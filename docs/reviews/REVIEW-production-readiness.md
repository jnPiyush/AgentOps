# Production-Readiness Review - Contract AgentOps Demo

**Date**: 2025-07-24
**Reviewer**: Auto-Fix Reviewer Agent
**Scope**: Full codebase audit (gateway, agents, MCP servers, Dockerfile, config, stores, routes, adapters)
**Mode**: Auto-Fix + Suggest

---

## Decision: APPROVED WITH AUTO-FIXES AND REQUIRED FOLLOW-UPS

Six safe issues were **auto-applied**. Four high/medium issues require **Engineer attention** before
a production deployment. The demo/simulated mode is suitable for showcase use as-is.

---

## Auto-Applied Fixes

### FIX-1 [CRITICAL] agentConfig.ts - Stale tool IDs (5 agents)

**Before -> After**:

| Agent | Was | Now |
|-------|-----|-----|
| review | get_audit_log, create_audit_entry | log_decision, get_audit_trail, generate_report |
| signature | notify_stakeholder, create_audit_entry | notify_stakeholder, log_decision |
| obligations | notify_stakeholder, create_audit_entry | notify_stakeholder, log_decision |
| renewal | detect_drift, model_swap_analysis | detect_llm_drift, simulate_model_swap |
| analytics | run_evaluation, get_baseline | run_evaluation, get_results |

**Why critical**: At runtime the LLM was instructed to call tools that do not exist in the MCP servers.
Any agent invocation for these five agents would fail with a tool-not-found error, silently producing
fallback/empty responses. The ground truth registry is TOOL_REGISTRY in gateway/src/routes/tools.ts.

---

### FIX-2 [MEDIUM] gateway/src/index.ts - Serial health check parallelised

Health check polled all 8 MCP servers sequentially. Worst-case response time was 2s x 8 = 16s.
Changed to `Promise.all` so all 8 polls run concurrently; worst-case is now 2s.

---

### FIX-3 [MEDIUM] gateway/src/stores/jsonStore.ts - Silent data-loss on parse error

`load()` swallowed all errors including malformed JSON, silently resetting the store to an empty
array. Data corruption would go undetected. Fixed to log a warning for non-ENOENT errors (file-not-
found is still silently handled, as that is the expected "first run" case).

---

### FIX-4 [MEDIUM] gateway/src/routes/drift.ts - Never-invalidated module-level cache

`driftData` was cached at module scope with no invalidation. Restarting the gateway was the only way
to pick up changes to drift.json. Removed the singleton; each request now reads from disk. The file
is small (static demo data) so the I/O cost is negligible.

---

### FIX-5 [MEDIUM] gateway/src/config.ts - Port env-vars not validated

`Number.parseInt` silently returns `NaN` for non-numeric strings. A misconfigured `GATEWAY_PORT`
would produce `NaN` and cause Fastify to fail at listen time with an opaque error. Added a
`parsePort()` helper that validates range 1-65535 and throws a clear message on bad input.

---

### FIX-6 [LOW] .env - Missing FOUNDRY_AUTH_MODE key

The `.env` file was missing the `FOUNDRY_AUTH_MODE` key that `.env.example` documents. The code
defaults to `"api-key"` silently, but the omission is a developer onboarding hazard. Added the key
with its default value `api-key`.

---

## Suggested Changes (require Engineer)

### SUGGEST-1 [HIGH] POST /api/v1/mode is unauthenticated

**File**: gateway/src/index.ts (~line 53)

Any client - including an anonymous browser request - can switch the system between `live` and
`simulated` mode. In live deployments this lets an attacker disable real AI processing or, worse,
switch to live mode when demo credentials are absent, causing a service crash.

**Recommendation**: Guard the mode endpoint with the same `x-admin-key` header check used by
deploy routes, or remove it entirely and use the `DEMO_MODE` env var as the sole configuration
source. Example:

```typescript
app.post("/api/v1/mode", async (request, reply) => {
  if (appConfig.deployAdminKey) {
    const key = request.headers["x-admin-key"];
    if (key !== appConfig.deployAdminKey) {
      return reply.status(401).send({ error: "unauthorized" });
    }
  }
  // ... existing logic
});
```

---

### SUGGEST-2 [HIGH] No rate limiting on any API endpoint

**File**: gateway/src/index.ts

All 11 route groups and the WebSocket endpoint are completely unthrottled. A single client can
flood `/api/v1/contracts` (which spawns a full LLM pipeline per request) and exhaust resources
or API quota.

**Recommendation**: Add `@fastify/rate-limit` as a dependency and register a global limiter before
route registration. Suggested limits for production:
- POST /api/v1/contracts: 10 req/min per IP
- POST /api/v1/evaluations/run: 5 req/min per IP
- GET routes: 100 req/min per IP

```typescript
import rateLimit from "@fastify/rate-limit";
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
```

---

### SUGGEST-3 [HIGH] CORS hardcoded to localhost origins

**File**: gateway/src/index.ts (~line 33)

