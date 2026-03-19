# Agent Prompt And Versioning Audit

Date: 2026-03-18
Scope: Contract AgentOps prompt quality by agent, contract-type coverage, and versioning status for agents, prompts, training/eval assets, and inference pipeline assets.

## Executive Summary

- Core intake, extraction, compliance, and approval prompts are structured well and enforce schema discipline.
- Only intake is explicitly contract-family aware.
- Drafting, review, negotiation, signature, obligations, renewal, and analytics prompts are role-correct but generic and not specialized by contract family.
- Agent versioning exists and is consistent at the YAML level.
- Prompt versioning is only implicit via Git. Prompt files do not carry explicit prompt metadata or version headers.
- Training and evaluation assets are partially versioned.
- Inference workflow versioning exists, but runtime model lineage is not fully aligned with declarative agent manifests.
- Several non-core agents are wired to the wrong output templates, which is the highest-priority defect found in this audit.

## Asset Versioning Status

| Asset Type | Status | Evidence | Notes |
|---|---|---|---|
| Agents | Yes | `version: 1.0.0` in agent YAML files | Good baseline; model names are also pinned with dated versions |
| Prompts | Partial | File-based and Git-versioned only | No explicit `prompt_version`, owner, or target-model metadata inside prompt files |
| Training / few-shot data | Partial | Core example files exist; eval runs versioned as `v1.3` | No dataset manifest or version per example set; no few-shot assets for most non-core agents |
| Inference pipeline | Yes, partial | `workflow_version` in runtime packages | Good workflow packaging, but runtime model defaults do not fully match agent YAML model pins |

## Per-Agent Audit

| Agent | Prompt Quality | Contract-Type Coverage | Template / Schema Alignment | Few-Shot Coverage | Versioning | Notes |
|---|---|---|---|---|---|---|
| Intake | Strong | Strong | Aligned | Present | Good | Best prompt in the repo for contract-family coverage |
| Extraction | Good | Medium | Aligned | Present | Good | Clause taxonomy is solid, but family-specific extraction guidance is thin |
| Compliance | Good | Medium | Aligned | Present | Good | Policy themes are generic, not family-specific |
| Approval | Good | Medium | Aligned | Present | Good | Decision logic is clean, but not tailored by contract family |
| Drafting | Medium | Weak | Misaligned | Missing | Partial | Output template points to extraction template instead of drafting schema |
| Review | Medium | Weak | Misaligned | Missing | Partial | Output template points to approval template instead of review schema |
| Negotiation | Medium | Weak | Misaligned | Missing | Partial | Output template points to approval template instead of negotiation schema |
| Signature | Medium | Weak | Misaligned | Missing | Partial | Output template points to approval template instead of signature schema |
| Obligations | Medium | Weak | Misaligned | Missing | Partial | Output template points to extraction template instead of obligations schema |
| Renewal | Medium | Weak | Misaligned | Missing | Partial | Output template points to approval template instead of renewal schema |
| Analytics | Medium | Weak | Misaligned | Missing | Partial | Output template points to approval template instead of analytics schema |

## Detailed Findings

### 1. Intake Prompt Is The Only Prompt That Is Explicitly Contract-Family Aware

