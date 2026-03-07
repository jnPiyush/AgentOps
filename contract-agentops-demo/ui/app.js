/* ============================================================
   Contract AgentOps Dashboard - Interactions & Mock Data
   Handles tab navigation, animations, and simulated workflows
   ============================================================ */

// --- Tab Navigation ---
document.addEventListener("DOMContentLoaded", () => {
	const tabs = document.querySelectorAll(".tab");
	const dots = document.querySelectorAll(".stage-dot");
	const visitedStages = new Set([0]);

	tabs.forEach((tab, index) => {
		tab.addEventListener("click", () => {
			switchView(index);
		});
		tab.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				switchView(index);
			}
			if (e.key === "ArrowRight" && index < tabs.length - 1) {
				tabs[index + 1].focus();
			}
			if (e.key === "ArrowLeft" && index > 0) {
				tabs[index - 1].focus();
			}
		});
	});

	dots.forEach((dot, index) => {
		dot.addEventListener("click", () => {
			switchView(index);
		});
	});

	function switchView(index) {
		const viewNames = ["design", "build", "deploy", "live", "monitor", "evaluate", "drift", "feedback"];
		// Update tabs
		tabs.forEach((t, i) => {
			t.classList.toggle("active", i === index);
			t.setAttribute("aria-selected", i === index ? "true" : "false");
			t.setAttribute("tabindex", i === index ? "0" : "-1");
		});
		// Update views
		const views = document.querySelectorAll(".view");
		views.forEach((v) => {
			v.classList.remove("active");
		});
		const target = document.getElementById(`view-${viewNames[index]}`);
		if (target) {
			target.classList.add("active");
		}
		// Update stage dots
		visitedStages.add(index);
		dots.forEach((d, i) => {
			d.classList.toggle("active", i === index);
			d.classList.toggle("completed", visitedStages.has(i) && i !== index);
		});
		// Sync downstream tabs from active workflow when navigating
		if (viewNames[index] === "build") syncBuildTab();
		if (viewNames[index] === "deploy") syncDeployTab();
		if (viewNames[index] === "live") syncLiveTab();
	}
});

// --- View 1: Design Canvas ---
// Design Canvas is now managed by WorkflowDesigner (workflow-designer.js)
function toggleAgentDetail() { /* Legacy - handled by WorkflowDesigner */ }
function resetLayout() { if (typeof WorkflowDesigner !== "undefined") WorkflowDesigner.resetToDefault(); }

// --- Active Workflow Integration ---
// When the user clicks "Push to Pipeline", this event fires and propagates
// the designed workflow to Build, Deploy, and Live tabs.
let activeWorkflow = null;

window.addEventListener("workflow-activated", (e) => {
	activeWorkflow = e.detail;
	syncBuildTab();
	syncDeployTab();
	syncLiveTab();
	// Update pipeline status in footer
	const pipelineEl = document.getElementById("pipeline-status-item");
	if (pipelineEl && activeWorkflow) {
		pipelineEl.textContent = `Pipeline: ${activeWorkflow.name} (${activeWorkflow.agents.length} agents)`;
		pipelineEl.style.color = "var(--color-pass)";
	}
});

function getActiveWorkflow() {
	if (activeWorkflow) return activeWorkflow;
	if (typeof WorkflowDesigner !== "undefined") return WorkflowDesigner.getCurrentWorkflow();
	return null;
}

// --- Sync Build Console from Active Workflow ---
function syncBuildTab() {
	const wf = getActiveWorkflow();
	if (!wf || !wf.agents) return;

	// Build a map of servers used by the workflow agents
	const serverToolMap = {};
	for (const agent of wf.agents) {
		for (const tool of (agent.tools || [])) {
			// Find which server this tool belongs to
			for (const [server, stools] of Object.entries(mcpTools)) {
				if (stools.includes(tool)) {
					if (!serverToolMap[server]) serverToolMap[server] = [];
					if (!serverToolMap[server].includes(tool)) serverToolMap[server].push(tool);
				}
			}
		}
	}

	// Update the MCP server dropdown
	const serverSelect = document.getElementById("mcp-server-select");
	if (serverSelect) {
		const servers = Object.keys(serverToolMap);
		if (servers.length > 0) {
			serverSelect.innerHTML = servers.map(s => `<option value="${s}">${s}</option>`).join("");
			updateToolList();
		}
	}

	// Update the tool registry title area to show workflow context
	const registryTitle = document.querySelector(".tool-registry-title");
	if (registryTitle) {
		registryTitle.textContent = `Tool Registry (${wf.name} — ${wf.agents.length} agents)`;
	}
}

