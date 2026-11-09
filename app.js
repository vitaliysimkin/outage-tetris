(function () {
  const COLS = 10;
  const ROWS = 20;

  const COLORS = {
    I: "#4dd8ff",
    O: "#ffc83d",
    T: "#c77dff",
    S: "#5cff8f",
    Z: "#ff5c7a",
    J: "#4d6bff",
    L: "#ff9d4d"
  };

  // size = bounding box side, cells = [x, y] offsets within that box
  const SHAPES = {
    I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }
  };

  const board = document.getElementById("board");
  const ctx = board.getContext("2d");
  const nextCanvas = document.getElementById("next-piece");
  const nextCtx = nextCanvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlay-text");
  const overlayBtn = document.getElementById("overlay-btn");
  const scoreEl = document.getElementById("score");
  const rowsEl = document.getElementById("rows");
  const levelEl = document.getElementById("level");

  let grid, current, bag, score, lines, level, dropInterval, dropTimer, lastTick, running, over;

  function newBag() {
    const keys = Object.keys(SHAPES);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys;
  }

  function nextFromBag() {
    if (!bag || bag.length === 0) bag = newBag();
    return bag.pop();
  }

  function spawn(type) {
    const shape = SHAPES[type];
    return {
      type,
      size: shape.size,
      cells: shape.cells.map((c) => c.slice()),
      x: Math.floor((COLS - shape.size) / 2),
      y: type === "I" ? -1 : 0
    };
  }

  function rotateCells(piece) {
    const n = piece.size;
    return piece.cells.map(([x, y]) => [n - 1 - y, x]);
  }

  function collides(piece, offX, offY, cells) {
    const list = cells || piece.cells;
    for (const [cx, cy] of list) {
      const x = piece.x + cx + offX;
      const y = piece.y + cy + offY;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
    return false;
  }

  function lockPiece() {
    for (const [cx, cy] of current.cells) {
      const x = current.x + cx;
      const y = current.y + cy;
      if (y < 0) {
        gameOver();
        return;
      }
      grid[y][x] = current.type;
    }
    clearLines();
    current = spawn(nextType);
    nextType = nextFromBag();
    drawNext();
    if (collides(current, 0, 0)) gameOver();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every((v) => v)) {
        grid.splice(y, 1);
        grid.unshift(new Array(COLS).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      level = 1 + Math.floor(lines / 10);
      dropInterval = Math.max(120, 800 - (level - 1) * 70);
      updateHud();
    }
  }

  function updateHud() {
    scoreEl.textContent = score;
    rowsEl.textContent = lines;
    levelEl.textContent = level;
  }

  function move(dx) {
    if (!running || over) return;
    if (!collides(current, dx, 0)) current.x += dx;
    draw();
  }

  function softDrop() {
    if (!running || over) return;
    if (!collides(current, 0, 1)) {
      current.y += 1;
      score += 1;
      updateHud();
    } else {
      lockPiece();
    }
    draw();
  }

  function hardDrop() {
    if (!running || over) return;
    let dist = 0;
    while (!collides(current, 0, dist + 1)) dist++;
    current.y += dist;
    score += dist * 2;
    updateHud();
    lockPiece();
    draw();
  }

  function rotate() {
    if (!running || over) return;
    if (current.type === "O") return;
    const rotated = rotateCells(current);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(current, k, 0, rotated)) {
        current.cells = rotated;
        current.x += k;
        draw();
        return;
      }
    }
  }

  function cellSize() {
    const wrap = board.parentElement;
    const available = Math.min(wrap.clientWidth - 12, 300);
    const maxByHeight = Math.floor((window.innerHeight * 0.5) / ROWS);
    return Math.max(14, Math.min(Math.floor(available / COLS), maxByHeight));
  }

  function resize() {
    const size = cellSize();
    board.width = size * COLS;
    board.height = size * ROWS;
    board.cellSize = size;
    draw();
  }

  function drawCell(c, x, y, size, color) {
    c.fillStyle = color;
    c.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    c.fillStyle = "rgba(255,255,255,0.18)";
    c.fillRect(x * size + 1, y * size + 1, size - 2, 3);
  }

  function draw() {
    const size = board.cellSize || cellSize();
    ctx.fillStyle = "#0a0f1e";
    ctx.fillRect(0, 0, board.width, board.height);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * size, 0);
      ctx.lineTo(x * size, ROWS * size);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * size);
      ctx.lineTo(COLS * size, y * size);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) drawCell(ctx, x, y, size, COLORS[grid[y][x]]);
      }
    }

    if (current) {
      for (const [cx, cy] of current.cells) {
        const x = current.x + cx;
        const y = current.y + cy;
        if (y >= 0) drawCell(ctx, x, y, size, COLORS[current.type]);
      }
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = SHAPES[nextType];
    const size = Math.floor(nextCanvas.width / 4);
    const offset = Math.floor((4 - shape.size) / 2);
    shape.cells.forEach(([cx, cy]) => {
      drawCell(nextCtx, cx + offset, cy + offset, size, COLORS[nextType]);
    });
  }

  function gameOver() {
    over = true;
    running = false;
    overlayText.textContent = "Гра закінчена — рахунок " + score;
    overlayBtn.textContent = "Нова гра";
    overlay.classList.remove("hidden");
  }

  function tick(ts) {
    if (!running) return;
    if (!lastTick) lastTick = ts;
    if (ts - lastTick >= dropInterval) {
      lastTick = ts;
      if (!collides(current, 0, 1)) {
        current.y += 1;
      } else {
        lockPiece();
      }
      draw();
    }
    dropTimer = requestAnimationFrame(tick);
  }

  let nextType;

  function startGame() {
    grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    bag = newBag();
    nextType = nextFromBag();
    current = spawn(nextFromBag());
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 800;
    lastTick = null;
    over = false;
    running = true;
    updateHud();
    drawNext();
    resize();
    overlay.classList.add("hidden");
    cancelAnimationFrame(dropTimer);
    dropTimer = requestAnimationFrame(tick);
  }

  function togglePause() {
    if (over) return;
    running = !running;
    if (running) {
      lastTick = null;
      overlay.classList.add("hidden");
      dropTimer = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(dropTimer);
      overlayText.textContent = "Пауза";
      overlayBtn.textContent = "Продовжити";
      overlay.classList.remove("hidden");
    }
    document.getElementById("btn-pause").textContent = running ? "⏸ Пауза" : "▶ Далі";
  }

  document.getElementById("btn-left").addEventListener("click", () => move(-1));
  document.getElementById("btn-right").addEventListener("click", () => move(1));
  document.getElementById("btn-rotate").addEventListener("click", rotate);
  document.getElementById("btn-down").addEventListener("click", softDrop);
  document.getElementById("btn-drop").addEventListener("click", hardDrop);
  document.getElementById("btn-pause").addEventListener("click", togglePause);
  document.getElementById("btn-reset").addEventListener("click", startGame);
  overlayBtn.addEventListener("click", () => {
    if (over) startGame();
    else togglePause();
  });

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft") move(-1);
    else if (e.key === "ArrowRight") move(1);
    else if (e.key === "ArrowDown") softDrop();
    else if (e.key === "ArrowUp" || e.key === "x" || e.key === "X") rotate();
    else if (e.key === " ") hardDrop();
    else if (e.key === "p" || e.key === "P") togglePause();
  });

  // swipe gestures directly on the board for mobile
  let touchStartX = 0, touchStartY = 0, touchMoved = false;
  board.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchMoved = false;
  }, { passive: true });

  board.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const threshold = 24;
    if (Math.abs(dx) > threshold) {
      move(dx > 0 ? 1 : -1);
      touchStartX = t.clientX;
      touchMoved = true;
    } else if (dy > threshold) {
      softDrop();
      touchStartY = t.clientY;
      touchMoved = true;
    }
    e.preventDefault();
  }, { passive: false });

  board.addEventListener("touchend", (e) => {
    if (!touchMoved) rotate();
  });

  window.addEventListener("resize", resize);

  startGame();
})();
