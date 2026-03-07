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

  const MODEL_OPTIONS = ["GPT-4o", "GPT-4o-mini", "GPT-4.1", "GPT-4.1-mini", "GPT-4.1-nano", "o3-mini", "o4-mini"];

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

  // --- Initialization ---
  function init() {
    loadSavedWorkflows();
    loadDefaultWorkflow();
    render();
    bindGlobalEvents();
  }

  function loadDefaultWorkflow() {
    // Set the default workflow with the 4 core agents
    currentWorkflow = {
      id: "default",
      name: "Contract Processing Pipeline",
      type: "sequential-hitl",
      agents: [
        {
          id: "agent-1",
          name: "Intake Agent",
          role: "Classify contracts by type and extract initial metadata",
          icon: "I",
          model: "GPT-4o",
          tools: ["upload_contract", "classify_document", "extract_metadata"],
          boundary: "Classify only",
          output: "Contract classification and metadata",
          color: AGENT_COLORS[0],
          order: 0,
        },
        {
          id: "agent-2",
          name: "Extraction Agent",
          role: "Extract key clauses, parties, dates, and monetary values",
          icon: "E",
          model: "GPT-4o",
          tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
          boundary: "Extract only",
          output: "Structured clause data with confidence scores",
          color: AGENT_COLORS[1],
          order: 1,
        },
        {
          id: "agent-3",
          name: "Compliance Agent",
          role: "Check extracted terms against company policies and flag risks",
          icon: "C",
          model: "GPT-4o",
          tools: ["check_policy", "flag_risk", "get_policy_rules"],
          boundary: "Flag only",
          output: "Policy compliance flags and risk assessment",
          color: AGENT_COLORS[2],
          order: 2,
        },
        {
          id: "agent-4",
          name: "Approval Agent",
          role: "Route contracts for approval or escalate to human review",
          icon: "A",
          model: "GPT-4o",
          tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
          boundary: "Route only",
          output: "Routing decision and stakeholder notification",
          color: AGENT_COLORS[3],
          order: 3,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    nextAgentId = 5;
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
        <button class="btn btn-primary" onclick="WorkflowDesigner.pushToPipeline()" title="Save and activate this workflow for Build/Deploy/Live">
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

    const sorted = [...currentWorkflow.agents].sort((a, b) => a.order - b.order);
    const isParallel = currentWorkflow.type === "parallel" || currentWorkflow.type === "fan-out";

    let html = "";

    if (sorted.length === 0) {
      html = `<div class="designer-empty">
        <div class="designer-empty-icon">+</div>
        <div class="designer-empty-text">No agents yet. Click "Add Agent" to start designing your workflow.</div>
      </div>`;
    } else if (isParallel) {
      html = renderParallelLayout(sorted);
    } else {
      html = renderSequentialLayout(sorted);
    }

    canvas.innerHTML = html;
    bindDragEvents();
  }

  function renderSequentialLayout(agents) {
    return `<div class="designer-sequential">
      ${agents.map((agent, idx) => `
        ${renderAgentCard(agent)}
        ${idx < agents.length - 1 ? '<div class="pipeline-arrow designer-arrow">&rarr;</div>' : ""}
      `).join("")}
    </div>`;
  }

  function renderParallelLayout(agents) {
    return `<div class="designer-parallel">
      <div class="designer-parallel-label">Parallel Execution</div>
      <div class="designer-parallel-grid">
        ${agents.map(agent => renderAgentCard(agent)).join("")}
      </div>
    </div>`;
  }

  function renderAgentCard(agent) {
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

    inv.innerHTML = `
      <div class="agent-inventory-item"><strong>Total Agents:</strong> ${currentWorkflow.agents.length}</div>
      <div class="agent-inventory-item"><strong>MCP Tools:</strong> ${allTools}</div>
      <div class="agent-inventory-item"><strong>Model:</strong> ${models}</div>
      <div class="agent-inventory-item"><strong>Pipeline:</strong> ${wfType ? wfType.label : currentWorkflow.type}</div>
      ${currentWorkflow.id ? `<div class="agent-inventory-item"><strong>Workflow ID:</strong> <span style="font-family:var(--font-mono);font-size:12px">${escapeHtml(String(currentWorkflow.id).substring(0,12))}</span></div>` : ""}
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
      sourceAgent.order = targetAgent.order;
      targetAgent.order = tempOrder;
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
      model: "GPT-4o",
      tools: [],
      boundary: "",
      output: "",
      color: AGENT_COLORS[(currentWorkflow.agents.length) % AGENT_COLORS.length],
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
    // Re-order remaining
    currentWorkflow.agents
      .sort((a, b) => a.order - b.order)
      .forEach((a, i) => { a.order = i; });
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
    const color = document.getElementById("modal-agent-color").value;

    // Gather selected tools
    const toolCheckboxes = document.querySelectorAll("#modal-tool-grid input[type=checkbox]:checked");
    const tools = Array.from(toolCheckboxes).map(cb => cb.value);

    // Validation
    if (!name) { alert("Agent name is required."); return; }
    if (!icon) { alert("Agent icon is required (1-2 characters)."); return; }
    if (!role) { alert("Agent role/responsibility is required."); return; }

    const agentData = { id: agentId, name, icon, role, model, tools, boundary, output, color };

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

    closeModal();
    render();
  }

  // --- Workflow Persistence (localStorage) ---
  function saveWorkflow() {
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
    showToast(`Workflow "${currentWorkflow.name}" saved`);
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
    currentWorkflow = JSON.parse(JSON.stringify(wf));
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
      if (data) savedWorkflows = JSON.parse(data);
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

  // --- Push to Pipeline (Save + Activate for Build/Deploy/Live) ---
  function pushToPipeline() {
    // First save locally
    saveWorkflow();

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
        }).then(r => r.json());
      })
      .then(() => {
        // Dispatch custom event so other tabs can react
        window.dispatchEvent(new CustomEvent("workflow-activated", { detail: wfCopy }));
        showToast(`"${currentWorkflow.name}" pushed to pipeline — Build/Deploy/Live updated`);
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
  }

  function updateType(type) {
    currentWorkflow.type = type;
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
    exportJson,
    pushToPipeline,
    showToast,
  };
})();

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  WorkflowDesigner.init();
});
