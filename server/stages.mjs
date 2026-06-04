// Stage 1, 2, 3, and dossier orchestration.
//
// Every public function takes (context, emit) where:
//   context = { campaignId, state, settings, sources, paths, fileApi }
//   emit    = function(event, data) — pushes an SSE-shaped event to listeners
//
// The orchestrator owns:
//   - building per-agent input context with allowed/forbidden context enforced
//   - calling the LLM
//   - merging structured output back into the campaign state (D-shape)
//   - writing per-stage artifact files to disk
//   - appending ledger events
//
// State produced here matches the prototype's window.DEMO shape so the
// React cockpit renders user campaigns identically to the demo.

import { runAgent, runText, ROLES } from "./agents.mjs";

function nowIso() {
  return new Date().toISOString();
}
function nowClock() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}
function nowShort() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
function pad(n, w = 3) {
  return String(n).padStart(w, "0");
}

function appendLedger(state, kind, text, run, extra = {}) {
  const event = { ts: nowClock(), kind, text, run, ...extra };
  state.ledger = [event, ...(state.ledger || [])].slice(0, 200);
  return event;
}

function bumpStatus(state, { run_started, run_finished, cost_delta }) {
  state.status = state.status || {
    stage: 1,
    in_flight_runs: 0,
    in_flight_agents: 0,
    cost_spent: 0,
    cost_cap: 5,
    elapsed_min: 0,
    cap_min: 23,
    pulse: Array(40).fill(0),
    unread_signal_cards: 0,
    last_pulse_at: 0,
    run_started_at: null
  };
  const now = Date.now();
  if (run_started) {
    state.status.in_flight_runs += 1;
    // Stamp the wall-clock start so elapsed_min is real, not synthetic.
    if (!state.status.run_started_at) state.status.run_started_at = now;
  }
  if (run_finished) {
    state.status.in_flight_runs = Math.max(0, state.status.in_flight_runs - 1);
    if (state.status.in_flight_runs === 0) state.status.run_started_at = null;
  }
  if (cost_delta) state.status.cost_spent = +(state.status.cost_spent + cost_delta).toFixed(4);

  // elapsed_min reflects the in-flight run's wall clock. Zero when idle.
  state.status.elapsed_min = state.status.run_started_at
    ? +((now - state.status.run_started_at) / 60000).toFixed(2)
    : 0;
  // in_flight_agents is derived from the agent roster — agents whose
  // state isn't "completed" are still working.
  state.status.in_flight_agents = (state.agents || []).filter(a => a.state !== "completed").length;

  // Pulse only ticks on real LLM activity (cost_delta means a model call
  // just landed). run_started / run_finished push a 0 so the line
  // settles flat when nothing is happening, instead of synthetic noise.
  const sample = cost_delta ? Math.max(1, Math.round((cost_delta || 0) * 100)) : 0;
  const pulse = (state.status.pulse || []).slice();
  pulse.push(sample);
  state.status.pulse = pulse.slice(-40);
  state.status.last_pulse_at = now;
}

function ensureCampaignFrame(state) {
  state.stages = state.stages || [
    { id: 1, name: "Real-data collector" },
    { id: 2, name: "Brainstorm + microtests" },
    { id: 3, name: "Simulated pilot" }
  ];
  state.opp_clusters = state.opp_clusters || [];
  state.directions = state.directions || [];
  state.artifacts = state.artifacts || [];
  state.cleared = state.cleared || [];
  state.evidence = state.evidence || [];
  state.hypotheses = state.hypotheses || [];
  state.tensions = state.tensions || [];
  state.microtests = state.microtests || [];
  state.runs = state.runs || [];
  state.agents = state.agents || [];
  state.qa = state.qa || [];
  state.gate_queue = state.gate_queue || [];
  state.personas = state.personas || [];
  state.defense_records = state.defense_records || {};
  state.what_you_missed = state.what_you_missed || [];
  state.cos_transcript = state.cos_transcript || [];
  // Founder rejections: anti-patterns the LLM should avoid in
  // subsequent producer runs and Stage 2 strategist invocations.
  state.rejections = state.rejections || [];
}

function setAgentRunning(state, agentDef) {
  state.agents = state.agents.filter(a => a.id !== agentDef.id);
  state.agents.push({ ...agentDef, state: agentDef.state || "thinking" });
}

function completeAgent(state, agentId, patch) {
  state.agents = state.agents.map(a =>
    a.id === agentId ? { ...a, state: "completed", ...patch } : a
  );
}

// ────────────────────────────────────────────────────────────
// Stage 1: Real-Data Collector
// ────────────────────────────────────────────────────────────

