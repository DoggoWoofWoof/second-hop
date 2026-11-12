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
  const articleURL = title => `https://en.wikipedia.org/wiki/${articlePaths.get(title) ?? encodeURIComponent(title.replaceAll(" ", "_"))}`;
  const edgeKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const formatList = new Intl.ListFormat("en", { type: "conjunction" });
  const svgNamespace = "http://www.w3.org/2000/svg";
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function excerpt(text, term) {
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

  function describeLink(sample, origin, target, family) {
    const details = window.SECOND_HOP_PIPELINE[sample.id].linkDetails[edgeKey(origin.id, target.id)];
    if (family === "K") {
      return { explanation: `Recorded cosine similarity between these two passages is ${details.cosine.toFixed(3)}.` };
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

  window.SECOND_HOP_LINKS = { families, articleURL, describeLink };

  const byId = id => document.getElementById(id);
  const typeList = byId("wire-types");
  const pairControl = byId("wire-pair");
  const tracks = byId("wire-tracks");
  const toggle = byId("wire-toggle");
  const buttons = new Map();
  let sample;
  let pairs = [];
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
    const hit = node => node.rank !== null && node.rank <= 5;
    const useful = ({ from, to }) => hit(from) && to.supporting && !hit(to) ? 0 : from.supporting && to.supporting ? 1
      : from.supporting || to.supporting ? 2 : 3;
    return useful(a) - useful(b) || (a.from.rank ?? 1001) - (b.from.rank ?? 1001);
  }

  function collectPairs(example) {
    const nodes = new Map(example.nodes.map(node => [node.id, node]));
    const grouped = new Map();
    for (const type of keys) {
      for (const [a, b] of example.edges[type]) {
        const key = edgeKey(a, b);
        if (!grouped.has(key)) {
          const [from, to] = [nodes.get(a), nodes.get(b)].sort((x, y) => (x.rank ?? 1001) - (y.rank ?? 1001));
          grouped.set(key, { key, from, to, types: [] });
        }
        grouped.get(key).types.push(type);
      }
    }
    return [...grouped.values()].sort(comparePair);
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
      const total = sample.edges[type].length;
      control.setAttribute("aria-pressed", String(type === family));
      count.textContent = `${total} shown · ${enabled.includes(type) ? "In pool" : "Off"}`;
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
    element.querySelector("small").textContent = node.rank === null ? "Beyond rank #1,000" : `First search #${node.rank.toLocaleString("en-US")}`;
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
    const { explanation, quote } = describeLink(sample, from, to, family);
    const references = el("div", "wire-references");
    for (const title of new Set([from.title, to.title])) {
      const link = el("a", "wire-source", `${title} ↗`);
      link.href = articleURL(title);
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
    pairControl.replaceChildren(...available.map(item => {
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
  for (const id of ["wire-from", "wire-to"]) {
    byId(id).addEventListener("click", ({ currentTarget }) => document.dispatchEvent(
      new CustomEvent("secondhop:passage", { detail: Number(currentTarget.dataset.node) }),
    ));
  }
  toggle.addEventListener("click", () => {
    const next = enabled.includes(family) ? enabled.filter(type => type !== family) : [...enabled, family];
    document.dispatchEvent(new CustomEvent("secondhop:links", { detail: next }));
  });
  document.addEventListener("secondhop:state", ({ detail }) => {
    enabled = detail.families;
    if (sample === detail.sample) {
      updatePoolControls();
      return;
    }
    sample = detail.sample;
    pairs = collectPairs(sample);
    byId("wire-example").hidden = sample.id === "blood-street";
    family = keys.find(type => sample.edges[type].length) ?? "S";
    selectedKey = undefined;
    render(false);
  });
})();
