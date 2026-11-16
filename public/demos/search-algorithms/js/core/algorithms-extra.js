/* Iterative-deepening DFS and bidirectional search.
   Pure logic: no DOM, loads under node as well as in the browser. */
(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});

  /* A round of iterative deepening can never need a limit deeper than the number
     of nodes: every path a depth-limited search follows is simple, so it visits
     each state at most once. The ceiling on top of that keeps a huge state space
     (a 60x40 grid) from queueing thousands of hopeless rounds. */
  const DEPTH_CEILING = 512;

  const finiteOr = (v, dflt) => (typeof v === 'number' && isFinite(v) ? v : dflt);
  const emptyFrontier = () => [];
  const fmt = v => (Math.round(v * 100) / 100);

  /* =========================================================
     Binary heap, min by cmp
     ========================================================= */
  class Heap {
    constructor(cmp) { this.a = []; this.cmp = cmp; }
    get size() { return this.a.length; }
    push(x) {
      const a = this.a; a.push(x);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.cmp(a[i], a[p]) < 0) { const t = a[i]; a[i] = a[p]; a[p] = t; i = p; } else break;
      }
    }
    peek() { return this.a[0]; }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
          if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
          if (m === i) break;
          const t = a[i]; a[i] = a[m]; a[m] = t; i = m;
        }
      }
      return top;
    }
  }

  /* =========================================================
     Iterative deepening DFS
     Delegates every round to the registered depth-limited search and
     stitches the rounds together.
     ========================================================= */
  function* iddfs(problem, opts) {
    opts = opts || {};
    const dls = typeof SAD.algorithmById === 'function' ? SAD.algorithmById('dls') : null;
    if (!dls || typeof dls.make !== 'function') {
      throw new Error('iddfs delegates to dls, which is not registered');
    }

    const startL = Math.max(0, Math.round(finiteOr(opts.limit, 0)));
    const cap = finiteOr(opts.maxExpansions, Infinity);
    const nodeCount = (typeof problem.nodes === 'function' && problem.nodes().length) || DEPTH_CEILING;
    const maxL = Math.max(startL, Math.min(DEPTH_CEILING, Math.max(1, nodeCount)));

    let expansions = 0;

    for (let L = startL; L <= maxL; L++) {
      /* Wipe every search-state visual and announce the round. The tree view
         redraws itself from scratch one level deeper on each of these. */
      yield {
        kind: 'restart', iteration: L, fsize: 0, frontier: emptyFrontier,
        note: 'round ' + (L - startL + 1) + ' — depth limit L = ' + L
      };

      const inner = dls.make(problem, Object.assign({}, opts, {
        limit: L,
        maxExpansions: cap === Infinity ? Infinity : Math.max(1, cap - expansions)
      }));

      let sawCutoff = false, capped = false;

      for (const step of inner) {
        if (step.kind === 'fail') {
          /* A round ending in cutoff is not a failure, it is the signal to go
             one level deeper. A round ending WITHOUT cutoff means the search
             saw the whole state space inside L and there is no goal in it
             anywhere, so iterative deepening has to stop too. */
          sawCutoff = !!step.cutoff;
          capped = step.note === 'cap';
          break;
        }
        if (step.kind === 'expand' || step.kind === 'cutoff' || step.kind === 'goal') expansions++;
        yield Object.assign({}, step, { iteration: L });
        if (step.kind === 'goal') return;
        if (expansions >= cap) { capped = true; break; }
      }

      if (capped) {
        yield {
          kind: 'fail', iteration: L, note: 'cap', fsize: 0, frontier: emptyFrontier
        };
        return;
      }
      if (!sawCutoff) {
        yield {
          kind: 'fail', iteration: L, fsize: 0, frontier: emptyFrontier,
          note: 'depth ' + L + ' covered the whole reachable state space — no goal exists'
        };
        return;
      }
    }

    /* Ran out of depth budget rather than out of state space. */
    yield {
      kind: 'fail', cutoff: true, note: 'cap', iteration: maxL, fsize: 0, frontier: emptyFrontier
    };
  }

  SAD.registerAlgorithm({
    id: 'iddfs',
    order: 4,
    name: 'Iterative Deepening DFS',
    short: 'IDDFS',
    group: 'uninformed',
    desc: 'Runs depth-limited search again and again, one level deeper each round: L = 0, then 1, then 2. Throwing away the whole tree and rebuilding it looks wasteful, but the bottom level of a tree holds most of its nodes, so everything above it is re-expanded for only a constant factor of extra work. What you get for that is DFS memory and BFS answers — the frontier never holds more than one path plus its siblings, and the goal it returns is still the shallowest one.',
    complete: ['yes', 'Yes, when the branching factor is finite'],
    optimal: ['maybe', 'Only when every step costs the same'],
    time: 'O(b^d)',
    space: 'O(b·d)',
    frontierLabel: 'LIFO stack — top (next out) at top, one round per limit',
    frontierKeys: ['d', 'g'],
    supports: { limit: true, undirectedOnly: false },
    code:
`for L ← 0, 1, 2, 3, ...:                  # the slider sets the first L
    result ← DEPTH_LIMITED_SEARCH(START, L)

    if result is SOLUTION:
        return result
    if result is not CUTOFF:               # searched everything inside L
        return FAILURE                     #   and found no goal at all
    # result was CUTOFF: something was still unexplored below L,
    # so throw the tree away and go one level deeper.

return FAILURE

# goalTest = 'gen'   each round hands the test to depth-limited search,
#                    which tests a child as it is generated, so a round
#                    can finish one expansion earlier than under 'pop'
# search   = 'tree'  what iterative deepening assumes anyway: no explored
#                    set survives a round, only the check against the
#                    path being walked, which is what keeps memory O(b·L).
#                    Under 'graph' the round's explored set is depth-
#                    sensitive — a state met at a strictly shallower depth
#                    is expanded again — so the shallowest goal survives.`,
    make: (problem, opts) => iddfs(problem, opts)
  });

  /* =========================================================
     Bidirectional search
     Forward from the start, backward from the goal, alternating.
     ========================================================= */
  function* bidirectional(problem, opts) {
    opts = opts || {};
    const cap = finiteOr(opts.maxExpansions, Infinity);
    const label = n => (typeof problem.label === 'function' ? problem.label(n) : String(n));

    const allNodes = typeof problem.nodes === 'function' ? problem.nodes() : [];
    const goals = allNodes.filter(n => problem.isGoal(n));

    const view0 = emptyFrontier;
    if (!goals.length) {
      yield { kind: 'init', pushed: [{ id: problem.start, parent: null, g: 0, h: 0, f: 0, d: 0, side: 'f' }], fsize: 1, frontier: view0 };
      yield { kind: 'fail', fsize: 0, frontier: view0, note: 'the backward search has nowhere to start from — no goal node' };
      return;
    }

    /* Backward expansion needs the edges pointing INTO a node, and it takes
       them from predecessors() no matter what `undirected` says. `undirected`
       promises only that adjacency is symmetric, never that the two directions
       cost the same. The grid is exactly that case: its step cost is the cost
       of the cell being ENTERED, so cost(a->b) = cost[b] while cost(b->a) =
       cost[a]. Pricing the backward search with successors() gives wrong path
       costs on every weighted grid while still looking right on a unit-cost
       graph, which is what makes it such a quiet bug. */
    let predsOf;
    if (typeof problem.predecessors === 'function') {
      predsOf = n => problem.predecessors(n).map(e => ({ id: e.from, cost: e.cost }));
    } else {
      /* Every problem the app ships supplies predecessors(). This is only so a
         hand-rolled one cannot crash the search. */
      const rev = new Map();
      for (const n of allNodes) {
        for (const e of problem.successors(n)) {
          let list = rev.get(e.to);
          if (!list) { list = []; rev.set(e.to, list); }
          list.push({ id: n, cost: e.cost });
        }
      }
      predsOf = n => rev.get(n) || [];
    }
    const succsOf = n => problem.successors(n).map(e => ({ id: e.to, cost: e.cost }));

    const cmp = (a, b) => a.g - b.g;
    const F = { tag: 'f', dist: new Map(), par: new Map(), dep: new Map(), settled: new Set(), heap: new Heap(cmp), edges: succsOf };
    const B = { tag: 'b', dist: new Map(), par: new Map(), dep: new Map(), settled: new Set(), heap: new Heap(cmp), edges: predsOf };
    F.other = B; B.other = F;

    F.dist.set(problem.start, 0); F.dep.set(problem.start, 0);
    F.heap.push({ id: problem.start, g: 0 });
    for (const gnode of goals) {
      B.dist.set(gnode, 0); B.dep.set(gnode, 0);
      B.heap.push({ id: gnode, g: 0 });
    }

    const live = S => {
      const bestOf = new Map();
      for (const e of S.heap.a) {
        if (S.settled.has(e.id)) continue;
        const d = S.dist.get(e.id);
        if (d === undefined || e.g > d) continue;
        const prev = bestOf.get(e.id);
        if (!prev || e.g < prev.g) bestOf.set(e.id, e);
      }
      return bestOf;
    };
    const view = () => {
      const out = [];
      for (const S of [F, B]) {
        for (const e of live(S).values()) {
          out.push({ id: e.id, g: e.g, h: 0, f: e.g, d: S.dep.get(e.id) || 0, side: S.tag });
        }
      }
      return out.sort((a, b) => (a.g - b.g) || (a.side < b.side ? -1 : 1));
    };
    const fsize = () => F.heap.size + B.heap.size;

    const initPushed = [{ id: problem.start, parent: null, g: 0, h: 0, f: 0, d: 0, side: 'f' }];
    for (const gnode of goals) initPushed.push({ id: gnode, parent: null, g: 0, h: 0, f: 0, d: 0, side: 'b' });
    yield {
      kind: 'init', pushed: initPushed, fsize: fsize(), frontier: view,
      note: 'forward from ' + label(problem.start) + ', backward from ' + goals.map(label).join(' / ')
    };

    /* mu is the cost of the best start-to-goal path found through any node both
       sides have reached. It is an upper bound that only ever gets smaller. */
    let mu = Infinity, meet = null, announced = false;

    if (problem.isGoal(problem.start)) {
      yield {
        kind: 'goal', id: problem.start, g: 0, h: 0, f: 0, depth: 0, side: 'f',
        path: [problem.start], fsize: fsize(), frontier: view, note: 'the start is already a goal'
      };
      return;
    }

    const consider = (id, side, gHere) => {
      const od = side.other.dist.get(id);
      if (od === undefined) return false;
      const total = gHere + od;
      if (total < mu) { mu = total; meet = id; return true; }
      return false;
    };

    const topKey = S => {
      /* Cheapest key still worth popping, skipping entries the search has
         already improved on or settled. */
      while (S.heap.size) {
        const e = S.heap.peek();
        const d = S.dist.get(e.id);
        if (S.settled.has(e.id) || d === undefined || e.g > d) { S.heap.pop(); continue; }
        return e.g;
      }
      return Infinity;
    };

    let expansions = 0;
    let turn = 0;

    for (;;) {
      const tF = topKey(F), tB = topKey(B);

      /* The termination rule. Every path still reachable costs at least
         tF + tB, so once that reaches mu nothing better than the best
         meeting so far can turn up. Stopping at the first meeting instead
         is the classic bug: that node is usually not on the cheapest path. */
      if (tF === Infinity && tB === Infinity) break;
      if (tF + tB >= mu) break;

      let S = turn === 0 ? F : B;
      if (S.heap.size === 0) S = S.other;
      turn ^= 1;

      const e = S.heap.pop();
      const known = S.dist.get(e.id);
      if (S.settled.has(e.id) || known === undefined || e.g > known) {
        yield {
          kind: 'stale', id: e.id, g: e.g, h: 0, f: e.g, side: S.tag,
          fsize: fsize(), frontier: view
        };
        continue;
      }
      S.settled.add(e.id);
      expansions++;

      const depth = S.dep.get(e.id) || 0;
      let improved = consider(e.id, S, e.g);

      const pushed = [];
      for (const nb of S.edges(e.id)) {
        const ng = e.g + nb.cost;
        const cur = S.dist.get(nb.id);
        if (cur === undefined || ng < cur) {
          S.dist.set(nb.id, ng);
          S.par.set(nb.id, e.id);
          S.dep.set(nb.id, depth + 1);
          S.heap.push({ id: nb.id, g: ng });
          pushed.push({ id: nb.id, parent: e.id, g: ng, h: 0, f: ng, d: depth + 1, side: S.tag });
          if (consider(nb.id, S, ng)) improved = true;
        }
      }

      yield {
        kind: 'expand', id: e.id, g: e.g, h: 0, f: e.g, depth, side: S.tag,
        pushed, fsize: fsize(), frontier: view,
        note: S.tag === 'f' ? 'forward' : 'backward'
      };

      if (improved) {
        yield {
          kind: 'meet', id: meet, g: mu, h: 0, f: mu, side: S.tag,
          pushed: [], fsize: fsize(), frontier: view,
          note: announced
            ? 'better meeting at ' + label(meet) + ' — best path now ' + fmt(mu)
            : 'frontiers touched at ' + label(meet) + ' — path of ' + fmt(mu) + ', not proven best yet'
        };
        announced = true;
      }

      if (expansions >= cap) {
        yield { kind: 'fail', note: 'cap', side: S.tag, fsize: fsize(), frontier: view };
        return;
      }
    }

    if (meet === null) {
      yield { kind: 'fail', fsize: fsize(), frontier: view, note: 'the two searches never met — the goal is unreachable' };
      return;
    }

    /* Splice the two halves: walk forward parents back to the start, reverse
       that, then walk backward parents on to the goal. */
    const head = [];
    let c = meet, guard = 0;
    while (c !== undefined && guard++ < 1e6) {
      head.push(c);
      const p = F.par.get(c);
      if (p === undefined) break;
      c = p;
    }
    head.reverse();
    const path = head;
    c = B.par.get(meet); guard = 0;
    while (c !== undefined && guard++ < 1e6) {
      path.push(c);
      c = B.par.get(c);
    }

    yield {
      kind: 'goal', id: meet, g: mu, h: 0, f: mu, depth: F.dep.get(meet) || 0,
      side: 'f', path, fsize: fsize(), frontier: view,
      note: 'met at ' + label(meet) + ' — ' + fmt(mu) + ' total, proven best once both frontiers passed it'
    };
  }

  SAD.registerAlgorithm({
    id: 'bidirectional',
    order: 8,
    name: 'Bidirectional Search',
    short: 'Bi-dir',
    group: 'informed',
    desc: 'Two searches run at once, one forward from the start and one backward from the goal, taking turns. Two trees of depth d/2 hold far fewer nodes than one tree of depth d, and that is the whole speedup. The subtle part is when to stop. The first node both searches touch is usually not on the cheapest path, so this keeps going until the cheapest key left in each frontier can no longer add up to anything better than the best meeting it has already found. Searching backward needs the edges pointing into a node rather than out of it, which is why it is offered only on problems whose adjacency is symmetric — and why it prices those edges with predecessors(), since symmetric adjacency does not mean symmetric cost.',
    complete: ['yes', 'Yes, when both directions can be searched'],
    optimal: ['yes', 'Yes — it does not stop at the first meeting'],
    time: 'O(b^(d/2))',
    space: 'O(b^(d/2))',
    frontierLabel: 'Two priority queues — lowest g first, sides alternate',
    frontierKeys: ['g'],
    supports: { limit: false, undirectedOnly: true },
    code:
`forward  ← priority queue by g_f, holding START with g_f = 0
backward ← priority queue by g_b, holding GOAL  with g_b = 0
best ← INFINITY                          # cheapest meeting found so far
meet ← none

while forward and backward are not both empty:
    if TOP(forward) + TOP(backward) ≥ best:
        break                            # nothing left can beat best
    side ← the queue whose turn it is
    node ← side.POP_MIN()
    side.SETTLE(node)

    if node has been reached by the other side:
        total ← g_side(node) + g_other(node)
        if total < best:
            best ← total ; meet ← node   # keep going, this may not be final

    for each neighbour of EXPAND(node):  # backward uses edges INTO node
        new_g ← g_side(node) + COST(node, neighbour)
        if new_g < g_side(neighbour):
            g_side(neighbour) ← new_g
            side.PUSH(neighbour, new_g)
            if neighbour reached by other side:
                best ← MIN(best, new_g + g_other(neighbour))

if meet is none: return FAILURE
return PATH(START → meet) + PATH(meet → GOAL)

# goalTest = 'gen'   no effect. There is no single goal test to move
#                    earlier: the run ends when the two frontiers can no
#                    longer add up to anything better than their best
#                    meeting, and the goal is just the backward root
# search   = 'tree'  no effect. Both sides settle each state once, and
#                    that is what makes the stopping rule sound. Dropping
#                    it would cost optimality, not just speed`,
    make: (problem, opts) => bidirectional(problem, opts)
  });

})(typeof globalThis !== 'undefined' ? globalThis : window);