export async function runStage1({ campaignId, state, settings, sources, fileApi, signal }, emit) {
  ensureCampaignFrame(state);
  const apiKey = settings?.anthropic?.apiKey;
  const model = settings?.anthropic?.model;
  // No hard key requirement: an empty key falls back to the authenticated
  // Claude CLI in server/llm.mjs (which surfaces a clear error if the CLI
  // isn't logged in either).
  if (!sources?.length) throw new Error("Add at least one source before running Stage 1.");

  state.mode = "stage1_streaming";
  state.campaign.stage = "stage1";
  state.campaign.status = "stage1_running";
  bumpStatus(state, { run_started: true });
  appendLedger(state, "fresh", "Stage 1 reading started — Builder, Tester, Evaluator harness engaged.", "stage1/run");
  emit("state", state);

  const sourcesPayload = sources.map(s => ({
    id: s.source.id,
    file: s.source.filename,
    modality: s.source.modality,
    text: s.text.slice(0, 8000)
  }));
  const ontology = ROLES.stage1_extractor.allowed_context;
  const campaignBrief = {
    name: state.campaign.name,
    search_domain: state.campaign.search_domain,
    constraints: state.campaign.constraints || state.campaign.strategic_constraints || {}
  };

  // ---- Extractor (Builder) ----
  const extractorJob = "stage1_extractor_001";
  setAgentRunning(state, {
    id: extractorJob,
    role: "Evidence Extractor",
    team: "Builder",
    state: "reading",
    item: "evidence",
    task: "Lift decision-useful evidence cards with provenance"
  });
  emit("agent_delta", { id: extractorJob, state: "reading", current_output: "Reading raw sources..." });

  const extractor = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage1_extractor",
    jobId: extractorJob,
    itemId: "evidence",
    task: `Extract atomic evidence cards from these ${sourcesPayload.length} source(s). Aim for 8-18 cards. Each card must trace to a source span and carry a direct quote. Use only the typed ontology.`,
    contextValues: {
      raw_sources: sourcesPayload,
      ontology,
      campaign_brief: campaignBrief
    }
  });

  const evidence = (extractor.output.evidence_cards || []).map((c, i) => ({
    id: `ev_${pad(i + 1)}`,
    type: c.type || "user_quote",
    claim: c.claim,
    source: {
      id: c.source_id,
      file: sourcesPayload.find(s => s.id === c.source_id)?.file || c.source_id,
      span: c.source_span || "",
      quote: c.source_quote || ""
    },
    conf: typeof c.extraction_confidence === "number" ? c.extraction_confidence : 0.7,
    status: "active"
  }));

  state.evidence = evidence;
  bumpStatus(state, { cost_delta: extractor.job.cost_usd });
  completeAgent(state, extractorJob, { note: `${evidence.length} evidence cards extracted`, cost_usd: extractor.job.cost_usd, model: extractor.job.model });
  appendLedger(state, "keep", `Evidence Extractor returned ${evidence.length} cards.`, "stage1/extract");
  fileApi.writeJsonl("evidence/cards.jsonl", evidence);
  fileApi.writeJson("stage1/extractor_job.json", extractor.job);

  // Stream cards to UI
  for (const ev of evidence) emit("evidence_card", ev);
  emit("state", state);

  // ---- Clusterer (Builder) ----
  const clustererJob = "stage1_clusterer_001";
  setAgentRunning(state, {
    id: clustererJob,
    role: "Opportunity Clusterer",
    team: "Builder",
    state: "drafting",
    item: "opp_clusters",
    task: "Cluster evidence into opportunity clusters and surface tensions"
  });
  emit("agent_delta", { id: clustererJob, state: "drafting", current_output: "Clustering evidence into opportunity hypotheses..." });

  const clusterer = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage1_clusterer",
    jobId: clustererJob,
    itemId: "opp_clusters",
    task: `Stage 1 is divergent by design — go WIDE before going narrow. From the ${evidence.length} evidence cards, generate AT LEAST 40 opportunity hypotheses (target 60-100 — push every distinct segment×pain×wedge combination the evidence supports; do NOT stop early). Every hypothesis is a specific segment+job+pain+wedge grounded in 1+ evidence card ids. Same segment can host many hypotheses with different wedges; same wedge can hit many segments. Then group them into 6-12 opportunity clusters using hypothesis_indices — every hypothesis belongs to exactly one cluster. Set initial_confidence per cluster: clusters with strong evidence + clear pain + viable wedge should hit 0.60-0.80 (multiple can clear 0.60 — that's expected; the gate surfaces ALL of them as parallel leads). Surface 2-5 tensions for Stage 2 to test. Be specific to THIS founder's material — never generic.`,
    contextValues: {
      evidence_cards: evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim, source_id: e.source.id, source_quote: e.source.quote })),
      campaign_brief: campaignBrief,
      ontology
    },
    maxTokens: 16000
  });

  // Persist hypotheses with stable ids hyp_001…hyp_NNN.
  const rawHyps = clusterer.output.opportunity_hypotheses || [];
  const hypotheses = rawHyps.map((h, i) => ({
    id: `hyp_${pad(i + 1)}`,
    segment: h.segment,
    job: h.job,
    pain: h.pain,
    current_workaround: h.current_workaround,
    opportunity: h.opportunity,
    evidence_card_ids: h.evidence_card_ids || [],
    initial_confidence: h.initial_confidence || {},
    cluster_id: null  // filled by the cluster mapping below
  }));
  state.hypotheses = hypotheses;

  // Sort cluster output by initial_confidence descending so the most
  // confident cluster lands at index 0 — that's the canonical "lead".
  // Multiple clusters can be advanced as parallel branches at the gate.
  const rawClusters = (clusterer.output.opportunity_clusters || []).slice().sort((a, b) => {
    const ca = typeof a.initial_confidence === "number" ? a.initial_confidence : 0.5;
    const cb = typeof b.initial_confidence === "number" ? b.initial_confidence : 0.5;
    return cb - ca;
  });

  // LEAD_THRESHOLD: clusters with confidence at or above this are
  // automatically marked "lead" so the founder sees multiple high-conf
  // candidates without having to pick. Below threshold sit as "held"
  // — still advanceable but visually quieter.
  const LEAD_THRESHOLD = 0.6;

  const clusters = rawClusters.map((c, i) => {
    const conf = typeof c.initial_confidence === "number" ? c.initial_confidence : 0.5;
    const band = typeof c.confidence_band === "number" ? c.confidence_band : 0.1;
    const cid = `opp_${pad(i + 1)}`;
    const memberHypIds = (c.hypothesis_indices || [])
      .map(idx => hypotheses[idx]?.id)
      .filter(Boolean);
    // Back-fill hypothesis.cluster_id so each hypothesis knows its home.
    for (const hid of memberHypIds) {
      const h = hypotheses.find(x => x.id === hid);
      if (h) h.cluster_id = cid;
    }
    return {
      id: cid,
      name: c.name,
      conf,
      band,
      ev: (c.evidence_card_ids || []).length,
      ten: 0,
      hypotheses: memberHypIds.length,
      defense: "0 / 0 held",
      state: conf >= LEAD_THRESHOLD ? "lead" : "held",
      note: c.note || c.opportunity || "",
      descendants: [],
      segment: c.segment,
      pain: c.pain,
      current_workaround: c.current_workaround,
      opportunity: c.opportunity,
      evidence_card_ids: c.evidence_card_ids || [],
      hypothesis_ids: memberHypIds,
      key_uncertainties: c.key_uncertainties || [],
      recommended_microtests: c.recommended_microtests || []
    };
  });

  // Any hypotheses the model didn't explicitly cluster get parked in a
  // synthetic "unclustered" bucket so we don't lose them on the floor.
  const orphans = hypotheses.filter(h => !h.cluster_id);
  if (orphans.length > 0) {
    const orphanCid = `opp_${pad(clusters.length + 1)}`;
    const orphanCluster = {
      id: orphanCid,
      name: "Other hypotheses",
      conf: 0.35,
      band: 0.16,
      ev: Array.from(new Set(orphans.flatMap(h => h.evidence_card_ids || []))).length,
      ten: 0,
      hypotheses: orphans.length,
      defense: "0 / 0 held",
      state: "held",
      note: "Hypotheses the clusterer didn't group — kept for the gate review.",
      descendants: [],
      hypothesis_ids: orphans.map(h => h.id),
      evidence_card_ids: Array.from(new Set(orphans.flatMap(h => h.evidence_card_ids || []))),
      key_uncertainties: [],
      recommended_microtests: []
    };
    for (const h of orphans) h.cluster_id = orphanCid;
    clusters.push(orphanCluster);
  }

  const tensions = (clusterer.output.tensions || []).map((t, i) => ({
    id: `con_${pad(i + 1)}`,
    topic: t.topic,
    a: t.claim_a,
    b: t.claim_b,
    linked: t.linked_evidence_ids || [],
    implication: t.implication
  }));

  // count tensions per cluster (rough mapping by linked evidence)
  for (const cluster of clusters) {
    const linkedIds = new Set(cluster.evidence_card_ids);
    cluster.ten = tensions.filter(t => (t.linked || []).some(id => linkedIds.has(id))).length;
  }

  state.opp_clusters = clusters;
  state.tensions = tensions;
  // Pin the previously-running agents to the freshly-created lead cluster
  // so the Item view's mini-hex indicators visibly attach to the cluster
  // they helped produce. Without this they point at placeholder ids
  // ("evidence", "opp_clusters") which don't match any node.
  const leadClusterId = clusters[0]?.id;
  if (leadClusterId) {
    state.agents = state.agents.map(a =>
      (a.id === extractorJob || a.id === clustererJob) ? { ...a, item: leadClusterId } : a
    );
  }
  bumpStatus(state, { cost_delta: clusterer.job.cost_usd });
  const leadCount = clusters.filter(c => c.state === "lead").length;
  completeAgent(state, clustererJob, { note: `${hypotheses.length} hypotheses → ${clusters.length} clusters · ${leadCount} lead${leadCount === 1 ? "" : "s"} · ${tensions.length} tensions`, cost_usd: clusterer.job.cost_usd, model: clusterer.job.model, item: leadClusterId });
  appendLedger(state, "keep", `Clusterer: ${hypotheses.length} hypotheses grouped into ${clusters.length} clusters (${leadCount} above lead threshold), ${tensions.length} tensions.`, "stage1/cluster");
  fileApi.writeJsonl("stage1/opportunity_clusters.jsonl", clusters);
  fileApi.writeJsonl("stage1/hypotheses.jsonl", hypotheses);
  fileApi.writeJsonl("evidence/contradictions.jsonl", tensions);
  fileApi.writeJson("stage1/clusterer_job.json", clusterer.job);

  for (const cluster of clusters) emit("cluster", cluster);
  for (const tension of tensions) emit("tension", tension);
  emit("state", state);

  // ---- Evaluator (Defense Records) ----
  const evaluatorJob = "stage1_evaluator_001";
  setAgentRunning(state, {
    id: evaluatorJob,
    role: "Evidence Provenance Auditor",
    team: "Evaluator",
    state: "auditing",
    item: leadClusterId || "opp_clusters",
    task: "Audit grounding, surface defense record entries"
  });
  emit("agent_delta", { id: evaluatorJob, state: "auditing", current_output: "Running Skeptic, Coverage, and Bias auditors against each cluster..." });

  const evaluator = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage1_evaluator",
    jobId: evaluatorJob,
    itemId: "opp_clusters",
    task: `For each opportunity cluster, produce a defense record with at least 4 challenge entries spanning Skeptic, Coverage, Bias, and Method dimensions. Verdicts must be grounded in source spans.`,
    contextValues: {
      raw_sources: sourcesPayload,
      evidence_cards: evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim, source_id: e.source.id })),
      opportunity_clusters: clusters.map(c => ({ id: c.id, name: c.name, segment: c.segment, pain: c.pain, evidence_card_ids: c.evidence_card_ids })),
      tensions
    }
  });

  for (const dr of evaluator.output.defense_records || []) {
    const cluster = clusters[dr.cluster_index];
    if (!cluster) continue;
    const entries = dr.entries || [];
    const held = entries.filter(e => e.verdict === "Held").length;
    const total = entries.length;
    cluster.defense = `${held} / ${total} held`;
    state.defense_records[cluster.id] = {
      summary: dr.summary || `${held} of ${total} held`,
      entries
    };
  }
  for (const w of evaluator.output.leakage_warnings || []) {
    state.qa.push({ sev: "warn", kind: w.kind || "leakage", text: w.text, run: w.run || "stage1/evaluator" });
  }

  bumpStatus(state, { cost_delta: evaluator.job.cost_usd });
  completeAgent(state, evaluatorJob, { note: `Defense records persisted for ${(evaluator.output.defense_records || []).length} clusters`, cost_usd: evaluator.job.cost_usd, model: evaluator.job.model, item: leadClusterId });
  appendLedger(state, "keep", `Stage 1 evaluator audit complete; defense records persisted.`, "stage1/audit");
  fileApi.writeJsonl("stage1/defense_records.jsonl", Object.entries(state.defense_records).map(([id, dr]) => ({ id, ...dr })));
  fileApi.writeJson("stage1/evaluator_job.json", evaluator.job);

  // ---- Gate ----
  // Surface every viable cluster so the gate modal can list them as
  // independent advance candidates. The human picks which to advance
  // (one or many in parallel) or asks for more alternatives.
  const lead = clusters[0];
  const candidates = clusters
    .filter(c => c.state !== "cleared" && c.state !== "discounted")
    .map(c => ({
      id: c.id,
      name: c.name,
      defense: c.defense,
      conf: c.conf,
      ev: c.ev,
      ten: c.ten,
      hypotheses: c.hypotheses,
      state: c.state,
      note: c.note
    }));
  const leadsCount = candidates.filter(c => c.state === "lead").length;
  state.gate_queue = [
    {
      id: "gate_stage1_to_stage2",
      kind: "stage_1_to_2",
      primary: lead?.name || "Lead opportunity cluster",
      one_liner: `${hypotheses.length} hypotheses · ${candidates.length} clusters · ${leadsCount} lead${leadsCount === 1 ? "" : "s"} · ${tensions.length} tension${tensions.length === 1 ? "" : "s"}.`,
      queued: nowShort(),
      recommendation: leadsCount > 1
        ? `${leadsCount} clusters cleared the lead threshold (conf ≥ 0.60). Advance one or several as parallel Stage 2 branches.`
        : candidates.length > 1
        ? `${candidates.length} clusters surfaced. The lead is ${lead?.id}. Pick more if their wedges read distinct.`
        : `Advance ${lead?.id || "the lead cluster"} to Stage 2.`,
      candidates,
      compounding: ""
    }
  ];
  state.mode = "stage1_gate";
  state.campaign.status = "stage1_gate_ready";

  bumpStatus(state, { run_finished: true });
  emit("state", state);
  return state;
}

// ────────────────────────────────────────────────────────────
// Stage 2: Brainstorm + Microtests
// ────────────────────────────────────────────────────────────

