# PRD: AI-Driven Contract Lifecycle Workflow

**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-03-11
**Stakeholders**: Legal Operations, In-House Counsel, Procurement, Sales Operations, Security and Compliance, IT Platform Team
**Related Assets**: `contract-agentops-demo/docs/prd/PRD-ContractAgentOps-Demo.md`, `contract-agentops-demo/docs/adr/ADR-ContractAgentOps-Demo.md`, `contract-agentops-demo/docs/specs/SPEC-ContractAgentOps-Demo.md`

---

## Table of Contents

1. Problem Statement
2. Target Users
3. Goals and Success Metrics
4. Research Summary
5. Requirements
6. User Stories and Acceptance Criteria
7. User Flows
8. Dependencies and Constraints
9. Risks and Mitigations
10. Timeline and Milestones
11. Out of Scope
12. Open Questions
13. Appendix

---

## 1. Problem Statement

Organizations still manage contract workflows through fragmented tools, email chains, manual reviews, and spreadsheet-based follow-up. The result is slow cycle time, inconsistent risk handling, missed obligations, delayed signatures, and poor portfolio visibility.

This PRD defines the **business workflow** for contracts. It is intentionally separate from the existing **AgentOps lifecycle**, which remains the SDLC and operational lifecycle for designing, testing, deploying, monitoring, evaluating, and improving AI agents.

The target product is an AI-driven contract lifecycle workflow that turns the full contract journey into an orchestrated, stage-aware system:

| Stage | Current Pain | AI Opportunity |
|-------|--------------|----------------|
| 1. Request / Initiation | Wrong template selected, incomplete intake | AI-guided intake, smart template recommendation |
| 2. Authoring / Drafting | Starting from scratch, inconsistent clauses | AI drafting assistant, approved clause suggestions |
| 3. Internal Review | Manual redlines, version confusion, email chains | AI redline suggestions, version diff, explainable change summaries |
| 4. Compliance Check | Manual scanning against policy and regulation | AI compliance scoring, deviations, regulatory mapping |
| 5. Negotiation / External Review | Counterparty redlines, unacceptable clauses | Clause-level risk scoring, accept/reject/revise recommendations |
| 6. Approval Routing | Wrong approver, missed escalations, bottlenecks | Smart routing based on type, value, region, and risk |
| 7. Execution / Signature | Manual signature follow-up and delays | E-sign integration, reminders, evidence trail |
| 8. Post-Execution / Obligations | Obligations buried in text, dates missed | Obligation extraction, milestone alerts, owner assignment |
| 9. Renewal / Expiry | Auto-renewals missed, renegotiations too late | Renewal intelligence, early warning alerts, portfolio prioritization |
| 10. Analytics | No visibility into cycle time or risk concentration | Contract dashboards, SLA tracking, risk and renewal KPIs |

### Why this matters

- Legal and business teams need faster turnaround without losing governance.
- AI can remove repetitive work, but only if paired with deterministic guardrails and human review.
- Contract value is created across the entire lifecycle, not only at drafting or signature.
- Most contract tools still solve isolated steps instead of the full workflow end to end.

### Workflow Separation Principle

The product must preserve two distinct but connected lifecycle models:

| Lifecycle | Purpose | Example Stages |
|-----------|---------|----------------|
| Contract Lifecycle | Business workflow for moving an agreement from request through renewal | Request, Drafting, Review, Compliance, Negotiation, Approval, Signature, Obligations, Renewal, Analytics |
| AgentOps Lifecycle | SDLC and operational workflow for building, validating, deploying, observing, and improving the AI system | Design, Test, Deploy, Run, Monitor, Evaluate, Detect, Feedback |

The contract workflow answers **where the agreement is in the business process**.
The AgentOps workflow answers **how the AI system supporting that process is designed, validated, deployed, and improved**.

These lifecycles must not be collapsed into one model. Instead:

- Contract Lifecycle remains the user-facing business workflow.
- AgentOps remains the engineering and operational workflow for AI quality and governance.
- Product analytics should allow business-stage outcomes and AgentOps evidence to be correlated without merging their state models.

