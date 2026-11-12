(() => {
  "use strict";

  const examples = window.SECOND_HOP_EXAMPLES;
  const families = {
    S: { name: "hyperlinks", color: "#8cdbdf", dash: [] },
    R: { name: "title rules", color: "#ed9ebd", dash: [7, 5] },
    N: { name: "shared names", color: "#c5d990", dash: [2, 5] },
    K: { name: "semantic links", color: "#bbabff", dash: [9, 4, 2, 4] },
  };
  const rankOrder = (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity);
  const formatNumber = new Intl.NumberFormat("en-US");
  const formatList = new Intl.ListFormat("en", { type: "conjunction" });
  const rankLabel = node => node.rank === null ? "Outside the recorded top 1,000" : `#${formatNumber.format(node.rank)}`;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stacked = window.matchMedia("(max-width: 1000px)");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const filters = [...document.querySelectorAll("[data-family]")];
  const byId = id => document.getElementById(id);
  const lab = byId("lab");
  const scene = byId("scene");
  const canvas = byId("edges");
  const graph = byId("nodes");
  const cases = byId("case-list");
  const supports = byId("support-list");
  const meter = byId("reach-meter");
  const source = byId("passage-source");
  const context = canvas.getContext("2d");

  let sample;
  let selected;
  let mode = "links";
  let reach;
  let supportNodes;
  let graphNodes;
  let supportButtons;
  let traceFrame = 0;
  const caseButtons = new Map();

  function assessReach() {
    const starts = new Set(sample.nodes.filter(node => node.rank !== null && node.rank <= 5).map(node => node.id));
    const links = new Map();
    const incoming = new Map();

    if (mode === "links") {
      for (const filter of filters.filter(input => input.checked && !input.disabled)) {
        const family = filter.dataset.family;
        for (const [a, b] of sample.edges[family]) {
          if (starts.has(a) === starts.has(b)) continue;
          const [from, to] = starts.has(a) ? [a, b] : [b, a];
          const key = `${from}-${to}`;
          if (!links.has(key)) links.set(key, { from, to, families: [] });
          links.get(key).families.push(family);
        }
      }
    }

    for (const edge of links.values()) {
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      incoming.get(edge.to).push(edge);
    }
    return { starts, incoming, edges: [...links.values()] };
  }

  function status(node) {
    if (reach.starts.has(node.id)) return "start";
    return reach.incoming.has(node.id) ? "linked" : "outside";
  }

  const statusLabels = {
    start: "In the first five",
    linked: "One link away",
    outside: "Out of reach",
  };

  function button(className) {
    const element = document.createElement("button");
    element.className = className;
    element.type = "button";
    return element;
  }

  function buildCasePicker() {
    for (const example of examples) {
      const control = button("case-button");
      const label = document.createElement("span");
      const dataset = document.createElement("span");
      const arrow = document.createElement("span");
      label.className = "case-label";
      label.textContent = example.label;
      dataset.className = "case-dataset";
      dataset.textContent = example.dataset === "2WikiMultihopQA" ? "2Wiki" : example.dataset;
      arrow.className = "case-arrow";
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      control.append(dataset, label, arrow);
      control.addEventListener("click", () => {
        openCase(example, true);
        const url = new URL(window.location.href);
        url.searchParams.set("case", example.id);
        history.replaceState(null, "", url);
        if (stacked.matches) {
          lab.focus({ preventScroll: true });
          lab.scrollIntoView({ behavior: reduceMotion.matches ? "instant" : "smooth" });
        }
      });
      cases.append(control);
      caseButtons.set(example.id, control);
    }
  }

  function makeGraphNode(node, [x, y]) {
    const control = button("graph-node");
    control.dataset.supporting = String(node.supporting);
    control.dataset.align = x < 20 ? "left" : x > 80 ? "right" : "center";
    control.style.left = `${x}%`;
    control.style.top = `${y}%`;

    const marker = document.createElement("span");
    marker.className = "node-marker";
    marker.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "node-label";
    label.setAttribute("aria-hidden", "true");
    const title = document.createElement("b");
    title.textContent = node.title;
    const rank = document.createElement("small");
    rank.textContent = rankLabel(node);
    label.append(title, rank);
    control.append(marker, label);
    control.addEventListener("click", () => selectNode(node.id));
    return control;
  }

  function buildGraph() {
    const otherNodes = sample.nodes.filter(node => !node.supporting).sort(rankOrder);
    const dense = supportNodes.length > 2;
    const supportPositions = dense ? [[24, 27], [74, 21], [78, 57], [28, 61]] : [[25, 40], [74, 55]];
    const otherPositions = dense ? [[11, 59], [47, 42], [55, 13], [55, 78], [91, 44], [39, 13]]
      : [[13, 72], [37, 74], [44, 19], [50, 80], [60, 32], [86, 24], [89, 78], [66, 77]];

    scene.parentElement.classList.toggle("dense", dense);
    graph.replaceChildren();
    graphNodes = new Map();
    for (const [nodes, positions] of [[supportNodes, supportPositions], [otherNodes, otherPositions]]) {
      nodes.forEach((node, index) => {
        const position = positions[index];
        const control = makeGraphNode(node, position);
        graph.append(control);
        graphNodes.set(node.id, { node, position, control });
      });
    }

    supports.replaceChildren();
    supportButtons = new Map();
    for (const node of supportNodes) {
      const control = button("support-button");
      const title = document.createElement("strong");
      const rank = document.createElement("span");
      const note = document.createElement("span");
      title.textContent = node.title;
      rank.className = "support-rank";
      rank.textContent = rankLabel(node);
      note.className = "support-status";
      control.append(rank, title, note);
      control.addEventListener("click", () => selectNode(node.id));
      supports.append(control);
      supportButtons.set(node.id, { control, note });
    }
  }

  function openCase(example, animate = false) {
    sample = example;
    supportNodes = sample.nodes.filter(node => node.supporting).sort(rankOrder);
    selected = supportNodes.find(node => node.rank === null || node.rank > 5)?.id ?? supportNodes[0].id;
    byId("question").textContent = sample.question;
    byId("dataset").textContent = sample.dataset;
    const hasHyperlinks = sample.dataset !== "MuSiQue";
    filters.find(input => input.dataset.family === "S").disabled = !hasHyperlinks;
    byId("dataset-note").hidden = hasHyperlinks;
    for (const [id, control] of caseButtons) control.setAttribute("aria-pressed", String(id === sample.id));
    buildGraph();
    renderReach(animate);
  }

  function renderReach(animate) {
    reach = assessReach();
    modeButtons.forEach(control => control.setAttribute("aria-pressed", String(control.dataset.mode === mode)));

    const count = supportNodes.filter(node => status(node) !== "outside").length;
    byId("reach-count").textContent = `${count} / ${supportNodes.length}`;
    meter.replaceChildren(...supportNodes.map(node => {
      const segment = document.createElement("i");
      segment.dataset.state = status(node);
      return segment;
    }));

    for (const { node, control } of graphNodes.values()) {
      const state = status(node);
      control.dataset.state = state;
      const kind = node.supporting ? "Supporting passage" : "Other passage";
      control.setAttribute("aria-label", `${node.title}. First search ${rankLabel(node)}. ${kind}. ${statusLabels[state]}.`);
      const support = supportButtons.get(node.id);
      if (support) {
        support.control.dataset.state = state;
        support.note.textContent = statusLabels[state];
      }
    }

    selectNode(selected);
    cancelAnimationFrame(traceFrame);
    drawGraph();
    if (animate && !reduceMotion.matches && reach.edges.some(edge => graphNodes.get(edge.to).node.supporting)) {
      const start = performance.now();
      const trace = now => {
        const progress = reduceMotion.matches ? 1 : Math.max(0, Math.min((now - start) / 800, 1));
        drawGraph(progress);
        if (progress < 1) traceFrame = requestAnimationFrame(trace);
      };
      traceFrame = requestAnimationFrame(trace);
    }
  }

  function selectNode(id) {
    selected = id;
    for (const [nodeId, { control }] of graphNodes) control.setAttribute("aria-pressed", String(nodeId === selected));
    for (const [nodeId, { control }] of supportButtons) control.setAttribute("aria-pressed", String(nodeId === selected));

    const node = graphNodes.get(id).node;
    const state = status(node);
    byId("passage-kind").textContent = node.supporting ? "Supporting passage" : "Other passage";
    byId("passage-rank").textContent = node.rank === null ? rankLabel(node) : `First search ${rankLabel(node)}`;
    byId("passage-title").textContent = node.title;
    byId("passage-text").textContent = node.text;
    byId("passage-path").dataset.state = state;
    if (state === "linked") {
      const origins = reach.incoming.get(id).map(edge => {
        const types = formatList.format(edge.families.map(family => families[family].name));
        return `${graphNodes.get(edge.from).node.title} (${types})`;
      });
      byId("passage-path").textContent = `One link from ${formatList.format(origins)}.`;
    } else if (state === "start") {
      byId("passage-path").textContent = "This passage is one of the first five results.";
    } else {
      byId("passage-path").textContent = mode === "links"
        ? "No enabled link connects this passage directly to the first five results."
        : "This passage is outside the first five results.";
    }
    source.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(node.title.replaceAll(" ", "_"))}`;
    source.setAttribute("aria-label", `Wikipedia article for ${node.title}`);
  }

  function drawGraph(progress = 1) {
    if (!context || !reach) return;
    const { width, height } = scene.getBoundingClientRect();
    if (!width || !height) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * scale);
    const pixelHeight = Math.round(height * scale);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);

    for (const edge of reach.edges) {
      const origin = graphNodes.get(edge.from);
      const target = graphNodes.get(edge.to);
      const [x1, y1] = [width * origin.position[0] / 100, height * origin.position[1] / 100];
      const [x2, y2] = [width * target.position[0] / 100, height * target.position[1] / 100];
      const bend = (y1 + y2) / 2 - Math.min(67, 12 + Math.abs(x2 - x1) * 0.14);
      const midpoint = (x1 + x2) / 2;
      const highlighted = target.node.supporting;
      const { color, dash } = families[edge.families[0]];

      context.beginPath();
      context.moveTo(x1, y1);
      context.quadraticCurveTo(midpoint, bend, x2, y2);
      context.strokeStyle = highlighted ? "#ffce8d" : color;
      context.setLineDash(highlighted ? [] : dash);
      if (highlighted) {
        context.globalAlpha = 0.13;
        context.lineWidth = 10;
        context.stroke();
      }
      context.globalAlpha = highlighted ? 0.86 : 0.34;
      context.lineWidth = highlighted ? 1.8 : 1.2;
      context.stroke();

      if (highlighted) {
        const inMotion = progress < 1;
        const t = inMotion ? progress : 0.5;
        const remaining = 1 - t;
        const pointX = remaining ** 2 * x1 + 2 * remaining * t * midpoint + t ** 2 * x2;
        const pointY = remaining ** 2 * y1 + 2 * remaining * t * bend + t ** 2 * y2;
        context.beginPath();
        context.arc(pointX, pointY, inMotion ? 4 : 2.8, 0, 2 * Math.PI);
        context.globalAlpha = 1;
        context.fillStyle = "#ffe6c4";
        context.fill();
      }
    }
  }

  modeButtons.forEach(control => control.addEventListener("click", () => {
    mode = control.dataset.mode;
    renderReach(true);
  }));
  filters.forEach(control => control.addEventListener("change", () => {
    mode = "links";
    renderReach(control.checked);
  }));
  const requested = new URLSearchParams(window.location.search).get("case");
  buildCasePicker();
  openCase(examples.find(example => example.id === requested) ?? examples[0]);
  new ResizeObserver(() => drawGraph()).observe(scene);
})();
