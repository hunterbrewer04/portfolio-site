/* Graph world — SVG rendering of a preset graph model. Presets only, no editor.
   Pan with one finger or the mouse, pinch or wheel to zoom, Fit resets the view. */
(function (root) {
'use strict';
const SAD = (root.SAD = root.SAD || {});

const NS = 'http://www.w3.org/2000/svg';
const AR = 1.55;            // content box aspect the layout prefers
const MAX_STRETCH = 1.45;   // how far a tall container may pull it out of that aspect
const MIN_K = 0.4, MAX_K = 6;

function svgEl(tag, attrs){
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const r1 = v => Math.round(v * 10) / 10;
const fmt = v =>
  v == null || !isFinite(v) ? '' : (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : String(Math.round(v)));
const ekey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================
   State
   ========================================================= */
let host = null, wrap = null, svg = null, scene = null, caption = null;
let gEdges, gPath, gCosts, gNodes, pathLine;
let model = null, sawH = false;
let radius = 18, fLabel = 10.5, fCost = 10, fVal = 9;
let box = { x:0, y:0, w:1, h:1 };
let size = { w:900, h:560 };
let minGap = 999;
const view = { k:1, tx:0, ty:0 };
const nodes = new Map();   // id -> { x, y, px, py, g, pop, base, dot, ring, mark, vals, lbl, slot, gv, hv, fv }
const edges = new Map();   // key -> { a, b, line, chip, text, digits }

/* =========================================================
   Build
   ========================================================= */
function skeleton(container){
  host = container;
  wrap = document.createElement('div');
  wrap.className = 'world-graph';

  svg = svgEl('svg', { class:'gsvg', xmlns:NS, preserveAspectRatio:'xMidYMid meet' });
  scene  = svgEl('g', { class:'scene' });
  gEdges = svgEl('g', { class:'edges' });
  gPath  = svgEl('g', { class:'pathlayer' });
  gCosts = svgEl('g', { class:'costs' });
  gNodes = svgEl('g', { class:'nodes' });
  pathLine = svgEl('path', { class:'pathline' });
  gPath.appendChild(pathLine);
  scene.append(gEdges, gPath, gCosts, gNodes);
  svg.appendChild(scene);

  caption = document.createElement('div');
  caption.className = 'gcaption';

  wrap.append(svg, tools(), caption);
  host.appendChild(wrap);
  bindGestures();

  if (typeof ResizeObserver === 'function') new ResizeObserver(() => place()).observe(wrap);
}

const ICON = {
  out: 'M5 11h14v2H5z',
  in:  'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  fit: 'M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z'
};

function tools(){
  const bar = document.createElement('div');
  bar.className = 'gtools';
  for (const act of ['out', 'in', 'fit']){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gbtn';
    b.dataset.act = act;
    b.title = act === 'fit' ? 'Fit graph to view' : act === 'in' ? 'Zoom in' : 'Zoom out';
    b.setAttribute('aria-label', b.title);
    const s = svgEl('svg', { viewBox:'0 0 24 24', 'aria-hidden':'true' });
    s.appendChild(svgEl('path', { d:ICON[act] }));
    b.appendChild(s);
    b.addEventListener('click', () => {
      if (act === 'fit') fit();
      else zoomBy(act === 'in' ? 1.35 : 1 / 1.35);
    });
    bar.appendChild(b);
  }
  return bar;
}

function build(){
  gEdges.replaceChildren();
  gCosts.replaceChildren();
  gNodes.replaceChildren();
  nodes.clear();
  edges.clear();

  for (const e of model.edges){
    const line = svgEl('line', { class:'gedge' });
    const chip = svgEl('rect', { class:'gchip' });
    const text = svgEl('text', { class:'gcost' });
    text.textContent = String(e.cost);
    gEdges.appendChild(line);
    gCosts.append(chip, text);
    edges.set(ekey(e.a, e.b), { a:e.a, b:e.b, line, chip, text, digits:String(e.cost).length });
  }

  for (const n of model.nodes){
    const g = svgEl('g', { class:'gnode' });
    g.dataset.id = n.id;
    const pop  = svgEl('g', { class:'pop' });
    const base = svgEl('circle', { class:'base' });
    const dot  = svgEl('circle', { class:'dot' });
    const ring = svgEl('circle', { class:'meetring' });
    pop.append(base, dot, ring);

    let mark = null;
    if (n.id === model.start){ g.classList.add('is-start'); mark = startMark(); }
    else if (n.id === model.goal){ g.classList.add('is-goal'); mark = goalMark(); }
    if (mark) pop.appendChild(mark.el);

    const vals = svgEl('text', { class:'nval' });
    const lbl  = svgEl('text', { class:'nlbl' });
    lbl.textContent = n.label ?? n.id;

    g.append(pop, vals, lbl);
    gNodes.appendChild(g);
    nodes.set(n.id, {
      x:n.x, y:n.y, px:0, py:0, slot:n.labelPos || 'below',
      g, pop, base, dot, ring, mark, vals, lbl,
      gv:null, hv:null, fv:null
    });
  }

  caption.replaceChildren();
  const name = document.createElement('b');
  name.textContent = model.name || model.id;
  caption.appendChild(name);
  if (model.note){
    const note = document.createElement('span');
    note.textContent = model.note;
    caption.appendChild(note);
  }
  const hint = document.createElement('em');
  hint.textContent = 'Pinch or scroll to zoom · drag to pan';
  caption.appendChild(hint);
  caption.classList.toggle('warn', model.admissible === false);
}

// the same two glyphs the grid uses for start and goal
function startMark(){
  const el = svgEl('g', { class:'mark' });
  const p = svgEl('path');
  el.appendChild(p);
  return { el, kind:'start', p };
}
function goalMark(){
  const el = svgEl('g', { class:'mark goal' });
  const ring = svgEl('circle', { class:'ring' });
  const pip  = svgEl('circle', { class:'pip' });
  el.append(ring, pip);
  return { el, kind:'goal', ring, pip };
}

/* =========================================================
   Layout — fit a fixed-aspect content box, sized to the container
   ========================================================= */
function measure(){
  let r = host.getBoundingClientRect();
  if (!(r.width > 40) || !(r.height > 40)) r = wrap.getBoundingClientRect();
  return {
    w: Math.max(280, Math.round(r.width)  || 900),
    h: Math.max(220, Math.round(r.height) || 560)
  };
}

function place(){
  if (!model) return;
  size = measure();
  const W = size.w, H = size.h;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // pad each axis off its own extent: a tall narrow container must not spend
  // its scarce width on padding sized by its abundant height
  const padX = clamp(W * 0.04, 10, 44), padY = clamp(H * 0.04, 10, 44);
  // the tool bar and the caption float over the surface, so the graph keeps clear of them
  const capH = Math.round(caption.getBoundingClientRect().height) || 46;
  const top = Math.max(padY, 64), bottom = padY + capH + 6;
  const availW = Math.max(80, W - padX * 2), availH = Math.max(60, H - top - bottom);
  let bw = availW, bh = bw / AR;
  if (bh > availH){
    bh = availH; bw = bh * AR;          // wide container: width follows height, aspect kept
  } else {
    // Tall container (phone, iPad portrait). Width is already maxed out, so the only
    // way to use the column is vertical stretch. Take it when the slack is worth
    // having, and never past MAX_STRETCH, so the map stays recognisable.
    const want = Math.min(availH, bh * MAX_STRETCH);
    if (want / bh > 1.15) bh = want;
  }
  box = { x:(W - bw) / 2, y:top + (availH - bh) / 2, w:bw, h:bh };

  // everything scales off the content box, so a phone gets a proportionally
  // smaller graph instead of desktop-sized nodes crammed into a narrow strip
  const ui = clamp(box.w / 960, 0.5, 1.2);
  radius = Math.max(7, Math.round((model.nodes.length > 20 ? 15 : 18) * ui));
  fLabel = r1(clamp(10.5 * ui, 7.5, 12));
  fCost  = r1(clamp(10 * ui, 7, 11));
  fVal   = r1(clamp(9 * ui, 6.5, 10));
  wrap.style.setProperty('--g-label', fLabel + 'px');
  wrap.style.setProperty('--g-cost', fCost + 'px');
  wrap.style.setProperty('--g-val', fVal + 'px');

  sizeNodes();

  const list = [...nodes.values()];
  for (const n of list){
    n.px = box.x + n.x * box.w;
    n.py = box.y + n.y * box.h;
    n.g.setAttribute('transform', `translate(${n.px.toFixed(1)} ${n.py.toFixed(1)})`);
  }
  minGap = Infinity;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      minGap = Math.min(minGap, Math.hypot(list[i].px - list[j].px, list[i].py - list[j].py));
  if (!isFinite(minGap)) minGap = 999;

  const chipH = Math.round(fCost * 1.5);
  const off = radius * 0.67;
  for (const e of edges.values()){
    const A = nodes.get(e.a), B = nodes.get(e.b);
    if (!A || !B) continue;
    const dx = B.px - A.px, dy = B.py - A.py;
    const len = Math.hypot(dx, dy) || 1;
    const ox = dx / len * (radius + 1), oy = dy / len * (radius + 1);
    e.line.setAttribute('x1', (A.px + ox).toFixed(1));
    e.line.setAttribute('y1', (A.py + oy).toFixed(1));
    e.line.setAttribute('x2', (B.px - ox).toFixed(1));
    e.line.setAttribute('y2', (B.py - oy).toFixed(1));

    // sit the cost chip just off the line, always on the upper side, so it
    // clears the node labels hanging under the endpoints
    let nx = -dy / len, ny = dx / len;
    if (ny > 0){ nx = -nx; ny = -ny; }
    const cx = (A.px + B.px) / 2 + nx * off, cy = (A.py + B.py) / 2 + ny * off;
    const cw = r1(fCost * 0.64 * e.digits + fCost * 1.1);
    e.chip.setAttribute('width', cw);
    e.chip.setAttribute('height', chipH);
    e.chip.setAttribute('rx', Math.round(chipH / 3));
    e.chip.setAttribute('x', r1(cx - cw / 2));
    e.chip.setAttribute('y', r1(cy - chipH / 2));
    e.text.setAttribute('x', r1(cx));
    e.text.setAttribute('y', r1(cy + fCost * 0.36));
  }

  clampView();
  applyView();
  if (shown.length) drawPathLine(false);
}

function sizeNodes(){
  const below = radius + fLabel * 1.45, above = -(radius + fVal * 1.0);
  const side  = radius + fLabel * 0.65, mid = fLabel * 0.38;
  for (const n of nodes.values()){
    n.base.setAttribute('r', radius);
    n.dot.setAttribute('r', radius);
    n.ring.setAttribute('r', r1(radius + fLabel * 0.55));
    if (n.mark){
      if (n.mark.kind === 'start'){
        const s = r1(radius * 0.62);
        n.mark.p.setAttribute('d', `M${r1(-s * 0.55)} ${-s}L${s} 0L${r1(-s * 0.55)} ${s}Z`);
      } else {
        n.mark.ring.setAttribute('r', r1(radius * 0.55));
        n.mark.ring.setAttribute('stroke-width', r1(Math.max(1.4, radius * 0.11)));
        n.mark.pip.setAttribute('r', r1(radius * 0.20));
      }
    }
    switch (n.slot){
      case 'above': place1(n.lbl, 0, above, 'middle'); place1(n.vals, 0, below, 'middle'); break;
      case 'left':  place1(n.lbl, -side, mid, 'end');  place1(n.vals, side, mid, 'start'); break;
      case 'right': place1(n.lbl, side, mid, 'start'); place1(n.vals, -side, mid, 'end');  break;
      default:      place1(n.lbl, 0, below, 'middle'); place1(n.vals, 0, above, 'middle');
    }
  }
}

function place1(t, x, y, anchor){
  t.setAttribute('x', r1(x));
  t.setAttribute('y', r1(y));
  t.setAttribute('text-anchor', anchor);
}

/* =========================================================
   Pan and zoom
   ========================================================= */
function applyView(){
  scene.setAttribute('transform',
    `translate(${r1(view.tx)} ${r1(view.ty)}) scale(${view.k.toFixed(4)})`);
  // thin the text out as the graph gets dense on screen, rather than let it overlap
  const gap = minGap * view.k;
  wrap.classList.toggle('compact', gap < 34);
  wrap.classList.toggle('minimal', gap < 26);
  wrap.classList.toggle('zoomed',
    Math.abs(view.k - 1) > 0.01 || Math.abs(view.tx) > 1 || Math.abs(view.ty) > 1);
}

// keep some of the graph on screen no matter how far it was dragged
function clampView(){
  const M = 60;
  const x0 = box.x * view.k + view.tx, x1 = (box.x + box.w) * view.k + view.tx;
  const y0 = box.y * view.k + view.ty, y1 = (box.y + box.h) * view.k + view.ty;
  if (x1 < M) view.tx += M - x1;
  else if (x0 > size.w - M) view.tx -= x0 - (size.w - M);
  if (y1 < M) view.ty += M - y1;
  else if (y0 > size.h - M) view.ty -= y0 - (size.h - M);
}

function zoomAt(k, lx, ly){
  const nk = clamp(k, MIN_K, MAX_K);
  const sx = (lx - view.tx) / view.k, sy = (ly - view.ty) / view.k;
  view.k = nk;
  view.tx = lx - sx * nk;
  view.ty = ly - sy * nk;
  clampView();
  applyView();
}
function zoomBy(f){ zoomAt(view.k * f, size.w / 2, size.h / 2); }
function fit(){ view.k = 1; view.tx = 0; view.ty = 0; clampView(); applyView(); }

const active = new Map();
let gesture = null;

function centroid(pts){
  let x = 0, y = 0;
  for (const p of pts){ x += p.x; y += p.y; }
  return { x:x / pts.length, y:y / pts.length };
}
const spread = pts => Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
function toLocal(cx, cy){
  const r = svg.getBoundingClientRect();
  return { x:cx - r.left, y:cy - r.top };
}

// one pointer pans, two pinch — same maths, so both run through one path
function beginGesture(){
  const pts = [...active.values()];
  if (!pts.length){ gesture = null; return; }
  const m = centroid(pts), c = toLocal(m.x, m.y);
  gesture = {
    k: view.k,
    dist: pts.length > 1 ? spread(pts) : 0,
    sx: (c.x - view.tx) / view.k,
    sy: (c.y - view.ty) / view.k
  };
}
function runGesture(){
  if (!gesture) return;
  const pts = [...active.values()];
  if (!pts.length) return;
  const m = centroid(pts), c = toLocal(m.x, m.y);
  let k = view.k;
  if (pts.length > 1 && gesture.dist > 0) k = clamp(gesture.k * spread(pts) / gesture.dist, MIN_K, MAX_K);
  view.k = k;
  view.tx = c.x - gesture.sx * k;
  view.ty = c.y - gesture.sy * k;
  clampView();
  applyView();
}

function bindGestures(){
  svg.addEventListener('pointerdown', e => {
    if (e.button != null && e.button > 1) return;
    try { svg.setPointerCapture(e.pointerId); } catch (_){ /* capture is best effort */ }
    active.set(e.pointerId, { x:e.clientX, y:e.clientY });
    wrap.classList.add('dragging');
    beginGesture();
  });
  svg.addEventListener('pointermove', e => {
    if (!active.has(e.pointerId)) return;
    active.set(e.pointerId, { x:e.clientX, y:e.clientY });
    runGesture();
  });
  const release = e => {
    if (!active.delete(e.pointerId)) return;
    if (!active.size) wrap.classList.remove('dragging');
    beginGesture();            // re-baseline so lifting one finger does not jump the view
  };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);
  svg.addEventListener('pointerleave', e => {
    // while the pointer is captured the drag continues off-surface; without capture
    // leaving is the only end-of-drag signal we will get
    if (svg.hasPointerCapture && svg.hasPointerCapture(e.pointerId)) return;
    release(e);
  });
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const p = toLocal(e.clientX, e.clientY);
    zoomAt(view.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), p.x, p.y);
  }, { passive:false });
  svg.addEventListener('dblclick', fit);
}

