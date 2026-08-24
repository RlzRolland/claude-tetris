'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SKINS = {
  retro: {
    colors: COLORS,
  },
  neon: {
    colors: [
      null,
      '#00e5ff', // I
      '#faff00', // O
      '#ff00e5', // T
      '#00ff66', // S
      '#ff2d55', // Z
      '#4d7bff', // J
      '#ff9100', // L
    ],
    bg: '#000000',
    gridColor: 'rgba(0, 229, 255, 0.12)',
    glow: true,
  },
  pastel: {
    colors: [
      null,
      '#a8e6e6', // I
      '#fff3b0', // O
      '#dcc6f0', // T
      '#c8e6c9', // S
      '#f8bcbc', // Z
      '#c5d9f7', // J
      '#ffd8a8', // L
    ],
    rounded: true,
  },
  pixel: {
    colors: COLORS,
    pixelTexture: true,
  },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let board, current, next, hold, holdUsed, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor = '#22222e';
let currentSkin = 'retro';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim() || gridColor;
  localStorage.setItem('tetris-theme', theme);
  themeToggle.checked = theme === 'light';
}

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

applyTheme(localStorage.getItem('tetris-theme') === 'light' ? 'light' : 'dark');

function applySkin(skin) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  localStorage.setItem('tetris-skin', currentSkin);
  skinSelect.value = currentSkin;
  // Guard: before init() runs, board/current/next don't exist yet, so skip redraw.
  if (board) {
    draw();
    drawNext();
    drawHold();
  }
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
});

applySkin(localStorage.getItem('tetris-skin') || 'retro');

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return makePiece(Math.floor(Math.random() * 7) + 1);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
  holdUsed = false;
  drawHold();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function holdPiece() {
  if (holdUsed) return;
  if (hold === null) {
    hold = current.type;
    spawn();
  } else {
    const heldType = hold;
    hold = current.type;
    current = makePiece(heldType);
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
  }
  holdUsed = true;
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  const color = skin.colors[colorIndex] || COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;

  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  const radius = Math.min(6, w / 3, h / 3);

  const tracePath = () => {
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(px, py, w, h, radius);
    } else {
      context.moveTo(px + radius, py);
      context.arcTo(px + w, py, px + w, py + h, radius);
      context.arcTo(px + w, py + h, px, py + h, radius);
      context.arcTo(px, py + h, px, py, radius);
      context.arcTo(px, py, px + w, py, radius);
      context.closePath();
    }
  };

  if (skin.glow) {
    context.shadowBlur = 12;
    context.shadowColor = color;
  }

  context.fillStyle = color;
  if (skin.rounded) {
    tracePath();
    context.fill();
  } else {
    context.fillRect(px, py, w, h);
  }

  if (skin.glow) {
    context.shadowBlur = 0;
  }

  // highlight (clipped to the rounded silhouette so it doesn't poke past the corners)
  context.fillStyle = 'rgba(255,255,255,0.12)';
  if (skin.rounded) {
    context.save();
    tracePath();
    context.clip();
    context.fillRect(px, py, w, 4);
    context.restore();
  } else {
    context.fillRect(px, py, w, 4);
  }

  // pixel-art texture: small darker/lighter sub-squares overlaid on the block
  if (skin.pixelTexture) {
    const half = size / 2;
    context.fillStyle = 'rgba(0,0,0,0.15)';
    context.fillRect(px, py, half - 1, half - 1);
    context.fillRect(px + half, py + half, w - half, h - half);
    context.fillStyle = 'rgba(255,255,255,0.10)';
    context.fillRect(px + half, py, w - half, half - 1);
    context.fillRect(px, py + half, half - 1, h - half);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  const skin = SKINS[currentSkin] || SKINS.retro;
  ctx.strokeStyle = skin.gridColor || gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function fillSkinBackground(context, w, h) {
  context.clearRect(0, 0, w, h);
  const skin = SKINS[currentSkin] || SKINS.retro;
  if (skin.bg) {
    context.fillStyle = skin.bg;
    context.fillRect(0, 0, w, h);
  }
}

function draw() {
  fillSkinBackground(ctx, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (gameOver) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  fillSkinBackground(nextCtx, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function drawHold() {
  const HB = 30;
  fillSkinBackground(holdCtx, holdCanvas.width, holdCanvas.height);
  if (hold !== null) {
    const shape = PIECES[hold];
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(holdCtx, offX + c, offY + r, shape[r][c], HB);
  }
  holdCanvas.classList.toggle('dimmed', holdUsed);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver && !paused) {
    animId = requestAnimationFrame(loop);
  }
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  holdUsed = false;
  next = randomPiece();
  spawn();
  updateHUD();
  drawHold();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
