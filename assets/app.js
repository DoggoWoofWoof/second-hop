(() => {
  "use strict";

  const examples = window.SECOND_HOP_EXAMPLES;
  const records = window.SECOND_HOP_PIPELINE;
  const { families, articleURL } = window.SECOND_HOP_LINKS;
  const { budgets, prepare, run } = window.SECOND_HOP_RETRIEVAL;
  const byId = id => document.getElementById(id);
  const number = new Intl.NumberFormat("en-US");
  const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });
  const scoreText = score => score.toFixed(4);
  const rankText = rank => rank ? `#${number.format(rank)}` : "—";
  const chooseCase = byId("flow-case");
  const budgetControl = byId("flow-budget");
  const boostControl = byId("flow-boost");
  const familyControls = [...document.querySelectorAll("input[data-family]")];
  const stepButtons = [...document.querySelectorAll("[data-stage]")];
  const panels = [...document.querySelectorAll("[data-flow-panel]")];
  const stages = stepButtons.map(button => button.dataset.stage);
  const stageLabels = ["Corpus", "Search", "Links", "Pool", "Top five"];
  const surface = byId("flow-surface");
  const settings = byId("flow-settings");
  const tune = byId("flow-tune");
  const play = byId("flow-play");
  const back = byId("flow-back");
  const next = byId("flow-next");
  const evidence = byId("evidence");
  const research = byId("research");
  const archivePanes = [...document.querySelectorAll("[data-research-pane]")];
  const archiveButtons = [...document.querySelectorAll("[data-archive-target]")];
  const traces = new Map();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const corpusCanvas = byId("corpus-field");

  const params = new URLSearchParams(window.location.search);
  const knownStage = () => {
    const fragment = window.location.hash.slice(1);
    return fragment === "shortlist" ? "pool" : stages.includes(fragment) ? fragment : null;
  };
  let stage = knownStage() ?? "corpus";
  let sample;
  let trace;
  let result;
  let loadId = 0;
  let timer = 0;
  let boosted = true;
  let currentPassage;
  let corpusFrame = 0;
  let corpusProgress = 1;

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function availableFamilies() {
    return familyControls.filter(input => input.checked && !input.disabled).map(input => input.dataset.family);
  }

  function writeLocation(fragment) {
    const url = new URL(window.location.href);
    url.searchParams.set("case", chooseCase.value);
    url.searchParams.set("budget", budgetControl.value);
    url.searchParams.set("links", familyControls.filter(input => input.checked).map(input => input.dataset.family).join(""));
    url.searchParams.set("boost", boostControl.value);
    if (fragment) url.hash = fragment;
    history.replaceState(null, "", url);
  }

  function renderNavigation() {
    const index = stages.indexOf(stage);
    stepButtons.forEach(button => {
      if (button.dataset.stage === stage) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      button.disabled = !result;
    });
    back.disabled = !result || index === 0;
    next.disabled = !result || index === stages.length - 1;
    next.textContent = index === stages.length - 1 ? "Finished" : `Next: ${stageLabels[index + 1]} →`;
    play.disabled = !result;
  }

  function showStage(id, animate = true, updateUrl = true) {
    const changed = stage !== id;
    stage = id;
    if (updateUrl) writeLocation(id);
    for (const panel of panels) panel.hidden = !result || panel.id !== id;
    renderNavigation();
    if (!result) return;
    const index = stages.indexOf(id);
    const stageStatus = byId("flow-stage-status");
    const stageLabel = `Step ${index + 1} of ${stages.length}: ${stageLabels[index]}`;
    if (stageStatus.textContent !== stageLabel) stageStatus.textContent = stageLabel;
    if (changed) surface.scrollTop = 0;
    const panel = byId(id);
    if (animate && !motion.matches && changed) {
      panel.animate([{ opacity: 0.25, transform: "translateY(7px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 250, easing: "ease-out" });
    }
    if (id === "corpus") animateCorpus(animate);
    if (id === "links" && animate) document.dispatchEvent(new Event("secondhop:replay-link"));
  }

  function stopReplay() {
    clearTimeout(timer);
    timer = 0;
    play.textContent = "Play pipeline ▷";
  }

  function setSettings(open) {
    settings.hidden = !open;
    tune.setAttribute("aria-expanded", String(open));
  }

  function playStages() {
    if (timer) {
      stopReplay();
      return;
    }
    if (!result) return;
    setSettings(false);
    play.textContent = "Pause replay";
    let index = 0;
    const advance = () => {
      showStage(stages[index]);
      index++;
      if (index === stages.length) stopReplay();
      else timer = window.setTimeout(advance, 2100);
    };
    advance();
  }

  function paintCorpus() {
    const context = corpusCanvas.getContext("2d");
    const { width, height } = corpusCanvas.getBoundingClientRect();
    if (!context || !width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const pixels = [Math.round(width * ratio), Math.round(height * ratio)];
    if (corpusCanvas.width !== pixels[0]) corpusCanvas.width = pixels[0];
    if (corpusCanvas.height !== pixels[1]) corpusCanvas.height = pixels[1];
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const dots = Math.round(90 + trace.corpus / 125);
    for (let index = 0; index < dots; index++) {
      const radius = Math.sqrt((index + 0.5) / dots) * (0.8 + 0.2 * corpusProgress);
      const angle = index * 2.399963;
      const x = width * (0.5 + Math.cos(angle) * radius * 0.44);
      const y = height * (0.5 + Math.sin(angle) * radius * 0.42);
      context.globalAlpha = (0.25 + (index % 7) * 0.095) * corpusProgress;
      context.fillStyle = index % 9 ? "#bbabff" : "#ffce8d";
      context.beginPath();
      context.arc(x, y, index % 9 ? 1.55 : 2.3, 0, 2 * Math.PI);
      context.fill();
    }
  }

  function animateCorpus(animate) {
    cancelAnimationFrame(corpusFrame);
    corpusProgress = 1;
    if (!animate || motion.matches) {
      paintCorpus();
      return;
    }
    const started = performance.now();
    const frame = now => {
      if (stage !== "corpus") return;
      corpusProgress = Math.min(1, Math.max(0.14, (now - started) / 520));
      paintCorpus();
      if (corpusProgress < 1) corpusFrame = requestAnimationFrame(frame);
    };
    corpusFrame = requestAnimationFrame(frame);
  }

  function rowFor(node, { position, detail, value } = {}) {
    const row = el("li", "flow-row");
    const button = el("button", "flow-row-button");
    const name = el("span", "flow-row-copy");
    button.type = "button";
    if (position !== undefined) button.append(el("span", "flow-row-position", position));
    name.append(el("strong", "", node.title), el("small", "", detail));
    button.append(name);
    if (value !== undefined) button.append(el("span", "flow-row-value", value));
    if (node.supporting) button.append(el("span", "flow-support-chip", "Supporting"));
    button.addEventListener("click", () => openPassage(node.id));
    row.append(button);
    return row;
  }

  function pathLabel(path) {
    return path.active.map(type => families[type].label.toLowerCase()).join(" + ");
  }

  function renderResults() {
    const ranking = boosted ? result.boosted : result.base;
    const kept = ranking.filter(entry => entry.node.supporting).length;
    byId("step-results").textContent = `${kept}/${trace.support.length}`;
    byId("finish-summary").textContent = `${kept} of ${trace.support.length} supporting passages made the cut.`;
    byId("finish-base").setAttribute("aria-pressed", String(!boosted));
    byId("finish-boosted").setAttribute("aria-pressed", String(boosted));
    byId("finish-rows").replaceChildren(...ranking.map(({ node, total }, index) => {
      const path = result.origins.get(node.id);
      const detail = path ? `Linked from ${path.from.title} (${rankText(path.from.rank)})` : `Search hit ${rankText(node.rank)}`;
      return rowFor(node, { position: String(index + 1), detail, value: scoreText(boosted ? total : node.score) });
    }));
  }

  function renderWalkthrough() {
    if (!trace) return;
    const enabled = availableFamilies();
    const boost = Number(boostControl.value);
    result = run(trace, Number(budgetControl.value), enabled, boost);
    const { seeds, size, support, origins, seedIds } = result;
    const added = size - seeds.length;
    byId("flow-boost-value").textContent = `${boost}×`;
    byId("step-corpus").textContent = number.format(trace.corpus);
    byId("step-search").textContent = number.format(seeds.length);
    byId("step-links").textContent = `+${number.format(added)}`;
    byId("step-pool").textContent = number.format(size);
    byId("corpus-total").textContent = number.format(trace.corpus);
    byId("corpus-detail").textContent = `The ${sample.dataset} benchmark snapshot holds this question’s search space. The recorded first search combines a word ranking with a meaning ranking.`;
    const searchPreview = seeds.length === 5 ? seeds : [...seeds.slice(0, 4), seeds.at(-1)];
    byId("search-summary").textContent = seeds.length === 5 ? "The first five fused ranks become starting points."
      : `The first ${seeds.length} results become starting points. Here are the first four and the cutoff.`;
    byId("search-rows").replaceChildren(...searchPreview.map(node => rowFor(node, {
      position: rankText(node.rank), detail: `Words ${rankText(node.words)} · Meaning ${rankText(node.meaning)}`, value: scoreText(node.score),
    })));
    byId("link-stage-summary").textContent = `${seeds.length} search hits → ${number.format(added)} linked neighbours.`;
    byId("pool-summary").textContent = `${percent.format(size / trace.corpus)} of the corpus, with ${support} of ${trace.support.length} supporting passages.`;
    byId("pool-corpus-total").textContent = `${number.format(trace.corpus)} passages`;
    byId("pool-share-bar").style.width = `${100 * size / trace.corpus}%`;
    byId("pool-seed-bar").style.width = `${100 * seeds.length / size}%`;
    byId("pool-linked-bar").style.width = `${100 * added / size}%`;
    byId("pool-seed-total").textContent = number.format(seeds.length);
    byId("pool-linked-total").textContent = number.format(added);
    byId("pool-total").textContent = number.format(size);
    byId("pool-rows").replaceChildren(...trace.support.map(node => {
      const path = origins.get(node.id);
      const detail = seedIds.has(node.id) ? `Search hit ${rankText(node.rank)}` : path
        ? `Via ${path.from.title} (${rankText(path.from.rank)})` : "Outside the shortlist";
      return rowFor(node, { detail });
    }));
    renderResults();
    document.dispatchEvent(new CustomEvent("secondhop:state", { detail: { sample, families: enabled, result } }));
  }

  async function loadExample(id, updateUrl = true) {
    const requestId = ++loadId;
    stopReplay();
    sample = examples.find(example => example.id === id) ?? examples[0];
    trace = result = null;
    chooseCase.value = sample.id;
    familyControls.find(input => input.dataset.family === "S").disabled = sample.dataset === "MuSiQue";
    byId("flow-dataset").textContent = sample.dataset;
    byId("flow-question").textContent = sample.question;
    byId("flow-loading").hidden = false;
    byId("flow-error").hidden = true;
    surface.setAttribute("aria-busy", "true");
    for (const id of ["step-corpus", "step-search", "step-links", "step-pool", "step-results"]) byId(id).textContent = "—";
    showStage(stage, false, updateUrl);
    try {
      if (!traces.has(sample.id)) {
        const slug = sample.id;
        const example = sample;
        const response = await fetch(`assets/traces/${slug}.json`);
        if (!response.ok) throw new Error(`Trace HTTP ${response.status}`);
        traces.set(slug, prepare(example, records[slug], await response.json()));
      }
      if (requestId !== loadId) return;
      trace = traces.get(sample.id);
      renderWalkthrough();
      showStage(stage, false, false);
      openHash();
    } catch (error) {
      if (requestId !== loadId) return;
      trace = result = null;
      showStage(stage, false, false);
      byId("flow-error").hidden = false;
      console.error(error);
    } finally {
      if (requestId === loadId) {
        byId("flow-loading").hidden = true;
        surface.setAttribute("aria-busy", "false");
      }
    }
  }

  function openPassage(id) {
    const node = trace?.passages.get(id);
    if (!node) return;
    if (research.open) research.close();
    const path = result.origins.get(id);
    currentPassage = node.id;
    byId("passage-kind").textContent = node.supporting ? "Supporting passage" : "Passage";
    byId("passage-title").textContent = node.title;
    byId("passage-text").textContent = node.text ?? "Open the Wikipedia reference to read about this passage.";
    byId("signal-words").textContent = rankText(node.words);
    byId("signal-meaning").textContent = rankText(node.meaning);
    byId("signal-fused").textContent = rankText(node.rank);
    byId("passage-path").textContent = result.seedIds.has(id) ? `Started as search hit ${rankText(node.rank)}.` : path
      ? `Entered the shortlist through ${path.from.title} (${rankText(path.from.rank)}) via ${pathLabel(path)}.` : "Outside this shortlist.";
    const ranking = boosted ? result.boosted : result.base;
    const position = ranking.findIndex(entry => entry.node.id === id);
    const bonus = boosted ? (path?.strength ?? 0) * Number(boostControl.value) : 0;
    byId("passage-score").textContent = `Fused score ${scoreText(node.score)} · Link bonus ${scoreText(bonus)}${position >= 0 ? ` · Final rank #${position + 1}` : ""}`;
    byId("passage-source").href = articleURL(node.title, Boolean(node.text));
    byId("passage-trace").hidden = !path;
    if (!evidence.open) evidence.showModal();
  }

  function openArchive(target) {
    if (evidence.open) evidence.close();
    for (const pane of archivePanes) pane.hidden = pane.id !== target;
    for (const button of archiveButtons) button.setAttribute("aria-pressed", String(button.dataset.archiveTarget === target));
    if (!research.open) research.showModal();
    research.querySelector(".research-content").scrollTop = 0;
  }

  function openHash() {
    const fragment = window.location.hash.slice(1);
    const nextStage = knownStage();
    if (nextStage) showStage(nextStage, false, false);
    if (archivePanes.some(pane => pane.id === fragment)) openArchive(fragment);
    if (fragment === "evidence" && trace) openPassage((trace.support[1] ?? trace.support[0]).id);
  }

  function applySettings() {
    stopReplay();
    byId("flow-boost-value").textContent = `${boostControl.value}×`;
    writeLocation();
    renderWalkthrough();
  }

  if (budgets.includes(Number(params.get("budget")))) budgetControl.value = params.get("budget");
  if (["0", "0.5", "1", "1.5", "2"].includes(params.get("boost"))) boostControl.value = params.get("boost");
  if (params.has("links") && /^[SRNK]*$/.test(params.get("links"))) {
    for (const control of familyControls) control.checked = params.get("links").includes(control.dataset.family);
  }
  byId("flow-boost-value").textContent = `${boostControl.value}×`;
  for (const example of examples) chooseCase.add(new Option(example.label, example.id));

  chooseCase.addEventListener("change", () => loadExample(chooseCase.value));
  byId("flow-retry").addEventListener("click", () => loadExample(chooseCase.value));
  for (const control of [budgetControl, ...familyControls]) control.addEventListener("change", applySettings);
  boostControl.addEventListener("input", () => {
    boosted = true;
    applySettings();
  });
  tune.addEventListener("click", () => {
    if (settings.hidden) stopReplay();
    setSettings(settings.hidden);
  });
  function navigateTo(id) {
    stopReplay();
    setSettings(false);
    showStage(id);
  }
  stepButtons.forEach(button => button.addEventListener("click", () => navigateTo(button.dataset.stage)));
  next.addEventListener("click", () => navigateTo(stages[stages.indexOf(stage) + 1]));
  back.addEventListener("click", () => navigateTo(stages[stages.indexOf(stage) - 1]));
  play.addEventListener("click", playStages);
  for (const [id, mode] of [["finish-base", false], ["finish-boosted", true]]) {
    byId(id).addEventListener("click", () => {
      boosted = mode;
      renderResults();
    });
  }
  byId("evidence-close").addEventListener("click", () => evidence.close());
  byId("passage-trace").addEventListener("click", () => {
    const path = result.origins.get(currentPassage);
    evidence.close();
    navigateTo("links");
    document.dispatchEvent(new CustomEvent("secondhop:route", { detail: path }));
  });
  for (const link of document.querySelectorAll("[data-open-research]")) link.addEventListener("click", event => {
    event.preventDefault();
    stopReplay();
    openArchive(link.hash.slice(1));
  });
  archiveButtons.forEach(button => button.addEventListener("click", () => openArchive(button.dataset.archiveTarget)));
  byId("research-close").addEventListener("click", () => research.close());
  document.addEventListener("secondhop:passage", ({ detail }) => openPassage(detail));
  document.addEventListener("secondhop:links", ({ detail }) => {
    for (const control of familyControls) if (!control.disabled) control.checked = detail.includes(control.dataset.family);
    applySettings();
  });
  window.addEventListener("hashchange", () => {
    stopReplay();
    openHash();
  });
  new ResizeObserver(() => {
    if (trace && stage === "corpus") paintCorpus();
  }).observe(corpusCanvas);
  loadExample(params.get("case"), false);
})();
