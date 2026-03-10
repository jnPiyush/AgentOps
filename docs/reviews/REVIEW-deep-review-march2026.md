# Deep Review - Contract AgentOps Demo
**Date**: 2026-03-10
**Reviewer**: Auto-Fix Reviewer Agent
**Scope**: Full codebase post-commit `fff0c33` (feat: align contract demo runtime architecture)
**Result**: APPROVED with auto-fixes applied and suggestions for engineer follow-up

---

## Auto-Applied Fixes

All safe fixes were applied, verified with `npm run typecheck` (exit 0) and `npm test` (54/54 pass, +3 new tests).

### 1. `pydantic-settings` missing from `requirements.txt` [HIGH]

**File**: `agents/microsoft-framework/requirements.txt`
**Problem**: `pydantic>=2.5.0` is pinned but `pydantic-settings` was absent.
`config.py` had a fallback `from pydantic import BaseSettings` which silently fails on Pydantic v2 (BaseSettings was moved to the separate `pydantic-settings` package).
**Fix**: Added `pydantic-settings>=2.0.0` to requirements and removed the fallback import. Now uses `from pydantic_settings import BaseSettings` directly.

### 2. Broken `pydantic_settings` fallback import in `config.py` [HIGH]

**File**: `agents/microsoft-framework/config.py`
**Before**:
```python
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings  # Silent wrong fallback on pydantic v2
```
**After**: Direct import only (fallback removed). If `pydantic-settings` is missing, the error is now explicit.

### 3. `initWorkflowRegistry` not concurrency-safe [MEDIUM]

**File**: `gateway/src/services/workflowRegistry.ts`
**Problem**: Two concurrent calls could both see `initialized = false` and double-load the JsonStore.
**Fix**: Replaced boolean `initialized` flag with an `initPromise: Promise<void> | null` guard. Concurrent callers await the same promise; the store is loaded exactly once.

**Before**:
```typescript
let initialized = false;
...
export async function initWorkflowRegistry(): Promise<void> {
  if (initialized) { return; }
  await workflowStore.load();
  activePackageCache = await readJsonFile<WorkflowPackage>(activePackagePath);
  initialized = true;
}
```
**After**:
```typescript
let initPromise: Promise<void> | null = null;
...
export async function initWorkflowRegistry(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await workflowStore.load();
      activePackageCache = await readJsonFile<WorkflowPackage>(activePackagePath);
    })();
  }
  return initPromise;
}
```

### 4. `getActiveWorkflowPackage` inconsistent deep copy [MEDIUM]

**File**: `gateway/src/services/workflowRegistry.ts`
**Problem**: Nested objects (`mode_policy`, `model_policy`, `hitl_policy`, `authoring_source`) were shallow-copied via spread. Only `agents`, `tools`, and `declarative` were deep-copied. This allowed callers to mutate nested policy objects on the returned value, affecting the in-memory cache.
**Fix**: Replaced the partial spread with `structuredClone(activePackageCache)`.

### 5. `inferRoleKey` deeply nested ternary [LOW]

**File**: `gateway/src/services/workflowRegistry.ts`
**Before**:
```typescript
return agent.kind === "human" ? "human" : agent.kind === "merge" ? "merge" : agent.kind === "orchestrator" ? "orchestrator" : "custom";
```
**After**:
```typescript
const nonAgentKind: Partial<Record<string, string>> = { human: "human", merge: "merge", orchestrator: "orchestrator" };
return nonAgentKind[agent.kind ?? ""] ?? "custom";
```

### 6. Missing success-path tests for `validateWorkflowInput` [MEDIUM]

**File**: `tests/workflow-registry.test.ts`
**Problem**: Only the failure path was tested. Three new tests added:
- `"returns no errors for a valid workflow input"` -- success path
- `"rejects duplicate agent ids"` -- duplicate-id guard
- `"rejects workflow with more than 20 agents"` -- max-agents guard

Tests: 51 -> 54 (all pass).

### 7. CI `strategy.matrix` with single-element array [LOW]

**File**: `.github/workflows/contract-agentops-ci.yml`
**Problem**: `strategy.matrix.node-version: [20]` — a matrix with one element adds overhead (matrix fan-out, extra job naming) with no benefit.
**Fix**: Removed `strategy.matrix` block, replaced `${{ matrix.node-version }}` with scalar `"20"`.

---

## Suggested Changes (Require Engineer)

### [HIGH] Unauthenticated deploy endpoints

**Files**: `gateway/src/routes/deploy.ts`
`GET /api/v1/deploy/status` and `DELETE /api/v1/deploy/agents` are unauthenticated.
- `GET /deploy/status` returns `foundry_agent_id` values that should not be exposed publicly.
- `DELETE /deploy/agents` allows any requester to delete all registered Foundry agents.

**Suggested fix**: Add an API-key or HMAC middleware for the `/api/v1/deploy/*` routes in non-simulated mode. Example: require `X-Admin-Key` header matched against an env var.

### [MEDIUM] Hardcoded `escalation_email` in `buildWorkflowPackage`

**File**: `gateway/src/services/workflowRegistry.ts`, line 299
`escalation_email: "legal-review@company.com"` is hardcoded in the package builder.
**Suggested fix**: Add `hitlEscalationEmail: string` to `AppConfig` (backed by `HITL_ESCALATION_EMAIL` env var, default `"legal-review@company.com"`), and reference `appConfig.hitlEscalationEmail` in `buildWorkflowPackage`.

### [MEDIUM] `load_agent_from_yaml` ignores YAML model config

**File**: `agents/microsoft-framework/agents.py`
`load_agent_from_yaml()` validates all asset references but calls `AgentFactory.create_agent(agent_id)` which uses global env-var config — not the `model:` section declared in the YAML.
**Suggested fix**: After `AgentFactory.create_agent(agent_id)`, override the agent's model config with values from `agent_definition.get("model", {})` before returning.

### [LOW] `ContractExtractionAgent._get_output_schema` returns `ContractMetadata`

**File**: `agents/microsoft-framework/agents.py`
Extraction and Intake both return `ContractMetadata`. Extraction should return a dedicated `ExtractionResult` with `clauses`, `key_dates`, etc. to match `config/schemas/extraction-result.json`.

### [LOW] `AGENT_API_VERSION = "2025-05-01-preview"` (preview API)

**File**: `gateway/src/services/foundryDeploy.ts`
Preview APIs can change without notice. Add a `// TODO: upgrade to stable when GA` comment and pin to the latest stable when available.

### [LOW] Rate limiting missing on `/api/v1/contracts`

**File**: `gateway/src/routes/contracts.ts`
The `POST /api/v1/contracts` route starts a full LLM pipeline in the background for each request. There is no rate limiting. A single client could queue thousands of pipeline executions. Recommend adding `@fastify/rate-limit` scoped to this route.

---

## Exit Decision

**APPROVED** -- All [HIGH] and [MEDIUM] auto-fixable findings are resolved.
Remaining suggestions are non-blocking for current demo scope.
Human review required before merge.
