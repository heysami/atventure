// Canvas-based Item view and Agent view — ported from the prototype.
//
// Both views are <canvas>-driven force-directed renderings with pan/zoom,
// hover tooltips, agent indicators, and animated bezier particles. Items
// reflow into quadrants (Item view) or team rings (Agent view) whenever
// the underlying campaign data changes.

import React, { Fragment, useEffect, useRef, useState } from "react";

// ── Palette ───────────────────────────────────────────────────
export const NODE_PALETTE = {
  // direction / opportunity states
  lead:       "oklch(58% 0.16 252)",
  active:     "oklch(58% 0.16 252)",
  advanced:   "oklch(58% 0.14 145)",
  held:       "oklch(58% 0.04 250)",
  discounted: "oklch(64% 0.13 75)",
  cleared:    "oklch(58% 0.10 25)",
  queued:     "oklch(58% 0.04 250)",
  warn:       "oklch(64% 0.13 75)",
  // agent states
  thinking:   "oklch(58% 0.16 252)",
  reading:    "oklch(58% 0.16 252)",
  drafting:   "oklch(64% 0.14 60)",
  responding: "oklch(60% 0.14 30)",
  auditing:   "oklch(60% 0.14 95)",
  running:    "oklch(58% 0.13 180)",
  replan:     "oklch(60% 0.13 30)",
};
function nodeColor(state) { return NODE_PALETTE[state] || "oklch(58% 0.04 250)"; }

// ── Legend overlay ────────────────────────────────────────────
export function LegendPanel({ title, rows, foot }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={"live-canvas-legend " + (open ? "is-open" : "is-closed")}>
      <button className="legend-toggle" onClick={() => setOpen(o => !o)} title={open ? "Hide legend" : "Show legend"}>
        <span className="legend-title mono">{title}</span>
        <span className="legend-chevron">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <Fragment>
          {rows.map((r, i) => (
            <div key={i} className="legend-row">
              <span className={r.shape === "hex" ? "hex-marker" : "dot"} style={{ background: r.color }} />
              {r.label}
            </div>
          ))}
          {foot && <div className="legend-foot mono">{foot}</div>}
        </Fragment>
      )}
    </div>
  );
}

// ── Colour helpers ─────────────────────────────────────────────
function alphaHex(n) {
  const v = Math.max(0, Math.min(255, Math.round(n * 255)));
  return v.toString(16).padStart(2, "0");
}
function withAlpha(color, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith("oklch(") && color.endsWith(")")) {
    return color.slice(0, -1) + " / " + a.toFixed(3) + ")";
  }
  return color + alphaHex(a);
}

// ── Bezier helpers ─────────────────────────────────────────────
function bezierAt(t, p0, p1, p2, p3) {
  const m = 1 - t;
  return m*m*m*p0 + 3*m*m*t*p1 + 3*m*t*t*p2 + t*t*t*p3;
}
function computeBezierCp(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const curv = dist * 0.18;
  const px = -dy / dist * curv;
  const py = dx / dist * curv;
  return {
    cp1x: from.x + dx * 0.30 + px, cp1y: from.y + dy * 0.30 + py,
    cp2x: from.x + dx * 0.70 + px, cp2y: from.y + dy * 0.70 + py,
    dist,
  };
}

