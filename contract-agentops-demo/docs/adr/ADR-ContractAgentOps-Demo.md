# ADR: Contract AgentOps Demo Architecture

**Decision ID**: ADR-ContractAgentOps
**Decision Title**: Enterprise-ready architecture for Contract AgentOps Demo using Microsoft Foundry and Microsoft Agent Framework
**Epic**: Contract AgentOps Demo
**Status**: Proposed
**Author**: Solution Architect Agent
**Date**: 2026-03-10
**Related PRD**: [PRD-ContractAgentOps-Demo.md](../prd/PRD-ContractAgentOps-Demo.md)
**Related Spec**: [SPEC-ContractAgentOps-Demo.md](../specs/SPEC-ContractAgentOps-Demo.md)
**Related UX**: [UX-ContractAgentOps-Dashboard.md](../ux/UX-ContractAgentOps-Dashboard.md)

---

## 1. Context

The Contract AgentOps Demo needs one clear architecture direction for enterprise discussions. The current repo already has a stable TypeScript gateway, static dashboard under `ui/`, eight MCP servers, a live Foundry deployment path, and an early Microsoft Agent Framework runtime track under `agents/microsoft-framework/`.

The architectural question is not whether the solution should use AI. The repo exists to demonstrate AgentOps for contract understanding, compliance reasoning, evaluation, drift handling, and human approval. Deterministic rules alone are insufficient for contract interpretation, exception handling, and risk explanation. At the same time, prompt-only orchestration is not sufficient for enterprise governance, recovery, and testability.

### AI-First Assessment

| Question | Assessment |
|----------|------------|
| Could this be solved without GenAI? | Partially, but not well enough for contract reasoning, summarization, exception handling, and policy interpretation. [Confidence: HIGH] |
| Should this be pure GenAI? | No. A pure prompt-only approach weakens governance, observability, fallback behavior, and release control. [Confidence: HIGH] |
| Recommended posture | Use GenAI for contract reasoning, but wrap it in deterministic tool boundaries, evaluation gates, policy retrieval, and human approval checkpoints. [Confidence: HIGH] |

### Research Summary

| Source | Evidence | Architectural Effect |
|--------|----------|----------------------|
| Microsoft Agent Framework documentation and repository | Supports agents, workflows, hosting, tools, middleware, OpenTelemetry, human-in-the-loop, Python and .NET, and migration from Semantic Kernel | Strong fit for enterprise agent runtime standardization. [Confidence: HIGH] |
| Microsoft Foundry documentation | Provides model hosting, Agent Service, tracing, evaluation, monitoring, safety, and governance surfaces | Strong fit for enterprise AI control plane. [Confidence: HIGH] |
| Foundry evaluation guidance | Supports model, agent, and dataset evaluations with AI-assisted quality, NLP, and safety metrics using CSV or JSONL datasets | Evaluation should be a formal release gate, not a smoke check. [Confidence: HIGH] |

### Constraints

| Constraint | Impact |
|-----------|--------|
| Demo runtime already works with TypeScript gateway plus static UI | Preserve these surfaces instead of rewriting them |
| MCP servers already express clean tool boundaries | Retain MCP as the business tool boundary |
| Simulated mode is required for reliable rehearsals and offline demos | Keep dual-mode execution |
| Enterprise story must be stronger than direct REST calls | Standardize on Microsoft Agent Framework for agent execution |

---

## 2. Decision Summary

| # | Decision | Choice |
|---|----------|--------|
| D1 | AI control plane | Microsoft Foundry for models, tracing, evaluation, and governance |
| D2 | Agent runtime | Microsoft Agent Framework as the primary orchestration and execution runtime |
| D3 | Development model | Hybrid declarative plus code model |
| D4 | Experience layer | Keep static dashboard and TypeScript gateway |
| D5 | Tool boundary | Keep eight MCP servers as bounded business tools |
| D6 | Execution mode | Keep live Foundry mode and simulated mode via adapter pattern |
| D7 | Human review | Approval and exception handling remain first-class workflow checkpoints |
| D8 | Evaluation strategy | Combine deterministic metrics, LLM-as-judge, and Foundry-native evaluation runs |
| D9 | Runtime operating model | Use a mixed runtime: TypeScript control plane plus Python Microsoft Agent Framework executor |

---

## 3. Options Considered

### Option A: Declarative-Only Agents on Foundry

```mermaid
graph LR
    U[Dashboard and Gateway] --> D[Prompts and YAML Only]
    D --> F[Foundry Models and Agent Service]
    F --> T[MCP Tools]
```

| Dimension | Assessment |
|-----------|------------|
| Strengths | Fast prompt iteration and lower initial engineering effort |
| Weaknesses | Weak runtime controls, weaker fallback behavior, weaker enterprise testability |
| Enterprise fit | Medium-Low |

