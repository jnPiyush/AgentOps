# Live Tab - Complete Documentation

## 1. What Is the Live Tab?

The Live tab lets you run a contract through the full 10-stage AI pipeline in real time. You pick a sample contract, click to start, and watch each stage complete one by one on screen. If the Approval stage decides the contract is risky, the pipeline pauses and shows a Human-in-the-Loop (HITL) review panel where you approve, reject, or request changes.

The tab works in two modes:

| Mode | What Happens |
|------|-------------|
| **Simulated** (default) | Pre-recorded JSON responses are loaded from `data/simulated/`. No LLM calls. Fast. |
| **Live** | The pipeline calls real Foundry Assistants deployed on Azure AI Foundry via the threads/runs API. Each stage creates a thread, posts contract data, runs the assistant, and parses the structured JSON response. Agents must be deployed first via the Deploy tab. |

---

## 2. Architecture Overview

```
User Browser (ui/)
  |
  |-- 1. Select contract --> GET /api/v1/sample-contracts/{filename}
  |-- 2. Click "Start"   --> POST /api/v1/contracts  { text, filename }
  |                            |
  |                            v
  |                       Gateway (FastAPI)
  |                       gateway/python/routes/contracts.py
  |                            |
  |                            v
  |                       pipeline.py::run_pipeline()
  |                       (background task, 10 stages)
  |                            |
  |                            +-- Simulated mode:
  |                            |     AgentFactory.create_agent(stage)
  |                            |     Load JSON from data/simulated/{stage}/
  |                            |
  |                            +-- Live mode:
  |                            |     _ensure_foundry_agents() --> cache asst_* IDs
  |                            |     _run_foundry_agent(stage, input_data):
  |                            |       POST /threads              (create thread)
  |                            |       POST /threads/{tid}/messages (send input)
  |                            |       POST /threads/{tid}/runs   (execute assistant)
  |                            |       Poll GET  /runs/{rid}      (wait for completion)
  |                            |       GET  /threads/{tid}/messages (extract response)
  |                            |       Strip markdown fences, parse JSON
  |                            |       DELETE /threads/{tid}      (cleanup)
  |                            |
  |                            v
  |                       broadcast() via WebSocket
  |                       /ws/workflow
  |                            |
  |<-- 3. Real-time events ---+
  |
  |-- 4. HITL (if needed) --> POST /api/v1/contracts/{id}/review
```

---

## 3. All Files Involved

### 3.1 UI Layer

| File | Purpose |
|------|---------|
| `ui/index.html` | HTML markup for the Live section (`id="view-live"`). Contains the contract dropdown, drop zone, workflow canvas, contract details bar, activity log, and HITL panel. |
| `ui/app.js` | JavaScript logic: `onLiveContractChange()` loads a contract, `syncLiveTab()` renders workflow stages, `startWorkflow()` dispatches to simulated or real mode, simulated mode timeline animation. |
| `ui/api.js` | Gateway communication: `startWorkflowReal()` submits contract via POST, `connectWorkflowWs()` opens WebSocket, `handleWorkflowEvent()` processes each stage event, `populateHitlPanel()` builds the review UI, `resolveHitlReal()` sends the human decision back. |

### 3.2 Gateway (Backend)

| File | Purpose |
|------|---------|
| `gateway/python/main.py` | FastAPI app. Registers the `/ws/workflow` WebSocket endpoint and all route modules. Runs `init_stores()` and `init_workflow_registry()` on startup. |
| `gateway/python/routes/contracts.py` | 4 endpoints: `POST /contracts` (submit), `GET /contracts` (list), `GET /contracts/{id}` (detail), `POST /contracts/{id}/review` (HITL decision). |
| `gateway/python/routes/sample_contracts.py` | 2 endpoints: `GET /sample-contracts` (list files), `GET /sample-contracts/{filename}` (read text). Serves from `data/sample-contracts/`. |
| `gateway/python/pipeline.py` | The 10-stage orchestrator. In **simulated** mode, uses `AgentFactory` with pre-recorded data. In **live** mode, calls the Foundry Assistants API directly via `_run_foundry_agent()`. Key functions: `_get_foundry_token()` (3-tier token: env var, AzureCliCredential, DefaultAzureCredential with scope `https://ai.azure.com/.default`), `_ensure_foundry_agents()` (lists assistants filtered by `metadata.domain=="contract-management"`, caches `{pipeline_role: asst_id}` map), `_run_foundry_agent()` (thread/run lifecycle with markdown fence stripping). |
| `gateway/python/websocket_manager.py` | Manages a set of active WebSocket connections. `broadcast(event)` sends a JSON message to all connected clients. |
| `gateway/python/stores.py` | File-backed JSON stores: `contract_store` (data/contracts.json), `audit_store` (data/audit.json). Also handles contract text persistence in `data/contract-texts/`. |
| `gateway/python/config.py` | Environment configuration: `DEMO_MODE`, `GATEWAY_PORT`, `FOUNDRY_*` settings, `MCP_SERVERS` list. |

