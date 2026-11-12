(() => {
  "use strict";

  const records = window.SECOND_HOP_PIPELINE;
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
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timingControls = [...document.querySelectorAll("[data-timing]")];
  const benchmarkControls = [...document.querySelectorAll("[data-benchmark]")];
  const messageGraph = byId("message-graph");
  const messageStatus = byId("message-status");
  const svg = "http://www.w3.org/2000/svg";

  let sample;
  let data;
  let dataset;
  let timingMode = "end";
  let benchmarkDataset = "2Wiki";
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
    anchor.addEventListener("click", event => {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent("secondhop:passage", { detail: node.id }));
    });
    return anchor;
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
    if (sample === detail.sample) return;
    sample = detail.sample;
    data = records[sample.id];
    dataset = shortNames[sample.dataset];
    benchmarkDataset = dataset;
    renderScale();
    renderRankings();
    renderTiming(false);
    renderBenchmark(false);
  });
  for (const control of timingControls) control.addEventListener("click", () => {
    timingMode = control.dataset.timing;
    renderTiming(true);
  });
  for (const control of benchmarkControls) control.addEventListener("click", () => {
    benchmarkDataset = control.dataset.benchmark;
    renderBenchmark(true);
  });
  byId("message-play").addEventListener("click", playMessages);
  byId("timing-play").addEventListener("click", () => renderTiming(true));
})();
