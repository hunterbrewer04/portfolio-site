(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});

  /* Grid. Node ids are integers. Step cost is the cost of the cell entered, so
     the edge relation is symmetric but the two directions are not the same
     price: anything searching backwards has to use predecessors(). */
  SAD.gridProblem = function (m) {
    const start = m.start, goal = m.goal;
    const gx = m.cx(goal), gy = m.cy(goal);

    return {
      id: 'grid',
      model: m,
      start,
      goal,
      undirected: true,

      isGoal(n){ return n === goal; },

      successors(n){
        const out = [];
        for (const v of m.searchOrder(n)) if (!m.wall[v]) out.push({ to: v, cost: m.cost[v] });
        return out;
      },

      predecessors(n){
        const out = [];
        const c = m.cost[n];
        for (const v of m.searchOrder(n)) if (!m.wall[v]) out.push({ from: v, cost: c });
        return out;
      },

      h(n){ return Math.abs(m.cx(n) - gx) + Math.abs(m.cy(n) - gy); },

      nodes(){
        const out = [];
        for (let i = 0; i < m.wall.length; i++) if (!m.wall[i]) out.push(i);
        return out;
      },

      label(n){ return '(' + m.cy(n) + ',' + m.cx(n) + ')'; }
    };
  };

  /* Graph. Node ids are strings. Reads the plain-data model described in the
     contract; when it carries no heuristic table, h is straight-line distance
     between the normalized coordinates, scaled by hScale. */
  SAD.graphProblem = function (gm) {
    const list = gm.nodes || [];
    const byId = new Map();
    for (const n of list) byId.set(n.id, n);

    const undirected = gm.undirected !== false;
    const succ = new Map(), pred = new Map();
    for (const n of list){ succ.set(n.id, []); pred.set(n.id, []); }
    const link = (map, k, v) => {
      let a = map.get(k);
      if (!a){ a = []; map.set(k, a); }
      a.push(v);
    };
    for (const e of (gm.edges || [])){
      link(succ, e.a, { to: e.b, cost: e.cost });
      link(pred, e.b, { from: e.a, cost: e.cost });
      if (undirected){
        link(succ, e.b, { to: e.a, cost: e.cost });
        link(pred, e.a, { from: e.b, cost: e.cost });
      }
    }

    const table = gm.heuristic || null;
    const hScale = gm.hScale == null ? 1 : gm.hScale;
    const goalNode = byId.get(gm.goal);

    return {
      id: 'graph',
      model: gm,
      start: gm.start,
      goal: gm.goal,
      undirected,

      isGoal(n){ return n === gm.goal; },

      successors(n){ const a = succ.get(n); return a ? a.slice() : []; },
      predecessors(n){ const a = pred.get(n); return a ? a.slice() : []; },

      h(n){
        if (table){ const v = table[n]; return typeof v === 'number' ? v : 0; }
        const a = byId.get(n);
        if (!a || !goalNode) return 0;
        return Math.hypot(a.x - goalNode.x, a.y - goalNode.y) * hScale;
      },

      nodes(){ return list.map(n => n.id); },

      label(n){
        const a = byId.get(n);
        return a && a.label != null ? a.label : String(n);
      }
    };
  };

})(typeof globalThis !== 'undefined' ? globalThis : window);
