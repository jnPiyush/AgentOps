# Big 4-Style Operating Model - PFX Audit Workflow

## Purpose

This document reframes the pasted PFX board into a Big 4-style operating model with explicit accountability across business owners, reviewers, systems, and AI agents.

The goal is to move from a board-level workflow concept to an operating model that can support execution, governance, and role clarity.

## Executive Summary

The current board implies a workflow-driven orchestration model, but it does not yet explicitly define who owns outputs, who reviews them, what system orchestrates them, and where AI agents have bounded responsibility.

This operating model resolves that gap by assigning each planning-stage output to:

- Owner
- Reviewer
- System
- AI Agent

It also introduces future-state roles for execution-stage activities that are missing from the original board.

## Big 4-Style Operating Model

| Stage | Objective | Owner | Reviewer | System | AI Agent | Key Inputs | Main Output |
|---|---|---|---|---|---|---|---|
| Researcher Run | Gather public information for engagement context | Engagement team or research analyst | Manager or designated content reviewer | Workflow orchestration layer | Researcher Run not clearly named as an AI agent | Client, primary engagement, secondary engagement, public sources | Research output package |
| Client Summary | Build client context across engagement layers | Engagement senior or manager | Manager or partner delegate | Prompt orchestration workflow | Client Summary Agent | Research outputs, client structure, engagement context | Client summary |
| Financial Summary | Produce structured financial summary across engagement contexts | Financial workstream lead | Manager or SMR reviewer | Prompt orchestration workflow | Financial Summary Agent | Client financial inputs, engagement structure, consolidated flag | Financial summary |
| Risk Assessment | Produce planning-stage risk profile | Risk lead or manager | Senior manager, partner, or risk reviewer | Prompt orchestration workflow | Risk Assessment Agent | Research output, financial summary, engagement structure | Risk assessment |
| Audit Design | Convert summary and risk outputs into planning design | Audit manager or methodology lead | Engagement partner or methodology reviewer | Planning workflow system | Audit Design Agent | Client summary, financial summary, risk assessment | Audit design package |
| Output Assembly | Merge or format stage outputs for use | Workflow owner or engagement manager | EA team or design authority | Output assembly and presentation layer | Affected across all planning agents | All prior stage outputs | Final planning output |
| Governance Review | Validate output structure and appropriateness | EA team or engagement governance owner | Partner / leadership / methodology lead | Governance workflow | None required | Final planning output | Approved or revised workflow output |

## Future-State Extension For Missing Audit Execution Stages

The original board does not cover execution-heavy audit work. A Big 4-style operating model would typically add the following stages.

| Future Stage | Objective | Owner | Reviewer | System | AI Agent | Key Inputs | Main Output |
|---|---|---|---|---|---|---|---|
| Control Scoping | Determine which controls matter | Audit manager | Senior manager | Audit methodology platform | Potential future Controls Scoping Agent | Risk assessment, process maps, control inventory | Key control scope |
| Walkthrough Support | Support process understanding and walkthrough documentation | Senior / associate | Manager | Workflow plus documentation platform | Potential future Walkthrough Agent | Narratives, interviews, screenshots, control points | Walkthrough package |
| Controls Testing Support | Assist with test planning and evidence structuring | Senior / associate | Manager | Testing workpaper platform | Potential future Controls Testing Agent | Control populations, samples, evidence | Controls testing package |
| Substantive Testing Support | Assist with balance and transaction testing design | Senior / associate | Manager / SMR | Audit testing platform | Potential future Substantive Testing Agent | Financial summary, risks, TB, schedules | Testing plan or evidence summaries |
| Issues Evaluation | Aggregate exceptions and proposed adjustments | Manager | Partner / EQ reviewer | Issue management system | Potential future Issues Evaluation Agent | Exceptions, testing results, misstatements | Issues summary |
| Completion Support | Tie together overall conclusions | Manager / SMR | Partner | Completion and reporting platform | Potential future Completion Agent | All results, disclosures, subsequent events | Completion memo support |
| Reporting Support | Draft governance communication and reporting packs | Partner delegate / manager | Partner / EQ reviewer | Reporting platform | Potential future Reporting Agent | Final conclusions, issues, draft financials | Draft reporting package |

## RACI-Like Interpretation

| Role | Practical Responsibility |
|---|---|
| Owner | Responsible for input quality, stage execution, and initial sign-off |
| Reviewer | Challenges output, confirms appropriateness, and approves stage completion |
| System | Orchestrates prompts, data movement, and output assembly |
| AI Agent | Produces bounded draft content within a controlled task scope |

## Operating Model Design Principles

1. AI agents should support judgment, not replace engagement accountability.
2. Every AI-produced output should have a named human owner.
3. Every planning-stage output should have a reviewer before downstream consumption.
4. Output assembly and formatting should be governed centrally when multiple prompt streams are merged.
5. Future execution-stage AI agents should be introduced only after role ownership and evidence controls are defined.

## Recommended Operating Model Decisions

1. Confirm whether Researcher Run becomes a formal AI agent or remains a workflow-owned capability.
2. Define reviewer authority by stage: manager, senior manager, partner, or EA team.
3. Standardize the system boundary between prompt orchestration, output assembly, and governance review.
4. Decide whether future-state execution stages should be included in the next design phase.

## Conclusion

The PFX board is already close to a workflow orchestration design, but it is not yet an operating model. This document adds the missing accountability layer needed to make the workflow usable in a Big 4-style environment.