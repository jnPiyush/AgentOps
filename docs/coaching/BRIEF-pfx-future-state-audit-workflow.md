# Future-State Target Workflow - PFX Audit Workflow With Execution Stages

## Purpose

This document extends the pasted PFX board into a future-state workflow that includes the missing audit execution stages.

The current board is strong in planning and design. The target state below preserves those planning stages and adds the execution, completion, and reporting stages required for a more complete audit operating model.

## Executive Summary

The current board covers the planning portion of the audit workflow:

- Research
- Client summary
- Financial summary
- Risk assessment
- Audit design

The future-state workflow adds the missing execution stages:

- Control scoping and walkthrough support
- Controls testing support
- Substantive testing support
- Issues aggregation and evaluation
- Completion support
- Reporting support

This target state should not be interpreted as replacing professional judgment. Instead, it describes how AI agents and workflow systems can support the audit team from planning through reporting while preserving clear human ownership and review.

## Current-State Coverage

| Stage | Covered Today? | AI Agent Mentioned |
|---|---|---|
| Researcher Run | Yes | No explicit named agent |
| Client Summary | Yes | Client Summary Agent |
| Financial Summary | Yes | Financial Summary Agent |
| Risk Assessment | Yes | Risk Assessment Agent |
| Audit Design | Yes | Audit Design Agent |
| Controls Scoping | No | Not yet defined |
| Walkthrough Support | No | Not yet defined |
| Controls Testing | No | Not yet defined |
| Substantive Testing | No | Not yet defined |
| Issues Evaluation | No | Not yet defined |
| Completion | No | Not yet defined |
| Reporting | No | Not yet defined |

## Future-State Workflow

| Stage | Objective | Main Inputs | System | AI Agent | Main Output |
|---|---|---|---|---|---|
| 1. Researcher Run | Gather public information for engagement understanding | Client, engagement context, public sources | Research workflow | Researcher capability | Research output package |
| 2. Client Summary | Build engagement-aware client overview | Research package, client structure, engagement context | Planning workflow | Client Summary Agent | Client summary |
| 3. Financial Summary | Produce financial summary with consolidated branching | Financial inputs, engagement structure, consolidated flag | Planning workflow | Financial Summary Agent | Financial summary |
| 4. Risk Assessment | Produce planning-stage risk view | Client summary, financial summary, research outputs | Planning workflow | Risk Assessment Agent | Risk assessment |
| 5. Audit Design | Translate risks into initial audit design | Prior stage outputs | Planning workflow | Audit Design Agent | Audit design package |
| 6. Control Scoping | Identify key controls and process areas requiring attention | Audit design, process maps, control inventory | Methodology workflow | Future Controls Scoping Agent | Key control scope |
| 7. Walkthrough Support | Support process understanding and walkthrough documentation | Narratives, interviews, system screenshots | Walkthrough workflow | Future Walkthrough Agent | Walkthrough documentation package |
| 8. Controls Testing Support | Support sample planning and control evidence structuring | Control scope, walkthrough output, populations | Testing workflow | Future Controls Testing Agent | Controls testing support package |
| 9. Substantive Testing Support | Support balance and transaction testing design | Risks, TB, lead schedules, account detail | Testing workflow | Future Substantive Testing Agent | Substantive testing plan or summaries |
| 10. Issues Evaluation | Aggregate exceptions and adjust conclusions | Testing results, misstatements, review comments | Issues workflow | Future Issues Evaluation Agent | Issues summary |
| 11. Completion Support | Tie together final engagement conclusions | Issues summary, financial statements, subsequent events, disclosures | Completion workflow | Future Completion Agent | Completion support memo |
| 12. Reporting Support | Support governance communication and reporting | Final conclusions, issues, draft report content | Reporting workflow | Future Reporting Agent | Draft reporting pack |
| 13. Governance Review | Human approval and final release | All prior outputs | Governance workflow | None | Approved final package |

## Design Rules For The Future State

### Planning-layer rules retained from the original board

- Primary and secondary engagement context remain separated where relevant
- Consolidated and non-consolidated branch logic stays explicit
- Outputs may be joined where business consumption requires a unified package
- Human review remains mandatory at key decision points

### New execution-layer rules

- No execution-stage output is final without human review
- Evidence handling must remain system-governed and auditable
- Testing-stage AI outputs should support preparation and evaluation, not perform the audit autonomously
- Completion and reporting stages require tighter review than planning stages

## Future-State Stage Detail

### Control Scoping

Purpose:
Identify which controls and processes matter most based on planning outputs.

Inputs:
- Risk assessment
- Process narratives
- Control inventory
- Entity structure

Output:
- Key control scope list

### Walkthrough Support

Purpose:
Support documentation of process understanding and control design.

Inputs:
- Process maps
- Interviews
- System screenshots
- Control descriptions

Output:
- Walkthrough documentation package

### Controls Testing Support

Purpose:
Support planning and summarization of control testing work.

Inputs:
- Key controls
- Populations
- Sample selections
- Evidence artifacts

Output:
- Controls testing support package

### Substantive Testing Support

Purpose:
Support substantive testing design and summarization.

Inputs:
- Trial balance
- Lead schedules
- Risk assessments
- Account-level support

Output:
- Substantive testing support package

### Issues Evaluation

Purpose:
Aggregate exceptions, misstatements, and unresolved matters.

Inputs:
- Testing outputs
- Review comments
- Misstatement logs

Output:
- Issues summary

### Completion Support

Purpose:
Support final conclusion-building before reporting.

Inputs:
- All stage outputs
- Final disclosures
- Subsequent events analysis
- Going concern considerations

Output:
- Completion support memo

### Reporting Support

Purpose:
Support governance communication and final reporting packs.

Inputs:
- Completion memo
- Final issues summary
- Final financial statements

Output:
- Draft reporting pack

## Future-State Value Proposition

| Benefit | Description |
|---|---|
| Better continuity | Connects planning outputs to execution stages rather than stopping at design |
| Better control | Introduces clearer system and review boundaries across the full audit lifecycle |
| Better traceability | Creates a stage-by-stage workflow that can support evidence and governance |
| Better scalability | Enables a modular AI-agent model instead of one large opaque workflow |

## Implementation Priorities

1. Formalize current planning-stage outputs and schemas.
2. Define controls scoping and walkthrough support as the first execution-stage additions.
3. Define reviewer checkpoints for testing, completion, and reporting.
4. Introduce evidence and audit-trail requirements before scaling execution-stage agents.

## Conclusion

The current board is a strong planning foundation. The future-state workflow above extends it into a more complete audit lifecycle while preserving the core design principles of separated engagement handling, explicit branching logic, output orchestration, and human governance.