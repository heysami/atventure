# AI Venture Lab — Product Spec (v2)

> Updated to integrate the wow architecture, design laws, persona-moments, the Chief of Staff layer, the cockpit/editorial register split, and multimodal capabilities. Mechanical sections of v1 are preserved; UX, governance, and presentation layers are extended.

---

## 1. Product Thesis

AI Venture Lab is a local-first app that turns messy real-world evidence into harness-validated **Opportunity Dossiers** through a mandatory three-stage process:

1. **Real-Data Collector**
2. **Internal Brainstorm + Microtests**
3. **Simulated Pilot**

The harness does not claim market validation. It validates opportunities only inside the harness by combining evidence extraction, structured agent simulation, proven microtest frameworks, simulated pilot environments, scoring, confidence tracking, and human gate decisions.

**Core philosophy:**

- Invalidation is progress.
- Evidence shifts confidence; it rarely creates certainty.
- Human judgment is the final authority at stage gates.
- Agents can recommend, simulate, generate, audit, and improve — but they do not silently rewrite the basis of truth.

**Product metaphor:** an AI Venture Lab — a research and simulation environment for discovering, stress-testing, and refining business/product opportunities before market execution.

**Wow architecture (new):** The lab has two coexisting registers — a dense **cockpit** for inspection and a polished **editorial layer** for moments that matter — and a voice-first **Chief of Staff** that translates between the founder's natural vocabulary and the harness's structured one. Every wow moment is grounded by cognitive provenance and meets the founder's intuition through specific, recognizable detail in their own material.

---

## 2. Grounding References

Structural patterns borrowed from:

- **MiroFish** — multi-agent social simulation and graph-based context
- **autoresearch** — versioned experiment loop, fixed evaluator, mutable artifact, run budget, ledger, keep/discard/crash decisions
- **Karpathy LLM Wiki gist** — raw sources, generated synthesis, schema/rules as separate knowledge layers
- **Design Council Double Diamond** — divergence before convergence
- **Innovation Tournament theory** — many candidates generated, clustered, narrowed through staged selection
- **IDEO design thinking** — desirability/feasibility/viability as opportunity evaluation lenses
- **Strategyzer Business Model Canvas** & **Value Proposition Canvas** — segments, jobs, pains, gains, channels, revenue, cost, business model fit
- **Strategyzer Test Card** — hypothesis, test, metric, threshold
- **Jobs To Be Done** — opportunities emerge from customer progress, jobs, pains, current workarounds
- **Porter Five Forces** — competition, substitutes, buyer power, supplier power, industry pressure
- **Diffusion of Innovations** — adoption friction, relative advantage, compatibility, complexity, trialability, observability
- **NN/g card sorting & tree testing** — UX research for mental models and information architecture
- **Popperian falsifiability** — applied cautiously through disconfirmation probes rather than aggressive one-shot falsification

---

## 3. Core Objects

### Campaign

The top-level unit. A campaign starts before the opportunity is known.

```yaml
campaign:
  name: "Neighborhood café — fixing the afternoon slump"
  search_domain: "Afternoon revenue, underused seats, regulars, remote workers, and café operations"
  strategic_constraints:
    geography: "Singapore / US / global"
    preferred_business_models:
      - b2b_saas
      - productized_service
    avoid:
      - regulated medical claims
      - hardware-heavy solutions
    founder_advantages:
      - AI prototyping
      - product/design expertise
      - access to SMB operators
```

Campaigns are isolated by default. Evidence, results, ledgers, personas, and decisions do not leak between campaigns.

### Global Templates

Reusable defaults: evidence card ontology, theory links, microtest method library, scorecard dimensions, weight profiles, role templates, evaluator rubrics. Campaigns snapshot global templates at creation. Later global changes do not affect existing campaigns unless explicitly imported. Imports are forward-only and never rewrite prior runs.

### Opportunity Dossier

The final artifact. Harness-validated, not market-validated. Includes validation scope, opportunity cluster, product direction, evidence basis, microtest outcomes, simulated pilot outcomes, scorecard and weight profile, confidence levels, robustness patterns, invalidation ledger, failed/discarded paths, unresolved uncertainties, recommended next action outside the harness if any.

The dossier surface is described in §13 (App Product Surface — Editorial Layer) and §14 (Wow Moments). Mechanically the dossier is a markdown/HTML artifact; experientially it is presented as an investor briefing.

---

## 4. Mandatory Three-Stage Flow

Stage 1 → Stage 2 → Stage 3 → Opportunity Dossier. No Stage 3 without Stage 2. No Stage 2 without Stage 1.

| Stage | Output |
|---|---|
| Stage 1 | Opportunity Clusters |
| Stage 2 | Product Direction Clusters |
| Stage 3 | Opportunity Dossiers |

---

## 5. Stage 1: Real-Data Collector

### Goal

Identify many opportunity hypotheses from messy real-world evidence. Divergent by design. No hard cap on the number of hypotheses; keep generating as long as evidence supports meaningful novelty.

### Inputs

Messy curated sources: dumped links, screenshots, interview notes, call transcripts, support tickets, competitor pages, reviews, forum threads, CSV exports, internal docs, rough notes, voice memo transcripts.

### Process

1. Normalize source material
2. Extract decision-useful evidence cards
3. Preserve raw source provenance
4. Generate many opportunity hypotheses
5. Cluster hypotheses into opportunity spaces
6. Identify contradictions
7. Annotate evidence fit and strategic fit separately
8. Produce key uncertainties per cluster

### UX framing — Reading Theater (new)

The pour-in moment is not an upload progress bar. It is a live **reading theater**:

- **What I'm reading** — source manifest populates as files are recognized (filename, modality, date, length)
- **What I'm noticing** — evidence cards stream into view one at a time as the harness reads, each card showing the lifted source quote and the type assigned
- **Whose voices, in what proportions** — a corpus-shape view updates live (e.g., *"Your 4 customer interviews: 38%. Forum scrape: 22%. Your own voice memos: 15%. 11 smaller sources: 25%."*)
- **First tension flag** — when the harness detects the first contradiction, it surfaces gently and immediately (*"I noticed a tension between two of your customers. Want me to keep an eye on it?"*)

The principle: the founder must **see comprehension within 90 seconds**, including at least one specific noticing of something they themselves missed in their own material.

### Evidence Cards

Atomic extracted knowledge layer. Raw sources are immutable. Evidence cards are append-only. Wiki pages and graph views are regenerable.

```yaml
id: ev_00142
type: adoption_objection
claim: "Owners worry AI-written messages may sound impersonal and damage customer relationships."
source:
  id: src_008
  span: "lines 42-58"
  modality: transcript
theory_links:
  - diffusion_of_innovations.complexity
  - diffusion_of_innovations.compatibility
  - value_proposition_canvas.pain
scorecard_links:
  - viability.adoption_friction
  - desirability.trust
confidence:
  extraction: 0.82
  source_quality: 0.76
  recency: 0.91
status: active
```

**Initial evidence card types:**
`pain_signal` · `job_to_be_done` · `current_workaround` · `budget_signal` · `adoption_objection` · `competitor_claim` · `competitor_weakness` · `workflow_step` · `user_quote` · `market_signal` · `trend_signal` · `regulatory_constraint` · `technical_constraint` · `channel_signal` · `pricing_signal`

The ontology is theory-backed and extensible. Agents may propose new types; human approval required to enter the active ontology.

### Contradictions (renamed in UX as "Tensions")

First-class artifacts. Internal model name *contradiction* is preserved; surfaced to the founder as **tension** (less adversarial language).

```yaml
id: con_012
topic: "willingness to pay for quiet-hours seating"
claim_a: "Owners want to fill underused afternoon seats with higher-intent customers."
claim_b: "Owners worry pass holders will make regulars feel pushed out."
linked_evidence: [ev_011, ev_039, ev_044]
implication: "May require a punch-card framing, regulars-first rules, or signage that protects café identity."
```

Tensions feed Stage 2 microtest planning.

### Opportunity Hypotheses

```yaml
id: hyp_014
segment: neighborhood_cafe_owner
job: improve revenue during the 2-5pm lull
pain: tables are occupied by low-spend regulars while the team cannot fully reset
current_workaround: informal discounts, hoping for walk-ins, occasional specials
opportunity: quiet-hours seating pass or bookable afternoon work session
evidence_card_ids: [ev_001, ev_013, ev_044]
initial_confidence:
  pain_strength: 4
  budget_signal: 3
  workaround_weakness: 4
  evidence_confidence: 0.62
```

### Opportunity Clusters

The gate artifact from Stage 1 to Stage 2. Each cluster includes: cluster name, representative hypotheses, supporting evidence cards, contradictions/tensions, key uncertainties, evidence fit, strategic fit, business theory tags, possible product wedges, recommended microtest directions, AI recommendation (clearly labeled).

Human decides which clusters advance, hold, merge, split, archive, or request more exploration.

---

## 6. Stage 2: Internal Brainstorm + Microtests

### Goal

Use agent teams and proven microtest frameworks to reduce opportunity clusters into Product Direction Clusters. Not full product implementation — a structured microtest lab.

### Inputs

Selected opportunity cluster(s), evidence cards, contradictions, key uncertainties, strategic constraints, theory-linked ontology, method library.

### Teams

**Builder Team** — domain knowledge, expert reasoning, business/product strategy. Roles: Opportunity Strategist, Domain Researcher, UX Researcher, Business Model Analyst, Prototype Designer / Builder, Skeptic.

**Tester Team** — represents laymen, target users, buyers, operators, blockers. Blinded to desired outcome.

