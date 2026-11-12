(() => {
  "use strict";

  const familyKeys = ["S", "R", "N", "K"];
  const budgets = [5, 25, 100, 200];
  const familyMask = keys => familyKeys.reduce((mask, key, index) => keys.includes(key) ? mask | (1 << index) : mask, 0);
  const typesIn = mask => familyKeys.filter((_, index) => mask & (1 << index));
  const reciprocal = rank => rank ? 1 / (60 + rank) : 0;
  const countBits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

  function prepare(example, record, snapshot) {
    const excerpts = new Map(example.nodes.map(node => [node.id, node.text]));
    const support = new Set(record.support);
    const passages = new Map(snapshot.passages.map(([id, title, words, meaning, rank]) => [id, {
      id, title, words, meaning, rank, text: excerpts.get(id), supporting: support.has(id),
      score: reciprocal(words) + reciprocal(meaning),
    }]));
    return {
      corpus: record.corpus,
      support: record.support.map(id => passages.get(id)),
      passages,
      seeds: snapshot.seeds.map(id => passages.get(id)),
      edges: snapshot.edges,
    };
  }

  function run(trace, budget, enabled, boost) {
    const mask = familyMask(enabled);
    const seeds = trace.seeds.slice(0, budget);
    const seedIds = new Set(seeds.map(node => node.id));
    const routes = [];
    const origins = new Map();

    for (const [a, b, types, cosine] of trace.edges) {
      const firstIsSeed = seedIds.has(a);
      if (firstIsSeed === seedIds.has(b)) continue;
      const from = trace.passages.get(firstIsSeed ? a : b);
      const to = trace.passages.get(firstIsSeed ? b : a);
      const active = mask & types;
      const strength = from.score * countBits[active] / familyKeys.length;
      const path = { key: a < b ? `${a}-${b}` : `${b}-${a}`, from, to, types: typesIn(types), active: typesIn(active), cosine, strength };
      routes.push(path);
      if (!active) continue;
      const previous = origins.get(to.id);
      if (!previous || strength > previous.strength || (strength === previous.strength && from.rank < previous.from.rank)) {
        origins.set(to.id, path);
      }
    }

    const rows = [...seeds, ...Array.from(origins.values(), path => path.to)].map(node => {
      const bonus = (origins.get(node.id)?.strength ?? 0) * boost;
      return { node, bonus, total: node.score + bonus };
    });
    rows.sort((a, b) => b.node.score - a.node.score || a.node.id - b.node.id);
    const base = rows.slice(0, 5);
    rows.sort((a, b) => b.total - a.total || b.node.score - a.node.score || a.node.id - b.node.id);
    return {
      seeds, seedIds, routes, origins, base, boosted: rows.slice(0, 5),
      size: rows.length,
      support: trace.support.filter(node => seedIds.has(node.id) || origins.has(node.id)).length,
    };
  }

  window.SECOND_HOP_RETRIEVAL = { budgets, typesIn, familyMask, prepare, run };
})();