// ── Drawing primitives ────────────────────────────────────────
function drawNodeCircle(ctx, n, time, hovered) {
  const breathe = 1 + Math.sin(time * 1.6 + (n.phase || 0)) * 0.05;
  const r = n.r * breathe;
  const color = nodeColor(n.state);

  const glowR = r * 2.8;
  const grad = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, glowR);
  grad.addColorStop(0, withAlpha(color, 0.42));
  grad.addColorStop(0.55, withAlpha(color, 0.14));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2); ctx.fill();

  const diskGrad = ctx.createRadialGradient(n.x - r * 0.25, n.y - r * 0.25, r * 0.1, n.x, n.y, r);
  diskGrad.addColorStop(0, "oklch(99.4% 0.004 80)");
  diskGrad.addColorStop(0.65, "oklch(98.5% 0.006 80)");
  diskGrad.addColorStop(1, withAlpha(color, 0.22));
  ctx.fillStyle = diskGrad;
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = hovered ? 2.8 : 2.0;
  if (n.state === "cleared" || n.state === "queued") ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  if (["thinking", "auditing", "responding", "lead", "reading", "drafting"].includes(n.state)) {
    const count = n.state === "lead" ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const a = time * 1.4 + (i / count) * Math.PI * 2 + (n.phase || 0);
      ctx.fillStyle = withAlpha(color, 0.85);
      ctx.beginPath();
      ctx.arc(n.x + Math.cos(a) * (r + 7), n.y + Math.sin(a) * (r + 7), 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (["queued", "held"].includes(n.state)) {
    for (let i = 0; i < 2; i++) {
      const phase = ((time * 0.55 + i * 0.5) % 1.0);
      const rr = r + 3 + phase * 22;
      const al = (1 - phase) * 0.32;
      ctx.strokeStyle = withAlpha(color, al);
      ctx.lineWidth = 1.2 * (1 - phase);
      ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, Math.PI * 2); ctx.stroke();
    }
  }

  if (n.glyph) {
    ctx.fillStyle = withAlpha(color, 0.95);
    ctx.font = `600 ${Math.round(r * 0.85)}px var(--font-mono), monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.glyph, n.x, n.y + 1);
  }

  ctx.fillStyle = hovered ? "oklch(28% 0.02 250)" : "oklch(48% 0.01 250)";
  ctx.font = `${hovered ? 11 : 10}px var(--font-mono), monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(n.label || n.id, n.x, n.y + r + 6);
}

function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHexNode(ctx, n, time, hovered) {
  const flicker = 1 + Math.sin(time * 3.4 + (n.phase || 0)) * 0.07;
  const r = n.r * flicker;
  const color = nodeColor(n.state);

  const glowR = r * 2.3;
  const grad = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, glowR);
  grad.addColorStop(0, withAlpha(color, 0.45));
  grad.addColorStop(0.6, withAlpha(color, 0.12));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2); ctx.fill();

  hexPath(ctx, n.x, n.y, r);
  ctx.fillStyle = withAlpha(color, hovered ? 0.95 : 0.85);
  ctx.fill();

  hexPath(ctx, n.x, n.y, r * 0.78);
  ctx.fillStyle = withAlpha(color, 0.18);
  ctx.fill();

  hexPath(ctx, n.x, n.y, r);
  ctx.strokeStyle = withAlpha(color, 1);
  ctx.lineWidth = hovered ? 2.2 : 1.4;
  ctx.stroke();

  ctx.save();
  hexPath(ctx, n.x, n.y, r);
  ctx.clip();
  const scanY = n.y - r + ((time * 60 + (n.phase || 0) * 30) % (r * 2));
  const scanGrad = ctx.createLinearGradient(n.x, scanY - 3, n.x, scanY + 3);
  scanGrad.addColorStop(0, withAlpha("oklch(99% 0.005 80)", 0));
  scanGrad.addColorStop(0.5, withAlpha("oklch(99% 0.005 80)", 0.55));
  scanGrad.addColorStop(1, withAlpha("oklch(99% 0.005 80)", 0));
  ctx.fillStyle = scanGrad;
  ctx.fillRect(n.x - r, scanY - 4, r * 2, 8);
  ctx.restore();

  if (n.glyph) {
    ctx.fillStyle = "oklch(99% 0.005 80)";
    ctx.font = `700 ${Math.round(r * 0.85)}px var(--font-sans), system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.glyph, n.x, n.y + 1);
  }

  ctx.fillStyle = hovered ? "oklch(28% 0.02 250)" : "oklch(48% 0.01 250)";
  ctx.font = `${hovered ? 11 : 10}px var(--font-mono), monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(n.label || n.id, n.x, n.y + r + 8);
}

function drawAgentIndicator(ctx, item, agentState, slotIndex, totalSlots, time) {
  const color = nodeColor(agentState);
  const startA = -Math.PI / 3;
  const span = (2 * Math.PI) / 3;
  const a = startA + (totalSlots > 1 ? (slotIndex / (totalSlots - 1)) * span : span / 2);
  const orbitR = item.r + 14;
  const cx = item.x + Math.cos(a) * orbitR;
  const cy = item.y + Math.sin(a) * orbitR;
  const r = 6 + Math.sin(time * 4.2 + slotIndex) * 0.8;

  ctx.strokeStyle = withAlpha(color, 0.45);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(item.x + Math.cos(a) * item.r, item.y + Math.sin(a) * item.r);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  hexPath(ctx, cx, cy, r);
  ctx.fillStyle = withAlpha(color, 0.95);
  ctx.fill();
  hexPath(ctx, cx, cy, r);
  ctx.strokeStyle = withAlpha(color, 1);
  ctx.lineWidth = 1;
  ctx.stroke();

  const pulseR = r + 3 + Math.sin(time * 4.2 + slotIndex) * 1.5;
  ctx.strokeStyle = withAlpha(color, 0.35);
  ctx.lineWidth = 0.8;
  hexPath(ctx, cx, cy, pulseR);
  ctx.stroke();
}

function drawCurvedEdge(ctx, from, to, opts = {}) {
  const cp = computeBezierCp(from, to);
  const color = opts.color || "oklch(60% 0.04 250)";
  const alpha = opts.alpha == null ? 0.32 : opts.alpha;
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = opts.width || 1.1;
  if (opts.dashed) ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  return cp;
}

function drawParticleOnEdge(ctx, edge, particle, time) {
  if (!edge.cp) return;
  const t = particle.t;
  const trailSeg = 6;
  for (let i = trailSeg; i >= 0; i--) {
    const tt = Math.max(0, t - i * 0.038);
    const xx = bezierAt(tt, edge.from.x, edge.cp.cp1x, edge.cp.cp2x, edge.to.x);
    const yy = bezierAt(tt, edge.from.y, edge.cp.cp1y, edge.cp.cp2y, edge.to.y);
    const a = ((trailSeg - i) / trailSeg) * 0.55;
    ctx.fillStyle = withAlpha(particle.color, a);
    ctx.beginPath();
    ctx.arc(xx, yy, particle.size * ((trailSeg - i + 1) / (trailSeg + 1)), 0, Math.PI * 2);
    ctx.fill();
  }
  const x = bezierAt(t, edge.from.x, edge.cp.cp1x, edge.cp.cp2x, edge.to.x);
  const y = bezierAt(t, edge.from.y, edge.cp.cp1y, edge.cp.cp2y, edge.to.y);
  ctx.fillStyle = particle.color;
  ctx.beginPath(); ctx.arc(x, y, particle.size, 0, Math.PI * 2); ctx.fill();
}