**Evaluator/Auditor Team** — independent. Roles: Method Auditor, Evidence Provenance Auditor, Metric Scorer, Bias / Leakage Auditor, Implementation QA Auditor.

> **UX naming note:** the *Skeptic* role is internally retained but surfaced to the founder as part of the **Defense Record** (see §14, Wow Moment 4). The Bias/Leakage Auditor is surfaced as the **Coverage Auditor**.

### Memory Separation

| Team | Can access |
|---|---|
| Builder | raw sources, evidence cards, wiki/graph views, prior hypotheses, prior microtest results, domain frameworks, expert playbooks |
| Tester | assigned role/cohort, scenario prompt, necessary artifact/context, role-appropriate memory |
| Evaluator | full audit context plus independent cross-references |

Tester Team **cannot** see: Builder rationale, desired outcome, score threshold, human preference, competing branch scores.

### Microtest Method Library

Initial library: value proposition test, Jobs/pain ranking, card sorting, tree testing, fake-door / intent test, objection simulation, competitive substitution test, simulated whiteboarding.

**Microtest design flow:** key uncertainty → method selection → test design → blinded tester run → evaluator scoring → confidence update.

Method selection must explain: risk being tested, chosen framework, why the framework fits, metric(s), threshold, expected evidence, advance/revise/discount logic.

### Experimental Tests

Maturity statuses: `experimental` · `calibrated` · `accepted` · `deprecated`. Experimental tests may influence decisions with discounted confidence and explicit labeling. Human approval required to promote campaign-local methods to global.

### Test DAG

Microtests run as a dependency graph — parallel when independent, sequential when one result changes the next.

```yaml
microtest_plan:
  parallel_batch_1:
    - pain_ranking
    - current_workaround_mapping
    - competitive_substitution
  sequential_batch_2:
    depends_on: [parallel_batch_1]
    tests:
      - value_proposition_test
      - card_sort
  gate_batch_3:
    - fake_door_intent
```

### Stage 2 Output: Product Direction Clusters

```yaml
product_direction_cluster:
  name: "Quiet-hours day pass / punch card"
  opportunity_cluster_id: opp_003
  core_wedge: "Sell afternoon work-friendly access without making the café feel like a co-working space."
  supported_by_microtests: [mt_011, mt_014]
  unresolved_uncertainties:
    - willingness_to_pay
    - regulars_feeling_displaced
    - barista_workflow_burden
  suggested_stage_3_branches:
    strategy: [drop_in_day_pass, ten_pack_punch_card, reserved_table_membership]
    segment: [remote_worker, existing_regular, cafe_owner_operator]
    pilot_environment: [quiet_afternoon, crowded_regulars_table, nearby_coworking_substitute]
  prototype_directions:
    - tap_to_pay_check_in
    - table_tent_signage
    - tiered_pricing_page
    - barista_talking_script
  evaluator_notes:
    - "Regulars feeling crowded out remains the dominant unresolved uncertainty; Stage 3 should include influence actors who do not directly buy the pass."
```

Human decides which product direction clusters advance, hold, merge, split, archive, or request more microtests.

---

## 7. Stage 3: Simulated Pilot

### Goal

Implement and test selected product directions in simulated environments. Implementation matters here. Artifacts may be apps, image assets, pricing pages, service scripts, shop displays, dashboards, chatbots, packaging concepts, spreadsheets, signage, voice scripts, or other modalities.

### Inputs

Selected Product Direction Cluster, Stage 3 Plan, stakeholder map, artifact plan, scorecard, weight profile, success threshold, branch tree.

### Stage 3 Plan

```yaml
stage_3_plan:
  selected_product_direction_cluster: pdc_004
  implementation_candidates:
    - tap_to_pay_day_pass_flow
    - ten_pack_punch_card_flow
    - reserved_table_membership_flow
  stakeholder_map:
    direct_users: [remote_worker, cafe_owner, barista_on_shift]
    influence_actors: [existing_regular, passing_foot_traffic, nearby_coworking_space, accounting_or_budget_actor]
  branch_tree:
    strategy: [drop_in_day_pass, ten_pack_punch_card, reserved_table_membership]
    segment: [remote_worker, regular_customer, cafe_owner_operator]
    pilot_environment: [quiet_afternoon, regulars_sensitive_to_crowding, nearby_coworking_competitor]
  scorecard:
    dimensions: [desirability, viability, feasibility, wedge, market_attractiveness, evidence_confidence]
    weight_profile: b2b_smb_default
  success_threshold:
    harness_validated: 0.72
```

Builder proposes the Stage 3 Plan; Evaluator audits; Human approves or edits before implementation.

### Stakeholder Influence Graph

```yaml
stakeholders:
  remote_worker:
    role: direct_user
    influence: medium
    incentives: [reliable_seat, affordable_work_session, good_coffee]
    fears: [awkward_rules, unclear_time_limits]
  cafe_owner:
    role: approver
    influence: high
    incentives: [higher_afternoon_revenue, simple_operations, protect_regulars]
    fears: [café_feels_like_coworking, barista_workflow_disruption]
  existing_regular:
    role: influence_actor
    influence: high
    incentives: [familiar_atmosphere, access_to_usual_table]
    fears: [being_pushed_out, room_getting_too_loud]

influence_edges:
  - {from: remote_worker, to: cafe_owner, type: purchase_intent_feedback, strength: 0.7}
  - {from: existing_regular, to: cafe_owner, type: social_license_pressure, strength: 0.8}
  - {from: cafe_owner, to: barista_on_shift, type: rollout_instruction, strength: 0.6}
```

### Synthetic Personas — composed-from-evidence (new)

Synthetic personas are visible **recipes** of the campaign's own evidence cards, not generic priors. The Persona Composition object exposes:

- which evidence cards compose this persona, with source provenance
- which traits trace to which source quotes
- which response sentences are grounded vs. extrapolated (per-claim improvisation flag)
- variance across cousins (multiple instantiations of the same persona under the same scenario)

This composition transparency is what makes synthetic test results auditable rather than dismissable.

### Artifact Plan

```yaml
artifact_plan:
  branch: cafe_day_pass_ten_pack
  artifacts:
    - {type: interactive_app, audience: cafe_owner_and_barista, purpose: test tap-to-pay check-in without breaking barista rhythm}
    - {type: pricing_page, audience: remote_worker, purpose: test willingness-to-pay across drop-in, 10-pack, and monthly formats}
    - {type: signage_sample, audience: passing_foot_traffic_and_regulars, purpose: test work-friendly framing without scaring regulars}
    - {type: setup_checklist, audience: cafe_owner, purpose: test adoption friction for a solo-operator rollout}
  coverage_audit:
    missing_actor_artifacts: [existing_regular]
    missing_risks: [café_identity_dilution]
```

Artifact planning is driven by stakeholder map, key risks, pilot environment, scorecard coverage.

### Multimodal Artifact Generation (new)

Stage 3 artifacts can be generated using external media services (see §15 Multimodal Capabilities). Artifact types and the recommended generation source:

| Artifact type | Generated via | Register |
|---|---|---|
| Pricing pages, mockups, signage, table-tents, packaging | fal.ai (image / vision-language) | **Low-fi sketch register** — never high-polish. Generated artifacts are deliberately rough so personas react to *the idea*, not the polish. |
| Voice scripts, barista talking scripts, voicemail concepts | ElevenLabs (TTS) | Voice rendering is opt-in and labeled |
| Synthetic persona voice rendering | ElevenLabs (TTS, voice profile derived from composition) | Opt-in; voice is generated, words are grounded |
| Interactive app flows, pricing flows | Code-capable LLM | Iterative; QA-audited |

> **Design rule (§14, Law 4):** generated artifacts must not overclaim fidelity. A polished mockup biases persona response toward polish, not idea. Sketch register is the default.

### Artifact QA

Implementation quality is separate from opportunity response.

| Implementation quality | Opportunity response |
|---|---|
| artifact loads correctly | user pull |
| flow completes without bugs | buyer interest |
| copy is understandable | trust |
| visual/content fidelity is adequate | adoption friction |
| scenario consistency | willingness to pay/adopt |
| QA auditor pass/fail | stakeholder alignment, competitive preference |

If artifact quality fails, the run is invalidated or discounted — never counted as opportunity failure. Failed-QA runs feed implementation improvement only.

### Branching

Parallel branches: Opportunity → Strategy → Segment → Test-environment → Implementation iteration. Goal: robustness across plausible strategies, segments, environments — not the highest score in one branch.

### Stage 3 Outputs

Prototype/artifact set, simulation report, decision dossier. Primary output: the Opportunity Dossier.

---

## 8. Autoresearch-Style Loops

Each stage runs as a separate experiment loop with a shared campaign ledger. Every stage has: mutable artifact, fixed evaluator for that run/branch, budget, version/commit, run log, results ledger, keep/discard/crash/invalid status.

### Shared Campaign Ledger

```yaml
campaign_ledger:
  - stage
  - run_id
  - artifact_versions
  - evaluator_version
  - status
  - score_summary
  - confidence_update
  - human_gate_decision
```

The ledger is append-only and is the source of truth. Materialized state files are generated for app speed. If ledger and state disagree, regenerate state from the ledger.

### Stage 1 Loop

- **Mutable:** hypothesis extraction strategy, clustering strategy, contradiction detection strategy
- **Fixed evaluator:** evidence grounding, novelty yield, cluster quality, contradiction capture, strategic-fit annotation
- **Improvement metrics:** evidence grounding, novelty yield, theory coverage, contradiction capture, cluster coherence, strategic-fit annotation, human usefulness
- **Keep rule:** improves novelty, grounding, contradiction capture, or cluster usefulness without significantly increasing noise