/* =========================================================
   Search state
   ========================================================= */
const STATES = ['is-frontier', 'is-visited', 'is-cutoff', 'is-path'];
const RANK = { 'is-frontier':1, 'is-visited':2, 'is-cutoff':3, 'is-path':4 };
let shown = [];
let meetAt = null;

function rankOf(g){
  let r = 0;
  for (const c of STATES) if (g.classList.contains(c)) r = Math.max(r, RANK[c]);
  return r;
}
function setState(id, cls){
  const n = nodes.get(id);
  if (!n) return;
  // tree search re-pushes states it has already expanded; that must not wipe the expansion
  if (cls === 'is-frontier' && rankOf(n.g) > RANK['is-frontier']) return;
  n.g.classList.remove(...STATES);
  n.g.classList.add(cls);
}

function setVals(id, s){
  const n = nodes.get(id);
  if (!n) return;
  const hadH = sawH;
  if (s.h > 0) sawH = true;
  if (s.g != null) n.gv = s.g;
  if (s.h != null) n.hv = s.h;
  if (s.f != null) n.fv = s.f;
  if (sawH && !hadH) for (const other of nodes.values()) renderVals(other);
  else renderVals(n);
}

function renderVals(n){
  let t = '';
  if (n.gv != null){
    t = 'g' + fmt(n.gv);
    if (sawH) t += ' h' + fmt(n.hv || 0) + ' f' + fmt(n.fv != null ? n.fv : n.gv + (n.hv || 0));
  }
  if (n.vals.textContent !== t) n.vals.textContent = t;
}

