# AgentOps Report - ContractAgentOps Demo

## Scope

This report documents the evidence surfaces that currently exist for evaluation, drift, feedback, and auditability in the repo.

## Repo-Local Evidence Surfaces

| Surface | Path | Purpose |
|---------|------|---------|
| Evaluation history | `data/evaluations.json` | Stores deterministic evaluation runs and quality-gate outcomes |
| Drift history | `data/drift.json` | Stores LLM drift, data drift, and model swap evidence |
| Feedback history | `data/feedback.json` | Stores reviewer feedback and feedback-to-test conversion flags |
| Audit trail | `data/audit.json` | Stores per-agent action events for processed contracts |
| Runtime workflow package | `data/runtime/active-workflow.json` and `data/runtime/packages/` | Stores active workflow package state and immutable snapshots |

These files are the current in-repo evidence backbone for the demo. [Confidence: HIGH]

## API Surfaces

The gateway exposes evaluation, drift, feedback, audit, and workflow APIs that allow the UI and tests to read or trigger these evidence flows. [Confidence: HIGH]

Examples:

- `GET /api/v1/evaluations/results`
- drift routes under `gateway/src/routes/drift.ts`
- feedback routes under `gateway/src/routes/feedback.ts`
- audit routes under `gateway/src/routes/audit.ts`

## Observability Posture

- The TypeScript gateway is the control-plane source of truth for workflow definitions and operator APIs. [Confidence: HIGH]
- The Python MAF executor is the runtime source of truth for in-flight execution behavior. [Confidence: HIGH]
- Repo-local audit and evaluation artifacts provide durable evidence even when live cloud tracing is not available. [Confidence: HIGH]

## Current Gaps

- The repo persists deterministic audit and evaluation evidence, but it does not yet publish a dedicated repo-local Foundry trace export or OpenTelemetry artifact bundle. [Confidence: HIGH]
- Feedback exists as data, but the optimize loop remains an operator workflow rather than a fully automated prompt-to-rerun promotion pipeline. [Confidence: HIGH]
- Generated data files can change during local test and demo runs, so commit hygiene should continue to stage only intentional evidence or code/documentation changes. [Confidence: HIGH]

## Practical Operating Guidance

1. Treat `data/evaluations.json` latest corpus-matched result as the authoritative quality gate input. [Confidence: HIGH]
2. Treat `data/drift.json` as the authoritative demo drift baseline unless a new deterministic regeneration step is introduced. [Confidence: HIGH]
3. Keep prompts, examples, templates, and schema definitions aligned before trusting evaluation deltas. [Confidence: HIGH]
4. Stage generated audit, contract, and feedback files only when the change is intentionally part of an evidence update. [Confidence: HIGH]