### Stage 2 Loop

- **Mutable:** team composition, test DAG, microtest designs, adapted/experimental test methods
- **Fixed evaluator:** method fit, uncertainty reduction, tester blindness, learning quality, product-direction clarity
- **Improvement metrics:** risk coverage, method fit, tester blindness, learning yield, product-direction clarity, test efficiency, experimental method quality, human usefulness
- **Keep rule:** uncertainty reduction, method fit, product-direction clarity, or efficiency improves without increasing leakage or bias

### Stage 3 Loop

- **Mutable:** implementation artifacts, artifact set, pilot environment, personas/stakeholder graph, branch setup
- **Fixed evaluator:** scorecard, weight profile for branch, success threshold, QA threshold, robustness comparison

Stage 3 has two keep categories:

- `keep_candidate_improvement` — product/artifact got better
- `keep_harness_improvement` — pilot environment / persona / test quality got better, even if score went down

**Statuses:** `keep_candidate_improvement`, `keep_harness_improvement`, `discard_candidate_change`, `discard_harness_change`, `crash`, `invalid_artifact`, `invalid_leakage`, `needs_human_review`.

---

## 9. Scoring and Confidence

### Scorecard Dimensions

The frozen scorecard evaluates the business opportunity, not only product usability.

| Dimension | Sub-factors |
|---|---|
| **Desirability** | pain intensity, value clarity, task success, emotional pull, repeat-use likelihood |
| **Viability** | willingness to pay, buyer urgency, budget fit, sales friction, retention/expansion potential |
| **Feasibility** | implementation complexity, data/tool dependency risk, operational support burden, delivery cost, time to useful MVP |
| **Defensibility / Wedge** | superiority to current workaround, competitor substitution resistance, uniqueness of insight/workflow/channel, switching trigger |
| **Market Attractiveness** | segment size, reachable niche, frequency of problem, trend/timing strength |
| **Evidence Confidence** | real-data grounding, persona fidelity, simulation variance, source quality, real-world validation gap |

Weights are adjustable by users and can vary by branch. Weight profiles are part of the run configuration. Post-run reweighting is treated as what-if analysis unless used in a new official branch/run.

### Metric Mapping

```yaml
metric_id: mt_014_pricing_acceptance
source: simulated_pilot
observed_event: "7 of 10 owner agents asked to continue after pricing screen."
scorecard_dimension: viability
factor: willingness_to_pay
normalized_score: 4.2
confidence: 0.64
weight: 0.20
notes:
  - "Synthetic-only; confidence discounted."
```

Evidence Confidence acts as a multiplier or adjustment, not merely a decorative score.

### Confidence Layers

Track confidence separately at: evidence card, opportunity hypothesis, opportunity cluster, product direction, test result, simulated pilot, dossier.

### Confidence Updates

| Result | Test quality | Confidence update |
|---|---|---|
| Positive | High | Increases |
| Positive | Low | Increases slightly |
| Negative | High | Decreases |
| Negative | Low | Decreases slightly / inconclusive |
| Broken artifact | n/a | No opportunity confidence update |
| Leaky test | n/a | Invalid or heavily discounted |

### Disconfirmation

Seek disconfirming evidence; avoid aggressive one-shot falsification. Invalidation requires convergent negative evidence: artifact QA passed, leakage checked, multiple branches/test variants failed, the same blocker repeats, evaluator confidence high enough, no obvious alternate product direction addresses the same root opportunity.

**Invalidation scope:**

- One failed prototype invalidates that prototype
- Several failed product directions may invalidate a product cluster
- Repeated failure across the opportunity space may invalidate the opportunity cluster

### UX framing — Cleared Possibilities (new)

Invalidated branches are surfaced to the founder as **cleared possibilities** — co-equal artifacts with the lead branch, never buried. Each cleared branch carries forward what it taught the campaign. All clearings are reversible via new ledger events. See §14, Wow Moment 6.

---

## 10. Human Governance

The human is the **principal investigator / venture lead**.

**Human owns:**
- source curation priorities
- opportunity framing
- ontology/scoring approvals
- stage gate decisions
- final branch selection
- real-world validation decisions
- ethical/business constraints

**Agents own:**
- source digestion
- evidence extraction
- hypothesis generation
- persona/stakeholder synthesis
- microtest design proposals
- prototype/artifact generation
- simulated runs
- metric calculation
- branch comparison
- self-improvement proposals

### Stage Gates

Gates are explicit decision screens (or voice conversations via the Chief of Staff — see §11).

**Stage 1 → Stage 2 gate** surfaces: opportunity clusters, evidence cards, contradictions, evidence fit, strategic fit, key uncertainties, AI recommendation, confidence/uncertainty. Human actions: advance, hold, merge/split, archive, request more Stage 1 exploration.

**Stage 2 → Stage 3 gate** surfaces: product direction clusters, microtest outcomes, unresolved uncertainties, proposed Stage 3 Plan, stakeholder map draft, artifact plan draft, scorecard/weights. Human actions: advance, hold, merge/split, archive, request more Stage 2 microtests.

Gate decisions are reversible through new ledger events. History is never rewritten.

### Promotion to Global Templates

Campaign artifacts may be promoted to global templates by human decision. Promotion candidates: new evidence card type, theory link mapping, microtest method, role template, evaluator prompt, artifact QA checklist, scorecard preset, stakeholder-map pattern.

```yaml
promoted_from_campaign: camp_014
artifact_type: microtest_method
name: procurement_room_roleplay
promoted_by: human
status: experimental
promotion_note: "Useful for B2B enterprise adoption simulations where buyer, user, security, and finance actors disagree."
example_runs:
  - stage2/mt_022
  - stage3/pilot_006
```

New global templates are inherited only by newly created campaigns. Existing campaigns can explicitly import newer templates for future runs only.

---

## 11. The Chief of Staff — Voice-First Orchestration (new)

A first-class layer between the founder and the harness.

### Metaphor

The Chief of Staff is the founder's personal staff. To the founder, it is a warm, intelligent assistant who listens to messy thoughts, asks clarifying questions, summarizes back, and acts on intent. To the harness, it is the orchestrator that translates intent into structured campaign artifacts, ledger events, and gate decisions.

### Core principle

> **The founder never has to speak the harness's language.** The Chief of Staff translates between the founder's natural vocabulary and the harness's structured one — in both directions.

### Dual-modality

Voice and cockpit are equally first-class. Cockpit-first founders never have to talk. Voice-first founders never have to type. Both paths reach every state and every action. The system never picks for the founder — the founder picks per moment.

### Phases

**Phase 0 — Pre-campaign brainstorm.** Founder hits "new campaign" and is met by a voice conversation, not a form. Chief of Staff listens for 5–15 minutes, asks 3–6 calibrated clarifying questions, summarizes back as a one-page draft brief: search domain, strategic constraints, founder advantages, sources to ingest, opening uncertainties. Founder reviews on screen, edits via voice or text, approves. Stage 1 reading begins.

**Phase 1 — During reading and runs.** Chief of Staff stays present but quiet. Summonable on demand:
- *"What's running right now?"* → plain-language summary
- *"How's that quiet-hours cluster looking?"* → narrates the defense record
- *"Skip the rest. Just tell me what mattered."* → reads signal-only replay aloud
- *"Add a constraint — no more than one part-time staffer."* → adds to strategic constraints, logs as ledger event with the founder's reason

**Phase 2 — At gates (decision conversation).** The Chief of Staff offers: *"Want to talk through this?"* The founder thinks out loud; the Chief of Staff reflects relevant material in conversation form, surfaces unresolved uncertainties, and translates the final call into a ledger event. The Chief of Staff does not decide.

**Phase 3 — Mid-flight adjustment.** Founder, on a walk: *"Add a microtest — what if drop-in pricing has a 50% discount during the quietest hour?"* Chief of Staff confirms test design, estimates cost and time, queues on approval, logs the founder's reason verbatim.

**Phase 4 — Between sessions.** Voices the handoff note when the founder reopens the app: *"Welcome back. Yesterday you advanced quiet-hours and held light-bites. Run 14 finished overnight; three moments worth your eyes. Want me to walk you through them, or do you want to see them on screen?"*

### Voice & register

One carefully-chosen ElevenLabs voice for the Chief of Staff — calm, deliberate, intelligent. The same voice register narrates the dossier (opt-in audio version). Continuity of voice = continuity of trust.

### Voice profile

- Warm but professional, never sycophantic, never hesitant
- Speaks the founder's vocabulary; never uses harness jargon unless the founder does
- Always honest about what it's about to do (*"I'm going to translate that into Y campaign structure — review the draft?"*)
- Always available, never demanding

### What the Chief of Staff is **not**

- Not a synthetic persona for testing (those are Stage 3 Tester agents)
- Not the harness's research engine (Builder/Tester/Evaluator teams do that work)
- Not a coach or therapist
- Not in conflict with the cockpit — it is a parallel surface to the same ledger

### Privacy contract

Voice transcripts are stored locally in the campaign's ledger. Only the structured query and necessary context go to the LLM. Founder can review every transcript. No voice material leaves the device unless explicitly permitted (e.g., for ElevenLabs TTS rendering, with cost disclosure).

---

## 12. Design Laws & Wow Moments (new)

The product surface is governed by seven design laws. Each persona-moment in the founder's lifecycle has a specific wow primitive. This section is normative — implementation must serve these laws.

### Seven Design Laws

1. **Cognitive grounding × intuitive recognition.** Every claim is both rigorously traceable AND viscerally recognizable. A finding is only ready to surface when it can be both inspected (provenance, source spans, audit chain) and *felt* (the founder recognizes it from their own material).

