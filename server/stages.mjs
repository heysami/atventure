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
  if (!apiKey) throw new Error("Anthropic API key not configured.");
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
    task: `Stage 1 is divergent by design. From the ${evidence.length} evidence cards, generate 25-60 opportunity hypotheses (each one a specific segment+pain+wedge grounded in 1+ evidence cards). Then group them into 4-12 opportunity clusters using hypothesis_indices. Surface 1-3 tensions for Stage 2 to test.`,
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
  if (!apiKey) throw new Error("Anthropic API key not configured.");
  const cluster = state.opp_clusters?.[0];
  if (!cluster) throw new Error("Stage 1 must complete before Stage 2.");

  state.mode = "stage2_running";
  state.campaign.stage = "stage2";
  state.campaign.status = "stage2_running";
  bumpStatus(state, { run_started: true });
  appendLedger(state, "fresh", `Stage 2 brainstorm engaged on ${cluster.id} — ${cluster.name}.`, "stage2/run");
  emit("state", state);

  // ---- Strategist (Builder) ----
  const stratJob = "stage2_strategist_001";
  setAgentRunning(state, {
    id: stratJob,
    role: "Opportunity Strategist",
    team: "Builder",
    state: "thinking",
    item: cluster.id,
    task: "Propose product direction clusters with microtest plans"
  });
  emit("agent_delta", { id: stratJob, state: "thinking", current_output: "Designing 2-4 distinct product direction wedges..." });

  // Stage 1 rejections inform Stage 2 — don't propose direction wedges
  // that map onto patterns the founder already rejected.
  const upstreamRejections = (state.rejections || []).filter(r => r.kind === "cluster" || r.kind === "hypothesis");
  const stage2RejectPrompt = upstreamRejections.length === 0
    ? ""
    : ` Avoid wedges that resemble these rejected upstream patterns:\n${upstreamRejections.slice(0, 12).map(r => `- ${r.kind} "${r.target_name}"${r.reason ? `: ${r.reason}` : ""}`).join("\n")}`;
  const strategist = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage2_strategist",
    jobId: stratJob,
    itemId: cluster.id,
    task: `Cluster: ${cluster.name}. Propose 2-4 Product Direction Clusters. Each carries a distinct wedge into the same opportunity. Mark one as preferred (lead).${stage2RejectPrompt}`,
    contextValues: {
      evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim })),
      opportunity_cluster: { id: cluster.id, name: cluster.name, segment: cluster.segment, pain: cluster.pain, key_uncertainties: cluster.key_uncertainties },
      tensions: state.tensions,
      ontology: ROLES.stage2_strategist.allowed_context
    }
  });

  const directions = (strategist.output.product_direction_clusters || []).map((d, i) => ({
    id: `pdc_${pad(i + 1)}`,
    name: d.name,
    conf: typeof d.initial_confidence === "number" ? d.initial_confidence : 0.5,
    band: typeof d.confidence_band === "number" ? d.confidence_band : 0.1,
    microtests: (d.suggested_microtests || []).length,
    defense: "0 / 0 held",
    state: d.preferred ? "lead" : (i === 0 ? "lead" : "held"),
    wedge: d.wedge,
    parents: [cluster.id],
    descendants: [],
    core_uncertainties: d.core_uncertainties || [],
    suggested_microtests: d.suggested_microtests || []
  }));
  // Ensure exactly one lead.
  let leadAssigned = false;
  for (const d of directions) {
    if (d.state === "lead" && !leadAssigned) leadAssigned = true;
    else if (d.state === "lead") d.state = "held";
  }
  cluster.descendants = directions.map(d => d.id);
  cluster.state = "advanced";

  state.directions = directions;
  bumpStatus(state, { cost_delta: strategist.job.cost_usd });
  completeAgent(state, stratJob, { note: `${directions.length} directions proposed`, cost_usd: strategist.job.cost_usd, model: strategist.job.model });
  appendLedger(state, "keep", `Strategist returned ${directions.length} product directions for ${cluster.id}.`, "stage2/strategist");
  fileApi.writeJsonl("stage2/product_direction_clusters.jsonl", directions);
  fileApi.writeJson("stage2/strategist_job.json", strategist.job);
  emit("state", state);

  // ---- Blinded Tester runs (one batch per microtest on lead direction) ----
  const lead = directions.find(d => d.state === "lead") || directions[0];
  const microtestSpecs = (lead.suggested_microtests || []).slice(0, 3);
  const microtestResults = [];

  for (let m = 0; m < microtestSpecs.length; m += 1) {
    const spec = microtestSpecs[m];
    const mtId = `mt_${pad(m + 1)}`;
    const testerJob = `stage2_tester_${pad(m + 1)}`;
    setAgentRunning(state, {
      id: testerJob,
      role: `Blinded Tester · ${spec.method}`,
      team: "Tester",
      state: "responding",
      // Point at the direction being tested so the Item view's mini-hex
      // indicator attaches to the actual node, not the synthetic mt_id.
      item: lead.id,
      task: spec.purpose || `Run ${spec.method} on ${lead.id}`
    });
    state.runs.push({
      id: `stage2/${mtId}`,
      team: "Tester",
      role: "blinded",
      state: "running",
      item: lead.id,
      elapsed: "00:01",
      note: `${spec.method} · ${spec.purpose || ""}`
    });
    emit("agent_delta", { id: testerJob, state: "responding", current_output: `Running ${spec.method} blinded against ${lead.id}` });

    // Strict blinded scenario: only role + scenario + necessary artifact.
    const scenario = `You are a member of the segment likely to encounter the wedge "${lead.wedge}". The harness has placed a low-fidelity version in front of you. React in your own voice. Method: ${spec.method}. Specific question: ${spec.purpose}.`;
    const tester = await runAgent({
      apiKey,
      model,
      signal,
      roleKey: "stage2_tester",
      jobId: testerJob,
      itemId: mtId,
      task: `Produce 5-7 cousin responses (different cousins of the same persona type) reacting to the scenario. Keep blinded — you have NO knowledge of what the harness wants.`,
      contextValues: {
        assigned_scenario: scenario,
        assigned_role: `member of segment '${cluster.segment || "target"}'`,
        necessary_artifact: `Wedge: ${lead.wedge}`
      }
    });

    bumpStatus(state, { cost_delta: tester.job.cost_usd });
    completeAgent(state, testerJob, { note: `${(tester.output.tester_responses || []).length} cousin responses`, cost_usd: tester.job.cost_usd, model: tester.job.model, item: lead.id });
    state.runs = state.runs.filter(r => r.id !== `stage2/${mtId}`);

    microtestResults.push({
      id: mtId,
      method: spec.method,
      purpose: spec.purpose,
      responses: tester.output.tester_responses || []
    });
    fileApi.writeJson(`stage2/microtest_runs/${mtId}.json`, microtestResults[microtestResults.length - 1]);
    appendLedger(state, "keep", `${spec.method} returned ${(tester.output.tester_responses || []).length} blinded cousin responses.`, `stage2/${mtId}`);
    emit("state", state);
  }

  // ---- Evaluator (Method Auditor) ----
  const evalJob = "stage2_evaluator_001";
  setAgentRunning(state, {
    id: evalJob,
    role: "Method Auditor",
    team: "Evaluator",
    state: "auditing",
    item: lead.id,
    task: "Score microtests, build defense record, recommend advance/hold"
  });
  emit("agent_delta", { id: evalJob, state: "auditing", current_output: "Auditing method fit, leakage, and cousin variance..." });

  const evaluator = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage2_evaluator",
    jobId: evalJob,
    itemId: lead.id,
    task: `Audit the ${microtestResults.length} microtest runs against ${lead.id}. Build a defense record covering all challenge dimensions.`,
    contextValues: {
      microtest_spec: microtestResults.map(r => ({ id: r.id, method: r.method, purpose: r.purpose })),
      tester_responses: microtestResults,
      product_direction_cluster: { id: lead.id, name: lead.name, wedge: lead.wedge, core_uncertainties: lead.core_uncertainties },
      evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim }))
    }
  });

  const mtVerdicts = evaluator.output.microtest_results || [];
  const microtests = microtestResults.map((r, i) => {
    const v = mtVerdicts[i] || {};
    return {
      id: r.id,
      method: r.method,
      result: (v.result || "Inconclusive").toLowerCase(),
      score: typeof v.score === "number" ? v.score : 0.5,
      finding: v.finding || r.purpose,
      leakage_flag: !!v.leakage_flag
    };
  });

  const dr = evaluator.output.defense_record;
  if (dr) {
    const held = (dr.entries || []).filter(e => e.verdict === "Held").length;
    const total = (dr.entries || []).length;
    lead.defense = `${held} / ${total} held`;
    state.defense_records[lead.id] = { summary: dr.summary || `${held} of ${total} held`, entries: dr.entries || [] };
  }
  if (evaluator.output.confidence_update) {
    const cu = evaluator.output.confidence_update;
    const target = directions[cu.direction_index] || lead;
    if (typeof cu.new_conf === "number") target.conf = cu.new_conf;
    if (typeof cu.new_band === "number") target.band = cu.new_band;
  }

  bumpStatus(state, { cost_delta: evaluator.job.cost_usd });
  completeAgent(state, evalJob, { note: `${(dr?.entries || []).length} defense entries · ${microtests.length} microtests scored`, cost_usd: evaluator.job.cost_usd, model: evaluator.job.model });
  appendLedger(state, "keep", `Stage 2 evaluator audit complete on ${lead.id}.`, "stage2/audit");
  fileApi.writeJson("stage2/microtests_summary.json", microtests);
  fileApi.writeJson("stage2/evaluator_job.json", evaluator.job);

  // Multi-candidate gate: surface every viable direction. The human can
  // pick one, several (parallel branches in Stage 3), or ask for more.
  const dirCandidates = directions
    .filter(d => d.state !== "cleared" && d.state !== "discounted")
    .map(d => ({ id: d.id, name: d.name, defense: d.defense, conf: d.conf, microtests: d.microtests, wedge: d.wedge, state: d.state }));
  state.gate_queue = [
    {
      id: "gate_stage2_to_stage3",
      kind: "stage_2_to_3",
      primary: lead.name,
      one_liner: `${dirCandidates.length} direction${dirCandidates.length === 1 ? "" : "s"} alive · ${microtests.length} microtest${microtests.length === 1 ? "" : "s"} run`,
      queued: nowShort(),
      recommendation: dirCandidates.length > 1
        ? `Pick which direction(s) to take into Stage 3. Multiple run as parallel branches.`
        : (evaluator.output.advance_recommendation
            ? `Recommendation: ${evaluator.output.advance_recommendation} ${lead.id}.`
            : `Advance ${lead.id} into Stage 3.`),
      candidates: dirCandidates,
      compounding: evaluator.output.compounding_signal || ""
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
  if (!apiKey) throw new Error("Anthropic API key not configured.");
  const lead = state.directions?.find(d => d.state === "lead") || state.directions?.[0];
  if (!lead) throw new Error("Stage 2 must complete before Stage 3.");

  state.mode = "stage3_running";
  state.campaign.stage = "stage3";
  state.campaign.status = "stage3_running";
  bumpStatus(state, { run_started: true });
  appendLedger(state, "fresh", `Stage 3 simulated pilot engaged on ${lead.id}.`, "stage3/run");
  emit("state", state);

  // ---- Plan Architect ----
  const planJob = "stage3_planner_001";
  setAgentRunning(state, {
    id: planJob,
    role: "Stage 3 Plan Architect",
    team: "Builder",
    state: "drafting",
    item: lead.id,
    task: "Build stakeholder map, artifact plan, and persona compositions"
  });
  emit("agent_delta", { id: planJob, state: "drafting", current_output: "Composing stakeholders, artifacts, and persona recipes..." });

  const planner = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage3_planner",
    jobId: planJob,
    itemId: lead.id,
    task: `Direction: ${lead.name}. Wedge: ${lead.wedge}. Compose a stakeholder map, an artifact plan (3-5 artifacts in low-fi sketch register), and 2-3 personas grounded in specific evidence cards.`,
    contextValues: {
      product_direction_cluster: { id: lead.id, name: lead.name, wedge: lead.wedge, core_uncertainties: lead.core_uncertainties },
      evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim, source_quote: e.source.quote })),
      tensions: state.tensions,
      campaign_brief: { name: state.campaign.name, search_domain: state.campaign.search_domain }
    }
  });

  bumpStatus(state, { cost_delta: planner.job.cost_usd });
  completeAgent(state, planJob, { note: `Plan ready: ${(planner.output.artifact_plan || []).length} artifacts, ${(planner.output.personas || []).length} personas`, cost_usd: planner.job.cost_usd, model: planner.job.model });
  fileApi.writeJson("stage3/stakeholder_maps/map.json", planner.output.stakeholders || []);
  fileApi.writeJson("stage3/artifact_plans/plan.json", planner.output.artifact_plan || []);
  fileApi.writeJson("stage3/persona_compositions/compositions.json", planner.output.personas || []);

  // Map personas into D shape.
  state.personas = (planner.output.personas || []).map((p, i) => ({
    id: `per_${pad(i + 1)}`,
    name: p.name,
    role: p.role,
    from: p.from_evidence_ids || [],
    cousins: p.cousins || 6,
    variance: p.variance_target || 0.18,
    improv_rate: 0.06,
    trait_provenance: p.trait_provenance || []
  }));

  // ---- Artifact Builder per artifact ----
  const artifactPlan = (planner.output.artifact_plan || []).slice(0, 4);
  const artifacts = [];
  for (let a = 0; a < artifactPlan.length; a += 1) {
    const brief = artifactPlan[a];
    const aId = `art_${pad(a + 1)}`;
    const builderJob = `stage3_builder_${pad(a + 1)}`;
    setAgentRunning(state, {
      id: builderJob,
      role: "Prototype Builder",
      team: "Builder",
      state: "drafting",
      item: aId,
      task: `Generate ${brief.type} for ${brief.audience}`
    });
    emit("agent_delta", { id: builderJob, state: "drafting", current_output: `Sketching ${brief.type} for ${brief.audience}...` });

    const builder = await runAgent({
      apiKey,
      model,
      signal,
      roleKey: "stage3_artifact_builder",
      jobId: builderJob,
      itemId: aId,
      task: `Produce the ${brief.type} body for audience '${brief.audience}'. Purpose: ${brief.purpose}. LOW-FI SKETCH REGISTER ONLY.`,
      contextValues: {
        artifact_brief: brief,
        product_direction_cluster: { id: lead.id, name: lead.name, wedge: lead.wedge },
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
      state: art.qa_state === "fail" ? "warn" : "queued",
      parents: [lead.id],
      type: art.type || brief.type,
      body_markdown: art.body_markdown || ""
    };
    artifacts.push(artifact);
    bumpStatus(state, { cost_delta: builder.job.cost_usd });
    completeAgent(state, builderJob, { note: `${artifact.name} drafted (${artifact.qa})`, cost_usd: builder.job.cost_usd, model: builder.job.model });
    fileApi.writeJson(`stage3/artifacts/${aId}.json`, artifact);
    appendLedger(state, "keep", `Artifact ${aId} drafted: ${artifact.name}`, `stage3/${aId}`);
    state.artifacts = artifacts;
    emit("state", state);
  }

  lead.descendants = artifacts.map(a => a.id);

  // ---- Persona cousin simulation against the lead artifact ----
  const persona = state.personas[0];
  const flagshipArtifact = artifacts[0];
  const cousinResponses = [];
  if (persona && flagshipArtifact) {
    const cousinCount = Math.min(persona.cousins, 6);
    for (let c = 0; c < cousinCount; c += 1) {
      const cId = `cousin_${pad(c + 1)}`;
      const cousinJob = `stage3_persona_${persona.id}_${cId}`;
      setAgentRunning(state, {
        id: cousinJob,
        role: `${persona.name} (cousin ${c + 1})`,
        team: "Tester",
        state: "responding",
        item: flagshipArtifact.id,
        task: "React to artifact under blinded scenario"
      });
      emit("agent_delta", { id: cousinJob, state: "responding", current_output: `${persona.name} cousin ${c + 1} reacting...` });

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
          assigned_artifact: { type: flagshipArtifact.type, name: flagshipArtifact.name, body: flagshipArtifact.body_markdown.slice(0, 1200) },
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
    // Expose responses to the cockpit, keyed by `<persona_id>:<artifact_id>`.
    state.persona_responses = state.persona_responses || {};
    state.persona_responses[`${persona.id}:${flagshipArtifact.id}`] = cousinResponses;
  }

  // ---- Evaluator (QA + Scorer) ----
  const evalJob = "stage3_evaluator_001";
  setAgentRunning(state, {
    id: evalJob,
    role: "Implementation QA + Scorer",
    team: "Evaluator",
    state: "auditing",
    item: lead.id,
    task: "Score pilot, separate QA from opportunity response"
  });
  emit("agent_delta", { id: evalJob, state: "auditing", current_output: "Scoring pilot across 6 dimensions and building Stage 3 defense record..." });

  const evaluator = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "stage3_evaluator",
    jobId: evalJob,
    itemId: lead.id,
    task: `Score the pilot for ${lead.id}. Build a defense record. Identify cleared possibilities. Separate artifact QA from opportunity response.`,
    contextValues: {
      artifact_set: artifacts.map(a => ({ id: a.id, name: a.name, type: a.type, qa: a.qa, body_excerpt: (a.body_markdown || "").slice(0, 600) })),
      persona_responses_grouped: cousinResponses,
      product_direction_cluster: { id: lead.id, name: lead.name, wedge: lead.wedge, core_uncertainties: lead.core_uncertainties },
      evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim }))
    }
  });

  const score = evaluator.output.harness_score;
  if (typeof score === "number") {
    lead.conf = score;
    if (typeof evaluator.output.confidence_band === "number") lead.band = evaluator.output.confidence_band;
  }
  if (evaluator.output.defense_record) {
    const dr = evaluator.output.defense_record;
    const held = (dr.entries || []).filter(e => e.verdict === "Held").length;
    const total = (dr.entries || []).length;
    lead.defense = `${held} / ${total} held`;
    state.defense_records[lead.id] = { summary: dr.summary || `${held} of ${total} held`, entries: dr.entries || [] };
  }
  for (const c of evaluator.output.cleared_possibilities || []) {
    state.cleared.push({
      id: `br_${pad(state.cleared.length + 1)}`,
      name: c.name,
      taught: c.taught,
      reason: c.reason
    });
  }

  state.pilot_run = {
    id: "pilot_001",
    direction_id: lead.id,
    scorecard: evaluator.output.scorecard || {},
    harness_score: score,
    confidence_band: evaluator.output.confidence_band,
    findings: evaluator.output.findings || []
  };
  bumpStatus(state, { cost_delta: evaluator.job.cost_usd });
  completeAgent(state, evalJob, { note: `pilot scored ${typeof score === "number" ? Math.round(score * 100) + "%" : "n/a"}`, cost_usd: evaluator.job.cost_usd, model: evaluator.job.model });
  appendLedger(state, "keep", `Stage 3 evaluator audit complete on ${lead.id} (score ${typeof score === "number" ? Math.round(score * 100) + "%" : "n/a"}).`, "stage3/audit");
  fileApi.writeJson("stage3/pilot_runs/pilot_001.json", state.pilot_run);
  fileApi.writeJson("stage3/evaluator_job.json", evaluator.job);

  state.gate_queue = [
    {
      id: "dossier_ready",
      kind: "dossier",
      primary: "Opportunity dossier ready",
      one_liner: typeof score === "number" ? `Stage 3 closed at ${Math.round(score * 100)}% harness score.` : "Stage 3 closed.",
      queued: nowShort(),
      recommendation: "Open the dossier and run the smallest real-world test."
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
  if (!apiKey) throw new Error("Anthropic API key not configured.");
  const cluster = state.opp_clusters?.[0];
  const direction = state.directions?.find(d => d.state === "lead") || state.directions?.[0];
  const pilot = state.pilot_run;
  if (!cluster || !direction || !pilot) throw new Error("Stages 1, 2, and 3 must complete before dossier generation.");

  const dossierJob = "dossier_001";
  setAgentRunning(state, {
    id: dossierJob,
    role: "Dossier Synthesizer",
    team: "Builder",
    state: "drafting",
    item: "dossier",
    task: "Synthesize four-screen editorial dossier from full ledger"
  });
  emit("agent_delta", { id: dossierJob, state: "drafting", current_output: "Synthesizing the four-screen dossier..." });

  const synth = await runAgent({
    apiKey,
    model,
    signal,
    roleKey: "dossier_synthesizer",
    jobId: dossierJob,
    itemId: "dossier",
    task: `Compose the four-screen Opportunity Dossier for ${state.campaign.name}. Voice: collegial, never therapeutic, second-person. Ground every claim in the ledger.`,
    contextValues: {
      full_campaign_ledger: state.ledger.slice(0, 60),
      all_artifacts: state.artifacts,
      evaluator_findings: {
        cluster: { id: cluster.id, name: cluster.name, key_uncertainties: cluster.key_uncertainties },
        direction: { id: direction.id, name: direction.name, wedge: direction.wedge, conf: direction.conf },
        pilot,
        defense_records: state.defense_records,
        cleared: state.cleared,
        tensions: state.tensions
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
  bumpStatus(state, { cost_delta: synth.job.cost_usd });
  completeAgent(state, dossierJob, { note: "dossier synthesized", cost_usd: synth.job.cost_usd, model: synth.job.model });
  appendLedger(state, "keep", "Opportunity dossier synthesized.", "dossier/generate");
  fileApi.writeJson("dossiers/dossier.json", dossier);
  fileApi.writeText("dossiers/opportunity_dossier_001.md", md);
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
  if (!apiKey) throw new Error("Anthropic API key not configured.");
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
    task: `Produce 2-4 ADDITIONAL opportunity clusters that are MEANINGFULLY DIFFERENT from these existing clusters: ${existingNames}. Do not repeat them or trivially rephrase. Pick alternative segments, alternative pains, or wedges from underused evidence. Also generate 8-20 supporting hypotheses for them.${rejectionPrompt}`,
    contextValues: {
      evidence_cards: state.evidence.map(e => ({ id: e.id, type: e.type, claim: e.claim, source_id: e.source.id, source_quote: e.source.quote })),
      campaign_brief: { name: state.campaign.name, search_domain: state.campaign.search_domain },
      ontology: ROLES.stage1_clusterer.allowed_context
    }
  });

  const startIdx = (state.opp_clusters || []).length;
  const newClusters = (result.output.opportunity_clusters || []).map((c, i) => ({
    id: `opp_${pad3(startIdx + i + 1)}`,
    name: c.name,
    conf: typeof c.initial_confidence === "number" ? c.initial_confidence : 0.45,
    band: typeof c.confidence_band === "number" ? c.confidence_band : 0.12,
    ev: (c.evidence_card_ids || []).length,
    ten: 0,
    defense: "0 / 0 held",
    state: "held",
    note: c.note || c.opportunity || "",
    descendants: [],
    segment: c.segment,
    pain: c.pain,
    current_workaround: c.current_workaround,
    opportunity: c.opportunity,
    evidence_card_ids: c.evidence_card_ids || [],
    key_uncertainties: c.key_uncertainties || [],
    recommended_microtests: c.recommended_microtests || []
  }));
  state.opp_clusters = [...(state.opp_clusters || []), ...newClusters];

  bumpStatus(state, { cost_delta: result.job.cost_usd });
  completeAgent(state, job, { note: `${newClusters.length} new cluster${newClusters.length === 1 ? "" : "s"} added`, cost_usd: result.job.cost_usd, model: result.job.model });
  appendLedger(state, "keep", `${newClusters.length} alternative cluster${newClusters.length === 1 ? "" : "s"} produced — added to gate options.`, "stage1/find_more");
  fileApi.writeJsonl("stage1/opportunity_clusters.jsonl", state.opp_clusters);

  // Refresh gate candidate list.
  const candidates = state.opp_clusters
    .filter(c => c.state !== "cleared" && c.state !== "discounted")
    .map(c => ({ id: c.id, name: c.name, defense: c.defense, conf: c.conf, ev: c.ev, ten: c.ten, note: c.note }));
  state.gate_queue = (state.gate_queue || []).map(g =>
    g.kind === "stage_1_to_2" ? { ...g, candidates, one_liner: `${(state.evidence||[]).length} evidence · ${(state.tensions||[]).length} tension(s) · ${candidates.length} clusters alive.` } : g
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
  if (!apiKey) throw new Error("Anthropic API key not configured.");
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

  const startIdx = (state.directions || []).length;
  const newDirections = (result.output.product_direction_clusters || []).map((d, i) => ({
    id: `pdc_${pad3(startIdx + i + 1)}`,
    name: d.name,
    conf: typeof d.initial_confidence === "number" ? d.initial_confidence : 0.45,
    band: typeof d.confidence_band === "number" ? d.confidence_band : 0.12,
    microtests: (d.suggested_microtests || []).length,
    defense: "0 / 0 held",
    state: "held",
    wedge: d.wedge,
    parents: [cluster.id],
    descendants: [],
    core_uncertainties: d.core_uncertainties || [],
    suggested_microtests: d.suggested_microtests || []
  }));
  state.directions = [...(state.directions || []), ...newDirections];

  bumpStatus(state, { cost_delta: result.job.cost_usd });
  completeAgent(state, job, { note: `${newDirections.length} new direction${newDirections.length === 1 ? "" : "s"} added`, cost_usd: result.job.cost_usd, model: result.job.model });
  appendLedger(state, "keep", `${newDirections.length} alternative direction${newDirections.length === 1 ? "" : "s"} produced — added to gate options.`, "stage2/find_more");
  fileApi.writeJsonl("stage2/product_direction_clusters.jsonl", state.directions);

  const dirCandidates = state.directions
    .filter(d => d.state !== "cleared" && d.state !== "discounted")
    .map(d => ({ id: d.id, name: d.name, defense: d.defense, conf: d.conf, microtests: d.microtests, wedge: d.wedge, state: d.state }));
  state.gate_queue = (state.gate_queue || []).map(g =>
    g.kind === "stage_2_to_3" ? { ...g, candidates: dirCandidates } : g
  );

  bumpStatus(state, { run_finished: true });
  emit("state", state);
  return state;
}
