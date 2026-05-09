# AI Venture Lab

Local-first opportunity harness. You drop in messy founder material — interview notes, voice memos, forum scrapes, support tickets — and Claude-backed agent teams (Builder / Tester / Evaluator) run a three-stage pipeline that produces evidence cards, opportunity clusters, microtested product directions, simulated-pilot artifacts, and a final editorial dossier.

Everything is real. There is no mock data path: every cluster, every defense entry, every persona cousin response is produced by a Claude API call against your campaign's actual sources.

Built from the spec at [`references/ai-venture-lab-spec.md`](references/ai-venture-lab-spec.md).

## What it does

1. You give it your messy notes (typed inline, no upload friction).
2. Claude Haiku translates that into a structured campaign brief — name, search domain, geography, business models, avoid list, founder advantages, opening uncertainties.
3. **Stage 1 — Real-Data Collector.** Evidence Extractor (Opus) lifts atomic, source-grounded evidence cards. Opportunity Clusterer (Opus) names 3–7 opportunity clusters and surfaces tensions. Provenance Auditor (Opus) writes a defense record per cluster (Skeptic / Coverage / Bias / Method challenges, each verdicted Held / Weakened / Cleared).
4. **Stage 2 — Brainstorm + Microtests.** Strategist (Opus) produces 2–4 product direction wedges from the lead cluster. Blinded Testers (Haiku, strict allowed/forbidden context per spec §6) run blinded scenarios against the lead direction. Method Auditor (Opus) scores microtests and writes a Stage 2 defense record.
5. **Stage 3 — Simulated Pilot.** Plan Architect (Opus) builds a stakeholder map, artifact plan, and persona compositions. Prototype Builder (Sonnet) drafts each artifact in low-fi sketch register. Persona cousins (Haiku, blinded) react to the flagship artifact. Implementation QA + Scorer (Opus) computes the six-dimension scorecard (desirability / viability / feasibility / wedge / market attractiveness / evidence confidence) and identifies cleared possibilities.
6. **Dossier.** Synthesizer (Opus) composes the four-screen editorial publication: How your thinking changed / What we walked past together / The smallest real-world test / Cleared possibilities.

The whole flow is observable live. SSE pushes evidence cards, agent state changes, defense entries, and ledger events into the cockpit as they happen.

## Two surfaces

**Immersive mode** (default landing) — single italic-serif prompt, blinking cursor, your past campaign names drifting on a sunflower orbit, ambient particle field. Hit Enter on your idea, watch the brief draft, click "begin reading", watch the live ledger headline update with each stage step. Items orbit the centre with strength-weighted underlines and mini-hex agent indicators.

**Cockpit mode** (dense observability) — Linear-style operator console. Three-stage canvas (Item view: physics-clustered quadrants; Agent view: bordered team zones), right rail (Gate queue / Ledger / Leakage QA), pipeline pulse, real cost ticker, real elapsed-time counter, real Pause that aborts in-flight Anthropic calls.

You can switch between them at any time — Immersive always wins on a fresh refresh.

## Quick start

```bash
git clone https://github.com/heysami/atventure.git
cd atventure
npm install
npm run dev
```

Open http://127.0.0.1:5173/ — you'll land in immersive mode. The page tells you to add an API key first if none is set.

Click the model pill in the top bar (or the "please add an API key first" prompt), paste your Anthropic API key, save. The model defaults to `claude-sonnet-4-6`; change it in the same modal if you want Opus or Haiku.

Type your messy idea in the centre, press Enter. The whole flow runs end-to-end on real LLM calls. Expect each stage to take 30–120 seconds depending on model tier and source size.

## Cost transparency

Every Anthropic call's actual `usage.input_tokens` and `usage.output_tokens` (from the SDK's response, not estimated) are multiplied by the published per-million-token rates and accumulated into the cockpit's cost ticker (top right). A typical full Stage 1 → 2 → 3 → dossier campaign runs **$1.50–$3.00** on Sonnet 4-6, **$4.00–$8.00** on Opus 4-7. The default cap is $5.00 (visible in the topbar bar) — exceeding it doesn't auto-pause yet but you can soft-pause any in-flight run from the topbar at any time.

## File layout

Everything is local. No database, no cloud sync, no telemetry.