### Agentized Stage Model

The contract lifecycle should be implemented as an **agentized business workflow**:

- Each contract business stage may be backed by **one or more specialized agents**.
- Those agents are the units that fit naturally into the AgentOps lifecycle for design, validation, deployment, runtime observation, evaluation, drift detection, and feedback.
- The business-stage model remains contract-centric, while the implementation model can be agent-centric.

Example pattern:

| Contract Stage | Possible Agentization Pattern |
|----------------|-------------------------------|
| Request / Initiation | Intake agent, metadata validation agent |
| Authoring / Drafting | Drafting agent, clause recommendation agent |
| Internal Review | Redline analysis agent, version diff agent |
| Compliance Check | Policy mapping agent, regulatory review agent |
| Negotiation / External Review | Counterparty review agent, fallback recommendation agent |
| Approval Routing | Routing agent, escalation agent |
| Execution / Signature | Signature orchestration agent, reminder agent |
| Post-Execution / Obligations | Obligation extraction agent, task assignment agent |
| Renewal / Expiry | Renewal detection agent, alert prioritization agent |
| Analytics | Reporting agent, insight summarization agent |

This model allows the contract lifecycle to "wrap around" AgentOps operationally without merging lifecycle states.

### What happens if we do not solve this

- Legal remains a bottleneck for routine agreements.
- High-risk clauses are handled inconsistently across reviewers.
- Obligations, renewals, and post-signature commitments continue to leak value.
- Reporting remains retrospective instead of operational.

---

## 2. Target Users

### Primary Users

**Persona 1: Legal Operations Manager**
- Goal: standardize contracting, reduce cycle time, improve adoption.
- Pain: too many handoffs, weak visibility, inconsistent data capture.

**Persona 2: In-House Counsel / Contract Reviewer**
- Goal: focus on real legal judgment, not repetitive redlining.
- Pain: first-pass review volume, fragmented versioning, unclear escalation logic.

**Persona 3: Business Requestor (Sales, Procurement, HR, Finance)**
- Goal: start contracts quickly and get them signed without legal confusion.
- Pain: wrong forms, missing data, unclear status, approval delays.

**Persona 4: Compliance / Security Reviewer**
- Goal: ensure policy and regulatory alignment without reading every line manually.
- Pain: inconsistent policy checks, slow exception handling, weak auditability.

### Secondary Users

- Executive stakeholders tracking contract throughput and risk exposure
- Revenue operations teams monitoring deal velocity
- Vendor management teams tracking obligations and renewals
- IT platform teams responsible for integrations, identity, and audit trails

---

## 3. Goals and Success Metrics

### Product Goals

1. Create one stage-based workflow model that covers the full contract lifecycle from intake to analytics.
2. Use AI to accelerate low-risk and repetitive work while preserving human control on material decisions.
3. Convert contract data into structured, searchable, reportable operational signals.
4. Make post-signature obligations and renewals first-class workflow stages, not afterthoughts.
5. Keep the system explainable, auditable, and compliant across AI-assisted decisions.
6. Preserve a clean separation between business workflow state and AgentOps lifecycle state.
7. Represent contract stages as agentizable units so they fit naturally into AgentOps design, test, deploy, run, and improvement flows.

### Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Intake completeness on first submission | Unknown / manual | 90%+ required fields complete |
| Template recommendation accuracy | No automation | 85%+ correct first recommendation |
| First-pass drafting time | Hours to days | 50% reduction |
| Internal review turnaround | Email-driven | 40% reduction |
| Compliance issue detection recall | Manual spot checks | 90% on policy-backed clauses |
| Approval routing accuracy | Manual routing | 95% correct approver path |
| Signature turnaround | Manual follow-up | 30% reduction |
| Obligation extraction precision | Ad hoc | 90%+ on tracked obligations |
| Renewal alerts created before deadline | Inconsistent | 95% for contracts with renewal clauses |
| Dashboard visibility | Fragmented | End-to-end stage metrics for 100% of managed contracts |

### AI Outcome Metrics

