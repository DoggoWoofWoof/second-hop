(() => {
  "use strict";

  const families = {
    S: { label: "Hyperlink", title: "Hyperlinks", color: "#8cdbdf", dash: [], length: 27 },
    R: { label: "Title rule", title: "Title rules", color: "#ed9ebd", dash: [7, 4], length: 31 },
    N: { label: "Shared name", title: "Shared names", color: "#c5d990", dash: [2, 5], length: 37 },
    K: { label: "Semantic link", title: "Semantic links", color: "#bbabff", dash: [8, 3, 2, 3], length: 46 },
  };

  const articlePaths = new Map([
    ["The Newcomers (film)", "The_Newcomers#Film"],
    ["The Newcomer in The Cabbage", "Vaniusha_The_Newcomer"],
  ]);

  function articleURL(title) {
    return "https://en.wikipedia.org/wiki/" + (articlePaths.get(title) ?? encodeURIComponent(title.replaceAll(" ", "_")));
  }

  function matches(text, term) {
    if (!term) return [];
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("(?<![\\p{L}\\p{N}])" + escaped + "(?![\\p{L}\\p{N}])", "giu");
    return [...(text ?? "").matchAll(pattern)];
  }

  function otherEnd(edge, node) {
    return edge.a.id === node.id ? edge.b : edge.a;
  }

  function terms(edge, type, node, names) {
    if (type === "N") return names?.[edge.key] ?? [];
    const other = otherEnd(edge, node);
    if (type === "R" && other.title !== node.title && matches(node.text, other.title).length) return [other.title];
    return [];
  }

  function explanation(edge, type, names) {
    const { a, b, cosine } = edge;
    if (type === "S") return "The source corpus records a Wikipedia hyperlink between these pages. Its plain text does not retain the original anchor.";
    if (type === "K") return "The embeddings compare whole passages. Recorded cosine similarity: " + (cosine?.toFixed(3) ?? "unavailable") + ".";
    if (type === "N") {
      const found = names?.[edge.key] ?? [];
      return found.length ? "The entity tagger matched " + found.map(name => "“" + name + "”").join(", ") + " in both passages."
        : "The recorded graph links these passages through a shared named entity.";
    }
    if (a.title === b.title) return "Both passages come from the same article.";
    if (matches(a.text, b.title).length) return "“" + b.title + "” appears in " + a.title + ".";
    if (matches(b.text, a.title).length) return "“" + a.title + "” appears in " + b.title + ".";
    return "This recorded title rule matched normalized article titles.";
  }

  function highlights(text, phrases) {
    const spans = [];
    for (const [key, phrase] of phrases) {
      for (const match of matches(text, phrase)) {
        spans.push({ key, start: match.index, end: match.index + match[0].length });
      }
    }
    spans.sort((a, b) => a.start - b.start || b.end - a.end);
    let cursor = 0;
    return spans.filter(span => {
      if (span.start < cursor) return false;
      cursor = span.end;
      return true;
    });
  }

  window.SECOND_HOP_LINKS = { families, articleURL, otherEnd, terms, explanation, highlights };
})();