2. **Notice what we miss, not generic gaps.** The harness must surface specific things in *this* founder's *this* material — never framework checklists ("test for feasibility"). Specificity is the wow; generic = cliche.

3. **Defense record over combat.** The harness's adversarial work happens *before* the founder sees a finding. The founder consumes a past-tense rigor log — *"this cluster was challenged on five fronts, here's what survived"* — never a live attack/defend interaction.

4. **The wow is in the specifics; the frame makes specifics legible; the frame is not the wow.** Polish does not substitute for specific noticing. Generated artifacts default to low-fi sketch register so personas react to ideas, not polish.

5. **Anxiety met by inspectability on demand, never forced reassurance.** Every form of founder anxiety (money, time, existence, quality, outcome, control) has a one-glance or one-click answer. None require declaring a mode.

6. **Cockpit dense, wow screens editorial — the register shift signals what matters.** The cockpit is the engine room (dense, technical, monospace where appropriate). Wow screens are the boardroom (generous, editorial, prose, calibrated typography). The register shift between them is itself a wow primitive.

7. **The Chief of Staff translates between the founder's vocabulary and the harness's. Voice and cockpit are equally first-class.** The founder is never asked to learn the harness's language; never required to use voice; never required to use the cockpit. Both surfaces reach every action.

### Twelve Persona-Moments

Primary persona: the **re-entering solo founder** — has been burned at least once, distrusts their own pattern-matching, holds messy evidence and stakes of life and runway.

| # | Moment | Felt-state at peak | Wow primitive |
|---|---|---|---|
| 1 | First 30 seconds | Curiosity laced with *"another AI tool"* cynicism | Demo campaign running live as the empty state; not a tutorial |
| 2 | Stage 1 ingestion (pour-in) | Vulnerability flutter; watching for whether the harness *reads* | Reading theater — *What I'm reading / noticing / whose voices*, plus first tension flag within 90 seconds |
| 3 | Active run / swarm watching | Impostor flutter, attention drift, possible babysitting anxiety | Quiet workshop + signal-only replay on return; inspectability-on-demand for the anxious; "step away — we'll be here" contract for the trusting |
| 4 | Stage 1 → 2 gate | Queasy specific feeling of about to be fooled again | Defense record (past-tense rigor log) + four panels: **Foundations / Mind-changers / Second opinion / Strengthen this** |
| 5 | Stage 3 simulated persona rejection | Defensive flinch; dismissal reflex; reverse-trap (accept yes, dismiss no) | Persona shown as composition recipe + response grounding to source quote + cousin variance + improvisation flag (per-claim) |
| 6 | Stage 3 invalidation in real-time | Small grief or relief; latent doubt about the harness's aggression | Graceful conclusion card; the branch's contribution named *before* its failure; reopen affordance always visible |
| 7 | Stage 2 → 3 gate | Higher stakes; near-action commitment | Same architecture as Stage 1 gate, denser content, **compounding-rigor signal** (*"this direction has been through 14 challenges across both gates; 11 held"*) |
| 8 | Dossier delivery | Verdict-hunger, deflation trap, max susceptibility to confirmation bias | Four screens: **How your thinking changed / What we walked past together / The smallest real-world test / Cleared possibilities**. Investor-briefing register. |
| 9 | Back next morning | Fragmentation, mild dread, continuity hunger | Handoff note — *"Yesterday-you left this for today-you"* — text and (opt-in) voice |
| 10 | Pre-campaign brainstorm conversation | Messy, half-formed, not yet a campaign | 12-minute voice conversation produces a structured campaign brief for the founder to review |
| 11 | Decision conversation at gates | Wanting to think out loud with someone fully informed | The Chief of Staff reflects relevant material in conversation, surfaces unresolved tensions, never decides |
| 12 | Mid-flight adjustment via voice | On a walk; intent forms outside the screen | Voice intent flows directly into the harness without a screen |

### Renamed UX surfaces (carried throughout the product)

| Internal model name | UX surface name |
|---|---|
| Skeptic agent challenge | Defense record entry |
| Adversarial pass | Stress-in-daylight pass (or folded into Mind-changers) |
| Bias / leakage auditor | Coverage auditor |
| Contradiction | Tension |
| Invalidation | Pruning / cleared possibility |
| Failed branch | Cleared branch (with what it taught the campaign) |
| "Try to break this" button | (removed — replaced by always-on **Defense record** badge) |
| Recommended next action | The smallest real-world test |
| Limitations / unresolved uncertainties | What we walked past together |
| Confidence score | Where this stands inside the harness *(footer: not market validation)* |
| Live run inspection | Step into the lab *(opt-in, not default)* |
| Streaming transcript | What's being said *(opt-in, not default)* |
| Active runs panel | In flight |
| Notifications | What you missed *(returns-only, signal-ranked)* |
| Empty state | Demo campaign — explore it, or start yours |
| Ingestion | Reading |
| Source manifest | What I'm reading |
| Evidence extraction stream | What I'm noticing |
| Source coverage breakdown | Whose voices, in what proportions |

### Inspectability-on-demand: six anxiety shapes (Law 5)

| Anxiety | One-glance answer (always present, never demanding) |
|---|---|
| Money — *"is this draining my budget?"* | Tiny cost ticker in run header. Visible, not animated. Pre-set cap visible. |
| Time — *"is this taking longer?"* | ETA ticker next to cost. Updates on real progress, not fake animation. |
| Existence — *"is anything happening?"* | Subtle pulse line at screen bottom — sparkline of last N minutes of agent activity. |
| Quality — *"is the AI doing something stupid?"* | One click on any agent card → live job spec, allowed/forbidden context, current input/output. Real, not staged. |
| Outcome — *"will this come up empty?"* | Item view's defense badges and cousin counts update live. A glance shows real evidence accumulating. |
| Control — *"can I stop this?"* | Visible (small, never bouncing) Soft pause / Hard pause controls. Never hidden in a menu. |

### Adaptive narration (the only piece that senses the founder)

If the founder hovers, opens transcripts often, or refreshes the cost ticker repeatedly for several minutes, the harness *quietly offers* (never modal): *"Want me to narrate the next significant moment?"* — one-click yes opens the *"What's happening now"* sentence in the header; one-click dismiss never shows again this run. The founder is never told they look anxious.

---

## 13. App Product Surface

The first product surface is a local-first app operator console with a parallel voice surface (Chief of Staff). It is not CLI-first. The app is file-backed underneath but presents a live **Campaign Control Room** alongside a conversational Chief of Staff.

### Two registers

The app has two coexisting registers — one for daily work, one for moments that matter.

| Zone | Register | Examples |
|---|---|---|
| **Cockpit** | Operator console — dense, technical, JetBrains Mono for identifiers, ledger-grade UI | Top bar, stage pipeline, active runs panel, ledger stream, gate queue, Item view, Agent view, Confidence Map |
| **Wow / Editorial layer** | Investor briefing — generous, editorial, prose, calibrated typography, single-headline pages | Gate decision modal, dossier, defense record full view, handoff note, "what you missed" cards, smallest-real-test card |

The **register shift** between them is itself a wow primitive. Founder works in dense cockpit; gate becomes ready; click; screen *opens* into editorial layout; slight pause; founder breathes; the harness has done dense work and presents the result with care.

### Editorial register — concrete moves

- **Numbers become sentences.** Not *"n=7, var=0.13, conf=0.84."* Instead: *"Six of seven regular-customer cousins, across two scenarios, told us this would push them out of their own café — grounded in your forum quote from October 23rd. We hold this finding with high confidence."*
- **One headline per screen.** The strongest finding is the largest thing on the page; supporting findings array below in editorial hierarchy.
- **Founder addressed by name and as a peer.** Tone is collegial — a sharp colleague's note, not a dashboard prompt.
- **Visualizations minimal and editorial.** A single discreet dot plot, not a Power BI bar chart. NYT graphics-desk register.
- **Restraint is the brand.** Generous white space, serif headlines, calibrated line heights, single sparingly-used accent color.
- **No theater of effort.** No animated counters. No bouncing badges. No emoji. No chrome.

### Campaign Control Room (cockpit)

Default screen for an open campaign. Answers:

- What stage are we in?
- What is running right now?
- What are the agents working on?
- Which items are improving, failing, discounted, or invalidated?
- Which decisions need the human?
- What evidence, confidence, leakage, or QA issue should be inspected?

#### Shell Layout

**Top Bar** — brand mark, local-first/version indicator, active campaign pill, in-flight run/evidence/budget status, Chief of Staff button (voice toggle), Guide button, Scorecard button, Soft pause / Resume control.

**Stage Pipeline** — full-width horizontal pipeline below top bar. Stage 1, Stage 2, Stage 3 as connected chips. Each chip: state, name, compact metrics. States: done, active, locked, paused, blocked.

**Main Workspace** — left/main is a tabbed canvas (Item / Agent / Confidence Map). Right is a persistent decision/status rail (Gate Queue / Ledger / Leakage&QA). UI preserves context across tab switches.

**Bottom/Footer Status** — optional compact status strip: storage path, replay bundle status, last save, worker connection, **pulse line** (anxiety-relief sparkline of recent activity).

#### Canvas Tabs

**Item View** — three-stage post-it canvas. Stage 1: Opportunity Clusters. Stage 2: Product Direction Clusters and branches. Stage 3: planned or running pilot artifacts. Cards grouped by stage. Valid/active/promoted above; cleared/discounted below (still inspectable). Cards show: type, title, confidence band, evidence count, tension count, QA state, branch, status, **defense record badge** (e.g., *"Held against 4 of 5 challenges"*). Small agent cursors when agents are active. Clicking opens a detail modal in editorial register.