function markTreeEdge(from, to){
  const e = edges.get(ekey(from, to));
  if (e) e.line.classList.add('is-tree');
}

function pushAll(list, side){
  if (!list) return;
  for (const p of list){
    if (!p || p.id == null) continue;
    const n = nodes.get(p.id);
    if (!n) continue;
    if (side && !n.g.dataset.side) n.g.dataset.side = side;
    if (p.parent != null) markTreeEdge(p.parent, p.id);
    setState(p.id, 'is-frontier');
    setVals(p.id, p);
  }
}

// a one-shot class the CSS animation hangs off, cleared so it can fire again
function flash(id, cls){
  const n = nodes.get(id);
  if (!n) return;
  n.g.classList.remove(cls);
  requestAnimationFrame(() => n.g.classList.add(cls));
  setTimeout(() => n.g.classList.remove(cls), 520);
}

function clearSearch(){
  for (const n of nodes.values()){
    n.g.classList.remove(...STATES, 'is-meet', 'is-hl', 'is-stale');
    delete n.g.dataset.side;
    n.pop.style.animationDelay = '';
    n.gv = n.hv = n.fv = null;
    if (n.vals.textContent) n.vals.textContent = '';
  }
  for (const e of edges.values()) e.line.classList.remove('is-tree', 'is-path');
  sawH = false;
  shown = [];
  meetAt = null;
  pathLine.style.transition = 'none';
  pathLine.style.opacity = 0;
  pathLine.removeAttribute('d');
}

