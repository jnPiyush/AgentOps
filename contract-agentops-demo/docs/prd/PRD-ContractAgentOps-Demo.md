# PRD: Contract AgentOps Demo - Microsoft Foundry

> **Architecture Update (2026-03-07)**: The React dashboard has been archived. The primary UI is now a static vanilla HTML/CSS/JS dashboard under `ui/`, served at `http://localhost:8000`. References to "React dashboard" below are historical.
> **Product Scope Update (2026-03-10)**: The Interactive Workflow Designer Canvas scope has been merged into this document. This is the single canonical PRD for the contract demo.

**Epic**: Contract AgentOps Demo
**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-03-04
**Stakeholders**: Piyush Jain (Creator/Lead), Demo Audiences, Microsoft Foundry Users
**Priority**: p1

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Target Users](#2-target-users)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Requirements](#4-requirements)
5. [User Stories & Features](#5-user-stories--features)
6. [User Flows](#6-user-flows)
7. [Dependencies & Constraints](#7-dependencies--constraints)
8. [Risks & Mitigations](#8-risks--mitigations)
9. [Timeline & Milestones](#9-timeline--milestones)
10. [Out of Scope](#10-out-of-scope)
11. [Open Questions](#11-open-questions)
12. [Appendix](#12-appendix)

---

## 1. Problem Statement

### What problem are we solving?

Organizations struggle to operationalize AI agents beyond initial prototypes. While building an AI agent is straightforward with modern SDKs, the hard part is **operating** it at enterprise scale -- monitoring for drift, collecting human feedback, evaluating quality, managing model changes, and governing agent behavior. There is no end-to-end demo that shows the full AgentOps lifecycle using a realistic business scenario with Microsoft Foundry.

### Why is this important?

- **Education Gap**: Teams understand "build an agent" but not "operate an agent" -- the 80% of work that happens after deployment
- **Microsoft Foundry Showcase**: Demonstrates the complete Foundry + Agent 365 value proposition in a tangible, relatable scenario
- **Enterprise Relevance**: Contract management is universal -- every organization handles contracts, making the demo immediately relatable
- **Visual Impact**: The interactive design canvas, workflow test surfaces, and operational dashboard make the invisible (drift, evaluations, feedback loops) visible and interactive

### What happens if we don't solve this?

AgentOps remains a theoretical concept in slide decks. Decision-makers cannot visualize what operationalizing agents actually looks like. Foundry adoption stays limited to "build and forget" agent prototypes that never mature into production-grade systems.

---

## 2. Target Users

### Primary Users

**User Persona 1: Demo Presenter (Piyush / Technical Evangelists)**
- **Goals**: Deliver a compelling, interactive AgentOps demo that showcases the full lifecycle
- **Pain Points**: Static slides do not convey the operational complexity; need live, interactive visuals
- **Behaviors**: Runs demos in conference talks, customer workshops, internal enablement sessions

**User Persona 2: Demo Audience (Technical Decision Makers)**
- **Goals**: Understand how AgentOps works in practice, not just theory
- **Pain Points**: Cannot visualize LLM drift, feedback loops, or quality gates from bullet points alone
- **Behaviors**: Evaluates platforms by seeing them in action; asks "show me" not "tell me"

**User Persona 3: Developer Learning AgentOps**
- **Goals**: Clone the repo, run the demo locally, learn by exploring the code
- **Pain Points**: No reference implementation that covers the full AgentOps lifecycle
- **Behaviors**: Learns by doing; wants runnable code, not documentation

### Secondary Users

- **Microsoft Foundry Product Team** -- reference demo for customer enablement
- **Solution Architects** -- reference architecture for enterprise agent deployments

---

## 3. Goals & Success Metrics

### Business Goals

1. **Demo Impact**: Audience clearly understands all 8 AgentOps stages after watching the demo
2. **Reusability**: Demo can be adapted for different industries by swapping the contract domain
3. **Learning Tool**: Developers can clone, run, and learn from the codebase independently

### Success Metrics (KPIs)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| AgentOps stages visually demonstrated | 0 (slides only) | 8/8 stages with live UI | MVP |
| Interactive design canvas capabilities | Partial | Full agent CRUD, workflow types, save/load, push to pipeline | MVP |
| MCP servers operational | 0 | 8 purpose-built MCP servers | MVP |
| Dashboard views | 0 | 8 interactive views (one per stage) | MVP |
| Sample contracts for demo | 0 | 5 (NDA, MSA, SOW, Amendment, SLA) | MVP |
| End-to-end demo runtime | N/A | 15-20 minutes (guided) | MVP |

### User Success Criteria

- Presenter can run the full demo end-to-end without code changes
- Audience can follow the contract flowing through all 8 stages visually
- Developer can clone the repo, install dependencies, and run locally in under 10 minutes

---

## 4. Requirements

### 4.1 Functional Requirements

#### Must Have (P0)

1. **8 MCP Servers**: Purpose-built MCP servers for each AgentOps stage
   - **Acceptance Criteria**:
   - [ ] Each MCP server exposes 3-5 tools via standard MCP protocol
   - [ ] Each MCP server can run independently for isolated testing
   - [ ] All MCP servers work together in the orchestrated pipeline

2. **Static Dashboard (8 Views)**: Interactive UI showing each AgentOps stage
   - **Acceptance Criteria**:
   - [ ] One view per AgentOps stage with real-time data
   - [ ] Navigation between stages follows the lifecycle flow
   - [ ] Visual indicators (traffic lights, progress bars, trend lines) for status

3. **Interactive Workflow Designer Canvas**: Design Canvas must support authoring and activating custom agent workflows
   - **Acceptance Criteria**:
   - [ ] Users can add, edit, and remove agents from the workflow
   - [ ] Users can associate MCP tools, model choice, role, boundary, and output expectations per agent
   - [ ] Users can choose workflow topology: sequential, parallel, sequential plus HITL, fan-out, conditional
   - [ ] Users can reorder agents and persist workflow definitions
   - [ ] Users can save, load, and activate workflows for Test, Deploy, and Live stages
   - [ ] Design validation blocks invalid save and push actions while preserving warnings

4. **4 Contract Agents**: Specialized agents orchestrated via Microsoft Foundry and Microsoft Agent Framework
   - **Acceptance Criteria**:
   - [ ] Intake Agent classifies contracts by type
   - [ ] Extraction Agent pulls key terms and clauses
   - [ ] Compliance Agent checks terms against company policies
   - [ ] Approval Agent routes for human approval based on risk level

5. **Sample Contract Dataset**: 5 realistic contract PDFs for demo
   - **Acceptance Criteria**:
   - [ ] NDA, MSA, SOW, Amendment, SLA -- each with distinct clauses
   - [ ] No real PII or company data (synthetic but realistic)
   - [ ] Ground truth annotations for evaluation comparisons

6. **Human-in-the-Loop Flow**: Approval escalation with human review
   - **Acceptance Criteria**:
   - [ ] High-risk contracts pause for human review in the UI
   - [ ] Reviewer can approve/reject/request-changes with comments
   - [ ] Decision is logged in the audit trail

#### Should Have (P1)

6. **Evaluation Lab**: Run eval suites, LLM-as-judge scoring, and compare baselines
   - **Acceptance Criteria**:
   - [ ] Run automated evaluations against the test contract set
   - [ ] Compare current vs. previous agent version (side-by-side metrics)
   - [ ] Quality gate pass/fail decision displayed
   - [ ] LLM-as-judge scores agent outputs on relevance, groundedness, and coherence (0-5 scale)
   - [ ] Judge LLM results shown alongside deterministic ground-truth metrics

7. **Drift Detection Center**: Detect and visualize LLM drift, data drift, model swap impact
   - **Acceptance Criteria**:
   - [ ] Simulated LLM drift over time (accuracy degradation visualization)
   - [ ] Data drift detection when new contract types appear
   - [ ] Model swap simulator: compare GPT-4o vs. GPT-4o-mini on same test set

8. **Feedback & Optimize Loop**: Collect human feedback and close the improvement loop
   - **Acceptance Criteria**:
   - [ ] Submit feedback (thumbs up/down + comment) on agent outputs
   - [ ] Convert negative feedback into new evaluation test cases
   - [ ] Show prompt refinement -> re-evaluation -> improvement cycle

9. **Advanced Canvas Experience**: Optional design-canvas enhancements for larger workflows
   - **Acceptance Criteria**:
   - [ ] Support enhanced canvas controls such as zoom, fit-to-view, or minimap when the workflow grows
   - [ ] Export workflow definitions as JSON for inspection and portability
   - [ ] Keep authoring performance acceptable for workflows up to 20 agents

#### Could Have (P2)

10. **Agent 365 Governance View**: Show agent registry, identity, access control
   - **Acceptance Criteria**:
   - [ ] Display registered agents with Entra Agent IDs
   - [ ] Show agent-to-data relationships visualization

11. **Demo Script Mode**: Auto-guided walkthrough with narration prompts
    - **Acceptance Criteria**:
    - [ ] Step-by-step guided mode highlighting each stage
    - [ ] Presenter notes displayed alongside the UI

#### Won't Have (Out of Scope)

- Production-grade contract processing (this is a demo, not a product)
- Real Azure Document Intelligence -- use simulated extraction for portability
- Multi-tenant support
- Mobile-responsive design (optimized for large screen/projector demos)

### 4.2 AI/ML Requirements

#### Technology Classification

- [x] **AI/ML powered** - requires model inference (LLM for contract analysis)
- [ ] Rule-based / statistical
- [ ] Hybrid

#### Model Requirements

| Requirement | Specification |
|-------------|---------------|
| **Model Type** | LLM (text understanding, extraction, reasoning) |
| **Provider** | Microsoft Foundry (GPT-4o primary, GPT-4o-mini for model swap demo) |
| **Latency** | Near-real-time (<10s per agent step for demo pacing) |
| **Quality Threshold** | Extraction accuracy >= 85%, Compliance precision >= 80% |
| **Cost Budget** | Demo budget -- minimal (few hundred requests per demo run) |
| **Data Sensitivity** | Synthetic data only -- no PII, no real contracts |

#### Inference Pattern

- [x] Real-time API (user-facing, visible in dashboard)
- [ ] Batch processing
- [x] RAG (clause library lookup, policy index)
- [ ] Fine-tuned model
- [x] Agent with tools (MCP tool calls)
- [x] Multi-agent orchestration (sequential pipeline with HITL)

#### Data Requirements

- **Evaluation data**: 5 sample contracts with ground truth annotations (20 total eval cases)
- **Grounding data**: Company policy index (10 policy rules), clause library (50 standard clauses)
- **Data sensitivity**: Fully synthetic -- safe for public demos
- **Volume**: ~5-20 requests per demo run (not a scale concern)

#### AI-Specific Acceptance Criteria

- [ ] Model produces structured JSON outputs for extraction results
- [ ] Inference completes within 10 seconds per agent step (demo pacing)
- [ ] Evaluation dataset has ground truth for all 5 sample contracts
- [ ] Quality gate blocks deployment when accuracy drops below threshold
- [ ] Graceful fallback: agents return "unable to process" on model failure (no hallucinated data)
- [ ] Model version pinned explicitly for reproducible demos
- [ ] All prompts stored as separate files in `prompts/` directory (not inline in code)
- [ ] LLM-as-judge evaluator scores agent outputs on relevance (0-5), groundedness (0-5), and coherence (0-5)
- [ ] Judge LLM uses GPT-4o with structured output schema for scoring consistency

### 4.3 Non-Functional Requirements

#### Performance

- **Response Time**: Each agent step completes within 10 seconds (demo-appropriate pacing)
- **Dashboard Load**: UI renders within 2 seconds
- **Concurrent Users**: 1 (single presenter)

#### Security

- **Authentication**: API keys via environment variables (demo setup)
- **Data Protection**: No real data -- all synthetic contracts
- **RBAC**: Demonstrated conceptually in Agent 365 governance view

#### Usability

- **Setup**: Clone + install + run in under 10 minutes
- **Accessibility**: WCAG 2.1 AA for dashboard (contrast, keyboard navigation)
- **Browser**: Chrome, Edge (latest)

---

## 5. User Stories & Features

### Feature 1: Contract Intake MCP Server + Design Canvas UI

**Description**: Design, configure, validate, and activate agent workflows before runtime execution
**Priority**: P0

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority |
|----------|---------|-----------|------------|---------------------|----------|
| US-1.1 | Workflow designer | to add a new agent with name, icon, role, model, tools, boundary, and output expectations | I can compose a custom workflow instead of using a fixed pipeline | - [ ] Add Agent action opens a form or modal<br>- [ ] Name, icon, and role are required<br>- [ ] New agent appears in the workflow after save | P0 |
| US-1.2 | Workflow designer | to edit and remove existing agents | I can refine or simplify the workflow safely | - [ ] Edit action opens pre-filled values<br>- [ ] Delete requires confirmation<br>- [ ] Order and remaining agent metadata stay consistent after changes | P0 |
| US-1.3 | Workflow designer | to select tools from available MCP servers for each agent | each agent has an explicit bounded tool set | - [ ] Tools are grouped by MCP server<br>- [ ] Selected tools appear on the agent card or details panel<br>- [ ] Tool choices persist with the workflow | P0 |
| US-1.4 | Workflow designer | to choose workflow topology such as sequential, parallel, sequential plus HITL, fan-out, or conditional | I can represent different orchestration patterns | - [ ] Workflow type is selectable in the design view<br>- [ ] Visual layout updates to reflect the chosen topology<br>- [ ] Workflow type persists when saved | P0 |
| US-1.5 | Workflow designer | to reorder agents in the workflow | I can control execution order and stage layout | - [ ] Agent cards can be reordered interactively<br>- [ ] Order changes persist after save and reload | P0 |
| US-1.6 | Workflow designer | to save and load workflow definitions | I can reuse and iterate on multiple designs | - [ ] Save writes to the workflow API with local fallback if needed<br>- [ ] Load shows saved workflows with name, type, agent count, and last updated date<br>- [ ] Delete from the saved list is supported | P0 |
| US-1.7 | Workflow designer | to push the designed workflow into the rest of the pipeline | Test, Deploy, and Live stages reflect the active design | - [ ] Push to Pipeline saves and activates the workflow<br>- [ ] Active workflow is visible to downstream stages<br>- [ ] Activation status is confirmed to the user | P0 |
| US-1.8 | Workflow designer | to see validation feedback during authoring, save, and push | invalid designs are caught before testing or deployment | - [ ] Structural errors are shown inline in the design experience<br>- [ ] Save is blocked when structural errors exist<br>- [ ] Push is blocked when structural errors exist<br>- [ ] Warnings remain visible but do not block progress | P0 |
| US-1.9 | Presenter | to upload a contract PDF to the dashboard after choosing a workflow | the audience sees the contract enter the active pipeline | - [ ] Upload button accepts PDF or representative text input<br>- [ ] Contract type is classified once the runtime begins<br>- [ ] Active workflow is clearly associated with the submitted contract | P0 |
| US-1.10 | Developer | MCP server to expose `upload_contract`, `classify_document`, `extract_metadata` tools | the intake stage can classify and prepare contract inputs via MCP | - [ ] 3 MCP tools registered and callable<br>- [ ] JSON schema defined for inputs and outputs | P0 |

### Feature 2: Extraction MCP Server + Workflow Test Lab UI

**Description**: Run scenario-based workflow tests against representative contracts and expected outcomes
**Priority**: P0

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority |
|----------|---------|-----------|------------|---------------------|----------|
| US-2.1 | Presenter | to select realistic contract scenarios with expected workflow outcomes | the audience sees what the workflow is being tested against | - [ ] Scenario selector with representative contract cases<br>- [ ] Scenario brief and expected outcomes visible<br>- [ ] Clear explanation of intended workflow behavior | P0 |
| US-2.2 | Presenter | to run workflow-level tests instead of raw tool tests | the audience understands whether the designed workflow is actually ready | - [ ] Run single scenario and run-all actions<br>- [ ] Results summary with pass/warn/fail counts<br>- [ ] Stage trace showing the expected workflow path | P0 |
| US-2.3 | Developer | MCP server to expose `extract_clauses`, `identify_parties`, `extract_dates_values` tools | extraction agent can pull structured data from contracts | - [ ] 3 MCP tools with typed inputs/outputs<br>- [ ] Tools return structured JSON | P0 |

### Feature 3: Compliance MCP Server + Deploy Dashboard UI

**Description**: Check contract clauses against company policies, show deployment status
**Priority**: P0

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority |
|----------|---------|-----------|------------|---------------------|----------|
| US-3.1 | Presenter | to see a traffic-light view of compliance results per clause | the audience sees which clauses pass/warn/fail against policies | - [ ] Green: compliant, Yellow: review needed, Red: policy violation<br>- [ ] Each result links to the specific policy rule | P0 |
| US-3.2 | Presenter | to see CI/CD deployment status and Foundry Agent Service registration | the audience sees what "deploy" looks like for agents | - [ ] Pipeline stages: Build -> Test -> Deploy -> Register<br>- [ ] Agent 365 registration confirmation with Entra Agent IDs shown | P0 |
| US-3.3 | Developer | MCP server to expose `check_policy`, `flag_risk`, `get_policy_rules` tools | compliance agent can evaluate clauses against the policy index | - [ ] 3 MCP tools with policy lookup<br>- [ ] Risk levels: low/medium/high/critical | P0 |

### Feature 4: Workflow MCP Server + Live Workflow UI

**Description**: Orchestrate the multi-agent pipeline with HITL escalation, animated flow visualization
**Priority**: P0

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority |
|----------|---------|-----------|------------|---------------------|----------|
| US-4.1 | Presenter | to watch a contract flow through all 4 agents in real time with animated nodes | the audience sees the "wow moment" -- agents processing live | - [ ] Nodes light up as each agent processes<br>- [ ] Tool calls appear as sub-nodes<br>- [ ] Status badges update in real time | P0 |
| US-4.2 | Presenter | high-risk contracts to pause at the Approval Agent for human review | the audience sees HITL in action | - [ ] Pipeline pauses with "Awaiting Human Review" badge<br>- [ ] Approve/Reject/Request Changes buttons visible<br>- [ ] Decision logged with reviewer name and timestamp | P0 |
| US-4.3 | Developer | MCP server to expose `route_approval`, `escalate_to_human`, `notify_stakeholder` tools | workflow agent can manage multi-agent routing and HITL | - [ ] 3 MCP tools for workflow orchestration<br>- [ ] HITL state persisted until human responds | P0 |

### Feature 5: Audit MCP Server + Monitor Panel UI

**Description**: Log all agent decisions, display traces, latency, and decision audit trail
**Priority**: P0

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority |
|----------|---------|-----------|------------|---------------------|----------|
| US-5.1 | Presenter | to see App Insights-style traces for each contract processed | the audience sees full observability -- what each agent did, which tools it called, how long it took | - [ ] Traces grouped by contract ID<br>- [ ] Expandable tree: Agent -> Tool Calls -> Inputs/Outputs<br>- [ ] Latency bars per step | P0 |
| US-5.2 | Presenter | to see a decision audit trail explaining why the agent took each action | the audience understands agent reasoning is auditable | - [ ] Timeline view of all decisions<br>- [ ] Each decision shows: agent, action, reasoning, timestamp | P0 |
| US-5.3 | Developer | MCP server to expose `log_decision`, `generate_report`, `query_history` tools | audit agent can record and retrieve decision history | - [ ] 3 MCP tools for audit logging<br>- [ ] History queryable by contract ID, agent, time range | P0 |

### Feature 6: Evaluation MCP Server + Evaluation Lab UI

**Description**: Run evaluation suites, compare baselines, display quality gates
**Priority**: P1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority |
|----------|---------|-----------|------------|---------------------|----------|
| US-6.1 | Presenter | to run an evaluation suite of 20 test cases and see pass/fail results | the audience sees automated quality validation in action | - [ ] "Run Suite" button triggers evaluation<br>- [ ] Per-contract pass/fail with drill-in<br>- [ ] Aggregate metrics: accuracy, precision, recall, F1 | P1 |
| US-6.2 | Presenter | to compare current agent version vs. baseline side-by-side | the audience sees version-over-version improvement tracking | - [ ] Baseline (v1) vs. current (v2) metrics table<br>- [ ] Delta indicators (green up, red down) | P1 |
| US-6.3 | Presenter | to see a quality gate pass/fail decision | the audience understands that agents must pass quality checks before deployment | - [ ] Quality gate card: PASS (green) or FAIL (red)<br>- [ ] Criteria shown: accuracy threshold, false-flag rate, latency P95 | P1 |
| US-6.4 | Developer | MCP server to expose `run_evaluation`, `compare_baseline`, `evaluate_single`, `get_quality_metrics`, `check_quality_gate`, `judge_output` tools | evaluation engine can run comprehensive quality analysis including LLM-as-judge | - [ ] 6 MCP tools for evaluation pipeline<br>- [ ] Ground truth comparison logic<br>- [ ] LLM-as-judge scoring (relevance, groundedness, coherence) | P1 |
| US-6.5 | Presenter | to see LLM-as-judge scores alongside deterministic metrics for each contract | the audience sees both automated and AI-based quality evaluation | - [ ] Per-contract judge scores: relevance, groundedness, coherence (0-5)<br>- [ ] Average judge scores in aggregate metrics panel<br>- [ ] Side-by-side: ground-truth F1 vs. judge scores | P1 |

### Feature 7: Drift Detection MCP Server + Drift Detection Center UI

**Description**: Detect and visualize LLM drift, data drift, and model swap impact
**Priority**: P1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority |
|----------|---------|-----------|------------|---------------------|----------|
| US-7.1 | Presenter | to see LLM drift visualized as accuracy degradation over time | the audience understands that LLM quality is not static -- it drifts | - [ ] Line chart: accuracy over weeks (simulated)<br>- [ ] Drift threshold line with "DRIFT DETECTED" alert<br>- [ ] Trend direction indicator | P1 |
| US-7.2 | Presenter | to see data drift when new contract types appear that were not in training | the audience sees how changing input distributions affect agents | - [ ] Distribution chart: contract types over time<br>- [ ] New type highlighted (e.g., "AI Liability clause -- 15% of recent contracts")<br>- [ ] "SHIFT DETECTED" alert | P1 |
| US-7.3 | Presenter | to simulate a model swap (GPT-4o to GPT-4o-mini) and see impact | the audience sees the cost-quality tradeoff in concrete terms | - [ ] Side-by-side: accuracy, latency, cost per model<br>- [ ] Verdict card: "ACCEPTABLE" or "DEGRADED" based on threshold | P1 |
| US-7.4 | Developer | MCP server to expose `detect_llm_drift`, `detect_data_drift`, `simulate_model_swap`, `get_drift_timeline`, `recommend_action` tools | drift detection engine can analyze agent quality over time | - [ ] 5 MCP tools for drift analysis<br>- [ ] Simulated historical data for demo | P1 |

### Feature 8: Feedback MCP Server + Feedback & Optimize Loop UI

**Description**: Collect human feedback, convert to test cases, close the improvement loop
**Priority**: P1

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority |
|----------|---------|-----------|------------|---------------------|----------|
| US-8.1 | Presenter | to submit feedback on agent outputs (thumbs up/down + comment) | the audience sees human-in-the-loop feedback collection | - [ ] Feedback widget on each agent output<br>- [ ] Thumbs up/down + free-text comment<br>- [ ] Feedback saved with agent ID, contract ID, timestamp | P1 |
| US-8.2 | Presenter | to see feedback trends and identify the weakest agent | the audience understands feedback-driven prioritization | - [ ] Bar chart: positive % per agent<br>- [ ] "Top Issue" callout (e.g., "Compliance Agent: false flag rate")<br>- [ ] Week-over-week trend | P1 |
| US-8.3 | Presenter | to convert negative feedback into new eval test cases and re-run | the audience sees the closed feedback-to-improvement loop | - [ ] "Optimize Now" button: converts N negative feedbacks to test cases<br>- [ ] "Re-Evaluate" button: runs updated eval suite<br>- [ ] Before/after metrics shown | P1 |
| US-8.4 | Presenter | to update a prompt and see metrics improve after re-evaluation | the audience sees the full optimize cycle complete | - [ ] Prompt editor for compliance agent instructions<br>- [ ] Re-run evaluations after prompt change<br>- [ ] Improvement delta displayed | P1 |
| US-8.5 | Developer | MCP server to expose `submit_feedback`, `get_feedback_summary`, `feedback_to_training`, `trigger_improvement`, `close_feedback_loop` tools | feedback engine can manage the full improvement lifecycle | - [ ] 5 MCP tools for feedback management<br>- [ ] Feedback persistence (JSON file store) | P1 |

---

## 6. User Flows

### Primary Flow: End-to-End Demo (The 8-Act Story)

**Trigger**: Presenter opens the Contract AgentOps Dashboard
**Preconditions**: All 8 MCP servers running, sample contracts loaded, dashboard accessible

**Steps**:

1. **Act 1 -- Design Canvas**: Presenter creates or loads a workflow, configures agents, validates the design, and activates it. The audience sees that workflow design is interactive rather than hardcoded.

2. **Act 2 -- Workflow Test Lab**: Presenter selects a representative scenario such as a high-risk MSA and runs the workflow test. The dashboard shows expected outcomes, workflow coverage, and pass/warn/fail results. Audience sees whether the designed workflow is fit for purpose.

3. **Act 3 -- Deploy Dashboard**: Presenter triggers a simulated deployment pipeline. Shows stages: Build -> Test -> Deploy -> Register. Agent 365 IDs appear. Agents are now "live."

4. **Act 4 -- Live Workflow**: Presenter drops a sample NDA into the intake. The workflow view animates: Intake (classifies) -> Extraction (pulls terms) -> Compliance (checks policies -- flags liability cap > $1M) -> Approval (routes to human). Pipeline pauses. Presenter approves. Contract moves to "Archived."

5. **Act 5 -- Monitor Panel**: Presenter switches to the monitor view. Shows traces for the NDA just processed -- every agent step, every tool call, latency bars. Expands the Compliance Agent trace to show its reasoning.

6. **Act 6 -- Evaluation Lab**: Presenter clicks "Run Suite." 20 test contracts are evaluated. Results: 17 pass, 3 fail. Quality gate: PASS (85% > 80% threshold). Baseline comparison shows +3.1% vs. v1. LLM-as-judge scores: relevance 4.6/5, groundedness 4.3/5, coherence 4.8/5. Judge flags MSA-003 extraction as low-groundedness (2.1/5).

7. **Act 7 -- Drift Detection**: Presenter opens the drift view. LLM drift chart shows accuracy declining: 92% -> 88% -> 81% over 4 weeks (simulated). "DRIFT DETECTED" alert. Data drift: new "AI Liability" clause type appearing in 15% of recent contracts. Model swap: GPT-4o-mini saves 60% cost with only 3% accuracy drop.

8. **Act 8 -- Feedback Loop**: Presenter submits feedback: "Missed termination clause in Exhibit B." Clicks "Optimize Now" -- negative feedback becomes a test case. Clicks "Re-Evaluate" -- updated suite runs. Opens prompt editor, adds instruction for exhibit scanning. Re-evaluates -- accuracy improves to 91%. Shows the loop closing.

**Success State**: Audience has seen all 8 AgentOps stages live, with real data flowing through the system.

### Secondary Flow: Developer Self-Guided Exploration

**Trigger**: Developer clones the repo and runs `npm start`
**Steps**:
1. Developer reads README, installs dependencies (`npm install`)
2. Starts MCP servers + gateway + dashboard (single `npm start` command)
3. Follows interactive tutorial overlay (optional)
4. Explores each stage by processing sample contracts

### Alternative Flows

- **Flow A: MCP-Only Demo (No UI)**: Run MCP tools from command line or Copilot Chat -- useful for developer-focused audiences.
- **Flow B: Single Stage Deep-Dive**: Zoom into one stage (e.g., Evaluation Lab only) for a focused 5-minute demo.
- **Flow C: Failure Scenario**: Submit a contract that deliberately fails compliance -- show how the system handles rejected contracts.

---

## 7. Dependencies & Constraints

### Technical Dependencies

| Dependency | Type | Status | Impact if Unavailable |
|------------|------|--------|----------------------|
| Microsoft Foundry (GPT-4o) | External | Available | HIGH -- core agent inference. Fallback: use simulated responses |
| Node.js 20+ | Runtime | Available | HIGH -- gateway, UI, and MCP control plane |
| Python 3.11+ | Runtime | Available | HIGH -- Microsoft Agent Framework executor runtime |
| @modelcontextprotocol/sdk | Library | Available | HIGH -- official MCP TypeScript SDK |
| Microsoft Agent Framework + Foundry SDK/runtime | Library | Available | HIGH -- primary agent orchestration path |
| Static dashboard UI served by gateway | Frontend | Available | MEDIUM -- primary operator experience |
| Fastify + ws | Library | Available | MEDIUM -- API gateway + WebSocket |

### Technical Constraints

- Must run locally without Azure subscription (simulated mode) for maximum demo portability
- Must also support live Foundry mode when Azure is available
- All sample data must be synthetic -- no real contracts or PII
- MCP servers must follow the standard MCP protocol for interoperability
- All prompts stored in `prompts/` directory as `.md` files (not inline in code)

### Resource Constraints

- Single developer (with AI assistance)
- Demo-quality (not production-grade) -- focus on visual impact and correctness, not scale

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Foundry API unavailable during demo | High | Low | Implement simulation mode with pre-recorded responses |
| MCP SDK breaking changes (preview) | Medium | Medium | Pin versions, abstract MCP layer |
| LLM responses non-deterministic | Medium | High | Use temperature=0, seed parameter; cache responses for demo reliability |
| Demo takes too long (>20 min) | Medium | Medium | Build "fast forward" buttons and pre-loaded states |
| Audience questions exceed demo scope | Low | High | Prepare FAQ slide, have simulated data for ad-hoc queries |
| Model quality insufficient for extraction | High | Low | Use GPT-4o with structured outputs; pre-validate all 5 sample contracts |

---

## 9. Timeline & Milestones

### Phase 1: Foundation (Core Pipeline)

**Goal**: 4 core agents + 5 MCP servers (Intake, Extraction, Compliance, Workflow, Audit) + Live Workflow UI
**Deliverables**:
- Contract agent definitions with prompts in `prompts/` directory
- MCP servers 1-5 with tool implementations
- Static dashboard: Design Canvas + Workflow Test Lab + Live Workflow + Monitor Panel views
- 5 sample contract PDFs with ground truth
- Agent orchestration via Microsoft Agent Framework

**Stories**: US-1.1 through US-5.3

### Phase 2: AgentOps Layer (Evaluate + Drift + Feedback)

**Goal**: 3 Ops MCP servers (Evaluation, Drift, Feedback) + corresponding UI views
**Deliverables**:
- MCP servers 6-8 with tool implementations
- Static dashboard: Evaluation Lab + Drift Detection Center + Feedback Loop views
- Simulated drift data (4-week degradation curve)
- Evaluation ground truth dataset (20 test cases)
- Prompt editor with re-evaluation flow

**Stories**: US-6.1 through US-8.5

### Phase 3: Polish (Deploy + Governance + Demo Script)

**Goal**: Deploy Dashboard + Agent 365 Governance view + guided demo mode
**Deliverables**:
- Static dashboard: Deploy Dashboard + Governance View
- Demo script mode with presenter notes
- README with setup instructions
- Demo recording for async sharing

**Stories**: US-3.2, US-9 (P2), US-10 (P2)

---

## 10. Out of Scope

**Explicitly excluded**:

- Production contract processing system -- this is a demo, not a product
- Real Azure Document Intelligence OCR -- simulated extraction for portability
- Real Azure AI Search integration -- simulated search with local data
- Multi-tenant support or user authentication
- Mobile-responsive design (optimized for projector/large screen)
- Real CI/CD pipeline execution (simulated deployment stages)
- Real Agent 365 integration (governance view is simulated)
- Internationalization / multi-language contracts

**Future Considerations**:

- Convert demo into a workshop with hands-on labs
- Add industry-specific variants (healthcare, finance, government)
- Integrate with real Azure services for "production mode" demo

---

## 11. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| Should MCP servers use Python (FastMCP) or TypeScript? | Piyush | **Resolved** | **TypeScript** -- MCP remains a TypeScript business-tool boundary owned by the existing control plane |
| Should the runtime be Node-only or mixed | Piyush | **Resolved** | **Mixed runtime** -- TypeScript gateway, static UI, and MCP servers remain in place, while Python hosts the Microsoft Agent Framework executor |
| Should the dashboard use React or Streamlit? | Piyush | **Resolved** | **Static dashboard served by the gateway** -- the React track is archived and the static runtime is the canonical UI |
| How realistic should simulated drift data be? | Piyush | Open | Recommend 4-week simulated degradation with configurable parameters |
| Should we include a "reset demo" button? | Piyush | Open | Recommend yes -- essential for repeated demo runs |
| Pre-recorded vs. live LLM calls during demo? | Piyush | Open | Recommend hybrid: live by default, fallback to cached for reliability |

---

## 12. Appendix

### Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                Contract AgentOps Dashboard (Static UI served by gateway)           |
|  +----------+ +--------+ +--------+ +---------+ +---------+ +------+ +-----+ +-+ |
|  | Design   | | Test   | | Deploy | | Live    | | Monitor | | Eval | |Drift| |FB||
|  | Canvas   | | Console| | Dash   | | Workflow| | Panel   | | Lab  | | Ctr | |  ||
|  +----------+ +--------+ +--------+ +---------+ +---------+ +------+ +-----+ +-+ |
+-----------------------------------------------------------------------------------+
        |             |          |           |           |         |        |      |
+-----------------------------------------------------------------------------------+
|               Agent Orchestration (Microsoft Agent Framework)                      |
|  [Intake Agent] --> [Extraction Agent] --> [Compliance Agent] --> [Approval Agent] |
+-----------------------------------------------------------------------------------+
        |             |          |           |           |         |        |      |
+-----------------------------------------------------------------------------------+
|                         MCP Server Layer (8 Servers)                               |
| [Intake] [Extract] [Compliance] [Workflow] [Audit] [Eval] [Drift] [Feedback]      |
+-----------------------------------------------------------------------------------+
        |             |          |           |
+-----------------------------------------------------------------------------------+
|                         Data Layer                                                 |
| [Sample Contracts] [Policy Index] [Clause Library] [Eval Ground Truth] [Feedback] |
+-----------------------------------------------------------------------------------+
```

### MCP Server Inventory

| # | Server Name | Tools | AgentOps Stage |
|---|-------------|-------|----------------|
| 1 | contract-intake-mcp | `upload_contract`, `classify_document`, `extract_metadata` | Design |
| 2 | contract-extraction-mcp | `extract_clauses`, `identify_parties`, `extract_dates_values` | Test |
| 3 | contract-compliance-mcp | `check_policy`, `flag_risk`, `get_policy_rules` | Deploy |
| 4 | contract-workflow-mcp | `route_approval`, `escalate_to_human`, `notify_stakeholder` | Run |
| 5 | contract-audit-mcp | `log_decision`, `generate_report`, `query_history` | Monitor |
| 6 | contract-eval-mcp | `run_evaluation`, `compare_baseline`, `evaluate_single`, `get_quality_metrics`, `check_quality_gate`, `judge_output` | Evaluate |
| 7 | contract-drift-mcp | `detect_llm_drift`, `detect_data_drift`, `simulate_model_swap`, `get_drift_timeline`, `recommend_action` | Detect |
| 8 | contract-feedback-mcp | `submit_feedback`, `get_feedback_summary`, `feedback_to_training`, `trigger_improvement`, `close_feedback_loop` | Feedback |

### Contract Agent Definitions

| Agent | Model | Tools (MCP) | Boundaries |
|-------|-------|-------------|------------|
| Intake Agent | GPT-4o | Intake MCP | Classify and route only -- no extraction or compliance |
| Extraction Agent | GPT-4o | Extraction MCP | Extract terms only -- no compliance judgment |
| Compliance Agent | GPT-4o | Compliance MCP | Flag risks against policy -- no approval authority |
| Approval Agent | GPT-4o | Workflow MCP | Route approvals, escalate -- no policy changes |

### Design Canvas Notes

| Topic | Decision |
|-------|----------|
| Workflow authoring source of truth | Design Canvas in the static dashboard |
| Supported topologies | Sequential, parallel, sequential plus HITL, fan-out, conditional |
| Persistence | Save and load through the workflow API, with local fallback when needed |
| Validation | Structural validation occurs during authoring, save, and push |
| Advanced controls | Export and enhanced canvas navigation are desirable but secondary to the core authoring flow |

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Dashboard | Static HTML/CSS/JS served by gateway | 8 interactive views |
| MCP Servers | TypeScript + @modelcontextprotocol/sdk | 8 tool servers |
| API Gateway | Fastify + ws (TypeScript) | REST API + WebSocket |
| Agent Orchestration | Python Microsoft Agent Framework with Foundry | Multi-agent pipeline |
| LLM (Agents) | Microsoft Foundry (GPT-4o) | Agent reasoning |
| LLM (Judge) | Microsoft Foundry (GPT-4o) | Evaluation scoring (LLM-as-judge) |
| Data Store | Local JSON files | Contracts, feedback, eval results |
| Charts | Native UI charts and dashboard visualizations | Drift trends, eval metrics, feedback trends |
| Styling | Static dashboard styles | Dashboard design |
| Runtime | Mixed: Node.js 20+ plus Python 3.11+ | TypeScript control plane plus Python execution plane |

### Glossary

- **AgentOps**: The discipline of operationalizing AI agents end-to-end (build, deploy, monitor, evaluate, optimize)
- **MCP**: Model Context Protocol -- standard for tools that AI agents can call
- **HITL**: Human-in-the-Loop -- requiring human approval for high-risk decisions
- **LLM-as-Judge**: Using a separate LLM instance to score agent outputs on qualitative dimensions (relevance, groundedness, coherence)
- **LLM Drift**: Quality degradation of LLM outputs over time (model updates, distribution changes)
- **Data Drift**: Change in the distribution of incoming data vs. what agents were trained/prompted for
- **Quality Gate**: Automated pass/fail check that blocks deployment if quality thresholds are not met
- **Ground Truth**: Known-correct answers used to evaluate agent accuracy

### Related Documents

- [AgentOps Presentation Script](../../scripts/generate_agentops_pptx.py)
- [Technical Specification](../specs/SPEC-ContractAgentOps-Demo.md)
- [Architecture Decision Record](../adr/ADR-ContractAgentOps-Demo.md)

---

## Review & Approval

| Stakeholder | Role | Status | Date | Comments |
|-------------|------|--------|------|----------|
| Piyush Jain | Creator/Lead | Pending | 2026-03-04 | Initial draft |

---

**Generated by AgentX Product Manager Agent**
**Last Updated**: 2026-03-04
**Version**: 1.0
