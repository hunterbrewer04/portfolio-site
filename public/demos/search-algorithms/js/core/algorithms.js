(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});
  const Heap = SAD.Heap;

  /* -------------------------------------------------------------
     Search nodes

     A node is { state, parent, g, depth } with a parent pointer, not an entry
     in a global parent map. Tree search then costs nothing extra: the same
     state can sit in many nodes at once, the cycle check is a walk up the
     chain, and the solution path falls out of the same walk.
     ------------------------------------------------------------- */

  const mk = (state, parent, g, depth) => ({ state, parent, g, depth, h: 0, f: g });

  function pathOf(n){
    const out = [];
    for (let c = n; c; c = c.parent) out.push(c.state);
    out.reverse();
    return out;
  }

  function onPath(n, state){
    for (let c = n; c; c = c.parent) if (c.state === state) return true;
    return false;
  }

  const ent = n => ({
    id: n.state,
    parent: n.parent ? n.parent.state : null,
    g: n.g, h: n.h, f: n.f, d: n.depth
  });

  function opt(o){
    o = o || {};
    return {
      limit:         o.limit         == null ? Infinity : o.limit,
      goalTest:      o.goalTest === 'gen' ? 'gen' : 'pop',
      search:        o.search   === 'tree' ? 'tree' : 'graph',
      maxExpansions: o.maxExpansions == null ? Infinity : o.maxExpansions
    };
  }

  /* -------------------------------------------------------------
     Breadth-first
     ------------------------------------------------------------- */

  function* bfs(problem, opts){
    const o = opt(opts);
    const tree = o.search === 'tree';
    const root = mk(problem.start, null, 0, 0);
    const q = [root]; let head = 0;
    const reached = tree ? null : new Set([problem.start]);
    let expansions = 0;

    const view = () => {
      const out = [];
      for (let i = head; i < q.length; i++) out.push(ent(q[i]));
      return out;
    };
    const fsize = () => q.length - head;

    yield { kind:'init', pushed:[ent(root)], fsize:fsize(), frontier:view };

    if (o.goalTest === 'gen' && problem.isGoal(root.state)){
      yield { kind:'goal', id:root.state, g:0, h:0, f:0, depth:0,
              path:[root.state], fsize:fsize(), frontier:view };
      return;
    }

    while (head < q.length){
      if (expansions >= o.maxExpansions){
        yield { kind:'fail', note:'cap', fsize:fsize(), frontier:view };
        return;
      }
      const cur = q[head++];

      if (o.goalTest === 'pop' && problem.isGoal(cur.state)){
        yield { kind:'goal', id:cur.state, g:cur.g, h:0, f:cur.g, depth:cur.depth,
                path:pathOf(cur), fsize:fsize(), frontier:view };
        return;
      }
      expansions++;

      const pushed = [];
      for (const s of problem.successors(cur.state)){
        if (tree){
          if (onPath(cur, s.to)) continue;
        } else {
          if (reached.has(s.to)) continue;
          reached.add(s.to);
        }
        const ch = mk(s.to, cur, cur.g + s.cost, cur.depth + 1);
        q.push(ch);
        pushed.push(ent(ch));
        if (o.goalTest === 'gen' && problem.isGoal(ch.state)){
          yield { kind:'goal', id:ch.state, g:ch.g, h:0, f:ch.g, depth:ch.depth,
                  path:pathOf(ch), pushed, fsize:fsize(), frontier:view };
          return;
        }
      }
      yield { kind:'expand', id:cur.state, g:cur.g, h:0, f:cur.g, depth:cur.depth,
              pushed, fsize:fsize(), frontier:view };
    }
    yield { kind:'fail', fsize:fsize(), frontier:view };
  }

  /* -------------------------------------------------------------
     Depth-first and depth-limited

     Successors are pushed in reverse, so the first one the problem lists is
     the first one popped. On a grid that lists [down, right, up, left], which
     goes onto the stack as left, up, right, down and comes off down first.
     ------------------------------------------------------------- */

  function* depthFirst(problem, opts, limited){
    const o = opt(opts);
    const L = limited ? o.limit : Infinity;
    const tree = o.search === 'tree';
    const explored = tree ? null : new Map();   // state -> shallowest depth expanded
    const root = mk(problem.start, null, 0, 0);

    /* A depth limit makes the explored set depth-sensitive. Expanding a state
       once at a deep depth and never looking at it again can hide a goal that
       does sit within the limit, reachable through that state by a shallower
       route — which costs iterative deepening its shallowest-goal guarantee.
       So DLS re-expands a state that turns up strictly shallower than the depth
       it was expanded at. Plain DFS has no such guarantee to keep and stays
       seen-once. */
    const blocked = (state, depth) => {
      const at = explored.get(state);
      if (at === undefined) return false;
      return limited ? at <= depth : true;
    };
    const stack = [root];
    let cut = false, expansions = 0;

    const view = () => {
      const out = [], seen = tree ? null : new Set();
      for (let i = stack.length - 1; i >= 0; i--){
        const n = stack[i];
        if (seen){
          if (blocked(n.state, n.depth) || seen.has(n.state)) continue;
          seen.add(n.state);
        }
        out.push(ent(n));
      }
      return out;
    };
    const fsize = () => stack.length;

    yield { kind:'init', pushed:[ent(root)], fsize:fsize(), frontier:view };

    if (o.goalTest === 'gen' && problem.isGoal(root.state)){
      yield { kind:'goal', id:root.state, g:0, h:0, f:0, depth:0,
              path:[root.state], fsize:fsize(), frontier:view };
      return;
    }

    while (stack.length){
      if (expansions >= o.maxExpansions){
        yield { kind:'fail', note:'cap', fsize:fsize(), frontier:view };
        return;
      }
      const cur = stack.pop();

      if (explored && blocked(cur.state, cur.depth)){
        yield { kind:'stale', id:cur.state, g:cur.g, h:0, f:cur.g, depth:cur.depth,
                fsize:fsize(), frontier:view };
        continue;
      }
      if (explored) explored.set(cur.state, cur.depth);

      if (o.goalTest === 'pop' && problem.isGoal(cur.state)){
        yield { kind:'goal', id:cur.state, g:cur.g, h:0, f:cur.g, depth:cur.depth,
                path:pathOf(cur), fsize:fsize(), frontier:view };
        return;
      }
      expansions++;

      if (cur.depth >= L){
        cut = true;
        yield { kind:'cutoff', id:cur.state, g:cur.g, h:0, f:cur.g, depth:cur.depth,
                fsize:fsize(), frontier:view };
        continue;
      }

      const succ = problem.successors(cur.state);
      const pushed = [];
      for (let k = succ.length - 1; k >= 0; k--){
        const s = succ[k];
        if (tree){
          if (onPath(cur, s.to)) continue;
        } else if (blocked(s.to, cur.depth + 1)) continue;

        const ch = mk(s.to, cur, cur.g + s.cost, cur.depth + 1);
        stack.push(ch);
        pushed.push(ent(ch));
        if (o.goalTest === 'gen' && problem.isGoal(ch.state)){
          yield { kind:'goal', id:ch.state, g:ch.g, h:0, f:ch.g, depth:ch.depth,
                  path:pathOf(ch), pushed, fsize:fsize(), frontier:view };
          return;
        }
      }
      yield { kind:'expand', id:cur.state, g:cur.g, h:0, f:cur.g, depth:cur.depth,
              pushed, fsize:fsize(), frontier:view };
    }
    yield { kind:'fail', cutoff:cut, fsize:fsize(), frontier:view };
  }

  /* -------------------------------------------------------------
     Best-first: uniform-cost, greedy, A*

     One loop, three keys. g is tracked in every mode so the path cost is real
     even when the ordering ignores it.
     ------------------------------------------------------------- */

  function* bestFirst(problem, opts, mode){
    const o = opt(opts);
    const tree = o.search === 'tree';
    const useH = mode !== 'ucs';
    const hOf = n => useH ? problem.h(n) : 0;
    const keyOf = mode === 'greedy' ? (g,h) => h
                : mode === 'astar'  ? (g,h) => g + h
                :                     (g,h) => g;

    const heap = new Heap((a,b) => (a.f - b.f) || (a.h - b.h));
    const closed = tree ? null : new Set();
    const bestG  = tree ? null : new Map();
    let expansions = 0;

    const root = mk(problem.start, null, 0, 0);
    root.h = hOf(root.state);
    root.f = keyOf(0, root.h);
    if (bestG) bestG.set(root.state, 0);
    heap.push(root);

    const view = () => {
      if (tree) return heap.a.map(ent).sort((a,b) => (a.f-b.f) || (a.h-b.h));
      const best = new Map();
      for (const n of heap.a){
        if (closed.has(n.state)) continue;
        const p = best.get(n.state);
        if (!p || n.f < p.f) best.set(n.state, n);
      }
      return [...best.values()].map(ent).sort((a,b) => (a.f-b.f) || (a.h-b.h));
    };
    const fsize = () => heap.size;

    yield { kind:'init', pushed:[ent(root)], fsize:fsize(), frontier:view };

    if (o.goalTest === 'gen' && problem.isGoal(root.state)){
      yield { kind:'goal', id:root.state, g:0, h:root.h, f:root.f, depth:0,
              path:[root.state], fsize:fsize(), frontier:view };
      return;
    }

    while (heap.size){
      if (expansions >= o.maxExpansions){
        yield { kind:'fail', note:'cap', fsize:fsize(), frontier:view };
        return;
      }
      const cur = heap.pop();

      if (closed && closed.has(cur.state)){
        yield { kind:'stale', id:cur.state, g:cur.g, h:cur.h, f:cur.f, depth:cur.depth,
                fsize:fsize(), frontier:view };
        continue;
      }
      if (closed) closed.add(cur.state);

      if (o.goalTest === 'pop' && problem.isGoal(cur.state)){
        yield { kind:'goal', id:cur.state, g:cur.g, h:cur.h, f:cur.f, depth:cur.depth,
                path:pathOf(cur), fsize:fsize(), frontier:view };
        return;
      }
      expansions++;

      const pushed = [];
      for (const s of problem.successors(cur.state)){
        const ng = cur.g + s.cost;
        if (tree){
          if (onPath(cur, s.to)) continue;
        } else {
          if (closed.has(s.to)) continue;
          const prev = bestG.get(s.to);
          if (prev !== undefined && ng >= prev) continue;   // must strictly improve
          bestG.set(s.to, ng);
        }
        const ch = mk(s.to, cur, ng, cur.depth + 1);
        ch.h = hOf(s.to);
        ch.f = keyOf(ng, ch.h);
        heap.push(ch);
        pushed.push(ent(ch));
        if (o.goalTest === 'gen' && problem.isGoal(ch.state)){
          yield { kind:'goal', id:ch.state, g:ch.g, h:ch.h, f:ch.f, depth:ch.depth,
                  path:pathOf(ch), pushed, fsize:fsize(), frontier:view };
          return;
        }
      }
      yield { kind:'expand', id:cur.state, g:cur.g, h:cur.h, f:cur.f, depth:cur.depth,
              pushed, fsize:fsize(), frontier:view };
    }
    yield { kind:'fail', fsize:fsize(), frontier:view };
  }

  /* -------------------------------------------------------------
     Registry
     ------------------------------------------------------------- */

  const SWITCHES =
