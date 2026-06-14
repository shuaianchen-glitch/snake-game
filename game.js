const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startBtn = document.getElementById("start-btn");
const difficultyEl = document.getElementById("difficulty");
const wrapModeEl = document.getElementById("wrap-mode");
const soundEnabledEl = document.getElementById("sound-enabled");
const playUrlEl = document.getElementById("play-url");

const GRID = 20;
const CELL = canvas.width / GRID;

const DIFFICULTY = {
  easy: { baseSpeed: 180, minSpeed: 100, label: "\u7b80\u5355" },
  normal: { baseSpeed: 140, minSpeed: 70, label: "\u666e\u901a" },
  hard: { baseSpeed: 100, minSpeed: 50, label: "\u56f0\u96be" },
};

const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

let snake, direction, nextDirection, food, score, highScore;
let gameLoop = null;
let lastTick = 0;
let baseSpeed = DIFFICULTY.normal.baseSpeed;
let minSpeed = DIFFICULTY.normal.minSpeed;
let speed = baseSpeed;
let wrapMode = false;
let soundEnabled = true;
let audioCtx = null;
let state = "idle";

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem("snake-settings") || "{}");
  if (saved.difficulty && DIFFICULTY[saved.difficulty]) {
    difficultyEl.value = saved.difficulty;
  }
  wrapModeEl.checked = Boolean(saved.wrapMode);
  soundEnabledEl.checked = saved.soundEnabled !== false;
}

function saveSettings() {
  localStorage.setItem(
    "snake-settings",
    JSON.stringify({
      difficulty: difficultyEl.value,
      wrapMode: wrapModeEl.checked,
      soundEnabled: soundEnabledEl.checked,
    })
  );
}

function loadHighScore() {
  return parseInt(localStorage.getItem("snake-high-score") || "0", 10);
}

function saveHighScore(value) {
  localStorage.setItem("snake-high-score", String(value));
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type = "square", volume = 0.08) {
  if (!soundEnabled) return;
  ensureAudio();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

function playEatSound() {
  playTone(520, 0.08, "sine", 0.12);
  setTimeout(() => playTone(780, 0.06, "sine", 0.1), 50);
}

function playGameOverSound() {
  playTone(220, 0.15, "sawtooth", 0.1);
  setTimeout(() => playTone(140, 0.25, "sawtooth", 0.08), 120);
}

function playStartSound() {
  playTone(330, 0.06, "sine", 0.08);
  setTimeout(() => playTone(440, 0.08, "sine", 0.08), 70);
}

function applySettings() {
  const diff = DIFFICULTY[difficultyEl.value] || DIFFICULTY.normal;
  baseSpeed = diff.baseSpeed;
  minSpeed = diff.minSpeed;
  wrapMode = wrapModeEl.checked;
  soundEnabled = soundEnabledEl.checked;
  saveSettings();
}

function initGame() {
  applySettings();
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { ...direction };
  score = 0;
  speed = baseSpeed;
  scoreEl.textContent = "0";
  highScore = loadHighScore();
  highScoreEl.textContent = highScore;
  spawnFood();
}

function spawnFood() {
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (occupied.has(`${pos.x},${pos.y}`));
  food = pos;
}

function showOverlay(title, message, btnText, showSettings = false) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  startBtn.textContent = btnText;
  document.querySelector(".settings").style.display = showSettings ? "flex" : "none";
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function isOpposite(a, b) {
  return a.x + b.x === 0 && a.y + b.y === 0;
}

function setDirection(dir) {
  if (!dir || isOpposite(dir, direction)) return;
  nextDirection = dir;
}

function wrapPosition(head) {
  if (head.x < 0) head.x = GRID - 1;
  if (head.x >= GRID) head.x = 0;
  if (head.y < 0) head.y = GRID - 1;
  if (head.y >= GRID) head.y = 0;
}

function tick() {
  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  if (wrapMode) {
    wrapPosition(head);
  } else if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
    playGameOverSound();
    return gameOver();
  }

  if (snake.some((s) => s.x === head.x && s.y === head.y)) {
    playGameOverSound();
    return gameOver();
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    speed = Math.max(minSpeed, baseSpeed - Math.floor(score / 30) * 10);
    playEatSound();
    spawnFood();
  } else {
    snake.pop();
  }
}

function drawCell(x, y, color, glow) {
  const pad = 1;
  const px = x * CELL + pad;
  const py = y * CELL + pad;
  const size = CELL - pad * 2;

  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(px, py, size, size, 3);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawGrid() {
  ctx.fillStyle = "#1a2332";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = wrapMode ? "rgba(74, 222, 128, 0.15)" : "rgba(45, 58, 79, 0.4)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(canvas.width, i * CELL);
    ctx.stroke();
  }
}

