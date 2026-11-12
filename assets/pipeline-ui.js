(() => {
  "use strict";

  const sim = window.SECOND_HOP_SIMULATION;
  const { ROUNDS, featureNames } = sim;
  const { families } = window.SECOND_HOP_LINKS;
  const id = name => document.getElementById(name);
  const all = selector => [...document.querySelectorAll(selector)];
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format;
  const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 3 }).format;
  const decimal = value => Number.isFinite(value) ? value.toFixed(4) : "—";
  const rank = value => value ? "#" + number(value) : "—";
  const reciprocal = value => value ? 1 / (60 + value) : 0;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const blocks = [
    ["Rank", 5, "Word and dense reciprocal ranks, fused score, agreement and seed flag."],
    ["Dense cosine", 1, "Dot product between the normalized question and passage embeddings."],
    ["Topology", 11, "Seed distance, reachability, degree, two-step walks and connected components."],
    ["Depth", 18, "Seed support, walk counts and cosine summaries in distance rings."],
    ["SEMB", 64, "Elementwise interaction between learned projections of question and passage."],
    ["SEED", 3, "Projected cosine to the seed mean, the best seed and the best rank-one seed."],
    ["WALK", 16, "One- to three-step seed walks over structural links in each direction."],
    ["DISTS", 14, "Seed counts, mass, cosine and branching at exact distances."],
    ["WALKF", 18, "Walk counts across link families, including name and semantic one-hop counts."],
    ["KT", 8, "Six walk ranks, scaled by log rank, with two flags."],
    ["Next hop", 7, "Five anchor scores, their maximum and the number of anchors that reach this passage."],
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, action, className = "ghost-button") {
    const node = el("button", className, text);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }

  function optionState(elements, property, value) {
    for (const item of elements) item.setAttribute("aria-pressed", String(item.dataset[property] === value));
  }

  function listRow(node, detail, action, prefix = "") {
    const row = el("li");
    const control = button("", action, "passage-row");
    const copy = el("span");
    copy.append(el("strong", "", prefix + node.title), el("small", "", detail));
    control.append(copy);
    row.append(control);
    return row;
  }

  function metrics(rows) {
    const group = el("dl", "run-metrics");
    for (const [label, value, note] of rows) {
      const entry = el("div");
      entry.append(el("dt", "", label), el("dd", "", value));
      if (note) entry.append(el("small", "", note));
      group.append(entry);
    }
    return group;
  }

  function bars(rows, max = 1) {
    const container = el("div", "feature-bars");
    for (const [label, value, text] of rows) {
      const item = el("div", "feature-bar");
      const meter = el("i");
      meter.setAttribute("aria-hidden", "true");
      meter.style.setProperty("--amount", Math.min(1, Math.abs(value) / (max || 1)) * 100 + "%");
      if (value < 0) meter.style.setProperty("--bar", "#ed9ebd");
      item.append(el("strong", "", label), el("output", "", text ?? decimal(value)), meter);
      container.append(item);
    }
    return container;
  }

  function details(title, ...contents) {
    const panel = el("details", "run-details");
    panel.append(el("summary", "", title), ...contents);
    return panel;
  }

  function normalize(nodes, values, shift = false) {
    let low = 0, high = 0;
    if (shift && values.length) low = values.reduce((min, v) => Math.min(min, v), values[0]);
    for (const value of values) high = Math.max(high, value - low);
    return new Map(nodes.map((node, i) => [node.id, high ? Math.max(0, (values[i] - low) / high) : 0]));
  }

  function runUI({ scene, rebuild, togglePool, readPassage, save }) {
    const loaded = new Map();
    const pending = new Map();
    const errors = new Set();
    const methodButtons = all("[data-pool-method]");
    const searchButtons = all("[data-search-signal]");
    const featureButtons = all("[data-feature]");
    const modelButtons = all("[data-model]");
    const rankButtons = all("[data-rank]");
    const restart = id("ppr-restart");
    const restartKind = id("ppr-kind");
    const seedSelect = id("ppr-seed");
    const pprSlider = id("ppr-round");
    const saved = new URLSearchParams(location.search);
    if (["single", "uniform", "mixed"].includes(saved.get("restartMode"))) restartKind.value = saved.get("restartMode");
    if (saved.has("restart") && Number(saved.get("restart")) >= .1 && Number(saved.get("restart")) <= .9) restart.value = saved.get("restart");
    if (["25", "50", "100", "200"].includes(saved.get("limit"))) id("pool-limit").value = saved.get("limit");
    const savedSource = saved.has("restartSeed") ? Number(saved.get("restartSeed")) : undefined;
    let context, view, source, probe;
    let stage = "inspect";
    let method = saved.get("poolRule") === "walk" ? "walk" : "direct";
    let chosenMethod = saved.has("poolRule");
    let category = "search";
    let searchSignal = "score";
    let model = "mlp";
    let ranking = "mlp";
    let round = 0;
    let layer = 0;
    let hop = 0;
    let timer = 0;
    let playing = "";
    let net, walk, plan, compiled, simulated, compiledKey;

    function stop() {
      clearTimeout(timer);
      timer = 0;
      playing = "";
    }

    function configure(next) {
      const changed = context?.key !== next.key;
      const newQuestion = context?.sample.id !== next.sample.id;
      const first = !context;
      context = next;
      if (changed) {
        stop();
        net = walk = plan = compiled = simulated = compiledKey = undefined;
      }
      if (newQuestion) {
        source = first ? savedSource : undefined;
        probe = undefined;
        round = layer = hop = 0;
      }
      const seeds = [...next.result.seedIds];
      if (!seeds.includes(source)) source = seeds[0];
      if (!next.wide.ids.has(probe)) probe = source ?? next.wide.nodes[0]?.id;
      setOptions(seedSelect, next.result.seeds, source, true);
    }

    function setOptions(select, nodes, selected, showRank = false) {
      const signature = nodes.map(node => node.id).join(",");
      if (select.dataset.options !== signature) {
        select.replaceChildren(...nodes.map(node => new Option((showRank ? rank(node.rank) + " · " : "") + node.title, node.id)));
        select.dataset.options = signature;
      }
      select.disabled = !nodes.length;
      select.value = String(selected ?? "");
    }

    function requestSignals() {
      const slug = context.sample.id;
      if (loaded.has(slug) || pending.has(slug) || errors.has(slug)) return;
      const job = fetch("assets/signals/" + slug + ".json").then(response => {
        if (!response.ok) throw new Error("Signals HTTP " + response.status);
        return response.json();
      }).then(payload => {
        loaded.set(slug, sim.signals(payload));
        if (context?.sample.id === slug) {
          net = walk = plan = compiled = simulated = compiledKey = undefined;
          rebuild();
        }
      }).catch(error => {
        errors.add(slug);
        if (context?.sample.id === slug) render();
        console.error(error);
      }).finally(() => pending.delete(slug));
      pending.set(slug, job);
    }

    function getWalk() {
      const data = loaded.get(context.sample.id);
      if (!data) return null;
      net ??= sim.topology(context.wide, data);
      walk ??= sim.ppr(net, [...context.result.seedIds], source, restartKind.value, Number(restart.value));
      return walk;
    }

    function getPlan() {
      const data = loaded.get(context.sample.id);
      if (method === "walk" && data) {
        plan ??= sim.walkPool(getWalk(), [...context.result.seedIds], Number(id("pool-limit").value), data);
        return plan;
      }
      return { ids: new Set([...context.result.seedIds, ...context.result.origins.keys()]), rows: [] };
    }

    function inputs() {
      if (!view?.pool || !getWalk()) return null;
      const key = view.pool.nodes.map(node => node.id).join(",");
      if (!compiled || compiledKey !== key) {
        compiled = sim.compile(view.pool, net, [...context.result.seedIds], walk, loaded.get(context.sample.id));
        compiledKey = key;
        simulated = undefined;
      }
      return compiled;
    }

    function pick(nodes, fallback) {
      if (!nodes.some(node => node.id === probe)) probe = fallback ?? nodes[0]?.id;
      return probe;
    }

    function overlay(label, nodes, values, paths = [], shift = false) {
      const badge = id("graph-run-readout");
      badge.hidden = !label;
      badge.textContent = label ?? "";
      scene.setSignal(label ? { values: normalize(nodes, values, shift), focus: probe, paths } : null);
    }

    function inspect(idValue, locate = false) {
      probe = idValue;
      if (locate) scene.locate(idValue);
      render();
    }

    function probeFromGraph(value) {
      if (!["lab", "ppr", "pool", "features", "models", "rankers"].includes(stage)) return false;
      inspect(value);
      return true;
    }

    function animate(kind, next, interval) {
      stop();
      playing = kind;
      if (matchMedia("(max-width: 860px)").matches) {
        id("scene-field").scrollIntoView({ block: "center", behavior: motion.matches ? "auto" : "smooth" });
      }
      const advance = () => {
        if (playing !== kind) return;
        const more = next();
        if (!more) stop();
        render();
        if (more) timer = window.setTimeout(advance, motion.matches ? 1050 : interval());
      };
      advance();
    }

    function strongestTransfers(active, info) {
      if (!round) return [];
      const before = active.frames[round - 1];
      const { nodes, degree, adjacent } = active.network;
      const sources = nodes.map((_, i) => i).filter(i => before[i] > 0).sort((a, b) => before[b] - before[a]).slice(0, 12);
      const candidates = sources.flatMap(i => degree[i] ? adjacent[i].map(arc => ({
        from: nodes[i].id, to: nodes[arc.i].id, edge: arc.edge,
        amount: (1 - active.restart) * before[i] * arc.weight / degree[i],
      })) : []).sort((a, b) => b.amount - a.amount);
      const incoming = info?.incoming.slice(0, 5).map(entry => ({ from: entry.node.id, to: probe, edge: entry.edge, amount: entry.amount })) ?? [];
      const selected = new Map();
      for (const transfer of [...incoming, ...candidates.slice(0, 16)]) {
        if (!selected.has(transfer.edge.key)) selected.set(transfer.edge.key, transfer);
      }
      return [...selected.values()];
    }

    function seedView() {
      const nodes = view.graph.nodes;
      const chosen = pick(nodes, nodes.find(node => node.id === source)?.id);
      const node = context.trace.passages.get(chosen);
      optionState(searchButtons, "searchSignal", searchSignal);
      const label = { words: "Words", meaning: "Meaning", score: "Fused search" }[searchSignal];
      const values = nodes.map(node => searchSignal === "score" ? node.score : reciprocal(node[searchSignal]));
      const target = id("seed-fusion");
      if (!node) target.replaceChildren();
      else target.replaceChildren(el("h3", "model-head", node.title),
        bars([["Words " + rank(node.words), reciprocal(node.words)], ["Meaning " + rank(node.meaning), reciprocal(node.meaning)],
          ["Fused score", node.score]], .033),
        el("p", "run-note", "Fused score adds 1 / (60 + rank) from each list. A missing rank contributes zero."),
        button("Read passage", () => readPassage(node.id)));
      overlay("Seeds · " + label, nodes, values);
    }

    function renderPpr() {
      const active = getWalk();
      const { network, frames, deltas } = active;
      const rows = sim.walkRanking(active, round);
      const hasSeed = Boolean(context.result.seeds.length);
      pick(network.nodes, source);
      const mass = frames[round].reduce((sum, value) => sum + value, 0);
      seedSelect.disabled = !hasSeed || restartKind.value !== "single";
      id("ppr-seed-label").hidden = restartKind.value !== "single";
      id("ppr-restart-value").textContent = pct(active.restart);
      id("ppr-round-value").textContent = round + " / " + ROUNDS;
      pprSlider.value = String(round);
      pprSlider.disabled = !hasSeed;
      for (const name of ["ppr-play", "ppr-step", "ppr-end"]) id(name).disabled = !hasSeed || (name === "ppr-step" && round === ROUNDS);
      id("ppr-play").textContent = playing === "ppr" ? "Pause rounds" : round === ROUNDS ? "Replay rounds" : "Play rounds";
      id("ppr-equation").textContent = round ? "xₜ₊₁ = " + active.restart.toFixed(2) + " r + " + (1 - active.restart).toFixed(2) + " T xₜ"
        : "x₀ = r  ·  start at the restart distribution";
      id("ppr-status").textContent = hasSeed ? pct(mass) + " total mass · " + number(rows.length) + (rows.length === 1 ? " passage reached" : " passages reached") +
        (round ? " · Δ " + deltas[round].toExponential(1) : "") : "Select an active seed in the Seeds step.";
      id("ppr-top").replaceChildren(...rows.slice(0, 3).map((row, i) => listRow(row.node, pct(row.mass) + " of total mass", () => inspect(row.node.id, true), (i + 1) + ". ")));
      const info = sim.stepAt(active, round, probe);
      const node = context.trace.passages.get(probe);
      id("ppr-probe-title").textContent = node ? "Mass at " + node.title : "Mass at a passage";
      if (info) {
        const shown = info.incoming.slice(0, 3);
        const remaining = info.incoming.slice(3).reduce((sum, entry) => sum + entry.amount, 0);
        const parts = [[round ? "Restart share" : "Initial mass", pct(info.reset)]];
        if (info.held) parts.push(["Held on isolated passage", pct(info.held)]);
        parts.push(...shown.map(entry => ["From " + entry.node.title, pct(entry.amount),
          pct(entry.before) + " × " + pct(1 - active.restart) + " × (" + decimal(entry.weight) + " / " + decimal(entry.outgoing) + ")"]));
        if (remaining) parts.push(["Other incoming links", pct(remaining)]);
        parts.push(["Total at this round", pct(info.total)]);
        id("ppr-probe").replaceChildren(metrics(parts), button("Read passage", () => readPassage(probe)));
      } else id("ppr-probe").replaceChildren();
      overlay("PPR · Round " + round + " · Brightness shows mass", network.nodes, frames[round], strongestTransfers(active, info));
    }

    function renderPool() {
      const shortlist = getPlan();
      optionState(methodButtons, "poolMethod", method);
      id("pool-limit-label").hidden = method !== "walk";
      id("pool-rule").textContent = method === "direct"
        ? "Keep the active seeds and every passage one enabled link away."
        : "Keep the seeds. Fuse the final PPR rank and question cosine rank of reached passages, then take the first candidates.";
      const supports = context.trace.support.filter(node => shortlist.ids.has(node.id)).length;
      id("pool-plan-count").textContent = number(context.wide.nodes.length) + " → " + number(shortlist.ids.size) + " passages";
      id("pool-apply").textContent = view.shrunk ? "Restore cluster ↗" : "Animate shrink ↘";
      const passage = context.trace.passages.get(probe);
      let reason = "Click a passage on the graph to see whether it is kept.";
      if (passage) {
        if (context.result.seedIds.has(passage.id)) reason = passage.title + " is an active seed and stays in the pool.";
        else if (method === "direct") {
          const witness = context.result.origins.get(passage.id);
          reason = witness ? passage.title + " enters via " + witness.from.title + " (" + witness.active.map(type => families[type].label).join(", ") + ")."
            : passage.title + " has no enabled direct link from an active seed.";
        } else {
          const place = shortlist.candidates.findIndex(row => row.node.id === passage.id);
          const row = shortlist.candidates[place];
          reason = row ? passage.title + " · combined rank " + rank(place + 1) + " · " + (shortlist.ids.has(passage.id) ? "kept" : "below the cutoff")
            + ". 1 / (60 + " + row.walkRank + ") + 1 / (60 + " + row.denseRank + ") = " + decimal(row.score) + "."
            : passage.title + " received no PPR mass in this walk.";
        }
      }
      id("pool-probe").textContent = reason;
      const rows = method === "walk" ? shortlist.rows.slice(0, 4).map(row => listRow(row.node,
        "Walk " + rank(row.walkRank) + " + cosine " + rank(row.denseRank) + " · fused " + decimal(row.score), () => inspect(row.node.id, true)))
        : [...context.result.origins.values()].sort((a, b) => Number(b.to.supporting) - Number(a.to.supporting) || a.from.rank - b.from.rank)
          .slice(0, 4).map(route => listRow(route.to, "Via " + route.from.title, () => inspect(route.to.id, true)));
      id("pool-preview").replaceChildren(...rows);
      const visible = view.graph.nodes;
      overlay((view.shrunk ? "Shortlist" : "Preview of passages kept") + " · " + supports + "/" + context.trace.support.length + " supporting",
        visible, visible.map(node => Number(shortlist.ids.has(node.id))));
    }

    function vectorTable(row) {
      const table = el("div", "run-vector");
      const header = el("div");
      for (const text of ["Signal", "Raw", "z", "Flag"]) header.append(el("span", "", text));
      table.append(header);
      row.raw.forEach((value, i) => {
        const entry = el("div");
        for (const text of [featureNames[i], decimal(value), row.z[i].toFixed(2), String(row.flags[i])]) entry.append(el("span", "", text));
        table.append(entry);
      });
      return table;
    }

    function featureView() {
      const input = inputs();
      const target = id("feature-content");
      const rows = input.rows;
      const picked = pick(input.net.nodes, source !== undefined && input.net.index.has(source) ? source : undefined);
      setOptions(id("feature-probe"), input.net.nodes, picked);
      id("feature-read").disabled = picked === undefined;
      optionState(featureButtons, "feature", category);
      const row = rows[input.net.index.get(picked)];
      if (!row) {
        target.replaceChildren(el("p", "run-note", "Select at least one seed to build the shortlist."));
        id("feature-vector").replaceChildren();
        overlay(null);
        return;
      }
      const { node, raw } = row;
      let values, paths = [], label, content;
      if (category === "search") {
        const projected = sim.dot(row.projected, input.data.query);
        const strongest = input.seedIds.map(seed => sim.dot(row.projected, input.data.projection(seed)));
        const rankOne = input.seedIds.filter(seed => {
          const hit = context.trace.passages.get(seed);
          return hit.words === 1 || hit.meaning === 1;
        }).map(seed => sim.dot(row.projected, input.data.projection(seed)));
        const products = [0, 1, 2, 3].map(i => ["Coordinate " + (i + 1), row.projected[i] * input.data.query[i]]);
        label = "Search inputs · Question cosine";
        values = rows.map(entry => entry.raw[1]);
        content = [
          metrics([["Word rank", rank(node.words)], ["Dense rank", rank(node.meaning)], ["Fused score", decimal(node.score)],
            ["In both search lists", node.words && node.meaning ? "Yes" : "No"], ["Active seed", context.result.seedIds.has(node.id) ? "Yes" : "No"]]),
          bars([["Question · passage (1,536-d)", raw[1]], ["Question · passage (128-d projection)", projected],
            ["Cosine to seed mean", raw[5]], ["Closest active seed", strongest.length ? Math.max(...strongest) : 0],
            ["Best rank-one seed", rankOne.length ? Math.max(...rankOne) : 0, rankOne.length ? decimal(Math.max(...rankOne)) : "—"]]),
          el("p", "run-note", "Cosine is a dot product of normalized vectors. The 128-d projections are quantized for the browser."),
          details("See an embedding interaction", el("p", "run-note", "Here are the first four coordinate products. Their sum over all 128 coordinates is the projected cosine. The research SEMB block learns separate projections."),
            bars(products, Math.max(.01, ...products.map(row => Math.abs(row[1]))))),
        ];
      } else if (category === "structure") {
        const info = sim.ringsAt(input, node.id);
        const directSeeds = input.net.adjacent[input.net.index.get(node.id)].filter(arc => context.result.seedIds.has(input.net.nodes[arc.i].id));
        const ring = hop || 3;
        label = hop ? "Seed reach · Hop " + hop + " of 3" : "Structure · Distance from active seeds";
        values = rows.map(entry => entry.hop >= 0 && entry.hop <= ring ? 1 / (1 + entry.hop) : 0);
        paths = sim.routeTo(input, node.id).filter((_, index) => index < ring);
        if (hop) {
          for (let i = 0; i < input.net.nodes.length && paths.length < 18; i++) {
            const from = input.distance.parent[i];
            if (input.distance.distance[i] !== hop || from < 0) continue;
            const arc = input.net.adjacent[from].find(item => item.i === i);
            if (arc) paths.push({ from: input.net.nodes[from].id, to: input.net.nodes[i].id, edge: arc.edge, amount: 1 });
          }
        }
        content = [
          metrics([["Nearest seed", row.hop < 0 ? "Unreached" : row.hop + (row.hop === 1 ? " hop" : " hops")],
            ["Pool degree", number(row.poolDegree)], ["Neighbourhood degree", number(row.scopeDegree)],
            ...row.paths.map((count, i) => ["Seed walks of length " + (i + 1), number(count)])]),
          button(playing === "hops" ? "Pause hops" : "Play 1–3 hops", () => {
            if (playing === "hops") { stop(); render(); return; }
            hop = 0;
            animate("hops", () => { hop++; return hop < 3; }, () => 780);
          }),
          details("Distance rings and link families", metrics([
            ["Connected component", number(info.component) + " passages"],
            ...info.rings.map(item => ["At " + item.hops + " hop" + (item.hops === 1 ? "" : "s"), number(item.count) + " passages",
              item.seeds + " seeds · fused sum " + decimal(item.seedScore) + " · mean/max cosine " +
              decimal(item.count ? item.totalCosine / item.count : NaN) + " / " + decimal(item.maxCosine)]),
            ["Structural walks (1 / 2 / 3)", row.structuralPaths.map(number).join(" / ")],
            ["One-hop shared names", number(directSeeds.filter(arc => arc.parts.N).length)],
            ["One-hop semantic links", number(directSeeds.filter(arc => arc.parts.K).length)],
          ])),
        ];
      } else if (category === "walks") {
        label = "Walk inputs · PPR after " + ROUNDS + " rounds";
        values = rows.map(entry => entry.mass);
        content = [
          metrics([["Final PPR mass", pct(row.mass)], ["Walk rank", rank(row.walkRank)],
            ["Log-scaled rank", row.walkRank ? decimal(Math.log1p(row.walkRank) / Math.log1p(7000)) : "1.0000 (absent)"],
            ["Restart probability", pct(Number(restart.value))]]),
          el("p", "run-note", "This browser vector carries the final PPR mass. The research KT block reads ranks from multiple walk orders."),
        ];
      } else {
        label = "Next-hop input · Anchors sending scores";
        values = rows.map(entry => Math.max(0, entry.raw[6] + 8) * entry.flags[6]);
        paths = row.anchorScores.map(entry => ({ from: entry.anchor.id, to: node.id, edge: entry.edge, amount: entry.score }));
        content = [
          metrics([["Anchors reaching this passage", number(row.anchorScores.length)],
            ["Best demo anchor score", row.anchorScores.length ? decimal(raw[6]) : "−8 (absent)"],
            ...row.anchorScores.map(entry => [entry.anchor.title, decimal(entry.score), "logit " + decimal(entry.logit) + " · " + entry.neighbours + " neighbours"])]),
          el("p", "run-note", "The demo scores up to five seed anchors, then applies log-softmax + log(neighbour count) within each anchor’s neighbours."),
        ];
      }
      target.replaceChildren(...content);
      id("feature-vector").replaceChildren(vectorTable(row), el("p", "run-note", "z = (raw − pool mean) / pool standard deviation. The browser uses the current shortlist for these statistics."));
      overlay(label, input.net.nodes, values, paths);
    }

    function layers() {
      return model === "gnn" ? ["Input", "GELU 6", "GELU 4", "Round 1", "Round 2", "Round 3", "Score"]
        : ["Input", "GELU 6", "GELU 4", "Score"];
    }

    function modelView() {
      const input = inputs();
      const target = id("model-content");
      const picked = pick(input.net.nodes, source !== undefined && input.net.index.has(source) ? source : undefined);
      setOptions(id("model-probe"), input.net.nodes, picked);
      optionState(modelButtons, "model", model);
      const i = input.net.index.get(picked);
      const steps = layers();
      const final = steps.length - 1;
      for (const name of ["model-play", "model-step", "model-reset"]) id(name).disabled = i === undefined || (name === "model-step" && layer === final);
      id("model-play").textContent = playing === "model" ? "Pause model" : layer === final ? "Replay model" : "Play model";
      id("model-layers").replaceChildren(...steps.map((name, step) => {
        const control = button(name, () => { stop(); layer = step; render(); }, "");
        if (layer === step) control.setAttribute("aria-current", "step");
        control.disabled = i === undefined;
        return control;
      }));
      if (i === undefined) {
        target.replaceChildren(el("p", "run-note", "Select at least one seed to score the shortlist."));
        overlay(null);
        return;
      }
      simulated ??= sim.models(input);
      const row = input.rows[i];
      const graphModel = model === "gnn";
      const paths = [];
      let strengths, content;
      if (!layer) {
        strengths = input.rows.map(entry => entry.raw[0]);
        content = [el("p", "run-note", "Each row starts with seven signals. Raw, standardized and presence values make 21 example input columns."), vectorTable(row)];
      } else if (layer === final) {
        strengths = simulated[model];
        content = [
          el("h3", "model-head", row.node.title),
          metrics([["MLP demo score", decimal(simulated.mlp[i])], ["GNN demo score", decimal(simulated.gnn[i])]]),
          el("p", "run-note", "The MLP reads its own encoded row. The GNN readout also uses the state after three neighbour updates."),
        ];
      } else {
        const messageRound = graphModel ? Math.max(0, layer - 2) : 0;
        const states = layer === 1 ? simulated.h1 : simulated.layers[messageRound];
        strengths = states.map(state => state[0]);
        const activations = states[i];
        content = [el("p", "run-note", messageRound ? "Each passage takes a link-weighted mean of neighbour states, then applies a residual GELU update."
          : "A dense transform and GELU update this passage’s own channels."),
        bars(activations.map((value, k) => ["Channel " + (k + 1), value]), Math.max(.1, ...activations.map(Math.abs)))];
        if (messageRound) {
          const previous = simulated.layers[messageRound - 1];
          const degree = input.net.degree[i];
          const contributors = input.net.adjacent[i].map(arc => ({
            from: input.net.nodes[arc.i].id, to: row.node.id, edge: arc.edge,
            node: input.net.nodes[arc.i], amount: degree ? previous[arc.i][0] * arc.weight / degree : 0,
          }));
          const mean = contributors.reduce((sum, entry) => sum + entry.amount, 0);
          contributors.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
          paths.push(...contributors.slice(0, 12));
          content.push(metrics([["Incoming neighbours", number(contributors.length)], ["Channel 1 before", decimal(previous[i][0])],
            ["Channel 1 weighted mean", decimal(mean)], ["Channel 1 after", decimal(activations[0])],
            ...contributors.slice(0, 3).map(entry => ["From " + entry.node.title, decimal(entry.amount)])]));
        }
      }
      target.replaceChildren(...content);
      overlay(model.toUpperCase() + " · " + steps[layer] + " · " + (layer === final ? "Score" : "Channel strength"), input.net.nodes, strengths, paths, true);
    }

    function rankingView() {
      const input = inputs();
      simulated ??= sim.models(input);
      optionState(rankButtons, "rank", ranking);
      const rows = input.rows.map((row, i) => ({ node: row.node, score: ranking === "ppr" ? row.mass : simulated[ranking][i] }))
        .sort((a, b) => b.score - a.score || (a.node.rank || Infinity) - (b.node.rank || Infinity) || a.node.id - b.node.id).slice(0, 5);
      const support = rows.filter(row => row.node.supporting).length;
      id("finish-summary").textContent = (ranking === "ppr" ? "PPR within the shortlist" : ranking.toUpperCase() + " with demonstration weights") +
        " · " + support + "/" + context.trace.support.length + " supporting in the top five.";
      id("finish-rows").replaceChildren(...rows.map((row, i) => listRow(row.node,
        (ranking === "ppr" ? pct(row.score) + " mass" : "Score " + decimal(row.score)) + (row.node.supporting ? " · Supporting" : ""),
        () => inspect(row.node.id, true), (i + 1) + ". ")));
      const order = new Map(rows.map((row, i) => [row.node.id, 1 / (i + 1)]));
      overlay("Final five · " + ranking.toUpperCase(), input.net.nodes, input.net.nodes.map(node => order.get(node.id) ?? 0));
    }

    function render() {
      if (!context || !view) return;
      const needsData = ["ppr", "features", "models", "rankers"].includes(stage) || (stage === "pool" && method === "walk");
      const data = loaded.has(context.sample.id);
      if ((needsData || method === "walk") && !data) requestSignals();
      const failed = errors.has(context.sample.id);
      id("run-loading").hidden = !needsData || data || failed;
      id("run-error").hidden = !needsData || data || !failed;
      for (const panel of all(".run-section")) panel.hidden = panel.id !== stage || (needsData && !data);
      if (stage !== "inspect") scene.setFocus(null);
      if (needsData && !data) { overlay(null); return; }
      if (stage === "lab") seedView();
      else if (stage === "ppr") renderPpr();
      else if (stage === "pool") renderPool();
      else if (stage === "features") featureView();
      else if (stage === "models") modelView();
      else if (stage === "rankers") rankingView();
      else overlay(null);
    }

    function display(next, details) {
      if (stage !== next) stop();
      stage = next;
      view = details;
      render();
    }

    function restartChanged() {
      stop();
      round = layer = 0;
      walk = plan = compiled = simulated = undefined;
      if (method === "walk") rebuild();
      else { render(); save(); }
    }

    for (const control of [restartKind, seedSelect, restart]) control.addEventListener("change", () => {
      source = seedSelect.value === "" ? context?.result.seeds[0]?.id : Number(seedSelect.value);
      restartChanged();
    });
    restart.addEventListener("input", () => { id("ppr-restart-value").textContent = pct(Number(restart.value)); });
    pprSlider.addEventListener("input", () => { stop(); round = Number(pprSlider.value); render(); });
    id("ppr-step").addEventListener("click", () => { stop(); round = Math.min(ROUNDS, round + 1); render(); });
    id("ppr-end").addEventListener("click", () => { stop(); round = ROUNDS; render(); });
    id("ppr-play").addEventListener("click", () => {
      if (playing === "ppr") { stop(); render(); return; }
      if (round === ROUNDS) round = 0;
      animate("ppr", () => { round++; return round < ROUNDS; }, () => round < 8 ? 740 : 130);
    });

    methodButtons.forEach(control => control.addEventListener("click", () => {
      method = control.dataset.poolMethod;
      chosenMethod = true;
      if (method === "walk") requestSignals();
      rebuild();
    }));
    id("pool-limit").addEventListener("change", () => { plan = undefined; rebuild(); });
    id("pool-apply").addEventListener("click", togglePool);
    searchButtons.forEach(control => control.addEventListener("click", () => {
      searchSignal = control.dataset.searchSignal;
      render();
    }));
    featureButtons.forEach(control => control.addEventListener("click", () => {
      stop();
      hop = 0;
      category = control.dataset.feature;
      render();
    }));
    for (const name of ["feature-probe", "model-probe"]) id(name).addEventListener("change", event => inspect(Number(event.target.value), true));
    id("feature-read").addEventListener("click", () => readPassage(probe));
    modelButtons.forEach(control => control.addEventListener("click", () => {
      stop();
      model = control.dataset.model;
      layer = 0;
      render();
    }));
    id("model-step").addEventListener("click", () => { stop(); layer = Math.min(layers().length - 1, layer + 1); render(); });
    id("model-reset").addEventListener("click", () => { stop(); layer = 0; render(); });
    id("model-play").addEventListener("click", () => {
      if (playing === "model") { stop(); render(); return; }
      const final = layers().length - 1;
      if (layer === final) layer = 0;
      animate("model", () => { layer++; return layer < final; }, () => 920);
    });
    rankButtons.forEach(control => control.addEventListener("click", () => { ranking = control.dataset.rank; render(); }));
    id("run-retry").addEventListener("click", () => { errors.delete(context.sample.id); requestSignals(); render(); });

    id("research-blocks").replaceChildren(el("p", "run-note", "These are the research inputs. The browser models use the smaller live vector above."),
      ...blocks.map(([name, width, copy]) => {
        const block = el("div", "run-block");
        block.append(el("strong", "", name + " · " + width), el("p", "", copy));
        return block;
      }));

    function writeParams(params) {
      if (method === "walk") {
        params.set("poolRule", "walk");
        params.set("limit", id("pool-limit").value);
      } else {
        if (chosenMethod) params.set("poolRule", "direct");
        else params.delete("poolRule");
        params.delete("limit");
      }
      params.set("restart", restart.value);
      params.set("restartMode", restartKind.value);
      if (source === undefined) params.delete("restartSeed");
      else params.set("restartSeed", String(source));
    }

    function followWalk() {
      if (chosenMethod || method === "walk") return false;
      method = "walk";
      return true;
    }

    return { configure, display, getPlan, probeFromGraph, writeParams, followWalk };
  }

  window.SECOND_HOP_RUN_UI = runUI;
})();
