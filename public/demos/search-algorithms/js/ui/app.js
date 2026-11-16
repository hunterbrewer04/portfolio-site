(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});

  /* The conductor. Owns the run loop, the pickers and switches, the keyboard,
     and race mode. It pulls a Problem from the active world, drives one
     algorithm generator, and pumps the resulting steps at every world plus the
     panels. */

  const $ = id => document.getElementById(id);
  const fmt = v => (v == null || !isFinite(v)) ? '—'
    : (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : String(Math.round(v)));
  const lab = n => SAD.panels.labelFor(n);

  const MAX_EXPANSIONS = 200000;
  const speedFor = v => Math.round(2 * Math.pow(320, v / 100));

  const NOTE_GOAL = {
    pop: 'Checked when a node comes off the frontier. UCS and A* stay optimal.',
    gen: 'Checked as soon as a node is generated. UCS and A* lose optimality.'
  };
  const NOTE_SEARCH = {
    graph: 'Explored set kept: each state is expanded at most once.',
    tree: 'No explored set: a state can reappear on many paths. Only cycles on the current path are blocked.'
  };
  const HINT_GRID =
    'Drag to draw walls · drag the start/goal markers · <kbd>shift</kbd>-drag or right-drag paints cost-5 terrain · ' +
    '<kbd>space</kbd> play/pause · <kbd>s</kbd> step · <kbd>r</kbd> reset · <kbd>1</kbd>–<kbd>8</kbd> pick algorithm';
  const HINT_PLAIN =
    '<kbd>space</kbd> play/pause · <kbd>s</kbd> step · <kbd>r</kbd> reset · <kbd>1</kbd>–<kbd>8</kbd> pick algorithm';

  const UI = { algo:null, world:null, mode:'explore', limit:12, speed:70,
               goalTest:'pop', search:'graph' };

  const sim = {
    gen:null, problem:null, playing:false, finished:false, started:false,
    expanded:0, peak:0, fsize:0, cost:null, len:null, status:'Ready',
    frontier:null, dirty:true
  };

  let wraps = new Map();          // world id -> its wrapper div in #worldHost
  let problemCache = null;

  const worlds = () => SAD.worlds || [];
  const worldById = id => worlds().find(w => w.id === id);
  const activeWorld = () => worldById(UI.world);
  const entry = () => SAD.algorithmById(UI.algo);

  function currentOpts(){
    return { limit: UI.limit, goalTest: UI.goalTest, search: UI.search, maxExpansions: MAX_EXPANSIONS };
  }

  /* Worlds need to know which algorithm is running to label their nodes and to
     decide whether a depth cut line applies. Publish it rather than making them
     read it back out of the rendered card. */
  function publishAlgorithm(){
    SAD.currentAlgorithm = entry() || null;
    SAD.currentOpts = currentOpts();
    for (const w of worlds())
      if (typeof w.setAlgorithm === 'function') w.setAlgorithm(SAD.currentAlgorithm, SAD.currentOpts);
  }

  function getProblem(){
    if (!problemCache) problemCache = activeWorld().problem();
    return problemCache;
  }

  /* True path cost, read back off the problem rather than trusted from the
     step, so the number is right no matter which goal-test rule is in force. */
  function pathCost(problem, path){
    if (!path || path.length < 2) return 0;
    let total = 0;
    for (let k = 0; k < path.length - 1; k++){
      let best = Infinity;
      for (const s of problem.successors(path[k]))
        if (s.to === path[k + 1] && s.cost < best) best = s.cost;
      if (!isFinite(best)) return null;
      total += best;
    }
    return total;
  }

  /* =========================================================
     Run control
     ========================================================= */
  function resetRun(){
    sim.gen = null; sim.problem = null;
    sim.playing = false; sim.finished = false; sim.started = false;
    sim.expanded = 0; sim.peak = 0; sim.fsize = 0;
    sim.cost = null; sim.len = null; sim.status = 'Ready';
    sim.frontier = null;
    for (const w of worlds()) w.reset();
    SAD.panels.clearLog();
    SAD.panels.emptyNote = 'press Play or Step to start';
    sim.dirty = true;
    setPlayLabel();
  }

  function startRun(){
    resetRun();
    const p = sim.problem = getProblem();
    SAD.panels.labelFor = n => p.label(n);
    publishAlgorithm();
    sim.gen = entry().make(p, SAD.currentOpts);
    sim.started = true;
    sim.status = 'Running';
  }

  function doStep(){
    if (UI.mode !== 'explore') return;
    if (!sim.started) startRun();
    if (sim.finished) return;
    const r = sim.gen.next();
    if (r.done){
      sim.finished = true; sim.playing = false; setPlayLabel();
      return;
    }
    applyStep(r.value);
  }

  function applyStep(v){
    if (v.frontier) sim.frontier = v.frontier;
    if (v.fsize != null){ sim.fsize = v.fsize; sim.peak = Math.max(sim.peak, v.fsize); }

    const sd = v.side ? ` [${v.side}]` : '';
    const tail = v.note ? `  — ${v.note}` : '';

    switch (v.kind){
      case 'init':
        if (v.pushed && v.pushed.length)
          SAD.panels.log('push', `start ${lab(v.pushed[0].id)} on the frontier${tail}`);
        break;

      case 'expand': {
        sim.expanded++;
        const k = v.pushed ? v.pushed.length : 0;
        SAD.panels.log('expand',
          `expand ${lab(v.id)}${sd}  g=${fmt(v.g)}${v.depth != null ? `  d=${v.depth}` : ''}` +
          `  →  ${k} child${k === 1 ? '' : 'ren'}${tail}`);
        break;
      }

      case 'stale':
        SAD.panels.log('skip', `pop ${lab(v.id)}${sd} — already expanded, discard${tail}`);
        break;

      case 'cutoff':
        sim.expanded++;
        SAD.panels.log('cut',
          `cutoff ${lab(v.id)} at depth ${v.depth} — children not generated${tail}`);
        break;

      case 'restart':
        // IDDFS opening its next round. Every visual goes; `expanded` and `peak`
        // stay cumulative, because the total work summed over the rounds is the
        // whole cost argument for iterative deepening.
        sim.status = `Round L = ${v.iteration}`;
        sim.fsize = 0;
        for (const w of worlds()) w.reset();
        SAD.panels.log('info', `restart — depth limit L = ${v.iteration}${tail}`);
        break;

      case 'meet':
        SAD.panels.log('info', `frontiers met at ${lab(v.id)} — not necessarily optimal yet${tail}`);
        break;

      case 'goal':
        sim.expanded++;
        break;

      case 'fail':
        sim.finished = true; sim.playing = false;
        sim.status = v.cutoff ? 'Cutoff' : (v.note === 'cap' ? 'Capped' : 'No path');
        SAD.panels.log('fail', v.cutoff
          ? `frontier empty — no goal within depth ${UI.limit} (cutoff)`
          : v.note === 'cap'
            ? `stopped at the ${MAX_EXPANSIONS.toLocaleString()} expansion safety cap`
            : 'frontier empty — the goal is unreachable');
        SAD.panels.emptyNote = 'frontier empty';
        setPlayLabel();
        break;
    }

    for (const w of worlds()) w.apply(v);

    if (v.kind === 'goal') finishGoal(v);
    sim.dirty = true;
  }

  function finishGoal(v){
    const path = v.path || [];
    const cost = pathCost(sim.problem, path);
    sim.cost = cost != null ? cost : (v.g != null ? v.g : null);
    sim.len = Math.max(0, path.length - 1);
    sim.finished = true; sim.playing = false;
    sim.status = 'Found';
    SAD.panels.emptyNote = 'frontier empty';
    SAD.panels.log('goal',
      `GOAL ${lab(v.id)} — cost ${fmt(sim.cost)}, ${sim.len} steps, ${sim.expanded} nodes expanded`);
    for (const w of worlds()) w.showPath(path);
    setPlayLabel();
  }

  /* =========================================================
     Animation loop
     ========================================================= */
  let lastT = 0, acc = 0, lastFlush = 0;

  function frame(t){
    requestAnimationFrame(frame);
    if (!lastT) lastT = t;
    const dt = Math.min(120, t - lastT); lastT = t;

    const sps = speedFor(UI.speed);
    if (UI.mode === 'explore'){
      if (sim.playing && !sim.finished){
        acc += dt / 1000 * sps;
        let budget = Math.min(600, Math.floor(acc));
        acc -= budget;
        while (budget-- > 0 && sim.playing && !sim.finished) doStep();
      }
    } else {
      if (race.playing && !race.done){
        acc += dt / 1000 * sps;
        let budget = Math.min(600, Math.floor(acc));
        acc -= budget;
        while (budget-- > 0 && !race.done) raceStep();
      }
    }
    flushUI();
  }

  function flushUI(){
    const now = performance.now();
    if (UI.mode === 'explore'){
      if (!sim.dirty || now - lastFlush < 70) return;
      lastFlush = now; sim.dirty = false;
      SAD.panels.update({
        expanded: sim.expanded, fsize: sim.fsize, peak: sim.peak,
        cost: sim.cost, len: sim.len, status: sim.status
      });
      if (SAD.panels.wantsFrontier())
        SAD.panels.renderFrontier(sim.frontier ? sim.frontier() : [], entry());
    } else {
      if (!race.dirty || now - lastFlush < 70) return;
      lastFlush = now; race.dirty = false;
      renderRaceStats();
    }
  }

  /* =========================================================
     World toggle
     ========================================================= */
  function buildWorldTabs(){
    const el = $('worldTabs');
    el.replaceChildren();
    for (const w of worlds()){
      const b = document.createElement('button');
      b.textContent = w.label;
      b.dataset.w = w.id;
      b.onclick = () => setWorld(w.id);
      el.appendChild(b);
    }
  }

  function mountWorlds(){
    const hostEl = $('worldHost');
    for (const w of worlds()){
      const div = document.createElement('div');
      div.className = `world world-${w.id}`;
      hostEl.appendChild(div);
      wraps.set(w.id, div);
      w.mount(div);
    }
  }

  /* Switching worlds mid-run must NOT reset the run: every world has been fed
     the same step stream, so the one you switch to is already current. */
  function setWorld(id){
    const prev = activeWorld();
    if (prev && prev.id !== id) prev.deactivate();
    UI.world = id;
    for (const [wid, div] of wraps) div.classList.toggle('on', wid === id);
    for (const b of $('worldTabs').children) b.classList.toggle('on', b.dataset.w === id);

    const w = activeWorld();
    problemCache = null;            // the next run comes from this world
    if (!w.supportsRace && UI.mode === 'race') setMode('explore');
    w.activate();
    if (typeof w.setAlgorithm === 'function') w.setAlgorithm(SAD.currentAlgorithm || null, SAD.currentOpts || currentOpts());
    syncWorldControls();
    buildAlgoTabs();                // undirectedOnly support can differ per world
  }

  function syncWorldControls(){
    const w = activeWorld();
    const hasTerrain = typeof w.terrain === 'function';
    const hasShowG = typeof w.setShowG === 'function';
    const hasPresets = (w.id === 'graph' || w.id === 'tree') && (SAD.graphPresets || []).length > 0;

    $('terrainWrap').classList.toggle('off', !hasTerrain);
    $('terrainDiv').classList.toggle('off', !hasTerrain);
    $('showGWrap').classList.toggle('off', !hasShowG);
    $('showGDiv').classList.toggle('off', !hasShowG);
    $('presetWrap').classList.toggle('off', !hasPresets);
    $('presetDiv').classList.toggle('off', !hasPresets);
    $('modeTabs').classList.toggle('off', !w.supportsRace);
    $('hint').innerHTML = w.id === 'grid' ? HINT_GRID : HINT_PLAIN;
  }

  /* =========================================================
     Algorithm picker
     ========================================================= */
  const GROUPS = [['uninformed', 'Uninformed'], ['informed', 'Informed']];

  /* Entries carry an explicit `order` and SAD.registerAlgorithm keeps
     SAD.algorithms sorted by it, so the array is already the picker order.
     Render it as-is: never re-sort, never hardcode a list of ids. */
  const algoList = () => SAD.algorithms || [];

  function disabledReason(e){
    if (!e) return null;
    if (e.supports && e.supports.undirectedOnly && getProblem().undirected === false)
      return 'Needs an undirected problem — it searches backward from the goal, and this graph’s edges only run one way.';
    return null;
  }

  function buildAlgoTabs(){
    const host = $('algoTabs');
    host.replaceChildren();
    const list = algoList();

    for (const [group, title] of GROUPS){
      const inGroup = list.filter(e => e.group === group);
      if (!inGroup.length) continue;
      const row = document.createElement('div');
      row.className = 'algogroup';
      row.innerHTML = `<span class="glabel">${title}</span>`;
      const pills = document.createElement('div');
      pills.className = 'pillrow';
      for (const e of inGroup){
        const n = e.order;                    // declared, so the key is stable on a partial merge
        const b = document.createElement('button');
        b.className = 'pill' + (e.id === UI.algo ? ' on' : '');
        b.dataset.k = e.id;
        b.innerHTML = `<span class="k">${n}</span>${e.name}`;
        const why = disabledReason(e);
        if (why){ b.disabled = true; b.title = why; }
        else b.onclick = () => selectAlgo(e.id);
        pills.appendChild(b);
      }
      row.appendChild(pills);
      host.appendChild(row);
    }

    // If the current pick just became unavailable, fall back to the first that is.
    if (UI.algo && disabledReason(entry())){
      const ok = list.find(e => !disabledReason(e));
      if (ok) selectAlgo(ok.id);
    }
  }

  function selectAlgo(id){
    const e = SAD.algorithmById(id);
    if (!e) return;
    UI.algo = id;
    for (const b of $('algoTabs').querySelectorAll('.pill'))
      b.classList.toggle('on', b.dataset.k === id);
    SAD.panels.setAlgorithm(e);
    publishAlgorithm();
    const wantsLimit = !!(e.supports && e.supports.limit);
    $('limitWrap').classList.toggle('off', !wantsLimit);
    $('limitDiv').classList.toggle('off', !wantsLimit);
    if (UI.mode === 'race') resetRace(); else resetRun();
  }

  /* =========================================================
     Convention switches
     ========================================================= */
  function wireSeg(segId, key, notes, noteId){
    const seg = $(segId);
    for (const b of seg.children){
      b.onclick = () => {
        if (UI[key] === b.dataset.v) return;
        UI[key] = b.dataset.v;
        for (const x of seg.children) x.classList.toggle('on', x === b);
        $(noteId).textContent = notes[UI[key]];
        publishAlgorithm();
        // The rules cannot change halfway through a search, so the run restarts.
        if (UI.mode === 'race') resetRace(); else resetRun();
      };
    }
    $(noteId).textContent = notes[UI[key]];
  }

  /* =========================================================
     Graph presets
     ========================================================= */
  const graphWorld = () => (SAD.worldOf ? SAD.worldOf('graph') : null);

  function buildPresets(){
    const sel = $('presetSelect');
    sel.replaceChildren();
    for (const p of SAD.graphPresets || []){
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name + (p.admissible === false ? '  (broken h)' : '');
      sel.appendChild(o);
    }
    sel.onchange = () => choosePreset(sel.value);
    syncPresetSelect();
  }

  /* Show whichever preset the graph world already has loaded, rather than
     forcing one on it at boot. */
  function syncPresetSelect(){
    const w = graphWorld();
    if (!w || typeof w.model !== 'function') return;
    const model = w.model();
    if (model && model.id) $('presetSelect').value = model.id;
  }

  function choosePreset(id){
    const w = graphWorld();
    if (!w || typeof w.setPreset !== 'function') return;
    w.setPreset(id);          // the graph world calls SAD.worldChanged() itself
    buildAlgoTabs();          // a directed preset can disable bidirectional
  }

  /* =========================================================
     Race mode
     ========================================================= */
  const race = { entries:[], problem:null, playing:false, done:false, dirty:true, view:null };
  const RC = { empty:'#161a25', wall:'#04060b', heavy:'#2a2313', frontier:'#22d3ee',
               visited:'#4b4f96', cutoff:'#7a3540', path:'#fbbf24', start:'#10b981', goal:'#f43f5e' };

  function racers(){ return algoList().filter(e => !disabledReason(e)); }

  function buildRace(){
    const grid = $('raceGrid');
    grid.replaceChildren();
    race.entries = racers().map(algo => {
      const card = document.createElement('div');
      card.className = 'rcard';
      card.innerHTML =
        `<header><span class="dot"></span><h3>${algo.name}</h3><span class="badge">idle</span></header>
         <canvas></canvas>
         <div class="rstats"><span>expanded <b class="e">0</b></span><span>cost <b class="c">—</b></span><span>steps <b class="s">—</b></span></div>
         <div class="rbar"><span></span></div>`;
      grid.appendChild(card);
      return {
        algo, card,
        canvas: card.querySelector('canvas'),
        badge: card.querySelector('.badge'),
        eEl: card.querySelector('.e'), cEl: card.querySelector('.c'), sEl: card.querySelector('.s'),
        bar: card.querySelector('.rbar span'),
        gen:null, state:null, expanded:0, done:false, status:'idle', cost:null, len:null
      };
    });
    sizeRace();
    resetRace();
  }

  function sizeRace(){
    const gw = worldById('grid');
    if (!gw || typeof gw.raceView !== 'function') return;
    race.view = gw.raceView();
    const V = race.view;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const e of race.entries){
      const avail = e.canvas.parentElement.clientWidth - 22;
      const s = Math.max(3, Math.floor(avail / Math.max(1, V.cols)));
      e.canvas.width  = Math.round(V.cols * s * dpr);
      e.canvas.height = Math.round(V.rows * s * dpr);
      e.canvas.style.width  = (V.cols * s) + 'px';
      e.canvas.style.height = (V.rows * s) + 'px';
      e.canvas.style.margin = '0 auto';
      e.ctx = e.canvas.getContext('2d');
      e.ctx.setTransform(1, 0, 0, 1, 0, 0);   // draw in device pixels
      e.sx = s * dpr;
      e.sy = s * dpr;
    }
  }

  function drawRaceCell(e, i){
    const V = race.view;
    const c = i % V.cols, r = (i / V.cols) | 0;
    let col;
    if (V.wall[i]) col = RC.wall;
    else {
      const st = e.state[i];
      col = st === 1 ? RC.frontier : st === 2 ? RC.visited : st === 3 ? RC.cutoff : st === 4 ? RC.path
          : (V.cost[i] > 1 ? RC.heavy : RC.empty);
    }
    if (i === V.start) col = RC.start;
    if (i === V.goal)  col = e.state[i] === 4 ? RC.path : RC.goal;
    e.ctx.fillStyle = col;
    e.ctx.fillRect(c * e.sx, r * e.sy, Math.max(1, e.sx - 0.6), Math.max(1, e.sy - 0.6));
  }

  function redrawRace(e){
    const V = race.view;
    e.ctx.setTransform(1, 0, 0, 1, 0, 0);
    e.ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
    for (let i = 0; i < V.cols * V.rows; i++) drawRaceCell(e, i);
  }

  function resetRace(){
    if (!race.entries.length) return;
    race.playing = false; race.done = false;
    const gw = worldById('grid');
    race.view = gw.raceView();
    const n = race.view.cols * race.view.rows;
    const p = race.problem = getProblem();
    const opts = currentOpts();
    for (const e of race.entries){
      e.state = new Uint8Array(n);
      e.gen = e.algo.make(p, opts);
      e.expanded = 0; e.done = false; e.status = 'idle';
      e.cost = null; e.len = null;
      e.card.classList.remove('winner');
      redrawRace(e);
    }
    race.dirty = true;
    setPlayLabel();
  }

  function racePush(e, list){
    if (!list) return;
    for (const q of list){ e.state[q.id] = 1; drawRaceCell(e, q.id); }
  }

  function raceStep(){
    const p = race.problem;
    let anyLive = false;
    for (const e of race.entries){
      if (e.done) continue;
      anyLive = true;
      const r = e.gen.next();
      if (r.done){ e.done = true; continue; }
      const v = r.value;
      e.status = 'running';
      if (v.kind === 'init'){
        racePush(e, v.pushed);
      } else if (v.kind === 'expand'){
        e.expanded++;
        e.state[v.id] = 2; drawRaceCell(e, v.id);
        racePush(e, v.pushed);
      } else if (v.kind === 'cutoff'){
        e.expanded++;
        e.state[v.id] = 3; drawRaceCell(e, v.id);
      } else if (v.kind === 'restart'){
        e.state.fill(0); redrawRace(e);
      } else if (v.kind === 'goal'){
        e.expanded++;
        const path = v.path || [];
        for (const id of path){ e.state[id] = 4; drawRaceCell(e, id); }
        const cost = pathCost(p, path);
        e.cost = cost != null ? cost : v.g;
        e.len = Math.max(0, path.length - 1);
        e.status = 'found'; e.done = true;
      } else if (v.kind === 'fail'){
        e.status = v.cutoff ? 'cutoff' : (v.note === 'cap' ? 'capped' : 'no path');
        e.done = true;
      }
    }
    race.dirty = true;
    if (!anyLive){
      race.done = true; race.playing = false;
      markWinners();
      setPlayLabel();
    }
  }

  function markWinners(){
    const found = race.entries.filter(e => e.status === 'found' && e.cost != null);
    if (!found.length) return;
    const bestCost = Math.min(...found.map(e => e.cost));
    for (const e of race.entries)
      e.card.classList.toggle('winner', e.status === 'found' && e.cost === bestCost);
  }

  function renderRaceStats(){
    const maxExp = Math.max(1, ...race.entries.map(e => e.expanded));
    for (const e of race.entries){
      e.eEl.textContent = e.expanded;
      e.cEl.textContent = e.cost == null ? '—' : fmt(e.cost);
      e.sEl.textContent = e.len == null ? '—' : e.len;
      e.badge.textContent = e.status;
      e.badge.className = 'badge ' + (e.status === 'running' ? 'run' : e.status === 'found' ? 'ok'
                          : (e.status === 'idle' ? '' : 'bad'));
      e.bar.style.width = (100 * e.expanded / maxExp) + '%';
    }
  }

  /* =========================================================
     Phone sheets
     ========================================================= */
  const isPhone = () => window.matchMedia('(max-width:719px)').matches;

  /* Touch sizing keys off a class, not a media query alone, so a hybrid laptop
     and an iPad in landscape both get 44px targets and the Options sheet. The
     markup ships with it on, so a stalled script fails toward finger-friendly. */
  function syncTouchClass(){
    const coarse = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches)
      || (navigator.maxTouchPoints || 0) > 0;
    document.body.classList.toggle('touch', coarse || window.innerWidth < 1024);
  }

  /* The bottom bar and the collapsed panel strip are both laid out from
     measured heights, because both depend on how the footer wrapped. */
  function measureChrome(){
    const root = document.documentElement;
    root.style.setProperty('--barH', Math.ceil($('bar').getBoundingClientRect().height) + 'px');
    if (isPhone()){
      const h = $('panelHandle').getBoundingClientRect().height;
      const st = $('panel').querySelector('.stats').getBoundingClientRect().height;
      root.style.setProperty('--collapsedH', Math.ceil(h + st + 8) + 'px');
    } else {
      root.style.removeProperty('--collapsedH');
    }
  }

  function collapsedPx(){
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--collapsedH')) || 0;
  }

  function setPanelOpen(on){
    document.body.classList.toggle('panel-open', !!on);
    const h = $('panelHandle');
    h.setAttribute('aria-expanded', on ? 'true' : 'false');
    h.setAttribute('aria-label', on ? 'Collapse panel' : 'Expand panel');
  }

  function setOptsOpen(on){
    document.body.classList.toggle('opts-open', !!on);
    $('btnOptions').setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  /* Tap the handle to toggle, or drag it and let it settle to the nearer end. */
  function wireSheets(){
    const handle = $('panelHandle'), panel = $('panel');
    let y0 = null, wasOpen = false, moved = 0;

    handle.addEventListener('pointerdown', e => {
      if (!isPhone()) return;
      handle.setPointerCapture(e.pointerId);
      y0 = e.clientY; moved = 0;
      wasOpen = document.body.classList.contains('panel-open');
      document.body.classList.add('panel-dragging');
    });
    handle.addEventListener('pointermove', e => {
      if (y0 == null) return;
      moved = e.clientY - y0;
      const hidden = Math.max(0, panel.offsetHeight - collapsedPx());
      const y = Math.max(0, Math.min(hidden, (wasOpen ? 0 : hidden) + moved));
      panel.style.transform = `translateY(${y}px)`;
    });
    const end = () => {
      if (y0 == null) return;
      y0 = null;
      document.body.classList.remove('panel-dragging');
      panel.style.transform = '';
      setPanelOpen(Math.abs(moved) < 6 ? !wasOpen : moved < 0);
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);

    $('btnOptions').onclick = () => setOptsOpen(!document.body.classList.contains('opts-open'));
    $('btnOptionsClose').onclick = () => setOptsOpen(false);
    $('scrim').onclick = () => setOptsOpen(false);
  }

  /* =========================================================
     Transport
     ========================================================= */
  function setPlayLabel(){
    const playing = UI.mode === 'explore' ? sim.playing : race.playing;
    const done = UI.mode === 'explore' ? sim.finished : race.done;
    $('playLbl').textContent = playing ? 'Pause' : (done ? 'Replay' : 'Play');
    $('icPlay').innerHTML = playing
      ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>'
      : '<path d="M7 4l13 8-13 8z"/>';
  }

  function togglePlay(){
    if (UI.mode === 'explore'){
      if (sim.finished || !sim.started){ startRun(); sim.playing = true; }
      else sim.playing = !sim.playing;
      if (sim.playing && sim.status === 'Ready') sim.status = 'Running';
      sim.dirty = true;
    } else {
      if (race.done) resetRace();
      race.playing = !race.playing;
      race.dirty = true;
    }
    setPlayLabel();
  }

  function setMode(m){
    UI.mode = m;
    $('modeExplore').classList.toggle('on', m === 'explore');
    $('modeRace').classList.toggle('on', m === 'race');
    $('worldHost').style.display = m === 'explore' ? '' : 'none';
    $('raceArea').style.display  = m === 'race' ? 'flex' : 'none';
    $('algoTabs').style.display  = m === 'explore' ? 'flex' : 'none';
    setOptsOpen(false);
    measureChrome();
    if (m === 'race'){ sim.playing = false; buildRace(); }
    else { race.playing = false; activeWorld().resize(); }
    setPlayLabel();
  }

  /* =========================================================
     Wiring
     ========================================================= */
  function wireControls(){
    $('btnPlay').onclick = togglePlay;
    $('btnStep').onclick = () => {
      if (UI.mode === 'explore'){ sim.playing = false; if (sim.finished) startRun(); doStep(); }
      else { race.playing = false; if (!race.done) raceStep(); }
      setPlayLabel();
    };
    $('btnReset').onclick = () => { if (UI.mode === 'explore') resetRun(); else resetRace(); };

    $('speed').oninput = e => {
      UI.speed = +e.target.value;
      $('speedVal').textContent = speedFor(UI.speed) + '/s';
    };
    $('limit').oninput = e => {
      UI.limit = +e.target.value;
      $('limitVal').textContent = UI.limit;
      publishAlgorithm();
      const e2 = entry();
      if (e2 && e2.supports && e2.supports.limit){
        if (UI.mode === 'race') resetRace(); else resetRun();
      }
    };
    $('tglCosts').onchange = e => {
      const w = activeWorld();
      if (typeof w.setShowG === 'function') w.setShowG(e.target.checked);
    };

    const terrain = kind => () => {
      const w = activeWorld();
      if (typeof w.terrain !== 'function') return;
      w.terrain(kind);
      if (UI.mode === 'race'){ sizeRace(); resetRace(); }
    };
    $('btnMaze').onclick    = terrain('maze');
    $('btnWalls').onclick   = terrain('walls');
    $('btnWeights').onclick = terrain('weights');
    $('btnClear').onclick   = terrain('clear');

    $('modeExplore').onclick = () => setMode('explore');
    $('modeRace').onclick = () => setMode('race');

    wireSeg('swGoalTest', 'goalTest', NOTE_GOAL, 'goalTestNote');
    wireSeg('swSearchMode', 'search', NOTE_SEARCH, 'searchModeNote');

    // Frontier row hover lights the node up in the world you are looking at.
    SAD.panels.onFrontierHover = (nodeId, on) => {
      const w = activeWorld();
      if (w) w.highlight(nodeId, on);
    };

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Escape'){ setOptsOpen(false); setPanelOpen(false); return; }
      if (e.code === 'Space'){ e.preventDefault(); togglePlay(); }
      else if (e.key === 's'){ $('btnStep').click(); }
      else if (e.key === 'r'){ $('btnReset').click(); }
      else if (e.key === 'm'){ $('btnMaze').click(); }
      else if (e.key === 'c'){ $('btnClear').click(); }
      else if (e.key >= '1' && e.key <= '8'){
        if (UI.mode !== 'explore') return;
        const pick = algoList().find(a => a.order === +e.key);
        if (pick && !disabledReason(pick)) selectAlgo(pick.id);
      }
    });

    let rt = 0;
    const relayout = () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        syncTouchClass();
        measureChrome();
        if (UI.mode === 'explore') activeWorld().resize();
        else { sizeRace(); race.entries.forEach(redrawRace); }
      }, 140);
    };
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', relayout);
  }

  /* A world calls this when the USER edits it: the board changed under the
     search, so the run has to start over. */
  SAD.worldChanged = function(){
    problemCache = null;
    if (UI.mode === 'race'){ sizeRace(); resetRace(); return; }
    const wasPlaying = sim.playing;
    resetRun();
    if (wasPlaying){ startRun(); sim.playing = true; setPlayLabel(); }
  };

  /* =========================================================
     Boot
     ========================================================= */
  function boot(){
    if (typeof SAD.registerWorld !== 'function' || !worlds().length){
      $('worldHost').innerHTML =
        '<div style="margin:auto;padding:24px;color:var(--dim);font-size:12px">No worlds registered.</div>';
      return;
    }
    SAD.panels.wire();
    buildWorldTabs();
    mountWorlds();

    const list = algoList();
    UI.algo = (SAD.algorithmById('astar') ? 'astar' : (list[0] && list[0].id)) || null;

    setWorld(worlds()[0].id);
    buildPresets();
    buildAlgoTabs();
    if (UI.algo) selectAlgo(UI.algo);

    syncTouchClass();
    wireControls();
    wireSheets();
    $('speedVal').textContent = speedFor(UI.speed) + '/s';
    $('limitVal').textContent = UI.limit;
    measureChrome();
    activeWorld().resize();
    requestAnimationFrame(frame);
  }

  document.addEventListener('DOMContentLoaded', boot);

})(typeof globalThis !== 'undefined' ? globalThis : window);
