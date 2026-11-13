(() => {
  "use strict";

  const { families } = window.SECOND_HOP_LINKS;
  const gold = "#ffce8d";
  const violet = "#bbabff";
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const keys = Object.keys(families);

  function phaseOf(id) {
    return ((Math.imul(id + 71, 0x9e3779b1) >>> 0) / 4294967296) * Math.PI * 2;
  }

  function graphScene(canvas, handlers) {
    const field = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const linkForce = d3.forceLink().id(node => node.id);
    const charge = d3.forceManyBody().strength(-22).distanceMax(195);
    const pullX = d3.forceX(0);
    const pullY = d3.forceY(0);
    const simulation = d3.forceSimulation().stop()
      .alphaTarget(.07).alphaDecay(.07).velocityDecay(.45)
      .force("links", linkForce)
      .force("charge", charge)
      .force("collision", d3.forceCollide(4.5).strength(.65))
      .force("x", pullX)
      .force("y", pullY)
      .force("drift", alpha => {
        for (const node of nodes) {
          if (node.fx != null) continue;
          node.vx += Math.sin(clock * .0017 + node.phase) * alpha * 2.25;
          node.vy += Math.cos(clock * .0014 + node.phase) * alpha * 1.6;
        }
      });

    const layout = new Map();
    let nodes = [];
    let links = [];
    let fading = [];
    let departing = [];
    let selected = null;
    let signal = null;
    let hover = null;
    let pointer = null;
    let width = 0, height = 0, frame = 0, clock = 0, lastTick = 0, lastPaint = 0;
    let camera = { x: 0, y: 0, scale: 1 };
    let destination = null;
    let hasFit = false;
    let paused = motion.matches;
    let panTouch = false;
    let visible = true;
    let forceFit = true;
    let hits = [];
    let strokes = [];
    let sky = null;
    let skyExit = null;
    let linkTypes = null;
    const skyRadius = 670;

    function schedule() {
      if (!frame && visible) frame = requestAnimationFrame(draw);
    }

    function show(model, result, { fresh, shrunk }) {
      if (fresh) {
        layout.clear();
        nodes = links = departing = fading = [];
        selected = signal = hover = destination = sky = skyExit = linkTypes = null;
        camera = { x: 0, y: 0, scale: 1 };
        hasFit = false;
        forceFit = true;
      }
      const now = performance.now();
      const previous = new Set(nodes.map(node => node.id));
      const oldLinks = new Map(links.map(link => [link.edge.key, link]));
      departing = nodes.filter(node => !model.ids.has(node.id)).map(node => ({ ...node, exit: now }));
      const n = model.nodes.length;
      nodes = model.nodes.map((passage, index) => {
        const existing = layout.get(passage.id);
        if (existing) {
          existing.seed = result.seedIds.has(passage.id);
          existing.highlight = passage.supporting || existing.seed;
          if (!previous.has(passage.id)) existing.enter = now;
          return existing;
        }
        const angle = index * 2.3999632297 + phaseOf(passage.id) * .15;
        const r = Math.sqrt(index + .5) * 10;
        const node = {
          id: passage.id, passage, phase: phaseOf(passage.id),
          x: r * Math.cos(angle), y: r * Math.sin(angle) * .8,
          enter: now, seed: result.seedIds.has(passage.id),
          highlight: passage.supporting || result.seedIds.has(passage.id),
        };
        layout.set(node.id, node);
        return node;
      });
      const active = model.pairs.filter(edge => edge.active.length);
      const activeTypes = new Map(active.map(edge => [edge.key, edge.active]));
      fading = links.flatMap(link => {
        const types = link.types.filter(type => !activeTypes.get(link.edge.key)?.includes(type));
        return types.length ? [{ ...link, types, exit: now }] : [];
      });
      links = active.map(edge => ({
        source: edge.a.id, target: edge.b.id, edge, types: edge.active,
        enter: oldLinks.has(edge.key) && edge.active.every(type => oldLinks.get(edge.key).types.includes(type)) ? null : now,
      }));
      linkForce.links([]);
      simulation.nodes(nodes);
      linkForce.links(links)
        .distance(link => Math.min(...link.types.map(type => families[type].length)) * (shrunk ? .82 : 1))
        .strength(link => Math.min(.27, .078 + link.types.length * .042));
      pullX.strength(shrunk ? .11 : .046);
      pullY.strength(shrunk ? .13 : .063);
      charge.strength(n > 1200 ? -11 : shrunk ? -16 : -24);
      simulation.alpha(fresh ? 1 : .7);
      if (fresh || motion.matches) simulation.tick(n > 1200 ? 9 : motion.matches ? 24 : 13);
      if (selected && !model.ids.has(selected.id)) selected = null;
      lastPaint = 0;
      schedule();
    }

    function fit(animated = true) {
      if (!width || !height || !nodes.length) return;
      if (sky) {
        aim({ x: 0, y: 0, scale: Math.min(width / 1180, height / 815) }, animated);
        hasFit = true;
        return;
      }
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (const node of nodes) {
        left = Math.min(left, node.x);
        right = Math.max(right, node.x);
        top = Math.min(top, node.y);
        bottom = Math.max(bottom, node.y);
      }
      const scale = clamp(Math.min((width - 72) / Math.max(45, right - left), (height - 119) / Math.max(45, bottom - top)), .23, 4.2);
      aim({ x: (left + right) / 2, y: (top + bottom) / 2, scale }, animated);
      hasFit = true;
    }

    function aim(value, animated = true) {
      if (animated && !motion.matches) destination = { from: { ...camera }, to: value, start: performance.now() };
      else {
        camera = value;
        destination = null;
      }
      schedule();
    }

    function locate(id, minScale = .9) {
      const active = layout.get(id);
      const node = active && nodes.includes(active) ? active : sky?.byId.get(id);
      if (!node) return;
      forceFit = false;
      aim({ x: node.x, y: node.y, scale: Math.max(camera.scale, minScale) });
    }

    function setFocus(id, routes = new Map()) {
      selected = id == null ? null : { id, routes };
      schedule();
    }

    function setLinkTypes(types) {
      linkTypes = types;
      hover = null;
      schedule();
    }

    function setCorpus(entries, poolIds) {
      if (!entries) {
        if (sky && !motion.matches) skyExit = { ...sky, time: performance.now() };
        sky = null;
        schedule();
        return;
      }
      const tile = document.createElement("canvas");
      tile.width = tile.height = skyRadius * 2;
      const ink = tile.getContext("2d");
      ink.fillStyle = "#c6aaff";
      const dots = [];
      const byId = new Map();
      function unit(i) { return (Math.imul(i ^ (i >>> 13), 0x5bd1e995) >>> 0) / 4294967296; }
      for (const [id, title] of entries) {
        if (poolIds.has(id)) continue;
        const r = skyRadius * (.12 + .86 * unit(id + 37) ** .72);
        const angle = (id % 5) * Math.PI * .4 + r * .0068 + (unit(id * 17 + 901) - .5) * (2 - r / skyRadius);
        const dot = { id, title, x: r * Math.cos(angle), y: r * Math.sin(angle) * .56 };
        dots.push(dot);
        byId.set(id, dot);
        const size = id % 79 === 0 ? 2.6 : 1.65;
        ink.globalAlpha = id % 79 === 0 ? .53 : .14 + (id % 7) * .025;
        ink.fillRect(skyRadius + dot.x, skyRadius + dot.y, size, size);
      }
      sky = { tile, byId, dots: d3.quadtree(dots, node => node.x, node => node.y), start: performance.now() };
      skyExit = null;
      schedule();
    }

    function paintCorpus(now) {
      const cloud = sky ?? skyExit;
      if (!cloud) return;
      const fade = sky ? (motion.matches ? 1 : clamp((now - sky.start) / 540, 0, 1))
        : 1 - clamp((now - skyExit.time) / 880, 0, 1);
      if (!fade && !sky) { skyExit = null; return; }
      const origin = projection({ x: 0, y: 0 });
      const spread = sky ? 1 : 1 + (1 - fade) * .18;
      const radius = skyRadius * camera.scale * spread;
      ctx.globalAlpha = fade;
      ctx.drawImage(cloud.tile, origin.x - radius, origin.y - radius, radius * 2, radius * 2);
      const dot = sky?.byId.get(hover?.id ?? selected?.id);
      if (dot) {
        const p = projection(dot);
        ctx.globalAlpha = 1;
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "600 12px Inter, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#170f21";
        const label = dot.title.length > 36 ? dot.title.slice(0, 34) + "…" : dot.title;
        const x = clamp(p.x + 10, 6, Math.max(6, width - ctx.measureText(label).width - 8));
        const y = clamp(p.y - 7, 16, height - 8);
        ctx.strokeText(label, x, y);
        ctx.fillStyle = "#f5effb";
        ctx.fillText(label, x, y);
      }
      ctx.globalAlpha = 1;
    }

    function setSignal(spec) {
      if (!spec) signal = null;
      else signal = {
        ...spec, previous: signal?.values, start: performance.now(),
        paths: new Map((spec.paths ?? []).map(path => [path.edge.key, path])),
      };
      schedule();
    }

    function pin(id, value) {
      const node = layout.get(id);
      if (!node) return;
      node.pinned = value;
      node.fx = value ? node.x : null;
      node.fy = value ? node.y : null;
      simulation.alpha(Math.max(.3, simulation.alpha()));
      schedule();
    }

    function isPinned(id) {
      return Boolean(layout.get(id)?.pinned);
    }

    function projection(node) {
      return { x: width * .5 + (node.x - camera.x) * camera.scale, y: height * .53 + (node.y - camera.y) * camera.scale };
    }

    function draw(now) {
      frame = 0;
      clock = now;
      if (!ctx || !width || !height) return;
      if (!paused && links.length + fading.length > 5500 && now - lastPaint < 29) {
        schedule();
        return;
      }
      lastPaint = now;
      const stepMs = nodes.length > 900 ? 44 : 15;
      if (!paused && now - lastTick >= stepMs) {
        simulation.tick();
        lastTick = now;
      }
      if (!hasFit) fit(false);
      if (destination) {
        const p = clamp((now - destination.start) / 480, 0, 1);
        const ease = p * p * (3 - 2 * p);
        for (const key of ["x", "y", "scale"]) camera[key] = mix(destination.from[key], destination.to[key], ease);
        if (p === 1) destination = null;
      }
      const ratio = Math.min(devicePixelRatio || 1, 2);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      fading = fading.filter(link => now - link.exit < 620);
      departing = departing.filter(node => now - node.exit < 820);
      paintCorpus(now);
      paintLinks(now);
      paintNodes(now);
      if (!paused || destination || departing.length || fading.length || skyExit || (sky && now - sky.start < 550) || nodes.some(node => now - node.enter < 520) ||
          (signal && now - signal.start < 720 && !motion.matches)) schedule();
    }

    function curve(a, b, i, count) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const l = Math.max(1, Math.hypot(dx, dy));
      const bend = count > 1 ? (i - (count - 1) / 2) * Math.min(8, l / 5) : Math.min(6, l * .08);
      return { x: (a.x + b.x) / 2 - dy / l * bend, y: (a.y + b.y) / 2 + dx / l * bend };
    }

    function drawCurve(path, a, mid, b) {
      path.moveTo(a.x, a.y);
      path.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
    }

    function curvePoint(a, mid, b, p) {
      const q = 1 - p;
      return { x: q * q * a.x + 2 * q * p * mid.x + p * p * b.x, y: q * q * a.y + 2 * q * p * mid.y + p * p * b.y };
    }

    function paintLinks(now) {
      strokes = [];
      const pools = new Map(keys.map(type => [type, new Path2D()]));
      const front = [];
      const highlightedIds = new Set(selected ? [selected.id] : []);
      const count = links.length;
      const stride = Math.max(1, Math.ceil((count + fading.length) / (camera.scale >= 1.6 ? 7400 : 4500)));
      const travel = signal ? clamp((now - signal.start) / 680, 0, 1) : 1;
      let index = 0;
      for (const link of [...links, ...fading]) {
        const focus = selected?.routes.get(link.edge.key);
        const transfer = signal?.paths.get(link.edge.key);
        const hovered = hover?.id === link.source.id || hover?.id === link.target.id || hover?.edge?.key === link.edge.key;
        const spotlight = (link.source.seed && (stride === 1 || link.source.passage.rank <= 5)) ||
          (link.target.seed && (stride === 1 || link.target.passage.rank <= 5));
        if (index++ % stride && !focus && !transfer && !hovered && !spotlight) continue;
        const a = projection(link.source);
        const b = projection(link.target);
        if ((a.x < -10 && b.x < -10) || (a.x > width + 10 && b.x > width + 10) ||
            (a.y < -10 && b.y < -10) || (a.y > height + 10 && b.y > height + 10)) continue;
        if (focus) { highlightedIds.add(link.source.id); highlightedIds.add(link.target.id); }
        const shown = linkTypes ? link.types.filter(type => linkTypes.has(type)) : link.types;
        for (const [index, type] of shown.entries()) {
          const mid = curve(a, b, index, shown.length);
          const chosen = focus?.has(type);
          const hot = chosen || Boolean(transfer) || (hovered && (!hover.edge || hover.type === type));
          const edge = { edge: link.edge, type, a, mid, b, hot, featured: spotlight || hot };
          const transition = link.exit ? clamp(1 - (now - link.exit) / 620, 0, 1)
            : link.enter ? clamp((now - link.enter) / 430, 0, 1) : 1;
          if (!link.exit) strokes.push(edge);
          if (hot || (spotlight && !selected) || transition < 1) {
            const alpha = hot ? .94 : spotlight && !selected ? .52 : selected || sky ? .055 : .22;
            front.push({ ...edge, alpha: alpha * transition, sparkle: chosen && !paused,
              flow: index === 0 ? transfer : null, forward: transfer?.from === link.source.id });
          } else drawCurve(pools.get(type), a, mid, b);
        }
      }
      for (const [type, path] of pools) {
        ctx.globalAlpha = selected || signal || sky ? .063 : count > 2500 ? .10 : .23;
        ctx.lineWidth = .83;
        ctx.strokeStyle = families[type].color;
        ctx.setLineDash(count > 2200 ? [] : families[type].dash);
        ctx.stroke(path);
      }
      front.sort((a, b) => a.alpha - b.alpha);
      for (const edge of front) {
        const { a, mid, b, type, hot, alpha, sparkle, flow, forward } = edge;
        ctx.strokeStyle = families[type].color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = hot ? 2 : 1.1;
        ctx.setLineDash(families[type].dash);
        ctx.beginPath();
        drawCurve(ctx, a, mid, b);
        ctx.stroke();
        if (sparkle) {
          const p = curvePoint(a, mid, b, (now * .00061 + phaseOf(edge.edge.a.id)) % 1);
          ctx.fillStyle = families[type].color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (flow && travel < 1 && !motion.matches) {
          const p = curvePoint(a, mid, b, forward ? travel : 1 - travel);
          ctx.fillStyle = gold;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.8 + Math.min(2, Math.sqrt(Math.abs(flow.amount))), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      paintNodes.focused = highlightedIds;
    }

    function paintNodes(now) {
      hits = [];
      const labels = [];
      const focused = paintNodes.focused;
      const compact = nodes.length > 650;
      const easing = signal && !motion.matches ? clamp((now - signal.start) / 420, 0, 1) : 1;
      for (const node of [...nodes, ...departing]) {
        const p = projection(node);
        const fade = node.exit ? clamp(1 - (now - node.exit) / 820, 0, 1) : clamp((now - node.enter) / 520, .07, 1);
        if (node.exit) {
          p.x += (p.x - width * .5) * (1 - fade) * .12;
          p.y += (p.y - height * .53) * (1 - fade) * .12;
        }
        if (p.x < -12 || p.x > width + 12 || p.y < -12 || p.y > height + 12) continue;
        const current = selected?.id === node.id || signal?.focus === node.id || hover?.id === node.id || pointer?.node?.id === node.id;
        const bright = current || focused.has(node.id);
        const value = mix(signal?.previous?.get(node.id) ?? 0, signal?.values?.get(node.id) ?? 0, easing);
        const intensity = Math.sqrt(Math.max(0, value));
        const r = ((current ? 5.8 : node.seed ? 4.9 : node.passage.supporting ? 4.3 : compact ? 1.65 : 2.35) + intensity * 3.6) * clamp(Math.sqrt(camera.scale), .72, 1.45);
        const color = node.seed || intensity > .6 ? gold : violet;
        ctx.globalAlpha = fade * (bright ? 1 : signal ? .24 + intensity * .75 : selected ? .27 : node.highlight ? .97 : sky ? .27 : .67);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (node.highlight || current || node.pinned || intensity > .3) {
          ctx.strokeStyle = color;
          ctx.globalAlpha *= current || node.pinned ? .88 : .48;
          ctx.lineWidth = current ? 1.5 : 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + (current ? 5 : 3), 0, Math.PI * 2);
          ctx.stroke();
        }
        if (!node.exit) {
          const hit = { ...p, id: node.id, radius: Math.max(6, r + 3), node };
          hits.push(hit);
          const namedNeighbour = selected && focused.size <= 9 && focused.has(node.id);
          if (current || namedNeighbour || intensity > .69 || (!selected && node.highlight && (node.passage.rank <= 4 || node.passage.supporting))) labels.push({ hit, current });
        }
      }
      labels.sort((a, b) => Number(b.current) - Number(a.current) || Number(b.hit.node.seed) - Number(a.hit.node.seed));
      const occupied = [];
      ctx.font = (width < 470 ? "600 11px" : "600 12px") + " Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      for (const { hit, current } of labels.slice(0, width < 470 ? 4 : 8)) {
        const title = hit.node.passage.title;
        const label = title.length > 31 ? title.slice(0, 29) + "…" : title;
        const w = ctx.measureText(label).width;
        const x = clamp(hit.x + 11, 8, Math.max(8, width - w - 8));
        const y = clamp(hit.y - 8, 18, height - 8);
        if (occupied.some(box => x < box.right && x + w > box.x && Math.abs(y - box.y) < 15)) continue;
        ctx.globalAlpha = current ? 1 : .89;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#170f21";
        ctx.strokeText(label, x, y);
        ctx.fillStyle = "#f5effb";
        ctx.fillText(label, x, y);
        hit.label = { x, y, right: x + w };
        occupied.push(hit.label);
      }
      ctx.globalAlpha = 1;
    }

    function distanceToLine(p, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = dx * dx + dy * dy;
      const t = length ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0;
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    }

    function targetAt(p) {
      let node;
      let best = Infinity;
      for (const hit of hits) {
        const label = hit.label;
        if (label && p.x >= label.x && p.x <= label.right && p.y >= label.y - 12 && p.y <= label.y + 3) return hit;
        const distance = Math.hypot(p.x - hit.x, p.y - hit.y);
        if (distance < hit.radius && distance < best) {
          best = distance;
          node = hit;
        }
      }
      if (node) return node;
      let edge, strong;
      best = 5;
      let strongDistance = 4.2;
      for (const stroke of strokes) {
        const { a, mid, b } = stroke;
        if (p.x < Math.min(a.x, mid.x, b.x) - 5 || p.x > Math.max(a.x, mid.x, b.x) + 5 ||
            p.y < Math.min(a.y, mid.y, b.y) - 5 || p.y > Math.max(a.y, mid.y, b.y) + 5) continue;
        const midpoint = curvePoint(a, mid, b, .5);
        const distance = Math.min(distanceToLine(p, a, midpoint), distanceToLine(p, midpoint, b));
        if (distance < best) { best = distance; edge = stroke; }
        if (stroke.featured && distance < strongDistance) { strongDistance = distance; strong = stroke; }
      }
      if (strong || edge) return strong ?? edge;
      const dot = sky?.dots.find(camera.x + (p.x - width * .5) / camera.scale,
        camera.y + (p.y - height * .53) / camera.scale, 4 / camera.scale);
      return dot && { id: dot.id, corpus: true };
    }

    function eventPoint(event) {
      const r = canvas.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    }

    function setZoom(factor, point = { x: width * .5, y: height * .53 }) {
      const next = clamp(camera.scale * factor, .19, 6);
      const dx = point.x - width * .5, dy = point.y - height * .53;
      forceFit = false;
      aim({ x: camera.x + dx / camera.scale - dx / next, y: camera.y + dy / camera.scale - dy / next, scale: next }, false);
    }

    canvas.addEventListener("wheel", event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(Math.exp(-event.deltaY * .0026), eventPoint(event));
    }, { passive: false });

    canvas.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      const at = eventPoint(event);
      const target = targetAt(at);
      const draggable = event.pointerType !== "touch" || panTouch;
      pointer = { id: event.pointerId, at, target, node: target?.node, draggable, moved: false, camera: { ...camera } };
      if (draggable) canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", event => {
      const at = eventPoint(event);
      if (pointer?.id !== event.pointerId) {
        hover = targetAt(at) ?? null;
        canvas.toggleAttribute("data-target", Boolean(hover));
        schedule();
        return;
      }
      const dx = at.x - pointer.at.x, dy = at.y - pointer.at.y;
      if (!pointer.moved && Math.hypot(dx, dy) < 4) return;
      pointer.moved = true;
      if (!pointer.draggable) return;
      forceFit = false;
      destination = null;
      canvas.setAttribute("data-dragging", "");
      if (pointer.node) {
        const node = pointer.node;
        node.x = node.fx = camera.x + (at.x - width * .5) / camera.scale;
        node.y = node.fy = camera.y + (at.y - height * .53) / camera.scale;
        simulation.alpha(Math.max(.62, simulation.alpha()));
      } else {
        camera.x = pointer.camera.x - dx / camera.scale;
        camera.y = pointer.camera.y - dy / camera.scale;
      }
      schedule();
    });

    function endPointer(event, click) {
      if (pointer?.id !== event.pointerId) return;
      const { target, moved, node } = pointer;
      pointer = null;
      canvas.removeAttribute("data-dragging");
      if (moved && node && !node.pinned) node.fx = node.fy = null;
      if (click && !moved) {
        if (target?.node || target?.corpus) handlers.node(target.id);
        else if (target?.edge) handlers.edge(target.edge, target.type);
        else handlers.clear();
      }
      schedule();
    }
    canvas.addEventListener("pointerup", event => endPointer(event, true));
    canvas.addEventListener("pointercancel", event => endPointer(event, false));
    canvas.addEventListener("pointerleave", () => { hover = null; canvas.removeAttribute("data-target"); schedule(); });

    const touchButton = document.getElementById("scene-pan");
    touchButton.addEventListener("click", () => {
      panTouch = !panTouch;
      field.dataset.pan = String(panTouch);
      touchButton.setAttribute("aria-pressed", String(panTouch));
    });
    document.getElementById("scene-plus").addEventListener("click", () => setZoom(1.24));
    document.getElementById("scene-minus").addEventListener("click", () => setZoom(1 / 1.24));
    document.getElementById("scene-reset").addEventListener("click", () => { forceFit = true; fit(); });
    field.addEventListener("keydown", event => {
      if (event.target !== field) return;
      const move = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[event.key];
      if (move) {
        forceFit = false;
        aim({ ...camera, x: camera.x + move[0] / camera.scale, y: camera.y + move[1] / camera.scale }, false);
      } else if (event.key === "+" || event.key === "=") setZoom(1.24);
      else if (event.key === "-") setZoom(1 / 1.24);
      else return;
      event.preventDefault();
    });

    new ResizeObserver(() => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      if (forceFit) fit(false);
      schedule();
    }).observe(canvas);

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    }, { rootMargin: "30px" }).observe(field);
    document.fonts.ready.then(schedule);

    return {
      show, setFocus, setSignal, setCorpus, setLinkTypes, locate, pin, isPinned, fit,
      pause: value => { paused = value; schedule(); },
    };
  }

  window.SECOND_HOP_SCENE = graphScene;
})();