### 3.3 Agent Framework (Simulated Mode Only)

The Microsoft Agent Framework is used **only in simulated mode**. In live mode, `pipeline.py` calls the Foundry Assistants API directly -- the Agent Framework is bypassed entirely.

| File | Purpose |
|------|---------|
| `agents/microsoft-framework/agents.py` | `DeclarativeContractAgent` base class and `AgentFactory`. Used in simulated mode: `set_simulated_response()` injects pre-recorded data. **Not used in live mode.** |
| `agents/microsoft-framework/config.py` | Model configuration: endpoint, API key, model name, temperature, timeout. Used by the framework in simulated mode. |
| `scripts/_start_gateway.py` | Python wrapper to start the gateway in live mode. Acquires a fresh Azure AD token via `AzureCliCredential`, sets `FOUNDRY_BEARER_TOKEN` env var, then starts uvicorn. Recommended startup method for live mode. |

### 3.4 Agent Configuration (11 agents)

All in `config/agents/`:

| File | Stage | Key Settings |
|------|-------|-------------|
| `intake-agent.yaml` | Intake | gpt-5.4, temp 0.0, timeout 30s, 3 tools |
| `extraction-agent.yaml` | Extraction | gpt-5.4, timeout 45s |
| `review-agent.yaml` | Review | timeout 45s |
| `compliance-agent.yaml` | Compliance | timeout 60s, parallel HITL review |
| `negotiation-agent.yaml` | Negotiation | timeout 45s |
| `approval-agent.yaml` | Approval | timeout 30s |
| `signature-agent.yaml` | Signature | timeout 45s |
| `obligations-agent.yaml` | Obligations | timeout 60s |
| `renewal-agent.yaml` | Renewal | timeout 45s |
| `analytics-agent.yaml` | Analytics | timeout 45s |
| `drafting-agent.yaml` | (Drafting) | Used by Design tab |

Each YAML file specifies: model provider, temperature, max tokens, system prompt path, tool bindings (MCP server + tool name), behaviour constraints, and retry policy.

### 3.5 System Prompts (10 prompts)

All in `prompts/`:

| File | Agent | What It Tells the LLM |
|------|-------|----------------------|
| `intake-system.md` | Intake | Classify contract type, extract metadata (parties, dates, jurisdiction, risk). Return JSON only. |
| `extraction-system.md` | Extraction | Extract clauses, identify parties, dates, and monetary values. |
| `review-system.md` | Review | Summarise material changes, flag unresolved items. |
| `compliance-system.md` | Compliance | Check policy compliance, flag violations, assess risk level. |
| `negotiation-system.md` | Negotiation | Assess counterparty positions, recommend fallback language. |
| `approval-system.md` | Approval | Decide auto_approve vs escalate_to_human based on risk and flags. |
| `signature-system.md` | Signature | Track signature status, pending signers, execution date. |
| `obligations-system.md` | Obligations | Extract obligations, assign owners, set follow-up windows. |
| `renewal-system.md` | Renewal | Check renewal windows, expiry dates, auto-renewal settings. |
| `analytics-system.md` | Analytics | Generate lifecycle analytics, portfolio summary, key metrics. |

### 3.6 Workflow Configuration

| File | Purpose |
|------|---------|
| `config/workflows/contract-processing.yaml` | Declares the 10-stage pipeline topology: stage order, dependencies, conditions, timeouts, retry counts, success/failure routing, and HITL checkpoints at compliance/approval/signature. |
| `config/stages/contract-lifecycle.json` | Stage catalog with display names and MCP server affinity for each lifecycle stage. |

### 3.7 Data Files