**Agent View** — same three-stage structure, agents-centered. Agents grouped by stage and team (Builder, Tester, Evaluator, idle/locked). Each agent card: role, state, progress, item being held. Cards visibly connect back to opportunity/product/artifact cards. Purpose: make the swarm observable, reveal team separation, expose who is working on what — without letting the user steer mid-run.

**Confidence Map** — sortable list/detail view for clusters, directions, branches. Shows confidence point estimate, confidence band, stage, tension count, promoted/child relationship, evidence drill-down, key uncertainty explanation, why a score is high/low/wide/narrow/discounted/cleared. Confidence is always labeled **harness-internal, not market validation.**

#### Right Rail

**Gate Queue** — pending human decisions: Stage 1→2 gates, Stage 2→3 gates, template promotions, ontology/method approvals. Actions: *Review & decide, Hold, Archive*.

**Ledger** — append-only event stream. Keep / discard / crash / invalid / warn / fresh events. Live entries flash briefly. Filters: all, live/fresh, keep, discard, warn/invalid. The ledger remains the visible source of truth.

**Leakage / QA** — pre-run leakage preview, artifact QA warnings, tester blindness warnings, broken artifact alerts, invalid run notices.

The right rail is for decisions and trust signals, not general navigation.

#### Required Panels and Components

Stage Pipeline · Active Runs panel ("In flight") · Human Gate Queue panel · Ledger Stream · Leakage / QA Alerts · Invalidation Board (Cleared Possibilities) · Artifact Preview tile · Confidence Map · **Pulse Line** · **Cost / Time tickers** · Item Detail modal · Evidence Card modal · Gate Decision modal (editorial register) · Template Promotion modal · Scorecard / Weight Adjustment modal · Artifact Preview modal · Guide / Walkthrough overlay · **Chief of Staff voice panel** · **"What you missed" replay viewer**.

### Modals (editorial register where indicated)

#### Item Detail Modal

Opens from any Stage 1/2/3 card. Shows: stage, item kind, branch, title, status, confidence (with band), evidence count, tension count, linked evidence, invalidation/discount reason. Stage 3 artifact cards include an **Artifact tab** opening the working artifact preview.

#### Evidence Card Modal

Inspectable from anywhere referenced. Shows: card id, type, claim, source document/span, source quote/excerpt, confidence factors, theory links, scorecard links, related cards, tensions, status. Hovering any claim in any other surface highlights the source span in this modal.

#### Gate Decision Modal *(editorial register)*

Opens from Gate Queue. Single-headline: the recommended cluster's name and a one-sentence summary. Below, four sections in publication-grade layout:

1. **Foundations** — source heatmap, single-source dependency callouts (*"Your voice memo carries this cluster"*)
2. **Mind-changers** — Bayesian pre-mortem in plain language (*"If the next 3 customer conversations don't repeat the afternoon-slump frustration, this dims. If a single regular volunteers willingness to pay, it brightens past the gate."*)
3. **Second opinion** — Builder vs. Evaluator disagreement, surfaced calmly, with reasoning
4. **Strengthen this** — short list of cheapest-leverage next moves before re-gate

Plus the **Defense record** as an always-visible badge, expandable into a paragraph-form peer-review summary.

For Stage 2 → 3 gate: also surfaces alternate clusters, microtest summary, unresolved uncertainties, proposed Stage 3 Plan, weight profile, branch plan, evaluator notes. Compounding-rigor signal: *"This direction has been through N challenges across both gates; M held."*

Human can advance multiple clusters/directions.

#### Template Promotion Modal

Promotion scope, maturity status, rationale, campaign source, inheritance behavior, note that new global templates affect only new campaigns unless explicitly imported.

#### Scorecard Modal

Live weight what-if analysis. Adjustable weights, total weight validation, branch score deltas, baseline vs adjusted score. Note: post-run changes are what-if unless saved as a new branch/run configuration.

#### Artifact Preview Modal

Stage 3 artifacts — apps, pages, images, scripts, checklists, signage, pricing pages, voice scripts. Switches between artifacts. Shows artifact type, audience, purpose, QA state. Renders interactive artifacts when available. Marks placeholder/pending/warn/pass/failed-QA states clearly. Generated artifacts shown in **low-fi sketch register**. Voice artifacts can be played through the Chief of Staff voice panel.

#### Dossier *(editorial register, multi-screen, opt-in audio narration)*

Section §14 below specifies dossier structure. Mechanically, the dossier is a markdown/HTML artifact stored at `dossiers/opportunity_dossier_{id}.md` — but its presentation is a four-screen editorial publication.

#### Handoff Note *(editorial register)*

Appears as the top of an open campaign on session resume. Small framed card, serif typeface, second-person voice. Composed from the campaign ledger's session-boundary delta.

#### "What you missed" replay *(editorial register)*

Three to five cards stacked vertically on a calm background. Each: single-sentence preview, small play button, estimated duration. No grid of thumbnails. No counter showing N unread events. Restraint.

### Interaction Rules

**Live run inspection is view-only.**

| Allowed | Not allowed |
|---|---|
| view active job status | edit prompts mid-run |
| view streaming transcript | change thresholds mid-run |
| view current artifact | coach agents mid-run |
| pause | alter tester context mid-run |
| stop | |
| terminate invalid run | |
| flag for review | |

**Canvas interaction:** zoom controls (trackpad/keyboard), keep stage columns scannable, clicking opens detail (not inline editing), invalidated/discounted items remain inspectable.

### Pause / Resume

| Mode | Behavior |
|---|---|
| Soft pause | finish current jobs, stop launching new jobs |
| Hard pause | terminate current jobs if safe, mark interrupted |
| Budget pause | auto-pause when spend/time cap is hit |

Resume continues from pending jobs.

### Visual System

- Dense operator-console layout for cockpit; generous editorial layout for wow screens
- Warm/cool neutral background; white or near-white surfaces in light mode; dark mode supported
- Compact and comfortable density modes
- IBM Plex Sans (or equivalent) for cockpit UI
- A serif (e.g., Söhne Mono / IBM Plex Serif / equivalent editorial serif) for wow screens
- JetBrains Mono (or equivalent) for identifiers, metrics, and ledger data
- Small-radius controls (4–8px)
- Restrained color coding: keep/supported = green; discard/cleared = red/orange; warn/discounted = amber; active/accent = blue; neutral/invalid/inactive = gray
- Post-it colors distinguish stage item families but never make the app a decorative mood board
- UI is utilitarian, legible, inspection-first in the cockpit; calibrated, generous, editorial in the wow layer

### Demo Data Shape (Milestone 1)

The reference UI uses a synthetic campaign with: active campaign metadata, stage states, active runs, ledger events, confidence map rows, gate queue, invalidations, QA alerts, evidence sample, artifacts, scorecard weights and branch scores, items by stage, agents by stage, Stage 2 Product Direction Clusters, defense records, persona compositions, generated low-fi artifacts. Milestone 1 implements this data shape with mock workers before real AI orchestration.

---

## 14. Wow Moment Specifications (normative)

This section specifies what each persona-moment *must* deliver. Implementation is constrained by the wow primitive named here.

### Wow Moment 1 — First 30 seconds

**State:** the empty state IS the demo campaign already running live (not a tutorial, not a sample dashboard, not a "Get Started" CTA). Stage 2 batch on the café case, defense badges visibly updating, cousin chorus arriving in real time. Labeled clearly *"Demo campaign — explore it, or start yours →"*. Local-first: the demo runs on the user's machine, fully hydrated.

### Wow Moment 2 — Reading Theater (Stage 1 ingestion)

**State:** founder drops a folder of messy material; three panels populate live: *What I'm reading / What I'm noticing / Whose voices, in what proportions*. Within 90 seconds, the harness surfaces a tension flag — at least one specific thing the founder missed in their own material, named gently. Local-first badge prominent.

### Wow Moment 3 — Quiet Workshop (active run)

**State:** run launch shows a contract, not a progress bar — *"23 minutes, $1.40, we'll surface what matters, step away"*. Default surface is calm; opt-in deepening for anxious-mode (pulse line, narration offer, cost/time tickers, "step into the lab"). Return is rewarded with **"What you missed"** — three signal-ranked cards (12–30 seconds each), not a feed.

### Wow Moment 4 — Stage 1 → 2 Gate (Defense Record)

**State:** Editorial-register modal. Single-headline; cluster-name + one sentence. Four panels: **Foundations**, **Mind-changers**, **Second opinion**, **Strengthen this**. Always-visible **Defense record badge**: *"Held against 4 of 5 challenges. 1 weakened."* Expandable into paragraph-form peer-review summary with each verdict grounded in source spans.

The defense record is past-tense rigor — the harness's Skeptic, Bias, and Coverage auditors ran *before* the gate and persisted their attempts. The founder reads a record, not a live battle.

### Wow Moment 5 — Synthetic Persona Rejection (Stage 3)

**State:** any synthetic persona response card opens four affordances:

1. **Show me who this person is** — composition recipe with traits-to-source-quote provenance
2. **Show me why they said this** — response sentences traced back to triggering evidence cards and source spans
3. **Show me her cousins** — variance across multiple instantiations of the same persona under the same scenario
4. **Show me where she improvised** — per-claim grounding audit; improvised sentences visually marked with subtle underline / hover-explained

Voice rendering via ElevenLabs is opt-in with cost disclosure. Voice profile is derived from the composition (older/weathered for long-time regular; hesitant/younger for first-time visitor). The label is honest: *"voice is generated, words are grounded."*

