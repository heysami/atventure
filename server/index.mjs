import express from "express";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runStage1, runStage2, runStage3, generateDossier, findMoreClusters, findMoreDirections } from "./stages.mjs";
import { runAgent } from "./agents.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const localDir = join(root, ".local");
const settingsPath = join(localDir, "ai-venture-lab-settings.json");
const labRoot = join(root, "venture_lab");
const campaignsRoot = join(labRoot, "campaigns");
const port = Number(process.env.PORT || 8787);

if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });
if (!existsSync(campaignsRoot)) mkdirSync(campaignsRoot, { recursive: true });

const defaultSettings = {
  openai: { apiKey: "", model: "gpt-5.2" },
  anthropic: { apiKey: "", model: "claude-sonnet-4-5" },
  fal: { apiKey: "", model: "fal-ai/flux/schnell" },
  elevenlabs: { apiKey: "", voiceId: "", model: "eleven_multilingual_v2" }
};

function readSettings() {
  if (!existsSync(settingsPath)) return structuredClone(defaultSettings);
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
    return Object.fromEntries(
      Object.entries(defaultSettings).map(([provider, defaults]) => [
        provider,
        { ...defaults, ...(parsed[provider] || {}) }
      ])
    );
  } catch {
    return structuredClone(defaultSettings);
  }
}

function writeSettings(next) {
  writeFileSync(settingsPath, JSON.stringify(next, null, 2));
}

function redactProvider(providerSettings) {
  const key = providerSettings.apiKey || "";
  return {
    configured: key.length > 0,
    last4: key ? key.slice(-4) : "",
    model: providerSettings.model,
    voiceId: providerSettings.voiceId
  };
}

function slugify(input) {
  return String(input || "campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "campaign";
}

function nowIso() {
  return new Date().toISOString();
}

function nowClock() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function appendJsonl(path, event) {
  writeFileSync(path, `${JSON.stringify(event)}\n`, { flag: "a" });
}

function createCampaignDirs(campaignId) {
  const base = join(campaignsRoot, campaignId);
  const dirs = [
    "",
    "template_snapshot",
    "sources/raw",
    "sources/normalized",
    "evidence",
    "stage1",
    "stage2/team_configs",
    "stage2/microtest_dags",
    "stage2/microtest_runs",
    "stage3/stakeholder_maps",
    "stage3/artifact_plans",
    "stage3/artifacts/generated",
    "stage3/artifacts/voiced",
    "stage3/persona_compositions",
    "stage3/pilot_runs",
    "chief_of_staff",
    "dossiers"
  ];
  for (const dir of dirs) mkdirSync(join(base, dir), { recursive: true });
  return base;
}

function publicCampaign(campaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    search_domain: campaign.search_domain,
    created_at: campaign.created_at,
    stage: campaign.stage,
    status: campaign.status
  };
}

function publicSettings() {
  const settings = readSettings();
  return Object.fromEntries(
    Object.keys(defaultSettings).map(provider => [provider, redactProvider(settings[provider])])
  );
}

function campaignBase(campaignId) {
  return join(campaignsRoot, campaignId);
}

function statePath(campaignId) {
  return join(campaignBase(campaignId), "current_state.json");
}

