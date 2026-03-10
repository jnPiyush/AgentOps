# Code Review - DS Documentation Alignment

**Date**: 2026-03-10
**Reviewer**: Code Reviewer Agent
**Commit Reviewed**: `2e375c2` (`fix: align ds assets and docs`)
**Scope**: DS documentation layer gap closure; 23 files changed (+1184 / -756)
**Related Spec**: [SPEC-ContractAgentOps-Demo.md](../contract-agentops-demo/docs/specs/SPEC-ContractAgentOps-Demo.md)
**Related PRD**: [PRD-ContractAgentOps-Demo.md](../contract-agentops-demo/docs/prd/PRD-ContractAgentOps-Demo.md)
**Related ADR**: [ADR-ContractAgentOps-Demo.md](../contract-agentops-demo/docs/adr/ADR-ContractAgentOps-Demo.md)

---

## 1. Summary

The prior deep-review session (`fff0c33`) aligned code, prompts, examples, templates, evaluation data, and drift data to the declarative schema contracts defined in the spec. This commit (`2e375c2`) closes the remaining gap: narrative documentation and DS artifacts still described a stale 20-case evaluation, an AI Liability drift example, and an Express-based gateway. All of those references have been corrected and four dedicated DS documentation files have been created.

The changes are accurate, internally consistent, well-tested, and do not introduce any functional or security regressions. [Confidence: HIGH]

---

## 2. Checklist Results

| Category | Result | Notes |
|----------|--------|-------|
| Spec Conformance | PASS | DS docs reflect mixed-runtime architecture; declarative source-of-truth posture correctly documented |
| Code Quality | PASS | New artifacts are concise and factually grounded; `confidence` key fix in workflows.py is correct |
| Testing | PASS | 63/63 tests pass; 4 new cross-validation tests in `ai-assets.test.ts` |
| Security | PASS | No secrets hardcoded; FOUNDRY_API_KEY and Azure credentials flow from env vars throughout |
| Performance | PASS | No performance implications; Fastify confirmed as the gateway runtime |
| Error Handling | ADVISORY | Pre-existing bare `except Exception` in Python MAF files (not introduced here) |
| Documentation | PASS | DS docs created; README, PRD, UX doc, and prototypes all updated to match runtime facts |
| Intent Preservation | PASS | PRD intent (full 8-act AgentOps demo narrative) is preserved and now grounded in actual measures |

---

## 3. Findings

### Critical - None

### Major - None

### Minor

**[MIN-1]** Pre-existing bare `except Exception as e:` in four Python files
[Confidence: HIGH]

Files: `agents.py` (lines 357, 431), `workflows.py` (lines 176, 502), `setup.py` (lines 114, 165, 233), `demo.py` (lines 156, 195, 234).
These linting warnings existed before this commit and are not introduced by the changes reviewed here. They are documented here for completeness and should be addressed in a follow-up Python hardening pass. They do not block approval of the current documentation work.

**[MIN-2]** `__init__.py` and `demo.py` catch previously-caught exception types
[Confidence: HIGH]

Same pre-existing origin as MIN-1. `__init__.py` line 104 re-catches `AttributeError`, `ValueError`; `demo.py` lines 156 and 195 re-catch `ValueError`, `RuntimeError`, etc. No risk in a demo context but should be cleaned up.

**[MIN-3]** GitHub Actions secrets not provisioned
[Confidence: HIGH]

