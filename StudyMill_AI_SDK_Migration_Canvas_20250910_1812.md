This plan defines the updated architecture, phases, and implementation steps for migrating StudyMill to the Vercel AI SDK with Cloudflare AI Gateway, supporting BYOK, resumable streaming, unified attachments, session branching/sharing, and Gateway routing/caching/guardrails. It incorporates ideas from Sparka (resumable streams, attachment UX) and keeps embeddings on `@cf/baai/bge-base-en-v1.5`.

## Global Enhancements (apply before/throughout phases)

### AI Gateway Routing (Gateway‑first)

All provider traffic flows through **Cloudflare AI Gateway** using an **authenticated** token set in the Worker as `AI_GATEWAY_TOKEN`. Provider API keys (Gemini/Vertex, OpenAI, OpenRouter) live in **Gateway Secret Store**—they are **not** stored in the Worker.

- **Routes**

    - `study-chat` (primary): Google Gemini 2.5 Flash → fallback Workers AI `@cf/meta/llama-3.1-70b-instruct-fp8-fast`
    - `study-tools`: same routing, but with longer TTL caching later
- **Environment variables (wrangler.jsonc)**

    - `AI_GATEWAY_GOOGLE_BASE_URL` → `…/studymill-prod/gemini`
    - `AI_GATEWAY_OPENAI_BASE_URL` → `…/studymill-prod/openai`
    - `AI_GATEWAY_OPENROUTER_BASE_URL` → `…/studymill-prod/openrouter`
- **Worker secrets**

    - `AI_GATEWAY_TOKEN` (Gateway auth)
    - `AI_PREFS_MASTER_KEY` (BYOK encryption master key, HKDF)

**Documentation**

