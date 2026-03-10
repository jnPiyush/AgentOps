# Drift Monitoring Report - ContractAgentOps Demo

## Scope

This report summarizes the drift evidence currently stored in `data/drift.json` and interpreted by `mcp-servers/contract-drift-mcp/src/engine.ts`.

## LLM Drift Snapshot

| Week | Accuracy |
|------|----------|
| 2026-W01 | `92%` |
| 2026-W02 | `91%` |
| 2026-W03 | `88%` |
| 2026-W04 | `84%` |
| 2026-W05 | `81%` |

- Detection threshold: `85%`
- Status at latest point: `DRIFT DETECTED`
- Latest recommendation: retrain prompts or evaluate model updates

The engine reports drift once the latest point drops below `0.85`. [Confidence: HIGH]

## Data Drift Snapshot

Current contract type distribution:

| Type | Share |
|------|-------|
| NDA | `30%` |
| MSA | `22%` |
| SOW | `14%` |
| Amendment | `9%` |
| SLA | `10%` |
| AI Services | `15%` |

- New type detected outside the known-type list: `AI Services`
- Alert progression: first seen at `7%`, later increased to `15%`
- Recommendation: expand evaluation and policy coverage for this type

The distribution is normalized to `1.0`, and the test suite now asserts that normalization. [Confidence: HIGH]

## Model Swap Analysis

| Model | Accuracy | Latency | Cost per contract |
|-------|----------|---------|-------------------|
| GPT-4o | `92%` | `2400 ms` | `$0.08` |
| GPT-4o-mini | `89%` | `1150 ms` | `$0.032` |

Computed deltas:

- accuracy delta: `-3.1%`
- latency delta: `-52%`
- cost delta: `-60%`
- verdict: `ACCEPTABLE`

The verdict is acceptable because the absolute accuracy drop remains within the `5%` threshold defined in the drift engine. [Confidence: HIGH]

## Operational Meaning

- Output-quality degradation and input-distribution shift are both active concerns in the current demo evidence. [Confidence: HIGH]
- AI Services is now a material share of incoming work and should remain a first-class regression category in prompt, policy, and evaluation updates. [Confidence: HIGH]
- Model swap economics look favorable for non-critical flows, but the release gate should still be enforced on the full evaluation corpus before any swap is promoted. [Confidence: HIGH]