# Model Card - ContractAgentOps Demo

## Scope

This document records the current model posture for the Contract AgentOps demo and the limitations that matter for evaluation, drift review, and release decisions.

## Model Inventory

| Role | Current Model | Source | Notes |
|------|---------------|--------|-------|
| Primary runtime default | `gpt-5.1-2026-01-15` | `agents/microsoft-framework/config.py` | Default primary model for the Python executor. [Confidence: HIGH] |
| Fallback | `gpt-4o-2026-01-15` | `agents/microsoft-framework/config.py`, `config/workflows/contract-processing.yaml` | Used for fallback routing and documented model swap comparisons. [Confidence: HIGH] |
| Emergency fallback | `gpt-4o-mini-2026-01-15` | `agents/microsoft-framework/config.py`, `config/workflows/contract-processing.yaml` | Lower-cost emergency path with accepted quality degradation threshold of 5%. [Confidence: HIGH] |
| Judge model family in demo docs | `gpt-4o` family | PRD and UX artifacts | Judge scoring is modeled as an LLM-as-judge layer, but repo-local evaluation is deterministic simulation today. [Confidence: HIGH] |

## Intended Responsibilities

| Agent | Primary Responsibility | Output Contract |
|-------|------------------------|-----------------|
| Intake | Contract type classification plus initial metadata | `config/schemas/intake-result.json` |
| Extraction | Clause, party, date, and value extraction | `config/schemas/extraction-result.json` |
| Compliance | Policy scoring, violations, and escalation signals | `config/schemas/compliance-result.json` |
| Approval | Decision, conditions, and next actions | `config/schemas/approval-result.json` |

The prompt files, templates, examples, and schema definitions are now aligned to these declarative contracts. [Confidence: HIGH]

## Current Quality Posture

- Latest stored `v1.3` evaluation on the active 57-case corpus returned `39/57` passed, `68.4%` overall accuracy, and `FAIL` for the quality gate. [Confidence: HIGH]
- Individual metric snapshots remain stronger than end-to-end pass rate: extraction `87.5%`, compliance `83.5%`, classification `91.5%`, false-flag rate `9.9%`, latency P95 `2.3s`. [Confidence: HIGH]
- The strict end-to-end gate is driven by per-contract combined pass criteria plus judge thresholds, so partial strength in individual metrics does not imply release readiness. [Confidence: HIGH]

## Known Limitations

- The historical 20-case `v1.3` result is preserved in `data/evaluations.json`, but it is no longer representative of the active ground-truth corpus and should not be used for release gating. [Confidence: HIGH]
- The 57-case corpus includes broader contract families such as AI Services, Government Contract, Franchise, Lease, Insurance, and adversarial cases. This wider coverage exposes classification and cross-stage consistency gaps that were hidden in the smaller corpus. [Confidence: HIGH]
- The intake prompt taxonomy currently enumerates many, but not all, corpus contract families. Corpus entries such as `Consortium` and `Partnership` should be treated as active evaluation pressure and may require taxonomy expansion or normalization rules. [Confidence: MEDIUM]

## Guardrails And Responsible AI

- Structured JSON output is enforced through declarative schemas and runtime validation. [Confidence: HIGH]
- Human escalation remains explicit in compliance and approval outputs via `approval_required`, `blocking_issues`, and `escalation_required`. [Confidence: HIGH]
- Drift detection is modeled for both output quality degradation and data distribution shifts; the repo currently stores deterministic drift evidence in `data/drift.json`. [Confidence: HIGH]
- Prompts now prohibit legacy output shapes that diverge from schema contracts, reducing silent prompt/schema drift risk. [Confidence: HIGH]

## Release Interpretation

The demo is operational for walkthrough and engineering validation, but the current `v1.3` evaluation baseline does not support a claim of production-quality promotion on the active corpus. Promotion should require a passing rerun on the 57-case suite, not on the legacy 20-case subset. [Confidence: HIGH]