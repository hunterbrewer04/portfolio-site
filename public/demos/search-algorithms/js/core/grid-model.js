(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});
  const HEAVY = SAD.HEAVY || 5;

  /* Grid state. Cell ids are integers, r * cols + c. Step cost is the cost of
     the cell being entered, so cost[] holds 1 or HEAVY and never 0. */
  class GridModel {
    constructor(cols, rows){
      this.cols = 0; this.rows = 0;
      this.wall = new Uint8Array(0);
      this.cost = new Uint8Array(0);
      this.start = 0; this.goal = 0;
      this.resize(cols || 24, rows || 16);
    }

    idx(c, r){ return r * this.cols + c; }
    cx(i){ return i % this.cols; }
    cy(i){ return (i / this.cols) | 0; }
    colOf(i){ return i % this.cols; }
    rowOf(i){ return (i / this.cols) | 0; }
    get size(){ return this.cols * this.rows; }

    /* clockwise: up, right, down, left. Walls are not filtered — this is the
       geometric neighbourhood, for rendering, editing and reachability. */
    neighbors(i){
      const c = i % this.cols, r = (i / this.cols) | 0, out = [];
      if (r > 0)             out.push(i - this.cols);
      if (c < this.cols - 1) out.push(i + 1);
      if (r < this.rows - 1) out.push(i + this.cols);
      if (c > 0)             out.push(i - 1);
      return out;
    }

    /* down, right, up, left — the order gridProblem lists successors in. A
       stack-based search pushes successors in reverse, which puts them on the
       stack as left, up, right, down and pops down first, then right. */
    searchOrder(i){
      const c = i % this.cols, r = (i / this.cols) | 0, out = [];
      if (r < this.rows - 1) out.push(i + this.cols);
      if (c < this.cols - 1) out.push(i + 1);
      if (r > 0)             out.push(i - this.cols);
      if (c > 0)             out.push(i - 1);
      return out;
    }

    /* Keeps whatever terrain overlaps the new bounds, and carries start and goal
       across proportionally. This fires on every device rotation, so re-placing
       the markers would throw away wherever the user dragged them; they only get
       re-placed when the cell they land on is unusable. */
    resize(cols, rows){
      cols = Math.max(2, cols | 0);
      rows = Math.max(2, rows | 0);
      const oldW = this.wall, oldC = this.cost, oc = this.cols, or_ = this.rows;
      const had = !!(oldW && oc && or_);
      const sc0 = had ? this.start % oc : 0, sr0 = had ? (this.start / oc) | 0 : 0;
      const gc0 = had ? this.goal  % oc : 0, gr0 = had ? (this.goal  / oc) | 0 : 0;

      this.cols = cols; this.rows = rows;
      const n = cols * rows;
      this.wall = new Uint8Array(n);
      this.cost = new Uint8Array(n).fill(1);

      if (had){
        for (let r = 0; r < Math.min(rows, or_); r++)
          for (let c = 0; c < Math.min(cols, oc); c++){
            this.wall[r*cols+c] = oldW[r*oc+c];
            this.cost[r*cols+c] = oldC[r*oc+c];
          }
      }

      const mid = Math.min(rows - 1, Math.round(rows / 2));
      const dStart = this.idx(Math.min(cols - 1, Math.max(1, Math.round(cols * 0.13))), mid);
      const dGoal  = this.idx(Math.max(0, Math.min(cols - 2, Math.round(cols * 0.87))), mid);

      // same fractional position in the new bounds
      const scale = (v, from, to) =>
        from <= 1 ? 0 : Math.max(0, Math.min(to - 1, Math.round(v * (to - 1) / (from - 1))));
      const free = (i, avoid) => i >= 0 && i < n && !this.wall[i] && i !== avoid;
      const nearestFree = (i, avoid) => {
        for (let d = 0; d < n; d++){
          if (free(i + d, avoid)) return i + d;
          if (free(i - d, avoid)) return i - d;
        }
        return i === avoid ? (i + 1) % n : i;
      };
      const place = (moved, fallback, avoid) => {
        if (had && free(moved, avoid)) return moved;
        if (free(fallback, avoid)) return fallback;
        return nearestFree(fallback, avoid);
      };

      this.start = place(this.idx(scale(sc0, oc, cols), scale(sr0, or_, rows)), dStart, -1);
      this.goal  = place(this.idx(scale(gc0, oc, cols), scale(gr0, or_, rows)), dGoal, this.start);
      this.wall[this.start] = 0; this.wall[this.goal] = 0;
      return this;
    }

    clear(){ this.wall.fill(0); this.cost.fill(1); return this; }

    reachable(){
      const n = this.size, seen = new Uint8Array(n), q = [this.start];
      seen[this.start] = 1;
      for (let h = 0; h < q.length; h++)
        for (const v of this.neighbors(q[h]))
          if (!this.wall[v] && !seen[v]){ seen[v] = 1; q.push(v); }
      return !!seen[this.goal];
    }

    randomWalls(){
      for (let attempt = 0; attempt < 14; attempt++){
        this.wall.fill(0);
        for (let i = 0; i < this.wall.length; i++)
          if (Math.random() < 0.24) this.wall[i] = 1;
        this.wall[this.start] = 0; this.wall[this.goal] = 0;
        if (this.reachable()) break;
        if (attempt === 13){                     // fall back to carving an L-corridor
          const sc = this.cx(this.start), sr = this.cy(this.start),
                gc = this.cx(this.goal),  gr = this.cy(this.goal);
          for (let c = Math.min(sc,gc); c <= Math.max(sc,gc); c++) this.wall[this.idx(c,sr)] = 0;
          for (let r = Math.min(sr,gr); r <= Math.max(sr,gr); r++) this.wall[this.idx(gc,r)] = 0;
        }
      }
      return this;
    }

    randomTerrain(){
      this.cost.fill(1);
      const blobs = 8 + ((Math.random() * 8) | 0);
      for (let b = 0; b < blobs; b++){
        const cc = (Math.random() * this.cols) | 0, cr = (Math.random() * this.rows) | 0;
        const rad = 2 + Math.random() * 4;
        for (let r = Math.max(0, cr - 6); r < Math.min(this.rows, cr + 7); r++)
          for (let c = Math.max(0, cc - 6); c < Math.min(this.cols, cc + 7); c++){
            const dist = Math.hypot(c - cc, r - cr);
            if (dist < rad + Math.random() * 1.2) this.cost[this.idx(c,r)] = HEAVY;
          }
      }
      this.cost[this.start] = 1; this.cost[this.goal] = 1;
      return this;
    }

    randomWeights(){ return this.randomTerrain(); }

    /* Recursive division. Walls land on even coordinates and gaps on odd ones,
       and every region is odd-to-odd; that parity is what keeps the maze
       connected, so leave it alone. */
    maze(){
      this.wall.fill(1);
      const open = (c,r) => { if (c>=0 && r>=0 && c<this.cols && r<this.rows) this.wall[this.idx(c,r)] = 0; };
      for (let r = 1; r < this.rows - 1; r++)
        for (let c = 1; c < this.cols - 1; c++) open(c,r);

      const oddIn = (a,b) => {           // random odd value in [a,b], a odd
        const n = Math.floor((b - a) / 2) + 1;
        return a + 2 * ((Math.random() * n) | 0);
      };
      const evenIn = (a,b) => {          // random even value in (a,b), a odd
        const lo = a + 1, n = Math.floor((b - lo) / 2) + 1;
        return lo + 2 * ((Math.random() * n) | 0);
      };

      const wallAt = (c,r) => { this.wall[this.idx(c,r)] = 1; };
      const divide = (x1,y1,x2,y2) => {
        const w = x2 - x1 + 1, h = y2 - y1 + 1;
        if (w < 3 || h < 3) return;
        const horiz = h > w ? true : (w > h ? false : Math.random() < .5);
        if (horiz){
          const wy = evenIn(y1, y2 - 1);
          const gap = oddIn(x1, x2);
          for (let x = x1; x <= x2; x++) if (x !== gap) wallAt(x, wy);
          divide(x1, y1, x2, wy - 1);
          divide(x1, wy + 1, x2, y2);
        } else {
          const wx = evenIn(x1, x2 - 1);
          const gap = oddIn(y1, y2);
          for (let y = y1; y <= y2; y++) if (y !== gap) wallAt(wx, y);
          divide(x1, y1, wx - 1, y2);
          divide(wx + 1, y1, x2, y2);
        }
      };
      divide(1, 1,
             this.cols - 2 - (this.cols % 2 === 0 ? 1 : 0),
             this.rows - 2 - (this.rows % 2 === 0 ? 1 : 0));

      const lastOddC = (this.cols - 2) % 2 === 1 ? this.cols - 2 : this.cols - 3;
      const lastOddR = (this.rows - 2) % 2 === 1 ? this.rows - 2 : this.rows - 3;
      this.start = this.idx(1, 1);
      this.goal  = this.idx(Math.max(1, lastOddC), Math.max(1, lastOddR));
      this.wall[this.start] = 0; this.wall[this.goal] = 0;
      this.cost[this.start] = 1; this.cost[this.goal] = 1;
      return this;
    }
  }

  GridModel.HEAVY = HEAVY;
  SAD.GridModel = GridModel;

})(typeof globalThis !== 'undefined' ? globalThis : window);