| Path | Purpose |
|------|---------|
| `data/sample-contracts/` | 13 sample contract text files (NDA, MSA, SOW, SLA, Amendment, Loan, License, SaaS, Sales, Services, Supply, Distribution, Promissory Note). |
| `data/simulated/{stage}/` | 10 folders (one per stage), each with 13 JSON files matching the sample contracts. Used in simulated mode. |
| `data/contracts.json` | Persistent store of submitted contracts (id, filename, status, type, timestamps). |
| `data/audit.json` | Audit log entries (id, contract_id, agent, action, reasoning, timestamp). |
| `data/contract-texts/` | Full text of each submitted contract, stored as `{contract-id}.txt`. |

### 3.8 MCP Servers (Tool Providers)

These run as separate processes. The pipeline does not call them directly in the current architecture (agents use simulated or in-process execution), but they provide the tool definitions referenced in agent YAML configs.

| Server | Port | Tools |
|--------|------|-------|
| contract-intake-mcp | 9001 | upload_contract, classify_document, extract_metadata |
| contract-extraction-mcp | 9002 | extract_clauses, identify_parties, extract_dates_values |
| contract-compliance-mcp | 9003 | check_policy, flag_risk, get_policy_rules + 3 more |
| contract-workflow-mcp | 9004 | route_approval, escalate_to_human, notify_stakeholder |
| contract-audit-mcp | 9005 | get_audit_log, create_audit_entry, get_contract_history |
| contract-eval-mcp | 9006 | run_evaluation, get_results, compare_baseline |
| contract-drift-mcp | 9007 | detect_llm_drift, detect_data_drift, simulate_model_swap |
| contract-feedback-mcp | 9008 | submit_feedback, convert_to_test_cases, get_feedback_summary |

---

## 4. The 10-Stage Pipeline (Step by Step)

When you click "Drop Contract Here", the pipeline runs all 10 stages in sequence. Each stage calls an agent, collects a result, broadcasts it over WebSocket, and logs an audit entry.

### Stage 1: Intake

**What it does:** Classifies the contract type (NDA, MSA, SOW, etc.) and extracts initial metadata.

**Agent input:**
```json
{
  "contract_text": "<full text>",
  "contract_id": "contract-a1b2c3d4",
  "action": "classify_and_extract_metadata"
}
```

**Agent output (example):**
```json
{
  "type": "NDA",
  "confidence": 0.97,
  "parties": ["Acme Corp", "Beta Inc"],
  "metadata": {
    "jurisdiction": "Delaware",
    "risk_level": "low",
    "effective_date": "2026-01-15"
  }
}
```

**UI update:** Shows contract type, confidence score, and parties in the workflow node and contract details bar.

---

### Stage 2: Extraction

**What it does:** Extracts clauses, identifies all parties, pulls dates and monetary values.

**Agent output (example):**
```json
{
  "clauses": [
    { "type": "confidentiality", "text": "...", "section": "3.1" },
    { "type": "termination", "text": "...", "section": "7.2" }
  ],
  "parties": ["Acme Corp", "Beta Inc"],
  "dates": ["2026-01-15", "2027-01-15"],
  "values": [{ "label": "Penalty Cap", "value": 50000 }]
}
```

**UI update:** Shows number of clauses extracted and party names. The UI maps this stage to "Drafting" in the workflow canvas (pipeline name "extraction" maps to design role "drafting").

---

### Stage 3: Review

**What it does:** Reviews the extracted clauses, identifies material changes and unresolved items.

**Agent output (example):**
```json
{
  "review_summary": "Standard NDA with minor deviations",
  "material_changes": ["Non-standard termination clause"],
  "unresolved_items": [],
  "confidence_score": 0.85
}
```

**UI update:** Shows count of material changes and unresolved items.

---

### Stage 4: Compliance

**What it does:** Checks extracted clauses against policy rules, flags violations, assesses overall risk level.

**Agent output (example):**
```json
{
  "clause_results": [
    { "clause_type": "confidentiality", "status": "pass", "policy_ref": "POL-001" },
    { "clause_type": "termination", "status": "fail", "policy_ref": "POL-003", "reason": "Missing 30-day notice" }
  ],
  "overall_risk": "medium",
  "flags_count": 1
}
```

**UI update:** Shows risk level badge and flag count. The compliance result is also stored in `window._lastComplianceResult` so the HITL panel can display the flagged items later.

---

### Stage 5: Negotiation

**What it does:** Assesses counterparty negotiation positions and recommends fallback language. Determines if escalation is needed.

**Agent output (example):**
```json
{
  "counterparty_positions": ["Seeking longer confidentiality period"],
  "fallback_recommendations": ["Propose 3-year term as compromise"],
  "escalation_required": false,
  "confidence_score": 0.78
}
```

