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
      neighbourhoods: new Map(),
    };
  }

  function run(trace, budget, enabled, boost, excluded = new Set()) {
    const mask = familyMask(enabled);
    const hits = trace.seeds.slice(0, budget);
    const seeds = hits.filter(node => !excluded.has(node.id));
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
      hits, seeds, seedIds, routes, origins, base, boosted: rows.slice(0, 5),
      size: rows.length,
      support: trace.support.filter(node => seedIds.has(node.id) || origins.has(node.id)).length,
    };
  }

  function neighbourhood(trace, depth, enabled, result, shrunk) {
    let scope = trace.neighbourhoods.get(depth);
    if (!scope) {
      const widest = run(trace, depth, familyKeys, 0);
      scope = new Set([...widest.seedIds, ...widest.origins.keys()]);
      trace.neighbourhoods.set(depth, scope);
    }
    const ids = shrunk ? new Set([...result.seedIds, ...result.origins.keys()]) : scope;
    const pairs = [];
    const incident = new Map();
    const mask = familyMask(enabled);
    for (const [a, b, types, cosine] of trace.edges) {
      if (!ids.has(a) || !ids.has(b)) continue;
      const pair = {
        key: a + "-" + b, a: trace.passages.get(a), b: trace.passages.get(b),
        types: typesIn(types), active: typesIn(types & mask), cosine,
      };
      pairs.push(pair);
      for (const id of [a, b]) {
        if (!incident.has(id)) incident.set(id, []);
        incident.get(id).push(pair);
      }
    }
    return { ids, nodes: Array.from(ids, id => trace.passages.get(id)), pairs, incident, scope: scope.size };
  }

  window.SECOND_HOP_RETRIEVAL = { budgets, typesIn, familyMask, prepare, run, neighbourhood };
})();
