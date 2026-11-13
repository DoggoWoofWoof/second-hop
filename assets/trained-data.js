(() => {
  "use strict";

  const requests = new Map();
  const { families } = window.SECOND_HOP_LINKS;
  const examples = new Map(window.SECOND_HOP_EXAMPLES.map(item => [item.id, item]));
  const root = "assets/";

  function get(path) {
    if (!requests.has(path)) {
      requests.set(path, fetch(root + path).then(response => {
        if (!response.ok) throw new Error(path + " HTTP " + response.status);
        return response.json();
      }).catch(error => {
        requests.delete(path);
        throw error;
      }));
    }
    return requests.get(path);
  }

  function floats(wire) {
    const bytes = Uint8Array.from(atob(wire), c => c.charCodeAt(0));
    const data = new DataView(bytes.buffer);
    return Float32Array.from({ length: bytes.length / 4 }, (_, i) => data.getFloat32(4 * i, true));
  }

  function ranking(values) {
    const order = Array.from(values.keys()).sort((a, b) => values[b] - values[a] || a - b);
    const positions = new Uint32Array(values.length);
    for (const [i, row] of order.entries()) positions[row] = i + 1;
    return { order, positions, values };
  }

  function rankAfter(ranked, row, score) {
    // Compare one replaced score with the other original scores, keeping the original tie order.
    return 1 + ranked.values.reduce((count, value, i) => count + Number(i !== row && (value > score || (value === score && i < row))), 0);
  }

  function kinds(structural, mask) {
    return [structural, "N", "K"].filter((_, i) => mask & (1 << i));
  }

  async function load(info) {
    const [data, corpus] = await Promise.all([get("trained/" + info.id + ".json"), get("corpora/" + info.key + ".json")]);
    const titles = new Map(corpus.nodes);
    const seedIds = new Set(data.seeds);
    const gold = new Set(data.gold);
    const original = new Map((examples.get(data.id)?.nodes ?? []).map(node => [node.id, node.text]));
    const nodes = data.pool.map((id, row) => {
      const [dense, splade, base, denseScore, sparseScore] = data.retrieval[row];
      return {
        id, row, title: titles.get(id), text: original.get(id), supporting: gold.has(id),
        rank: base || undefined, dense, splade, denseScore, sparseScore, base,
        score: (dense ? 1 / (60 + dense) : 0) + (splade ? 1 / (60 + splade) : 0),
      };
    });
    const byId = new Map(nodes.map(node => [node.id, node]));
    const ids = new Set(data.pool);
    const incident = new Map(nodes.map(node => [node.id, []]));
    const edges = new Map();
    const weights = {};
    const pairs = data.edges.map(([a, b, mask, named, cosine, relations]) => {
      const key = a + "-" + b;
      const types = kinds(data.structural, mask);
      const edge = { key, a: byId.get(a), b: byId.get(b), active: types, types, cosine, named, relations };
      incident.get(a).push(edge);
      incident.get(b).push(edge);
      edges.set(key, edge);
      weights[key] = [named, cosine];
      return edge;
    });
    const ranks = Object.fromEntries(Object.entries(data.scores).map(([key, wire]) => [key, ranking(floats(wire))]));
    ranks.rrf = ranking(nodes.map(node => node.score));
    return {
      ...data, corpus, titles, gold, seedIds, byId, edges, weights, ranks,
      names: window.SECOND_HOP_PIPELINE[data.id]?.linkDetails ?? {},
      graph: { nodes, ids, incident, pairs },
      familyTypes: [data.structural, "N", "K"].filter(key => families[key] && pairs.some(edge => edge.types.includes(key))),
    };
  }

  function detail(data) {
    return get("trained/" + data.id + "-inspect.json").then(info => {
      if (data.detail) return data.detail;
      const readouts = Object.fromEntries(Object.entries(info.readouts).map(([key, values]) => [key, values.map(floats)]));
      const ablations = Object.fromEntries(Object.entries(info.ablations).map(([key, values]) => [key, values.map(wire => ranking(floats(wire)))]));
      return data.detail = { ...info, readouts, ablations, messages: floats(info.messages) };
    });
  }

  function passage(data, id) {
    if (data.key === "metaqa") return Promise.resolve("");
    return get("corpora/" + data.key + "/" + Math.floor(id / 512) + ".json").then(rows => rows[id % 512]);
  }

  const edgeKey = (a, b) => Math.min(a, b) + "-" + Math.max(a, b);
  const names = data => data.key === "metaqa" ? Promise.resolve({}) : get("corpora/" + data.key + "-names.json");
  window.SECOND_HOP_TRAINED_DATA = { index: () => get("trained/index.json"), load, detail, passage, names, rankAfter, kinds, edgeKey };
})();