export async function runStage2({ campaignId, state, settings, fileApi, signal }, emit) {
  ensureCampaignFrame(state);
  const apiKey = settings?.anthropic?.apiKey;
  const model = settings?.anthropic?.model;
  // No hard key requirement: an empty key falls back to the authenticated
  // Claude CLI in server/llm.mjs (which surfaces a clear error if the CLI
  // isn't logged in either).
  // Every cluster the founder advanced at the Stage 1 gate becomes its
  // own parallel branch in Stage 2. The previous implementation only
  // processed state.opp_clusters[0], collapsing N picks back into 1.
  const advancedClusters = (state.opp_clusters || []).filter(c => c.state === "advanced");
  if (advancedClusters.length === 0) {
    if (!(state.opp_clusters || []).length) {
      throw new Error("Stage 1 has not produced any clusters yet — re-run Stage 1 first.");
    }
    throw new Error("No opportunity clusters were advanced. Open the Stage 1 → 2 gate and click Advance on at least one cluster, then re-run Stage 2.");
  }

  state.mode = "stage2_running";
  state.campaign.stage = "stage2";
  state.campaign.status = "stage2_running";
  bumpStatus(state, { run_started: true });
  appendLedger(state, "fresh", `Stage 2 brainstorm engaged on ${advancedClusters.length} parallel branch${advancedClusters.length === 1 ? "" : "es"}: ${advancedClusters.map(c => c.id).join(", ")}.`, "stage2/run");
  emit("state", state);

  // Stage 1 rejections inform every Stage 2 branch — don't propose
  // direction wedges that map onto patterns the founder already
  // rejected.
  const upstreamRejections = (state.rejections || []).filter(r => r.kind === "cluster" || r.kind === "hypothesis");
  const stage2RejectPrompt = upstreamRejections.length === 0
    ? ""
    : ` Avoid wedges that resemble these rejected upstream patterns:\n${upstreamRejections.slice(0, 12).map(r => `- ${r.kind} "${r.target_name}"${r.reason ? `: ${r.reason}` : ""}`).join("\n")}`;

  // Start fresh — we want directions to only reflect the current run.
  // Previous direction sets get archived to file but cleared from state
  // so a re-run from Stage 1 doesn't leave stale rows.
  state.directions = [];
  // Microtest runs (with cousin responses) get persisted to state so the
  // frontend can render them. Previously they only landed on disk as
  // stage2/microtest_runs/*.json and the cockpit had no way to see the
  // actual cousin verdicts.
  state.microtests = [];
  const allDirections = [];
  const allMicrotests = [];
  let branchIdx = 0;
  for (const cluster of advancedClusters) {
    branchIdx += 1;
    const cIdx = pad(branchIdx);

    // ---- Strategist (Builder) — per cluster ----
    const stratJob = `stage2_strategist_${cluster.id}`;
    setAgentRunning(state, {
      id: stratJob,
      role: `Opportunity Strategist · ${cluster.id}`,
      team: "Builder",
      state: "thinking",
      item: cluster.id,
      task: `Propose product direction clusters for ${cluster.id} with microtest plans`
    });
    emit("agent_delta", { id: stratJob, state: "thinking", current_output: `Designing 2-4 distinct product direction wedges for ${cluster.id}...` });
    appendLedger(state, "fresh", `Branch ${branchIdx}/${advancedClusters.length} — strategist running on ${cluster.id} (${cluster.name}).`, "stage2/strategist");
    emit("state", state);

    const strategist = await runAgent({
      apiKey,
      model,
      signal,
      roleKey: "stage2_strategist",
      jobId: stratJob,
      itemId: cluster.id,
      // Stage 2 expands the funnel — decompose the cluster into many
      // small, independently-testable modules. Stage 3 will converge
      // them. So aim HIGH here.
      task: `Cluster: ${cluster.name}. Segment: ${cluster.segment || "—"}. Pain: ${cluster.pain || "—"}. Decompose this opportunity into 8-16 Product Direction MODULES. Each module is ONE atomic bet (pricing point, channel, framing, onboarding step, feature, format, etc) — small enough to die on its own from a single microtest. Each module gets a microtest plan (1-2 methods). Mark 1-2 as preferred. The goal is granular scrutiny: every assumption embedded in the cluster's wedge should appear as its own testable module.${stage2RejectPrompt}`,
      maxTokens: 14000,
      contextValues: {
        evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim })),
        opportunity_cluster: { id: cluster.id, name: cluster.name, segment: cluster.segment, pain: cluster.pain, key_uncertainties: cluster.key_uncertainties },
        tensions: state.tensions,
        ontology: ROLES.stage2_strategist.allowed_context
      }
    });

    const startDirIdx = state.directions.length;
    const branchDirections = (strategist.output.product_direction_clusters || []).map((d, i) => ({
      id: `pdc_${pad(startDirIdx + i + 1)}`,
      name: d.name,
      conf: typeof d.initial_confidence === "number" ? d.initial_confidence : 0.5,
      band: typeof d.confidence_band === "number" ? d.confidence_band : 0.1,
      microtests: (d.suggested_microtests || []).length,
      defense: "0 / 0 held",
      // Stage 2 modules surface as "module" state by default. The
      // microtest loop bumps the strongest-scoring ones to "lead"
      // (multi-lead on cluster basis). Modules can be held / rejected
      // by the founder at the gate.
      state: d.preferred ? "lead" : "module",
      wedge: d.wedge,
      module_kind: d.module_kind || "other",
      parents: [cluster.id],
      descendants: [],
      core_uncertainties: d.core_uncertainties || [],
      suggested_microtests: d.suggested_microtests || [],
      // Concrete artifact stub the tester reacts to. Without this the
      // microtest is abstract business chatter; with it the test is a
      // real UX research method against a low-fi product surface.
      artifact_sketch: d.artifact_sketch || null
    }));
    // Cap leads per branch so the gate doesn't drown in green pips —
    // top 2 preferred modules become leads, the rest start as
    // "module".
    let leadsThisBranch = 0;
    for (const d of branchDirections) {
      if (d.state === "lead") {
        if (leadsThisBranch >= 2) d.state = "module";
        else leadsThisBranch += 1;
      }
    }
    if (leadsThisBranch === 0 && branchDirections[0]) {
      branchDirections[0].state = "lead";
    }
    cluster.descendants = branchDirections.map(d => d.id);
    state.directions = [...state.directions, ...branchDirections];
    allDirections.push(...branchDirections);

    bumpStatus(state, { cost_delta: strategist.job.cost_usd });
    completeAgent(state, stratJob, { note: `${branchDirections.length} modules proposed for ${cluster.id}`, cost_usd: strategist.job.cost_usd, model: strategist.job.model });
    appendLedger(state, "keep", `Strategist decomposed ${cluster.id} into ${branchDirections.length} testable modules.`, "stage2/strategist");
    fileApi.writeJson(`stage2/strategist_job_${cluster.id}.json`, strategist.job);
    emit("state", state);

    // ---- Blinded Tester runs — microtest EVERY module (capped per
    // branch) so each atomic bet gets independently scrutinized, not
    // just the lead. The user previously saw 1 microtest per cluster;
    // they should now see one per module so the failure pattern is
    // visible across the entire battery. Cap per branch so a cluster
    // with 16 modules doesn't run away with cost.
    const MAX_MICROTESTS_PER_BRANCH = 8;
    const branchModulesToTest = branchDirections
      .slice()
      .sort((a, b) => {
        // Leads first, then by initial confidence descending so the
        // most-believed modules get tested when capped.
        const aRank = (a.state === "lead" ? 0 : 1);
        const bRank = (b.state === "lead" ? 0 : 1);
        if (aRank !== bRank) return aRank - bRank;
        return (b.conf || 0) - (a.conf || 0);
      })
      .slice(0, MAX_MICROTESTS_PER_BRANCH);

    let mtIdx = 0;
    for (const moduleUnderTest of branchModulesToTest) {
      const spec = (moduleUnderTest.suggested_microtests || [])[0]
        || { method: "value_proposition_test", purpose: `Probe ${moduleUnderTest.name} for adoption signal.` };
      mtIdx += 1;
      const mtId = `mt_${cluster.id}_${pad(mtIdx)}`;
      const testerJob = `stage2_tester_${cluster.id}_${pad(mtIdx)}`;
      setAgentRunning(state, {
        id: testerJob,
        role: `Blinded Tester · ${spec.method} (${moduleUnderTest.id})`,
        team: "Tester",
        state: "responding",
        item: moduleUnderTest.id,
        task: spec.purpose || `Run ${spec.method} on ${moduleUnderTest.id}`
      });
      state.runs.push({
        id: `stage2/${mtId}`,
        team: "Tester",
        role: "blinded",
        state: "running",
        item: moduleUnderTest.id,
        elapsed: "00:01",
        note: `${spec.method} · ${spec.purpose || ""}`
      });
      emit("agent_delta", { id: testerJob, state: "responding", current_output: `Running ${spec.method} blinded against ${moduleUnderTest.id}` });

      // Build a CONCRETE, method-specific scenario. The blinded tester
      // is reacting to a real product surface (nav tree, hero copy,
      // pricing page, CTA, card-sort label set), not a business
      // discussion. The artifact_sketch is rendered inline so the
      // tester sees what an end user would see in low-fi.
      const sketch = moduleUnderTest.artifact_sketch || {};
      const renderSketch = () => {
        const parts = [];
        if (sketch.surface) parts.push(`Surface: ${sketch.surface}`);
        if (sketch.primary_text) parts.push(`Headline / label / CTA: "${sketch.primary_text}"`);
        if (sketch.body_text) parts.push(`Body / supporting copy: ${sketch.body_text}`);
        if (sketch.structure) parts.push(`Structure:\n${sketch.structure}`);
        return parts.join("\n");
      };
      const methodScript = (method) => {
        switch (method) {
          case "tree_testing":
            return `You are doing a TREE TEST. Look at the navigation tree shown. To accomplish the task described, name the EXACT label you would click first, then the label you would click second. If you'd give up, say so honestly.`;
          case "first_click_test":
            return `You are doing a FIRST-CLICK TEST. Look at the interface section shown. To accomplish the task described, name the SINGLE thing you'd click first. Don't deliberate.`;
          case "card_sorting":
            return `You are doing a CARD SORT. Look at the list of labels. Group them into 2-5 categories that make sense to you. Name each category in your own words. If a label doesn't fit anywhere, say so.`;
          case "fake_door_intent":
            return `You see a CTA button or signup link. Imagine you've just landed on this page. State whether you'd click it RIGHT NOW (yes/no/maybe) and explain in one sentence why. If "maybe", say what would tip you to yes.`;
          case "value_proposition_test":
            return `Read the hero copy / headline / sub. In your own words, ONE sentence: (a) what does this product do, and (b) who is it for? If you can't tell, say so.`;
          case "pain_ranking":
            return `Look at the list of pains. Rank them from MOST painful (1) to LEAST painful in your actual day-to-day. If a pain doesn't apply to you, mark it N/A and say why.`;
          case "objection_simulation":
            return `You see the offer/feature/pricing. Voice your FIRST objection out loud, exactly as you'd say it to a friend. What would have to be true for you to stop objecting?`;
          case "competitive_substitution":
            return `You see this offering. What are you using TODAY to handle this problem (free or paid)? Would you switch? Why / why not?`;
          case "pricing_acceptance":
            return `Look at the price shown. Without thinking too long, react: "expensive" / "fair" / "cheap" / "no idea what value I'd get". Then say what price would feel obviously right.`;
          default:
            return `React to what you see in your own voice. State whether you'd engage with it, what's confusing, and what you'd want next.`;
        }
      };
      const scenario = [
        `You are a cousin of the segment: ${cluster.segment || "target user"}.`,
        `You're encountering this as a real product surface, low-fidelity:`,
        renderSketch(),
        ``,
        `Method instruction: ${methodScript(spec.method)}`,
        ``,
        `Task: ${sketch.tester_task || spec.purpose || "React in your own voice."}`,
        ``,
        `Speak in 1-3 short sentences. If something is missing or unclear, say so honestly. Do NOT pretend you understand if you don't.`
      ].join("\n");

      const tester = await runAgent({
        apiKey,
        model,
        signal,
        roleKey: "stage2_tester",
        jobId: testerJob,
        itemId: mtId,
        task: `Produce 5-7 cousin responses (different cousins of the same persona type) reacting to the scenario. Each cousin is a DIFFERENT person of the same archetype — vary background, mood, prior context. Keep blinded — you have NO knowledge of what the harness wants.`,
        contextValues: {
          assigned_scenario: scenario,
          assigned_role: `member of segment '${cluster.segment || "target"}'`,
          necessary_artifact: renderSketch() || `Module: ${moduleUnderTest.name} · ${moduleUnderTest.wedge}`
        }
      });

      bumpStatus(state, { cost_delta: tester.job.cost_usd });
      completeAgent(state, testerJob, { note: `${(tester.output.tester_responses || []).length} cousin responses`, cost_usd: tester.job.cost_usd, model: tester.job.model, item: moduleUnderTest.id });
      state.runs = state.runs.filter(r => r.id !== `stage2/${mtId}`);

      const microtestResult = {
        id: mtId,
        cluster_id: cluster.id,
        direction_id: moduleUnderTest.id,
        method: spec.method,
        purpose: spec.purpose,
        responses: tester.output.tester_responses || []
      };
      allMicrotests.push(microtestResult);
      state.microtests = [...(state.microtests || []), microtestResult];
      fileApi.writeJson(`stage2/microtest_runs/${mtId}.json`, microtestResult);
      appendLedger(state, "keep", `${spec.method} returned ${(tester.output.tester_responses || []).length} responses for ${moduleUnderTest.id}.`, `stage2/${mtId}`);
      emit("state", state);
    }

    // ---- Evaluator (Method Auditor) — per branch, scores every
    // microtested module, not just the lead. Updates per-module
    // confidence so the gate can show winners/losers.
    const branchMicrotests = allMicrotests.filter(r => r.cluster_id === cluster.id);
    const evalJob = `stage2_evaluator_${cluster.id}`;
    setAgentRunning(state, {
      id: evalJob,
      role: `Method Auditor · ${cluster.id}`,
      team: "Evaluator",
      state: "auditing",
      item: cluster.id,
      task: "Score microtests per module, build defense records, surface winners/losers"
    });
    emit("agent_delta", { id: evalJob, state: "auditing", current_output: `Auditing ${branchMicrotests.length} microtest battery across ${branchDirections.length} modules for ${cluster.id}...` });

    const evaluator = await runAgent({
      apiKey,
      model,
      signal,
      roleKey: "stage2_evaluator",
      jobId: evalJob,
      itemId: cluster.id,
      task: `Audit ${branchMicrotests.length} microtest runs across ${branchDirections.length} modules of cluster ${cluster.id}. Build a defense record covering all challenge dimensions and update per-module confidence so the founder can see which atomic bets held and which failed.`,
      contextValues: {
        microtest_spec: branchMicrotests.map(r => ({ id: r.id, direction_id: r.direction_id, method: r.method, purpose: r.purpose })),
        tester_responses: branchMicrotests,
        product_direction_cluster: { id: cluster.id, name: cluster.name, wedge: cluster.opportunity, core_uncertainties: cluster.key_uncertainties },
        evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim }))
      },
      maxTokens: 10000
    });

    const dr = evaluator.output.defense_record;
    if (dr) {
      const held = (dr.entries || []).filter(e => e.verdict === "Held").length;
      const total = (dr.entries || []).length;
      // Attach the cluster-level defense to every direction in this branch
      // so each module card carries the audit context.
      for (const d of branchDirections) {
        d.defense = `${held} / ${total} held`;
      }
      state.defense_records[cluster.id] = { summary: dr.summary || `${held} of ${total} held`, entries: dr.entries || [] };
    }
    // Multi-module confidence update — the evaluator may return
    // confidence_update as a single object or an array of {direction_id, new_conf}.
    const confUpdates = Array.isArray(evaluator.output.confidence_updates)
      ? evaluator.output.confidence_updates
      : evaluator.output.confidence_update
      ? [evaluator.output.confidence_update]
      : [];
    for (const cu of confUpdates) {
      const target = cu.direction_id
        ? branchDirections.find(d => d.id === cu.direction_id)
        : branchDirections[cu.direction_index || 0];
      if (!target) continue;
      if (typeof cu.new_conf === "number") target.conf = cu.new_conf;
      if (typeof cu.new_band === "number") target.band = cu.new_band;
    }

    bumpStatus(state, { cost_delta: evaluator.job.cost_usd });
    completeAgent(state, evalJob, { note: `${(dr?.entries || []).length} defense entries · ${branchMicrotests.length} microtests audited across ${branchDirections.length} modules`, cost_usd: evaluator.job.cost_usd, model: evaluator.job.model });
    appendLedger(state, "keep", `Stage 2 audit complete on branch ${cluster.id} — ${branchMicrotests.length} microtests across ${branchDirections.length} modules scored.`, "stage2/audit");
    fileApi.writeJson(`stage2/evaluator_job_${cluster.id}.json`, evaluator.job);
    emit("state", state);
  }

  // Final summary microtests view — flatten verdicts across all branches.
  const microtestsSummary = allMicrotests.map(r => ({
    id: r.id,
    cluster_id: r.cluster_id,
    direction_id: r.direction_id,
    method: r.method,
    finding: r.purpose,
    responses: (r.responses || []).length
  }));
  fileApi.writeJsonl("stage2/product_direction_clusters.jsonl", state.directions);
  fileApi.writeJson("stage2/microtests_summary.json", microtestsSummary);

  // Multi-candidate gate: surface every viable direction across every
  // branch. The human can pick one, several (parallel branches in Stage
  // 3), or ask for more. Apply the same LEAD_THRESHOLD here so any
  // direction whose evaluator-updated conf cleared 0.60 surfaces as a
  // cross-branch lead.
  const LEAD_THRESHOLD = 0.6;
  for (const d of state.directions) {
    if (typeof d.conf === "number" && d.conf >= LEAD_THRESHOLD && d.state === "held") d.state = "lead";
  }
  const dirCandidates = state.directions
    .filter(d => d.state !== "cleared" && d.state !== "discounted" && d.state !== "rejected")
    .map(d => ({ id: d.id, name: d.name, defense: d.defense, conf: d.conf, microtests: d.microtests, wedge: d.wedge, state: d.state, parents: d.parents, module_kind: d.module_kind, artifact_sketch: d.artifact_sketch }));
  const leadsAlive = dirCandidates.filter(d => d.state === "lead").length;
  const primaryLead = state.directions.find(d => d.state === "lead") || state.directions[0];
  // Preserve any non-Stage-2 gates (e.g. dossier) but rebuild the
  // stage_2_to_3 entry with the full multi-branch candidate list.
  const otherGates = (state.gate_queue || []).filter(g => g.kind !== "stage_2_to_3");
  state.gate_queue = [
    ...otherGates,
    {
      id: "gate_stage2_to_stage3",
      kind: "stage_2_to_3",
      primary: primaryLead?.name || "Lead direction",
      one_liner: `${advancedClusters.length} Stage-1 branch${advancedClusters.length === 1 ? "" : "es"} · ${dirCandidates.length} direction${dirCandidates.length === 1 ? "" : "s"} alive · ${leadsAlive} lead${leadsAlive === 1 ? "" : "s"} · ${allMicrotests.length} microtest${allMicrotests.length === 1 ? "" : "s"}`,
      queued: nowShort(),
      recommendation: leadsAlive > 1
        ? `${leadsAlive} directions cleared the lead threshold (conf ≥ 0.60). Advance one or several as parallel Stage 3 branches.`
        : `Pick any viable direction — multi-select to run parallel Stage 3 branches.`,
      candidates: dirCandidates,
      compounding: ""
    }
  ];
  state.mode = "stage2_gate";
  state.campaign.status = "stage2_gate_ready";
  bumpStatus(state, { run_finished: true });
  emit("state", state);
  return state;
}

