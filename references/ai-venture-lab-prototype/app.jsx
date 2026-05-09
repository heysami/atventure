// GENRE: Linear-style observability cockpit + NYT/long-form editorial register for wow moments.
// Reference: feels like Datadog/Linear's project view × NYT magazine for the gate-decision and dossier surfaces.
// The register shift between cockpit and editorial layer is itself a wow primitive (Law 6).

const { useState, useMemo, useEffect, useRef, Fragment } = React;
const D = window.DEMO;

// ── Inline icons. One stroke weight (1.5), round endcaps, 14×14 default. ──
const Icon = {
  flask: (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M9 4h6"/><path d="M10 4v5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V4"/><path d="M7.5 14h9"/></svg>),
  pause: (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>),
  play:  (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M7 5l12 7-12 7V5z"/></svg>),
  mic:   (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>),
  book:  (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M19 16H6"/></svg>),
  scale: (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M12 4v16"/><path d="M5 8l-2 6a3 3 0 0 0 6 0L7 8z"/><path d="M19 8l-2 6a3 3 0 0 0 6 0l-2-6z"/><path d="M5 8h14"/></svg>),
  close: (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>),
  back:  (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>),
  forward:(p)=> (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>),
  zoomIn:(p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M11 8v6M8 11h6M20 20l-4.5-4.5"/></svg>),
  zoomOut:(p)=> (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M8 11h6M20 20l-4.5-4.5"/></svg>),
  search:(p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>),
  spark: (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l3 3M14.5 14.5l3 3M6.5 17.5l3-3M14.5 9.5l3-3"/></svg>),
  bolt:  (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>),
  arrowR:(p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
  ext:   (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M14 12v6H6V8h6"/></svg>),
  dot:   (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/></svg>),
  brand: (p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24" stroke="white" fill="none" strokeWidth="2"><path d="M5 4l7 16 7-16"/><path d="M9 13h6"/></svg>),
  corner:(p) => (<svg className={`icon ${p.cls||''}`} viewBox="0 0 24 24"><path d="M6 4h12M6 4l-2 2v14l2 2"/></svg>),
};

const fmt = {
  pct: (n) => `${Math.round(n*100)}%`,
  money: (n) => `$${n.toFixed(2)}`,
  band: (lo, hi) => `${Math.round(lo*100)}–${Math.round(hi*100)}%`,
};

// ── Persona avatars — eight variations of the same archetype.
// Same pose, same warm palette; small differences in hair / accessory
// to express cousin variance. The "walked" cousin (#8) is shown in
// three-quarter profile, gaze slightly off, to read as turning away.
const skin = "oklch(82% 0.05 50)";
const skinShade = "oklch(74% 0.06 45)";
const hairs = ["oklch(28% 0.04 35)", "oklch(34% 0.06 30)", "oklch(42% 0.08 60)", "oklch(22% 0.02 280)"];
function AvatarBase({ children, bg = "oklch(96% 0.018 60)" }) {
  return (
    <svg className="avatar" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="27" fill={bg} stroke="oklch(89% 0.005 80)" strokeWidth="1" />
      {children}
    </svg>
  );
}
const Avatar = {
  // 1 — long hair, parted center
  one: () => (
    <AvatarBase>
      <path d="M 12 30 Q 12 14 28 14 Q 44 14 44 30 L 44 44 L 12 44 Z" fill={hairs[0]} />
      <ellipse cx="28" cy="30" rx="9" ry="11" fill={skin} />
      <path d="M 19 27 Q 19 18 28 18 Q 37 18 37 27 L 37 22 Q 32 19 28 19 Q 24 19 19 22 Z" fill={hairs[0]} />
      <circle cx="25" cy="29" r="0.9" fill="#1a1a1a" />
      <circle cx="31" cy="29" r="0.9" fill="#1a1a1a" />
      <path d="M 26 34 Q 28 35 30 34" stroke="oklch(58% 0.10 35)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </AvatarBase>
  ),
  // 2 — short hair, round glasses
  two: () => (
    <AvatarBase bg="oklch(95% 0.022 70)">
      <ellipse cx="28" cy="30" rx="9" ry="11" fill={skin} />
      <path d="M 18 24 Q 18 14 28 14 Q 38 14 38 24 Q 36 19 28 19 Q 20 19 18 24 Z" fill={hairs[1]} />
      <circle cx="24.5" cy="29" r="2.4" fill="none" stroke="oklch(28% 0.02 240)" strokeWidth="1" />
      <circle cx="31.5" cy="29" r="2.4" fill="none" stroke="oklch(28% 0.02 240)" strokeWidth="1" />
      <line x1="27" y1="29" x2="29" y2="29" stroke="oklch(28% 0.02 240)" strokeWidth="1" />
      <path d="M 25 35 Q 28 36 31 35" stroke="oklch(58% 0.10 35)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </AvatarBase>
  ),
  // 3 — top bun
  three: () => (
    <AvatarBase bg="oklch(97% 0.014 50)">
      <circle cx="28" cy="11" r="4.5" fill={hairs[0]} />
      <ellipse cx="28" cy="30" rx="9" ry="11" fill={skin} />
      <path d="M 19 25 Q 19 16 28 16 Q 37 16 37 25 L 37 21 Q 32 18 28 18 Q 24 18 19 21 Z" fill={hairs[0]} />
      <circle cx="25" cy="29" r="0.9" fill="#1a1a1a" />
      <circle cx="31" cy="29" r="0.9" fill="#1a1a1a" />
      <ellipse cx="22" cy="31" rx="1.4" ry="0.7" fill="oklch(85% 0.08 30)" opacity="0.6" />
      <ellipse cx="34" cy="31" rx="1.4" ry="0.7" fill="oklch(85% 0.08 30)" opacity="0.6" />
      <path d="M 26 34 L 30 34" stroke="oklch(50% 0.10 35)" strokeWidth="0.8" strokeLinecap="round" />
    </AvatarBase>
  ),
  // 4 — bangs / fringe, longer hair
  four: () => (
    <AvatarBase bg="oklch(96% 0.020 55)">
      <path d="M 11 30 Q 11 13 28 13 Q 45 13 45 30 L 45 46 L 11 46 Z" fill={hairs[2]} />
      <ellipse cx="28" cy="31" rx="9" ry="11" fill={skin} />
      <path d="M 19 24 Q 23 19 28 19 Q 33 19 37 24 L 37 28 Q 33 24 28 24 Q 23 24 19 28 Z" fill={hairs[2]} />
      <circle cx="25" cy="30" r="0.9" fill="#1a1a1a" />
      <circle cx="31" cy="30" r="0.9" fill="#1a1a1a" />
      <path d="M 25 35 Q 28 37 31 35" stroke="oklch(54% 0.10 30)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </AvatarBase>
  ),
  // 5 — beanie / soft cap
  five: () => (
    <AvatarBase bg="oklch(96% 0.014 80)">
      <ellipse cx="28" cy="31" rx="9" ry="11" fill={skin} />
      <path d="M 18 24 Q 18 13 28 13 Q 38 13 38 24 L 38 22 L 18 22 Z" fill="oklch(48% 0.12 250)" />
      <rect x="18" y="22" width="20" height="3" fill="oklch(38% 0.10 250)" />
      <circle cx="28" cy="13" r="1.6" fill="oklch(38% 0.10 250)" />
      <circle cx="25" cy="30" r="0.9" fill="#1a1a1a" />
      <circle cx="31" cy="30" r="0.9" fill="#1a1a1a" />
      <path d="M 25 35 Q 28 36 31 35" stroke="oklch(56% 0.10 35)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </AvatarBase>
  ),
  // 6 — side-swept fringe + earrings
  six: () => (
    <AvatarBase bg="oklch(96% 0.020 65)">
      <path d="M 12 32 Q 12 14 28 14 Q 44 14 44 32 L 44 42 L 12 42 Z" fill={hairs[1]} />
      <ellipse cx="28" cy="31" rx="9" ry="11" fill={skin} />
      <path d="M 19 25 Q 22 18 30 18 Q 38 18 38 26 L 38 23 Q 33 20 28 22 Q 23 24 19 28 Z" fill={hairs[1]} />
      <circle cx="19" cy="34" r="1.1" fill="oklch(78% 0.13 80)" />
      <circle cx="37" cy="34" r="1.1" fill="oklch(78% 0.13 80)" />
      <circle cx="25" cy="30" r="0.9" fill="#1a1a1a" />
      <circle cx="31" cy="30" r="0.9" fill="#1a1a1a" />
      <path d="M 25 35 Q 28 36 31 35" stroke="oklch(54% 0.10 30)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </AvatarBase>
  ),
  // 7 — ponytail + headphones
  seven: () => (
    <AvatarBase bg="oklch(97% 0.012 45)">
      <ellipse cx="28" cy="30" rx="9" ry="11" fill={skin} />
      <path d="M 18 24 Q 18 14 28 14 Q 38 14 38 24 Q 36 18 28 18 Q 20 18 18 24 Z" fill={hairs[3]} />
      <path d="M 38 24 Q 44 28 42 38 Q 41 34 38 32 Z" fill={hairs[3]} />
      <path d="M 16 23 Q 16 18 22 17" stroke="oklch(40% 0.05 250)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M 40 23 Q 40 18 34 17" stroke="oklch(40% 0.05 250)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="14.5" y="22" width="3" height="6" rx="1" fill="oklch(28% 0.02 250)" />
      <rect x="38.5" y="22" width="3" height="6" rx="1" fill="oklch(28% 0.02 250)" />
      <circle cx="25" cy="29" r="0.9" fill="#1a1a1a" />
      <circle cx="31" cy="29" r="0.9" fill="#1a1a1a" />
      <path d="M 25 34 Q 28 35 31 34" stroke="oklch(56% 0.10 35)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </AvatarBase>
  ),
  // 8 — three-quarter profile, turning away (the walked cousin)
  eight: () => (
    <AvatarBase bg="oklch(96% 0.018 25)">
      <path d="M 14 32 Q 14 14 28 14 Q 42 14 42 32 L 42 44 L 14 44 Z" fill={hairs[0]} />
      <path d="M 19 30 Q 21 22 28 21 Q 34 21 36 30 Q 36 38 31 41 Q 26 41 22 38 Q 19 35 19 30 Z" fill={skinShade} />
      <path d="M 19 28 Q 22 20 30 19 Q 36 20 36 28 L 36 24 Q 32 22 28 22 Q 23 22 19 25 Z" fill={hairs[0]} />
      <circle cx="33" cy="30" r="0.85" fill="#1a1a1a" />
      <path d="M 32 35 Q 33 36 35 35" stroke="oklch(50% 0.10 30)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      {/* hint of motion / leaving */}
      <path d="M 8 30 L 13 30 M 9 33 L 14 33 M 10 27 L 14 27" stroke="oklch(82% 0.04 30)" strokeWidth="1" strokeLinecap="round" />
    </AvatarBase>
  ),
};

// ── Top bar ──────────────────────────────────────────────────
function TopBar({ status, onCos, cosOn, onWym, missedCount }) {
  const costPct = (status.cost_spent / status.cost_cap) * 100;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Icon.brand /></span>
        <span className="brand-name">Venture Lab</span>
        <span className="local-pill" title="Local-first. Sources never leave the device.">
          <span className="dot"></span>local · v0.4.2
        </span>
      </div>
      <div className="campaign-pill" title={D.campaign.name}>
        <span className="swatch" />
        <span className="name">{D.campaign.name}</span>
      </div>
      <div className="flight-status">
        <span className="seg">
          <span className="dot live" />
          <span className="tnum">{status.in_flight_runs} runs</span>
        </span>
        <span className="seg-divider" />
        <span className="seg" title="Cost cap visible. Founder always sees what's leaving the device.">
          <span className="tnum">{fmt.money(status.cost_spent)} / {fmt.money(status.cost_cap)}</span>
          <span className="cost-bar"><span style={{width: `${costPct}%`}}/></span>
        </span>
        <span className="seg-divider" />
        <span className="seg" title="ETA — updates on real progress, not animation.">
          <span className="tnum">{status.elapsed_min.toFixed(1)} / {status.cap_min}m</span>
        </span>
      </div>
      <div className="tb-actions">
        <button className="tb-btn" onClick={onWym} title="What you missed — returns-only, signal-ranked replay.">
          <Icon.spark cls="icon-sm" />
          <span>Missed</span>
          {missedCount > 0 && <span className="badge">{missedCount}</span>}
        </button>
        <button className="tb-btn" title="Open scorecard / weight what-if.">
          <Icon.scale cls="icon-sm" />
          <span>Scorecard</span>
        </button>
        <button className="tb-btn" title="Guide / walkthrough.">
          <Icon.book cls="icon-sm" />
        </button>
        <button className="tb-btn" title="Soft pause.">
          <Icon.pause cls="icon-sm" />
          <span>Pause</span>
        </button>
        <button className={"tb-btn " + (cosOn ? "is-on" : "")} onClick={onCos} title="Chief of Staff — voice or text. Translates between your vocabulary and the harness's.">
          <Icon.mic cls="icon-sm" />
          <span>Chief of Staff</span>
        </button>
      </div>
    </header>
  );
}

// ── Stage pipeline ───────────────────────────────────────────
// Each stage runs in parallel — none is "done" or "locked". The chip shows the
// real population at that stage right now: how many are alive (held + advanced),
// how many graduated forward, how many were cleared. The CTA on the right is
// pinned to the specific item that's at a gate — not a stage-wide promotion.
function StagePipeline({ focusStage, setFocusStage, onOpenGate }) {
  const opps = D.opp_clusters;
  const dirs = D.directions;
  const arts = D.artifacts;

  const oppHeld     = opps.filter(o => o.state === "held").length;
  const oppAdvanced = opps.filter(o => o.state === "advanced").length;
  const oppCleared  = opps.filter(o => o.state === "cleared").length;

  const dirLead       = dirs.filter(d => d.state === "lead").length;
  const dirAdvanced   = dirs.filter(d => d.state === "advanced").length;
  const dirDiscounted = dirs.filter(d => d.state === "discounted").length;

  const artQueued = arts.filter(a => a.state === "queued").length;
  const artWarn   = arts.filter(a => a.state === "warn").length;

  const stageBlocks = [
    {
      id: 1, name: "Real-data collector",
      population: `${opps.length - oppCleared} alive · ${oppAdvanced} advanced · ${oppCleared} cleared`,
      meta: "142 evidence · 12 tensions · 7 clusters",
    },
    {
      id: 2, name: "Brainstorm + microtests",
      population: `${dirLead + dirAdvanced} alive · ${dirAdvanced} advanced · ${dirDiscounted} discounted`,
      meta: `${dirs.length} directions · 11 microtests · 9/12 held`,
    },
    {
      id: 3, name: "Simulated pilot",
      population: `${artQueued + artWarn} planned · ${artWarn} warn · 0 ran`,
      meta: `${arts.length} artifacts · awaiting gate · 1 ready`,
    },
  ];

  return (
    <div className="pipeline">
      <div className="stage-chips">
        {stageBlocks.map(s => (
          <button
            key={s.id}
            onClick={() => setFocusStage(s.id)}
            className={"stage-chip is-running " + (focusStage === s.id ? "is-focused " : "")}
            title={s.name}
          >
            <span className="num">{s.id}</span>
            <span className="label-row">
              <span className="label-top">
                <span className="label">{s.name}</span>
                <span className="live-dot" aria-hidden="true" />
              </span>
              <span className="population">{s.population}</span>
              <span className="metrics">{s.meta}</span>
            </span>
          </button>
        ))}
      </div>
      <button className="gate-cta" onClick={onOpenGate} title="pdc_004 has held 9 of 12 challenges. Promote it to Stage 3.">
        <span className="gate-cta-id mono">pdc_004</span>
        <span className="gate-cta-text">promote to Stage 3</span>
        <Icon.arrowR cls="icon-sm" />
      </button>
    </div>
  );
}

// ── Left sidebar — three focuses ──────────────────────────
function Sidebar({ focus, setFocus }) {
  const items = [
    { id: "items", label: "Items", sub: "stages 1 → 3", count: D.opp_clusters.length + D.directions.length + D.artifacts.length, icon: Icon.flask },
    { id: "agents", label: "Agents", sub: "builder · tester · eval", count: D.agents.length, icon: Icon.bolt },
    { id: "summary", label: "Scientific summary", sub: "where this stands", count: null, icon: Icon.scale },
  ];
  return (
    <nav className="sidebar">
      <div>
        <div className="sidebar-head">Focus</div>
        <div className="sidebar-nav">
          {items.map(it => {
            const Ico = it.icon;
            return (
              <button
                key={it.id}
                className={"side-link " + (focus === it.id ? "is-on" : "")}
                onClick={() => setFocus(it.id)}
              >
                <Ico cls="icon-sm" />
                <span className="label">
                  <span>{it.label}</span>
                  <span className="sub">{it.sub}</span>
                </span>
                {it.count !== null && <span className="pip mono">{it.count}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div></div>
      <div className="sidebar-foot">
        <div className="ws-card">
          <span className="k">Workspace</span>
          <span className="v">~/venture_lab</span>
          <span className="k">camp_014 · day 18</span>
        </div>
      </div>
    </nav>
  );
}

// ── Canvas (Items + Agents) — Miro-style endless board ────
function CanvasBar({ focus }) {
  const breadcrumbs = focus === "items"
    ? <><span>camp_014 · </span><span>quadrant orbit · </span><span className="crumb-now">items · physics-clustered</span></>
    : focus === "agents"
    ? <><span>camp_014 · </span><span>live swarm · </span><span className="crumb-now">agents · 14 in flight</span></>
    : <><span>camp_014 · </span><span className="crumb-now">scientific summary</span></>;
  return (
    <div className="canvas-bar">
      <span className="breadcrumbs">{breadcrumbs}</span>
      {focus !== "summary" && (
        <span className="canvas-mini">
          <span className="live-pulse" /> live · 60fps · auto-fit
        </span>
      )}
    </div>
  );
}

function CanvasBoard({ children, zoom }) {
  // Wrapper keeps the scaled board's footprint so canvas-body scrolls correctly.
  const wrapStyle = { width: 1640 * zoom, height: 980 * zoom };
  const boardStyle = { transform: `scale(${zoom})`, width: 1640, height: 980 };
  return (
    <div className="board-wrap" style={wrapStyle}>
      <div className="board" style={boardStyle}>
        {children}
      </div>
    </div>
  );
}

// ── Live canvas language (shared by Item + Agent views) ───
// Loosely modelled on patoles/agent-flow's render pipeline:
// glow halo + breathing scale + state ring per node, tapered bezier edges,
// comet-trail particles flowing along edges, orbiting dots on "thinking",
// radar ripples on "queued/held". Adapted to the cockpit's light theme.

const NODE_PALETTE = {
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

// Collapsible legend overlay shared by both canvas views. Click the chevron
// to fold to the title bar; click again to expand. Folded state is per-view.
function LegendPanel({ title, rows, foot }) {
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

function alphaHex(n) {
  const v = Math.max(0, Math.min(255, Math.round(n * 255)));
  return v.toString(16).padStart(2, "0");
}

// Returns the same OKLCH colour with explicit alpha. Required because canvas
// fillStyle parses OKLCH strings, but appending "+ aaHex" silently produces
// an invalid colour and renders transparent.
function withAlpha(color, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  // Match "oklch(L C H)" — strip the closing paren and inject "/ alpha"
  if (color.startsWith("oklch(") && color.endsWith(")")) {
    return color.slice(0, -1) + " / " + a.toFixed(3) + ")";
  }
  // Hex fallback
  return color + alphaHex(a);
}

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

function drawNodeCircle(ctx, n, time, hovered) {
  const breathe = 1 + Math.sin(time * 1.6 + (n.phase || 0)) * 0.05;
  const r = n.r * breathe;
  const color = nodeColor(n.state);

  // Outer glow (radial)
  const glowR = r * 2.8;
  const grad = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, glowR);
  grad.addColorStop(0, withAlpha(color, 0.42));
  grad.addColorStop(0.55, withAlpha(color, 0.14));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2); ctx.fill();

  // Disk — state-tinted so the circle reads as a circle on paper, not as
  // an empty ring. Inner gradient + a darker rim gives weight.
  const diskGrad = ctx.createRadialGradient(n.x - r * 0.25, n.y - r * 0.25, r * 0.1, n.x, n.y, r);
  diskGrad.addColorStop(0, "oklch(99.4% 0.004 80)");
  diskGrad.addColorStop(0.65, "oklch(98.5% 0.006 80)");
  diskGrad.addColorStop(1, withAlpha(color, 0.22));
  ctx.fillStyle = diskGrad;
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();

  // State ring
  ctx.strokeStyle = color;
  ctx.lineWidth = hovered ? 2.8 : 2.0;
  if (n.state === "cleared" || n.state === "queued") ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // Orbiting dots — for "thinking" / live states
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

  // Radar ripples — for "queued / held"
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

  // Center glyph — stage number for items, role-letter for agents
  if (n.glyph) {
    ctx.fillStyle = withAlpha(color, 0.95);
    ctx.font = `600 ${Math.round(r * 0.85)}px var(--font-mono), monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.glyph, n.x, n.y + 1);
  }

  // Label below
  ctx.fillStyle = hovered ? "oklch(28% 0.02 250)" : "oklch(48% 0.01 250)";
  ctx.font = `${hovered ? 11 : 10}px var(--font-mono), monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(n.label || n.id, n.x, n.y + r + 6);
}

// Hexagon path — flat-top hex centred on (x, y) with circumradius r.
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

// Hexagon node — visually distinct from circles. Agents use this. The pulse
// is faster and more flicker-y than the circle's slow breathe so even at a
// glance you can tell agents apart from items.
function drawHexNode(ctx, n, time, hovered) {
  const flicker = 1 + Math.sin(time * 3.4 + (n.phase || 0)) * 0.07;
  const r = n.r * flicker;
  const color = nodeColor(n.state);
  const filled = n.team || true; // agents are filled-color

  // Outer glow
  const glowR = r * 2.3;
  const grad = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, glowR);
  grad.addColorStop(0, withAlpha(color, 0.45));
  grad.addColorStop(0.6, withAlpha(color, 0.12));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2); ctx.fill();

  // Filled hex body in state colour
  hexPath(ctx, n.x, n.y, r);
  ctx.fillStyle = withAlpha(color, hovered ? 0.95 : 0.85);
  ctx.fill();

  // Inner darker hex for depth
  hexPath(ctx, n.x, n.y, r * 0.78);
  ctx.fillStyle = withAlpha(color, 0.18);
  ctx.fill();

  // Crisp edge
  hexPath(ctx, n.x, n.y, r);
  ctx.strokeStyle = withAlpha(color, 1);
  ctx.lineWidth = hovered ? 2.2 : 1.4;
  ctx.stroke();

  // Scanline (horizontal sweep) — agent-flow signature
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

  // Glyph (team letter)
  if (n.glyph) {
    ctx.fillStyle = "oklch(99% 0.005 80)";
    ctx.font = `700 ${Math.round(r * 0.85)}px var(--font-sans), system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.glyph, n.x, n.y + 1);
  }

  // Label
  ctx.fillStyle = hovered ? "oklch(28% 0.02 250)" : "oklch(48% 0.01 250)";
  ctx.font = `${hovered ? 11 : 10}px var(--font-mono), monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(n.label || n.id, n.x, n.y + r + 8);
}

// Mini agent indicator — small filled hex orbiting an item circle.
// Used in the Item view to signal "an agent is currently working on this."
function drawAgentIndicator(ctx, item, agentState, slotIndex, totalSlots, time) {
  const color = nodeColor(agentState);
  // Slot positions: arc on the right side of the item
  const startA = -Math.PI / 3;
  const span = (2 * Math.PI) / 3;
  const a = startA + (totalSlots > 1 ? (slotIndex / (totalSlots - 1)) * span : span / 2);
  const orbitR = item.r + 14;
  const cx = item.x + Math.cos(a) * orbitR;
  const cy = item.y + Math.sin(a) * orbitR;
  const r = 6 + Math.sin(time * 4.2 + slotIndex) * 0.8;

  // Tether line back to the item edge
  ctx.strokeStyle = withAlpha(color, 0.45);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(item.x + Math.cos(a) * item.r, item.y + Math.sin(a) * item.r);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  // Filled hex
  hexPath(ctx, cx, cy, r);
  ctx.fillStyle = withAlpha(color, 0.95);
  ctx.fill();
  hexPath(ctx, cx, cy, r);
  ctx.strokeStyle = withAlpha(color, 1);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Faint pulse halo
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

// Soft physics — repulsion + anchor pull + spring links + light brownian.
// Nodes flagged `static: true` (deferred / cleared / discounted) sit still:
// they still take part in repulsion against active nodes but never move.
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
    // Quadrant boundary — soft wall so nodes never cross into another zone.
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

// Pan / zoom camera shared by both canvas views.
//   .scale       — current zoom (0.3 → 3.0)
//   .tx, .ty     — screen-space translation applied AFTER scale
//   .dragging    — true while user is panning
//   .dragMoved   — true if pointer moved >2px during drag (suppresses click)
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
    // Keep the world point under the cursor pinned to the cursor.
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

function useLiveCanvas(onMount) {
  // Internal helper — sets up canvas with DPR, ResizeObserver, RAF loop. The
  // caller owns simulation state via a ref.
}

// ── Item view — quadrant orbits, gravity-clustered per stage ──────
// Four quadrants: Stage 1 (top-left), Stage 2 (top-right), Stage 3 (bottom-right),
// Cleared possibilities (bottom-left). Each item is a circle anchored to its
// quadrant's centre with soft repulsion against neighbours and weak springs to
// any lineage parents/descendants in other quadrants. Particles flow along the
// lineage edges so the same idea's S1→S2→S3 progression is visibly alive.
function ItemCanvasView({ onOpen }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ nodes: [], links: [], particles: [], hover: null, sectors: null, initialized: false });
  const cameraRef = useRef(newCamera());
  const [tip, setTip] = useState(null);
  const [zoomReadout, setZoomReadout] = useState(1);

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
      // Reset anchors when size changes so quadrants reflow.
      const s = stateRef.current;
      if (s.initialized) reanchor(s, dim.w, dim.h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const teardownCam = installCameraControls(canvas, cameraRef.current, () => {
      setZoomReadout(cameraRef.current.scale);
    });

    // Quadrants are real bounded rectangles drawn with a clear border.
    // Sized as a 2×2 grid that fills the visible canvas with a small gap.
    // Each quadrant exposes both the centre (for anchoring) and a rect
    // (for boundary forces) so items can never wander into another's territory.
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
      // Pre-bucket so we know each node's slot index within its sector.
      const stage1Items = D.opp_clusters.filter(o => o.state !== "cleared");
      const clearedItems = [
        ...D.opp_clusters.filter(o => o.state === "cleared"),
        ...D.directions.filter(d => d.state === "discounted"),
        ...(D.cleared || []).filter(c => c.id.startsWith("br_")),
      ];
      const stage2Items = D.directions.filter(d => d.state !== "discounted");
      const stage3Items = D.artifacts;

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
        const isOpp = c.id.startsWith("opp_");
        const isDir = c.id.startsWith("pdc_");
        const placed = place(sectors.cleared, i, clearedItems.length);
        nodes.push({
          kind: isOpp ? "opportunity" : isDir ? "direction" : "cleared_branch",
          sector: "cleared", id: c.id, label: c.id, data: c,
          state: isDir ? c.state : "cleared",
          glyph: isOpp ? "1" : isDir ? "2" : "·",
          r: 17,
          phase: i * 0.7 + 3,
          // Deferred items don't drift — once they're cleared/discounted they
          // sit still where they're placed.
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
      D.opp_clusters.forEach(o => (o.descendants || []).forEach(c => linkPair(o.id, c)));
      D.directions.forEach(d => (d.descendants || []).forEach(c => linkPair(d.id, c)));

      // Index agents by the item they're touching, so the renderer can
      // show "an agent is working on this" indicators on the right items.
      const agentsByItem = {};
      for (const a of D.agents) {
        if (!a.item) continue;
        // Trim "stage2/mt_011" → "mt_011" so it matches a node id when relevant
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

      // Clear in identity transform; everything below is drawn under the
      // camera transform (dpr × scale, then translation).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cam = cameraRef.current;
      ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * cam.tx, dpr * cam.ty);

      // Paper background — drawn in world space, generously oversized so
      // panning never reveals the void.
      ctx.fillStyle = "oklch(98% 0.003 80)";
      ctx.fillRect(-w * 4, -h * 4, w * 9, h * 9);

      if (s.initialized) {
        const tints = {
          stage1:  { fill: "oklch(96% 0.024 145)", border: "oklch(72% 0.10 145)" },
          stage2:  { fill: "oklch(96% 0.024 252)", border: "oklch(70% 0.10 252)" },
          stage3:  { fill: "oklch(96% 0.026 60)",  border: "oklch(72% 0.11 60)"  },
          cleared: { fill: "oklch(96% 0.008 250)", border: "oklch(72% 0.02 250)" },
        };
        // Quadrant rectangles — clear filled regions with visible border.
        for (const k of Object.keys(s.sectors)) {
          const sec = s.sectors[k];
          ctx.fillStyle = tints[k].fill;
          ctx.beginPath();
          ctx.roundRect(sec.x, sec.y, sec.w, sec.h, 14);
          ctx.fill();
          ctx.strokeStyle = withAlpha(tints[k].border, 0.65);
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.roundRect(sec.x, sec.y, sec.w, sec.h, 14);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Quadrant labels — top-left of each rect, with a count chip.
        ctx.font = `600 10px var(--font-mono), monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (const k of Object.keys(s.sectors)) {
          const sec = s.sectors[k];
          const count = s.nodes.filter(n => n.sector === k).length;
          const labelX = sec.x + 14, labelY = sec.y + 12;
          // Count chip
          const chipText = String(count);
          const chipW = 18, chipH = 14;
          ctx.fillStyle = withAlpha(tints[k].border, 0.18);
          ctx.beginPath(); ctx.roundRect(labelX, labelY, chipW, chipH, 4); ctx.fill();
          ctx.fillStyle = tints[k].border;
          ctx.font = `600 9.5px var(--font-mono), monospace`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(chipText, labelX + chipW / 2, labelY + chipH / 2 + 0.5);
          // Label text
          ctx.fillStyle = withAlpha(tints[k].border, 0.95);
          ctx.font = `600 10px var(--font-mono), monospace`;
          ctx.textAlign = "left"; ctx.textBaseline = "top";
          ctx.fillText(sec.label, labelX + chipW + 8, labelY + 2);
        }

        // Dot grid — only inside each quadrant
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

        // Edges first (under nodes)
        for (const l of s.links) {
          l.cp = drawCurvedEdge(ctx, l.from, l.to, {
            color: nodeColor(l.to.state), alpha: 0.30, width: 1,
          });
        }
        // Particles
        for (const p of s.particles) {
          const e = s.links.find(x => x.id === p.edgeId);
          if (!e) continue;
          drawParticleOnEdge(ctx, e, p, ts / 1000);
        }
        // Nodes
        for (const n of s.nodes) drawNodeCircle(ctx, n, ts / 1000, n === s.hover);

        // Agent indicators — mini hexes orbiting items that have an agent on them
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
      if (n && n.data) onOpen(n.data, n.kind === "cleared_branch" ? "cleared_branch" : n.kind);
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

// Stub kept so anything importing the old name still resolves.
function ItemCard() { return null; }
function ItemBoard() { return null; }

// ── Agent view — agent-flow-style live swarm ──────────────────────
// Each agent node breathes, glows in its team colour, and shoots particles
// along curved edges to the item it's currently touching. Items sit in a
// central column; agents cluster around three team gravity centres.
function AgentCanvasView({ onOpen }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ nodes: [], links: [], particles: [], hover: null, initialized: false });
  const cameraRef = useRef(newCamera());
  const [tip, setTip] = useState(null);
  const [zoomReadout, setZoomReadout] = useState(1);

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
      // Give each agent a slot on a small ring around its team centre
      const teams = { Builder: [], Tester: [], Evaluator: [] };
      for (const n of s.nodes) if (n.kind === "agent") teams[n.team].push(n);
      for (const t of Object.keys(teams)) {
        teams[t].forEach((n, i) => {
          const a = (i / teams[t].length) * Math.PI * 2;
          const ringR = 70;
          n.anchorX = tc[t].cx + Math.cos(a) * ringR;
          n.anchorY = tc[t].cy + Math.sin(a) * ringR;
        });
      }
      // Items in a vertical stack near the right-side gravity well
      const items = s.nodes.filter(n => n.kind === "item");
      items.forEach((n, i) => {
        const stepY = Math.max(60, (h - 120) / Math.max(1, items.length));
        n.anchorX = ic.cx;
        n.anchorY = 60 + i * stepY;
      });
    }

    function init(w, h) {
      const tc = teamCenters(w, h);
      const ic = itemCenter(w, h);
      const nodes = [];
      const teams = { Builder: [], Tester: [], Evaluator: [] };
      D.agents.forEach((a, i) => teams[a.team].push(a));

      for (const t of Object.keys(teams)) {
        teams[t].forEach((a, i) => {
          const ang = (i / teams[t].length) * Math.PI * 2;
          const ringR = 70;
          nodes.push({
            kind: "agent", id: a.id, label: a.id + " · " + a.role.split(" ")[0].toLowerCase(),
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

      // Items being touched — derive from agents' .item field
      const itemIds = Array.from(new Set(D.agents.map(a => a.item)));
      const itemMeta = {
        pdc_004: { state: "lead",     name: "Quiet-hours day pass / 10-pack" },
        pdc_005: { state: "advanced", name: "Reserved-table membership" },
        art_003: { state: "queued",   name: "A-frame + table-tent signage" },
        "stage2/mt_011": { state: "running", name: "mt_011 · pricing acceptance" },
      };
      itemIds.forEach((id, i) => {
        const meta = itemMeta[id] || { state: "running", name: id };
        const stepY = Math.max(110, (h - 180) / Math.max(1, itemIds.length));
        nodes.push({
          kind: "item", id, label: id, data: { id, name: meta.name }, state: meta.state,
          glyph: id.startsWith("art") ? "3" : id.startsWith("stage") ? "·" : "2",
          r: 36, phase: i * 0.8 + 5,
          x: ic.cx, y: 100 + i * stepY,
          anchorX: ic.cx, anchorY: 100 + i * stepY,
          vx: 0, vy: 0,
        });
      });

      const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
      const links = [];
      const particles = [];
      D.agents.forEach((a, i) => {
        const fromN = byId[a.id];
        const toN = byId[a.item];
        if (!fromN || !toN) return;
        const id = a.id + "->" + a.item;
        links.push({ id, from: fromN, to: toN, target: 320 });
        // Particle count by state — thinking / responding / auditing emit faster
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
        // Team-zone tints
        for (const t of Object.keys(s.teamCenters)) {
          const tc = s.teamCenters[t];
          const grd = ctx.createRadialGradient(tc.cx, tc.cy, 30, tc.cx, tc.cy, 260);
          grd.addColorStop(0, tc.color.replace("58%", "94%").replace("60%", "94%") .replace("0.16", "0.025").replace("0.13", "0.025").replace("0.14", "0.025"));
          grd.addColorStop(1, "oklch(98% 0.003 80 / 0)");
          ctx.fillStyle = grd;
          ctx.fillRect(-w * 4, -h * 4, w * 9, h * 9);
        }
        // Items column tint
        const ic = s.itemCenter;
        const igrd = ctx.createRadialGradient(ic.cx, ic.cy, 40, ic.cx, ic.cy, 380);
        igrd.addColorStop(0, "oklch(96% 0.018 252)");
        igrd.addColorStop(1, "oklch(98% 0.003 80 / 0)");
        ctx.fillStyle = igrd;
        ctx.fillRect(-w * 4, -h * 4, w * 9, h * 9);

        // Dot grid
        ctx.fillStyle = "oklch(88% 0.005 95)";
        const step = 24;
        for (let yy = step / 2; yy < h; yy += step) {
          for (let xx = step / 2; xx < w; xx += step) ctx.fillRect(xx, yy, 1, 1);
        }

        // Team labels
        ctx.font = `600 10px var(--font-mono), monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const t of Object.keys(s.teamCenters)) {
          const tc = s.teamCenters[t];
          ctx.fillStyle = tc.color;
          ctx.fillText(tc.label, tc.cx, tc.cy - 110);
        }
        // Items column heading
        ctx.fillStyle = "oklch(48% 0.02 250)";
        ctx.fillText("ITEMS BEING TOUCHED", ic.cx, 26);

        // Edges
        for (const l of s.links) {
          l.cp = drawCurvedEdge(ctx, l.from, l.to, {
            color: nodeColor(l.from.state), alpha: 0.32, width: 1,
          });
        }
        // Particles
        for (const p of s.particles) {
          const e = s.links.find(x => x.id === p.edgeId);
          if (!e) continue;
          drawParticleOnEdge(ctx, e, p, ts / 1000);
        }
        // Nodes — items render as large breathing circles, agents as
        // smaller filled hexagons with a faster scanline pulse so the two
        // are visually unmistakable.
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

  return (
    <div className="live-canvas-frame">
      <canvas ref={canvasRef} className="live-canvas" />
      <LegendPanel
        title="Live · 14 agents in flight · 3 runs"
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

// Stub kept so older references resolve.
function AgentBoard() { return null; }

// ── Scientific summary view ─────────────────────────────
function ScientificSummary() {
  const allItems = [
    ...D.directions.map(d => ({ ...d, stage: 2, kind: "direction" })),
    ...D.opp_clusters.map(o => ({ ...o, stage: 1, kind: "opportunity" })),
  ];
  // Defense histogram across both gates (synthetic from defense_pdc_004 + opp clusters defense)
  const histRows = [
    { label: "Skeptic challenges",  held: 5, weakened: 0, cleared: 1 },
    { label: "Coverage audits",     held: 3, weakened: 1, cleared: 1 },
    { label: "Bias / leakage",      held: 2, weakened: 0, cleared: 0 },
    { label: "Method audits",       held: 2, weakened: 0, cleared: 0 },
  ];
  const totals = histRows.reduce((acc, r) => ({
    held: acc.held + r.held, weakened: acc.weakened + r.weakened, cleared: acc.cleared + r.cleared
  }), { held: 0, weakened: 0, cleared: 0 });
  const totalChallenges = totals.held + totals.weakened + totals.cleared;

  const openQuestions = [
    { q: "Do regulars feel pushed out by the rules — or only by their wording?", meta: "named in 7 microtests · 0 structurally tested", heat: 0.86 },
    { q: "What does the solo-barista reset routine cost on a 2pm rush?",          meta: "no microtest yet covers it",                       heat: 0.78 },
    { q: "Will pricing-tier comprehension hold without the signage in view?",     meta: "pricing tested in isolation only",                  heat: 0.55 },
    { q: "Are low-spend, non-regular customers a silent segment in your corpus?", meta: "0 sources from this group",                         heat: 0.62 },
  ];

  return (
    <div className="scisum">
      <div className="scisum-head">
        <div>
          <div className="kicker">Scientific summary · day 18 · auto-drafted</div>
          <h2>Where the campaign stands, and what it still doesn't know.</h2>
        </div>
        <div className="stamp">
          updated 18:24:09<br />
          camp_014 · stage 2 · pre-gate
        </div>
      </div>

      <div className="bignums">
        <div className="bignum">
          <span className="k">evidence cards</span>
          <span className="v tnum">142</span>
          <span className="sub">across 24 sources · 11 modalities</span>
        </div>
        <div className="bignum">
          <span className="k">directions alive</span>
          <span className="v accent tnum">3</span>
          <span className="sub">1 lead · 1 advanced · 1 discounted</span>
        </div>
        <div className="bignum">
          <span className="k">challenges held</span>
          <span className="v tnum">11 / 14</span>
          <span className="sub">across both gates · 2 weakened · 1 cleared</span>
        </div>
        <div className="bignum">
          <span className="k">cleared possibilities</span>
          <span className="v tnum">3</span>
          <span className="sub">each carrying what it taught</span>
        </div>
      </div>

      <div className="sci-grid">
        <div className="sci-card">
          <h4>Confidence panorama <span className="badge">harness-internal · not market</span></h4>
          <div className="panorama">
            {allItems.map((r, i) => {
              const lo = Math.max(0, r.conf - r.band);
              const hi = Math.min(1, r.conf + r.band);
              return (
                <div key={r.id} className={"pan-row " + (r.state || "")} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-faint)" }}>
                  <div className="name-row">
                    <span className="name">{r.name}</span>
                    <span className="id mono">{r.id} · stage {r.stage}</span>
                    <span className="verdict-mini">{r.state}</span>
                  </div>
                  <div className="bar-row">
                    <div className="bandvis">
                      <span className="band" style={{ left: `${lo*100}%`, width: `${(hi-lo)*100}%` }} />
                      <span className="point" style={{ left: `${r.conf*100}%` }} />
                    </div>
                    <span className="pct tnum">{fmt.pct(r.conf)} · ±{Math.round(r.band*100)} pt</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sci-card">
          <h4>Defense record · so far</h4>
          <div className="def-hist">
            {histRows.map(r => (
              <div key={r.label} className="def-hist-row">
                <span className="label">{r.label}</span>
                <span className="bar">
                  {Array.from({ length: r.held }, (_, i) => <span key={"h"+i} className="seg-square held" />)}
                  {Array.from({ length: r.weakened }, (_, i) => <span key={"w"+i} className="seg-square weakened" />)}
                  {Array.from({ length: r.cleared }, (_, i) => <span key={"c"+i} className="seg-square cleared" />)}
                </span>
                <span className="total">{r.held + r.weakened + r.cleared}</span>
              </div>
            ))}
          </div>
          <div className="def-summary">
            <div className="stat held"><span className="v tnum">{totals.held}</span><span className="k">held</span></div>
            <div className="stat weakened"><span className="v tnum">{totals.weakened}</span><span className="k">weakened</span></div>
            <div className="stat cleared"><span className="v tnum">{totals.cleared}</span><span className="k">cleared</span></div>
          </div>
        </div>
      </div>

      <div className="sci-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="sci-card">
          <h4>Open questions <span className="badge">ranked by unresolved heat</span></h4>
          <div className="openq">
            {openQuestions.map((o, i) => (
              <div key={i} className="openq-row">
                <span className="num">{String(i+1).padStart(2, "0")}</span>
                <div>
                  <div className="q">{o.q}</div>
                  <div className="meta">{o.meta}</div>
                </div>
                <span className="heat" style={{ "--p": `${o.heat*100}%` }}>
                  <style>{`.openq-row .heat::after { left: var(--p, 80%); }`}</style>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="sci-card">
          <h4>Pruning trail <span className="badge">three branches cleared</span></h4>
          <div className="prune">
            {D.cleared.map(c => (
              <div key={c.id} className="prune-row">
                <span className="x"><Icon.close cls="icon-sm" /></span>
                <div>
                  <div className="name">{c.name}</div>
                  <div className="taught">Taught · {c.taught}</div>
                  <div className="why">cleared by · {c.reason} · ({c.id})</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sci-card">
        <h4>This session's significance peaks <span className="badge">queried, not curated</span></h4>
        <div className="sig-peaks">
          {D.what_you_missed.map((m, i) => (
            <div key={m.id} className="peak-row">
              <span className="rank">{i+1}</span>
              <div>
                <div className="head">{m.headline}</div>
                <div className="sub">{m.sub}</div>
              </div>
              <span className="score">σ {(0.92 - i * 0.07).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="opt-in-hint" style={{ textAlign: "center", marginTop: 6 }}>
        Every figure on this page traces back to a ledger event. Nothing here is decorative. Decisions are reversible.
      </p>
    </div>
  );
}

// ── Right rail ───────────────────────────────────────────────
function GateQueue({ onReview }) {
  return (
    <div>
      {D.gate_queue.map((g, i) => {
        const isPrimary = g.kind === "stage_2_to_3";
        return (
          <div key={g.id} className={"gate-item " + (isPrimary ? "is-primary" : "")}>
            <div className="gh">
              <span className="kind mono">{g.kind.replace(/_/g, " ")}</span>
              <span className="ts mono">queued {g.queued}</span>
            </div>
            <div className="title">{g.primary || g.artifact}</div>
            {g.one_liner && <div className="one-liner">{g.one_liner}</div>}
            {g.note && <div className="one-liner mono">{g.note}</div>}
            {g.compounding && <span className="compounding">{g.compounding}</span>}
            <div className="gate-actions">
              {isPrimary && <button className="btn primary" onClick={onReview}>Review &amp; decide</button>}
              {!isPrimary && <button className="btn">Open</button>}
              <button className="btn ghost">Hold</button>
              <button className="btn ghost">Archive</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Ledger() {
  return (
    <div className="ledger">
      {D.ledger.map((row, i) => (
        <div key={i} className={"row kind-" + row.kind}>
          <span className="ts">{row.ts}</span>
          <span className="kind"><span className="pip" /></span>
          <span className="text">
            {row.text}
            <span className="run mono">{row.run}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function LeakageQA() {
  return (
    <div className="qa-list">
      {D.qa.map((q, i) => (
        <div key={i} className={"qa-row " + q.sev}>
          <span className="qk mono">{q.kind.replace(/_/g, " ")}</span>
          <div>
            <div className="qt">{q.text}</div>
            <span className="qrun">↳ {q.run}</span>
          </div>
        </div>
      ))}
      <div className="opt-in-hint" style={{ paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
        Coverage Auditor flagged operator-side workload three times before it landed. The defense record reflects this.
      </div>
    </div>
  );
}

// ── Pulse line (status footer) ──────────────────────────────
function PulseLine({ data }) {
  const w = 240, h = 18, max = Math.max(...data);
  const pts = data.map((v, i) => `${(i/(data.length-1)) * w},${h - (v/max)*h}`).join(" ");
  return (
    <span className="pulse-line">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline fill="none" stroke="oklch(48% 0.13 252)" strokeWidth="1.2" points={pts} />
      </svg>
    </span>
  );
}

// ── Item detail modal (cockpit register) ────────────────────
function ItemDetailModal({ item, kind, onClose, onOpenEvidence, onOpenDefense }) {
  if (!item) return null;
  const isDirection = kind === "direction";
  const isOpp = kind === "opportunity";
  const showDefense = item.id === "pdc_004" || item.id === "opp_001";
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="titlerow">
            <span className="id mono">{item.id} · {kind}</span>
            <span className="name">{item.name}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon.close /></button>
        </div>
        <div className="modal-body">
          <div className="section">
            <h5>Where this stands inside the harness</h5>
            <div className="kv">
              {item.conf !== undefined && (
                <Fragment>
                  <span className="k">Confidence</span>
                  <span className="v mono"><span className="tnum">{fmt.pct(item.conf)}</span> · band {fmt.band(item.conf - item.band, item.conf + item.band)}</span>
                </Fragment>
              )}
              <span className="k">State</span><span className="v"><span className={"card-state " + item.state}>{item.state}</span></span>
              {item.aud && <Fragment><span className="k">Audience</span><span className="v">{item.aud}</span></Fragment>}
              {item.purpose && <Fragment><span className="k">Purpose</span><span className="v">{item.purpose}</span></Fragment>}
              {item.qa && <Fragment><span className="k">QA</span><span className="v mono">{item.qa}</span></Fragment>}
              {item.defense && <Fragment><span className="k">Defense record</span><span className="v"><button className="evidence-link" onClick={() => onOpenDefense(item)}>{item.defense}<Icon.arrowR cls="icon-sm" /></button></span></Fragment>}
              {item.wedge && <Fragment><span className="k">Wedge</span><span className="v">{item.wedge}</span></Fragment>}
              {item.note && <Fragment><span className="k">Note</span><span className="v">{item.note}</span></Fragment>}
              {item.microtests !== undefined && <Fragment><span className="k">Microtests</span><span className="v mono tnum">{item.microtests}</span></Fragment>}
              {item.ev !== undefined && <Fragment><span className="k">Evidence count</span><span className="v mono tnum">{item.ev}</span></Fragment>}
              {item.ten !== undefined && <Fragment><span className="k">Tensions</span><span className="v mono tnum">{item.ten}</span></Fragment>}
            </div>
          </div>

          {(isDirection || isOpp) && (
            <div className="section">
              <h5>Linked evidence (sample)</h5>
              <div style={{ display: "grid", gap: 6 }}>
                {D.evidence.slice(0, 4).map(ev => (
                  <button key={ev.id} className="evidence-link" onClick={() => onOpenEvidence(ev)}>
                    {ev.id} · {ev.type.replace(/_/g, " ")}
                    <Icon.ext cls="icon-sm" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(isDirection || isOpp) && (
            <div className="section">
              <h5>Tensions</h5>
              {D.tensions.slice(0, 2).map(t => (
                <div key={t.id} className="evidence-quote" style={{ marginBottom: 8 }}>
                  <strong style={{ fontFamily: "var(--font-sans)", fontSize: "var(--t-12)", display: "block", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-faint)" }}>
                    {t.id} · {t.topic}
                  </strong>
                  <div style={{ marginBottom: 4 }}>{t.a}</div>
                  <div style={{ color: "var(--text-muted)" }}>vs. {t.b}</div>
                </div>
              ))}
            </div>
          )}

          {kind === "artifact" && (
            <div className="section">
              <h5>Persona that will react</h5>
              <p className="muted" style={{ fontSize: "var(--t-13)", margin: 0 }}>
                Three personas are composed for this artifact. <strong>Yi-Ling</strong> (remote worker, laptop-friendly) is built from <span className="mono">ev_044, ev_058, ev_071</span>. Eight cousins; variance 0.18; improvisation rate 6%.
              </p>
              <div style={{ marginTop: 10, background: "var(--surface-2)", borderRadius: 6, padding: "12px 14px" }}>
                <div className="cousin-row"><span className="num">c1</span><span className="out">"$42 for ten? That's two months of co-working — yes."</span><span className="verdict-pill paid">paid</span><span className="dur mono">14s</span></div>
                <div className="cousin-row"><span className="num">c2</span><span className="out">"I'd pay drop-in once before committing."</span><span className="verdict-pill paid">paid</span><span className="dur mono">11s</span></div>
                <div className="cousin-row"><span className="num">c3</span><span className="out">"I want to read the rules first."</span><span className="verdict-pill paid">paid</span><span className="dur mono">17s</span></div>
                <div className="cousin-row"><span className="num">c4</span><span className="out">"Wait — <span className="improv" title="Improvised: this clause is not directly grounded in evidence cards.">if regulars get priority on weekends</span> I'll feel like a guest."</span><span className="verdict-pill walked">walked</span><span className="dur mono">22s</span></div>
              </div>
              <p className="footnote" style={{ fontSize: "var(--t-11)", color: "var(--text-faint)", marginTop: 8 }}>
                Underlined sentences extrapolate beyond evidence (improvisation flag, per-claim audited).
              </p>
            </div>
          )}

          {showDefense && (
            <div className="section">
              <h5>Defense record summary</h5>
              <p className="muted" style={{ fontSize: "var(--t-13)", margin: "0 0 8px" }}>{D.defense_pdc_004.summary}</p>
              <button className="btn primary" onClick={() => onOpenDefense(item)}>Open defense record →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Evidence card modal ─────────────────────────────────────
function EvidenceModal({ evidence, onClose }) {
  if (!evidence) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: "min(640px, 100%)" }}>
        <div className="modal-head">
          <div className="titlerow">
            <span className="id mono">{evidence.id} · {evidence.type}</span>
            <span className="name">{evidence.claim}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon.close /></button>
        </div>
        <div className="modal-body">
          <div className="section">
            <h5>Source quote</h5>
            <div className="evidence-quote">"{evidence.source.quote}"</div>
            <div className="kv" style={{ marginTop: 12 }}>
              <span className="k">File</span><span className="v mono">{evidence.source.file}</span>
              <span className="k">Span</span><span className="v mono">{evidence.source.span}</span>
              <span className="k">Source id</span><span className="v mono">{evidence.source.id}</span>
              <span className="k">Extraction confidence</span><span className="v mono tnum">{fmt.pct(evidence.conf)}</span>
            </div>
          </div>
          <div className="section">
            <h5>Theory links</h5>
            <div style={{ display: "grid", gridAutoFlow: "column", justifyContent: "start", gap: 6 }}>
              <span className="tag">value_proposition_canvas.pain</span>
              <span className="tag">diffusion_of_innovations.complexity</span>
              <span className="tag">jtbd.workaround</span>
            </div>
          </div>
          <div className="section">
            <h5>Status</h5>
            <p className="muted" style={{ margin: 0 }}>Active. Linked from 3 hypotheses, 2 directions, 1 tension.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Defense record full modal ───────────────────────────────
function DefenseModal({ open, onClose }) {
  if (!open) return null;
  const dr = D.defense_pdc_004;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: "min(820px, 100%)" }}>
        <div className="modal-head">
          <div className="titlerow">
            <span className="id mono">pdc_004 · defense record</span>
            <span className="name">Quiet-hours day pass / 10-pack punch card</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon.close /></button>
        </div>
        <div className="modal-body">
          <div className="section">
            <h5>Summary</h5>
            <p style={{ fontSize: "var(--t-14)", margin: 0, color: "var(--text)", fontFamily: "var(--font-serif)", lineHeight: 1.55 }}>
              {dr.summary} The harness's Skeptic, Coverage and Bias auditors ran <em>before</em> this gate and persisted their attempts. You're reading a record, not a live battle.
            </p>
          </div>
          <div className="section">
            <h5>Twelve challenges</h5>
            <div className="defense-table">
              {dr.entries.map((e, i) => (
                <div key={i} className="defense-row">
                  <div>
                    <div className="challenger">{e.challenger}</div>
                    <div className="reasoning">{e.reasoning} <span className="mono faint">· {e.basis}</span></div>
                  </div>
                  <span className={"verdict " + e.verdict.toLowerCase()}>{e.verdict}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Gate decision — editorial register full screen ─────────
function GateDecisionEditorial({ open, onClose, onOpenDossier }) {
  if (!open) return null;
  return (
    <div className="editorial-shell editorial">
      <div className="editorial-bar">
        <div className="left">
          <button className="tb-btn" onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <Icon.back cls="icon-sm" /> Return to cockpit
          </button>
          <span className="breadcrumbs">camp_014 · gate 2 → 3 · pdc_004</span>
        </div>
        <div></div>
        <div className="right">
          <span className="opt-in-hint" style={{ color: "var(--text-muted)" }}>This is the editorial register — moments that matter.</span>
          <button className="tb-btn"><Icon.mic cls="icon-sm" /> Talk it through</button>
        </div>
      </div>
      <div className="editorial-page">
        <div className="editorial-col wide">
          <div className="kicker">Gate · Stage 2 → Stage 3 · pdc_004</div>
          <h1>Quiet-hours day pass and a 10-pack punch card.</h1>
          <p className="lede">
            Held against nine of twelve challenges. One weakened — operator workload — because no microtest yet
            covers the barista's reset routine. Two cleared, including the substitution-by-library worry. A
            parallel branch on reserved-table membership is alive and earning its place.
          </p>
          <p className="muted" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--t-12)" }}>
            <span className="small-caps">Compounding rigor</span> · This direction has been through 14 challenges across both gates. 11 held.
          </p>

          <div className="editorial-grid-2" style={{ marginTop: 32 }}>
            <div className="editorial-card">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.book cls="icon-sm" /></span>
                <span>Foundations</span>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: 15, lineHeight: 1.55 }}>Five sources carry this cluster. Yi-Ling's voice memo is the strongest single thread — she named her own willingness-to-pay before you did.</p>
                <div className="source-heatmap">
                  <div className="source-heatmap-row"><span className="src">Yi-Ling · voice memo</span><span className="h-bar"><span style={{ width: "84%" }} /></span><span className="pct">.84</span></div>
                  <div className="source-heatmap-row"><span className="src">Emily · interview</span><span className="h-bar"><span style={{ width: "72%" }} /></span><span className="pct">.72</span></div>
                  <div className="source-heatmap-row"><span className="src">Forum scrape, Apr 23</span><span className="h-bar"><span style={{ width: "61%" }} /></span><span className="pct">.61</span></div>
                  <div className="source-heatmap-row"><span className="src">Reviews aggregator</span><span className="h-bar"><span style={{ width: "44%" }} /></span><span className="pct">.44</span></div>
                  <div className="source-heatmap-row"><span className="src">Support tickets</span><span className="h-bar"><span style={{ width: "28%" }} /></span><span className="pct">.28</span></div>
                </div>
                <p className="muted" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--t-11)", marginTop: 12 }}>Single-source dependency on <span className="mono">ev_044</span> previously carried budget. Resolved by adding two corroborating posts.</p>
              </div>
            </div>

            <div className="editorial-card">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.bolt cls="icon-sm" /></span>
                <span>Mind-changers</span>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: 15, lineHeight: 1.55 }}>What would move our confidence here, before tomorrow.</p>
                <div className="fork">
                  <div className="fork-side up">
                    <div className="lbl"><Icon.arrowR cls="icon-sm" /> brightens</div>
                    A single regular who volunteers willingness to pay.<br /><br />
                    Barista workflow audit on pdc_005 holds → parallel branch promotes from "alive" to "recommended."
                  </div>
                  <div className="fork-side down">
                    <div className="lbl"><Icon.close cls="icon-sm" /> dims</div>
                    Next three customer conversations don't repeat the afternoon-slump frustration.<br /><br />
                    Coverage gap on operator workload widens to 2/12.
                  </div>
                </div>
              </div>
            </div>

            <div className="editorial-card">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.scale cls="icon-sm" /></span>
                <span>Second opinion</span>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: 15, lineHeight: 1.55 }}>The Builder and Evaluator teams agree on the lead. They differ on sequencing.</p>
                <div className="opinion-ledger">
                  <div className="opinion-row">
                    <span className="who builder">Builder</span>
                    <div>Advance <span className="mono">pdc_004</span> with <span className="mono">pdc_005</span> as a parallel branch. Begin Stage 3 artifact generation in low-fi sketch register.</div>
                  </div>
                  <div className="opinion-row">
                    <span className="who evaluator">Evaluator</span>
                    <div>Agreed on the lead. <em>Dissents calmly on sequencing</em> — would run the operator-workload microtest <em>before</em> any artifact spend.</div>
                  </div>
                  <div className="opinion-row">
                    <span className="who">Where they meet</span>
                    <div>One microtest first. Then artifacts. Cost delta is $0.18 and twenty minutes.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="editorial-card">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.flask cls="icon-sm" /></span>
                <span>Strengthen this</span>
              </div>
              <div className="panel-body">
                <p style={{ fontSize: 15, lineHeight: 1.55 }}>Cheapest next moves, in order. Each one is a microtest, not a commitment.</p>
                <div className="num-bullets">
                  <div className="num-bullet"><span className="n">1</span><span className="text">Microtest on the solo-barista reset routine. Where the workload actually goes when the room turns over at 3pm.</span><span className="cost">$0.18 · 20 min</span></div>
                  <div className="num-bullet"><span className="n">2</span><span className="text">Signage A/B before pricing-page generation. Test work-friendly framing without scaring regulars first.</span><span className="cost">$0.32 · 35 min</span></div>
                  <div className="num-bullet"><span className="n">3</span><span className="text">Reweight operator-side workload to 0.18 in the Stage 3 scorecard, up from 0.12.</span><span className="cost">free · 1 click</span></div>
                </div>
              </div>
            </div>
          </div>

          <h2>The defense record</h2>
          <div className="editorial-defense">
            {D.defense_pdc_004.entries.map((e, i) => (
              <div className="row" key={i}>
                <div>
                  <div className="ch">{e.challenger}</div>
                  <div className="reason">{e.reasoning}</div>
                </div>
                <div className="verdict"><span className={e.verdict.toLowerCase()}>{e.verdict}</span></div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridAutoFlow: "column", gap: 10, justifyContent: "start", marginTop: 32 }}>
            <button className="btn primary" style={{ padding: "10px 18px", fontSize: "var(--t-13)" }}>
              Advance pdc_004 + pdc_005 as parallel branches
            </button>
            <button className="btn" style={{ padding: "10px 18px", fontSize: "var(--t-13)" }}>Hold for one more microtest</button>
            <button className="btn ghost" style={{ padding: "10px 18px" }} onClick={onOpenDossier}>Preview drafted dossier →</button>
          </div>
          <p className="footnote" style={{ marginTop: 24 }}>
            Where this stands inside the harness — not market validation. Decisions are reversible via new ledger events.
          </p>
        </div>
      </div>
      <div className="editorial-pager">
        <button className="btn ghost" onClick={onClose}><Icon.back cls="icon-sm" /> back to cockpit</button>
        <div className="dots">
          <span className="dot-link is-on" />
        </div>
        <span className="pager-info">drafted by ag_011, ag_022, ag_051 · 4 minutes ago</span>
      </div>
    </div>
  );
}

// ── Dossier — editorial 4-screen publication ───────────────
function DossierEditorial({ open, onClose }) {
  if (!open) return null;
  const [page, setPage] = useState(1);
  const d = D.dossier;

  const Page1 = () => (
    <div className="editorial-col">
      <div className="kicker">Opportunity dossier · screen 1 of 4</div>
      <h1>{d.title}</h1>
      <p className="lede" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>{d.subtitle}</p>
      <h2>How your thinking changed.</h2>
      <p>You started looking for an afternoon traffic problem. By the end of day one you were looking for a regulars problem. Eighteen days later, you're not yet sure if regulars feel safe — and that's the right thing to be unsure about.</p>
      <div style={{ marginTop: 28, borderTop: "1px solid var(--border)" }}>
        {d.thinking_changed.map((m, i) => (
          <div key={i} className="inflection-row">
            <span className="roundel">{i+1}</span>
            <span className="when">{m.ts}</span>
            <p className="note">{m.note}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const Page2 = () => (
    <div className="editorial-col">
      <div className="kicker">Opportunity dossier · screen 2 of 4</div>
      <h1>What we walked past together.</h1>
      <p className="lede">Specific to this campaign. Not a checklist. The harness was beside you the whole way — these are co-investigated gaps, not blame.</p>
      <div style={{ marginTop: 24, borderTop: "1px solid var(--border)" }}>
        {d.walked_past.map((line, i) => (
          <div key={i} className="walked-row">
            <span className="miss-icon">○</span>
            <div className="body">
              <p style={{ margin: 0 }}>{line}</p>
              <div className="tag-row">
                <span className="stamp">no microtest</span>
                <span className="stamp">cheap to fix</span>
                <span className="stamp">flagged · ag_052</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const Page3 = () => (
    <div className="editorial-col">
      <div className="kicker">Opportunity dossier · screen 3 of 4</div>
      <h1>The smallest real-world test.</h1>
      <p className="lede">One card. The cheapest possible move that converts a harness-internal finding into a real-world signal.</p>
      <div className="smallest-card" style={{ marginTop: 24 }}>
        <div className="head">
          <div>
            <div className="small-caps">Tomorrow · 3pm</div>
            <h3 style={{ margin: "6px 0 0", fontSize: 22 }}>{d.smallest_test.headline}</h3>
          </div>
          <span className="price-tag">{d.smallest_test.cost}</span>
          <span className="duration-tag">{d.smallest_test.duration}</span>
        </div>
        <p>{d.smallest_test.outcome}</p>
        <div className="observe">
          <div className="small-caps">Observe</div>
          <ul>
            {d.smallest_test.observe.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </div>
        <div className="tier-table">
          <div className="small-caps">Or, if tomorrow won't work</div>
          {d.smallest_test.tiers.slice(1).map((t, i) => (
            <div key={i} className="tier-row">
              <span className="t">{t.tier}</span>
              <span className="a">{t.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const Page4 = () => (
    <div className="editorial-col">
      <div className="kicker">Opportunity dossier · screen 4 of 4</div>
      <h1>Cleared possibilities.</h1>
      <p className="lede">Five branches no longer needed. Each is named with what it taught the campaign first, then how it was cleared. Walk-back from any line is one click — full provenance to the source quote.</p>
      <div className="cleared-list" style={{ marginTop: 28 }}>
        {d.cleared_possibilities.map((c, i) => (
          <div key={i} className="cleared-row">
            <div className="left">
              <span className="x-mark"><Icon.close cls="icon-sm" /></span>
              <div>
                <div className="name">{c.name}</div>
                <div className="taught"><em>Taught:</em> {c.taught}</div>
                <div className="clearedby">Cleared by · {c.cleared_by}</div>
              </div>
            </div>
            <button className="reopen">Reopen this branch</button>
          </div>
        ))}
      </div>
      <p className="footnote" style={{ marginTop: 36, fontSize: "var(--t-12)" }}>
        Where this stands inside the harness · {fmt.pct(d.confidence_value)} ± {Math.round(d.confidence_band*100)} pts. Not market validation. Real validation begins tomorrow at 3pm.
      </p>
    </div>
  );

  const pages = [Page1, Page2, Page3, Page4];
  const Cur = pages[page - 1];

  return (
    <div className="editorial-shell editorial">
      <div className="editorial-bar">
        <div className="left">
          <button className="tb-btn" onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <Icon.back cls="icon-sm" /> Return to cockpit
          </button>
          <span className="breadcrumbs">camp_014 · drafted dossier · screen {page} / 4</span>
        </div>
        <div></div>
        <div className="right">
          <button className="tb-btn"><Icon.mic cls="icon-sm" /> Read aloud (Chief of Staff voice)</button>
          <span className="opt-in-hint" style={{ color: "var(--text-muted)" }}>~$0.42 via ElevenLabs</span>
        </div>
      </div>
      <div className="editorial-page">
        <Cur />
      </div>
      <div className="editorial-pager">
        <button className="btn ghost" onClick={() => setPage(Math.max(1, page-1))} disabled={page===1}>
          <Icon.back cls="icon-sm" /> previous
        </button>
        <div className="dots">
          {[1,2,3,4].map(p => (
            <button key={p} className={"dot-link " + (p === page ? "is-on" : "")} onClick={() => setPage(p)} />
          ))}
        </div>
        <button className="btn ghost" onClick={() => setPage(Math.min(4, page+1))} disabled={page===4}>
          next <Icon.forward cls="icon-sm" />
        </button>
      </div>
    </div>
  );
}

// ── Chief of Staff stage — graphical, hands-free presentation ──
//
// The Chief of Staff doesn't open a chat panel. They open a stage:
// editorial-register slides with key visuals, tasteful staggered
// motion on entrance, auto-advance timing, and an auto-scroll for
// any slide tall enough to need it. Nav is invisible by default and
// reveals only on cursor movement; ←/→ keys also work; Space pauses.
function ChiefOfStaffStage({ open, onClose, onJumpDossier, onJumpGate }) {
  const SLIDES = useMemo(() => ([
    {
      id: "welcome",
      duration: 5800,
      kicker: "Chief of Staff · day 18 · 18:24",
      render: () => (
        <Fragment>
          <div className="kicker" style={{ "--d": 0 }}>Welcome back</div>
          <h1 style={{ "--d": 200 }}>Eighteen days in,<br/>and the lead direction is holding.</h1>
          <p className="lede" style={{ "--d": 500 }}>
            I'm going to walk you through where the campaign stands tonight in seven slides.
            Sit back — I'll move on my own. Press <span className="mono">→</span> to advance, <span className="mono">space</span> to pause.
          </p>
          <p className="footnote" style={{ "--d": 800 }}>
            Everything here traces back to a ledger event. Nothing is summarized away.
          </p>
        </Fragment>
      )
    },
    {
      id: "defense",
      duration: 9500,
      kicker: "Defense record · pdc_004 · across both gates",
      render: () => {
        const total = 14, held = 11, weakened = 1, cleared = 2;
        const C = 2 * Math.PI * 90; // circumference at r=90
        const heldArc = (held / total) * C;
        const weakArc = (weakened / total) * C;
        const clearArc = (cleared / total) * C;
        return (
          <Fragment>
            <div className="kicker" style={{ "--d": 0 }}>Past-tense rigor · so far</div>
            <h1 className="smaller" style={{ "--d": 150 }}>The lead direction held against eleven of fourteen challenges.</h1>
            <p className="lede" style={{ "--d": 400 }}>
              Skeptic, Coverage and Bias auditors ran on <em>pdc_004</em> across Stage 1 and Stage 2.
              You're reading a record, not a live battle.
            </p>
            <div className="def-arc" style={{ "--d": 700 }}>
              <svg className="def-arc-svg" viewBox="0 0 220 220">
                <circle cx="110" cy="110" r="90" fill="none" className="seg-bg" strokeWidth="18" />
                <g transform="rotate(-90 110 110)">
                  <circle cx="110" cy="110" r="90" fill="none"
                          stroke="oklch(50% 0.13 152)" strokeWidth="18"
                          strokeDasharray={`${heldArc} ${C}`} strokeDashoffset="0"
                          className="seg-fill" />
                  <circle cx="110" cy="110" r="90" fill="none"
                          stroke="oklch(67% 0.135 75)" strokeWidth="18"
                          strokeDasharray={`${weakArc} ${C}`} strokeDashoffset={`-${heldArc}`}
                          className="seg-fill" />
                  <circle cx="110" cy="110" r="90" fill="none"
                          stroke="oklch(55% 0.16 28)" strokeWidth="18"
                          strokeDasharray={`${clearArc} ${C}`} strokeDashoffset={`-${heldArc + weakArc}`}
                          className="seg-fill" />
                </g>
                <text x="110" y="108" textAnchor="middle" className="center-num">{held}</text>
                <text x="110" y="132" textAnchor="middle" className="center-of">of {total} held</text>
              </svg>
              <div className="def-legend">
                <div className="def-legend-row"><span className="swatch held" /><span className="label">Held — basis grounded, no weakening</span><span className="count">{held}</span></div>
                <div className="def-legend-row"><span className="swatch weakened" /><span className="label">Weakened — coverage gap on operator workload</span><span className="count">{weakened}</span></div>
                <div className="def-legend-row"><span className="swatch cleared" /><span className="label">Cleared — single-source dependency, route to library substitute</span><span className="count">{cleared}</span></div>
              </div>
            </div>
            <p className="footnote" style={{ "--d": 1200 }}>One challenge to your eyes next.</p>
          </Fragment>
        );
      }
    },
    {
      id: "weakened",
      duration: 9500,
      kicker: "The one that weakened",
      render: () => (
        <Fragment>
          <div className="kicker" style={{ "--d": 0 }}>Coverage auditor · ag_052</div>
          <h1 className="smaller" style={{ "--d": 150 }}>Operator workload — we don't yet have a microtest on the barista's reset routine.</h1>
          <p className="lede" style={{ "--d": 400 }}>
            Twelve cells below are the Stage 2 challenges. One amber means weakened. Two red mean cleared. Nine green held cleanly.
          </p>
          <div className="def-bar" style={{ "--d": 700 }}>
            {[
              { v: "held" }, { v: "held" }, { v: "weakened" }, { v: "held" },
              { v: "held" }, { v: "held" }, { v: "cleared" }, { v: "held" },
              { v: "held" }, { v: "cleared" }, { v: "held" }, { v: "held" },
            ].map((c, i) => (
              <div key={i} className={"cell " + c.v} style={{ "--d": 700 + i * 60 }}>{c.v[0].toUpperCase()}</div>
            ))}
          </div>
          <div className="def-bar-legend" style={{ "--d": 1500 }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "oklch(50% 0.13 152)", marginRight: 6 }} /> held · 9</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "oklch(67% 0.135 75)", marginRight: 6 }} /> weakened · 1</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "oklch(55% 0.16 28)", marginRight: 6 }} /> cleared · 2</span>
          </div>
          <p className="footnote" style={{ "--d": 1700, marginTop: 14 }}>
            The cheapest move that closes this is one microtest — twenty minutes, eighteen cents. I'll show you in a moment.
          </p>
        </Fragment>
      )
    },
    {
      id: "cousins",
      duration: 10500,
      kicker: "Stage 3 simulated pilot · Yi-Ling persona · 8 cousins",
      render: () => {
        const cousins = [
          { v: "paid",   q: "Two months of co-working — yes.",                      A: Avatar.one   },
          { v: "paid",   q: "Drop-in once before committing.",                      A: Avatar.two   },
          { v: "paid",   q: "I want to read the rules first.",                      A: Avatar.three },
          { v: "paid",   q: "Tens at $4.20 each is fair.",                          A: Avatar.four  },
          { v: "paid",   q: "Quiet hours sound exactly right.",                     A: Avatar.five  },
          { v: "paid",   q: "I'd buy if regulars stay welcome.",                    A: Avatar.six   },
          { v: "paid",   q: "Cheaper than the library café down the road.",         A: Avatar.seven },
          { v: "walked", q: "If regulars get priority on weekends I'll feel like a guest.", A: Avatar.eight },
        ];
        return (
          <Fragment>
            <div className="kicker" style={{ "--d": 0 }}>Cousin chorus</div>
            <h1 className="smaller" style={{ "--d": 150 }}>Seven of eight Yi-Lings paid. One walked away over the rules.</h1>
            <p className="lede" style={{ "--d": 400 }}>
              Eight runs of the same persona under the same scenario. Their words are grounded in your evidence cards. Voice rendering is opt-in.
            </p>
            <div className="cousins" style={{ "--d": 700 }}>
              {cousins.map((c, i) => (
                <div key={i} className={"cousin " + c.v} style={{ "--d": 700 + i * 80 }}>
                  <span className="avatar-wrap"><c.A /></span>
                  <span><span className="num">cousin {i+1}</span><span className="verdict">{c.v}</span></span>
                  <span className="quote">"{c.q}"</span>
                </div>
              ))}
            </div>
            <p className="footnote" style={{ "--d": 1500 }}>
              Variance 0.18 · improvisation rate 6%. Cousin 8's "weekends" clause was flagged as improvised — it extrapolated beyond evidence.
            </p>
          </Fragment>
        );
      }
    },
    {
      id: "missed",
      duration: 9500,
      kicker: "Three signal-ranked moments since you stepped away",
      render: () => (
        <Fragment>
          <div className="kicker" style={{ "--d": 0 }}>What you missed · queried, not curated</div>
          <h1 className="smaller" style={{ "--d": 150 }}>Three moments worth your eyes.</h1>
          <div className="signals" style={{ "--d": 400 }}>
            {D.what_you_missed.map((m, i) => (
              <div key={m.id} className="signal" style={{ "--d": 400 + i * 220 }}>
                <span className="rank">{i+1}</span>
                <span className="head">{m.headline}</span>
                <span className="meta">{m.sub}</span>
                <span className="score">σ {(0.92 - i * 0.07).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="footnote" style={{ "--d": 1100 }}>
            Each one is a 12 to 30 second listen, in my voice. I won't read them now unless you ask.
          </p>
        </Fragment>
      )
    },
    {
      id: "queue",
      duration: 9500,
      kicker: "What I'd queue before the gate",
      render: () => (
        <Fragment>
          <div className="kicker" style={{ "--d": 0 }}>One microtest · cheapest move</div>
          <h1 className="smaller" style={{ "--d": 150 }}>Solo-barista reset routine.</h1>
          <p className="lede" style={{ "--d": 400 }}>
            Where the workload actually goes when the room turns over at three. This closes the one weakened challenge before any artifact spend.
          </p>
          <div className="queue-card" style={{ "--d": 700 }}>
            <div>
              <div className="label">μt-018-b · queued · awaiting your nod</div>
              <div className="name">Mock a 3pm rush in the barista workflow auditor.</div>
              <p className="why">
                Run 6 cousins. Score reset-time, customer collisions, and rule-explanation friction.
                Resulting evidence updates the Stage 3 weight from 0.12 to 0.18.
              </p>
            </div>
            <div className="price-stack">
              <div className="cost">$0.18</div>
              <div className="duration">≈ 20 minutes</div>
            </div>
          </div>
          <p className="footnote" style={{ "--d": 1100 }}>I'll only run this when you tap the queue. I don't spend without your nod.</p>
        </Fragment>
      )
    },
    {
      id: "ask",
      duration: 0,
      kicker: "Your move",
      render: () => (
        <Fragment>
          <div className="kicker" style={{ "--d": 0 }}>Anything else worth your eyes?</div>
          <h1 className="tight" style={{ "--d": 150 }}>That's where we stand.</h1>
          <p className="lede" style={{ "--d": 400 }}>
            We can talk it through, open the gate when you're ready, or page back to any slide. I'll wait.
          </p>
          <div className="ask-buttons" style={{ "--d": 700 }}>
            <button className="ask-btn primary" onClick={onJumpGate}>
              <Icon.arrowR cls="icon-sm" />
              Open the Stage 2 → 3 gate
            </button>
            <button className="ask-btn" onClick={onJumpDossier}>
              <Icon.book cls="icon-sm" />
              Read the drafted dossier
            </button>
            <button className="ask-btn">
              <Icon.mic cls="icon-sm" />
              Talk it through
            </button>
          </div>
          <p className="footnote" style={{ "--d": 1000 }}>
            Press <span className="mono">←</span> to step back, or close — your transcript is saved to the campaign ledger either way.
          </p>
        </Fragment>
      )
    },
  ]), [onJumpDossier, onJumpGate]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);   // 0..1 inside current slide
  const [navIdle, setNavIdle] = useState(true);

  // reset slide state when stage opens
  useEffect(() => {
    if (open) {
      setIdx(0);
      setPaused(false);
      setProgress(0);
    }
  }, [open]);

  // auto-advance + progress ticker
  useEffect(() => {
    if (!open) return;
    const slide = SLIDES[idx];
    if (!slide || slide.duration === 0) {
      setProgress(1);
      return;
    }
    if (paused) return;

    const start = performance.now();
    const startProgress = progress;
    let raf;
    const tick = (t) => {
      const elapsed = (t - start) + startProgress * slide.duration;
      const p = Math.min(1, elapsed / slide.duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else if (idx < SLIDES.length - 1) {
        setIdx(i => i + 1);
        setProgress(0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, paused, SLIDES]);

  // hide nav after 1.6s of no cursor movement
  useEffect(() => {
    if (!open) return;
    let t;
    const wake = () => {
      setNavIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setNavIdle(true), 1600);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    wake();
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [open]);

  // auto-scroll any tall slide content
  const scrollRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    el.scrollTop = 0;
    const slide = SLIDES[idx];
    if (slide.duration === 0) return;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / slide.duration);
      el.scrollTop = max * p;
      if (p < 1 && !paused) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idx, open, paused, SLIDES]);

  // keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") { setIdx(i => Math.min(SLIDES.length - 1, i + 1)); setProgress(0); }
      else if (e.key === "ArrowLeft") { setIdx(i => Math.max(0, i - 1)); setProgress(0); }
      else if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
      else if (e.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, SLIDES.length, onClose]);

  if (!open) return null;
  const slide = SLIDES[idx];

  return (
    <div className={"cos-stage " + (navIdle ? "is-idle" : "")}>
      <div className="stage-bar">
        <div className="stage-host">
          <span className="voice-mark" />
          <div className="who-line">
            <span className="who">Chief of Staff</span>
            <span className="what">{slide.kicker}</span>
          </div>
        </div>
        <span className="stage-meta">a seven-slide briefing · slide {idx + 1} of {SLIDES.length}</span>
        <div className="stage-tools">
          <button className="stage-tool" onClick={() => setPaused(p => !p)} title="Space to pause">
            {paused ? <Icon.play cls="icon-sm" /> : <Icon.pause cls="icon-sm" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="stage-tool" onClick={onClose} title="Esc">
            <Icon.close cls="icon-sm" />
            Close
          </button>
        </div>
      </div>

      <div className="cos-slides">
        {SLIDES.map((s, i) => (
          <section
            key={s.id}
            className={"cos-slide " + (i === idx ? "is-on" : i < idx ? "is-leaving" : "")}
            aria-hidden={i !== idx}
          >
            <div className="cos-slide-inner" ref={i === idx ? scrollRef : null}>
              {s.render()}
            </div>
          </section>
        ))}
      </div>

      <button
        className="stage-nav prev"
        onClick={() => { setIdx(i => Math.max(0, i - 1)); setProgress(0); }}
        disabled={idx === 0}
        title="Previous · ←"
      >
        <Icon.back />
      </button>
      <button
        className="stage-nav next"
        onClick={() => { setIdx(i => Math.min(SLIDES.length - 1, i + 1)); setProgress(0); }}
        disabled={idx === SLIDES.length - 1}
        title="Next · →"
      >
        <Icon.forward />
      </button>

      <div className="stage-progress">
        <span className="pause-state">{paused ? "paused" : (slide.duration === 0 ? "your turn" : "advancing")}</span>
        <div className="dots">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              className={"dot-link " + (i === idx ? "is-on" : i < idx ? "is-past" : "")}
              onClick={() => { setIdx(i); setProgress(0); }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <div style={{ display: "grid", gridAutoFlow: "column", gap: 12, alignItems: "center" }}>
          <div className="pl-line" style={{ width: 160 }}>
            <span className="fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="timer">{slide.duration === 0 ? "—" : `${Math.max(0, Math.ceil(((1 - progress) * slide.duration) / 1000))}s`}</span>
        </div>
      </div>
    </div>
  );
}

// ── What you missed modal ──────────────────────────────────
function WhatYouMissedModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal wym-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="titlerow">
            <span className="id mono">returns-only · signal-ranked</span>
            <span className="name">Three moments worth your eyes.</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon.close /></button>
        </div>
        <div className="modal-body">
          <div className="wym-list">
            {D.what_you_missed.map(m => (
              <div key={m.id} className="wym-row">
                <button className="play"><Icon.play /></button>
                <div className="text">
                  <div className="head">{m.headline}</div>
                  <div className="sub">{m.sub}</div>
                </div>
                <span className="dur tnum">{m.duration_s}s</span>
              </div>
            ))}
          </div>
          <p className="footnote opt-in-hint" style={{ marginTop: 14 }}>
            Queried from the ledger filtered by significance. Not curated, not editable.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Handoff card ───────────────────────────────────────────
function Handoff({ onDismiss }) {
  return (
    <div className="handoff">
      <span className="corner"><Icon.corner cls="icon-sm" /></span>
      <div>
        <div className="when">{D.handoff.when}</div>
        <div className="body">Welcome back. <em>{D.handoff.body}</em></div>
      </div>
      <button className="dismiss icon-btn" onClick={onDismiss} title="Dismiss"><Icon.close cls="icon-sm" /></button>
    </div>
  );
}

// ── App root ───────────────────────────────────────────────
function App() {
  const [focus, setFocus] = useState("items");
  const [zoom, setZoom] = useState(0.9);
  const [railTab, setRailTab] = useState("gate");
  const [focusStage, setFocusStage] = useState(2);

  // overlays
  const [openItem, setOpenItem] = useState(null); // { item, kind }
  const [openEvidence, setOpenEvidence] = useState(null);
  const [openDefense, setOpenDefense] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [cosOpen, setCosOpen] = useState(false);
  const [wymOpen, setWymOpen] = useState(false);
  const [handoffShown, setHandoffShown] = useState(true);

  const openItemHandler = (item, kind) => setOpenItem({ item, kind });

  return (
    <div className="app-shell">
      <TopBar
        status={D.status}
        cosOn={cosOpen}
        onCos={() => setCosOpen(!cosOpen)}
        onWym={() => setWymOpen(true)}
        missedCount={D.status.unread_signal_cards}
      />
      <div className="main">
        <Sidebar focus={focus} setFocus={setFocus} />
        <section className="canvas">
          <CanvasBar focus={focus} />
          <div className="canvas-body is-live-canvas">
            {focus === "items" && <ItemCanvasView onOpen={openItemHandler} />}
            {focus === "agents" && <AgentCanvasView onOpen={openItemHandler} />}
            {focus === "summary" && <ScientificSummary />}
          </div>
        </section>
        <aside className="rail">
          <div className="rail-tabs">
            <button className={"rail-tab " + (railTab === "gate" ? "is-on" : "")} onClick={() => setRailTab("gate")}>
              Gate queue <span className="count">{D.gate_queue.length}</span>
            </button>
            <button className={"rail-tab " + (railTab === "ledger" ? "is-on" : "")} onClick={() => setRailTab("ledger")}>
              Ledger <span className="count">{D.ledger.length}</span>
            </button>
            <button className={"rail-tab " + (railTab === "qa" ? "is-on" : "")} onClick={() => setRailTab("qa")}>
              Leakage / QA <span className="count">{D.qa.length}</span>
            </button>
          </div>
          <div className="rail-body">
            {railTab === "gate" && <GateQueue onReview={() => setGateOpen(true)} />}
            {railTab === "ledger" && <Ledger />}
            {railTab === "qa" && <LeakageQA />}
          </div>
        </aside>
      </div>
      <footer className="statusbar">
        <div className="group">
          <span>~/venture_lab/campaigns/camp_014/</span>
          <span>· last save 18:24:09</span>
          <span>· workers ok (3/3)</span>
        </div>
        <div className="group" style={{ justifySelf: "center" }}>
          <span className="muted">pulse · last 40 minutes</span>
          <PulseLine data={D.status.pulse} />
        </div>
        <div className="group">
          <span>significance score · 0.71 median</span>
        </div>
      </footer>

      {/* Modals & overlays */}
      <ItemDetailModal
        item={openItem?.item}
        kind={openItem?.kind}
        onClose={() => setOpenItem(null)}
        onOpenEvidence={(ev) => setOpenEvidence(ev)}
        onOpenDefense={() => { setOpenItem(null); setOpenDefense(true); }}
      />
      <EvidenceModal evidence={openEvidence} onClose={() => setOpenEvidence(null)} />
      <DefenseModal open={openDefense} onClose={() => setOpenDefense(false)} />
      <GateDecisionEditorial open={gateOpen} onClose={() => setGateOpen(false)} onOpenDossier={() => { setGateOpen(false); setDossierOpen(true); }} />
      <DossierEditorial open={dossierOpen} onClose={() => setDossierOpen(false)} />
      <ChiefOfStaffStage
        open={cosOpen}
        onClose={() => setCosOpen(false)}
        onJumpDossier={() => { setCosOpen(false); setDossierOpen(true); }}
        onJumpGate={() => { setCosOpen(false); setGateOpen(true); }}
      />
      <WhatYouMissedModal open={wymOpen} onClose={() => setWymOpen(false)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