// --- Sync Deploy Tab from Active Workflow ---
function syncDeployTab() {
	const wf = getActiveWorkflow();
	if (!wf || !wf.agents) return;

	// Update the deploy summary to reflect the active workflow
	const summary = document.getElementById("deploy-summary");
	if (summary) {
		const totalTools = wf.agents.reduce((acc, a) => acc + (a.tools ? a.tools.length : 0), 0);
		summary.textContent = `${wf.agents.length} agents ready | ${totalTools} tools registered | 0 errors — ${wf.name}`;
	}
}

// --- Sync Live Tab from Active Workflow ---
function syncLiveTab() {
	const wf = getActiveWorkflow();
	if (!wf || !wf.agents) return;

	const canvas = document.getElementById("workflow-canvas");
	if (!canvas) return;

	const isParallel = wf.type === "parallel" || wf.type === "fan-out";
	const sorted = [...wf.agents].sort((a, b) => a.order - b.order);

	// Agent color mapping
	const agentColors = {
		"intake": "var(--color-intake)",
		"extraction": "var(--color-extraction)",
		"compliance": "var(--color-compliance)",
		"approval": "var(--color-approval)",
	};

	function getColor(agent) {
		// Try to match known agent names, otherwise use agent's own color
		const key = agent.name.toLowerCase().replace(/\s*agent\s*/gi, "").trim();
		return agentColors[key] || agent.color || "var(--color-accent)";
	}

	let html = "";
	if (isParallel) {
		html = `<div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;">`;
		sorted.forEach(agent => {
			html += renderLiveNode(agent, getColor(agent));
		});
		html += `</div>`;
	} else {
		sorted.forEach((agent, idx) => {
			html += renderLiveNode(agent, getColor(agent));
			if (idx < sorted.length - 1) {
				html += `<div class="workflow-arrow">&rarr;</div>`;
			}
		});
	}

	canvas.innerHTML = html;
}

function renderLiveNode(agent, color) {
	const nodeId = `wf-${agent.id}`;
	return `
		<div class="workflow-node" id="${nodeId}">
			<div class="workflow-node-name">${escapeHtmlApp(agent.name)}</div>
			<div class="workflow-node-status">Waiting</div>
			<div class="workflow-node-progress">
				<div class="progress-bar"><div class="progress-fill" style="width:0%;background:${color}"></div></div>
			</div>
			<div class="workflow-node-tools" id="${nodeId}-tools"></div>
		</div>
	`;
}