`.github/workflows/contract-agentops-deploy.yml` references `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `FOUNDRY_ENDPOINT`, `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_API_KEY`. These are reported as invalid context references because the repo-level secrets are not yet set. This is expected and appropriate for a demo repo without a live CI environment. Not a blocker.

### Nit

**[NIT-1]** `eval-engine.test.ts` baseline version hardcoded as `"v1.2"`

`getBaseline()` calls `simulateEvaluation("v1.2")` and the test asserts `expect(baseline.version).toBe("v1.2")`. This is intentional -- the baseline is a deterministic simulation separate from the stored v1.3 evaluation runs in `data/evaluations.json`. The distinction is correct but not immediately obvious to a new contributor. A one-line comment in the test would help. No functional issue.

**[NIT-2]** `app.js` judge average is `4.2/5`; individual scores are `4.1 / 4.0 / 4.4`

The computed mean is `(4.1 + 4.0 + 4.4) / 3 = 4.17`, rounded to `4.2`. Consistent and defensible. Acceptable.

---

## 4. Detailed Findings

### 4.1 DS Documentation Artifacts

**Location**: `contract-agentops-demo/docs/data-science/`

All four new files are accurate:

| File | Verified Against | Result |
|------|-------------------|--------|
| `MODEL-CARD-ContractAgentOps-Demo.md` | `agents/microsoft-framework/config.py` for model names; `mcp-servers/contract-eval-mcp/src/engine.ts` for ground truth size | PASS |
| `EVAL-ContractAgentOps-Demo.md` | `data/evaluations.json` latest entry (id=`eval-995170ba`, 57 cases, 39 passed, 68.4%, FAIL) | PASS |
| `DRIFT-ContractAgentOps-Demo.md` | `data/drift.json` (AI Services 15%, normalized total 1.0, model swap -3.1%/-60%) | PASS |
| `AGENTOPS-ContractAgentOps-Demo.md` | Gateway route references (evaluation, drift, feedback, audit APIs) and current gaps (no Foundry trace export) | PASS |

### 4.2 README.md

Gateway description changed from "Express.js" to "Fastify-based TypeScript gateway." Confirmed against `gateway/package.json` which lists `fastify@^5.8.1` and `@fastify/cors`, `@fastify/static`, `@fastify/websocket` -- no Express dependency. [Confidence: HIGH]

Test case count changed from "50+ test cases" to "57 ground-truth cases." Confirmed against `mcp-servers/contract-eval-mcp/src/engine.ts` `GROUND_TRUTH` array length and `eval-engine.test.ts` assertion. [Confidence: HIGH]

Current Evaluation Snapshot section now shows actual values (39/57, FAIL, 87.5%/83.5%/91.5%) instead of the fabricated 95%/92%/98%/97% benchmarks that appeared to have no data backing. [Confidence: HIGH]

### 4.3 Prompt Files

Schema-to-prompt alignment confirmed by `ai-assets.test.ts`:

| Prompt | Key Checks | Result |
|--------|-----------|--------|
| `intake-system.md` | Contains `contract_type`, `confidence_score`; does not contain `"type": "CONTRACT_TYPE"` | PASS |
| `extraction-system.md` | Contains `"dates": [`, `"values": [`; does not contain object-form `"dates": {` | PASS |
| `compliance-system.md` | Contains `overall_score`, `approval_required`; does not contain `clause_results` or `overall_risk` | PASS |
| `approval-system.md` | Contains `decision`, `escalation_required`; does not contain `"action": "auto_approve` | PASS |

Note: `extraction-system.md` retains `ai_liability` as a **clause taxonomy type** (e.g., identifying an AI liability clause within a contract). This is distinct from the contract type `AI Services` used in drift detection and is correct. [Confidence: HIGH]

### 4.4 Evaluation and Drift Data

`data/evaluations.json`:
- Entry 1 (legacy): `total_cases: 20`, `accuracy: 85`, `quality_gate: "PASS"` -- preserved as historical context
- Entry 2 (full corpus): `total_cases: 57`, `accuracy: 68.4`, `quality_gate: "FAIL"` -- active evidence baseline
- Entry 3 (compact static): `total_cases: 57`, `version: "v1.3"` -- additional static reference

`ai-assets.test.ts` correctly gates on `evaluations[evaluations.length - 1].total_cases === getGroundTruth().length` (both 57). [Confidence: HIGH]

`data/drift.json`: AI Services at 15%, distribution normalized to 1.0. Confirmed by `drift-engine.test.ts` normalization assertion. [Confidence: HIGH]

### 4.5 workflows.py Confidence Key Fix

```python
# Line 424
confidence = result.get("confidence", result.get("confidence_score"))
```

Correctly accepts both `"confidence"` (extraction schema top-level key) and `"confidence_score"` (intake schema key) from agent results. This prevents a silent `None` failure when the result uses the intake field name. [Confidence: HIGH]

### 4.6 UX Document

Evaluation Lab wireframe now shows:
- Test Set: 57 contracts (was 20)
- Overall: 39/57 passed (68.4%) (was 17/20 passed 85.0%)
- Quality gate: [FAIL] (was [PASS])

Drift Detection wireframe now shows:
- AI Services bar at correct relative proportion
- "NEW: AI Services" label (was "NEW: AI Liability")
- Action item: "Expand policy and evaluation coverage for AI Services contracts"

Feedback view now shows:
- Before: 68.4% (39/57) (was 85.0%)
- Quality Gate: [FAIL]

All three sections are now consistent with the stored data. [Confidence: HIGH]

### 4.7 Security Posture

No security regressions introduced. Confirmed:
- `FOUNDRY_API_KEY` loaded from environment in `config.py` (`Field(..., env="FOUNDRY_API_KEY")`), `gateway/src/config.ts` (`envOrDefault("FOUNDRY_API_KEY", "")`), and `infra/main.parameters.json` (`"${FOUNDRY_API_KEY}"`)
- No connection strings, passphrases, or tokens appear in any file changed in this commit
- Input validation: unchanged from prior review

---

## 5. Decision

**APPROVED** [Confidence: HIGH]

All Critical and Major finding categories are empty. Two pre-existing Minor linting issues (bare exception catches) are advisory only and predated this commit. One CI-credentials nit is expected for a demo repo with no live CI environment. The documentation work is accurate, internally consistent, and well-validated by the test suite.

The repo is now in a state where:
- DS artifacts are present and factually grounded
- All narrative docs match what the code actually does
- Tests cross-validate schema, prompt, template, and example alignment
- The quality gate FAIL at 68.4% is correctly communicated throughout (not obscured by legacy PASS numbers)

---

## 6. Recommended Follow-Up (Not Blocking Approval)

These items should be tracked but do not need to be resolved before this commit is merged/retained:

1. **Python exception handling hardening** (MIN-1, MIN-2): Replace bare `except Exception` with specific exception types. Applies to `agents.py`, `workflows.py`, `setup.py`, `demo.py`. Estimated: 30 min.

2. **GitHub Actions secrets provisioning** (MIN-3): If/when a live CI environment is set up for `jnPiyush/AgentOps`, the seven secrets need to be added to the repository settings.

3. **Evaluation quality improvement** (NIT): To advance from the current FAIL baseline, target the three failure clusters identified in `EVAL-ContractAgentOps-Demo.md`: classification failures on SOW/EMP/SAAS, extraction failures on MSA-002/SOW-003/NDA-006, compliance failures on SLA-002/SLA-003/RE-001.

4. **Taxonomy gap** (`Consortium`, `Partnership` contract types): Documented as a known limitation in the model card. Should be addressed in the intake prompt taxonomy or via normalization rules.