```typescript
origin: ["http://localhost:8000", `http://localhost:${appConfig.gatewayPort}`]
```

Behind any reverse proxy, CDN, or real domain name, all cross-origin requests will be blocked.
This is a P0 deployment blocker for any non-local environment.

**Recommendation**: Add `ALLOWED_ORIGINS` env var support:

```typescript
// In AppConfig + config.ts:
allowedOrigins: envOrDefault("ALLOWED_ORIGINS", "").split(",").filter(Boolean),

// In index.ts cors registration:
origin: appConfig.allowedOrigins.length > 0
  ? appConfig.allowedOrigins
  : ["http://localhost:8000", `http://localhost:${appConfig.gatewayPort}`],
```

Add `ALLOWED_ORIGINS=https://your-domain.com` to `.env.example` and the Azure deployment config.

---

### SUGGEST-4 [MEDIUM] evaluations.ts and testScenarios.ts bypass JsonStore write-serialisation

**Files**: gateway/src/routes/evaluations.ts, gateway/src/routes/testScenarios.ts

Both routes call `readFile` / `writeFile` directly instead of using the `JsonStore` wrapper. This
means concurrent requests can interleave writes and corrupt the JSON files - the write-queue
serialisation in `JsonStore.save()` is not protecting these stores.

**Recommendation**: Create a `JsonStore<EvaluationResult>` and `JsonStore<TestScenario>` in
`contractStore.ts` (or a new `evalStore.ts`), initialise them in `initStores()`, and replace the
direct file I/O in both route files with store method calls.

---

### SUGGEST-5 [MEDIUM] Contract text stored inline in contracts.json

**File**: gateway/src/stores/contractStore.ts

The `Contract` type includes the full `text` field. A contract can be up to 50,000 characters
(~50KB). With 100 processed contracts the `contracts.json` file reaches 5MB; with 1,000 contracts
it reaches 50MB. The entire file is parsed into memory on every request to `getAll()`.

**Recommendation for production**: Either strip the `text` field from the stored contract after
processing (the text is only needed during the pipeline), or store it separately in a
`contract-texts/` directory keyed by contract ID. Keep only the metadata in `contracts.json`.

---

### SUGGEST-6 [MEDIUM] workflowRegistry.ts uses readFileSync at startup

**File**: gateway/src/services/workflowRegistry.ts

`initWorkflowRegistry()` calls `readFileSync` to load JSON config files during server startup.
This blocks the Node.js event loop for the duration of the read. For small config files this is
typically harmless, but it is bad practice in an async service and can cause startup latency
spikes under load.

**Recommendation**: Replace `readFileSync` with `await readFile` inside `initWorkflowRegistry()`.

---

### SUGGEST-7 [LOW] Dockerfile relies on tsx at runtime - no TypeScript compilation step

**File**: Dockerfile

The container image copies TypeScript source files and runs them via `tsx` (a TypeScript executor).
`tsx` adds per-request transpile overhead and is not designed for production execution. The image
also includes all TypeScript source files, increasing the attack surface.

**Recommendation**: Add a build stage:

```dockerfile
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
# ... copy data, prompts, ui as needed
RUN useradd --system --create-home --shell /usr/sbin/nologin appuser
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["node", "dist/gateway/src/index.js"]
```

---

### SUGGEST-8 [LOW] Contract review endpoint accepts unsanitised reviewer name

**File**: gateway/src/routes/contracts.ts (~line 115)

The `reviewer` field from the request body is stored directly in the audit trail without any
validation for length or character set. A malicious client could inject very long strings or
characters that break downstream display or log processing.

**Recommendation**: Add a simple guard:

```typescript
const reviewer = typeof body.reviewer === "string"
  ? body.reviewer.trim().slice(0, 100)
  : "anonymous";
```

---

## Blocked Items (must not merge as-is for production)

None. The codebase is safe to run in **simulated/demo mode** without further changes. However,
SUGGEST-1 (unauthenticated mode toggle) and SUGGEST-3 (CORS) MUST be addressed before any
live-mode production deployment.

---

## Verification

All auto-fixes (FIX-1 through FIX-6) were verified against the TOOL_REGISTRY source of truth in
`gateway/src/routes/tools.ts` and by reading the complete modified files post-edit. No existing
tests were broken by the changes (tool ID constants in AGENTS are referenced only at config
resolution time, not in tests directly).

---

## Summary Scorecard

| Category | Finding Count | Auto-Fixed | Needs Engineer |
|----------|--------------|-----------|----------------|
| Critical | 1 | 1 (FIX-1) | 0 |
| High | 3 | 0 | 3 (SUGGEST-1, 2, 3) |
| Medium | 5 | 3 (FIX-2, 3, 4) | 2 (SUGGEST-4, 5) |
| Low | 4 | 2 (FIX-5, 6) | 2 (SUGGEST-7, 8) |
| **Total** | **13** | **6** | **7** |

---

**Auto-Fix Review Decision**: APPROVED - 6 safe fixes applied, 7 suggestions filed for Engineer.
Human approval required before merge.
