# Deploy Tab -- Complete Technical Documentation

**Contract AgentOps | Deploy Dashboard**
**Last Updated:** 2026-03-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Files Involved](#3-files-involved)
4. [UI Layer](#4-ui-layer)
5. [Gateway API Layer](#5-gateway-api-layer)
6. [Deploy Script Engine](#6-deploy-script-engine)
7. [The 6-Stage Pipeline (Backend)](#7-the-6-stage-pipeline-backend)
8. [UI-to-Backend Stage Mapping](#8-ui-to-backend-stage-mapping)
9. [Agent Configuration & Prompts](#9-agent-configuration--prompts)
10. [Dual-Mode Architecture](#10-dual-mode-architecture)
11. [Authentication & Security](#11-authentication--security)
12. [Environment Variables](#12-environment-variables)
13. [Response Schemas](#13-response-schemas)
14. [Azure Integration](#14-azure-integration)
15. [Verification & Testing](#15-verification--testing)
16. [CLI Usage](#16-cli-usage)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Overview

The Deploy Tab is the third view in the Contract AgentOps dashboard. It lets users deploy
all contract-processing agents to **Azure AI Foundry** as registered Assistants with a
single button click. The system supports two operating modes:

- **Simulated mode** -- No Azure credentials required. Returns mock results that mirror
  the real pipeline structure. Used for demos and local development.
- **Live mode** -- Connects to Azure AI Foundry. Runs a 6-stage deployment pipeline that
  registers real AI Assistants with tools, prompts, and content safety checks.

Both modes use the same UI, the same API endpoints, and the same JSON response format.
The only difference is whether real Azure API calls are made.

---

## 2. Architecture

```
User clicks "Deploy Pipeline"
          |
          v
+-------------------+
|   UI (index.html  |        Simulated Mode         Live Mode
|   + app.js/api.js)|        (mock timings)          (real Foundry calls)
+--------+----------+              |                      |
         |                         |                      |
    HTTP POST                      v                      v
    /api/v1/deploy/pipeline   +----+----------------------+----+
         |                    |   gateway/python/routes/deploy.py  |
         |                    +----+----------------------+----+
         |                         |                      |
         |                    subprocess.run           subprocess.run
         |                         |                      |
         |                         v                      v
         |                 scripts/deploy/foundry_deploy.py
         |                   --simulate            (live: 6-stage pipeline)
         |                         |                      |
         |                    Mock JSON             Azure AI Foundry APIs
         |                         |                      |
         v                         v                      v
    UI animates stages      JSON result returned to gateway
    + populates agent        -> forwarded to UI as HTTP 201
      registry table
```

---

## 3. Files Involved

### Frontend (UI)

| File | Purpose |
|------|---------|
| `ui/index.html` (lines 155-218) | Deploy tab HTML markup: 4 pipeline stage cards, agent registry table, security grid, summary bar |
| `ui/app.js` | `syncDeployTab()` -- populates agent registry from active workflow; `runDeployPipeline()` -- simulated mode animation |
| `ui/api.js` | `runDeployPipelineReal()` -- real mode: calls gateway API, maps backend stages to UI stages, renders results |

### Gateway (API)

| File | Purpose |
|------|---------|
| `gateway/python/routes/deploy.py` | 4 REST endpoints for deploy operations |
| `gateway/python/config.py` | Environment variables: DEMO_MODE, DEPLOY_ADMIN_KEY, FOUNDRY_* |

### Backend (Deploy Engine)

| File | Purpose |
|------|---------|
| `scripts/deploy/foundry_deploy.py` (~900 lines) | Full 6-stage deployment pipeline, simulated deploy, cleanup, CLI |

### Configuration

| File | Purpose |
|------|---------|
| `config/agents/*.yaml` (11 files) | Agent definitions: name, model, prompts, tool bindings |
| `prompts/*.md` (11 files) | System prompt instructions for each agent |
| `templates/*.json` | Output templates referenced by agent configs |
| `examples/*.json` | Few-shot examples referenced by agent configs |

### Infrastructure & CI/CD

| File | Purpose |
|------|---------|
| `azure.yaml` (postdeploy hook) | Triggers `POST /api/v1/deploy/pipeline` after `azd deploy` |
| `Dockerfile` | Copies prompts/, config/, ui/ into container image |
| `scripts/deploy/verify-deployment.ps1` | Post-deployment health validation script |

### Tests

| File | Purpose |
|------|---------|
| `tests/deploy-routes.test.ts` | Auth, admin key, mode configuration tests |

---

## 4. UI Layer

### 4.1 HTML Structure (`ui/index.html`)

The Deploy Dashboard (View 3) contains four sections:

#### A. Pipeline Stages (4 visual cards)

```
Build  -->  Test  -->  Deploy  -->  Register
```

Each stage card has:
- **Element ID**: `stage-build`, `stage-test`, `stage-deploy`, `stage-register`
- **Name label**: Build / Test / Deploy / Register
- **Status badge**: Initially "Pending" (badge-info), changes to "[PASS]" (badge-pass) or "[FAIL]" (badge-fail)
- **Duration**: Initially "--", updates to elapsed time (e.g. "12s" or "2400ms")

#### B. Agent Registry Table

| Column | Description |
|--------|-------------|
| Agent | Display name (e.g. "Contract Intake Agent") |
| Entra Agent ID | Foundry assistant ID (e.g. `agent_sim_a1b2c3d4e5f6`) or generated local ID |
| Status | "Ready", "Registered", or "failed" |
| Scope | Contract stage the agent belongs to |

#### C. Security Grid (static display)

Two cards showing pre-checked security items:

**Identity & Access:** Entra ID assigned, RBAC configured, Conditional access applied

**Content Safety:** Content filters ON, XPIA protection ON, PII redaction ON

#### D. Summary Bar

Single line at the bottom: `"10 agents deployed | 27 tools registered | 0 errors"`

### 4.2 Simulated Mode Flow (`ui/app.js` -- `runDeployPipeline()`)

When `dashboardMode !== "real"`, the UI runs a purely client-side animation:

1. Button changes to "Deploying..."
2. Gets agent list from active workflow (or falls back to 4 default agents)
3. Animates each stage card at 700ms intervals:
   - Adds `completed` CSS class
   - Sets status to `[PASS]`
   - Sets hardcoded times: Build=12s, Test=8s, Deploy=15s, Register=3s
4. After all stages complete:
   - Populates agent registry rows with 200ms staggered animation
   - Updates summary with agent count and tool count
   - Button text changes to "Deployed"

### 4.3 Real Mode Flow (`ui/api.js` -- `runDeployPipelineReal()`)

When `dashboardMode === "real"`:

1. Button changes to "Deploying..."
2. Calls `apiCall("POST", "/api/v1/deploy/pipeline", null, { "x-admin-key": DEPLOY_ADMIN_KEY }, 600000)`
   - 600-second timeout (10 minutes) because live deploy can take a while
3. On success, maps backend stage names to UI element IDs:

   | UI Element | Backend Stage |
   |------------|---------------|
   | `stage-build` | "Preflight" |
   | `stage-test` | "Model Deployment" |
   | `stage-deploy` | "Agent Registration" |
   | `stage-register` | "Health Check" or "Content Safety" or "Evaluation" |

4. Animates each stage at 400ms intervals using real `status` and `duration_ms` from response
5. If a stage failed, sets `[FAIL]` badge and adds error tooltip (`title` attribute)
6. Populates agent registry from `data.agents[]` with real Foundry agent IDs
7. Updates summary with `agents_deployed`, `tools_registered`, and any failed stage names
8. On error, shows "Deploy Failed" with error message in summary bar

### 4.4 Sync from Workflow Designer (`ui/app.js` -- `syncDeployTab()`)

When a user activates a workflow in the Design tab, the Deploy tab auto-syncs:

1. Gets the active workflow via `getActiveWorkflow()`
2. Maps agents to contract stages via `getWorkflowStagesForTesting()`
3. Updates summary: `"N contract stages mapped | N execution agents ready | N tools registered"`
4. Populates the agent registry table showing each agent's name, ID, status "Ready", and
   which contract stages it belongs to

---

## 5. Gateway API Layer

**File:** `gateway/python/routes/deploy.py`

All endpoints are prefixed with `/api/v1`.

### 5.1 POST /api/v1/deploy/pipeline

**Purpose:** Trigger the full deployment pipeline.

**Auth:** Requires `x-admin-key` header in live mode.

**Behavior:**
- Simulated mode: runs `python foundry_deploy.py --json --simulate`
- Live mode: runs `python foundry_deploy.py --json` with Foundry env vars injected

**Response:** `201 Created` with pipeline result JSON (see Section 13).

**Implementation:**

```python
def _run_python_deploy(simulate: bool) -> dict:
    args = ["python", str(DEPLOY_SCRIPT), "--json"]
    if simulate:
        args.append("--simulate")
    # In live mode, injects FOUNDRY_ENDPOINT, FOUNDRY_API_KEY,
    # FOUNDRY_PROJECT_ENDPOINT, FOUNDRY_MODEL into subprocess env
    proc = subprocess.run(args, capture_output=True, text=True, timeout=600)
    return json.loads(proc.stdout)
```

### 5.2 GET /api/v1/deploy/status

**Purpose:** Return the result of the last deployment.

**Auth:** Requires `x-admin-key` in live mode.

**Response:** `200 OK` with last pipeline result, or `404` if no deployment has run.

### 5.3 DELETE /api/v1/deploy/agents

**Purpose:** Clean up previously registered agents from Foundry.

**Auth:** Requires `x-admin-key` in live mode.

**Behavior:**
- Live mode: runs `python foundry_deploy.py --cleanup <id1> <id2> ... --json`
- Simulated mode: clears the in-memory deployment state

**Response:** `200 OK` with `{ deleted: N, errors: [], message: "..." }`

### 5.4 GET /api/v1/deploy/mode

**Purpose:** Check current deployment configuration.

**No auth required.**

**Response:**
```json
{
  "mode": "simulated",
  "foundry_auth_mode": "api-key",
  "foundry_configured": false
}
```

### 5.5 Admin Auth Logic (`_ensure_admin`)

```
If DEMO_MODE is not "live":
    -> skip auth (all requests pass)
If DEMO_MODE is "live":
    If DEPLOY_ADMIN_KEY is not set:
        -> 503 "deploy_admin_not_configured"
    If request header "x-admin-key" does not match:
        -> 401 "unauthorized"
    Else:
        -> pass
```

---

## 6. Deploy Script Engine

**File:** `scripts/deploy/foundry_deploy.py`

This is a standalone Python script (~900 lines) that implements the complete deployment
pipeline. It can be run via CLI or spawned as a subprocess by the gateway.

### 6.1 Data Classes

```
DeployConfig
  - endpoint: str          (Azure AI Foundry endpoint URL)
  - project_endpoint: str  (Foundry project endpoint, defaults to endpoint)
  - api_key: str           (API key for authentication)
  - model: str             (LLM model name, e.g. "gpt-5.4")
  - agent_endpoint: str    (property: returns project_endpoint or endpoint)

AgentDef
  - key: str               (e.g. "intake", "compliance")
  - name: str              (e.g. "Contract Intake Agent")
  - prompt_file: str       (e.g. "intake-system.md")
  - tools: list[str]       (e.g. ["upload_contract", "classify_document"])
  - eval_prompt: str       (test prompt for stage 5 evaluation)

StageResult
  - name: str              (stage display name)
  - status: str            ("passed" | "failed" | "skipped")
  - duration_ms: int       (wall-clock time in milliseconds)
  - details: dict          (stage-specific metadata)
  - error: str | None      (error message if failed)

AgentInfo
  - agent_name: str        (display name)
  - foundry_agent_id: str  (Foundry assistant ID)
  - model: str             (model used)
  - status: str            ("registered" | "failed")
  - tools_count: int       (number of tools bound)
```

### 6.2 Agent Definition Loading

The script loads agent definitions from `config/agents/*.yaml`:

```
config/agents/
  analytics-agent.yaml
  approval-agent.yaml
  compliance-agent.yaml
  drafting-agent.yaml
  extraction-agent.yaml
  intake-agent.yaml
  negotiation-agent.yaml
  obligations-agent.yaml
  renewal-agent.yaml
  review-agent.yaml
  signature-agent.yaml
```

Each YAML file contains:

```yaml
agent_id: intake
name: Contract Intake Agent
version: 1.0.0
model:
  provider: microsoft_foundry
  name: gpt-5.4
  temperature: 0.0
prompts:
  system_prompt: prompts/intake-system.md
  output_template: templates/intake-result.json
  few_shot_examples: examples/intake-examples.json
tools:
  - name: upload_contract
    mcp_server: contract-intake-mcp
  - name: classify_document
    mcp_server: contract-intake-mcp
  - name: extract_metadata
    mcp_server: contract-intake-mcp
```

The loader extracts:
- `agent_id` -> key
- `name` -> display name
- `prompts.system_prompt` -> filename to load from `prompts/`
- `tools[].name` -> list of tool names to bind

### 6.3 Prompt Loading

System prompts are loaded from `prompts/` directory:

```
prompts/
  analytics-system.md      intake-system.md
  approval-system.md       negotiation-system.md
  compliance-system.md     obligations-system.md
  drafting-system.md       renewal-system.md
  extraction-system.md     review-system.md
  signature-system.md
```

Each file contains the full system prompt that instructs the Foundry agent on its role,
input/output format, and behavioral constraints.

---

## 7. The 6-Stage Pipeline (Backend)

The live deployment runs 6 stages sequentially. Each stage returns a `StageResult`. If
Stage 1 or 2 fails, the pipeline short-circuits (Stages 3-6 are skipped).

### Stage 1: Preflight (`stage_preflight`)

**What it does:** Verifies API connectivity by listing available models.

**API Call:** `GET /openai/models?api-version=2024-10-21`

**Pass condition:** HTTP 200 response.

**Result details:**
```json
{ "endpoint_reachable": true, "models_found": 5 }
```

**Failure causes:** Invalid endpoint, expired API key, network error, wrong API version.

**Short-circuits on fail:** Yes -- if Preflight fails, the entire pipeline stops.

---

### Stage 2: Model Deployment (`stage_verify_model`)

**What it does:** Sends a minimal chat completion to confirm the configured model exists
and is responding.

**API Call:** `POST /openai/deployments/{model}/chat/completions?api-version=2024-10-21`
with `{"messages": [{"role":"user","content":"ping"}], "max_tokens": 1}`

**Pass condition:** HTTP 200 response.

**Result details:**
```json
{ "deployment_name": "gpt-5.4", "model": "gpt-5.4", "status": "succeeded" }
```

**Failure causes:** Model not deployed, wrong model name, API permissions issue.

**Short-circuits on fail:** Yes -- if model verification fails, remaining stages are skipped.

---

### Stage 3: Agent Registration (`stage_register_agents`)

**What it does:** Registers each agent definition as an Assistant on Azure AI Foundry.

**Process:**
1. Lists existing assistants filtered by `metadata.domain == "contract-management"`
2. For each agent definition:
   - If an assistant with the same name already exists: **REUSE** it (idempotent)
   - Otherwise: **CREATE** a new assistant with:
     - `model`: from config
     - `name`: agent display name
     - `instructions`: loaded from `prompts/*.md`
     - `tools`: built from tool definitions
     - `temperature`: 0.1
     - `metadata`: domain, pipeline_role, mcp_tools, version

**Important:** The `metadata.pipeline_role` field (e.g., `intake`, `extraction`, `compliance`) is critical -- it is used by the live pipeline's `_ensure_foundry_agents()` to map each pipeline stage to its deployed Foundry assistant ID. Without this metadata, the Live tab cannot route contract data to the correct agent.

**API Calls:**
- `GET /assistants?api-version=2025-05-15-preview&limit=100` (list existing)
- `POST /assistants?api-version=2025-05-15-preview` (create new)

**Result details:**
```json
{
  "registered": 11,
  "total": 11,
  "reused": 8,
  "created": 3,
  "tool_definitions_registered": 27
}
```

**Does NOT short-circuit:** Pipeline continues even if some agents fail (partial success
is accepted).

---

### Stage 4: Content Safety (`stage_content_safety`)

**What it does:** Verifies that Azure AI content safety filters are active on the model
deployment.

**API Call:** `POST /openai/deployments/{model}/chat/completions` with a test message
checking for content filter activation.

**Pass condition:** Either content filter results are present in the response, or the
request is blocked by a content filter (HTTP 400 with "content_filter").

**Result details:**
```json
{ "filters_active": true, "triggered_on_test": false }
```

---

### Stage 5: Evaluation (`stage_evaluation`)

**What it does:** Runs a quick functional test for each registered agent. Creates a thread,
posts a representative prompt, runs the assistant, and polls for completion.

**Process per agent:**
1. `POST /threads` -- Create a new conversation thread
2. `POST /threads/{tid}/messages` -- Send the agent's evaluation prompt
3. `POST /threads/{tid}/runs` -- Execute the agent
4. Poll `GET /threads/{tid}/runs/{rid}` every 2 seconds (max 30s)
5. Check final status is "completed"
6. `DELETE /threads/{tid}` -- Clean up

**Eval prompts** are pre-defined for each agent role. Example for "intake":
```
Classify this agreement: "This Non-Disclosure Agreement is entered into between
Acme Corp and Beta Inc, effective January 1, 2025, for two years."
```

**Result details:**
```json
{ "test_count": 11, "passed": 10, "accuracy": 91, "agents_tested": 11 }
```

---

### Stage 6: Health Check (`stage_health_check`)

**What it does:** Confirms each registered agent is retrievable via the Assistants API.

**API Call per agent:** `GET /assistants/{agent_id}?api-version=2025-05-15-preview`

**Pass condition:** All registered agents return HTTP 200.

**Result details:**
```json
{ "healthy": 11, "total": 11 }
```

---

## 8. UI-to-Backend Stage Mapping

The backend runs 6 stages but the UI displays only 4 cards. The mapping is:

```
+--------+--------------------+-------------------------------------------+
|  UI    |  UI Label          |  Backend Stage(s) Mapped                  |
+--------+--------------------+-------------------------------------------+
| Card 1 |  Build             |  Stage 1: Preflight                       |
| Card 2 |  Test              |  Stage 2: Model Deployment                |
| Card 3 |  Deploy            |  Stage 3: Agent Registration              |
| Card 4 |  Register          |  Stage 6: Health Check                    |
|        |                    |  (fallback: Stage 4 or 5)                 |
+--------+--------------------+-------------------------------------------+
```

**Code in `api.js`:**

```javascript
const stageMapping = {
    "stage-build":    stageByName["Preflight"],
    "stage-test":     stageByName["Model Deployment"],
    "stage-deploy":   stageByName["Agent Registration"],
    "stage-register": stageByName["Health Check"]
                   || stageByName["Content Safety"]
                   || stageByName["Evaluation"],
};
```

**Why 4 vs 6?** The UI simplifies the pipeline into user-friendly categories:
- "Build" = verify infrastructure is accessible
- "Test" = verify the model works
- "Deploy" = register the agents
- "Register" = confirm everything is healthy

Stages 4 (Content Safety) and 5 (Evaluation) run in the backend but their results are
folded into the Register card or available in the full JSON response.

---

## 9. Agent Configuration & Prompts

### 11 Agents Deployed

| Agent | Key | System Prompt | Tools |
|-------|-----|---------------|-------|
| Contract Intake Agent | intake | intake-system.md | upload_contract, classify_document, extract_metadata |
| Extraction Agent | extraction | extraction-system.md | extract_clauses, identify_parties, extract_dates_values |
| Compliance Agent | compliance | compliance-system.md | check_policy, flag_risk, + 4 CRUD policy tools |
| Drafting Agent | drafting | drafting-system.md | (drafting tools) |
| Review Agent | review | review-system.md | (review tools) |
| Negotiation Agent | negotiation | negotiation-system.md | (negotiation tools) |
| Approval Agent | approval | approval-system.md | route_approval, escalate_to_human, notify_stakeholder |
| Signature Agent | signature | signature-system.md | (signature tracking tools) |
| Obligations Agent | obligations | obligations-system.md | (obligation tracking tools) |
| Renewal Agent | renewal | renewal-system.md | (renewal analysis tools) |
| Analytics Agent | analytics | analytics-system.md | (analytics tools) |

---

## 10. Dual-Mode Architecture

### Simulated Mode (default)

- **Trigger:** `DEMO_MODE=simulated` (or unset)
- **No Azure credentials needed**
- **Script command:** `python foundry_deploy.py --json --simulate`
- **Agent IDs:** Generated as `agent_sim_{random_hex}`
- **All stages pass with realistic mock timings:**

```json
{
  "stages": [
    { "name": "Preflight",           "status": "passed", "duration_ms": 320  },
    { "name": "Model Deployment",    "status": "passed", "duration_ms": 180  },
    { "name": "Agent Registration",  "status": "passed", "duration_ms": 2400 },
    { "name": "Content Safety",      "status": "passed", "duration_ms": 450  },
    { "name": "Evaluation",          "status": "passed", "duration_ms": 3200 },
    { "name": "Health Check",        "status": "passed", "duration_ms": 600  }
  ]
}
```

### Live Mode

- **Trigger:** `DEMO_MODE=live`
- **Requires:** `FOUNDRY_ENDPOINT`, `FOUNDRY_API_KEY`, `DEPLOY_ADMIN_KEY`
- **Script command:** `python foundry_deploy.py --json`
- **Real Azure AI Foundry API calls**
- **Agent IDs:** Real Foundry assistant IDs (e.g. `asst_abc123...`)
- **Stages can fail** -- pipeline short-circuits on Stage 1 or 2 failure

---

## 11. Authentication & Security

### Deploy Admin Key

- In live mode, all deploy endpoints require `x-admin-key` header
- The key is set via `DEPLOY_ADMIN_KEY` environment variable
- If the key is not configured in live mode, endpoints return 503
- In simulated mode, auth is bypassed entirely

### Foundry Authentication

Three authentication modes, in order of precedence:

| Mode | How | Use Case |
|------|-----|----------|
| **Bearer token** (recommended) | `FOUNDRY_BEARER_TOKEN` env var, or acquired automatically via `AzureCliCredential` / `DefaultAzureCredential` with scope `https://ai.azure.com/.default` | Development and production. Required for the Agent Service (Assistants API). |
| `api-key` | `FOUNDRY_API_KEY` env var, sent as `api-key` header | Works for OpenAI-compatible endpoints (models, chat completions) but **not** for the Agent Service. Using `api-key` for Assistants API calls returns 403 with empty object ID. |
| `managed-identity` | `FOUNDRY_MANAGED_IDENTITY_CLIENT_ID` | Production Azure deployments |

**Key detail:** The deploy script (`foundry_deploy.py`) uses Bearer token auth for all Agent Service calls (stages 3, 5, 6). The token scope must be `https://ai.azure.com/.default` -- using `https://cognitiveservices.azure.com/.default` causes 401 "audience is not valid" errors.

### Security Cards (UI)

The Deploy tab displays pre-validated security checks:
- Entra ID assigned, RBAC configured, Conditional access applied
- Content filters ON, XPIA protection ON, PII redaction ON

In live mode, Content Safety is verified dynamically by Stage 4.

---

## 12. Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DEMO_MODE` | `simulated` | No | `"simulated"` or `"live"` |
| `DEPLOY_ADMIN_KEY` | (empty) | Live mode | Shared secret for deploy endpoints |
| `FOUNDRY_ENDPOINT` | (empty) | Live mode | Azure AI Foundry OpenAI endpoint URL |
| `FOUNDRY_API_KEY` | (empty) | Live (fallback) | Foundry API key. Works for model endpoints but not Agent Service. |
| `FOUNDRY_PROJECT_ENDPOINT` | Same as endpoint | No | Foundry Agent Service endpoint (e.g., `https://<name>.services.ai.azure.com/api/projects/<project>`). Used for Assistants API calls. Falls back to `FOUNDRY_ENDPOINT` if not set. |
| `FOUNDRY_BEARER_TOKEN` | (empty) | Live (recommended) | Pre-fetched Azure AD Bearer token with scope `https://ai.azure.com/.default`. If set, used for all Agent Service calls instead of acquiring a token at runtime. `scripts/_start_gateway.py` sets this automatically. |
| `FOUNDRY_MODEL` | `gpt-5.4` | No | Model deployment name |
| `FOUNDRY_AUTH_MODE` | `api-key` | No | `"api-key"` or `"managed-identity"` (legacy -- Bearer token is now preferred) |
| `FOUNDRY_MANAGED_IDENTITY_CLIENT_ID` | (empty) | Managed identity | Client ID for MI auth |
| `GATEWAY_PORT` | `8000` | No | Port for the FastAPI gateway |

---

## 13. Response Schemas

### Pipeline Result (both modes)

```json
{
  "pipeline_id": "deploy-a1b2c3d4",
  "mode": "simulated",
  "stages": [
    {
      "name": "Preflight",
      "status": "passed",
      "duration_ms": 320,
      "details": { "endpoint_reachable": true, "models_found": 5 }
    },
    {
      "name": "Model Deployment",
      "status": "passed",
      "duration_ms": 180,
      "details": { "deployment_name": "gpt-5.4", "status": "succeeded" }
    },
    {
      "name": "Agent Registration",
      "status": "passed",
      "duration_ms": 2400,
      "details": { "registered": 11, "total": 11, "reused": 0, "created": 11 }
    },
    {
      "name": "Content Safety",
      "status": "passed",
      "duration_ms": 450,
      "details": { "filters_active": true }
    },
    {
      "name": "Evaluation",
      "status": "passed",
      "duration_ms": 3200,
      "details": { "test_count": 11, "passed": 11, "accuracy": 100 }
    },
    {
      "name": "Health Check",
      "status": "passed",
      "duration_ms": 600,
      "details": { "healthy": 11, "total": 11 }
    }
  ],
  "agents": [
    {
      "agent_name": "Contract Intake Agent",
      "foundry_agent_id": "agent_sim_a1b2c3d4e5f6",
      "model": "gpt-5.4",
      "status": "registered",
      "tools_count": 3
    }
  ],
  "summary": {
    "agents_deployed": 11,
    "tools_registered": 27,
    "errors": 0,
    "total_duration_ms": 7150
  }
}
```

### Cleanup Result

```json
{
  "deleted": 11,
  "errors": [],
  "message": "Cleaned up 11 agents from Foundry"
}
```

### Mode Check Result

```json
{
  "mode": "simulated",
  "foundry_auth_mode": "api-key",
  "foundry_configured": false
}
```

---

## 14. Azure Integration

### Postdeploy Hook (`azure.yaml`)

After `azd deploy` completes, Azure Developer CLI runs the postdeploy hook:

```bash
# Runs automatically after azd deploy
curl -X POST "${APP_URL}/api/v1/deploy/pipeline" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: ${DEPLOY_ADMIN_KEY}" \
  --retry 3 --retry-delay 10 --max-time 120
```

This ensures agents are registered on Foundry every time the app is deployed to Azure.

### Dockerfile

The Dockerfile copies all required files into the container:
- `prompts/` -- agent system prompts
- `config/` -- agent YAML definitions
- `ui/` -- static frontend files
- `scripts/deploy/` -- the deployment engine

The Dockerfile health check validates `/api/v1/health` to ensure the gateway is ready
before the postdeploy hook fires.

### Verification Script (`scripts/deploy/verify-deployment.ps1`)

PowerShell script for post-deployment validation:

1. Calls `GET /api/v1/health` -- confirms gateway is running
2. Checks that all MCP servers are online
3. Calls `GET /api/v1/deploy/mode` -- confirms configuration
4. Optionally triggers `POST /api/v1/deploy/pipeline`
5. Calls `GET /api/v1/deploy/status` -- confirms agents deployed
6. Calls `GET /api/v1/tools` -- confirms at least 8 tool registrations

---

## 15. Verification & Testing

### Test File (`tests/deploy-routes.test.ts`)

Tests cover:

| Test Case | Expected |
|-----------|----------|
| GET /deploy/status with no deployment | 404 |
| GET /deploy/status in live mode without admin key | 401 |
| GET /deploy/status in live mode with valid key, no deployment | 404 |
| POST /deploy/pipeline in live mode without admin key | 401 |
| GET /deploy/mode with managed-identity auth | 200, foundry_configured: true |

### Manual Testing

**Simulated mode (no setup required):**
```bash
# Start the gateway
python -m uvicorn gateway.python.main:app --port 8000

# Trigger simulated deploy
curl -X POST http://localhost:8000/api/v1/deploy/pipeline

# Check status
curl http://localhost:8000/api/v1/deploy/status

# Check mode
curl http://localhost:8000/api/v1/deploy/mode
```

**Live mode:**
```bash
export DEMO_MODE=live
export DEPLOY_ADMIN_KEY=my-secret-key
export FOUNDRY_ENDPOINT=https://my-foundry.openai.azure.com
export FOUNDRY_API_KEY=my-api-key

curl -X POST http://localhost:8000/api/v1/deploy/pipeline \
  -H "x-admin-key: my-secret-key"
```

---

## 16. CLI Usage

The deploy script can be run directly from the command line:

```bash
# Simulated deploy (no Azure credentials needed)
python scripts/deploy/foundry_deploy.py --simulate

# Simulated deploy with JSON output
python scripts/deploy/foundry_deploy.py --simulate --json

# Live deploy (requires env vars)
python scripts/deploy/foundry_deploy.py

# Live deploy with JSON output (used by gateway)
python scripts/deploy/foundry_deploy.py --json

# Cleanup specific agents
python scripts/deploy/foundry_deploy.py --cleanup asst_abc123 asst_def456

# Cleanup with JSON output
python scripts/deploy/foundry_deploy.py --cleanup asst_abc123 --json
```

**Human-readable output example:**
```
Pipeline: deploy-a1b2c3d4  (simulated mode)
-------------------------------------------------------
  [PASS]  Preflight                320ms
  [PASS]  Model Deployment         180ms
  [PASS]  Agent Registration      2400ms
  [PASS]  Content Safety           450ms
  [PASS]  Evaluation              3200ms
  [PASS]  Health Check             600ms
-------------------------------------------------------
  Agents: 11  Tools: 27  Errors: 0

  [PASS]  Contract Intake Agent         agent_sim_a1b2c3d4e5f6
  [PASS]  Extraction Agent              agent_sim_f6e5d4c3b2a1
  ...
```

---

## 17. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Deploy button does nothing | No active workflow in Design tab | Activate a workflow first, or click Deploy anyway (uses defaults) |
| 401 Unauthorized on deploy | Missing `x-admin-key` header | Set `DEPLOY_ADMIN_KEY` env var and pass header |
| 401 "audience is not valid" | Token acquired with wrong scope | Use `https://ai.azure.com/.default` as the token scope, NOT `https://cognitiveservices.azure.com/.default` |
| 403 with empty object ID | Using `api-key` header for Agent Service calls | The Assistants API requires Bearer token auth. Set `FOUNDRY_BEARER_TOKEN` or use `AzureCliCredential`. |
| 503 deploy_admin_not_configured | Live mode but no admin key set | Set `DEPLOY_ADMIN_KEY` environment variable |
| 400 missing_config | Live mode but Foundry not configured | Set `FOUNDRY_ENDPOINT` and `FOUNDRY_API_KEY` |
| Preflight fails | Can't reach Foundry endpoint | Check endpoint URL, network, API key validity |
| Model Deployment fails | Model not provisioned | Deploy the model in Azure AI Foundry portal first |
| Agent Registration partial fail | API rate limits or permission issues | Check Foundry project permissions; retry |
| Content Safety fails | Filters not enabled on deployment | Enable content filtering in Azure AI Foundry |
| Evaluation fails | Agent can't process eval prompt | Check agent instructions and tool bindings |
| Pipeline timeout (600s) | Slow network or many agents | Increase `timeout` in `_run_python_deploy` or `REQUEST_TIMEOUT` |
| Live tab shows "No deployed agent" after deploy | Agents missing `metadata.pipeline_role` | Re-run deploy -- `foundry_deploy.py` sets `pipeline_role` in metadata automatically |

---

**End of Documentation**
