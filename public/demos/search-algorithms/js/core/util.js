(function (root) {
  'use strict';
  const SAD = (root.SAD = root.SAD || {});

  /* Binary heap. cmp(a,b) < 0 means a leaves first. */
  class Heap {
    constructor(cmp){ this.a = []; this.cmp = cmp; }
    get size(){ return this.a.length; }
    push(x){
      const a = this.a; a.push(x);
      let i = a.length - 1;
      while (i > 0){
        const p = (i - 1) >> 1;
        if (this.cmp(a[i], a[p]) < 0){ [a[i],a[p]] = [a[p],a[i]]; i = p; } else break;
      }
    }
    pop(){
      const a = this.a, top = a[0], last = a.pop();
      if (a.length){
        a[0] = last;
        let i = 0;
        for(;;){
          const l = 2*i+1, r = l+1; let m = i;
          if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
          if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
          if (m === i) break;
          [a[i],a[m]] = [a[m],a[i]]; i = m;
        }
      }
      return top;
    }
  }
  SAD.Heap = Heap;

  /* cost of a cell the search steps onto, when the grid is carrying terrain */
  SAD.HEAVY = 5;

  /* Picker order. Files register in whatever order the page loads them, so the
     list is kept sorted by the order each entry declares for itself. An entry
     with no order sorts last, keeping its arrival position; verify.mjs fails on
     a missing order rather than letting the picker quietly scramble. */
  const rank = entry => typeof entry.order === 'number' ? entry.order : Infinity;

  SAD.algorithms = SAD.algorithms || [];
  SAD.registerAlgorithm = SAD.registerAlgorithm || function (entry) {
    const at = SAD.algorithms.findIndex(a => a.id === entry.id);
    if (at >= 0) SAD.algorithms[at] = entry; else SAD.algorithms.push(entry);
    SAD.algorithms.sort((a, b) => rank(a) - rank(b));
    return entry;
  };
  SAD.algorithmById = SAD.algorithmById || function (id) {
    return SAD.algorithms.find(a => a.id === id) || null;
  };

  /* Worlds register from js/worlds/*.js, which the page loads before js/ui/app.js,
     so the registry has to already exist here. */
  SAD.worlds = SAD.worlds || [];
  SAD.registerWorld = SAD.registerWorld || function (world) {
    const at = SAD.worlds.findIndex(w => w.id === world.id);
    if (at >= 0) SAD.worlds[at] = world; else SAD.worlds.push(world);
    SAD.worlds.sort((a, b) => (a.order || 0) - (b.order || 0));
    return world;
  };
  SAD.worldById = SAD.worldById || function (id) {
    return SAD.worlds.find(w => w.id === id) || null;
  };
  /* contract addendum 1 name; delegates so it survives worldById being replaced */
  SAD.worldOf = SAD.worldOf || function (id) { return SAD.worldById(id); };

  /* js/data/presets.js pushes into this; predeclared so it can load in any order */
  SAD.graphPresets = SAD.graphPresets || [];

  /* the app replaces this; the default keeps a world from throwing if it edits
     itself before the app has booted */
  SAD.worldChanged = SAD.worldChanged || function () {};

})(typeof globalThis !== 'undefined' ? globalThis : window);
