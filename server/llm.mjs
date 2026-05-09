// Anthropic LLM helper. Resolves model tiers, parses JSON output, tracks token spend.
//
// Tier policy is data per spec §16:
//   opus    — evidence extraction, clustering, evaluator/auditor judgment, dossier synthesis
//   sonnet  — Stage 3 implementation artifacts, Chief of Staff, prototype repair
//   haiku   — blinded testers, repetitive microtest participants, branch variation

import Anthropic from "@anthropic-ai/sdk";

const TIER_TO_MODEL = {
  opus: "claude-opus-4-7",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001"
};

// Approximate per-million-token prices (USD). Used only for the cost ticker
// surfaced to the founder; not authoritative billing.
const TIER_PRICES = {
  opus: { in: 15, out: 75 },
  sonnet: { in: 3, out: 15 },
  haiku: { in: 1, out: 5 }
};

export class LlmUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export function resolveTier(tier) {
  if (TIER_TO_MODEL[tier]) return tier;
  if (tier === "quality" || tier === "high") return "opus";
  if (tier === "medium") return "sonnet";
  if (tier === "low") return "haiku";
  return "sonnet";
}

export function modelForTier(tier) {
  return TIER_TO_MODEL[resolveTier(tier)];
}

export function priceUsd({ tier, in_tokens, out_tokens }) {
  const t = TIER_PRICES[resolveTier(tier)] || TIER_PRICES.sonnet;
  return ((in_tokens || 0) * t.in + (out_tokens || 0) * t.out) / 1_000_000;
}

function client(apiKey) {
  if (!apiKey) {
    throw new LlmUnavailableError(
      "Anthropic API key is not configured. Add one in Settings before running stages."
    );
  }
  return new Anthropic({ apiKey });
}

// Anthropic SDK throws APIError objects whose `.message` is the raw JSON
// body. Surface the human-readable `error.message` field instead so the
// cockpit shows "Your credit balance is too low" rather than a JSON blob.
function friendlyAnthropicError(err) {
  if (!err) return new Error("Unknown LLM error.");
  // Try to read the structured fields the SDK puts on APIError.
  const status = err.status || err.statusCode;
  const inner = err.error?.error || err.error;
  const human = inner?.message || err.message;
  const type = inner?.type || err.type;
  const out = new Error(human || String(err));
  out.status = status;
  out.type = type;
  out.requestId = err.headers?.["request-id"] || err.requestID || err.request_id;
  return out;
}

// Minimum, deliberate set of LLM ops the harness needs.
//
//   callJson     — Single-shot JSON output. Builder, Tester, Evaluator agents.
//   callText     — Plain-text output. Used for dossier prose and Chief of Staff.
//
// All calls log {prompt, model, usage, cost, output} to the agent transcript so
// the cockpit can show "what's happening now" honestly.

// Cap is generous — Stage 2 strategist + evaluator outputs can run 3-4k
// tokens. Truncation here was the most common cause of "Run failed:
// non-JSON" errors before this bump.
const DEFAULT_MAX_TOKENS = 8192;
const MAX_PARSE_RETRIES = 2;

// Strip a leading ```json fence (and its trailing fence if present). If
// the response was truncated mid-JSON the trailing fence won't be there;
// we fall back to substring-by-brace.
function stripFence(text) {
  if (!text) return "";
  const m = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  return m ? m[1] : text;
}

