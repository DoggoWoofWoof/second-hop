(() => {
  "use strict";

  const records = window.SECOND_HOP_PIPELINE;
  const linkTypes = ["S", "R", "N", "K"];
  const linkLabels = { S: "hyperlink", R: "title rule", N: "shared name", K: "semantic link" };
  const shortNames = { "2WikiMultihopQA": "2Wiki", HotpotQA: "HotpotQA", MuSiQue: "MuSiQue" };
  const fullScale = {
    "2Wiki": [5989847, "1,081.2", "98.7%", "0.018%"],
    HotpotQA: [5233329, "706.0", "97.9%", "0.013%"],
    MuSiQue: [117534, "5,263.6", "97.8%", "4.48%"],
  };
  const timings = {
    "2Wiki": { end: [197.1, 201.7, 1.02, "1.01–1.04"], rerank: [20.0, 23.1, 1.15, "1.06–1.24"], forward: [3.2, 9.0, 2.81, "2.70–2.87"] },
    HotpotQA: { end: [176.6, 177.3, 1.00, "0.99–1.02"], rerank: [14.4, 15.2, 1.06, "0.96–1.22"], forward: [2.2, 5.9, 2.64, "2.58–2.74"] },
    MuSiQue: { end: [218.0, 255.3, 1.17, "1.14–1.19"], rerank: [78.3, 115.0, 1.47, "1.39–1.55"], forward: [13.2, 50.9, 3.86, "3.72–4.04"] },
  };
  const timingCopy = {
    end: "Includes the shared pool build, feature preparation, and scoring. The run starts with saved first-search results.",
    rerank: "Starts with the pool ready. Includes feature preparation and scoring for each model.",
    forward: "Times only the scoring pass. Feature preparation has already finished.",
  };
  const benchmarks = {
    "2Wiki": [65.3, 76.5, 90.4, 90.4],
    HotpotQA: [74.8, 94.5, 77.3, 96.3],
    MuSiQue: [43.5, 69.7, 53.2, 74.7],
  };
  const byId = id => document.getElementById(id);
  const number = new Intl.NumberFormat("en-US");
  const articlePaths = new Map([
    ["The Newcomers (film)", "The_Newcomers#Film"],
    ["The Newcomer in The Cabbage", "Vaniusha_The_Newcomer"],
  ]);
  const articleURL = title => `https://en.wikipedia.org/wiki/${articlePaths.get(title) ?? encodeURIComponent(title.replaceAll(" ", "_"))}`;
  window.SECOND_HOP_ARTICLE_URL = articleURL;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const depthControls = [...document.querySelectorAll("[data-depth]")];
  const recipeControls = [...document.querySelectorAll("[data-recipe]")];
  const stageControls = [...document.querySelectorAll("[data-pool-stage]")];
  const timingControls = [...document.querySelectorAll("[data-timing]")];
  const benchmarkControls = [...document.querySelectorAll("[data-benchmark]")];
  const poolPlay = byId("pool-play");
  const canvas = byId("pool-canvas");
  const context = canvas.getContext("2d");
  const messageGraph = byId("message-graph");
  const messageStatus = byId("message-status");
  const svg = "http://www.w3.org/2000/svg";

  let sample;
  let data;
  let dataset;
  let depth = 5;
  let mask = 15;
  let stage = "pool";
  let poolTimer = 0;
  let poolFrame = 0;
  let timingMode = "end";
  let benchmarkDataset = "2Wiki";
  let dots = [];
  let messageDots = [];
  let messageFrame = 0;

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function svgEl(tag, attrs) {
    const element = document.createElementNS(svg, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  }

  function pressed(controls, key, selected) {
    for (const control of controls) control.setAttribute("aria-pressed", String(control.dataset[key] === String(selected)));
  }

  function inspectPassage(node, className) {
    const anchor = el("a", className, node.title);
    anchor.href = "#evidence";
    anchor.addEventListener("click", () => document.dispatchEvent(new CustomEvent("secondhop:passage", { detail: node.id })));
    return anchor;
  }

  function poolReadout() {
    const [size, held, edges] = data.pools[depth][mask];
    const [, seedHeld] = data.pools[depth][0];
    return { size, held, edges, seedHeld };
  }

  function renderPool() {
    const { size, held, edges, seedHeld } = poolReadout();
    const nodes = new Map(sample.nodes.map(node => [node.id, node]));
    const keep = data.support.filter((_, i) => held & (1 << i)).length;
    const added = size - depth;
    const percent = (100 * size / data.corpus).toFixed(size / data.corpus < 0.01 ? 2 : 1);
    byId("pool-case").textContent = sample.label;
    byId("pool-corpus").textContent = number.format(data.corpus);
    byId("pool-seeds").textContent = number.format(depth);
    byId("pool-size").textContent = number.format(size);
    byId("pool-change").textContent = `${keep} of ${data.support.length} supporting passages in the pool.`;
    byId("pool-links").textContent = `${number.format(added)} neighbours added · ${number.format(edges)} distinct links within the pool · ${percent}% of the snapshot.`;

    const active = linkTypes.filter((_, bit) => mask & (1 << bit));
    byId("pool-evidence").replaceChildren(...data.support.map((id, index) => {
      const node = nodes.get(id);
      const item = el("li", "pool-evidence-row");
      const flag = 1 << index;
      const state = seedHeld & flag ? "start" : held & flag ? "linked" : "outside";
      const info = el("div", "pool-evidence-info");
      const first = node.rank === null ? "Outside the stored top 1,000" : `First search #${number.format(node.rank)}`;
      const label = el("span", "pool-evidence-status", { start: "Search hit", linked: "Added by link", outside: "Outside pool" }[state]);
      item.dataset.state = state;
      info.append(inspectPassage(node, "pool-evidence-title"), el("small", "", first));
      item.append(info, label);
      if (state === "linked") {
        const origin = active.map(family => ({ ...data.origins[id][family], family }))
          .filter(candidate => candidate.rank <= depth).sort((a, b) => a.rank - b.rank)[0];
        const note = el("p", "pool-origin", "via ");
        const source = el("a", "", `${origin.title} #${number.format(origin.rank)}`);
        source.href = articleURL(origin.title);
        source.target = "_blank";
        source.rel = "noopener";
        note.append(source, ` · ${linkLabels[origin.family]}`);
        item.append(note);
      }
      return item;
    }));

    pressed(depthControls, "depth", depth);
    const noHyperlinks = sample.dataset === "MuSiQue";
    recipeControls.find(control => control.dataset.recipe === "13").disabled = noHyperlinks;
    recipeControls.find(control => control.dataset.recipe === "15").hidden = noHyperlinks;
    pressed(recipeControls, "recipe", mask);
    setStage(stage);
  }

  function poolLayout(count, seeds, isCorpus) {
    const displayed = Math.min(180, count);
    const seedDots = isCorpus ? 0 : Math.max(1, Math.round(displayed * seeds / count));
    return Array.from({ length: 180 }, (_, index) => {
      const angle = index * 2.399963;
      const radius = Math.sqrt((index + 0.65) / displayed);
      const span = isCorpus ? 0.49 : 0.19 + Math.min(0.21, displayed / 850);
      return {
        x: 0.5 + Math.cos(angle) * radius * span,
        y: 0.46 + Math.sin(angle) * radius * (isCorpus ? 0.44 : 0.34),
        alpha: Number(index < displayed),
        color: isCorpus ? "#8e7aac" : index < seedDots ? "#bbabff" : "#ffce8d",
      };
    });
  }

  function paintPool() {
    if (!context) return;
    const { width, height } = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    for (const dot of dots) {
      if (dot.alpha < 0.02) continue;
      context.globalAlpha = dot.alpha;
      context.fillStyle = dot.color;
      context.beginPath();
      context.arc(dot.x * width, dot.y * height, stage === "seeds" && depth === 5 ? 4.1 : 2.15, 0, 2 * Math.PI);
      context.fill();
    }
  }

  function setStage(next) {
    stage = next;
    pressed(stageControls, "poolStage", stage);
    const { size } = poolReadout();
    const captions = {
      corpus: `${number.format(data.corpus)} passages in the benchmark snapshot`,
      seeds: `${number.format(depth)} starting passages from the fused ranking`,
      pool: `${number.format(depth)} starting passages + ${number.format(size - depth)} linked neighbours`,
    };
    byId("pool-stage-caption").textContent = captions[stage];
    const count = stage === "corpus" ? data.corpus : stage === "seeds" ? depth : size;
    const nextDots = poolLayout(count, depth, stage === "corpus");
    const before = dots;
    cancelAnimationFrame(poolFrame);
    if (!before.length || motion.matches) {
      dots = nextDots;
      paintPool();
      return;
    }
    const started = performance.now();
    function move(now) {
      const progress = motion.matches ? 1 : Math.max(0, Math.min(1, (now - started) / 650));
      const eased = 1 - (1 - progress) ** 3;
      dots = nextDots.map((dot, index) => {
        const previous = before[index];
        return {
          x: previous.x + (dot.x - previous.x) * eased,
          y: previous.y + (dot.y - previous.y) * eased,
          alpha: previous.alpha + (dot.alpha - previous.alpha) * eased,
          color: dot.alpha ? dot.color : previous.color,
        };
      });
      paintPool();
      if (progress < 1) poolFrame = requestAnimationFrame(move);
    }
    poolFrame = requestAnimationFrame(move);
  }

  function stopPoolReplay() {
    clearTimeout(poolTimer);
    poolTimer = 0;
    poolPlay.textContent = "Replay pool build ↻";
  }

  function replayPool() {
    if (poolTimer) {
      stopPoolReplay();
      return;
    }
    poolPlay.textContent = "Pause replay";
    setStage("corpus");
    poolTimer = window.setTimeout(() => {
      setStage("seeds");
      poolTimer = window.setTimeout(() => {
        setStage("pool");
        stopPoolReplay();
      }, 1100);
    }, 1050);
  }

  function rankLane(title, sub, hit, order, nodes) {
    const lane = el("section", "rank-lane");
    const header = el("div", "rank-lane-head");
    const count = el("p", "rank-hit", `${hit} / ${data.support.length}`);
    count.append(el("span", "", " supporting passages"));
    header.append(el("p", "rank-kind", sub), el("h3", "", title), count);
    lane.append(header);
    if (order.length) {
      const list = el("ol", "rank-list");
      for (const id of order) {
        const node = nodes.get(id);
        const row = el("li", "rank-row");
        row.dataset.supporting = String(node.supporting);
        row.append(inspectPassage(node, "rank-passage"));
        if (node.supporting) row.append(el("span", "rank-dot", "Supporting passage"));
        list.append(row);
      }
      lane.append(list);
    } else {
      const slots = el("div", "rank-coverage");
      slots.setAttribute("aria-hidden", "true");
      for (let index = 0; index < 5; index++) {
        const slot = el("i");
        if (index < hit) slot.className = "hit";
        slots.append(slot);
      }
      lane.append(slots, el("p", "lab-note", "Saved top-five coverage"));
    }
    return lane;
  }

  function renderRankings() {
    const nodes = new Map(sample.nodes.map(node => [node.id, node]));
    const [search, solo, graph] = data.ranking.hits;
    const order = sample.nodes.filter(node => node.rank !== null && node.rank <= 5).sort((a, b) => a.rank - b.rank).map(node => node.id);
    byId("rank-case").textContent = sample.label;
    byId("rank-lanes").replaceChildren(
      rankLane("First search", "Fused rank", search, order, nodes),
      rankLane("Passage-only MLP", "Independent scoring", solo, data.ranking.order.solo, nodes),
      rankLane("Graph GNN", "Neighbour-aware scoring", graph, data.ranking.order.graph, nodes),
    );
    const poolSize = data.ranking.size ? ` They scored the same saved pool of ${number.format(data.ranking.size)} candidates.` : "";
    byId("rank-note").textContent = `Saved model runs, seed 0.${poolSize}`;
    byId("full-rank-link").hidden = Boolean(data.ranking.order.solo.length);
    buildMessageGraph();
  }

  function buildMessageGraph() {
    cancelAnimationFrame(messageFrame);
    const coords = new Map();
    const support = sample.nodes.filter(node => node.supporting).sort((a, b) => (a.rank ?? 1001) - (b.rank ?? 1001));
    const other = sample.nodes.filter(node => !node.supporting);
    const dense = support.length > 2;
    const supportPositions = dense ? [[74, 55], [211, 110], [320, 37], [393, 104]] : [[83, 64], [356, 68]];
    const otherPositions = [[42, 110], [138, 26], [164, 100], [225, 49], [279, 114], [315, 24], [395, 24], [414, 114]];
    support.forEach((node, index) => coords.set(node.id, supportPositions[index]));
    other.forEach((node, index) => coords.set(node.id, otherPositions[index]));
    const paths = [];
    const seen = new Set();
    messageGraph.replaceChildren();
    messageDots = [];
    for (const family of ["R", "N", "K"]) {
      for (const [a, b] of sample.edges[family]) {
        const key = [a, b].sort((x, y) => x - y).join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        const [x1, y1] = coords.get(a);
        const [x2, y2] = coords.get(b);
        const control = [(x1 + x2) / 2, (y1 + y2) / 2 - 22];
        const prominent = support.some(node => node.id === a || node.id === b);
        paths.push(svgEl("path", { d: `M ${x1} ${y1} Q ${control.join(" ")} ${x2} ${y2}`, class: prominent ? "message-edge primary" : "message-edge" }));
        const dot = svgEl("circle", { cx: x1, cy: y1, r: prominent ? 3.5 : 2.2, class: prominent ? "message-dot primary" : "message-dot", opacity: 0 });
        messageDots.push({ dot, x1, y1, x2, y2, control });
      }
    }
    const nodes = sample.nodes.map(node => {
      const [x, y] = coords.get(node.id);
      return svgEl("circle", { cx: x, cy: y, r: node.supporting ? 6.5 : 3.6, class: node.supporting ? "message-node primary" : "message-node" });
    });
    const labels = support.map(node => {
      const [x, y] = coords.get(node.id);
      const label = svgEl("text", { x, y: y + 21, class: "message-label", "text-anchor": "middle" });
      label.textContent = node.title.length > 22 ? `${node.title.slice(0, 20)}…` : node.title;
      return label;
    });
    messageGraph.append(...paths, ...nodes, ...labels, ...messageDots.map(item => item.dot));
    messageStatus.textContent = "Visible passage links · propagation illustrated";
  }

  function playMessages() {
    cancelAnimationFrame(messageFrame);
    if (motion.matches) {
      for (const { dot } of messageDots) dot.setAttribute("opacity", 0);
      messageStatus.textContent = "Three rounds · each passage updates from its neighbours.";
      return;
    }
    const started = performance.now();
    let lastRound = -1;
    function frame(now) {
      const elapsed = Math.max(0, (now - started) / 780);
      const round = Math.floor(elapsed);
      if (round > 2) {
        for (const { dot } of messageDots) dot.setAttribute("opacity", 0);
        messageStatus.textContent = "Three rounds complete · score each passage.";
        return;
      }
      if (round !== lastRound) messageStatus.textContent = `Round ${round + 1} of 3 · neighbours exchange updates`;
      lastRound = round;
      for (const [index, { dot, x1, y1, x2, y2, control }] of messageDots.entries()) {
        const phase = Math.max(0, Math.min(1, (elapsed - round - (index % 5) * 0.025) / 0.87));
        const t = round % 2 ? 1 - phase : phase;
        const remaining = 1 - t;
        dot.setAttribute("cx", remaining ** 2 * x1 + 2 * remaining * t * control[0] + t ** 2 * x2);
        dot.setAttribute("cy", remaining ** 2 * y1 + 2 * remaining * t * control[1] + t ** 2 * y2);
        dot.setAttribute("opacity", phase > 0 && phase < 1 ? 1 : 0);
      }
      messageFrame = requestAnimationFrame(frame);
    }
    messageFrame = requestAnimationFrame(frame);
  }

  function renderBars(container, labels, values, unit, limit, animate) {
    container.replaceChildren(...labels.map((name, index) => {
      const row = el("div", "chart-row");
      const meter = el("span", "chart-track");
      const fill = el("i", "chart-fill");
      fill.style.width = `${100 * values[index] / limit}%`;
      fill.style.setProperty("--bar-time", `${Math.round(960 * values[index] / limit)}ms`);
      if (animate) fill.classList.add("run");
      meter.setAttribute("aria-hidden", "true");
      meter.append(fill);
      row.append(el("span", "chart-label", name), meter, el("strong", "chart-value", `${values[index].toFixed(1)}${unit}`));
      return row;
    }));
  }

  function renderTiming(animate) {
    pressed(timingControls, "timing", timingMode);
    byId("timing-dataset").textContent = dataset;
    const [solo, graph, ratio, interval] = timings[dataset][timingMode];
    renderBars(byId("timing-chart"), ["MLP", "GNN"], [solo, graph], " ms", Math.max(solo, graph), animate);
    const summary = el("strong", "", `${ratio.toFixed(2)}× GNN / MLP`);
    byId("timing-description").replaceChildren(summary, ` · 95% interval ${interval}. ${timingCopy[timingMode]}`);
  }

  function renderBenchmark(animate) {
    pressed(benchmarkControls, "benchmark", benchmarkDataset);
    renderBars(byId("benchmark-chart"), ["BM25", "NV-Embed-v2", "HippoRAG (reproduced)", "HippoRAG 2"],
      benchmarks[benchmarkDataset], "%", 100, animate);
  }

  function renderScale() {
    const [corpus, pool, support, share] = fullScale[dataset];
    byId("scale-dataset").textContent = dataset;
    byId("scale-corpus").textContent = number.format(corpus);
    byId("scale-pool").textContent = `${pool} (${share})`;
    byId("scale-recall").textContent = support;
  }

  document.addEventListener("secondhop:state", ({ detail }) => {
    const nextMask = linkTypes.reduce((value, key, bit) => value | (detail.families.includes(key) ? 1 << bit : 0), 0);
    const changedCase = sample !== detail.sample;
    if (!changedCase && nextMask === mask) return;
    sample = detail.sample;
    data = records[sample.id];
    mask = nextMask;
    stopPoolReplay();
    stage = "pool";
    renderPool();
    if (!changedCase) return;
    dataset = shortNames[sample.dataset];
    benchmarkDataset = dataset;
    renderScale();
    renderRankings();
    renderTiming(false);
    renderBenchmark(false);
  });
  for (const control of depthControls) control.addEventListener("click", () => {
    depth = Number(control.dataset.depth);
    stopPoolReplay();
    stage = "pool";
    renderPool();
  });
  for (const control of recipeControls) control.addEventListener("click", () => {
    const chosen = Number(control.dataset.recipe);
    document.dispatchEvent(new CustomEvent("secondhop:links", { detail: linkTypes.filter((_, bit) => chosen & (1 << bit)) }));
  });
  for (const control of stageControls) control.addEventListener("click", () => {
    stopPoolReplay();
    setStage(control.dataset.poolStage);
  });
  for (const control of timingControls) control.addEventListener("click", () => {
    timingMode = control.dataset.timing;
    renderTiming(true);
  });
  for (const control of benchmarkControls) control.addEventListener("click", () => {
    benchmarkDataset = control.dataset.benchmark;
    renderBenchmark(true);
  });
  poolPlay.addEventListener("click", replayPool);
  byId("message-play").addEventListener("click", playMessages);
  byId("timing-play").addEventListener("click", () => renderTiming(true));
  new ResizeObserver(paintPool).observe(canvas);
})();