// ────────────────────────────────────────────────────────────
// Stage 3: Simulated Pilot
// ────────────────────────────────────────────────────────────

export async function runStage3({ campaignId, state, settings, fileApi, signal }, emit) {
  ensureCampaignFrame(state);
  const apiKey = settings?.anthropic?.apiKey;
  const model = settings?.anthropic?.model;
  // No hard key requirement: an empty key falls back to the authenticated
  // Claude CLI in server/llm.mjs (which surfaces a clear error if the CLI
  // isn't logged in either).
  // Stage 3 CONVERGES. The founder advanced a SET of Stage-2 modules
  // (each an atomic bet — pricing, channel, framing, etc). Stage 3
  // integrates the surviving modules into a single cohesive concept
  // per parent CLUSTER, not per module. So if 6 modules advanced
  // across 2 parent clusters, Stage 3 produces 2 cohesive pilots (one
  // per cluster), each embodying that cluster's surviving modules.
  const advancedModules = (state.directions || []).filter(d => d.state === "lead" || d.state === "advanced");
  if (advancedModules.length === 0) {
    if (!(state.directions || []).length) {
      throw new Error("Stage 2 has not produced any directions yet — re-run Stage 2 first.");
    }
    throw new Error("No directions were advanced. Open the Stage 2 → 3 gate and click Advance on at least one module, then re-run Stage 3.");
  }
  // Group advanced modules by their parent cluster id so we run one
  // pilot per cluster.
  const clusterGroups = new Map();
  for (const m of advancedModules) {
    const parentId = (m.parents && m.parents[0]) || "unknown";
    if (!clusterGroups.has(parentId)) clusterGroups.set(parentId, []);
    clusterGroups.get(parentId).push(m);
  }

  state.mode = "stage3_running";
  state.campaign.stage = "stage3";
  state.campaign.status = "stage3_running";
  bumpStatus(state, { run_started: true });
  appendLedger(state, "fresh", `Stage 3 simulated pilot engaged — converging ${advancedModules.length} advanced module${advancedModules.length === 1 ? "" : "s"} into ${clusterGroups.size} cohesive concept${clusterGroups.size === 1 ? "" : "s"}.`, "stage3/run");
  emit("state", state);

  // Reset Stage 3 outputs so a re-run from Stage 2 doesn't leave stale
  // artifacts / personas / pilot_runs.
  state.artifacts = [];
  state.personas = [];
  state.pilot_runs = [];
  state.persona_responses = state.persona_responses || {};

  let branchIdx = 0;
  for (const [parentClusterId, modules] of clusterGroups.entries()) {
    branchIdx += 1;
    const parentCluster = (state.opp_clusters || []).find(c => c.id === parentClusterId);
    // The "lead" of this cohesive concept is the highest-confidence
    // module within the cluster, used to label the pilot run and the
    // gate candidate.
    const leadModule = modules.slice().sort((a, b) => (b.conf || 0) - (a.conf || 0))[0];
    const conceptLabel = parentCluster?.name || leadModule.name;

    appendLedger(state, "fresh", `Concept ${branchIdx}/${clusterGroups.size} — integrating ${modules.length} module${modules.length === 1 ? "" : "s"} of ${parentClusterId} into cohesive pilot.`, "stage3/run");
    emit("state", state);

    // ---- Plan Architect (per cluster, integrating all modules) ----
    const planJob = `stage3_planner_${parentClusterId}`;
    setAgentRunning(state, {
      id: planJob,
      role: `Stage 3 Plan Architect · ${parentClusterId}`,
      team: "Builder",
      state: "drafting",
      item: parentClusterId,
      task: `Integrate ${modules.length} advanced modules of ${parentClusterId} into one cohesive concept`
    });
    emit("agent_delta", { id: planJob, state: "drafting", current_output: `Integrating ${modules.length} modules of ${parentClusterId} into a single concept (stakeholders / artifacts / personas)...` });

    const moduleSummary = modules.map(m => `- ${m.id} (${m.module_kind || "module"}): ${m.name} — ${m.wedge}`).join("\n");
    const planner = await runAgent({
      apiKey,
      model,
      signal,
      roleKey: "stage3_planner",
      jobId: planJob,
      itemId: parentClusterId,
      task: `Cluster: ${conceptLabel}. The founder advanced ${modules.length} validated modules of this cluster from Stage 2:\n${moduleSummary}\n\nSynthesize them into ONE cohesive concept (not separate prototypes per module). Produce: a stakeholder map; an artifact plan of 3-5 prototypes that, taken together, embody the surviving modules; 2-3 personas grounded in specific evidence cards.`,
      maxTokens: 12000,
      contextValues: {
        product_direction_cluster: {
          id: parentClusterId,
          name: conceptLabel,
          wedge: parentCluster?.opportunity || leadModule.wedge,
          core_uncertainties: parentCluster?.key_uncertainties || leadModule.core_uncertainties || [],
          advanced_modules: modules.map(m => ({ id: m.id, name: m.name, wedge: m.wedge, module_kind: m.module_kind, conf: m.conf }))
        },
        evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim, source_quote: e.source.quote })),
        tensions: state.tensions,
        campaign_brief: { name: state.campaign.name, search_domain: state.campaign.search_domain }
      }
    });

    bumpStatus(state, { cost_delta: planner.job.cost_usd });
    completeAgent(state, planJob, { note: `Plan ready: ${(planner.output.artifact_plan || []).length} artifacts, ${(planner.output.personas || []).length} personas`, cost_usd: planner.job.cost_usd, model: planner.job.model });
    fileApi.writeJson(`stage3/stakeholder_maps/${parentClusterId}.json`, planner.output.stakeholders || []);
    fileApi.writeJson(`stage3/artifact_plans/${parentClusterId}.json`, planner.output.artifact_plan || []);
    fileApi.writeJson(`stage3/persona_compositions/${parentClusterId}_compositions.json`, planner.output.personas || []);

    const personaStartIdx = state.personas.length;
    const branchPersonas = (planner.output.personas || []).map((p, i) => ({
      id: `per_${pad(personaStartIdx + i + 1)}`,
      name: p.name,
      role: p.role,
      from: p.from_evidence_ids || [],
      cousins: p.cousins || 6,
      variance: p.variance_target || 0.18,
      improv_rate: 0.06,
      trait_provenance: p.trait_provenance || [],
      cluster_id: parentClusterId
    }));
    state.personas = [...state.personas, ...branchPersonas];

    // ---- Artifact Builder per artifact in this cohesive plan ----
    const artifactPlan = (planner.output.artifact_plan || []).slice(0, 4);
    const branchArtifacts = [];
    const artStartIdx = state.artifacts.length;
    for (let a = 0; a < artifactPlan.length; a += 1) {
      const brief = artifactPlan[a];
      const aId = `art_${pad(artStartIdx + a + 1)}`;
      const builderJob = `stage3_builder_${parentClusterId}_${pad(a + 1)}`;
      setAgentRunning(state, {
        id: builderJob,
        role: `Prototype Builder · ${parentClusterId}`,
        team: "Builder",
        state: "drafting",
        item: aId,
        task: `Generate ${brief.type} embodying surviving modules of ${parentClusterId}`
      });
      emit("agent_delta", { id: builderJob, state: "drafting", current_output: `Sketching ${brief.type} for ${brief.audience} (${parentClusterId})...` });

      const builder = await runAgent({
        apiKey,
        model,
        signal,
        roleKey: "stage3_artifact_builder",
        jobId: builderJob,
        itemId: aId,
        task: `Produce the ${brief.type} body for audience '${brief.audience}'. Purpose: ${brief.purpose}. Integrate these surviving Stage-2 modules: ${modules.map(m => m.name).join("; ")}. LOW-FI SKETCH REGISTER ONLY.`,
        contextValues: {
          artifact_brief: brief,
          product_direction_cluster: { id: parentClusterId, name: conceptLabel, wedge: parentCluster?.opportunity || leadModule.wedge },
          stakeholder_map: planner.output.stakeholders || [],
          evidence_cards: state.evidence.slice(0, 6).map(e => ({ id: e.id, claim: e.claim, source_quote: e.source.quote }))
        }
      });

      const art = builder.output.artifact || {};
      const artifact = {
        id: aId,
        name: art.name || `${brief.type} v1`,
        aud: art.audience || brief.audience,
        purpose: art.purpose || brief.purpose,
        qa: art.qa_state || "pending",
        qa_notes: art.qa_notes || "",
        state: art.qa_state === "fail" ? "warn" : "queued",
        parents: [parentClusterId, ...modules.map(m => m.id)],
        type: art.type || brief.type,
        body_markdown: art.body_markdown || "",
        // Structured preview for the artifact viewer modal. The shape
        // depends on `preview.kind` — see stage3_artifact_builder
        // schema_hint. Renders as a tangible low-fi mockup, not just
        // markdown text.
        preview: art.preview || null
      };
      branchArtifacts.push(artifact);
      state.artifacts = [...state.artifacts, artifact];
      bumpStatus(state, { cost_delta: builder.job.cost_usd });
      completeAgent(state, builderJob, { note: `${artifact.name} drafted (${artifact.qa})`, cost_usd: builder.job.cost_usd, model: builder.job.model });
      fileApi.writeJson(`stage3/artifacts/${aId}.json`, artifact);
      appendLedger(state, "keep", `Artifact ${aId} drafted: ${artifact.name} (${parentClusterId})`, `stage3/${aId}`);
      emit("state", state);
    }

    // Each surviving module gets the cluster's artifact descendants.
    for (const m of modules) m.descendants = branchArtifacts.map(a => a.id);

    // ---- Persona cousin simulation against this concept's flagship artifact ----
    const persona = branchPersonas[0];
    const flagshipArtifact = branchArtifacts[0];
    const cousinResponses = [];
    if (persona && flagshipArtifact) {
      const cousinCount = Math.min(persona.cousins, 6);
      for (let c = 0; c < cousinCount; c += 1) {
        const cousinJob = `stage3_persona_${persona.id}_${pad(c + 1)}`;
        setAgentRunning(state, {
          id: cousinJob,
          role: `${persona.name} (cousin ${c + 1})`,
          team: "Tester",
          state: "responding",
          item: flagshipArtifact.id,
          task: "React to artifact under blinded scenario"
        });
        emit("agent_delta", { id: cousinJob, state: "responding", current_output: `${persona.name} cousin ${c + 1} reacting (${parentClusterId})...` });

        const personaBrief = {
          name: persona.name,
          role: persona.role,
          evidence_ids: persona.from,
          traits: (persona.trait_provenance || []).map(tp => `${tp.trait} (from ${tp.source_id})`)
        };
        const sim = await runAgent({
          apiKey,
          model,
          signal,
          roleKey: "stage3_persona_simulator",
          jobId: cousinJob,
          itemId: flagshipArtifact.id,
          task: `Cousin ${c + 1} of 6. React to the artifact. 1-3 sentences in your voice.`,
          contextValues: {
            assigned_persona_brief: personaBrief,
            assigned_artifact: { type: flagshipArtifact.type, name: flagshipArtifact.name, body: (flagshipArtifact.body_markdown || "").slice(0, 1200) },
            scenario: `You are a single instance of '${persona.name}' encountering '${flagshipArtifact.name}'.`
          }
        });
        const r = sim.output.cousin_response || {};
        cousinResponses.push({
          cousin: c + 1,
          verdict: r.verdict || "engaged",
          quote: r.quote || "",
          improv: !!r.improvisation_present
        });
        bumpStatus(state, { cost_delta: sim.job.cost_usd });
        completeAgent(state, cousinJob, { note: `verdict ${r.verdict || "engaged"}`, cost_usd: sim.job.cost_usd, model: sim.job.model });
      }
      fileApi.writeJson(`stage3/persona_compositions/${persona.id}_cousins.json`, cousinResponses);
      state.persona_responses[`${persona.id}:${flagshipArtifact.id}`] = cousinResponses;
    }

    // ---- Evaluator (per cohesive concept) ----
    const evalJob = `stage3_evaluator_${parentClusterId}`;
    setAgentRunning(state, {
      id: evalJob,
      role: `Implementation QA + Scorer · ${parentClusterId}`,
      team: "Evaluator",
      state: "auditing",
      item: parentClusterId,
      task: "Score cohesive pilot, separate QA from opportunity response"
    });
    emit("agent_delta", { id: evalJob, state: "auditing", current_output: `Scoring cohesive concept for ${parentClusterId}...` });

    const evaluator = await runAgent({
      apiKey,
      model,
      signal,
      roleKey: "stage3_evaluator",
      jobId: evalJob,
      itemId: parentClusterId,
      task: `Score the cohesive concept for ${parentClusterId} (integrating ${modules.length} validated Stage-2 modules). Build a defense record. Identify cleared possibilities. Separate artifact QA from opportunity response.`,
      maxTokens: 10000,
      contextValues: {
        artifact_set: branchArtifacts.map(a => ({ id: a.id, name: a.name, type: a.type, qa: a.qa, body_excerpt: (a.body_markdown || "").slice(0, 600) })),
        persona_responses_grouped: cousinResponses,
        product_direction_cluster: {
          id: parentClusterId,
          name: conceptLabel,
          wedge: parentCluster?.opportunity || leadModule.wedge,
          core_uncertainties: parentCluster?.key_uncertainties || [],
          integrated_modules: modules.map(m => ({ id: m.id, name: m.name, kind: m.module_kind, conf: m.conf }))
        },
        evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim }))
      }
    });

    const score = evaluator.output.harness_score;
    // Update every module of this cluster with the cohesive score so
    // the founder sees a consistent confidence on the post-Stage-3 view.
    if (typeof score === "number") {
      for (const m of modules) {
        m.conf = score;
        if (typeof evaluator.output.confidence_band === "number") m.band = evaluator.output.confidence_band;
      }
    }
    if (evaluator.output.defense_record) {
      const dr = evaluator.output.defense_record;
      const held = (dr.entries || []).filter(e => e.verdict === "Held").length;
      const total = (dr.entries || []).length;
      for (const m of modules) m.defense = `${held} / ${total} held`;
      state.defense_records[parentClusterId] = { summary: dr.summary || `${held} of ${total} held`, entries: dr.entries || [] };
    }
    for (const c of evaluator.output.cleared_possibilities || []) {
      state.cleared.push({
        id: `br_${pad(state.cleared.length + 1)}`,
        name: c.name,
        taught: c.taught,
        reason: c.reason
      });
    }

    const pilotRun = {
      id: `pilot_${pad(state.pilot_runs.length + 1)}`,
      cluster_id: parentClusterId,
      cluster_name: conceptLabel,
      // Keep direction_id pointing at the lead module for backward compat
      // (dossier generator + scorecard modal still read this field).
      direction_id: leadModule.id,
      direction_name: leadModule.name,
      integrated_module_ids: modules.map(m => m.id),
      scorecard: evaluator.output.scorecard || {},
      harness_score: score,
      confidence_band: evaluator.output.confidence_band,
      findings: evaluator.output.findings || [],
      artifact_ids: branchArtifacts.map(a => a.id),
      persona_ids: branchPersonas.map(p => p.id)
    };
    state.pilot_runs = [...state.pilot_runs, pilotRun];
    fileApi.writeJson(`stage3/pilot_runs/${pilotRun.id}.json`, pilotRun);
    bumpStatus(state, { cost_delta: evaluator.job.cost_usd });
    completeAgent(state, evalJob, { note: `cohesive pilot ${pilotRun.id} scored ${typeof score === "number" ? Math.round(score * 100) + "%" : "n/a"}`, cost_usd: evaluator.job.cost_usd, model: evaluator.job.model });
    appendLedger(state, "keep", `Stage 3 cohesive pilot complete on ${parentClusterId} (${modules.length} modules integrated, score ${typeof score === "number" ? Math.round(score * 100) + "%" : "n/a"}).`, "stage3/audit");
    fileApi.writeJson(`stage3/evaluator_job_${parentClusterId}.json`, evaluator.job);
    emit("state", state);
  }

  // Surface the highest-scoring pilot as `state.pilot_run` for legacy
  // reads (dossier generator, scorecard modal, boot recovery).
  const sorted = [...state.pilot_runs].sort((a, b) => (b.harness_score || 0) - (a.harness_score || 0));
  state.pilot_run = sorted[0] || null;
  const topScore = state.pilot_run?.harness_score;
  const ranking = sorted.map(p => `${p.direction_id}:${typeof p.harness_score === "number" ? Math.round(p.harness_score * 100) + "%" : "n/a"}`).join(", ");

  // Preserve every earlier gate that still has undecided candidates
  // (stage_1_to_2, stage_2_to_3) so the founder can come back and
  // decide on leftovers from the previous gates instead of losing
  // them when Stage 3 completes. Only replace the existing dossier
  // gate (if any) — this is the new one we're emitting.
  const otherGates = (state.gate_queue || []).filter(g => g.kind !== "dossier");
  state.gate_queue = [
    ...otherGates,
    {
      id: "dossier_ready",
      kind: "dossier",
      primary: "Opportunity dossier ready",
      one_liner: state.pilot_runs.length > 1
        ? `${state.pilot_runs.length} parallel pilots closed. Top: ${state.pilot_run?.direction_id || "—"} at ${typeof topScore === "number" ? Math.round(topScore * 100) + "%" : "n/a"}.`
        : (typeof topScore === "number" ? `Stage 3 closed at ${Math.round(topScore * 100)}% harness score.` : "Stage 3 closed."),
      queued: nowShort(),
      recommendation: `Open the dossier — it synthesises across all ${state.pilot_runs.length} branch${state.pilot_runs.length === 1 ? "" : "es"}. Ranking: ${ranking}.`
    }
  ];
  state.mode = "stage3_done";
  state.campaign.status = "stage3_done";
  bumpStatus(state, { run_finished: true });
  emit("state", state);
  return state;
}

