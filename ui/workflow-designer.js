/* ============================================================
   Workflow Designer - Interactive Agentic Workflow Canvas
   Drag/drop, add/edit/delete agents, save/load workflows
   ============================================================ */

// --- Workflow State ---
const WorkflowDesigner = (() => {
  // Color palette for dynamic agents
  const AGENT_COLORS = [
    "#0078d4", "#00b294", "#8861c4", "#ff8c00",
    "#e74c3c", "#3498db", "#2ecc71", "#9b59b6",
    "#1abc9c", "#e67e22", "#e91e63", "#00bcd4"
  ];

  const WORKFLOW_TYPES = [
    { id: "sequential", label: "Sequential", description: "Agents execute one after another in order" },
    { id: "parallel",   label: "Parallel",   description: "Agents execute simultaneously, results merged" },
    { id: "sequential-hitl", label: "Sequential + HITL", description: "Sequential with human-in-the-loop checkpoint" },
    { id: "fan-out",    label: "Fan-out / Fan-in", description: "One agent fans out to parallel, then merges" },
    { id: "conditional", label: "Conditional",  description: "Agent routes to different agents based on output" },
  ];

  const AGENT_KINDS = [
    { id: "agent", label: "Agent" },
    { id: "orchestrator", label: "Orchestrator" },
    { id: "human", label: "Human Checkpoint" },
    { id: "merge", label: "Merge Node" },
  ];

  const MODEL_OPTIONS = ["GPT-5.4", "GPT-4o-mini", "GPT-4.1", "GPT-4.1-mini", "GPT-4.1-nano", "o3-mini", "o4-mini"];

  // All available MCP tools organized by server
  const AVAILABLE_TOOLS = {
    "contract-intake-mcp":      ["upload_contract", "classify_document", "extract_metadata"],
    "contract-extraction-mcp":  ["extract_clauses", "identify_parties", "extract_dates_values"],
    "contract-compliance-mcp":  ["check_policy", "flag_risk", "get_policy_rules"],
    "contract-workflow-mcp":    ["route_approval", "escalate_to_human", "notify_stakeholder"],
    "contract-audit-mcp":       ["get_audit_log", "create_audit_entry"],
    "contract-eval-mcp":        ["run_evaluation", "get_baseline"],
    "contract-drift-mcp":       ["detect_drift", "model_swap_analysis"],
    "contract-feedback-mcp":    ["submit_feedback", "optimize_feedback"],
  };

  // Current workflow state
  let currentWorkflow = {
    id: null,
    name: "Untitled Workflow",
    type: "sequential",
    agents: [],
    createdAt: null,
    updatedAt: null,
  };

  let savedWorkflows = [];
  let dragState = { dragging: false, agentId: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };
  let nextAgentId = 1;

  function compareAgents(a, b) {
    return (a.stage ?? 0) - (b.stage ?? 0)
      || (a.lane ?? 0) - (b.lane ?? 0)
      || (a.order ?? 0) - (b.order ?? 0)
      || String(a.name || "").localeCompare(String(b.name || ""));
  }

  function normalizeAgent(agent, fallbackOrder) {
    const parsedStage = Number.isFinite(Number(agent.stage))
      ? Number(agent.stage)
      : (Number.isFinite(Number(agent.order)) ? Number(agent.order) : fallbackOrder);
    const parsedLane = Number.isFinite(Number(agent.lane)) ? Number(agent.lane) : 0;
    const kind = AGENT_KINDS.some(item => item.id === agent.kind) ? agent.kind : "agent";

    return {
      ...agent,
      kind,
      stage: Math.max(0, parsedStage),
      lane: Math.max(0, parsedLane),
      order: Number.isFinite(Number(agent.order)) ? Number(agent.order) : fallbackOrder,
      boundary: agent.boundary || "",
      output: agent.output || "",
      tools: Array.isArray(agent.tools) ? [...agent.tools] : [],
    };
  }

  function normalizeWorkflow(workflow) {
    const agents = (workflow.agents || []).map((agent, index) => normalizeAgent(agent, index));
    agents.sort(compareAgents);
    const stageOrder = [...new Set(agents.map(agent => agent.stage))];
    const stageIndexMap = new Map(stageOrder.map((stage, index) => [stage, index]));

    for (const agent of agents) {
      agent.stage = stageIndexMap.get(agent.stage) ?? 0;
    }

    const stageMap = new Map();
    for (const agent of agents) {
      if (!stageMap.has(agent.stage)) {
        stageMap.set(agent.stage, []);
      }
      stageMap.get(agent.stage).push(agent);
    }

    for (const stageAgents of stageMap.values()) {
      stageAgents.sort(compareAgents);
      stageAgents.forEach((agent, laneIndex) => {
        agent.lane = laneIndex;
      });
    }

    agents.sort(compareAgents);
    agents.forEach((agent, index) => {
      agent.order = index;
    });

    return {
      ...workflow,
      agents,
    };
  }

  function getSortedAgents() {
    return [...currentWorkflow.agents].sort(compareAgents);
  }

  function getWorkflowStages(agents = getSortedAgents()) {
    const stageMap = new Map();

    for (const agent of agents) {
      const stage = agent.stage ?? 0;
      if (!stageMap.has(stage)) {
        stageMap.set(stage, []);
      }
      stageMap.get(stage).push(agent);
    }

    return [...stageMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([stage, stageAgents]) => ({
        stage,
        agents: [...stageAgents].sort(compareAgents),
        isParallel: stageAgents.length > 1,
      }));
  }

  function validateWorkflow(workflow = currentWorkflow) {
    const normalizedWorkflow = normalizeWorkflow(JSON.parse(JSON.stringify(workflow || currentWorkflow || {})));
    const stages = getWorkflowStages(normalizedWorkflow.agents || []);
    const findings = [];
    const toolRegistry = window.mcpTools || {};
    const knownTools = new Set(Object.values(toolRegistry).flat());

    function addFinding(severity, message) {
      findings.push({ severity, message });
    }

    if (!String(normalizedWorkflow.name || "").trim()) {
      addFinding("warning", "Give the workflow a clear name before saving.");
    }

    if (!Array.isArray(normalizedWorkflow.agents) || normalizedWorkflow.agents.length === 0) {
      addFinding("error", "Add at least one agent before saving or testing the workflow.");
    }

    normalizedWorkflow.agents.forEach((agent, index) => {
      const label = agent.name || `Agent ${index + 1}`;
      if (!String(agent.name || "").trim()) {
        addFinding("error", `Agent ${index + 1} is missing a name.`);
      }
      if (!String(agent.role || "").trim()) {
        addFinding("error", `${label} is missing a role.`);
      }
      if (!String(agent.model || "").trim()) {
        addFinding("error", `${label} is missing a model selection.`);
      }
      if (!String(agent.boundary || "").trim()) {
        addFinding("warning", `${label} should define a boundary for safer execution.`);
      }
      if (!String(agent.output || "").trim()) {
        addFinding("warning", `${label} should define an expected output.`);
      }
      if (!Array.isArray(agent.tools) || agent.tools.length === 0) {
        addFinding("warning", `${label} has no tools assigned.`);
      }
      if (Array.isArray(agent.tools)) {
        agent.tools.forEach((tool) => {
          if (knownTools.size > 0 && !knownTools.has(tool)) {
            addFinding("error", `${label} references unknown tool "${tool}".`);
          }
        });
      }
    });

    if (normalizedWorkflow.type === "sequential" || normalizedWorkflow.type === "conditional") {
      stages.forEach((stageInfo) => {
        if (stageInfo.agents.length > 1) {
          addFinding("error", `${WORKFLOW_TYPES.find(t => t.id === normalizedWorkflow.type)?.label || "This workflow"} cannot have parallel agents in Stage ${stageInfo.stage + 1}.`);
        }
      });

      normalizedWorkflow.agents.forEach((agent) => {
        if (agent.kind === "orchestrator" || agent.kind === "merge") {
          addFinding("error", `${agent.name} uses the ${agent.kind} role, which is not valid for ${normalizedWorkflow.type} workflows.`);
        }
      });
    }

    if (normalizedWorkflow.type === "sequential-hitl") {
      stages.forEach((stageInfo) => {
        if (stageInfo.agents.length > 1) {
          addFinding("error", `Sequential HITL workflows cannot have parallel agents in Stage ${stageInfo.stage + 1}.`);
        }
      });

      const humanAgents = normalizedWorkflow.agents.filter((agent) => agent.kind === "human");
      if (humanAgents.length === 0) {
        addFinding("error", "Sequential HITL workflows require at least one human checkpoint.");
      }

      const finalStage = stages[stages.length - 1];
      if (finalStage && finalStage.agents[0] && finalStage.agents[0].kind !== "human") {
        addFinding("warning", "The final stage is not a human checkpoint. Review workflows usually end with human approval.");
      }
    }

    if (normalizedWorkflow.type === "parallel") {
      const firstStage = stages[0];
      const secondStage = stages[1];

      if (!firstStage || firstStage.agents.length !== 1 || firstStage.agents[0].kind !== "orchestrator") {
        addFinding("error", "Parallel workflows must start with a single orchestrator stage.");
      }

      if (!secondStage) {
        addFinding("error", "Parallel workflows need a second stage for parallel branches.");
      } else if (secondStage.agents.length < 2) {
        addFinding("warning", "Parallel workflows should have at least two agents in the parallel stage.");
      }
    }

    if (normalizedWorkflow.type === "fan-out") {
      const firstStage = stages[0];
      const middleStage = stages[1];
      const lastStage = stages[stages.length - 1];

      if (!firstStage || firstStage.agents.length !== 1 || firstStage.agents[0].kind !== "orchestrator") {
        addFinding("error", "Fan-out workflows must start with a single orchestrator stage.");
      }

      if (!middleStage || middleStage.agents.length < 2) {
        addFinding("error", "Fan-out workflows require at least two parallel branch agents.");
      }

      if (!lastStage || lastStage.agents.length !== 1 || lastStage.agents[0].kind !== "merge") {
        addFinding("error", "Fan-out workflows must end with a single merge node.");
      }
    }

    const errors = findings.filter((item) => item.severity === "error").length;
    const warnings = findings.filter((item) => item.severity === "warning").length;
    const infos = findings.filter((item) => item.severity === "info").length;

    return {
      workflow: normalizedWorkflow,
      findings,
      errors,
      warnings,
      infos,
      isValid: errors === 0,
    };
  }

  function getValidationStatus(validation) {
    if (validation.errors > 0) {
      return { label: "Blocked", badgeClass: "badge-fail" };
    }

    if (validation.warnings > 0) {
      return { label: "Needs Review", badgeClass: "badge-warn" };
    }

    return { label: "Ready", badgeClass: "badge-pass" };
  }

  function showValidationAlert(actionLabel, validation) {
    const errorLines = validation.findings
      .filter((item) => item.severity === "error")
      .map((item) => `- ${item.message}`)
      .join("\n");

    alert(`Cannot ${actionLabel} this workflow yet. Fix the following issues first:\n\n${errorLines}`);
  }

  function applyWorkflowTypePreset(type) {
    const agents = getSortedAgents();
    if (agents.length === 0) {
      currentWorkflow.type = type;
      return;
    }

    if (type === "sequential" || type === "sequential-hitl" || type === "conditional") {
      agents.forEach((agent, index) => {
        agent.stage = index;
        agent.lane = 0;
        if (agent.kind === "merge" || agent.kind === "orchestrator") {
          agent.kind = "agent";
        }
      });

      if (type === "sequential-hitl") {
        const reviewAgent = agents[agents.length - 1];
        if (reviewAgent) {
          reviewAgent.kind = "human";
        }
      }
    }

    if (type === "parallel") {
      agents[0].kind = "orchestrator";
      agents[0].stage = 0;
      agents[0].lane = 0;

      for (let index = 1; index < agents.length; index += 1) {
        agents[index].stage = 1;
        agents[index].lane = index - 1;
        if (agents[index].kind === "merge") {
          agents[index].kind = "agent";
        }
      }
    }

    if (type === "fan-out") {
      agents[0].kind = "orchestrator";
      agents[0].stage = 0;
      agents[0].lane = 0;

      if (agents.length === 2) {
        agents[1].kind = "merge";
        agents[1].stage = 1;
        agents[1].lane = 0;
      } else if (agents.length > 2) {
        const mergeIndex = agents.length - 1;
        for (let index = 1; index < mergeIndex; index += 1) {
          agents[index].stage = 1;
          agents[index].lane = index - 1;
          if (agents[index].kind === "merge") {
            agents[index].kind = "agent";
          }
        }
        agents[mergeIndex].kind = "merge";
        agents[mergeIndex].stage = 2;
        agents[mergeIndex].lane = 0;
      }
    }

    currentWorkflow = normalizeWorkflow({ ...currentWorkflow, type, agents });
  }

  // --- Initialization ---
  function init() {
    loadSavedWorkflows();
    loadDefaultWorkflow();
    render();
    bindGlobalEvents();
  }

  function loadDefaultWorkflow() {
    // Set the default workflow with the active 6-stage pre-execution lifecycle
    currentWorkflow = {
      id: "default",
      name: "Contract Lifecycle Pipeline",
      type: "sequential-hitl",
      agents: [
        {
          id: "agent-1",
          name: "Intake Agent",
          role: "Classify contracts by type and extract initial metadata",
          icon: "I",
          model: "GPT-5.4",
          tools: ["upload_contract", "classify_document", "extract_metadata"],
          boundary: "Classify only",
          output: "Contract classification and metadata",
          color: AGENT_COLORS[0],
          kind: "agent",
          stage: 0,
          lane: 0,
          order: 0,
        },
        {
          id: "agent-2",
          name: "Drafting Agent",
          role: "Assemble the initial draft package and recommend approved clause language",
          icon: "D",
          model: "GPT-5.4",
          tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
          boundary: "Draft package only",
          output: "Draft-ready clause package and fallback language recommendations",
          color: AGENT_COLORS[1],
          kind: "agent",
          stage: 1,
          lane: 0,
          order: 1,
        },
        {
          id: "agent-3",
          name: "Internal Review Agent",
          role: "Summarize redlines, review comments, and internal decision points",
          icon: "R",
          model: "GPT-5.4",
          tools: ["get_audit_log", "create_audit_entry"],
          boundary: "Internal review only",
          output: "Redline summary and internal review disposition",
          color: AGENT_COLORS[2],
          kind: "agent",
          stage: 2,
          lane: 0,
          order: 2,
        },
        {
          id: "agent-4",
          name: "Compliance Agent",
          role: "Check extracted terms against company policies and flag risks",
          icon: "C",
          model: "GPT-5.4",
          tools: ["check_policy", "flag_risk", "get_policy_rules"],
          boundary: "Flag only",
          output: "Policy compliance flags and risk assessment",
          color: AGENT_COLORS[3],
          kind: "agent",
          stage: 3,
          lane: 0,
          order: 3,
        },
        {
          id: "agent-5",
          name: "Negotiation Agent",
          role: "Assess counterparty markup and recommend fallback negotiation positions",
          icon: "N",
          model: "GPT-5.4",
          tools: ["route_approval", "notify_stakeholder"],
          boundary: "Negotiation support only",
          output: "Negotiation summary with fallback recommendations",
          color: AGENT_COLORS[4],
          kind: "agent",
          stage: 4,
          lane: 0,
          order: 4,
        },
        {
          id: "agent-6",
          name: "Approval Agent",
          role: "Route contracts for approval or escalate to human review",
          icon: "A",
          model: "GPT-5.4",
          tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
          boundary: "Route only",
          output: "Routing decision and stakeholder notification",
          color: AGENT_COLORS[5],
          kind: "human",
          stage: 5,
          lane: 0,
          order: 5,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    currentWorkflow = normalizeWorkflow(currentWorkflow);
    nextAgentId = 7;
  }

  // --- Render ---
  function render() {
    renderToolbar();
    renderCanvas();
    renderInventory();
  }

  function renderToolbar() {
    const toolbar = document.getElementById("designer-toolbar");
    if (!toolbar) return;

    const wfType = WORKFLOW_TYPES.find(t => t.id === currentWorkflow.type) || WORKFLOW_TYPES[0];

    toolbar.innerHTML = `
      <div class="designer-toolbar-left">
        <input type="text" class="designer-wf-name" id="wf-name-input"
               value="${escapeHtml(currentWorkflow.name)}"
               onchange="WorkflowDesigner.updateName(this.value)"
               title="Workflow name" />
        <div class="designer-wf-type-wrapper">
          <label class="designer-label">Type:</label>
          <select class="select designer-type-select" id="wf-type-select"
                  onchange="WorkflowDesigner.updateType(this.value)">
            ${WORKFLOW_TYPES.map(t =>
              `<option value="${t.id}" ${t.id === currentWorkflow.type ? "selected" : ""}>${t.label}</option>`
            ).join("")}
          </select>
          <span class="designer-type-desc">${escapeHtml(wfType.description)}</span>
        </div>
      </div>
      <div class="designer-toolbar-right">
        <button class="btn btn-outline" onclick="WorkflowDesigner.addAgent()" title="Add a new agent">
          + Add Agent
        </button>
        <button class="btn btn-outline" onclick="WorkflowDesigner.exportJson()" title="Export workflow as JSON">
          Export
        </button>
        <button class="btn btn-outline" onclick="WorkflowDesigner.loadWorkflowDialog()" title="Load saved workflow">
          Load
        </button>
        <button class="btn btn-outline" onclick="WorkflowDesigner.saveWorkflow()" title="Save workflow">
          Save
        </button>
        <button class="btn btn-primary" onclick="WorkflowDesigner.pushToPipeline()" title="Save and activate this workflow for Test/Deploy/Live">
          Push to Pipeline &rarr;
        </button>
        <button class="btn btn-outline" onclick="WorkflowDesigner.resetToDefault()" title="Reset to default">
          Reset
        </button>
      </div>
    `;
  }

  function renderCanvas() {
    const canvas = document.getElementById("designer-canvas");
    if (!canvas) return;

    currentWorkflow = normalizeWorkflow(currentWorkflow);
    const stages = getWorkflowStages();

    let html = "";

    if (stages.length === 0) {
      html = `<div class="designer-empty">
        <div class="designer-empty-icon">+</div>
        <div class="designer-empty-text">No agents yet. Click "Add Agent" to start designing your workflow.</div>
      </div>`;
    } else {
      html = renderStageLayout(stages);
    }

    canvas.innerHTML = html;
    bindDragEvents();
  }

  function renderStageLayout(stages) {
    const isVertical = ["sequential", "sequential-hitl", "conditional"].includes(currentWorkflow.type);
    const arrowHtml = isVertical
      ? '<div class="pipeline-arrow designer-arrow designer-stage-arrow" style="margin-top:0;font-size:24px">&darr;</div>'
      : '<div class="pipeline-arrow designer-arrow designer-stage-arrow">&rarr;</div>';
    return `<div class="designer-stage-flow designer-stage-flow-${escapeHtml(currentWorkflow.type)}">
      ${stages.map((stageInfo, index) => `
        <div class="designer-stage-shell">
          ${renderStage(stageInfo)}
        </div>
        ${index < stages.length - 1 ? arrowHtml : ""}
      `).join("")}
    </div>`;
  }

  function renderStage(stageInfo) {
    const stageClass = stageInfo.isParallel ? "designer-stage designer-stage-parallel" : "designer-stage designer-stage-sequential";
    const stageLabel = stageInfo.isParallel
      ? `Stage ${stageInfo.stage + 1} • Parallel`
      : `Stage ${stageInfo.stage + 1}`;
    const layoutClass = stageInfo.isParallel ? "designer-parallel-grid" : "designer-sequential";

    return `<div class="${stageClass}">
      <div class="designer-stage-label">${escapeHtml(stageLabel)}</div>
      <div class="${layoutClass}">
        ${stageInfo.agents.map((agent, idx) => `
          ${renderAgentCard(agent)}
          ${!stageInfo.isParallel && idx < stageInfo.agents.length - 1 ? '<div class="pipeline-arrow designer-arrow">&rarr;</div>' : ""}
        `).join("")}
      </div>
    </div>`;
  }

  function renderAgentCard(agent) {
    const kindLabel = AGENT_KINDS.find(kind => kind.id === agent.kind)?.label || "Agent";
    return `
      <div class="agent-card designer-agent-card" data-agent-id="${agent.id}"
           draggable="true" style="border-color: ${agent.color}">
        <div class="designer-card-actions">
          <button class="designer-card-btn" onclick="WorkflowDesigner.editAgent('${agent.id}')" title="Edit agent">&#9998;</button>
          <button class="designer-card-btn designer-card-btn-danger" onclick="WorkflowDesigner.removeAgent('${agent.id}')" title="Remove agent">&times;</button>
          <span class="designer-drag-handle" title="Drag to reorder">&#9776;</span>
        </div>
        <div class="agent-card-icon" style="background: ${agent.color}">${escapeHtml(agent.icon)}</div>
        <div class="agent-card-name">${escapeHtml(agent.name)}</div>
        <div class="designer-agent-meta-row">
          <span class="designer-agent-badge designer-agent-badge-kind">${escapeHtml(kindLabel)}</span>
          <span class="designer-agent-badge">S${Number(agent.stage) + 1}</span>
          <span class="designer-agent-badge">L${Number(agent.lane) + 1}</span>
        </div>
        <div class="agent-card-model">Model: ${escapeHtml(agent.model)}</div>
        <div class="agent-card-section">
          <div class="agent-card-section-title">Role</div>
          <div class="agent-card-tool" style="font-family: var(--font-primary)">${escapeHtml(agent.role)}</div>
        </div>
        <div class="agent-card-section">
          <div class="agent-card-section-title">Tools</div>
          ${agent.tools.map(t => `<div class="agent-card-tool">- ${escapeHtml(t)}</div>`).join("")}
        </div>
        <div class="agent-card-section">
          <div class="agent-card-section-title">Boundary</div>
          <div class="agent-card-boundary">${escapeHtml(agent.boundary)}</div>
        </div>
        ${agent.output ? `<div class="agent-card-section">
          <div class="agent-card-section-title">Output</div>
          <div class="agent-card-tool" style="font-family: var(--font-primary); font-size: 11px; color: var(--color-text-tertiary)">${escapeHtml(agent.output)}</div>
        </div>` : ""}
      </div>
    `;
  }

  function renderInventory() {
    const inv = document.getElementById("designer-inventory");
    if (!inv) return;

    const allTools = currentWorkflow.agents.reduce((acc, a) => acc + a.tools.length, 0);
    const models = [...new Set(currentWorkflow.agents.map(a => a.model))].join(", ") || "--";
    const wfType = WORKFLOW_TYPES.find(t => t.id === currentWorkflow.type);
    const validation = validateWorkflow(currentWorkflow);
    const validationStatus = getValidationStatus(validation);
    const topFindings = validation.findings.slice(0, 4);

    inv.innerHTML = `
      <div class="agent-inventory-item"><strong>Total Agents:</strong> ${currentWorkflow.agents.length}</div>
      <div class="agent-inventory-item"><strong>Stages:</strong> ${getWorkflowStages().length}</div>
      <div class="agent-inventory-item"><strong>MCP Tools:</strong> ${allTools}</div>
      <div class="agent-inventory-item"><strong>Model:</strong> ${models}</div>
      <div class="agent-inventory-item"><strong>Pipeline:</strong> ${wfType ? wfType.label : currentWorkflow.type}</div>
      ${currentWorkflow.id ? `<div class="agent-inventory-item"><strong>Workflow ID:</strong> <span style="font-family:var(--font-mono);font-size:12px">${escapeHtml(String(currentWorkflow.id).substring(0,12))}</span></div>` : ""}
      <div class="designer-validation-summary">
        <div class="designer-validation-header">
          <div class="agent-inventory-item"><strong>Design Validation:</strong> <span class="badge ${validationStatus.badgeClass}">${validationStatus.label}</span></div>
          <div class="designer-validation-meta">${validation.errors} errors • ${validation.warnings} warnings</div>
        </div>
        <div class="designer-validation-list">
          ${topFindings.length > 0 ? topFindings.map((item) => `
            <div class="designer-validation-item is-${item.severity}">
              <span class="badge badge-${item.severity === "error" ? "fail" : item.severity === "warning" ? "warn" : "pass"}">[${item.severity === "error" ? "FAIL" : item.severity === "warning" ? "WARN" : "PASS"}]</span>
              <span>${escapeHtml(item.message)}</span>
            </div>
          `).join("") : `
            <div class="designer-validation-item is-pass">
              <span class="badge badge-pass">[PASS]</span>
              <span>Workflow is ready to save, test, and deploy.</span>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- Drag & Drop ---
  function bindDragEvents() {
    const cards = document.querySelectorAll(".designer-agent-card");
    cards.forEach(card => {
      card.addEventListener("dragstart", onDragStart);
      card.addEventListener("dragend", onDragEnd);
      card.addEventListener("dragover", onDragOver);
      card.addEventListener("drop", onDrop);
    });
  }

  function onDragStart(e) {
    const agentId = e.currentTarget.dataset.agentId;
    e.dataTransfer.setData("text/plain", agentId);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("dragging");
    dragState.dragging = true;
    dragState.agentId = agentId;
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove("dragging");
    dragState.dragging = false;
    dragState.agentId = null;
    // Remove all drop targets
    document.querySelectorAll(".designer-agent-card").forEach(c => c.classList.remove("drag-over"));
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = e.currentTarget;
    if (target.dataset.agentId !== dragState.agentId) {
      target.classList.add("drag-over");
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    const targetId = e.currentTarget.dataset.agentId;
    e.currentTarget.classList.remove("drag-over");

    if (sourceId === targetId) return;

    // Swap order
    const sourceAgent = currentWorkflow.agents.find(a => a.id === sourceId);
    const targetAgent = currentWorkflow.agents.find(a => a.id === targetId);
    if (sourceAgent && targetAgent) {
      const tempOrder = sourceAgent.order;
      const tempStage = sourceAgent.stage;
      const tempLane = sourceAgent.lane;
      sourceAgent.order = targetAgent.order;
      sourceAgent.stage = targetAgent.stage;
      sourceAgent.lane = targetAgent.lane;
      targetAgent.order = tempOrder;
      targetAgent.stage = tempStage;
      targetAgent.lane = tempLane;
      currentWorkflow = normalizeWorkflow(currentWorkflow);
      render();
      showToast("Agent order updated");
    }
  }

  function bindGlobalEvents() {
    // Close modal on escape
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeModal();
    });
  }

  // --- Agent CRUD ---
  function addAgent() {
    const newAgent = {
      id: `agent-${nextAgentId++}`,
      name: "",
      role: "",
      icon: "",
      model: "GPT-5.4",
      tools: [],
      boundary: "",
      output: "",
      kind: "agent",
      color: AGENT_COLORS[(currentWorkflow.agents.length) % AGENT_COLORS.length],
      stage: currentWorkflow.agents.length,
      lane: 0,
      order: currentWorkflow.agents.length,
    };
    openAgentModal(newAgent, true);
  }

  function editAgent(agentId) {
    const agent = currentWorkflow.agents.find(a => a.id === agentId);
    if (!agent) return;
    openAgentModal({ ...agent }, false);
  }

  function removeAgent(agentId) {
    const agent = currentWorkflow.agents.find(a => a.id === agentId);
    if (!agent) return;
    if (!confirm(`Remove "${agent.name}" from the workflow?`)) return;

    currentWorkflow.agents = currentWorkflow.agents.filter(a => a.id !== agentId);
    currentWorkflow = normalizeWorkflow(currentWorkflow);
    render();
    showToast(`"${agent.name}" removed`);
  }

  // --- Agent Modal ---
  function openAgentModal(agent, isNew) {
    const modal = document.getElementById("designer-modal");
    if (!modal) return;

    // Group all tools flat for selection
    const allTools = [];
    for (const [server, tools] of Object.entries(AVAILABLE_TOOLS)) {
      for (const tool of tools) {
        allTools.push({ server, tool });
      }
    }

    modal.innerHTML = `
      <div class="designer-modal-backdrop" onclick="WorkflowDesigner.closeModal()"></div>
      <div class="designer-modal-content">
        <div class="designer-modal-header">
          <h2>${isNew ? "Add New Agent" : "Edit Agent"}</h2>
          <button class="designer-card-btn" onclick="WorkflowDesigner.closeModal()">&times;</button>
        </div>
        <div class="designer-modal-body">
          <div class="designer-form-row">
            <div class="designer-form-group" style="flex:2">
              <label class="designer-label">Agent Name *</label>
              <input type="text" class="input designer-input" id="modal-agent-name"
                     value="${escapeHtml(agent.name)}" placeholder="e.g. Intake Agent" />
            </div>
            <div class="designer-form-group" style="flex:0 0 80px">
              <label class="designer-label">Icon *</label>
              <input type="text" class="input designer-input" id="modal-agent-icon"
                     value="${escapeHtml(agent.icon)}" placeholder="I" maxlength="2"
                     style="text-align:center;font-weight:700;font-size:18px" />
            </div>
            <div class="designer-form-group" style="flex:1">
              <label class="designer-label">Model</label>
              <select class="select designer-input" id="modal-agent-model">
                ${MODEL_OPTIONS.map(m =>
                  `<option value="${m}" ${m === agent.model ? "selected" : ""}>${m}</option>`
                ).join("")}
              </select>
            </div>
          </div>

          <div class="designer-form-group">
            <label class="designer-label">Role / Responsibility *</label>
            <textarea class="textarea designer-input" id="modal-agent-role" rows="2"
                      placeholder="Describe what this agent does...">${escapeHtml(agent.role)}</textarea>
          </div>

          <div class="designer-form-group">
            <label class="designer-label">Tools (select from available MCP tools)</label>
            <div class="designer-tool-grid" id="modal-tool-grid">
              ${Object.entries(AVAILABLE_TOOLS).map(([server, tools]) => `
                <div class="designer-tool-server">
                  <div class="designer-tool-server-name">${escapeHtml(server)}</div>
                  ${tools.map(tool => `
                    <label class="designer-tool-checkbox">
                      <input type="checkbox" value="${escapeHtml(tool)}" data-server="${escapeHtml(server)}"
                             ${agent.tools.includes(tool) ? "checked" : ""} />
                      <span class="designer-tool-label">${escapeHtml(tool)}</span>
                    </label>
                  `).join("")}
                </div>
              `).join("")}
            </div>
          </div>

          <div class="designer-form-row">
            <div class="designer-form-group" style="flex:1">
              <label class="designer-label">Boundary Constraint</label>
              <input type="text" class="input designer-input" id="modal-agent-boundary"
                     value="${escapeHtml(agent.boundary)}" placeholder="e.g. Classify only" />
            </div>
            <div class="designer-form-group" style="flex:1">
              <label class="designer-label">Output Description</label>
              <input type="text" class="input designer-input" id="modal-agent-output"
                     value="${escapeHtml(agent.output || "")}" placeholder="e.g. Classification and metadata" />
            </div>
          </div>

          <div class="designer-form-row">
            <div class="designer-form-group" style="flex:1">
              <label class="designer-label">Execution Role</label>
              <select class="select designer-input" id="modal-agent-kind">
                ${AGENT_KINDS.map(kind => `
                  <option value="${kind.id}" ${kind.id === (agent.kind || "agent") ? "selected" : ""}>${kind.label}</option>
                `).join("")}
              </select>
            </div>
            <div class="designer-form-group" style="flex:1">
              <label class="designer-label">Stage</label>
              <input type="number" class="input designer-input" id="modal-agent-stage"
                     value="${Number.isFinite(Number(agent.stage)) ? Number(agent.stage) : 0}" min="0" step="1" />
            </div>
            <div class="designer-form-group" style="flex:1">
              <label class="designer-label">Lane</label>
              <input type="number" class="input designer-input" id="modal-agent-lane"
                     value="${Number.isFinite(Number(agent.lane)) ? Number(agent.lane) : 0}" min="0" step="1" />
            </div>
          </div>

          <div class="designer-form-group">
            <label class="designer-label">Agent Color</label>
            <div class="designer-color-picker">
              ${AGENT_COLORS.map(c => `
                <div class="designer-color-swatch ${c === agent.color ? "selected" : ""}"
                     style="background:${c}" data-color="${c}"
                     onclick="WorkflowDesigner.selectColor(this, '${c}')"></div>
              `).join("")}
            </div>
            <input type="hidden" id="modal-agent-color" value="${agent.color}" />
          </div>
        </div>

        <div class="designer-modal-footer">
          <button class="btn btn-outline" onclick="WorkflowDesigner.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="WorkflowDesigner.saveAgent('${agent.id}', ${isNew})">
            ${isNew ? "Add Agent" : "Save Changes"}
          </button>
        </div>
      </div>
    `;

    modal.classList.add("visible");
  }

  function selectColor(el, color) {
    document.querySelectorAll(".designer-color-swatch").forEach(s => s.classList.remove("selected"));
    el.classList.add("selected");
    document.getElementById("modal-agent-color").value = color;
  }

  function saveAgent(agentId, isNew) {
    const name = document.getElementById("modal-agent-name").value.trim();
    const icon = document.getElementById("modal-agent-icon").value.trim();
    const role = document.getElementById("modal-agent-role").value.trim();
    const model = document.getElementById("modal-agent-model").value;
    const boundary = document.getElementById("modal-agent-boundary").value.trim();
    const output = document.getElementById("modal-agent-output").value.trim();
    const kind = document.getElementById("modal-agent-kind").value;
    const stage = Math.max(0, Number(document.getElementById("modal-agent-stage").value || 0));
    const lane = Math.max(0, Number(document.getElementById("modal-agent-lane").value || 0));
    const color = document.getElementById("modal-agent-color").value;

    // Gather selected tools
    const toolCheckboxes = document.querySelectorAll("#modal-tool-grid input[type=checkbox]:checked");
    const tools = Array.from(toolCheckboxes).map(cb => cb.value);

    // Validation
    if (!name) { alert("Agent name is required."); return; }
    if (!icon) { alert("Agent icon is required (1-2 characters)."); return; }
    if (!role) { alert("Agent role/responsibility is required."); return; }

    const agentData = { id: agentId, name, icon, role, model, tools, boundary, output, color, kind, stage, lane };

    if (isNew) {
      agentData.order = currentWorkflow.agents.length;
      currentWorkflow.agents.push(agentData);
      showToast(`"${name}" added to workflow`);
    } else {
      const idx = currentWorkflow.agents.findIndex(a => a.id === agentId);
      if (idx !== -1) {
        agentData.order = currentWorkflow.agents[idx].order;
        currentWorkflow.agents[idx] = agentData;
      }
      showToast(`"${name}" updated`);
    }

    currentWorkflow = normalizeWorkflow(currentWorkflow);
    closeModal();
    render();
  }

  // --- Workflow Persistence (localStorage) ---
  function saveWorkflow() {
    currentWorkflow = normalizeWorkflow(currentWorkflow);
    const validation = validateWorkflow(currentWorkflow);

    if (!validation.isValid) {
      render();
      showValidationAlert("save", validation);
      showToast("Fix design errors before saving");
      return false;
    }

    currentWorkflow.updatedAt = new Date().toISOString();
    if (!currentWorkflow.id || currentWorkflow.id === "default") {
      currentWorkflow.id = "wf-" + Date.now().toString(36);
      currentWorkflow.createdAt = new Date().toISOString();
    }

    const idx = savedWorkflows.findIndex(w => w.id === currentWorkflow.id);
    const copy = JSON.parse(JSON.stringify(currentWorkflow));
    if (idx !== -1) {
      savedWorkflows[idx] = copy;
    } else {
      savedWorkflows.push(copy);
    }

    persistWorkflows();
    render();
    showToast(validation.warnings > 0
      ? `Workflow "${currentWorkflow.name}" saved with ${validation.warnings} warning${validation.warnings === 1 ? "" : "s"}`
      : `Workflow "${currentWorkflow.name}" saved`);
    return true;
  }

  function loadWorkflowDialog() {
    if (savedWorkflows.length === 0) {
      showToast("No saved workflows found");
      return;
    }

    const modal = document.getElementById("designer-modal");
    if (!modal) return;

    modal.innerHTML = `
      <div class="designer-modal-backdrop" onclick="WorkflowDesigner.closeModal()"></div>
      <div class="designer-modal-content" style="max-width:560px">
        <div class="designer-modal-header">
          <h2>Load Workflow</h2>
          <button class="designer-card-btn" onclick="WorkflowDesigner.closeModal()">&times;</button>
        </div>
        <div class="designer-modal-body">
          <div class="designer-load-list">
            ${savedWorkflows.map(w => `
              <div class="designer-load-item" onclick="WorkflowDesigner.loadWorkflow('${escapeHtml(w.id)}')">
                <div class="designer-load-item-name">${escapeHtml(w.name)}</div>
                <div class="designer-load-item-meta">
                  ${w.agents.length} agents &middot; ${WORKFLOW_TYPES.find(t => t.id === w.type)?.label || w.type}
                  &middot; Updated ${new Date(w.updatedAt).toLocaleDateString()}
                </div>
                <button class="designer-card-btn designer-card-btn-danger" style="position:absolute;right:12px;top:12px"
                        onclick="event.stopPropagation(); WorkflowDesigner.deleteWorkflow('${escapeHtml(w.id)}')"
                        title="Delete workflow">&times;</button>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="designer-modal-footer">
          <button class="btn btn-outline" onclick="WorkflowDesigner.closeModal()">Cancel</button>
        </div>
      </div>
    `;

    modal.classList.add("visible");
  }

  function loadWorkflow(workflowId) {
    const wf = savedWorkflows.find(w => w.id === workflowId);
    if (!wf) return;
    currentWorkflow = normalizeWorkflow(JSON.parse(JSON.stringify(wf)));
    // Recalculate nextAgentId
    const maxId = currentWorkflow.agents.reduce((max, a) => {
      const num = parseInt(a.id.replace("agent-", ""), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    nextAgentId = maxId + 1;
    closeModal();
    render();
    showToast(`Loaded "${currentWorkflow.name}"`);
  }

  function deleteWorkflow(workflowId) {
    const wf = savedWorkflows.find(w => w.id === workflowId);
    if (!wf) return;
    if (!confirm(`Delete workflow "${wf.name}"?`)) return;
    savedWorkflows = savedWorkflows.filter(w => w.id !== workflowId);
    persistWorkflows();
    // Re-render the load dialog
    loadWorkflowDialog();
    showToast(`Deleted "${wf.name}"`);
  }

  function persistWorkflows() {
    try {
      localStorage.setItem("agentops-workflows", JSON.stringify(savedWorkflows));
    } catch (_e) { /* ignore quota errors */ }
  }

  function loadSavedWorkflows() {
    try {
      const data = localStorage.getItem("agentops-workflows");
      if (data) savedWorkflows = JSON.parse(data).map(workflow => normalizeWorkflow(workflow));
    } catch (_e) {
      savedWorkflows = [];
    }
  }

  // --- Export Workflow as JSON ---
  function exportJson() {
    const data = JSON.parse(JSON.stringify(currentWorkflow));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(currentWorkflow.name || "workflow").replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Workflow exported as JSON");
  }

  // --- Push to Pipeline (Save + Activate for Test/Deploy/Live) ---
  function pushToPipeline() {
    // First save locally
    if (!saveWorkflow()) {
      return;
    }

    const wfCopy = JSON.parse(JSON.stringify(currentWorkflow));

    // Save to backend gateway
    fetch(`${window.GATEWAY_URL || "http://localhost:8000"}/api/v1/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: wfCopy.id,
        name: wfCopy.name,
        type: wfCopy.type,
        agents: wfCopy.agents,
      }),
    })
      .then(res => res.json())
      .then(saved => {
        const wfId = saved.id || wfCopy.id;
        // Activate this workflow
        return fetch(`${window.GATEWAY_URL || "http://localhost:8000"}/api/v1/workflows/${encodeURIComponent(wfId)}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).then(r => r.json());
      })
      .then(() => {
        // Dispatch custom event so other tabs can react
        window.dispatchEvent(new CustomEvent("workflow-activated", { detail: wfCopy }));
        showToast(`"${currentWorkflow.name}" pushed to pipeline — Test/Deploy/Live updated`);
      })
      .catch(() => {
        // Even if backend fails, dispatch the event with local data
        window.dispatchEvent(new CustomEvent("workflow-activated", { detail: wfCopy }));
        showToast(`"${currentWorkflow.name}" pushed to pipeline (local mode)`);
      });
  }

  // --- Workflow Metadata ---
  function updateName(name) {
    currentWorkflow.name = name;
    renderInventory();
  }

  function updateType(type) {
    applyWorkflowTypePreset(type);
    render();
  }

  function resetToDefault() {
    if (!confirm("Reset to default Contract Processing Pipeline?")) return;
    loadDefaultWorkflow();
    render();
    showToast("Reset to default workflow");
  }

  // --- Modal Helpers ---
  function closeModal() {
    const modal = document.getElementById("designer-modal");
    if (modal) {
      modal.classList.remove("visible");
      modal.innerHTML = "";
    }
  }

  // --- Toast Notification ---
  function showToast(message) {
    let toast = document.getElementById("designer-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "designer-toast";
      toast.className = "designer-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 2500);
  }

  // --- Security: HTML Escaping ---
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return str.replace(/[&<>"']/g, c => map[c]);
  }

  // --- Get current workflow (for other modules) ---
  function getCurrentWorkflow() {
    return JSON.parse(JSON.stringify(currentWorkflow));
  }

  // --- Public API ---
  return {
    init,
    render,
    addAgent,
    editAgent,
    removeAgent,
    saveAgent,
    saveWorkflow,
    loadWorkflow,
    loadWorkflowDialog,
    deleteWorkflow,
    updateName,
    updateType,
    resetToDefault,
    closeModal,
    selectColor,
    getCurrentWorkflow,
    validateWorkflow,
    exportJson,
    pushToPipeline,
    showToast,
  };
})();

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  WorkflowDesigner.init();
});
