(function () {
  const GROUPS = ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2"];
  const ROWS = 24;
  const BEST_KEY = "outage-tetris-best";

  const game = new TetrisGame({ cols: GROUPS.length, rows: ROWS });
  window.__tetris = game;

  const $ = (id) => document.getElementById(id);
  const boardEl = $("board");
  const stageEl = $("stage");
  const overlay = $("overlay");
  const overlayTitle = $("overlay-title");
  const overlayText = $("overlay-text");
  const overlayBtn = $("overlay-btn");
  const pauseBtn = $("pause-btn");
  const scoreEl = $("score");
  const linesEl = $("lines");
  const levelEl = $("level");
  const nextEl = $("next");

  let mode = "start"; // start | play | pause | over
  let best = readBest();

  const date = new Date().toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  $("title").textContent = "Тетріс: графік відключень на " + date;

  function readBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; }
  }

  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* storage unavailable */ }
  }

  // board DOM
  const cells = [];
  const prevClass = [];
  function div(cls, text) {
    const d = document.createElement("div");
    d.className = cls;
    if (text) d.textContent = text;
    boardEl.appendChild(d);
    return d;
  }
  div("head", "Час/Гр.");
  GROUPS.forEach((g) => div("head", g));
  for (let r = 0; r < ROWS; r++) {
    const pad = (n) => String(n).padStart(2, "0");
    div("hour", pad(r) + "-" + pad(r + 1));
    cells.push([]);
    prevClass.push([]);
    for (let c = 0; c < GROUPS.length; c++) {
      cells[r].push(div("cell"));
      prevClass[r].push("cell");
    }
  }

  const nextCells = [];
  for (let i = 0; i < 8; i++) {
    const el = document.createElement("i");
    nextEl.appendChild(el);
    nextCells.push(el);
  }

  function layout() {
    const w = stageEl.clientWidth;
    const h = stageEl.clientHeight;
    const cell = Math.max(10, Math.floor(Math.min((w - 13) / 12.6, (h - 27) / (ROWS + 1))));
    document.documentElement.style.setProperty("--cell", cell + "px");
    document.documentElement.style.setProperty("--hour-w", Math.round(cell * 2.6) + "px");
  }

  let lastNext = null;
  function renderNext() {
    if (game.next === lastNext) return;
    lastNext = game.next;
    const m = TetrisGame.SHAPES[game.next];
    const pts = [];
    m.forEach((row, y) => row.forEach((v, x) => { if (v) pts.push([x, y]); }));
    const minX = Math.min(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1]));
    const w = Math.max(...pts.map((p) => p[0])) - minX + 1;
    const off = Math.floor((4 - w) / 2);
    nextCells.forEach((el) => { el.className = ""; });
    pts.forEach(([x, y]) => { nextCells[(y - minY) * 4 + (x - minX + off)].className = "on"; });
  }

  function render() {
    const want = [];
    for (let r = 0; r < ROWS; r++) {
      want.push([]);
      for (let c = 0; c < GROUPS.length; c++) want[r].push(game.board[r + game.hidden][c] ? "cell off" : "cell");
    }
    if (game.piece) {
      const gy = game.ghostY() - game.piece.y;
      for (const [x, y] of game.cells()) {
        const r = y + gy - game.hidden;
        if (r >= 0 && want[r][x] === "cell") want[r][x] = "cell ghost";
      }
      for (const [x, y] of game.cells()) {
        const r = y - game.hidden;
        if (r >= 0) want[r][x] = "cell on";
      }
    }
    if (game.clearing) {
      for (const y of game.clearing.rows) {
        const r = y - game.hidden;
        if (r >= 0) for (let c = 0; c < GROUPS.length; c++) want[r][c] = "cell flash";
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < GROUPS.length; c++) {
        if (prevClass[r][c] !== want[r][c]) {
          cells[r][c].className = want[r][c];
          prevClass[r][c] = want[r][c];
        }
      }
    }
    scoreEl.textContent = game.score;
    linesEl.textContent = game.lines;
    levelEl.textContent = game.level;
    renderNext();
  }

  function showOverlay(title, text, btn) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBtn.textContent = btn;
    overlay.hidden = false;
  }

  function setMode(m) {
    mode = m;
    pauseBtn.textContent = m === "pause" ? "▶" : "❚❚";
    if (m === "play") {
      overlay.hidden = true;
    } else if (m === "pause") {
      showOverlay("Пауза", "", "Продовжити");
    } else if (m === "over") {
      if (game.score > best) { best = game.score; saveBest(best); }
      showOverlay("Світло вимкнули", "Рахунок: " + game.score + "\nРекорд: " + best, "Ще раз");
    } else {
      showOverlay("Тетріс", "◀ ▶ — рух, ↻ — обертання\n▼ — вниз, ⤓ — скинути\nабо свайпи й тап по полю" +
        (best ? "\n\nРекорд: " + best : ""), "Грати");
    }
  }

  function newGame() {
    game.reset();
    lastTime = 0;
    setMode("play");
  }

  function act(action) {
    if (action === "restart") return newGame();
    if (action === "pause") {
      if (mode === "play") setMode("pause");
      else if (mode === "pause") setMode("play");
      else if (mode === "start" || mode === "over") newGame();
      return;
    }
    if (mode !== "play") return;
    if (action === "left") game.move(-1);
    else if (action === "right") game.move(1);
    else if (action === "down") game.softDrop();
    else if (action === "rotate") game.rotate(1);
    else if (action === "rotateCCW") game.rotate(-1);
    else if (action === "drop") game.hardDrop();
    render();
  }

  // main loop
  let lastTime = 0;
  function frame(t) {
    const dt = lastTime ? Math.min(t - lastTime, 100) : 0;
    lastTime = t;
    if (mode === "play") {
      game.tick(dt);
      if (game.over) setMode("over");
    }
    render();
    requestAnimationFrame(frame);
  }

  function capture(el, id) {
    try { el.setPointerCapture(id); } catch (e) { /* pointer already released */ }
  }

  // on-screen buttons with hold-to-repeat
  const REPEAT = { left: [170, 55], right: [170, 55], down: [120, 35] };
  document.querySelectorAll("[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    let delay = null;
    let interval = null;
    const stop = () => {
      clearTimeout(delay);
      clearInterval(interval);
      btn.classList.remove("pressed");
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      capture(btn, e.pointerId);
      btn.classList.add("pressed");
      act(action);
      const rep = REPEAT[action];
      if (rep) {
        delay = setTimeout(() => { interval = setInterval(() => act(action), rep[1]); }, rep[0]);
      }
    });
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("lostpointercapture", stop);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  overlayBtn.addEventListener("click", () => {
    if (mode === "pause") setMode("play");
    else newGame();
  });

  // swipe / tap gestures on the board
  let g = null;
  boardEl.addEventListener("pointerdown", (e) => {
    if (mode !== "play") return;
    e.preventDefault();
    capture(boardEl, e.pointerId);
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ax: e.clientX, ay: e.clientY, t0: performance.now(), moved: false };
  });
  boardEl.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    const step = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell")) || 20;
    while (e.clientX - g.ax >= step) { act("right"); g.ax += step; g.moved = true; }
    while (g.ax - e.clientX >= step) { act("left"); g.ax -= step; g.moved = true; }
    while (e.clientY - g.ay >= step) { act("down"); g.ay += step; g.moved = true; }
    if (Math.abs(e.clientY - g.y0) > 10 || Math.abs(e.clientX - g.x0) > 10) g.moved = true;
  });
  const endGesture = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dt = performance.now() - g.t0;
    const dy = e.clientY - g.y0;
    const dx = e.clientX - g.x0;
    if (!g.moved && dt < 300) act("rotate");
    else if (dy > 60 && dy > Math.abs(dx) * 2 && dy / dt > 0.9) act("drop");
    g = null;
  };
  boardEl.addEventListener("pointerup", endGesture);
  boardEl.addEventListener("pointercancel", () => { g = null; });

  // keyboard
  const KEYS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down", ArrowUp: "rotate",
    x: "rotate", X: "rotate", z: "rotateCCW", Z: "rotateCCW", " ": "drop",
    p: "pause", P: "pause", Escape: "pause"
  };
  window.addEventListener("keydown", (e) => {
    const action = KEYS[e.key];
    if (!action) {
      if (e.key === "Enter" && mode !== "play") overlayBtn.click();
      return;
    }
    e.preventDefault();
    if (e.repeat && (action === "drop" || action === "pause" || action === "rotate" || action === "rotateCCW")) return;
    act(action);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "play") setMode("pause");
  });

  window.addEventListener("resize", layout);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);
  document.addEventListener("dblclick", (e) => e.preventDefault());

  layout();
  setMode("start");
  requestAnimationFrame(frame);
})();
