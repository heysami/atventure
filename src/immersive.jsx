// Immersive Mode — calm, editorial-register entry point for a campaign.
//
// Phases:
//   idle           — center prompt + floating campaign names from history
//   drafting       — Claude is producing the brief; loading orbit
//   brief_review   — brief fields fade in one by one, "Begin reading" CTA
//   creating       — POST /campaigns + add source + kickoff Stage 1
//   running        — latest ledger event in centre, items orbit around it
//
// Style follows the Chief of Staff stage: generous serif typography,
// dim accent only at the centre, slow staggered fades.

import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";

// Place items on concentric rings so adjacent indices land at evenly
// spaced angles (no clustering, no overlap). Each ring holds `perRing`
// items distributed across 360° with a small per-ring rotational
// offset so successive rings don't visually align radial spokes.
// Older items push to outer rings.
function ringPos(index, total, w, h, opts = {}) {
  const cx = w / 2;
  const cy = h / 2;
  const minR = opts.minR || 320;
  const ringStep = opts.ringStep || 90;
  const perRing = opts.perRing || 6;
  const ring = Math.floor(index / perRing);
  const slot = index % perRing;
  const r = minR + ring * ringStep;
  const ringRotation = ring * 23;
  const angle = (slot / perRing) * 360 + ringRotation;
  const rad = angle * Math.PI / 180;
  // Stable per-item jitter so positions feel organic but never reflow.
  const jitterRad = ((index * 53) % 17) - 8;
  const jitterDeg = ((index * 31) % 14) - 7;
  const finalR = r + jitterRad;
  const finalAngle = angle + jitterDeg;
  const rad2 = finalAngle * Math.PI / 180;
  return { x: cx + Math.cos(rad2) * finalR, y: cy + Math.sin(rad2) * finalR, r: finalR, ring };
}

// Subtle ambient particle field — purely cosmetic, ~40 dots drifting
// slowly with low opacity so the immersive surface feels fleeting.
// Generated once at module load; positions / durations / sizes are
// stable across renders so the field doesn't reshuffle on every paint.
const PARTICLES = (() => {
  const seed = (n) => {
    // Deterministic pseudo-random in [0..1) so SSR / hot-reload don't reflow.
    const s = Math.sin(n * 99173) * 10000;
    return s - Math.floor(s);
  };
  return Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: seed(i * 3 + 1) * 100,        // %
    top:  seed(i * 5 + 2) * 100,        // %
    size: 1.4 + seed(i * 7 + 3) * 2.2,  // 1.4–3.6 px
    opacity: 0.10 + seed(i * 11 + 4) * 0.22, // 0.10–0.32
    duration: 22 + seed(i * 13 + 5) * 28,    // 22–50 s
    delay: -seed(i * 17 + 6) * 30,           // negative phase offset
    driftX: 30 + seed(i * 19 + 7) * 70,      // 30–100 px lateral
    driftY: 20 + seed(i * 23 + 8) * 60       // 20–80 px vertical
  }));
})();

function ParticleField() {
  return (
    <div className="im-particles" aria-hidden="true">
      {PARTICLES.map(p => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            "--p-drift-x": `${p.driftX}px`,
            "--p-drift-y": `${p.driftY}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`
          }}
        />
      ))}
    </div>
  );
}

// Per-item drift offset feeds CSS variables for the keyframe animation.
// Each item gets a slightly different drift radius / period / phase so
// the field never moves in lockstep.
function driftStyle(index) {
  const dx = 8 + ((index * 7) % 9);    // 8–16 px lateral
  const dy = 6 + ((index * 11) % 8);   // 6–13 px vertical
  const dur = 9 + ((index * 5) % 7);   // 9–15 s
  const delay = ((index * 13) % 7) * -1;
  return {
    "--drift-x": `${dx}px`,
    "--drift-y": `${dy}px`,
    animationDuration: `${dur}s`,
    animationDelay: `${delay}s`
  };
}

