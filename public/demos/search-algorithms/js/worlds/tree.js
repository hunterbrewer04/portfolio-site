/* The search-tree world: a view of the run that is happening in the graph
   world, rebuilt from the step stream. Every `pushed` entry is one new tree
   node, keyed by its own identity, because the same state legitimately turns
   up in several places at once. */
(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});
  const SVGNS = 'http://www.w3.org/2000/svg';

  const COL_W = 46;      // horizontal slot per node within a depth row
  const ROW_H = 62;      // vertical distance between depth rows
  const NODE_W = 34;
  const NODE_H = 22;

  /* Trees get wide fast, and a phone has neither the pixels to show a thousand
     nodes nor the budget to animate them, so the cap comes down with the
     viewport. Whatever is over the cap is counted, never silently dropped. */
  function capFor(w) {
    if (w < 720) return 260;
    if (w < 1024) return 500;
    return 900;
  }

  /* The scale at which fitting stops being worth it, measured in a browser
     rather than guessed. A phone has no room for an overview you then have to
     zoom into, so it holds the scale where a 10px node label still renders
     around 7px and follows the search instead. A tablet or a desktop keeps
     fitting further out, because a shrunken whole tree is still a useful
     picture there and pinching in to read is cheap — but not past the point
     where a 34px node box is under ~6px and the tree is just a smear. */
  function fitFloorFor(w) {
    if (w < 720) return 0.72;
    if (w < 1024) return 0.34;
    return 0.18;
  }

  /* Which number each algorithm is really ordering on. frontierKeys drives it
     when the id is not one we know. */
  const ORDER_KEY = {
    bfs: 'd', dfs: 'd', dls: 'd', iddfs: 'd',
    ucs: 'g', greedy: 'h', astar: 'f', bidirectional: 'g'
  };
  const POP_ORDER = {
    bfs: 'fifo', dfs: 'lifo', dls: 'lifo', iddfs: 'lifo',
    ucs: 'key', greedy: 'key', astar: 'key', bidirectional: 'key'
  };

  const fmtNum = v => {
    if (v == null || !isFinite(v)) return '';
    if (Math.abs(v) >= 1000) return Math.round(v / 100) / 10 + 'k';
    return String(Math.round(v * 100) / 100);
  };
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  function viewportW() {
    if (typeof window !== 'undefined' && window.innerWidth) return window.innerWidth;
    return T.w || 1024;
  }

  /* =========================================================
     State
     ========================================================= */
  const T = {
    mounted: false, active: false,
    host: null, svg: null, gPan: null, gCut: null, gEdges: null, gNodes: null,
    elRound: null, elCount: null, elMore: null, elFit: null,

    nodes: [], roots: [], byState: new Map(), live: new Map(),
    hidden: 0, seq: 0, cap: 900, focus: null,
    round: null, limit: null, goalRec: null,
    labelFn: null, labelTried: false, entry: null, entryName: null,

    w: 900, h: 520, ext: { w: 0, h: 0 },
    /* mode 'auto' lets the view fit or follow on its own. Any pan or pinch
       drops it to 'manual' until Fit is pressed. */
    view: { k: 1, tx: 0, ty: 0, mode: 'auto', following: false },
    pointers: new Map(), pinch: null, drag: null,
    raf: 0, dirty: false
  };

  /* =========================================================
     Which algorithm is running
     The app fills #algoName from the registry entry, so that text is enough
     to find the entry again and read frontierKeys / supports off it.
     ========================================================= */
  function currentEntry() {
    if (typeof document === 'undefined') return T.entry;
    const el = document.getElementById('algoName');
    const name = el && el.textContent ? String(el.textContent).trim() : '';
    if (!name) return T.entry;
    if (name === T.entryName && T.entry) return T.entry;
    const list = SAD.algorithms || [];
    for (const a of list) {
      if (a.name === name || a.short === name) {
        T.entryName = name; T.entry = a; return a;
      }
    }
    return T.entry;
  }

  function orderKeyOf(entry) {
    if (entry && ORDER_KEY[entry.id]) return ORDER_KEY[entry.id];
    const keys = (entry && entry.frontierKeys) || [];
    if (keys.indexOf('f') >= 0) return 'f';
    if (keys.indexOf('h') >= 0 && keys.indexOf('g') < 0) return 'h';
    if (keys.indexOf('d') >= 0) return 'd';
    return 'g';
  }
  function popOrderOf(entry) {
    return (entry && POP_ORDER[entry.id]) || 'lifo';
  }

  /* Depth limit in force: IDDFS puts the round's L on every step, DLS takes it
     from the slider until a cutoff step names it exactly. */
  function limitFromUI() {
    if (typeof document === 'undefined') return null;
    const el = document.getElementById('limit');
    if (!el) return null;
    const v = Number(el.value);
    return isFinite(v) ? v : null;
  }
  function activeLimit(step) {
    if (step && typeof step.iteration === 'number') return step.iteration;
    const e = currentEntry();
    if (e && e.supports && e.supports.limit) return limitFromUI();
    return null;
  }

  function graphWorld() {
    if (typeof SAD.worldOf === 'function') return SAD.worldOf('graph');
    if (typeof SAD.worldById === 'function') return SAD.worldById('graph');
    return null;
  }

  function labelOf(id) {
    if (T.labelFn) { try { return T.labelFn(id); } catch (_) { /* fall through */ } }
    if (T.labelTried) return String(id);
    T.labelTried = true;
    try {
      const gw = graphWorld();
      const p = gw && gw.problem && gw.problem();
      if (p && typeof p.label === 'function') { T.labelFn = p.label.bind(p); return T.labelFn(id); }
    } catch (_) { /* no graph world yet */ }
    return String(id);
  }

  /* =========================================================
     Tree model
     ========================================================= */
  function clearTree() {
    if (T.gEdges) T.gEdges.textContent = '';
    if (T.gNodes) T.gNodes.textContent = '';
    T.nodes = []; T.roots = []; T.byState = new Map(); T.live = new Map();
    T.hidden = 0; T.goalRec = null; T.focus = null;
    T.cap = capFor(viewportW());
  }

  function addRecord(entry, parentRec) {
    if (T.nodes.length >= T.cap) { T.hidden++; return null; }
    const r = {
      key: ++T.seq,
      state: entry.id,
      parent: parentRec || null,
      children: [],
      depth: parentRec ? parentRec.depth + 1 : 0,
      g: entry.g, h: entry.h, f: entry.f,
      d: entry.d != null ? entry.d : (parentRec ? parentRec.depth + 1 : 0),
      side: entry.side || (parentRec ? parentRec.side : 'f'),
      status: 'frontier', meet: false, hl: false,
      x: 0, y: 0, el: null, edge: null, lbl: null, val: null, ttl: null,
      lastCls: '', lastVal: '', lastTip: ''
    };
    T.nodes.push(r);
    if (parentRec) parentRec.children.push(r); else T.roots.push(r);

    let bs = T.byState.get(r.state);
    if (!bs) { bs = []; T.byState.set(r.state, bs); }
    bs.push(r);

    let lv = T.live.get(r.state);
    if (!lv) { lv = []; T.live.set(r.state, lv); }
    lv.push(r);

    T.focus = r;
    return r;
  }

  function findRecord(step) {
    const state = step.id;
    const lv = T.live.get(state);
    const pool = (lv && lv.length) ? lv : (T.byState.get(state) || []);
    if (!pool.length) return null;

    const cand = [];
    for (const r of pool) {
      if (step.depth != null && r.d !== step.depth) continue;
      if (step.g != null && r.g != null && Math.abs(r.g - step.g) > 1e-9) continue;
      cand.push(r);
    }
    const from = cand.length ? cand : pool;
    const order = popOrderOf(currentEntry());
    const pick = order === 'fifo' ? from[0] : from[from.length - 1];

    if (lv) {
      const i = lv.indexOf(pick);
      if (i >= 0) lv.splice(i, 1);
    }
    T.focus = pick;
    return pick;
  }

  function addPushed(list, parentRec) {
    if (!list || !list.length) return;
    for (const p of list) {
      let par = parentRec;
      if (p.parent == null) par = null;
      else if (!par || par.state !== p.parent) {
        const bs = T.byState.get(p.parent);
        par = bs && bs.length ? bs[bs.length - 1] : null;
        if (!par && T.nodes.length) { T.hidden++; continue; }
      }
      addRecord(p, par);
    }
  }

  /* =========================================================
     Step rendering
     ========================================================= */
  function apply(step) {
    if (!step) return;
    switch (step.kind) {
      case 'init':
        clearTree();
        T.labelFn = null; T.labelTried = false;
        /* iterative deepening tags every step with its round, and its restart
           step already announced the round this init belongs to. */
        T.round = step.iteration != null ? step.iteration : null;
        T.limit = activeLimit(step);
        T.view.mode = 'auto';
        addPushed(step.pushed, null);
        break;

      case 'restart':
        clearTree();
        T.round = step.iteration != null ? step.iteration : null;
        T.limit = activeLimit(step);
        break;

      case 'expand': {
        const r = findRecord(step);
        if (r) { r.status = 'expanded'; soak(r, step); }
        if (T.limit == null) T.limit = activeLimit(step);
        addPushed(step.pushed, r);
        break;
      }

      case 'cutoff': {
        const r = findRecord(step);
        if (r) { r.status = 'cutoff'; soak(r, step); }
        /* a node is cut off exactly at the limit, so this names L more
           reliably than reading the slider */
        if (step.iteration == null && step.depth != null) T.limit = step.depth;
        else if (T.limit == null) T.limit = activeLimit(step);
        break;
      }

      case 'stale': {
        const r = findRecord(step);
        if (r) r.status = 'stale';
        break;
      }

      case 'meet': {
        const bs = T.byState.get(step.id);
        if (bs) for (const r of bs) r.meet = true;
        break;
      }

      case 'goal': {
        /* `pushed` is optional here. Under goalTest 'pop' the goal went into
           the tree on an earlier step. Under 'gen' it arrives in this very
           step, and without consuming it there is no parented node for the
           goal and no final edge to draw. */
        if (step.pushed && step.pushed.length) {
          const pstate = step.pushed[0].parent;
          let par = null;
          if (pstate != null) {
            par = findRecord({ id: pstate });
            if (par && par.status === 'frontier') par.status = 'expanded';
          }
          addPushed(step.pushed, par);
        }
        const r = findRecord(step);
        if (r) { r.status = 'expanded'; soak(r, step); T.goalRec = r; }
        if (step.path) showPath(step.path);
        break;
      }

      case 'fail':
      default:
        break;
    }
    T.dirty = true;
    schedule();
  }

  function soak(r, step) {
    if (step.g != null) r.g = step.g;
    if (step.h != null) r.h = step.h;
    if (step.f != null) r.f = step.f;
    if (step.depth != null) r.d = step.depth;
    if (step.side) r.side = step.side;
  }

  function showPath(path) {
    if (T.goalRec) {
      let c = T.goalRec, guard = 0;
      while (c && guard++ < 1e5) { c.status = 'path'; c = c.parent; }
    }
    if (path && path.length) {
      /* Bidirectional splices two half-paths together, so the goal node's
         ancestors only cover one of them. Fill in the rest by state, one node
         per state, so a duplicated state does not light up twice. */
      const taken = new Set();
      for (const r of T.nodes) if (r.status === 'path') taken.add(r.state);
      for (const state of path) {
        if (taken.has(state)) continue;
        const bs = T.byState.get(state);
        if (!bs || !bs.length) continue;
        let best = bs[0];
        for (const r of bs) if (r.depth < best.depth) best = r;
        best.status = 'path';
        taken.add(state);
      }
    }
    T.dirty = true;
    schedule();
  }

  function reset() {
    clearTree();
    T.round = null; T.limit = null; T.labelFn = null; T.labelTried = false;
    T.view.mode = 'auto';
    T.dirty = true;
    schedule();
  }

  function highlight(nodeId, on) {
    const bs = T.byState.get(nodeId);
    if (!bs) return;
    for (const r of bs) {
      r.hl = !!on;
      if (r.el && r.el.classList) r.el.classList.toggle('hl', !!on);
    }
  }

  /* =========================================================
     Layout — one row per depth, children packed left to right
     under their parent in generation order.
     ========================================================= */
  function layout() {
    const slot = [];
    let maxD = 0, maxSlot = 0;
    const stack = [];
    for (let i = T.roots.length - 1; i >= 0; i--) stack.push(T.roots[i]);
    while (stack.length) {
      const r = stack.pop();
      const d = r.depth;
      const s = slot[d] || 0;
      slot[d] = s + 1;
      r.x = s * COL_W + COL_W / 2;
      r.y = d * ROW_H + ROW_H * 0.55;
      if (d > maxD) maxD = d;
      if (s + 1 > maxSlot) maxSlot = s + 1;
      for (let i = r.children.length - 1; i >= 0; i--) stack.push(r.children[i]);
    }
    T.ext.w = Math.max(COL_W, maxSlot * COL_W);
    T.ext.h = (maxD + 1) * ROW_H + ROW_H * 0.4;
    if (T.limit != null) T.ext.h = Math.max(T.ext.h, (T.limit + 1) * ROW_H + ROW_H * 0.9);
  }

  const cutWorldY = () =>
    (T.limit == null ? null : T.limit * ROW_H + ROW_H * 0.55 + NODE_H / 2 + 13);

  /* Place the view while the user has not taken it over. A wide screen fits
     the whole tree. Once fitting would shrink a node past legibility — which
     on a phone happens after two or three levels — it follows the newest
     activity instead, because that is the part worth looking at. */
  function autoPlace() {
    const padX = 22, padY = 18;
    const floor = fitFloorFor(viewportW());
    const kx = (T.w - padX * 2) / Math.max(1, T.ext.w);
    const ky = (T.h - padY * 2) / Math.max(1, T.ext.h);
    let k = Math.min(1.25, Math.min(kx, ky));
    if (!isFinite(k) || k <= 0) k = 1;

    if (k >= floor) {
      T.view.following = false;
      T.view.k = k;
      T.view.tx = (T.w - T.ext.w * k) / 2;
      T.view.ty = (T.ext.h * k < T.h - padY * 2) ? (T.h - T.ext.h * k) / 2 : padY;
      return;
    }

    T.view.following = true;
    k = floor;
    T.view.k = k;

    const f = T.focus;
    const fx = f ? f.x : T.ext.w / 2;
    const fy = f ? f.y : 0;
    let tx = T.w / 2 - fx * k;
    let ty = T.h * 0.55 - fy * k;

    /* Keep the cut line on screen when there is one. It is the point of this
       view, and chasing the frontier past it would hide it. */
    const cy = cutWorldY();
    if (cy != null) {
      const lo = T.h * 0.30 - cy * k;
      const hi = T.h - padY - cy * k;
      if (ty > hi) ty = hi;
      if (ty < lo) ty = lo;
    }

    const spanW = T.ext.w * k, spanH = T.ext.h * k;
    tx = spanW <= T.w - padX * 2 ? (T.w - spanW) / 2
      : Math.min(padX, Math.max(T.w - padX - spanW, tx));
    ty = spanH <= T.h - padY * 2 ? (T.h - spanH) / 2
      : Math.min(padY, Math.max(T.h - padY - spanH, ty));

    T.view.tx = tx; T.view.ty = ty;
  }

  /* =========================================================
     Drawing
     ========================================================= */
  function svgEl(name, attrs) {
    const el = document.createElementNS(SVGNS, name);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function ensureNodeEl(r) {
    if (r.el) return;
    const g = svgEl('g', { class: 'tnode' });
    const rect = svgEl('rect', {
      x: -NODE_W / 2, y: -NODE_H / 2, width: NODE_W, height: NODE_H, rx: 6, class: 'tbox'
    });
    const lbl = svgEl('text', { class: 'tlbl', y: 3.5 });
    const val = svgEl('text', { class: 'tval', y: NODE_H / 2 + 11 });
    const ttl = svgEl('title', null);
    g.appendChild(rect); g.appendChild(lbl); g.appendChild(val); g.appendChild(ttl);
    r.el = g; r.lbl = lbl; r.val = val; r.ttl = ttl;
    lbl.textContent = clip(String(labelOf(r.state)), 6);
    T.gNodes.appendChild(g);

    if (r.parent) {
      r.edge = svgEl('path', { class: 'tedge', d: '' });
      T.gEdges.appendChild(r.edge);
    }
  }

  function classOf(r) {
    let c = 'tnode s-' + r.status;
    if (r.side === 'b') c += ' back';
    if (r.meet) c += ' meet';
    if (T.limit != null && r.depth >= T.limit) c += ' atlimit';
    if (r.hl) c += ' hl';
    return c;
  }

  function valueOf(r, key) {
    switch (key) {
      case 'd': return r.d != null ? 'd ' + r.d : '';
      case 'h': return r.h != null ? 'h ' + fmtNum(r.h) : '';
      case 'f': return r.f != null ? 'f ' + fmtNum(r.f) : '';
      default: return r.g != null ? 'g ' + fmtNum(r.g) : '';
    }
  }

  function render() {
    T.dirty = false;
    if (!T.mounted || !T.active) return;
    layout();
    if (T.view.mode === 'auto') autoPlace();

    const key = orderKeyOf(currentEntry());

    for (const r of T.nodes) {
      ensureNodeEl(r);
      r.el.setAttribute('transform', 'translate(' + r.x.toFixed(1) + ',' + r.y.toFixed(1) + ')');
      const cls = classOf(r);
      if (cls !== r.lastCls) { r.el.setAttribute('class', cls); r.lastCls = cls; }
      const v = valueOf(r, key);
      if (v !== r.lastVal) { r.val.textContent = v; r.lastVal = v; }
      if (r.ttl) {
        const tip = labelOf(r.state) + '  depth ' + r.depth +
          (r.g != null ? '  g ' + fmtNum(r.g) : '') +
          (r.h ? '  h ' + fmtNum(r.h) : '') +
          (r.f != null && r.f !== r.g ? '  f ' + fmtNum(r.f) : '');
        if (tip !== r.lastTip) { r.ttl.textContent = tip; r.lastTip = tip; }
      }
      if (r.edge && r.parent) {
        const px = r.parent.x, py = r.parent.y + NODE_H / 2;
        const cx = r.x, cy = r.y - NODE_H / 2;
        const mid = (py + cy) / 2;
        r.edge.setAttribute('d',
          'M' + px.toFixed(1) + ' ' + py.toFixed(1) +
          'C' + px.toFixed(1) + ' ' + mid.toFixed(1) + ' ' +
          cx.toFixed(1) + ' ' + mid.toFixed(1) + ' ' +
          cx.toFixed(1) + ' ' + cy.toFixed(1));
        r.edge.setAttribute('class', 'tedge' + (r.status === 'path' ? ' on' : '') + (r.side === 'b' ? ' back' : ''));
      }
    }

    T.gPan.setAttribute('transform',
      'translate(' + T.view.tx.toFixed(2) + ',' + T.view.ty.toFixed(2) + ') scale(' + T.view.k.toFixed(4) + ')');

    drawCut();
    updateBar();
  }

  /* The cut line is drawn in SCREEN space, outside the pan group, so the rule
     stays one pixel thick and its label stays at a readable size however far
     the tree is zoomed out. On a phone that is the difference between the most
     important thing this view shows being legible and being a smudge. */
  function drawCut() {
    T.gCut.textContent = '';
    const wy = cutWorldY();
    if (wy == null) return;

    const y = T.view.ty + wy * T.view.k;
    if (y > T.h) return;                    // nothing on screen sits below it yet

    const top = Math.max(0, y);
    T.gCut.appendChild(svgEl('rect', {
      class: 'tdead', x: -4, y: top, width: T.w + 8, height: Math.max(0, T.h - top)
    }));
    if (y >= -1) {
      T.gCut.appendChild(svgEl('line', {
        class: 'tcut', x1: -4, y1: y.toFixed(1), x2: (T.w + 4).toFixed(1), y2: y.toFixed(1)
      }));
    }

    const narrow = T.w < 520;
    const t = svgEl('text', {
      class: 'tcutlbl',
      x: 10,
      y: Math.min(T.h - 8, Math.max(13, y + 14)).toFixed(1)
    });
    t.textContent = narrow
      ? 'depth limit L = ' + T.limit
      : 'depth limit L = ' + T.limit + ' — nothing below this line is ever generated';
    T.gCut.appendChild(t);
  }

  function updateBar() {
    if (T.elRound) {
      T.elRound.textContent = T.round != null
        ? 'round L = ' + T.round
        : (T.limit != null ? 'limit L = ' + T.limit : 'no depth limit');
      T.elRound.classList.toggle('on', T.limit != null);
    }
    if (T.elCount) T.elCount.textContent = T.nodes.length + ' node' + (T.nodes.length === 1 ? '' : 's');
    if (T.elMore) {
      T.elMore.textContent = T.hidden ? T.hidden + ' more not drawn' : '';
      T.elMore.classList.toggle('on', T.hidden > 0);
    }
    if (T.elFit) {
      const following = T.view.mode === 'auto' && T.view.following;
      T.elFit.textContent = following ? 'Following' : 'Fit';
      T.elFit.classList.toggle('on', following);
    }
    if (T.host && T.host.classList) T.host.classList.toggle('has-nodes', T.nodes.length > 0);
  }

  function schedule() {
    if (!T.mounted || !T.active) return;
    if (T.raf) return;
    if (typeof requestAnimationFrame !== 'function') { render(); return; }
    T.raf = requestAnimationFrame(() => { T.raf = 0; if (T.dirty) render(); });
  }

  /* =========================================================
     Pan and pinch
     One finger drags, two fingers pinch. The page never scrolls, so
     touch-action:none on the surface is safe and both gestures are ours.
     ========================================================= */
  function stageRect() {
    const stage = T.svg && T.svg.parentNode;
    if (stage && typeof stage.getBoundingClientRect === 'function') return stage.getBoundingClientRect();
    return { left: 0, top: 0, width: T.w, height: T.h };
  }
  const localX = ev => (ev.offsetX != null ? ev.offsetX
    : (ev.clientX != null ? ev.clientX - (stageRect().left || 0) : T.w / 2));
  const localY = ev => (ev.offsetY != null ? ev.offsetY
    : (ev.clientY != null ? ev.clientY - (stageRect().top || 0) : T.h / 2));

  function zoomAbout(px, py, k) {
    const k0 = T.view.k;
    k = Math.max(0.08, Math.min(2.6, k));
    T.view.tx = px - (px - T.view.tx) * (k / k0);
    T.view.ty = py - (py - T.view.ty) * (k / k0);
    T.view.k = k;
  }

  function pinchState() {
    const pts = [...T.pointers.values()];
    const a = pts[0], b = pts[1];
    if (!a || !b) return { dist: 0, cx: 0, cy: 0 };
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2
    };
  }

  function wireGestures(svg) {
    svg.addEventListener('wheel', ev => {
      if (ev.preventDefault) ev.preventDefault();
      T.view.mode = 'manual';
      zoomAbout(localX(ev), localY(ev), T.view.k * (ev.deltaY < 0 ? 1.12 : 1 / 1.12));
      T.dirty = true; render();
    }, { passive: false });

    svg.addEventListener('pointerdown', ev => {
      const id = ev.pointerId == null ? 0 : ev.pointerId;
      T.pointers.set(id, { x: localX(ev), y: localY(ev) });
      T.view.mode = 'manual';
      if (T.pointers.size >= 2) {
        T.drag = null;
        const s = pinchState();
        T.pinch = { dist: s.dist, cx: s.cx, cy: s.cy, k: T.view.k, tx: T.view.tx, ty: T.view.ty };
      } else {
        T.drag = { x: localX(ev), y: localY(ev), tx: T.view.tx, ty: T.view.ty };
      }
      if (svg.setPointerCapture && ev.pointerId != null) {
        try { svg.setPointerCapture(ev.pointerId); } catch (_) { /* not capturable */ }
      }
    });

    svg.addEventListener('pointermove', ev => {
      const id = ev.pointerId == null ? 0 : ev.pointerId;
      if (!T.pointers.has(id)) return;
      T.pointers.set(id, { x: localX(ev), y: localY(ev) });

      if (T.pointers.size >= 2 && T.pinch && T.pinch.dist > 0) {
        const now = pinchState();
        if (now.dist > 0) {
          /* replay from the gesture's starting transform so the pinch does not
             compound rounding error frame after frame */
          T.view.k = T.pinch.k; T.view.tx = T.pinch.tx; T.view.ty = T.pinch.ty;
          zoomAbout(T.pinch.cx, T.pinch.cy, T.pinch.k * (now.dist / T.pinch.dist));
          T.view.tx += now.cx - T.pinch.cx;
          T.view.ty += now.cy - T.pinch.cy;
        }
      } else if (T.drag) {
        T.view.tx = T.drag.tx + (localX(ev) - T.drag.x);
        T.view.ty = T.drag.ty + (localY(ev) - T.drag.y);
      }
      T.dirty = true; render();
    });

    const lift = ev => {
      if (!ev || ev.pointerId == null) T.pointers.clear();
      else T.pointers.delete(ev.pointerId);
      if (T.pointers.size < 2) T.pinch = null;
      if (T.pointers.size === 1) {
        const only = T.pointers.values().next().value;
        T.drag = { x: only.x, y: only.y, tx: T.view.tx, ty: T.view.ty };
      } else if (T.pointers.size === 0) {
        T.drag = null;
      }
    };
    svg.addEventListener('pointerup', lift);
    svg.addEventListener('pointercancel', lift);
    svg.addEventListener('pointerleave', lift);
  }

  /* =========================================================
     Mount
     ========================================================= */
  function mount(container) {
    if (T.mounted) return;
    const host = document.createElement('div');
    host.className = 'world-tree';

    const bar = document.createElement('div');
    bar.className = 'tbar';
    const round = document.createElement('span'); round.className = 'tbadge'; round.textContent = 'no depth limit';
    const count = document.createElement('span'); count.className = 'tcount'; count.textContent = '0 nodes';
    const more = document.createElement('span'); more.className = 'tmore'; more.textContent = '';
    const sp = document.createElement('span'); sp.className = 'tspacer';
    const hint = document.createElement('span'); hint.className = 'thint'; hint.textContent = 'drag to pan · pinch or scroll to zoom';
    const btn = document.createElement('button');
    btn.className = 'tfit'; btn.type = 'button'; btn.textContent = 'Fit';
    btn.setAttribute('aria-label', 'Fit the tree back into view');
    bar.appendChild(round); bar.appendChild(count); bar.appendChild(more);
    bar.appendChild(sp); bar.appendChild(hint); bar.appendChild(btn);

    const stage = document.createElement('div');
    stage.className = 'tstage';
    const svg = svgEl('svg', { class: 'tsvg', width: '100%', height: '100%', preserveAspectRatio: 'none' });
    const gPan = svgEl('g', { class: 'tpan' });
    const gEdges = svgEl('g', { class: 'tedges' });
    const gNodes = svgEl('g', { class: 'tnodes' });
    /* the cut group lives outside gPan, in screen space, so it never scales */
    const gCut = svgEl('g', { class: 'tcutg' });
    gPan.appendChild(gEdges); gPan.appendChild(gNodes);
    svg.appendChild(gPan); svg.appendChild(gCut);
    stage.appendChild(svg);

    const empty = document.createElement('div');
    empty.className = 'tempty';
    empty.textContent = 'The tree is drawn from the run in the Graph world. Press Play or Step.';
    stage.appendChild(empty);

    host.appendChild(bar); host.appendChild(stage);
    container.appendChild(host);

    T.host = host; T.svg = svg; T.gPan = gPan; T.gCut = gCut; T.gEdges = gEdges; T.gNodes = gNodes;
    T.elRound = round; T.elCount = count; T.elMore = more; T.elFit = btn;
    T.mounted = true;
    T.cap = capFor(viewportW());

    btn.addEventListener('click', () => {
      T.view.mode = 'auto';
      T.pointers.clear(); T.pinch = null; T.drag = null;
      T.dirty = true; render();
    });
    wireGestures(svg);

    resize();
  }

  function resize() {
    if (!T.mounted) return;
    let w = T.w, h = T.h;
    const b = stageRect();
    if (b && b.width > 40) w = b.width;
    if (b && b.height > 40) h = b.height;
    T.w = w; T.h = h;
    /* unrounded, so one svg user unit is exactly one css pixel and the
       screen-space cut line lands where it is put */
    T.svg.setAttribute('viewBox', '0 0 ' + w.toFixed(2) + ' ' + h.toFixed(2));
    T.dirty = true;
    render();
  }

  function activate() { T.active = true; T.dirty = true; resize(); }
  function deactivate() { T.active = false; }

  function problem() {
    const gw = graphWorld();
    if (!gw || typeof gw.problem !== 'function') {
      throw new Error('the tree world is a view of the graph world, which is not registered');
    }
    return gw.problem();
  }

  /* =========================================================
     Registration
     ========================================================= */
  const world = {
    id: 'tree', label: 'Tree', order: 3,
    mount, activate, deactivate, problem, reset, apply, showPath, resize, highlight,
    supportsRace: false
  };

  if (typeof SAD.registerWorld === 'function') {
    SAD.registerWorld(world);
  } else {
    SAD.worlds = SAD.worlds || [];
    SAD.worlds.push(world);
    SAD.worlds.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (typeof SAD.worldOf !== 'function') {
      SAD.worldOf = id => (SAD.worlds || []).filter(w => w.id === id)[0] || null;
    }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof SAD.registerWorld === 'function' &&
          !(SAD.worlds || []).some(w => w.id === 'tree')) {
        SAD.registerWorld(world);
      }
    });
  }

})(typeof globalThis !== 'undefined' ? globalThis : window);
