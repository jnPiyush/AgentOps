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
		const viewNames = ["design", "test", "deploy", "live", "monitor", "evaluate", "drift", "feedback"];
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
		if (viewNames[index] === "test") syncTestTab();
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
// the designed workflow to Test, Deploy, and Live tabs.
let activeWorkflow = null;

window.addEventListener("workflow-activated", (e) => {
	activeWorkflow = e.detail;
	syncTestTab();
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

const mcpTools = {
	"contract-extraction-mcp": ["extract_clauses", "identify_parties", "extract_dates_values"],
	"contract-intake-mcp": ["upload_contract", "classify_document", "extract_metadata"],
	"contract-compliance-mcp": ["check_policy", "flag_risk", "get_policy_rules"],
	"contract-workflow-mcp": ["route_approval", "escalate_to_human", "notify_stakeholder"],
};

window.mcpTools = mcpTools;

const TEST_SCENARIOS = [
	{
		id: "nda-standard",
		name: "Standard NDA",
		description: "Check that the workflow can classify a low-risk NDA, extract key clauses, and complete without unnecessary escalation.",
		inputSummary: "Acme and Beta mutual NDA with confidentiality, parties, effective date, and a standard 2-year term.",
		expectations: [
			"Intake should classify a confidentiality-heavy agreement.",
			"Extraction should capture parties, dates, and confidentiality clauses.",
			"Workflow should complete without mandatory human approval.",
		],
		requiredCapabilities: ["intake", "extraction", "approval"],
		requiresHumanReview: false,
		prefersParallel: false,
	},
	{
		id: "msa-high-risk",
		name: "High-Risk MSA",
		description: "Stress the workflow with a risky master services agreement that should trigger compliance review and human approval.",
		inputSummary: "Enterprise MSA with high liability cap, auto-renewal, cross-border data transfer, and aggressive termination language.",
		expectations: [
			"Compliance should review policy-sensitive clauses.",
			"Approval should escalate to a human checkpoint.",
			"Parallel review is beneficial when multiple specialists are involved.",
		],
		requiredCapabilities: ["intake", "extraction", "compliance", "approval"],
		requiresHumanReview: true,
		prefersParallel: true,
	},
	{
		id: "amendment-fast-track",
		name: "Amendment Fast Track",
		description: "Validate a short amendment path where extraction and approval can be lightweight but still complete.",
		inputSummary: "Short data-policy amendment updating only retention terms and notice contacts.",
		expectations: [
			"Workflow should identify this as a small delta review.",
			"Extraction should capture the changed clauses quickly.",
			"Approval path should remain lightweight.",
		],
		requiredCapabilities: ["intake", "extraction", "approval"],
		requiresHumanReview: false,
		prefersParallel: false,
	},
];

const CAPABILITY_RULES = {
	intake: {
		label: "Intake",
		keywords: ["intake", "classify", "metadata", "upload", "document"],
		tools: ["upload_contract", "classify_document", "extract_metadata"],
	},
	extraction: {
		label: "Extraction",
		keywords: ["extract", "clause", "party", "date", "metadata"],
		tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
	},
	compliance: {
		label: "Compliance",
		keywords: ["compliance", "policy", "risk", "flag", "review"],
		tools: ["check_policy", "flag_risk", "get_policy_rules"],
	},
	approval: {
		label: "Approval",
		keywords: ["approval", "route", "stakeholder", "human", "legal"],
		tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
	},
};

function getWorkflowStagesForTesting(workflow) {
	const stageMap = new Map();
	const agents = [...(workflow.agents || [])].sort((a, b) => {
		return (a.stage ?? 0) - (b.stage ?? 0)
			|| (a.lane ?? 0) - (b.lane ?? 0)
			|| (a.order ?? 0) - (b.order ?? 0);
	});

	agents.forEach((agent) => {
		const stage = agent.stage ?? agent.order ?? 0;
		if (!stageMap.has(stage)) {
			stageMap.set(stage, []);
		}
		stageMap.get(stage).push(agent);
	});

	return [...stageMap.entries()].sort((a, b) => a[0] - b[0]).map(([stage, stageAgents]) => ({
		stage,
		agents: stageAgents,
		isParallel: stageAgents.length > 1,
	}));
}

function getWorkflowValidation(workflow) {
	if (typeof WorkflowDesigner !== "undefined" && typeof WorkflowDesigner.validateWorkflow === "function") {
		return WorkflowDesigner.validateWorkflow(workflow);
	}

	return {
		workflow,
		findings: [],
		errors: 0,
		warnings: 0,
		infos: 0,
		isValid: true,
	};
}

function getWorkflowText(agent) {
	return [agent.name, agent.role, agent.boundary, agent.output].filter(Boolean).join(" ").toLowerCase();
}

function workflowHasCapability(workflow, capabilityId) {
	const rule = CAPABILITY_RULES[capabilityId];
	if (!rule) return false;

	return (workflow.agents || []).some((agent) => {
		const text = getWorkflowText(agent);
		const matchesKeyword = rule.keywords.some((keyword) => text.includes(keyword));
		const matchesTool = (agent.tools || []).some((tool) => rule.tools.includes(tool));
		return matchesKeyword || matchesTool;
	});
}

function getResultBadgeClass(status) {
	if (status === "fail") return "badge-fail";
	if (status === "warn") return "badge-warn";
	return "badge-pass";
}

function updateTestModeNote() {
	const noteEl = document.getElementById("test-mode-note");
	if (!noteEl) return;

	noteEl.textContent = dashboardMode === "real"
		? "Real mode validates workflow readiness and shows scenario expectations. End-to-end live execution still happens in the Live tab."
		: "Simulated mode runs scenario-based workflow checks. Design rules are enforced in the Design tab before save or push.";
}

function populateTestScenarioSelect() {
	const select = document.getElementById("test-scenario-select");
	if (!select) return;

	const previousValue = select.value;
	select.innerHTML = TEST_SCENARIOS.map((scenario) => `<option value="${scenario.id}">${scenario.name}</option>`).join("");
	if (previousValue && TEST_SCENARIOS.some((scenario) => scenario.id === previousValue)) {
		select.value = previousValue;
	}
}

function getSelectedScenario() {
	const select = document.getElementById("test-scenario-select");
	const scenarioId = select ? select.value : TEST_SCENARIOS[0].id;
	return TEST_SCENARIOS.find((scenario) => scenario.id === scenarioId) || TEST_SCENARIOS[0];
}

function renderTestWorkflowSummary(workflow) {
	const nameEl = document.getElementById("test-workflow-name");
	const metaEl = document.getElementById("test-workflow-meta");
	const readinessEl = document.getElementById("test-readiness-status");
	const readinessMetaEl = document.getElementById("test-readiness-meta");
	const checksEl = document.getElementById("test-workflow-checks");

	if (!nameEl || !metaEl || !readinessEl || !readinessMetaEl || !checksEl) {
		return;
	}

	if (!workflow || !workflow.agents || workflow.agents.length === 0) {
		nameEl.textContent = "No workflow selected";
		metaEl.textContent = "Create or load a workflow in Design to begin testing.";
		readinessEl.innerHTML = '<span class="badge badge-fail">Blocked</span>';
		readinessMetaEl.textContent = "A workflow is required before tests can run.";
		checksEl.innerHTML = '<div class="test-check-item is-fail"><span class="badge badge-fail">[FAIL]</span><span>Add at least one agent in Design.</span></div>';
		return;
	}

	const validation = getWorkflowValidation(workflow);
	const stages = getWorkflowStagesForTesting(validation.workflow || workflow);
	const totalTools = (workflow.agents || []).reduce((acc, agent) => acc + ((agent.tools || []).length), 0);
	const readinessLabel = validation.errors > 0 ? "Blocked" : validation.warnings > 0 ? "Ready with warnings" : "Ready";
	const readinessBadge = validation.errors > 0 ? "badge-fail" : validation.warnings > 0 ? "badge-warn" : "badge-pass";

	nameEl.textContent = workflow.name || "Untitled workflow";
	metaEl.textContent = `${workflow.agents.length} agents • ${stages.length} stages • ${totalTools} tools`;
	readinessEl.innerHTML = `<span class="badge ${readinessBadge}">${readinessLabel}</span>`;
	readinessMetaEl.textContent = validation.errors > 0
		? `${validation.errors} blocking errors must be fixed in Design.`
		: validation.warnings > 0
			? `${validation.warnings} warnings remain, but testing can continue.`
			: "Workflow is structurally ready for scenario testing.";

	const findings = validation.findings.slice(0, 5);
	checksEl.innerHTML = findings.length > 0
		? findings.map((item) => `
			<div class="test-check-item is-${item.severity}">
				<span class="badge ${item.severity === "error" ? "badge-fail" : item.severity === "warning" ? "badge-warn" : "badge-pass"}">[${item.severity === "error" ? "FAIL" : item.severity === "warning" ? "WARN" : "PASS"}]</span>
				<span>${escapeHtmlApp(item.message)}</span>
			</div>
		`).join("")
		: '<div class="test-check-item is-pass"><span class="badge badge-pass">[PASS]</span><span>No blocking design issues were found.</span></div>';
}

function updateScenarioDetails() {
	updateTestModeNote();
	populateTestScenarioSelect();

	const scenario = getSelectedScenario();
	const summaryEl = document.getElementById("test-scenario-summary");
	const briefEl = document.getElementById("test-scenario-brief");
	const expectedEl = document.getElementById("test-expected-list");

	if (summaryEl) {
		summaryEl.textContent = scenario.inputSummary;
	}

	if (briefEl) {
		briefEl.innerHTML = `
			<div class="test-scenario-description">${escapeHtmlApp(scenario.description)}</div>
			<div class="test-scenario-input"><strong>Input:</strong> ${escapeHtmlApp(scenario.inputSummary)}</div>
		`;
	}

	if (expectedEl) {
		expectedEl.innerHTML = scenario.expectations.map((expectation) => `
			<div class="test-expected-item">
				<span class="badge badge-info">[INFO]</span>
				<span>${escapeHtmlApp(expectation)}</span>
			</div>
		`).join("");
	}

	renderTestWorkflowSummary(getActiveWorkflow());
}

function evaluateWorkflowScenario(workflow, scenario) {
	const validation = getWorkflowValidation(workflow);
	const effectiveWorkflow = validation.workflow || workflow;
	const stages = getWorkflowStagesForTesting(effectiveWorkflow);
	const assertions = [];
	const totalTools = (effectiveWorkflow.agents || []).reduce((acc, agent) => acc + ((agent.tools || []).length), 0);
	const hasHuman = (effectiveWorkflow.agents || []).some((agent) => agent.kind === "human");

	assertions.push({
		status: validation.errors === 0 ? "pass" : "fail",
		label: "Design validation",
		detail: validation.errors === 0
			? (validation.warnings > 0 ? `${validation.warnings} warnings remain, but the design is testable.` : "No blocking design issues found.")
			: `${validation.errors} blocking design issues prevent a clean run.`,
	});

	assertions.push({
		status: totalTools > 0 ? "pass" : "warn",
		label: "Tool coverage",
		detail: totalTools > 0 ? `${totalTools} tools are assigned across the workflow.` : "No tools are assigned yet, so this test is only validating structure.",
	});

	scenario.requiredCapabilities.forEach((capabilityId) => {
		const rule = CAPABILITY_RULES[capabilityId];
		const hasCapability = workflowHasCapability(effectiveWorkflow, capabilityId);
		assertions.push({
			status: hasCapability ? "pass" : "fail",
			label: `${rule.label} coverage`,
			detail: hasCapability
				? `Workflow includes an agent or tool capable of ${rule.label.toLowerCase()} work.`
				: `No agent or tool mapping clearly covers ${rule.label.toLowerCase()} work for this scenario.`,
		});
	});

	assertions.push({
		status: scenario.requiresHumanReview ? (hasHuman ? "pass" : "fail") : (hasHuman ? "warn" : "pass"),
		label: "Human checkpoint fit",
		detail: scenario.requiresHumanReview
			? (hasHuman ? "A human checkpoint exists for escalation-heavy review." : "This scenario expects a human checkpoint but none is defined.")
			: (hasHuman ? "A human checkpoint exists even though this scenario should usually fast-track." : "Workflow can complete without mandatory human review."),
	});

	if (scenario.prefersParallel) {
		const hasParallel = stages.some((stageInfo) => stageInfo.agents.length > 1);
		assertions.push({
			status: hasParallel ? "pass" : "warn",
			label: "Parallel review fit",
			detail: hasParallel ? "Workflow includes a parallel stage that can support specialist review." : "Workflow is fully sequential; it can still run, but high-risk review may be slower.",
		});
	}

	const passCount = assertions.filter((item) => item.status === "pass").length;
	const warnCount = assertions.filter((item) => item.status === "warn").length;
	const failCount = assertions.filter((item) => item.status === "fail").length;
	const verdict = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";

	return {
		scenario,
		workflow: effectiveWorkflow,
		stages,
		assertions,
		passCount,
		warnCount,
		failCount,
		verdict,
	};
}

function renderSingleScenarioResult(result) {
	const summaryEl = document.getElementById("test-results-summary");
	const listEl = document.getElementById("test-result-list");
	const traceEl = document.getElementById("test-stage-trace");
	if (!summaryEl || !listEl || !traceEl) return;

	summaryEl.dataset.hasResults = "true";
	summaryEl.innerHTML = `
		<span class="badge ${getResultBadgeClass(result.verdict)}">${result.verdict === "fail" ? "Blocked" : result.verdict === "warn" ? "Review" : "Pass"}</span>
		<span>${escapeHtmlApp(result.scenario.name)}: ${result.passCount} passed • ${result.warnCount} warnings • ${result.failCount} failed</span>
	`;

	listEl.innerHTML = result.assertions.map((assertion) => `
		<div class="test-result-item is-${assertion.status}">
			<div class="test-result-label"><span class="badge ${getResultBadgeClass(assertion.status)}">[${assertion.status === "fail" ? "FAIL" : assertion.status === "warn" ? "WARN" : "PASS"}]</span><span>${escapeHtmlApp(assertion.label)}</span></div>
			<div class="test-result-detail">${escapeHtmlApp(assertion.detail)}</div>
		</div>
	`).join("");

	traceEl.innerHTML = `
		<div class="test-panel-title">Stage Trace</div>
		<div class="test-stage-row">
			${result.stages.map((stageInfo) => `
				<div class="test-stage-chip ${stageInfo.isParallel ? "is-parallel" : ""}">
					<div class="test-stage-chip-label">Stage ${stageInfo.stage + 1}${stageInfo.isParallel ? " • Parallel" : ""}</div>
					<div class="test-stage-chip-body">${stageInfo.agents.map((agent) => escapeHtmlApp(agent.name)).join(stageInfo.isParallel ? " + " : " -> ")}</div>
				</div>
			`).join("<div class=\"workflow-arrow\">&rarr;</div>")}
		</div>
	`;
}

function renderAggregateScenarioResults(results) {
	const summaryEl = document.getElementById("test-results-summary");
	const listEl = document.getElementById("test-result-list");
	const traceEl = document.getElementById("test-stage-trace");
	if (!summaryEl || !listEl || !traceEl) return;

	const passCount = results.filter((item) => item.verdict === "pass").length;
	const warnCount = results.filter((item) => item.verdict === "warn").length;
	const failCount = results.filter((item) => item.verdict === "fail").length;
	const overallStatus = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";

	summaryEl.dataset.hasResults = "true";
	summaryEl.innerHTML = `
		<span class="badge ${getResultBadgeClass(overallStatus)}">${overallStatus === "fail" ? "Needs fixes" : overallStatus === "warn" ? "Partial" : "Pass"}</span>
		<span>${passCount} scenarios passed • ${warnCount} need review • ${failCount} failed</span>
	`;

	listEl.innerHTML = results.map((result) => `
		<div class="test-result-item is-${result.verdict}">
			<div class="test-result-label"><span class="badge ${getResultBadgeClass(result.verdict)}">${escapeHtmlApp(result.scenario.name)}</span><span>${result.passCount} passed • ${result.warnCount} warnings • ${result.failCount} failed</span></div>
			<div class="test-result-detail">${escapeHtmlApp(result.scenario.description)}</div>
		</div>
	`).join("");

	traceEl.innerHTML = '<div class="test-result-detail">Run an individual scenario to inspect the stage-by-stage trace.</div>';
}

function runSelectedTest() {
	const workflow = getActiveWorkflow();
	const scenario = getSelectedScenario();
	if (!workflow || !workflow.agents || workflow.agents.length === 0) {
		clearTestResults();
		return;
	}

	renderSingleScenarioResult(evaluateWorkflowScenario(workflow, scenario));
}

function runAllTests() {
	const workflow = getActiveWorkflow();
	if (!workflow || !workflow.agents || workflow.agents.length === 0) {
		clearTestResults();
		return;
	}

	renderAggregateScenarioResults(TEST_SCENARIOS.map((scenario) => evaluateWorkflowScenario(workflow, scenario)));
}

function clearTestResults() {
	const summaryEl = document.getElementById("test-results-summary");
	const listEl = document.getElementById("test-result-list");
	const traceEl = document.getElementById("test-stage-trace");

	if (summaryEl) {
		summaryEl.dataset.hasResults = "false";
		summaryEl.innerHTML = '<span class="badge badge-info">Ready</span><span>Select a scenario and run a workflow test.</span>';
	}

	if (listEl) {
		listEl.innerHTML = "";
	}

	if (traceEl) {
		traceEl.innerHTML = '<div class="test-result-detail">Stage trace will appear after you run a scenario.</div>';
	}

	renderTestWorkflowSummary(getActiveWorkflow());
	updateScenarioDetails();
}

function syncTestTab() {
	populateTestScenarioSelect();
	updateScenarioDetails();
	updateTestModeNote();
	if (!document.getElementById("test-results-summary")?.dataset.hasResults) {
		clearTestResults();
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

	const sorted = [...wf.agents].sort((a, b) => {
		return (a.stage ?? 0) - (b.stage ?? 0)
			|| (a.lane ?? 0) - (b.lane ?? 0)
			|| (a.order ?? 0) - (b.order ?? 0);
	});
	const stageMap = new Map();
	for (const agent of sorted) {
		const stage = agent.stage ?? agent.order ?? 0;
		if (!stageMap.has(stage)) {
			stageMap.set(stage, []);
		}
		stageMap.get(stage).push(agent);
	}
	const stages = [...stageMap.entries()].sort((a, b) => a[0] - b[0]);

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
	stages.forEach(([stageNumber, agents], idx) => {
		const isParallelStage = agents.length > 1;
		html += `<div class="workflow-stage ${isParallelStage ? "workflow-stage-parallel" : "workflow-stage-sequential"}">`;
		html += `<div class="workflow-stage-label">Stage ${Number(stageNumber) + 1}${isParallelStage ? " • Parallel" : ""}</div>`;
		if (isParallelStage) {
			html += `<div class="workflow-stage-grid">`;
			agents.forEach(agent => {
				html += renderLiveNode(agent, getColor(agent));
			});
			html += `</div>`;
		} else {
			html += renderLiveNode(agents[0], getColor(agents[0]));
		}
		html += `</div>`;
		if (idx < stages.length - 1) {
			html += `<div class="workflow-arrow">&rarr;</div>`;
		}
	});

	canvas.innerHTML = html;
}

function renderLiveNode(agent, color) {
	const nodeId = `wf-${agent.id}`;
	const roleLabel = agent.kind ? String(agent.kind).replace(/^./, c => c.toUpperCase()) : "Agent";
	return `
		<div class="workflow-node" id="${nodeId}">
			<div class="workflow-node-name">${escapeHtmlApp(agent.name)}</div>
			<div class="workflow-node-role">${escapeHtmlApp(roleLabel)}</div>
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