### Wow Moment 6 — Real-time Invalidation (Cleared Possibility)

**State:** when a branch dies live, a "Cleared" card slides into the Cleared Possibilities column. Card carries: *what this branch taught the campaign* (named first), then *why it was cleared* (specific cousin variance, specific evidence). A **"Reopen this branch"** affordance is always visible — eliminates the aggression anxiety. Reopens are new ledger events; nothing destructive.

### Wow Moment 7 — Stage 2 → 3 Gate (Compounding Rigor)

**State:** same architecture as Moment 4, denser content. **Compounding-rigor signal** prominently surfaced: *"This direction has been through 14 challenges across both gates. 11 held."* The Strengthen-this panel becomes *"What microtests we'd run next"* — specifically named methods tied to specifically named uncertainties.

### Wow Moment 8 — Dossier Delivery

**State:** Editorial publication, four screens.

1. **How your thinking changed** — a 7-point spine of the founder's own inflection points across the campaign, each tied to a specific moment that moved them. Voice: factual, never therapeutic. *"Gate 2: you held cluster #4 for 6 hours, then advanced after microtest 11 weakened it."*
2. **What we walked past together** — specific to this campaign's actual coverage. *"You ran 0 microtests on operator-side workload. The dominant unresolved uncertainty (regulars feeling crowded) was named in 7 microtests but never structurally tested. You have no evidence from any low-spend customer."* Each line one click open.
3. **The smallest real-world test** — one card, one experiment, the cheapest possible move. *"Tomorrow, 3pm. Walk into the closest comparable café. Order coffee. Watch for 25 minutes: how many laptop workers, how many regulars look annoyed, how many seats are empty for >20 minutes. Cost: $4. Outcome: confirms or kills your environmental assumption."* With script and observation rubric. Optional second/third cards (1-hour, 1-week tiers) but headline is the $4/30-min version.
4. **Cleared possibilities** — five branches no longer needed, one line each. Walk-back from any cleared possibility is one click — full provenance to source quote.

Optional audio narration via ElevenLabs in the Chief of Staff voice. Opt-in, with cost disclosure.

### Wow Moment 9 — Back Next Morning (Handoff Note)

**State:** small framed card at top of campaign, serif typeface, second-person voice. *"Yesterday at 11:47pm, you advanced cluster #3 (quiet-hours) and held cluster #5 (light-bites). Run 14 completed overnight; three moments are waiting for your eyes. Your $4 / 30-min experiment is on tomorrow's calendar."* Composed from the ledger's session-boundary delta. Optional voice rendering (Chief of Staff voice).

### Wow Moment 10 — Pre-campaign Brainstorm

**State:** Chief of Staff voice conversation. 5–15 minutes. 3–6 calibrated clarifying questions. Output: a draft campaign brief in editorial register for the founder to review/edit/approve. The founder did not learn the harness's vocabulary.

### Wow Moment 11 — Decision Conversation at Gates

**State:** Chief of Staff offers *"Want to talk through this?"* on any open gate. Reflects relevant material conversationally; surfaces unresolved tensions; never decides. Founder's final call is translated into a ledger event with the founder's reasoning logged.

### Wow Moment 12 — Mid-flight Voice Adjustment

**State:** founder, on a phone call to the app: *"Add a constraint — no more than one part-time staffer."* Chief of Staff confirms the change, estimates downstream impact, queues on approval. No screen needed.

---

## 15. Multimodal Capabilities (new)

### Strategic frame

> **Multimodal serves moments of embodied recognition. Text serves moments of inspection.**

Voice and image deepen the wow where the founder needs to *feel* a finding (synthetic persona reacting, dossier listened to on a walk). Text stays where the founder needs to *audit* a finding (defense record, gate analysis, cockpit, evidence cards).

### Capability map

| Capability | Service | Used for | Register |
|---|---|---|---|
| TTS — Chief of Staff voice | ElevenLabs (one carefully chosen voice) | All Chief of Staff narration; opt-in dossier reading; opt-in handoff note | Calm, deliberate, intelligent — the editorial voice |
| TTS — synthetic persona voicing | ElevenLabs (voice profile per persona composition) | Stage 3 simulated persona rejections / acceptances (opt-in, with cost disclosure) | Distinct per persona; honest label *"voice is generated, words are grounded"* |
| STT — founder voice in | Whisper (local where possible) for low-latency | Conversational input to Chief of Staff | Local-first by default; transcripts stored in ledger |
| Image generation — Stage 3 visual artifacts | fal.ai | Pricing page mockups, signage samples, table-tents, packaging concepts | **Low-fi sketch register** — never high-polish |
| Code-capable LLM | Claude or equivalent strong model | Stage 3 interactive app flows, prototype repair, QA diagnosis | Iterative; QA-audited |
| Strong reasoning LLM | Claude or equivalent | Evidence extraction, opportunity clustering, evaluator/auditor judgment, dossier synthesis | Backbone |
| Cheaper / faster LLM | Smaller/faster model | Tester agents, repetitive microtest participants, branch variation, first-pass summaries | High-volume work |

### Local-first contract

The harness is local-first by default. Hosted services (ElevenLabs, fal.ai, hosted LLMs) are **opt-in, per-action, with cost disclosure**:

> *"This run will voice 8 cousins via ElevenLabs (~$0.32) and generate 3 signage variants via fal.ai (~$0.18). Total: ~$0.50. Proceed?"*

The founder always sees what's leaving the device, what it costs, and can decline. Privacy-sensitive material (raw transcripts, voice memos) never leaves the device; only structured persona prompts and artifact briefs go out. Generated outputs are stored locally (e.g., `signage_v1.png`, `cousin_03_response.mp3`) and replayable forever without re-generation cost.

### Generated-artifact rule (Law 4 application)

A polished mockup biases persona response toward polish, not idea. Generated visual artifacts default to a **deliberate low-fi sketch register** (think napkin sketch, not Figma export). Founders can promote any artifact to higher fidelity for a later branch — but the default test is on the idea, not the polish.

### Voice profile for Chief of Staff (canonical)

- Warm, professional, never sycophantic, never hesitant
- Speaks the founder's vocabulary; never uses harness jargon unless the founder does
- Always honest about what it's about to do
- Always available, never demanding
- One voice, used consistently across all Chief of Staff surfaces and the dossier audio version — continuity of voice = continuity of trust

### Synthetic persona voice profile

- One distinct voice per persona, derived from composition recipe
- Audio waveform marked at improvised segments (subtle audio cue, e.g., slight cadence change) and visually underlined in the synced transcript
- Honest label always present: *"voice is generated; words are grounded in your evidence cards."*

### What we deliberately do not do (V1)

- AI-generated avatars or faces for synthetic personas — too uncanny in V1; voice + composition recipe is sufficient
- Background music / ambient audio — drifts toward theater
- Voice-cloning the founder's own voice for the handoff note — possible later as opt-in with strict consent flow; not V1 default

---

## 16. Technical Architecture

### V1 Technical Shape

The harness ships as a single desktop app with a Node orchestrator and Python sidecars for parsing and STT. All long-running work is durable, replayable, and ledger-backed. Raw sources are read by the local sidecar and never transmitted off-device; only structured prompts (persona briefs, microtest specs, evaluator queries, artifact briefs) cross the network boundary, and only when the founder approves a hosted call with cost disclosure.

| Layer | Pick | Role |
|---|---|---|
| Desktop shell | **Tauri 2** | Single bundle (~3–10 MB), per-API capability permissions, native sidecar process management |
| Frontend | **React + TypeScript + Vite** | Cockpit and editorial registers in one SPA; HMR for typography iteration |
| Backend | **Node + TypeScript** | Orchestrator, ledger writer, SSE stream, Vercel AI SDK host |
| Multi-agent orchestration | **LangGraph.js** | Typed state graphs enforce per-agent `allowed_context` / `forbidden_context` — auditable blinded-tester guarantees (§6) |
| Long-running DAG runner | **Inngest (self-hosted, SQLite-backed)** | Step functions for the Test DAG; per-step retry/replay; `step.sleep` for pause/resume; middleware for budget caps and ledger writes |
| Document parsing | **Docling** (PDF/HTML) + **Tesseract / PaddleOCR** (screenshots) + **whisper.cpp** word-level timestamps (audio) | Page/bbox/line-span provenance for evidence cards (§5) |
| Vector store | **LanceDB** (one dataset directory per campaign) | Embedded, zero-server, columnar on-disk, versioned; campaign isolation is a directory boundary; regenerable from the ledger |
| STT (voice in) | **MLX-whisper** on Apple Silicon, **whisper.cpp** as portable fallback | Local-only; raw audio never leaves the device |
| TTS (voice out) | **ElevenLabs SDK** with cost tracking | One canonical Chief of Staff voice; opt-in persona / dossier voicing |
| Image generation | **fal.ai SDK** with cost tracking | Stage 3 visual artifacts in low-fi sketch register only (§15 Law 4) |
| LLM SDK | **Vercel AI SDK v5** + Anthropic provider | Provider-agnostic streaming, structured tool calls, cost tracking, tier-policy middleware in one place |
| Real-time UI transport | **SSE** | Unidirectional ledger/agent stream; lighter than WebSocket for the cockpit's read-mostly traffic |

### Process Topology

Three processes bridged by Tauri IPC:

1. **Python sidecar** — Docling + Tesseract + MLX-whisper, exposed as a single stdio JSON-RPC service. Reads raw sources from `venture_lab/campaigns/{id}/sources/` directly. Streams parsed chunks (with character offsets / line spans / bboxes) and STT segments (with word timestamps) back to the orchestrator.
2. **Node orchestrator** — LangGraph.js agent graphs, Inngest workers, Vercel AI SDK calls, ledger I/O, SSE broadcaster, cost ticker.
3. **React renderer** — cockpit + editorial layers, SSE consumer, Chief of Staff voice panel (Whisper input via Tauri IPC, ElevenLabs playback inline).