// Try to repair a JSON string that was truncated mid-output (max_tokens
// was hit). We close any unbalanced braces / brackets and trim a
// dangling comma. This preserves the partial output the LLM produced
// instead of throwing the whole call away.
function repairTruncatedJson(s) {
  if (!s) return s;
  let out = s.trimEnd();
  // Drop a dangling comma so JSON.parse can succeed.
  out = out.replace(/,\s*$/, "");
  // Track open/close depth across [, {, and string boundaries.
  let inString = false;
  let escape = false;
  let braces = 0;
  let brackets = 0;
  for (let i = 0; i < out.length; i += 1) {
    const c = out[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{") braces += 1;
    else if (c === "}") braces -= 1;
    else if (c === "[") brackets += 1;
    else if (c === "]") brackets -= 1;
  }
  if (inString) out += '"';
  while (brackets > 0) { out += "]"; brackets -= 1; }
  while (braces > 0) { out += "}"; braces -= 1; }
  return out;
}

function extractJson(text) {
  if (!text) return null;
  const stripped = stripFence(text).trim();
  // Try plain parse first.
  try { return JSON.parse(stripped); } catch {}
  // Try the substring between the first `{` and last `}`.
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch {}
  }
  // Last resort: repair a truncated stream.
  try { return JSON.parse(repairTruncatedJson(stripped)); } catch {}
  return null;
}

export async function callJson({ apiKey, tier, model: modelOverride, system, prompt, maxTokens, signal }) {
  const c = client(apiKey);
  // The user's configured Default model in Settings wins. Tier is a
  // documented preference (opus for evaluators / sonnet for artifact
  // builders / haiku for blinded testers) but only kicks in if the user
  // hasn't specified one.
  const model = (modelOverride && String(modelOverride).trim()) || modelForTier(tier);
  const maxTok = maxTokens || DEFAULT_MAX_TOKENS;
  const baseSystem = `${system}\n\nReturn ONLY valid JSON matching the schema described. No prose, no markdown fences, no commentary.`;
  const messages = [{ role: "user", content: prompt }];

  let lastText = "";
  let lastUsage = { input_tokens: 0, output_tokens: 0 };
  let lastStop = null;
  let totalIn = 0;
  let totalOut = 0;

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt += 1) {
    let message;
    try {
      message = await c.messages.create(
        {
          model,
          max_tokens: maxTok,
          system: baseSystem,
          messages
        },
        signal ? { signal } : undefined
      );
    } catch (err) {
      throw friendlyAnthropicError(err);
    }
    const text = (message.content || [])
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");
    const usage = message.usage || {};
    totalIn += usage.input_tokens || 0;
    totalOut += usage.output_tokens || 0;
    lastText = text;
    lastUsage = usage;
    lastStop = message.stop_reason;

    const parsed = extractJson(text);
    if (parsed) {
      return {
        output: parsed,
        raw_text: text,
        model,
        tier: resolveTier(tier),
        in_tokens: totalIn,
        out_tokens: totalOut,
        cost_usd: priceUsd({ tier, in_tokens: totalIn, out_tokens: totalOut }),
        stop_reason: lastStop,
        attempts: attempt + 1
      };
    }

    // Parse failed. If we haven't exhausted retries, append a corrective
    // message and try again. The retry includes the LLM's previous output
    // so it can fix in place rather than restarting from scratch.
    if (attempt < MAX_PARSE_RETRIES) {
      messages.push({ role: "assistant", content: text });
      const reason = message.stop_reason === "max_tokens"
        ? "Your previous output was truncated because it ran past the token limit. Re-emit the FULL response as compact JSON (no whitespace, no markdown fence). Drop any optional fields you can to fit."
        : "Your previous output could not be parsed as JSON. Re-emit the FULL response as a single valid JSON object. No markdown fence. No commentary. No trailing text.";
      messages.push({ role: "user", content: reason });
    }
  }

  throw new Error(
    `LLM returned non-JSON from ${tier}/${model} after ${MAX_PARSE_RETRIES + 1} attempts (last stop_reason: ${lastStop}). First 240 chars: ${String(lastText).slice(0, 240)}`
  );
}

export async function callText({ apiKey, tier, model: modelOverride, system, prompt, maxTokens }) {
  const c = client(apiKey);
  const model = (modelOverride && String(modelOverride).trim()) || modelForTier(tier);
  let message;
  try {
    message = await c.messages.create({
      model,
      max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }]
    });
  } catch (err) {
    throw friendlyAnthropicError(err);
  }
  const text = (message.content || [])
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n");
  const usage = message.usage || {};
  return {
    output: text,
    model,
    tier: resolveTier(tier),
    in_tokens: usage.input_tokens || 0,
    out_tokens: usage.output_tokens || 0,
    cost_usd: priceUsd({
      tier,
      in_tokens: usage.input_tokens || 0,
      out_tokens: usage.output_tokens || 0
    })
  };
}