// ── Physics ─────────────────────────────────────────────────────
function physicsStep(nodes, links, dt, w, h, anchorK = 0.018) {
  const damping = 0.86;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.static && b.static) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx*dx + dy*dy + 0.0001;
      const d = Math.sqrt(d2);
      const minDist = (a.r + b.r) * 1.55;
      if (d < minDist) {
        const f = (minDist - d) * 0.55;
        const ux = dx / d, uy = dy / d;
        if (!a.static) { a.vx -= ux * f * dt; a.vy -= uy * f * dt; }
        if (!b.static) { b.vx += ux * f * dt; b.vy += uy * f * dt; }
      }
    }
  }
  for (const n of nodes) {
    if (n.static) continue;
    if (n.anchorX === undefined) continue;
    n.vx += (n.anchorX - n.x) * anchorK;
    n.vy += (n.anchorY - n.y) * anchorK;
  }
  if (links) {
    for (const l of links) {
      const a = l.from, b = l.to;
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx*dx + dy*dy) || 1;
      const target = l.target || 200;
      const f = (d - target) * 0.0008;
      const ux = dx / d, uy = dy / d;
      if (!a.static) { a.vx += ux * f; a.vy += uy * f; }
      if (!b.static) { b.vx -= ux * f; b.vy -= uy * f; }
    }
  }
  for (const n of nodes) {
    if (n.static) continue;
    n.vx += (Math.random() - 0.5) * 0.45;
    n.vy += (Math.random() - 0.5) * 0.45;
    n.vx *= damping;
    n.vy *= damping;
    n.x += n.vx * dt * 60;
    n.y += n.vy * dt * 60;
    if (n.bounds) {
      const m = n.r + 6;
      if (n.x - m < n.bounds.left)  { n.x = n.bounds.left + m;  n.vx = Math.abs(n.vx) * 0.4; }
      if (n.x + m > n.bounds.right) { n.x = n.bounds.right - m; n.vx = -Math.abs(n.vx) * 0.4; }
      if (n.y - m < n.bounds.top)   { n.y = n.bounds.top + m;   n.vy = Math.abs(n.vy) * 0.4; }
      if (n.y + m > n.bounds.bottom){ n.y = n.bounds.bottom - m; n.vy = -Math.abs(n.vy) * 0.4; }
    }
  }
}

function hitNode(nodes, x, y) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const dx = n.x - x, dy = n.y - y;
    if (dx*dx + dy*dy <= (n.r + 4) * (n.r + 4)) return n;
  }
  return null;
}

// ── Camera ─────────────────────────────────────────────────────
function newCamera() {
  return { scale: 1, tx: 0, ty: 0, dragging: false, lastX: 0, lastY: 0, dragMoved: false };
}
function screenToWorld(cam, sx, sy) {
  return { x: (sx - cam.tx) / cam.scale, y: (sy - cam.ty) / cam.scale };
}
function installCameraControls(canvas, cam, onChange) {
  const onWheel = (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const before = screenToWorld(cam, sx, sy);
    const factor = Math.pow(1.0015, -e.deltaY);
    cam.scale = Math.max(0.3, Math.min(3.0, cam.scale * factor));
    cam.tx = sx - before.x * cam.scale;
    cam.ty = sy - before.y * cam.scale;
    onChange && onChange();
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    cam.dragging = true;
    cam.dragMoved = false;
    cam.lastX = e.clientX; cam.lastY = e.clientY;
    canvas.style.cursor = "grabbing";
  };
  const onMove = (e) => {
    if (!cam.dragging) return;
    const dx = e.clientX - cam.lastX;
    const dy = e.clientY - cam.lastY;
    cam.tx += dx; cam.ty += dy;
    cam.lastX = e.clientX; cam.lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) cam.dragMoved = true;
    onChange && onChange();
  };
  const onUp = () => {
    if (!cam.dragging) return;
    cam.dragging = false;
    canvas.style.cursor = "grab";
  };
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.style.cursor = "grab";
  return () => {
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("mousedown", onDown);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
}