The Tauri main process owns the local filesystem capability grant and brokers all sidecar lifecycle, capability scoping, and per-action cost-disclosure modals.

### File-Backed Artifact Store

```
venture_lab/
  global/
    ontology/
      evidence_types.yaml
      theory_links.yaml
      method_library.yaml
      scorecard.yaml
      weight_profiles.yaml
      role_templates.yaml
      evaluator_rubrics.yaml
      chief_of_staff_voice_profile.yaml      # NEW
      defense_record_templates.yaml          # NEW
      editorial_layout_templates.yaml        # NEW

  campaigns/
    {campaign_id}/
      campaign.yaml
      template_snapshot/
        ...
      sources/
        raw/
        normalized/
        manifest.yaml
      evidence/
        cards.jsonl
        contradictions.jsonl
        extraction_runs.jsonl
      stage1/
        hypotheses.jsonl
        opportunity_clusters.jsonl
        defense_records.jsonl                # NEW
        ledger.tsv
      stage2/
        team_configs/
        microtest_dags/
        microtest_runs/
        product_direction_clusters.jsonl
        defense_records.jsonl                # NEW
        ledger.tsv
      stage3/
        stakeholder_maps/
        artifact_plans/
        artifacts/
          generated/                         # NEW: fal.ai outputs cached locally
          voiced/                            # NEW: ElevenLabs outputs cached locally
        persona_compositions/                # NEW: composition recipes + cousin runs
        pilot_runs/
        branch_results.jsonl
        ledger.tsv
      chief_of_staff/                        # NEW
        transcripts.jsonl                    # founder ↔ assistant conversations
        intent_translations.jsonl            # what intent → which ledger events
      dossiers/
        opportunity_dossier_{id}.md
        opportunity_dossier_{id}.audio.mp3   # NEW: optional
      session_boundaries.jsonl               # NEW: powers handoff notes
      campaign_ledger.jsonl
      current_state.json
```

### Agent Job Specs

Every agent call is an explicit job.

```yaml
job:
  id: stage2_mt_014_tester_003
  stage: stage2
  team: tester
  role: skeptical_buyer
  model_policy:
    quality: medium
    cost: low
    capabilities: [structured_output]
  input_files:
    - microtest_spec.yaml
    - blinded_persona.yaml
  output_files:
    - tester_response.json
    - transcript.md
  allowed_context:
    - assigned_scenario
    - assigned_role
    - product_artifact
  forbidden_context:
    - builder_rationale
    - desired_outcome
    - scorecard_threshold
```

Every job stores: job spec, input artifact hashes, allowed/forbidden context, prompt, model used, full transcript, structured output, evaluator audit, run status, **significance score** (new — drives "What you missed" replay), **defense record entries** (new — for relevant agent kinds).

### Chief of Staff job spec (new)

```yaml
job:
  id: cos_session_2026-05-09_09-12_001
  surface: chief_of_staff
  mode: voice_in_voice_out  # or voice_in_text_out, text_in_text_out
  founder_intent_input: "Add a microtest — what if drop-in pricing has a 50% discount during the quietest hour?"
  proposed_translation:
    artifact_type: microtest_spec
    method: pricing_acceptance_test
    parameters:
      discount_percent: 50
      time_window: "quietest_hour"
    estimated_cost: 0.18
    estimated_duration: 4
  approved_by_founder: pending
  ledger_event_on_approval: stage2.microtest.queued
```

### Significance scoring (new — powers "What you missed")

The Evaluator team scores each event for significance on a 0–1 scale. Trigger conditions for high significance:
- defense weakened (Held → Weakened verdict on previously-Held challenge)
- persona improvised beyond evidence (audited)
- new tension surfaced
- branch invalidated (cleared)
- cousin variance jumped above threshold
- scorecard delta above threshold
- founder gate decision queued

The "What you missed" replay is *queried* from the ledger filtered by significance, not edited or curated.

### Model Strategy

Concrete model assignments (provider: Anthropic, called via Vercel AI SDK). Each agent role declares its tier in its job spec; a policy middleware resolves the tier to a concrete model and applies cost tracking before the call leaves the device.

| Use | Model | Rationale |
|---|---|---|
| Evidence extraction, opportunity clustering, evaluator / auditor judgment, dossier synthesis | **Claude Opus 4.7** | Strongest reasoning; the correctness of these outputs anchors the Defense Record, Confidence Map, and dossier — they cannot be cheaply approximated |
| Tester agents, repetitive microtest participants, branch variation, first-pass summaries | **Claude Haiku 4.5** | High-volume, role-blinded; correctness is averaged across cousins, so per-call quality matters less than throughput and cost |
| Stage 3 implementation artifacts, prototype repair, QA diagnosis | **Claude Sonnet 4.6** | Code-capable; emits a strict `{files: [{path, contents}]}` schema served via per-campaign Vite iframe and audited by the Implementation QA Auditor |
| Chief of Staff conversational layer | **Claude Sonnet 4.6** with structured tool calls | Strong + lower-latency than Opus; tool calls write ledger events for every founder intent, with the founder's reasoning logged verbatim |

Tier policy is data, not code: each agent role's `model_policy` (quality / cost / capabilities) is resolved at job dispatch, so retiring or upgrading a model is a config change, not a refactor.

---

## 17. Self-Improvement

Self-improvement targets differ by stage.

| Stage | Improve |
|---|---|
| **Stage 1** | hypothesis identification, evidence extraction, clustering, contradiction detection, theory mapping, strategic-fit annotation |
| **Stage 2** | team composition, role definitions, microtest design, method-selection matrix, test DAG quality, invented/adapted tests, leakage detection |
| **Stage 3** | implementation artifacts, artifact QA, pilot environment, personas/stakeholder graph, test environment realism, broken implementation repair |
| **Cross-stage (new)** | defense record quality, significance scoring calibration, Chief of Staff translation accuracy, editorial register quality |

Self-improvement artifacts are versioned: `hypothesis_extractor_v3`, `builder_team_config_v2`, `tester_cohort_model_v5`, `microtest_library_v4`, `experimental_test_method_x_v0`, `pilot_harness_v7`, `prototype_candidate_v12`, `chief_of_staff_translator_v2`, `defense_record_format_v3`.

Agents may propose improvements. Evaluator audits. Human approves changes that affect global templates, scoring, ontology, or official process.

---

## 18. Demo Campaign

V1 ships with a clearly synthetic demo campaign: **Neighborhood café — fixing the afternoon slump**.

### Stage 1 Demo

Synthetic messy sources reveal hypotheses around: underused 2-5pm seating; regulars occupying tables with low spend; remote workers as both opportunity and social-risk segment; owner/operator time pressure; afternoon prep/reset friction; reluctance to make the café feel like a co-working space; nearby co-working spaces as substitutes; parents, students, office workers, and regulars as competing afternoon segments.

**Opportunity clusters:** quiet-hours seating pass; school-pickup pre-order window; loyalty streak / regulars club; wholesale to nearby offices; late-afternoon kids-friendly hour; light-bites afternoon menu; reserved-table membership.

### Stage 2 Demo

Selected cluster: *Quiet-hours seating pass*. Microtests: pain ranking, value proposition comprehension, objection simulation, competitive substitution, fake-door intent, card sort, service blueprint / workflow test, experimental objection lattice. **Product Direction Clusters:** day pass / punch card; light-bites afternoon menu; reserved-table membership.

### Stage 3 Demo

Selected direction: *Day pass / punch card*. Artifacts: tap-to-pay table check-in app; tiered pricing page; day-1 rollout setup checklist; A-frame and table-tent signage samples *(generated low-fi via fal.ai)*; barista talking script *(voiced via ElevenLabs)*. Stakeholders: café owner, barista on shift, regular customer, remote worker, passing foot traffic, nearby co-working substitute, accounting/budget actor.

**Possible demo outcome:**

- Full reservation branch is **cleared** because regulars feel pushed out.
- 10-pack punch card branch performs better than pure drop-in pricing.
- Reserved-table membership has stronger viability but higher operational complexity.
- Light-bites menu is feasible but weaker on defensibility.
- Regulars feeling crowded out remains the dominant unresolved uncertainty.
- The Opportunity Dossier recommends — as the smallest real-world test — a 30-minute observation at a comparable café tomorrow at 3pm, with a script.

The demo also seeds: at least one defense record entry per cluster (to populate the Wow Moment 4 surface); at least one improvised-flag example in a Stage 3 persona response (to populate Wow Moment 5); at least one "What you missed" replay sequence (to populate Wow Moment 3); a pre-rendered handoff note (to populate Wow Moment 9).

---

## 19. Build Roadmap (revised)

### Milestone 1: App Shell + Fake Runner

- Local web app shell
- Campaign creation
- Campaign file structure
- Campaign ledger
- Materialized current state
- Campaign Control Room (cockpit register):
  - top bar with campaign pill, in-flight status, Scorecard, Guide, Soft pause, **Chief of Staff toggle (mocked)**
  - three-chip stage pipeline
  - central tabbed canvas: Item / Agent / Confidence Map
  - right rail: Gate Queue / Ledger / Leakage&QA
  - **pulse line**, cost/time tickers