### Option B: In-Code Agent Runtime on Microsoft Agent Framework

```mermaid
graph LR
    U[Dashboard and Gateway] --> R[Microsoft Agent Framework Runtime]
    R --> F[Foundry Models]
    R --> T[MCP Tools]
    R --> O[Tracing and Evaluation]
```

| Dimension | Assessment |
|-----------|------------|
| Strengths | Strong runtime control, workflow support, tool mediation, HITL, middleware, and tracing |
| Weaknesses | Slower change cycle if prompts and policies are kept only in code |
| Enterprise fit | High |

### Option C: Portal-First or Low-Code Agent Development

```mermaid
graph LR
    U[Dashboard and Gateway] --> P[Portal Configuration]
    P --> F[Foundry Managed Assets]
    F --> T[Connected Tools]
```

| Dimension | Assessment |
|-----------|------------|
| Strengths | Fastest experimentation path |
| Weaknesses | Weaker source control, promotion discipline, and runtime customization |
| Enterprise fit | Medium-Low |

### Option D: Hybrid Declarative Assets plus Microsoft Agent Framework Runtime (Selected)

```mermaid
graph TB
    UI[Static Dashboard and TypeScript Gateway]
    DA[Declarative Assets\nPrompts\nSchemas\nPolicies\nWorkflow Manifests]
    AF[Microsoft Agent Framework Runtime]
    FD[Microsoft Foundry\nModels\nAgent Service\nEvaluation\nTracing]
    MCP[Eight MCP Servers]

    UI --> AF
    DA --> AF
    AF --> FD
    AF --> MCP
```

| Dimension | Assessment |
|-----------|------------|
| Strengths | Best balance of governance, velocity, testing, traceability, and enterprise readiness |
| Weaknesses | More moving parts than prompt-only or portal-only options |
| Enterprise fit | Highest |

**Decision**: Select **Option D**. Use Microsoft Foundry as the enterprise AI control plane and Microsoft Agent Framework as the agent runtime, while keeping prompts, schemas, policy assets, and workflow manifests declarative. [Confidence: HIGH]

---

## 4. Target Architecture

```mermaid
graph TB
    subgraph Experience[Experience Layer]
        UI[Static Dashboard]
        GW[TypeScript Gateway]
    end

    subgraph Runtime[Agent Runtime Layer]
        AFR[Microsoft Agent Framework Runtime]
        WF[Workflow and HITL]
        MR[Model Routing and Fallback]
    end

    subgraph Control[Foundry Control Plane]
        FM[Foundry Models]
        FA[Foundry Agent Service]
        FE[Foundry Evaluation]
        FT[Foundry Tracing and Monitoring]
    end

    subgraph Tools[Tool Layer]
        MCP[Eight MCP Servers]
        DATA[Contracts Policies Clauses Audit Drift Feedback]
    end

    subgraph Assets[Declarative Assets]
        PR[Prompts]
        SC[Schemas]
        WM[Workflow Manifests]
        EV[Evaluation Datasets]
    end

    UI --> GW
    GW --> AFR
    AFR --> WF
    AFR --> MR
    AFR --> FM
    AFR --> FA
    AFR --> FE
    AFR --> FT
    AFR --> MCP
    MCP --> DATA
    PR --> AFR
    SC --> AFR
    WM --> AFR
    EV --> FE
```

### Agent Topology

| Agent | Purpose | Inputs | Outputs | Tools |
|-------|---------|--------|---------|-------|
| Intake Agent | Classify contract and extract initial metadata | Raw text and file metadata | Contract type and metadata | Intake MCP |
| Extraction Agent | Extract structured clauses and entities | Contract text plus intake result | Structured extraction record | Extraction MCP |
| Compliance Agent | Compare extracted clauses against policy set | Extraction output plus policy corpus | Risk findings and policy violations | Compliance MCP |
| Approval Agent | Decide approval path and HITL escalation | Compliance result plus workflow context | Approval decision and review routing | Workflow and audit MCP |

### Development Model

| Layer | Declarative | In Code |
|-------|-------------|---------|
| System prompts | Yes | No |
| Output schemas | Yes | No |
| Workflow manifests | Yes | No |
| Policy thresholds | Yes | No |
| Retry and fallback | No | Yes |
| HITL enforcement | No | Yes |
| Tool authorization | No | Yes |
| Middleware and observability | No | Yes |

