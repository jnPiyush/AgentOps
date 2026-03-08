# PRD: Interactive Workflow Designer Canvas

**Epic**: Interactive Workflow Designer Canvas
**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-03-07
**Stakeholders**: Piyush Jain (Creator/Lead), Demo Audiences, Microsoft Foundry Users
**Priority**: P0
**Related PRD**: [PRD-ContractAgentOps-Demo.md](PRD-ContractAgentOps-Demo.md)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Research Summary](#2-research-summary)
3. [Target Users](#3-target-users)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [Requirements](#5-requirements)
6. [User Stories & Features](#6-user-stories--features)
7. [User Flows](#7-user-flows)
8. [Dependencies & Constraints](#8-dependencies--constraints)
9. [Risks & Mitigations](#9-risks--mitigations)
10. [Timeline & Milestones](#10-timeline--milestones)
11. [Out of Scope](#11-out-of-scope)
12. [Open Questions](#12-open-questions)

---

## 1. Problem Statement

### What problem are we solving?

The current **Design Canvas** in the React dashboard (`DesignCanvas.tsx`) is **completely static** — it displays a hardcoded list of 4 agents in a fixed sequential pipeline. Users cannot:

- Add, remove, or configure agents
- Define agent roles, responsibilities, or tool associations
- Arrange agents in different workflow topologies (sequential, parallel, conditional)
- Save, load, or manage multiple workflow designs
- Push a custom-designed workflow through the full AgentOps lifecycle (Build → Deploy → Live)

Meanwhile, the vanilla JS UI (`ui/workflow-designer.js`) already has a **fully functional** interactive workflow designer with add/edit/delete agents, drag-to-reorder, save/load, and Push to Pipeline. However, the React dashboard — which is the target for the enhanced experience — lacks all of this interactivity.

### Why is this important?

- **Demo Impact**: A static canvas undermines the "Design" story in the 8-stage AgentOps demo. Audiences cannot see the power of visual workflow design.
- **User Empowerment**: Users should be able to design custom agentic workflows tailored to their use case, not be locked into a fixed 4-agent pipeline.
- **End-to-End Story**: The workflow designed on the canvas should flow through Build, Deploy, and Live stages — creating a seamless AgentOps lifecycle demo.
- **Competitive Parity**: Tools like n8n, LangGraph Studio, CrewAI, and Flowise all offer visual workflow builders. Our Design Canvas should match or exceed this level of interactivity.

### What happens if we don't solve this?

The React dashboard's Design view remains a static display, breaking the narrative that users can "design, build, deploy, and operate" agentic workflows. The vanilla JS UI has this capability but lacks the component architecture and state management needed for a polished experience.

---

## 2. Research Summary

### Prior Art Analysis

| Solution | Approach | Strengths | Weaknesses |
|----------|----------|-----------|------------|
| **n8n** | Node-based visual editor with drag-drop connections, 400+ integrations | Rich node library, visual connections between nodes, execution data visible on each node | Complex for simple workflows, enterprise-focused pricing |
| **React Flow / xyflow** | Open-source React library for node-based UIs (35.5K GitHub stars) | MIT licensed, infinitely customizable, built-in drag/zoom/pan, used by Stripe/Zapier | Library only — no agent-specific features, requires building agent abstractions on top |
| **LangGraph Studio** | Visual debugger/IDE for LangGraph agent workflows | Deep LangChain integration, state visualization, time-travel debugging | Tightly coupled to LangGraph, not a general workflow designer |
| **CrewAI** | YAML-based agent role definition with visual flow | Clean role/goal/backstory model for agents, task-based decomposition | Limited visual builder, primarily code-first |
| **Flowise** | Drag-drop LLM flow builder with LangChain nodes | Low-code, visual connections, chatbot-focused | Not agent-ops focused, no lifecycle management |

### Key Patterns Identified

1. **Node-based canvas** is the industry standard for workflow design (n8n, Flowise, React Flow)
2. **Agent configuration via modal/panel** — define role, tools, model, boundary in a side panel or dialog
3. **Topology selection** — users choose Sequential, Parallel, Fan-out, Conditional patterns
4. **Save/Load persistence** — workflows stored as JSON, loadable from a library
5. **Push to execution** — designed workflows activate for the rest of the pipeline

### Existing Implementation Assets

The vanilla JS UI (`ui/workflow-designer.js`) already implements:
- Agent CRUD (add, edit, delete) with modal form
- Tool selection from available MCP tools (8 servers, 21 tools)
- Drag-to-reorder with HTML5 Drag API
- 5 workflow types (Sequential, Parallel, Sequential+HITL, Fan-out, Conditional)
- Save/Load to localStorage + Push to Pipeline via gateway API
- Export to JSON

The gateway API (`gateway/src/routes/workflows.ts`) already has:
- `POST /api/v1/workflows` — save workflow
- `GET /api/v1/workflows` — list saved workflows
- `GET /api/v1/workflows/:id` — get specific workflow
- `POST /api/v1/workflows/:id/activate` — activate workflow for pipeline
- `DELETE /api/v1/workflows/:id` — delete workflow

### Technology Decision

Port the proven vanilla JS workflow designer functionality into the React dashboard using **React Flow (@xyflow/react)** for the visual canvas. React Flow provides:
- Professional node-based canvas with built-in pan/zoom/drag
- Custom node types (for agent cards)
- Edge connections between nodes (for data flow visualization)
- Minimap and controls plugins
- MIT license, 35.5K stars, used by Stripe, Zapier, Typeform

### Compliance & Standards

- **WCAG 2.1 AA**: All interactive elements must be keyboard accessible
- **No new backend dependencies**: Reuse existing gateway workflow API
- **Data security**: Workflow definitions contain no PII; localStorage + gateway persistence is acceptable for a demo

---

## 3. Target Users

### Primary Users

**User Persona 1: Demo Presenter**
- **Goals**: Show audience how to visually design an agentic workflow, configure agents, and activate the pipeline
- **Pain Points**: Static canvas requires verbal explanation; interactive canvas is self-evident
- **Behaviors**: Adds/removes agents during live demo, switches workflow types, saves and loads different scenarios

**User Persona 2: Developer / Self-Guided Learner**
- **Goals**: Experiment with different agent configurations, tool combinations, and workflow topologies
- **Pain Points**: Cannot iterate on workflow design without editing code
- **Behaviors**: Creates multiple workflows, exports JSON for inspection, tests different model assignments

**User Persona 3: Technical Decision Maker (Audience)**
- **Goals**: See that the platform enables visual workflow design, not just code-based configuration
- **Pain Points**: Needs to see the "Design → Build → Deploy → Live" story connected end-to-end
- **Behaviors**: Watches the presenter design a workflow and activate it; evaluates the UX polish

---

## 4. Goals & Success Metrics

### Business Goals

1. **Close the design gap**: React dashboard Design Canvas becomes fully interactive, matching the vanilla JS UI
2. **End-to-end demo flow**: Workflow designed on canvas propagates through Build, Deploy, and Live stages
3. **Reusability**: Workflow designer is agent-agnostic — can be adapted for any domain beyond contracts

### Success Metrics (KPIs)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Interactive agent CRUD in React canvas | 0 (static) | Full add/edit/delete | MVP |
| Workflow types supported | 1 (static sequential) | 5 (sequential, parallel, HITL, fan-out, conditional) | MVP |
| Drag-to-reorder agents | No | Yes | MVP |
| Save/Load workflows via gateway API | No (React) | Yes | MVP |
| Push to Pipeline activates Build/Deploy/Live | No (React) | Yes | MVP |
| Export workflow as JSON | No (React) | Yes | Post-MVP |

---

## 5. Requirements

### P0 — Must Have (MVP)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| R1 | **Add Agent**: User clicks "Add Agent" → modal/panel opens to define name, role, icon, model, tools, boundary, output | Core workflow design capability |
| R2 | **Edit Agent**: User clicks edit on an agent card → same modal pre-filled with agent data | Iterate on agent configuration |
| R3 | **Remove Agent**: User clicks delete on an agent card → confirmation → agent removed | Manage workflow composition |
| R4 | **Tool Association**: Agent modal shows all available MCP tools grouped by server; user checks tools to associate | Agents must have tool bindings |
| R5 | **Workflow Type Selection**: Toolbar dropdown to select Sequential, Parallel, Sequential+HITL, Fan-out, Conditional | Different workflow topologies |
| R6 | **Visual Layout**: Canvas renders agents in sequential (left-to-right with arrows) or parallel (grid) based on type | Visual representation of topology |
| R7 | **Drag-to-Reorder**: User drags agent cards to change execution order | Arrange workflow sequence |
| R8 | **Save Workflow**: Saves to gateway API (`POST /api/v1/workflows`) + localStorage fallback | Persistence across sessions |
| R9 | **Load Workflow**: Load dialog lists saved workflows; user selects one to load into canvas | Resume previous work |
| R10 | **Push to Pipeline**: Saves + activates workflow → propagates to Build, Deploy, Live tabs | End-to-end AgentOps story |

### P1 — Should Have

| ID | Requirement | Rationale |
|----|-------------|-----------|
| R11 | **React Flow Canvas**: Use @xyflow/react for professional node-based canvas with pan/zoom/minimap | Industry-standard visual experience |
| R12 | **Edge Connections**: Visual edges/arrows between agent nodes showing data flow direction | Clearer workflow visualization |
| R13 | **Workflow Naming**: Editable workflow name in toolbar | Identify saved workflows |
| R14 | **Delete Saved Workflow**: Remove a workflow from the saved list | Manage workflow library |
| R15 | **Inventory Bar**: Show total agents, tools, model, pipeline type at bottom of canvas | At-a-glance stats |

### P2 — Nice to Have

| ID | Requirement | Rationale |
|----|-------------|-----------|
| R16 | **Export JSON**: Download workflow definition as JSON file | Portability and inspection |
| R17 | **Workflow Templates**: Pre-built templates (e.g., Contract Processing, Document Review) | Quick start for users |
| R18 | **Agent Color Picker**: Custom color per agent for visual distinction | UX polish |
| R19 | **Minimap Plugin**: React Flow minimap for large workflows | Navigation aid |
| R20 | **Undo/Redo**: Undo last action on canvas | Error recovery |

---

## 6. User Stories & Features

### Feature 1: Agent CRUD on Canvas

**[Story 1.1]** As a workflow designer, I want to click "Add Agent" and define a new agent's name, role, model, tools, boundary, and output so that I can compose my workflow.

**Acceptance Criteria:**
- Clicking "Add Agent" opens a modal/panel form
- Form fields: Agent Name (required), Icon (1-2 chars, required), Role/Responsibility (textarea, required), Model (dropdown: GPT-4o, GPT-4o-mini, GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, o3-mini, o4-mini), Tools (checkboxes grouped by MCP server), Boundary Constraint (text), Output Description (text), Color (swatch picker)
- Validation: Name, Icon, Role are required; shows error if missing
- On save, agent appears on canvas in correct position
- Toast notification confirms action

**[Story 1.2]** As a workflow designer, I want to edit an existing agent by clicking its edit button so that I can refine its configuration.

**Acceptance Criteria:**
- Clicking edit icon on agent card opens modal pre-filled with current values
- All fields editable
- Save updates the agent in place (preserving order)
- Cancel discards changes

**Story 1.3:** As a workflow designer, I want to remove an agent from the workflow so that I can simplify or restructure.

**Acceptance Criteria:**
- Clicking delete icon on agent card shows confirmation dialog
- On confirm, agent is removed and remaining agents re-ordered
- Toast notification confirms removal

### Feature 2: Tool Association

**Story 2.1:** As a workflow designer, I want to select tools from available MCP servers when configuring an agent so that the agent knows which tools it can use.

**Acceptance Criteria:**
- Agent modal shows all available MCP tools grouped by server (8 servers, 21+ tools)
- Tools displayed with checkboxes; user checks to associate, unchecks to remove
- Selected tools shown on the agent card after save
- Tool list sources from `AVAILABLE_TOOLS` constant (matching existing MCP server registrations)

### Feature 3: Workflow Type & Layout

**Story 3.1:** As a workflow designer, I want to select a workflow type (Sequential, Parallel, HITL, Fan-out, Conditional) so that agents execute in the chosen pattern.

**Acceptance Criteria:**
- Toolbar contains a dropdown with 5 workflow types
- Each type has a label and description shown on hover/selection
- Selecting a type changes the canvas layout:
  - Sequential: left-to-right with arrows
  - Parallel: grid/concurrent layout
  - Sequential+HITL: sequential with HITL checkpoint indicator
  - Fan-out: one node fans to parallel then merges
  - Conditional: branching paths based on output
- Type persists when saving workflow

### Feature 4: Drag-to-Reorder

**Story 4.1:** As a workflow designer, I want to drag agent cards to rearrange their execution order so that I can control the workflow sequence.

**Acceptance Criteria:**
- Agent cards are draggable (drag handle visible)
- Dragging over another agent highlights the drop target
- On drop, agents swap positions and canvas re-renders
- Works in both sequential and parallel layouts
- Order persists when saving workflow

### Feature 5: Save, Load & Manage Workflows

**Story 5.1:** As a workflow designer, I want to save my workflow so that I can resume or share it later.

**Acceptance Criteria:**
- "Save" button saves to gateway API (`POST /api/v1/workflows`)
- Falls back to localStorage if gateway unavailable
- Workflow ID generated on first save; subsequent saves update in place
- Toast confirms save with workflow name

**Story 5.2:** As a workflow designer, I want to load a previously saved workflow from a list so that I can continue editing or review it.

**Acceptance Criteria:**
- "Load" button opens dialog listing all saved workflows
- Each entry shows: name, agent count, workflow type, last updated date
- Clicking a workflow loads it into the canvas (replacing current)
- "Delete" button per entry allows removing from saved list
- Dialog is dismissible via Cancel or Escape

**Story 5.3:** As a workflow designer, I want to push my designed workflow to the pipeline so that it activates across Build, Deploy, and Live stages.

**Acceptance Criteria:**
- "Push to Pipeline" button saves the workflow AND activates it
- Calls `POST /api/v1/workflows/:id/activate` on gateway
- Dispatches `workflow-activated` custom event with workflow data
- Build, Deploy, and Live tabs update to reflect the active workflow
- Toast confirms with workflow name and activation status
- Works in offline/local mode with event dispatch only

### Feature 6: Visual Canvas with React Flow (P1)

**Story 6.1:** As a workflow designer, I want a professional node-based canvas with pan, zoom, and minimap so that I can work with complex workflows.

**Acceptance Criteria:**
- Canvas uses @xyflow/react for rendering
- Agent nodes are custom React Flow nodes (styled like AgentCard)
- Edges connect agents showing data flow direction
- Canvas supports pan (drag background), zoom (scroll/pinch), and fit-to-view
- Minimap shows overview of large workflows
- Controls panel with zoom in/out/fit buttons

---

## 7. User Flows

### 7.1 Primary Flow: Design a New Workflow

```
User opens Design Canvas
  → Sees toolbar with workflow name, type dropdown, action buttons
  → Sees empty canvas with "Add Agent" prompt (or default pipeline)
  → Clicks "Add Agent"
    → Modal opens with form fields
    → Fills in name, role, selects tools, sets model
    → Clicks "Add Agent" button
    → Agent card appears on canvas
  → Repeats for additional agents
  → Selects workflow type from dropdown
    → Canvas re-layouts agents accordingly
  → Drags agents to reorder
  → Clicks "Save"
    → Workflow saved to gateway API
    → Toast confirms
  → Clicks "Push to Pipeline"
    → Workflow activated
    → Build/Deploy/Live tabs update
```

### 7.2 Load & Modify Flow

```
User clicks "Load"
  → Dialog shows saved workflows
  → Selects a workflow
  → Canvas loads with saved agents and configuration
  → Edits an agent (click edit icon)
    → Modal opens pre-filled
    → Makes changes
    → Saves
  → Removes an agent (click delete icon)
    → Confirms
    → Agent removed
  → Saves modified workflow
  → Pushes to Pipeline
```

---

## 8. Dependencies & Constraints

### Dependencies

| Dependency | Type | Status | Risk |
|------------|------|--------|------|
| Gateway workflow API | Backend | ✅ Already exists | Low — API is complete |
| MCP server tool registry | Data | ✅ Already exists | Low — tool list is static |
| React dashboard framework | Frontend | ✅ Already exists | Low — App shell, routing, context in place |
| @xyflow/react (P1) | Library | New dependency | Medium — needs installation and integration |
| AppContext for workflow state | Frontend | Needs extension | Low — add workflow state to existing context |

### Constraints

- **No new backend services**: All workflow persistence uses existing gateway API
- **Dark theme**: Must match existing dashboard dark theme (CSS variables)
- **Projector-friendly**: Large fonts, high contrast, readable from conference room back row
- **Performance**: Canvas must render smoothly with up to 20 agents
- **Browser support**: Modern browsers (Chrome, Edge, Firefox latest)

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| React Flow adds bundle size | Medium | Low | Tree-shakeable; only import needed components |
| Drag-drop complexity in React Flow | Medium | Medium | Start with simple HTML5 drag (like vanilla JS), upgrade to React Flow DnD later |
| State management complexity | Medium | Medium | Use React context + useReducer for workflow state |
| Gateway API unavailable during demo | Low | High | localStorage fallback already pattern-proven in vanilla JS UI |
| Canvas performance with many agents | Low | Medium | Gateway enforces max 20 agents; React Flow handles thousands of nodes |

---

## 10. Timeline & Milestones

### MVP (P0 features)
- Agent CRUD with modal form (Stories 1.1–1.3)
- Tool association (Story 2.1)
- Workflow type & layout (Story 3.1)
- Drag-to-reorder (Story 4.1)
- Save/Load/Push to Pipeline (Stories 5.1–5.3)

### Post-MVP (P1 + P2 features)
- React Flow canvas integration (Story 6.1)
- Export JSON, templates, color picker, minimap, undo/redo

---

## 11. Out of Scope

- **Agent code generation**: The designer defines workflow topology and agent config; it does not generate agent source code
- **Real-time multi-user collaboration**: Single-user design experience only
- **Visual code editor**: No inline code editing in the canvas
- **Custom MCP tool creation**: Users select from existing tools; creating new tools is out of scope
- **Workflow versioning/diff**: Save overwrites; no version history
- **Deployment automation**: "Push to Pipeline" activates the workflow in the UI; it does not trigger actual CI/CD deployment

---

## 12. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should we use React Flow from MVP or start with simple CSS layout and add React Flow in P1? | Tech Lead | **Resolved** — Keep it simple: use CSS-based layout for MVP. React Flow deferred to P1. |
| 2 | Should workflow persistence use a file-based store (JSON files in `data/`) in addition to gateway in-memory store? | Architect | **Needs Architect Validation** — Workflows and agents must persist for production deployment, not just in-memory. Architect to validate storage strategy (file-based JSON in `data/`, database, or hybrid). |
| 3 | Should the canvas support freeform node positioning (absolute x,y) or only auto-layout? | UX Designer | **Resolved** — Auto-layout only. Current implementation works well; no freeform positioning needed. |
| 4 | Do we need workflow validation before Push to Pipeline (e.g., at least 1 agent, required tools)? | PM | **Resolved** — Yes. Minimum: at least 1 agent, each agent must have a name and role. |

---

## Appendix

### A. Existing Tool Registry

| MCP Server | Tools |
|------------|-------|
| contract-intake-mcp | upload_contract, classify_document, extract_metadata |
| contract-extraction-mcp | extract_clauses, identify_parties, extract_dates_values |
| contract-compliance-mcp | check_policy, flag_risk, get_policy_rules |
| contract-workflow-mcp | route_approval, escalate_to_human, notify_stakeholder |
| contract-audit-mcp | get_audit_log, create_audit_entry |
| contract-eval-mcp | run_evaluation, get_baseline |
| contract-drift-mcp | detect_drift, model_swap_analysis |
| contract-feedback-mcp | submit_feedback, optimize_feedback |

### B. Workflow Type Definitions

| Type | ID | Description |
|------|----|-------------|
| Sequential | sequential | Agents execute one after another in order |
| Parallel | parallel | Agents execute simultaneously, results merged |
| Sequential + HITL | sequential-hitl | Sequential with human-in-the-loop checkpoint |
| Fan-out / Fan-in | fan-out | One agent fans out to parallel, then merges |
| Conditional | conditional | Agent routes to different agents based on output |

### C. Agent Data Model

```typescript
interface WorkflowAgent {
  id: string;
  name: string;
  role: string;
  icon: string;
  model: string;
  tools: string[];
  boundary: string;
  output: string;
  color: string;
  order: number;
}

interface Workflow {
  id: string;
  name: string;
  type: "sequential" | "parallel" | "sequential-hitl" | "fan-out" | "conditional";
  agents: WorkflowAgent[];
  createdAt: string;
  updatedAt: string;
}
```