**UI update:** Shows number of counterparty positions and escalation status.

---

### Stage 6: Approval (HITL Checkpoint)

**What it does:** Decides whether the contract can be auto-approved or needs human review. This is the key decision point.

**Decision logic:**
- If the agent returns `action: "auto_approve"` or `decision: "APPROVE"` with `escalation_required: false` --> auto-approved, pipeline continues
- If the agent returns `action: "escalate_to_human"` or `decision: "REJECT"/"CONDITIONAL"` --> pipeline pauses, HITL panel appears

**Agent output (example - escalation):**
```json
{
  "action": "escalate_to_human",
  "reasoning": "High compliance risk with 3 policy violations",
  "assigned_to": "legal-review@company.com"
}
```

**UI update:** If auto-approved, the node shows "Complete" and the pipeline moves on. If escalated, the node shows "Awaiting review", the drop zone says "Pipeline paused", and the HITL panel slides in.

---

### Stage 7: Signature

**What it does:** Tracks signature status, identifies pending signers, and determines next action.

**Agent output (example):**
```json
{
  "signature_status": "pending",
  "pending_signers": ["John Smith (Acme)", "Jane Doe (Beta)"],
  "completed_signers": [],
  "next_action": "Send DocuSign envelopes",
  "execution_date": null
}
```

---

### Stage 8: Obligations

**What it does:** Extracts obligations from the contract, assigns owners, and sets follow-up windows.

**Agent output (example):**
```json
{
  "obligations": [
    { "description": "Deliver quarterly reports", "owner": "Acme Corp", "due": "Quarterly" }
  ],
  "total_obligations": 5,
  "follow_up_window_days": 30
}
```

---

### Stage 9: Renewal

**What it does:** Checks renewal windows, expiry dates, and auto-renewal settings.

**Agent output (example):**
```json
{
  "renewal_window_days": 90,
  "risk_level": "low",
  "expiry_date": "2027-01-15",
  "auto_renewal": true,
  "recommended_actions": ["Set calendar reminder 90 days before expiry"]
}
```

---

### Stage 10: Analytics

**What it does:** Generates lifecycle analytics, portfolio summary, key metrics, and improvement recommendations.

**Agent output (example):**
```json
{
  "portfolio_summary": "Contract portfolio is healthy with low overall risk",
  "key_metrics": [
    { "metric": "avg_processing_time", "value": "4.2s" },
    { "metric": "compliance_pass_rate", "value": "92%" }
  ],
  "recommended_actions": ["Review termination clauses across NDA portfolio"]
}
```

**UI update:** Shows metric count, action count, and overall score. After this stage, the pipeline broadcasts `pipeline_complete`.

---

## 5. Human-in-the-Loop (HITL) Flow

The HITL panel appears when Stage 6 (Approval) escalates the contract. Here is the complete flow:

### 5.1 Trigger

The approval agent returns `action: "escalate_to_human"`. The pipeline broadcasts:
```json
{
  "event": "agent_step_complete",
  "contract_id": "contract-a1b2c3d4",
  "agent": "approval",
  "status": "awaiting_review",
  "result": { "action": "escalate_to_human", "reasoning": "..." }
}
```

### 5.2 UI Shows the HITL Panel

The panel (inside `ui/index.html`, `id="hitl-panel"`) displays:
- **Risk badge**: "ESCALATED" in red
- **Reason text**: From the approval agent's reasoning
- **Flagged items**: Built from the compliance stage's `clauseResults` (stored in `window._lastComplianceResult`). Items with `status: "fail"` show `[X]`, items with `status: "warn"` show `[!]`
- **Approval summary**: Action, reasoning, assigned reviewer, contract type, parties
- **Three buttons**: Approve (green), Reject (red), Request Changes (yellow)
- **Comment input**: Optional text field

### 5.3 User Makes a Decision

When the user clicks a button, `resolveHitl(decision)` is called:

1. **Simulated mode**: Updates the UI directly (no backend call)
2. **Real mode**: Sends `POST /api/v1/contracts/{contract_id}/review` with:
```json
{
  "decision": "approve",
  "reviewer": "demo-user",
  "comment": "Looks good after review"
}
```

### 5.4 Backend Processes the Review

`contracts.py::review_contract()`:
1. Validates decision is one of: `approve`, `reject`, `request_changes`
2. Updates contract status in `contract_store`
3. Creates an audit entry with `agent: "human"`
4. Broadcasts the decision over WebSocket