// Active model summary shown in the top bar. "claude-sonnet-4-5 + 2"
// when more than one provider has a key configured.
function activeModelLabel(settings) {
  if (!settings) return null;
  const providers = ["anthropic", "openai", "elevenlabs", "fal"];
  const configured = providers
    .filter(p => settings[p]?.configured)
    .map(p => settings[p]?.model || p);
  if (configured.length === 0) return "no model configured";
  if (configured.length === 1) return configured[0];
  return `${configured[0]} +${configured.length - 1}`;
}

// Map item state → strength score in [0..1]. Drives underline width
// and font weight on the orbit labels.
function itemStrength(item) {
  if (!item) return 0;
  if (typeof item.conf === "number") return Math.max(0, Math.min(1, item.conf));
  const map = { lead: 0.85, advanced: 0.7, held: 0.55, queued: 0.5, discounted: 0.3, cleared: 0.18 };
  return map[item.state] || 0.5;
}

// Mini hexagon SVG — for indicating agent count on an orbiting item.
function HexCluster({ count, color = "var(--accent)" }) {
  const items = Array.from({ length: Math.min(count, 5) });
  return (
    <span className="im-hex-cluster" aria-label={`${count} agent${count === 1 ? "" : "s"} on this item`}>
      {items.map((_, i) => (
        <svg key={i} viewBox="-10 -10 20 20" width="9" height="9">
          <polygon
            points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5"
            fill={color}
            opacity={0.85 - i * 0.1}
          />
        </svg>
      ))}
      {count > 5 && <span className="im-hex-overflow mono">+{count - 5}</span>}
    </span>
  );
}

// Three-dot stage indicator. Filled up to and including the current stage.
function StageDots({ stage }) {
  const n = stage === 3 ? 3 : stage === 2 ? 2 : 1;
  return (
    <div className="im-stage-dots" aria-label={`Stage ${n} of 3`}>
      {[1, 2, 3].map(i => (
        <span key={i} className={"im-stage-dot " + (i <= n ? "is-on" : "is-off")} />
      ))}
    </div>
  );
}

// Editorial top bar — appname, model, exit. Always present.
function ImmersiveTop({ modelLabel, onExit, exitLabel, onSettings }) {
  return (
    <header className="im-top">
      <span className="im-brand">Venture Lab</span>
      <button
        className="im-model mono"
        onClick={onSettings}
        disabled={!onSettings}
        title="Click to open API keys & default model settings."
      >
        {modelLabel}
      </button>
      <button className="im-exit" onClick={onExit} title={exitLabel?.title || "Exit immersive mode."}>
        {exitLabel?.text || "exit immersive"}
      </button>
    </header>
  );
}