/* =========================================================
   Solution path
   ========================================================= */
function drawPathLine(animate){
  const pts = shown.map(id => nodes.get(id)).filter(Boolean);
  if (pts.length < 2){ pathLine.removeAttribute('d'); return; }
  const d = pts.map((n, k) => `${k === 0 ? 'M' : 'L'}${n.px.toFixed(1)} ${n.py.toFixed(1)}`).join(' ');
  pathLine.setAttribute('d', d);
  pathLine.style.opacity = 1;

  let len = 0;
  if (animate && !reduceMotion()){
    try { len = pathLine.getTotalLength(); } catch (_){ /* not laid out yet */ }
  }
  if (!len){                                   // reduced motion, or a relayout: draw it at once
    pathLine.style.transition = 'none';
    pathLine.style.strokeDasharray = 'none';
    pathLine.style.strokeDashoffset = 0;
    return;
  }
  pathLine.style.transition = 'none';
  pathLine.style.strokeDasharray = len;
  pathLine.style.strokeDashoffset = len;
  requestAnimationFrame(() => {
    const ms = Math.min(1400, Math.max(360, shown.length * 130));
    pathLine.style.transition = `stroke-dashoffset ${ms}ms cubic-bezier(.3,.7,.3,1)`;
    pathLine.style.strokeDashoffset = 0;
  });
}