// ────────────────────────────────────────────────────────────
// Dossier
// ────────────────────────────────────────────────────────────

export async function generateDossier({ campaignId, state, settings, fileApi, signal }, emit) {
  ensureCampaignFrame(state);
  const apiKey = settings?.anthropic?.apiKey;
  const model = settings?.anthropic?.model;
  // No hard key requirement: an empty key falls back to the authenticated
  // Claude CLI in server/llm.mjs (which surfaces a clear error if the CLI
  // isn't logged in either).

  // Pick the cluster + direction that actually drove Stage 3 — not just
  // state.opp_clusters[0] / first lead. If pilot_run.direction_id exists,
  // use that direction and its parent cluster. Falls back to the highest-
  // scoring pilot_runs entry if multi-branch Stage 3 ran.
  const pilot = state.pilot_run
    || ((state.pilot_runs || []).slice().sort((a, b) => (b.harness_score || 0) - (a.harness_score || 0))[0])
    || null;
  if (!pilot) {
    throw new Error("Stage 3 must complete before dossier generation. The pilot scorecard is missing — re-run Stage 3 from the gate.");
  }
  const direction = (state.directions || []).find(d => d.id === pilot.direction_id)
    || (state.directions || []).find(d => d.state === "lead")
    || (state.directions || [])[0];
  if (!direction) {
    throw new Error("No direction available for the dossier. Stage 2 must produce at least one direction first.");
  }
  const cluster = (state.opp_clusters || []).find(c => (direction.parents || []).includes(c.id))
    || (state.opp_clusters || []).find(c => c.state === "advanced")
    || (state.opp_clusters || [])[0];
  if (!cluster) {
    throw new Error("No cluster available for the dossier. Stage 1 must produce at least one cluster first.");
  }
  if (!(state.artifacts || []).length) {
    throw new Error("Stage 3 produced no artifacts. Re-run Stage 3 from the gate so the synthesizer has something to summarise.");
  }

  // Mark the run as in-flight so the cockpit shows a real spinner,
  // pulse activity, and elapsed timer for the 30-90s Opus call.
  // Without this, in_flight_runs stayed 0 and the UI appeared frozen.
  bumpStatus(state, { run_started: true });
  appendLedger(state, "fresh", `Dossier synthesis engaged on ${direction.id} (${direction.name}).`, "dossier/generate");

  const dossierJob = "dossier_001";
  setAgentRunning(state, {
    id: dossierJob,
    role: "Dossier Synthesizer",
    team: "Builder",
    state: "drafting",
    item: "dossier",
    task: "Synthesize four-screen editorial dossier from full ledger"
  });
  // Emit state FIRST so the cockpit shows the agent running and the
  // in-flight counter ticks before the long Opus call blocks for 30-90s.
  emit("state", state);
  emit("agent_delta", { id: dossierJob, state: "drafting", current_output: "Synthesizing the four-screen dossier (Opus, ~30-90s)..." });

  const synth = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "dossier_synthesizer",
    jobId: dossierJob,
    itemId: "dossier",
    // Larger budget — the four-screen dossier with cleared possibilities
    // routinely truncates at 8192 and the retry can compound the cost.
    maxTokens: 12000,
    task: `Compose the four-screen Opportunity Dossier for ${state.campaign.name}. Voice: collegial, never therapeutic, second-person. Ground every claim in the ledger.`,
    contextValues: {
      full_campaign_ledger: (state.ledger || []).slice(0, 60),
      all_artifacts: state.artifacts || [],
      evaluator_findings: {
        cluster: { id: cluster.id, name: cluster.name, key_uncertainties: cluster.key_uncertainties || [] },
        direction: { id: direction.id, name: direction.name, wedge: direction.wedge, conf: direction.conf },
        pilot,
        // Multi-branch summary so the synthesizer sees all parallel
        // pilot runs, not just the winning one. Helps it write the
        // "How your thinking changed" section faithfully.
        pilot_runs_summary: (state.pilot_runs || []).map(p => ({
          id: p.id,
          direction_id: p.direction_id,
          direction_name: p.direction_name,
          harness_score: p.harness_score
        })),
        defense_records: state.defense_records || {},
        cleared: state.cleared || [],
        tensions: state.tensions || []
      }
    }
  });

  const d = synth.output;
  const dossier = {
    title: d.title || `${state.campaign.name} — Opportunity Dossier`,
    subtitle: d.subtitle || "Harness-validated. Not market-validated.",
    confidence_label: "Where this stands inside the harness",
    confidence_value: typeof d.confidence_value === "number" ? d.confidence_value : (pilot.harness_score || 0.6),
    confidence_band: typeof d.confidence_band === "number" ? d.confidence_band : 0.08,
    thinking_changed: d.thinking_changed || [],
    walked_past: d.walked_past || [],
    smallest_test: d.smallest_test || {
      headline: "Run the cheapest real-world observation that confirms or kills your dominant assumption.",
      cost: "$5",
      duration: "30 min",
      outcome: "Confirms or kills the environmental assumption.",
      observe: ["Note the actual frequency of the pain.", "Note who is present at the time the pain occurs."],
      tiers: []
    },
    cleared_possibilities: d.cleared_possibilities || (state.cleared || []).map(c => ({ name: c.name, taught: c.taught, cleared_by: c.reason }))
  };

  // Markdown form for the file system, the editorial layer reads the JSON.
  const md = [
    `# ${dossier.title}`,
    "",
    dossier.subtitle,
    "",
    "## How your thinking changed",
    ...dossier.thinking_changed.map(t => `- ${t.ts || ""}: ${t.note || ""}`),
    "",
    "## What we walked past together",
    ...dossier.walked_past.map(line => `- ${line}`),
    "",
    "## The smallest real-world test",
    "",
    `**${dossier.smallest_test.headline}**`,
    "",
    `Cost: ${dossier.smallest_test.cost} · Duration: ${dossier.smallest_test.duration}`,
    "",
    dossier.smallest_test.outcome,
    "",
    "Observe:",
    ...dossier.smallest_test.observe.map(o => `- ${o}`),
    "",
    "## Cleared possibilities",
    ...dossier.cleared_possibilities.map(c => `- **${c.name}** — taught: ${c.taught} — cleared by: ${c.cleared_by}`)
  ].join("\n");

  state.dossier = dossier;
  state.mode = "dossier";
  state.campaign.status = "dossier_generated";
  // Dossier is the terminal artifact — drop any remaining dossier gate
  // CTAs from the queue so the cockpit shows "Open dossier" instead of
  // "Generate dossier".
  state.gate_queue = (state.gate_queue || []).filter(g => g.kind !== "dossier");
  bumpStatus(state, { cost_delta: synth.job.cost_usd });
  completeAgent(state, dossierJob, { note: "dossier synthesized", cost_usd: synth.job.cost_usd, model: synth.job.model });
  appendLedger(state, "keep", "Opportunity dossier synthesized.", "dossier/generate");
  fileApi.writeJson("dossiers/dossier.json", dossier);
  fileApi.writeText("dossiers/opportunity_dossier_001.md", md);
  // Close the run so in_flight_runs returns to 0 and the cockpit
  // spinner stops. Without this, run_started_at lingered and elapsed_min
  // kept ticking forever after a successful generation.
  bumpStatus(state, { run_finished: true });
  emit("state", state);
  return state;
}