function escapeHtmlApp(str) {
	if (typeof str !== "string") return "";
	const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
	return str.replace(/[&<>"']/g, c => map[c]);
}

// --- View 2: Build Console ---
const toolOutputs = {
	extract_clauses: {
		output:
			'{\n  "clauses": [\n    {\n      "type": "confidentiality",\n      "text": "Recipient shall not disclose...",\n      "section": "3.1"\n    },\n    {\n      "type": "termination",\n      "text": "This agreement terminates after 2 yrs",\n      "section": "7.1"\n    }\n  ],\n  "confidence": 0.94\n}',
		latency: "1.2s",
		tokens: "342 in / 198 out",
	},
	identify_parties: {
		output:
			'{\n  "parties": [\n    {\n      "name": "Acme Corp",\n      "role": "Discloser",\n      "type": "Corporation"\n    },\n    {\n      "name": "Beta Inc",\n      "role": "Recipient",\n      "type": "Corporation"\n    }\n  ],\n  "confidence": 0.97\n}',
		latency: "0.8s",
		tokens: "210 in / 145 out",
	},
	extract_dates_values: {
		output:
			'{\n  "dates": [\n    {\n      "type": "effective_date",\n      "value": "2026-03-01",\n      "source": "Preamble"\n    },\n    {\n      "type": "term_end",\n      "value": "2028-03-01",\n      "source": "Section 7.1"\n    }\n  ],\n  "confidence": 0.92\n}',
		latency: "0.6s",
		tokens: "180 in / 120 out",
	},
};

const mcpTools = {
	"contract-extraction-mcp": ["extract_clauses", "identify_parties", "extract_dates_values"],
	"contract-intake-mcp": ["upload_contract", "classify_document", "extract_metadata"],
	"contract-compliance-mcp": ["check_policy", "flag_risk", "get_policy_rules"],
	"contract-workflow-mcp": ["route_approval", "escalate_to_human", "notify_stakeholder"],
};

function renderToolRegistry(server, tools) {
	const registryTitle = document.querySelector(".tool-registry-title");
	const registryList = document.querySelector(".tool-registry-list");

	if (registryTitle) {
		registryTitle.textContent = `Tool Registry (${server})`;
	}

	if (!registryList) {
		return;
	}

	registryList.innerHTML = "";
	tools.forEach((tool) => {
		const div = document.createElement("div");
		div.className = "tool-registry-item";
		div.innerHTML = `<span class="badge badge-pass">[PASS]</span> ${tool}`;
		registryList.appendChild(div);
	});
}

function updateToolList() {
	const server = document.getElementById("mcp-server-select").value;
	const toolSelect = document.getElementById("tool-select");
	const tools =
		dashboardMode === "real" && window.realMcpTools ? window.realMcpTools[server] || [] : mcpTools[server] || [];
	toolSelect.innerHTML = "";
	tools.forEach((t) => {
		const opt = document.createElement("option");
		opt.textContent = t;
		opt.value = t;
		toolSelect.appendChild(opt);
	});
	renderToolRegistry(server, tools);
}

function runTool() {
	if (dashboardMode === "real") {
		const server = document.getElementById("mcp-server-select").value;
		const tool = document.getElementById("tool-select").value;
		return runToolReal(server, tool);
	}

	const tool = document.getElementById("tool-select").value;
	const outputEl = document.getElementById("console-output");
	const statsEl = document.getElementById("console-stats");

	outputEl.textContent = `// Running ${tool}...`;
	outputEl.style.color = "var(--color-accent)";

	let data = toolOutputs[tool];
	if (!data) {
		data = {
			output: '{\n  "result": "Tool executed successfully",\n  "status": "ok"\n}',
			latency: "0.5s",
			tokens: "150 in / 80 out",
		};
	}

	setTimeout(() => {
		outputEl.textContent = data.output;
		outputEl.style.color = "var(--color-text-secondary)";
		statsEl.style.display = "flex";
		document.getElementById("stat-latency").textContent = data.latency;
		document.getElementById("stat-tokens").textContent = data.tokens;
		document.getElementById("stat-status").innerHTML = '<span class="badge badge-pass">[PASS] Success</span>';
	}, 800);
}

function clearConsole() {
	document.getElementById("console-output").textContent = '// Click "Run" to execute the tool...';
	document.getElementById("console-output").style.color = "var(--color-text-disabled)";
	document.getElementById("console-stats").style.display = "none";
}

// --- View 3: Deploy Pipeline ---
function runDeployPipeline() {
	if (dashboardMode === "real") return runDeployPipelineReal();

	const stages = [
		{ id: "stage-build", time: "12s" },
		{ id: "stage-test", time: "8s" },
		{ id: "stage-deploy", time: "15s" },
		{ id: "stage-register", time: "3s" },
	];

	const btn = document.getElementById("deploy-btn");
	btn.disabled = true;
	btn.textContent = "Deploying...";

	// Use active workflow agents if available, else fallback to defaults
	const wf = getActiveWorkflow();
	const agents = (wf && wf.agents && wf.agents.length > 0)
		? wf.agents.sort((a, b) => a.order - b.order).map((a, i) => ({
			name: a.name,
			id: `agt-${(wf.id || "7f3a").substring(0, 4)}-${a.name.toLowerCase().replace(/\s+/g, "-").substring(0, 8)}-${String(i + 1).padStart(3, "0")}`,
		}))
		: [
			{ name: "Intake Agent", id: "agt-7f3a-intake-001" },
			{ name: "Extraction Agent", id: "agt-7f3a-extract-002" },
			{ name: "Compliance Agent", id: "agt-7f3a-comply-003" },
			{ name: "Approval Agent", id: "agt-7f3a-approve-004" },
		];

	stages.forEach((stage, i) => {
		setTimeout(
			() => {
				const el = document.getElementById(stage.id);
				el.classList.add("completed");
				el.querySelector(".deploy-stage-status").innerHTML = '<span class="badge badge-pass">[PASS]</span>';
				el.querySelector(".deploy-stage-time").textContent = stage.time;

				if (i === stages.length - 1) {
					btn.textContent = "Deployed";
					const tbody = document.getElementById("agent-registry-body");
					tbody.innerHTML = "";
					agents.forEach((agent, j) => {
						setTimeout(() => {
							const row = document.createElement("tr");
							row.style.animation = "viewFadeIn 0.3s ease";
							row.innerHTML = `<td>${agent.name}</td><td style="font-family:var(--font-mono);font-size:12px">${agent.id}</td><td><span class="badge badge-pass">Registered</span></td><td>Contracts</td>`;
							tbody.appendChild(row);
						}, j * 200);
					});

					// Update summary with workflow-aware count
					const summary = document.getElementById("deploy-summary");
					if (summary) {
						const totalTools = wf ? wf.agents.reduce((acc, a) => acc + (a.tools ? a.tools.length : 0), 0) : 12;
						summary.textContent = `${agents.length} agents deployed | ${totalTools} tools registered | 0 errors`;
					}
				}
			},
			(i + 1) * 700,
		);
	});
}

// --- View 4: Live Workflow ---
let workflowRunning = false;

function startWorkflow() {
	if (workflowRunning) return;
	workflowRunning = true;

	if (dashboardMode === "real") return startWorkflowReal();

	// If active workflow has been pushed, sync the live tab first
	const wf = getActiveWorkflow();
	if (wf && wf.agents && wf.agents.length > 0) {
		syncLiveTab();
	}

	const dropArea = document.getElementById("drop-area");
	dropArea.textContent = "Processing NDA.pdf...";
	dropArea.style.borderColor = "var(--color-accent)";
	dropArea.style.color = "var(--color-accent)";

	const log = document.getElementById("activity-log");
	log.innerHTML = "";

	document.getElementById("contract-details").style.display = "flex";

	const timeline = [
		// Intake phase
		{
			time: 500,
			action: () => {
				setNodeState("wf-intake", "processing", "Classifying...");
				setNodeProgress("wf-intake", 30);
				addLog("10:04:01", "Intake Agent", "classify_document started");
			},
		},
		{
			time: 1200,
			action: () => {
				setNodeProgress("wf-intake", 60);
				addToolCall("wf-intake-tools", 'classify_document => "NDA" (0.97)');
				addLog("10:04:01", "Intake Agent", "classify_document => NDA (0.97)");
				document.getElementById("cd-type").textContent = "NDA";
			},
		},
		{
			time: 1800,
			action: () => {
				setNodeProgress("wf-intake", 100);
				addToolCall("wf-intake-tools", "extract_metadata => {parties: 2, pages: 4}");
				addLog("10:04:02", "Intake Agent", "extract_metadata => {parties: 2}");
				document.getElementById("cd-parties").textContent = "Acme Corp, Beta Inc";
				document.getElementById("cd-pages").textContent = "4";
			},
		},
		{
			time: 2300,
			action: () => {
				setNodeState("wf-intake", "complete", "Complete (1.2s)");
				addLog("10:04:03", "Intake Agent", "[PASS] Complete. Handing off to Extraction");
			},
		},
		// Extraction phase
		{
			time: 2800,
			action: () => {
				setNodeState("wf-extraction", "processing", "Extracting...");
				setNodeProgress("wf-extraction", 20);
				addLog("10:04:03", "Extraction Agent", "Starting...");
			},
		},
		{
			time: 3500,
			action: () => {
				setNodeProgress("wf-extraction", 50);
				addToolCall("wf-extraction-tools", "extract_clauses => 6 clauses found");
				addLog("10:04:04", "Extraction Agent", "extract_clauses => 6 clauses");
			},
		},
		{
			time: 4200,
			action: () => {
				setNodeProgress("wf-extraction", 80);
				addToolCall("wf-extraction-tools", "identify_parties => Acme Corp, Beta Inc");
				addLog("10:04:04", "Extraction Agent", "identify_parties => 2 parties");
			},
		},
		{
			time: 4800,
			action: () => {
				setNodeProgress("wf-extraction", 100);
				addToolCall("wf-extraction-tools", "extract_dates_values => effective: 2026-03-01");
				addLog("10:04:05", "Extraction Agent", "extract_dates_values => 2 dates");
			},
		},
		{
			time: 5200,
			action: () => {
				setNodeState("wf-extraction", "complete", "Complete (2.8s)");
				addLog("10:04:05", "Extraction Agent", "[PASS] Complete. Handing off to Compliance");
			},
		},
		// Compliance phase
		{
			time: 5700,
			action: () => {
				setNodeState("wf-compliance", "processing", "Checking...");
				setNodeProgress("wf-compliance", 30);
				addLog("10:04:06", "Compliance Agent", "Starting policy check...");
			},
		},
		{
			time: 6400,
			action: () => {
				setNodeProgress("wf-compliance", 70);
				addToolCall("wf-compliance-tools", "check_policy => [WARN] Liability $2.5M");
				addLog("10:04:06", "Compliance Agent", "check_policy => [WARN] Liability exceeds $1M");
			},
		},
		{
			time: 7000,
			action: () => {
				setNodeProgress("wf-compliance", 100);
				addToolCall("wf-compliance-tools", "flag_risk => [WARN] No termination clause");
				addLog("10:04:06", "Compliance Agent", "flag_risk => [WARN] Missing termination for convenience");
				document.getElementById("cd-risk").innerHTML = '<span class="badge badge-fail">HIGH</span>';
			},
		},
		{
			time: 7500,
			action: () => {
				setNodeState("wf-compliance", "warning", "2 flags (1.5s)");
				addLog("10:04:06", "Compliance Agent", "[WARN] Complete. 2 flags raised. Handing off to Approval");
			},
		},
		// Approval - HITL
		{
			time: 8000,
			action: () => {
				setNodeState("wf-approval", "processing", "Routing...");
				setNodeProgress("wf-approval", 50);
				addLog("10:04:07", "Approval Agent", "route_approval => Risk: HIGH");
			},
		},
		{
			time: 8500,
			action: () => {
				setNodeProgress("wf-approval", 100);
				addToolCall("wf-approval-tools", "escalate_to_human => HITL required");
				addLog("10:04:07", "Approval Agent", "escalate_to_human => AWAITING HUMAN REVIEW");
			},
		},
		{
			time: 9000,
			action: () => {
				setNodeState("wf-approval", "hitl", "Awaiting Human");
				document.getElementById("hitl-panel").classList.add("visible");
				addLog("10:04:07", "System", "--- PAUSED: Awaiting human review ---");
				dropArea.textContent = "Pipeline paused - Human review required";
				dropArea.style.borderColor = "var(--color-approval)";
				dropArea.style.color = "var(--color-approval)";
			},
		},
	];

	timeline.forEach((step) => {
		setTimeout(step.action, step.time);
	});
}

function setNodeState(nodeId, state, statusText) {
	const node = document.getElementById(nodeId);
	node.className = `workflow-node ${state}`;
	node.querySelector(".workflow-node-status").textContent = statusText;
}

function setNodeProgress(nodeId, pct) {
	const node = document.getElementById(nodeId);
	const fill = node.querySelector(".progress-fill");
	fill.style.width = `${pct}%`;
}

function addToolCall(containerId, text) {
	const container = document.getElementById(containerId);
	const div = document.createElement("div");
	div.className = "workflow-tool-call";
	div.textContent = `- ${text}`;
	div.style.animation = "viewFadeIn 0.2s ease";
	container.appendChild(div);
}

function addLog(time, agent, message) {
	const log = document.getElementById("activity-log");
	const entry = document.createElement("div");
	entry.className = "log-entry";
	entry.innerHTML = `<span class="log-time">${time}</span><span class="log-agent">${agent}</span><span class="log-message">${message}</span>`;
	log.appendChild(entry);
	log.scrollTop = log.scrollHeight;
}

function resolveHitl(decision) {
	if (dashboardMode === "real") return resolveHitlReal(decision);

	const panel = document.getElementById("hitl-panel");
	panel.classList.remove("visible");

	const statusMap = {
		approved: { text: "Approved", badge: "pass", log: "Approved with comment" },
		rejected: { text: "Rejected", badge: "fail", log: "Rejected" },
		changes: {
			text: "Changes Requested",
			badge: "warn",
			log: "Requested changes",
		},
	};

	const result = statusMap[decision];
	setNodeState(
		"wf-approval",
		decision === "approved" ? "complete" : decision === "rejected" ? "warning" : "warning",
		result.text,
	);

	addLog("10:04:52", "Human", result.log);
	addLog("10:04:52", "System", `--- Pipeline ${decision === "approved" ? "COMPLETE" : `STOPPED: ${result.text}`} ---`);

	const dropArea = document.getElementById("drop-area");
	dropArea.textContent = `Pipeline complete - ${result.text}`;
	dropArea.style.borderColor = decision === "approved" ? "var(--color-pass)" : "var(--color-warn)";
	dropArea.style.color = decision === "approved" ? "var(--color-pass)" : "var(--color-warn)";

	workflowRunning = false;
}

// --- View 5: Monitor - Trace toggle + Real mode ---
function toggleTrace(header) {
	const tools = header.parentElement.querySelector(".trace-tools");
	const toggle = header.querySelector(".trace-toggle");
	if (tools.style.display === "none") {
		tools.style.display = "block";
		toggle.textContent = "[-]";
	} else {
		tools.style.display = "none";
		toggle.textContent = "[+]";
	}
}

function refreshMonitor() {
	if (dashboardMode === "real") {
		const select = document.getElementById("monitor-contract-select");
		const contractId = select ? select.value : "";
		loadMonitorReal(contractId || null);
	}
}

function onMonitorContractChange(contractId) {
	if (dashboardMode === "real" && contractId) {
		loadMonitorReal(contractId);
	}
}

// --- View 6: Evaluation Lab ---
function runEvalSuite() {
	if (dashboardMode === "real") return runEvalSuiteReal();

	const btn = document.getElementById("run-suite-btn");
	btn.disabled = true;
	btn.textContent = "Running...";

	// Ground-truth metrics
	const metrics = [
		{
			id: "m-extraction",
			value: "91.2%",
			delta: "+3.1%",
			baseline: "91.2%",
			bdelta: "+3.1%",
			bId: "b-extraction",
			dId: "d-extraction",
		},
		{
			id: "m-compliance",
			value: "87.5%",
			delta: "+5.2%",
			baseline: "87.5%",
			bdelta: "+5.2%",
			bId: "b-compliance",
			dId: "d-compliance",
		},
		{ id: "m-classification", value: "95.0%" },
		{
			id: "m-false-flags",
			value: "8.5%",
			baseline: "8.5%",
			bdelta: "-4.1%",
			bId: "b-false-flags",
			dId: "d-false-flags",
		},
		{
			id: "m-latency",
			value: "3.1s",
			baseline: "3.1s",
			bdelta: "-0.4s",
			bId: "b-latency",
			dId: "d-latency",
		},
	];

	// LLM-as-judge scores
	const judgeMetrics = [
		{
			id: "j-relevance",
			value: "4.6 / 5",
			baseline: "4.6/5",
			bdelta: "+0.4",
			bId: "b-relevance",
			dId: "d-relevance",
		},
		{
			id: "j-groundedness",
			value: "4.3 / 5",
			baseline: "4.3/5",
			bdelta: "+0.3",
			bId: "b-groundedness",
			dId: "d-groundedness",
		},
		{
			id: "j-coherence",
			value: "4.8 / 5",
			baseline: "4.8/5",
			bdelta: "+0.3",
			bId: "b-coherence",
			dId: "d-coherence",
		},
	];

	metrics.forEach((m, i) => {
		setTimeout(
			() => {
				const el = document.getElementById(m.id);
				el.textContent = m.value;
				el.parentElement.style.animation = "scaleIn 0.3s ease";

				if (m.bId) {
					document.getElementById(m.bId).textContent = m.baseline;
					const deltaEl = document.getElementById(m.dId);
					deltaEl.textContent = m.bdelta;
					deltaEl.classList.add(
						m.bdelta.charAt(0) === "+"
							? "positive"
							: m.bdelta.charAt(0) === "-" && m.id !== "m-false-flags" && m.id !== "m-latency"
								? "negative"
								: "positive",
					);
				}
			},
			(i + 1) * 300,
		);
	});

	// Animate judge scores after ground-truth metrics
	const judgeDelay = (metrics.length + 1) * 300;
	judgeMetrics.forEach((j, i) => {
		setTimeout(
			() => {
				const el = document.getElementById(j.id);
				el.textContent = j.value;
				el.parentElement.style.animation = "scaleIn 0.3s ease";
				// Color the score based on value
				const score = Number.parseFloat(j.value);
				if (score >= 4.0) {
					el.style.color = "var(--color-pass)";
				} else if (score >= 3.0) {
					el.style.color = "var(--color-warn)";
				} else {
					el.style.color = "var(--color-fail)";
				}

				if (j.bId) {
					document.getElementById(j.bId).textContent = j.baseline;
					const deltaEl = document.getElementById(j.dId);
					deltaEl.textContent = j.bdelta;
					deltaEl.classList.add("positive");
				}
			},
			judgeDelay + (i + 1) * 200,
		);
	});

	const totalDelay = judgeDelay + (judgeMetrics.length + 1) * 200 + 200;
	setTimeout(() => {
		document.getElementById("eval-overall").textContent = "Overall: 17/20 passed (85.0%) | Judge Avg: 4.6/5";
		document.getElementById("eval-last-run").textContent = "Just now";
		const gate = document.getElementById("quality-gate");
		gate.style.animation = "scaleIn 0.3s ease";
		gate.classList.add("animate-pulse-green");
		btn.textContent = "Run Suite";
		btn.disabled = false;
	}, totalDelay);
}

// --- View 7: Model Swap ---
function simulateModelSwap() {
	if (dashboardMode === "real") return simulateModelSwapReal();

	const btn = document.getElementById("swap-btn");
	btn.disabled = true;
	btn.textContent = "Simulating...";

	setTimeout(() => {
		document.getElementById("cand-accuracy").textContent = "88.1%";
		document.getElementById("cand-latency").textContent = "1.1s";
		document.getElementById("cand-cost").textContent = "$0.024";
	}, 600);

	setTimeout(() => {
		const verdict = document.getElementById("verdict-card");
		verdict.style.opacity = "1";
		verdict.style.animation = "scaleIn 0.3s ease";
		document.getElementById("verdict-title").textContent = "ACCEPTABLE";
		document.getElementById("v-accuracy").textContent = "-3.1%";
		document.getElementById("v-cost").textContent = "-60%";
		document.getElementById("v-latency").textContent = "-52%";
		btn.textContent = "Simulate Swap";
		btn.disabled = false;
	}, 1200);
}

// --- View 8: Feedback & Optimize ---
function optimizeFeedback() {
	if (dashboardMode === "real") return optimizeFeedbackReal();

	const btn = document.getElementById("optimize-btn");
	btn.disabled = true;
	btn.textContent = "Converting...";

	setTimeout(() => {
		btn.textContent = "5 test cases created";
		btn.classList.remove("btn-primary");
		btn.classList.add("btn-outline");
	}, 1000);
}

function savePrompt() {
	if (dashboardMode === "real") return savePromptReal();

	const editor = document.getElementById("prompt-editor");
	editor.style.borderColor = "var(--color-pass)";
	setTimeout(() => {
		editor.style.borderColor = "#3A3A3A";
	}, 1500);
}

function reEvaluate() {
	if (dashboardMode === "real") return reEvaluateReal();

	const btn = document.getElementById("re-eval-btn");
	btn.disabled = true;
	btn.textContent = "Evaluating...";

	setTimeout(() => {
		document.getElementById("re-eval-results").style.display = "grid";
		document.getElementById("re-eval-results").style.animation = "viewFadeIn 0.3s ease";
		document.getElementById("re-eval-gate").style.display = "block";
		document.getElementById("re-eval-gate").style.animation = "scaleIn 0.3s ease";
		btn.textContent = "Re-Evaluate";
		btn.disabled = false;
	}, 1200);
}

function deployUpdate() {
	if (dashboardMode === "real") {
		// In real mode, deploy via the deploy pipeline
		return runDeployPipelineReal();
	}

	const btn = document.getElementById("deploy-v14-btn");
	btn.disabled = true;
	btn.textContent = "Deploying...";

	setTimeout(() => {
		btn.textContent = "v1.4 Deployed";
		btn.classList.remove("btn-success");
		btn.classList.add("btn-outline");
	}, 1000);
}
