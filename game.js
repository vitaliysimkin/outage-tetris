(function (root) {
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
  };
  const TYPES = Object.keys(SHAPES);

  // SRS wall kicks, y axis already flipped to "down is positive"
  const KICKS_JLSTZ = {
    "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  };
  const KICKS_I = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
  };

  const LOCK_DELAY = 500;
  const MAX_LOCK_RESETS = 15;
  const CLEAR_TIME = 220;
  const LINE_POINTS = [0, 100, 300, 500, 800];

  function rotateCW(m) {
    const n = m.length;
    return m.map((row, y) => row.map((_, x) => m[n - 1 - x][y]));
  }

  function rotations(type) {
    const list = [SHAPES[type]];
    for (let i = 1; i < 4; i++) list.push(rotateCW(list[i - 1]));
    return list;
  }

  const ROTATIONS = {};
  TYPES.forEach((t) => { ROTATIONS[t] = rotations(t); });

  class Game {
    constructor(opts) {
      const o = opts || {};
      this.cols = o.cols || 10;
      this.rows = o.rows || 24;
      this.hidden = 2;
      this.rng = o.rng || Math.random;
      this.reset();
    }

    reset() {
      this.board = [];
      for (let y = 0; y < this.rows + this.hidden; y++) this.board.push(new Array(this.cols).fill(null));
      this.bag = [];
      this.queue = [];
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.over = false;
      this.clearing = null;
      this.piece = null;
      this.fallAcc = 0;
      this.fillQueue();
      this.spawn();
    }

    fillQueue() {
      while (this.queue.length < 2) {
        if (this.bag.length === 0) {
          this.bag = TYPES.slice();
          for (let i = this.bag.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
          }
        }
        this.queue.push(this.bag.pop());
      }
    }

    get next() { return this.queue[0]; }

    gravityMs() {
      return Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1) * 1000;
    }

    spawn() {
      const type = this.queue.shift();
      this.fillQueue();
      const n = SHAPES[type].length;
      this.piece = { type, rot: 0, x: Math.floor((this.cols - n) / 2), y: this.hidden - 1 };
      this.lockTimer = 0;
      this.lockResets = 0;
      this.lowestY = this.piece.y;
      this.fallAcc = 0;
      if (this.collides(this.piece)) {
        this.over = true;
        return;
      }
      if (!this.collides(this.piece, 0, 1)) this.piece.y += 1;
    }

    cells(p) {
      const piece = p || this.piece;
      const m = ROTATIONS[piece.type][piece.rot];
      const out = [];
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m.length; x++) {
          if (m[y][x]) out.push([piece.x + x, piece.y + y]);
        }
      }
      return out;
    }

    collides(p, dx, dy, rot) {
      const test = { type: p.type, rot: rot === undefined ? p.rot : rot, x: p.x + (dx || 0), y: p.y + (dy || 0) };
      for (const [x, y] of this.cells(test)) {
        if (x < 0 || x >= this.cols || y >= this.rows + this.hidden) return true;
        if (y >= 0 && this.board[y][x]) return true;
      }
      return false;
    }

    get active() { return !this.over && !this.clearing && !!this.piece; }

    grounded() { return this.collides(this.piece, 0, 1); }

    afterMove() {
      if (this.grounded() && this.lockResets < MAX_LOCK_RESETS) {
        this.lockTimer = 0;
        this.lockResets++;
      }
    }

    move(dx) {
      if (!this.active || this.collides(this.piece, dx, 0)) return false;
      this.piece.x += dx;
      this.afterMove();
      return true;
    }

    rotate(dir) {
      if (!this.active || this.piece.type === "O") return false;
      const from = this.piece.rot;
      const to = (from + (dir < 0 ? 3 : 1)) % 4;
      const kicks = (this.piece.type === "I" ? KICKS_I : KICKS_JLSTZ)[from + ">" + to];
      for (const [kx, ky] of kicks) {
        if (!this.collides(this.piece, kx, ky, to)) {
          this.piece.x += kx;
          this.piece.y += ky;
          this.piece.rot = to;
          this.afterMove();
          return true;
        }
      }
      return false;
    }

    stepDown() {
      this.piece.y += 1;
      if (this.piece.y > this.lowestY) {
        this.lowestY = this.piece.y;
        this.lockResets = 0;
        this.lockTimer = 0;
      }
    }

    softDrop() {
      if (!this.active || this.grounded()) return false;
      this.stepDown();
      this.score += 1;
      this.fallAcc = 0;
      return true;
    }

    hardDrop() {
      if (!this.active) return 0;
      let d = 0;
      while (!this.collides(this.piece, 0, 1)) { this.piece.y += 1; d++; }
      this.score += d * 2;
      this.lock();
      return d;
    }

    ghostY() {
      let d = 0;
      while (!this.collides(this.piece, 0, d + 1)) d++;
      return this.piece.y + d;
    }

    lock() {
      const cells = this.cells();
      let allHidden = true;
      for (const [x, y] of cells) {
        if (y >= 0) this.board[y][x] = this.piece.type;
        if (y >= this.hidden) allHidden = false;
      }
      this.piece = null;
      if (allHidden) {
        this.over = true;
        return;
      }
      const full = [];
      for (let y = 0; y < this.board.length; y++) {
        if (this.board[y].every(Boolean)) full.push(y);
      }
      if (full.length) {
        this.clearing = { rows: full, t: 0 };
      } else {
        this.spawn();
      }
    }

    finishClear() {
      const rows = this.clearing.rows;
      this.board = this.board.filter((_, y) => !rows.includes(y));
      while (this.board.length < this.rows + this.hidden) this.board.unshift(new Array(this.cols).fill(null));
      this.score += LINE_POINTS[rows.length] * this.level;
      this.lines += rows.length;
      this.level = 1 + Math.floor(this.lines / 10);
      this.clearing = null;
      this.spawn();
    }

    tick(dt) {
      if (this.over) return;
      if (this.clearing) {
        this.clearing.t += dt;
        if (this.clearing.t >= CLEAR_TIME) this.finishClear();
        return;
      }
      if (!this.piece) return;
      if (this.grounded()) {
        this.fallAcc = 0;
        this.lockTimer += dt;
        if (this.lockTimer >= LOCK_DELAY) this.lock();
        return;
      }
      this.fallAcc += dt;
      const g = this.gravityMs();
      while (this.fallAcc >= g && !this.grounded()) {
        this.fallAcc -= g;
        this.stepDown();
      }
    }
  }

  Game.SHAPES = SHAPES;
  Game.ROTATIONS = ROTATIONS;
  if (typeof module !== "undefined") module.exports = Game;
  else root.TetrisGame = Game;
})(this);