// ────────────────────────────────────────────────────────────
// Find more alternatives — re-runs the producer agent with a
// corrective prompt asking for candidates DIFFERENT from existing
// ones. Appends to the list rather than replacing. Useful when the
// founder rejects all current candidates or wants more options.
// ────────────────────────────────────────────────────────────

function pad3(n) { return String(n).padStart(3, "0"); }

export async function findMoreClusters({ campaignId, state, settings, fileApi, signal }, emit) {
  ensureCampaignFrame(state);
  const apiKey = settings?.anthropic?.apiKey;
  const model = settings?.anthropic?.model;
  // No hard key requirement: an empty key falls back to the authenticated
  // Claude CLI in server/llm.mjs (which surfaces a clear error if the CLI
  // isn't logged in either).
  if (!state.evidence?.length) throw new Error("No evidence yet — run Stage 1 first.");

  bumpStatus(state, { run_started: true });
  appendLedger(state, "fresh", "Searching for more cluster alternatives — distinct from existing.", "stage1/find_more");
  emit("state", state);

  const existingNames = (state.opp_clusters || []).map(c => c.name).join("; ");
  const existingIds = (state.opp_clusters || []).map(c => c.id);
  // Pull rejections so we can tell the producer what NOT to repeat.
  const clusterRejections = (state.rejections || []).filter(r => r.kind === "cluster");
  const hypothesisRejections = (state.rejections || []).filter(r => r.kind === "hypothesis");
  const rejectionPrompt = (clusterRejections.length === 0 && hypothesisRejections.length === 0)
    ? ""
    : `\n\nThe founder REJECTED these earlier patterns. Do NOT propose anything similar; pick a meaningfully different segment, pain, or wedge:\n${[
      ...clusterRejections.map(r => `- cluster "${r.target_name}"${r.reason ? `: ${r.reason}` : ""}`),
      ...hypothesisRejections.map(r => `- hypothesis "${r.target_name}"${r.reason ? `: ${r.reason}` : ""}`)
    ].join("\n")}`;
  const job = `stage1_clusterer_more_${Date.now()}`;
  setAgentRunning(state, {
    id: job,
    role: "Opportunity Clusterer (alternatives)",
    team: "Builder",
    state: "drafting",
    item: "opp_clusters",
    task: "Produce additional cluster candidates distinct from existing"
  });
  emit("state", state);

  const result = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage1_clusterer",
    jobId: job,
    itemId: "opp_clusters",
    task: `Produce 2-4 ADDITIONAL opportunity clusters that are MEANINGFULLY DIFFERENT from these existing clusters: ${existingNames}. Do not repeat them or trivially rephrase. Pick alternative segments, alternative pains, or wedges from underused evidence. Generate 10-25 NEW supporting hypotheses for these clusters and group them via hypothesis_indices (each cluster MUST list 2+ hypothesis_indices into the new hypotheses array).${rejectionPrompt}`,
    contextValues: {
      evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim, source_id: e.source.id, source_quote: e.source.quote })),
      campaign_brief: { name: state.campaign.name, search_domain: state.campaign.search_domain },
      ontology: ROLES.stage1_clusterer.allowed_context
    },
    maxTokens: 12000
  });

  // Persist the new hypotheses alongside existing ones so cluster cards
  // can show hyp counts and the cockpit ledger reflects divergent volume.
  const existingHypCount = (state.hypotheses || []).length;
  const rawNewHyps = result.output.opportunity_hypotheses || [];
  const newHyps = rawNewHyps.map((h, i) => ({
    id: `hyp_${pad3(existingHypCount + i + 1)}`,
    segment: h.segment,
    job: h.job,
    pain: h.pain,
    current_workaround: h.current_workaround,
    opportunity: h.opportunity,
    evidence_card_ids: h.evidence_card_ids || [],
    initial_confidence: h.initial_confidence || {},
    cluster_id: null
  }));
  state.hypotheses = [...(state.hypotheses || []), ...newHyps];

  // Same LEAD_THRESHOLD as the initial clusterer — clusters with
  // initial_confidence ≥ 0.60 surface as "lead" so the founder sees
  // every viable candidate at the gate, not just the first one.
  const LEAD_THRESHOLD = 0.6;
  const startIdx = (state.opp_clusters || []).length;
  const newClusters = (result.output.opportunity_clusters || []).map((c, i) => {
    const conf = typeof c.initial_confidence === "number" ? c.initial_confidence : 0.45;
    const cid = `opp_${pad3(startIdx + i + 1)}`;
    // hypothesis_indices are relative to the NEW hypotheses array; map
    // them into the new hyp ids we just minted.
    const memberHypIds = (c.hypothesis_indices || [])
      .map(idx => newHyps[idx]?.id)
      .filter(Boolean);
    for (const hid of memberHypIds) {
      const h = state.hypotheses.find(x => x.id === hid);
      if (h) h.cluster_id = cid;
    }
    return {
      id: cid,
      name: c.name,
      conf,
      band: typeof c.confidence_band === "number" ? c.confidence_band : 0.12,
      ev: (c.evidence_card_ids || []).length,
      ten: 0,
      hypotheses: memberHypIds.length,
      defense: "0 / 0 held",
      state: conf >= LEAD_THRESHOLD ? "lead" : "held",
      note: c.note || c.opportunity || "",
      descendants: [],
      segment: c.segment,
      pain: c.pain,
      current_workaround: c.current_workaround,
      opportunity: c.opportunity,
      evidence_card_ids: c.evidence_card_ids || [],
      hypothesis_ids: memberHypIds,
      key_uncertainties: c.key_uncertainties || [],
      recommended_microtests: c.recommended_microtests || []
    };
  });
  state.opp_clusters = [...(state.opp_clusters || []), ...newClusters];

  // Any orphan hypotheses (model didn't assign to any new cluster) get
  // parked on the first new cluster so we don't lose them.
  const orphanNewHyps = newHyps.filter(h => !h.cluster_id);
  if (orphanNewHyps.length > 0 && newClusters[0]) {
    for (const h of orphanNewHyps) h.cluster_id = newClusters[0].id;
    newClusters[0].hypotheses = (newClusters[0].hypotheses || 0) + orphanNewHyps.length;
    newClusters[0].hypothesis_ids = [
      ...(newClusters[0].hypothesis_ids || []),
      ...orphanNewHyps.map(h => h.id)
    ];
  }

  const newLeadCount = newClusters.filter(c => c.state === "lead").length;
  bumpStatus(state, { cost_delta: result.job.cost_usd });
  completeAgent(state, job, {
    note: `${newClusters.length} new cluster${newClusters.length === 1 ? "" : "s"} (${newLeadCount} lead${newLeadCount === 1 ? "" : "s"}) · ${newHyps.length} new hypotheses`,
    cost_usd: result.job.cost_usd,
    model: result.job.model
  });
  appendLedger(state, "keep", `${newClusters.length} alternative cluster${newClusters.length === 1 ? "" : "s"} produced (${newLeadCount} above lead threshold) · ${newHyps.length} new hypotheses.`, "stage1/find_more");
  fileApi.writeJsonl("stage1/opportunity_clusters.jsonl", state.opp_clusters);
  fileApi.writeJsonl("stage1/hypotheses.jsonl", state.hypotheses);

  // Refresh gate candidate list — keep the field set in sync with the
  // initial Stage 1 gate (hypotheses count + state included).
  const candidates = state.opp_clusters
    .filter(c => c.state !== "cleared" && c.state !== "discounted" && c.state !== "rejected")
    .map(c => ({
      id: c.id, name: c.name, defense: c.defense, conf: c.conf, band: c.band,
      ev: c.ev, ten: c.ten, hypotheses: c.hypotheses, state: c.state, note: c.note
    }));
  const leadsAlive = candidates.filter(c => c.state === "lead").length;
  state.gate_queue = (state.gate_queue || []).map(g =>
    g.kind === "stage_1_to_2" ? {
      ...g,
      candidates,
      one_liner: `${(state.hypotheses||[]).length} hypotheses · ${candidates.length} clusters · ${leadsAlive} lead${leadsAlive === 1 ? "" : "s"} · ${(state.tensions||[]).length} tension${(state.tensions||[]).length === 1 ? "" : "s"}.`,
      recommendation: leadsAlive > 1
        ? `${leadsAlive} clusters cleared the lead threshold (conf ≥ 0.60). Advance one or several as parallel Stage 2 branches.`
        : `Pick any viable cluster — multi-select to run parallel Stage 2 branches.`
    } : g
  );

  bumpStatus(state, { run_finished: true });
  for (const c of newClusters) emit("cluster", c);
  emit("state", state);
  return state;
}

