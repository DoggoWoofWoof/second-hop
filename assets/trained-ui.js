(() => {
  "use strict";

  const { load, detail, passage, names, rankAfter, kinds, edgeKey } = window.SECOND_HOP_TRAINED_DATA;
  const { families, articleURL, explanation, terms, highlights, otherEnd } = window.SECOND_HOP_LINKS;
  const { topology, ppr, stepAt } = window.SECOND_HOP_SIMULATION;
  const by = id => document.getElementById(id);
  const number = new Intl.NumberFormat("en-US").format;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const stages = [
    ["Corpus & seeds", "Two searches pick starting points: dense matches meaning; SPLADE matches words. Their top five results each supply the seeds."],
    ["Build one candidate pool", "Merge the fused search hits with a bounded walk from the seeds. Every later step uses exactly these candidates."],
    ["What the models see", "Each candidate gets its own search, semantic and graph features. Pick an input to see its value and try removing it."],
    ["Two models, one pool", "Both checkpoints score each candidate. The GNN then reads its neighbours’ scores once and adjusts its own."],
    ["Read the rankings", "The order changes while the pool stays fixed. Select a result in either list to trace how it got there."],
  ];
  const blocks = {
    rank: ["Search ranks", "Dense and SPLADE reciprocal ranks, fused score, search agreement and seed flag."],
    dense_cos: ["Question cosine", "Similarity between the question and candidate embeddings."],
    topo_STRUCT: ["Topology", "Seed distance, reachability, degree and nearby seed counts on structural links."],
    depth_STRUCT: ["By distance", "Seed support, query similarity and embedding context grouped by exact hop distance."],
    SEMB: ["Embedding match", "64 learned query–candidate interactions. Each checkpoint learns its own projection."],
    SEED: ["Seed similarity", "Mean and maximum similarity to the seeds, including the highest-ranked anchors."],
    WALK: ["Structural walks", "Counts of paths from seeds, split by length and stored link direction."],
    DISTS: ["Seed reach", "Counts, mass and similarity of seeds at each distance, plus repeated neighbour averaging."],
    WALKF: ["All-link walks", "Walk counts across structural, name and semantic links, with separate one-hop counts."],
    CHAIN: ["Relation chains", "For typed knowledge graphs, a learned correction uses sequences of relation types reached from the seeds."],
  };
  const score = (value, digits = 3) => Number.isFinite(value) ? value.toFixed(digits).replace(/^-0\.0+$/, "0." + "0".repeat(digits)) : "—";
  const signed = value => (value > 0 ? "+" : value < 0 ? "−" : "") + score(Math.abs(value));
  const rank = value => value ? "#" + number(value) : "—";
  const pct = value => new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 3 }).format(value);

  function el(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function button(label, fn, className = "ghost-button") {
    const item = el("button", className, label);
    item.type = "button";
    item.addEventListener("click", fn);
    return item;
  }

  function link(text, href) {
    const a = el("a", "section-link", text);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function options(values, active, select, label) {
    const row = el("div", "run-options trained-options");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", label);
    for (const [value, title] of values) {
      const item = button(title, () => select(value), "");
      item.setAttribute("aria-pressed", String(value === active));
      row.append(item);
    }
    return row;
  }

  function disclosure(title, content, open = false) {
    const box = el("details", "run-details trained-details");
    box.open = open;
    box.append(el("summary", "", title), content);
    return box;
  }

  function create({ scene, save, walkLab }) {
    const header = by("trained-head");
    const content = by("trained-content");
    const probe = by("trained-probe");
    const next = by("trained-next");
    const tabs = [...document.querySelectorAll("[data-trained-step]")];
    let data, pending = 0, inspection, failed = false, inFlight = false;
    let active = false, stage = 0, selected, edgePick, termPick, chosenSeed, feature, modelLens, compare, cutoff, evidenceOnly;
    let textRequest, exactNames, exactNameRequest, readingOpen, listExpanded = false, lensLinks = new Set();
    let walk, walkOpen, round, restarting, walkTimer, walkStyle, walkUI, modelTimer, poolTimer, featureOpen;
    let initialRankModel;

    const entity = () => data?.key === "metaqa";
    const unit = () => entity() ? "entities" : "passages";
    const tag = () => entity() ? "Answer" : "Evidence";
    const goldCount = order => order.reduce((n, i) => n + Number(data.gold.has(data.pool[i])), 0);
    const small = text => el("p", "trained-note", text);
    const row = () => data.byId.get(selected)?.row;
    const label = id => data.titles.get(id) ?? "Passage " + id;
    const typeList = mask => kinds(data.structural, mask).map(key => families[key].label).join(" · ");

    async function open(info, step) {
      const sequence = ++pending;
      active = true;
      data = null;
      clearTimers();
      header.replaceChildren(el("p", "trained-kicker", "Checkpoint replay"), el("h2", "", "Opening " + info.label));
      content.replaceChildren(small("Loading the benchmark corpus and recorded rankings…"));
      const record = await load(info);
      if (sequence !== pending || !active) return false;
      data = record;
      inspection = null;
      failed = inFlight = false;
      textRequest = exactNames = exactNameRequest = null;
      readingOpen = false;
      edgePick = termPick = null;
      feature = "rank";
      featureOpen = false;
      modelLens = "gnn";
      initialRankModel = "local";
      compare = null;
      cutoff = 10;
      evidenceOnly = listExpanded = false;
      walk = walkUI = null;
      walkOpen = false;
      round = 0;
      restarting = .5;
      walkStyle = "single";
      lensLinks = new Set(data.familyTypes);
      chosenSeed = (data.seedIds.has(data.topic) ? data.topic : data.seeds[0]);
      selected = chosenSeed;
      stage = 0;
      scene.show(data.graph, { seedIds: data.seedIds }, { fresh: true, shrunk: step > 0 });
      scene.setLinkTypes(lensLinks);
      renderFamilies();
      go(step, false, true);
      return true;
    }

    function close() {
      ++pending;
      active = false;
      clearTimers();
      scene.setLinkTypes(null);
      scene.setCorpus(null);
      scene.setFocus(null);
      scene.setSignal(null);
      probe.hidden = true;
    }

    function clearTimers() {
      clearInterval(walkTimer);
      clearTimeout(modelTimer);
      clearTimeout(poolTimer);
      walkTimer = modelTimer = poolTimer = undefined;
    }

    function go(nextStage, store = true, opening = false) {
      if (!data || !Number.isInteger(nextStage) || nextStage < 0 || nextStage >= stages.length) return;
      const before = stage;
      clearTimers();
      if (before !== nextStage) edgePick = termPick = null;
      stage = nextStage;
      listExpanded = false;
      if (stage > 0 && !data.byId.has(selected)) selected = chosenSeed;
      if (stage === 0 && (before !== 0 || opening)) {
        scene.show(data.graph, { seedIds: data.seedIds }, { fresh: false, shrunk: false });
        scene.setCorpus(data.corpus.nodes, data.graph.ids);
        scene.fit(!opening);
      } else if (stage > 0 && (before === 0 || opening)) {
        scene.setCorpus(null);
        if (!opening) scene.show(data.graph, { seedIds: data.seedIds }, { fresh: false, shrunk: true });
        scene.fit(!opening);
      }
      compare = null;
      initialRankModel = "gnn";
      for (const control of tabs) {
        if (Number(control.dataset.trainedStep) === stage) control.setAttribute("aria-current", "step");
        else control.removeAttribute("aria-current");
      }
      header.replaceChildren(
        el("p", "trained-kicker", "0" + (stage + 1) + " / 0" + stages.length + "  ·  " + (stage ? number(data.pool.length) + " " + unit() : data.dataset)),
        el("h2", "", stages[stage][0]), small(stages[stage][1]));
      next.textContent = ["Build pool ↘", "See model inputs →", "Compare models →", "View ranking →", "Replay from corpus ↺"][stage];
      by("trained-back").disabled = stage === 0;
      content.scrollTop = 0;
      if (stage === 2 || stage === 3) loadDetails();
      draw();
      if (store && stage === 1 && before === 0) animatePool();
      if (store && before !== stage && matchMedia("(max-width: 860px)").matches &&
          by("scene-field").getBoundingClientRect().bottom < 180) by("scene-field").scrollIntoView({ block: "start", behavior: motion.matches ? "auto" : "smooth" });
      if (store) save(data.id, stage);
    }

    function animatePool() {
      if (motion.matches || (walkOpen && walk)) return;
      const waves = Array.from({ length: data.construction.setting.hops }, () => []);
      for (const [id, [from, type, hop]] of Object.entries(data.expansion)) {
        const edge = data.edges.get(edgeKey(from, Number(id)));
        if (edge?.types.includes([data.structural, "N", "K"][type])) waves[hop - 1].push({ edge, from, amount: 1 });
      }
      const values = new Map(data.graph.nodes.map(node => [node.id, data.seedIds.has(node.id) ? 1 : node.base ? .35 : 0]));
      const caption = by("graph-run-readout");
      function wave(i) {
        if (!active || stage !== 1 || walkOpen) return;
        if (i === waves.length) { drawGraph(); signal(); return; }
        const paths = waves[i].sort((a, b) =>
          Number(b.from === chosenSeed) - Number(a.from === chosenSeed) ||
          Number(b.edge.a.supporting || b.edge.b.supporting) - Number(a.edge.a.supporting || a.edge.b.supporting)).slice(0, 26);
        for (const path of paths) values.set(otherEnd(path.edge, { id: path.from }).id, .78);
        caption.textContent = "Expansion · hop " + (i + 1) + " of " + waves.length;
        scene.setSignal({ values: new Map(values), paths, focus: selected });
        poolTimer = setTimeout(() => wave(i + 1), 720);
      }
      wave(0);
    }

    function loadDetails() {
      if (!data || inspection || failed || inFlight) return;
      const current = data;
      inFlight = true;
      detail(current).then(value => {
        if (!active || current !== data) return;
        inspection = value;
        inFlight = false;
        if (stage >= 2) render();
      }).catch(error => {
        if (!active || current !== data) return;
        inFlight = false;
        failed = true;
        console.error(error);
        if (stage >= 2) render();
      });
    }

    function renderFamilies() {
      const container = by("graph-families");
      container.setAttribute("aria-label", "Show link types on the graph");
      const legend = data.familyTypes.map(key => {
        const count = data.graph.pairs.filter(edge => edge.types.includes(key)).length;
        const control = button("", () => {
          if (lensLinks.has(key)) lensLinks.delete(key); else lensLinks.add(key);
          control.setAttribute("aria-pressed", String(lensLinks.has(key)));
          scene.setLinkTypes(lensLinks);
          if (stage === 1 && walkOpen) { buildWalk(); updateWalk(); }
          else drawGraph();
          scene.setFocus(selected, routesFor());
          renderProbe();
        }, "galaxy-family");
        control.dataset.family = key;
        control.style.setProperty("--edge", families[key].color);
        control.title = "Show or hide these lines. The trained scores stay fixed.";
        control.setAttribute("aria-pressed", "true");
        control.append(el("i"), el("span", "", families[key].title), el("small", "", number(count)));
        return control;
      });
      container.replaceChildren(...legend);
    }

    function drawGraph() {
      const n = stage === 0 ? data.corpus.nodes.length : data.pool.length;
      const activeMask = [data.structural, "N", "K"].reduce((mask, type, i) => mask | (lensLinks.has(type) ? 1 << i : 0), 0);
      const edges = stage === 0 ? (data.corpus.pairMasks?.reduce((total, count, mask) => total + ((mask & activeMask) ? count : 0), 0) ?? data.corpus.pairs)
        : data.graph.pairs.filter(edge => edge.types.some(type => lensLinks.has(type))).length;
      by("graph-title").textContent = stage === 0 ? data.dataset + " corpus" : "Candidate pool";
      by("graph-scope").textContent = stage === 0 ? "Faint dots are corpus " + unit() + "; links shown for the pool"
        : number(n) + " fixed " + unit() + " · " + data.pool.filter(id => data.gold.has(id)).length + "/" + data.gold.size + " " + (entity() ? "answers" : "supporting passages");
      by("graph-unit").textContent = entity() ? "Entities" : "Passages";
      by("graph-nodes").textContent = number(n);
      by("graph-edges").textContent = number(edges);
      by("graph-density").textContent = pct(n > 1 ? 2 * edges / (n * (n - 1)) : 0);
      by("graph-empty").hidden = true;
      const open = by("graph-open-passage");
      open.hidden = selected === undefined;
      open.textContent = "Inspect " + (entity() ? "entity" : "passage") + " ↓";
      const hint = by("graph-hint");
      hint.textContent = stage === 0 ? "Drag the bright nodes or pan the map. Click any dot to inspect it." :
        stage < 3 ? "Drag a node. Click a line to see why it exists. Link toggles only change the view."
          : "Brighter nodes rank higher in the selected model. The graph keeps the same candidates.";
      const shrink = by("graph-shrink");
      shrink.textContent = stage ? "Corpus view ↗" : "Build pool ↘";
      shrink.setAttribute("aria-pressed", String(stage > 0));
      const caption = by("graph-run-readout");
      caption.hidden = false;
      caption.textContent = stage === 0 ? "● " + data.seeds.length + " search seeds" : stage < 3 ? "● " + number(n) + " in the fixed pool"
        : (modelLens === "mlp" ? "MLP" : "GNN") + (compare?.model === modelLens ? " · with change" : " · rank");
      if (stage === 1 && walkOpen && walk) caption.textContent = "PPR comparison · round " + round + "/50";
      if (stage === 3 && !compare && initialRankModel === "local" && modelLens === "gnn") caption.textContent = "GNN · before neighbour pass";
      if (stage === 2 && compare) caption.textContent = "GNN · " + blocks[compare.block][0] + " removed";
    }

    function routesFor() {
      if (!data.byId.has(selected)) return new Map();
      const edges = data.graph.incident.get(selected) ?? [];
      if (termPick) return new Map(edges.flatMap(edge => {
        const types = edge.types.filter(type => lensLinks.has(type) && edgeTerms(edge, type, data.byId.get(selected)).some(name => name.toLowerCase() === termPick));
        return types.length ? [[edge.key, new Set(types)]] : [];
      }));
      if (edgePick) return new Map([[edgePick.edge.key, new Set([edgePick.type])]]);
      if (compare?.kind === "neighbour") {
        const key = edgeKey(selected, compare.from);
        const edge = data.edges.get(key);
        return edge ? new Map([[key, new Set(edge.types)]]) : new Map();
      }
      if (stage === 4 && entity()) {
        const proof = data.paths?.[selected];
        if (proof) return new Map(proof.slice(1).map((id, i) => [edgeKey(proof[i], id), new Set(["T"])]));
      }
      if (stage <= 1 && data.expansion[selected] && !data.seedIds.has(selected)) {
        const routes = new Map();
        let id = selected;
        while (data.expansion[id]) {
          const [parent, type] = data.expansion[id];
          const key = edgeKey(id, parent);
          routes.set(key, new Set([[data.structural, "N", "K"][type]]));
          id = parent;
        }
        if (routes.size) return routes;
      }
      const strongest = (stage === 3 ? inspection?.neighbours[row()] : null)?.slice(0, 5);
      const local = strongest ? strongest.map(([id]) => data.edges.get(edgeKey(selected, id))).filter(Boolean) : stage >= 3 ? edges.slice(0, 6) : edges;
      return new Map(local.map(edge => [edge.key, new Set(edge.types.filter(type => lensLinks.has(type))) ]));
    }

    function signal(paths = []) {
      if (stage <= 1 && !(stage === 1 && walkOpen && walk)) {
        scene.setSignal(null);
        return;
      }
      if (stage === 1) {
        const values = walk.frames[round];
        const max = values.reduce((m, value) => Math.max(m, value), 1e-12);
        const flows = stepAt(walk, round, selected)?.incoming.slice(0, 7).map(({ edge, node, amount }) => ({ edge, from: node.id, amount })) ?? [];
        scene.setSignal({ values: new Map(data.graph.nodes.map(node => [node.id, Math.min(1, Math.sqrt(values[node.row] / max))])), paths: flows, focus: selected });
        return;
      }
      let ranked;
      if (stage === 2 && !compare && inspection) {
        const rows = inspection.readouts[feature === "SEMB" ? "gnn_SEMB" : feature === "CHAIN" ? "gnn_chains" : feature];
        const values = rows.at(-1);
        const width = inspection.blocks[feature].length;
        const scaled = data.graph.nodes.map(node => {
          const i = node.row * width;
          const level = feature === "CHAIN" ? Math.abs(values[i + 2])
            : Math.sqrt(values.subarray(i, i + width).reduce((n, value) => n + value ** 2, 0) / width);
          return [node.id, level];
        });
        const max = scaled.reduce((n, [, value]) => Math.max(n, value), 1e-12);
        scene.setSignal({ values: new Map(scaled.map(([id, value]) => [id, Math.min(1, value / max)])), focus: selected });
        by("graph-run-readout").textContent = blocks[feature][0] + " · relative input strength";
        return;
      }
      if (compare?.model === modelLens) ranked = compare.ranked;
      else ranked = data.ranks[stage === 3 && modelLens === "gnn" ? initialRankModel : modelLens];
      const values = new Map(data.graph.nodes.map(node => {
        const pos = compare?.kind === "neighbour" && compare.model === modelLens
          ? node.id === selected ? compare.position
            : ranked.positions[node.row] - Number(ranked.positions[node.row] > ranked.positions[row()]) + Number(ranked.positions[node.row] - Number(ranked.positions[node.row] > ranked.positions[row()]) >= compare.position)
          : ranked.positions[node.row];
        return [node.id, 1 / (1 + (pos - 1) * .1)];
      }));
      scene.setSignal({ values, paths, focus: selected });
    }

    function draw(paths = []) {
      drawGraph();
      scene.setFocus(selected, routesFor());
      signal(paths);
      render();
    }

    function select(id, { locate = false, seed = false, edge = null, term = null } = {}) {
      if (!data?.titles.has(id) || (stage > 0 && !data.byId.has(id))) return;
      clearTimeout(poolTimer);
      if (id !== selected) {
        compare = null;
        listExpanded = false;
        readingOpen = false;
        if (stage === 3) initialRankModel = "gnn";
      }
      if (id !== textRequest?.id) textRequest = null;
      selected = id;
      if (seed) {
        chosenSeed = id;
        if (walkOpen) buildWalk();
      }
      edgePick = edge;
      termPick = term;
      if (edge && !entity()) readingOpen = true;
      draw();
      if (locate) scene.locate(id, seed ? 1.68 : 1.18);
    }

    function pickEdge(edge, type) {
      const node = edge.a.id === selected ? edge.a : edge.b.id === selected ? edge.b : edge.a;
      select(node.id, { edge: { edge, type } });
    }

    function passageButton(node, secondary, action = () => select(node.id, { locate: true })) {
      const item = button("", action, "passage-row trained-row");
      item.setAttribute("aria-pressed", String(node.id === selected));
      const text = el("span");
      text.append(el("strong", "", node.title), el("small", "", secondary));
      item.append(text);
      if (node.supporting) item.append(el("span", "trained-badge", tag()));
      return item;
    }

    function searchBox() {
      const wrapper = el("div", "trained-search");
      const input = el("input");
      input.type = "search";
      input.placeholder = stage === 0 ? "Find in the corpus…" : "Find in the pool…";
      input.setAttribute("aria-label", input.placeholder);
      const output = el("div", "trained-search-results");
      function matches() {
        const q = input.value.toLowerCase().trim();
        if (!q) return [];
        const primary = [], secondary = [];
        for (const [id, title] of (stage === 0 ? data.corpus.nodes : data.graph.nodes.map(node => [node.id, node.title]))) {
          const text = title.toLowerCase();
          if (text.startsWith(q)) { if (primary.length < 5) primary.push({ id, title }); }
          else if (text.includes(q) && secondary.length < 5) secondary.push({ id, title });
          if (primary.length === 5) break;
        }
        return [...primary, ...secondary].slice(0, 5);
      }
      input.addEventListener("input", () => {
        output.replaceChildren();
        if (!input.value.trim()) return;
        const items = matches();
        output.replaceChildren(...(items.length ? items.map(node => passageButton(node, data.byId.has(node.id) ? "In candidate pool" : "Corpus only")) : [small("No matching titles.")]));
      });
      input.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        const first = matches()[0];
        if (first) { event.preventDefault(); select(first.id, { locate: true }); }
      });
      wrapper.append(input, output);
      return wrapper;
    }

    function seedButton(id) {
      const node = data.byId.get(id);
      const words = node.splade <= 5 && node.splade ? "SPLADE " + rank(node.splade) : "";
      const dense = node.dense <= 5 && node.dense ? "Dense " + rank(node.dense) : "";
      return passageButton(node, [dense, words].filter(Boolean).join(" · "), () => select(id, { locate: true, seed: true }));
    }

    function corpusStage() {
      const seeds = el("div", "trained-stack");
      const shown = listExpanded ? data.seeds : data.seeds.slice(0, 3);
      seeds.append(...shown.map(seedButton));
      if (data.seeds.length > 3) seeds.append(button(listExpanded ? "Fewer seeds" : "All " + data.seeds.length + " seeds", () => {
        listExpanded = !listExpanded;
        render();
      }));
      content.append(searchBox(), el("h3", "trained-label", "Search seeds · click to zoom"), seeds);
      if (!entity()) content.append(button("Experiment with seeds in Walk lab ↗", walkLab, "trained-text-button"));
    }

    function buildWalk() {
      clearTimeout(poolTimer);
      clearInterval(walkTimer);
      walkTimer = undefined;
      if (walkUI?.play) walkUI.play.textContent = "Play rounds";
      const filtered = { ...data.graph, pairs: data.graph.pairs.map(edge => ({ ...edge, active: edge.types.filter(type => lensLinks.has(type)) })) };
      const graph = topology(filtered, data);
      walk = ppr(graph, data.seeds, chosenSeed, walkStyle, restarting);
      round = 0;
    }

    function updateWalk() {
      if (!walk || !walkUI) return;
      const point = stepAt(walk, round, selected);
      walkUI.value.textContent = round + " / 50";
      walkUI.slider.value = round;
      walkUI.math.textContent = point ? label(selected) + ": " + score(point.total, 5) + " mass"
        + (round ? " · " + score(point.reset, 5) + " restart + " + score(point.held + point.incoming.reduce((n, arc) => n + arc.amount, 0), 5) + " from the graph" : " at restart") : "";
      drawGraph();
      signal();
    }

    function walkExperiment() {
      const body = el("div", "trained-stack");
      const box = disclosure("Try PageRank on this pool", body, walkOpen);
      box.addEventListener("toggle", () => {
        if (walkOpen === box.open) return;
        walkOpen = box.open;
        if (walkOpen && !walk) buildWalk();
        if (!walkOpen) { clearInterval(walkTimer); walkTimer = undefined; }
        if (walkOpen) updateWalk();
        else { drawGraph(); signal(); }
      });
      body.append(small("Each round sends mass back to the seeds and across the enabled links. Try changing the source, restart rate or link types. PageRank is a separate comparison."));
      const restart = el("select");
      restart.setAttribute("aria-label", "PageRank restart source");
      restart.append(new Option("Selected seed", "single"), new Option("All seeds", "seeds"), new Option("Seeds + fused search", "mixed"));
      restart.value = walkStyle;
      restart.addEventListener("change", () => { walkStyle = restart.value; buildWalk(); updateWalk(); });
      const source = el("select");
      source.setAttribute("aria-label", "Focus seed for PageRank");
      source.append(...data.seeds.map(id => new Option(label(id), id)));
      source.value = chosenSeed;
      source.addEventListener("change", () => select(Number(source.value), { locate: true, seed: true }));
      const range = (name, min, max, step, value, fn) => {
        const label = el("label", "run-range");
        const output = el("output", "", value);
        const slider = el("input");
        Object.assign(slider, { type: "range", min, max, step, value });
        slider.setAttribute("aria-label", name);
        slider.addEventListener("input", () => fn(Number(slider.value), output));
        label.append(el("span", "", name), output, slider);
        return { label, output, slider };
      };
      const alpha = range("Restart probability", .1, .9, .05, restarting, (value, out) => {
        restarting = value;
        out.textContent = pct(value);
        buildWalk();
        updateWalk();
      });
      alpha.output.textContent = pct(restarting);
      const frames = range("Round", 0, 50, 1, round, value => { round = value; updateWalk(); });
      frames.output.textContent = round + " / 50";
      const math = el("p", "run-math");
      walkUI = { slider: frames.slider, value: frames.output, math };
      const controls = el("div", "run-controls");
      const play = button("Play rounds", () => {
        if (!walk) buildWalk();
        if (walkTimer) {
          clearInterval(walkTimer);
          walkTimer = undefined;
          play.textContent = "Play rounds";
          return;
        }
        if (round >= 50) round = 0;
        play.textContent = "Pause rounds";
        walkTimer = setInterval(() => {
          round = Math.min(50, round + 1);
          updateWalk();
          if (round === 50) { clearInterval(walkTimer); walkTimer = undefined; play.textContent = "Play rounds"; }
        }, motion.matches ? 125 : 230);
      });
      walkUI.play = play;
      controls.append(play, button("Step +1", () => { round = Math.min(50, round + 1); updateWalk(); }), button("Round 50", () => { round = 50; updateWalk(); }));
      body.append(restart, source, alpha.label, controls, frames.label, math);
      if (walkOpen && walk) updateWalk();
      return box;
    }

    function poolStage() {
      const { base_pool, setting, regime } = data.construction;
      const base = data.graph.nodes.filter(node => node.base).length;
      const extra = data.pool.length - base;
      const counts = el("div", "trained-counts");
      for (const [n, title] of [[base, "Fused hits"], [data.seeds.length, "Seeds included"], [extra, "Extra candidates"]]) {
        const box = el("div");
        box.append(el("strong", "", number(n)), el("small", "", title));
        counts.append(box);
      }
      const rule = el("div", "trained-callout");
      rule.append(el("strong", "", number(data.corpus.nodes.length) + " → " + number(data.pool.length) + " " + unit()),
        small("Top " + base_pool.split("_").at(-1) + " fused hits ∪ search seeds ∪ " + setting.hops +
          (setting.hops === 1 ? " hop" : " hops") + " over " + (regime === "FULL" ? "all three link types" : "structural links") + "."),
        small("Up to " + setting.per_seed_cap + " neighbours per seed and link type" + (setting.visited_cap ? " with a " + number(setting.visited_cap) + "-node expansion cap." : ".")));
      content.append(rule, counts, searchBox(), walkExperiment());
    }

    function unavailable() {
      const copy = el("div", "trained-stack");
      copy.append(small(failed ? "The input breakdown couldn’t load." : "Loading the feature and neighbour breakdown…"));
      if (failed) copy.append(button("Try again", () => { failed = false; loadDetails(); render(); }));
      return copy;
    }

    function deltaRow(name, modelName, base, changed, i, position = changed.positions[i], value = changed.values[i]) {
      const change = base.positions[i] - position;
      const box = el("div", "trained-delta");
      box.append(el("span", "", name), el("strong", "", rank(base.positions[i]) + " → " + rank(position)),
        el("small", change > 0 ? "gain" : change < 0 ? "loss" : "", signed(value - base.values[i]) + " score"));
      box.dataset.model = modelName;
      return box;
    }

    function inputsStage() {
      if (!inspection) { content.append(unavailable()); return; }
      const i = row();
      const matrix = el("div", "trained-inputs");
      for (const key of Object.keys(inspection.blocks)) {
        const control = button("", () => { feature = key; compare = null; draw(); }, "trained-input");
        control.setAttribute("aria-pressed", String(key === feature));
        const count = inspection.blocks[key].length;
        control.append(el("strong", "", blocks[key][0]), el("small", "", key === "CHAIN" ? "Typed KB" : count + (count === 1 ? " value" : " values")));
        matrix.append(control);
      }
      content.append(matrix, small(blocks[feature][1]));
      const result = el("div", "trained-stack");
      const off = compare?.kind === "block" && compare.block === feature;
      result.append(button(off ? "Restore input" : "What if we remove this input?", () => {
        compare = off ? null : { kind: "block", block: feature, model: "gnn", ranked: inspection.ablations[feature][1] };
        modelLens = "gnn";
        draw();
      }, "ghost-button trained-ablate"));
      if (off) {
        const [mlp, gnn] = inspection.ablations[feature];
        const deltas = el("div", "trained-deltas");
        deltas.append(deltaRow("MLP", "mlp", data.ranks.mlp, mlp, i), deltaRow("GNN", "gnn", data.ranks.gnn, gnn, i));
        result.append(deltas, small(feature === "rank"
          ? "This removes the rank block from the encoder. The separate RRF baseline term remains in both models."
          : "The input is removed for every candidate and both models rerank the same pool."));
      }
      content.append(result);
      const vector = el("div", "trained-vector");
      const cols = inspection.blocks[feature];
      const width = cols.length;
      const modelSpecific = feature === "SEMB" || feature === "CHAIN";
      const table = el("table");
      const headings = feature === "CHAIN" ? ["Input", "MLP", "GNN"] : modelSpecific ? ["Input", "MLP raw / z", "GNN raw / z"] : ["Input", "Raw", "z-score"];
      const tr = el("tr");
      tr.append(...headings.map(text => el("th", "", text)));
      const thead = el("thead");
      thead.append(tr);
      const tbody = el("tbody");
      for (const [j, [name, formula]] of cols.entries()) {
        const line = el("tr");
        const first = el("th");
        first.scope = "row";
        const item = el("abbr", "", name.replaceAll("_", " "));
        item.tabIndex = 0;
        item.title = formula;
        first.append(item);
        line.append(first);
        const at = i * width + j;
        if (modelSpecific) {
          for (const model of ["mlp", "gnn"]) {
            const [raw, z] = inspection.readouts[model + "_" + (feature === "CHAIN" ? "chains" : feature)];
            line.append(el("td", "", score(raw[at], 4) + (z ? " / " + score(z[at], 2) : "")));
          }
        } else {
          const [raw, z] = inspection.readouts[feature];
          line.append(el("td", "", score(raw[at], 4)), el("td", "", score(z[at], 2)));
        }
        tbody.append(line);
      }
      table.append(thead, tbody);
      vector.append(table, small("A z-score compares a value to the retrieved rows; it uses the full pool when those rows don’t vary. Hover or focus a column label for its formula."));
      const box = disclosure("Exact values and formulas", vector, featureOpen);
      box.addEventListener("toggle", () => { featureOpen = box.open; });
      content.append(box, searchBox());
    }

    function card(model, title, ranked, i) {
      const box = el("div", "trained-score");
      box.dataset.model = model;
      const activeChange = compare?.model === model && model === "gnn";
      const position = activeChange && compare.kind === "neighbour" ? compare.position : ranked.positions[i];
      const value = activeChange && compare.kind === "neighbour" ? compare.score : ranked.values[i];
      box.append(el("small", "", title), el("strong", "", rank(position)), el("span", "", score(value) + " score"));
      return box;
    }

    function neighbourPaths(source) {
      if (!inspection) return [];
      const messages = inspection.neighbours[row()];
      return (source === undefined ? messages.slice(0, 6) : messages)
        .filter(([id]) => source === undefined || source === id)
        .flatMap(([from, , alt]) => {
          const edge = data.edges.get(edgeKey(selected, from));
          return edge ? [{ edge, from, amount: data.ranks.gnn.values[row()] - alt }] : [];
        });
    }

    function playMessages() {
      clearTimeout(modelTimer);
      compare = null;
      modelLens = "gnn";
      initialRankModel = "local";
      draw(neighbourPaths());
      const current = data, id = selected;
      const reveal = () => {
        if (!active || data !== current || selected !== id || stage !== 3) return;
        initialRankModel = "gnn";
        draw();
      };
      if (motion.matches) reveal();
      else modelTimer = setTimeout(reveal, 690);
    }

    function modelStage() {
      const i = row();
      const { mlp, gnn, local } = data.ranks;
      const after = compare?.kind === "neighbour" ? gnn : initialRankModel === "local" ? local : gnn;
      const cards = el("div", "trained-scores");
      cards.append(card("mlp", "MLP · zrc", mlp, i),
        card("gnn", initialRankModel === "local" ? "GNN · before messages" : "GNN · zsp", after, i));
      const count = (data.graph.incident.get(selected) ?? []).length;
      const correction = gnn.values[i] - local.values[i];
      const math = el("div", "trained-math");
      math.append(el("span", "", "GNN encoder"), el("strong", "", score(local.values[i])),
        el("span", "", "Learned correction"), el("strong", "", signed(correction)),
        el("span", "", "Rank with all messages"), el("strong", "", rank(local.positions[i]) + " → " + rank(gnn.positions[i])));
      const actions = el("div", "run-controls trained-controls");
      actions.append(button("Play neighbour pass ▷", playMessages, "galaxy-primary"),
        button(initialRankModel === "local" ? "Show final scores" : "Turn off neighbour pass", () => {
          compare = null;
          modelLens = "gnn";
          initialRankModel = initialRankModel === "local" ? "gnn" : "local";
          draw();
        }));
      content.append(cards, actions, math,
        options([["gnn", "Show GNN on graph"], ["mlp", "Show MLP on graph"]], modelLens, key => { modelLens = key; draw(); }, "Score overlay"));
      const movers = data.graph.nodes.filter(node => node.supporting && node.id !== selected && local.positions[node.row] !== gnn.positions[node.row]);
      const example = movers.sort((a, b) => Math.abs(local.positions[b.row] - gnn.positions[b.row]) - Math.abs(local.positions[a.row] - gnn.positions[a.row]))[0];
      if (example) content.append(passageButton(example, "Follow a rank change · " + rank(local.positions[example.row]) + " → " + rank(gnn.positions[example.row])));
      if (!inspection) { content.append(unavailable()); return; }
      const messages = el("div", "trained-stack");
      const shown = inspection.neighbours[i];
      messages.append(small("Each row below removes one neighbour’s incoming messages for this " + (entity() ? "entity" : "passage") + ". Other candidates keep their scores."));
      if (!shown.length) messages.append(small("No neighbour messages reach this candidate. The head still reads its own standardized score."));
      else for (const [from, types, alt] of shown.slice(0, listExpanded ? shown.length : 5)) {
        const shift = alt - gnn.values[i];
        const pos = rankAfter(gnn, i, alt);
        const item = passageButton(data.byId.get(from), typeList(types) + " · " + signed(shift) + " if removed", () => {
          const restoring = compare?.from === from;
          initialRankModel = "gnn";
          modelLens = "gnn";
          edgePick = termPick = null;
          compare = restoring ? null : { kind: "neighbour", model: "gnn", ranked: gnn, from, score: alt, position: pos };
          draw(restoring ? neighbourPaths(from) : []);
        });
        item.setAttribute("aria-pressed", String(compare?.from === from));
        messages.append(item);
      }
      if (compare?.kind === "neighbour") {
        messages.append(deltaRow("Without " + label(compare.from), "gnn", gnn, gnn, i, compare.position, compare.score));
      }
      if (shown.length > 5) messages.append(button(listExpanded ? "Show five" : "All " + shown.length + " neighbours", () => { listExpanded = !listExpanded; render(); }));
      content.append(disclosure("Remove individual messages · " + number(count) + " neighbours", messages, true));
      const stats = el("div", "trained-stack");
      const offset = i * 10;
      stats.append(small("Per link type the head takes mean neighbour z-score, log-sum-exp and log(1 + degree), plus this node’s own z-score. Both models were fitted separately."));
      for (const [j, type] of [data.structural, "N", "K"].entries()) {
        stats.append(el("p", "run-math", families[type].label + " · mean " + score(inspection.messages[offset + j]) +
          " · soft max " + score(inspection.messages[offset + 3 + j]) + " · log degree " + score(inspection.messages[offset + 6 + j])));
      }
      stats.append(el("p", "run-math", "Own z-score · " + score(inspection.messages[offset + 9])));
      content.append(disclosure("Exact inputs to the message head", stats), searchBox());
    }

    function rankingStage() {
      const { mlp, gnn } = data.ranks;
      const gold = data.gold.size;
      const lanes = el("div", "trained-ranks");
      content.append(options([[10, "Top 10"], [20, "Top 20"], [50, "Top 50"]], cutoff, value => { cutoff = value; render(); }, "Number of results"));
      const label = entity() ? "Answers" : "Evidence";
      const filters = el("div", "trained-ranking-tools");
      filters.append(small(label + " among the first " + Math.min(cutoff, data.pool.length) + " results"),
        button(evidenceOnly ? "Show all results" : label + " only", () => { evidenceOnly = !evidenceOnly; render(); }, "trained-text-button"));
      content.append(filters);
      for (const [key, title, ranked] of [["mlp", "MLP", mlp], ["gnn", "GNN", gnn]]) {
        const lane = el("section", "trained-lane");
        lane.dataset.model = key;
        const top = ranked.order.slice(0, cutoff);
        const titleRow = el("header");
        titleRow.append(el("h3", "", title), el("strong", "", goldCount(top) + "/" + gold));
        lane.append(titleRow);
        const results = el("ol");
        for (const i of top.filter(i => !evidenceOnly || data.gold.has(data.pool[i]))) {
          const node = data.graph.nodes[i];
          const entry = el("li");
          const item = button("", () => {
            modelLens = key;
            select(node.id, { locate: true });
            if (matchMedia("(max-width: 860px)").matches) probe.scrollIntoView({ block: "start", behavior: motion.matches ? "auto" : "smooth" });
          }, "trained-result");
          item.setAttribute("aria-pressed", String(node.id === selected));
          item.append(el("small", "trained-position", rank(ranked.positions[i])), el("strong", "", node.title));
          if (node.supporting) {
            item.dataset.supporting = "";
            item.append(el("span", "trained-result-mark", tag()));
          }
          entry.append(item);
          results.append(entry);
        }
        if (!results.children.length) results.append(el("li", "trained-note", "None in this range."));
        lane.append(results);
        lanes.append(lane);
      }
      content.append(lanes);
      const answer = el("div", "trained-stack");
      if (entity()) {
        for (const id of data.gold) {
          if (data.byId.has(id)) answer.append(passageButton(data.byId.get(id), "MLP " + rank(mlp.positions[data.byId.get(id).row]) +
            " · GNN " + rank(gnn.positions[data.byId.get(id).row])));
          else answer.append(small(data.titles.get(id) + " · outside the pool"));
        }
      } else answer.append(small(data.answers.join(" · ")), small("The models rank supporting passages. They do not generate this benchmark answer."));
      content.append(disclosure(entity() ? "All " + gold + " benchmark answers" : "Benchmark answer", answer));
      const info = el("div", "trained-stack");
      info.append(small("J5 p@swa checkpoints: zrc and zsp. Scores are exported from the original research code; the browser replays them."),
        link(entity() ? "MetaQA dataset ↗" : "Benchmark and checkpoint protocol ↗", entity() ? "https://github.com/yuyuz/MetaQA"
          : "https://github.com/DoggoWoofWoof/MLPvsGNN/blob/f30a9e421d30881936ceada05cd792809e1c652a/docs/B1B_MODELS_ON_HIPPORAG2.md"));
      content.append(disclosure("Run provenance", info), searchBox());
    }

    function edgeTerms(edge, type, node) {
      if (!node) return [];
      if (type === "N") return exactNames?.[edge.key] ?? data.names[edge.key]?.names ?? [];
      if (type === "T") return [];
      return terms(edge, type, node, exactNames);
    }

    function readText(id, target, node) {
      if (entity()) {
        target.replaceChildren(small("Official MetaQA entity · " + id));
        return;
      }
      loadNames();
      if (textRequest?.id !== id) {
        const record = data;
        const cached = node?.text;
        const req = { id, text: cached };
        textRequest = req;
        passage(record, id).then(text => {
          if (data !== record || textRequest !== req) return;
          req.text = text;
          if (node) node.text = text;
          if (active && selected === id) {
            const current = by("trained-passage-text");
            if (current) writeText(text, current, node);
          }
        }).catch(() => {
          if (data !== record || textRequest !== req) return;
          req.failed = true;
          const current = by("trained-passage-text");
          if (current && !req.text) current.textContent = "The saved passage couldn’t load. Open the source article below.";
        });
      }
      if (textRequest.text) writeText(textRequest.text, target, node);
      else target.textContent = textRequest.failed ? "The saved passage couldn’t load." : "Loading the benchmark passage…";
    }

    function loadNames() {
      if (entity() || exactNames || exactNameRequest) return;
      const current = data;
      exactNameRequest = names(data).then(found => {
        if (active && current === data) { exactNames = found; renderProbe(); }
      }).catch(() => {
        if (current === data) exactNames = {};
      });
    }

    function writeText(text, target, node) {
      const phrases = new Map();
      const related = (data.graph.incident.get(selected) ?? []).filter(edge => !edgePick || edge === edgePick.edge);
      for (const edge of related) for (const type of edge.types) {
        if (!lensLinks.has(type) || (edgePick && edgePick.type !== type)) continue;
        for (const term of edgeTerms(edge, type, node)) phrases.set(term.toLowerCase(), term);
      }
      const spans = highlights(text, phrases);
      const parts = [];
      let cursor = 0;
      for (const { key, start, end } of spans) {
        parts.push(text.slice(cursor, start));
        const token = button(text.slice(start, end), () => {
          termPick = termPick === key ? null : key;
          edgePick = null;
          draw();
          probe.querySelector("[data-phrase-active]")?.focus({ preventScroll: true });
        }, "evidence-term");
        token.setAttribute("aria-pressed", String(termPick === key));
        if (termPick === key) token.dataset.phraseActive = "";
        parts.push(token);
        cursor = end;
      }
      parts.push(text.slice(cursor));
      target.replaceChildren(...parts);
    }

    function relationProof(ids) {
      const result = el("ol", "trained-proof");
      for (const [i, id] of ids.entries()) {
        const step = el("li");
        if (i) {
          const from = ids[i - 1];
          const edge = data.edges.get(edgeKey(from, id));
          const relations = data.pathRelations?.[edgeKey(from, id)] ?? edge?.relations;
          const names = (relations ?? []).map(([a, b, rel]) => a === from && b === id ? "→ " + rel : "← " + rel);
          step.append(el("span", "", names.length ? names.join(" / ") : "→ Related"));
        }
        step.append(button(label(id), () => select(id, { locate: true }), "trained-text-button"));
        result.append(step);
      }
      return result;
    }

    function describeEdge(edge, type) {
      if (type === "T" && edge.relations?.length) {
        return edge.relations.map(([a, b, rel]) => label(a) + " → " + rel + " → " + label(b)).join(" · ");
      }
      const names = { [edge.key]: edgeTerms(edge, type, edge.a) };
      if (type === "N" && !names[edge.key].length && entity()) return "The frozen shared-entity graph links these names. Recorded weight: " + score(edge.named, 4) + ".";
      return explanation(edge, type, names);
    }

    function expansionNote(node) {
      if (!node) return "Outside this question’s candidate pool.";
      const route = data.expansion[node.id];
      const tags = [];
      if (data.seedIds.has(node.id)) tags.push("Search seed");
      if (node.base) tags.push("Fused hit " + rank(node.base));
      if (route) tags.push("Expansion hop " + route[2]);
      if (!tags.length) return "In the candidate pool";
      return tags.join(" · ");
    }

    function renderProbe() {
      const node = data.byId.get(selected);
      const outside = !node;
      const top = el("div", "trained-probe-heading");
      const headings = el("div");
      headings.append(el("p", "trained-kicker", outside ? "Corpus only" : expansionNote(node)), el("h3", "", label(selected)));
      top.append(headings);
      const buttons = el("div", "trained-probe-actions");
      const zoom = button("Focus", () => scene.locate(selected, data.seedIds.has(selected) ? 1.68 : 1.18));
      zoom.title = "Zoom to " + label(selected);
      buttons.append(zoom);
      if (stage === 1 && node && !data.seedIds.has(selected)) {
        buttons.append(button("Seed", () => select(chosenSeed, { locate: true, seed: true })));
      }
      if (!outside) {
        const pin = button(scene.isPinned(selected) ? "Unpin" : "Pin", () => {
          scene.pin(selected, !scene.isPinned(selected));
          const set = scene.isPinned(selected);
          pin.textContent = set ? "Unpin" : "Pin";
          pin.setAttribute("aria-pressed", String(set));
        });
        pin.setAttribute("aria-pressed", String(scene.isPinned(selected)));
        buttons.append(pin);
      }
      top.append(buttons);
      probe.replaceChildren(top);
      probe.hidden = false;
      const body = el("div", "trained-probe-body");
      if (node?.supporting) body.append(el("span", "trained-badge", entity() ? "Correct answer" : "Supporting passage"));
      if (stage === 0 || stage === 1) {
        if (!node) body.append(small(expansionNote(node)));
        else {
          body.append(small("Dense " + rank(node.dense) + " · SPLADE " + rank(node.splade) + " · Fused score " + score(node.score, 5)));
          if (stage === 1 && data.expansion[selected]) {
            const [from, type, hop] = data.expansion[selected];
            const family = [data.structural, "N", "K"][type];
            const edge = data.edges.get(edgeKey(from, selected));
            const detail = el("div", "trained-expansion");
            detail.append(small("Hop " + hop + " via " + families[family].label.toLowerCase() + ": "),
              button(label(from), () => select(from, { locate: true }), "trained-text-button"));
            if (edge) detail.append(button("See link", () => pickEdge(edge, family), "trained-text-button"));
            body.append(detail);
          }
        }
      }
      if (stage === 4 && node) {
        const ranks = el("div", "trained-result-probe");
        ranks.append(small("MLP " + rank(data.ranks.mlp.positions[node.row]) + " · GNN " + rank(data.ranks.gnn.positions[node.row])),
          button("Explain score →", () => go(3), "trained-text-button"));
        const back = button("Results ↑", () => header.scrollIntoView({ block: "start", behavior: motion.matches ? "auto" : "smooth" }),
          "trained-text-button trained-mobile-jump");
        ranks.append(back);
        body.append(ranks);
      }
      if (edgePick) {
        const { edge, type } = edgePick;
        const other = otherEnd(edge, node);
        const card = el("div", "inspect-edge");
        card.style.setProperty("--edge", families[type].color);
        card.append(el("strong", "", families[type].label + " · " + other.title), el("p", "", describeEdge(edge, type)));
        const switches = el("div", "inspect-edge-actions");
        for (const family of edge.types) {
          const control = button(families[family].label, () => pickEdge(edge, family), "");
          control.setAttribute("aria-pressed", String(family === type));
          switches.append(control);
        }
        switches.append(button("Inspect other end", () => select(other.id, { locate: true, edge: { edge, type } }), ""));
        card.append(switches);
        body.append(card);
      }
      if (data.paths?.[selected] && stage >= 1) {
        const proof = el("div", "trained-path-card");
        proof.append(el("strong", "", "Answer path in MetaQA"), relationProof(data.paths[selected]));
        body.append(proof);
      }
      const connections = (data.graph.incident.get(selected) ?? []).filter(edge => edge.types.some(type =>
        lensLinks.has(type) && (!termPick || edgeTerms(edge, type, node).some(word => word.toLowerCase() === termPick))));
      if (connections.length) {
        const items = el("div", "trained-stack");
        const ordered = connections.slice().sort((a, b) => Number(otherEnd(b, node).supporting) - Number(otherEnd(a, node).supporting)
          || Number(data.seedIds.has(otherEnd(b, node).id)) - Number(data.seedIds.has(otherEnd(a, node).id)));
        const more = el("div", "trained-stack");
        const add = (parent, edge) => {
          const to = otherEnd(edge, node);
          const types = edge.types.filter(type => lensLinks.has(type) && (!termPick ||
            edgeTerms(edge, type, node).some(word => word.toLowerCase() === termPick)));
          const control = passageButton(to, types.map(type => families[type].label).join(" · "), () => pickEdge(edge, types[0]));
          control.setAttribute("aria-pressed", String(edge === edgePick?.edge));
          parent.append(control);
        };
        ordered.slice(0, 7).forEach(edge => add(items, edge));
        if (ordered.length > 7) {
          const buttonMore = button("All " + ordered.length + " connections", () => {
            if (!more.childElementCount) ordered.slice(7).forEach(edge => add(more, edge));
            else more.replaceChildren();
            buttonMore.textContent = more.childElementCount ? "Show fewer connections" : "All " + ordered.length + " connections";
          });
          items.append(more, buttonMore);
        }
        body.append(disclosure(termPick ? "“" + termPick + "” · " + connections.length + " connections" : number(connections.length) + " pool connections", items, Boolean(termPick)));
      }
      if (termPick || edgePick) body.append(button("Clear link focus", () => select(selected), "trained-text-button"));
      const text = el("p", "inspect-body");
      text.id = "trained-passage-text";
      const reading = el("div", "trained-stack");
      const credits = el("div", "inspect-sources");
      if (entity()) credits.append(link("MetaQA source ↗", "https://github.com/yuyuz/MetaQA"));
      else credits.append(link("Wikipedia ↗", articleURL(label(selected))), link("Passage credits ↗", "assets/passages/sources.txt"));
      reading.append(text, credits);
      const readingBox = disclosure(entity() ? "Entity details" : "Read full passage", reading, readingOpen || Boolean(termPick));
      readingBox.addEventListener("toggle", () => {
        if (!readingBox.isConnected) return;
        readingOpen = readingBox.open;
        if (readingBox.open) readText(selected, text, node);
      });
      if (readingBox.open) readText(selected, text, node);
      body.append(readingBox);
      probe.append(body);
    }

    function render() {
      if (!data || !active) return;
      const scroll = content.scrollTop;
      const focused = document.activeElement;
      const refocus = content.contains(focused) && focused.tagName === "BUTTON" ? focused.textContent : null;
      content.replaceChildren();
      [corpusStage, poolStage, inputsStage, modelStage, rankingStage][stage]();
      content.scrollTop = scroll;
      if (refocus) [...content.querySelectorAll("button")].find(item => item.textContent === refocus)?.focus({ preventScroll: true });
      renderProbe();
    }

    by("trained-back").addEventListener("click", () => go(stage - 1));
    next.addEventListener("click", () => go(stage === 4 ? 0 : stage + 1));
    for (const button of tabs) button.addEventListener("click", () => go(Number(button.dataset.trainedStep)));
    return { open, close, go, select, pickEdge, currentStage: () => stage,
      togglePool: () => go(stage ? 0 : 1), clear: () => { edgePick = termPick = null; if (data) draw(); } };
  }

  window.SECOND_HOP_TRAINED_UI = create;
})();
