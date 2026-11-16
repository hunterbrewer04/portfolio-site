/* Graph presets. Plain data only — this file must load under node with no DOM. */
(function (root) {
'use strict';
const SAD = (root.SAD = root.SAD || {});

/* =========================================================
   Helpers — every preset is still plain data once built
   ========================================================= */

// adjacency as Map<id, [{to,cost}]>, both directions when undirected
function adjacency(model){
  const adj = new Map();
  for (const n of model.nodes) adj.set(n.id, []);
  for (const e of model.edges){
    adj.get(e.a).push({ to:e.b, cost:e.cost });
    if (model.undirected !== false) adj.get(e.b).push({ to:e.a, cost:e.cost });
  }
  return adj;
}

// true shortest cost from `from` to every node. plain array scan — presets are tiny.
function dijkstra(model, from){
  const adj = adjacency(model);
  const dist = new Map();
  for (const n of model.nodes) dist.set(n.id, Infinity);
  dist.set(from, 0);
  const done = new Set();
  for (;;){
    let cur = null, best = Infinity;
    for (const [id, d] of dist) if (!done.has(id) && d < best){ best = d; cur = id; }
    if (cur === null) break;
    done.add(cur);
    for (const { to, cost } of adj.get(cur) || [])
      if (best + cost < dist.get(to)) dist.set(to, best + cost);
  }
  return dist;
}

// admissible by construction: a fraction of the true remaining cost, rounded down
function heuristicFromTruth(model, factor){
  const dist = dijkstra(model, model.goal);
  const h = {};
  for (const n of model.nodes){
    const d = dist.get(n.id);
    h[n.id] = Number.isFinite(d) ? Math.floor(factor * d) : 0;
  }
  return h;
}

const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* =========================================================
   1. Romania — Russell & Norvig, figures 3.1 and 3.16
   Road distances and straight-line distances to Bucharest are the
   textbook values; x,y place the cities roughly where they sit on the map.
   ========================================================= */
const romania = {
  id: 'romania',
  name: 'Romania',
  note: 'The textbook map. h(n) is the straight-line distance to Bucharest.',
  undirected: true,
  nodes: [
    { id:'Arad',           label:'Arad',            x:0.055, y:0.327, labelPos:'left' },
    { id:'Zerind',         label:'Zerind',          x:0.081, y:0.211, labelPos:'right' },
    { id:'Oradea',         label:'Oradea',          x:0.130, y:0.095, labelPos:'right' },
    { id:'Sibiu',          label:'Sibiu',           x:0.403, y:0.433, labelPos:'above' },
    { id:'Timisoara',      label:'Timisoara',       x:0.030, y:0.470 },
    { id:'Lugoj',          label:'Lugoj',           x:0.127, y:0.462 },
    { id:'Mehadia',        label:'Mehadia',         x:0.184, y:0.675, labelPos:'left' },
    { id:'Drobeta',        label:'Drobeta',         x:0.220, y:0.748 },
    { id:'Craiova',        label:'Craiova',         x:0.360, y:0.832 },
    { id:'RimnicuVilcea',  label:'Rimnicu Vilcea',  x:0.430, y:0.621, labelPos:'left' },
    { id:'Pitesti',        label:'Pitesti',         x:0.491, y:0.686, labelPos:'right' },
    { id:'Fagaras',        label:'Fagaras',         x:0.504, y:0.422, labelPos:'above' },
    { id:'Bucharest',      label:'Bucharest',       x:0.642, y:0.802, labelPos:'left' },
    { id:'Giurgiu',        label:'Giurgiu',         x:0.626, y:0.945 },
    { id:'Urziceni',       label:'Urziceni',        x:0.708, y:0.724 },
    { id:'Hirsova',        label:'Hirsova',         x:0.869, y:0.732 },
    { id:'Eforie',         label:'Eforie',          x:0.955, y:0.902 },
    { id:'Vaslui',         label:'Vaslui',          x:0.842, y:0.206 },
    { id:'Iasi',           label:'Iasi',            x:0.825, y:0.066, labelPos:'right' },
    { id:'Neamt',          label:'Neamt',           x:0.675, y:0.055 }
  ],
  edges: [
    { a:'Arad',          b:'Zerind',        cost:75  },
    { a:'Arad',          b:'Sibiu',         cost:140 },
    { a:'Arad',          b:'Timisoara',     cost:118 },
    { a:'Zerind',        b:'Oradea',        cost:71  },
    { a:'Oradea',        b:'Sibiu',         cost:151 },
    { a:'Timisoara',     b:'Lugoj',         cost:111 },
    { a:'Lugoj',         b:'Mehadia',       cost:70  },
    { a:'Mehadia',       b:'Drobeta',       cost:75  },
    { a:'Drobeta',       b:'Craiova',       cost:120 },
    { a:'Craiova',       b:'RimnicuVilcea', cost:146 },
    { a:'Craiova',       b:'Pitesti',       cost:138 },
    { a:'Sibiu',         b:'RimnicuVilcea', cost:80  },
    { a:'Sibiu',         b:'Fagaras',       cost:99  },
    { a:'RimnicuVilcea', b:'Pitesti',       cost:97  },
    { a:'Fagaras',       b:'Bucharest',     cost:211 },
    { a:'Pitesti',       b:'Bucharest',     cost:101 },
    { a:'Bucharest',     b:'Giurgiu',       cost:90  },
    { a:'Bucharest',     b:'Urziceni',      cost:85  },
    { a:'Urziceni',      b:'Hirsova',       cost:98  },
    { a:'Hirsova',       b:'Eforie',        cost:86  },
    { a:'Urziceni',      b:'Vaslui',        cost:142 },
    { a:'Vaslui',        b:'Iasi',          cost:92  },
    { a:'Iasi',          b:'Neamt',         cost:87  }
  ],
  start: 'Arad',
  goal:  'Bucharest',
  heuristic: {
    Arad:366, Bucharest:0,   Craiova:160, Drobeta:242, Eforie:161,
    Fagaras:176, Giurgiu:77, Hirsova:151, Iasi:226,    Lugoj:244,
    Mehadia:241, Neamt:234,  Oradea:380,  Pitesti:100, RimnicuVilcea:193,
    Sibiu:253,   Timisoara:329, Urziceni:80, Vaslui:199, Zerind:374
  },
  hScale: 1,
  admissible: true
};

/* =========================================================
   2. Exam graph — small integers, tuned so the algorithms disagree.
   Optimal S→G is 9 along the bottom. F sits right next to G but the
   road out of it costs 9, so greedy walks into it and pays 15.
   H and J are cheap in g and useless in h, so UCS expands them and A* never does.
   ========================================================= */
const exam = {
  id: 'exam',
  name: 'Exam graph',
  note: 'Optimal cost is 9. Greedy pays 15 by trusting h(F)=1; UCS wastes H and J.',
  undirected: true,
  nodes: [
    { id:'S', label:'S', x:0.070, y:0.500 },
    { id:'A', label:'A', x:0.270, y:0.270 },
    { id:'B', label:'B', x:0.270, y:0.660 },
    { id:'C', label:'C', x:0.480, y:0.150 },
    { id:'D', label:'D', x:0.500, y:0.740 },
    { id:'E', label:'E', x:0.680, y:0.560 },
    { id:'F', label:'F', x:0.820, y:0.300 },
    { id:'G', label:'G', x:0.930, y:0.440 },
    { id:'H', label:'H', x:0.130, y:0.870 },
    { id:'J', label:'J', x:0.320, y:0.950 }
  ],
  edges: [
    { a:'S', b:'A', cost:2 },
    { a:'S', b:'B', cost:2 },
    { a:'S', b:'H', cost:1 },
    { a:'H', b:'J', cost:1 },
    { a:'J', b:'D', cost:6 },
    { a:'A', b:'C', cost:2 },
    { a:'B', b:'D', cost:2 },
    { a:'C', b:'F', cost:2 },
    { a:'C', b:'E', cost:4 },
    { a:'D', b:'E', cost:3 },
    { a:'E', b:'G', cost:2 },
    { a:'F', b:'G', cost:9 }
  ],
  start: 'S',
  goal:  'G',
  heuristic: { S:8, A:4, B:6, C:3, D:4, E:2, F:1, G:0, H:9, J:10 },
  hScale: 1,
  admissible: true
};

/* =========================================================
   3. Deep tree — no cycles, five levels, depth is the vertical axis.
   Built from a parent list so the layout stays tidy if the shape changes.
   ========================================================= */
const TREE_SPEC = [
  // [child, parent, cost]
  ['B','A',2], ['C','A',3], ['D','A',2],
  ['E','B',2], ['F','B',4], ['G','C',3], ['H','C',1], ['I','D',2], ['J','D',3],
  ['K','E',1], ['L','E',3], ['M','F',2], ['N','G',4], ['O','G',2], ['P','H',3],
  ['Q','I',2], ['R','I',1], ['S','J',2],
  ['T','K',3], ['U','K',1], ['V','N',2], ['W','Q',1], ['X','Q',3], ['Y','S',2]
];

function buildTree(rootId, spec, goalId){
  const kids = new Map([[rootId, []]]);
  const depth = new Map([[rootId, 0]]);
  const order = [rootId];
  for (const [child, parent] of spec){
    kids.get(parent).push(child);
    kids.set(child, []);
    depth.set(child, depth.get(parent) + 1);
    order.push(child);
  }
  const maxDepth = Math.max(...depth.values());

  // leaves evenly spaced left to right, every parent centred over its children
  let slot = 0;
  const leaves = [];
  (function count(id){
    const c = kids.get(id);
    if (!c.length) leaves.push(id);
    else c.forEach(count);
  })(rootId);
  const span = Math.max(1, leaves.length - 1);
  const x = new Map();
  (function place(id){
    const c = kids.get(id);
    if (!c.length){ x.set(id, 0.05 + 0.90 * (slot++ / span)); return; }
    c.forEach(place);
    let sum = 0;
    for (const k of c) sum += x.get(k);
    x.set(id, sum / c.length);
  })(rootId);

  const nodes = order.map(id => ({
    id, label:id,
    x: Math.round(x.get(id) * 1000) / 1000,
    y: Math.round((0.06 + depth.get(id) * (0.88 / maxDepth)) * 1000) / 1000
  }));
  const edges = spec.map(([child, parent, cost]) => ({ a:parent, b:child, cost }));

  const model = {
    id: 'tree',
    name: 'Deep tree',
    note: 'No cycles, depth 4. Watch DLS cut off and IDDFS restart at each new limit.',
    undirected: true,
    nodes, edges,
    start: rootId,
    goal: goalId,
    hScale: 1,
    admissible: true
  };
  model.heuristic = heuristicFromTruth(model, 0.6);
  return model;
}

const deepTree = buildTree('A', TREE_SPEC, 'Y');

/* =========================================================
   4. Random graph — connected by construction (spanning tree first),
   then short non-crossing extras so it stays planar-ish.
   ========================================================= */
const RID = 'ABCDEFGHIJKLMNOPQR';

// do segments p1p2 and p3p4 cross, ignoring shared endpoints
function crosses(p1, p2, p3, p4){
  if (p1 === p3 || p1 === p4 || p2 === p3 || p2 === p4) return false;
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const d1 = o(p3, p4, p1), d2 = o(p3, p4, p2), d3 = o(p1, p2, p3), d4 = o(p1, p2, p4);
  return d1 !== d2 && d3 !== d4;
}

// a label hangs under its node, which is exactly where the chip of a downward
// edge sits — so push it aside whenever the node has one
function autoLabelPos(nodes, links){
  const nbrs = nodes.map(() => []);
  for (const [i, j] of links){ nbrs[i].push(j); nbrs[j].push(i); }
  nodes.forEach((n, i) => {
    let down = false, right = 0;
    for (const j of nbrs[i]){
      const dx = nodes[j].x - n.x, dy = nodes[j].y - n.y, L = Math.hypot(dx, dy) || 1;
      if (dy / L > 0.55) down = true;
      right += dx / L;
    }
    if (down) n.labelPos = right > 0 ? 'left' : 'right';
  });
}

function randomGraph(seed){
  for (let attempt = 0; attempt < 24; attempt++){
    const rng = mulberry32((seed + attempt * 7919) | 0);
    const want = 12 + Math.floor(rng() * 7);            // 12..18
    const pts = [];
    for (let tries = 0; tries < 900 && pts.length < want; tries++){
      const p = { x: 0.06 + rng() * 0.88, y: 0.07 + rng() * 0.86 };
      if (pts.every(q => dist2(p, q) > 0.155)) pts.push(p);
    }
    if (pts.length < 12) continue;

    pts.sort((a, b) => a.x - b.x);
    const nodes = pts.map((p, i) => ({
      id: RID[i], label: RID[i],
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000
    }));
    const n = nodes.length;

    // Prim spanning tree — this is what guarantees the goal is reachable
    const inTree = [0], out = [];
    for (let i = 1; i < n; i++) out.push(i);
    const links = [];
    while (out.length){
      let bi = 0, bj = 0, best = Infinity;
      for (const i of inTree) for (let k = 0; k < out.length; k++){
        const d = dist2(nodes[i], nodes[out[k]]);
        if (d < best){ best = d; bi = i; bj = k; }
      }
      const j = out.splice(bj, 1)[0];
      links.push([bi, j]);
      inTree.push(j);
    }

    // extras: short, degree-capped, and never crossing an edge already drawn
    const deg = new Array(n).fill(0);
    for (const [i, j] of links){ deg[i]++; deg[j]++; }
    const cand = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) cand.push([i, j, dist2(nodes[i], nodes[j])]);
    cand.sort((a, b) => a[2] - b[2]);
    const has = new Set(links.map(([i, j]) => i < j ? i + ',' + j : j + ',' + i));
    let extras = Math.round(n * 0.45);
    for (const [i, j, d] of cand){
      if (extras <= 0) break;
      if (d > 0.36) break;
      const key = i < j ? i + ',' + j : j + ',' + i;
      if (has.has(key) || deg[i] >= 4 || deg[j] >= 4) continue;
      if (links.some(([p, q]) => crosses(nodes[i], nodes[j], nodes[p], nodes[q]))) continue;
      links.push([i, j]); has.add(key); deg[i]++; deg[j]++; extras--;
    }

    // ceil keeps every edge at least as long as its straight-line distance,
    // so floor(straight-line) below is admissible for sure
    const edges = links.map(([i, j]) => ({
      a: nodes[i].id, b: nodes[j].id,
      cost: Math.max(1, Math.ceil(dist2(nodes[i], nodes[j]) * 100))
    }));

    autoLabelPos(nodes, links);

    const model = {
      id: 'random',
      name: 'Random graph',
      note: 'Fresh layout every time you pick it. Costs are straight-line distances.',
      undirected: true,
      nodes, edges,
      start: nodes[0].id,
      goal:  nodes[n - 1].id,
      hScale: 1,
      admissible: true
    };

    // explicit reachability check, even though the spanning tree already assures it
    const adj = adjacency(model);
    const seen = new Set([model.start]);
    const q = [model.start];
    for (let h = 0; h < q.length; h++)
      for (const { to } of adj.get(q[h])) if (!seen.has(to)){ seen.add(to); q.push(to); }
    if (!seen.has(model.goal)) continue;

    const goalNode = nodes[n - 1];
    model.heuristic = {};
    for (const nd of nodes) model.heuristic[nd.id] = Math.floor(dist2(nd, goalNode) * 100);
    return model;
  }
  return exam;   // unreachable in practice; never hand back a broken model
}

const randomPreset = randomGraph(20260909);
randomPreset.generate = () => {
  const next = randomGraph((Math.random() * 0x7fffffff) | 0);
  next.generate = randomPreset.generate;
  return next;
};

/* =========================================================
   5. Inadmissible h — h(A)=9 when the true remaining cost from A is 4.
   A* never expands A, so it takes S→C→D→G for 9 instead of S→A→B→G for 6.
   Run UCS on the same graph and it finds the 6.
   ========================================================= */
const badH = {
  id: 'badh',
  name: 'Inadmissible h',
  note: 'h(A)=9 but the true cost from A is 4, so A* skips A and returns 9 instead of 6.',
  undirected: true,
  nodes: [
    { id:'S', label:'S', x:0.080, y:0.500 },
    { id:'A', label:'A', x:0.300, y:0.240 },
    { id:'B', label:'B', x:0.560, y:0.160 },
    { id:'C', label:'C', x:0.320, y:0.760 },
    { id:'D', label:'D', x:0.620, y:0.800 },
    { id:'E', label:'E', x:0.500, y:0.500 },
    { id:'G', label:'G', x:0.920, y:0.480 }
  ],
  edges: [
    { a:'S', b:'A', cost:2 },
    { a:'A', b:'B', cost:2 },
    { a:'B', b:'G', cost:2 },
    { a:'S', b:'C', cost:3 },
    { a:'C', b:'D', cost:3 },
    { a:'D', b:'G', cost:3 },
    { a:'A', b:'E', cost:3 },
    { a:'C', b:'E', cost:4 },
    { a:'E', b:'D', cost:3 }
  ],
  start: 'S',
  goal:  'G',
  heuristic: { S:6, A:9, B:2, C:5, D:3, E:5, G:0 },
  hScale: 1,
  admissible: false
};

SAD.graphPresets = [romania, exam, deepTree, randomPreset, badH];

})(typeof globalThis !== 'undefined' ? globalThis : window);
