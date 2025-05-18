const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

// 消去アニメーション用の状態
let clearingRows = [];
let clearingAlpha = 1;
let clearing = false;
const CLEAR_ANIMATION_DURATION = 400; // ms
let clearStartTime = 0;

// 吹き出し演出用
let popups = [];
const POPUP_DURATION = 700; // ms

// NEXTブロック表示用
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
nextCtx.scale(20, 20);

// スコア管理
let score = 0;
let combo = 0;
function updateScoreDisplay() {
  document.getElementById('score').textContent = score;
}

// プレイヤーの次ブロック
let nextPieceType = null;

// 効果音再生
function playClearSound() {
  const audio = document.getElementById('clear-audio');
  const bgm = document.getElementById('bgm-audio');
  if (bgm) {
    bgm.volume = 0.03;
    bgm.pause();
  }
  if (audio) {
    audio.volume = 1.0;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    // onendedでBGM再開
    audio.onended = () => {
      if (bgm) {
        bgm.volume = 0.25;
        bgm.play().catch(() => {});
      }
    };
    // iOS対策: 0.5秒後にBGM再開（onendedが発火しない場合もカバー）
    setTimeout(() => {
      if (bgm && bgm.paused) {
        bgm.volume = 0.25;
        bgm.play().catch(() => {});
      }
    }, 500);
  }
}

function arenaSweep() {
  let rowsToClear = [];
  for (let y = arena.length - 1; y >= 0; --y) {
    if (arena[y].every(cell => cell !== 0)) {
      rowsToClear.push(y);
    }
  }
  if (rowsToClear.length > 0) {
    playClearSound();
    // 吹き出し追加
    for (const y of rowsToClear) {
      popups.push({
        text: rowsToClear.length > 1 ? `${rowsToClear.length}連消し!` : 'ナイス！',
        y: y,
        time: performance.now(),
      });
    }
    // スコア加算
    const base = [0, 100, 300, 500, 800];
    score += (base[rowsToClear.length] || (rowsToClear.length * 200)) + combo * 50;
    combo++;
    updateScoreDisplay();
    clearingRows = rowsToClear;
    clearingAlpha = 1;
    clearing = true;
    clearStartTime = performance.now();
  } else {
    combo = 0;
  }
}

function applyClearRows() {
  // 実際に行を消す（高い行から順に消すことでインデックスずれを防ぐ）
  clearingRows.sort((a, b) => b - a);
  for (const y of clearingRows) {
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
  }
  clearingRows = [];
  clearing = false;
  // 連続消し対応: さらに消せる行があれば再度アニメーション
  arenaSweep();
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (
        m[y][x] !== 0 &&
        (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  if (type === 'T') {
    return [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ];
  } else if (type === 'O') {
    return [
      [2, 2],
      [2, 2],
    ];
  } else if (type === 'L') {
    return [
      [0, 3, 0],
      [0, 3, 0],
      [0, 3, 3],
    ];
  } else if (type === 'J') {
    return [
      [0, 4, 0],
      [0, 4, 0],
      [4, 4, 0],
    ];
  } else if (type === 'I') {
    return [
      [0, 5, 0, 0],
      [0, 5, 0, 0],
      [0, 5, 0, 0],
      [0, 5, 0, 0],
    ];
  } else if (type === 'S') {
    return [
      [0, 6, 6],
      [6, 6, 0],
      [0, 0, 0],
    ];
  } else if (type === 'Z') {
    return [
      [7, 7, 0],
      [0, 7, 7],
      [0, 0, 0],
    ];
  }
}

function drawMatrix(matrix, offset, rowAlphaList) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        let alpha = 1;
        if (rowAlphaList && rowAlphaList[y] !== undefined) {
          alpha = rowAlphaList[y];
        }
        context.save();
        context.globalAlpha = alpha;
        // グラデーション
        const grad = context.createLinearGradient(
          x + offset.x, y + offset.y, x + offset.x, y + offset.y + 1
        );
        grad.addColorStop(0, lightenColor(colors[value], 0.35));
        grad.addColorStop(1, darkenColor(colors[value], 0.25));
        context.fillStyle = grad;
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
        // 白い枠線
        context.strokeStyle = '#fff';
        context.lineWidth = 0.08;
        context.strokeRect(x + offset.x, y + offset.y, 1, 1);
        context.restore();
      }
    });
  });
}