function loadState(campaignId) {
  const file = statePath(campaignId);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

function saveState(campaignId, state) {
  writeFileSync(statePath(campaignId), JSON.stringify(state, null, 2));
  const campaignFile = join(campaignBase(campaignId), "campaign.json");
  if (existsSync(campaignFile) && state.campaign) {
    const existing = JSON.parse(readFileSync(campaignFile, "utf8"));
    writeFileSync(campaignFile, JSON.stringify({
      ...existing,
      name: state.campaign.name,
      search_domain: state.campaign.search_domain,
      stage: state.campaign.stage,
      status: state.campaign.status,
      updated_at: nowIso()
    }, null, 2));
  }
}

function readSourceTexts(campaignId) {
  const manifestFile = join(campaignBase(campaignId), "sources", "manifest.json");
  if (!existsSync(manifestFile)) return [];
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  return (manifest.sources || []).map(source => {
    const rawPath = join(campaignBase(campaignId), "sources", "raw", source.filename);
    return {
      source,
      text: existsSync(rawPath) ? readFileSync(rawPath, "utf8") : ""
    };
  }).filter(row => row.text.trim());
}

// File-backed I/O helper passed into stages.
function makeFileApi(campaignId) {
  const base = campaignBase(campaignId);
  return {
    writeJson(relPath, obj) {
      const full = join(base, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, JSON.stringify(obj, null, 2));
    },
    writeJsonl(relPath, rows) {
      const full = join(base, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, rows.map(r => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
    },
    writeText(relPath, text) {
      const full = join(base, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, text);
    },
    appendJsonl(relPath, row) {
      const full = join(base, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, `${JSON.stringify(row)}\n`, { flag: "a" });
    }
  };
}

async function testAnthropic(apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic rejected the key (${response.status}): ${body.slice(0, 240)}`);
  }
  return { ok: true, provider: "anthropic" };
}

async function testOpenAI(apiKey) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI rejected the key (${response.status}): ${body.slice(0, 240)}`);
  }
  return { ok: true, provider: "openai" };
}

async function testElevenLabs(apiKey) {
  const response = await fetch("https://api.elevenlabs.io/v1/models", {
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs rejected the key (${response.status}): ${body.slice(0, 240)}`);
  }
  return { ok: true, provider: "elevenlabs" };
}

const app = express();
app.use(express.json({ limit: "2mb" }));

const streamClients = new Map();

function sseSend(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function emitCampaignEvent(campaignId, event, data) {
  const clients = streamClients.get(campaignId) || new Set();
  for (const res of clients) sseSend(res, event, data);
}

// ── Health & settings ──────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "AI Venture Lab", time: new Date().toISOString() });
});

app.get("/api/settings", (_req, res) => {
  res.json(publicSettings());
});

app.put("/api/settings", (req, res) => {
  const settings = readSettings();
  for (const provider of ["openai", "anthropic", "fal", "elevenlabs"]) {
    if (!req.body?.[provider]) continue;
    const incoming = req.body[provider];
    settings[provider] = {
      ...settings[provider],
      model: typeof incoming.model === "string" && incoming.model.trim()
        ? incoming.model.trim()
        : settings[provider].model,
      voiceId: typeof incoming.voiceId === "string"
        ? incoming.voiceId.trim()
        : settings[provider].voiceId,
      apiKey: typeof incoming.apiKey === "string" && incoming.apiKey.trim()
        ? incoming.apiKey.trim()
        : settings[provider].apiKey
    };
    if (incoming.clearKey === true) settings[provider].apiKey = "";
  }
  writeSettings(settings);
  res.json(publicSettings());
});

app.post("/api/test-key", async (req, res) => {
  try {
    const provider = req.body?.provider;
    const settings = readSettings();
    if (!["openai", "anthropic", "elevenlabs", "fal"].includes(provider)) {
      res.status(400).json({ ok: false, error: "Unknown provider" });
      return;
    }
    const apiKey = settings[provider].apiKey;
    if (!apiKey) {
      res.status(400).json({ ok: false, error: `No ${provider} API key is saved yet.` });
      return;
    }
    if (provider === "fal") {
      res.json({ ok: true, provider: "fal", note: "Saved locally. fal calls are validated when a generation job is queued." });
      return;
    }
    const result = provider === "openai"
      ? await testOpenAI(apiKey)
      : provider === "anthropic"
        ? await testAnthropic(apiKey)
        : await testElevenLabs(apiKey);
    res.json(result);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ── Chief of Staff brief drafter (real LLM, no regex) ──────
app.post("/api/draft-brief", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Source notes are empty." });
  const settings = readSettings();
  const apiKey = settings?.anthropic?.apiKey;
  if (!apiKey) {
    return res.status(400).json({ error: "Anthropic API key not configured. Add one in Settings before drafting a brief." });
  }
  try {
    const { output, job } = await runAgent({
      apiKey,
      model: settings?.anthropic?.model,
      roleKey: "brief_drafter",
      jobId: `pre_campaign_brief_${Date.now()}`,
      itemId: "draft_brief",
      task: "Translate the founder's messy notes into a structured campaign brief grounded in their actual material. Keep their voice. Surface genuine uncertainties.",
      contextValues: { founder_intent_text: text }
    });
    res.json({ brief: output, model: job.model, cost_usd: job.cost_usd });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Campaign list / create / open ───────────────────────────

app.get("/api/campaigns", (_req, res) => {
  const campaigns = readdirSync(campaignsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const file = join(campaignsRoot, entry.name, "campaign.json");
      if (!existsSync(file)) return null;
      try {
        return publicCampaign(JSON.parse(readFileSync(file, "utf8")));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  res.json({ campaigns });
});

app.post("/api/campaigns", (req, res) => {
  const brief = req.body?.brief || {};
  const name = String(brief.name || "Untitled campaign").trim();
  const campaignId = `camp_${Date.now()}_${slugify(name)}`;
  const base = createCampaignDirs(campaignId);
  const createdAt = nowIso();
  const campaign = {
    id: campaignId,
    name,
    created_at: createdAt,
    updated_at: createdAt,
    stage: "stage1",
    status: "brief_approved_reading_not_started",
    search_domain: String(brief.search_domain || "").trim(),
    strategic_constraints: {
      geography: String(brief.geography || "").trim(),
      preferred_business_models: String(brief.business_models || "")
        .split(",").map(x => x.trim()).filter(Boolean),
      avoid: String(brief.avoid || "").split("\n").map(x => x.trim()).filter(Boolean),
      founder_advantages: String(brief.founder_advantages || "").split("\n").map(x => x.trim()).filter(Boolean)
    },
    opening_uncertainties: String(brief.opening_uncertainties || "").split("\n").map(x => x.trim()).filter(Boolean)
  };

  const manifest = {
    campaign_id: campaignId,
    created_at: createdAt,
    sources: [],
    corpus_shape: []
  };

  const creationEvent = {
    ts: nowClock(),
    kind: "fresh",
    text: `Created campaign "${name}" from Chief of Staff draft brief.`,
    run: "campaign/created"
  };

  // The `current_state` shape mirrors the prototype's window.DEMO so the
  // cockpit renders without a translation layer.
  const currentState = {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      started: createdAt.slice(0, 10),
      today: createdAt.slice(0, 16).replace("T", " · "),
      search_domain: campaign.search_domain,
      constraints: {
        geography: campaign.strategic_constraints.geography,
        avoid: campaign.strategic_constraints.avoid
      },
      stage: "stage1",
      status: campaign.status
    },
    status: {
      stage: 1,
      in_flight_runs: 0,
      in_flight_agents: 0,
      cost_spent: 0,
      cost_cap: 5,
      elapsed_min: 0,
      cap_min: 23,
      pulse: Array(40).fill(1),
      unread_signal_cards: 0
    },
    stages: [
      { id: 1, name: "Real-data collector" },
      { id: 2, name: "Brainstorm + microtests" },
      { id: 3, name: "Simulated pilot" }
    ],
    opp_clusters: [],
    directions: [],
    artifacts: [],
    cleared: [],
    evidence: [],
    tensions: [],
    runs: [],
    agents: [],
    qa: [],
    gate_queue: [],
    personas: [],
    defense_records: {},
    what_you_missed: [],
    cos_transcript: [],
    handoff: null,
    dossier: null,
    mode: "fresh",
    reading: { status: "waiting_for_sources", manifest: [], noticing: [], corpus_shape: [], first_tension: null },
    ledger: [creationEvent]
  };

  writeFileSync(join(base, "campaign.json"), JSON.stringify(campaign, null, 2));
  writeFileSync(join(base, "sources", "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(base, "current_state.json"), JSON.stringify(currentState, null, 2));
  writeFileSync(join(base, "campaign_ledger.jsonl"), "");
  appendJsonl(join(base, "campaign_ledger.jsonl"), {
    ts: createdAt,
    kind: "campaign.created",
    human_gate_decision: "brief_approved",
    summary: `Created campaign "${name}" from Chief of Staff draft brief.`
  });
  writeFileSync(join(base, "chief_of_staff", "intent_translations.jsonl"), "");
  appendJsonl(join(base, "chief_of_staff", "intent_translations.jsonl"), {
    ts: createdAt,
    founder_intent_input: req.body?.founder_intent || "",
    proposed_translation: campaign,
    approved_by_founder: true,
    ledger_event_on_approval: "campaign.created"
  });

  res.status(201).json({ campaign: publicCampaign(campaign), current_state: currentState });
});

app.get("/api/campaigns/:id", (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  res.json(state);
});

app.get("/api/campaigns/:id/events", (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).end();
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  sseSend(res, "hello", { campaign_id: req.params.id, ts: nowIso() });
  if (!streamClients.has(req.params.id)) streamClients.set(req.params.id, new Set());
  streamClients.get(req.params.id).add(res);
  req.on("close", () => {
    streamClients.get(req.params.id)?.delete(res);
  });
});

// ── Source intake ───────────────────────────────────────────

function corpusFromManifest(manifest) {
  const total = manifest.sources.length || 1;
  const buckets = new Map();
  for (const src of manifest.sources) {
    const label = src.modality === "note" ? "Founder notes"
      : src.modality === "transcript" ? "Voice / transcript"
      : "Documents";
    buckets.set(label, (buckets.get(label) || 0) + 1);
  }
  return [...buckets.entries()].map(([label, count]) => ({ label, count, pct: count / total }));
}

app.post("/api/campaigns/:id/source-note", (req, res) => {
  const base = campaignBase(req.params.id);
  const stateFile = statePath(req.params.id);
  const manifestFile = join(base, "sources", "manifest.json");
  if (!existsSync(stateFile) || !existsSync(manifestFile)) {
    return res.status(404).json({ error: "Campaign not found" });
  }
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Source note is empty" });
  const label = String(req.body?.label || "founder_note").trim().slice(0, 40);
  const createdAt = nowIso();
  const sourceId = `src_${Date.now()}`;
  const filename = `${sourceId}_${label}.txt`;
  const source = {
    id: sourceId,
    filename,
    modality: "note",
    label,
    bytes: Buffer.byteLength(text),
    created_at: createdAt,
    status: "raw_stored"
  };
  writeFileSync(join(base, "sources", "raw", filename), text);
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  manifest.sources.push(source);
  manifest.corpus_shape = corpusFromManifest(manifest);
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  state.reading = state.reading || {};
  state.reading.status = "sources_added";
  state.reading.manifest = manifest.sources;
  state.reading.corpus_shape = manifest.corpus_shape;
  state.campaign.status = "sources_added";
  state.ledger = [{
    ts: nowClock(),
    kind: "fresh",
    text: `Added source ${sourceId} (${source.bytes} bytes).`,
    run: "stage1/intake"
  }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  appendJsonl(join(base, "campaign_ledger.jsonl"), {
    ts: createdAt,
    kind: "source.added",
    source
  });
  res.status(201).json(state);
});

// ── Stage runners ───────────────────────────────────────────

// In-flight run registry — keyed by campaignId so the Pause button can
// abort the active run and the state can mark it cleanly cancelled.
const activeRuns = new Map();

// Recover any campaigns whose saved state claims a run is in flight but
// the process that owned that run is gone (most commonly: a dev-server
// restart killed Node mid-stage). Without this, the cockpit shows
// "1 runs" / spinning state forever and the next Run button refuses to
// fire because the disk says a run is already active.
function recoverStaleRuns() {
  let recovered = 0;
  if (!existsSync(campaignsRoot)) return recovered;
  for (const entry of readdirSync(campaignsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = statePath(entry.name);
    if (!existsSync(file)) continue;
    let state;
    try { state = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }
    const stale = (state?.status?.in_flight_runs > 0)
      || /_running$|_streaming$/.test(state?.mode || "");
    if (!stale) continue;
    state.status = state.status || {};
    state.status.in_flight_runs = 0;
    state.status.run_started_at = null;
    state.status.elapsed_min = 0;
    state.status.in_flight_agents = (state.agents || []).filter(a => a.state !== "completed").length;
    // Drop the "_running" suffix on mode → reflect the last completed
    // gate state. e.g. stage2_running → stage2_gate (if a gate is
    // already queued) or fresh otherwise.
    if (state.mode === "stage1_streaming" || state.mode === "stage1_running") {
      state.mode = state.opp_clusters?.length ? "stage1_gate" : "fresh";
    } else if (state.mode === "stage2_running") {
      state.mode = state.directions?.length ? "stage2_gate" : "stage2_ready";
    } else if (state.mode === "stage3_running") {
      state.mode = state.artifacts?.length ? "stage3_done" : "stage3_ready";
    }
    state.last_error = "Run interrupted by server restart. Click the next Run button to resume.";
    state.ledger = [{
      ts: nowClock(),
      kind: "warn",
      text: "Run interrupted by server restart — partial state recovered. Re-run from the cockpit.",
      run: "harness/recovery"
    }, ...(state.ledger || [])].slice(0, 200);
    saveState(entry.name, state);
    recovered += 1;
  }
  if (recovered > 0) console.log(`Recovered ${recovered} interrupted campaign run(s).`);
  return recovered;
}
recoverStaleRuns();

function clearRun(campaignId) {
  const entry = activeRuns.get(campaignId);
  if (entry) {
    activeRuns.delete(campaignId);
  }
}

async function runWithEmit(campaignId, runner) {
  const state = loadState(campaignId);
  if (!state) throw new Error("Campaign not found");
  const settings = readSettings();
  const sources = readSourceTexts(campaignId);
  const fileApi = makeFileApi(campaignId);

  // If a run is already in flight, refuse to double-fire.
  if (activeRuns.has(campaignId)) {
    throw new Error("A run is already in flight for this campaign. Pause it first.");
  }
  const controller = new AbortController();
  activeRuns.set(campaignId, { controller, started_at: Date.now() });

  const emit = (event, data) => {
    if (event === "state") {
      saveState(campaignId, data);
    }
    emitCampaignEvent(campaignId, event, data);
  };

  try {
    const next = await runner(
      { campaignId, state, settings, sources, fileApi, signal: controller.signal },
      emit
    );
    saveState(campaignId, next);
    return next;
  } catch (error) {
    const failedState = loadState(campaignId) || state;
    const aborted = controller.signal.aborted;
    failedState.ledger = [{
      ts: nowClock(),
      kind: aborted ? "discard" : "warn",
      text: aborted ? "Run paused by founder." : `Run failed: ${error.message}`,
      run: aborted ? "harness/pause" : "harness/error"
    }, ...(failedState.ledger || [])].slice(0, 200);
    failedState.last_error = aborted ? null : error.message;
    failedState.mode = aborted ? "paused" : (failedState.mode || "fresh");
    if (failedState.status) {
      failedState.status.in_flight_runs = 0;
      failedState.status.run_started_at = null;
      failedState.status.elapsed_min = 0;
      failedState.status.in_flight_agents = (failedState.agents || []).filter(a => a.state !== "completed").length;
    }
    saveState(campaignId, failedState);
    emitCampaignEvent(campaignId, "state", failedState);
    if (!aborted) throw error;
    return failedState;
  } finally {
    clearRun(campaignId);
  }
}

app.post("/api/campaigns/:id/run-stage1", async (req, res) => {
  try {
    const next = await runWithEmit(req.params.id, runStage1);
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Streaming variant kept for backwards compatibility — same agentic pipeline,
// but the response returns immediately and SSE delivers state.
app.post("/api/campaigns/:id/stream-stage1", async (req, res) => {
  res.status(202).json({ ok: true, campaign_id: req.params.id, run: "stage1/stream" });
  try {
    await runWithEmit(req.params.id, runStage1);
  } catch (error) {
    // already logged into ledger by runWithEmit
  }
});

app.post("/api/campaigns/:id/advance-stage2", async (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  if (!state.opp_clusters?.length) return res.status(400).json({ error: "Stage 1 must complete first." });
  // Accept selective advance: { ids: ["opp_001", "opp_003"] } promotes
  // those clusters' state → "advanced". Empty body promotes the lead.
  const ids = Array.isArray(req.body?.ids) && req.body.ids.length > 0 ? req.body.ids : [state.opp_clusters[0].id];
  state.opp_clusters = state.opp_clusters.map(c => ids.includes(c.id) ? { ...c, state: "advanced" } : c);
  state.mode = "stage2_ready";
  state.campaign.stage = "stage2";
  state.campaign.status = "stage2_advance_approved";
  state.gate_queue = [];
  state.ledger = [{ ts: nowClock(), kind: "fresh", text: `Human advanced ${ids.length} cluster${ids.length === 1 ? "" : "s"} to Stage 2: ${ids.join(", ")}.`, run: "gate/stage1_to_stage2", advanced_ids: ids }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

app.post("/api/campaigns/:id/hold-clusters", async (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  state.opp_clusters = (state.opp_clusters || []).map(c => ids.includes(c.id) ? { ...c, state: "held" } : c);
  state.ledger = [{ ts: nowClock(), kind: "fresh", text: `Held ${ids.length} cluster${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}.`, run: "gate/hold" }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

app.post("/api/campaigns/:id/archive-clusters", async (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  state.opp_clusters = (state.opp_clusters || []).map(c => ids.includes(c.id) ? { ...c, state: "cleared" } : c);
  state.cleared = state.cleared || [];
  for (const id of ids) {
    const c = (state.opp_clusters || []).find(x => x.id === id);
    if (c && !state.cleared.find(x => x.id === id)) {
      state.cleared.push({ id, name: c.name, taught: c.note || "—", reason: "Archived by founder at gate" });
    }
  }
  state.ledger = [{ ts: nowClock(), kind: "discard", text: `Archived ${ids.length} cluster${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}.`, run: "gate/archive" }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

app.post("/api/campaigns/:id/run-stage2", async (req, res) => {
  try {
    const next = await runWithEmit(req.params.id, runStage2);
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/campaigns/:id/advance-stage3", async (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  if (!state.directions?.length) return res.status(400).json({ error: "Stage 2 must complete first." });
  const ids = Array.isArray(req.body?.ids) && req.body.ids.length > 0
    ? req.body.ids
    : [(state.directions.find(d => d.state === "lead") || state.directions[0]).id];
  // Mark selected directions as the new "lead" set; the first becomes
  // canonical lead so runStage3's lead-finder still works.
  state.directions = state.directions.map((d, i) => {
    if (!ids.includes(d.id)) return d;
    return { ...d, state: i === state.directions.findIndex(x => x.id === ids[0]) ? "lead" : "advanced" };
  });
  state.mode = "stage3_ready";
  state.campaign.stage = "stage3";
  state.campaign.status = "stage3_advance_approved";
  state.gate_queue = [];
  state.ledger = [{ ts: nowClock(), kind: "fresh", text: `Human advanced ${ids.length} direction${ids.length === 1 ? "" : "s"} to Stage 3: ${ids.join(", ")}.`, run: "gate/stage2_to_stage3", advanced_ids: ids }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

app.post("/api/campaigns/:id/hold-directions", async (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  state.directions = (state.directions || []).map(d => ids.includes(d.id) ? { ...d, state: "held" } : d);
  state.ledger = [{ ts: nowClock(), kind: "fresh", text: `Held ${ids.length} direction${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}.`, run: "gate/hold" }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

app.post("/api/campaigns/:id/archive-directions", async (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  state.directions = (state.directions || []).map(d => ids.includes(d.id) ? { ...d, state: "discounted" } : d);
  state.ledger = [{ ts: nowClock(), kind: "discard", text: `Discounted ${ids.length} direction${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}.`, run: "gate/archive" }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

app.post("/api/campaigns/:id/run-stage3", async (req, res) => {
  try {
    const next = await runWithEmit(req.params.id, runStage3);
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Soft-pause — abort the in-flight run for this campaign. The run loop
// receives the AbortSignal via context and the underlying Anthropic SDK
// call (via callJson's signal pass-through) honours it.
app.post("/api/campaigns/:id/pause", (req, res) => {
  const entry = activeRuns.get(req.params.id);
  if (!entry) return res.json({ ok: true, paused: false, note: "No active run." });
  entry.controller.abort();
  res.json({ ok: true, paused: true });
});

app.get("/api/campaigns/:id/run-status", (req, res) => {
  const entry = activeRuns.get(req.params.id);
  res.json({
    in_flight: !!entry,
    started_at: entry?.started_at || null
  });
});

// Force-clear a stuck run state. Useful when the cockpit shows
// "1 runs" but `/run-status` reports nothing in flight — a sign the
// disk lost sync (typically a server crash mid-run).
app.post("/api/campaigns/:id/force-clear-run", (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  // Abort any controller that DOES exist, just in case.
  const entry = activeRuns.get(req.params.id);
  if (entry) entry.controller.abort();
  activeRuns.delete(req.params.id);
  state.status = state.status || {};
  state.status.in_flight_runs = 0;
  state.status.run_started_at = null;
  state.status.elapsed_min = 0;
  state.status.in_flight_agents = (state.agents || []).filter(a => a.state !== "completed").length;
  if (/_running$|_streaming$/.test(state.mode || "")) {
    state.mode = state.opp_clusters?.length ? "stage1_gate" : "fresh";
  }
  state.ledger = [{
    ts: nowClock(),
    kind: "warn",
    text: "Run state force-cleared by founder.",
    run: "harness/force_clear"
  }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

// Reject a cluster, direction, or hypothesis with optional reason.
// Logged to state.rejections so subsequent producer runs (find-more-*,
// next-stage strategist) can use it as anti-pattern feedback.
app.post("/api/campaigns/:id/reject", (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  const kind = String(req.body?.kind || "").toLowerCase();
  const targetId = String(req.body?.id || "");
  const reason = String(req.body?.reason || "").slice(0, 400);
  if (!kind || !targetId) return res.status(400).json({ error: "kind and id are required" });

  state.rejections = state.rejections || [];
  let targetName = targetId;
  if (kind === "cluster") {
    state.opp_clusters = (state.opp_clusters || []).map(c => {
      if (c.id !== targetId) return c;
      targetName = c.name || c.id;
      return { ...c, state: "rejected", rejection_reason: reason || null };
    });
  } else if (kind === "direction") {
    state.directions = (state.directions || []).map(d => {
      if (d.id !== targetId) return d;
      targetName = d.name || d.id;
      return { ...d, state: "rejected", rejection_reason: reason || null };
    });
  } else if (kind === "hypothesis") {
    state.hypotheses = (state.hypotheses || []).map(h => {
      if (h.id !== targetId) return h;
      targetName = h.opportunity || h.pain || h.id;
      return { ...h, rejected: true, rejection_reason: reason || null };
    });
  } else {
    return res.status(400).json({ error: `Unknown reject kind: ${kind}` });
  }
  state.rejections.unshift({
    id: `rej_${Date.now()}`,
    kind,
    target_id: targetId,
    target_name: targetName,
    reason: reason || null,
    ts: nowIso()
  });
  state.ledger = [{
    ts: nowClock(),
    kind: "discard",
    text: `Rejected ${kind} ${targetId}${reason ? ` — ${reason}` : ""}.`,
    run: "gate/reject"
  }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

// Move a hypothesis from one cluster to another, or split off into a new
// cluster by passing a fresh `to_cluster_name`. Updates membership counts
// and back-fills hypothesis.cluster_id.
app.post("/api/campaigns/:id/reassign-hypothesis", (req, res) => {
  const state = loadState(req.params.id);
  if (!state) return res.status(404).json({ error: "Campaign not found" });
  const hypId = String(req.body?.hypothesis_id || "");
  const toClusterId = req.body?.to_cluster_id ? String(req.body.to_cluster_id) : null;
  const newName = req.body?.to_cluster_name ? String(req.body.to_cluster_name) : null;
  if (!hypId) return res.status(400).json({ error: "hypothesis_id is required" });
  const hyp = (state.hypotheses || []).find(h => h.id === hypId);
  if (!hyp) return res.status(404).json({ error: "hypothesis not found" });
  const fromId = hyp.cluster_id;
  // Resolve / create target cluster.
  let target;
  if (toClusterId) {
    target = (state.opp_clusters || []).find(c => c.id === toClusterId);
    if (!target) return res.status(404).json({ error: "target cluster not found" });
  } else if (newName) {
    const nextIdx = (state.opp_clusters || []).length + 1;
    target = {
      id: `opp_${String(nextIdx).padStart(3, "0")}`,
      name: newName,
      conf: 0.4, band: 0.16,
      ev: (hyp.evidence_card_ids || []).length, ten: 0,
      hypotheses: 0,
      defense: "0 / 0 held",
      state: "held",
      note: "Split off by founder",
      descendants: [],
      hypothesis_ids: [],
      evidence_card_ids: hyp.evidence_card_ids || [],
      key_uncertainties: [],
      recommended_microtests: []
    };
    state.opp_clusters.push(target);
  } else {
    return res.status(400).json({ error: "to_cluster_id or to_cluster_name required" });
  }
  // Apply the move.
  if (fromId) {
    state.opp_clusters = state.opp_clusters.map(c => {
      if (c.id !== fromId) return c;
      const ids = (c.hypothesis_ids || []).filter(x => x !== hypId);
      return { ...c, hypothesis_ids: ids, hypotheses: ids.length };
    });
  }
  state.opp_clusters = state.opp_clusters.map(c => {
    if (c.id !== target.id) return c;
    const ids = Array.from(new Set([...(c.hypothesis_ids || []), hypId]));
    return { ...c, hypothesis_ids: ids, hypotheses: ids.length };
  });
  state.hypotheses = state.hypotheses.map(h => h.id === hypId ? { ...h, cluster_id: target.id } : h);
  state.ledger = [{
    ts: nowClock(),
    kind: "fresh",
    text: `Reassigned ${hypId} from ${fromId || "—"} to ${target.id}${newName ? ` (new cluster "${newName}")` : ""}.`,
    run: "gate/reassign"
  }, ...(state.ledger || [])].slice(0, 200);
  saveState(req.params.id, state);
  emitCampaignEvent(req.params.id, "state", state);
  res.json(state);
});

app.post("/api/campaigns/:id/find-more-clusters", async (req, res) => {
  try {
    const next = await runWithEmit(req.params.id, findMoreClusters);
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/campaigns/:id/find-more-directions", async (req, res) => {
  try {
    const next = await runWithEmit(req.params.id, findMoreDirections);
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/campaigns/:id/generate-dossier", async (req, res) => {
  try {
    const next = await runWithEmit(req.params.id, generateDossier);
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Static dist (production build) is served if present.
const dist = join(root, "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => res.sendFile(join(dist, "index.html")));
}

app.listen(port, "127.0.0.1", () => {
  console.log(`AI Venture Lab API running at http://127.0.0.1:${port}`);
});