### Runtime Operating Model

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Experience and control plane | TypeScript gateway plus static dashboard | Workflow authoring, validation, activation, operator APIs, deployment view, evaluation controls, and demo coordination |
| Business tool boundary | TypeScript MCP servers | Contract-domain tools, policy lookups, audit helpers, evaluation tools, drift tools, and feedback tools |
| Agent execution plane | Python Microsoft Agent Framework runtime | Multi-agent orchestration, model routing, tool mediation, HITL checkpoints, workflow state, retries, and tracing emission |
| AI control plane | Microsoft Foundry | Models, agent service integration, tracing, evaluation, content safety, and monitoring |

**Decision**: Do not force a Node-only runtime. The best-fit operating model is a mixed runtime where TypeScript remains the product and tool control plane, while Python becomes the primary Microsoft Agent Framework execution plane. [Confidence: HIGH]

---

## 5. Rationale

| Recommendation | Why | Confidence |
|----------------|-----|------------|
| Use Microsoft Foundry for model hosting, tracing, evaluation, and governance | The repo already uses Foundry in live mode and Foundry provides the clearest enterprise control plane story | [Confidence: HIGH] |
| Use Microsoft Agent Framework as the primary agent runtime | It replaces bespoke orchestration with workflow, middleware, tool, and hosting primitives aligned to enterprise agent systems | [Confidence: HIGH] |
| Keep the TypeScript gateway and static dashboard | They already work and form a stable user-facing control plane | [Confidence: HIGH] |
| Keep MCP as the business tool boundary | MCP servers already align with the demo lifecycle and keep agent permissions explicit | [Confidence: HIGH] |
| Keep simulated mode alongside live Foundry mode | Simulated mode protects demo reliability, while live mode remains the enterprise truth path | [Confidence: HIGH] |
| Externalize prompts, schemas, and workflow manifests | This preserves fast change velocity and reviewability without weakening runtime controls | [Confidence: HIGH] |
| Use Python rather than Node.js for the MAF executor | MAF is first-class in Python and .NET, while the repo already has a working TypeScript control plane that should not be rewritten | [Confidence: HIGH] |

### Why This Is the Enterprise Choice

| Enterprise Need | Declarative Only | In-Code Only | Hybrid with Foundry plus MAF |
|-----------------|------------------|--------------|------------------------------|
| Prompt and policy agility | Strong | Weak | Strong |
| Workflow safety and fallback | Weak | Strong | Strong |
| Auditability and promotion discipline | Medium | Strong | Strong |
| Observability | Medium | Strong | Strong |
| Long-term maintainability | Medium | Strong | Strong |

---

## 6. Consequences

### Positive

| Outcome | Effect |
|---------|--------|
| Single architecture story | The repo has one clear recommendation instead of competing orchestration patterns |
| Better enterprise posture | Evaluation, tracing, guardrails, and HITL become first-class, not optional |
| Clear migration path | Existing gateway, UI, MCP servers, datasets, and deployment automation can remain |
| Better governance | Declarative assets remain versioned and reviewable while runtime behavior stays explicit |

### Negative

| Outcome | Effect |
|---------|--------|
| More moving parts than prompt-only designs | Requires explicit runtime plus control-plane boundaries |
| Mixed-language operations | Intentionally keeps TypeScript control-plane code plus a Python agent runtime |
| Preview maturity risk | Agent Framework versions must be pinned and introduced carefully |

---

## 7. Delivery Guidance

| Area | Guidance |
|------|----------|
| Runtime migration | Promote `agents/microsoft-framework/` into the primary orchestration boundary in phases, but keep workflow authoring and activation in the TypeScript gateway |
| Evaluation | Require deterministic regression metrics plus Foundry evaluation runs before promotion |
| Guardrails | Enforce schema validation, tool allowlists, content safety checks, and approval checkpoints |
| Model management | Pin a primary model, a fallback model, and a smaller emergency model in Foundry |
| Evidence | Persist workflow IDs, agent outputs, model versions, review actions, and evaluation results |
| Runtime contract | Treat the gateway as the source of truth for active workflow definitions and the Python MAF executor as the source of truth for in-flight execution state |

---

## 8. References

### Internal

- [PRD-ContractAgentOps-Demo.md](../prd/PRD-ContractAgentOps-Demo.md)
- [UX-ContractAgentOps-Dashboard.md](../ux/UX-ContractAgentOps-Dashboard.md)
- `agents/microsoft-framework/`

### External

- Microsoft Agent Framework documentation and repository
- Microsoft Foundry documentation
- Foundry evaluation guidance
- Model Context Protocol specification

---

## 9. Review History

| Date | Reviewer | Status | Notes |
|------|----------|--------|-------|
| 2026-03-10 | Solution Architect Agent | Proposed | Consolidated to one canonical architecture document using Microsoft Foundry plus Microsoft Agent Framework |

---

**Generated by AgentX Architect Agent**
**Author**: Solution Architect Agent
**Last Updated**: 2026-03-10
**Version**: 2.0