function draw() {
  // グラデーション背景
  const grad = context.createLinearGradient(0, 0, 0, canvas.height / 20);
  grad.addColorStop(0, 'rgba(30,30,60,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0.7)');
  context.fillStyle = grad;
  context.fillRect(0, 0, canvas.width, canvas.height);
  // arenaの各行ごとにalphaを決める
  let rowAlphaList = Array(arena.length).fill(1);
  if (clearing) {
    for (const y of clearingRows) {
      rowAlphaList[y] = clearingAlpha;
    }
  }
  // arena描画
  arena.forEach((row, y) => {
    drawMatrix([row], { x: 0, y: y }, [rowAlphaList[y]]);
  });
  // プレイヤーは常にalpha=1
  drawMatrix(player.matrix, player.pos);

  // 吹き出し描画
  const now = performance.now();
  popups = popups.filter(p => now - p.time < POPUP_DURATION);
  for (const p of popups) {
    const t = (now - p.time) / POPUP_DURATION;
    context.save();
    context.globalAlpha = 1 - t;
    context.font = 'bold 1.2px sans-serif';
    context.fillStyle = '#FFD700';
    context.strokeStyle = '#fff';
    context.lineWidth = 0.08;
    // 吹き出しを中央に表示
    const text = p.text;
    const x = 6; // フィールド中央
    const y = p.y + 0.5 - t * 1.5; // 上に浮かぶ
    context.strokeText(text, x - text.length * 0.3, y);
    context.fillText(text, x - text.length * 0.3, y);
    context.restore();
  }
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

// --- 即落下後の回転猶予（lock delay）実装 ---
let lockDelay = 0;
const LOCK_DELAY_TIME = 200; // ms
let lockDelayActive = false;

function playerDrop() {
  if (clearing) return; // アニメーション中は操作不可
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    if (!lockDelayActive) {
      lockDelayActive = true;
      lockDelay = performance.now();
      // lock delay中はreturnし、一定時間後に本当にロック
      setTimeout(() => {
        if (lockDelayActive) {
          merge(arena, player);
          playerReset();
          arenaSweep();
          lockDelayActive = false;
        }
      }, LOCK_DELAY_TIME);
      return;
    } else {
      merge(arena, player);
      playerReset();
      arenaSweep();
      lockDelayActive = false;
    }
  } else {
    lockDelayActive = false;
  }
  dropCounter = 0;
}

// lock delay中は回転・移動を許可
function playerMove(dir) {
  if (clearing) return;
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function playerReset() {
  const pieces = 'TJLOSZI';
  // 最初だけnextPieceTypeがnullなのでランダム生成
  if (!nextPieceType) {
    nextPieceType = pieces[(pieces.length * Math.random()) | 0];
  }
  player.matrix = createPiece(nextPieceType);
  player.pos.y = 0;
  player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
  // 次のブロックを決めておく
  nextPieceType = pieces[(pieces.length * Math.random()) | 0];
  drawNext();
  if (collide(arena, player)) {
    arena.forEach(row => row.fill(0));
    score = 0;
    combo = 0;
    updateScoreDisplay();
    alert('ゲームオーバー!');
  }
}

function playerRotate(dir) {
  if (clearing) return;
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
  // lock delay中に回転したら、lock delayをリセット
  if (lockDelayActive) {
    lockDelay = performance.now();
  }
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function drawNext() {
  nextCtx.save();
  nextCtx.setTransform(1, 0, 0, 1, 0, 0); // リセット
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.scale(20, 20);
  if (!nextPieceType) return;
  const matrix = createPiece(nextPieceType);
  // 中央に描画
  const offsetX = Math.floor((4 - matrix[0].length) / 2);
  const offsetY = Math.floor((4 - matrix.length) / 2);
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        // グラデーション
        const grad = nextCtx.createLinearGradient(
          x + offsetX, y + offsetY, x + offsetX, y + offsetY + 1
        );
        grad.addColorStop(0, lightenColor(colors[value], 0.35));
        grad.addColorStop(1, darkenColor(colors[value], 0.25));
        nextCtx.fillStyle = grad;
        nextCtx.fillRect(x + offsetX, y + offsetY, 1, 1);
        // 白い枠線
        nextCtx.strokeStyle = '#fff';
        nextCtx.lineWidth = 0.08;
        nextCtx.strokeRect(x + offsetX, y + offsetY, 1, 1);
      }
    });
  });
  nextCtx.restore();
}

