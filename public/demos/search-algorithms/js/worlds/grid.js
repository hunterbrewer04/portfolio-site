(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});

  /* The grid world. Presentation and interaction only: the board lives in
     SAD.GridModel and this file renders whatever the model holds. Node ids are
     integers, i = row * cols + col. */

  const GAP = 2;                       // must match --gap in css/base.css
  const S_EMPTY = 0, S_FRONTIER = 1, S_VISITED = 2, S_CUTOFF = 3, S_PATH = 4;

  /* Every read of the model goes through here, so a rename on the model side is
     a small fix rather than a sweep. */
  let m = null;
  const nCells = () => m.cols * m.rows;
  const colOf  = i => i % m.cols;
  const rowOf  = i => (i / m.cols) | 0;
  const isWall = i => !!m.wall[i];
  const costOf = i => m.cost[i];
  const HEAVY  = () => SAD.HEAVY;

  let host = null, board = null, overlay = null, pathLine = null;
  let cells = [];
  let stateArr = null, gArr = null;
  let showG = false;
  let cs = 22;                         // cell size in px, mirrored onto --cs

  const fmtNum = v => (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : String(Math.round(v)));
  const valid = i => typeof i === 'number' && i === (i | 0) && i >= 0 && i < nCells();

  /* =========================================================
     Board construction
     ========================================================= */
  function buildCells(){
    const n = nCells();
    board.style.gridTemplateColumns = `repeat(${m.cols}, var(--cs))`;
    const frag = document.createDocumentFragment();
    cells = new Array(n);
    for (let i = 0; i < n; i++){
      const d = document.createElement('div');
      d.className = 'cell';
      d.dataset.i = i;
      const s = document.createElement('span');
      s.className = 'lbl';
      d.appendChild(s);
      frag.appendChild(d);
      cells[i] = d;
    }
    board.replaceChildren(frag);

    const px = m.cols * (cs + GAP) - GAP, py = m.rows * (cs + GAP) - GAP;
    overlay.setAttribute('width', px);
    overlay.setAttribute('height', py);
    overlay.setAttribute('viewBox', `0 0 ${px} ${py}`);

    stateArr = new Uint8Array(n);
    gArr = new Float64Array(n).fill(Infinity);
    clearSearch();
  }

  /* Cells get BIGGER on a phone, not smaller: drawing walls with a fingertip
     wants fewer, larger cells. The minimums shrink to match, so a narrow screen
     ends up with a coarse board rather than an unusable one. */
  function metrics(){
    const w = window.innerWidth;
    if (w < 720)  return { cs:28, minCols:9,  minRows:7,  maxCols:26, maxRows:34 };
    if (w < 1024) return { cs:24, minCols:12, minRows:8,  maxCols:40, maxRows:44 };
    return              { cs:22, minCols:12, minRows:8,  maxCols:64, maxRows:48 };
  }

  function layout(){
    if (!host) return;
    const box = host.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return;   // hidden world, nothing to measure
    const M = metrics();
    cs = M.cs;
    document.documentElement.style.setProperty('--cs', cs + 'px');
    const cols = Math.max(M.minCols, Math.min(M.maxCols, Math.floor((box.width  - 18 + GAP) / (cs + GAP))));
    const rows = Math.max(M.minRows, Math.min(M.maxRows, Math.floor((box.height - 18 + GAP) / (cs + GAP))));
    if (cols !== m.cols || rows !== m.rows){
      m.resize(cols, rows);
      buildCells();
      repaintAll();
      // The board changed shape, so any run in flight is against a stale problem.
      SAD.worldChanged();
    }
  }

  /* =========================================================
     Cell painting
     ========================================================= */
  function paint(i){
    const el = cells[i]; if (!el) return;
    let cls = 'cell';
    if (costOf(i) > 1) cls += ' w';
    if (isWall(i)) cls += ' wall';
    else {
      const s = stateArr[i];
      if (s === S_FRONTIER) cls += ' frontier';
      else if (s === S_VISITED) cls += ' visited';
      else if (s === S_CUTOFF) cls += ' cutoff';
      else if (s === S_PATH) cls += ' path';
    }
    if (i === m.start) cls += ' start';
    else if (i === m.goal) cls += ' goal';
    el.className = cls;

    const lbl = el.firstChild;
    let t = '';
    if (i !== m.start && i !== m.goal && !isWall(i)){
      if (showG && gArr[i] !== Infinity) t = fmtNum(gArr[i]);
      else if (costOf(i) > 1) t = String(costOf(i));
    }
    if (lbl.textContent !== t) lbl.textContent = t;
  }

  function setState(i, s){
    stateArr[i] = s;
    if (i !== m.start && i !== m.goal) paint(i);
  }
  function repaintAll(){ for (let i = 0; i < cells.length; i++) paint(i); }

  function clearSearch(){
    if (stateArr) stateArr.fill(S_EMPTY);
    if (gArr) gArr.fill(Infinity);
    for (const el of cells) el.classList.remove('meet', 'hl');
    if (pathLine){
      pathLine.style.transition = 'none';
      pathLine.style.opacity = 0;
      pathLine.setAttribute('d', '');
    }
  }

  /* =========================================================
     Step rendering
     ========================================================= */
  function pushAll(list){
    if (!list) return;
    for (const p of list){
      if (!valid(p.id)) continue;
      if (p.g != null) gArr[p.id] = p.g;
      setState(p.id, S_FRONTIER);
    }
  }

  function applyStep(v){
    switch (v.kind){
      case 'init':
        pushAll(v.pushed);
        break;

      case 'expand':
        if (valid(v.id)){
          if (v.g != null) gArr[v.id] = v.g;
          setState(v.id, S_VISITED);
        }
        pushAll(v.pushed);
        break;

      case 'cutoff':
        if (valid(v.id)){
          if (v.g != null) gArr[v.id] = v.g;
          setState(v.id, S_CUTOFF);
        }
        break;

      case 'goal':
        if (valid(v.id)){
          if (v.g != null) gArr[v.id] = v.g;
          setState(v.id, S_VISITED);
        }
        pushAll(v.pushed);
        break;

      case 'meet':
        if (valid(v.id)){
          setState(v.id, S_VISITED);
          cells[v.id].classList.add('meet');
        }
        break;

      case 'restart':
        // IDDFS opening a new round: everything the search drew goes away, the board stays.
        clearSearch();
        repaintAll();
        break;

      // 'stale' and 'fail' change nothing on the board.
    }
  }

  /* =========================================================
     Solution path
     ========================================================= */
  const reduceMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showPath(path){
    if (!path || !path.length) return;
    const usable = path.filter(valid);
    if (usable.length !== path.length) return;    // path belongs to another world
    const still = reduceMotion();

    usable.forEach((id, k) => {
      stateArr[id] = S_PATH;
      const el = cells[id];
      if (!still){
        el.style.animationDelay = (k * 20) + 'ms';
        setTimeout(() => { el.style.animationDelay = ''; }, k * 20 + 600);
      }
      paint(id);
    });

    const step = cs + GAP, half = cs / 2;
    const d = usable.map((id, k) =>
      `${k === 0 ? 'M' : 'L'}${(colOf(id) * step + half).toFixed(1)} ${(rowOf(id) * step + half).toFixed(1)}`).join(' ');
    pathLine.setAttribute('d', d);
    pathLine.style.opacity = 1;
    if (still){
      pathLine.style.transition = 'none';
      pathLine.style.strokeDasharray = '';
      pathLine.style.strokeDashoffset = 0;
      return;
    }
    const len = pathLine.getTotalLength();
    pathLine.style.transition = 'none';
    pathLine.style.strokeDasharray = len;
    pathLine.style.strokeDashoffset = len;
    requestAnimationFrame(() => {
      const ms = Math.min(1400, Math.max(320, usable.length * 26));
      pathLine.style.transition = `stroke-dashoffset ${ms}ms cubic-bezier(.3,.7,.3,1)`;
      pathLine.style.strokeDashoffset = 0;
    });
  }

  /* =========================================================
     Mouse editing
     ========================================================= */
  let drag = null;

  function cellFrom(e){
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return -1;
    const c = el.closest ? el.closest('.cell') : null;
    return c ? +c.dataset.i : -1;
  }

  function wireEditing(){
    board.addEventListener('contextmenu', e => e.preventDefault());
    board.addEventListener('pointerdown', e => {
      const i = cellFrom(e); if (i < 0) return;
      e.preventDefault();
      // Safari throws if the pointer is already gone; capture is an optimisation.
      try { board.setPointerCapture(e.pointerId); } catch (_) {}
      if (i === m.start) drag = { t:'start' };
      else if (i === m.goal) drag = { t:'goal' };
      else if (e.shiftKey || e.button === 2 || e.altKey)
        drag = { t:'weight', val: costOf(i) > 1 ? 1 : HEAVY() };
      else
        drag = { t:'wall', val: isWall(i) ? 0 : 1 };
      applyEdit(i);
    });
    board.addEventListener('pointermove', e => {
      if (drag){ const i = cellFrom(e); if (i >= 0) applyEdit(i); }
    });
    window.addEventListener('pointerup', () => { drag = null; });
  }

  function applyEdit(i){
    if (!drag || !valid(i)) return;
    if (drag.t === 'start'){
      if (i === m.goal || isWall(i)) return;
      const old = m.start; m.start = i; paint(old); paint(i);
    } else if (drag.t === 'goal'){
      if (i === m.start || isWall(i)) return;
      const old = m.goal; m.goal = i; paint(old); paint(i);
    } else if (drag.t === 'wall'){
      if (i === m.start || i === m.goal || m.wall[i] === drag.val) return;
      m.wall[i] = drag.val; if (drag.val) m.cost[i] = 1; paint(i);
    } else {
      if (i === m.start || i === m.goal || m.cost[i] === drag.val) return;
      m.cost[i] = drag.val; m.wall[i] = 0; paint(i);
    }
    SAD.worldChanged();
  }

  /* =========================================================
     World registration
     ========================================================= */
  SAD.registerWorld({
    id: 'grid',
    label: 'Grid',
    order: 1,
    supportsRace: true,

    mount(container){
      host = container;
      container.innerHTML =
        '<div id="gridWrap"><div id="board"></div>' +
        '<svg id="overlay"><path id="pathLine"></path></svg></div>';
      board = container.querySelector('#board');
      overlay = container.querySelector('#overlay');
      pathLine = container.querySelector('#pathLine');

      m = new SAD.GridModel(40, 22);
      buildCells();
      m.randomWeights();
      repaintAll();
      wireEditing();
    },

    activate(){ layout(); repaintAll(); },
    deactivate(){ drag = null; },

    problem(){ return SAD.gridProblem(m); },

    reset(){ clearSearch(); repaintAll(); },
    apply(step){ applyStep(step); },
    showPath,
    resize(){ layout(); },

    highlight(nodeId, on){
      if (!valid(nodeId)) return;
      cells[nodeId].classList.toggle('hl', !!on);
    },

    /* --- grid-only extras, feature-detected by js/ui/app.js --- */

    // Terrain buttons. kind is one of maze | walls | weights | clear.
    terrain(kind){
      if (kind === 'maze') m.maze();
      else if (kind === 'walls') m.randomWalls();
      else if (kind === 'weights') m.randomWeights();
      else m.clear();
      clearSearch();
      repaintAll();
      SAD.worldChanged();
    },

    setShowG(on){ showG = !!on; repaintAll(); },

    // Plain data the race canvases draw from. Live references, read-only.
    raceView(){
      return { cols:m.cols, rows:m.rows, wall:m.wall, cost:m.cost, start:m.start, goal:m.goal };
    }
  });

})(typeof globalThis !== 'undefined' ? globalThis : window);
