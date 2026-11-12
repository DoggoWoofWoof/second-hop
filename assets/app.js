(() => {
  "use strict";

  const examples = window.SECOND_HOP_EXAMPLES;
  const records = window.SECOND_HOP_PIPELINE;
  const { families, articleURL, otherEnd, terms, explanation, highlights } = window.SECOND_HOP_LINKS;
  const { budgets, prepare, run, neighbourhood } = window.SECOND_HOP_RETRIEVAL;
  const byId = id => document.getElementById(id);
  const format = new Intl.NumberFormat("en-US").format;
  const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 }).format;
  const rank = value => value ? "#" + format(value) : "—";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const chooseDataset = byId("flow-dataset-select");
  const chooseCase = byId("flow-case");
  const budget = byId("flow-budget");
  const depth = byId("graph-depth");
  const familyButtons = new Map();
  const panelButtons = [...document.querySelectorAll("[data-panel]")];
  const steps = ["lab", "ppr", "pool", "features", "models", "rankers"];
  const stepNames = ["Seeds", "PPR", "Pool", "Inputs", "Models", "Top five"];
  const research = byId("research");
  const archivePanes = [...document.querySelectorAll("[data-research-pane]")];
  const archiveButtons = [...document.querySelectorAll("[data-archive-target]")];
  const find = byId("passage-find");
  const traces = new Map();
  const texts = new Map();
  const exclusions = new Map();
  const params = new URLSearchParams(location.search);
  const initial = examples.find(example => example.id === params.get("case")) ?? examples[0];
  const enabled = new Set(params.has("links") && /^[SRNK]*$/.test(params.get("links")) ? params.get("links") : Object.keys(families));
  if (params.has("skip")) {
    const ids = params.get("skip").split(",").filter(id => /^\d+$/.test(id)).map(Number);
    exclusions.set(initial.id, new Set(ids));
  }

  let panel = steps.includes(location.hash.slice(1)) ? location.hash.slice(1) : "inspect";
  let lastStep = panel === "inspect" ? "lab" : panel;
  let shrunk = params.has("pool") ? params.get("pool") === "1" : ["#pool", "#shortlist", "#rankers"].includes(location.hash);
  let paused = motion.matches;
  let sample, trace, result, graph, planned, selection;
  let loadSequence = 0;
  let allSeeds = false;
  let allConnections = false;
  let searchMatches = [];
  const scene = window.SECOND_HOP_SCENE(byId("pipeline-canvas"), {
    node: id => { if (!runUI.probeFromGraph(id)) inspectNode(id); },
    edge: (edge, type) => inspectEdge(edge, type),
    clear: () => {
      if (panel !== "inspect" || !selection) return;
      selection = { id: selection.id, focused: false };
      renderInspector();
    },
  });
  const runUI = window.SECOND_HOP_RUN_UI({ scene, rebuild: updateSettings, togglePool, readPassage: id => inspectNode(id, true), save: writeURL });

  function el(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function button(className, text, activate) {
    const item = el("button", className, text);
    item.type = "button";
    if (activate) item.addEventListener("click", activate);
    return item;
  }

  function activeFamilies() {
    return [...enabled].filter(type => type !== "S" || sample.dataset !== "MuSiQue");
  }

  function selectPanel(id, store = true) {
    const usesWalk = panel === "ppr" && id === "pool" && runUI.followWalk();
    panel = id;
    if (id !== "inspect") lastStep = id;
    const step = steps.indexOf(id);
    const inRun = step >= 0;
    byId("run-tab").setAttribute("aria-pressed", String(inRun));
    byId("run-panel").hidden = !inRun;
    byId("graph-pipeline").textContent = inRun ? "Inspect passages" : "Run pipeline →";
    byId("run-back").disabled = step <= 0;
    byId("run-next").disabled = step >= steps.length - 1;
    byId("run-next").textContent = step >= steps.length - 1 ? "Finished" : "Next: " + stepNames[step + 1] + " →";
    for (const control of panelButtons) {
      const active = control.dataset.panel === id;
      if (control.dataset.panel === "inspect") control.setAttribute("aria-pressed", String(active));
      else if (active) control.setAttribute("aria-current", "step");
      else control.removeAttribute("aria-current");
      byId(control.dataset.panel).hidden = !active;
    }
    const wasShrunk = shrunk;
    if (id === "ppr") shrunk = false;
    if (["features", "models", "rankers"].includes(id)) shrunk = true;
    if (graph && (wasShrunk !== shrunk || usesWalk)) renderGraph();
    else if (graph) displayRun();
    if (id === "inspect" && graph) renderInspector();
    if (store && trace) writeURL();
  }

  function writeURL() {
    const url = new URL(location.href);
    url.searchParams.set("case", sample.id);
    url.searchParams.set("budget", budget.value);
    url.searchParams.set("depth", depth.value);
    url.searchParams.set("links", Object.keys(families).filter(type => enabled.has(type)).join(""));
    url.searchParams.delete("boost");
    runUI.writeParams(url.searchParams);
    if (shrunk) url.searchParams.set("pool", "1");
    else url.searchParams.delete("pool");
    const skipped = exclusions.get(sample.id);
    if (skipped.size) url.searchParams.set("skip", [...skipped].join(","));
    else url.searchParams.delete("skip");
    url.hash = panel === "inspect" ? "links" : panel;
    history.replaceState(null, "", url);
  }

  async function json(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(path + " HTTP " + response.status);
    return response.json();
  }

  function loadTexts(example, prepared) {
    if (!texts.has(example.id)) {
      const request = json("assets/passages/" + example.id + ".json?v=2").then(data => {
        for (const [id, text] of Object.entries(data.text)) prepared.passages.get(Number(id)).text = text;
        prepared.names = data.names;
        prepared.fullText = true;
      }).catch(() => {
        prepared.textError = true;
        texts.delete(example.id);
      });
      texts.set(example.id, request);
    }
    return texts.get(example.id);
  }

  async function load(id, store = true) {
    const sequence = ++loadSequence;
    const previous = sample;
    sample = examples.find(example => example.id === id) ?? examples[0];
    const example = sample;
    chooseDataset.value = example.dataset;
    if (previous?.dataset !== example.dataset) {
      chooseCase.replaceChildren(...examples.filter(item => item.dataset === example.dataset).map(item => new Option(item.label, item.id)));
    }
    chooseCase.value = example.id;
    byId("flow-question").textContent = example.question;
    if (!exclusions.has(example.id)) exclusions.set(example.id, new Set());
    if (previous && previous !== example) shrunk = false;
    trace = result = graph = planned = selection = undefined;
    runUI.display("inspect", null);
    allSeeds = allConnections = false;
    find.value = "";
    byId("graph-workspace").hidden = true;
    byId("graph-loading").hidden = false;
    byId("graph-error").hidden = true;
    byId("pipeline").setAttribute("aria-busy", "true");
    if (store) writeURL();
    try {
      if (!traces.has(example.id)) {
        const snapshot = await json("assets/traces/" + example.id + ".json?v=2");
        const prepared = prepare(example, records[example.id], snapshot);
        prepared.names = Object.fromEntries(Object.entries(records[example.id].linkDetails).map(([key, info]) => [key, info.names]));
        traces.set(example.id, prepared);
      }
      if (sequence !== loadSequence) return;
      trace = traces.get(example.id);
      byId("graph-workspace").hidden = false;
      selectPanel(panel, false);
      renderGraph(true);
      document.dispatchEvent(new CustomEvent("secondhop:state", { detail: { sample } }));
      loadTexts(example, trace).then(() => { if (sequence === loadSequence) renderInspector(); });
    } catch (error) {
      if (sequence !== loadSequence) return;
      byId("graph-workspace").hidden = true;
      byId("graph-error").hidden = false;
      console.error(error);
    } finally {
      if (sequence === loadSequence) {
        byId("graph-loading").hidden = true;
        byId("pipeline").setAttribute("aria-busy", "false");
      }
    }
  }

  function renderGraph(fresh = false) {
    if (!trace) return;
    const n = Number(budget.value);
    if (Number(depth.value) < n) depth.value = budget.value;
    for (const option of depth.options) option.disabled = Number(option.value) < n;
    const types = activeFamilies();
    const horizon = Number(depth.value);
    result = run(trace, n, types, 0, exclusions.get(sample.id));
    const wide = neighbourhood(trace, horizon, types, result, false);
    const key = [sample.id, horizon, [...types].sort().join(""), [...result.seedIds].join(",")].join("/");
    runUI.configure({ sample, trace, result, wide, key });
    planned = runUI.getPlan();
    graph = shrunk ? neighbourhood(trace, horizon, types, result, true, planned.ids) : wide;
    if (!selection || !graph.ids.has(selection.id)) {
      const id = result.seeds[0]?.id ?? graph.nodes[0]?.id;
      selection = id === undefined ? null : { id, focused: false };
    }
    scene.show(graph, result, { fresh, shrunk });
    const edges = graph.pairs.filter(pair => pair.active.length).length;
    const size = graph.nodes.length;
    byId("graph-title").textContent = shrunk ? "Candidate pool" : "Search neighbourhood";
    const support = trace.support.filter(node => planned.ids.has(node.id)).length;
    byId("graph-scope").textContent = shrunk ? format(size) + " of " + format(graph.scope) + " passages kept · " + support + "/" + trace.support.length + " supporting"
      : depth.value + " search hits + neighbours · " + format(planned.ids.size) + " in the shortlist";
    byId("graph-nodes").textContent = format(size);
    byId("graph-edges").textContent = format(edges);
    byId("graph-density").textContent = percent(size > 1 ? 2 * edges / (size * (size - 1)) : 0);
    byId("graph-empty").hidden = Boolean(size);
    byId("graph-hint").textContent = edges > 4500 ? "Select a passage to see every link attached to it. Drag nodes or the background to explore."
      : "Drag a passage or the background. Click a dot or a line to inspect it.";
    const shrink = byId("graph-shrink");
    shrink.setAttribute("aria-pressed", String(shrunk));
    shrink.textContent = shrunk ? "Restore cluster ↗" : "Shrink pool ↘";
    for (const [type, { control, count }] of familyButtons) {
      const available = type !== "S" || sample.dataset !== "MuSiQue";
      const recorded = graph.pairs.filter(pair => pair.types.includes(type)).length;
      control.disabled = !available;
      control.setAttribute("aria-pressed", String(available && enabled.has(type)));
      control.title = available ? format(recorded) + " recorded " + families[type].title.toLowerCase() : "This dataset does not preserve article hyperlinks";
      count.textContent = format(recorded);
    }
    renderInspector();
    renderSearch();
    displayRun();
    renderFind();
  }

  function displayRun() {
    const needsPool = ["features", "models", "rankers"].includes(panel);
    const pool = needsPool ? (shrunk ? graph : neighbourhood(trace, Number(depth.value), activeFamilies(), result, true, planned.ids)) : null;
    runUI.display(panel, { graph, pool, shrunk });
  }

  function rowFor(node, detail, action, types = []) {
    const row = el("li");
    const item = button("passage-row", undefined, action);
    const copy = el("span");
    copy.append(el("strong", "", node.title));
    if (detail) copy.append(el("small", "", detail));
    item.append(copy);
    if (types.length) {
      const swatches = el("span", "edge-swatches");
      swatches.setAttribute("aria-label", types.map(type => families[type].label).join(", "));
      for (const type of types) {
        const dot = el("i");
        dot.style.setProperty("--edge", families[type].color);
        swatches.append(dot);
      }
      item.append(swatches);
    }
    row.append(item);
    return row;
  }

  function inspectNode(id, locate = false) {
    if (!graph?.ids.has(id)) return;
    selection = { id, focused: true };
    allConnections = false;
    selectPanel("inspect");
    renderInspector();
    if (locate) scene.locate(id);
  }

  function inspectEdge(edge, type, keepEnd = false) {
    const focusNode = [edge.a, edge.b].find(node => node.id === selection?.id);
    const ends = focusNode ? [focusNode, otherEnd(edge, focusNode)] : [edge.a, edge.b];
    const node = (keepEnd && focusNode) || ends.find(item => terms(edge, type, item, trace.names).length) || ends[0];
    selection = { id: node.id, edge: edge.key, type, focused: true };
    allConnections = false;
    selectPanel("inspect");
    renderInspector();
  }

  function phraseIndex(node, connections) {
    const phrases = new Map();
    for (const edge of connections) {
      for (const type of edge.active) {
        for (const phrase of terms(edge, type, node, trace.names)) {
          const key = phrase.toLowerCase();
          if (!phrases.has(key)) phrases.set(key, { phrase, routes: new Map() });
          const routes = phrases.get(key).routes;
          if (!routes.has(edge.key)) routes.set(edge.key, new Set());
          routes.get(edge.key).add(type);
        }
      }
    }
    return phrases;
  }

  function renderPassageText(node, phrases) {
    const body = byId("inspect-body");
    const focused = document.activeElement?.dataset.term;
    if (!node.text) {
      body.textContent = trace.textError ? "The saved passage didn’t load. Open its Wikipedia page below." : "Loading the benchmark passage…";
      return;
    }
    const text = node.text;
    const spans = highlights(text, Array.from(phrases, ([key, info]) => [key, info.phrase]));
    const contents = [];
    let cursor = 0;
    for (const { key, start, end } of spans) {
      contents.push(text.slice(cursor, start));
      const term = button("evidence-term", text.slice(start, end), () => {
        selection.term = selection.term === key ? undefined : key;
        selection.edge = selection.type = undefined;
        selection.focused = true;
        allConnections = false;
        renderInspector();
      });
      term.dataset.term = key;
      term.title = "Trace this phrase to connected passages";
      term.setAttribute("aria-pressed", String(selection.term === key));
      contents.push(term);
      cursor = end;
    }
    contents.push(text.slice(cursor));
    body.replaceChildren(...contents);
    if (focused) [...body.querySelectorAll("[data-term]")].find(term => term.dataset.term === focused)?.focus({ preventScroll: true });
  }

  function renderEdge(edge, node) {
    const details = byId("inspect-edge");
    details.hidden = !edge;
    if (!edge) return;
    const type = edge.active.includes(selection.type) ? selection.type : edge.active[0];
    selection.type = type;
    details.style.setProperty("--edge", families[type].color);
    const heading = el("strong", "", families[type].label);
    const reason = el("p", "", explanation(edge, type, trace.names));
    const endpoints = el("div", "inspect-edge-actions");
    for (const endpoint of [edge.a, edge.b]) {
      const option = button("", endpoint.title, () => {
        selection.id = endpoint.id;
        renderInspector();
      });
      option.setAttribute("aria-pressed", String(endpoint.id === node.id));
      endpoints.append(option);
    }
    const options = el("div", "inspect-edge-actions");
    if (edge.active.length > 1) {
      for (const family of edge.active) {
        const option = button("", families[family].label, () => inspectEdge(edge, family));
        option.setAttribute("aria-pressed", String(family === type));
        options.append(option);
      }
    }
    details.replaceChildren(heading, reason, endpoints, options);
  }

  function renderInspector() {
    if (!graph) return;
    const entry = selection && trace.passages.get(selection.id);
    byId("passage-inspector").hidden = !entry;
    byId("inspect-empty").hidden = Boolean(entry);
    const openPassage = byId("graph-open-passage");
    openPassage.hidden = !entry || !selection.focused;
    if (!entry) {
      scene.setFocus(null);
      return;
    }
    const node = entry;
    const pinned = scene.isPinned(node.id);
    const pin = byId("inspect-pin");
    pin.textContent = pinned ? "Unpin" : "Pin";
    pin.setAttribute("aria-pressed", String(pinned));
    byId("inspect-title").textContent = node.title;
    openPassage.textContent = node.title + " · Read passage ↓";
    byId("inspect-source").href = articleURL(node.title);
    const witness = result.origins.get(node.id);
    const role = result.seedIds.has(node.id) ? "Seed " + rank(node.rank)
      : witness ? "Via " + witness.from.title : node.rank ? "Search " + rank(node.rank) : "Benchmark passage";
    byId("inspect-meta").textContent = node.supporting ? role + " · Supporting" : role;

    const incident = (graph.incident.get(node.id) ?? []).filter(edge => edge.active.length);
    const phrases = phraseIndex(node, incident);
    const word = phrases.get(selection.term);
    if (!word) selection.term = undefined;
    const edge = incident.find(item => item.key === selection.edge);
    if (!edge) selection.edge = selection.type = undefined;
    renderEdge(edge, node);
    const displayedPhrases = edge ? new Map([...phrases].filter(([, phrase]) => phrase.routes.get(edge.key)?.has(selection.type))) : phrases;
    renderPassageText(node, displayedPhrases);

    const options = word ? incident.filter(item => word.routes.has(item.key)) : incident;
    const count = options.length;
    byId("inspect-count").textContent = word ? "“" + word.phrase + "” · " + count + (count === 1 ? " connection" : " connections")
      : format(count) + (count === 1 ? " connection" : " connections");
    byId("inspect-clear").hidden = !word && !edge && !selection.focused;
    byId("inspect-instruction").textContent = word ? "These passages connect through the selected phrase."
      : displayedPhrases.size ? "Click a highlighted phrase to trace it through the graph."
      : count ? "Select a connection to read its evidence." : "No enabled links connect this passage in this view.";

    const ordered = [...options].sort((a, b) => {
      const left = otherEnd(a, node), right = otherEnd(b, node);
      return Number(b === edge) - Number(a === edge) || Number(right.supporting) - Number(left.supporting) ||
        b.active.length - a.active.length || (left.rank || Infinity) - (right.rank || Infinity) || left.title.localeCompare(right.title);
    });
    byId("inspect-connections").replaceChildren(...(allConnections ? ordered : ordered.slice(0, 6)).map(item => {
      const other = otherEnd(item, node);
      const kinds = word ? [...word.routes.get(item.key)] : item.active;
      const row = rowFor(other, kinds.map(type => families[type].label).join(" · "), () => inspectEdge(item, kinds[0], true), kinds);
      row.firstChild.setAttribute("aria-pressed", String(item === edge));
      return row;
    }));
    const more = byId("inspect-more");
    more.hidden = count <= 6;
    more.textContent = allConnections ? "Show fewer connections" : "Show all " + format(count) + " connections";

    let routes = word?.routes;
    if (!routes && edge) routes = new Map([[edge.key, new Set([selection.type])]]);
    if (!routes) routes = new Map(incident.map(item => [item.key, new Set(item.active)]));
    if (panel === "inspect") scene.setFocus(selection.focused ? node.id : null, routes);
  }

  function renderFind() {
    if (!graph) return;
    const query = find.value.toLowerCase().trim();
    searchMatches = query ? graph.nodes.filter(node => node.title.toLowerCase().includes(query))
      .sort((a, b) => Number(b.title.toLowerCase().startsWith(query)) - Number(a.title.toLowerCase().startsWith(query)) ||
        (a.rank || Infinity) - (b.rank || Infinity) || a.title.localeCompare(b.title)).slice(0, 6) : [];
    const list = byId("passage-matches");
    list.hidden = !query;
    list.replaceChildren(...(searchMatches.length ? searchMatches.map(node => rowFor(node, "Search " + rank(node.rank), () => {
      find.value = "";
      renderFind();
      inspectNode(node.id, true);
    })) : [el("li", "inspect-instruction", "No matching passage in this view.")]));
  }

  function renderSearch() {
    const { hits, seedIds } = result;
    byId("search-summary").textContent = seedIds.size + " of " + hits.length + " hits are active seeds. Uncheck one to see what it contributes.";
    const visible = allSeeds || hits.length <= 5 ? hits : [...hits.slice(0, 4), hits.at(-1)];
    const focus = document.activeElement?.dataset.seed;
    const rows = visible.map(node => {
      const row = rowFor(node, rank(node.rank) + " fused · Words " + rank(node.words) + " · Meaning " + rank(node.meaning), () => {
        if (!graph.ids.has(node.id)) {
          shrunk = false;
          renderGraph();
        }
        if (runUI.probeFromGraph(node.id)) scene.locate(node.id);
        else inspectNode(node.id, true);
      });
      const label = el("label", "seed-check");
      const check = el("input");
      check.type = "checkbox";
      check.checked = seedIds.has(node.id);
      check.dataset.seed = node.id;
      check.setAttribute("aria-label", "Use " + node.title + " as a seed");
      check.addEventListener("change", () => {
        const excluded = exclusions.get(sample.id);
        if (check.checked) excluded.delete(node.id);
        else excluded.add(node.id);
        updateSettings();
      });
      label.append(check, el("span", "", "Seed"));
      row.append(label);
      return row;
    });
    byId("search-rows").replaceChildren(...rows);
    if (focus) byId("search-rows").querySelector('[data-seed="' + focus + '"]')?.focus({ preventScroll: true });
    byId("search-reset").hidden = seedIds.size === hits.length;
    const toggle = byId("search-all");
    toggle.hidden = hits.length <= 5;
    toggle.textContent = allSeeds ? "Show fewer hits" : "Show all " + hits.length + " hits";
  }

  function togglePool() {
    shrunk = !shrunk;
    updateSettings();
  }

  function updateSettings() {
    if (!trace) return;
    renderGraph();
    writeURL();
  }

  function openArchive(target) {
    for (const pane of archivePanes) pane.hidden = pane.id !== target;
    for (const control of archiveButtons) control.setAttribute("aria-pressed", String(control.dataset.archiveTarget === target));
    if (!research.open) research.showModal();
    research.querySelector(".research-content").scrollTop = 0;
  }

  function openHash() {
    const hash = location.hash.slice(1);
    if (archivePanes.some(pane => pane.id === hash)) openArchive(hash);
    if (!trace) return;
    if (["top", "corpus", "shortlist", "links"].includes(hash)) {
      shrunk = hash === "shortlist" || (hash === "links" && new URLSearchParams(location.search).get("pool") === "1");
      selectPanel("inspect", false);
      renderGraph();
    } else if (steps.includes(hash)) selectPanel(hash, false);
  }

  if (budgets.includes(Number(params.get("budget")))) budget.value = params.get("budget");
  if ([25, 100, 200].includes(Number(params.get("depth")))) depth.value = params.get("depth");
  for (const dataset of new Set(examples.map(example => example.dataset))) chooseDataset.add(new Option(dataset, dataset));
  for (const [type, info] of Object.entries(families)) {
    const control = button("galaxy-family", undefined, () => {
      if (enabled.has(type)) enabled.delete(type);
      else enabled.add(type);
      updateSettings();
    });
    const count = el("small");
    control.style.setProperty("--edge", info.color);
    control.dataset.family = type;
    control.append(el("i"), el("span", "", info.title), count);
    familyButtons.set(type, { control, count });
    byId("graph-families").append(control);
  }

  chooseDataset.addEventListener("change", () => load(examples.find(example => example.dataset === chooseDataset.value).id));
  chooseCase.addEventListener("change", () => load(chooseCase.value));
  byId("graph-retry").addEventListener("click", () => load(chooseCase.value));
  for (const control of [budget, depth]) control.addEventListener("change", updateSettings);
  panelButtons.forEach(control => control.addEventListener("click", () => selectPanel(control.dataset.panel)));
  byId("run-tab").addEventListener("click", () => selectPanel(lastStep));
  byId("run-back").addEventListener("click", () => selectPanel(steps[steps.indexOf(panel) - 1]));
  byId("run-next").addEventListener("click", () => selectPanel(steps[steps.indexOf(panel) + 1]));
  byId("graph-pipeline").addEventListener("click", () => {
    const opening = panel === "inspect";
    selectPanel(opening ? lastStep : "inspect");
    if (opening && matchMedia("(max-width: 860px)").matches) byId("run-tab").scrollIntoView({ block: "center", behavior: motion.matches ? "auto" : "smooth" });
  });
  byId("graph-shrink").addEventListener("click", togglePool);
  const pauseControl = byId("graph-pause");
  function syncPause() {
    pauseControl.textContent = paused ? "Resume" : "Pause";
    pauseControl.setAttribute("aria-pressed", String(paused));
    scene.pause(paused);
  }
  pauseControl.addEventListener("click", () => { paused = !paused; syncPause(); });
  byId("inspect-pin").addEventListener("click", () => {
    scene.pin(selection.id, !scene.isPinned(selection.id));
    renderInspector();
  });
  byId("inspect-clear").addEventListener("click", () => {
    const id = selection.id;
    selection = { id, focused: false };
    renderInspector();
  });
  byId("inspect-more").addEventListener("click", () => { allConnections = !allConnections; renderInspector(); });
  byId("search-all").addEventListener("click", () => { allSeeds = !allSeeds; renderSearch(); });
  byId("search-reset").addEventListener("click", () => { exclusions.get(sample.id).clear(); updateSettings(); });
  byId("graph-open-passage").addEventListener("click", () => byId("inspect").scrollIntoView({ block: "start", behavior: motion.matches ? "auto" : "smooth" }));
  find.addEventListener("input", renderFind);
  find.addEventListener("keydown", event => {
    if (event.key !== "Enter" || !searchMatches.length) return;
    const id = searchMatches[0].id;
    find.value = "";
    renderFind();
    inspectNode(id, true);
  });
  for (const link of document.querySelectorAll("[data-open-research]")) link.addEventListener("click", event => {
    event.preventDefault();
    openArchive(link.hash.slice(1));
  });
  archiveButtons.forEach(control => control.addEventListener("click", () => openArchive(control.dataset.archiveTarget)));
  byId("research-close").addEventListener("click", () => research.close());
  window.addEventListener("hashchange", openHash);
  syncPause();
  load(initial.id, false).then(() => {
    if (archivePanes.some(pane => pane.id === location.hash.slice(1))) openHash();
  });
})();