### 5.5 Pipeline Continues or Stops

- **Approved**: Stages 7-10 continue (Signature, Obligations, Renewal, Analytics)
- **Rejected**: Pipeline stops, UI shows "Pipeline STOPPED: Rejected"
- **Request Changes**: Contract returns to "awaiting_review" status

---

## 6. WebSocket Communication

The WebSocket connection at `/ws/workflow` is the backbone of real-time updates.

### 6.1 Connection

After submitting a contract, the UI opens:
```
ws://localhost:8000/ws/workflow
```

### 6.2 Event Types

| Event | Status | Meaning |
|-------|--------|---------|
| `pipeline_status` | `processing_started` | Pipeline has begun |
| `agent_step_complete` | `intake_complete` | Stage 1 finished |
| `agent_step_complete` | `extraction_complete` | Stage 2 finished |
| `agent_step_complete` | `review_complete` | Stage 3 finished |
| `agent_step_complete` | `compliance_complete` | Stage 4 finished |
| `agent_step_complete` | `negotiation_complete` | Stage 5 finished |
| `agent_step_complete` | `approved` or `awaiting_review` | Stage 6 finished (auto-approved or escalated) |
| `agent_step_complete` | `signature_complete` | Stage 7 finished |
| `agent_step_complete` | `obligations_complete` | Stage 8 finished |
| `agent_step_complete` | `renewal_complete` | Stage 9 finished |
| `agent_step_complete` | `analytics_complete` | Stage 10 finished |
| `pipeline_status` | `pipeline_complete` | All stages done |
| `pipeline_status` | `pipeline_failed` | Pipeline error |
| `error` | -- | Runtime error |

### 6.3 Event Payload Structure

Every `agent_step_complete` event has this shape:
```json
{
  "event": "agent_step_complete",
  "contract_id": "contract-a1b2c3d4",
  "agent": "intake",
  "status": "intake_complete",
  "result": { ... },
  "latency_ms": 342,
  "timestamp": "2026-03-24T14:30:00Z"
}
```

---

## 7. Simulated vs Real Mode

### 7.1 Simulated Mode (Default)

- No LLM calls, no API keys needed
- `pipeline.py` calls `_load_simulated_response(stage, contract_text)` which picks a JSON file from `data/simulated/{stage}/` based on keywords in the contract text
- Contract type detection: "non-disclosure" or "nda" --> `nda-001.json`, "master service" or "msa" --> `msa-001.json`, etc.
- Adds a random 0.3-0.8s delay per stage to simulate latency
- 13 contract types x 10 stages = 130 pre-recorded response files

### 7.2 Live Mode

- Requires agents to be deployed on Azure AI Foundry first (use the Deploy tab)
- Requires a Bearer token with scope `https://ai.azure.com/.default` (NOT `cognitiveservices.azure.com`)
- `pipeline.py` calls the Foundry Assistants API **directly** -- the Microsoft Agent Framework is not used
- Set via: `POST /api/v1/mode` with `{ "mode": "live" }` (requires admin key), or `DEMO_MODE=live`

**Token acquisition** (`_get_foundry_token()`):
1. Check `FOUNDRY_BEARER_TOKEN` environment variable (pre-fetched token)
2. Try `AzureCliCredential` with scope `https://ai.azure.com/.default`
3. Fall back to `DefaultAzureCredential` with same scope

**Agent lookup** (`_ensure_foundry_agents()`):
- Calls `GET /assistants?api-version=2025-05-15-preview&limit=100` on the Foundry project endpoint
- Filters assistants by `metadata.domain == "contract-management"`
- Maps `metadata.pipeline_role` to assistant ID (e.g., `intake -> asst_abc123`)
- Result is cached for the gateway lifetime

**Per-stage execution** (`_run_foundry_agent()`):
1. Create thread: `POST /threads`
2. Add message: `POST /threads/{tid}/messages` with JSON input
3. Create run: `POST /threads/{tid}/runs` with `assistant_id`
4. Poll: `GET /threads/{tid}/runs/{rid}` every 2s (up to 60s)
5. Extract response: `GET /threads/{tid}/messages` (descending, pick first assistant message)
6. **Strip markdown fences**: Foundry agents often wrap JSON in ` ```json ... ``` ` -- the pipeline strips these before parsing
7. Parse JSON response
8. Cleanup: `DELETE /threads/{tid}`

