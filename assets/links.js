(() => {
  "use strict";

  const families = {
    S: { label: "Hyperlink", title: "Hyperlinks", source: "Article links", color: "#8cdbdf", dash: [],
      how: "Uses links already present between Wikipedia articles in the benchmark corpus." },
    R: { label: "Title rule", title: "Title rules", source: "Title mentions", color: "#ed9ebd", dash: [8, 5],
      how: "Looks for one article’s title in another passage, or joins passages from the same article." },
    N: { label: "Shared name", title: "Shared names", source: "Named entities", color: "#c5d990", dash: [2, 7],
      how: "A tagger looks for people, places, and other named entities that occur in both passages." },
    K: { label: "Semantic link", title: "Semantic links", source: "Similar meanings", color: "#bbabff", dash: [9, 4, 2, 4],
      how: "Compares passage embeddings and connects each passage to its three nearest neighbours by meaning." },
  };
  const keys = Object.keys(families);
  const articlePaths = new Map([
    ["The Newcomers (film)", "The_Newcomers#Film"],
    ["The Newcomer in The Cabbage", "Vaniusha_The_Newcomer"],
  ]);
  const articleURL = (title, known = true) => known
    ? `https://en.wikipedia.org/wiki/${articlePaths.get(title) ?? encodeURIComponent(title.replaceAll(" ", "_"))}`
    : `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title)}`;
  const edgeKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const formatList = new Intl.ListFormat("en", { type: "conjunction" });
  const svgNamespace = "http://www.w3.org/2000/svg";
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function excerpt(text = "", term) {
    const index = text.toLowerCase().indexOf(term.toLowerCase());
    if (index < 0) return null;
    const quote = document.createElement("blockquote");
    const highlight = document.createElement("mark");
    const start = Math.max(0, index - 70);
    const end = Math.min(text.length, index + term.length + 92);
    highlight.textContent = text.slice(index, index + term.length);
    quote.append(start ? `…${text.slice(start, index)}` : text.slice(start, index), highlight,
      text.slice(index + term.length, end) + (end < text.length ? "…" : ""));
    return quote;
  }

  function describeLink(sample, origin, target, family, cosine) {
    const details = window.SECOND_HOP_PIPELINE[sample.id].linkDetails[edgeKey(origin.id, target.id)];
    if (family === "K") {
      const similarity = cosine ?? details?.cosine;
      return { explanation: similarity === undefined ? "The saved graph connects these passages by semantic similarity."
        : `Recorded cosine similarity between these two passages is ${similarity.toFixed(3)}.` };
    }
    if (family === "N") {
      const names = details?.names ?? [];
      return {
        explanation: names.length ? `The tagger found ${formatList.format(names.map(name => `“${name}”`))} in both passages.`
          : "The benchmark graph records a shared named entity between these passages.",
        quote: names.length ? excerpt(origin.text, names[0]) : null,
      };
    }
    const quoteFromOrigin = excerpt(origin.text, target.title);
    const quoteFromTarget = excerpt(target.text, origin.title);
    if (family === "S") {
      return { explanation: "The benchmark records an article hyperlink between these pages.", quote: quoteFromOrigin || quoteFromTarget,
        quotedBy: quoteFromOrigin ? origin.title : target.title };
    }
    if (origin.title === target.title) return { explanation: "The two passages come from the same Wikipedia article." };
    if (quoteFromOrigin) return { explanation: `“${target.title}” appears in the text of “${origin.title}”.`, quote: quoteFromOrigin, quotedBy: origin.title };
    if (quoteFromTarget) return { explanation: `“${origin.title}” appears in the text of “${target.title}”.`, quote: quoteFromTarget, quotedBy: target.title };
    return { explanation: "The title-rule graph links these passages using normalized article titles." };
  }

  window.SECOND_HOP_LINKS = { families, articleURL };

  const byId = id => document.getElementById(id);
  const typeList = byId("wire-types");
  const pairControl = byId("wire-pair");
  const tracks = byId("wire-tracks");
  const toggle = byId("wire-toggle");
  const buttons = new Map();
  let sample;
  let pairs = [];
  let counts = {};
  let previousBudget;
  let enabled = [];
  let family = "S";
  let selectedKey;
  let replayFrame = 0;

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function svgEl(tag, attrs) {
    const element = document.createElementNS(svgNamespace, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  }

  function lineSample(type, wide = false) {
    const width = wide ? 180 : 40;
    const line = svgEl("svg", { viewBox: `0 0 ${width} 20`, preserveAspectRatio: "none", "aria-hidden": "true" });
    line.append(svgEl("line", { x1: 1, x2: width - 1, y1: 10, y2: 10, stroke: families[type].color,
      "stroke-dasharray": families[type].dash.join(" "), "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }));
    if (wide) line.append(svgEl("circle", { cx: 3, cy: 10, r: 4, fill: families[type].color, opacity: 0 }));
    return line;
  }

  function comparePair(a, b) {
    const priority = ({ from, to }) => to.supporting ? 0 : from.supporting ? 1 : 2;
    return priority(a) - priority(b) || a.from.rank - b.from.rank || (a.to.rank || 1001) - (b.to.rank || 1001);
  }

  function makeTypeButtons() {
    for (const type of keys) {
      const control = el("button", "wire-type");
      control.type = "button";
      control.dataset.wireType = type;
      control.style.setProperty("--wire", families[type].color);
      const label = el("strong", "", families[type].title);
      const count = el("span", "wire-type-count");
      const source = el("small", "", families[type].source);
      const swatch = el("span", "wire-swatch");
      swatch.append(lineSample(type));
      control.append(swatch, label, source, count);
      control.addEventListener("click", () => selectType(type));
      typeList.append(control);
      buttons.set(type, { control, count });
    }
  }

  function updatePoolControls() {
    for (const [type, { control, count }] of buttons) {
      const total = counts[type];
      control.setAttribute("aria-pressed", String(type === family));
      count.textContent = `${total.toLocaleString("en-US")} links · ${enabled.includes(type) ? "On" : "Off"}`;
    }
    const included = enabled.includes(family);
    toggle.hidden = family === "S" && sample.dataset === "MuSiQue";
    toggle.textContent = included ? `Remove ${families[family].title.toLowerCase()} from pool` : `Add ${families[family].title.toLowerCase()} to pool`;
    updateTracks();
  }

  function updateTracks() {
    const shown = [...tracks.children];
    let included = 0;
    for (const track of shown) {
      const used = enabled.includes(track.dataset.track);
      track.dataset.enabled = String(used);
      if (used) included++;
    }
    byId("wire-path-count").textContent = `${shown.length} ${shown.length === 1 ? "link type" : "link types"} · ${included} in pool`;
  }

  function showNode(id, node) {
    const element = byId(id);
    element.dataset.node = node.id;
    element.querySelector("strong").textContent = node.title;
    element.querySelector("small").textContent = node.rank ? `First search #${node.rank.toLocaleString("en-US")}` : "Beyond rank #1,000";
  }

  function replay() {
    cancelAnimationFrame(replayFrame);
    for (const dot of tracks.querySelectorAll("circle")) dot.setAttribute("opacity", 0);
    if (motion.matches) return;
    const dot = tracks.querySelector('[aria-pressed="true"] circle');
    if (!dot) return;
    const start = performance.now();
    function move(now) {
      const progress = motion.matches ? 1 : Math.min(1, Math.max(0, (now - start) / 900));
      dot.setAttribute("cx", 3 + 174 * progress);
      dot.setAttribute("opacity", progress === 1 ? 0 : 1);
      if (progress < 1) replayFrame = requestAnimationFrame(move);
    }
    replayFrame = requestAnimationFrame(move);
  }

  function showTracks(pair) {
    cancelAnimationFrame(replayFrame);
    tracks.replaceChildren(...pair.types.map(type => {
      const control = el("button", "wire-track");
      control.type = "button";
      control.dataset.track = type;
      control.style.setProperty("--wire", families[type].color);
      control.setAttribute("aria-label", families[type].title);
      control.setAttribute("aria-pressed", String(type === family));
      control.title = families[type].title;
      control.append(lineSample(type, true));
      control.addEventListener("click", () => {
        selectType(type);
        tracks.querySelector(`[data-track="${type}"]`).focus({ preventScroll: true });
      });
      return control;
    }));
    updateTracks();
  }

  function showProof(pair) {
    byId("wire-proof").style.setProperty("--wire", families[family].color);
    byId("wire-proof-title").textContent = families[family].label;
    byId("wire-how").textContent = families[family].how;
    const evidence = byId("wire-evidence");
    if (!pair) {
      evidence.replaceChildren();
      return;
    }
    const { from, to } = pair;
    const { explanation, quote } = describeLink(sample, from, to, family, pair.cosine);
    const references = el("div", "wire-references");
    for (const node of from.title === to.title ? [from] : [from, to]) {
      const link = el("a", "wire-source", `${node.title} ↗`);
      link.href = articleURL(node.title, Boolean(node.text));
      link.target = "_blank";
      link.rel = "noopener";
      references.append(link);
    }
    const observation = family === "S" ? [] : [el("p", "wire-observation", explanation)];
    evidence.replaceChildren(...observation, ...(quote ? [quote] : []), references);
  }

  function render(animate) {
    const available = pairs.filter(pair => pair.types.includes(family));
    const pair = available.find(item => item.key === selectedKey) ?? available[0];
    byId("wire-route").hidden = !pair;
    byId("wire-empty").hidden = Boolean(pair);
    updatePoolControls();
    showProof(pair);
    if (!pair) {
      byId("wire-empty-title").textContent = `0 ${families[family].title.toLowerCase()} in this example`;
      byId("wire-empty-note").textContent = sample.dataset === "MuSiQue" && family === "S"
        ? "MuSiQue supplies passages as text. The other tabs show links built from that text."
        : "Choose another type to see which passages are connected in this example.";
      return;
    }
    selectedKey = pair.key;
    const options = available.slice(0, 18);
    if (!options.includes(pair)) options.push(pair);
    pairControl.replaceChildren(...options.map(item => {
      const option = el("option", "", `${item.from.title} → ${item.to.title}`);
      option.value = item.key;
      return option;
    }));
    pairControl.value = pair.key;
    showNode("wire-from", pair.from);
    showNode("wire-to", pair.to);
    showTracks(pair);
    if (animate) replay();
  }

  function selectType(type) {
    family = type;
    render(true);
  }

  makeTypeButtons();
  pairControl.addEventListener("change", () => {
    selectedKey = pairControl.value;
    render(true);
  });
  byId("wire-replay").addEventListener("click", replay);
  document.addEventListener("secondhop:replay-link", replay);
  document.addEventListener("secondhop:route", ({ detail }) => {
    if (!detail) return;
    selectedKey = detail.key;
    selectType(detail.active[0]);
  });
  for (const id of ["wire-from", "wire-to"]) {
    byId(id).addEventListener("click", event => {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent("secondhop:passage", { detail: Number(event.currentTarget.dataset.node) }));
    });
  }
  toggle.addEventListener("click", () => {
    const next = enabled.includes(family) ? enabled.filter(type => type !== family) : [...enabled, family];
    document.dispatchEvent(new CustomEvent("secondhop:links", { detail: next }));
  });
  document.addEventListener("secondhop:state", ({ detail }) => {
    enabled = detail.families;
    const changedCase = sample !== detail.sample;
    const budget = detail.result.seeds.length;
    if (!changedCase && budget === previousBudget) {
      updatePoolControls();
      return;
    }
    previousBudget = budget;
    sample = detail.sample;
    pairs = [...detail.result.routes].sort(comparePair);
    counts = Object.fromEntries(keys.map(type => [type, pairs.filter(pair => pair.types.includes(type)).length]));
    byId("wire-example").hidden = sample.id === "blood-street";
    if (changedCase) {
      family = keys.find(type => counts[type]) ?? "S";
      selectedKey = undefined;
    }
    render(false);
  });
})();