// ── IDLE phase — center prompt, blinking cursor, history orbit ──
function IdleLayer({ campaigns, onSubmit, onOpen, busy, error, modelHasKey, onSettings, initialText, onTextChange }) {
  const [text, setText] = useState(initialText || "");
  // Push every keystroke up so the App-level seed survives mount/unmount.
  useEffect(() => { onTextChange?.(text); }, [text]);
  const [dim, setDim] = useState({ w: 1200, h: 720 });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDim({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-focus the typing cursor on every entry.
  useEffect(() => { inputRef.current?.focus(); }, []);

  const onKey = (e) => {
    if (e.key === "Enter" && text.trim() && !busy) {
      e.preventDefault();
      onSubmit(text.trim());
    }
  };

  // Newest first; cap at 12 names so the orbit doesn't get crowded.
  const sorted = [...(campaigns || [])]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 12);

  return (
    <div ref={wrapRef} className="im-stage">
      <div className="im-orbit">
        {sorted.map((c, i) => {
          const minR = Math.max(420, Math.min(dim.w, dim.h) * 0.34);
          const pos = ringPos(i, sorted.length, dim.w, dim.h, {
            minR,
            ringStep: 110,
            perRing: 6
          });
          const age = sorted.length <= 1 ? 0 : i / (sorted.length - 1);
          const opacity = 0.25 + (1 - age) * 0.55;
          const fontSize = 13 + (1 - age) * 6;
          return (
            <button
              key={c.id}
              className="im-orbit-name"
              style={{ left: pos.x, top: pos.y, opacity, fontSize, ...driftStyle(i) }}
              onClick={() => onOpen?.(c.id)}
              title={`${c.name} · ${c.stage || "stage1"}`}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      <div className="im-center">
        {!modelHasKey ? (
          // No key yet: don't ask for an idea. Show one quiet line in the
          // same italic serif register as the placeholder, clickable to
          // open settings. The orbit fades to a calmer level too.
          <button
            className="im-needs-key"
            onClick={onSettings}
            disabled={!onSettings}
            title="Open API keys & default model settings"
          >
            please add an API key first
          </button>
        ) : (
          <Fragment>
            <div className="im-prompt">what is your idea?</div>
            <div className="im-input-row">
              <input
                ref={inputRef}
                className="im-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                placeholder="A messy hunch — half-formed is fine."
                disabled={busy}
                spellCheck={false}
                autoComplete="off"
              />
              <span className="im-enter mono" style={{ opacity: text.trim() ? 1 : 0.25 }}>
                ↵ enter
              </span>
            </div>
            {error && <div className="im-warn">{error}</div>}
          </Fragment>
        )}
      </div>
    </div>
  );
}

// ── DRAFTING phase — quiet loading ──
function DraftingLayer({ note }) {
  return (
    <div className="im-stage">
      <div className="im-center">
        <div className="im-loading"><span /><span /><span /></div>
        <div className="im-prompt im-fade-in">drafting your brief</div>
        {note && <div className="im-hint im-fade-in">{note}</div>}
      </div>
    </div>
  );
}

// ── BRIEF REVIEW phase — fields fade in, then a Begin button ──
function BriefReviewLayer({ brief, onBegin, busy, sourceText }) {
  const fields = [
    { key: "name",                 label: "campaign",         value: brief.name },
    { key: "search_domain",        label: "search domain",    value: brief.search_domain },
    { key: "geography",            label: "geography",        value: brief.geography },
    { key: "business_models",      label: "business models",  value: brief.business_models },
    { key: "avoid",                label: "avoid",            value: brief.avoid },
    { key: "founder_advantages",   label: "advantages",       value: brief.founder_advantages },
    { key: "opening_uncertainties",label: "uncertainties",    value: brief.opening_uncertainties }
  ].filter(f => f.value && String(f.value).trim());

  return (
    <div className="im-stage im-scroll-top">
      <div className="im-center im-brief">
        <div className="im-prompt">your brief</div>
        <div className="im-brief-fields">
          {fields.map((f, i) => (
            <div
              key={f.key}
              className="im-brief-field"
              style={{ "--d": `${300 + i * 200}ms` }}
            >
              <span className="im-brief-label">{f.label}</span>
              <span className="im-brief-value">{f.value}</span>
            </div>
          ))}
        </div>
        <button className="im-begin" onClick={onBegin} disabled={busy}>
          {busy ? "starting…" : "begin reading →"}
        </button>
        {sourceText && (
          <div className="im-hint" style={{ marginTop: 18, "--d": `${300 + fields.length * 200 + 200}ms` }}>
            Source on file: {sourceText.slice(0, 120)}{sourceText.length > 120 ? "…" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ── RUNNING phase — latest ledger in centre, items orbit ──
function RunningLayer({ data, onExit, onOpenGate, onOpenDossier }) {
  const [dim, setDim] = useState({ w: 1200, h: 720 });
  const wrapRef = useRef(null);
  const ledger = data?.ledger || [];
  const latest = ledger[0] || null;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDim({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Bind every active item to an orbit position. Sort by recency so
  // newer items cluster near the centre, older drifts outward. Use the
  // item's id as a stable key so positions don't reshuffle on each tick.
  const orbiting = useMemo(() => {
    const all = [
      ...(data?.directions || []).map(d => ({ ...d, kind: "direction" })),
      ...(data?.opp_clusters || []).map(o => ({ ...o, kind: "opportunity" })),
      ...(data?.artifacts || []).map(a => ({ ...a, kind: "artifact" }))
    ];
    // Active first (lead → advanced → held), then discounted/cleared at the rim.
    const rank = { lead: 0, advanced: 1, held: 2, queued: 3, discounted: 4, cleared: 5 };
    all.sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9));
    return all;
  }, [data?.directions, data?.opp_clusters, data?.artifacts]);

  // Map each item id → count of agents currently working on it.
  const agentsOnItem = useMemo(() => {
    const m = new Map();
    for (const a of (data?.agents || [])) {
      if (!a.item) continue;
      const key = a.item.includes("/") ? a.item.split("/").pop() : a.item;
      m.set(key, (m.get(key) || 0) + 1);
      m.set(a.item, (m.get(a.item) || 0) + 1);
    }
    return m;
  }, [data?.agents]);

  const stage = data?.campaign?.stage === "stage3" ? 3 : data?.campaign?.stage === "stage2" ? 2 : 1;
  const inFlight = (data?.status?.in_flight_runs || 0) > 0;

  return (
    <div ref={wrapRef} className="im-stage">
      <div className="im-orbit">
        {orbiting.map((it, i) => {
          const minR = Math.max(380, Math.min(dim.w, dim.h) * 0.32);
          const pos = ringPos(i, orbiting.length, dim.w, dim.h, {
            minR,
            ringStep: 110,
            perRing: 6
          });
          const strength = itemStrength(it);
          const fontWeight = 380 + Math.round(strength * 280);  // 380–660
          const opacity = 0.25 + (1 - i / Math.max(1, orbiting.length - 1)) * 0.65;
          const agentCount = agentsOnItem.get(it.id) || 0;
          return (
            <div
              key={it.id}
              className={"im-orbit-item is-" + (it.state || "active")}
              style={{ left: pos.x, top: pos.y, opacity, fontWeight, ...driftStyle(i) }}
              title={`${it.id} · ${it.kind} · ${it.state || ""}`}
            >
              <div className="im-orbit-label">{it.name || it.id}</div>
              <div className="im-orbit-bar" style={{ "--strength": strength }}>
                <span style={{ width: `${strength * 100}%` }} />
              </div>
              {agentCount > 0 && <HexCluster count={agentCount} />}
            </div>
          );
        })}
      </div>
      <div className="im-center">
        <StageDots stage={stage} />
        <div key={latest?.ts || "idle"} className="im-ledger im-fade-in">
          {latest ? latest.text : "Waiting for the harness to begin…"}
        </div>
        {latest?.run && (
          <div className="im-ledger-run mono im-fade-in">{latest.run}</div>
        )}
        {inFlight && <div className="im-loading"><span /><span /><span /></div>}
        {/* When a primary gate is queued, surface it as the focal CTA so
            the founder doesn't have to exit to cockpit to act on it. */}
        {(() => {
          const queue = data?.gate_queue || [];
          const gate =
            queue.find(g => g.kind === "stage_1_to_2") ||
            queue.find(g => g.kind === "stage_2_to_3") ||
            queue.find(g => g.kind === "dossier");
          if (!gate || inFlight) return null;
          const label = gate.kind === "dossier"
            ? (data.dossier ? "open dossier →" : "generate dossier →")
            : gate.kind === "stage_1_to_2"
            ? `review stage 1 → 2 gate (${gate.candidates?.length || 0} candidates) →`
            : `review stage 2 → 3 gate (${gate.candidates?.length || 0} directions) →`;
          const onClick = gate.kind === "dossier" ? onOpenDossier : onOpenGate;
          return onClick ? (
            <button className="im-gate-cta im-fade-in" onClick={onClick}>
              {label}
            </button>
          ) : null;
        })()}
        {onExit && (
          <button className="im-view-details" onClick={onExit} title="Switch to the dense cockpit view of this campaign.">
            view details →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Top-level ImmersiveMode — orchestrates phase transitions ──
export default function ImmersiveMode({
  campaigns,
  settings,
  userCampaignState,
  onCreated,
  onOpen,
  onExit,
  onSettings,
  onOpenGate,
  onOpenDossier,
  seed
}) {
  const modelLabel = activeModelLabel(settings);
  const modelHasKey = !!settings?.anthropic?.configured;

  // Resume whatever the user was doing if they exited and re-entered.
  //   userCampaignState present  → running
  //   seed.brief present         → brief_review (drafted but not submitted)
  //   seed.sourceText present    → idle with the text restored
  //   otherwise                  → idle blank
  const initialPhase = userCampaignState
    ? "running"
    : seed?.brief
    ? "brief_review"
    : "idle";
  const [phase, setPhase] = useState(initialPhase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [draftedBrief, setDraftedBrief] = useState(seed?.brief || null);
  const [sourceText, setSourceText] = useState(seed?.sourceText || "");

  useEffect(() => {
    if (userCampaignState) setPhase("running");
  }, [userCampaignState?.campaign?.id]);

  // From idle: send notes to /api/draft-brief, get brief, jump to review.
  // The text comes from IdleLayer (current input) and is also mirrored
  // into our sourceText state via onTextChange so it persists if the
  // user exits + re-enters mid-draft.
  const submitIdea = async (text) => {
    setError(null);
    setBusy(true);
    setSourceText(text);
    setPhase("drafting");
    try {
      const res = await fetch("/api/draft-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not draft brief.");
      setDraftedBrief(body.brief || {});
      setPhase("brief_review");
    } catch (e) {
      setError(e.message || String(e));
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  };

  // From brief_review: create campaign, add source, kick off Stage 1.
  const beginReading = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founder_intent: sourceText, brief: draftedBrief })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create campaign.");
      let state = body.current_state;
      if (sourceText.trim()) {
        const noteRes = await fetch(`/api/campaigns/${body.campaign.id}/source-note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sourceText })
        });
        state = await noteRes.json();
      }
      // Fire-and-forget the streaming Stage 1 run; SSE will push state updates.
      fetch(`/api/campaigns/${body.campaign.id}/stream-stage1`, { method: "POST" }).catch(() => {});
      onCreated?.(state);
      setPhase("running");
    } catch (e) {
      setError(e.message || String(e));
      setPhase("brief_review");
    } finally {
      setBusy(false);
    }
  };

  // Exit hands the parent the current phase + any in-progress payload
  // so it can route to the right destination:
  //   idle          → Campaign Home (empty)
  //   drafting/brief_review → CampaignStartFlow with idea + brief pre-filled
  //   running       → cockpit (campaign already exists in state)
  const exitWithContext = () => {
    if (phase === "idle") {
      onExit?.({ phase, sourceText: "", brief: null });
    } else if (phase === "drafting" || phase === "brief_review") {
      onExit?.({ phase, sourceText, brief: draftedBrief });
    } else {
      onExit?.({ phase, sourceText: "", brief: null });
    }
  };

  // Exit-button copy is honest about what's about to happen.
  const exitLabel =
    phase === "running"
      ? { text: "exit to cockpit", title: "Switch to the dense cockpit view of this campaign." }
      : phase === "drafting" || phase === "brief_review"
      ? { text: "exit to brief", title: "Continue editing the brief in the campaign-start form." }
      : { text: "exit immersive", title: "Return to the campaign list." };

  return (
    <div className="immersive-shell editorial">
      <ImmersiveTop modelLabel={modelLabel} onExit={exitWithContext} exitLabel={exitLabel} onSettings={onSettings} />
      <main className="im-main">
        <ParticleField />
        {phase === "idle" && (
          <IdleLayer
            campaigns={campaigns}
            onSubmit={submitIdea}
            onOpen={onOpen}
            busy={busy}
            error={error}
            modelHasKey={modelHasKey}
            onSettings={onSettings}
            initialText={sourceText}
            onTextChange={setSourceText}
          />
        )}
        {phase === "drafting" && (
          <DraftingLayer note="Claude is composing the brief from your notes." />
        )}
        {phase === "brief_review" && draftedBrief && (
          <BriefReviewLayer
            brief={draftedBrief}
            onBegin={beginReading}
            busy={busy}
            sourceText={sourceText}
          />
        )}
        {phase === "running" && (
          <RunningLayer
            data={userCampaignState}
            onExit={exitWithContext}
            onOpenGate={onOpenGate}
            onOpenDossier={onOpenDossier}
          />
        )}
      </main>
    </div>
  );
}