export async function findMoreDirections({ campaignId, state, settings, fileApi, signal }, emit) {
  ensureCampaignFrame(state);
  const apiKey = settings?.anthropic?.apiKey;
  const model = settings?.anthropic?.model;
  // No hard key requirement: an empty key falls back to the authenticated
  // Claude CLI in server/llm.mjs (which surfaces a clear error if the CLI
  // isn't logged in either).
  const cluster = state.opp_clusters?.[0];
  if (!cluster) throw new Error("Stage 1 must complete first.");
  if (!state.directions?.length) throw new Error("No directions yet — run Stage 2 first.");

  bumpStatus(state, { run_started: true });
  appendLedger(state, "fresh", "Searching for more direction alternatives — distinct from existing.", "stage2/find_more");
  emit("state", state);

  const existingNames = (state.directions || []).map(d => d.name).join("; ");
  const directionRejections = (state.rejections || []).filter(r => r.kind === "direction");
  const rejectionPrompt = directionRejections.length === 0
    ? ""
    : `\n\nThe founder REJECTED these earlier directions. Do NOT propose anything similar:\n${directionRejections.map(r => `- "${r.target_name}"${r.reason ? `: ${r.reason}` : ""}`).join("\n")}`;
  const job = `stage2_strategist_more_${Date.now()}`;
  setAgentRunning(state, {
    id: job,
    role: "Opportunity Strategist (alternatives)",
    team: "Builder",
    state: "thinking",
    item: cluster.id,
    task: "Produce additional direction candidates distinct from existing"
  });
  emit("state", state);

  const result = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage2_strategist",
    jobId: job,
    itemId: cluster.id,
    task: `Produce 2-3 ADDITIONAL Product Direction Clusters for ${cluster.name} that are MEANINGFULLY DIFFERENT from these existing directions: ${existingNames}. Pick alternative wedges, alternative business models, or alternative segments. Do not repeat them.${rejectionPrompt}`,
    contextValues: {
      evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim })),
      opportunity_cluster: { id: cluster.id, name: cluster.name, segment: cluster.segment, pain: cluster.pain, key_uncertainties: cluster.key_uncertainties },
      tensions: state.tensions,
      ontology: ROLES.stage2_strategist.allowed_context
    }
  });

  // Same threshold as the original Stage 2 strategist — clears the
  // multi-lead bar so additional directions can surface as leads, not
  // permanently demoted to "held".
  const LEAD_THRESHOLD = 0.6;
  const startIdx = (state.directions || []).length;
  const newDirections = (result.output.product_direction_clusters || []).map((d, i) => {
    const conf = typeof d.initial_confidence === "number" ? d.initial_confidence : 0.45;
    return {
      id: `pdc_${pad3(startIdx + i + 1)}`,
      name: d.name,
      conf,
      band: typeof d.confidence_band === "number" ? d.confidence_band : 0.12,
      microtests: (d.suggested_microtests || []).length,
      defense: "0 / 0 held",
      state: conf >= LEAD_THRESHOLD ? "lead" : "held",
      wedge: d.wedge,
      parents: [cluster.id],
      descendants: [],
      core_uncertainties: d.core_uncertainties || [],
      suggested_microtests: d.suggested_microtests || []
    };
  });
  state.directions = [...(state.directions || []), ...newDirections];

  const newLeadCount = newDirections.filter(d => d.state === "lead").length;
  bumpStatus(state, { cost_delta: result.job.cost_usd });
  completeAgent(state, job, {
    note: `${newDirections.length} new direction${newDirections.length === 1 ? "" : "s"} (${newLeadCount} lead${newLeadCount === 1 ? "" : "s"})`,
    cost_usd: result.job.cost_usd,
    model: result.job.model
  });
  appendLedger(state, "keep", `${newDirections.length} alternative direction${newDirections.length === 1 ? "" : "s"} produced (${newLeadCount} above lead threshold) — added to gate options.`, "stage2/find_more");
  fileApi.writeJsonl("stage2/product_direction_clusters.jsonl", state.directions);

  const dirCandidates = state.directions
    .filter(d => d.state !== "cleared" && d.state !== "discounted" && d.state !== "rejected")
    .map(d => ({ id: d.id, name: d.name, defense: d.defense, conf: d.conf, microtests: d.microtests, wedge: d.wedge, state: d.state, module_kind: d.module_kind, artifact_sketch: d.artifact_sketch }));
  const leadsAlive = dirCandidates.filter(d => d.state === "lead").length;
  state.gate_queue = (state.gate_queue || []).map(g =>
    g.kind === "stage_2_to_3" ? {
      ...g,
      candidates: dirCandidates,
      one_liner: `${dirCandidates.length} direction${dirCandidates.length === 1 ? "" : "s"} alive · ${leadsAlive} lead${leadsAlive === 1 ? "" : "s"}.`,
      recommendation: leadsAlive > 1
        ? `${leadsAlive} directions cleared the lead threshold. Advance one or several as parallel Stage 3 branches.`
        : `Pick any viable direction — multi-select to run parallel Stage 3 branches.`
    } : g
  );

  bumpStatus(state, { run_finished: true });
  emit("state", state);
  return state;
}

