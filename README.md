# AI Venture Lab

Local-first prototype-to-app build for the AI Venture Lab product spec.

## Current Status

This repository currently implements **Milestone 1: App Shell + Fake Runner**:

- React/Vite desktop cockpit based on `references/ai-venture-lab-prototype`
- Demo campaign data for "Neighborhood cafe — fixing the afternoon slump"
- Start-yours flow with Chief-of-Staff-style draft campaign brief
- Local campaign folder creation under `venture_lab/campaigns/{campaign_id}`
- Stage 1 Reading Theater entry state with raw source notes and source manifest
- Stage canvas, agent view, scientific summary, gate queue, ledger, Leakage/QA
- Editorial gate, defense record, Chief of Staff briefing, drafted dossier
- Local settings API for user-provided provider keys

It does **not** yet run real extraction, microtests, simulated pilots, fal.ai image generation, or ElevenLabs audio. Those integrations are configured first, then wired stage by stage.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

The dev script starts:

- Vite frontend on `127.0.0.1:5173`
- Local API server on `127.0.0.1:8787`

## Local Secrets

Click **API keys** in the top bar and paste the keys you want to use.

Keys are stored locally at:

```text
.local/ai-venture-lab-settings.json
```

`.local/` is gitignored. Do not commit it.

Supported settings:

- OpenAI / ChatGPT API key
- Anthropic / Claude API key
- fal.ai `FAL_KEY`
- ElevenLabs `ELEVENLABS_API_KEY`
- ElevenLabs Chief of Staff `voice_id`

## Provider Setup

### OpenAI

Create an API key in the OpenAI dashboard, then paste it in the app under **API keys**. For server-side use, the conventional environment variable is:

```bash
export OPENAI_API_KEY="your_key"
```

The app stores it locally instead of exposing it in browser code.

### Anthropic / Claude

Create an API key in the Anthropic Console, then paste it in the app. The conventional environment variable is:

```bash
export ANTHROPIC_API_KEY="your_key"
```

### fal.ai

Create a key from the fal dashboard. fal keys usually look like:

```text
key_id:key_secret
```

The conventional environment variable is:

```bash
export FAL_KEY="key_id:key_secret"
```

In this app, paste it into **API keys**. fal generation will be enabled when Stage 3 artifact generation is wired.

### ElevenLabs

Create an ElevenLabs API key, paste it into **API keys**, and optionally paste the `voice_id` you want for the Chief of Staff.

The conventional environment variable is:

```bash
export ELEVENLABS_API_KEY="your_key"
```

ElevenLabs requests authenticate with the `xi-api-key` header from the local server.

## Database Decision

For the real product, default to **local-first storage**:

- campaign files under `venture_lab/campaigns/{campaign_id}/`
- append-only campaign ledger
- generated artifacts stored locally
- SQLite for indexes / durable job state when real workers are added

Do **not** add Supabase by default. Supabase becomes useful later only if we add cloud sync, collaboration, or hosted user accounts. The spec explicitly leans local-first, so the first real database should be local SQLite, not a hosted database.

## Deployment Decision

For now this should run locally. Vercel/Render are not required for Milestone 1.

Later options:

- **Tauri desktop app**: best match for the spec
- **Render**: possible hosted orchestrator, but less local-first
- **Vercel**: possible hosted marketing/demo frontend, not ideal for local raw-source processing
- **Supabase**: later only for accounts/sync/collaboration

## Next Implementation Order

1. Replace mock campaign state with file-backed campaign storage.
2. Add SQLite ledger/index tables.
3. Add file upload for PDFs, screenshots, CSVs, transcripts, and audio.
4. Add Stage 1 real extraction with OpenAI/Claude.
5. Add Reading Theater streaming events.
6. Add Stage 2 microtest runner and evaluator audits.
7. Add Stage 3 artifact generation hooks:
   - fal.ai for low-fi images
   - ElevenLabs for opt-in voice
8. Package as Tauri desktop app.