// ── Item Canvas View ───────────────────────────────────────────
export function ItemCanvasView({ onOpen, data }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ nodes: [], links: [], particles: [], hover: null, sectors: null, initialized: false });
  const cameraRef = useRef(newCamera());
  const dataRef = useRef(data);
  const [tip, setTip] = useState(null);
  const [zoomReadout, setZoomReadout] = useState(1);

  // Re-init when the underlying data shape changes.
  useEffect(() => {
    dataRef.current = data;
    stateRef.current.initialized = false;
  }, [
    (data?.opp_clusters || []).length,
    (data?.directions || []).length,
    (data?.artifacts || []).length,
    (data?.cleared || []).length,
    (data?.agents || []).length
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let dim = { w: 800, h: 600 };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dim = { w: Math.max(400, r.width), h: Math.max(300, r.height) };
      canvas.width = dim.w * dpr; canvas.height = dim.h * dpr;
      const s = stateRef.current;
      if (s.initialized) reanchor(s, dim.w, dim.h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const teardownCam = installCameraControls(canvas, cameraRef.current, () => {
      setZoomReadout(cameraRef.current.scale);
    });

    function buildSectors(w, h) {
      const pad = 14, gap = 14;
      const halfW = (w - pad * 2 - gap) / 2;
      const halfH = (h - pad * 2 - gap) / 2;
      const make = (col, row, label, key) => {
        const x = pad + col * (halfW + gap);
        const y = pad + row * (halfH + gap);
        return {
          key, label,
          x, y, w: halfW, h: halfH,
          cx: x + halfW / 2, cy: y + halfH / 2,
          rect: { left: x, top: y, right: x + halfW, bottom: y + halfH },
        };
      };
      return {
        stage1:  make(0, 0, "STAGE 1 · OPPORTUNITY CLUSTERS", "stage1"),
        stage2:  make(1, 0, "STAGE 2 · PRODUCT DIRECTIONS",   "stage2"),
        cleared: make(0, 1, "CLEARED POSSIBILITIES",          "cleared"),
        stage3:  make(1, 1, "STAGE 3 · ARTIFACTS",            "stage3"),
      };
    }

    function reanchor(s, w, h) {
      const sectors = buildSectors(w, h);
      s.sectors = sectors;
      const buckets = { stage1: [], stage2: [], stage3: [], cleared: [] };
      for (const n of s.nodes) buckets[n.sector].push(n);
      for (const k of Object.keys(buckets)) {
        const arr = buckets[k];
        const sec = sectors[k];
        const ringR = Math.min(sec.w, sec.h) * 0.30;
        arr.forEach((n, i) => {
          const a = (i / Math.max(1, arr.length)) * Math.PI * 2;
          const jitter = 0.55 + Math.sin(i) * 0.35;
          n.anchorX = sec.cx + Math.cos(a) * ringR * jitter;
          n.anchorY = sec.cy + Math.sin(a) * ringR * jitter;
          n.bounds = sec.rect;
          if (n.static) { n.x = n.anchorX; n.y = n.anchorY; }
        });
      }
    }

    function init(w, h) {
      const D = dataRef.current || { opp_clusters: [], directions: [], artifacts: [], cleared: [], agents: [] };
      const sectors = buildSectors(w, h);
      const nodes = [];
      const place = (sec, i, total) => {
        const ringR = Math.min(sec.w, sec.h) * 0.30;
        const a = (i / Math.max(1, total)) * Math.PI * 2;
        const jitter = 0.55 + Math.sin(i) * 0.35;
        const ax = sec.cx + Math.cos(a) * ringR * jitter;
        const ay = sec.cy + Math.sin(a) * ringR * jitter;
        return {
          x: ax + (Math.random() - 0.5) * 20,
          y: ay + (Math.random() - 0.5) * 20,
          anchorX: ax, anchorY: ay, vx: 0, vy: 0,
          bounds: sec.rect,
        };
      };
      const oppList = D.opp_clusters || [];
      const dirList = D.directions || [];
      const artList = D.artifacts || [];
      const clearedList = D.cleared || [];

      const stage1Items = oppList.filter(o => o.state !== "cleared");
      const clearedItems = [
        ...oppList.filter(o => o.state === "cleared"),
        ...dirList.filter(d => d.state === "discounted"),
        ...clearedList.filter(c => c.id && c.id.startsWith("br_")),
      ];
      const stage2Items = dirList.filter(d => d.state !== "discounted");
      const stage3Items = artList;

      stage1Items.forEach((o, i) => {
        nodes.push({
          kind: "opportunity", sector: "stage1", id: o.id, label: o.id, data: o,
          state: o.state, glyph: "1",
          r: 22 + Math.min(14, (o.ev || 0) * 0.5),
          phase: i * 0.7,
          ...place(sectors.stage1, i, stage1Items.length),
        });
      });
      stage2Items.forEach((d, i) => {
        nodes.push({
          kind: "direction", sector: "stage2", id: d.id, label: d.id, data: d,
          state: d.state, glyph: "2",
          r: 26 + Math.min(14, (d.microtests || 0) * 1.1),
          phase: i * 0.7 + 1,
          ...place(sectors.stage2, i, stage2Items.length),
        });
      });
      stage3Items.forEach((a, i) => {
        nodes.push({
          kind: "artifact", sector: "stage3", id: a.id, label: a.id, data: a,
          state: a.state, glyph: "3",
          r: 22 + (a.state === "warn" ? 3 : 0),
          phase: i * 0.7 + 2,
          ...place(sectors.stage3, i, stage3Items.length),
        });
      });
      clearedItems.forEach((c, i) => {
        const isOpp = (c.id || "").startsWith("opp_");
        const isDir = (c.id || "").startsWith("pdc_");
        const placed = place(sectors.cleared, i, clearedItems.length);
        nodes.push({
          kind: isOpp ? "opportunity" : isDir ? "direction" : "cleared_branch",
          sector: "cleared", id: c.id, label: c.id, data: c,
          state: isDir ? c.state : "cleared",
          glyph: isOpp ? "1" : isDir ? "2" : "·",
          r: 17,
          phase: i * 0.7 + 3,
          static: true,
          ...placed,
          x: placed.anchorX, y: placed.anchorY,
        });
      });

      const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
      const links = [];
      const particles = [];
      const linkPair = (fromId, toId) => {
        const a = byId[fromId], b = byId[toId];
        if (!a || !b) return;
        const id = fromId + "->" + toId;
        const target = a.sector === b.sector ? 140 : 280;
        links.push({ id, from: a, to: b, target });
        const speed = b.state === "lead" ? 0.32 : 0.22;
        particles.push({ edgeId: id, t: Math.random(), speed, size: 1.7, color: nodeColor(b.state) });
      };
      oppList.forEach(o => (o.descendants || []).forEach(c => linkPair(o.id, c)));
      dirList.forEach(d => (d.descendants || []).forEach(c => linkPair(d.id, c)));

      const agentsByItem = {};
      for (const a of (D.agents || [])) {
        if (!a.item) continue;
        const key = a.item.includes("/") ? a.item.split("/").pop() : a.item;
        const matches = byId[a.item] ? a.item : (byId[key] ? key : null);
        if (!matches) continue;
        (agentsByItem[matches] ||= []).push({ id: a.id, state: a.state, role: a.role });
      }
      stateRef.current = { nodes, links, particles, hover: null, sectors, initialized: true, agentsByItem };
    }

    let raf, last = performance.now();
    const tick = (ts) => {
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      const { w, h } = dim;
      const s = stateRef.current;
      if (!s.initialized && w > 100) init(w, h);

      if (s.initialized) {
        physicsStep(s.nodes, s.links, dt, w, h, 0.024);
        for (const p of s.particles) { p.t += p.speed * dt; if (p.t > 1) p.t = 0; }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cam = cameraRef.current;
      ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * cam.tx, dpr * cam.ty);

      ctx.fillStyle = "oklch(98% 0.003 80)";
      ctx.fillRect(-w * 4, -h * 4, w * 9, h * 9);

      if (s.initialized) {
        const tints = {
          stage1:  { fill: "oklch(96% 0.024 145)", border: "oklch(72% 0.10 145)" },
          stage2:  { fill: "oklch(96% 0.024 252)", border: "oklch(70% 0.10 252)" },
          stage3:  { fill: "oklch(96% 0.026 60)",  border: "oklch(72% 0.11 60)"  },
          cleared: { fill: "oklch(96% 0.008 250)", border: "oklch(72% 0.02 250)" },
        };
        for (const k of Object.keys(s.sectors)) {
          const sec = s.sectors[k];
          ctx.fillStyle = tints[k].fill;
          ctx.beginPath(); ctx.roundRect(sec.x, sec.y, sec.w, sec.h, 14); ctx.fill();
          ctx.strokeStyle = withAlpha(tints[k].border, 0.65);
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 5]);
          ctx.beginPath(); ctx.roundRect(sec.x, sec.y, sec.w, sec.h, 14); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.font = `600 10px var(--font-mono), monospace`;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        for (const k of Object.keys(s.sectors)) {
          const sec = s.sectors[k];
          const count = s.nodes.filter(n => n.sector === k).length;
          const labelX = sec.x + 14, labelY = sec.y + 12;
          const chipText = String(count);
          const chipW = 18, chipH = 14;
          ctx.fillStyle = withAlpha(tints[k].border, 0.18);
          ctx.beginPath(); ctx.roundRect(labelX, labelY, chipW, chipH, 4); ctx.fill();
          ctx.fillStyle = tints[k].border;
          ctx.font = `600 9.5px var(--font-mono), monospace`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(chipText, labelX + chipW / 2, labelY + chipH / 2 + 0.5);
          ctx.fillStyle = withAlpha(tints[k].border, 0.95);
          ctx.font = `600 10px var(--font-mono), monospace`;
          ctx.textAlign = "left"; ctx.textBaseline = "top";
          ctx.fillText(sec.label, labelX + chipW + 8, labelY + 2);
        }
        for (const k of Object.keys(s.sectors)) {
          const sec = s.sectors[k];
          ctx.fillStyle = withAlpha(tints[k].border, 0.10);
          const step = 22;
          for (let yy = sec.y + 30; yy < sec.y + sec.h - 8; yy += step) {
            for (let xx = sec.x + 14; xx < sec.x + sec.w - 8; xx += step) {
              ctx.fillRect(xx, yy, 1, 1);
            }
          }
        }
        for (const l of s.links) {
          l.cp = drawCurvedEdge(ctx, l.from, l.to, {
            color: nodeColor(l.to.state), alpha: 0.30, width: 1,
          });
        }
        for (const p of s.particles) {
          const e = s.links.find(x => x.id === p.edgeId);
          if (!e) continue;
          drawParticleOnEdge(ctx, e, p, ts / 1000);
        }
        for (const n of s.nodes) drawNodeCircle(ctx, n, ts / 1000, n === s.hover);
        const agentsByItem = s.agentsByItem || {};
        for (const n of s.nodes) {
          const list = agentsByItem[n.id];
          if (!list || !list.length) continue;
          list.forEach((ag, i) => {
            drawAgentIndicator(ctx, n, ag.state, i, list.length, ts / 1000);
          });
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); teardownCam(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e) => {
      const cam = cameraRef.current;
      if (cam.dragging) { setTip(null); return; }
      const r = canvas.getBoundingClientRect();
      const w = screenToWorld(cam, e.clientX - r.left, e.clientY - r.top);
      const s = stateRef.current;
      const n = hitNode(s.nodes, w.x, w.y);
      s.hover = n;
      canvas.style.cursor = n ? "pointer" : "grab";
      setTip(n ? { id: n.id, name: n.data?.name || n.label, state: n.state, kind: n.kind, x: e.clientX, y: e.clientY } : null);
    };
    const onLeave = () => { stateRef.current.hover = null; canvas.style.cursor = "grab"; setTip(null); };
    const onClick = (e) => {
      const cam = cameraRef.current;
      if (cam.dragMoved) { cam.dragMoved = false; return; }
      const r = canvas.getBoundingClientRect();
      const w = screenToWorld(cam, e.clientX - r.left, e.clientY - r.top);
      const s = stateRef.current;
      const n = hitNode(s.nodes, w.x, w.y);
      if (n && n.data && onOpen) onOpen(n.data, n.kind === "cleared_branch" ? "cleared_branch" : n.kind);
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [onOpen]);

  const zoomBy = (factor) => {
    const cam = cameraRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const sx = r.width / 2, sy = r.height / 2;
    const before = screenToWorld(cam, sx, sy);
    cam.scale = Math.max(0.3, Math.min(3.0, cam.scale * factor));
    cam.tx = sx - before.x * cam.scale;
    cam.ty = sy - before.y * cam.scale;
    setZoomReadout(cam.scale);
  };
  const resetCamera = () => {
    const cam = cameraRef.current;
    cam.scale = 1; cam.tx = 0; cam.ty = 0;
    setZoomReadout(1);
  };

  return (
    <div className="live-canvas-frame">
      <canvas ref={canvasRef} className="live-canvas" />
      <LegendPanel
        title="Live · physics-clustered by stage"
        rows={[
          { color: NODE_PALETTE.lead,       label: "lead" },
          { color: NODE_PALETTE.advanced,   label: "advanced" },
          { color: NODE_PALETTE.held,       label: "held" },
          { color: NODE_PALETTE.discounted, label: "discounted (frozen)" },
          { color: NODE_PALETTE.cleared,    label: "cleared (frozen)" },
        ]}
        foot="drag to pan · scroll to zoom"
      />
      <div className="live-canvas-controls mono">
        <button onClick={() => zoomBy(0.85)} title="Zoom out">−</button>
        <span className="zoom-readout">{Math.round(zoomReadout * 100)}%</span>
        <button onClick={() => zoomBy(1.18)} title="Zoom in">+</button>
        <button onClick={resetCamera} title="Reset view">⟲</button>
      </div>
      {tip && (
        <div className="live-canvas-tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <div className="t-id mono">{tip.id} · {tip.kind}</div>
          <div className="t-name">{tip.name}</div>
          <div className="t-state mono">{tip.state}</div>
        </div>
      )}
    </div>
  );
}

// ── Agent Canvas View ──────────────────────────────────────────
export function AgentCanvasView({ onOpen, data }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ nodes: [], links: [], particles: [], hover: null, initialized: false });
  const cameraRef = useRef(newCamera());
  const dataRef = useRef(data);
  const [tip, setTip] = useState(null);
  const [zoomReadout, setZoomReadout] = useState(1);

  useEffect(() => {
    dataRef.current = data;
    stateRef.current.initialized = false;
  }, [
    (data?.agents || []).length,
    (data?.opp_clusters || []).length,
    (data?.directions || []).length,
    (data?.artifacts || []).length
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let dim = { w: 800, h: 600 };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dim = { w: Math.max(400, r.width), h: Math.max(300, r.height) };
      canvas.width = dim.w * dpr; canvas.height = dim.h * dpr;
      const s = stateRef.current;
      if (s.initialized) reanchor(s, dim.w, dim.h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const teardownCam = installCameraControls(canvas, cameraRef.current, () => {
      setZoomReadout(cameraRef.current.scale);
    });

    const teamCenters = (w, h) => ({
      Builder:   { cx: w * 0.18, cy: h * 0.50, color: "oklch(58% 0.16 252)", letter: "B", label: "BUILDER" },
      Tester:    { cx: w * 0.18, cy: h * 0.18, color: "oklch(60% 0.13 200)", letter: "T", label: "TESTER · BLINDED" },
      Evaluator: { cx: w * 0.18, cy: h * 0.82, color: "oklch(60% 0.14 95)",  letter: "E", label: "EVALUATOR" },
    });
    const itemCenter = (w, h) => ({ cx: w * 0.78, cy: h * 0.50 });

    function reanchor(s, w, h) {
      const tc = teamCenters(w, h);
      const ic = itemCenter(w, h);
      s.teamCenters = tc;
      s.itemCenter = ic;
      const teams = { Builder: [], Tester: [], Evaluator: [] };
      for (const n of s.nodes) if (n.kind === "agent") teams[n.team]?.push(n);
      for (const t of Object.keys(teams)) {
        teams[t].forEach((n, i) => {
          const a = (i / Math.max(1, teams[t].length)) * Math.PI * 2;
          const ringR = 70;
          n.anchorX = tc[t].cx + Math.cos(a) * ringR;
          n.anchorY = tc[t].cy + Math.sin(a) * ringR;
        });
      }
      const items = s.nodes.filter(n => n.kind === "item");
      items.forEach((n, i) => {
        const stepY = Math.max(60, (h - 120) / Math.max(1, items.length));
        n.anchorX = ic.cx;
        n.anchorY = 60 + i * stepY;
      });
    }

    function init(w, h) {
      const D = dataRef.current || { agents: [], opp_clusters: [], directions: [], artifacts: [] };
      const tc = teamCenters(w, h);
      const ic = itemCenter(w, h);
      const nodes = [];
      const teams = { Builder: [], Tester: [], Evaluator: [] };
      (D.agents || []).forEach((a) => { if (teams[a.team]) teams[a.team].push(a); });

      for (const t of Object.keys(teams)) {
        teams[t].forEach((a, i) => {
          const ang = (i / Math.max(1, teams[t].length)) * Math.PI * 2;
          const ringR = 70;
          nodes.push({
            kind: "agent", id: a.id, label: a.id + " · " + (a.role || "").split(" ")[0].toLowerCase(),
            data: a, state: a.state, team: a.team, glyph: tc[t].letter,
            r: 18, phase: i * 0.6,
            x: tc[t].cx + Math.cos(ang) * ringR,
            y: tc[t].cy + Math.sin(ang) * ringR,
            anchorX: tc[t].cx + Math.cos(ang) * ringR,
            anchorY: tc[t].cy + Math.sin(ang) * ringR,
            vx: 0, vy: 0,
            item: a.item,
          });
        });
      }

      const itemMetaById = {};
      for (const o of (D.opp_clusters || [])) itemMetaById[o.id] = { state: o.state, name: o.name };
      for (const d of (D.directions || []))   itemMetaById[d.id] = { state: d.state, name: d.name };
      for (const a of (D.artifacts || []))    itemMetaById[a.id] = { state: a.state, name: a.name };

      const itemIds = Array.from(new Set((D.agents || []).map(a => a.item).filter(Boolean)));
      itemIds.forEach((id, i) => {
        const meta = itemMetaById[id] || itemMetaById[(id || "").split("/").pop()] || { state: "running", name: id };
        const stepY = Math.max(110, (h - 180) / Math.max(1, itemIds.length));
        nodes.push({
          kind: "item", id, label: id, data: { id, name: meta.name }, state: meta.state,
          glyph: id.startsWith("art") ? "3" : id.startsWith("stage") ? "·" : id.startsWith("opp") ? "1" : "2",
          r: 36, phase: i * 0.8 + 5,
          x: ic.cx, y: 100 + i * stepY,
          anchorX: ic.cx, anchorY: 100 + i * stepY,
          vx: 0, vy: 0,
        });
      });

      const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
      const links = [];
      const particles = [];
      (D.agents || []).forEach((a) => {
        const fromN = byId[a.id];
        const toN = byId[a.item];
        if (!fromN || !toN) return;
        const id = a.id + "->" + a.item;
        links.push({ id, from: fromN, to: toN, target: 320 });
        const fast = ["thinking", "responding", "auditing", "reading", "drafting"].includes(a.state);
        const count = fast ? 2 : 1;
        for (let k = 0; k < count; k++) {
          particles.push({
            edgeId: id, t: Math.random(),
            speed: fast ? 0.30 + Math.random() * 0.10 : 0.18,
            size: 1.7,
            color: nodeColor(a.state),
          });
        }
      });

      stateRef.current = { nodes, links, particles, hover: null, teamCenters: tc, itemCenter: ic, initialized: true };
    }

    let raf, last = performance.now();
    const tick = (ts) => {
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      const { w, h } = dim;
      const s = stateRef.current;
      if (!s.initialized && w > 100) init(w, h);

      if (s.initialized) {
        physicsStep(s.nodes, s.links, dt, w, h, 0.030);
        for (const p of s.particles) { p.t += p.speed * dt; if (p.t > 1) p.t = 0; }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cam = cameraRef.current;
      ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * cam.tx, dpr * cam.ty);

      ctx.fillStyle = "oklch(98% 0.003 80)";
      ctx.fillRect(-w * 4, -h * 4, w * 9, h * 9);

      if (s.initialized) {
        for (const t of Object.keys(s.teamCenters)) {
          const tc = s.teamCenters[t];
          const grd = ctx.createRadialGradient(tc.cx, tc.cy, 30, tc.cx, tc.cy, 260);
          grd.addColorStop(0, tc.color.replace("58%", "94%").replace("60%", "94%").replace("0.16", "0.025").replace("0.13", "0.025").replace("0.14", "0.025"));
          grd.addColorStop(1, "oklch(98% 0.003 80 / 0)");
          ctx.fillStyle = grd;
          ctx.fillRect(-w * 4, -h * 4, w * 9, h * 9);
        }
        const ic = s.itemCenter;
        const igrd = ctx.createRadialGradient(ic.cx, ic.cy, 40, ic.cx, ic.cy, 380);
        igrd.addColorStop(0, "oklch(96% 0.018 252)");
        igrd.addColorStop(1, "oklch(98% 0.003 80 / 0)");
        ctx.fillStyle = igrd;
        ctx.fillRect(-w * 4, -h * 4, w * 9, h * 9);

        ctx.fillStyle = "oklch(88% 0.005 95)";
        const step = 24;
        for (let yy = step / 2; yy < h; yy += step) {
          for (let xx = step / 2; xx < w; xx += step) ctx.fillRect(xx, yy, 1, 1);
        }

        ctx.font = `600 10px var(--font-mono), monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const t of Object.keys(s.teamCenters)) {
          const tc = s.teamCenters[t];
          ctx.fillStyle = tc.color;
          ctx.fillText(tc.label, tc.cx, tc.cy - 110);
        }
        ctx.fillStyle = "oklch(48% 0.02 250)";
        ctx.fillText("ITEMS BEING TOUCHED", ic.cx, 26);

        for (const l of s.links) {
          l.cp = drawCurvedEdge(ctx, l.from, l.to, {
            color: nodeColor(l.from.state), alpha: 0.32, width: 1,
          });
        }
        for (const p of s.particles) {
          const e = s.links.find(x => x.id === p.edgeId);
          if (!e) continue;
          drawParticleOnEdge(ctx, e, p, ts / 1000);
        }
        for (const n of s.nodes) if (n.kind === "item") drawNodeCircle(ctx, n, ts / 1000, n === s.hover);
        for (const n of s.nodes) if (n.kind === "agent") drawHexNode(ctx, n, ts / 1000, n === s.hover);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); teardownCam(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e) => {
      const cam = cameraRef.current;
      if (cam.dragging) { setTip(null); return; }
      const r = canvas.getBoundingClientRect();
      const w = screenToWorld(cam, e.clientX - r.left, e.clientY - r.top);
      const s = stateRef.current;
      const n = hitNode(s.nodes, w.x, w.y);
      s.hover = n;
      canvas.style.cursor = n ? "pointer" : "grab";
      setTip(n ? {
        id: n.id, name: n.data?.name || n.data?.role || n.label,
        state: n.state, kind: n.kind,
        sub: n.kind === "agent" ? n.data?.task : null,
        item: n.kind === "agent" ? n.data?.item : null,
        x: e.clientX, y: e.clientY,
      } : null);
    };
    const onLeave = () => { stateRef.current.hover = null; canvas.style.cursor = "grab"; setTip(null); };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const zoomBy = (factor) => {
    const cam = cameraRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const sx = r.width / 2, sy = r.height / 2;
    const before = screenToWorld(cam, sx, sy);
    cam.scale = Math.max(0.3, Math.min(3.0, cam.scale * factor));
    cam.tx = sx - before.x * cam.scale;
    cam.ty = sy - before.y * cam.scale;
    setZoomReadout(cam.scale);
  };
  const resetCamera = () => {
    const cam = cameraRef.current;
    cam.scale = 1; cam.tx = 0; cam.ty = 0;
    setZoomReadout(1);
  };

  const agentCount = (data?.agents || []).length;
  const runCount = (data?.runs || []).length;

  return (
    <div className="live-canvas-frame">
      <canvas ref={canvasRef} className="live-canvas" />
      <LegendPanel
        title={`Live · ${agentCount} agent${agentCount === 1 ? "" : "s"} · ${runCount} run${runCount === 1 ? "" : "s"}`}
        rows={[
          { shape: "hex", color: NODE_PALETTE.thinking, label: "agents · hex · faster pulse" },
          { color: NODE_PALETTE.lead, label: "items · circle · slow breathe" },
          { color: NODE_PALETTE.thinking,   label: "thinking / reading" },
          { color: NODE_PALETTE.drafting,   label: "drafting" },
          { color: NODE_PALETTE.responding, label: "responding" },
          { color: NODE_PALETTE.auditing,   label: "auditing" },
          { color: NODE_PALETTE.queued,     label: "queued" },
        ]}
        foot="drag to pan · scroll to zoom"
      />
      <div className="live-canvas-controls mono">
        <button onClick={() => zoomBy(0.85)} title="Zoom out">−</button>
        <span className="zoom-readout">{Math.round(zoomReadout * 100)}%</span>
        <button onClick={() => zoomBy(1.18)} title="Zoom in">+</button>
        <button onClick={resetCamera} title="Reset view">⟲</button>
      </div>
      {tip && (
        <div className="live-canvas-tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <div className="t-id mono">{tip.id} · {tip.kind}</div>
          <div className="t-name">{tip.name}</div>
          {tip.sub && <div className="t-sub">{tip.sub}</div>}
          {tip.item && <div className="t-state mono">↳ {tip.item}</div>}
          <div className="t-state mono">{tip.state}</div>
        </div>
      )}
    </div>
  );
}