| Metric | Target |
|--------|--------|
| Structured output conformance | 99%+ valid schema outputs |
| Hallucination rate on clause or policy citations | Less than 2% in eval set |
| Human override rate for low-risk recommendations | Less than 15% after tuning |
| Average AI response latency for interactive steps | Less than 8 seconds |
| Evaluation gate for production model change | No release if score drops more than 10% from baseline |

---

## 4. Research Summary

### Sources Consulted

| Source | URL | Relevance |
|--------|-----|-----------|
| Ironclad AI agents article | https://ironcladapp.com/product/ai/ | Intake, redlining, lifecycle-wide agent patterns, HITL emphasis |
| Juro legal AI guide | https://juro.com/ai | AI-native CLM patterns, adoption lessons, explainability, playbook design |
| Cflow contract workflow automation article | https://www.cflowapps.com/contract-lifecycle-management/ | Workflow bottlenecks, renewal alerts, approval automation, analytics |
| NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Responsible AI governance and trustworthiness |
| UK GDPR guidance and resources | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/ | Privacy, AI, accountability, security, international transfers |
| eIDAS Regulation overview | https://digital-strategy.ec.europa.eu/en/policies/eidas-regulation | Electronic trust services, signatures, cross-border validity |
| California Consumer Privacy Act overview | https://oag.ca.gov/privacy/ccpa | Data subject rights, notices, deletion, correction, sensitive data controls |

### Key Findings

1. The market has converged on lifecycle-wide intelligence rather than point automation.
   Ironclad and Juro both position AI as embedded across intake, review, negotiation, approvals, repository search, and renewals rather than as a one-off chatbot.

2. Playbooks and clause libraries are prerequisites, not optional enhancements.
   Juro repeatedly emphasizes that AI quality depends on structured playbooks, fallback clauses, escalation points, and explainable outputs. This aligns with the need for pre-approved clause libraries in drafting, review, and negotiation.

3. Intake and routing are high-value automation targets.
   Ironclad frames intake as the "front door of legal" and highlights metadata extraction plus form population as a material cycle-time reducer. This validates Stage 1 and Stage 6 as core workflow stages, not administrative overhead.

4. Redlining, review, and negotiation need explainability.
   Both Ironclad and Juro emphasize reasoning, source-backed recommendations, and human control. Black-box redlines are not acceptable in legal workflows.

5. Post-signature stages are essential product scope.
   Cflow and Juro both stress renewal management, obligation tracking, searchable repositories, and alerting as critical to ROI. Stopping at signature would leave major business value unrealized.

6. Analytics must be operational, not passive reporting.
   The strongest market pattern is stage metrics tied to approvals, renewals, backlog, risk concentration, and throughput rather than static contract archives.

7. Responsible AI and privacy controls must be built into the operating model.
   NIST AI RMF supports trustworthiness, measurement, and governance. UK GDPR and CCPA require accountability, data minimization, notices, correction/deletion rights, and controls over personal or sensitive information. eIDAS highlights the need for trusted digital signature and evidence services for cross-border electronic transactions.

### Comparison Matrix

| Solution | Workflow Coverage | Notable Strengths | Weaknesses / Gaps Observed | User Reception Signal |
|----------|-------------------|-------------------|----------------------------|-----------------------|
| Ironclad | Intake to renewal | Lifecycle-wide agents, workflow-native AI, HITL governance, repository search | Heavy emphasis on internal workflow engine; less detail publicly visible on post-signature obligation modeling depth | Public positioning focuses on reducing manual bottlenecks and preserving human control |
| Juro | Draft, review, approval, sign, store, track, analytics | AI-native CLM, playbook-driven review, explainability, self-serve business workflows, adoption guidance | Public materials emphasize in-house legal and SMB/mid-market ease of use more than deep enterprise process orchestration | Strong public adoption narrative; multiple quotes stress time savings and reduced bottlenecks |
| Cflow | Workflow automation across creation, approval, compliance, renewal, analytics | Clear stage automation language, measurable cycle-time claims, audit trail and renewal focus | More workflow-automation-led than legal-domain-specific AI depth | Public content strongly reinforces common workflow pain points and ROI arguments |

### User Needs Validation

