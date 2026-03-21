# Executive Workshop Document - PFX Audit Workflow Additions

## Executive Summary

This workshop document translates the pasted PFX board into an executive-ready view of what is changing in the audit workflow, why it matters, and how the operating model should evolve.

The board is best understood as a redesign of the audit planning and design layer, not the full audit execution lifecycle. It introduces a dual-engagement pattern across four AI-supported stages:

- Client Summary
- Financial Summary
- Risk Assessment
- Audit Design

The design intent is consistent across the board:

- Treat primary and secondary engagements separately when both exist
- Apply explicit branching for consolidated and non-consolidated cases
- Use multiple prompts where necessary and join outputs into a single downstream package
- Preserve a human confirmation step for final output format and workflow governance

The current design is strong in early-phase audit activities such as client understanding, financial summarization, and risk framing. The key gap is that it does not yet extend into execution-heavy audit work such as controls testing, substantive testing, completion, and reporting.

## Workshop Objectives

This document is designed to help stakeholders do four things:

1. Align on what the current board actually covers
2. Distinguish current workflow from proposed workflow additions
3. Understand where AI agents fit within the audit lifecycle
4. Create a shared basis for moving from planning support to execution-ready workflow design

## What The Board Covers

The pasted board appears to cover five workflow domains:

1. Researcher Run
2. Client Summary
3. Financial Summary
4. Risk Assessment
5. Audit Design

Across all of these, the recurring themes are:

- Separate primary and secondary engagement handling
- Consolidated-true versus consolidated-false logic
- Multi-prompt orchestration
- Joined outputs
- Output-format review with the EA team

## Current Vs Proposed Workflow

| Area | Current Workflow | Proposed Workflow Addition | AI Agent Mentioned | Prompt Pattern | Main Change |
|---|---|---|---|---|---|
| Research / public info | One researcher run tied mostly to one engagement context | Add separate research paths for primary and secondary engagement | No explicit named AI agent visible | Two prompts: primary public info and secondary public info | Expands research coverage before downstream summarization |
| Client summary | Single-engagement summary bias | Add separate primary and secondary engagement handling, then join outputs | Client Summary Agent | Prompt 4 | Makes client summary engagement-aware across both layers |
| Financial summary | One financial summary stream | Add primary and secondary handling, especially when consolidated | Financial Summary Agent | Prompt 2 | Introduces branch logic and dual-engagement structuring |
| Risk assessment | Risk output centered on one engagement context | Separate financial and risk information for secondary engagements | Risk Assessment Agent | Prompt 3 | Preserves dual-engagement visibility in risk outputs |
| Audit design | Design output downstream of summary and risk workflows | Extend audit design to use dual-engagement structured inputs | Audit Design Agent | Prompt 3 | Pushes dual-engagement logic into final planning output |
| Output format | Likely one current schema or format | Reconfirm structure of combined output | Multiple downstream AI agents affected | Joined-output pattern repeated | Introduces formal governance checkpoint |
| Consolidation handling | Implicit or incomplete | Add explicit consolidated / non-consolidated branching | Financial Summary Agent, Risk Assessment Agent, Audit Design Agent | Conditional prompt and workflow logic | Formalizes scenario-specific behavior |

## AI Agent Inventory

| AI Agent | Role In Workflow | Prompt Count Shown | Primary Inputs | Main Output | Comments |
|---|---|---|---|---|---|
| Client Summary Agent | Builds engagement-aware client summary | 4 | Client, primary engagement, secondary engagement, research context | Client summary | Output appears to be joined from multiple prompt paths |
| Financial Summary Agent | Produces financial summary for dual-engagement context | 2 | Client, financial information, engagement structure, consolidated flag | Financial summary | Explicit consolidated logic appears here |
| Risk Assessment Agent | Produces risk summary with distinct engagement views | 3 | Client, engagement info, financial and risk inputs | Risk assessment | Secondary content is intended to stay distinct from primary |
| Audit Design Agent | Converts summary and risk outputs into audit design | 3 | Client, engagement structure, risk and financial outputs | Audit design | Represents the planning-design end of the workflow |
| Researcher Run | Upstream information-gathering stage | Not shown as an agent | Public information and engagement context | Research output package | May remain workflow-owned rather than agent-owned |

## Workflow Logic Patterns

| Logic Rule | Business Meaning |
|---|---|
| Primary and secondary engagement handled separately | Do not collapse distinct engagement contexts into one undifferentiated prompt input |
| Joined outputs | Multiple prompt outputs can be merged into one user-facing package |
| Consolidated true / false branch | Workflow behavior depends on whether a consolidated audit context exists |
| Secondary information listed separately | Secondary financial and risk data should remain visible, not blended invisibly into primary |
| Fallback to current execution | If no secondary engagement exists, continue with current single-engagement logic |
| Output format confirmation required | Human governance is still required before release or standardization |

## Mapping To The Audit Lifecycle

| Audit Lifecycle Stage | Fit To Board | Coverage Summary |
|---|---|---|
| Acceptance / continuance | Low | Not explicitly covered |
| Kickoff / planning | Partial | Engagement structure appears in inputs, but planning governance is not the main focus |
| Entity / client understanding | High | Strongly represented through researcher and client summary workflows |
| Financial understanding | High | Strongly represented through Financial Summary Agent |
| Risk assessment | High | Strongly represented through Risk Assessment Agent |
| Audit response design | High | Strongly represented through Audit Design Agent |
| Controls testing | None | Not covered |
| Substantive testing | None | Not covered |
| Completion and reporting | None | Not covered |

## Key Workshop Takeaways

### What is working in the design

- The board has a clear orchestration pattern across multiple AI-supported stages.
- It recognizes the need to treat primary and secondary engagement structures explicitly.
- It introduces scenario-aware workflow behavior through consolidated branching.
- It preserves a human confirmation step rather than assuming full autonomous release.

### What is incomplete

- There is no visible extension into control testing or substantive testing.
- There is no execution-stage evidence model.
- There is no completion or reporting stage.
- Roles and review layers are not yet formalized to a Big 4 operating model level.

### Strategic implication

The board is a strong planning-layer design artifact. To become an end-to-end audit operating model, it must be extended into fieldwork, evidence evaluation, completion, reporting, and governance.

## Recommended Decisions For The Workshop

1. Confirm whether Researcher Run should remain a workflow step or become a named AI agent.
2. Standardize when outputs are merged versus when primary and secondary sections remain separated.
3. Define the target output schema for Client Summary, Financial Summary, Risk Assessment, and Audit Design.
4. Decide whether future workflow expansion will include execution-stage AI agents for controls and substantive work.
5. Define review ownership between engagement teams, specialists, and EA governance.

## Suggested Next Steps

1. Approve the planning-layer workflow as a target-state design baseline.
2. Adopt the Big 4-style operating model defined in the companion document.
3. Extend the workflow into audit execution stages using the future-state workflow document.
4. Use the presentation storyboard to run the workshop and capture decisions live.