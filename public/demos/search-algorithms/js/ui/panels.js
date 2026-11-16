(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});

  /* The right-hand panel: algorithm card, stat tiles, and the
     Frontier / Trace / Pseudocode tabs. */

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[ch]));
  const fmtNum = v => (v == null || !isFinite(v)) ? '—'
    : (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : String(Math.round(v)));

  const MAXROWS = 34;
  const MAXLOG = 400;              // ring size
  const LOGTAIL = 70;              // rows actually drawn

  // Column headings for the numeric keys an entry can ask for.
  const KEY_LABEL = { g:'g', h:'h', f:'f', d:'depth', order:'order' };

  let tab = 'frontier';
  let logBuf = [];
  let lastList = [];               // the frontier rows currently on screen, for hover lookup
  let logTimer = 0, logDrawnAt = 0;

  /* =========================================================
     Algorithm card
     ========================================================= */
  function highlightCode(src){
    return String(src || '').split('\n').map(line => {
      const h = line.indexOf('#');
      const code = h >= 0 ? line.slice(0, h) : line;
      const cm = h >= 0 ? line.slice(h) : '';
      let s = esc(code)
        .replace(/(←|≤|≥|⌊|⌋|→|∪)/g, '<span class="op">$1</span>')
        .replace(/\b(while|if|else|for|each|return|not|in|is|and|or|continue|repeat|until|do)\b/g, '<span class="kw">$1</span>')
        .replace(/\b([A-Z][A-Z_]{1,})\b/g, '<span class="fn">$1</span>');
      if (cm) s += `<span class="cm">${esc(cm)}</span>`;
      return s;
    }).join('\n');
  }

  function setAlgorithm(entry){
    if (!entry) return;
    $('algoName').textContent = entry.name;
    $('algoDesc').textContent = entry.desc;
    $('pComplete').innerHTML = `<span class="${entry.complete[0]}">${esc(entry.complete[1])}</span>`;
    $('pOptimal').innerHTML  = `<span class="${entry.optimal[0]}">${esc(entry.optimal[1])}</span>`;
    $('pTime').textContent = entry.time;
    $('pSpace').textContent = entry.space;
    $('frontierHead').textContent = entry.frontierLabel || '';
    $('codeBlock').innerHTML = highlightCode(entry.code);
  }

  /* =========================================================
     Stat tiles
     ========================================================= */
  function statusColor(s){
    if (s === 'Found') return '#fbbf24';
    if (s === 'No path' || s === 'Cutoff' || s === 'Capped') return '#fb7185';
    if (s === 'Ready') return 'var(--dim)';
    return '#67e8f9';
  }

  function update(s){
    if (!s) return;
    if (s.expanded != null) $('stExpanded').textContent = s.expanded;
    if (s.fsize != null) $('stFrontier').textContent = s.fsize;
    if (s.peak != null) $('stPeak').textContent = s.peak;
    $('stCost').textContent = s.cost == null ? '—' : fmtNum(s.cost);
    $('stLen').textContent  = s.len  == null ? '—' : s.len;
    if (s.status != null){
      const el = $('stStatus');
      el.textContent = s.status;
      el.style.color = statusColor(s.status);
    }
  }

  /* =========================================================
     Frontier table
     ========================================================= */
  function renderFrontier(list, entry){
    list = list || [];
    lastList = list;
    const keys = (entry && entry.frontierKeys && entry.frontierKeys.length)
      ? entry.frontierKeys : ['g'];
    const sortKey = keys[keys.length - 1];      // what the frontier is ordered on

    const html = [];
    const shown = Math.min(list.length, MAXROWS);
    for (let k = 0; k < shown; k++){
      const e = list[k];
      const kv = keys.map(key => {
        const label = KEY_LABEL[key] || key;
        const val = fmtNum(e[key]);
        return key === sortKey
          ? `<b>${label} ${val}</b>`
          : `<span>${label} ${val}</span>`;
      }).join('');
      html.push(
        `<div class="frow${k === 0 ? ' next' : ''}" data-k="${k}">` +
        `<span class="n">${k + 1}</span>` +
        `<span class="c">${esc(SAD.panels.labelFor(e.id))}</span>` +
        `<span class="kv">${kv}</span></div>`);
    }
    if (!list.length) html.push(`<div class="more">${SAD.panels.emptyNote}</div>`);
    else if (list.length > MAXROWS) html.push(`<div class="more">+ ${list.length - MAXROWS} more</div>`);
    $('frontierList').innerHTML = html.join('');
  }

  /* =========================================================
     Trace log
     ========================================================= */
  const LOG_TAG = { expand:'EXPAND', push:'PUSH', skip:'SKIP', cut:'CUTOFF',
                    goal:'GOAL', fail:'FAIL', info:'INFO' };

  function drawLog(){
    const el = $('logList');
    el.innerHTML = logBuf.slice(-LOGTAIL).map(l =>
      `<div class="lrow ${l.type}"><span class="t">${LOG_TAG[l.type] || 'INFO'}</span>` +
      `<span>${esc(l.text)}</span></div>`).join('');
    el.parentElement.scrollTop = el.parentElement.scrollHeight;
  }

  /* The log fills far faster than it is worth drawing, so redraws are capped
     at roughly 14 a second and only happen while the Trace tab is open. */
  function scheduleLog(){
    if (logTimer || tab !== 'log') return;
    const wait = Math.max(0, 70 - (performance.now() - logDrawnAt));
    logTimer = setTimeout(() => {
      logTimer = 0; logDrawnAt = performance.now(); drawLog();
    }, wait);
  }

  function log(type, text){
    logBuf.push({ type, text });
    if (logBuf.length > MAXLOG) logBuf.splice(0, MAXLOG / 2);
    scheduleLog();
  }

  function clearLog(){
    logBuf = [];
    clearTimeout(logTimer); logTimer = 0;
    $('logList').innerHTML = '';
  }

  /* =========================================================
     Tabs
     ========================================================= */
  const TABS = [['ptFrontier','frontier','paneFrontier'],
                ['ptLog','log','paneLog'],
                ['ptCode','code','paneCode']];

  function selectTab(key){
    tab = key;
    for (const [bid, k, pid] of TABS){
      $(bid).classList.toggle('on', k === key);
      $(pid).classList.toggle('on', k === key);
    }
    if (key === 'log'){ logDrawnAt = 0; drawLog(); }
  }

  function wire(){
    for (const [bid, key] of TABS) $(bid).onclick = () => selectTab(key);

    // Hover a frontier row to light the node up in whichever world is showing.
    const list = $('frontierList');
    const idAt = target => {
      const row = target.closest ? target.closest('.frow') : null;
      if (!row) return undefined;
      const e = lastList[+row.dataset.k];
      return e ? e.id : undefined;
    };
    list.addEventListener('mouseover', e => {
      const id = idAt(e.target);
      if (id !== undefined) SAD.panels.onFrontierHover(id, true);
    });
    list.addEventListener('mouseout', e => {
      const id = idAt(e.target);
      if (id !== undefined) SAD.panels.onFrontierHover(id, false);
    });
  }

  SAD.panels = {
    setAlgorithm,
    update,
    renderFrontier,
    log,
    clearLog,
    onFrontierHover: () => {},

    /* Set by js/ui/app.js. `labelFor` is the running problem's label(), so the
       frontier prints "(3,7)" on a grid and "Arad" on a graph. */
    labelFor: n => String(n),
    emptyNote: 'press Play or Step to start',

    // The app skips calling step.frontier() unless the table is actually visible.
    wantsFrontier: () => tab === 'frontier',
    wire
  };

})(typeof globalThis !== 'undefined' ? globalThis : window);