Evidence from public sources consistently points to the same recurring pain:

- Manual review and email chains slow approvals and create version confusion.
- Legal teams need self-serve intake and drafting for routine work.
- Missed renewals and buried obligations create avoidable cost and risk.
- AI adoption fails when the workflow is unclear, the playbook is weak, or outputs are not explainable.

Direct independent review-platform extraction was limited during this research pass, so the strongest user signals here come from vendor-published adoption guidance, public practitioner quotes surfaced in Juro content, and cross-vendor pattern consistency. This is a known evidence gap and should be supplemented with stakeholder interviews before final prioritization.

### Chosen Approach Rationale

The recommended product shape is a stage-aware contract lifecycle workflow with AI assistance at every stage, but with deterministic policy controls, structured outputs, and human checkpoints at review, compliance exceptions, negotiation exceptions, and approval.

This approach was chosen because it matches both the market direction and the repo's current architecture: AI agents already exist for intake, extraction, compliance, and approval, and the workflow infrastructure can be extended to support the remaining lifecycle stages.

It also matches the repo's existing operating model: the `contract-agentops-demo` already uses AgentOps as the lifecycle for AI design, runtime validation, deployment, monitoring, evaluation, drift detection, and feedback. The new contract stages should sit on top of that platform as the business process being executed and observed.

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Chatbot-only legal assistant | Too shallow for routing, auditability, lifecycle tracking, and deterministic governance |
| Signature-only or review-only point solution | Solves one bottleneck but leaves obligations, renewals, and analytics fragmented |
| Fully autonomous contract processing with no HITL | Not credible for legal risk, exception handling, or explainability |
| Repository-only analytics after signature | Misses upstream value in intake, drafting, review, compliance, and negotiation |

---

## 5. Requirements

### 5.1 Functional Requirements

#### P0 Must Have

1. **Stage-based contract workflow model**
   - The system must represent all 10 lifecycle stages as first-class workflow stages.
   - Each contract must show current stage, previous stage, next action, owner, and SLA.
   - The contract workflow state model must remain separate from AgentOps lifecycle state.
   - The system must support linking a contract-stage execution to AgentOps evidence such as trace, evaluation, drift, and feedback records without replacing business-stage status.

2. **Agentized business-stage implementation model**
   - Each business stage must be representable by one or more specialized agents.
   - Agent decomposition must support stage-specific prompts, tools, schemas, and evaluation.
   - The design must support stage-to-agent mapping without requiring one stage to equal exactly one agent.

3. **AI-guided intake and template recommendation**
   - Intake must validate completeness before submission.
   - AI must recommend a template based on contract type, request purpose, counterparty type, jurisdiction, and risk context.

4. **Drafting assistant with approved clause support**
   - Users must be able to start from approved templates.
   - AI suggestions must come from approved clause libraries and playbooks, not unconstrained generation.

5. **Internal review with redline intelligence**
   - AI must summarize changes, identify missing clauses, and compare versions.
   - Reviewers must see an explanation for each suggested redline.

6. **Compliance scoring and policy mapping**
   - Contracts must be checked against internal playbooks and mapped regulatory requirements.
   - Deviations must cite clause evidence and applicable policy or regulation.

7. **Negotiation assistance**
   - Counterparty redlines must be risk scored per clause.
   - The system must recommend accept, revise, escalate, or reject actions with rationale.

8. **Approval routing and escalation**
   - The system must route contracts based on contract type, contract value, geography, risk score, and exception flags.
   - Escalations must trigger when SLA thresholds or risk rules are breached.

9. **Execution and signature orchestration**
   - The system must integrate with an e-sign provider.
   - Signature status, audit evidence, reminders, and completion timestamps must be tracked.

10. **Obligation and milestone tracking**
   - Post-signature obligations must be extracted into structured records.
   - Each obligation must support owner, due date, status, and reminder workflow.

11. **Renewal and expiry intelligence**
   - Renewal terms and notice windows must be extracted and monitored.
   - Users must receive pre-renewal alerts with recommended action windows.