- Dynamic routing: [https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/](https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/)
- Secret Store BYOK: [https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)
- Authentication: [https://developers.cloudflare.com/ai-gateway/configuration/authentication/](https://developers.cloudflare.com/ai-gateway/configuration/authentication/)
- Caching: [https://developers.cloudflare.com/ai-gateway/features/caching/](https://developers.cloudflare.com/ai-gateway/features/caching/)
- Rate limiting: [https://developers.cloudflare.com/ai-gateway/features/rate-limiting/](https://developers.cloudflare.com/ai-gateway/features/rate-limiting/)

### Unified Provider System (via AI SDK)

- Google (Gemini/Vertex) via `@ai-sdk/google`
- OpenAI via `@ai-sdk/openai`
- OpenRouter: **OpenAI‑compatible** (no separate package); **no default model** (explicit per user/session)

All providers use a **Gateway‑wrapped fetch** that injects `Authorization: Bearer ${AI_GATEWAY_TOKEN}` and targets the Gateway base URLs above.

**Documentation**

- AI SDK providers/models: [https://ai-sdk.dev/docs/foundations/providers-and-models](https://ai-sdk.dev/docs/foundations/providers-and-models)
- AI SDK reference (providers): [https://ai-sdk.dev/docs/reference/providers](https://ai-sdk.dev/docs/reference/providers)

---

## Phase 0 — Foundation (completed)

### Problem

Legacy WS + Durable Object chat, provider keys stored in code/Worker, no AI SDK abstraction, no resumables.

### Goal

Lay the groundwork for Gateway‑first traffic, secure BYOK in D1 with HKDF+AES‑GCM, provider registry, AI SDK service wrappers, and a minimal testable surface.

### Future State

- Worker never holds provider keys (only `AI_GATEWAY_TOKEN` + `AI_PREFS_MASTER_KEY`).
- D1 table for `user_ai_preferences` (encrypted BYOK, default provider/model).
- AI SDK service ready for Phase 1 HTTP streaming (no WS dependency).
- Basic test suite green (crypto + service).

### What changed (key points)

- **Dependencies** (Worker): `ai`, `@ai-sdk/openai`, `@ai-sdk/google`, `zod`
- **Crypto utils**: HKDF (SHA‑256) + AES‑GCM; base64url helpers; unit tests
- **D1**: `user_ai_preferences` (encrypted per‑provider BYOK; salt; model defaults)
- **Provider registry**: `createOpenAI`, Google client; OpenRouter via OpenAI client + baseURL; **no default OpenRouter model**
- **AI SDK service**: `streamChat`, `streamObject`, `resolveUserAIConfig` reads Gateway baseURLs + token
- **Vitest**: Node threads pool for Phase‑0 unit tests; green
- **Gateway**: base URLs injected; token set as Worker secret

### D1 schema (Phase 0)

```sql
CREATE TABLE IF NOT EXISTS user_ai_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_provider TEXT NOT NULL DEFAULT 'google' CHECK (default_provider IN ('google','openai','openrouter')),
  use_gateway INTEGER NOT NULL DEFAULT 1,
  google_key_ct TEXT, google_key_iv TEXT,
  openai_key_ct TEXT, openai_key_iv TEXT,
  openrouter_key_ct TEXT, openrouter_key_iv TEXT,
  salt_b64 TEXT NOT NULL,
  provider_models TEXT,                           -- JSON: { google, openai, openrouter }
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS update_user_ai_preferences_updated_at
AFTER UPDATE ON user_ai_preferences
BEGIN
  UPDATE user_ai_preferences SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;
```

> Provider keys in this table are for **BYOK** only. If not set, the system uses Gateway routes with Secret Store.

**Documentation**

- SubtleCrypto (HKDF/AES‑GCM): [https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- AI SDK security guide: [https://ai-sdk.dev/docs/guides/security](https://ai-sdk.dev/docs/guides/security)

---

## Phase 1 — Chat Migration (HTTP streaming + resumables + attachments)

### Problem

WebSocket + DO chat is not resilient to refresh, can’t leverage Gateway routing/caching/guardrails, and doesn’t expose a clean surface for schema‑driven tools and sources.

### Goal

Ship an **HTTP streaming** chat endpoint powered by AI SDK through AI Gateway, with:

- **Resumable streams** (generation_id persisted)
- **Server‑side context retrieval** before generation
- **Unified attachment pipeline** (drag‑drop → R2 → Vectorize → sources in answer)
- **Session branching + sharing**
- Modern UI built with AI SDK Elements (`useChat`, `<Message>`, `<PromptInput>`, `<Loader>`, `<Sources>`, `<Suggestion>`)

### Future State

- New `/api/chat` route (Hono) that streams via `streamText(...)`
- Durable Objects no longer required for chat transport (kept as fallback behind a flag until Phase 2)
- Document attachments handled inline in chat
- Sessions support branching/versioning; sharing produces signed snapshots

---

### Backend changes (Worker)

#### 1) Routes

- `POST /api/chat` — stream tokens using AI SDK; Gateway‑first routing
- `POST /api/chat/branch` — creates a new session from a prior message index
- `POST /api/share/:sessionId` — creates a signed share token and a snapshot record (public view)

**Documentation**

- AI SDK streaming: [https://ai-sdk.dev/docs/reference/core/streaming](https://ai-sdk.dev/docs/reference/core/streaming)
- AI SDK React `useChat`: [https://ai-sdk.dev/docs/react/use-chat](https://ai-sdk.dev/docs/react/use-chat)

#### 2) Storage model (D1)

- **Tables** (augment existing)

    - `chat_sessions` (add fields)

```sql
ALTER TABLE chat_sessions ADD COLUMN provider TEXT;       -- 'google' | 'openai' | 'openrouter'
ALTER TABLE chat_sessions ADD COLUMN model_id TEXT;       -- 'gemini-2.5-flash', etc.
ALTER TABLE chat_sessions ADD COLUMN generation_id TEXT;  -- latest inflight ID
ALTER TABLE chat_sessions ADD COLUMN parent_session_id TEXT;
ALTER TABLE chat_sessions ADD COLUMN branch_from_msg_index INTEGER;
CREATE INDEX IF NOT EXISTS ix_sessions_user_created ON chat_sessions(user_id, created_at);
```
    - `chat_messages` (ensure resumables)

```sql
ALTER TABLE chat_messages ADD COLUMN generation_id TEXT;       -- ties deltas/final to a run
ALTER TABLE chat_messages ADD COLUMN msg_index INTEGER;
CREATE INDEX IF NOT EXISTS ix_msgs_index ON chat_messages(session_id, msg_index);
CREATE INDEX IF NOT EXISTS ix_msgs_created ON chat_messages(session_id, created_at);
```
- **Resumables**

    - Issue a `generation_id` for each assistant turn.
    - Persist streamed chunks to `chat_messages` (append strategy) with `generation_id`.
    - If a client reconnects and finds an **incomplete** `generation_id`, server re‑attaches to the stream (if supported) or replays from persisted chunks and continues until complete.

**Documentation**

- Pattern reference (resumables inspiration): [https://github.com/franciscoMoretti/sparka](https://github.com/franciscoMoretti/sparka)

#### 3) Server‑side context retrieval

- Before `streamText(...)`, call a **static** method (convert your existing ContextSynthesisService to expose `getContextForDocuments` as static or a utility) to fetch relevant chunks from Vectorize + any user‑selected files.
- Accept two attachment vectors:

    - **Drag‑drop** files (new uploads → R2 → Vectorize ingest → IDs for context)
    - **Inline @file selection** from existing documents (like Cursor)
- Return **sources** `{ id, title, snippet }` back with the assistant message.

**Documentation**

- Sources component: [https://ai-sdk.dev/elements/components/sources](https://ai-sdk.dev/elements/components/sources)

#### 4) Gateway routing + fallback

- Default provider/model:

    - Provider: `google`
    - Model: `gemini-2.5-flash`
- Fallback (Gateway rule): Workers AI `@cf/meta/llama-3.1-70b-instruct-fp8-fast`
- OpenRouter: **no default** — enforce explicit model only when user actually selects OpenRouter.

**Documentation**

- Dynamic routing: [https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/](https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/)
- Workers AI models: [https://developers.cloudflare.com/workers-ai/platform/pricing/](https://developers.cloudflare.com/workers-ai/platform/pricing/)

#### 5) Guardrails (lightweight in Phase 1)

- **Local precheck**: quick single‑turn validation (e.g., short “safe?” probe) to give immediate UI feedback before sending.
- **Gateway guardrails**: leave OFF in Phase 1 (turn ON globally in Phase 4).

**Documentation**

- Guardrails: [https://developers.cloudflare.com/ai-gateway/features/guardrails/](https://developers.cloudflare.com/ai-gateway/features/guardrails/)

---

### Endpoint sketches

**`POST /api/chat`** (Hono)

```ts
// pseudocode sketch
app.post('/api/chat', async (c) => {
  const userId = requireUser(c)
  const { sessionId, messages, attachments, modelOverride, providerOverride } = await c.req.json()

  // 1) Resolve model/provider via D1 prefs or overrides
  const cfg = await resolveUserAIConfig(userId, c.env.DB, c.env)
  const provider = providerOverride || cfg.provider
  const model = modelOverride || (provider === 'openrouter' ? undefined : cfg.models[provider])
  if (provider === 'openrouter' && !model) throw new Error('OpenRouter requires explicit model')

  // 2) Context: assemble sources (Vectorize + attachments)
  const { contextStr, sources } = await ContextSynthesis.getContextForDocuments({ userId, attachments, db: c.env.DB })

  // 3) Compose system+messages
  const system = `You are StudyMill...`
  const coreMessages = [
    { role:'system', content: `${system}\n\nContext:\n${contextStr}` },
    ...messages
  ]

  // 4) Create generation_id, persist pending state
  const generationId = crypto.randomUUID()
  await persistPendingTurn({ sessionId, generationId, provider, model, db: c.env.DB })

  // 5) Stream via AI SDK (Gateway fetch injected)
  const result = await streamChat(
    { userId, messages: coreMessages, modelOverride: model, providerOverride: provider },
    { env: c.env, db: c.env.DB }
  )

  // 6) Convert to HTTP stream; persist deltas
  return new Response(
    result.toReadableStream({
      onToken: async (t) => appendDelta({ sessionId, generationId, t, db: c.env.DB }),
      onFinal: async (full) => completeTurn({ sessionId, generationId, content: full, sources, db: c.env.DB }),
      onError: async (err) => markFailed({ sessionId, generationId, err, db: c.env.DB })
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  )
})
```

**`POST /api/chat/branch`**

```ts
// create a new chat_sessions row with parent_session_id and branch_from_msg_index
// copy messages up to index; return new sessionId
```

**`POST /api/share/:sessionId`**

```ts
// create signed share token + insert into a snapshot table
// (e.g., chat_snapshots: { id, session_id, snapshot_json, created_at })
```

---

### Frontend changes (Next.js, Mantine)

- **Switch to `useChat`** for HTTP streaming.
- Show AI SDK Elements for rich UX:

    - `<Message>`: [https://ai-sdk.dev/elements/components/message](https://ai-sdk.dev/elements/components/message)
    - `<PromptInput>`: [https://ai-sdk.dev/elements/components/prompt-input](https://ai-sdk.dev/elements/components/prompt-input)
    - `<Loader>`: [https://ai-sdk.dev/elements/components/loader](https://ai-sdk.dev/elements/components/loader)
    - `<Sources>`: [https://ai-sdk.dev/elements/components/sources](https://ai-sdk.dev/elements/components/sources)
    - `<Suggestion>`: [https://ai-sdk.dev/elements/components/suggestion](https://ai-sdk.dev/elements/components/suggestion)
    - (Optional advanced) `<Response>`, `<Reasoning>`, `<InlineCitation>`, `<Context>`, `<CodeBlock>`, `<Artifact>`

**Example (simplified)**

```tsx
const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
  onResponse: async (res) => {/* apply UI state updates */},
  onError: (e) => {/* toast */},
  onFinish: () => {/* clear inflight flags */}
})

<form onSubmit={handleSubmit}>
  <Message content="..." />
  <PromptInput value={input} onChange={handleInputChange} />
  {isLoading && <Loader />}
  {messages.map(m => (
    <Message key={m.id} content={m.content} />
  ))}
  {/* when backend returns sources on final: */}
  {/* <Sources data={m.sources} /> */}
</form>
```

**Attachments**

- Add drag‑drop to the chat input; on drop:

    - Upload to R2
    - Kick off Vectorize ingest
    - Add returned doc IDs to the current turn’s **context list**
- Add “@file” inline selector to pick among existing docs.

**Documentation**

- Elements components:

    - Message: [https://ai-sdk.dev/elements/components/message](https://ai-sdk.dev/elements/components/message)
    - PromptInput: [https://ai-sdk.dev/elements/components/prompt-input](https://ai-sdk.dev/elements/components/prompt-input)
    - Loader: [https://ai-sdk.dev/elements/components/loader](https://ai-sdk.dev/elements/components/loader)
    - Sources: [https://ai-sdk.dev/elements/components/sources](https://ai-sdk.dev/elements/components/sources)
    - Suggestion: [https://ai-sdk.dev/elements/components/suggestion](https://ai-sdk.dev/elements/components/suggestion)
    - Artifact/Task (for Phase 3 tools): [https://ai-sdk.dev/elements/components/task](https://ai-sdk.dev/elements/components/task), [https://ai-sdk.dev/elements/components/artifact](https://ai-sdk.dev/elements/components/artifact)

---

### Operational notes (Phase 1)

- **Caching**: Leave OFF or use a very short TTL (e.g., 0–30s) for `/api/chat`; enable longer TTL later for deterministic tools.
- **Rate limiting & guardrails**: Configure in Gateway dashboard; keep server‑side precheck lightweight for now.
- **Feature flag**: Keep the existing WS/DO chat behind a flag during rollout.

---

### Testing & rollout

- **Unit**: extend Phase‑0 tests with route handler unit tests (mock `streamText`, context fetch, and D1 writes).
- **Integration** (staged): Workers pool tests that spin Hono app + D1 (remote dev DB) to assert streaming shape and resumable behavior.
- **Smoke**: manual run with attachments; verify sources show beneath final assistant message.
- **Deployment**: ship `/api/chat` behind a query flag or per‑user feature flag; monitor Gateway metrics.

**Documentation**

- AI Gateway analytics: [https://developers.cloudflare.com/ai-gateway/](https://developers.cloudflare.com/ai-gateway/)
- AI SDK streaming APIs: [https://ai-sdk.dev/docs/reference/core/streaming](https://ai-sdk.dev/docs/reference/core/streaming)

---

## Phase 2 — BYOK + Preferences (preview)

- Settings UI for BYOK (Google/OpenAI/OpenRouter), stored encrypted in D1
- Model picker (session‑scoped; defaults from preferences)
- Route requests with user’s BYOK via Gateway policy when possible; otherwise fallback to managed keys

**Documentation**

- BYOK: [https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)
- Elements (settings artifacts, suggestions): [https://ai-sdk.dev/elements/components/actions](https://ai-sdk.dev/elements/components/actions)

---

## Phase 3 — Tools (Flashcards & Guides) + Unified Attachments (preview)

- `/api/tools/flashcards`, `/api/tools/study-guide` using `streamObject()` and Zod schemas
- `<Task>` progress and `<Artifact>` rendering in UI
- Edge caching ON for tools (deterministic prompts) with longer TTL

**Documentation**

- streamObject: [https://ai-sdk.dev/docs/reference/core/streaming](https://ai-sdk.dev/docs/reference/core/streaming)
- Task/Artifact: [https://ai-sdk.dev/elements/components/task](https://ai-sdk.dev/elements/components/task), [https://ai-sdk.dev/elements/components/artifact](https://ai-sdk.dev/elements/components/artifact)

---

## Phase 4 — Transparency, Guardrails & Caching (preview)

- `<Sources>` everywhere; enable Gateway Guardrails (prompt+response)
- Full‑chat cache keys include context hash (doc IDs + chunk hashes + params)
- Rate limit tiers via Gateway for future plans

**Documentation**

- Guardrails: [https://developers.cloudflare.com/ai-gateway/features/guardrails/](https://developers.cloudflare.com/ai-gateway/features/guardrails/)
- Caching: [https://developers.cloudflare.com/ai-gateway/features/caching/](https://developers.cloudflare.com/ai-gateway/features/caching/)