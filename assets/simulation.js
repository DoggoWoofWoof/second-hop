(() => {
  "use strict";

  const PROJECTION = 128;
  const ROUNDS = 50;
  const families = ["S", "R", "N", "K"];
  const featureNames = ["Fused score", "Question cosine", "PPR mass", "Seed proximity", "Pool log-degree", "Seed cosine", "Next-hop score"];
  const byRank = (a, b) => (a.rank || Infinity) - (b.rank || Infinity) || a.id - b.id;
  const gelu = x => .5 * x * (1 + Math.tanh(.79788456 * (x + .044715 * x ** 3)));

  function decode(raw, size) {
    const values = atob(raw);
    if (values.length !== size * PROJECTION) throw new Error("Projection length mismatch");
    const vectors = new Float32Array(values.length);
    for (let start = 0; start < values.length; start += PROJECTION) {
      let sum = 0;
      for (let i = start; i < start + PROJECTION; i++) {
        const byte = values.charCodeAt(i);
        const signed = byte > 127 ? byte - 256 : byte;
        vectors[i] = signed;
        sum += signed * signed;
      }
      const norm = Math.sqrt(sum) || 1;
      for (let i = start; i < start + PROJECTION; i++) vectors[i] /= norm;
    }
    return vectors;
  }

  function signals(data) {
    const index = new Map(data.ids.map((id, i) => [id, i]));
    const projected = decode(data.projection, data.ids.length);
    return {
      cosine: id => data.cosines[index.get(id)],
      projection: id => {
        const offset = index.get(id);
        return offset === undefined ? null : projected.subarray(offset * PROJECTION, (offset + 1) * PROJECTION);
      },
      query: decode(data.query, 1),
      weights: data.weights,
    };
  }

  function topology(graph, data) {
    const nodes = graph.nodes;
    const index = new Map(nodes.map((node, i) => [node.id, i]));
    const adjacent = nodes.map(() => []);
    const degree = new Float64Array(nodes.length);
    for (const edge of graph.pairs) {
      if (!edge.active.length) continue;
      const [entity, semantic] = data.weights[edge.key] ?? [0, edge.cosine ?? 0];
      const parts = Object.fromEntries(edge.active.map(type => [type, type === "N" ? entity : type === "K" ? Math.max(0, semantic) : 1]));
      const weight = Object.values(parts).reduce((sum, value) => sum + value, 0);
      const a = index.get(edge.a.id), b = index.get(edge.b.id);
      adjacent[a].push({ i: b, edge, weight, parts });
      adjacent[b].push({ i: a, edge, weight, parts });
      degree[a] += weight;
      degree[b] += weight;
    }
    return { nodes, index, adjacent, degree };
  }

  function restartFor(network, seedIds, source, kind) {
    const seedIndices = seedIds.map(id => network.index.get(id)).filter(i => i !== undefined);
    const r = new Float64Array(network.nodes.length);
    if (!seedIndices.length) return r;
    if (kind === "single") {
      r[network.index.get(source) ?? seedIndices[0]] = 1;
      return r;
    }
    const ranked = network.nodes.map(node => node.score).reduce((sum, score) => sum + score, 0);
    const split = kind === "mixed" && ranked > 0 ? .5 : 1;
    for (const i of seedIndices) r[i] += split / seedIndices.length;
    if (split < 1) network.nodes.forEach((node, i) => { r[i] += (1 - split) * node.score / ranked; });
    return r;
  }

  function ppr(network, seedIds, source, kind, restart) {
    const r = restartFor(network, seedIds, source, kind);
    const frames = [r];
    const deltas = [0];
    let prev = r;
    for (let step = 1; step <= ROUNDS; step++) {
      const next = r.map(value => restart * value);
      for (let i = 0; i < prev.length; i++) {
        if (!prev[i]) continue;
        const share = (1 - restart) * prev[i];
        const total = network.degree[i];
        if (!total) next[i] += share;
        else for (const arc of network.adjacent[i]) next[arc.i] += share * arc.weight / total;
      }
      let delta = 0;
      for (let i = 0; i < next.length; i++) delta += Math.abs(next[i] - prev[i]);
      frames.push(next);
      deltas.push(delta);
      prev = next;
    }
    return { network, r, frames, deltas, restart };
  }

  function stepAt(walk, round, id) {
    const i = walk.network.index.get(id);
    if (i === undefined) return null;
    const now = walk.frames[round];
    if (!round) return { total: now[i], reset: now[i], held: 0, incoming: [] };
    const before = walk.frames[round - 1];
    const factor = 1 - walk.restart;
    const incoming = walk.network.adjacent[i].flatMap(arc => {
      const outgoing = walk.network.degree[arc.i];
      const portion = outgoing ? arc.weight / outgoing : 0;
      const amount = factor * before[arc.i] * portion;
      return amount > 0 ? [{ node: walk.network.nodes[arc.i], edge: arc.edge, amount, before: before[arc.i], weight: arc.weight, outgoing }] : [];
    }).sort((a, b) => b.amount - a.amount || byRank(a.node, b.node));
    return {
      total: now[i], reset: walk.restart * walk.r[i],
      held: walk.network.degree[i] ? 0 : factor * before[i], incoming,
    };
  }

  function walkRanking(walk, round) {
    const values = walk.frames[round];
    return walk.network.nodes.map((node, i) => ({ node, mass: values[i] }))
      .filter(row => row.mass > 0)
      .sort((a, b) => b.mass - a.mass || byRank(a.node, b.node));
  }

  function walkPool(walk, seedIds, limit, data) {
    const seedSet = new Set(seedIds);
    const semantic = [...walk.network.nodes].filter(node => !seedSet.has(node.id))
      .sort((a, b) => (data.cosine(b.id) ?? 0) - (data.cosine(a.id) ?? 0) || byRank(a, b));
    const denseRanks = new Map(semantic.map((node, i) => [node.id, i + 1]));
    const candidates = walkRanking(walk, ROUNDS).filter(row => !seedSet.has(row.node.id)).map((row, i) => {
      const denseRank = denseRanks.get(row.node.id);
      return { ...row, walkRank: i + 1, denseRank, score: 1 / (61 + i) + 1 / (60 + denseRank) };
    }).sort((a, b) => b.score - a.score || a.walkRank - b.walkRank || byRank(a.node, b.node));
    const rows = candidates.slice(0, limit);
    return { ids: new Set([...seedIds, ...rows.map(row => row.node.id)]), rows, candidates };
  }

  function seedDistances(net, ids) {
    const distance = new Int16Array(net.nodes.length).fill(-1);
    const parent = new Int32Array(net.nodes.length).fill(-1);
    const queue = [];
    for (const id of ids) {
      const i = net.index.get(id);
      if (i === undefined || distance[i] !== -1) continue;
      distance[i] = 0;
      queue.push(i);
    }
    for (let front = 0; front < queue.length; front++) {
      const i = queue[front];
      for (const arc of net.adjacent[i]) {
        if (distance[arc.i] !== -1) continue;
        distance[arc.i] = distance[i] + 1;
        parent[arc.i] = i;
        queue.push(arc.i);
      }
    }
    return { distance, parent };
  }

  function seedWalks(net, ids, structural = false) {
    let mass = new Float64Array(net.nodes.length);
    for (const id of ids) if (net.index.has(id)) mass[net.index.get(id)] = 1;
    return [1, 2, 3].map(() => {
      const step = new Float64Array(net.nodes.length);
      for (let i = 0; i < net.nodes.length; i++) {
        if (!mass[i]) continue;
        for (const arc of net.adjacent[i]) {
          if (!structural || arc.parts.S || arc.parts.R) step[arc.i] += mass[i];
        }
      }
      mass = step;
      return step;
    });
  }

  function dot(a, b) {
    if (!a || !b) return 0;
    let sum = 0;
    for (let i = 0; i < PROJECTION; i++) sum += a[i] * b[i];
    return sum;
  }

  function seedPrototype(ids, data) {
    const mean = new Float32Array(PROJECTION);
    for (const id of ids) {
      const vector = data.projection(id);
      if (vector) for (let i = 0; i < PROJECTION; i++) mean[i] += vector[i];
    }
    const norm = Math.sqrt(dot(mean, mean));
    return norm ? mean.map(value => value / norm) : null;
  }

  function anchorScores(net, seeds, data) {
    const out = net.nodes.map(() => []);
    const anchors = seeds.slice(0, 5);
    const anchorSet = new Set(anchors);
    for (const id of anchors) {
      const i = net.index.get(id);
      if (i === undefined) continue;
      const connected = net.adjacent[i].filter(arc => !anchorSet.has(net.nodes[arc.i].id));
      const logits = connected.map(arc => 2.4 * (data.cosine(net.nodes[arc.i].id) ?? 0)
        + .8 * (arc.parts.K ?? 0) + .55 * arc.edge.active.length / families.length);
      const logSum = Math.log(logits.reduce((sum, score) => sum + Math.exp(score), 0));
      connected.forEach((arc, j) => out[arc.i].push({
        anchor: net.nodes[i], edge: arc.edge, logit: logits[j], neighbours: connected.length,
        score: Math.max(-8, Math.min(8, logits[j] - logSum + Math.log(connected.length))),
      }));
    }
    return out;
  }

  function compile(pool, wide, seedIds, walk, data) {
    const net = topology(pool, data);
    const distance = seedDistances(net, seedIds);
    const paths = seedWalks(net, seedIds);
    const structuralPaths = seedWalks(net, seedIds, true);
    const proto = seedPrototype(seedIds, data);
    const hops = anchorScores(net, seedIds, data);
    const final = walk.frames[ROUNDS];
    const walkRanks = new Map(walkRanking(walk, ROUNDS).map((row, i) => [row.node.id, i + 1]));
    const rows = net.nodes.map((node, i) => {
      const hop = distance.distance[i];
      const mass = final[walk.network.index.get(node.id)] ?? 0;
      const cosine = data.cosine(node.id);
      const projected = data.projection(node.id);
      const nextHop = hops[i].length ? Math.max(...hops[i].map(entry => entry.score)) : -8;
      const raw = [node.score, cosine ?? 0, mass, hop < 0 ? 0 : 1 / (1 + hop),
        Math.log1p(net.adjacent[i].length), dot(projected, proto), nextHop];
      const flags = [1, Number(cosine !== undefined), 1, Number(hop >= 0), 1, Number(Boolean(proto && projected)), Number(hops[i].length > 0)];
      return {
        node, raw, flags, hop, mass, walkRank: walkRanks.get(node.id),
        poolDegree: net.adjacent[i].length, scopeDegree: wide.adjacent[wide.index.get(node.id)]?.length ?? 0,
        paths: paths.map(values => values[i]), structuralPaths: structuralPaths.map(values => values[i]),
        anchorScores: hops[i], projected,
      };
    });
    const mean = featureNames.map((_, i) => rows.reduce((sum, row) => sum + row.raw[i], 0) / Math.max(1, rows.length));
    const sigma = mean.map((average, i) => Math.sqrt(rows.reduce((sum, row) => sum + (row.raw[i] - average) ** 2, 0) / Math.max(1, rows.length)));
    for (const row of rows) row.z = row.raw.map((value, i) => sigma[i] ? (value - mean[i]) / sigma[i] : 0);
    return { net, rows, mean, sigma, distance, proto, seedIds, data };
  }

  function routeTo(features, id) {
    const { net, distance } = features;
    const route = [];
    let i = net.index.get(id);
    while (i !== undefined && distance.parent[i] >= 0) {
      const from = distance.parent[i];
      const arc = net.adjacent[from].find(edge => edge.i === i);
      if (arc) route.unshift({ from: net.nodes[from].id, to: net.nodes[i].id, edge: arc.edge, amount: 1 });
      i = from;
    }
    return route;
  }

  function ringsAt(features, id) {
    const { net, seedIds, data } = features;
    const { distance } = seedDistances(net, [id]);
    const seeds = new Set(seedIds);
    const rings = [1, 2, 3].map(hops => ({ hops, count: 0, seeds: 0, seedScore: 0, totalCosine: 0, maxCosine: -Infinity }));
    let component = 0;
    net.nodes.forEach((node, i) => {
      const depth = distance[i];
      if (depth >= 0) component++;
      if (depth < 1 || depth > 3) return;
      const ring = rings[depth - 1];
      const cosine = data.cosine(node.id) ?? 0;
      ring.count++;
      ring.totalCosine += cosine;
      ring.maxCosine = Math.max(ring.maxCosine, cosine);
      if (seeds.has(node.id)) {
        ring.seeds++;
        ring.seedScore += node.score;
      }
    });
    return { component, rings };
  }

  function hiddenOne(row) {
    const z = row.z.map(value => Math.max(-3, Math.min(3, value)));
    const [rrf, cosine, mass, proximity, degree, seed, hop] = z;
    const [, rawCosine, , rawProximity, , rawSeed] = row.raw;
    return [
      gelu(.67 * rrf + .72 * cosine + .35 * rawCosine),
      gelu(.76 * mass + .38 * proximity + .31 * rawProximity),
      gelu(.42 * degree + .35 * proximity + .26 * row.flags[3]),
      gelu(.67 * seed + .3 * rawSeed + .18 * cosine),
      gelu(.56 * hop + .25 * cosine + .33 * row.flags[6]),
      gelu(.36 * rrf + .22 * seed + .39 * mass),
    ];
  }

  function hiddenTwo(h) {
    return [
      gelu(.75 * h[0] + .45 * h[3] + .21 * h[4]),
      gelu(.7 * h[1] + .33 * h[2] + .38 * h[5]),
      gelu(.56 * h[2] + .5 * h[4] + .17 * h[0]),
      gelu(.38 * h[3] + .53 * h[5] + .18 * h[1]),
    ];
  }

  function readout(h) {
    return .41 * h[0] + .29 * h[1] + .16 * h[2] + .14 * h[3];
  }

  function models(features) {
    const h1 = features.rows.map(hiddenOne);
    const h2 = h1.map(hiddenTwo);
    const layers = [h2];
    for (let layer = 0; layer < 3; layer++) {
      const before = layers[layer];
      layers.push(before.map((row, i) => {
        const weights = features.net.degree[i];
        if (!weights) return row.slice();
        const mean = [0, 0, 0, 0];
        for (const arc of features.net.adjacent[i]) {
          for (let k = 0; k < mean.length; k++) mean[k] += before[arc.i][k] * arc.weight / weights;
        }
        return row.map((value, k) => value + gelu(.54 * mean[k] - .22 * value));
      }));
    }
    return {
      h1, h2, layers, mlp: h2.map(readout),
      gnn: layers[3].map((state, i) => .81 * readout(state) + .19 * readout(h2[i])),
    };
  }

  window.SECOND_HOP_SIMULATION = {
    ROUNDS, featureNames, signals, topology, ppr, stepAt, walkRanking, walkPool, compile, routeTo, ringsAt, models, dot,
  };
})();
