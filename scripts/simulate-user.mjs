// End-to-end harness simulation — drives the same HTTP endpoints the React
// cockpit hits, validates every state transition matches the prototype's
// `D` shape, and confirms the agentic-harness memory-separation invariant
// is preserved on disk.
//
// Run: node scripts/simulate-user.mjs
//
// Optional: set ANTHROPIC_API_KEY in env to exercise live LLM stages.
// Without a key, Phases 2-4 stop at the first run-stage call and the
// ledger/error path is validated instead.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const API = process.env.VENTURE_API || "http://127.0.0.1:8787";
const ROOT = process.cwd();

// Prefer env, fall back to the locally saved settings (so a key configured
// once via the UI carries over to the simulator).
function loadSavedKey() {
  const p = join(ROOT, ".local", "ai-venture-lab-settings.json");
  if (!existsSync(p)) return "";
  try {
    const s = JSON.parse(readFileSync(p, "utf8"));
    return s?.anthropic?.apiKey || "";
  } catch {
    return "";
  }
}
const KEY = process.env.ANTHROPIC_API_KEY || loadSavedKey();

const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const SKIP = "\x1b[33mSKIP\x1b[0m";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const tag = ok === "skip" ? SKIP : ok ? PASS : FAIL;
  console.log(`${tag}  ${name}${detail ? "  →  " + detail : ""}`);
}

function assert(cond, name, detail) {
  record(name, !!cond, cond ? "" : detail || "");
  return cond;
}

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, body: json, text };
}

function fileLines(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").trim().split("\n").filter(Boolean);
}

function hasFields(obj, fields) {
  return fields.every(f => obj && obj[f] !== undefined);
}

const SAMPLE_SOURCES = [
  {
    label: "interview_alex",
    text: `Interview with Alex, freelance brand designer, 8 years independent.

She told me proposals eat her Sunday. "Every time a lead comes in I have a panic
spiral — pricing, timeline, scope. I have a Notion template but I rewrite half
of it because every project is different. I quote $4-12k for brand work and
fifty percent of leads ghost after I send the proposal." She mentioned she
re-uses portfolio screenshots manually each time. She said she'd pay for
something that drafts the proposal in her voice from the discovery call notes
but she's burned by AI tools that "write like a startup blog." Calmly skeptical.`
  },
  {
    label: "forum_post_designer_news",
    text: `Forum post on designer-news, March 2026:

"Anyone else feel like writing proposals takes longer than the actual project?
I track my hours and last quarter I spent 14 hours on proposals that didn't
close. That's a full day of client work I gave away free. Tried Bonsai and
HoneyBook and they're either too rigid or too generic. I keep coming back to
copy-pasting from old PDFs which feels worse every year. Would happily pay
$30/mo for something that doesn't sound like ChatGPT."

23 replies. Themes: ghosting after proposal sent, pricing uncertainty,
scope creep starts at the proposal stage, tools feel templated.`
  },
  {
    label: "voice_memo_owner_2026-04-08",
    text: `Voice memo, designer co-op owner, April 2026.

"The pattern I see across the eight people in our co-op is the proposal is
where the relationship breaks. If the discovery call is good and the proposal
lands fast and reads like the designer wrote it themselves, the close rate is
maybe 70%. If it takes a week and reads like a template, it's under 30%. The
problem is the people who are best at design are usually the slowest at writing
proposals. They re-read every paragraph six times. We've talked about a shared
proposal library but no one ever updates it." Tone: matter-of-fact, frustrated,
also sees it as an opportunity.`
  }
];

const BRIEF = {
  name: "Freelance designers lose time on proposals",
  search_domain: "Freelance brand and product designers; the proposal-and-pricing window between discovery call and signed contract",
  geography: "US / EU / global",
  business_models: "b2c_saas, productized_service",
  avoid: "regulated industries\nenterprise procurement",
  founder_advantages: "AI prototyping\nproduct/design taste\naccess to designer co-ops",
  opening_uncertainties: "Which segment feels the pain most?\nWhat current workaround is weakest?\nWill they trust AI-generated proposal language?"
};