**Typical latency**: 5-18 seconds per agent (vs 0.3-0.8s in simulated mode)

### 7.3 How the UI Chooses

In `ui/app.js`, `startWorkflow()` checks the `dashboardMode` variable:
```javascript
function startWorkflow() {
    if (workflowRunning) return;
    workflowRunning = true;
    if (dashboardMode === "real") return startWorkflowReal();
    // ... simulated mode timeline
}
```

In simulated mode, the UI runs a pre-scripted timeline animation locally. In real mode, it submits to the gateway and listens on WebSocket.

---

## 8. UI Components in Detail

### 8.1 Contract Dropdown

```html
<select id="live-contract-select" onchange="onLiveContractChange(this.value)">
```
Populated on page load by `loadSampleContracts()` which calls `GET /api/v1/sample-contracts`. Returns 13 sample contracts.

### 8.2 Drop Zone

```html
<div class="drop-area" id="drop-area" onclick="startWorkflow()">
    Drop Contract Here (or click to start demo)
</div>
```
Shows different states:
- Default: "Drop Contract Here (or click to start demo)"
- Loading: "Loading NDA-Acme-Beta-2026.txt..." (blue border)
- Ready: "NDA-Acme-Beta-2026.txt loaded - click to process" (green border)
- Processing: "Processing NDA-Acme-Beta-2026.txt..." (blue border)
- Paused: "Pipeline paused - Approval requires review" (orange border)
- Complete: "Pipeline complete" (green border)
- Error: "Error - ..." (red border)

### 8.3 Workflow Canvas

```html
<div class="workflow-canvas" id="workflow-canvas">
```
Dynamically rendered by `syncLiveTab()`. Shows each stage as a node with:
- Stage label (e.g., "Request Initiation")
- Agent role name
- Status indicator (Waiting / In progress / Complete / Awaiting review)
- Progress bar
- Tool output area (populated as stages complete)

Stages are connected by arrow dividers (`-->`) to show the flow.

### 8.4 Contract Details Bar

```html
<div class="contract-details-bar" id="contract-details">
```
Hidden until the pipeline starts. Shows four fields updated in real time:
- **Type**: Set by Intake stage (e.g., "NDA")
- **Parties**: Set by Intake/Extraction stages
- **Pages**: Estimated from text length
- **Risk**: Set by Compliance stage (badge: green LOW / yellow MEDIUM / red HIGH)

### 8.5 Activity Log

```html
<div class="activity-log" id="activity-log">
```
Scrollable log of all pipeline events. Each entry has:
- Timestamp
- Actor (stage name or "System")
- Message (e.g., "[PASS] intake complete", "Latency: 342ms")

### 8.6 HITL Panel

```html
<div class="hitl-panel" id="hitl-panel">
```
Hidden by default. Shown when approval escalates. Contains risk badge, reason, flagged items, summary, action buttons, and comment input.

---

## 9. Pipeline-to-UI Stage Mapping

The backend pipeline uses internal stage names. The UI maps these to workflow design roles for display:

| Pipeline Agent | UI Design Role | Display Name |
|---------------|---------------|-------------|
| `intake` | `intake` | Request Initiation |
| `extraction` | `drafting` | Authoring/Drafting |
| `review` | `review` | Internal Review |
| `compliance` | `compliance` | Compliance Check |
| `negotiation` | `negotiation` | Negotiation |
| `approval` | `approval` | Approval and Routing |
| `signature` | `signature` | Execution/Signature |
| `obligations` | `obligations` | Obligations |
| `renewal` | `renewal` | Renewal |
| `analytics` | `analytics` | Analytics |

This mapping is defined in `ui/api.js` inside `handleWorkflowEvent()`:
```javascript
const pipelineToDesignRole = {
    intake: "intake",
    extraction: "drafting",
    review: "review",
    compliance: "compliance",
    negotiation: "negotiation",
    approval: "approval",
    signature: "signature",
    obligations: "obligations",
    renewal: "renewal",
    analytics: "analytics",
};
```

---

## 10. Data Persistence

### 10.1 Contracts

Every submitted contract is stored in `data/contracts.json`:
```json
{
  "id": "contract-a1b2c3d4",
  "filename": "NDA-Acme-Beta-2026.txt",
  "status": "approved",
  "type": "NDA",
  "classification_confidence": 0.97,
  "submitted_at": "2026-03-24T14:30:00Z",
  "completed_at": "2026-03-24T14:30:05Z"
}
```

