const navToggle = document.querySelector('.nav-toggle');
const siteMenu = document.querySelector('#site-menu');

if (navToggle && siteMenu) {
  const closeMenu = () => {
    siteMenu.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  navToggle.addEventListener('click', () => {
    const isOpen = siteMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  siteMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

const canvas = document.querySelector('#game-canvas');
const gameStatus = document.querySelector('#game-status');
const scoreElement = document.querySelector('#score');
const highScoreElement = document.querySelector('#high-score');
const startButton = document.querySelector('#start-game');
const pauseButton = document.querySelector('#pause-game');
const restartButton = document.querySelector('#restart-game');
const touchButtons = document.querySelectorAll('[data-direction]');

if (canvas && gameStatus && scoreElement && highScoreElement && startButton && pauseButton && restartButton) {
  const context = canvas.getContext('2d');
  const GRID = 22;
  const COLUMNS = Math.floor(canvas.width / GRID);
  const ROWS = Math.floor(canvas.height / GRID);
  const TICK_MS = 135;
  const MAX_ENEMIES = 5;
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const enemySizes = [12, 16, 21, 26, 32];
  const state = {
    phase: 'idle',
    snake: [],
    direction: DIRECTIONS.right,
    nextDirection: DIRECTIONS.right,
    food: { x: 0, y: 0 },
    score: 0,
    highScore: readHighScore(),
    enemies: [],
    timerId: null,
  };

  function readHighScore() {
    try {
      return Number(window.localStorage.getItem('enemy-sweep-high-score')) || 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore() {
    try {
      window.localStorage.setItem('enemy-sweep-high-score', String(state.highScore));
    } catch {
      // Storage may be unavailable in private browsing; the game still works.
    }
  }

  function randomInteger(max) {
    return Math.floor(Math.random() * max);
  }

  function randomFreeCell() {
    const occupied = new Set(state.snake.map((segment) => `${segment.x},${segment.y}`));
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = { x: randomInteger(COLUMNS), y: randomInteger(ROWS) };
      if (!occupied.has(`${candidate.x},${candidate.y}`)) return candidate;
    }
    return { x: 1, y: 1 };
  }

  function randomEnemy(enemy = {}) {
    const margin = 30;
    return {
      ...enemy,
      x: margin + Math.random() * (canvas.width - margin * 2),
      y: margin + Math.random() * (canvas.height - margin * 2),
      vx: (Math.random() > .5 ? 1 : -1) * (.45 + Math.random() * .7),
      vy: (Math.random() > .5 ? 1 : -1) * (.45 + Math.random() * .7),
      size: enemy.size || enemySizes[randomInteger(enemySizes.length)],
      active: true,
      explodeAt: Date.now() + 3000 + Math.random() * 2000,
      respawnAt: 0,
      explodedAt: 0,
    };
  }

  function clearGameTimer() {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startGameTimer() {
    clearGameTimer();
    state.timerId = window.setInterval(tick, TICK_MS);
  }

  function setStatus(message) {
    gameStatus.textContent = message;
  }

  function updateScore() {
    scoreElement.textContent = String(state.score);
    highScoreElement.textContent = String(state.highScore);
  }

  function resetGame() {
    clearGameTimer();
    state.phase = 'idle';
    state.snake = [
      { x: Math.floor(COLUMNS / 2), y: Math.floor(ROWS / 2) },
      { x: Math.floor(COLUMNS / 2) - 1, y: Math.floor(ROWS / 2) },
      { x: Math.floor(COLUMNS / 2) - 2, y: Math.floor(ROWS / 2) },
    ];
    state.direction = DIRECTIONS.right;
    state.nextDirection = DIRECTIONS.right;
    state.score = 0;
    state.food = randomFreeCell();
    state.enemies = Array.from({ length: MAX_ENEMIES }, () => randomEnemy());
    updateScore();
    updateControls();
    setStatus('시작 버튼을 눌러 게임을 시작하세요.');
    draw();
  }

  function startGame() {
    if (state.phase === 'running') return;
    if (state.phase === 'gameover') resetGame();
    state.phase = 'running';
    startGameTimer();
    updateControls();
    setStatus('게임 진행 중 · 적과 벽을 피하세요.');
  }

  function pauseGame() {
    if (state.phase === 'running') {
      clearGameTimer();
      state.phase = 'paused';
      setStatus('일시정지됨 · 다시 시작하려면 계속 버튼을 누르세요.');
    } else if (state.phase === 'paused') {
      state.phase = 'running';
      startGameTimer();
      setStatus('게임 진행 중 · 적과 벽을 피하세요.');
    }
    updateControls();
    draw();
  }

  function restartGame() {
    resetGame();
    startGame();
  }

  function updateControls() {
    pauseButton.disabled = !['running', 'paused'].includes(state.phase);
    pauseButton.textContent = state.phase === 'paused' ? '계속' : '일시정지';
    startButton.disabled = state.phase === 'running';
  }

  function changeDirection(name) {
    const next = DIRECTIONS[name];
    if (!next || (next.x + state.direction.x === 0 && next.y + state.direction.y === 0)) return;
    state.nextDirection = next;
  }

  function isSnakeCollision(head) {
    return state.snake.some((segment) => segment.x === head.x && segment.y === head.y);
  }

  function updateEnemies(now) {
    state.enemies = state.enemies.map((enemy) => {
      if (!enemy.active) {
        if (now >= enemy.respawnAt) return randomEnemy({ size: enemy.size });
        return enemy;
      }
      if (now >= enemy.explodeAt) {
        return { ...enemy, active: false, explodedAt: now, respawnAt: now + 2000 };
      }
      const next = { ...enemy, x: enemy.x + enemy.vx, y: enemy.y + enemy.vy };
      if (next.x < enemy.size || next.x > canvas.width - enemy.size) next.vx *= -1;
      if (next.y < enemy.size || next.y > canvas.height - enemy.size) next.vy *= -1;
      return next;
    });
  }

  function enemyCollision(head) {
    const headX = head.x * GRID + GRID / 2;
    const headY = head.y * GRID + GRID / 2;
    return state.enemies.some((enemy) => {
      if (!enemy.active) return false;
      const distance = Math.hypot(headX - enemy.x, headY - enemy.y);
      return distance < enemy.size + GRID * .35;
    });
  }

  function endGame(message) {
    clearGameTimer();
    state.phase = 'gameover';
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveHighScore();
    }
    updateScore();
    updateControls();
    setStatus(message);
    draw();
  }

  function tick() {
    if (state.phase !== 'running') return;
    state.direction = state.nextDirection;
    const head = state.snake[0];
    const nextHead = { x: head.x + state.direction.x, y: head.y + state.direction.y };
    if (nextHead.x < 0 || nextHead.x >= COLUMNS || nextHead.y < 0 || nextHead.y >= ROWS || isSnakeCollision(nextHead)) {
      endGame('게임 오버 · 벽 또는 자기 몸에 부딪혔습니다.');
      return;
    }
    state.snake.unshift(nextHead);
    const ateFood = nextHead.x === state.food.x && nextHead.y === state.food.y;
    if (ateFood) {
      state.score += 10;
      state.food = randomFreeCell();
      if (state.score > state.highScore) state.highScore = state.score;
      updateScore();
    } else {
      state.snake.pop();
    }
    const now = Date.now();
    updateEnemies(now);
    if (enemyCollision(nextHead)) {
      endGame('게임 오버 · 적과 충돌했습니다.');
      return;
    }
    draw(now);
  }

  function drawGrid() {
    context.strokeStyle = 'rgba(97, 255, 145, .08)';
    context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += GRID) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += GRID) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
    }
  }

  function drawFood() {
    const x = state.food.x * GRID + GRID / 2;
    const y = state.food.y * GRID + GRID / 2;
    context.fillStyle = '#67e8ff';
    context.shadowColor = '#67e8ff';
    context.shadowBlur = 12;
    context.beginPath(); context.moveTo(x, y - 7); context.lineTo(x + 7, y); context.lineTo(x, y + 7); context.lineTo(x - 7, y); context.closePath(); context.fill();
    context.shadowBlur = 0;
  }

  function drawSnake() {
    state.snake.forEach((segment, index) => {
      const padding = index === 0 ? 2 : 4;
      context.fillStyle = index === 0 ? '#b6ffc8' : '#61ff91';
      context.shadowColor = '#61ff91';
      context.shadowBlur = index === 0 ? 14 : 7;
      context.fillRect(segment.x * GRID + padding, segment.y * GRID + padding, GRID - padding * 2, GRID - padding * 2);
    });
    context.shadowBlur = 0;
  }

  function drawEnemies(now = Date.now()) {
    state.enemies.forEach((enemy) => {
      if (!enemy.active) {
        const elapsed = now - enemy.explodedAt;
        if (elapsed < 2000) {
          context.strokeStyle = `rgba(202, 125, 255, ${1 - elapsed / 2000})`;
          context.lineWidth = 2;
          context.beginPath(); context.arc(enemy.x, enemy.y, enemy.size + elapsed / 8, 0, Math.PI * 2); context.stroke();
        }
        return;
      }
      context.fillStyle = enemy.size >= 26 ? '#ca7dff' : '#67e8ff';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = 15;
      context.beginPath(); context.arc(enemy.x, enemy.y, enemy.size / 2, 0, Math.PI * 2); context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = '#050907';
      context.lineWidth = 2;
      context.beginPath(); context.arc(enemy.x, enemy.y, enemy.size / 4, 0, Math.PI * 2); context.stroke();
    });
  }

  function draw(now = Date.now()) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#030806';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawFood();
    drawEnemies(now);
    drawSnake();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      pauseGame();
      return;
    }
    const direction = keys[event.key];
    if (direction) {
      event.preventDefault();
      changeDirection(direction);
    }
  });

  touchButtons.forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      changeDirection(button.dataset.direction);
    });
  });
  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', pauseGame);
  restartButton.addEventListener('click', restartGame);

  window.__wormGame = {
    getState: () => ({ phase: state.phase, score: state.score, highScore: state.highScore, snakeLength: state.snake.length, enemyCount: state.enemies.length, activeEnemies: state.enemies.filter((enemy) => enemy.active).length, timerActive: state.timerId !== null }),
    start: startGame,
    pause: pauseGame,
    restart: restartGame,
    direction: changeDirection,
  };

  resetGame();
}