12. **Lifecycle analytics dashboard**
   - Dashboard must show cycle time by stage, risk distribution, approval backlog, signature lag, obligation compliance, and renewal exposure.
   - Users must be able to filter by business unit, contract type, geography, and counterparty.

#### P1 Should Have

1. AI-generated negotiation fallback language tied to approved playbooks
2. Portfolio-level anomaly detection for unusual clauses or risk clustering
3. Approval bottleneck prediction based on historical routing patterns
4. Renewal prioritization by spend, revenue, risk, and notice window
5. Counterparty behavior analytics across negotiation cycles

#### P2 Could Have

1. Multilingual drafting and review support
2. Voice or chat-based contract intake for business users
3. Benchmarking against market-standard fallback clauses by geography or industry
4. Contract portfolio forecasting for renewal volume and legal team capacity

### 5.2 GenAI Requirements

#### AI Classification

- [x] GenAI / LLM required
- [x] RAG / grounded retrieval required
- [x] Agent or workflow orchestration required
- [x] Human-in-the-loop required
- [ ] Fine-tuning required at MVP

#### Model and Evaluation Requirements

| Requirement | Specification |
|-------------|---------------|
| Primary model posture | Enterprise LLM with strong structured output and reasoning support |
| Model pinning | Explicit pinned model version in config, not floating aliases only |
| Grounding | Clause library, policy corpus, approval rules, and contract metadata |
| Evaluation set | Stage-specific eval sets for intake, drafting, review, compliance, negotiation, obligation extraction, renewal extraction |
| Quality gates | No production promotion if structured output validity, citation accuracy, or stage accuracy falls below threshold |
| Fallback behavior | Graceful escalation to human review when confidence or schema validity is low |

#### Guardrails

- AI must cite the clause, source text, or policy that supports each recommendation.
- AI must not silently rewrite contract text without change visibility.
- High-risk outputs must require human approval before external action.
- The system must log prompts, outputs, citations, and overrides for audit.
- Sensitive contract data must follow privacy and retention controls.

#### Responsible AI Requirements

- Apply NIST AI RMF-aligned governance for mapping, measuring, managing, and governing AI risks.
- Include explainability for review, compliance, negotiation, and routing recommendations.
- Support human override and feedback loops at every risk-bearing stage.
- Track drift, error patterns, and override rates over time.

### 5.3 Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Security | Role-based access control, audit trails, encryption in transit and at rest |
| Privacy | Support data minimization, deletion, correction, notice, and access workflows where regulated data is present |
| Reliability | Workflow retries, idempotent transitions, durable event history |
| Performance | Interactive AI steps should complete in less than 8 seconds in normal conditions |
| Accessibility | Workflow UI should meet WCAG 2.1 AA standards |
| Interoperability | Integrate with CRM, ERP, procurement, document storage, and e-sign tools |
| Searchability | Structured contract data and extracted obligations must be queryable |
| Architecture | Business stages must map to one or more agent units that can be designed, tested, deployed, run, and observed through AgentOps |

---

## 6. User Stories and Acceptance Criteria

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-1 | As a business requestor, I want guided intake so that I submit complete requests the first time. | Required fields enforced, AI suggests template, missing inputs flagged before submit. | P0 |
| US-2 | As a contract author, I want AI-assisted drafting from approved language so that I do not start from scratch. | Template selected, approved clauses suggested, unsupported freeform generation blocked or warned. | P0 |
| US-3 | As internal counsel, I want AI redline and version summaries so that I can review faster with confidence. | Version diff displayed, clause deviations highlighted, redline rationale visible. | P0 |
| US-4 | As a compliance reviewer, I want policy and regulatory mapping so that non-compliant clauses are identified early. | Clause citations shown, policy links attached, deviation severity scored. | P0 |
| US-5 | As a negotiator, I want clause-level recommendations so that I know what to accept, reject, or escalate. | Accept/revise/reject recommendation available per issue, with fallback language when allowed. | P0 |
| US-6 | As a legal ops manager, I want smart approval routing so that contracts reach the right approver without manual triage. | Routing rules use type, value, risk, region, and exception flags; SLA timers start automatically. | P0 |
| US-7 | As an approver, I want signature workflow visibility so that I can track pending execution and reminders. | Signature status visible, reminders sent, completion audit trail stored. | P0 |
| US-8 | As an obligation owner, I want obligations extracted and assigned so that I do not miss commitments. | Due dates, owners, reminders, and completion status captured for extracted obligations. | P0 |
| US-9 | As a vendor manager, I want renewal alerts early enough to act so that contracts do not auto-renew unintentionally. | Renewal dates and notice windows extracted, alerts triggered before notice deadline. | P0 |
| US-10 | As an executive stakeholder, I want lifecycle analytics so that I can spot bottlenecks and risk exposure. | Dashboard shows cycle time, backlog, renewal exposure, obligation status, and risk trends. | P0 |
| US-11 | As a model owner, I want eval gates and drift tracking so that AI changes do not degrade legal quality. | Baseline retained, releases gated, override and drift metrics visible. | P1 |
| US-12 | As a global team member, I want multilingual support so that contracts in multiple languages can use the same workflow. | Language detection and multilingual review available for supported jurisdictions. | P2 |

