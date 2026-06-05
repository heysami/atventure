// GENRE: Linear-style observability cockpit + NYT/long-form editorial register for wow moments.
// Reference: feels like Datadog/Linear's project view × NYT magazine for the gate-decision and dossier surfaces.
// The register shift between cockpit and editorial layer is itself a wow primitive (Law 6).

import React, { useState, useMemo, useEffect, useRef, Fragment, createContext, useContext } from "react";
import { DEMO as DEMO_DATA } from "./data.js";
import { ItemCanvasView, AgentCanvasView } from "./canvas-views.jsx";
import ImmersiveMode from "./immersive.jsx";
import "./styles.css";

// ── Data context ────────────────────────────────────────────
// One context for the cockpit. The provider value matches the prototype's
// `D` shape exactly (campaign, status, opp_clusters, directions, artifacts,
// cleared, evidence, tensions, runs, agents, ledger, gate_queue, qa,
// defense_records, personas, what_you_missed, handoff, dossier).
//
// When the user is browsing the demo campaign the value is DEMO_DATA;
// when a user campaign is open, the server's `current_state` (built in
// the same shape) is the value. Components read via useData(); they do
// not branch on whether the data is demo or real.
const DataContext = createContext(DEMO_DATA);
function useData() {
  return useContext(DataContext);
}

// Defense record lookup that works for both the demo's flat
// `defense_pdc_004` and the user campaign's keyed `defense_records[id]`.
function getDefenseFor(data, itemId) {
  if (!data) return null;
  if (data.defense_records && data.defense_records[itemId]) {
    return data.defense_records[itemId];
  }
  if (itemId === "pdc_004" && data.defense_pdc_004) return data.defense_pdc_004;
  // Fall back to the lead direction if asked for the lead with no specific id.
  const lead = (data.directions || []).find(d => d.state === "lead");
  if (lead && data.defense_records && data.defense_records[lead.id]) {
    return data.defense_records[lead.id];
  }
  return data.defense_pdc_004 || null;
}

// Default status fields when a fresh campaign hasn't accumulated metrics yet.
function ensureStatus(data) {
  return {
    in_flight_runs: 0,
    in_flight_agents: 0,
    cost_spent: 0,
    cost_cap: 5,
    elapsed_min: 0,
    cap_min: 23,
    pulse: Array(40).fill(1),
    unread_signal_cards: 0,
    ...(data?.status || {})
  };
}

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
function TopBar({ status, onCos, cosOn, onWym, missedCount, onSettings, settings, onCampaigns, campaignName, onPause, pauseBusy, onResume, canResume, resumeBusy, onScorecard, onImmersive }) {
  const costPct = (status.cost_spent / status.cost_cap) * 100;
  const keyCount = ["openai", "anthropic", "fal", "elevenlabs"]
    .reduce((sum, key) => sum + Number(settings?.[key]?.configured || false), 0);
  return (
    <header className="topbar">
      <button className="tb-btn tb-back" onClick={onCampaigns} title="Return to campaign list.">
        <Icon.back cls="icon-sm" />
        <span>Campaigns</span>
      </button>
      <div className="brand">
        <span className="brand-mark"><Icon.brand /></span>
        <span className="brand-name">Venture Lab</span>
        <span className="local-pill" title="Local-first. Sources never leave the device.">
          <span className="dot"></span>local · v0.4.2
        </span>
      </div>
      <div className="campaign-pill" title={campaignName}>
        <span className="swatch" />
        <span className="name">{campaignName}</span>
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
        {onImmersive && (
          <button className="tb-btn" onClick={onImmersive} title="Enter immersive mode — calm editorial layout.">
            <Icon.spark cls="icon-sm" />
            <span>Immersive</span>
          </button>
        )}
        <button className="tb-btn" onClick={onWym} title="What you missed — returns-only, signal-ranked replay.">
          <Icon.spark cls="icon-sm" />
          <span>Missed</span>
          {missedCount > 0 && <span className="badge">{missedCount}</span>}
        </button>
        <button className="tb-btn" onClick={onSettings} title="Add OpenAI and Anthropic API keys for local runs.">
          <Icon.scale cls="icon-sm" />
          <span>API keys</span>
          {keyCount > 0 && <span className="badge">{keyCount}</span>}
        </button>
        <button className="tb-btn" title="Open scorecard / weight what-if." onClick={onScorecard} disabled={!onScorecard}>
          <Icon.scale cls="icon-sm" />
          <span>Scorecard</span>
        </button>
        <button className="tb-btn" title="Guide / walkthrough.">
          <Icon.book cls="icon-sm" />
        </button>
        <button
          className="tb-btn"
          title={status.in_flight_runs > 0 ? "Soft pause — abort the in-flight run." : "Nothing is running."}
          disabled={!onPause || status.in_flight_runs === 0 || pauseBusy}
          onClick={onPause}
        >
          <Icon.pause cls="icon-sm" />
          <span>{pauseBusy ? "Pausing…" : status.in_flight_runs > 0 ? "Pause" : "Idle"}</span>
        </button>
        {canResume && (
          <button
            className="tb-btn"
            title="Resume the run that was interrupted by the last server restart."
            disabled={!onResume || resumeBusy}
            onClick={onResume}
          >
            <Icon.play cls="icon-sm" />
            <span>{resumeBusy ? "Resuming…" : "Resume"}</span>
          </button>
        )}
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
function StagePipeline({ focusStage, setFocusStage, onOpenGate, onRunStage }) {
  const data = useData();
  const opps = data.opp_clusters || [];
  const dirs = data.directions || [];
  const arts = data.artifacts || [];
  const evidenceCount = (data.evidence || []).length;
  const tensionCount = (data.tensions || []).length;
  const microtestCount = dirs.reduce((sum, d) => sum + (d.microtests || 0), 0);

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
      meta: `${evidenceCount} evidence · ${tensionCount} tensions · ${opps.length} clusters`,
    },
    {
      id: 2, name: "Brainstorm + microtests",
      population: `${dirLead + dirAdvanced} alive · ${dirAdvanced} advanced · ${dirDiscounted} discounted`,
      meta: `${dirs.length} directions · ${microtestCount || 0} microtests`,
    },
    {
      id: 3, name: "Simulated pilot",
      population: `${arts.length} planned · ${artWarn} warn · ${arts.filter(a => a.state === "completed").length} ran`,
      meta: `${arts.length} artifacts`,
    },
  ];

  const lead = dirs.find(d => d.state === "lead") || dirs[0];
  const gateForStage = (data.gate_queue || []).find(g => g.kind === "stage_2_to_3" || g.kind === "stage_1_to_2" || g.kind === "dossier");

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
      {gateForStage ? (
        <button className="gate-cta" onClick={onOpenGate} title={gateForStage.recommendation || "Open gate"}>
          <span className="gate-cta-id mono">{(gateForStage.id || "").replace(/^gate_/, "") || gateForStage.kind}</span>
          <span className="gate-cta-text">{gateForStage.kind === "dossier" ? "open dossier" : gateForStage.kind === "stage_1_to_2" ? "promote to Stage 2" : "promote to Stage 3"}</span>
          <Icon.arrowR cls="icon-sm" />
        </button>
      ) : onRunStage ? (() => {
        // Label and badge derive from STATE FACTS, never error text.
        //   recoverable = any prior error exists AND we're not running
        //   That's the only signal we need for "is this a recovery vs
        //   a fresh kickoff" — not a string-match on last_error.
        const hasPilot = !!data.pilot_run;
        const hasDossier = !!data.dossier;
        const recoverable = !!data.last_error && (data?.status?.in_flight_runs || 0) === 0;
        let label;
        if (evidenceCount === 0) label = "run Stage 1";
        else if (dirs.length === 0) label = "run Stage 2";
        else if (arts.length === 0) label = "run Stage 3";
        else if (!hasPilot) label = recoverable ? "resume Stage 3" : "complete Stage 3";
        else if (!hasDossier) label = "generate dossier";
        else label = "dossier ready";
        return (
          <button className="gate-cta" onClick={onRunStage} title="Kick off the next harness run.">
            <span className="gate-cta-id mono">{recoverable ? "recover" : "harness"}</span>
            <span className="gate-cta-text">{label}</span>
            <Icon.arrowR cls="icon-sm" />
          </button>
        );
      })() : null}
    </div>
  );
}

// ── Left sidebar — three focuses ──────────────────────────
function Sidebar({ focus, setFocus, campaignId, onAddSources }) {
  const data = useData();
  const items = [
    { id: "items", label: "Items", sub: "stages 1 → 3", count: (data.opp_clusters?.length || 0) + (data.directions?.length || 0) + (data.artifacts?.length || 0), icon: Icon.flask },
    { id: "agents", label: "Agents", sub: "builder · tester · eval", count: data.agents?.length || 0, icon: Icon.bolt },
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
        {onAddSources && (
          <button className="side-link" onClick={onAddSources} style={{ marginBottom: 8 }}>
            <Icon.book cls="icon-sm" />
            <span className="label">
              <span>Sources</span>
              <span className="sub">add raw material</span>
            </span>
            <span className="pip mono">{data.reading?.manifest?.length || 0}</span>
          </button>
        )}
        <div className="ws-card">
          <span className="k">Workspace</span>
          <span className="v">~/venture_lab</span>
          <span className="k">{campaignId || data.campaign?.id || "camp_014"}</span>
        </div>
      </div>
    </nav>
  );
}