The full contract text is stored separately as `data/contract-texts/contract-a1b2c3d4.txt`.

### 10.2 Audit Trail

Every agent action is logged to `data/audit.json`:
```json
{
  "id": "uuid",
  "contract_id": "contract-a1b2c3d4",
  "agent": "intake",
  "action": "classified",
  "reasoning": "Classified as NDA (confidence 0.97)",
  "timestamp": "2026-03-24T14:30:01Z"
}
```

Human HITL decisions are also logged with `"agent": "human"`.

### 10.3 Traces

Pipeline traces (agent, tool, input, output, latency, tokens) are stored in-memory with a 500-contract LRU cache via `store_traces()` in `stores.py`.

---

## 11. API Endpoints Used by the Live Tab

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/v1/sample-contracts` | List available sample contracts | None |
| `GET` | `/api/v1/sample-contracts/{filename}` | Get contract text | None |
| `POST` | `/api/v1/contracts` | Submit contract for processing | None |
| `GET` | `/api/v1/contracts` | List all submitted contracts | None |
| `GET` | `/api/v1/contracts/{id}` | Get specific contract details | None |
| `POST` | `/api/v1/contracts/{id}/review` | Submit HITL decision | None |
| `WS` | `/ws/workflow` | Real-time pipeline events | None |
| `GET` | `/api/v1/client-config` | Get current mode (simulated/live) | None |
| `POST` | `/api/v1/mode` | Switch between simulated and live | Admin key |

---

## 12. Environment Variables

| Variable | Default | Used For |
|----------|---------|----------|
| `DEMO_MODE` | `simulated` | Which mode the pipeline runs in |
| `GATEWAY_PORT` | `8000` | Port for the FastAPI gateway |
| `FOUNDRY_API_KEY` | (none) | Azure AI Foundry API key (fallback auth) |
| `FOUNDRY_ENDPOINT` | (none) | Azure AI Foundry OpenAI endpoint |
| `FOUNDRY_PROJECT_ENDPOINT` | (none) | Foundry Agent Service endpoint (e.g., `https://<name>.services.ai.azure.com/api/projects/<project>`). Used for Assistants API calls. Falls back to `FOUNDRY_ENDPOINT` if not set. |
| `FOUNDRY_BEARER_TOKEN` | (none) | Pre-fetched Azure AD Bearer token for Agent Service. If set, the pipeline uses this directly instead of acquiring a token via `AzureCliCredential`. Recommended for live mode -- use `scripts/_start_gateway.py` to set automatically. |
| `FOUNDRY_MODEL` | `gpt-5.4` | Primary model for agents |
| `DEPLOY_ADMIN_KEY` | (none) | Required for mode switching |
| `ALLOWED_ORIGINS` | localhost | CORS origins |

---

## 13. Sample Contracts (13 Types)

| File | Contract Type |
|------|-------------|
| `NDA-Acme-Beta-2026.txt` | Non-Disclosure Agreement |
| `MSA-GlobalTech-2026.txt` | Master Service Agreement |
| `SOW-CloudMigration-2026.txt` | Statement of Work |
| `SLA-InfraUptime-2026.txt` | Service Level Agreement |
| `Amendment-DataPolicy-2026.txt` | Amendment |
| `LoanAgreement-TermLoan-2026.txt` | Loan Agreement |
| `LicenseAgreement-Platform-2026.txt` | License Agreement |
| `SaaS-CloudServices-2026.txt` | SaaS / Cloud Services |
| `SalesAgreement-Equipment-2026.txt` | Sales Agreement |
| `ServicesAgreement-Consulting-2026.txt` | Services Agreement |
| `SupplyAgreement-Materials-2026.txt` | Supply Agreement |
| `DistributionAgreement-Regional-2026.txt` | Distribution Agreement |
| `PromissoryNote-BridgeLoan-2026.txt` | Promissory Note |

---

## 14. Error Handling

| Scenario | What Happens |
|----------|-------------|
| No contract selected | Drop zone shows "Please select a contract first" (red) |
| Contract text empty | Gateway returns 400: "Contract text is required" |
| Contract text > 50,000 chars | Gateway returns 400: "exceeds maximum length" |
| Agent stage fails | Pipeline catches exception, broadcasts `pipeline_failed`, logs audit entry "Pipeline failed: {error}" |
| WebSocket disconnects | UI shows "WebSocket disconnected" in activity log |
| WebSocket error | UI shows "WebSocket error - falling back to polling" |
| HITL decision invalid | Gateway returns 400: "Decision must be one of: approve, reject, request_changes" |