---

## 7. User Flows

### Primary Flow: Standard Contract Lifecycle

1. Requestor submits an intake request.
2. System validates completeness and recommends template.
3. Requestor or legal author creates first draft from approved language.
4. Internal reviewers receive AI-generated summary, diffs, and redline suggestions.
5. Compliance engine scores the contract and flags deviations.
6. If counterparty paper or redlines exist, negotiation assistant evaluates clause changes and recommends response.
7. Approval routing sends the contract to the correct approvers based on rules.
8. Approved contract moves to e-signature.
9. Signed contract is parsed for obligations, milestones, and renewal terms.
10. Portfolio analytics updates in near real time.

### Exception Flow: High-Risk Contract

1. Compliance or negotiation stage detects a high-risk deviation.
2. System blocks auto-progression.
3. Contract is escalated to legal or security approver with AI rationale and cited evidence.
4. Reviewer approves, rejects, or requests revision.
5. Workflow resumes only after explicit decision.

### Renewal Flow

1. System extracts renewal date, auto-renewal clause, and notice period.
2. Owner receives alert at configured notice intervals.
3. Dashboard prioritizes renewals by value, risk, and time remaining.
4. Renewal decision launches amendment, renegotiation, or termination workflow.

---

## 8. Dependencies and Constraints

### Dependencies

- Approved contract templates per contract type
- Clause library with fallback positions
- Playbook and policy corpus by jurisdiction and risk domain
- Approval matrix with owner and escalation logic
- E-signature platform integration
- Contract repository and search index
- Structured analytics model and workflow event telemetry
- AI evaluation datasets and baseline metrics
- AgentOps telemetry, evaluation, drift, and feedback surfaces from the existing platform

### Constraints

- Legal AI outputs must remain explainable and reviewable.
- Contract data may contain personal or sensitive information and must support privacy obligations.
- Signature and trust-service behavior must be jurisdiction-aware.
- The existing `contract-agentops-demo` architecture is already oriented around intake, extraction, compliance, approval, evaluation, drift, and feedback; new stages should extend that model rather than replace it.
- AgentOps must remain intact as the SDLC and operational lifecycle. Contract Lifecycle must be added as a business workflow layer, not as a replacement for AgentOps stages or views.

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Wrong template recommendation | Bad draft quality and rework | Confidence thresholds, user confirmation, fallback to manual choice |
| Hallucinated legal recommendation | Legal and compliance exposure | Retrieval grounding, citations, schema validation, HITL checkpoints |
| Poor playbook quality | AI outputs drift from company policy | Playbook governance, clause-library ownership, periodic review |
| Misrouted approvals | Delay and governance failure | Deterministic routing rules plus exception audits |
| Missed obligations due to extraction error | Operational or financial exposure | Confidence scoring, human verification for high-value contracts |
| Privacy violations in contract data handling | Regulatory and reputational risk | Data minimization, notices, retention rules, deletion/correction workflows |
| Over-automation reduces user trust | Low adoption | Explainability, transparent overrides, pilot with measurable wins |
| Cross-border signature assumptions are wrong | Enforceability concerns | Use trusted e-sign provider, legal review by jurisdiction, evidence retention |