The intake prompt enumerates supported contract types directly in the prompt at [prompts/intake-system.md](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/prompts/intake-system.md#L17). This is good and matches the current expanded intake taxonomy.

Strengths:

- Explicit supported family list
- Clear schema instructions
- Confidence guidance for ambiguity handling
- Appropriate `UNKNOWN` fallback

Gap:

- No internal prompt metadata such as prompt version, target model, or last updated marker

### 2. Extraction Prompt Is Structurally Good But Not Family-Specific Enough

The extraction prompt defines a clause taxonomy at [prompts/extraction-system.md](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/prompts/extraction-system.md#L41) and enforces a clean JSON shape.

Strengths:

- Correct top-level schema discipline
- Good clause normalization rules
- Good treatment of dates and values

Gaps:

- No contract-family guidance for loan terms, lease economics, insurance coverage, public-sector terms, procurement milestones, franchise obligations, or distribution territory restrictions
- This prompt should branch by `contract_type` when the intake result is already available

### 3. Drafting, Review, And Negotiation Prompts Are Too Generic For The Current Contract Catalog

The drafting, review, and negotiation prompts are role-correct but generic:

- [prompts/drafting-system.md](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/prompts/drafting-system.md#L1)
- [prompts/review-system.md](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/prompts/review-system.md#L1)
- [prompts/negotiation-system.md](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/prompts/negotiation-system.md#L1)

Gaps:

- No mandatory clause guidance by contract family
- No family-specific fallback language patterns
- No family-specific review checklist
- No difference between financial contract review and software / data contract review

Impact:

- These prompts will work as generic legal copilots, but they will not consistently produce family-optimized output for the contract types now supported by intake

### 4. Non-Core Agent Configs Are Wired To The Wrong Output Templates

This is the most important implementation defect found.

Examples:

- [config/agents/drafting-agent.yaml](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/agents/drafting-agent.yaml#L19) uses `templates/extraction-result.json` while its real schema is [config/schemas/drafting-result.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/schemas/drafting-result.json#L1)
- [config/agents/review-agent.yaml](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/agents/review-agent.yaml#L19) uses `templates/approval-result.json` while its real schema is [config/schemas/review-result.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/schemas/review-result.json#L1)
- [config/agents/negotiation-agent.yaml](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/agents/negotiation-agent.yaml#L19) uses `templates/approval-result.json` while its real schema is [config/schemas/negotiation-result.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/schemas/negotiation-result.json#L1)
- [config/agents/obligations-agent.yaml](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/agents/obligations-agent.yaml#L19) uses `templates/extraction-result.json` while its real schema is [config/schemas/obligations-result.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/schemas/obligations-result.json#L1)
- [config/agents/renewal-agent.yaml](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/agents/renewal-agent.yaml#L19) uses `templates/approval-result.json`
- [config/agents/signature-agent.yaml](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/agents/signature-agent.yaml#L19) uses `templates/approval-result.json`
- [config/agents/analytics-agent.yaml](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/agents/analytics-agent.yaml#L19) uses `templates/approval-result.json` while its real schema is [config/schemas/analytics-result.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/config/schemas/analytics-result.json#L1)

Impact:

- Prompts and schemas can be correct while runtime prompt assembly is still wrong
- Foundry-style prompt validation and eval reproducibility are weakened
- Non-core agent outputs may be biased toward the wrong JSON shape

### 5. Few-Shot Assets Exist Only For The Core Four Agents

Present example assets:

- [examples/intake-examples.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/examples/intake-examples.json#L1)
- [examples/extraction-examples.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/examples/extraction-examples.json)
- [examples/compliance-examples.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/examples/compliance-examples.json)
- [examples/approval-examples.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/examples/approval-examples.json)

Current gap:

- No dedicated few-shot examples for drafting, review, negotiation, signature, obligations, renewal, or analytics
- Intake examples themselves are narrow and do not represent all supported contract families

### 6. Prompt Files Are File-Based But Not Explicitly Prompt-Versioned

Prompt files are stored correctly in the `prompts/` directory, which is good. However, they do not contain explicit prompt metadata such as:

- `prompt_version`
- `owner`
- `target_model`
- `supported_contract_types`
- `last_updated`

This affects:

- Prompt promotion discipline
- Auditability
- Foundry experiment traceability
- Safe rollback when prompt quality changes

### 7. Runtime Inference Versioning Exists But Model Lineage Is Split

Inference package versioning is good. The active workflow package contains `workflow_version` and runtime model policy at [data/runtime/active-workflow.json](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/data/runtime/active-workflow.json#L5).

However:

- Declarative agents pin dated models like `gpt-5.1-2026-01-15`
- Gateway runtime defaults use [gpt-5.4 and gpt-4o-mini](c:/Piyush%20-%20Personal/GenAI/Contract%20Management/gateway/src/config.ts#L49)

This means there is not yet one immutable manifest tying together:

- agent version
- prompt version
- dataset version
- workflow version
- exact deployed model version

## Foundry Readiness Assessment

If these assets were promoted into a stricter Foundry lifecycle today:

- Agent manifests: mostly ready
- Prompt files: need explicit version headers
- Few-shot datasets: incomplete
- Workflow packages: good foundation
- Eval history: good foundation
- Reproducibility: not complete due to model lineage split and missing prompt / dataset versions

## Recommended Fix Order

1. Fix all agent `output_template` miswirings.
2. Add prompt metadata headers to all prompt files.
3. Create missing templates for non-core agents if they do not already exist, then wire them correctly.
4. Add few-shot datasets for drafting, review, negotiation, obligations, renewal, signature, and analytics.
5. Expand intake and extraction few-shot coverage across all supported contract families.
6. Add contract-family-aware branching guidance to extraction, drafting, review, and negotiation prompts.
7. Introduce a single asset manifest that records agent version, prompt version, dataset version, workflow version, and runtime model version together.

## Recommended Prompt Metadata Header

Suggested header for each prompt file:

```text
Prompt-Version: 1.0.0
Owner: legal-ops
Target-Model: gpt-5.1-2026-01-15
Supported-Contract-Types: NDA, MSA, Services Agreement, SOW, SLA, Amendment, Sales Agreement, Distribution Agreement, Supply Agreement, License Agreement, SaaS / Cloud Services Agreement, Promissory Note, Loan Agreement, Employment, Joint Venture, Franchise, AI Services, Procurement, Consortium, Partnership, Lease, Insurance, Government Contract
Last-Updated: 2026-03-18
```

## Bottom Line

The repo has a strong base for prompt-managed agents, but it is only partially mature for full contract-family-aware prompting and Foundry-grade asset governance.

The two biggest issues are:

- non-core agents are wired to incorrect templates
- only intake is truly contract-family aware today

Everything else is optimization and governance work layered on top of that.