// ────────────────────────────────────────────────────────────
// Refine — re-run the producer agent on a single existing item
// with the founder's corrective feedback. Unlike find-more (which
// APPENDS a new item), refine REPLACES the item in place,
// preserving its id so descendants and references stay intact.
// Works on Stage 1 clusters and Stage 2 modules (directions).
// ────────────────────────────────────────────────────────────

export async function refineItem({ campaignId, state, settings, fileApi, signal, refineSpec }, emit) {
  ensureCampaignFrame(state);
  const apiKey = settings?.anthropic?.apiKey;
  const model = settings?.anthropic?.model;
  // No hard key requirement: an empty key falls back to the authenticated
  // Claude CLI in server/llm.mjs (which surfaces a clear error if the CLI
  // isn't logged in either).

  const { kind, id, feedback } = refineSpec || {};
  if (!id) throw new Error("Refine requires the target item id.");
  if (kind !== "cluster" && kind !== "direction") throw new Error(`Refine kind must be "cluster" or "direction" (got "${kind}").`);

  bumpStatus(state, { run_started: true });
  const feedbackBlock = (feedback && feedback.trim())
    ? `\n\nThe founder's specific refinement guidance:\n"${feedback.trim()}"\n\nIncorporate this guidance precisely. Do not drift away from the original target.`
    : `\n\nNo specific guidance — improve the item along the dimension of clarity, distinctness from siblings, and grounding in evidence.`;

  if (kind === "cluster") {
    const existing = (state.opp_clusters || []).find(c => c.id === id);
    if (!existing) throw new Error(`Cluster ${id} not found.`);

    appendLedger(state, "fresh", `Refining cluster ${id} (${existing.name})${feedback ? " with founder guidance" : ""}.`, "stage1/refine");
    emit("state", state);

    const job = `stage1_clusterer_refine_${id}_${Date.now()}`;
    setAgentRunning(state, {
      id: job,
      role: "Opportunity Clusterer (refine)",
      team: "Builder",
      state: "drafting",
      item: id,
      task: `Refine cluster ${id}`
    });
    emit("agent_delta", { id: job, state: "drafting", current_output: `Refining cluster ${id}...` });

    const siblings = (state.opp_clusters || []).filter(c => c.id !== id).map(c => `- ${c.id}: ${c.name}`).join("\n");
    const currentJson = JSON.stringify({
      name: existing.name,
      segment: existing.segment,
      pain: existing.pain,
      current_workaround: existing.current_workaround,
      opportunity: existing.opportunity,
      key_uncertainties: existing.key_uncertainties,
      note: existing.note,
      initial_confidence: existing.conf
    }, null, 2);

    const result = await runAgent({
      apiKey,
      model,
      signal,
      roleKey: "stage1_clusterer",
      jobId: job,
      itemId: id,
      maxTokens: 6000,
      task: `Refine the SINGLE opportunity cluster ${id}. Current version:\n${currentJson}\n\nSibling clusters (do not duplicate them):\n${siblings || "(none)"}${feedbackBlock}\n\nReturn EXACTLY ONE refined cluster in opportunity_clusters (the same shape as the original, no new hypothesis array). The refined cluster should be more specific, more distinct from siblings, and more grounded in evidence than the original — but still recognisably the same target.`,
      contextValues: {
        evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim, source_id: e.source.id, source_quote: e.source.quote })),
        campaign_brief: { name: state.campaign.name, search_domain: state.campaign.search_domain },
        ontology: ROLES.stage1_clusterer.allowed_context
      }
    });

    const refined = (result.output.opportunity_clusters || [])[0];
    if (!refined) {
      bumpStatus(state, { run_finished: true });
      throw new Error("Refine returned no cluster.");
    }
    const conf = typeof refined.initial_confidence === "number" ? refined.initial_confidence : existing.conf;
    const LEAD_THRESHOLD = 0.6;
    // Replace in place, preserve id + descendant linkage.
    state.opp_clusters = state.opp_clusters.map(c => c.id === id ? ({
      ...c,
      name: refined.name || c.name,
      conf,
      band: typeof refined.confidence_band === "number" ? refined.confidence_band : c.band,
      state: conf >= LEAD_THRESHOLD ? "lead" : (c.state === "advanced" ? "advanced" : "held"),
      note: refined.note || refined.opportunity || c.note,
      segment: refined.segment || c.segment,
      pain: refined.pain || c.pain,
      current_workaround: refined.current_workaround || c.current_workaround,
      opportunity: refined.opportunity || c.opportunity,
      evidence_card_ids: refined.evidence_card_ids || c.evidence_card_ids,
      key_uncertainties: refined.key_uncertainties || c.key_uncertainties,
      recommended_microtests: refined.recommended_microtests || c.recommended_microtests
    }) : c);

    bumpStatus(state, { cost_delta: result.job.cost_usd });
    completeAgent(state, job, { note: `Cluster ${id} refined`, cost_usd: result.job.cost_usd, model: result.job.model });
    appendLedger(state, "keep", `Cluster ${id} refined → "${refined.name || existing.name}".`, "stage1/refine");
    fileApi.writeJsonl("stage1/opportunity_clusters.jsonl", state.opp_clusters);

    // Refresh stage_1_to_2 gate candidates.
    const candidates = (state.opp_clusters || [])
      .filter(c => c.state !== "cleared" && c.state !== "discounted" && c.state !== "rejected")
      .map(c => ({ id: c.id, name: c.name, defense: c.defense, conf: c.conf, band: c.band, ev: c.ev, ten: c.ten, hypotheses: c.hypotheses, state: c.state, note: c.note }));
    const leadsAlive = candidates.filter(c => c.state === "lead").length;
    state.gate_queue = (state.gate_queue || []).map(g =>
      g.kind === "stage_1_to_2" ? {
        ...g,
        candidates,
        one_liner: `${candidates.length} clusters · ${leadsAlive} lead${leadsAlive === 1 ? "" : "s"} · ${id} just refined.`
      } : g
    );
  } else if (kind === "direction") {
    const existing = (state.directions || []).find(d => d.id === id);
    if (!existing) throw new Error(`Direction ${id} not found.`);
    const parentCluster = (state.opp_clusters || []).find(c => (existing.parents || []).includes(c.id));

    appendLedger(state, "fresh", `Refining module ${id} (${existing.name})${feedback ? " with founder guidance" : ""}.`, "stage2/refine");
    emit("state", state);

    const job = `stage2_strategist_refine_${id}_${Date.now()}`;
    setAgentRunning(state, {
      id: job,
      role: "Opportunity Strategist (refine)",
      team: "Builder",
      state: "drafting",
      item: id,
      task: `Refine module ${id}`
    });
    emit("agent_delta", { id: job, state: "drafting", current_output: `Refining module ${id}...` });

    const siblings = (state.directions || [])
      .filter(d => d.id !== id && (parentCluster ? (d.parents || []).includes(parentCluster.id) : true))
      .map(d => `- ${d.id} (${d.module_kind || "module"}): ${d.name}`)
      .join("\n");
    const currentJson = JSON.stringify({
      name: existing.name,
      wedge: existing.wedge,
      module_kind: existing.module_kind,
      core_uncertainties: existing.core_uncertainties,
      suggested_microtests: existing.suggested_microtests,
      artifact_sketch: existing.artifact_sketch,
      initial_confidence: existing.conf
    }, null, 2);

    const result = await runAgent({
      apiKey,
      model,
      signal,
      roleKey: "stage2_strategist",
      jobId: job,
      itemId: id,
      maxTokens: 6000,
      task: `Refine the SINGLE product direction module ${id}. Current version:\n${currentJson}\n\nSibling modules in the same cluster (do not duplicate them):\n${siblings || "(none)"}${feedbackBlock}\n\nReturn EXACTLY ONE refined module in product_direction_clusters (same shape, full artifact_sketch included). Keep the same module_kind unless the refinement explicitly changes it. The refined module should be more specific, more testable, and more distinct from siblings.`,
      contextValues: {
        evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim })),
        opportunity_cluster: parentCluster ? { id: parentCluster.id, name: parentCluster.name, segment: parentCluster.segment, pain: parentCluster.pain, key_uncertainties: parentCluster.key_uncertainties } : { id: "unknown" },
        tensions: state.tensions,
        ontology: ROLES.stage2_strategist.allowed_context
      }
    });

    const refined = (result.output.product_direction_clusters || [])[0];
    if (!refined) {
      bumpStatus(state, { run_finished: true });
      throw new Error("Refine returned no module.");
    }
    const conf = typeof refined.initial_confidence === "number" ? refined.initial_confidence : existing.conf;
    const LEAD_THRESHOLD = 0.6;
    state.directions = state.directions.map(d => d.id === id ? ({
      ...d,
      name: refined.name || d.name,
      conf,
      band: typeof refined.confidence_band === "number" ? refined.confidence_band : d.band,
      state: d.state === "advanced" ? "advanced" : (conf >= LEAD_THRESHOLD ? "lead" : "module"),
      wedge: refined.wedge || d.wedge,
      module_kind: refined.module_kind || d.module_kind,
      core_uncertainties: refined.core_uncertainties || d.core_uncertainties,
      suggested_microtests: refined.suggested_microtests || d.suggested_microtests,
      artifact_sketch: refined.artifact_sketch || d.artifact_sketch,
      microtests: (refined.suggested_microtests || d.suggested_microtests || []).length
    }) : d);

    bumpStatus(state, { cost_delta: result.job.cost_usd });
    completeAgent(state, job, { note: `Module ${id} refined`, cost_usd: result.job.cost_usd, model: result.job.model });
    appendLedger(state, "keep", `Module ${id} refined → "${refined.name || existing.name}".`, "stage2/refine");
    fileApi.writeJsonl("stage2/product_direction_clusters.jsonl", state.directions);

    // Refresh stage_2_to_3 gate candidates.
    const dirCandidates = (state.directions || [])
      .filter(d => d.state !== "cleared" && d.state !== "discounted" && d.state !== "rejected")
      .map(d => ({ id: d.id, name: d.name, defense: d.defense, conf: d.conf, microtests: d.microtests, wedge: d.wedge, state: d.state, parents: d.parents, module_kind: d.module_kind, artifact_sketch: d.artifact_sketch }));
    const leadsAlive = dirCandidates.filter(d => d.state === "lead").length;
    state.gate_queue = (state.gate_queue || []).map(g =>
      g.kind === "stage_2_to_3" ? {
        ...g,
        candidates: dirCandidates,
        one_liner: `${dirCandidates.length} modules · ${leadsAlive} lead${leadsAlive === 1 ? "" : "s"} · ${id} just refined.`
      } : g
    );
  }

  bumpStatus(state, { run_finished: true });
  emit("state", state);
  return state;
}
