(() => {
  "use strict";

  const { families } = window.SECOND_HOP_LINKS;
  const gold = "#ffce8d";
  const violet = "#bbabff";
  const cyan = "#8cdbdf";
  const muted = "#a99ab8";
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const smooth = t => t * t * (3 - 2 * t);
  const seedKey = id => "p" + id;

  function segmentDistance(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length, 0, 1) : 0;
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
  }

  function noise(id, salt) {
    const hash = Math.imul(id ^ Math.imul(salt, 0x9e3779b1), 0x45d9f3b);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  }

  function orbit(id, rx, ry, cy = .48) {
    const angle = noise(id, 1) * Math.PI * 2;
    const distance = Math.sqrt(noise(id, 2));
    return { x: .5 + Math.cos(angle) * rx * distance, y: cy + Math.sin(angle) * ry * distance };
  }

  function keyframe(index) {
    return { nodes: new Map(), edges: new Map(), cloud: [1, .35, .19, 0, 0][index], guides: [0, 1, 2, 3, 4].map(i => Number(i === index)) };
  }

  function addPassage(frame, node, at, style) {
    frame.nodes.set(seedKey(node.id), { ...at, ...style, node, opacity: style.opacity ?? 1 });
  }

  function lane(index, count) {
    return count === 1 ? .46 : .2 + .58 * index / Math.max(1, count - 1);
  }

  function makeFrames(result, ranking, preview) {
    const frames = Array.from({ length: 5 }, (_, index) => keyframe(index));
    const [corpus, search, graph, pool, final] = frames;
    const highlighted = result.seeds.slice(0, 5);
    const highlightedIds = new Set(highlighted.map(node => node.id));
    const rankedIds = new Set(ranking.map(item => item.node.id));
    const candidates = [...result.origins.values()];
    const fromVisibleSeeds = candidates.filter(route => highlightedIds.has(route.from.id));
    const illustrated = [...fromVisibleSeeds].sort((a, b) =>
      Number(rankedIds.has(b.to.id)) - Number(rankedIds.has(a.to.id)) ||
      Number(b.to.supporting) - Number(a.to.supporting) ||
      b.active.length - a.active.length || a.from.rank - b.from.rank
    ).slice(0, 7);
    const namesByRoute = new Map(illustrated.map((route, index) => [route.to.id, index]));
    const seedPositions = new Map(highlighted.map((node, index) => [node.id, lane(index, highlighted.length)]));
    const pooled = [...result.seeds, ...candidates.map(route => route.to)];
    const crowded = pooled.length > 180;
    const radius = crowded ? 1.6 : pooled.length > 100 ? 2.25 : 3.2;

    for (const node of new Map([...preview, ...highlighted].map(item => [item.id, item])).values()) {
      addPassage(corpus, node, orbit(node.id, .44, .36), { radius: 2.6, color: violet, opacity: .72 });
    }

    const ranks = ["words", "meaning"];
    const orders = ranks.map(rank => preview.filter(node => node[rank]).sort((a, b) => a[rank] - b[rank]));
    preview.forEach((node, index) => {
      const active = result.seedIds.has(node.id);
      addPassage(search, node, { x: .5, y: lane(index, preview.length) }, {
        color: active ? gold : muted, radius: 5.2, label: node.title, align: "center", spawn: orbit(node.id, .44, .36),
      });
      ranks.forEach((rank, side) => {
        if (!node[rank]) return;
        const source = rank + node.id;
        const rankOrder = orders[side];
        const color = side ? violet : cyan;
        search.nodes.set(source, {
          x: side ? .88 : .12, y: lane(rankOrder.indexOf(node), rankOrder.length),
          opacity: .85, radius: 3.7, color, rank: "#" + node[rank],
        });
        search.edges.set(source, {
          from: side ? seedKey(node.id) : source, to: side ? source : seedKey(node.id), color, opacity: .58, bend: 0, strong: true,
        });
      });
    });

    for (const node of result.seeds) {
      const featured = highlightedIds.has(node.id);
      const at = featured ? { x: .25, y: seedPositions.get(node.id) }
        : { x: .27 + .12 * noise(node.id, 3), y: .16 + .66 * noise(node.id, 4) };
      addPassage(graph, node, at, {
        radius: featured ? 6 : radius, color: gold, opacity: featured ? 1 : .7,
        label: featured ? node.title : "", align: "left", spawn: orbit(node.id, .42, .34),
      });
    }
    for (const route of candidates) {
      const node = route.to;
      const name = namesByRoute.get(node.id);
      const featured = name !== undefined;
      const at = featured ? { x: .73, y: lane(name, illustrated.length) }
        : { x: .54 + .27 * noise(node.id, 3), y: .14 + .69 * noise(node.id, 4) };
      addPassage(graph, node, at, {
        radius: featured ? 5.9 : radius, color: violet, opacity: featured ? 1 : .62,
        label: featured ? node.title : "", align: "right", from: seedKey(route.from.id),
      });
    }
    for (const route of result.routes) {
      if (!route.active.length) continue;
      const featured = illustrated.includes(route);
      const types = route.active;
      types.forEach((type, index) => {
        graph.edges.set(route.key + type, {
          from: seedKey(route.from.id), to: seedKey(route.to.id),
          type, color: families[type].color, dash: families[type].dash, strong: featured,
          bend: (index - (types.length - 1) / 2) * (featured ? .027 : .01),
          opacity: featured ? .79 : crowded ? .07 : .17, route,
        });
      });
    }

    for (const node of pooled) {
      const seed = result.seedIds.has(node.id);
      addPassage(pool, node, orbit(node.id, .225, .305), {
        radius: rankedIds.has(node.id) ? Math.max(radius, 3.7) : radius,
        color: seed ? gold : violet, opacity: crowded ? .68 : .87,
      });
    }

    ranking.forEach(({ node }, index) => {
      addPassage(final, node, { x: .232, y: .185 + .14 * index }, {
        radius: 6.2, color: result.seedIds.has(node.id) ? gold : violet, label: node.title, align: "row",
        rank: String(index + 1),
      });
    });
    return frames;
  }

  function interpolate(left, right, t) {
    if (t <= 0) return left;
    if (t >= 1) return right;
    const nodes = new Map();
    for (const [key, start] of left.nodes) {
      const end = right.nodes.get(key);
      if (end) {
        nodes.set(key, {
          ...(t < .5 ? start : end),
          x: mix(start.x, end.x, t), y: mix(start.y, end.y, t),
          radius: mix(start.radius, end.radius, t), opacity: mix(start.opacity, end.opacity, t),
          textOpacity: start.label === end.label && start.align === end.align ? 1 : Math.abs(1 - 2 * t),
        });
      } else {
        nodes.set(key, { ...start, radius: start.radius * (1 - .42 * t), opacity: start.opacity * (1 - t) });
      }
    }
    for (const [key, end] of right.nodes) {
      if (nodes.has(key)) continue;
      const start = left.nodes.get(end.from) ?? right.nodes.get(end.from) ?? end.spawn ?? end;
      nodes.set(key, {
        ...end,
        x: mix(start.x, end.x, t),
        y: mix(start.y, end.y, t) - (end.from ? Math.sin(Math.PI * t) * .049 : 0),
        radius: mix(Math.min(2.4, end.radius), end.radius, t),
        opacity: end.opacity * t, textOpacity: t,
      });
    }
    const edges = new Map();
    for (const [key, edge] of left.edges) {
      edges.set(key, { ...edge, opacity: mix(edge.opacity, right.edges.get(key)?.opacity ?? 0, t) });
    }
    for (const [key, edge] of right.edges) {
      if (!edges.has(key)) edges.set(key, { ...edge, opacity: edge.opacity * t, arrival: t });
    }
    return {
      nodes, edges, cloud: mix(left.cloud, right.cloud, t),
      guides: left.guides.map((weight, index) => mix(weight, right.guides[index], t)),
    };
  }

  function passageScene(canvas, { inspect, inspectLink, pause }) {
    const ctx = canvas.getContext("2d");
    const field = canvas.parentElement;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const panButton = document.getElementById("scene-pan");
    const offsets = new Map();
    let frames;
    let drawn;
    let progress = 0;
    let morph;
    let raf = 0;
    let width = 0, height = 0;
    let zoom = 1, panX = 0, panY = 0;
    let pointer;
    let hover;
    let located;
    let noSeeds = false;
    let shortRanking = 5;
    let boxes = [];
    let strokes = [];
    let panEnabled = false;

    function invalidate() {
      if (!raf) raf = requestAnimationFrame(render);
    }

    function frameAt(value) {
      const step = Math.floor(value);
      return interpolate(frames[step], frames[Math.min(step + 1, frames.length - 1)], smooth(value - step));
    }

    function update(result, ranking, preview, animate = true) {
      if (frames && animate && !motion.matches) morph = { start: performance.now(), from: drawn ?? frameAt(progress) };
      else morph = undefined;
      noSeeds = !result.seeds.length;
      shortRanking = ranking.length;
      frames = makeFrames(result, ranking, preview);
      if (located && !frames[2].edges.has(located.key)) located = undefined;
      invalidate();
    }

    function setPosition(value) {
      progress = value;
      invalidate();
    }

    function point(key, node) {
      const offset = offsets.get(key);
      return { x: (node.x + (offset?.x ?? 0)) * width, y: (node.y + (offset?.y ?? 0)) * height };
    }

    function render(now) {
      raf = 0;
      if (!frames || !ctx) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width * (.5 + panX), height * (.5 + panY));
      ctx.scale(zoom, zoom);
      ctx.translate(-width * .5, -height * .5);
      drawn = frameAt(progress);
      if (morph) {
        const fraction = clamp((now - morph.start) / 575, 0, 1);
        drawn = interpolate(morph.from, drawn, smooth(fraction));
        if (fraction < 1) invalidate();
        else morph = undefined;
      }
      boxes = [];
      strokes = [];
      drawGuides(drawn);
      drawEdges(drawn, now);
      drawNodes(drawn.nodes);
    }

    function drawGuides({ cloud, guides }) {
      if (cloud > .01) {
        ctx.fillStyle = violet;
        const count = width < 490 ? 236 : 382;
        for (let index = 1; index <= count; index++) {
          const p = orbit(index + 5000, .445 + .023 * cloud, .36, .48);
          ctx.globalAlpha = cloud * (.15 + .62 * noise(index, 5));
          ctx.beginPath();
          ctx.arc(p.x * width, p.y * height, .8 + noise(index, 6) * 1.48, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const [, search, graph, pool, final] = guides;
      if (search > .01) {
        caption("WORD RANK", .12, search, cyan);
        caption("FUSED RANK", .5, search, gold);
        caption("MEANING RANK", .88, search, violet);
      }
      if (graph > .01) {
        caption("SEARCH HITS", .25, graph, gold);
        caption("LINKED NEIGHBOURS", .73, graph, violet);
      }
      const boundary = guides[0] * .45 + graph * .15 + pool * .65;
      if (boundary > .015) {
        ctx.globalAlpha = boundary;
        ctx.strokeStyle = violet;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 7]);
        ctx.beginPath();
        ctx.ellipse(.5 * width, .48 * height, mix(.47, .25, pool) * width, mix(.39, .341, pool) * height, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (final > .01) {
        ctx.globalAlpha = final * .59;
        for (let index = 0; index < shortRanking; index++) {
          ctx.fillStyle = "#2e2241";
          ctx.strokeStyle = "#655178";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(width * .15, height * (.185 + .14 * index - .051), width * .7, height * .102, 8);
          ctx.fill();
          ctx.stroke();
        }
      }
      if (noSeeds && graph + pool + final > .65) {
        ctx.globalAlpha = graph + pool + final;
        ctx.textAlign = "center";
        ctx.font = "600 13px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#f5effb";
        ctx.fillText("Choose a seed in Search to start.", width * .5, height * .47);
      }
      ctx.globalAlpha = 1;
    }

    function caption(text, x, opacity, color) {
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.font = (width < 480 ? "10px" : "12px") + " ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(text, x * width, height * .095);
    }

    function curve(path, start, end, bend) {
      const reach = (end.x - start.x) * .42;
      path.moveTo(start.x, start.y);
      path.bezierCurveTo(start.x + reach, start.y + bend, end.x - reach, end.y + bend, end.x, end.y);
    }

    function drawEdges(frame, now) {
      const groups = new Map();
      const focused = [];
      for (const [key, edge] of frame.edges) {
        const start = frame.nodes.get(edge.from);
        const end = frame.nodes.get(edge.to);
        if (!start || !end || edge.opacity < .012) continue;
        const a = point(edge.from, start);
        const b = point(edge.to, end);
        const bend = edge.bend * height;
        const selected = located?.key === key;
        const hoveredEdge = hover?.route && hover.route === edge.route && hover.type === edge.type;
        const emphasize = selected || hoveredEdge || hover?.key === edge.from || hover?.key === edge.to;
        if (edge.route) strokes.push({ edge, a, b, bend, featured: edge.strong || selected });
        if (edge.strong || emphasize) {
          focused.push({ edge, a, b, bend, emphasize, selected });
          continue;
        }
        const group = edge.type ?? edge.color;
        if (!groups.has(group)) groups.set(group, { edge, path: new Path2D() });
        curve(groups.get(group).path, a, b, bend);
      }
      for (const { edge, path } of groups.values()) {
        ctx.strokeStyle = edge.color;
        ctx.globalAlpha = edge.opacity;
        ctx.lineWidth = .75;
        ctx.setLineDash([]);
        ctx.stroke(path);
      }
      for (const { edge, a, b, bend, emphasize, selected } of focused) {
        ctx.strokeStyle = edge.color;
        ctx.globalAlpha = emphasize ? 1 : edge.opacity;
        ctx.lineWidth = emphasize ? 2.6 : 1.45;
        ctx.setLineDash(edge.dash ?? []);
        ctx.beginPath();
        curve(ctx, a, b, bend);
        ctx.stroke();
        if (edge.route) {
          const replay = selected && !motion.matches ? (now - located.start) / 1200 : 1;
          const travel = replay < 1 ? Math.max(0, replay) : .58 + (edge.arrival ?? 1) * .42;
          if (travel < 1) {
            const p = along(a, b, bend, travel);
            ctx.fillStyle = edge.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2);
            ctx.fill();
            if (replay < 1) invalidate();
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    function along(a, b, bend, t) {
      const u = 1 - t;
      const reach = (b.x - a.x) * .42;
      return {
        x: u ** 3 * a.x + 3 * u * u * t * (a.x + reach) + 3 * u * t * t * (b.x - reach) + t ** 3 * b.x,
        y: u ** 3 * a.y + 3 * u * u * t * (a.y + bend) + 3 * u * t * t * (b.y + bend) + t ** 3 * b.y,
      };
    }

    function drawNodes(nodes) {
      const labels = [];
      for (const [key, node] of nodes) {
        if (node.opacity < .035) continue;
        const p = point(key, node);
        const locatedNode = Math.round(progress) === 2 && (located?.from === key || located?.to === key);
        const active = hover?.key === key || locatedNode;
        ctx.globalAlpha = active ? 1 : node.opacity;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, node.radius + (active ? 2 : 0), 0, Math.PI * 2);
        ctx.fill();
        if (node.radius >= 5 || active) {
          ctx.strokeStyle = node.color;
          ctx.globalAlpha *= .42;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, node.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        const box = { key, x: p.x, y: p.y, radius: Math.max(8, node.radius + 5), node: node.node, named: Boolean(node.label) };
        if (node.node && node.opacity > .38) boxes.push(box);
        if (node.label || node.rank || active) labels.push({ node, p, box, active });
      }
      for (const label of labels) drawLabel(label);
      ctx.globalAlpha = 1;
    }

    function drawLabel({ node, p, box, active }) {
      const font = width < 470 ? 11 : 13;
      const align = node.align ?? "right";
      const title = node.label || (active ? node.node?.title : "");
      ctx.globalAlpha = node.opacity * (node.textOpacity ?? 1);
      ctx.font = "600 " + font + "px Inter, system-ui, sans-serif";
      if (node.rank) {
        ctx.textAlign = node.x > .5 ? "left" : "right";
        ctx.fillStyle = node.color;
        ctx.fillText(node.rank, p.x + (align === "row" ? -19 : node.x > .5 ? 8 : -8), p.y + 4);
      }
      if (!title) return;
      let text = title;
      const maxWidth = width * (align === "row" ? .52 : align === "center" ? .36 : .21);
      while (ctx.measureText(text).width > maxWidth && text.length > 2) text = text.slice(0, -2) + "…";
      const x = p.x + (align === "left" ? -13 : align === "center" ? 0 : 13);
      const y = p.y + (align === "center" ? 19 : 4);
      ctx.textAlign = align === "left" ? "right" : align === "center" ? "center" : "left";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#1a1425";
      ctx.strokeText(text, x, y);
      ctx.fillStyle = "#f4ebfc";
      ctx.fillText(text, x, y);
      const textWidth = ctx.measureText(text).width;
      box.label = { left: x - (align === "left" ? textWidth : align === "center" ? textWidth / 2 : 0), y, width: textWidth, font };
    }

    function hit(x, y) {
      const at = {
        x: (x - width * (.5 + panX)) / zoom + width * .5,
        y: (y - height * (.5 + panY)) / zoom + height * .5,
      };
      let closest;
      let best = Infinity;
      let bestNamed;
      let namedDistance = Infinity;
      for (const box of boxes) {
        const distance = Math.hypot(box.x - at.x, box.y - at.y);
        if (distance < box.radius && distance < best) {
          closest = box;
          best = distance;
        }
        if (box.named && distance < box.radius && distance < namedDistance) {
          bestNamed = box;
          namedDistance = distance;
        }
      }
      if (bestNamed) return bestNamed;
      for (const box of boxes) {
        const label = box.label;
        if (label && at.x >= label.left && at.x <= label.left + label.width &&
            at.y >= label.y - label.font && at.y <= label.y + 3) return box;
      }
      if (closest) return closest;
      let featuredEdge;
      let featuredDistance = 5;
      best = 6;
      for (const { edge, a, b, bend, featured } of strokes) {
        if (at.x < Math.min(a.x, b.x) - 6 || at.x > Math.max(a.x, b.x) + 6 ||
            at.y < Math.min(a.y, b.y) - Math.abs(bend) - 6 || at.y > Math.max(a.y, b.y) + Math.abs(bend) + 6) continue;
        const steps = Math.max(8, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 14));
        let previous = a;
        for (let i = 1; i <= steps; i++) {
          const p = along(a, b, bend, i / steps);
          const distance = segmentDistance(at, previous, p);
          previous = p;
          if (featured && distance < featuredDistance) {
            featuredEdge = edge;
            featuredDistance = distance;
          }
          if (distance < best) {
            closest = edge;
            best = distance;
          }
        }
      }
      return featuredEdge ?? closest;
    }

    function getTarget(event) {
      const rect = canvas.getBoundingClientRect();
      return hit(event.clientX - rect.left, event.clientY - rect.top);
    }

    canvas.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      const target = getTarget(event);
      const draggable = event.pointerType !== "touch" || panEnabled;
      pointer = {
        id: event.pointerId, x: event.clientX, y: event.clientY, target, draggable, moved: false,
        x0: panX, y0: panY, offset: offsets.get(target?.key) ?? { x: 0, y: 0 },
      };
      if (draggable) canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", event => {
      if (pointer?.id !== event.pointerId) {
        const target = getTarget(event);
        if (target?.key !== hover?.key || target?.route !== hover?.route || target?.type !== hover?.type) {
          hover = target;
          canvas.toggleAttribute("data-target", Boolean(target));
          invalidate();
        }
        return;
      }
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.moved && Math.hypot(dx, dy) < 5) return;
      if (!pointer.moved && pointer.draggable) pause();
      pointer.moved = true;
      if (!pointer.draggable) return;
      canvas.toggleAttribute("data-dragging", true);
      if (pointer.target?.node) {
        hover = pointer.target;
        offsets.set(pointer.target.key, { x: pointer.offset.x + dx / width / zoom, y: pointer.offset.y + dy / height / zoom });
      } else {
        panX = clamp(pointer.x0 + dx / width, -2, 2);
        panY = clamp(pointer.y0 + dy / height, -2, 2);
      }
      invalidate();
    });

    function endPointer(event, inspectTarget) {
      if (pointer?.id !== event.pointerId) return;
      const { target, moved } = pointer;
      pointer = undefined;
      canvas.removeAttribute("data-dragging");
      if (inspectTarget && !moved && target?.node) inspect(target.node.id);
      else if (inspectTarget && !moved && target?.route) inspectLink(target.route, target.type);
    }

    canvas.addEventListener("pointerup", event => endPointer(event, true));
    canvas.addEventListener("pointercancel", event => endPointer(event, false));
    canvas.addEventListener("pointerleave", () => {
      if (pointer) return;
      hover = undefined;
      canvas.removeAttribute("data-target");
      invalidate();
    });

    function zoomBy(multiplier) {
      const previous = zoom;
      zoom = clamp(zoom * multiplier, .55, 3.2);
      panX = clamp(panX * zoom / previous, -2, 2);
      panY = clamp(panY * zoom / previous, -2, 2);
      invalidate();
    }

    function reset() {
      panX = panY = 0;
      zoom = 1;
      offsets.clear();
      hover = undefined;
      located = undefined;
      canvas.removeAttribute("data-target");
      invalidate();
    }

    function locate(route, family) {
      const key = route.key + family;
      const graph = frames?.[2];
      const edge = graph?.edges.get(key);
      if (!edge || !width || !height) return;
      const a = point(edge.from, graph.nodes.get(edge.from));
      const b = point(edge.to, graph.nodes.get(edge.to));
      const xSpan = Math.abs(b.x - a.x) / width;
      const ySpan = Math.abs(b.y - a.y) / height;
      zoom = clamp(Math.min(1.4, .67 / xSpan, .66 / ySpan), .55, 1.4);
      panX = (.5 - (a.x + b.x) / (2 * width)) * zoom;
      panY = (.48 - (a.y + b.y) / (2 * height)) * zoom;
      located = { key, from: edge.from, to: edge.to, start: performance.now() };
      hover = undefined;
      invalidate();
    }

    panButton.addEventListener("click", () => {
      panEnabled = !panEnabled;
      field.dataset.pan = String(panEnabled);
      panButton.setAttribute("aria-pressed", String(panEnabled));
    });
    document.getElementById("scene-plus").addEventListener("click", () => zoomBy(1.25));
    document.getElementById("scene-minus").addEventListener("click", () => zoomBy(.8));
    document.getElementById("scene-reset").addEventListener("click", reset);

    field.addEventListener("keydown", event => {
      if (event.target !== field) return;
      const move = { ArrowLeft: [.08, 0], ArrowRight: [-.08, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }[event.key];
      if (move) {
        panX = clamp(panX + move[0], -2, 2);
        panY = clamp(panY + move[1], -2, 2);
        invalidate();
      } else if (event.key === "+" || event.key === "=") zoomBy(1.25);
      else if (event.key === "-") zoomBy(.8);
      else if (event.key === "0") reset();
      else return;
      event.preventDefault();
    });

    new ResizeObserver(invalidate).observe(canvas);
    document.fonts.ready.then(invalidate);
    return { update, setPosition, reset, locate };
  }

  window.SECOND_HOP_SCENE = passageScene;
})();