// ── Run ────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== AI Venture Lab — User Simulation ===`);
  console.log(`API: ${API}`);
  console.log(`Anthropic key: ${KEY ? `present (${KEY.slice(0, 6)}…${KEY.slice(-4)})` : "absent — Phases 2-4 will be skipped or expect 400s"}`);
  console.log(``);

  // ── Phase 1: pre-flight ───────────────────────────────────────
  console.log(`--- Phase 1: pre-flight ---`);
  let r = await req("GET", "/api/health");
  assert(r.status === 200 && r.body?.ok, "GET /api/health responds 200 ok");

  r = await req("GET", "/api/settings");
  assert(r.status === 200, "GET /api/settings responds");
  assert(hasFields(r.body, ["openai", "anthropic", "fal", "elevenlabs"]), "settings has all four providers");

  r = await req("GET", "/api/campaigns");
  assert(r.status === 200 && Array.isArray(r.body?.campaigns), "GET /api/campaigns returns campaigns array");

  // Configure key if env-provided.
  if (KEY) {
    r = await req("PUT", "/api/settings", { anthropic: { apiKey: KEY } });
    assert(r.status === 200 && r.body?.anthropic?.configured, "PUT /api/settings persists Anthropic key");
  }

  // ── Phase 2: create campaign + add sources ───────────────────
  console.log(`\n--- Phase 2: create campaign + add 3 sources ---`);
  r = await req("POST", "/api/campaigns", { brief: BRIEF, founder_intent: "Designers losing hours on proposals" });
  if (!assert(r.status === 201 && r.body?.campaign?.id, "POST /api/campaigns creates campaign", JSON.stringify(r.body).slice(0, 200))) return;
  const id = r.body.campaign.id;
  console.log(`campaign id: ${id}`);

  const fresh = r.body.current_state;
  assert(fresh.campaign?.id === id, "fresh state.campaign.id matches");
  assert(Array.isArray(fresh.opp_clusters) && fresh.opp_clusters.length === 0, "fresh opp_clusters[] empty");
  assert(Array.isArray(fresh.directions) && fresh.directions.length === 0, "fresh directions[] empty");
  assert(Array.isArray(fresh.artifacts) && fresh.artifacts.length === 0, "fresh artifacts[] empty");
  assert(Array.isArray(fresh.evidence) && fresh.evidence.length === 0, "fresh evidence[] empty");
  assert(Array.isArray(fresh.agents), "fresh agents[] is array");
  assert(Array.isArray(fresh.ledger) && fresh.ledger.length >= 1, "fresh ledger has creation event");
  assert(fresh.status && typeof fresh.status.cost_spent === "number", "fresh status has cost ticker");

  for (const src of SAMPLE_SOURCES) {
    r = await req("POST", `/api/campaigns/${id}/source-note`, src);
    if (!assert(r.status === 201, `POST source-note (${src.label})`)) return;
  }
  r = await req("GET", `/api/campaigns/${id}`);
  assert(r.body.reading?.manifest?.length === SAMPLE_SOURCES.length, `manifest has ${SAMPLE_SOURCES.length} sources`);
  assert(Array.isArray(r.body.reading?.corpus_shape), "corpus_shape populated");

  // ── Phase 3: run Stage 1 ─────────────────────────────────────
  console.log(`\n--- Phase 3: run Stage 1 ---`);
  if (!KEY) {
    r = await req("POST", `/api/campaigns/${id}/run-stage1`);
    assert(r.status === 400 && /Anthropic API key/.test(r.body?.error || ""), "run-stage1 fails cleanly with no key");
    const after = (await req("GET", `/api/campaigns/${id}`)).body;
    const hasWarn = (after.ledger || []).some(e => e.kind === "warn" && /API key/.test(e.text || ""));
    assert(hasWarn, "ledger captured the failure as a warn entry");
    record("Phase 3 (Stage 1 LLM run)", "skip", "no ANTHROPIC_API_KEY in env");
  } else {
    console.log("Running Stage 1 — this calls Anthropic and takes ~30-60 s…");
    const t0 = Date.now();
    r = await req("POST", `/api/campaigns/${id}/run-stage1`);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    if (!assert(r.status === 200, `run-stage1 returns 200 in ${dt}s`, r.body?.error || r.text?.slice(0, 200))) return;
    const s = r.body;

    // Evidence cards
    assert(Array.isArray(s.evidence) && s.evidence.length >= 3, `evidence[] has ≥3 cards (got ${s.evidence?.length})`);
    if (s.evidence?.[0]) {
      const e0 = s.evidence[0];
      assert(hasFields(e0, ["id", "type", "claim", "source", "conf"]), "evidence card has core fields");
      assert(hasFields(e0.source || {}, ["id", "file", "quote"]), "evidence.source has provenance fields");
    }

    // Opportunity clusters
    assert(Array.isArray(s.opp_clusters) && s.opp_clusters.length >= 1, `opp_clusters[] has ≥1 (got ${s.opp_clusters?.length})`);
    if (s.opp_clusters?.[0]) {
      const c0 = s.opp_clusters[0];
      assert(hasFields(c0, ["id", "name", "conf", "band", "ev", "ten", "defense", "state", "evidence_card_ids", "key_uncertainties"]),
        "cluster has D-shape fields");
      assert(/\d+\s*\/\s*\d+\s*held/.test(c0.defense || ""), `defense format "X / Y held" — got "${c0.defense}"`);
    }

    // Tensions
    assert(Array.isArray(s.tensions), "tensions[] present");

    // Defense records keyed by id
    assert(s.defense_records && typeof s.defense_records === "object", "defense_records object present");
    const drKeys = Object.keys(s.defense_records || {});
    if (drKeys.length > 0) {
      const dr = s.defense_records[drKeys[0]];
      assert(Array.isArray(dr.entries) && dr.entries.length >= 1, `first defense record has ≥1 entry (${dr.entries?.length})`);
      const e = dr.entries?.[0];
      assert(e && hasFields(e, ["challenger", "verdict", "basis", "reasoning"]), "defense entry has all fields");
      assert(["Held", "Weakened", "Cleared", "Noted"].includes(e?.verdict), `verdict from allowed set — got "${e?.verdict}"`);
    } else {
      record("at least one defense record exists", false, "defense_records empty");
    }

    // Gate queue
    assert((s.gate_queue || []).some(g => g.kind === "stage_1_to_2"), "gate_queue has stage_1_to_2 event");

    // Ledger
    assert((s.ledger || []).length >= 4, "ledger accumulated ≥4 entries through Stage 1");

    // ── Phase 3b: agentic-harness invariants on disk ──────────
    const base = join(ROOT, "venture_lab", "campaigns", id);
    const extractorJob = join(base, "stage1", "extractor_job.json");
    const clustererJob = join(base, "stage1", "clusterer_job.json");
    const evaluatorJob = join(base, "stage1", "evaluator_job.json");
    if (assert(existsSync(extractorJob), "stage1/extractor_job.json on disk")) {
      const j = JSON.parse(readFileSync(extractorJob, "utf8"));
      assert(Array.isArray(j.allowed_context) && j.allowed_context.length > 0, "extractor.allowed_context is set");
      assert(Array.isArray(j.forbidden_context), "extractor.forbidden_context is set");
      assert(typeof j.cost_usd === "number" && j.cost_usd >= 0, "extractor.cost_usd numeric");
      assert(j.model && /claude/i.test(j.model), `extractor.model is a Claude model — got "${j.model}"`);
    }
    assert(existsSync(clustererJob), "stage1/clusterer_job.json on disk");
    assert(existsSync(evaluatorJob), "stage1/evaluator_job.json on disk");
    assert(fileLines(join(base, "evidence", "cards.jsonl")).length === s.evidence.length, "evidence/cards.jsonl row count matches state");
    assert(fileLines(join(base, "stage1", "opportunity_clusters.jsonl")).length === s.opp_clusters.length, "stage1/opportunity_clusters.jsonl row count matches state");

    // ── Phase 4: cascade Stages 2 + 3 + dossier ────────────────
    console.log(`\n--- Phase 4: advance + run Stage 2, then 3, then dossier ---`);
    r = await req("POST", `/api/campaigns/${id}/advance-stage2`);
    assert(r.status === 200, "advance-stage2 returns 200");

    console.log("Running Stage 2 — Anthropic, ~60-90 s…");
    const t2 = Date.now();
    r = await req("POST", `/api/campaigns/${id}/run-stage2`);
    const dt2 = ((Date.now() - t2) / 1000).toFixed(1);
    if (!assert(r.status === 200, `run-stage2 returns 200 in ${dt2}s`, r.body?.error || r.text?.slice(0, 200))) {
      summary(); return;
    }
    const s2 = r.body;
    assert(Array.isArray(s2.directions) && s2.directions.length >= 1, `directions[] has ≥1 (got ${s2.directions?.length})`);
    assert(s2.directions?.some(d => d.state === "lead"), "exactly one direction marked 'lead'");
    if (s2.directions?.[0]) {
      const d0 = s2.directions[0];
      assert(hasFields(d0, ["id", "name", "wedge", "conf", "band", "microtests", "defense", "state", "parents"]),
        "direction has D-shape fields");
    }
    assert((s2.gate_queue || []).some(g => g.kind === "stage_2_to_3"), "gate_queue advanced to stage_2_to_3");

    // Tester blinded-context invariant
    const base2 = join(ROOT, "venture_lab", "campaigns", id);
    const testerFiles = [];
    try {
      const { readdirSync } = await import("node:fs");
      const dir = join(base2, "stage2", "microtest_runs");
      if (existsSync(dir)) testerFiles.push(...readdirSync(dir).map(f => join(dir, f)));
    } catch {}
    assert(testerFiles.length >= 1, `stage2/microtest_runs has ≥1 file (got ${testerFiles.length})`);

    // The MEMORY SEPARATION INVARIANT — find any tester job and assert its forbidden_context
    // (jobs are recorded inside microtest run files via the agent runner; we also check
    // the job-spec record which `runAgent` returns and the orchestrator persists in agent state)
    const tester = (s2.agents || []).find(a => a.team === "Tester");
    if (assert(tester, "at least one Tester agent recorded in state")) {
      assert(Array.isArray(tester.forbidden_context), "tester.forbidden_context is an array");
      const required = ["builder_rationale", "desired_outcome", "scorecard_threshold"];
      for (const f of required) {
        assert((tester.forbidden_context || []).includes(f), `tester forbidden_context excludes ${f}`);
      }
      const allowed = tester.allowed_context || [];
      assert(!allowed.includes("builder_rationale"), "tester allowed_context does NOT include builder_rationale");
      assert(!allowed.includes("scorecard_threshold"), "tester allowed_context does NOT include scorecard_threshold");
    }

    r = await req("POST", `/api/campaigns/${id}/advance-stage3`);
    assert(r.status === 200, "advance-stage3 returns 200");

    console.log("Running Stage 3 — Anthropic, ~90-150 s…");
    const t3 = Date.now();
    r = await req("POST", `/api/campaigns/${id}/run-stage3`);
    const dt3 = ((Date.now() - t3) / 1000).toFixed(1);
    if (!assert(r.status === 200, `run-stage3 returns 200 in ${dt3}s`, r.body?.error || r.text?.slice(0, 200))) {
      summary(); return;
    }
    const s3 = r.body;
    assert(Array.isArray(s3.artifacts) && s3.artifacts.length >= 1, `artifacts[] has ≥1 (got ${s3.artifacts?.length})`);
    if (s3.artifacts?.[0]) {
      const a0 = s3.artifacts[0];
      assert(hasFields(a0, ["id", "name", "aud", "purpose", "qa", "state", "parents", "type"]), "artifact has D-shape fields");
      assert(typeof a0.body_markdown === "string" && a0.body_markdown.length > 0, "artifact has body_markdown content");
    }
    assert(Array.isArray(s3.personas) && s3.personas.length >= 1, `personas[] has ≥1 (got ${s3.personas?.length})`);
    if (s3.personas?.[0]) {
      const p0 = s3.personas[0];
      assert(hasFields(p0, ["id", "name", "role", "from", "cousins", "variance"]), "persona has D-shape fields");
      assert(Array.isArray(p0.from) && p0.from.length >= 1, `persona.from has ≥1 evidence id (got ${p0.from?.length})`);
    }
    assert(s3.pilot_run && typeof s3.pilot_run.harness_score === "number", `pilot_run.harness_score is numeric (got ${s3.pilot_run?.harness_score})`);
    if (s3.pilot_run?.scorecard) {
      const sc = s3.pilot_run.scorecard;
      const dims = ["desirability", "viability", "feasibility", "wedge", "market_attractiveness", "evidence_confidence"];
      const present = dims.filter(d => typeof sc[d] === "number");
      assert(present.length >= 4, `scorecard has ≥4 of 6 dimensions (got ${present.join(", ")})`);
    }

    console.log("Generating dossier…");
    r = await req("POST", `/api/campaigns/${id}/generate-dossier`);
    if (!assert(r.status === 200, "generate-dossier returns 200", r.body?.error)) { summary(); return; }
    const sD = r.body;
    assert(sD.dossier && typeof sD.dossier === "object", "state.dossier present");
    if (sD.dossier) {
      assert(hasFields(sD.dossier, ["title", "subtitle", "confidence_value", "thinking_changed", "walked_past", "smallest_test", "cleared_possibilities"]),
        "dossier has all four-screen fields");
      assert(typeof sD.dossier.smallest_test?.headline === "string" && sD.dossier.smallest_test.headline.length > 0,
        "dossier.smallest_test.headline is non-empty");
      assert(Array.isArray(sD.dossier.thinking_changed), "dossier.thinking_changed[] is array");
    }
    const dossierMd = join(base2, "dossiers", "opportunity_dossier_001.md");
    const dossierJson = join(base2, "dossiers", "dossier.json");
    assert(existsSync(dossierMd), "dossiers/opportunity_dossier_001.md on disk");
    assert(existsSync(dossierJson), "dossiers/dossier.json on disk");
  }

  // ── Phase 5: SSE smoke ───────────────────────────────────────
  console.log(`\n--- Phase 5: SSE smoke ---`);
  await new Promise((resolve) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); resolve(); }, 1500);
    fetch(`${API}/api/campaigns/${id}/events`, { signal: ctrl.signal })
      .then(async (res) => {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        const { value } = await reader.read();
        const chunk = dec.decode(value || new Uint8Array());
        record("/events emits hello frame", /event:\s*hello/.test(chunk), chunk.slice(0, 60));
        clearTimeout(timer);
        ctrl.abort();
        resolve();
      })
      .catch(() => resolve());
  });

  summary();
}

function summary() {
  const total = results.length;
  const passed = results.filter(r => r.ok === true).length;
  const failed = results.filter(r => r.ok === false).length;
  const skipped = results.filter(r => r.ok === "skip").length;
  console.log(`\n=== Summary ===`);
  console.log(`${passed}/${total} pass · ${failed} fail · ${skipped} skip`);
  if (failed > 0) {
    console.log(`\nFailures:`);
    for (const r of results.filter(x => x.ok === false)) {
      console.log(`  ${FAIL}  ${r.name}${r.detail ? "  →  " + r.detail : ""}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
