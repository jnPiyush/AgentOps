# PFX Audit Workflow Board - Presentation Storyboard

## Audience

Audit partners, senior managers, methodology leaders, EA stakeholders, and workflow owners.

## Presentation Goal

Explain what the pasted board covers today, where AI agents fit, what is missing from the current workflow, and how to move toward a more complete future-state audit workflow.

## Slide 1 - Title And Framing

### Core Message

The PFX board is a planning-layer workflow design for AI-assisted audit content generation.

### Audience Takeaway

This is not yet a full audit operating model; it is a structured planning and design workflow.

### Recommended Visual

Title slide with the pasted board as a faded background image and four highlighted labels:

- Client Summary Agent
- Financial Summary Agent
- Risk Assessment Agent
- Audit Design Agent

### Presenter Notes

Open by explaining that the board is valuable because it already shows structured thinking around prompt orchestration, dual-engagement handling, and output governance. Then set expectations that the session will separate current coverage from future-state ambition.

## Slide 2 - What The Board Actually Covers

### Core Message

The board covers five workflow domains centered on audit planning support.

### Audience Takeaway

The board is strongest in upstream planning and analysis, not downstream execution.

### Recommended Visual

Five-column layout:

| Domain |
|---|
| Researcher Run |
| Client Summary |
| Financial Summary |
| Risk Assessment |
| Audit Design |

### Presenter Notes

Walk the audience left to right and explain that the board behaves like an orchestration chain. Research feeds summaries, summaries feed risk, and risk plus summaries feed design.

## Slide 3 - AI Agents On The Board

### Core Message

Four named AI agents appear clearly, each aligned to a planning-stage output.

### Audience Takeaway

AI agent usage is currently bounded and stage-specific, which is a strong design choice.

### Recommended Visual

Table:

| AI Agent | Prompt Count | Output |
|---|---:|---|
| Client Summary Agent | 4 | Client summary |
| Financial Summary Agent | 2 | Financial summary |
| Risk Assessment Agent | 3 | Risk assessment |
| Audit Design Agent | 3 | Audit design |

### Presenter Notes

Emphasize that the board does not show one monolithic agent trying to do everything. It shows bounded agents per planning stage, which is easier to govern and review.

## Slide 4 - Workflow Logic Patterns

### Core Message

The same orchestration logic repeats across the board.

### Audience Takeaway

The workflow design is consistent, which is a good sign for standardization.

### Recommended Visual

Process strip:

```text
Primary Context + Secondary Context -> Separate Prompt Paths -> Conditional Logic -> Join Outputs -> Human Confirmation
```

### Presenter Notes

Call out the repeated design rules:

- primary and secondary engagement separation
- consolidated branching
- joined outputs
- human confirmation point

## Slide 5 - Current Vs Proposed Workflow

### Core Message

The board is not small optimization; it is a structural change from single-engagement logic to dual-engagement orchestration.

### Audience Takeaway

The main shift is from one engagement stream to a more nuanced operating model.

### Recommended Visual

Two-column comparison:

| Current | Proposed |
|---|---|
| Single engagement bias | Primary and secondary engagement handling |
| One output stream | Multi-prompt joined output |
| Implicit consolidation handling | Explicit consolidated branching |
| Limited governance visibility | Output format confirmation checkpoint |

### Presenter Notes

This slide should help the room understand that the board is more than prompt tuning. It changes the workflow model itself.

## Slide 6 - Mapping To The Audit Lifecycle

### Core Message

The board maps well to planning, but not to audit execution.

### Audience Takeaway

There is a clear opportunity to extend the model into fieldwork and reporting.

### Recommended Visual

Lifecycle bar with current coverage highlighted:

```text
Acceptance -> Planning -> Client Understanding -> Financial Understanding -> Risk Assessment -> Audit Design -> Controls Testing -> Substantive Testing -> Completion -> Reporting
                    [Covered Today] [Covered Today] [Covered Today] [Covered Today]
```

### Presenter Notes

Explain that current coverage is strong through audit design, but execution stages remain outside scope today.

## Slide 7 - Big 4-Style Operating Model

### Core Message

To use this workflow in practice, the model needs explicit ownership and review.

### Audience Takeaway

The board becomes operational only when owner, reviewer, system, and AI-agent roles are defined.

### Recommended Visual

Compact operating model table:

| Stage | Owner | Reviewer | System | AI Agent |
|---|---|---|---|---|
| Client Summary | Manager | SMR / partner delegate | Workflow layer | Client Summary Agent |
| Financial Summary | Workstream lead | Manager / SMR | Workflow layer | Financial Summary Agent |
| Risk Assessment | Risk lead | SMR / partner | Workflow layer | Risk Assessment Agent |
| Audit Design | Audit manager | Partner / methodology reviewer | Planning workflow | Audit Design Agent |

### Presenter Notes

Explain that this is the minimum operating model needed to make the board usable in a controlled environment.

## Slide 8 - Future-State Target Workflow

### Core Message

The next maturity step is extending the planning workflow into execution and reporting.

### Audience Takeaway

The board should evolve into a full lifecycle with execution-stage support agents.

### Recommended Visual

Future-state workflow sequence:

```text
Research -> Client Summary -> Financial Summary -> Risk Assessment -> Audit Design -> Control Scoping -> Walkthrough Support -> Controls Testing Support -> Substantive Testing Support -> Issues Evaluation -> Completion Support -> Reporting Support
```

### Presenter Notes

Position this as a target-state roadmap, not an immediate implementation commitment.

## Slide 9 - Governance And Decision Points

### Core Message

The main open decisions are governance decisions, not only prompt decisions.

### Audience Takeaway

The workshop should end with explicit decisions on ownership, format, and future expansion.

### Recommended Visual

Decision checklist:

- Should Researcher Run become a formal AI agent?
- When should outputs be joined versus kept separate?
- What is the target output schema for each stage?
- Who approves release of final outputs?
- Which execution stages should be added next?

### Presenter Notes

Use this slide to transition from explanation to action.

## Slide 10 - Closing Recommendation

### Core Message

Adopt the planning workflow now, standardize the operating model next, and phase execution-stage expansion deliberately.

### Audience Takeaway

There is enough value in the current board to move forward, but not enough coverage yet to call it an end-to-end audit workflow.

### Recommended Visual

Three-step roadmap:

| Phase | Focus |
|---|---|
| Phase 1 | Approve planning-layer workflow |
| Phase 2 | Formalize operating model and governance |
| Phase 3 | Extend into execution, completion, and reporting |

### Presenter Notes

Close by anchoring the room on a practical message: the board is already useful, but the right next step is structured operationalization rather than overclaiming full-lifecycle coverage.