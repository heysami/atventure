// Agent role library. Each role declares its tier, allowed/forbidden context,
// system prompt, and JSON schema description. The agent runner is the *only*
// place that constructs prompts — so blinded-tester guarantees are enforced
// in one auditable location instead of being scattered across stage code.

import { callJson, callText, resolveTier } from "./llm.mjs";

// ── Role definitions ────────────────────────────────────────
// allowed_context / forbidden_context match §6 (Memory Separation):
//   Builder    — raw sources, evidence cards, prior microtest results, frameworks
//   Tester     — assigned scenario, role, necessary artifact only
//   Evaluator  — full audit context, independent cross-references

export const ROLES = {
  // ---------- Stage 1 ----------
  stage1_extractor: {
    stage: "stage1",
    team: "Builder",
    role: "Evidence Extractor",
    tier: "opus",
    allowed_context: ["raw_sources", "ontology", "campaign_brief"],
    forbidden_context: ["scorecard_threshold", "tester_responses", "human_preference"],
    system: `You are the Evidence Extractor for the AI Venture Lab harness (spec §5).
You read messy founder-supplied source material and lift atomic, decision-useful evidence cards with full provenance. Each card claims one thing, traces back to a specific source span, and is annotated with a type from the ontology.`,
    schema_hint: `{
  "evidence_cards": [
    {
      "type": "pain_signal | current_workaround | adoption_objection | budget_signal | competitor_claim | competitor_weakness | user_quote | market_signal | trend_signal | regulatory_constraint | technical_constraint | channel_signal | pricing_signal | job_to_be_done",
      "claim": "<one sentence — decision-useful>",
      "source_id": "<id of the source>",
      "source_span": "<line range or paragraph>",
      "source_quote": "<direct quote from the source>",
      "extraction_confidence": 0.0-1.0
    }
  ]
}`
  },

  stage1_clusterer: {
    stage: "stage1",
    team: "Builder",
    role: "Opportunity Clusterer",
    tier: "opus",
    allowed_context: ["evidence_cards", "campaign_brief", "ontology"],
    forbidden_context: ["scorecard_threshold", "tester_responses"],
    system: `You are the Opportunity Clusterer (spec §5). Given evidence cards, you cluster them into named opportunity clusters. Each cluster names: a tight one-line opportunity, the segment it serves, the pain it addresses, the current workaround, key uncertainties, and recommended microtest directions. Be specific to THIS founder's THIS material — never generic frameworks.`,
    schema_hint: `{
  "opportunity_clusters": [
    {
      "name": "<short evocative name>",
      "segment": "<who>",
      "pain": "<what hurts>",
      "current_workaround": "<what they do today>",
      "opportunity": "<one-line wedge>",
      "evidence_card_ids": ["ev_001","ev_013"],
      "key_uncertainties": ["..."],
      "recommended_microtests": ["pain_ranking","objection_simulation"],
      "note": "<one sentence the founder would recognise>",
      "initial_confidence": 0.0-1.0,
      "confidence_band": 0.04-0.18
    }
  ],
  "tensions": [
    {
      "topic": "<short noun phrase>",
      "claim_a": "<one side>",
      "claim_b": "<other side>",
      "linked_evidence_ids": ["ev_001"],
      "implication": "<what the harness will test next>"
    }
  ]
}`
  },

  stage1_evaluator: {
    stage: "stage1",
    team: "Evaluator",
    role: "Evidence Provenance Auditor",
    tier: "opus",
    allowed_context: ["raw_sources", "evidence_cards", "opportunity_clusters", "tensions"],
    forbidden_context: [],
    system: `You are the Evidence Provenance Auditor (spec §6). For each opportunity cluster you produce a Defense Record entry per challenge dimension: Skeptic (adoption ceiling), Coverage (gaps), Bias / Leakage, Method fit, Single-source dependency, Wedge durability. Verdicts are: Held / Weakened / Cleared / Noted. Be calm, past-tense, grounded in source spans.`,
    schema_hint: `{
  "defense_records": [
    {
      "cluster_index": 0,
      "summary": "<X of Y held>",
      "entries": [
        { "challenger": "Skeptic — adoption ceiling", "verdict": "Held", "basis": "ev_044", "reasoning": "..." }
      ]
    }
  ],
  "leakage_warnings": [
    { "kind": "leakage | coverage_gap | broken_artifact", "text": "...", "run": "stage1/extract" }
  ]
}`
  },

  // ---------- Stage 2 ----------
  stage2_strategist: {
    stage: "stage2",
    team: "Builder",
    role: "Opportunity Strategist",
    tier: "opus",
    allowed_context: ["evidence_cards", "opportunity_cluster", "tensions", "ontology"],
    forbidden_context: ["scorecard_threshold", "tester_responses"],
    system: `You are the Opportunity Strategist (spec §6). Given a selected opportunity cluster, propose 2-4 distinct Product Direction Clusters (different wedges into the same opportunity). For each, name a tight wedge, parents, suggested branches (strategy / segment / pilot environment), key unresolved uncertainties, and a microtest plan. One should be the lead; one or more may be intentionally weaker for variance.`,
    schema_hint: `{
  "product_direction_clusters": [
    {
      "name": "<wedge as a phrase>",
      "wedge": "<one sentence — the bet>",
      "core_uncertainties": ["..."],
      "suggested_microtests": [
        { "method": "pain_ranking | value_proposition_test | fake_door_intent | objection_simulation | competitive_substitution | card_sort | service_blueprint | pricing_acceptance", "purpose": "...", "uncertainty_addressed": "..." }
      ],
      "initial_confidence": 0.0-1.0,
      "confidence_band": 0.04-0.18,
      "preferred": true
    }
  ]
}`
  },

  stage2_tester: {
    stage: "stage2",
    team: "Tester",
    role: "Blinded Tester",
    tier: "haiku",
    allowed_context: ["assigned_scenario", "assigned_role", "necessary_artifact"],
    forbidden_context: [
      "builder_rationale",
      "desired_outcome",
      "scorecard_threshold",
      "human_preference",
      "competing_branch_scores"
    ],
    system: `You are a blinded tester. You are NOT told what the harness wants to see. You ONLY have your assigned role and scenario. Respond as that person would, in their voice. Speak in 1-3 short sentences. If the scenario is unclear or you would not engage, say so honestly. Do not roleplay outside the role you were given.`,
    schema_hint: `{
  "tester_responses": [
    {
      "cousin": 1,
      "verdict": "engaged | hesitant | walked",
      "quote": "<their actual reaction in their voice>",
      "objection": "<one short noun phrase or null>"
    }
  ]
}`
  },

  stage2_evaluator: {
    stage: "stage2",
    team: "Evaluator",
    role: "Method Auditor",
    tier: "opus",
    allowed_context: [
      "microtest_spec",
      "tester_responses",
      "product_direction_cluster",
      "evidence_cards"
    ],
    forbidden_context: [],
    system: `You are the Method Auditor + Coverage Auditor + Bias/Leakage Auditor (spec §6). For each microtest produce: a method-fit verdict, a leakage check, a result classification (Held / Weakened / Cleared / Inconclusive), and an updated confidence delta. Audit blind-tester response variance for cousin agreement. Produce a Stage 2 defense record summarising every challenge across the selected product direction.`,
    schema_hint: `{
  "microtest_results": [
    { "method": "...", "result": "Held | Weakened | Cleared | Inconclusive", "score": 0.0-1.0, "finding": "...", "leakage_flag": false }
  ],
  "defense_record": {
    "summary": "<X of Y held>",
    "entries": [
      { "challenger": "Skeptic — pricing ceiling", "verdict": "Held", "basis": "mt_002", "reasoning": "..." }
    ]
  },
  "confidence_update": { "direction_index": 0, "new_conf": 0.0-1.0, "new_band": 0.04-0.18 },
  "advance_recommendation": "advance | hold | discount",
  "compounding_signal": "<e.g. This direction has been through 9 challenges; 7 held>"
}`
  },

  // ---------- Stage 3 ----------
  stage3_planner: {
    stage: "stage3",
    team: "Builder",
    role: "Stage 3 Plan Architect",
    tier: "opus",
    allowed_context: [
      "product_direction_cluster",
      "evidence_cards",
      "tensions",
      "campaign_brief"
    ],
    forbidden_context: ["scorecard_threshold", "tester_responses_raw"],
    system: `You are the Stage 3 Plan Architect (spec §7). Given a selected Product Direction Cluster, draft: a stakeholder map (direct users + influence actors + their incentives & fears), an artifact plan (low-fi sketch register only — no high-polish), 2-3 synthetic personas (composed from specific evidence cards with traits-to-source-quote provenance and a cousin count), and a coverage audit naming what is structurally untested.`,
    schema_hint: `{
  "stakeholders": [
    { "id": "<snake_case>", "role": "direct_user | approver | influence_actor", "incentives": ["..."], "fears": ["..."], "influence": "low | medium | high" }
  ],
  "artifact_plan": [
    { "type": "pricing_page | signage_sample | setup_checklist | voice_script | interactive_app", "audience": "<stakeholder id>", "purpose": "...", "register": "low_fi_sketch" }
  ],
  "personas": [
    { "name": "<short>", "role": "<one phrase>", "from_evidence_ids": ["ev_044","ev_071"], "trait_provenance": [{ "trait": "...", "source_id": "ev_044" }], "cousins": 6, "variance_target": 0.18 }
  ],
  "coverage_audit": { "missing_actor_artifacts": ["..."], "missing_risks": ["..."] }
}`
  },

  stage3_artifact_builder: {
    stage: "stage3",
    team: "Builder",
    role: "Prototype Builder",
    tier: "sonnet",
    allowed_context: [
      "artifact_brief",
      "product_direction_cluster",
      "stakeholder_map",
      "evidence_cards"
    ],
    forbidden_context: ["scorecard_threshold", "tester_responses"],
    system: `You are the Prototype Builder (spec §7, §15 Law 4). Generate the artifact body in deliberate LOW-FI SKETCH register — never high-polish. The reaction must be to the IDEA, not the polish. Produce concise text content (markdown / plain). Voice scripts are 6-12 short lines. Pricing pages list tiers as a table. Signage is one A-frame line + one table-tent line. Setup checklists are 5-12 bullets.`,
    schema_hint: `{
  "artifact": {
    "name": "<short>",
    "type": "pricing_page | signage_sample | setup_checklist | voice_script | interactive_app",
    "audience": "<stakeholder id>",
    "purpose": "<one phrase>",
    "body_markdown": "<the actual artifact, low-fi register>",
    "qa_state": "pass | warn | fail"
  }
}`
  },

  stage3_persona_simulator: {
    stage: "stage3",
    team: "Tester",
    role: "Persona Cousin",
    tier: "haiku",
    allowed_context: ["assigned_persona_brief", "assigned_artifact", "scenario"],
    forbidden_context: [
      "builder_rationale",
      "desired_outcome",
      "scorecard_threshold",
      "other_cousins"
    ],
    system: `You are one cousin of a synthetic persona — ONE instantiation. You react to ONE artifact under ONE scenario. You do NOT see other cousins. You speak in 1-3 sentences in the persona's voice. If you extrapolate beyond what your persona brief explicitly says, mark that sentence with a leading "[improv]" tag — only on the improvised sentence, not the whole response.`,
    schema_hint: `{
  "cousin_response": {
    "verdict": "paid | engaged | hesitant | walked",
    "quote": "<persona's reaction; mark improv sentences with [improv] prefix>",
    "improvisation_present": true
  }
}`
  },

  stage3_evaluator: {
    stage: "stage3",
    team: "Evaluator",
    role: "Implementation QA + Scorer",
    tier: "opus",
    allowed_context: [
      "artifact_set",
      "persona_responses_grouped",
      "product_direction_cluster",
      "evidence_cards"
    ],
    forbidden_context: [],
    system: `You are the Implementation QA Auditor and Scorer (spec §7, §9). Separate artifact quality from opportunity response. Score the pilot on Desirability / Viability / Feasibility / Wedge / Market Attractiveness / Evidence Confidence. Produce a Stage 3 defense record. Identify cleared possibilities. Never count broken artifact runs as opportunity failure.`,
    schema_hint: `{
  "scorecard": {
    "desirability": 0.0-1.0,
    "viability": 0.0-1.0,
    "feasibility": 0.0-1.0,
    "wedge": 0.0-1.0,
    "market_attractiveness": 0.0-1.0,
    "evidence_confidence": 0.0-1.0
  },
  "harness_score": 0.0-1.0,
  "confidence_band": 0.04-0.14,
  "findings": ["..."],
  "cleared_possibilities": [
    { "name": "...", "taught": "<what it taught the campaign>", "reason": "<short>" }
  ],
  "defense_record": {
    "summary": "<X of Y held>",
    "entries": [
      { "challenger": "...", "verdict": "Held | Weakened | Cleared | Noted", "basis": "...", "reasoning": "..." }
    ]
  }
}`
  },

  // ---------- Brief drafter (Chief of Staff translation, §11) ----------
  brief_drafter: {
    stage: "pre_campaign",
    team: "Builder",
    role: "Chief of Staff — Brief Drafter",
    tier: "haiku",
    allowed_context: ["founder_intent_text"],
    forbidden_context: [],
    system: `You are the Chief of Staff (spec §11). The founder has given you messy, half-formed notes about an opportunity space they want the harness to investigate. Translate their natural vocabulary into a structured campaign brief. Be specific to THEIR material — never generic SaaS templates. Keep their voice. If they are uncertain, name the uncertainty in the opening_uncertainties.`,
    schema_hint: `{
  "name": "<short campaign name in the founder's vocabulary, max 60 chars>",
  "search_domain": "<one or two sentences describing the opportunity space they want to investigate, grounded in their actual phrasing>",
  "geography": "<their stated or implied geography — e.g. 'US / EU / global' or 'Singapore'>",
  "business_models": "<comma list of plausible models given the notes — e.g. 'b2c_saas, productized_service'>",
  "avoid": "<newline-separated list of things they said to avoid OR sensible defaults derived from the notes>",
  "founder_advantages": "<newline-separated list of advantages stated or implied in the notes>",
  "opening_uncertainties": "<newline-separated list of 3-5 SPECIFIC uncertainties grounded in what they wrote — never the generic 'who has the sharpest pain'>"
}`
  },

  // ---------- Dossier ----------
  dossier_synthesizer: {
    stage: "dossier",
    team: "Builder",
    role: "Dossier Synthesizer",
    tier: "opus",
    allowed_context: ["full_campaign_ledger", "all_artifacts", "evaluator_findings"],
    forbidden_context: [],
    system: `You are the Dossier Synthesizer (spec §13, §14 Wow Moment 8). Produce the four-screen dossier: How your thinking changed (7 inflection points tied to ledger moments), What we walked past together (specific co-investigated gaps in this campaign), The smallest real-world test (one $4-$10, 30-min observation card with script), Cleared possibilities (each named with what it taught FIRST, then how it was cleared). Voice: collegial, never therapeutic; the founder addressed by name as a peer.`,
    schema_hint: `{
  "title": "...",
  "subtitle": "Harness-validated. Not market-validated.",
  "confidence_value": 0.0-1.0,
  "confidence_band": 0.04-0.10,
  "thinking_changed": [ { "ts": "<date · note>", "note": "..." } ],
  "walked_past": ["..."],
  "smallest_test": {
    "headline": "<single sentence directive>",
    "cost": "$4",
    "duration": "30 min",
    "outcome": "<what it confirms or kills>",
    "observe": ["..."],
    "tiers": [ { "tier": "$4 / 30 min", "action": "..." }, { "tier": "$0 / 60 min", "action": "..." } ]
  },
  "cleared_possibilities": [
    { "name": "...", "taught": "<what it taught>", "cleared_by": "<provenance>" }
  ]
}`
  }
};

