(() => {
  "use strict";

  const examples = window.SECOND_HOP_EXAMPLES;
  const records = window.SECOND_HOP_PIPELINE;
  const { families, articleURL, describeLink } = window.SECOND_HOP_LINKS;
  const { budgets, prepare, run } = window.SECOND_HOP_RETRIEVAL;
  const byId = id => document.getElementById(id);
  const number = new Intl.NumberFormat("en-US");
  const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });
  const scoreText = score => score.toFixed(4);
  const rankText = rank => rank ? "#" + number.format(rank) : "—";

  const chooseDataset = byId("flow-dataset-select");
  const chooseCase = byId("flow-case");
  const budgetControl = byId("flow-budget");
  const boostControl = byId("flow-boost");
  const familyControls = [...document.querySelectorAll("input[data-family]")];
  const stepButtons = [...document.querySelectorAll("[data-stage]")];
  const panels = [...document.querySelectorAll("[data-flow-panel]")];
  const stages = stepButtons.map(button => button.dataset.stage);
  const stageLabels = ["Corpus", "Search", "Links", "Shortlist", "Top five"];
  const sceneTitles = ["The search space", "First search", "Follow the links", "The shortlist", "Final top five"];
  const surface = byId("flow-surface");
  const visual = byId("flow-visual");
  const settings = byId("flow-settings");
  const tune = byId("flow-tune");
  const play = byId("flow-play");
  const back = byId("flow-back");
  const next = byId("flow-next");
  const scrub = byId("flow-scrub");
  const evidence = byId("evidence");
  const research = byId("research");
  const archivePanes = [...document.querySelectorAll("[data-research-pane]")];
  const archiveButtons = [...document.querySelectorAll("[data-archive-target]")];
  const traces = new Map();
  const textRequests = new Map();
  const exclusions = new Map();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const params = new URLSearchParams(window.location.search);
  const initialCase = examples.find(example => example.id === params.get("case")) ?? examples[0];
  if (params.has("skip")) {
    const ids = params.get("skip").split(",").filter(id => /^\d+$/.test(id)).map(Number);
    exclusions.set(initialCase.id, new Set(ids));
  }

  function stageFromHash() {
    const fragment = window.location.hash.slice(1);
    const stage = fragment === "shortlist" ? "pool" : fragment;
    return stages.indexOf(stage);
  }

  let position = Math.max(0, stageFromHash());
  let activeStep = -1;
  let sample;
  let trace;
  let result;
  let loadId = 0;
  let timer = 0;
  let frame = 0;
  let playing = false;
  let boosted = true;
  let showAllHits = false;
  let currentPassage;
  let preview = [];

  const scene = window.SECOND_HOP_SCENE(byId("pipeline-canvas"), {
    inspect: id => openPassage(id),
    inspectLink: (route, type) => openPassage(route.to.id, route, type),
    pause: stopReplay,
  });

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function enabledFamilies() {
    return familyControls.filter(input => input.checked && !input.disabled).map(input => input.dataset.family);
  }

  function excludedSeeds() {
    return exclusions.get(sample.id);
  }

  function selectedRanking() {
    return boosted ? result.boosted : result.base;
  }

  function writeLocation(step) {
    const url = new URL(window.location.href);
    url.searchParams.set("case", sample.id);
    url.searchParams.set("budget", budgetControl.value);
    url.searchParams.set("links", familyControls.filter(input => input.checked).map(input => input.dataset.family).join(""));
    url.searchParams.set("boost", boostControl.value);
    if (excludedSeeds().size) url.searchParams.set("skip", [...excludedSeeds()].join(","));
    else url.searchParams.delete("skip");
    if (step !== undefined) url.hash = stages[step];
    history.replaceState(null, "", url);
  }

  function renderTransport() {
    back.disabled = !result || position <= 0;
    next.disabled = !result || position >= stages.length - 1;
    play.disabled = scrub.disabled = !result;
    if (play.dataset.playing !== String(playing)) play.dataset.playing = String(playing);
    const label = playing ? "Pause pipeline" : position >= stages.length - 1 ? "Replay pipeline" : "Play pipeline";
    if (play.textContent !== label) play.textContent = label;
  }

  function legendItem(label, color, type) {
    const item = el("span", "", label);
    item.prepend(el("i"));
    item.style.setProperty("--key", color);
    if (type) item.dataset.line = type;
    return item;
  }

  function renderSceneCaption(index) {
    if (!result) return;
    const { seeds, hits, size, support } = result;
    const kept = selectedRanking().filter(entry => entry.node.supporting).length;
    const n = number.format;
    const counts = [
      n(trace.corpus) + " passages",
      n(seeds.length) + " of " + n(hits.length) + " hits used",
      "+" + n(size - seeds.length) + " linked neighbours",
      n(size) + " of " + n(trace.corpus) + " passages",
      kept + " of " + trace.support.length + " supporting passages",
    ];
    const notes = [
      "Play or scrub to follow the search through this corpus sample.",
      "Word and meaning ranks converge. Choose which hits become seeds below.",
      "Drag a passage or the background. Click a dot or a connection to inspect it.",
      percent.format(size / trace.corpus) + " of the original search space. " + support + " supporting passages reached the shortlist.",
      "Compare fused score and link boost to see what moves into the top five.",
    ];
    byId("scene-title").textContent = sceneTitles[index];
    byId("scene-count").textContent = counts[index];
    byId("scene-note").textContent = notes[index];
    const legend = byId("scene-legend");
    const nodeKeys = [legendItem("Search hit", "#ffce8d"), legendItem("Linked passage", "#bbabff")];
    const focusedFamily = document.activeElement?.dataset.sceneFamily;
    const linkKeys = familyControls.map(control => {
      const type = control.dataset.family;
      const item = legendItem(families[type].label, families[type].color, type);
      const button = el("button");
      button.type = "button";
      button.dataset.sceneFamily = type;
      button.disabled = control.disabled;
      button.setAttribute("aria-pressed", String(control.checked && !control.disabled));
      button.title = (control.checked ? "Remove " : "Add ") + families[type].title.toLowerCase();
      button.append(item);
      button.addEventListener("click", () => {
        control.checked = !control.checked;
        applySettings();
      });
      return button;
    });
    legend.replaceChildren(...(index === 2 ? linkKeys : index >= 3 ? nodeKeys : []));
    if (focusedFamily) legend.querySelector('[data-scene-family="' + focusedFamily + '"]')?.focus({ preventScroll: true });
  }

  function renderStep(index) {
    if (!result || activeStep === index) return;
    activeStep = index;
    for (const panel of panels) panel.hidden = panel.id !== stages[index];
    for (const button of stepButtons) {
      button.disabled = false;
      if (button.dataset.stage === stages[index]) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    }
    byId("flow-stage-status").textContent = "Step " + (index + 1) + " of " + stages.length + ": " + stageLabels[index];
    scrub.setAttribute("aria-valuetext", stageLabels[index]);
    renderSceneCaption(index);
    if (index === 2) {
      document.dispatchEvent(new Event("secondhop:replay-link"));
      loadPassages(sample, trace).catch(() => {});
    }
  }

  function setPosition(value) {
    position = value;
    scrub.value = String(value);
    scene.setPosition(value);
    renderStep(Math.round(value));
    renderTransport();
  }

  function stopReplay() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    timer = frame = 0;
    playing = false;
    renderTransport();
  }

  function glideTo(target, duration, done) {
    const from = position;
    if (from === target || motion.matches) {
      setPosition(target);
      done();
      return;
    }
    let started;
    const advance = now => {
      started ??= now;
      const progress = Math.min(1, (now - started) / duration);
      setPosition(progress === 1 ? target : from + (target - from) * progress);
      if (progress < 1) frame = requestAnimationFrame(advance);
      else {
        frame = 0;
        done();
      }
    };
    frame = requestAnimationFrame(advance);
  }

  function playStages() {
    if (playing) {
      stopReplay();
      return;
    }
    if (!result) return;
    stopReplay();
    if (position >= stages.length - 1) setPosition(0);
    playing = true;
    setSettings(false);
    renderTransport();
    const advance = () => {
      const atStop = Number.isInteger(position);
      const to = Math.floor(position) + 1;
      const pause = atStop ? [650, 1600, 2450, 1300][position] : 0;
      timer = window.setTimeout(() => {
        const duration = [1400, 1900, 1700, 1700][to - 1] * (to - position);
        glideTo(to, duration, () => {
          writeLocation(to);
          if (to >= stages.length - 1) stopReplay();
          else advance();
        });
      }, pause);
    };
    advance();
  }

  function setSettings(open) {
    settings.hidden = !open;
    tune.setAttribute("aria-expanded", String(open));
  }

  function navigateTo(index, animate = true, done = () => {}) {
    if (!result || index < 0 || index >= stages.length) return;
    stopReplay();
    const finish = () => {
      writeLocation(index);
      done();
    };
    if (animate) glideTo(index, Math.min(2600, 980 * Math.abs(position - index)), finish);
    else {
      setPosition(index);
      finish();
    }
  }

  function rowFor(node, { position: rowPosition, detail, value, seed = false } = {}) {
    const row = el("li", "flow-row");
    const button = el("button", "flow-row-button");
    const name = el("span", "flow-row-copy");
    button.type = "button";
    if (rowPosition !== undefined) button.append(el("span", "flow-row-position", rowPosition));
    name.append(el("strong", "", node.title), el("small", "", detail));
    button.append(name);
    if (value !== undefined) button.append(el("span", "flow-row-value", value));
    if (node.supporting) button.append(el("span", "flow-support-chip", "Supporting"));
    button.addEventListener("click", () => openPassage(node.id));
    row.append(button);
    if (seed) {
      const label = el("label", "seed-check");
      const control = el("input");
      control.type = "checkbox";
      control.checked = result.seedIds.has(node.id);
      control.dataset.seed = node.id;
      control.setAttribute("aria-label", "Use " + node.title + " as a seed");
      control.addEventListener("change", () => toggleSeed(node.id));
      label.append(control, el("span", "", "Seed"));
      row.append(label);
    }
    return row;
  }

  function renderSearch() {
    const { hits, seeds } = result;
    const rows = byId("search-rows");
    const focusedSeed = document.activeElement?.dataset.seed;
    const searchAll = byId("search-all");
    const searchReset = byId("search-reset");
    searchAll.hidden = hits.length <= 5;
    searchAll.textContent = showAllHits ? "Show fewer hits" : "Show all " + hits.length + " hits";
    searchAll.setAttribute("aria-expanded", String(showAllHits && hits.length > 5));
    searchReset.hidden = seeds.length === hits.length;
    byId("search-summary").textContent = seeds.length + " of " + hits.length + " fused search hits are active seeds. Uncheck a hit to see what it was adding.";
    rows.replaceChildren(...(showAllHits ? hits : preview).map(node => rowFor(node, {
      position: rankText(node.rank),
      detail: "Words " + rankText(node.words) + " · Meaning " + rankText(node.meaning),
      value: scoreText(node.score),
      seed: true,
    })));
    if (focusedSeed) rows.querySelector('[data-seed="' + focusedSeed + '"]')?.focus({ preventScroll: true });
  }

  function renderResults() {
    const ranking = selectedRanking();
    const kept = ranking.filter(entry => entry.node.supporting).length;
    byId("step-results").textContent = kept + "/" + trace.support.length;
    byId("finish-summary").textContent = ranking.length ? kept + " of " + trace.support.length + " supporting passages made the cut." : "Choose a seed in Search to rank passages.";
    byId("finish-base").setAttribute("aria-pressed", String(!boosted));
    byId("finish-boosted").setAttribute("aria-pressed", String(boosted));
    byId("finish-rows").replaceChildren(...ranking.map(({ node, total }, index) => {
      const path = result.origins.get(node.id);
      const detail = path ? "Linked from " + path.from.title + " (" + rankText(path.from.rank) + ")" : "Search hit " + rankText(node.rank);
      return rowFor(node, { position: String(index + 1), detail, value: scoreText(boosted ? total : node.score) });
    }));
  }

  function renderWalkthrough(animate = true) {
    if (!trace) return;
    const enabled = enabledFamilies();
    const boost = Number(boostControl.value);
    result = run(trace, Number(budgetControl.value), enabled, boost, excludedSeeds());
    const { hits, seeds, size, support, origins, seedIds } = result;
    const added = size - seeds.length;
    byId("flow-boost-value").textContent = boost + "×";
    byId("step-corpus").textContent = number.format(trace.corpus);
    byId("step-search").textContent = number.format(seeds.length);
    byId("step-links").textContent = "+" + number.format(added);
    byId("step-pool").textContent = number.format(size);
    byId("corpus-detail").textContent = sample.dataset + " supplies the recorded corpus and question. Search combines the saved word and meaning ranks with reciprocal rank fusion.";
    preview = hits.length <= 5 ? hits : [...hits.slice(0, 4), hits.at(-1)];
    renderSearch();
    byId("link-stage-summary").textContent = number.format(seeds.length) + " seeds added " + number.format(added) + " unique neighbours.";
    byId("pool-summary").textContent = percent.format(size / trace.corpus) + " of the corpus, with " + support + " of " + trace.support.length + " supporting passages.";
    byId("pool-corpus-total").textContent = number.format(trace.corpus) + " passages";
    byId("pool-share-bar").style.width = 100 * size / trace.corpus + "%";
    byId("pool-seed-bar").style.width = (size ? 100 * seeds.length / size : 0) + "%";
    byId("pool-linked-bar").style.width = (size ? 100 * added / size : 0) + "%";
    byId("pool-seed-total").textContent = number.format(seeds.length);
    byId("pool-linked-total").textContent = number.format(added);
    byId("pool-total").textContent = number.format(size);
    byId("pool-rows").replaceChildren(...trace.support.map(node => {
      const path = origins.get(node.id);
      const detail = seedIds.has(node.id) ? "Search hit " + rankText(node.rank) : path
        ? "Via " + path.from.title + " (" + rankText(path.from.rank) + ")" : "Outside the shortlist";
      return rowFor(node, { detail });
    }));
    renderResults();
    renderSceneCaption(Math.round(position));
    scene.update(result, selectedRanking(), preview, animate);
    document.dispatchEvent(new CustomEvent("secondhop:state", { detail: { sample, families: enabled, result, names: trace.names } }));
    if (evidence.open && currentPassage) renderPassage();
  }

  async function loadExample(id, updateUrl = true) {
    const requestId = ++loadId;
    stopReplay();
    const previous = sample;
    sample = examples.find(example => example.id === id) ?? examples[0];
    chooseDataset.value = sample.dataset;
    if (previous?.dataset !== sample.dataset) {
      chooseCase.replaceChildren(...examples.filter(example => example.dataset === sample.dataset).map(example => new Option(example.label, example.id)));
    }
    chooseCase.value = sample.id;
    if (!exclusions.has(sample.id)) exclusions.set(sample.id, new Set());
    if (previous !== sample) {
      showAllHits = false;
      scene.reset();
    }
    trace = result = null;
    activeStep = -1;
    familyControls.find(input => input.dataset.family === "S").disabled = sample.dataset === "MuSiQue";
    byId("flow-dataset").textContent = sample.dataset;
    byId("flow-question").textContent = sample.question;
    byId("flow-loading").hidden = false;
    byId("flow-error").hidden = true;
    surface.setAttribute("aria-busy", "true");
    visual.hidden = true;
    for (const panel of panels) panel.hidden = true;
    for (const button of stepButtons) button.disabled = true;
    for (const id of ["step-corpus", "step-search", "step-links", "step-pool", "step-results"]) byId(id).textContent = "—";
    renderTransport();
    if (updateUrl) writeLocation();
    try {
      const slug = sample.id;
      const example = sample;
      if (!traces.has(slug)) {
        const response = await fetch("assets/traces/" + slug + ".json");
        if (!response.ok) throw new Error("Trace HTTP " + response.status);
        traces.set(slug, prepare(example, records[slug], await response.json()));
      }
      if (requestId !== loadId) return;
      trace = traces.get(slug);
      visual.hidden = false;
      renderWalkthrough(false);
      setPosition(position);
      if (!updateUrl) openHash();
    } catch (error) {
      if (requestId !== loadId) return;
      trace = result = null;
      visual.hidden = true;
      for (const panel of panels) panel.hidden = true;
      renderTransport();
      byId("flow-error").hidden = false;
      console.error(error);
    } finally {
      if (requestId === loadId) {
        byId("flow-loading").hidden = true;
        surface.setAttribute("aria-busy", "false");
      }
    }
  }

  function loadPassages(example, preparedTrace) {
    if (preparedTrace.fullText) return Promise.resolve();
    const slug = example.id;
    if (!textRequests.has(slug)) {
      const request = fetch("assets/passages/" + slug + ".json").then(response => {
        if (!response.ok) throw new Error("Passages HTTP " + response.status);
        return response.json();
      }).then(data => {
        for (const [id, text] of Object.entries(data.text)) preparedTrace.passages.get(Number(id)).text = text;
        preparedTrace.names = data.names;
        preparedTrace.fullText = true;
        document.dispatchEvent(new CustomEvent("secondhop:passages", { detail: { sample: example, names: data.names } }));
      }).finally(() => textRequests.delete(slug));
      textRequests.set(slug, request);
    }
    return textRequests.get(slug);
  }

  function passageLinks(id) {
    return result.routes.filter(route => route.to.id === id || route.from.id === id);
  }

  function currentRoute(node, options) {
    if (currentPassage.key === "") return null;
    return options.find(route => route.key === currentPassage.key) ?? result.origins.get(node.id);
  }

  function renderPassage() {
    const { id, family } = currentPassage;
    const node = trace.passages.get(id);
    const origin = result.origins.get(id);
    const options = passageLinks(id);
    const path = currentRoute(node, options);
    const rank = selectedRanking().findIndex(entry => entry.node.id === id);
    const bonus = boosted ? (origin?.strength ?? 0) * Number(boostControl.value) : 0;
    const seeded = result.seedIds.has(id);
    const seedOption = result.hits.some(hit => hit.id === id);
    byId("passage-kind").textContent = node.supporting ? "Supporting passage" : "Benchmark passage";
    byId("passage-title").textContent = node.title;
    byId("passage-text").textContent = node.text ?? "Loading the benchmark passage…";
    byId("signal-words").textContent = rankText(node.words);
    byId("signal-meaning").textContent = rankText(node.meaning);
    byId("signal-fused").textContent = rankText(node.rank);
    byId("passage-path").textContent = seeded ? "Started as search hit " + rankText(node.rank) + "."
      : origin ? "Entered the shortlist through " + origin.from.title + " (" + rankText(origin.from.rank) + ")."
      : "Outside this shortlist.";
    byId("passage-score").textContent = "Fused score " + scoreText(node.score) + " · Link bonus " + scoreText(bonus) +
      (rank >= 0 ? " · Final rank #" + (rank + 1) : "");
    byId("passage-source").href = articleURL(node.title);
    byId("passage-trace").hidden = !path;
    const seedButton = byId("passage-seed");
    seedButton.hidden = !seedOption;
    seedButton.textContent = seeded ? "Remove seed" : "Use as seed";

    const routeControl = byId("passage-route");
    byId("passage-route-label").hidden = !options.length;
    routeControl.replaceChildren(new Option("Choose a connection", ""), ...options.map(route => {
      const label = route.from.id === id ? "To " + route.to.title : "From " + route.from.title;
      return new Option(label + (route.active.length ? "" : " (disabled)"), route.key);
    }));
    routeControl.value = path?.key ?? "";
    const types = path ? [...path.types] : [];
    if (family && types.includes(family)) types.unshift(...types.splice(types.indexOf(family), 1));
    byId("passage-links").replaceChildren(...types.map(type => {
      const detail = el("div", "passage-link-detail");
      detail.style.setProperty("--wire", families[type].color);
      const { explanation, quote } = describeLink(sample, path.from, path.to, type, path.cosine, trace.names?.[path.key]);
      detail.append(el("strong", "", families[type].label + (path.active.includes(type) ? "" : " · disabled")), el("p", "", explanation));
      if (quote) detail.append(quote);
      return detail;
    }));
  }

  function openPassage(id, path, family) {
    if (!trace?.passages.has(id)) return;
    stopReplay();
    if (research.open) research.close();
    const opened = { id, key: path?.key, family };
    currentPassage = opened;
    renderPassage();
    if (!evidence.open) evidence.showModal();
    evidence.scrollTop = 0;
    loadPassages(sample, trace).then(() => {
      if (evidence.open && currentPassage === opened) renderPassage();
    }).catch(() => {
      if (evidence.open && currentPassage === opened && !trace.passages.get(id).text) {
        byId("passage-text").textContent = "The benchmark passage couldn’t load. You can open the Wikipedia article below.";
      }
    });
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
    const index = stageFromHash();
    if (index >= 0 && result) setPosition(index);
    if (fragment === "top" && result) setPosition(0);
    if (archivePanes.some(pane => pane.id === fragment)) openArchive(fragment);
    if (fragment === "evidence" && trace) openPassage((trace.support[1] ?? trace.support[0]).id);
  }

  function applySettings() {
    stopReplay();
    byId("flow-boost-value").textContent = boostControl.value + "×";
    writeLocation();
    renderWalkthrough();
  }

  function toggleSeed(id) {
    const excluded = excludedSeeds();
    if (excluded.has(id)) excluded.delete(id);
    else excluded.add(id);
    applySettings();
  }

  if (budgets.includes(Number(params.get("budget")))) budgetControl.value = params.get("budget");
  if (["0", "0.5", "1", "1.5", "2"].includes(params.get("boost"))) boostControl.value = params.get("boost");
  if (params.has("links") && /^[SRNK]*$/.test(params.get("links"))) {
    for (const control of familyControls) control.checked = params.get("links").includes(control.dataset.family);
  }
  byId("flow-boost-value").textContent = boostControl.value + "×";
  for (const dataset of new Set(examples.map(example => example.dataset))) chooseDataset.add(new Option(dataset, dataset));

  chooseDataset.addEventListener("change", () => loadExample(examples.find(example => example.dataset === chooseDataset.value).id));
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

  stepButtons.forEach((button, index) => button.addEventListener("click", () => navigateTo(index)));
  next.addEventListener("click", () => navigateTo(Math.floor(position) + 1));
  back.addEventListener("click", () => navigateTo(Math.ceil(position) - 1));
  play.addEventListener("click", playStages);
  scrub.addEventListener("input", () => {
    stopReplay();
    setPosition(Number(scrub.value));
  });
  scrub.addEventListener("change", () => writeLocation(Math.round(position)));
  byId("search-all").addEventListener("click", () => {
    showAllHits = !showAllHits;
    renderSearch();
  });
  byId("search-reset").addEventListener("click", () => {
    excludedSeeds().clear();
    applySettings();
  });

  for (const [id, mode] of [["finish-base", false], ["finish-boosted", true]]) {
    byId(id).addEventListener("click", () => {
      stopReplay();
      boosted = mode;
      renderResults();
      renderSceneCaption(Math.round(position));
      scene.update(result, selectedRanking(), preview);
    });
  }
  byId("evidence-close").addEventListener("click", () => evidence.close());
  byId("passage-route").addEventListener("change", event => {
    currentPassage.key = event.target.value;
    currentPassage.family = undefined;
    renderPassage();
  });
  byId("passage-seed").addEventListener("click", () => toggleSeed(currentPassage.id));
  byId("passage-trace").addEventListener("click", () => {
    const route = currentRoute(trace.passages.get(currentPassage.id), passageLinks(currentPassage.id));
    evidence.close();
    navigateTo(stages.indexOf("links"), false, () => {
      document.dispatchEvent(new CustomEvent("secondhop:route", { detail: { ...route, family: currentPassage.family } }));
      byId("links").scrollIntoView({ block: "start", behavior: motion.matches ? "instant" : "smooth" });
    });
  });
  for (const link of document.querySelectorAll("[data-open-research]")) link.addEventListener("click", event => {
    event.preventDefault();
    stopReplay();
    openArchive(link.hash.slice(1));
  });
  archiveButtons.forEach(button => button.addEventListener("click", () => openArchive(button.dataset.archiveTarget)));
  byId("research-close").addEventListener("click", () => research.close());
  document.addEventListener("secondhop:passage", ({ detail }) => openPassage(detail));
  document.addEventListener("secondhop:locate", ({ detail }) => {
    navigateTo(stages.indexOf("links"), false, () => {
      scene.locate(detail.route, detail.family);
      visual.scrollIntoView({ block: "center", behavior: motion.matches ? "instant" : "smooth" });
    });
  });
  document.addEventListener("secondhop:links", ({ detail }) => {
    for (const control of familyControls) if (!control.disabled) control.checked = detail.includes(control.dataset.family);
    applySettings();
  });
  window.addEventListener("hashchange", () => {
    stopReplay();
    openHash();
  });
  loadExample(initialCase.id, false);
})();
