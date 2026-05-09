// Anthropic LLM helper. Resolves model tiers, parses JSON output, tracks token spend.
//
// Tier policy is data per spec §16:
//   opus    — evidence extraction, clustering, evaluator/auditor judgment, dossier synthesis
//   sonnet  — Stage 3 implementation artifacts, Chief of Staff, prototype repair
//   haiku   — blinded testers, repetitive microtest participants, branch variation

import Anthropic from "@anthropic-ai/sdk";

const TIER_TO_MODEL = {
  opus: "claude-opus-4-5-20250929",
  sonnet: "claude-sonnet-4-5-20250929",
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

// Minimum, deliberate set of LLM ops the harness needs.
//
//   callJson     — Single-shot JSON output. Builder, Tester, Evaluator agents.
//   callText     — Plain-text output. Used for dossier prose and Chief of Staff.
//
// All calls log {prompt, model, usage, cost, output} to the agent transcript so
// the cockpit can show "what's happening now" honestly.

const DEFAULT_MAX_TOKENS = 1800;

function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

export async function callJson({ apiKey, tier, system, prompt, maxTokens, signal }) {
  const c = client(apiKey);
  const model = modelForTier(tier);
  const message = await c.messages.create(
    {
      model,
      max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
      system: `${system}\n\nReturn ONLY valid JSON matching the schema described. No prose, no markdown fences, no commentary.`,
      messages: [{ role: "user", content: prompt }]
    },
    signal ? { signal } : undefined
  );
  const text = (message.content || [])
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n");
  const parsed = extractJson(text);
  if (!parsed) {
    throw new Error(
      `LLM returned non-JSON from ${tier}/${model}. First 240 chars: ${String(text).slice(0, 240)}`
    );
  }
  const usage = message.usage || {};
  return {
    output: parsed,
    raw_text: text,
    model,
    tier: resolveTier(tier),
    in_tokens: usage.input_tokens || 0,
    out_tokens: usage.output_tokens || 0,
    cost_usd: priceUsd({
      tier,
      in_tokens: usage.input_tokens || 0,
      out_tokens: usage.output_tokens || 0
    }),
    stop_reason: message.stop_reason
  };
}

export async function callText({ apiKey, tier, system, prompt, maxTokens }) {
  const c = client(apiKey);
  const model = modelForTier(tier);
  const message = await c.messages.create({
    model,
    max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
    system,
    messages: [{ role: "user", content: prompt }]
  });
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