// ── Agent runner ────────────────────────────────────────────
//
// Constructs the prompt by *only including* fields named in allowed_context.
// Never includes forbidden_context. Records the full job spec on disk so the
// audit trail proves blinded testers were actually blind.

function buildContextBlock(roleDef, contextValues) {
  const lines = [];
  lines.push(`# Allowed context for ${roleDef.role}`);
  for (const key of roleDef.allowed_context) {
    if (contextValues[key] === undefined) continue;
    const value = contextValues[key];
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    lines.push(`\n## ${key}\n${serialized}`);
  }
  if (roleDef.forbidden_context.length > 0) {
    lines.push(`\n## Hidden from this agent (memory separation)`);
    lines.push(roleDef.forbidden_context.map(k => `- ${k}`).join("\n"));
  }
  return lines.join("\n");
}

export async function runAgent({
  apiKey,
  roleKey,
  jobId,
  contextValues,
  task,
  itemId,
  schemaOverride,
  signal
}) {
  const role = ROLES[roleKey];
  if (!role) throw new Error(`Unknown role: ${roleKey}`);

  const sentContext = {};
  for (const key of role.allowed_context) {
    if (contextValues[key] !== undefined) sentContext[key] = contextValues[key];
  }

  const prompt = `${buildContextBlock(role, contextValues)}\n\n# Task\n${task}\n\n# Output schema\n${schemaOverride || role.schema_hint}\n\nReturn JSON only.`;

  const start = Date.now();
  const llm = await callJson({
    apiKey,
    tier: role.tier,
    system: role.system,
    prompt,
    signal
  });
  const elapsed = (Date.now() - start) / 1000;

  return {
    job: {
      id: jobId,
      stage: role.stage,
      team: role.team,
      role: role.role,
      model_policy: { tier: resolveTier(role.tier) },
      model: llm.model,
      allowed_context: role.allowed_context,
      forbidden_context: role.forbidden_context,
      sent_context_keys: Object.keys(sentContext),
      task,
      item: itemId,
      state: "completed",
      elapsed: `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${Math.floor(elapsed % 60).toString().padStart(2, "0")}`,
      cost_usd: llm.cost_usd,
      in_tokens: llm.in_tokens,
      out_tokens: llm.out_tokens,
      stop_reason: llm.stop_reason,
      note: typeof llm.output === "object" ? "completed" : String(llm.output).slice(0, 240)
    },
    output: llm.output,
    raw_text: llm.raw_text
  };
}

export async function runText({ apiKey, tier, system, prompt }) {
  return callText({ apiKey, tier, system, prompt });
}