- Item / post-it cards for Stage 1 clusters, Stage 2 directions, Stage 3 artifacts — including **defense record badges**
- Card detail modal *(editorial register)*
- Evidence card modal
- **Gate Decision modal in editorial register** with Foundations / Mind-changers / Second opinion / Strengthen this
- Template promotion modal
- Scorecard weight what-if modal
- Artifact preview modal *(low-fi sketch register placeholder for generated artifacts)*
- **"What you missed" replay viewer**
- **Handoff note surface**
- **Cleared Possibilities column**
- Guide / walkthrough overlay
- Light/dark theme; comfortable/compact density
- Mock stage workers; mock Chief of Staff (typed conversation, no voice yet)
- Seed demo campaign: *Neighborhood café — fixing the afternoon slump*
- Fake keep/discard/crash events; fake active runs with Builder/Tester/Evaluator roles; fake agent-to-card assignments; fake confidence bands and contradictions; fake invalidation board and QA alerts; fake defense records; fake persona compositions

**Goal:** Prove the wow architecture (cockpit + editorial layer + Chief of Staff stub) and artifact lineage before expensive AI orchestration.

### Milestone 2: Stage 1 Real Extraction + Reading Theater

- Source ingestion with **live Reading Theater UX** (What I'm reading / noticing / whose voices)
- Raw source manifest
- Evidence card extraction (real)
- Contradiction (tension) extraction
- Hypothesis generation
- Opportunity clustering
- Stage 1 ledger
- **Stage 1 gate screen in editorial register** with real defense record generation
- **First tension flag** within 90 seconds of pour-in

### Milestone 3: Stage 2 Microtest Lab + Compounding Rigor

- Builder/Tester/Evaluator role separation
- Method-selection matrix
- Microtest DAG planner
- Blinded tester job specs
- Evaluator audit
- Confidence updates
- Product Direction Cluster output
- **Stage 2 → 3 gate with compounding-rigor signal**
- Defense record persistence and replay

### Milestone 4: Stage 3 Simulated Pilot + Persona Composition Transparency

- Stakeholder map generator
- Artifact plan generator
- **Persona composition recipes + per-claim improvisation flag**
- **Cousin variance reporting**
- Artifact generation hooks (text + fal.ai for visual artifacts in low-fi sketch register)
- Artifact QA
- Simulated pilot branch runner
- Influence actor simulation
- Scorecard calculation
- Invalidation ledger surfaced as **Cleared Possibilities**

### Milestone 5: Chief of Staff (voice)

- ElevenLabs integration for Chief of Staff TTS
- Local STT (Whisper) for low-latency voice input
- Pre-campaign brainstorm conversation flow
- Decision conversation at gates
- Mid-flight voice adjustment
- Handoff note (voiced, opt-in)
- Privacy/cost contract surface

### Milestone 6: Opportunity Dossier (editorial)

- **Editorial-register dossier** with four screens:
  1. How your thinking changed
  2. What we walked past together
  3. The smallest real-world test
  4. Cleared possibilities
- Validation scope label
- Evidence drill-down
- Microtest summary
- Pilot branch comparison
- Failed/discarded path preservation
- Confidence visualization
- **Optional audio narration** in Chief of Staff voice

### Milestone 7: Multimodal Stage 3 artifacts

- fal.ai integration for visual artifact generation in low-fi sketch register
- ElevenLabs integration for synthetic persona voicing (opt-in, cost-disclosed)
- Generated artifact storage, replay, and re-generation policy

---

## 20. Non-Goals for V1

V1 should not include:

- Autonomous open web crawling
- Heavy graph database
- Cross-campaign evidence sharing
- Real user recruitment
- Payment testing
- Enterprise collaboration
- Fully autonomous ontology mutation
- General-purpose visual whiteboard/editor beyond the operator canvas
- Market validation claims
- AI-generated faces/avatars for synthetic personas
- Voice-cloning the founder's own voice
- Background music / ambient audio in any product surface

---

## 21. Open Decisions

To resolve during implementation:

- Exact schema format for all major artifacts
- Initial global ontology contents
- Initial scorecard weights
- Initial role prompt templates
- Exact artifact QA thresholds
- Whether generated prototypes are sandboxed per branch or stored as static artifacts
- How much of the first demo campaign is hand-authored versus generated
- **Exact significance-score thresholds for "What you missed" replay**
- **Specific ElevenLabs voice ID for the Chief of Staff** (one canonical voice — needs voice-direction call)
- **Editorial-register typography pairing** (which serif for headlines, which sans for editorial body)
- **MLX-whisper model size** (large-v3-turbo vs. medium) for Chief of Staff voice input — quality vs. memory footprint on lower-spec Macs
- **fal.ai model selection for low-fi sketch register**
- **Whether voice-only mode (no screen) is shipped in M5 or deferred**

### Validation risks to retire early

Stack-level assumptions worth proving on a small spike before Milestone 1 hardens around them:

- **LangGraph.js feature parity with the Python version.** Confirm typed channel projections (or equivalent) can statically express `allowed_context` / `forbidden_context` for blinded testers. If not, fall back to a thin custom orchestrator on top of Vercel AI SDK with explicit context-projection helpers.
- **Inngest self-hosted local mode at run length.** Confirm crash recovery and replay work cleanly with the SQLite store at the 20+ minute run lengths Stage 2 and Stage 3 will see. If shaky, swap to BullMQ + an embedded Redis (KeyDB or redis-stack-server) — fewer features, more proven.
- **Tauri sidecar ergonomics with two Python services.** If Docling + MLX-whisper as separate processes proves brittle, collapse them into one Python service (FastAPI or stdio JSON-RPC) with internal routing.
- **Docling span fidelity on the messy real corpus.** Validate page/bbox/line-span output on the actual mix of PDFs, scraped HTML, and screenshots Founders bring. If span fidelity drops on any modality, slot Marker in as a per-modality fallback.

---

## 22. Glossary

**Harness-validated** — Validated inside the AI Venture Lab process. Does not imply real market validation.

**Opportunity Cluster** — A cluster of related opportunity hypotheses grounded in Stage 1 evidence.

**Product Direction Cluster** — A cluster of possible product/service/artifact directions emerging from Stage 2 microtests.

**Opportunity Dossier** — The final report generated after Stage 3 simulated pilots, presented in editorial register across four screens.

**Evidence Card** — Append-only, theory-linked extracted claim from source material with full source-span provenance.

**Disconfirmation Probe** — A test intended to lower overconfidence and reveal failure modes without treating one negative result as automatic invalidation.

**Invalidation Ledger / Cleared Possibilities** — A record of failed, discarded, discounted, or inconclusive hypotheses, product directions, branches, and artifacts. Surfaced in UX as cleared possibilities — co-equal artifacts with the lead branch, never buried.

**Campaign Ledger** — Append-only source of truth for all campaign events, decisions, run statuses, versions, and confidence updates.

**Tension** — UX-surface name for a Contradiction. Less adversarial language; same first-class artifact.

**Defense Record** — Past-tense rigor log for a cluster or product direction. Lists every challenge the harness's auditors attempted, with verdicts (Held / Weakened / Cleared / Noted) grounded in source spans. Replaces any combat-framed UX. *(New)*

**Reading Theater** — UX framing for Stage 1 ingestion. Three live panels (What I'm reading / What I'm noticing / Whose voices, in what proportions) plus first-tension flag within 90 seconds. *(New)*

**Quiet Workshop** — Default state of the active-run cockpit. No animation theater; pulse line and cost/time tickers as the only ambient signals; inspectability on demand. *(New)*

**What You Missed** — Returns-only, signal-ranked replay of significant moments since last attended. Three to five 12–30 second cards. *(New)*

**Cousin** — One of multiple instantiations of the same synthetic persona under the same scenario, used to report variance across the simulated population. *(New)*

**Persona Composition** — The recipe of evidence cards and source quotes that compose a synthetic persona. Visible to the founder. Powers the Wow Moment 5 audit affordances (Show me who, why, cousins, improvisation). *(New)*

**Improvisation Flag** — Per-claim grounding audit on synthetic persona responses. Sentences that extrapolate beyond evidence are visually marked. *(New)*

**Chief of Staff** — The voice-first conversational layer between the founder and the harness. Translates the founder's natural vocabulary into structured campaign artifacts and back. Always opt-in, never required. *(New)*

**Cockpit Register / Editorial Register** — The two coexisting visual registers of the app. Cockpit = dense operator console for daily work. Editorial = generous, prose-led briefing layout for moments that matter. The register shift between them is itself a wow primitive. *(New)*

**Compounding Rigor Signal** — The visible accumulation of defense-record outcomes across gates (e.g., *"This direction has been through 14 challenges across both gates; 11 held"*). *(New)*

**Smallest Real-World Test** — The cheapest, smallest action the founder could take outside the harness to convert a harness-internal finding into a real-world signal. Headlined in the dossier as the recommended next move. *(New)*

**What We Walked Past Together** — The dossier section listing specific, campaign-specific gaps in coverage (not generic checklist gaps). Implicates the harness as co-investigator, never blames. *(New)*

**Pulse Line** — Subtle horizontal sparkline at the bottom of the screen showing the last N minutes of agent activity. Anxiety-relief affordance for Law 5; never demanded, always available. *(New)*

**Significance Score** — Evaluator-assigned 0–1 score per ledger event indicating whether a moment is worth surfacing in "What you missed". Not curated; queried. *(New)*

**Compounding Trust** — The accumulating felt-state across multiple gates as the founder watches rigor at each gate match or exceed the previous one. *(New)*

---

*End of spec v2. The founder is the principal investor in their own venture. The Chief of Staff is their personal staff. The harness is the research team. The cockpit is the engine room. The wow screens are the boardroom. All of it belongs to them.*
