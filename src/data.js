// Demo campaign blob — Neighborhood café, fixing the afternoon slump.
// One coherent fictional world: same people, same week, same campaign id.
export const DEMO = {
  campaign: {
    id: "camp_014",
    name: "Neighborhood café — fixing the afternoon slump",
    started: "Apr 22",
    today: "May 9 · 18:24",
    search_domain: "Afternoon revenue, underused seats, regulars, remote workers, café operations.",
    constraints: { geography: "SG / US / global", avoid: ["regulated medical claims", "hardware-heavy"] },
  },

  status: {
    stage: 2,
    in_flight_runs: 3,
    in_flight_agents: 14,
    cost_spent: 0.42,
    cost_cap: 5.0,
    elapsed_min: 18.4,
    cap_min: 23,
    pulse: [2,3,2,4,5,4,6,7,5,4,3,4,6,8,7,5,6,4,3,2,3,4,5,6,7,8,6,5,4,5,6,5,4,3,4,5,6,7,6,5],
    unread_signal_cards: 3,
  },

  // Stages are not a linear pipeline — all three run in parallel and the
  // population at each is computed from `opp_clusters / directions / artifacts`
  // in StagePipeline. This list is kept for downstream panels that still need
  // a stable list of stage ids and human-readable names.
  stages: [
    { id: 1, name: "Real-data collector" },
    { id: 2, name: "Brainstorm + microtests" },
    { id: 3, name: "Simulated pilot" },
  ],

  // Stage 1 opportunity clusters
  // `parents` is empty (Stage 1 = origin). State distinguishes "still alive at S1" (held)
  // from "alive at S1 AND has produced a Stage 2 child" (advanced). Lineage is explicit
  // via `descendants` so the renderer doesn't need SVG arrows to tell the story.
  opp_clusters: [
    { id: "opp_001", name: "Quiet-hours seating pass",                  conf: 0.71, band: 0.08, ev: 18, ten: 3, defense: "4 / 5 held", state: "advanced", note: "regulars-first signage rule discovered along the way", descendants: ["pdc_004", "pdc_005"] },
    { id: "opp_002", name: "Light-bites afternoon menu",                conf: 0.48, band: 0.12, ev: 9,  ten: 1, defense: "2 / 3 held", state: "advanced", note: "weak on defensibility; barista cost unclear",            descendants: ["pdc_006"] },
    { id: "opp_003", name: "Reserved-table afternoon membership",       conf: 0.58, band: 0.10, ev: 12, ten: 2, defense: "3 / 4 held", state: "advanced", note: "viability strong, ops complexity high",                  descendants: ["pdc_005"] },
    { id: "opp_004", name: "School-pickup pre-order window",            conf: 0.42, band: 0.14, ev: 7,  ten: 1, defense: "1 / 2 held", state: "held",     note: "narrow segment; budget signal mixed",                    descendants: [] },
    { id: "opp_005", name: "Loyalty streak / regulars club",            conf: 0.39, band: 0.16, ev: 6,  ten: 0, defense: "2 / 2 held", state: "held",     note: "low novelty; substitute risk high",                       descendants: [] },
    { id: "opp_006", name: "Wholesale to nearby offices",               conf: 0.31, band: 0.18, ev: 4,  ten: 0, defense: "0 / 1 held", state: "held",     note: "outside the founder's stated channel comfort",            descendants: [] },
    { id: "opp_007", name: "Full reservation system",                   conf: 0.18, band: 0.07, ev: 3,  ten: 2, defense: "1 / 4 held", state: "cleared",  note: "regulars feel pushed out (forum quote, 2026-04-23)",      descendants: [] },
  ],

  // Stage 2 product directions
  // `parents` points at the Stage 1 cluster(s) the direction came from; the originating cluster
  // is *still alive* at Stage 1 in parallel — both rows render. `descendants` points down to S3.
  directions: [
    { id: "pdc_004", name: "Quiet-hours day pass / 10-pack punch card", conf: 0.68, band: 0.07, microtests: 11, defense: "9 / 12 held", state: "lead",       wedge: "afternoon access without making the café feel like co-working", parents: ["opp_001"],            descendants: ["art_001", "art_002", "art_003"] },
    { id: "pdc_005", name: "Reserved-table afternoon membership",        conf: 0.54, band: 0.11, microtests: 7,  defense: "5 / 8 held",  state: "advanced",   wedge: "predictable revenue, dedicated table, opt-in identity",         parents: ["opp_001", "opp_003"], descendants: ["art_004", "art_005"] },
    { id: "pdc_006", name: "Light-bites menu pairing",                   conf: 0.41, band: 0.14, microtests: 4,  defense: "3 / 4 held",  state: "discounted", wedge: "secondary check size, weaker defensibility",                    parents: ["opp_002"],            descendants: [] },
  ],

  // Stage 3 artifacts (planned / queued behind gate). `parents` is the Stage 2 direction.
  artifacts: [
    { id: "art_001", name: "Tap-to-pay table check-in app",                       aud: "owner + barista",              purpose: "test rhythm without breaking barista flow",         qa: "pending",        state: "queued", parents: ["pdc_004"] },
    { id: "art_002", name: "Tiered pricing page (drop-in / 10-pack / monthly)",   aud: "remote_worker",                purpose: "willingness-to-pay across tiers",                   qa: "render delayed", state: "warn",   parents: ["pdc_004"] },
    { id: "art_003", name: "A-frame + table-tent signage",                        aud: "passing foot traffic, regulars", purpose: "work-friendly framing without scaring regulars",  qa: "pending",        state: "queued", parents: ["pdc_004"] },
    { id: "art_004", name: "Solo-operator setup checklist",                       aud: "owner",                        purpose: "adoption friction, day-1 rollout",                  qa: "pending",        state: "queued", parents: ["pdc_005"] },
    { id: "art_005", name: "Barista talking script (voiced)",                     aud: "barista",                      purpose: "rule explanation that protects regulars",           qa: "pending",        state: "queued", parents: ["pdc_005"] },
  ],

  // Cleared possibilities — co-equal artifacts; never buried.
  cleared: [
    { id: "opp_007", name: "Full reservation system", taught: "regulars-first signage rule",                       reason: "regulars feel pushed out (forum, Apr 23)" },
    { id: "br_011",  name: "Pure drop-in pricing branch", taught: "10-pack outperformed in 4/5 cousin variants",    reason: "single-visit friction was higher than expected" },
    { id: "br_014",  name: "Hourly metered seating",      taught: "founders dislike timer UX; rule-clarity matters", reason: "barista workflow audit failed twice" },
  ],

  // Evidence cards
  evidence: [
    { id: "ev_011", type: "pain_signal",        claim: "Afternoon tables sit half-occupied while owners can't fully reset for the dinner shift.", source: { id: "src_003", file: "interview_emily_2026-04-23.md", span: "lines 18–34", quote: "Around 2:30 the room thins out but four tables still have someone nursing the same espresso since 11. I can't reset the room and I can't bus a regular." } , conf: 0.84 },
    { id: "ev_013", type: "current_workaround",  claim: "Owners hint informally — refills, eye contact, a quick wipe of the table — to imply it's time to move on.", source: { id: "src_003", file: "interview_emily_2026-04-23.md", span: "lines 88–99", quote: "I do the wipe. I hate it. It's mean and unclear and half the time they don't read it." }, conf: 0.79 },
    { id: "ev_039", type: "adoption_objection",  claim: "Regulars perceive structured afternoon access as an eviction signal even when the rules don't apply to them.", source: { id: "src_007", file: "neighborhood_forum_2026-04-23.html", span: "post 14", quote: "If she starts charging for the seats Saturday afternoons that's where I draw the line. I'm there four mornings a week — I'm not the problem." }, conf: 0.71 },
    { id: "ev_044", type: "budget_signal",       claim: "Remote workers around the area pay $4–$8 per session at nearby co-working / library cafés for the same chair-and-wifi outcome.", source: { id: "src_011", file: "voice_memo_owner_2026-04-26.txt", span: "lines 4–11", quote: "Yi-Ling told me she's at the co-working two days a week — fifty bucks a month, just for the seat." }, conf: 0.86 },
    { id: "ev_058", type: "competitor_weakness", claim: "Nearby co-working spaces feel sterile to creative-class workers who came for café atmosphere.", source: { id: "src_014", file: "review_aggregator_2026-04-29.csv", span: "row 22", quote: "It works but it doesn't feel like anywhere. I miss the noise." }, conf: 0.62 },
    { id: "ev_071", type: "user_quote",          claim: "First-time visitors hesitate to ask about table rules and either leave silently or stay too long uncomfortably.", source: { id: "src_018", file: "support_tickets_2026-05-02.csv", span: "row 4", quote: "I sat for an hour but felt I shouldn't have ordered just one drink. Didn't come back." }, conf: 0.67 },
  ],

  // Tensions
  tensions: [
    { id: "con_012", topic: "willingness to pay for quiet-hours seating",                       a: "Owners want to fill underused afternoon seats with higher-intent customers.", b: "Owners worry pass holders will make regulars feel pushed out.", linked: ["ev_011","ev_039","ev_044"] },
    { id: "con_017", topic: "rule clarity vs. café identity",                                   a: "Clear rules reduce barista workload and customer hesitation.",                b: "Clear rules make the café read as 'co-working with tolerance', not a café.", linked: ["ev_039","ev_058","ev_071"] },
    { id: "con_021", topic: "operator workload of running an opt-in seating system solo",      a: "A 10-pack is one tap and a stamp; rollout is light.",                          b: "Edge cases compound on a solo barista — regulars asking, lost cards, refunds.", linked: ["ev_013"] },
  ],

  // Active runs
  runs: [
    { id: "stage2/mt_011_pricing_acceptance",  team: "Tester",    role: "skeptical_buyer",     state: "running", item: "pdc_004", elapsed: "04:12", note: "7/10 cousins continued past pricing screen" },
    { id: "stage2/mt_014_objection_lattice",   team: "Tester",    role: "regulars_panel",      state: "replan",  item: "pdc_004", elapsed: "01:48", note: "leakage warn — scenario hinted at outcome" },
    { id: "stage2/mt_018_workflow_audit",      team: "Evaluator", role: "implementation_qa",   state: "running", item: "pdc_005", elapsed: "06:03", note: "barista workflow burden — 2nd pass" },
  ],

  // Agent roster
  agents: [
    { id: "ag_011", role: "Opportunity Strategist", team: "Builder",   state: "thinking",   item: "pdc_004", task: "deciding test order across pricing tiers" },
    { id: "ag_022", role: "Domain Researcher",      team: "Builder",   state: "reading",    item: "pdc_005", task: "mapping reserved-table substitutes nearby" },
    { id: "ag_033", role: "UX Researcher",          team: "Builder",   state: "drafting",   item: "art_003", task: "table-tent rule wording, v3" },
    { id: "ag_041", role: "Skeptical Buyer Panel", team: "Tester",    state: "responding", item: "pdc_004", task: "round 4 of objection prompts (cousin 5/8)" },
    { id: "ag_042", role: "Regulars Panel",         team: "Tester",    state: "queued",     item: "pdc_005", task: "blocked — leakage clearance pending" },
    { id: "ag_051", role: "Method Auditor",         team: "Evaluator", state: "auditing",   item: "stage2/mt_011", task: "method fit vs willingness-to-pay risk" },
    { id: "ag_052", role: "Coverage Auditor",       team: "Evaluator", state: "auditing",   item: "pdc_004", task: "operator-side workload coverage" },
  ],

  // Ledger — append-only event stream
  ledger: [
    { ts: "18:24:11", kind: "keep",    text: "mt_011 pricing acceptance: 7/10 owner cousins continued past pricing.",         run: "stage2/mt_011" },
    { ts: "18:23:47", kind: "warn",    text: "mt_014 tester blindness: scenario hint exposed; replanning prompt batch.",      run: "stage2/mt_014" },
    { ts: "18:22:09", kind: "fresh",   text: "ag_052 raised coverage gap — operator-side workload not yet tested directly.",  run: "stage2/coverage" },
    { ts: "18:20:31", kind: "keep",    text: "defense pdc_004: challenge #9 (substitution by co-working) Held.",              run: "stage2/defense" },
    { ts: "18:18:14", kind: "discard", text: "br_014 hourly metered seating cleared — barista workflow audit failed (2nd).",   run: "stage2/br_014" },
    { ts: "18:15:02", kind: "keep",    text: "tension surfaced: pricing page implies 'work session', signage says 'café'.",    run: "stage2/tension_fresh" },
    { ts: "18:11:38", kind: "warn",    text: "art_002 pricing page render delayed; QA awaiting next iteration.",               run: "stage3/art_002" },
    { ts: "18:09:52", kind: "keep",    text: "mt_018 reserved-table workflow: 4/6 owner cousins tolerable on solo shift.",     run: "stage2/mt_018" },
    { ts: "18:04:21", kind: "fresh",   text: "Yi-Ling persona composition revised; cousin variance 0.21 → 0.18.",              run: "stage3/per_001" },
    { ts: "17:58:09", kind: "discard", text: "br_011 pure drop-in cleared — 10-pack outperformed in 4/5 cousin variants.",     run: "stage2/br_011" },
  ],

  // Right rail — gate queue
  gate_queue: [
    { id: "gate_002", kind: "stage_2_to_3", primary: "Quiet-hours day pass / 10-pack punch card",
      one_liner: "Held against 9 of 12 challenges; 1 weakened (operator workload), 2 cleared.",
      queued: "16:02", recommendation: "advance pdc_004 with pdc_005 as parallel branch; keep pdc_006 discounted.",
      compounding: "This direction has been through 14 challenges across both gates. 11 held." },
    { id: "promo_003", kind: "template_promotion", artifact: "objection_lattice microtest method", note: "experimental → calibrated", queued: "15:48" },
    { id: "ont_004", kind: "ontology_approval", artifact: "new evidence type: micro_ritual_signal", note: "proposed by ag_022; 4 candidate cards", queued: "13:11" },
  ],

  // QA / leakage alerts
  qa: [
    { sev: "warn", kind: "leakage",        text: "scenario in mt_014 hinted at desired outcome — replanning",  run: "stage2/mt_014" },
    { sev: "info", kind: "broken_artifact", text: "art_002 pricing page render delayed; QA awaiting next iter", run: "stage3/art_002" },
    { sev: "warn", kind: "coverage_gap",    text: "no microtest covers solo-operator workload directly",        run: "pdc_004" },
  ],

  // Defense record for the lead direction
  defense_pdc_004: {
    summary: "Held against 9 of 12 challenges. 1 weakened. 2 cleared.",
    entries: [
      { challenger: "Skeptic — adoption ceiling",      verdict: "Held",     basis: "ev_044",          reasoning: "co-working seat budget already exists in this segment; pass collapses it without a category move." },
      { challenger: "Skeptic — substitute by library", verdict: "Held",     basis: "ev_058",          reasoning: "library-café sterility named explicitly; café atmosphere is the wedge." },
      { challenger: "Coverage — operator workload",    verdict: "Weakened", basis: "ev_013, con_021", reasoning: "no microtest covers the solo-barista reset routine. Strengthen-this lists this as cheapest next move." },
      { challenger: "Coverage — regulars displacement", verdict: "Held",     basis: "ev_039",          reasoning: "regulars-first signage rule entered the design; ev_039 still elevated, queued for Stage 3." },
      { challenger: "Bias — leakage from owner voice",  verdict: "Held",     basis: "audit_005",       reasoning: "tester team blinded; owner rationale not in scenario context." },
      { challenger: "Method — pricing test fit",        verdict: "Held",     basis: "audit_007",       reasoning: "fake-door + objection_lattice combination beats vp-test alone for 10-pack pricing." },
      { challenger: "Method — single-source dependency", verdict: "Cleared", basis: "ev_044",          reasoning: "ev_044 was the sole budget signal; resolved by adding ev_071 + 2 forum posts." },
      { challenger: "Skeptic — café-identity dilution", verdict: "Held",     basis: "ev_039, ev_071",  reasoning: "rule wording v3 protects identity; cousins responded to idea, not to rules-feel." },
      { challenger: "Skeptic — pricing ceiling at $8",  verdict: "Held",     basis: "ev_044",          reasoning: "10-pack at $42 sits below the co-working monthly anchor; willingness held across 6/8 cousins." },
      { challenger: "Coverage — channel signal absent",  verdict: "Cleared", basis: "audit_011",       reasoning: "no signage A/B in current artifact set — moved to Stage 3 plan, not gate-blocking." },
      { challenger: "Method — frequency of problem",     verdict: "Held",     basis: "ev_011",          reasoning: "afternoon slump observed in 5/7 owner sources; problem is recurrent, not episodic." },
      { challenger: "Skeptic — wedge durability",        verdict: "Held",     basis: "ev_058, ev_044",  reasoning: "wedge sits on atmosphere + budget collapse; both are slow-moving." },
    ],
  },

  // Personas (Stage 3, planned)
  personas: [
    { id: "per_001", name: "Yi-Ling", role: "remote_worker — laptop-friendly", from: ["ev_044","ev_058","ev_071"], cousins: 8, variance: 0.18, improv_rate: 0.06 },
    { id: "per_002", name: "Mr. Tan", role: "regular — four mornings a week",  from: ["ev_039","ev_013"],          cousins: 6, variance: 0.22, improv_rate: 0.04 },
    { id: "per_003", name: "Emily",   role: "owner-operator — solo barista",   from: ["ev_011","ev_013","ev_044"], cousins: 5, variance: 0.14, improv_rate: 0.09 },
  ],

  // Chief of Staff transcript (mocked)
  cos_transcript: [
    { who: "founder", text: "How's the quiet-hours cluster looking?", at: "18:21" },
    { who: "cos",     text: "Held against 9 of 12 in Stage 2. Three weakened or cleared. The one I'd want your eyes on is operator workload — we don't yet have a microtest on the barista reset routine. Want me to queue one before the gate?", at: "18:21" },
    { who: "founder", text: "Yes. And add a constraint — no more than one part-time staffer.", at: "18:22" },
    { who: "cos",     text: "Logged. I'll fold it into the Stage 3 stakeholder map and re-audit pdc_004 against it. Two minutes.", at: "18:22" },
  ],

  // What you missed — returns-only signal-ranked replay
  what_you_missed: [
    { id: "wym_01", duration_s: 18, headline: "Yi-Ling's three cousins all paid; her fourth walked away over the rules.", sub: "stage3/per_001 · cousin variance 0.21" },
    { id: "wym_02", duration_s: 22, headline: "Defense on pdc_005 weakened — regulars-displacement claim is now single-sourced.", sub: "stage2/defense · 5/8 → 4/8 held" },
    { id: "wym_03", duration_s: 30, headline: "New tension: pricing page implies 'work session' but signage says 'café'.", sub: "stage2/tension_fresh · microtest queued" },
  ],

  // Handoff note (drafted from the ledger session-boundary delta)
  handoff: {
    when: "Yesterday at 11:47pm",
    body: "you advanced cluster #3 (quiet-hours) and held cluster #5 (light-bites). Run 14 completed overnight; three moments are waiting for your eyes. Your $4 / 30-min experiment is on tomorrow's calendar.",
  },

  // Dossier — drafted, would be generated at Stage 3 close. Editorial register.
  dossier: {
    title: "Neighborhood café — fixing the afternoon slump",
    subtitle: "Harness-validated. Not market-validated.",
    confidence_label: "Where this stands inside the harness",
    confidence_value: 0.74,
    confidence_band: 0.06,

    // Screen 1
    thinking_changed: [
      { ts: "Apr 22 · day 1",   note: "You started looking for an afternoon traffic problem. By the end of day one you were looking for a regulars problem." },
      { ts: "Apr 26 · evening", note: "Reading Yi-Ling's voice memo, you noticed she'd already named her own willingness-to-pay ($50 / month at the co-working). You moved budget evidence from theory to anchor." },
      { ts: "May 1 · gate 1",   note: "You held cluster #5 (light-bites) for six hours, then advanced after microtest 11 weakened it." },
      { ts: "May 4 · run 12",   note: "You stopped framing this as remote-workers-vs-regulars and started framing it as a rules-clarity design problem." },
      { ts: "May 6 · gate 2",   note: "You let pdc_005 stay in as a parallel branch even though pdc_004 led on score. The scorecard rewards robustness." },
      { ts: "May 8 · ag_052",   note: "You asked: 'is this making baristas miserable?' That's the question you didn't ask on day one." },
      { ts: "May 9 · today",    note: "You're not yet sure if regulars feel safe. That's the right thing to be unsure about." },
    ],

    // Screen 2
    walked_past: [
      "You ran 0 microtests on operator-side workload. Coverage Auditor flagged it three times before it landed.",
      "The dominant unresolved uncertainty (regulars feeling crowded) was named in 7 microtests but never structurally tested.",
      "You have no evidence from any low-spend customer who is not a regular. The morning-only crowd is silent in your corpus.",
      "Pricing was tested against tier comprehension, not against substitution by library cafés one block over.",
      "Channel signals (signage A/B, neighborhood notice) were planned for Stage 3 and not yet run.",
    ],

    // Screen 3 — smallest real-world test
    smallest_test: {
      headline: "Tomorrow, 3pm. Walk into the closest comparable café. Order a coffee. Watch for 25 minutes.",
      cost: "$4",
      duration: "30 min",
      observe: [
        "How many laptop workers are in the room.",
        "How many regulars look annoyed when laptop workers ask about wifi or seating.",
        "How many seats are empty for >20 minutes.",
        "Whether the barista does the wipe.",
      ],
      outcome: "Confirms or kills your environmental assumption — that quiet-hours afternoons exist as a stable pattern in this kind of café, not just in Emily's.",
      tiers: [
        { tier: "$4 / 30 min", action: "Observation, comparable café." },
        { tier: "$0 / 60 min", action: "Re-read your own forum scrape with the regulars-displacement lens you didn't have on day one." },
        { tier: "$80 / 1 wk",  action: "Lend Emily a printed table-tent for one week. Watch what she does with it." },
      ],
    },

    // Screen 4 — cleared possibilities (full provenance)
    cleared_possibilities: [
      { name: "Full reservation system",        taught: "Regulars-first signage rule.",                      cleared_by: "Forum quote 2026-04-23 (ev_039)." },
      { name: "Pure drop-in pricing branch",    taught: "10-pack outperformed in 4/5 cousin variants.",       cleared_by: "Stage 2 pricing acceptance, 2nd pass (mt_011_b)." },
      { name: "Hourly metered seating",         taught: "Founders dislike timer UX; rule-clarity matters.",   cleared_by: "Barista workflow audit, twice (mt_018, mt_018_b)." },
      { name: "Wholesale to nearby offices",    taught: "Outside the founder's stated channel comfort.",      cleared_by: "Strategic-fit annotation, Stage 1 gate." },
      { name: "School-pickup pre-order window", taught: "Narrow segment, mixed budget signal.",               cleared_by: "Evidence yield + frequency of problem, low." },
    ],
  },
};