function render() {
  drawGrid();
  drawCell(food.x, food.y, "#f87171", "rgba(248, 113, 113, 0.5)");
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    drawCell(
      seg.x,
      seg.y,
      isHead ? "#22c55e" : "#16a34a",
      isHead ? "rgba(74, 222, 128, 0.4)" : null
    );
  });
}

function loop(timestamp) {
  if (state !== "running") return;

  if (timestamp - lastTick >= speed) {
    tick();
    lastTick = timestamp;
    render();
  }

  gameLoop = requestAnimationFrame(loop);
}

function startGame() {
  initGame();
  state = "running";
  hideOverlay();
  lastTick = 0;
  playStartSound();
  render();
  cancelAnimationFrame(gameLoop);
  gameLoop = requestAnimationFrame(loop);
}

function gameOver() {
  state = "over";
  cancelAnimationFrame(gameLoop);

  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
    highScoreEl.textContent = highScore;
    showOverlay("\u65b0\u7eaa\u5f55\uff01", `\u5f97\u5206 ${score}\uff0c\u6309\u7a7a\u683c\u518d\u6765\u4e00\u5c40`, "\u518d\u6765\u4e00\u5c40", true);
  } else {
    showOverlay("\u6e38\u620f\u7ed3\u675f", `\u5f97\u5206 ${score}\uff0c\u6309\u7a7a\u683c\u518d\u6765\u4e00\u5c40`, "\u518d\u6765\u4e00\u5c40", true);
  }
}

function togglePause() {
  if (state === "running") {
    state = "paused";
    cancelAnimationFrame(gameLoop);
    showOverlay("\u5df2\u6682\u505c", "\u6309\u7a7a\u683c\u7ee7\u7eed", "\u7ee7\u7eed", false);
  } else if (state === "paused") {
    state = "running";
    hideOverlay();
    lastTick = performance.now();
    gameLoop = requestAnimationFrame(loop);
  }
}

function showPlayHint() {
  const host = location.hostname;
  if (location.protocol === "file:" || host === "localhost" || host === "127.0.0.1") {
    playUrlEl.classList.remove("hidden");
    playUrlEl.innerHTML =
      "\u672c\u5730\u6d4b\u8bd5\u5730\u5740\uff1a<code>" + location.href + "</code><br>\u5206\u4eab\u7ed9\u670b\u53cb\u9700\u8981\u90e8\u7f72\u5230\u4e92\u8054\u7f51\uff0c\u89c1\u9879\u76ee\u91cc\u7684 deploy.sh";
  } else {
    playUrlEl.classList.add("hidden");
  }
}

function setupSwipeControls() {
  let startX = 0;
  let startY = 0;

  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      if (state !== "running" && state !== "idle" && state !== "over") return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < 24) return;

      if (state === "idle" || state === "over") startGame();

      if (absX > absY) {
        setDirection(dx > 0 ? DIRECTIONS.ArrowRight : DIRECTIONS.ArrowLeft);
      } else {
        setDirection(dy > 0 ? DIRECTIONS.ArrowDown : DIRECTIONS.ArrowUp);
      }
    },
    { passive: true }
  );
}

document.addEventListener("keydown", (e) => {
  const key = e.key;

  if (key === " " || key === "Spacebar") {
    e.preventDefault();
    if (state === "idle" || state === "over") {
      startGame();
    } else {
      togglePause();
    }
    return;
  }

  if (state !== "running") return;

  const dir = DIRECTIONS[key];
  if (dir) {
    e.preventDefault();
    setDirection(dir);
  }
});

startBtn.addEventListener("click", () => {
  if (state === "idle" || state === "over") {
    startGame();
  } else if (state === "paused") {
    togglePause();
  }
});

[difficultyEl, wrapModeEl, soundEnabledEl].forEach((el) => {
  el.addEventListener("change", saveSettings);
});

document.querySelectorAll(".touch-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const map = {
      up: DIRECTIONS.ArrowUp,
      down: DIRECTIONS.ArrowDown,
      left: DIRECTIONS.ArrowLeft,
      right: DIRECTIONS.ArrowRight,
    };
    if (state === "idle" || state === "over") {
      startGame();
    }
    setDirection(map[btn.dataset.dir]);
  });
});

loadSettings();
highScoreEl.textContent = loadHighScore();
setupSwipeControls();
showPlayHint();
showOverlay("\u8d2a\u5403\u86c7", "\u9009\u62e9\u8bbe\u7f6e\u540e\u5f00\u59cb\u6e38\u620f", "\u5f00\u59cb\u6e38\u620f", true);
render();
