# Execution Plan: Full CLM Alignment

## Purpose / Big Picture
- Expand the active business workflow from the prior narrower baseline to a 10-stage CLM baseline that covers intake through analytics.
- Enrich intake so classification captures contract category, source channel, industry, compliance needs, party type, and risk signals across commercial and corporate contracts.
- Keep the canonical docs, runtime mapping, tests, prompts, templates, and active vanilla JS UI aligned.

## Progress
- Discovery complete.
- Patch set in progress across lifecycle catalog, intake contract, tests, docs, and UI defaults.

## Surprises & Discoveries
- The repo already supports broad contract families in the deterministic classifier and shared types.
- The main gap is the active lifecycle baseline and the narrow intake schema.
- `contract_stage_map` is the critical seam shared by gateway packaging and the vanilla JS dashboard.

## Decision Log
- 2026-03-19: Promote the active business lifecycle to 10 stages: Request, Drafting, Review, Compliance, Negotiation, Approval, Signature, Obligations, Renewal, Analytics.
- 2026-03-19: Keep AgentOps separate from Contract Lifecycle and update only the business-stage model.
- 2026-03-19: Represent commercial and corporate breadth through enriched intake metadata rather than a second workflow tree.

## Context and Orientation
- Source of truth for business stages: `config/stages/contract-lifecycle.json`.
- Runtime packaging and stage mapping: `gateway/src/services/workflowRegistry.ts`.
- Intake contract surfaces: schema, template, examples, prompt, deterministic intake engine, intake adapter.
- Active UI: `ui/`.

## Plan of Work
- Update the declarative stage catalog and workflow registry mappings.
- Widen intake outputs and deterministic enrichment.
- Update workflow and intake tests.
- Align canonical PRD, ADR, spec, UX, and UI defaults.
- Remove banned deployment-label strings.

## Concrete Steps
- [ ] Add execution artifacts.
- [ ] Expand the 10-stage CLM catalog and workflow mapping.
- [ ] Enrich intake schema, template, examples, prompt, and engine.
- [ ] Update intake and workflow tests.
- [ ] Align docs and active UI wording/defaults.
- [ ] Validate with tests, typecheck, and targeted lint.

## Validation and Acceptance
- Workflow registry tests reflect the 10-stage lifecycle.
- Intake tests cover richer metadata and category/source inference.
- Canonical docs no longer describe the active runtime as six stages ending at approval.
- No banned legacy customer labels remain.

## Idempotence and Recovery
- Avoid editing generated `data/runtime/` artifacts directly.
- Keep changes isolated to source, docs, and tests so the runtime package can be regenerated safely later.

## Artifacts and Notes
- Plan owner: AgentX Auto
- Date: 2026-03-19

## Outcomes & Retrospective
- Pending implementation.