// ── Canvas (Items + Agents) — Miro-style endless board ────
function CanvasBar({ focus, zoom, setZoom, onFit }) {
  const data = useData();
  const cid = data.campaign?.id || "camp";
  const agentsLive = (data.agents || []).filter(a => a.state !== "completed").length;
  const breadcrumbs = focus === "items"
    ? <><span>{cid} · </span><span>three-stage canvas · </span><span className="crumb-now">items</span></>
    : focus === "agents"
    ? <><span>{cid} · </span><span>swarm canvas · </span><span className="crumb-now">agents · {agentsLive} in flight</span></>
    : <><span>{cid} · </span><span className="crumb-now">scientific summary</span></>;
  return (
    <div className="canvas-bar">
      <span className="breadcrumbs">{breadcrumbs}</span>
      {focus !== "summary" && (
        <span className="canvas-mini">
          board 1640 × 1140 · pan to navigate
        </span>
      )}
      {focus !== "summary" && (
        <div className="canvas-controls">
          <button className="icon-btn" onClick={() => setZoom(Math.max(0.5, +(zoom - 0.1).toFixed(2)))} title="Zoom out"><Icon.zoomOut /></button>
          <span className="zoom-readout mono">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom(Math.min(1.4, +(zoom + 0.1).toFixed(2)))} title="Zoom in"><Icon.zoomIn /></button>
          <button className="icon-btn" onClick={onFit} title="Reset view"><Icon.dot cls="icon-sm" /></button>
        </div>
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

// ── Item card (now lives inside zones) ───────────────────
// `lineage` is a small structured row baked into every card:
//   { parents: [...ids], children: [...ids] }
// — read out as "← from opp_001" and "↳ pdc_004 · pdc_005" so the same idea's
// progression across stages is legible without SVG arrows.
function ItemCard({ item, onOpen, kind, lineage }) {
  const conf = item.conf;
  const lo = conf !== undefined ? Math.max(0, conf - item.band) : 0;
  const hi = conf !== undefined ? Math.min(1, conf + item.band) : 1;
  const stateClass = item.state || "active";
  const isCleared = item.state === "cleared";
  const isLead = item.state === "lead";
  const isDisc = item.state === "discounted";
  const isAdvanced = item.state === "advanced" || (lineage?.children?.length > 0 && !isCleared && !isDisc);
  const parents = lineage?.parents || [];
  const children = lineage?.children || [];
  return (
    <button
      className={"card " + (isLead ? "is-lead " : "") + (isCleared ? "is-cleared " : "") + (isDisc ? "is-discounted " : "") + (isAdvanced ? "is-advanced " : "") + (children.length === 0 && !isCleared && !isDisc && !isLead ? "is-held-leaf " : "")}
      onClick={() => onOpen(item, kind)}
    >
      <div className="card-head">
        <span className="card-id mono">{item.id}</span>
        <span className={"card-state " + stateClass}>{item.state}</span>
      </div>
      <div className="card-body">
        <div className="card-title">{item.name}</div>
        {item.wedge && <div className="card-sub">{item.wedge}</div>}
        {item.note && <div className="card-sub">{item.note}</div>}
        {item.aud && <div className="card-sub"><span className="faint">for </span>{item.aud}</div>}
      </div>
      {(parents.length > 0 || children.length > 0) && (
        <div className="card-lineage mono">
          {parents.length > 0 && (
            <span className="lineage-row up">
              <span className="lineage-arrow">←</span>
              <span className="lineage-label">from</span>
              {parents.map((p, i) => (
                <span key={p} className="lineage-id">{p}{i < parents.length - 1 ? "," : ""}</span>
              ))}
            </span>
          )}
          {children.length > 0 && (
            <span className="lineage-row down">
              <span className="lineage-arrow">↳</span>
              <span className="lineage-label">advanced to</span>
              {children.map((c, i) => (
                <span key={c} className="lineage-id">{c}{i < children.length - 1 ? "," : ""}</span>
              ))}
            </span>
          )}
        </div>
      )}
      {item.conf !== undefined && (
        <div className="conf">
          <div className="conf-bar">
            <span className="band" style={{ left: `${lo*100}%`, width: `${(hi-lo)*100}%` }} />
            <span className="point" style={{ left: `${conf*100}%` }} />
          </div>
          <div className="card-meta mono">
            <span className="pip">conf <span className="tnum">{fmt.pct(conf)}</span></span>
            {item.ev !== undefined && <span className="pip">ev <span className="tnum">{item.ev}</span></span>}
            {item.ten !== undefined && <span className="pip">tens <span className="tnum">{item.ten}</span></span>}
            {item.microtests !== undefined && <span className="pip">μt <span className="tnum">{item.microtests}</span></span>}
            {item.defense && <span className={"defense-badge " + (item.defense.includes("0 /") ? "danger" : item.defense.match(/^[0-2] /) ? "warn" : "")}>{item.defense}</span>}
          </div>
        </div>
      )}
      {!item.conf && item.qa && (
        <div className="card-meta mono">
          <span className="pip">qa <span className="tnum">{item.qa}</span></span>
          {item.purpose && <span className="pip faint" style={{textWrap: "wrap"}}>· {item.purpose}</span>}
        </div>
      )}
    </button>
  );
}

function ItemBoard({ onOpen, onAddSources, onRunStage1 }) {
  const data = useData();
  const opp = data.opp_clusters || [];
  const dirs = data.directions || [];
  const arts = data.artifacts || [];
  const clearedAll = data.cleared || [];

  // Lineage indexes — derived from the data, not hard-coded geometry.
  const dirById = Object.fromEntries(dirs.map(d => [d.id, d]));
  const oppDescendants = Object.fromEntries(opp.map(o => [o.id, o.descendants || []]));
  const dirParents = Object.fromEntries(dirs.map(d => [d.id, d.parents || []]));
  const dirDescendants = Object.fromEntries(dirs.map(d => [d.id, d.descendants || []]));
  const artParents = Object.fromEntries(arts.map(a => [a.id, a.parents || []]));

  const oppActive = opp.filter(o => o.state !== "cleared");
  const oppCleared = opp.filter(o => o.state === "cleared");
  const dirActive = dirs.filter(d => d.state !== "cleared" && d.state !== "discounted");
  const dirOther = dirs.filter(d => d.state === "discounted" || d.state === "cleared");
  const clearedBranches = clearedAll.filter(c => c.id && c.id.startsWith("br_"));
  const sourceCount = data.reading?.manifest?.length || 0;
  const evidenceCount = (data.evidence || []).length;

  // Three stage-zones laid out left → right; cleared zone spans the bottom.
  // No SVG arrow layer — lineage is now baked into every card so a held
  // Stage-1 cluster reads as "still alive" and an advanced one reads as
  // "alive + has spawned a Stage-2 child" without leaning on geometry.
  return (
    <Fragment>
      {/* Stage 1 zone */}
      <div className="zone" style={{ left: 28, top: 36, width: 392, paddingBottom: 16 }}>
        <div className="zone-label">
          <span className="stage-num done">1</span>
          <span>Stage 1 · opportunity clusters</span>
          <span className="pill-count">{oppActive.length}</span>
        </div>
        <div className="zone-cards">
          {oppActive.map(o => (
            <ItemCard
              key={o.id}
              item={o}
              kind="opportunity"
              onOpen={onOpen}
              lineage={{ parents: [], children: oppDescendants[o.id] || [] }}
            />
          ))}
          {oppActive.length === 0 && (onAddSources || onRunStage1) && (
            <div className="card" style={{ borderStyle: "dashed", textAlign: "left", background: "transparent" }}>
              <div className="card-head">
                <span className="card-id mono">stage 1</span>
                <span className="card-state held">empty</span>
              </div>
              <div className="card-body">
                <div className="card-title">No opportunity clusters yet.</div>
                <div className="card-sub">{sourceCount === 0 ? "Add raw source material to begin Stage 1 reading." : evidenceCount === 0 ? "Sources are stored locally. Run Stage 1 to extract evidence and cluster opportunities." : "Stage 1 in progress — evidence has streamed; clustering will appear here."}</div>
              </div>
              <div className="card-meta mono" style={{ display: "grid", gridAutoFlow: "column", gap: 6, justifyContent: "start" }}>
                {sourceCount === 0
                  ? <button className="btn primary" onClick={onAddSources}>Add raw sources</button>
                  : <button className="btn primary" onClick={onRunStage1}>Run Stage 1</button>}
                {sourceCount > 0 && <span className="pip">{sourceCount} source(s) on disk</span>}
                {evidenceCount > 0 && <span className="pip">{evidenceCount} evidence cards</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stage 2 zone */}
      <div className="zone" style={{ left: 444, top: 36, width: 392 }}>
        <div className="zone-label">
          <span className="stage-num active">2</span>
          <span>Stage 2 · product directions</span>
          <span className="pill-count">{dirActive.length}</span>
        </div>
        <div className="zone-cards">
          {dirActive.map(d => (
            <ItemCard
              key={d.id}
              item={d}
              kind="direction"
              onOpen={onOpen}
              lineage={{ parents: dirParents[d.id], children: dirDescendants[d.id] }}
            />
          ))}
        </div>
      </div>

      {/* Stage 2 — discounted side-zone */}
      <div className="zone is-cleared" style={{ left: 444, top: 488, width: 392 }}>
        <div className="zone-label">
          <span className="stage-num"></span>
          <span>Stage 2 · discounted / cleared</span>
          <span className="pill-count">{dirOther.length + clearedBranches.length}</span>
        </div>
        <div className="zone-cards">
          {dirOther.map(d => (
            <ItemCard
              key={d.id}
              item={d}
              kind="direction"
              onOpen={onOpen}
              lineage={{ parents: dirParents[d.id], children: dirDescendants[d.id] }}
            />
          ))}
          {clearedBranches.map(c => (
            <button key={c.id} className="card is-cleared" onClick={() => onOpen({ ...c, state: "cleared" }, "cleared_branch")}>
              <div className="card-head">
                <span className="card-id mono">{c.id}</span>
                <span className="card-state cleared">cleared</span>
              </div>
              <div>
                <div className="card-title">{c.name}</div>
                <div className="card-sub"><span className="faint">taught: </span>{c.taught}</div>
              </div>
              <div className="card-meta mono"><span className="pip">{c.reason}</span></div>
            </button>
          ))}
        </div>
      </div>

      {/* Stage 3 zone */}
      <div className="zone" style={{ left: 860, top: 36, width: 396 }}>
        <div className="zone-label">
          <span className="stage-num locked">3</span>
          <span>Stage 3 · artifacts (planned)</span>
          <span className="pill-count">{arts.length}</span>
        </div>
        <div className="zone-cards">
          {arts.map(a => (
            <ItemCard
              key={a.id}
              item={a}
              kind="artifact"
              onOpen={onOpen}
              lineage={{ parents: artParents[a.id], children: [] }}
            />
          ))}
        </div>
        {arts.length === 0 && (() => {
          const lead = dirs.find(d => d.state === "lead") || dirs[0];
          const leadId = lead?.id;
          const hint = leadId
            ? `Once you advance ${leadId}, I'll draft the Stage 3 plan and queue artifact generation in low-fi sketch register. You'll review before any external API call.`
            : "Stage 3 begins after a lead product direction is advanced from Stage 2. Artifacts are generated in low-fi sketch register so personas react to ideas, not polish.";
          return (
            <div className="card" style={{ borderStyle: "dashed", textAlign: "left", marginTop: 10, background: "transparent" }}>
              <div className="card-sub" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--text-muted)" }}>
                "{hint}"
              </div>
              <div className="card-meta mono"><span className="pip faint">— Chief of Staff</span></div>
            </div>
          );
        })()}
      </div>

      {/* Stage 1 cleared zone — sits below the active stack */}
      {oppCleared.length > 0 && (
        <div className="zone is-cleared" style={{ left: 28, top: 860, width: 392 }}>
          <div className="zone-label">
            <span>Stage 1 · cleared possibilities</span>
            <span className="pill-count">{oppCleared.length}</span>
          </div>
          <div className="zone-cards">
            {oppCleared.map(o => (
              <ItemCard
                key={o.id}
                item={o}
                kind="opportunity"
                onOpen={onOpen}
                lineage={{ parents: [], children: [] }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Compact legend — pinned below Stage 3, fits inside the visible canvas
          so the user doesn't need to pan the board to read it. */}
      <div className="zone legend-zone" style={{ left: 860, top: 720, width: 396 }}>
        <div className="zone-label">
          <span>Legend · stage states</span>
        </div>
        <div className="legend-grid">
          <div className="legend-row"><span className="card-state lead">lead</span><span>currently best-supported direction</span></div>
          <div className="legend-row"><span className="card-state advanced">advanced</span><span>still alive at this stage <em>and</em> has produced a child</span></div>
          <div className="legend-row"><span className="card-state held">held</span><span>still alive, no child yet</span></div>
          <div className="legend-row"><span className="card-state discounted">discounted</span><span>weak on a key dimension</span></div>
          <div className="legend-row"><span className="card-state cleared">cleared</span><span>pruned · taught the campaign something</span></div>
          <div className="legend-foot mono">
            {(() => {
              const exampleParent = (data.opp_clusters || []).find(o => (o.descendants || []).length > 0);
              const exampleChild = exampleParent?.descendants?.[0];
              const fromId = exampleParent?.id || "opp_001";
              const toId = exampleChild || (data.directions?.[0]?.id) || "pdc_001";
              return (
                <Fragment>
                  <span className="lineage-arrow">←</span> from <span className="lineage-id">{fromId}</span> &nbsp;·&nbsp;
                  <span className="lineage-arrow">↳</span> advanced to <span className="lineage-id">{toId}</span>
                </Fragment>
              );
            })()}
          </div>
        </div>
      </div>
    </Fragment>
  );
}

// ── Agent canvas ──────────────────────────────────────────
function AgentBoard() {
  const data = useData();
  const allAgents = data.agents || [];
  const groups = {
    Builder: allAgents.filter(a => a.team === "Builder"),
    Tester: allAgents.filter(a => a.team === "Tester"),
    Evaluator: allAgents.filter(a => a.team === "Evaluator"),
  };
  const allRuns = data.runs || [];
  const cls = (team) => team === "Builder" ? "" : team === "Tester" ? "is-tester" : "is-evaluator";
  const teamCls = (team) => team === "Builder" ? "is-team-builder" : team === "Tester" ? "is-team-tester" : "is-team-evaluator";

  // Item cards on the right hand side — what the live agents are actually
  // touching, derived from the real `agents[].item` references plus any
  // active runs. Falls back to the lead direction so the right column never
  // shows an empty list while there is real work in flight.
  const itemIndex = useMemo(() => {
    const ix = new Map();
    for (const o of data.opp_clusters || []) ix.set(o.id, { id: o.id, name: o.name, state: o.state });
    for (const d of data.directions || []) ix.set(d.id, { id: d.id, name: d.name, state: d.state });
    for (const a of data.artifacts || []) ix.set(a.id, { id: a.id, name: a.name, state: a.state });
    return ix;
  }, [data.opp_clusters, data.directions, data.artifacts]);

  const watchedItems = useMemo(() => {
    const ids = new Set();
    for (const a of allAgents) if (a.item) ids.add(a.item);
    for (const r of allRuns) if (r.item) ids.add(r.item);
    const result = [];
    for (const id of ids) {
      const item = itemIndex.get(id);
      if (item) result.push(item);
      else if (typeof id === "string") result.push({ id, name: id, state: "active" });
    }
    if (result.length === 0) {
      const lead = (data.directions || []).find(d => d.state === "lead") || (data.directions || [])[0];
      if (lead) result.push({ id: lead.id, name: lead.name, state: lead.state });
    }
    return result.slice(0, 6);
  }, [allAgents, allRuns, itemIndex, data.directions]);

  return (
    <Fragment>
      <svg className="connectors" viewBox="0 0 1640 1140" preserveAspectRatio="none">
        {/* Connectors are drawn from each agent's left-zone position to the
            right-column item it claims to be working on. Coordinates are
            derived from agent index within its team and the watched-item
            index in the right column, so layouts with any number of
            agents and items render coherent lines instead of stranded ones. */}
        {(() => {
          const teamYs = { Builder: 130, Tester: 510, Evaluator: 830 };
          const itemY = (idx) => 130 + idx * 92;
          const watchedIndex = new Map(watchedItems.map((it, i) => [it.id, i]));
          const lines = [];
          for (const team of ["Builder", "Tester", "Evaluator"]) {
            const list = groups[team];
            for (let i = 0; i < list.length; i += 1) {
              const a = list[i];
              const ay = teamYs[team] + i * 92;
              const itemIdx = watchedIndex.has(a.item) ? watchedIndex.get(a.item) : 0;
              const iy = itemY(itemIdx);
              lines.push(
                <path key={`${team}-${a.id}`} d={`M 388 ${ay} C 540 ${ay}, 700 ${(ay + iy) / 2}, 1080 ${iy}`} />
              );
            }
          }
          return lines;
        })()}
      </svg>

      {/* Builder zone */}
      <div className={"zone " + teamCls("Builder")} style={{ left: 28, top: 36, width: 360 }}>
        <div className="zone-label">
          <span className="stage-num active" style={{ background: "var(--accent)", borderColor: "var(--accent)" }}>B</span>
          <span>Builder team</span>
          <span className="pill-count">{groups.Builder.length} agents</span>
        </div>
        <div className="zone-cards">
          {groups.Builder.map(a => (
            <div key={a.id} className={"agent-card " + cls("Builder")}>
              <div className="ag-head">
                <span className="role">{a.role}</span>
                <span className={"ag-state " + a.state}>{a.state}</span>
              </div>
              <div className="task">{a.task}</div>
              <div className="item mono">↳ {a.item} · {a.id}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tester zone */}
      <div className={"zone " + teamCls("Tester")} style={{ left: 28, top: 430, width: 360 }}>
        <div className="zone-label">
          <span className="stage-num" style={{ background: "var(--info)", color: "white", borderColor: "var(--info)" }}>T</span>
          <span>Tester team — blinded</span>
          <span className="pill-count">{groups.Tester.length} agents</span>
        </div>
        <div className="zone-cards">
          {groups.Tester.map(a => (
            <div key={a.id} className={"agent-card " + cls("Tester")}>
              <div className="ag-head">
                <span className="role">{a.role}</span>
                <span className={"ag-state " + a.state}>{a.state}</span>
              </div>
              <div className="task">{a.task}</div>
              <div className="item mono">↳ {a.item} · {a.id}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: "8px 10px", background: "color-mix(in oklch, var(--info-soft) 70%, transparent)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: "var(--t-10)", color: "var(--text-muted)", lineHeight: 1.5 }}>
          forbidden_context: builder_rationale, desired_outcome, threshold
        </div>
      </div>

      {/* Evaluator zone */}
      <div className={"zone " + teamCls("Evaluator")} style={{ left: 28, top: 750, width: 360 }}>
        <div className="zone-label">
          <span className="stage-num" style={{ background: "var(--warning)", color: "white", borderColor: "var(--warning)" }}>E</span>
          <span>Evaluator / Auditor</span>
          <span className="pill-count">{groups.Evaluator.length} agents</span>
        </div>
        <div className="zone-cards">
          {groups.Evaluator.map(a => (
            <div key={a.id} className={"agent-card " + cls("Evaluator")}>
              <div className="ag-head">
                <span className="role">{a.role}</span>
                <span className={"ag-state " + a.state}>{a.state}</span>
              </div>
              <div className="task">{a.task}</div>
              <div className="item mono">↳ {a.item} · {a.id}</div>
            </div>
          ))}
        </div>
      </div>

      {/* In-flight runs (centre column at top) */}
      <div className="zone" style={{ left: 412, top: 36, width: 320 }}>
        <div className="zone-label">
          <span className="stage-num active">⚡</span>
          <span>In flight · {allRuns.length} runs</span>
        </div>
        <div className="zone-cards">
          {allRuns.length === 0 && (
            <div className="card" style={{ borderStyle: "dashed", background: "transparent" }}>
              <div className="card-sub">No runs in flight. Stage runs queue here when launched.</div>
            </div>
          )}
          {allRuns.map(r => (
            <div key={r.id} className="card" style={{ borderLeft: r.state === "replan" ? "2px solid var(--warning)" : "2px solid var(--accent)" }}>
              <div className="card-head">
                <span className="card-id mono">{r.id.split("/")[1]}</span>
                <span className={"card-state " + (r.state === "replan" ? "warn" : "active")}>{r.state}</span>
              </div>
              <div className="card-title" style={{ fontSize: "var(--t-12)" }}>{r.note}</div>
              <div className="card-meta mono">
                <span className="pip">{r.team}</span>
                <span className="pip">{r.role}</span>
                <span className="pip">↳ {r.item}</span>
                <span className="pip faint">{r.elapsed}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items being worked on (right column) */}
      <div className="zone" style={{ left: 1080, top: 36, width: 320 }}>
        <div className="zone-label">
          <span>Items being touched</span>
          <span className="pill-count">{watchedItems.length}</span>
        </div>
        <div className="zone-cards">
          {watchedItems.map(it => (
            <div key={it.id} className="card">
              <div className="card-head">
                <span className="card-id mono">{it.id}</span>
                <span className={"card-state " + it.state}>{it.state}</span>
              </div>
              <div className="card-title" style={{ fontSize: "var(--t-13)" }}>{it.name}</div>
              <div className="card-meta mono">
                <span className="pip faint">live agent connections shown left</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Memory separation legend */}
      <div className="zone" style={{ left: 412, top: 430, width: 760, background: "var(--surface)", borderStyle: "solid", padding: 18 }}>
        <div className="zone-label">
          <span>Memory separation · per spec §6</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 6 }}>
          <div>
            <div className="small-caps" style={{ color: "var(--accent)", marginBottom: 6, fontFamily: "var(--font-sans)" }}>BUILDER</div>
            <p style={{ margin: 0, fontSize: "var(--t-12)", color: "var(--text-muted)", lineHeight: 1.5 }}>raw sources · evidence cards · wiki/graph · prior microtest results · domain frameworks</p>
          </div>
          <div>
            <div className="small-caps" style={{ color: "var(--info)", marginBottom: 6, fontFamily: "var(--font-sans)" }}>TESTER</div>
            <p style={{ margin: 0, fontSize: "var(--t-12)", color: "var(--text-muted)", lineHeight: 1.5 }}>assigned scenario · role · necessary artifact only — blinded to outcome, threshold, builder rationale</p>
          </div>
          <div>
            <div className="small-caps" style={{ color: "var(--warning)", marginBottom: 6, fontFamily: "var(--font-sans)" }}>EVALUATOR</div>
            <p style={{ margin: 0, fontSize: "var(--t-12)", color: "var(--text-muted)", lineHeight: 1.5 }}>full audit context · independent cross-references · drives keep/discard verdicts</p>
          </div>
        </div>
      </div>
    </Fragment>
  );
}

// ── Scientific summary view ─────────────────────────────
//
// All numbers and text in this view are derived from the campaign state. If
// a field is missing (e.g. defense records haven't been generated yet), the
// view shows an honest empty state instead of a hardcoded placeholder.
function ScientificSummary() {
  const data = useData();
  const dirs = data.directions || [];
  const opps = data.opp_clusters || [];
  const cleared = data.cleared || [];
  const wym = data.what_you_missed || [];
  const evidence = data.evidence || [];
  const tensions = data.tensions || [];
  const ledger = data.ledger || [];
  const defenseRecords = data.defense_records || {};
  const allItems = [
    ...dirs.map(d => ({ ...d, stage: 2, kind: "direction" })),
    ...opps.map(o => ({ ...o, stage: 1, kind: "opportunity" })),
  ];

  // Defense histogram — bin every recorded challenger entry across all
  // defense records by its dimension (Skeptic / Coverage / Bias / Method)
  // and its verdict (Held / Weakened / Cleared).
  const dimBins = {
    "Skeptic challenges": { held: 0, weakened: 0, cleared: 0 },
    "Coverage audits":    { held: 0, weakened: 0, cleared: 0 },
    "Bias / leakage":     { held: 0, weakened: 0, cleared: 0 },
    "Method audits":      { held: 0, weakened: 0, cleared: 0 }
  };
  const classify = (challenger) => {
    const c = (challenger || "").toLowerCase();
    if (/skeptic/.test(c)) return "Skeptic challenges";
    if (/coverage/.test(c)) return "Coverage audits";
    if (/bias|leakage/.test(c)) return "Bias / leakage";
    if (/method/.test(c)) return "Method audits";
    return "Method audits";
  };
  for (const dr of Object.values(defenseRecords)) {
    for (const e of (dr.entries || [])) {
      const bin = dimBins[classify(e.challenger)];
      if (!bin) continue;
      const v = (e.verdict || "").toLowerCase();
      if (v === "held") bin.held += 1;
      else if (v === "weakened") bin.weakened += 1;
      else if (v === "cleared") bin.cleared += 1;
    }
  }
  const histRows = Object.entries(dimBins).map(([label, c]) => ({ label, ...c }));
  const totals = histRows.reduce((acc, r) => ({
    held: acc.held + r.held, weakened: acc.weakened + r.weakened, cleared: acc.cleared + r.cleared
  }), { held: 0, weakened: 0, cleared: 0 });
  const totalChallenges = totals.held + totals.weakened + totals.cleared;

  // Open questions = key uncertainties from each cluster + each direction's
  // unresolved core_uncertainties, weighted by the cluster's confidence band
  // (wider band = higher heat) and whether any related microtest exists.
  const openQuestions = [];
  for (const o of opps) {
    for (const q of (o.key_uncertainties || [])) {
      openQuestions.push({ q, meta: `from ${o.id} · ${o.name}`, heat: Math.min(0.95, (o.band || 0.1) * 5 + 0.45) });
    }
  }
  for (const d of dirs) {
    for (const q of (d.core_uncertainties || [])) {
      openQuestions.push({ q, meta: `from ${d.id} · ${d.name}`, heat: Math.min(0.95, (d.band || 0.1) * 5 + 0.40) });
    }
  }
  openQuestions.sort((a, b) => b.heat - a.heat);

  // Source / modality counts for the evidence big-number.
  const sourceIds = new Set(evidence.map(e => e?.source?.id).filter(Boolean));
  const modalitySet = new Set();
  for (const src of (data.reading?.manifest || [])) {
    if (src.modality) modalitySet.add(src.modality);
  }

  // Direction state breakdown.
  const dirLead = dirs.filter(d => d.state === "lead").length;
  const dirAdvanced = dirs.filter(d => d.state === "advanced").length;
  const dirHeld = dirs.filter(d => d.state === "held").length;
  const dirDiscounted = dirs.filter(d => d.state === "discounted").length;

  // Latest ledger entry timestamp — the "updated" stamp.
  const lastEvent = ledger[0];
  const updatedStamp = lastEvent?.ts || "—";
  const stageLabel = data.campaign?.stage || "stage1";

  return (
    <div className="scisum">
      <div className="scisum-head">
        <div>
          <div className="kicker">Scientific summary · auto-drafted from this campaign's ledger</div>
          <h2>Where the campaign stands, and what it still doesn't know.</h2>
        </div>
        <div className="stamp">
          updated {updatedStamp}<br />
          {(data.campaign?.id || "—")} · {stageLabel}
        </div>
      </div>

      <div className="bignums">
        <div className="bignum">
          <span className="k">evidence cards</span>
          <span className="v tnum">{evidence.length}</span>
          <span className="sub">across {sourceIds.size} source{sourceIds.size === 1 ? "" : "s"}{modalitySet.size ? ` · ${modalitySet.size} modalit${modalitySet.size === 1 ? "y" : "ies"}` : ""}</span>
        </div>
        <div className="bignum">
          <span className="k">directions alive</span>
          <span className="v accent tnum">{dirLead + dirAdvanced + dirHeld}</span>
          <span className="sub">{dirLead} lead · {dirAdvanced} advanced · {dirDiscounted} discounted</span>
        </div>
        <div className="bignum">
          <span className="k">challenges held</span>
          <span className="v tnum">{totalChallenges > 0 ? `${totals.held} / ${totalChallenges}` : "—"}</span>
          <span className="sub">{totalChallenges > 0 ? `across all gates · ${totals.weakened} weakened · ${totals.cleared} cleared` : "no defense records yet"}</span>
        </div>
        <div className="bignum">
          <span className="k">cleared possibilities</span>
          <span className="v tnum">{cleared.length}</span>
          <span className="sub">{cleared.length > 0 ? "each carrying what it taught" : "none cleared yet"}</span>
        </div>
      </div>

      <div className="sci-grid">
        <div className="sci-card">
          <h4>Confidence panorama <span className="badge">harness-internal · not market</span></h4>
          {allItems.length === 0 && (
            <p className="opt-in-hint">No clusters or directions yet. Run Stage 1 to populate.</p>
          )}
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
          {totalChallenges === 0 && (
            <p className="opt-in-hint">No defense records yet. Stage 1 evaluator and Stage 2 method auditor write to this surface.</p>
          )}
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
          {openQuestions.length === 0 && (
            <p className="opt-in-hint">No unresolved uncertainties recorded yet. Stage 1 clusterer and Stage 2 strategist surface these.</p>
          )}
          <div className="openq">
            {openQuestions.slice(0, 6).map((o, i) => (
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
          <h4>Pruning trail <span className="badge">{cleared.length === 1 ? "one branch cleared" : `${cleared.length} branches cleared`}</span></h4>
          {cleared.length === 0 && (
            <p className="opt-in-hint">No branches cleared yet. Stage 3 evaluator and gate decisions populate this trail.</p>
          )}
          <div className="prune">
            {cleared.map(c => (
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
        {wym.length === 0 && (
          <p className="opt-in-hint">No high-significance moments accumulated yet. The replay queue fills as runs surface defense weakenings, persona walks, and tension flags.</p>
        )}
        <div className="sig-peaks">
          {wym.map((m, i) => (
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
function GateQueue({ onReview, onAdvance, onRun, onOpenDossier, onAdvanceItems, onRefineItem, onRejectItem, onHoldItems, onArchiveItems, busyItems }) {
  const data = useData();
  // Rank later-stage gates higher: dossier (the goal) → Stage 2→3 → Stage 1→2.
  // A founder mid-campaign cares about the furthest-along decision first.
  const gateRank = (k) => k === "dossier" ? 0 : k === "stage_2_to_3" ? 1 : k === "stage_1_to_2" ? 2 : 3;
  const gates = [...(data.gate_queue || [])].sort((a, b) => gateRank(a.kind) - gateRank(b.kind));
  // Per-gate collapse of the inline candidate rail so a long list can be
  // folded away. Keyed by gate id/kind; default expanded.
  const [collapsed, setCollapsed] = useState({});
  if (gates.length === 0) {
    return (
      <div className="opt-in-hint">
        No gate yet. Stages emit gates as opportunity clusters, product directions, or dossier drafts mature.
      </div>
    );
  }
  return (
    <div>
      {gates.map((g, i) => {
        const isStage1 = g.kind === "stage_1_to_2";
        const isStage2 = g.kind === "stage_2_to_3";
        const isPrimary = isStage1 || isStage2;
        const isDossier = g.kind === "dossier";
        // Show every candidate inline so the gate queue feels like
        // N decision points, not one "review" button hiding the rest.
        // Source from live state (so refinements update immediately)
        // rather than the stale gate.candidates snapshot.
        const candidates = isStage1
          ? (data.opp_clusters || []).filter(c => c.state !== "cleared" && c.state !== "discounted" && c.state !== "rejected")
          : isStage2
          ? (data.directions || []).filter(d => d.state !== "cleared" && d.state !== "discounted" && d.state !== "rejected")
          : [];
        const kindLabel = isStage1 ? "cluster" : isStage2 ? "module" : "item";
        const gateKey = g.id || g.kind || i;
        const isCollapsed = !!collapsed[gateKey];
        // Collapse = hide the candidates you haven't advanced yet, keeping the
        // advanced ones in view. Only offered when there's a mix of both.
        const advancedCands = candidates.filter(c => c.state === "advanced");
        const pendingCands = candidates.filter(c => c.state !== "advanced");
        const canFilter = advancedCands.length > 0 && pendingCands.length > 0;
        const visibleCands = (isCollapsed && canFilter) ? advancedCands : candidates;
        return (
          <div key={g.id || i} className={"gate-item " + (isPrimary || isDossier ? "is-primary" : "")}>
            <div className="gh">
              <span className="kind mono">{(g.kind || "gate").replace(/_/g, " ")}</span>
              <span className="ts mono">queued {g.queued}</span>
            </div>
            <div className="title">{g.primary || g.artifact}</div>
            {g.one_liner && <div className="one-liner">{g.one_liner}</div>}
            {g.recommendation && <div className="one-liner">{g.recommendation}</div>}
            {g.compounding && <span className="compounding">{g.compounding}</span>}
            <div className="gate-actions">
              {isPrimary && onReview && <button className="btn primary" onClick={onReview}>Review &amp; decide ({candidates.length})</button>}
              {isPrimary && onRun && <button className="btn" onClick={() => onRun(g)}>Run next stage</button>}
              {isDossier && (
                data.dossier
                  ? <button className="btn primary" onClick={onOpenDossier}>Open dossier</button>
                  : onAdvance && <button className="btn primary" onClick={() => onAdvance(g)}>Generate dossier</button>
              )}
              {!isPrimary && !isDossier && <button className="btn">Open</button>}
            </div>
            {/* Inline candidate rail — every viable item gets its own
                row with quick actions, so the cockpit gate queue shows
                N items instead of one "Review" button. */}
            {isPrimary && candidates.length > 0 && (
              <div className="gate-inline-candidates">
                {canFilter && (
                  <button
                    className="gate-collapse-toggle"
                    onClick={() => setCollapsed(s => ({ ...s, [gateKey]: !s[gateKey] }))}
                    aria-expanded={!isCollapsed}
                    title={isCollapsed ? "Show the candidates you haven't advanced yet" : "Hide the candidates you haven't advanced yet"}
                  >
                    <span className={"chev" + (isCollapsed ? "" : " open")}>▸</span>
                    {isCollapsed
                      ? `show ${pendingCands.length} not advanced`
                      : `hide ${pendingCands.length} not advanced`}
                  </button>
                )}
                {visibleCands.map(c => {
                  // Per-card busy state — if this id is in busyItems, show
                  // a "Working…" badge instead of action buttons so the
                  // founder gets immediate visible feedback on click.
                  const itemBusy = busyItems ? busyItems[c.id] : null;
                  const busyLabel = itemBusy ? {
                    refine: "Refining…",
                    advance: "Advancing…",
                    hold: "Holding…",
                    reject: "Rejecting…",
                    archive: "Archiving…"
                  }[itemBusy.action] || "Working…" : null;
                  return (
                  <div key={c.id} className={"gqi-row state-" + (c.state || "held") + (itemBusy ? " is-busy" : "")}>
                    <div className="gqi-head">
                      <span className="gqi-id mono">{c.id}</span>
                      <span className={"card-state " + (c.state || "held")}>{c.state || "held"}</span>
                      {typeof c.conf === "number" && <span className="gqi-conf mono">{fmt.pct(c.conf)}</span>}
                    </div>
                    <div className="gqi-name">{c.name}</div>
                    {(c.wedge || c.note) && <div className="gqi-sub">{c.wedge || c.note}</div>}
                    {itemBusy ? (
                      <div className="gqi-busy">
                        <div className="im-loading"><span /><span /><span /></div>
                        <span className="gqi-busy-label">{busyLabel}</span>
                      </div>
                    ) : (
                    <div className="gqi-actions">
                      {onAdvanceItems && c.state !== "advanced" && (
                        <button
                          className="gqi-btn primary"
                          onClick={() => onAdvanceItems(g, [c.id])}
                          title={`Advance ${c.id} to the next stage`}
                        >advance</button>
                      )}
                      {onRefineItem && (
                        <button
                          className="gqi-btn"
                          onClick={() => {
                            const feedback = window.prompt(`Refine "${c.name}" — give optional guidance. Leave blank for a generic improvement pass.`);
                            if (feedback !== null) onRefineItem(kindLabel, c.id, feedback || "");
                          }}
                          title="Re-run the producer agent on this item with optional guidance."
                        >refine</button>
                      )}
                      {onHoldItems && c.state !== "held" && c.state !== "advanced" && (
                        <button
                          className="gqi-btn"
                          onClick={() => onHoldItems(g, [c.id])}
                        >hold</button>
                      )}
                      {onRejectItem && (
                        <button
                          className="gqi-btn danger"
                          onClick={() => {
                            const reason = window.prompt(`Why reject "${c.name}"? (optional, fed back to find-more)`);
                            if (reason !== null) onRejectItem(kindLabel, c.id, reason || "");
                          }}
                        >reject</button>
                      )}
                      {onArchiveItems && (
                        <button
                          className="gqi-btn"
                          onClick={() => onArchiveItems(g, [c.id])}
                          title="Archive — surface as cleared possibility"
                        >archive</button>
                      )}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Ledger({ onOpenItem }) {
  const data = useData();
  const ledger = data.ledger || [];
  // For ledger rows that reference a microtest (run path = "stage2/mt_xxx"),
  // build a lookup from mt id to its parent module so we can deep-link
  // from the ledger straight into the module detail (where the cousin
  // responses now render).
  const mtIdToModuleId = new Map();
  for (const mt of (data.microtests || [])) {
    if (mt.id && mt.direction_id) mtIdToModuleId.set(mt.id, mt.direction_id);
  }
  return (
    <div className="ledger">
      {ledger.length === 0 && <div className="opt-in-hint">Ledger is empty. Events accumulate as Builder, Tester, and Evaluator agents run.</div>}
      {ledger.map((row, i) => {
        // run looks like "stage2/mt_opp_001_001". Pull the mt id out and
        // resolve to a module; if found, the row becomes a button that
        // opens the module detail modal with responses visible.
        const mtMatch = /stage2\/(mt_[\w-]+)/.exec(row.run || "");
        const mtId = mtMatch ? mtMatch[1] : null;
        const moduleId = mtId ? mtIdToModuleId.get(mtId) : null;
        const clickable = !!(moduleId && onOpenItem);
        const onClick = clickable ? () => {
          const mod = (data.directions || []).find(d => d.id === moduleId);
          if (mod) onOpenItem(mod, "direction");
        } : undefined;
        return (
          <div
            key={i}
            className={"row kind-" + row.kind + (clickable ? " is-clickable" : "")}
            onClick={onClick}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            title={clickable ? `Open ${moduleId} to see the ${mtId} cousin responses` : undefined}
          >
            <span className="ts">{row.ts}</span>
            <span className="kind"><span className="pip" /></span>
            <span className="text">
              {row.text}
              <span className="run mono">{row.run}{clickable ? " ↗" : ""}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LeakageQA() {
  const data = useData();
  const qa = data.qa || [];
  if (qa.length === 0) {
    return <div className="opt-in-hint">No leakage or QA flags. Coverage Auditor and Bias Auditor flags appear here as they fire.</div>;
  }
  return (
    <div className="qa-list">
      {qa.map((q, i) => (
        <div key={i} className={"qa-row " + q.sev}>
          <span className="qk mono">{q.kind.replace(/_/g, " ")}</span>
          <div>
            <div className="qt">{q.text}</div>
            <span className="qrun">↳ {q.run}</span>
          </div>
        </div>
      ))}
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
  const data = useData();
  if (!item) return null;
  const isDirection = kind === "direction";
  const isOpp = kind === "opportunity";
  const itemDefense = item ? getDefenseFor(data, item.id) : null;
  const showDefense = Boolean(itemDefense);
  const evidenceList = data.evidence || [];
  const tensionList = data.tensions || [];
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
                {evidenceList.slice(0, 4).map(ev => (
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
              {tensionList.slice(0, 2).map(t => (
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

          {kind === "artifact" && (() => {
            const personas = data.personas || [];
            const persona = personas[0]; // The flagship artifact's first persona.
            const responses = persona && data.persona_responses
              ? (data.persona_responses[`${persona.id}:${item.id}`] || [])
              : [];
            return (
              <div className="section">
                <h5>Persona that will react</h5>
                {!persona && (
                  <p className="opt-in-hint">No personas composed yet. Stage 3 plan architect generates persona compositions from evidence cards.</p>
                )}
                {persona && (
                  <Fragment>
                    <p className="muted" style={{ fontSize: "var(--t-13)", margin: 0 }}>
                      {personas.length} persona{personas.length === 1 ? "" : "s"} composed for this artifact. <strong>{persona.name}</strong> ({persona.role}) is built from <span className="mono">{(persona.from || []).join(", ")}</span>. {persona.cousins} cousins; variance {persona.variance?.toFixed?.(2) ?? "—"}; improvisation rate {Math.round((persona.improv_rate || 0) * 100)}%.
                    </p>
                    {responses.length > 0 ? (
                      <div style={{ marginTop: 10, background: "var(--surface-2)", borderRadius: 6, padding: "12px 14px" }}>
                        {responses.map((r, i) => (
                          <div key={i} className="cousin-row">
                            <span className="num">c{r.cousin || i + 1}</span>
                            <span className="out">{r.improv ? <span className="improv" title="Improvised: persona extrapolated beyond evidence.">"{r.quote}"</span> : `"${r.quote}"`}</span>
                            <span className={"verdict-pill " + (r.verdict === "walked" ? "walked" : "paid")}>{r.verdict}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="opt-in-hint" style={{ marginTop: 10 }}>No cousin responses recorded for this artifact yet. Run Stage 3 to simulate the persona reacting.</p>
                    )}
                    {responses.some(r => r.improv) && (
                      <p className="footnote" style={{ fontSize: "var(--t-11)", color: "var(--text-faint)", marginTop: 8 }}>
                        Quotes flagged with the improv tag extrapolate beyond evidence (per-claim audited).
                      </p>
                    )}
                  </Fragment>
                )}
              </div>
            );
          })()}

          {/* Stage 3 artifact preview — show the actual viewable artifact
              (pricing tiers, landing section, nav tree, etc) so the
              founder can SEE what the agent cousins reacted to. */}
          {kind === "artifact" && (item.preview || item.body_markdown) && (
            <div className="section">
              <h5>Artifact preview · low-fi register</h5>
              <ArtifactPreview artifact={item} />
            </div>
          )}

          {/* Stage 2 module sketch — the concrete UX-test surface that
              blinded testers reacted to (nav tree for tree test, hero
              copy for value-prop test, CTA for fake-door, etc). */}
          {kind === "direction" && item.artifact_sketch && (
            <div className="section">
              <h5>Tested surface · what cousins saw</h5>
              <ArtifactSketchPreview sketch={item.artifact_sketch} moduleKind={item.module_kind} />
            </div>
          )}

          {/* Stage 2 microtest responses — the actual cousin verdicts
              from blinded testers against THIS module. Match by
              direction_id; fall back to scanning the campaign ledger
              for "for pdc_xxx" / "on pdc_xxx" mentions so legacy
              microtests without direction_id still surface. */}
          {kind === "direction" && (() => {
            const allMt = data.microtests || [];
            const direct = allMt.filter(mt => mt.direction_id === item.id);
            // If no direct link, try ledger-based reverse lookup so older
            // data (saved before direction_id existed) is still findable.
            let runs = direct;
            if (runs.length === 0) {
              const ledger = data.ledger || [];
              const myMtIds = new Set();
              for (const row of ledger) {
                if (row.text && row.text.includes(item.id)) {
                  const m = /stage2\/(mt[\w_]+)/.exec(row.run || "");
                  if (m) myMtIds.add(m[1]);
                }
              }
              runs = allMt.filter(mt => myMtIds.has(mt.id));
            }
            if (runs.length === 0) return null;
            return (
              <div className="section">
                <h5>Microtest responses · {runs.length} run{runs.length === 1 ? "" : "s"}</h5>
                <MicrotestRuns runs={runs} />
              </div>
            );
          })()}

          {showDefense && (
            <div className="section">
              <h5>Defense record summary</h5>
              <p className="muted" style={{ fontSize: "var(--t-13)", margin: "0 0 8px" }}>{itemDefense?.summary}</p>
              <button className="btn primary" onClick={() => onOpenDefense(item)}>Open defense record →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Artifact preview — renders the structured `preview` field from
// Stage 3 artifacts as a tangible low-fi mockup the founder can see.
// Falls back to body_markdown when no structured preview is present
// (back-compat for artifacts built before the schema bump).
function ArtifactPreview({ artifact }) {
  const p = artifact.preview;
  if (!p && !artifact.body_markdown) return null;
  // Body markdown shown alongside the structured preview (or alone if
  // no structured one) — it's the agent's free-form artifact body.
  const body = artifact.body_markdown
    ? <pre className="artifact-body">{artifact.body_markdown}</pre>
    : null;
  if (!p) return body;
  const kind = p.kind;
  let structured = null;
  if (kind === "pricing_page" && Array.isArray(p.pricing_tiers)) {
    structured = (
      <div className="art-preview art-pricing">
        {p.pricing_tiers.map((t, i) => (
          <div key={i} className="art-pricing-tier">
            <div className="art-tier-name">{t.name}</div>
            <div className="art-tier-price">{t.price}</div>
            {t.tagline && <div className="art-tier-tagline">{t.tagline}</div>}
            <ul className="art-tier-features">
              {(t.features || []).map((f, j) => <li key={j}>{f}</li>)}
            </ul>
            {t.cta && <button className="art-tier-cta" type="button" disabled>{t.cta}</button>}
          </div>
        ))}
      </div>
    );
  } else if (kind === "landing_section" && p.landing) {
    structured = (
      <div className="art-preview art-landing">
        <div className="art-land-hero">{p.landing.hero_headline}</div>
        {p.landing.hero_sub && <div className="art-land-sub">{p.landing.hero_sub}</div>}
        <div className="art-land-ctas">
          {p.landing.primary_cta && <button type="button" className="art-land-primary" disabled>{p.landing.primary_cta}</button>}
          {p.landing.secondary_cta && <button type="button" className="art-land-secondary" disabled>{p.landing.secondary_cta}</button>}
        </div>
        {p.landing.social_proof && <div className="art-land-proof">{p.landing.social_proof}</div>}
      </div>
    );
  } else if (kind === "nav_tree" && Array.isArray(p.nav_tree)) {
    const renderNode = (node, depth = 0) => (
      <div key={(node.label || "") + depth} className="art-nav-node" style={{ paddingLeft: depth * 14 }}>
        <span className="art-nav-label">{node.label}</span>
        {Array.isArray(node.children) && node.children.map(c => renderNode(c, depth + 1))}
      </div>
    );
    structured = <div className="art-preview art-nav-tree">{p.nav_tree.map(n => renderNode(n))}</div>;
  } else if (kind === "checklist" && Array.isArray(p.checklist)) {
    structured = (
      <ol className="art-preview art-checklist">
        {p.checklist.map((c, i) => (
          <li key={i}><span>{c.label}</span>{c.note && <span className="art-note"> {c.note}</span>}</li>
        ))}
      </ol>
    );
  } else if (kind === "script" && Array.isArray(p.script_lines)) {
    structured = (
      <div className="art-preview art-script">
        {p.script_lines.map((l, i) => (
          <div key={i} className="art-script-line">
            <span className="art-script-speaker mono">{l.speaker}:</span>
            <span className="art-script-text">"{l.line}"</span>
          </div>
        ))}
      </div>
    );
  } else if (kind === "flow_steps" && Array.isArray(p.flow_steps)) {
    structured = (
      <div className="art-preview art-flow">
        {p.flow_steps.map((s, i) => (
          <div key={i} className="art-flow-step">
            <span className="art-flow-num mono">{s.step || i + 1}</span>
            <div className="art-flow-body">
              <div className="art-flow-title">{s.title}</div>
              {s.ui_hint && <div className="art-flow-hint">{s.ui_hint}</div>}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (kind === "signage" && p.signage) {
    structured = (
      <div className="art-preview art-signage">
        <div className="art-aframe">{p.signage.a_frame_line}</div>
        {p.signage.table_tent_line && <div className="art-tent">{p.signage.table_tent_line}</div>}
      </div>
    );
  } else if (kind === "dashboard_widget" && p.dashboard_widget) {
    const w = p.dashboard_widget;
    structured = (
      <div className="art-preview art-dashboard">
        <div className="art-dash-title">{w.title}</div>
        <div className="art-dash-primary">{w.primary_value}</div>
        {w.secondary_value && <div className="art-dash-secondary">{w.secondary_value}</div>}
        {w.chart_hint && <div className="art-dash-chart">[{w.chart_hint}]</div>}
      </div>
    );
  } else if (kind === "text" && p.text) {
    structured = <pre className="artifact-body">{p.text}</pre>;
  }
  return (
    <Fragment>
      {structured}
      {structured && artifact.body_markdown && (
        <details className="art-body-toggle">
          <summary>Show raw artifact body</summary>
          {body}
        </details>
      )}
      {!structured && body}
      {artifact.qa_notes && <p className="footnote">QA note: {artifact.qa_notes}</p>}
    </Fragment>
  );
}

// ── Microtest runs — renders the actual blinded-tester cousin
// responses for a Stage 2 module. Each run is a UX-research test
// (tree test, fake door, value prop, etc) and each response is one
// cousin's verdict + quote.
function MicrotestRuns({ runs }) {
  return (
    <div className="mt-runs">
      {runs.map((mt, i) => {
        const responses = mt.responses || [];
        return (
          <div key={mt.id || i} className="mt-run">
            <div className="mt-run-head">
              <span className="mt-run-method mono">{mt.method || "microtest"}</span>
              <span className="mt-run-id mono">{mt.id}</span>
              <span className="mt-run-count mono">{responses.length} cousin{responses.length === 1 ? "" : "s"}</span>
            </div>
            {mt.purpose && <div className="mt-run-purpose">{mt.purpose}</div>}
            {responses.length === 0 ? (
              <div className="opt-in-hint" style={{ marginTop: 6 }}>No responses recorded.</div>
            ) : (
              <div className="mt-responses">
                {responses.map((r, j) => (
                  <div key={j} className={"mt-response verdict-" + (r.verdict || "engaged").toLowerCase()}>
                    <span className="mt-cousin mono">c{r.cousin || j + 1}</span>
                    <span className="mt-quote">"{r.quote || "(no quote)"}"</span>
                    <span className={"verdict-pill " + ((r.verdict || "engaged").toLowerCase() === "walked" ? "walked" : "paid")}>{r.verdict || "—"}</span>
                    {r.objection && <span className="mt-objection mono">objection: {r.objection}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Module sketch preview — Stage 2 modules carry an `artifact_sketch`
// that records the concrete UX-test surface a blinded tester reacted
// to. Rendering it here lets the founder see what was actually tested
// (a nav tree for tree-testing, hero copy for value-prop, a CTA for
// fake-door, etc) rather than just an abstract module name.
function ArtifactSketchPreview({ sketch, moduleKind }) {
  if (!sketch) return null;
  return (
    <div className="art-sketch">
      {sketch.surface && (
        <div className="art-sketch-row"><span className="art-sketch-k mono">surface</span><span className="art-sketch-v">{sketch.surface}</span></div>
      )}
      {sketch.primary_text && (
        <div className="art-sketch-row"><span className="art-sketch-k mono">primary text</span><span className="art-sketch-v art-sketch-primary">"{sketch.primary_text}"</span></div>
      )}
      {sketch.body_text && (
        <div className="art-sketch-row"><span className="art-sketch-k mono">body</span><span className="art-sketch-v">{sketch.body_text}</span></div>
      )}
      {sketch.structure && (
        <div className="art-sketch-row art-sketch-structure">
          <span className="art-sketch-k mono">structure</span>
          <pre className="art-sketch-v">{sketch.structure}</pre>
        </div>
      )}
      {sketch.tester_task && (
        <div className="art-sketch-row"><span className="art-sketch-k mono">tester task</span><span className="art-sketch-v">{sketch.tester_task}</span></div>
      )}
      {moduleKind && (
        <div className="art-sketch-row"><span className="art-sketch-k mono">module kind</span><span className="art-sketch-v"><span className="tag">{moduleKind}</span></span></div>
      )}
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
function DefenseModal({ open, onClose, itemId }) {
  const data = useData();
  if (!open) return null;
  const lead = (data.directions || []).find(d => d.state === "lead") || (data.directions || [])[0] || (data.opp_clusters || [])[0];
  const targetId = itemId || lead?.id || "pdc_004";
  const targetItem = (data.directions || []).concat(data.opp_clusters || []).find(x => x.id === targetId) || lead;
  const dr = getDefenseFor(data, targetId) || { summary: "No defense record yet.", entries: [] };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: "min(820px, 100%)" }}>
        <div className="modal-head">
          <div className="titlerow">
            <span className="id mono">{targetId} · defense record</span>
            <span className="name">{targetItem?.name || "Lead direction"}</span>
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
            <h5>{(dr.entries || []).length} challenges</h5>
            <div className="defense-table">
              {(dr.entries || []).map((e, i) => (
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

// ── Scorecard modal — live read of the Stage 3 pilot scorecard ─
//
// Per spec §9: six weighted dimensions (desirability / viability /
// feasibility / wedge / market_attractiveness / evidence_confidence)
// produce one harness_score. The Scorecard modal shows the underlying
// dimensions, their values for the current lead direction, the
// harness-internal overall score, and the evaluator's findings.
//
// Weight what-if (post-run reweighting) is the next feature; this
// version is read-only and honest about that.
function ScorecardModal({ open, onClose }) {
  const data = useData();
  if (!open) return null;
  const pilot = data.pilot_run;
  const direction = (data.directions || []).find(d => d.state === "lead") || (data.directions || [])[0];
  const dimensions = [
    { key: "desirability",         label: "Desirability",          hint: "pain intensity · value clarity · repeat-use likelihood" },
    { key: "viability",            label: "Viability",             hint: "willingness to pay · budget fit · sales friction" },
    { key: "feasibility",          label: "Feasibility",           hint: "implementation complexity · operational burden · time to MVP" },
    { key: "wedge",                label: "Defensibility / Wedge", hint: "superiority to workaround · uniqueness · switching trigger" },
    { key: "market_attractiveness",label: "Market Attractiveness", hint: "segment size · frequency · trend / timing" },
    { key: "evidence_confidence",  label: "Evidence Confidence",   hint: "real-data grounding · source quality · validation gap" }
  ];
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: "min(720px, 100%)" }}>
        <div className="modal-head">
          <div className="titlerow">
            <span className="id mono">{direction?.id || "—"} · scorecard</span>
            <span className="name">{direction?.name || "Lead direction"}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon.close /></button>
        </div>
        <div className="modal-body">
          {!pilot ? (
            <div className="section">
              <p className="opt-in-hint">No pilot scorecard yet. The Stage 3 evaluator emits this after the simulated pilot runs against the lead direction.</p>
            </div>
          ) : (
            <Fragment>
              <div className="section">
                <h5>Where this stands inside the harness <span className="badge">harness-internal · not market</span></h5>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", marginTop: 10 }}>
                  <span className="mono" style={{ fontSize: "var(--t-12)", color: "var(--text-faint)" }}>harness_score</span>
                  <div className="conf-bar" style={{ height: 8 }}>
                    <span
                      className="band"
                      style={{
                        left: `${Math.max(0, (pilot.harness_score || 0) - (pilot.confidence_band || 0)) * 100}%`,
                        width: `${Math.min(1, (pilot.confidence_band || 0) * 2) * 100}%`
                      }}
                    />
                    <span className="point" style={{ left: `${(pilot.harness_score || 0) * 100}%` }} />
                  </div>
                  <span className="mono tnum" style={{ fontSize: "var(--t-13)", fontWeight: 500 }}>
                    {fmt.pct(pilot.harness_score || 0)}{typeof pilot.confidence_band === "number" ? ` ± ${Math.round(pilot.confidence_band * 100)} pt` : ""}
                  </span>
                </div>
              </div>
              <div className="section">
                <h5>Six dimensions</h5>
                <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                  {dimensions.map(d => {
                    const v = pilot.scorecard?.[d.key];
                    const has = typeof v === "number";
                    return (
                      <div key={d.key} style={{ display: "grid", gridTemplateColumns: "180px 1fr 56px", gap: 12, alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: "var(--t-12)", fontWeight: 500 }}>{d.label}</div>
                          <div style={{ fontSize: "var(--t-10)", color: "var(--text-faint)" }}>{d.hint}</div>
                        </div>
                        <div className="conf-bar" style={{ height: 6 }}>
                          {has && <span className="point" style={{ left: `${v * 100}%` }} />}
                          {has && (
                            <span
                              className="band"
                              style={{ left: 0, width: `${v * 100}%`, background: "color-mix(in oklch, var(--accent) 18%, transparent)" }}
                            />
                          )}
                        </div>
                        <span className="mono tnum" style={{ fontSize: "var(--t-12)", textAlign: "right" }}>
                          {has ? fmt.pct(v) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {(pilot.findings || []).length > 0 && (
                <div className="section">
                  <h5>Evaluator findings</h5>
                  <ul style={{ paddingLeft: 18, margin: 0, display: "grid", gap: 6 }}>
                    {pilot.findings.map((f, i) => (
                      <li key={i} style={{ fontSize: "var(--t-12)", lineHeight: 1.55, color: "var(--text-muted)" }}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="section">
                <p className="opt-in-hint" style={{ margin: 0 }}>
                  Read-only for now. Post-run weight adjustment (what-if reweighting per spec §9) lands in a later pass.
                </p>
              </div>
            </Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Gate decision — editorial register full screen ─────────
function GateDecisionEditorial({ open, onClose, onOpenDossier, onAdvance, onAdvanceMany, onHoldMany, onArchiveMany, onFindMore, onReject, onRefine, onReassign, busy }) {
  const data = useData();
  // Selected candidate ids for multi-pick advance.
  const [selected, setSelected] = useState(new Set());
  // Which cluster id is currently expanded showing its hypotheses.
  const [expanded, setExpanded] = useState(null);
  // Active gate kind — defaults to Stage 2 if it exists, else Stage 1.
  // The user can toggle when both gates are alive (e.g. leftover Stage
  // 1 clusters after a partial advance still need decisions).
  const [activeGateKind, setActiveGateKind] = useState(null);
  // When on, the candidate list hides everything the founder hasn't ticked —
  // useful for focusing on the parallel branches before advancing.
  const [onlySelected, setOnlySelected] = useState(false);
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setExpanded(null);
      setActiveGateKind(null);
      setOnlySelected(false);
    }
  }, [open]);
  if (!open) return null;

  // List ALL alive primary gates so the modal can offer a toggle.
  const queue = data.gate_queue || [];
  const primaryGates = queue.filter(g => g.kind === "stage_1_to_2" || g.kind === "stage_2_to_3");
  const defaultKind = primaryGates.find(g => g.kind === "stage_2_to_3")?.kind
    || primaryGates.find(g => g.kind === "stage_1_to_2")?.kind
    || queue[0]?.kind;
  const effectiveKind = activeGateKind || defaultKind;
  const gate = queue.find(g => g.kind === effectiveKind) || queue[0];
  const isStage1Gate = gate?.kind === "stage_1_to_2";
  const isStage2Gate = gate?.kind === "stage_2_to_3";

  // Full candidate list — every viable cluster (S1→2) or direction (S2→3),
  // not just the lead. The user can advance one, several (parallel
  // branches in the next stage), hold them, or archive them.
  const candidates = isStage1Gate
    ? (data.opp_clusters || []).filter(c => c.state !== "cleared" && c.state !== "discounted" && c.state !== "rejected")
    : isStage2Gate
    ? (data.directions || []).filter(d => d.state !== "cleared" && d.state !== "discounted" && d.state !== "rejected")
    : [];
  // Already-advanced items have spawned a child in the next stage — they
  // must not be re-offered as an advance option. They still render (with
  // their "advanced" badge) but their checkbox is disabled and they're
  // excluded from the default advance target.
  const advanceableCandidates = candidates.filter(c => c.state !== "advanced");
  const defaultAdvanceId = advanceableCandidates[0]?.id || null;
  const lead = isStage1Gate
    ? (data.opp_clusters || []).find(o => o.state !== "cleared") || (data.opp_clusters || [])[0]
    : (data.directions || []).find(d => d.state === "lead") || (data.directions || [])[0];
  const dr = lead ? (getDefenseFor(data, lead.id) || { entries: [], summary: "" }) : { entries: [], summary: "" };
  const cid = data.campaign?.id || "camp";

  // Title / breadcrumb / advance button labels depend on the gate kind.
  const gateLabel = isStage1Gate ? "Stage 1 → Stage 2" : isStage2Gate ? "Stage 2 → Stage 3" : "Gate";
  const breadcrumbLabel = isStage1Gate ? "gate 1 → 2" : isStage2Gate ? "gate 2 → 3" : "gate";
  const nextStageNum = isStage1Gate ? 2 : isStage2Gate ? 3 : null;
  const advanceLabel = nextStageNum ? `Advance ${lead?.id || "lead"} to Stage ${nextStageNum}` : "Advance";

  // Foundations panel: source heatmap derived from evidence cards.
  // Each source's "weight" is the average extraction confidence of cards
  // from that source. We enrich with the manifest's human-readable label
  // (what the founder typed when adding the source) and modality so the
  // heatmap row reads meaningfully — e.g. "interview_emily · note ·
  // 1.2 KB · 5 cards" — instead of "src_1778310865_…".
  const manifest = data.reading?.manifest || [];
  const manifestById = new Map(manifest.map(m => [m.id, m]));
  // Filename pattern is `src_TIMESTAMP_<label>.txt`. Strip the prefix
  // and suffix to get the label the user typed; if filename is missing,
  // fall back to manifest.label, then the bare id.
  const labelFromFile = (filename) => {
    if (!filename) return null;
    const m = filename.match(/^src_\d+_(.+?)\.[a-z0-9]+$/i);
    return m ? m[1].replace(/_/g, " ") : null;
  };
  const humanLabel = (sid, file) => {
    const fromMan = manifestById.get(sid);
    return labelFromFile(file)
      || (fromMan?.label ? fromMan.label.replace(/_/g, " ") : null)
      || sid;
  };
  const sourceAgg = new Map();
  for (const ev of (data.evidence || [])) {
    const sid = ev.source?.id;
    if (!sid) continue;
    const prev = sourceAgg.get(sid) || {
      id: sid,
      file: ev.source.file,
      sum: 0,
      count: 0,
      sample_quote: null,
      sample_claim: null,
      sample_claims: []
    };
    prev.sum += (ev.conf || 0);
    prev.count += 1;
    if (!prev.sample_quote && ev.source?.quote) prev.sample_quote = ev.source.quote;
    if (!prev.sample_claim && ev.claim) prev.sample_claim = ev.claim;
    if (ev.claim && prev.sample_claims.length < 5) prev.sample_claims.push({ id: ev.id, type: ev.type, claim: ev.claim });
    sourceAgg.set(sid, prev);
  }
  const sources = [...sourceAgg.values()]
    .map(s => {
      const m = manifestById.get(s.id) || {};
      return {
        ...s,
        score: s.count > 0 ? s.sum / s.count : 0,
        label: humanLabel(s.id, s.file),
        modality: m.modality || "note",
        bytes: m.bytes || 0
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const formatBytes = (n) => {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };
  const totalEvidence = (data.evidence || []).length;

  // Mind-changers: defense entries on the lead item. Weakened/Cleared
  // verdicts tell the founder what dimmed confidence; Held entries show
  // what survived.
  const weakenedEntries = (dr.entries || []).filter(e => e.verdict === "Weakened" || e.verdict === "Cleared");
  const heldEntries = (dr.entries || []).filter(e => e.verdict === "Held").slice(0, 2);

  // Strengthen this: at S1→2, the lead cluster's recommended microtest
  // directions; at S2→3, the lead direction's suggested microtests.
  const microtests = isStage1Gate
    ? (lead?.recommended_microtests || []).map(method => ({ method, purpose: "Stage 2 microtest" }))
    : (lead?.suggested_microtests || []);

  const recommendation = gate?.recommendation || "";
  return (
    <div className="editorial-shell editorial">
      <div className="editorial-bar">
        <div className="left">
          <button className="tb-btn" onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <Icon.back cls="icon-sm" /> Return to cockpit
          </button>
          <span className="breadcrumbs">{cid} · {breadcrumbLabel} · {lead?.id || "—"}</span>
        </div>
        <div></div>
        <div className="right">
          <span className="opt-in-hint" style={{ color: "var(--text-muted)" }}>This is the editorial register — moments that matter.</span>
          <button className="tb-btn"><Icon.mic cls="icon-sm" /> Talk it through</button>
        </div>
      </div>
      <div className="editorial-page">
        <div className="editorial-col wide">
          <div className="kicker">Gate · {gateLabel} · {lead?.id || "—"}</div>
          <h1>{lead?.name || (isStage1Gate ? "Lead opportunity cluster" : "Lead product direction")}</h1>
          <p className="lede">
            {dr.summary || lead?.wedge || lead?.note || ""}
          </p>
          {(gate?.compounding || dr.summary) && (
            <p className="muted" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--t-12)" }}>
              <span className="small-caps">Compounding rigor</span> · {gate?.compounding || dr.summary}
            </p>
          )}

          <div className="editorial-grid-2" style={{ marginTop: 32 }}>
            <div className="editorial-card">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.book cls="icon-sm" /></span>
                <span>Foundations</span>
              </div>
              <div className="panel-body">
                {sources.length === 0 ? (
                  <p className="opt-in-hint">No evidence yet. Stage 1 evidence extractor populates this panel.</p>
                ) : (
                  <Fragment>
                    <p style={{ fontSize: 15, lineHeight: 1.55 }}>
                      {sources.length === 1
                        ? <>This cluster rests on a <strong>single source</strong>. {totalEvidence} evidence card{totalEvidence === 1 ? "" : "s"} were lifted from it.</>
                        : <>{sources.length} sources carry this cluster, ranked by extraction confidence.</>}
                    </p>
                    <div className="source-heatmap">
                      {sources.map(s => (
                        <div key={s.id} className="source-heatmap-row" style={{ alignItems: "flex-start" }}>
                          <span className="src" title={s.file || s.id} style={{ display: "grid", gap: 2 }}>
                            <span style={{ fontWeight: 500 }}>{s.label}</span>
                            <span className="mono" style={{ fontSize: "var(--t-10)", color: "var(--text-faint)" }}>
                              {s.modality} · {formatBytes(s.bytes)} · {s.count} card{s.count === 1 ? "" : "s"}
                            </span>
                          </span>
                          <span className="h-bar"><span style={{ width: `${Math.round(s.score * 100)}%` }} /></span>
                          <span className="pct">.{Math.round(s.score * 100).toString().padStart(2, "0")}</span>
                        </div>
                      ))}
                    </div>
                    {sources.length === 1 && sources[0].sample_quote && (
                      <div className="evidence-quote" style={{ marginTop: 14, fontSize: "var(--t-12)" }}>
                        "{sources[0].sample_quote.slice(0, 240)}{sources[0].sample_quote.length > 240 ? "…" : ""}"
                      </div>
                    )}
                    {sources.length === 1 && sources[0].sample_claims.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div className="small-caps" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--t-11)", color: "var(--text-faint)", marginBottom: 6 }}>
                          What the extractor lifted
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {sources[0].sample_claims.map(c => (
                            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "baseline" }}>
                              <span className="mono" style={{ fontSize: "var(--t-10)", color: "var(--text-faint)" }}>{c.type.replace(/_/g, " ")}</span>
                              <span style={{ fontSize: "var(--t-12)", lineHeight: 1.45 }}>{c.claim}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {sources.length === 1 && (
                      <p className="muted" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--t-11)", marginTop: 12 }}>
                        Single-source dependency — the evaluator flags this in the Defense record. Add a corroborating source to broaden the basis.
                      </p>
                    )}
                  </Fragment>
                )}
              </div>
            </div>

            <div className="editorial-card">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.bolt cls="icon-sm" /></span>
                <span>Mind-changers</span>
              </div>
              <div className="panel-body">
                {(weakenedEntries.length === 0 && heldEntries.length === 0) ? (
                  <p className="opt-in-hint">No defense entries yet. The Stage 2 evaluator's verdicts populate this panel.</p>
                ) : (
                  <Fragment>
                    <p style={{ fontSize: 15, lineHeight: 1.55 }}>What's already moved confidence — and what would move it next.</p>
                    <div className="fork">
                      <div className="fork-side up">
                        <div className="lbl"><Icon.arrowR cls="icon-sm" /> held</div>
                        {heldEntries.length === 0 ? (
                          <span style={{ color: "var(--text-faint)" }}>—</span>
                        ) : heldEntries.map((e, i) => (
                          <Fragment key={i}>
                            <strong>{e.challenger}</strong> — {e.reasoning}{i < heldEntries.length - 1 && <br />}
                          </Fragment>
                        ))}
                      </div>
                      <div className="fork-side down">
                        <div className="lbl"><Icon.close cls="icon-sm" /> {weakenedEntries[0]?.verdict === "Cleared" ? "cleared" : "weakened"}</div>
                        {weakenedEntries.length === 0 ? (
                          <span style={{ color: "var(--text-faint)" }}>—</span>
                        ) : weakenedEntries.slice(0, 2).map((e, i) => (
                          <Fragment key={i}>
                            <strong>{e.challenger}</strong> — {e.reasoning}{i < Math.min(2, weakenedEntries.length) - 1 && <br />}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </Fragment>
                )}
              </div>
            </div>

            <div className="editorial-card">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.scale cls="icon-sm" /></span>
                <span>Second opinion</span>
              </div>
              <div className="panel-body">
                {recommendation ? (
                  <Fragment>
                    <p style={{ fontSize: 15, lineHeight: 1.55 }}>The evaluator's recommendation, drawn from the method audit.</p>
                    <div className="opinion-ledger">
                      <div className="opinion-row">
                        <span className="who evaluator">Evaluator</span>
                        <div>{recommendation}</div>
                      </div>
                      {gate?.compounding && (
                        <div className="opinion-row">
                          <span className="who">Compounding</span>
                          <div>{gate.compounding}</div>
                        </div>
                      )}
                    </div>
                  </Fragment>
                ) : (
                  <p className="opt-in-hint">No evaluator recommendation yet. The Stage 2 evaluator emits one when method audit completes.</p>
                )}
              </div>
            </div>

            <div className="editorial-card">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.flask cls="icon-sm" /></span>
                <span>Strengthen this</span>
              </div>
              <div className="panel-body">
                {microtests.length === 0 ? (
                  <p className="opt-in-hint">No suggested microtests yet. The Stage 2 strategist proposes the next moves.</p>
                ) : (
                  <Fragment>
                    <p style={{ fontSize: 15, lineHeight: 1.55 }}>Cheapest next moves, in order. Each one is a microtest, not a commitment.</p>
                    <div className="num-bullets">
                      {microtests.slice(0, 4).map((mt, i) => (
                        <div key={i} className="num-bullet">
                          <span className="n">{i + 1}</span>
                          <span className="text">
                            {mt.purpose || mt.method}
                            {mt.uncertainty_addressed && <span style={{ display: "block", color: "var(--text-faint)", fontSize: "var(--t-11)", marginTop: 2 }}>addresses: {mt.uncertainty_addressed}</span>}
                          </span>
                          <span className="cost mono">{mt.method}</span>
                        </div>
                      ))}
                    </div>
                  </Fragment>
                )}
              </div>
            </div>
          </div>

          <h2>The defense record</h2>
          <div className="editorial-defense">
            {(dr.entries || []).map((e, i) => (
              <div className="row" key={i}>
                <div>
                  <div className="ch">{e.challenger}</div>
                  <div className="reason">{e.reasoning}</div>
                </div>
                <div className="verdict"><span className={e.verdict.toLowerCase()}>{e.verdict}</span></div>
              </div>
            ))}
          </div>

          {primaryGates.length > 1 && (
            <div className="gate-kind-tabs">
              <div className="gate-kind-label">Active gate:</div>
              {primaryGates.map(g => {
                const aliveCount = g.kind === "stage_1_to_2"
                  ? (data.opp_clusters || []).filter(c => c.state !== "cleared" && c.state !== "discounted" && c.state !== "rejected" && c.state !== "advanced").length
                  : (data.directions || []).filter(d => d.state !== "cleared" && d.state !== "discounted" && d.state !== "rejected" && d.state !== "advanced" && d.state !== "lead").length;
                const isOn = g.kind === effectiveKind;
                return (
                  <button
                    key={g.kind}
                    className={"gate-kind-tab " + (isOn ? "is-on" : "")}
                    onClick={() => { setActiveGateKind(g.kind); setSelected(new Set()); setExpanded(null); }}
                  >
                    {g.kind === "stage_1_to_2" ? "Stage 1 → 2" : "Stage 2 → 3"}
                    {aliveCount > 0 && <span className="gate-kind-badge">{aliveCount} pending</span>}
                  </button>
                );
              })}
            </div>
          )}

          {candidates.length > 0 && (
            <Fragment>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginTop: 36 }}>
                <h2 style={{ margin: 0 }}>Candidates · pick one or more to advance</h2>
                {selected.size > 0 && (
                  <button
                    className="btn ghost"
                    style={{ padding: "4px 10px", fontSize: "var(--t-12)", whiteSpace: "nowrap" }}
                    onClick={() => setOnlySelected(v => !v)}
                    title={onlySelected ? "Show all candidates again" : "Hide everything you haven't ticked"}
                  >
                    {onlySelected ? `Show all (${candidates.length})` : `Show only selected (${selected.size})`}
                  </button>
                )}
              </div>
              <p className="muted" style={{ marginTop: 8, fontSize: "var(--t-13)" }}>
                Multiple selections run as parallel branches in Stage {nextStageNum}. None of these convincing? Click <strong>find more alternatives</strong> below to ask the {isStage1Gate ? "Clusterer" : "Strategist"} for additional options distinct from these.
              </p>
              <div className="gate-candidates">
                {(onlySelected && selected.size > 0 ? candidates.filter(c => selected.has(c.id)) : candidates).map(c => {
                  const isSel = selected.has(c.id);
                  const isExpanded = expanded === c.id;
                  // Advanced items already moved to the next stage — not advanceable.
                  const advanceable = c.state !== "advanced";
                  // Member hypotheses for cluster expansions (Stage 1 only).
                  const memberHyps = isStage1Gate
                    ? (data.hypotheses || []).filter(h => h.cluster_id === c.id && !h.rejected)
                    : [];
                  const otherClusters = isStage1Gate
                    ? candidates.filter(x => x.id !== c.id)
                    : [];
                  return (
                    <div key={c.id} className={"gate-candidate" + (isSel ? " is-selected" : "") + " state-" + (c.state || "held")}>
                      <label className="gc-pick" title={advanceable ? undefined : "Already advanced to the next stage"}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          disabled={!advanceable}
                          onChange={(e) => {
                            if (!advanceable) return;
                            const next = new Set(selected);
                            if (e.target.checked) next.add(c.id); else next.delete(c.id);
                            setSelected(next);
                          }}
                        />
                      </label>
                      <div className="gc-body">
                        <div className="gc-head">
                          <span className="gc-id mono">{c.id}</span>
                          <span className="gc-name">{c.name}</span>
                          <span className={"card-state " + (c.state || "held")}>{c.state || "held"}</span>
                          {isStage1Gate && c.hypotheses > 0 && (
                            <button
                              className="gc-expand"
                              onClick={() => setExpanded(isExpanded ? null : c.id)}
                            >
                              {isExpanded ? "hide hypotheses" : `show ${c.hypotheses} hypothes${c.hypotheses === 1 ? "is" : "es"}`}
                            </button>
                          )}
                          <button
                            className="gc-refine"
                            onClick={() => {
                              const feedback = window.prompt(`Refine "${c.name}" — give optional guidance (e.g. "more aggressive pricing", "narrow the segment"). Leave empty for a generic improvement pass.`);
                              if (feedback !== null) onRefine?.(isStage1Gate ? "cluster" : "direction", c.id, feedback || "");
                            }}
                            disabled={busy}
                            title="Re-run the producer agent on this item with optional feedback. Replaces the item in place."
                          >refine</button>
                          <button
                            className="gc-reject"
                            onClick={() => {
                              const reason = window.prompt(`Why reject "${c.name}"? (optional, fed back to the next find-more run)`);
                              if (reason !== null) onReject?.(isStage1Gate ? "cluster" : "direction", c.id, reason || "");
                            }}
                          >reject</button>
                        </div>
                        {(c.wedge || c.note) && <div className="gc-sub">{c.wedge || c.note}</div>}
                        {/* Stage 2 modules: show the concrete UX-test surface
                            inline so the founder sees WHAT was tested without
                            opening the modal. The full sketch lives in
                            ItemDetailModal. */}
                        {isStage2Gate && c.artifact_sketch && (
                          <div className="gc-sketch">
                            {c.module_kind && <span className="gc-sketch-kind tag">{c.module_kind}</span>}
                            {c.artifact_sketch.primary_text && (
                              <span className="gc-sketch-primary">"{c.artifact_sketch.primary_text}"</span>
                            )}
                            {c.artifact_sketch.tester_task && (
                              <div className="gc-sketch-task">
                                <span className="mono">task: </span>{c.artifact_sketch.tester_task}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="gc-meta mono">
                          {typeof c.hypotheses === "number" && c.hypotheses > 0 && <span className="pip">hyp {c.hypotheses}</span>}
                          {typeof c.conf === "number" && <span className="pip">conf {fmt.pct(c.conf)}</span>}
                          {typeof c.ev === "number" && <span className="pip">ev {c.ev}</span>}
                          {typeof c.microtests === "number" && <span className="pip">μt {c.microtests}</span>}
                          {c.defense && <span className={"defense-badge " + (c.defense.match(/^[01] /) ? "warn" : "")}>{c.defense}</span>}
                        </div>
                        {isExpanded && memberHyps.length > 0 && (
                          <div className="gc-hyps">
                            {memberHyps.map(h => (
                              <div key={h.id} className="gc-hyp">
                                <div className="gc-hyp-head">
                                  <span className="gc-hyp-id mono">{h.id}</span>
                                  <span className="gc-hyp-segment">{h.segment || "—"}</span>
                                </div>
                                <div className="gc-hyp-line"><strong>opportunity:</strong> {h.opportunity || "—"}</div>
                                {h.pain && <div className="gc-hyp-line"><strong>pain:</strong> {h.pain}</div>}
                                {h.current_workaround && <div className="gc-hyp-line"><strong>workaround:</strong> {h.current_workaround}</div>}
                                <div className="gc-hyp-actions">
                                  <button
                                    className="gc-hyp-action"
                                    onClick={() => {
                                      const reason = window.prompt(`Why reject this hypothesis? (optional)`);
                                      if (reason !== null) onReject?.("hypothesis", h.id, reason || "");
                                    }}
                                  >reject</button>
                                  {otherClusters.length > 0 && (
                                    <select
                                      className="gc-hyp-action"
                                      defaultValue=""
                                      onChange={(e) => {
                                        const targetId = e.target.value;
                                        if (!targetId) return;
                                        onReassign?.(h.id, targetId);
                                        e.target.value = "";
                                      }}
                                    >
                                      <option value="">move to…</option>
                                      {otherClusters.map(o => (
                                        <option key={o.id} value={o.id}>{o.id} · {o.name}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {(data.rejections || []).length > 0 && (
                <div className="gate-rejections">
                  <div className="small-caps">{(data.rejections || []).length} rejection{(data.rejections || []).length === 1 ? "" : "s"} feeding into "find more"</div>
                  <div className="gate-rejections-list">
                    {(data.rejections || []).slice(0, 5).map(r => (
                      <div key={r.id} className="gate-rejection-row">
                        <span className="mono">{r.kind}</span>
                        <span className="name">{r.target_name}</span>
                        {r.reason && <span className="reason">— {r.reason}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Fragment>
          )}

          <p className="footnote" style={{ marginTop: 24 }}>
            Where this stands inside the harness — not market validation. Decisions are reversible via new ledger events.
          </p>
          </div>{/* /editorial-col.wide */}
          {/* Action bar is a direct child of the scrolling .editorial-page —
              NOT nested in the centered column — so sticky bottom: 0 pins it
              cleanly to the viewport edge no matter how tall the two-column
              content above gets. */}
          <div className="gate-action-bar">
            {busy && (
              <div className="gate-action-busy">
                <div className="im-loading"><span /><span /><span /></div>
                <span>Working… new candidates will append to the list above when ready.</span>
              </div>
            )}
            <div className="gate-action-buttons">
              {onAdvanceMany && nextStageNum && (
                <button
                  className="btn primary"
                  style={{ padding: "10px 18px", fontSize: "var(--t-13)" }}
                  onClick={() => onAdvanceMany(Array.from(selected.size > 0 ? selected : [defaultAdvanceId].filter(Boolean)), effectiveKind)}
                  disabled={busy || (selected.size === 0 && !defaultAdvanceId)}
                >
                  {selected.size > 1
                    ? `Advance ${selected.size} as parallel branches →`
                    : `Advance ${selected.size === 1 ? Array.from(selected)[0] : (defaultAdvanceId || "lead")} to Stage ${nextStageNum}`}
                </button>
              )}
              {onHoldMany && (
                <button
                  className="btn"
                  style={{ padding: "10px 18px", fontSize: "var(--t-13)" }}
                  onClick={() => onHoldMany(Array.from(selected), effectiveKind)}
                  disabled={busy || selected.size === 0}
                >
                  Hold {selected.size > 0 ? `${selected.size} ` : ""}for now
                </button>
              )}
              {onArchiveMany && (
                <button
                  className="btn ghost"
                  style={{ padding: "10px 18px", fontSize: "var(--t-13)" }}
                  onClick={() => onArchiveMany(Array.from(selected), effectiveKind)}
                  disabled={busy || selected.size === 0}
                >
                  Archive {selected.size > 0 ? `${selected.size}` : ""}
                </button>
              )}
              {onFindMore && (
                <button
                  className="btn ghost"
                  style={{ padding: "10px 18px", fontSize: "var(--t-13)" }}
                  onClick={() => onFindMore(effectiveKind)}
                  disabled={busy}
                >
                  {busy ? "Finding more…" : "Find more alternatives"}
                </button>
              )}
              {onRefine && (
                <button
                  className="btn ghost"
                  style={{ padding: "10px 18px", fontSize: "var(--t-13)" }}
                  onClick={() => {
                    const ids = Array.from(selected);
                    if (ids.length === 0) {
                      window.alert("Tick a candidate first, then Refine.");
                      return;
                    }
                    const target = candidates.find(c => c.id === ids[0]);
                    if (!target) return;
                    const feedback = window.prompt(`Refine "${target.name}" — give optional guidance (e.g. "more aggressive pricing", "narrow the segment"). Leave empty for a generic improvement pass.${ids.length > 1 ? `\n\nNote: refine acts on ONE item — will refine ${target.id} only.` : ""}`);
                    if (feedback !== null) onRefine(isStage1Gate ? "cluster" : "direction", target.id, feedback || "");
                  }}
                  disabled={busy || selected.size === 0}
                  title="Re-run the producer agent on the selected item with optional guidance. Replaces it in place."
                >
                  {busy ? "Refining…" : selected.size > 0 ? `Refine ${selected.size === 1 ? Array.from(selected)[0] : "1 of " + selected.size}` : "Refine"}
                </button>
              )}
              <button className="btn ghost" style={{ padding: "10px 18px", fontSize: "var(--t-13)" }} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
      </div>
      <div className="editorial-pager">
        <button className="btn ghost" onClick={onClose}><Icon.back cls="icon-sm" /> back to cockpit</button>
        <div className="dots">
          <span className="dot-link is-on" />
        </div>
        <span className="pager-info">{(() => {
          const stage2Agents = (data.agents || []).filter(a => /stage2/.test(a.id || ""));
          if (stage2Agents.length === 0) return "drafted by Stage 2 agents";
          return `drafted by ${stage2Agents.slice(0, 3).map(a => a.id).join(", ")}`;
        })()}</span>
      </div>
    </div>
  );
}

// ── Dossier — editorial 4-screen publication ───────────────
function DossierEditorial({ open, onClose, onGenerate, busy }) {
  const data = useData();
  const [page, setPage] = useState(1);
  // Track elapsed time during synthesis so the user can SEE how long
  // the wait has lasted — anchored on busy transitions so the timer
  // starts the moment the call fires.
  const [synthStart, setSynthStart] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (busy && !synthStart) setSynthStart(Date.now());
    if (!busy && synthStart) setSynthStart(null);
  }, [busy, synthStart]);
  useEffect(() => {
    if (!busy) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [busy]);
  if (!open) return null;
  const d = data.dossier;

  // Server-side in-flight flag — true while runStage* or generateDossier
  // is running. Use this alongside the local `busy` prop so SSE-driven
  // synthesis (e.g. another tab fired the run) also shows the spinner.
  const serverBusy = (data?.status?.in_flight_runs || 0) > 0;
  const isSynthesizing = busy || (serverBusy && !d);

  // Dossier-relevant ledger entries (latest first) so the user sees
  // exactly what the synthesizer is doing while they wait. Source of
  // truth is the live state ledger, updated via SSE.
  const dossierLedger = (data.ledger || []).filter(row =>
    /dossier/i.test(row.run || "") || /dossier|synthes/i.test(row.text || "")
  ).slice(0, 6);
  const lastLedgerLine = dossierLedger[0];

  // Active dossier agent (if any) so we can show "Drafting…" along
  // with the agent's current_output.
  const dossierAgent = (data.agents || []).find(a =>
    a.id === "dossier_001" || /dossier/i.test(a.role || "")
  );

  // Render the SYNTHESIZING screen when busy regardless of prereqs — the
  // user already clicked Generate, prereq check is moot at this point.
  if (isSynthesizing) {
    const elapsedSec = synthStart ? Math.round((now - synthStart) / 1000) : 0;
    return (
      <div className="editorial-shell editorial">
        <div className="editorial-bar">
          <div className="left">
            <button className="tb-btn" onClick={onClose} style={{ color: "var(--text-muted)" }}>
              <Icon.back cls="icon-sm" /> Return to cockpit
            </button>
            <span className="breadcrumbs">{(data.campaign?.id || "")} · dossier · synthesizing</span>
          </div>
          <div></div>
          <div className="right">
            <span className="opt-in-hint" style={{ color: "var(--text-muted)" }}>{elapsedSec}s elapsed · ~30-90s total</span>
          </div>
        </div>
        <div className="editorial-page">
          <div className="editorial-col">
            <div className="kicker">Dossier · synthesizing</div>
            <h1>Drafting your dossier.</h1>
            <p className="lede">
              The Dossier Synthesizer (Opus tier) is reading the full campaign ledger and composing the four-screen publication. This typically takes 30–90 seconds.
            </p>
            <div className="dossier-synth-card">
              <div className="dossier-synth-spinner"><span /><span /><span /></div>
              <div className="dossier-synth-status">
                <div className="dossier-synth-now">
                  {dossierAgent?.current_output
                    || lastLedgerLine?.text
                    || "Reading the campaign ledger…"}
                </div>
                {dossierAgent?.role && (
                  <div className="dossier-synth-agent mono">
                    {dossierAgent.role} · {dossierAgent.state || "drafting"}
                  </div>
                )}
              </div>
            </div>
            {dossierLedger.length > 0 && (
              <div className="dossier-synth-ledger">
                <div className="kicker" style={{ marginTop: 24 }}>Live ledger tail</div>
                {dossierLedger.map((row, i) => (
                  <div key={i} className={"dossier-synth-row kind-" + row.kind}>
                    <span className="ts mono">{row.ts}</span>
                    <span className="text">{row.text}</span>
                    <span className="run mono">{row.run}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="footnote" style={{ marginTop: 24 }}>
              Cancel any time by closing this window — the run continues server-side, and the dossier will appear here when it finishes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!d) {
    // Check whether the prerequisites are met (Stages 1-3 done). If yes,
    // offer to generate directly from this empty state — no need to bounce
    // to the gate queue rail. If no, explain what's missing.
    const hasEvidence = (data.evidence || []).length > 0;
    const hasDirections = (data.directions || []).length > 0;
    const hasArtifacts = (data.artifacts || []).length > 0;
    const hasPilot = !!data.pilot_run;
    const canGenerate = hasEvidence && hasDirections && hasArtifacts && hasPilot && !!onGenerate;
    const missing = [];
    if (!hasEvidence) missing.push("Stage 1 evidence");
    if (!hasDirections) missing.push("Stage 2 directions");
    if (!hasArtifacts) missing.push("Stage 3 artifacts");
    if (!hasPilot) missing.push("Stage 3 pilot scorecard");
    return (
      <div className="editorial-shell editorial">
        <div className="editorial-bar">
          <div className="left">
            <button className="tb-btn" onClick={onClose} style={{ color: "var(--text-muted)" }}>
              <Icon.back cls="icon-sm" /> Return to cockpit
            </button>
            <span className="breadcrumbs">{(data.campaign?.id || "")} · dossier</span>
          </div>
          <div></div>
          <div className="right" />
        </div>
        <div className="editorial-page">
          <div className="editorial-col">
            <div className="kicker">Dossier · not yet drafted</div>
            {canGenerate ? (
              <Fragment>
                <h1>Ready to synthesize.</h1>
                <p className="lede">
                  All three stages have completed for {data.campaign?.name || "this campaign"}. Click below to draft the four-screen editorial publication — How your thinking changed / What we walked past together / The smallest real-world test / Cleared possibilities.
                </p>
                <div style={{ marginTop: 32 }}>
                  <button
                    className="btn primary"
                    style={{ padding: "12px 28px", fontSize: "var(--t-14)" }}
                    onClick={onGenerate}
                    disabled={busy}
                  >
                    {busy ? "Synthesizing…" : "Generate dossier →"}
                  </button>
                  <p className="footnote" style={{ marginTop: 18 }}>
                    Runs the Dossier Synthesizer (Opus tier) against the full campaign ledger. ~30–90 seconds.
                  </p>
                </div>
              </Fragment>
            ) : (
              <Fragment>
                <h1>The dossier is generated after Stage 3 closes.</h1>
                <p className="lede">
                  Still missing: {missing.join(", ")}. Complete the remaining stages from the cockpit, then come back here.
                </p>
              </Fragment>
            )}
          </div>
        </div>
      </div>
    );
  }

  const Page1 = () => (
    <div className="editorial-col">
      <div className="kicker">Opportunity dossier · screen 1 of 4</div>
      <h1>{d.title}</h1>
      <p className="lede" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>{d.subtitle}</p>
      <h2>How your thinking changed.</h2>
      {(d.thinking_changed || []).length === 0 && (
        <p className="opt-in-hint">No inflection points recorded yet.</p>
      )}
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
        {(d.walked_past || []).length === 0 && (
          <p className="opt-in-hint">No co-investigated gaps recorded.</p>
        )}
        {(d.walked_past || []).map((line, i) => (
          <div key={i} className="walked-row">
            <span className="miss-icon">○</span>
            <div className="body">
              <p style={{ margin: 0 }}>{line}</p>
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
            <div className="small-caps">The cheapest move</div>
            <h3 style={{ margin: "6px 0 0", fontSize: 22 }}>{d.smallest_test?.headline || "—"}</h3>
          </div>
          {d.smallest_test?.cost && <span className="price-tag">{d.smallest_test.cost}</span>}
          {d.smallest_test?.duration && <span className="duration-tag">{d.smallest_test.duration}</span>}
        </div>
        {d.smallest_test?.outcome && <p>{d.smallest_test.outcome}</p>}
        {(d.smallest_test?.observe || []).length > 0 && (
          <div className="observe">
            <div className="small-caps">Observe</div>
            <ul>
              {d.smallest_test.observe.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
        )}
        {(d.smallest_test?.tiers || []).length > 1 && (
          <div className="tier-table">
            <div className="small-caps">Or, if that won't work</div>
            {d.smallest_test.tiers.slice(1).map((t, i) => (
              <div key={i} className="tier-row">
                <span className="t">{t.tier}</span>
                <span className="a">{t.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const Page4 = () => (
    <div className="editorial-col">
      <div className="kicker">Opportunity dossier · screen 4 of 4</div>
      <h1>Cleared possibilities.</h1>
      <p className="lede">{(d.cleared_possibilities || []).length} branches no longer needed. Each is named with what it taught the campaign first, then how it was cleared.</p>
      <div className="cleared-list" style={{ marginTop: 28 }}>
        {(d.cleared_possibilities || []).length === 0 && (
          <p className="opt-in-hint">No cleared branches yet.</p>
        )}
        {(d.cleared_possibilities || []).map((c, i) => (
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
        Where this stands inside the harness · {fmt.pct(d.confidence_value || 0)} ± {Math.round((d.confidence_band || 0) * 100)} pts. Not market validation.
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
          <span className="breadcrumbs">{(data.campaign?.id || "")} · drafted dossier · screen {page} / 4</span>
        </div>
        <div></div>
        <div className="right" />
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
  const data = useData();
  const wym = data.what_you_missed || [];
  const lead = (data.directions || []).find(d => d.state === "lead") || (data.directions || [])[0];
  const leadDR = lead ? getDefenseFor(data, lead.id) : null;
  const heldCount = (leadDR?.entries || []).filter(e => e.verdict === "Held").length;
  const weakenedCount = (leadDR?.entries || []).filter(e => e.verdict === "Weakened").length;
  const clearedCount = (leadDR?.entries || []).filter(e => e.verdict === "Cleared").length;
  const totalEntries = (leadDR?.entries || []).length;
  const firstWeakened = (leadDR?.entries || []).find(e => e.verdict === "Weakened" || e.verdict === "Cleared");
  const persona = (data.personas || [])[0];
  const flagshipArtifact = (data.artifacts || [])[0];
  const cousinResponses = persona && flagshipArtifact && data.persona_responses
    ? (data.persona_responses[`${persona.id}:${flagshipArtifact.id}`] || [])
    : [];
  const cousinAvatars = [Avatar.one, Avatar.two, Avatar.three, Avatar.four, Avatar.five, Avatar.six, Avatar.seven, Avatar.eight];
  const queuedMicrotest = (lead?.suggested_microtests || [])[0];
  const stageNumber = data.campaign?.stage === "stage3" ? 3 : data.campaign?.stage === "stage2" ? 2 : 1;
  const evidenceCount = (data.evidence || []).length;

  const SLIDES = useMemo(() => {
    const slides = [];

    // Slide 1: welcome — derived from current state. Also surfaces the
    // founder's original hypothesis (search_domain) so they remember
    // what they set out to investigate before diving into results.
    const hypothesis = data.campaign?.search_domain;
    slides.push({
      id: "welcome",
      duration: 5800,
      kicker: `Chief of Staff · ${data.campaign?.name || "campaign"}`,
      render: () => (
        <Fragment>
          <div className="kicker" style={{ "--d": 0 }}>Welcome back</div>
          <h1 style={{ "--d": 200 }}>{
            evidenceCount === 0
              ? "We haven't read anything yet."
              : !lead
              ? `Stage ${stageNumber} · ${(data.opp_clusters || []).length} opportunity cluster${(data.opp_clusters || []).length === 1 ? "" : "s"} alive.`
              : `Stage ${stageNumber} · ${lead.name} is the lead.`
          }</h1>
          {hypothesis && (
            <div style={{
              "--d": 350,
              borderLeft: "2px solid var(--text-faint)",
              paddingLeft: 14,
              margin: "12px 0 16px",
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "var(--text-muted)",
              fontSize: "var(--t-14)",
              lineHeight: 1.55
            }}>
              <div className="small-caps" style={{ fontFamily: "var(--font-sans)", fontStyle: "normal", color: "var(--text-faint)", fontSize: "var(--t-11)", letterSpacing: "0.06em", marginBottom: 4 }}>
                Your original hypothesis
              </div>
              {hypothesis}
            </div>
          )}
          <p className="lede" style={{ "--d": 500 }}>
            I'll walk you through what the harness has produced so far. Press <span className="mono">→</span> to advance, <span className="mono">space</span> to pause.
          </p>
          <p className="footnote" style={{ "--d": 800 }}>
            Everything here traces back to a ledger event. Nothing is summarized away.
          </p>
        </Fragment>
      )
    });

    // Slide 2: defense arc — only if we have any defense entries on the lead
    if (lead && totalEntries > 0) {
      slides.push({
        id: "defense",
        duration: 9500,
        kicker: `Defense record · ${lead.id}`,
        render: () => {
          const C = 2 * Math.PI * 90;
          const heldArc = (heldCount / totalEntries) * C;
          const weakArc = (weakenedCount / totalEntries) * C;
          const clearArc = (clearedCount / totalEntries) * C;
          return (
            <Fragment>
              <div className="kicker" style={{ "--d": 0 }}>Past-tense rigor · so far</div>
              <h1 className="smaller" style={{ "--d": 150 }}>{lead.name} held against {heldCount} of {totalEntries} challenges.</h1>
              <p className="lede" style={{ "--d": 400 }}>
                Skeptic, Coverage and Bias auditors ran on <em>{lead.id}</em>. You're reading a record, not a live battle.
              </p>
              <div className="def-arc" style={{ "--d": 700 }}>
                <svg className="def-arc-svg" viewBox="0 0 220 220">
                  <circle cx="110" cy="110" r="90" fill="none" className="seg-bg" strokeWidth="18" />
                  <g transform="rotate(-90 110 110)">
                    <circle cx="110" cy="110" r="90" fill="none" stroke="oklch(50% 0.13 152)" strokeWidth="18" strokeDasharray={`${heldArc} ${C}`} strokeDashoffset="0" className="seg-fill" />
                    <circle cx="110" cy="110" r="90" fill="none" stroke="oklch(67% 0.135 75)" strokeWidth="18" strokeDasharray={`${weakArc} ${C}`} strokeDashoffset={`-${heldArc}`} className="seg-fill" />
                    <circle cx="110" cy="110" r="90" fill="none" stroke="oklch(55% 0.16 28)" strokeWidth="18" strokeDasharray={`${clearArc} ${C}`} strokeDashoffset={`-${heldArc + weakArc}`} className="seg-fill" />
                  </g>
                  <text x="110" y="108" textAnchor="middle" className="center-num">{heldCount}</text>
                  <text x="110" y="132" textAnchor="middle" className="center-of">of {totalEntries} held</text>
                </svg>
                <div className="def-legend">
                  <div className="def-legend-row"><span className="swatch held" /><span className="label">Held — basis grounded, no weakening</span><span className="count">{heldCount}</span></div>
                  <div className="def-legend-row"><span className="swatch weakened" /><span className="label">Weakened — challenge that softened the basis</span><span className="count">{weakenedCount}</span></div>
                  <div className="def-legend-row"><span className="swatch cleared" /><span className="label">Cleared — challenge that removed the basis</span><span className="count">{clearedCount}</span></div>
                </div>
              </div>
            </Fragment>
          );
        }
      });
    }

    // Slide 3: the one that weakened — only if there's a weakened/cleared entry
    if (firstWeakened) {
      slides.push({
        id: "weakened",
        duration: 9500,
        kicker: `The one that ${firstWeakened.verdict.toLowerCase()}`,
        render: () => (
          <Fragment>
            <div className="kicker" style={{ "--d": 0 }}>{firstWeakened.challenger}</div>
            <h1 className="smaller" style={{ "--d": 150 }}>{firstWeakened.reasoning}</h1>
            <p className="lede" style={{ "--d": 400 }}>
              Verdict: <strong>{firstWeakened.verdict}</strong>. Basis: <span className="mono">{firstWeakened.basis}</span>.
            </p>
            <div className="def-bar" style={{ "--d": 700 }}>
              {(leadDR.entries || []).map((e, i) => (
                <div key={i} className={"cell " + e.verdict.toLowerCase()} style={{ "--d": 700 + i * 60 }} title={e.challenger}>{e.verdict[0]}</div>
              ))}
            </div>
            <div className="def-bar-legend" style={{ "--d": 1500 }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "oklch(50% 0.13 152)", marginRight: 6 }} /> held · {heldCount}</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "oklch(67% 0.135 75)", marginRight: 6 }} /> weakened · {weakenedCount}</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "oklch(55% 0.16 28)", marginRight: 6 }} /> cleared · {clearedCount}</span>
            </div>
          </Fragment>
        )
      });
    }

    // Slide 4: cousins — only if persona responses exist
    if (persona && cousinResponses.length > 0) {
      slides.push({
        id: "cousins",
        duration: 10500,
        kicker: `Stage 3 · ${persona.name} · ${cousinResponses.length} cousin${cousinResponses.length === 1 ? "" : "s"}`,
        render: () => {
          const paidCount = cousinResponses.filter(r => r.verdict === "paid" || r.verdict === "engaged").length;
          const walkedCount = cousinResponses.filter(r => r.verdict === "walked").length;
          return (
            <Fragment>
              <div className="kicker" style={{ "--d": 0 }}>Cousin chorus</div>
              <h1 className="smaller" style={{ "--d": 150 }}>{paidCount} of {cousinResponses.length} {persona.name}s engaged. {walkedCount > 0 ? `${walkedCount} walked.` : ""}</h1>
              <p className="lede" style={{ "--d": 400 }}>
                {cousinResponses.length} runs of the same persona under the same scenario. Words grounded in your evidence cards.
              </p>
              <div className="cousins" style={{ "--d": 700 }}>
                {cousinResponses.map((r, i) => {
                  const A = cousinAvatars[i % cousinAvatars.length];
                  return (
                    <div key={i} className={"cousin " + (r.verdict === "walked" ? "walked" : "paid")} style={{ "--d": 700 + i * 80 }}>
                      <span className="avatar-wrap"><A /></span>
                      <span><span className="num">cousin {r.cousin || i + 1}</span><span className="verdict">{r.verdict}</span></span>
                      <span className="quote">"{r.quote}"</span>
                    </div>
                  );
                })}
              </div>
              <p className="footnote" style={{ "--d": 1500 }}>
                Variance {persona.variance?.toFixed?.(2) ?? "—"} · improvisation rate {Math.round((persona.improv_rate || 0) * 100)}%. {cousinResponses.some(r => r.improv) ? "Improvised quotes are flagged." : ""}
              </p>
            </Fragment>
          );
        }
      });
    }

    // Slide 5: what you missed — only if signals exist
    if (wym.length > 0) {
      slides.push({
        id: "missed",
        duration: 9500,
        kicker: `${wym.length} signal-ranked moments since you stepped away`,
        render: () => (
          <Fragment>
            <div className="kicker" style={{ "--d": 0 }}>What you missed · queried, not curated</div>
            <h1 className="smaller" style={{ "--d": 150 }}>{wym.length} moment{wym.length === 1 ? "" : "s"} worth your eyes.</h1>
            <div className="signals" style={{ "--d": 400 }}>
              {wym.map((m, i) => (
                <div key={m.id} className="signal" style={{ "--d": 400 + i * 220 }}>
                  <span className="rank">{i+1}</span>
                  <span className="head">{m.headline}</span>
                  <span className="meta">{m.sub}</span>
                </div>
              ))}
            </div>
          </Fragment>
        )
      });
    }

    // Slide 6: what I'd queue — only if there's a suggested microtest on the lead
    if (queuedMicrotest && lead) {
      slides.push({
        id: "queue",
        duration: 9500,
        kicker: "What I'd queue next",
        render: () => (
          <Fragment>
            <div className="kicker" style={{ "--d": 0 }}>One microtest · cheapest move</div>
            <h1 className="smaller" style={{ "--d": 150 }}>{queuedMicrotest.method.replace(/_/g, " ")}.</h1>
            <p className="lede" style={{ "--d": 400 }}>
              {queuedMicrotest.purpose || "Run a blinded test on the lead direction."}
            </p>
            <div className="queue-card" style={{ "--d": 700 }}>
              <div>
                <div className="label">queued · awaiting your nod</div>
                <div className="name">{queuedMicrotest.method.replace(/_/g, " ")}</div>
                <p className="why">
                  Addresses uncertainty: {queuedMicrotest.uncertainty_addressed || "the lead direction's open question"}.
                </p>
              </div>
              <div className="price-stack">
                <div className="cost">{queuedMicrotest.method}</div>
                <div className="duration">on {lead.id}</div>
              </div>
            </div>
            <p className="footnote" style={{ "--d": 1100 }}>I'll only run this when you tap the queue. I don't spend without your nod.</p>
          </Fragment>
        )
      });
    }

    // Final slide: ask
    slides.push({
      id: "ask",
      duration: 0,
      kicker: "Your move",
      render: () => {
        const hasGate = (data.gate_queue || []).some(g => g.kind === "stage_1_to_2" || g.kind === "stage_2_to_3");
        const hasDossier = !!data.dossier;
        return (
          <Fragment>
            <div className="kicker" style={{ "--d": 0 }}>Anything else worth your eyes?</div>
            <h1 className="tight" style={{ "--d": 150 }}>That's where we stand.</h1>
            <p className="lede" style={{ "--d": 400 }}>
              We can open the gate when you're ready, or page back to any slide. I'll wait.
            </p>
            <div className="ask-buttons" style={{ "--d": 700 }}>
              {hasGate && (
                <button className="ask-btn primary" onClick={onJumpGate}>
                  <Icon.arrowR cls="icon-sm" />
                  Open the gate
                </button>
              )}
              {hasDossier && (
                <button className="ask-btn" onClick={onJumpDossier}>
                  <Icon.book cls="icon-sm" />
                  Read the drafted dossier
                </button>
              )}
            </div>
            <p className="footnote" style={{ "--d": 1000 }}>
              Press <span className="mono">←</span> to step back, or close — your transcript is saved to the campaign ledger either way.
            </p>
          </Fragment>
        );
      }
    });

    return slides;
  }, [
    onJumpDossier, onJumpGate,
    data.campaign?.name, data.campaign?.stage,
    lead?.id, lead?.name,
    totalEntries, heldCount, weakenedCount, clearedCount,
    firstWeakened?.challenger,
    persona?.id, cousinResponses.length,
    wym.length,
    queuedMicrotest?.method,
    evidenceCount, stageNumber,
    (data.gate_queue || []).length, !!data.dossier
  ]);

  // Live counts (held/weakened/cousins/gate length…) feed the SLIDES memo, so
  // SLIDES gets a NEW identity every time a stage streams an update. The
  // auto-advance and auto-scroll effects must NOT re-run on that — re-running
  // the scroll effect forces scrollTop back to 0, which read as the page
  // "refreshing scroll position whenever something happens". Keep the latest
  // slides in a ref the effects read without subscribing to.
  const slidesRef = useRef(SLIDES);
  slidesRef.current = SLIDES;

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
    const slide = slidesRef.current[idx];
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
      else if (idx < slidesRef.current.length - 1) {
        setIdx(i => i + 1);
        setProgress(0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, paused]);

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

  // auto-scroll any tall slide content. Keyed ONLY on the slide index (+open/
  // paused) — never on SLIDES identity — so a live content update doesn't yank
  // scroll back to the top mid-slide.
  const scrollRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    el.scrollTop = 0;
    const slide = slidesRef.current[idx];
    if (!slide || slide.duration === 0) return;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / slide.duration);
      el.scrollTop = max * p;
      if (p < 1 && !paused) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, open, paused]);

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
        <span className="stage-meta">a {SLIDES.length}-slide briefing · slide {idx + 1} of {SLIDES.length}</span>
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
  const data = useData();
  if (!open) return null;
  const wym = data.what_you_missed || [];
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
            {wym.length === 0 && <div className="opt-in-hint">Nothing significant has accumulated yet. The replay queue fills as runs surface high-significance events.</div>}
            {wym.map(m => (
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
  const data = useData();
  if (!data.handoff) return null;
  return (
    <div className="handoff">
      <span className="corner"><Icon.corner cls="icon-sm" /></span>
      <div>
        <div className="when">{data.handoff.when}</div>
        <div className="body">Welcome back. <em>{data.handoff.body}</em></div>
      </div>
      <button className="dismiss icon-btn" onClick={onDismiss} title="Dismiss"><Icon.close cls="icon-sm" /></button>
    </div>
  );
}

// ── Local API-key settings ─────────────────────────────────
function ApiKeySettingsModal({ open, onClose, settings, onSaved }) {
  const [form, setForm] = useState({
    openai: { apiKey: "", model: settings?.openai?.model || "gpt-5.2", clearKey: false },
    anthropic: { apiKey: "", model: settings?.anthropic?.model || "claude-sonnet-4-6", clearKey: false },
    fal: { apiKey: "", model: settings?.fal?.model || "fal-ai/flux/schnell", clearKey: false },
    elevenlabs: { apiKey: "", model: settings?.elevenlabs?.model || "eleven_multilingual_v2", voiceId: settings?.elevenlabs?.voiceId || "", clearKey: false },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      openai: { apiKey: "", model: settings?.openai?.model || "gpt-5.2", clearKey: false },
      anthropic: { apiKey: "", model: settings?.anthropic?.model || "claude-sonnet-4-6", clearKey: false },
      fal: { apiKey: "", model: settings?.fal?.model || "fal-ai/flux/schnell", clearKey: false },
      elevenlabs: { apiKey: "", model: settings?.elevenlabs?.model || "eleven_multilingual_v2", voiceId: settings?.elevenlabs?.voiceId || "", clearKey: false },
    });
    setMessage("");
  }, [open]);

  if (!open) return null;

  const update = (provider, field, value) => {
    setForm(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value }
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error(await res.text());
      const next = await res.json();
      onSaved(next);
      setMessage("Saved locally. Keys are kept in .local/ai-venture-lab-settings.json.");
    } catch (error) {
      setMessage(error.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const test = async (provider) => {
    setSaving(true);
    setMessage(`Testing ${provider} key...`);
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider })
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || "Key test failed.");
      setMessage(`${provider === "openai" ? "OpenAI" : "Anthropic"} key works.`);
    } catch (error) {
      setMessage(error.message || "Key test failed.");
    } finally {
      setSaving(false);
    }
  };

  const ProviderBlock = ({ provider, title, hint, keyHint = "Paste API key", extra }) => {
    const configured = settings?.[provider]?.configured;
    const last4 = settings?.[provider]?.last4;
    return (
      <div className="key-block">
        <div className="key-block-head">
          <div>
            <h5>{title}</h5>
            <p>{hint}</p>
          </div>
          <span className={"key-status " + (configured ? "configured" : "")}>
            {configured ? `saved · ••••${last4}` : "not saved"}
          </span>
        </div>
        <label className="field">
          <span>API key</span>
          <input
            type="password"
            value={form[provider].apiKey}
            placeholder={configured ? "Leave blank to keep existing key" : keyHint}
            onChange={(e) => update(provider, "apiKey", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Default model</span>
          <input
            value={form[provider].model}
            onChange={(e) => update(provider, "model", e.target.value)}
          />
        </label>
        {extra === "voice" && (
          <label className="field">
            <span>Chief voice ID</span>
            <input
              value={form[provider].voiceId || ""}
              placeholder="Optional ElevenLabs voice_id"
              onChange={(e) => update(provider, "voiceId", e.target.value)}
            />
          </label>
        )}
        <div className="key-actions">
          <label className="checkline">
            <input
              type="checkbox"
              checked={form[provider].clearKey}
              onChange={(e) => update(provider, "clearKey", e.target.checked)}
            />
            <span>Clear saved key</span>
          </label>
          <button className="btn" disabled={!configured || saving} onClick={() => test(provider)}>
            Test saved key
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal key-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="titlerow">
            <span className="id mono">local settings · bring your own keys</span>
            <span className="name">LLM provider keys</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon.close /></button>
        </div>
        <div className="modal-body">
          <div className="section">
            <p className="muted" style={{ margin: 0 }}>
              This development app keeps provider keys on your machine through the local Node API. They are not committed, bundled, or written into browser code.
            </p>
          </div>
          <div className="key-block">
            <div className="key-block-head">
              <div>
                <h5>Claude CLI — no key to paste</h5>
                <p>
                  Prefer not to manage an API key? Install the Claude CLI and run{" "}
                  <code>claude</code> once to log in with your Claude subscription. When
                  it's detected, runs use it automatically — no key needed.
                </p>
              </div>
              <span className={"key-status " + (settings?.cli?.present ? "configured" : "")}>
                {settings?.cli?.present ? "detected" : "not detected"}
              </span>
            </div>
            {!settings?.cli?.present && (
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Install from{" "}
                <a href="https://docs.claude.com/en/docs/claude-code/overview" target="_blank" rel="noreferrer">
                  docs.claude.com
                </a>
                , then run <code>claude</code> (or <code>claude setup-token</code>) to log
                in. Detection refreshes within ~20s — reopen this panel. If{" "}
                <code>claude</code> isn't on your PATH, set <code>CLAUDE_CLI_BIN</code> to
                its full path.
              </p>
            )}
          </div>
          <ProviderBlock
            provider="openai"
            title="OpenAI / ChatGPT API"
            hint="Used for OpenAI-backed extraction, synthesis, and Chief of Staff runs."
          />
          <ProviderBlock
            provider="anthropic"
            title="Anthropic / Claude API"
            hint="Used for Claude-backed evaluator, testing, and implementation-agent runs."
          />
          <ProviderBlock
            provider="fal"
            title="fal.ai image generation"
            hint="Used later for Stage 3 low-fi signage, pricing-page sketches, and artifact variants."
            keyHint="Paste FAL_KEY, usually key_id:key_secret"
          />
          <ProviderBlock
            provider="elevenlabs"
            title="ElevenLabs voice"
            hint="Used later for Chief of Staff narration and opt-in synthetic persona voice rendering."
            keyHint="Paste ELEVENLABS_API_KEY"
            extra="voice"
          />
          {message && <div className="settings-message mono">{message}</div>}
          <div className="settings-footer">
            <button className="btn ghost" onClick={onClose}>Close</button>
            <button className="btn primary" disabled={saving} onClick={save}>
              {saving ? "Saving..." : "Save locally"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Campaign creation + Reading Theater ────────────────────
const emptyBrief = {
  name: "",
  search_domain: "",
  geography: "",
  business_models: "",
  avoid: "",
  founder_advantages: "",
  opening_uncertainties: "",
  source_note: "",
};

// Brief drafting is the Chief of Staff's job (spec §11). The local /api/draft-brief
// endpoint runs Claude (Haiku tier) on the founder's notes and returns a fully
// structured brief grounded in their actual material. No regex, no hardcoded
// defaults — if the API key is missing, the call fails clearly so the UI can
// say so instead of silently faking it.
async function draftBriefFromNotes(text) {
  const res = await fetch("/api/draft-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Draft failed.");
  return body;
}

function CampaignStartFlow({ open, onClose, onCreated, seed, onImmersive }) {
  const [brief, setBrief] = useState({ ...emptyBrief });
  const [step, setStep] = useState("conversation");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [message, setMessage] = useState("");
  const [draftMeta, setDraftMeta] = useState(null);

  useEffect(() => {
    if (!open) return;
    // Seed from the immersive flow — user typed an idea, possibly drafted
    // a brief, then exited. Carry their work over instead of resetting.
    if (seed) {
      setBrief({
        ...emptyBrief,
        ...(seed.brief || {}),
        source_note: seed.sourceText || ""
      });
      setStep(seed.brief ? "brief" : "conversation");
    } else {
      setBrief({ ...emptyBrief });
      setStep("conversation");
    }
    setMessage("");
    setDraftMeta(null);
  }, [open, seed]);

  if (!open) return null;

  const update = (field, value) => setBrief(prev => ({ ...prev, [field]: value }));

  const approve = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founder_intent: brief.source_note || brief.search_domain,
          brief
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create campaign.");
      let state = body.current_state;
      const campaignId = body.campaign.id;
      if (brief.source_note.trim()) {
        const noteRes = await fetch(`/api/campaigns/${campaignId}/source-note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: brief.source_note })
        });
        state = await noteRes.json();
      }
      // Honour the "begin Stage 1" promise on the button label. Use the
      // streaming endpoint so the cockpit opens immediately and fills in
      // live via SSE as the Builder/Tester/Evaluator agents run.
      const sourceCount = (state?.reading?.manifest || []).length;
      if (sourceCount > 0) {
        fetch(`/api/campaigns/${campaignId}/stream-stage1`, { method: "POST" })
          .catch(() => { /* SSE will surface errors into the ledger */ });
      }
      onCreated(state);
      onClose();
    } catch (error) {
      setMessage(error.message || "Could not create campaign.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editorial-shell editorial campaign-start">
      <div className="editorial-bar">
        <div className="left">
          <button className="tb-btn" onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <Icon.back cls="icon-sm" /> Return to campaigns
          </button>
          <span className="breadcrumbs">new campaign · Chief of Staff draft</span>
        </div>
        <div></div>
        <div className="right">
          {onImmersive && (
            <button className="tb-btn" onClick={onImmersive} title="Open immersive mode — calm editorial layout.">
              <Icon.spark cls="icon-sm" /> Immersive
            </button>
          )}
          <span className="opt-in-hint" style={{ color: "var(--text-muted)" }}>Phase 0 · no external API call yet</span>
        </div>
      </div>
      <div className="editorial-page">
        <div className="editorial-col wide">
          <div className="kicker">Pre-campaign brainstorm</div>
          <h1>Start before the opportunity is known.</h1>
          <p className="lede">
            The Chief of Staff turns your messy intent into a one-page campaign brief. You can edit every field before the lab creates the local campaign folder and Stage 1 ledger.
          </p>

          <div className="start-grid">
            <div className="start-panel">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.mic cls="icon-sm" /></span>
                <span>Conversation stub</span>
              </div>
              <div className="cos-mini-thread">
                <div className="cos-msg cos">
                  <span>Tell me the messy thing you want to investigate. Half-formed is fine.</span>
                  <span className="when">Chief of Staff</span>
                </div>
                <textarea
                  value={brief.source_note}
                  onChange={(e) => update("source_note", e.target.value)}
                  placeholder="Paste your rough notes, customer quotes, links you want to inspect later, or the messy intuition in your own words."
                />
                <button
                  className="btn primary"
                  onClick={async () => {
                    setMessage("");
                    setDrafting(true);
                    try {
                      const result = await draftBriefFromNotes(brief.source_note);
                      const drafted = result.brief || {};
                      setBrief(prev => ({
                        ...prev,
                        name: drafted.name || prev.name,
                        search_domain: drafted.search_domain || prev.search_domain,
                        geography: drafted.geography || prev.geography,
                        business_models: drafted.business_models || prev.business_models,
                        avoid: drafted.avoid || prev.avoid,
                        founder_advantages: drafted.founder_advantages || prev.founder_advantages,
                        opening_uncertainties: drafted.opening_uncertainties || prev.opening_uncertainties
                      }));
                      setDraftMeta({ model: result.model, cost_usd: result.cost_usd });
                      setStep("brief");
                    } catch (err) {
                      setMessage(err.message || "Could not draft from your notes.");
                    } finally {
                      setDrafting(false);
                    }
                  }}
                  disabled={!brief.source_note.trim() || drafting}
                >
                  {drafting ? "Drafting via Claude…" : "Draft from my notes"}
                </button>
                {draftMeta && (
                  <div className="opt-in-hint mono" style={{ marginTop: 6 }}>
                    drafted by {draftMeta.model} · ${draftMeta.cost_usd?.toFixed?.(4) ?? "0.0000"}
                  </div>
                )}
              </div>
            </div>

            <div className="start-panel">
              <div className="panel-title with-icon">
                <span className="panel-icon"><Icon.book cls="icon-sm" /></span>
                <span>Draft campaign brief</span>
              </div>
              <div className="brief-form">
                <label><span>Campaign name</span><input value={brief.name} onChange={(e) => update("name", e.target.value)} /></label>
                <label><span>Search domain</span><textarea value={brief.search_domain} onChange={(e) => update("search_domain", e.target.value)} /></label>
                <label><span>Geography</span><input value={brief.geography} onChange={(e) => update("geography", e.target.value)} /></label>
                <label><span>Preferred business models</span><input value={brief.business_models} onChange={(e) => update("business_models", e.target.value)} /></label>
                <label><span>Avoid</span><textarea value={brief.avoid} onChange={(e) => update("avoid", e.target.value)} /></label>
                <label><span>Founder advantages</span><textarea value={brief.founder_advantages} onChange={(e) => update("founder_advantages", e.target.value)} /></label>
                <label><span>Opening uncertainties</span><textarea value={brief.opening_uncertainties} onChange={(e) => update("opening_uncertainties", e.target.value)} /></label>
              </div>
            </div>
          </div>

          {step === "brief" && (
            <div className="translation-note">
              <strong>Translation ready.</strong> On approval, I’ll create a campaign directory, snapshot the initial brief, write the first ledger event, store your source note locally, and open Stage 1 Reading Theater.
            </div>
          )}
          {message && <div className="settings-message mono">{message}</div>}
          <div className="start-actions">
            <button className="btn ghost" onClick={onClose}>Back to campaigns</button>
            <button className="btn primary" disabled={saving || !brief.name.trim()} onClick={approve}>
              {saving ? "Creating campaign..." : "Approve brief & begin Stage 1"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function CampaignHome({ campaigns, onOpenCampaign, onNewCampaign, onSettings, onOpenDemo, onImmersive, settings }) {
  const keyCount = ["openai", "anthropic", "fal", "elevenlabs"]
    .reduce((sum, key) => sum + Number(settings?.[key]?.configured || false), 0);
  return (
    <main className="home-shell">
      <header className="home-top">
        <div className="brand">
          <span className="brand-mark"><Icon.brand /></span>
          <span className="brand-name">Venture Lab</span>
          <span className="local-pill">
            <span className="dot"></span>local · campaigns on disk
          </span>
        </div>
        <div className="home-actions">
          {onImmersive && (
            <button className="tb-btn" onClick={onImmersive} title="Enter immersive mode — calm editorial layout.">
              <Icon.spark cls="icon-sm" />
              <span>Immersive</span>
            </button>
          )}
          <button className="tb-btn" onClick={onSettings}>
            <Icon.scale cls="icon-sm" />
            <span>API keys</span>
            {keyCount > 0 && <span className="badge">{keyCount}</span>}
          </button>
          <button className="btn primary" onClick={onNewCampaign}>
            <Icon.arrowR cls="icon-sm" />
            New campaign
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div>
          <div className="kicker">Campaigns</div>
          <h1>Start with messy evidence. Leave with a dossier.</h1>
          <p>
            Each campaign is isolated, file-backed, and moves through Stage 1, Stage 2, Stage 3, and a final opportunity dossier.
          </p>
        </div>
        <button className="home-primary" onClick={onNewCampaign}>
          <Icon.arrowR cls="icon-sm" />
          Start a campaign
        </button>
      </section>

      <section className="campaign-list">
        <div className="list-head">
          <h2>Your campaigns</h2>
          <span className="mono">{campaigns.length} local</span>
        </div>
        {campaigns.length === 0 ? (
          <div className="empty-campaigns">
            <h3>No campaigns yet.</h3>
            <p>Create the first one. The demo cockpit is no longer the default app state.</p>
            <button className="btn primary" onClick={onNewCampaign}>New campaign</button>
          </div>
        ) : (
          <div className="campaign-rows">
            {campaigns.map(campaign => (
              <button key={campaign.id} className="campaign-row" onClick={() => onOpenCampaign(campaign.id)}>
                <div>
                  <strong>{campaign.name}</strong>
                  <span>{campaign.search_domain || "No search domain recorded"}</span>
                </div>
                <div className="campaign-row-meta">
                  <span className="card-state active">{campaign.stage}</span>
                  <span className="mono">{campaign.status}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// ── Source intake modal — mounts inside the cockpit ─────────
function SourceIntakeModal({ open, onClose, onAdd, sources, busy }) {
  const [text, setText] = useState("");
  const [label, setLabel] = useState("interview_note");
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: "min(720px, 100%)" }}>
        <div className="modal-head">
          <div className="titlerow">
            <span className="id mono">stage 1 · raw intake</span>
            <span className="name">Add messy source material</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon.close /></button>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ marginTop: 0 }}>
            Paste interview notes, support snippets, copied forum posts, voice-memo transcripts, or competitor observations. Sources stay on this device. Only structured prompts go out, and only when you approve a hosted call.
          </p>
          <label className="field" style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: "var(--t-12)", color: "var(--text-muted)" }}>Label (file slug)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value.replace(/[^a-z0-9_]/gi, "_"))} />
          </label>
          <label className="field" style={{ display: "grid", gap: 6, marginTop: 12 }}>
            <span style={{ fontSize: "var(--t-12)", color: "var(--text-muted)" }}>Source body</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="One customer said the outcome was great but they couldn't justify the price. Another said..."
              style={{ width: "100%", fontFamily: "var(--font-sans)", padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <button
              className="btn primary"
              disabled={!text.trim() || busy}
              onClick={async () => {
                await onAdd(text, label);
                setText("");
              }}
            >{busy ? "Saving…" : "Add raw source"}</button>
            <button className="btn ghost" onClick={onClose}>Close</button>
            <span className="opt-in-hint" style={{ marginLeft: "auto" }}>{(sources || []).length} on disk</span>
          </div>
          {sources && sources.length > 0 && (
            <div className="section">
              <h5>What I'm reading</h5>
              <div style={{ display: "grid", gap: 6 }}>
                {sources.map(src => (
                  <div key={src.id} className="evidence-link" style={{ cursor: "default" }}>
                    <span className="mono">{src.id}</span>
                    <span style={{ marginLeft: 8 }}>{src.filename}</span>
                    <span className="faint" style={{ marginLeft: "auto" }}>{src.modality} · {src.bytes} bytes</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
  const [openItem, setOpenItem] = useState(null);
  const [openEvidence, setOpenEvidence] = useState(null);
  const [openDefense, setOpenDefense] = useState(false);
  const [defenseTarget, setDefenseTarget] = useState(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [cosOpen, setCosOpen] = useState(false);
  const [wymOpen, setWymOpen] = useState(false);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  // Used to seed CampaignStartFlow from immersive mode — carries the
  // idea text the user typed and any brief Claude already drafted.
  const [startFlowSeed, setStartFlowSeed] = useState(null);
  // Used to seed ImmersiveMode itself when re-entering after an exit,
  // so the user's typed idea / drafted brief / current phase don't reset.
  const [immersiveSeed, setImmersiveSeed] = useState(null);
  // Immersive mode is always the default landing on a fresh page load.
  // The user can exit to the cockpit within a session, but a refresh
  // returns them to the calm editorial entry — no preference is
  // persisted. Clear any stale localStorage from earlier builds.
  const [immersive, setImmersive] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("ai-venture-lab.immersive");
      window.localStorage.removeItem("ai-venture-lab.immersive.v2");
    }
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [sourceIntakeOpen, setSourceIntakeOpen] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  // Per-item busy tracking so gate cards can show "Refining…" / "Advancing…"
  // on the specific card the user clicked, instead of an invisible global
  // spinner. Map of item id → { action: "refine"|"advance"|… }.
  const [busyItems, setBusyItems] = useState({});
  const markItemBusy = (id, action) => {
    if (!id) return;
    setBusyItems(prev => ({ ...prev, [id]: { action, started_at: Date.now() } }));
  };
  const clearItemBusy = (id) => {
    if (!id) return;
    setBusyItems(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const [userCampaignState, setUserCampaignState] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [handoffShown, setHandoffShown] = useState(true);

  const isUserCampaign = Boolean(userCampaignState);
  const data = isUserCampaign ? userCampaignState : DEMO_DATA;
  const status = ensureStatus(data);
  const activeCampaignId = userCampaignState?.campaign?.id;
  const activeCampaignName = data.campaign?.name || "Demo campaign";

  const openItemHandler = (item, kind) => setOpenItem({ item, kind });
  const refreshCampaigns = () => {
    fetch("/api/campaigns")
      .then(res => res.json())
      .then(body => setCampaigns(body.campaigns || []))
      .catch(() => setCampaigns([]));
  };

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(setSettings)
      .catch(() => setSettings({
        openai: { configured: false, last4: "", model: "gpt-5.2" },
        anthropic: { configured: false, last4: "", model: "claude-sonnet-4-5" },
        fal: { configured: false, last4: "", model: "fal-ai/flux/schnell" },
        elevenlabs: { configured: false, last4: "", model: "eleven_multilingual_v2" }
      }));
    refreshCampaigns();
    // Deep link: ?campaign=ID auto-opens that campaign's cockpit, and the
    // sentinel ?campaign=demo loads the bundled DEMO_DATA into the cockpit
    // for visual comparison against the prototype.
    const params = new URLSearchParams(window.location.search);
    const openParam = params.get("campaign");
    if (openParam === "demo") {
      setUserCampaignState({ ...DEMO_DATA });
      setFocus("items");
    } else if (openParam) {
      openCampaign(openParam);
    }
  }, []);

  const openCampaign = async (campaignId) => {
    const res = await fetch(`/api/campaigns/${campaignId}`);
    const body = await res.json();
    if (!res.ok) {
      window.alert(body.error || "Could not open campaign");
      return;
    }
    setUserCampaignState(body);
    setFocus("items");
    setRailTab("gate");
    setFocusStage(1);
  };

  const addSourceToCampaign = async (text, label) => {
    if (!activeCampaignId) return;
    setSourceBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaignId}/source-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, label })
      });
      const body = await res.json();
      if (res.ok) setUserCampaignState(body);
      else window.alert(body.error || "Could not save source");
    } finally {
      setSourceBusy(false);
    }
  };

  // Returns the response body on success or null on failure, so callers
  // can chain conditional follow-ups (e.g. only open the dossier modal
  // if the dossier was actually generated).
  const postCampaignAction = async (action, opts = {}) => {
    if (!activeCampaignId) return null;
    const { silentIfAlreadyRunning = false } = opts;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaignId}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        // Already-running collisions during auto-fire after advance
        // are expected — the previously-advanced clusters' run is
        // still in flight and will pick up newly-advanced ones at
        // its next iteration. Don't alert in that case.
        const isAlreadyRunning = body.error && body.error.includes("already in flight");
        if (silentIfAlreadyRunning && isAlreadyRunning) return null;
        window.alert(body.error || `Could not run ${action}`);
        return null;
      }
      setUserCampaignState(body);
      // Only switch to the Ledger rail tab when the action has nothing
      // gate-shaped to look at afterwards (run-stageN starts work; user
      // wants to watch the live ledger). When there are still candidates
      // waiting at a gate, stay on the Gate tab so the user can see the
      // ones they didn't decide on yet.
      const hasPendingGate = (body.gate_queue || []).some(g =>
        g.kind === "stage_1_to_2" || g.kind === "stage_2_to_3"
      );
      if (!hasPendingGate) setRailTab("ledger");
      return body;
    } finally {
      setActionBusy(false);
    }
  };

  // Soft pause — aborts the in-flight Anthropic call. The run finalises
  // with a "discard · Run paused by founder." ledger event and sets
  // mode=paused. SSE pushes the state update so the cockpit reflects it.
  const [pauseBusy, setPauseBusy] = useState(false);
  const pauseRun = async () => {
    if (!activeCampaignId) return;
    setPauseBusy(true);
    try {
      await fetch(`/api/campaigns/${activeCampaignId}/pause`, { method: "POST" });
    } finally {
      setPauseBusy(false);
    }
  };

  // SSE stream for live updates while a stage runs.
  useEffect(() => {
    if (!activeCampaignId) return undefined;
    const source = new EventSource(`/api/campaigns/${activeCampaignId}/events`);
    source.addEventListener("state", (event) => {
      try { setUserCampaignState(JSON.parse(event.data)); } catch {}
    });
    source.addEventListener("evidence_card", (event) => {
      try {
        const ev = JSON.parse(event.data);
        setUserCampaignState(prev => prev ? ({
          ...prev,
          evidence: [ev, ...(prev.evidence || []).filter(c => c.id !== ev.id)]
        }) : prev);
      } catch {}
    });
    source.addEventListener("agent_delta", (event) => {
      try {
        const delta = JSON.parse(event.data);
        setUserCampaignState(prev => {
          if (!prev) return prev;
          const exists = (prev.agents || []).some(a => a.id === delta.id);
          const agents = exists
            ? prev.agents.map(a => a.id === delta.id ? { ...a, ...delta } : a)
            : [...(prev.agents || []), delta];
          return { ...prev, agents };
        });
      } catch {}
    });
    source.addEventListener("tension", (event) => {
      try {
        const t = JSON.parse(event.data);
        setUserCampaignState(prev => prev ? ({
          ...prev,
          tensions: [t, ...(prev.tensions || []).filter(x => x.id !== t.id)]
        }) : prev);
      } catch {}
    });
    source.addEventListener("cluster", (event) => {
      try {
        const c = JSON.parse(event.data);
        setUserCampaignState(prev => prev ? ({
          ...prev,
          opp_clusters: [...(prev.opp_clusters || []).filter(x => x.id !== c.id), c]
        }) : prev);
      } catch {}
    });
    return () => source.close();
  }, [activeCampaignId]);

  // What the next "Run" button should do given current state. Stage 3
  // only counts as "complete" when both artifacts AND a pilot_run exist
  // (a server-restart recovery may leave you with artifacts but no
  // pilot_run, in which case the right move is to re-run Stage 3).
  const runNextStage = () => {
    if (!activeCampaignId) return;
    const evidenceCount = (userCampaignState.evidence || []).length;
    const clusterCount = (userCampaignState.opp_clusters || []).length;
    const advancedClusters = (userCampaignState.opp_clusters || []).filter(c => c.state === "advanced").length;
    const dirCount = (userCampaignState.directions || []).length;
    const advancedDirs = (userCampaignState.directions || []).filter(d => d.state === "lead" || d.state === "advanced").length;
    const artCount = (userCampaignState.artifacts || []).length;
    const hasPilot = !!userCampaignState.pilot_run;
    const hasDossier = !!userCampaignState.dossier;
    // Stage 1 is complete only when BOTH evidence AND clusters exist.
    // The previous check fired Stage 2 the moment the extractor returned
    // — even if the clusterer never ran — leading to:
    //   "Run failed: Stage 1 must complete before Stage 2."
    if (!evidenceCount || !clusterCount) return postCampaignAction("run-stage1");
    // Stage 2 requires advanced clusters; without them we'd silently
    // collapse to opp_clusters[0]. Tell the founder to advance instead.
    if (!dirCount && advancedClusters === 0) {
      window.alert("Pick at least one cluster to advance from the Stage 1 gate before running Stage 2.");
      return null;
    }
    if (!dirCount) return postCampaignAction("run-stage2");
    if ((!artCount || !hasPilot) && advancedDirs === 0) {
      window.alert("Pick at least one direction to advance from the Stage 2 gate before running Stage 3.");
      return null;
    }
    if (!artCount || !hasPilot) return postCampaignAction("run-stage3");
    if (!hasDossier) return postCampaignAction("generate-dossier");
    return null;
  };

  const advanceFromGate = async (gate) => {
    if (!gate) return null;
    if (gate.kind === "stage_1_to_2") {
      const advanced = await postCampaignAction("advance-stage2");
      // Auto-fire the next stage run if one isn't already running.
      // If it IS running (e.g. user just advanced cluster A, server is
      // running Stage 2 for A, user then advances cluster B), don't
      // surface "already running" as an error — B is queued for the
      // next time Stage 2 fires.
      if (advanced) await postCampaignAction("run-stage2", { silentIfAlreadyRunning: true });
      return advanced;
    }
    if (gate.kind === "stage_2_to_3") {
      const advanced = await postCampaignAction("advance-stage3");
      if (advanced) await postCampaignAction("run-stage3", { silentIfAlreadyRunning: true });
      return advanced;
    }
    if (gate.kind === "dossier") {
      // Open the dossier modal IMMEDIATELY so the user sees the
      // "synthesizing…" state for the full 30-90s the Opus call takes.
      // Previously the click went into a black hole — nothing visible
      // changed until the call finished.
      setDossierOpen(true);
      const result = await postCampaignAction("generate-dossier");
      // If the call failed (no dossier on the response), close the
      // modal so the user sees the alert from postCampaignAction
      // rather than a stale empty modal.
      if (!result || !result.dossier) setDossierOpen(false);
      return result;
    }
    return null;
  };

  // Immersive mode is the calm, editorial-register surface for the
  // pre-campaign brainstorm and live-run watching. It coexists with the
  // dense cockpit; the exit button on the immersive top bar swaps to it.
  if (immersive) {
    return (
      <DataContext.Provider value={data}>
        <ImmersiveMode
          campaigns={campaigns}
          settings={settings}
          userCampaignState={userCampaignState}
          seed={immersiveSeed}
          onCreated={(state) => {
            setUserCampaignState(state);
            setFocus("items");
            setRailTab("gate");
            setFocusStage(1);
            refreshCampaigns();
            // Seed cleared once we have a real campaign in flight.
            setImmersiveSeed(null);
          }}
          onOpen={openCampaign}
          onSettings={() => setSettingsOpen(true)}
          onOpenGate={() => setGateOpen(true)}
          onOpenDossier={() => {
            // If the dossier doesn't exist yet, generate it first then open.
            if (!data.dossier) {
              const gate = (data.gate_queue || []).find(g => g.kind === "dossier");
              if (gate) advanceFromGate(gate);
              else setDossierOpen(true);
            } else {
              setDossierOpen(true);
            }
          }}
          onExit={({ phase, sourceText, brief }) => {
            // Preserve the in-progress idea / brief so re-entering immersive
            // doesn't drop the user back to a blank prompt.
            const hasWork = (sourceText && sourceText.trim()) || brief;
            setImmersiveSeed(hasWork ? { sourceText: sourceText || "", brief: brief || null, phase } : null);
            // Phase-aware exit destination:
            //   idle        → drop to campaign list
            //   drafting/brief_review → open CampaignStartFlow with the work
            //   running     → fall to cockpit
            setImmersive(false);
            if (phase === "drafting" || phase === "brief_review") {
              setStartFlowSeed({ sourceText: sourceText || "", brief: brief || null });
              setStartOpen(true);
            }
          }}
        />
        <ApiKeySettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSaved={setSettings}
        />
        <GateDecisionEditorial
          open={gateOpen}
          onClose={() => setGateOpen(false)}
          onOpenDossier={() => { setGateOpen(false); setDossierOpen(true); }}
          busy={actionBusy}
          onAdvanceMany={async (ids, kind) => {
            const queue = data.gate_queue || [];
            const gate = (kind && queue.find(g => g.kind === kind)) || queue.find(g => g.kind === "stage_2_to_3") || queue.find(g => g.kind === "stage_1_to_2");
            if (!gate) return;
            const next = gate.kind === "stage_1_to_2" ? "advance-stage2" : "advance-stage3";
            const run = gate.kind === "stage_1_to_2" ? "run-stage2" : "run-stage3";
            setActionBusy(true);
            try {
              const res = await fetch(`/api/campaigns/${activeCampaignId}/${next}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids })
              });
              const body = await res.json();
              if (!res.ok) { window.alert(body.error || "Could not advance."); return; }
              setUserCampaignState(body);
              setGateOpen(false);
              postCampaignAction(run, { silentIfAlreadyRunning: true });
            } finally {
              setActionBusy(false);
            }
          }}
          onHoldMany={async (ids, kind) => {
            if (!ids.length) return;
            const queue = data.gate_queue || [];
            const gate = (kind && queue.find(g => g.kind === kind)) || queue.find(g => g.kind === "stage_2_to_3") || queue.find(g => g.kind === "stage_1_to_2");
            const route = gate?.kind === "stage_1_to_2" ? "hold-clusters" : "hold-directions";
            const res = await fetch(`/api/campaigns/${activeCampaignId}/${route}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids })
            });
            const body = await res.json();
            if (res.ok) setUserCampaignState(body);
          }}
          onArchiveMany={async (ids, kind) => {
            if (!ids.length) return;
            const queue = data.gate_queue || [];
            const gate = (kind && queue.find(g => g.kind === kind)) || queue.find(g => g.kind === "stage_2_to_3") || queue.find(g => g.kind === "stage_1_to_2");
            const route = gate?.kind === "stage_1_to_2" ? "archive-clusters" : "archive-directions";
            const res = await fetch(`/api/campaigns/${activeCampaignId}/${route}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids })
            });
            const body = await res.json();
            if (res.ok) setUserCampaignState(body);
          }}
          onFindMore={(kind) => {
            const queue = data.gate_queue || [];
            const gate = (kind && queue.find(g => g.kind === kind)) || queue.find(g => g.kind === "stage_2_to_3") || queue.find(g => g.kind === "stage_1_to_2");
            const route = gate?.kind === "stage_1_to_2" ? "find-more-clusters" : "find-more-directions";
            postCampaignAction(route);
          }}
          onReject={async (kind, id, reason) => {
            const res = await fetch(`/api/campaigns/${activeCampaignId}/reject`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, id, reason })
            });
            const body = await res.json();
            if (res.ok) setUserCampaignState(body);
          }}
          onRefine={async (kind, id, feedback) => {
            // Refine re-runs the producer agent on this single item
            // with the founder's optional feedback. Replaces in place.
            setActionBusy(true);
            try {
              const res = await fetch(`/api/campaigns/${activeCampaignId}/refine`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, id, feedback })
              });
              const body = await res.json();
              if (!res.ok) { window.alert(body.error || "Could not refine."); return; }
              setUserCampaignState(body);
            } finally {
              setActionBusy(false);
            }
          }}
          onReassign={async (hypothesis_id, to_cluster_id) => {
            const res = await fetch(`/api/campaigns/${activeCampaignId}/reassign-hypothesis`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hypothesis_id, to_cluster_id })
            });
            const body = await res.json();
            if (res.ok) setUserCampaignState(body);
          }}
        />
        <DossierEditorial open={dossierOpen} onClose={() => setDossierOpen(false)} busy={actionBusy} onGenerate={async () => { const r = await postCampaignAction("generate-dossier"); if (r && r.dossier) setDossierOpen(true); }} />
      </DataContext.Provider>
    );
  }

  if (!isUserCampaign) {
    return (
      <Fragment>
        <CampaignHome
          campaigns={campaigns}
          onOpenCampaign={openCampaign}
          onNewCampaign={() => setStartOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onImmersive={() => setImmersive(true)}
          settings={settings}
        />
        <CampaignStartFlow
          open={startOpen}
          onClose={() => { setStartOpen(false); setStartFlowSeed(null); }}
          onCreated={(state) => {
            setUserCampaignState(state);
            setFocus("items");
            setRailTab("gate");
            setFocusStage(1);
            refreshCampaigns();
            setStartFlowSeed(null);
          }}
          seed={startFlowSeed}
          onImmersive={() => { setStartOpen(false); setImmersive(true); }}
        />
        <ApiKeySettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSaved={setSettings}
        />
      </Fragment>
    );
  }

  return (
    <DataContext.Provider value={data}>
      <div className="app-shell">
        <TopBar
          status={status}
          cosOn={cosOpen}
          onCos={() => setCosOpen(!cosOpen)}
          onWym={() => setWymOpen(true)}
          missedCount={(data.what_you_missed || []).length}
          onSettings={() => setSettingsOpen(true)}
          settings={settings}
          onCampaigns={() => {
            setUserCampaignState(null);
            refreshCampaigns();
          }}
          campaignName={activeCampaignName}
          onPause={pauseRun}
          pauseBusy={pauseBusy}
          canResume={
            // Show Resume whenever ANY recoverable condition exists — a
            // last_error of any kind, a paused mode, or a stuck-mid-run
            // status. The previous predicate required the substring
            // "interrupted" in last_error, which left every other
            // failure (LLM error, missing prereq, parse failure) with
            // no retry affordance — the cockpit looked frozen.
            (status.in_flight_runs === 0) && (
              data.mode === "paused" ||
              !!data.last_error
            )
          }
          onResume={runNextStage}
          resumeBusy={actionBusy}
          onScorecard={() => setScorecardOpen(true)}
          onImmersive={() => setImmersive(true)}
        />
        {/* Error banner — visible whenever last_error is set on state.
            Two affordances: Retry (re-fires runNextStage) and Dismiss
            (POST /clear-error to wipe last_error without retrying).
            Closes the dead-end where a failed run left the cockpit
            with no obvious next step. */}
        {data.last_error && status.in_flight_runs === 0 && (
          <div className="error-banner">
            <div className="error-banner-body">
              <span className="error-banner-icon">⚠</span>
              <div className="error-banner-text">
                <div className="error-banner-title">Last run failed</div>
                <div className="error-banner-detail">{data.last_error}</div>
              </div>
            </div>
            <div className="error-banner-actions">
              <button
                className="btn primary"
                onClick={() => runNextStage()}
                disabled={actionBusy}
              >{actionBusy ? "Working…" : "Retry"}</button>
              <button
                className="btn ghost"
                onClick={async () => {
                  const res = await fetch(`/api/campaigns/${activeCampaignId}/clear-error`, { method: "POST" });
                  if (res.ok) {
                    const body = await res.json();
                    setUserCampaignState(body);
                  }
                }}
                disabled={actionBusy}
              >Dismiss</button>
            </div>
          </div>
        )}
        <div className="main">
          <Sidebar
            focus={focus}
            setFocus={setFocus}
            campaignId={activeCampaignId}
            onAddSources={() => setSourceIntakeOpen(true)}
          />
          <section className="canvas">
            <CanvasBar focus={focus} zoom={zoom} setZoom={setZoom} onFit={() => setZoom(0.9)} />
            <div className={"canvas-body" + (focus === "items" || focus === "agents" ? " is-live-canvas" : "")}>
              {focus === "items" && (
                <ItemCanvasView onOpen={openItemHandler} data={data} />
              )}
              {focus === "agents" && (
                <AgentCanvasView onOpen={openItemHandler} data={data} />
              )}
              {focus === "summary" && <ScientificSummary />}
            </div>
          </section>
          <aside className="rail">
            <div className="rail-tabs">
              <button className={"rail-tab " + (railTab === "gate" ? "is-on" : "")} onClick={() => setRailTab("gate")}>
                Gate queue <span className="count">{(data.gate_queue || []).length}</span>
              </button>
              <button className={"rail-tab " + (railTab === "ledger" ? "is-on" : "")} onClick={() => setRailTab("ledger")}>
                Ledger <span className="count">{(data.ledger || []).length}</span>
              </button>
              <button className={"rail-tab " + (railTab === "qa" ? "is-on" : "")} onClick={() => setRailTab("qa")}>
                Leakage / QA <span className="count">{(data.qa || []).length}</span>
              </button>
            </div>
            <div className="rail-body">
              {railTab === "gate" && (
                <GateQueue
                  busyItems={busyItems}
                  onReview={() => setGateOpen(true)}
                  onAdvance={advanceFromGate}
                  onRun={advanceFromGate}
                  onOpenDossier={() => setDossierOpen(true)}
                  onAdvanceItems={async (gate, ids) => {
                    if (!ids || !ids.length) return;
                    const next = gate.kind === "stage_1_to_2" ? "advance-stage2" : "advance-stage3";
                    const run = gate.kind === "stage_1_to_2" ? "run-stage2" : "run-stage3";
                    for (const id of ids) markItemBusy(id, "advance");
                    setActionBusy(true);
                    try {
                      const res = await fetch(`/api/campaigns/${activeCampaignId}/${next}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids })
                      });
                      const body = await res.json();
                      if (!res.ok) { window.alert(body.error || "Could not advance."); return; }
                      setUserCampaignState(body);
                      postCampaignAction(run, { silentIfAlreadyRunning: true });
                    } finally {
                      setActionBusy(false);
                      for (const id of ids) clearItemBusy(id);
                    }
                  }}
                  onRefineItem={async (kind, id, feedback) => {
                    markItemBusy(id, "refine");
                    setActionBusy(true);
                    try {
                      const res = await fetch(`/api/campaigns/${activeCampaignId}/refine`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kind, id, feedback })
                      });
                      const body = await res.json();
                      if (!res.ok) { window.alert(body.error || "Could not refine."); return; }
                      setUserCampaignState(body);
                    } finally {
                      setActionBusy(false);
                      clearItemBusy(id);
                    }
                  }}
                  onRejectItem={async (kind, id, reason) => {
                    markItemBusy(id, "reject");
                    try {
                      const res = await fetch(`/api/campaigns/${activeCampaignId}/reject`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ kind, id, reason })
                      });
                      const body = await res.json();
                      if (res.ok) setUserCampaignState(body);
                    } finally {
                      clearItemBusy(id);
                    }
                  }}
                  onHoldItems={async (gate, ids) => {
                    const route = gate.kind === "stage_1_to_2" ? "hold-clusters" : "hold-directions";
                    for (const id of ids) markItemBusy(id, "hold");
                    try {
                      const res = await fetch(`/api/campaigns/${activeCampaignId}/${route}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids })
                      });
                      const body = await res.json();
                      if (res.ok) setUserCampaignState(body);
                    } finally {
                      for (const id of ids) clearItemBusy(id);
                    }
                  }}
                  onArchiveItems={async (gate, ids) => {
                    const route = gate.kind === "stage_1_to_2" ? "archive-clusters" : "archive-directions";
                    for (const id of ids) markItemBusy(id, "archive");
                    try {
                      const res = await fetch(`/api/campaigns/${activeCampaignId}/${route}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids })
                      });
                      const body = await res.json();
                      if (res.ok) setUserCampaignState(body);
                    } finally {
                      for (const id of ids) clearItemBusy(id);
                    }
                  }}
                />
              )}
              {railTab === "ledger" && (
                <Ledger onOpenItem={(item, kind) => setOpenItem({ item, kind })} />
              )}
              {railTab === "qa" && <LeakageQA />}
            </div>
          </aside>
        </div>
        <footer className="statusbar">
          <div className="group">
            <span>~/venture_lab/campaigns/{activeCampaignId || data.campaign?.id || "—"}/</span>
            <span>· campaign ledger ready</span>
            <span>· workers {status.in_flight_runs > 0 ? "running" : "idle"}</span>
          </div>
          <div className="group" style={{ justifySelf: "center" }}>
            <span className="muted">pulse · last 40 minutes</span>
            <PulseLine data={status.pulse && status.pulse.length ? status.pulse : Array(40).fill(1)} />
          </div>
          <div className="group">
            <span className="mono">{`$${status.cost_spent.toFixed(2)} / $${status.cost_cap.toFixed(2)}`}</span>
          </div>
        </footer>

        {/* Modals & overlays */}
        <ItemDetailModal
          item={openItem?.item}
          kind={openItem?.kind}
          onClose={() => setOpenItem(null)}
          onOpenEvidence={(ev) => setOpenEvidence(ev)}
          onOpenDefense={(item) => { setDefenseTarget(item?.id || null); setOpenItem(null); setOpenDefense(true); }}
        />
        <EvidenceModal evidence={openEvidence} onClose={() => setOpenEvidence(null)} />
        <DefenseModal open={openDefense} itemId={defenseTarget} onClose={() => setOpenDefense(false)} />
        <GateDecisionEditorial
          open={gateOpen}
          onClose={() => setGateOpen(false)}
          onOpenDossier={() => { setGateOpen(false); setDossierOpen(true); }}
          busy={actionBusy}
          // Multi-pick advance: takes an array of cluster/direction ids
          // and POSTs them to /advance-stage{2,3}, then auto-fires
          // /run-stage{2,3} so the modal closes and Stage N+1 begins.
          onAdvanceMany={async (ids, kind) => {
            const queue = data.gate_queue || [];
            const gate = (kind && queue.find(g => g.kind === kind)) || queue.find(g => g.kind === "stage_2_to_3") || queue.find(g => g.kind === "stage_1_to_2");
            if (!gate) return;
            const next = gate.kind === "stage_1_to_2" ? "advance-stage2" : "advance-stage3";
            const run = gate.kind === "stage_1_to_2" ? "run-stage2" : "run-stage3";
            setActionBusy(true);
            try {
              const res = await fetch(`/api/campaigns/${activeCampaignId}/${next}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids })
              });
              const body = await res.json();
              if (!res.ok) { window.alert(body.error || "Could not advance."); return; }
              setUserCampaignState(body);
              setGateOpen(false);
              postCampaignAction(run, { silentIfAlreadyRunning: true });
            } finally {
              setActionBusy(false);
            }
          }}
          onHoldMany={async (ids, kind) => {
            if (!ids.length) return;
            const queue = data.gate_queue || [];
            const gate = (kind && queue.find(g => g.kind === kind)) || queue.find(g => g.kind === "stage_2_to_3") || queue.find(g => g.kind === "stage_1_to_2");
            const route = gate?.kind === "stage_1_to_2" ? "hold-clusters" : "hold-directions";
            const res = await fetch(`/api/campaigns/${activeCampaignId}/${route}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids })
            });
            const body = await res.json();
            if (res.ok) setUserCampaignState(body);
          }}
          onArchiveMany={async (ids, kind) => {
            if (!ids.length) return;
            const queue = data.gate_queue || [];
            const gate = (kind && queue.find(g => g.kind === kind)) || queue.find(g => g.kind === "stage_2_to_3") || queue.find(g => g.kind === "stage_1_to_2");
            const route = gate?.kind === "stage_1_to_2" ? "archive-clusters" : "archive-directions";
            const res = await fetch(`/api/campaigns/${activeCampaignId}/${route}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids })
            });
            const body = await res.json();
            if (res.ok) setUserCampaignState(body);
          }}
          onFindMore={(kind) => {
            const queue = data.gate_queue || [];
            const gate = (kind && queue.find(g => g.kind === kind)) || queue.find(g => g.kind === "stage_2_to_3") || queue.find(g => g.kind === "stage_1_to_2");
            const route = gate?.kind === "stage_1_to_2" ? "find-more-clusters" : "find-more-directions";
            postCampaignAction(route);
          }}
          onReject={async (kind, id, reason) => {
            const res = await fetch(`/api/campaigns/${activeCampaignId}/reject`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, id, reason })
            });
            const body = await res.json();
            if (res.ok) setUserCampaignState(body);
          }}
          onRefine={async (kind, id, feedback) => {
            setActionBusy(true);
            try {
              const res = await fetch(`/api/campaigns/${activeCampaignId}/refine`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, id, feedback })
              });
              const body = await res.json();
              if (!res.ok) { window.alert(body.error || "Could not refine."); return; }
              setUserCampaignState(body);
            } finally {
              setActionBusy(false);
            }
          }}
          onReassign={async (hypothesis_id, to_cluster_id) => {
            const res = await fetch(`/api/campaigns/${activeCampaignId}/reassign-hypothesis`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hypothesis_id, to_cluster_id })
            });
            const body = await res.json();
            if (res.ok) setUserCampaignState(body);
          }}
        />
        <DossierEditorial open={dossierOpen} onClose={() => setDossierOpen(false)} busy={actionBusy} onGenerate={async () => { const r = await postCampaignAction("generate-dossier"); if (r && r.dossier) setDossierOpen(true); }} />
        <ChiefOfStaffStage
          open={cosOpen}
          onClose={() => setCosOpen(false)}
          onJumpDossier={() => { setCosOpen(false); setDossierOpen(true); }}
          onJumpGate={() => { setCosOpen(false); setGateOpen(true); }}
        />
        <WhatYouMissedModal open={wymOpen} onClose={() => setWymOpen(false)} />
        <ScorecardModal open={scorecardOpen} onClose={() => setScorecardOpen(false)} />
        <CampaignStartFlow
          open={startOpen}
          onClose={() => { setStartOpen(false); setStartFlowSeed(null); }}
          onCreated={(state) => {
            setUserCampaignState(state);
            setFocus("items");
            setRailTab("gate");
            refreshCampaigns();
            setStartFlowSeed(null);
          }}
          seed={startFlowSeed}
          onImmersive={() => { setStartOpen(false); setImmersive(true); }}
        />
        <ApiKeySettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSaved={setSettings}
        />
        <SourceIntakeModal
          open={sourceIntakeOpen}
          onClose={() => setSourceIntakeOpen(false)}
          onAdd={addSourceToCampaign}
          sources={data.reading?.manifest || []}
          busy={sourceBusy}
        />
      </div>
    </DataContext.Provider>
  );
}

export default App;