```
venture_lab/
  campaigns/
    {campaign_id}/
      campaign.json                       # name, brief, stage, status
      current_state.json                  # full cockpit state (D-shape)
      campaign_ledger.jsonl               # append-only event log
      sources/
        manifest.json                     # source list with labels
        raw/                              # raw source files as written
      evidence/
        cards.jsonl                       # Stage 1 evidence cards
        contradictions.jsonl              # tensions
      stage1/
        extractor_job.json                # per-agent job spec + transcript
        clusterer_job.json
        evaluator_job.json
        opportunity_clusters.jsonl
        defense_records.jsonl
      stage2/
        strategist_job.json
        evaluator_job.json
        product_direction_clusters.jsonl
        microtest_runs/                   # one file per blinded tester batch
        microtests_summary.json
      stage3/
        stakeholder_maps/
        artifact_plans/
        artifacts/                        # per-artifact body + qa state
        persona_compositions/             # composition recipes + cousin runs
        pilot_runs/
      dossiers/
        dossier.json                      # structured four-screen content
        opportunity_dossier_001.md        # markdown export
.local/
  ai-venture-lab-settings.json            # your API keys (never committed)
```

`.local/` and `venture_lab/` are both gitignored.

## Memory separation per spec §6

The Tester team is **blinded**. The agent runner in [`server/agents.mjs`](server/agents.mjs) is the only place that constructs prompts — every role declares `allowed_context` and `forbidden_context`, and the prompt builder includes ONLY the allowed fields. Blinded testers cannot see:

- `builder_rationale`
- `desired_outcome`
- `scorecard_threshold`
- `human_preference`
- `competing_branch_scores`
- `other_cousins`

The job spec written to disk records `sent_context_keys` so the audit trail proves blinded runs were actually blind.

## Resilience

- **Server restart mid-run.** On boot, the server scans `venture_lab/campaigns/` for any state with `mode: *_running` or `in_flight_runs > 0`, resets in-flight counters, prepends a `warn` ledger entry, and exposes a Resume button in the cockpit topbar.
- **JSON parse failures.** `callJson` retries up to 3× on parse failure with a corrective re-prompt (max-tokens-aware: tells the model to drop optional fields when truncated). `repairTruncatedJson` closes unbalanced braces / strings so partial outputs parse instead of crashing.
- **Pause is real.** Pause aborts the in-flight Anthropic call via `AbortController`, finalises the run with a `discard` ledger entry, and switches the topbar's Pause to a Resume button that picks up where you left off.

## Provider keys

Click **API keys** in the topbar (or the model pill in immersive mode). Keys are stored locally at `.local/ai-venture-lab-settings.json`. Never committed.

| Provider | Used for | Required for |
|---|---|---|
| Anthropic | Every agent call (Builder / Tester / Evaluator / Brief drafter / Dossier) | Everything |
| OpenAI | Reserved for future tier alternatives | Nothing yet |
| fal.ai | Stage 3 visual artifacts in low-fi sketch register | Not yet wired |
| ElevenLabs | Chief of Staff narration; opt-in synthetic persona voicing | Not yet wired |

You only need an Anthropic key to run the full three-stage flow today. The default model is `claude-sonnet-4-6`; tier policy in [`server/llm.mjs`](server/llm.mjs) recommends Opus for evaluators / dossier and Haiku for blinded testers, but **the model field in Settings always wins** — what you set there is what every agent uses.

## Validate end-to-end without the UI

```bash
node scripts/simulate-user.mjs
```

This drives the same HTTP endpoints the UI hits. With no key configured it validates the structural happy path (campaign creation, source intake, error handling, SSE smoke); with a key (env var `ANTHROPIC_API_KEY` or saved via the UI), it runs Stage 1–3 + dossier and asserts memory-separation invariants on disk.

## Status vs the spec

**Implemented**
- Three-stage agentic pipeline with real Claude calls (per [`server/agents.mjs`](server/agents.mjs), [`server/stages.mjs`](server/stages.mjs))
- Strict allowed/forbidden context enforcement (spec §6)
- Defense records (spec §13 Wow Moment 4)
- Persona compositions with cousin variance (spec §7)
- Editorial dossier (spec §14 Wow Moment 8)
- Live SSE-streamed cockpit (Item view + Agent view as `<canvas>` force-directed renderings, per prototype)
- Real cost ticker, real elapsed-time, real pulse line on agent activity
- Pause / Resume / boot recovery for interrupted runs
- Immersive mode (spec §13 register-shift, §11 Chief of Staff translation feel)
- File-backed campaign storage (spec §16)

**Not yet implemented**
- fal.ai image generation for Stage 3 artifacts (currently text-only artifacts)
- ElevenLabs TTS for Chief of Staff / dossier narration / persona voicing
- Whisper-based voice input for the Chief of Staff
- True parallel microtest DAG (microtests run sequentially today)
- Stage 3 multi-branch parallelism (strategy × segment × environment combinations)
- Tauri desktop bundle (runs as Vite dev server today)
- Reweighting / what-if analysis on the scorecard

## License

Personal project. Spec authorship rests with the original document at [`references/ai-venture-lab-spec.md`](references/ai-venture-lab-spec.md).