---

## 15. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Dropdown is empty | Gateway not running or sample-contracts folder missing | Start gateway: `python scripts/_start_gateway.py` (live) or `python -m uvicorn gateway.python.main:app --port 8000` (simulated) |
| "Loading..." stuck | Gateway returned error for sample contract | Check `data/sample-contracts/` has .txt files |
| No WebSocket events | WebSocket not connected or gateway crashed | Check browser console for WS errors, check gateway logs |
| Pipeline stuck at approval | HITL panel waiting for human input | Click Approve/Reject/Request Changes |
| All stages show "Waiting" | No active workflow pushed from Design tab | Go to Design tab, activate a workflow, then return to Live |
| Stages complete instantly | Simulated mode | Expected behaviour - pre-recorded responses load in ~0.5s |
| "Pipeline failed" | Agent error or missing simulated data | Check gateway logs for the exception details |
| Risk always shows "--" | Compliance stage hasn't run yet | Wait for stage 4 to complete |
| Intake returns `type=UNKNOWN, confidence=0.0` | Foundry agent JSON response wrapped in markdown code fences (`\`\`\`json ... \`\`\``) and parsing failed | This was fixed in `pipeline.py` -- the pipeline now strips markdown fences before parsing. If it recurs, check the agent's system prompt instructs it to return raw JSON. |
| `AzureCliCredential` fails / 401 | Running in a background terminal where `az` is not on PATH, or token expired | Use `scripts/_start_gateway.py` which acquires the token in the foreground terminal and passes it via `FOUNDRY_BEARER_TOKEN` env var |
| 401 "audience is not valid" | Token acquired with wrong scope (e.g., `cognitiveservices.azure.com`) | The correct scope is `https://ai.azure.com/.default` -- this is set in `_get_foundry_token()` |
| 403 with empty object ID | Using `api-key` header instead of Bearer token | The Agent Service requires Bearer token auth, not `api-key`. Set `FOUNDRY_BEARER_TOKEN` or use `AzureCliCredential`. |
| "No deployed Foundry agent for stage 'X'" | Agents not yet deployed, or deployed without `metadata.pipeline_role` | Run the Deploy tab first. Verify agents have `metadata.pipeline_role` set (e.g., `intake`, `extraction`). |
| Pipeline takes 2-3 minutes | Normal for live mode | Each Foundry agent call takes 5-18s. 10 stages = 50-180s total. |

---

## 16. How to Use

### Simulated Mode (default)

1. **Start the gateway**: `python -m uvicorn gateway.python.main:app --host 0.0.0.0 --port 8000`
2. **Open the UI**: Navigate to `http://localhost:8000`
3. **Go to Design tab first**: Activate a workflow so the Live tab has stages to render
4. **Switch to Live tab**
5. **Select a contract** from the dropdown (e.g., "NDA-Acme-Beta-2026.txt")
6. **Click the drop zone** to start processing
7. **Watch the pipeline**: Each stage lights up as it completes (~0.5s per stage)
8. **Handle HITL** (if the approval agent escalates): Review flagged items and click Approve/Reject/Request Changes
9. **Check the activity log** for detailed stage-by-stage results

### Live Mode (real Foundry agents)

**Prerequisites:**
- Azure CLI logged in (`az login`)
- Foundry environment variables set in `.env` (`FOUNDRY_ENDPOINT`, `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_API_KEY`)
- `DEMO_MODE=live` and `DEPLOY_ADMIN_KEY` set in `.env`
- Agents deployed via the Deploy tab (all 11 agents with `metadata.pipeline_role`)

**Steps:**
1. **Start the gateway with token**: `python scripts/_start_gateway.py`
   - This acquires a Bearer token via `AzureCliCredential` and sets `FOUNDRY_BEARER_TOKEN` automatically
   - Starts uvicorn on port 8000 (or pass `--port <N>` to override)
2. **Open the UI**: Navigate to `http://localhost:8000`
3. **Verify mode**: The mode indicator should show "Live" (or call `GET /api/v1/mode`)
4. **Go to Design tab first**: Activate a workflow
5. **Switch to Live tab**
6. **Select a contract** and click the drop zone
7. **Wait for results**: Each stage takes 5-18s (total pipeline: ~1-3 minutes)
8. **Handle HITL** if prompted
9. **Check activity log**: Shows real LLM latencies and structured responses