// 色を明るくする
function lightenColor(hex, lum) {
  hex = String(hex).replace(/[^0-9a-f]/gi, '');
  if (hex.length < 6) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  let rgb = "#", c, i;
  for (i = 0; i < 3; i++) {
    c = parseInt(hex.substr(i*2,2), 16);
    c = Math.min(255, Math.floor(c + (255 - c) * lum));
    rgb += ("0"+c.toString(16)).substr(-2);
  }
  return rgb;
}
// 色を暗くする
function darkenColor(hex, lum) {
  hex = String(hex).replace(/[^0-9a-f]/gi, '');
  if (hex.length < 6) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  let rgb = "#", c, i;
  for (i = 0; i < 3; i++) {
    c = parseInt(hex.substr(i*2,2), 16);
    c = Math.max(0, Math.floor(c * (1 - lum)));
    rgb += ("0"+c.toString(16)).substr(-2);
  }
  return rgb;
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;
  if (clearing) {
    // アニメーション進行
    const elapsed = time - clearStartTime;
    clearingAlpha = Math.max(0, 1 - elapsed / CLEAR_ANIMATION_DURATION);
    if (clearingAlpha <= 0) {
      applyClearRows();
    }
    // アニメーション中はドロップ進行しない
  } else {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
  }
  draw();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
  if (event.keyCode === 37) {
    playerMove(-1);
  } else if (event.keyCode === 39) {
    playerMove(1);
  } else if (event.keyCode === 40) {
    playerDrop();
  } else if (event.keyCode === 81) {
    playerRotate(-1);
  } else if (event.keyCode === 38) {
    playerRotate(1);
  } else if (event.keyCode === 32) {
    while (!collide(arena, player)) {
      player.pos.y++;
    }
    player.pos.y--;
    playerDrop();
  }
});

const colors = [
  null,
  '#FF0D72',
  '#0DC2FF',
  '#0DFF72',
  '#F538FF',
  '#FF8E0D',
  '#FFE138',
  '#3877FF',
];

const arena = createMatrix(12, 20);
const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
};

playerReset();
update();

// BGM自動再生
function playBGM() {
  const bgm = document.getElementById('bgm-audio');
  if (bgm && bgm.paused) {
    bgm.volume = 0.25;
    bgm.play().catch(() => {});
  }
}
playBGM();
// ユーザー操作時にも再生を試みる（自動再生制限対策）
document.addEventListener('keydown', playBGM);

// タッチ操作対応
function setupTouchControls() {
  const btnLeft = document.getElementById('left');
  const btnRight = document.getElementById('right');
  const btnDown = document.getElementById('down');
  const btnRotate = document.getElementById('rotate');
  const btnDrop = document.getElementById('drop');
  const playAllSounds = () => {
    playBGM();
    const audio = document.getElementById('clear-audio');
    if (audio) audio.volume = 1.0;
  };
  if (btnLeft) btnLeft.addEventListener('touchstart', e => { e.preventDefault(); playAllSounds(); playerMove(-1); });
  if (btnRight) btnRight.addEventListener('touchstart', e => { e.preventDefault(); playAllSounds(); playerMove(1); });
  if (btnDown) btnDown.addEventListener('touchstart', e => { e.preventDefault(); playAllSounds(); playerDrop(); });
  if (btnRotate) btnRotate.addEventListener('touchstart', e => { e.preventDefault(); playAllSounds(); playerRotate(1); });
  if (btnDrop) btnDrop.addEventListener('touchstart', e => { e.preventDefault(); playAllSounds(); while (!collide(arena, player)) { player.pos.y++; } player.pos.y--; playerDrop(); });
}
setupTouchControls(); 