function showPath(path){
  if (!path || !path.length) return;
  const stagger = !reduceMotion();
  shown = path.slice();
  for (let k = 1; k < shown.length; k++){
    const e = edges.get(ekey(shown[k - 1], shown[k]));
    if (e) e.line.classList.add('is-path');
  }
  shown.forEach((id, k) => {
    const n = nodes.get(id);
    if (!n) return;
    n.g.classList.remove(...STATES);
    if (stagger){
      n.pop.style.animationDelay = (k * 55) + 'ms';
      setTimeout(() => { n.pop.style.animationDelay = ''; }, k * 55 + 700);
    }
    n.g.classList.add('is-path');
  });
  drawPathLine(true);
}

/* =========================================================
   World
   ========================================================= */
function resolvePreset(arg){
  const all = SAD.graphPresets || [];
  if (typeof arg === 'string') return all.find(p => p.id === arg) || null;
  if (typeof arg === 'number') return all[arg] || null;
  if (arg && typeof arg === 'object') return arg;
  return null;
}

function load(preset){
  model = (typeof preset.generate === 'function') ? preset.generate() : preset;
  SAD.activePreset = model;
  build();
  clearSearch();
  fit();
  place();
}

SAD.registerWorld({
  id: 'graph',
  label: 'Graph',
  order: 2,
  supportsRace: false,

  mount(container){
    skeleton(container);
    load((SAD.graphPresets || [])[0]);
    requestAnimationFrame(place);
  },

  activate(){ place(); },
  deactivate(){},

  problem(){ return SAD.graphProblem(model); },

  reset(){ clearSearch(); },

  resize(){ place(); },

  highlight(nodeId, on){
    const n = nodes.get(nodeId);
    if (n) n.g.classList.toggle('is-hl', !!on);
  },

  apply(step){
    if (!step) return;
    switch (step.kind){
      case 'init':
        pushAll(step.pushed, step.side);
        break;

      case 'expand':
        setState(step.id, 'is-visited');
        setVals(step.id, step);
        pushAll(step.pushed, step.side);
        break;

      case 'stale':
        flash(step.id, 'is-stale');
        break;

      case 'cutoff':
        setState(step.id, 'is-cutoff');
        setVals(step.id, step);
        break;

      case 'goal':
        // goalTest:'gen' carries the goal in `pushed`, goalTest:'pop' carries nothing.
        // Take the pushes first so the goal gets its tree edge, then mark it expanded.
        pushAll(step.pushed, step.side);
        setState(step.id, 'is-visited');
        setVals(step.id, step);
        break;

      case 'meet': {
        // fires again on every better meeting, so the ring marks the current best
        // rather than accumulating a trail of superseded ones
        if (meetAt != null && meetAt !== step.id){
          const prev = nodes.get(meetAt);
          if (prev) prev.g.classList.remove('is-meet');
        }
        const n = nodes.get(step.id);
        if (n){ n.g.classList.add('is-meet'); meetAt = step.id; }
        setVals(step.id, step);
        break;
      }

      case 'restart':
        clearSearch();
        break;

      case 'fail':
      default:
        break;
    }
  },

  showPath,

  /* Addendum 1 and 6 — the app calls this with a preset object plus an index,
     older callers with an id. Take whatever arrives. */
  setPreset(presetOrIdOrIndex, index){
    let p = resolvePreset(presetOrIdOrIndex);
    if (!p && typeof index === 'number') p = resolvePreset(index);
    if (!p) return;
    load(p);
    SAD.worldChanged();
  },
  model(){ return model; }
});

})(typeof globalThis !== 'undefined' ? globalThis : window);