`
# goalTest = 'gen'   test each child the moment it is generated
#                    instead of waiting until it is popped
# search   = 'tree'  no explored set at all. A state is reachable by
#                    many paths and appears many times in the tree, so
#                    a child already on the current path is rejected —
#                    without that check the search never terminates.`;

  const reg = SAD.registerAlgorithm;

  reg({
    id:'bfs', order:1, name:'Breadth-First Search', short:'BFS', group:'uninformed',
    desc:'Expands the shallowest node in the frontier. The frontier is a FIFO queue, so nodes leave in exactly the order they arrived and the search sweeps outward in even rings from the start.',
    complete: ['yes','Yes'],
    optimal:  ['maybe','Only when every step costs the same'],
    time:'O(b^d)', space:'O(b^d)',
    frontierLabel:'FIFO queue — front (next out) at top',
    frontierKeys:['g','d'],
    supports:{ limit:false, undirectedOnly:false },
    make(problem, opts){ return bfs(problem, opts); },
    code:
`frontier ← FIFO queue with START
explored ← { START }

while frontier is not empty:
    node ← frontier.POP_FRONT()
    if node is GOAL:
        return SOLUTION(node)
    for each child of EXPAND(node):
        if child not in explored:
            explored.ADD(child)
            frontier.PUSH_BACK(child)

return FAILURE
` + SWITCHES
  });

  reg({
    id:'dfs', order:2, name:'Depth-First Search', short:'DFS', group:'uninformed',
    desc:'Expands the deepest node in the frontier. The frontier is a LIFO stack, so the newest child comes out first and the search dives down one corridor until it dead-ends before backing up.',
    complete: ['maybe','Yes on a finite graph with an explored set'],
    optimal:  ['no','No — returns the first path found'],
    time:'O(b^m)', space:'O(b·m)',
    frontierLabel:'LIFO stack — top (next out) at top',
    frontierKeys:['g','d'],
    supports:{ limit:false, undirectedOnly:false },
    make(problem, opts){ return depthFirst(problem, opts, false); },
    code:
`frontier ← LIFO stack with START
explored ← { }

while frontier is not empty:
    node ← frontier.POP_TOP()
    if node in explored: continue        # stale entry
    explored.ADD(node)
    if node is GOAL:
        return SOLUTION(node)
    for each child of EXPAND(node):
        if child not in explored:
            frontier.PUSH_TOP(child)

return FAILURE
` + SWITCHES
  });

  reg({
    id:'dls', order:3, name:'Depth-Limited Search', short:'DLS', group:'uninformed',
    desc:'DFS that refuses to look past depth L. Nodes at the limit are cut off and their children are never generated, which bounds time and memory — but the goal is unreachable if it sits deeper than L. Run it with growing L and you get iterative deepening.',
    complete: ['maybe','Only if L ≥ depth of the shallowest goal'],
    optimal:  ['no','No'],
    time:'O(b^L)', space:'O(b·L)',
    frontierLabel:'LIFO stack — top (next out) at top',
    frontierKeys:['g','d'],
    supports:{ limit:true, undirectedOnly:false },
    make(problem, opts){ return depthFirst(problem, opts, true); },
    code:
`frontier ← LIFO stack with (START, depth 0)
explored ← { }
cutoff_hit ← false

while frontier is not empty:
    (node, depth) ← frontier.POP_TOP()
    if explored[node] ≤ depth: continue   # already expanded this shallow
    explored[node] ← depth                # re-expand if seen deeper before
    if node is GOAL:
        return SOLUTION(node)
    if depth = L:                        # cut off, do not expand
        cutoff_hit ← true
        continue
    for each child of EXPAND(node):
        if explored[child] > depth + 1:
            frontier.PUSH_TOP((child, depth + 1))

return CUTOFF if cutoff_hit else FAILURE
` + SWITCHES
  });

  reg({
    id:'ucs', order:5, name:'Uniform-Cost Search', short:'UCS', group:'uninformed',
    desc:'Expands the node with the lowest path cost g(n) so far. The frontier is a priority queue keyed on g, which makes this Dijkstra’s algorithm: it grows a cost contour outward and is optimal for any non-negative step costs.',
    complete: ['yes','Yes, when every step cost is > 0'],
    optimal:  ['yes','Yes'],
    time:'O(b^(1+⌊C*/ε⌋))', space:'O(b^(1+⌊C*/ε⌋))',
    frontierLabel:'Priority queue — lowest g(n) first',
    frontierKeys:['g'],
    supports:{ limit:false, undirectedOnly:false },
    make(problem, opts){ return bestFirst(problem, opts, 'ucs'); },
    code:
`frontier ← priority queue ordered by g(n)
frontier.PUSH(START, g = 0)
explored ← { }

while frontier is not empty:
    node ← frontier.POP_MIN()            # cheapest g so far
    if node in explored: continue
    explored.ADD(node)
    if node is GOAL:
        return SOLUTION(node)
    for each child of EXPAND(node):
        new_g ← g(node) + COST(node, child)
        if new_g < g(child):
            g(child) ← new_g
            frontier.PUSH(child, new_g)

return FAILURE
` + SWITCHES
  });

  reg({
    id:'greedy', order:6, name:'Greedy Best-First Search', short:'Greedy', group:'informed',
    desc:'Expands whichever node looks closest to the goal, ordering the frontier on h(n) alone and throwing away the g(n) already spent. It drives at the goal hard and usually gets there after very few expansions, but it takes the first path it stumbles into and will happily walk a long way around an obstacle that only looked like a shortcut. A* is this same loop with g added back, which is exactly what buys the optimality back.',
    complete: ['maybe','Yes on a finite graph with an explored set'],
    optimal:  ['no','No — ignores the cost already paid'],
    time:'O(b^m), far better with a good h', space:'keeps all nodes in memory',
    frontierLabel:'Priority queue — lowest h(n) first',
    frontierKeys:['g','h'],
    supports:{ limit:false, undirectedOnly:false },
    make(problem, opts){ return bestFirst(problem, opts, 'greedy'); },
    code:
`frontier ← priority queue ordered by h(n)   # g is NOT part of the key
h(n) ← estimated distance from n to GOAL
frontier.PUSH(START, h(START))
explored ← { }

while frontier is not empty:
    node ← frontier.POP_MIN()            # closest-looking node
    if node in explored: continue
    explored.ADD(node)
    if node is GOAL:
        return SOLUTION(node)
    for each child of EXPAND(node):
        new_g ← g(node) + COST(node, child)
        if new_g < g(child):
            g(child) ← new_g
            frontier.PUSH(child, h(child))

return FAILURE
` + SWITCHES
  });

  reg({
    id:'astar', order:7, name:'A* Search', short:'A*', group:'informed',
    desc:'Expands the node with the lowest f(n) = g(n) + h(n), where h is the Manhattan distance to the goal. Because h never overestimates the true remaining cost, A* returns an optimal path while pulling the search toward the goal instead of spreading evenly like UCS.',
    complete: ['yes','Yes'],
    optimal:  ['yes','Yes — h is admissible and consistent'],
    time:'O(b^d), far better with a good h', space:'keeps all nodes in memory',
    frontierLabel:'Priority queue — lowest f = g + h first',
    frontierKeys:['g','h','f'],
    supports:{ limit:false, undirectedOnly:false },
    make(problem, opts){ return bestFirst(problem, opts, 'astar'); },
    code:
`frontier ← priority queue ordered by f(n) = g(n) + h(n)
h(n) ← MANHATTAN(n, GOAL)                # admissible
frontier.PUSH(START, f = h(START))
explored ← { }

while frontier is not empty:
    node ← frontier.POP_MIN()            # lowest f
    if node in explored: continue
    explored.ADD(node)
    if node is GOAL:
        return SOLUTION(node)
    for each child of EXPAND(node):
        new_g ← g(node) + COST(node, child)
        if new_g < g(child):
            g(child) ← new_g
            frontier.PUSH(child, new_g + h(child))

return FAILURE
` + SWITCHES
  });

})(typeof globalThis !== 'undefined' ? globalThis : window);
