# Evaluation Report - ContractAgentOps Demo

## Scope

This report summarizes the repo-local evaluation evidence currently persisted for the demo.

## Active Gate Definition

The evaluation engine marks the quality gate as `PASS` only when:

- overall accuracy is at least `80%`
- judge relevance is at least `4.0`
- judge groundedness is at least `3.8`

These rules are implemented in `mcp-servers/contract-eval-mcp/src/engine.ts`. [Confidence: HIGH]

## Latest Representative Run

| Field | Value |
|-------|-------|
| Version | `v1.3` |
| Run timestamp | `2026-03-10T17:11:23.991Z` |
| Corpus size | `57` |
| Passed | `39` |
| Overall accuracy | `68.4%` |
| Quality gate | `FAIL` |
| Relevance | `4.1 / 5` |
| Groundedness | `4.0 / 5` |
| Coherence | `4.4 / 5` |

Source: latest representative entry in `data/evaluations.json` matching the active ground-truth corpus size. [Confidence: HIGH]

## Metric Snapshot

| Metric | Current Value |
|--------|---------------|
| Extraction accuracy | `87.5%` |
| Compliance accuracy | `83.5%` |
| Classification accuracy | `91.5%` |
| False-flag rate | `9.9%` |
| Latency P95 | `2.3s` |

## Interpretation

- The suite fails because the combined end-to-end pass rate is well below the 80% threshold even though judge scores and several component metrics remain above threshold. [Confidence: HIGH]
- The active corpus is much broader than the legacy subset and now includes adversarial, international, AI-specific, and multi-party scenarios. [Confidence: HIGH]
- The evaluation evidence therefore supports schema alignment and better DS artifact hygiene, but it does not support a release-readiness claim for `v1.3` on the full corpus. [Confidence: HIGH]

## Historical Note

`data/evaluations.json` still contains an earlier `v1.3` record for a 20-case run with `85%` accuracy and `PASS`. That result is useful as historical context but is not the correct baseline for current promotion decisions because `getGroundTruth()` now returns 57 cases. [Confidence: HIGH]

## Representative Failure Patterns

Examples visible in the stored per-contract results include:

- classification failures on contracts such as `SOW-002`, `SOW-004`, `EMP-001`, and `SAAS-002`
- extraction failures on contracts such as `MSA-002`, `SOW-003`, `NDA-006`, `JV-002`, and `SAAS-003`
- compliance failures on contracts such as `SLA-002`, `SLA-003`, `EMP-002`, `MULTI-002`, and `RE-001`

These patterns indicate that the current weakness is cross-stage consistency across a broader taxonomy rather than a single isolated metric. [Confidence: HIGH]

## Recommended Next Focus Areas

1. Expand or normalize classification taxonomy coverage to match the active corpus. [Confidence: HIGH]
2. Re-run evaluation immediately after any prompt or schema change and treat the 57-case gate as canonical. [Confidence: HIGH]
3. Use prompt edits and policy updates to target failure clusters before attempting model promotion. [Confidence: MEDIUM]