---

## 10. Timeline and Milestones

### Phase 1: Foundation Workflow

Scope:
- Intake
- Drafting
- Internal review
- Compliance
- Approval routing

Outcome:
- Working pre-signature workflow with explainable AI and deterministic routing.

### Phase 2: External Execution and Post-Signature

Scope:
- Negotiation support
- Signature orchestration
- Obligation extraction
- Renewal monitoring

Outcome:
- End-to-end contract execution and post-signature visibility.

### Phase 3: Analytics and Optimization

Scope:
- Portfolio dashboards
- Override analytics
- Drift tracking
- Stage SLA reporting
- Renewal prioritization

Outcome:
- Operational visibility and measurable business impact.

### Phase 4: Advanced Intelligence

Scope:
- Counterparty behavior analytics
- Forecasting
- Multilingual support
- Predictive approval bottlenecking

Outcome:
- Higher maturity AI operations and broader global coverage.

---

## 11. Out of Scope

- Fully autonomous legal decision-making with no human approval
- Replacing external counsel for bespoke or high-stakes negotiations
- Blockchain or smart-contract execution as MVP scope
- Broad legal research outside the contract lifecycle workflow
- General enterprise document management beyond contract-domain needs

---

## 12. Open Questions

1. Which contract types are in MVP scope: NDA, MSA, SOW, procurement, employment, partner, or all of the above?
2. Which systems will be the source of truth for request initiation: CRM, procurement system, ticketing system, or native intake form?
3. What jurisdictional coverage is required at launch for signature and regulatory mapping?
4. Which approval dimensions are mandatory at MVP: value, geography, security risk, data sensitivity, procurement category?
5. Will obligations be tracked only in this platform or synchronized to existing task / ERP systems?
6. What is the acceptable confidence threshold for auto-progression versus mandatory human review?
7. Which privacy regimes are in scope at launch: GDPR, UK GDPR, CCPA/CPRA, sector-specific rules?
8. Should the workflow support contract repository migration, or only new in-flight contracts at MVP?

---

## 13. Appendix

### Recommended MVP Workflow Stages

| Order | Stage | MVP Decision |
|-------|-------|--------------|
| 1 | Request / Initiation | Include |
| 2 | Authoring / Drafting | Include |
| 3 | Internal Review | Include |
| 4 | Compliance Check | Include |
| 5 | Negotiation / External Review | Include as guided support, not full autonomy |
| 6 | Approval Routing | Include |
| 7 | Execution / Signature | Include |
| 8 | Post-Execution / Obligations | Include |
| 9 | Renewal / Expiry | Include |
| 10 | Analytics | Include |

### Agentization Principle

The recommended operating model is:

- Business stakeholders see **contract stages**.
- Platform and AI operators configure **agents mapped to those stages**.
- AgentOps handles the lifecycle of those agent units across design, test, deploy, run, monitor, evaluate, detect, and feedback.
- Reporting correlates the business-stage view and the agent evidence view without collapsing them into one status model.

### Standards and Compliance Notes

- **NIST AI RMF** supports the trustworthiness and governance model for AI-assisted legal workflows.
- **UK GDPR / GDPR-style controls** require attention to lawful basis, minimization, security, accountability, AI explainability, and international transfers where contract data contains personal information.
- **CCPA / CPRA** requires notices, deletion/correction handling, and controls over sensitive personal information for in-scope businesses.
- **eIDAS** highlights the need for trusted electronic signature and trust-service evidence in EU contexts and cross-border transactions.
- **US electronic signature requirements** should be confirmed with legal counsel and selected provider capabilities before implementation decisions are finalized.

### Product Positioning Statement

This product is not just AI for drafting. It is AI plus workflow orchestration across the full contract lifecycle, with explainable recommendations, deterministic controls, human approvals, and portfolio intelligence.

It is also not a replacement for AgentOps. The contract lifecycle is the business process, while AgentOps remains the lifecycle that governs how the AI system is designed, deployed, measured, and improved.

