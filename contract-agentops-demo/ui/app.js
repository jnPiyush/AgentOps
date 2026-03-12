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
		if (viewNames[index] === "monitor") syncMonitorTab();
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

function normalizeWorkflowShape(workflow) {
	if (!workflow) return null;

	const rawWorkflow = workflow.workflow || workflow;
	const agents = Array.isArray(rawWorkflow.agents) ? rawWorkflow.agents : [];

	return {
		...rawWorkflow,
		id: rawWorkflow.workflow_id || rawWorkflow.id || workflow.workflow_id || workflow.id || "",
		name: rawWorkflow.workflow_name || rawWorkflow.name || workflow.workflow_name || workflow.name || "Untitled workflow",
		agents,
		contract_stage_map: rawWorkflow.contract_stage_map || workflow.contract_stage_map || null,
	};
}

function updatePipelineStatus(workflow) {
	const pipelineEl = document.getElementById("pipeline-status-item");
	if (!pipelineEl || !workflow) return;

	const stageViews = getWorkflowStagesForTesting(workflow);
	pipelineEl.textContent = `Pipeline: ${workflow.name} (${stageViews.length} contract stages, ${workflow.agents.length} execution agents)`;
	pipelineEl.style.color = "var(--color-pass)";
}

function refreshActiveWorkflowFromGateway() {
	const gatewayUrl = window.GATEWAY_URL || "http://localhost:8000";
	return fetch(`${gatewayUrl}/api/v1/workflows/active/package`, { signal: AbortSignal.timeout(4000) })
		.then((res) => {
			if (!res.ok) {
				throw new Error("No active workflow package available");
			}
			return res.json();
		})
		.then((workflowPackage) => {
			activeWorkflow = normalizeWorkflowShape(workflowPackage);
			syncTestTab();
			syncDeployTab();
			syncLiveTab();
			updatePipelineStatus(activeWorkflow);
			return activeWorkflow;
		})
		.catch(() => null);
}

window.refreshActiveWorkflowFromGateway = refreshActiveWorkflowFromGateway;

function normalizeRoleKey(value) {
	return String(value || "").trim().toLowerCase();
}

function deriveAgentRoleKey(agent) {
	const text = [agent?.name, agent?.role, agent?.boundary, agent?.output].filter(Boolean).join(" ").toLowerCase();
	const tools = new Set((agent?.tools || []).map((tool) => String(tool).toLowerCase()));

	if (text.includes("draft") || text.includes("authoring") || text.includes("fallback language")) {
		return "drafting";
	}

	if (text.includes("internal review") || text.includes("redline") || text.includes("version diff")) {
		return "review";
	}

	if (text.includes("negotiat") || text.includes("counterparty") || text.includes("external review")) {
		return "negotiation";
	}

	if (text.includes("signature") || text.includes("execution") || text.includes("signing")) {
		return "signature";
	}

	if (text.includes("obligation") || text.includes("post-execution") || text.includes("milestone")) {
		return "obligations";
	}

	if (text.includes("renewal") || text.includes("expiry") || text.includes("expiration")) {
		return "renewal";
	}

	if (text.includes("analytic") || text.includes("insight") || text.includes("reporting")) {
		return "analytics";
	}

	if (
		tools.has("upload_contract")
		|| tools.has("classify_document")
		|| text.includes("intake")
		|| text.includes("classif")
	) {
		return "intake";
	}

	if (
		tools.has("check_policy")
		|| tools.has("flag_risk")
		|| text.includes("compliance")
		|| text.includes("policy")
	) {
		return "compliance";
	}

	if (
		tools.has("extract_clauses")
		|| tools.has("identify_parties")
		|| text.includes("extract")
		|| text.includes("draft")
	) {
		return "extraction";
	}

	if (
		tools.has("route_approval")
		|| tools.has("escalate_to_human")
		|| text.includes("approval")
		|| text.includes("human")
	) {
		return "approval";
	}

	return normalizeRoleKey(agent?.runtime_role_key || agent?.kind || agent?.id || "custom");
}

function getAgentNodeId(agent) {
	const roleKey = deriveAgentRoleKey(agent);
	if (["intake", "drafting", "extraction", "review", "compliance", "negotiation", "approval"].includes(roleKey)) {
		return `wf-${roleKey}`;
	}
	return `wf-${String(agent?.id || roleKey).replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}`;
}

window.getWorkflowNodeIdForAgentName = function getWorkflowNodeIdForAgentName(agentName) {
	const normalized = normalizeRoleKey(agentName);
	if (["intake", "drafting", "extraction", "review", "compliance", "negotiation", "approval"].includes(normalized)) {
		return `wf-${normalized}`;
	}
	return `wf-${normalized.replace(/[^a-z0-9_-]/gi, "-")}`;
};

window.addEventListener("workflow-activated", (e) => {
	activeWorkflow = normalizeWorkflowShape(e.detail);
	syncTestTab();
	syncDeployTab();
	syncLiveTab();
	syncMonitorTab();
	updatePipelineStatus(activeWorkflow);
	if (activeWorkflow?.id && !activeWorkflow.contract_stage_map) {
		refreshActiveWorkflowFromGateway();
	}
});

function getActiveWorkflow() {
	if (activeWorkflow) return activeWorkflow;
	if (typeof WorkflowDesigner !== "undefined") return normalizeWorkflowShape(WorkflowDesigner.getCurrentWorkflow());
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
	const normalizedWorkflow = normalizeWorkflowShape(workflow);
	if (!normalizedWorkflow) return [];

	const agents = [...(normalizedWorkflow.agents || [])].sort((a, b) => {
		return (a.stage ?? 0) - (b.stage ?? 0)
			|| (a.lane ?? 0) - (b.lane ?? 0)
			|| (a.order ?? 0) - (b.order ?? 0);
	});
	const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
	const contractStageMap = normalizedWorkflow.contract_stage_map;

	if (contractStageMap?.stages?.length) {
		return contractStageMap.stages
			.map((stage) => {
				const executionGroups = (stage.execution_groups || []).map((group) => {
					const groupAgents = (group.runtime_agent_ids || [])
						.map((agentId) => agentsById.get(agentId))
						.filter(Boolean);

					return {
						id: group.id,
						name: group.name,
						runtimeRoleKeys: group.runtime_role_keys || [],
						agents: groupAgents,
					};
				}).filter((group) => group.agents.length > 0 || group.runtimeRoleKeys.length > 0);

				return {
					id: stage.id,
					stage: Math.max((stage.order || 1) - 1, 0),
					order: stage.order || 0,
					name: stage.name,
					summary: stage.summary,
					executionGroups,
					agents: executionGroups.flatMap((group) => group.agents),
					isParallel: executionGroups.length > 1 || executionGroups.some((group) => group.agents.length > 1),
				};
			})
			.filter((stage) => stage.executionGroups.length > 0);
	}

	const stageMap = new Map();
	agents.forEach((agent) => {
		const stage = agent.stage ?? agent.order ?? 0;
		if (!stageMap.has(stage)) {
			stageMap.set(stage, []);
		}
		stageMap.get(stage).push(agent);
	});

	return [...stageMap.entries()].sort((a, b) => a[0] - b[0]).map(([stage, stageAgents]) => ({
		id: `stage-${stage}`,
		stage,
		order: Number(stage) + 1,
		name: `Execution Stage ${Number(stage) + 1}`,
		summary: stageAgents.map((agent) => agent.name).join(" -> "),
		executionGroups: [{
			id: `group-stage-${stage}`,
			name: stageAgents.length > 1 ? "Parallel execution" : "Sequential execution",
			runtimeRoleKeys: stageAgents.map((agent) => deriveAgentRoleKey(agent)),
			agents: stageAgents,
		}],
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

	const normalizedWorkflow = normalizeWorkflowShape(workflow);
	if (!normalizedWorkflow || !normalizedWorkflow.agents || normalizedWorkflow.agents.length === 0) {
		nameEl.textContent = "No workflow selected";
		metaEl.textContent = "Create or load a workflow in Design to begin testing.";
		readinessEl.innerHTML = '<span class="badge badge-fail">Blocked</span>';
		readinessMetaEl.textContent = "A workflow is required before tests can run.";
		checksEl.innerHTML = '<div class="test-check-item is-fail"><span class="badge badge-fail">[FAIL]</span><span>Add at least one agent in Design.</span></div>';
		return;
	}

	const validation = getWorkflowValidation(normalizedWorkflow);
	const stages = getWorkflowStagesForTesting(validation.workflow || workflow);
	const totalTools = (normalizedWorkflow.agents || []).reduce((acc, agent) => acc + ((agent.tools || []).length), 0);
	const readinessLabel = validation.errors > 0 ? "Blocked" : validation.warnings > 0 ? "Ready with warnings" : "Ready";
	const readinessBadge = validation.errors > 0 ? "badge-fail" : validation.warnings > 0 ? "badge-warn" : "badge-pass";

	nameEl.textContent = normalizedWorkflow.name || "Untitled workflow";
	metaEl.textContent = `${normalizedWorkflow.agents.length} execution agents • ${stages.length} contract stages • ${totalTools} tools`;
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
					<div class="test-stage-chip-label">${escapeHtmlApp(stageInfo.name)}${stageInfo.isParallel ? " • Parallel" : ""}</div>
					<div class="test-stage-chip-body">${stageInfo.executionGroups.map((group) => {
						const groupAgents = group.agents.map((agent) => escapeHtmlApp(agent.name)).join(group.agents.length > 1 ? " + " : " -> ");
						return groupAgents || escapeHtmlApp(group.name);
					}).join(stageInfo.isParallel ? " | " : " -> ")}</div>
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
	const stages = getWorkflowStagesForTesting(wf);

	// Update the deploy summary to reflect the active workflow
	const summary = document.getElementById("deploy-summary");
	if (summary) {
		const totalTools = wf.agents.reduce((acc, a) => acc + (a.tools ? a.tools.length : 0), 0);
		summary.textContent = `${stages.length} contract stages mapped | ${wf.agents.length} execution agents ready | ${totalTools} tools registered — ${wf.name}`;
	}

	const tbody = document.getElementById("agent-registry-body");
	if (tbody) {
		const stageNamesByAgentId = new Map();
		stages.forEach((stageInfo) => {
			stageInfo.agents.forEach((agent) => {
				const existing = stageNamesByAgentId.get(agent.id) || [];
				existing.push(stageInfo.name);
				stageNamesByAgentId.set(agent.id, existing);
			});
		});

		tbody.innerHTML = wf.agents.map((agent) => {
			const stageNames = stageNamesByAgentId.get(agent.id) || ["Unmapped"];
			return `<tr><td>${escapeHtmlApp(agent.name)}</td><td style="font-family:var(--font-mono);font-size:12px">${escapeHtmlApp(agent.id || "--")}</td><td><span class="badge badge-info">Ready</span></td><td>${escapeHtmlApp(stageNames.join(", "))}</td></tr>`;
		}).join("");
	}
}

// --- Sync Live Tab from Active Workflow ---
function syncLiveTab() {
	const wf = getActiveWorkflow();
	if (!wf || !wf.agents) return;

	const canvas = document.getElementById("workflow-canvas");
	if (!canvas) return;
	const stages = getWorkflowStagesForTesting(wf);

	// Agent color mapping
	const agentColors = {
		"intake": "var(--color-intake)",
		"drafting": "#1d4ed8",
		"extraction": "var(--color-extraction)",
		"review": "#6d28d9",
		"compliance": "var(--color-compliance)",
		"negotiation": "#b45309",
		"approval": "var(--color-approval)",
	};

	function getColor(agent) {
		// Try to match known agent names, otherwise use agent's own color
		const key = deriveAgentRoleKey(agent);
		return agentColors[key] || agent.color || "var(--color-accent)";
	}

	let html = "";
	stages.forEach((stageInfo, idx) => {
		const isParallelStage = stageInfo.isParallel;
		html += `<div class="workflow-stage ${isParallelStage ? "workflow-stage-parallel" : "workflow-stage-sequential"}">`;
		html += `<div class="workflow-stage-label">${escapeHtmlApp(stageInfo.name)}${isParallelStage ? " • Parallel" : ""}</div>`;
		if (stageInfo.summary) {
			html += `<div class="workflow-stage-summary">${escapeHtmlApp(stageInfo.summary)}</div>`;
		}
		if (isParallelStage || stageInfo.executionGroups.length > 1) {
			html += `<div class="workflow-stage-grid">`;
			stageInfo.executionGroups.forEach((group) => {
				html += `<div class="workflow-group">`;
				html += `<div class="workflow-group-label">${escapeHtmlApp(group.name)}</div>`;
				group.agents.forEach((agent) => {
					html += renderLiveNode(agent, getColor(agent));
				});
				html += `</div>`;
			});
			html += `</div>`;
		} else {
			html += renderLiveNode(stageInfo.agents[0], getColor(stageInfo.agents[0]));
		}
		html += `</div>`;
		if (idx < stages.length - 1) {
			html += `<div class="workflow-arrow">&rarr;</div>`;
		}
	});

	canvas.innerHTML = html;
}

const monitorMetricDefaults = {
	intake: { latency_ms: 1200, tokens_in: 1204, tokens_out: 342, cost: 0.0112 },
	extraction: { latency_ms: 2800, tokens_in: 3891, tokens_out: 1205, cost: 0.0376 },
	compliance: { latency_ms: 1500, tokens_in: 2156, tokens_out: 678, cost: 0.0209 },
	approval: { latency_ms: 300, tokens_in: 456, tokens_out: 123, cost: 0.0041 },
};

function getRoleDisplayName(roleKey) {
	const normalized = normalizeRoleKey(roleKey);
	if (normalized === "intake") return "Intake";
	if (normalized === "extraction") return "Extraction";
	if (normalized === "compliance") return "Compliance";
	if (normalized === "approval") return "Approval";
	if (normalized === "human") return "Human review";
	return normalized ? normalized.replace(/(^.|[-_ ]+.)/g, (match) => match.replace(/[-_ ]/, "").toUpperCase()) : "Unmapped";
}

const liveStageFallbacks = {
	intake: { stageName: "Request and Initiation", nextStageName: "Authoring and Drafting" },
	extraction: { stageName: "Authoring and Drafting", nextStageName: "Compliance Check" },
	compliance: { stageName: "Compliance Check", nextStageName: "Approval and Routing" },
	approval: { stageName: "Approval and Routing", nextStageName: null },
	human: { stageName: "Approval and Routing", nextStageName: null },
};

function getLiveStageContextForRole(roleKey) {
	const normalizedRole = normalizeRoleKey(roleKey);
	const stageViews = getWorkflowStagesForTesting(getActiveWorkflow());

	for (let index = 0; index < stageViews.length; index += 1) {
		const stageInfo = stageViews[index];
		const matchingGroup = stageInfo.executionGroups.find((group) => {
			const groupRoles = new Set((group.runtimeRoleKeys || []).map((key) => normalizeRoleKey(key)));
			(group.agents || []).forEach((agent) => groupRoles.add(deriveAgentRoleKey(agent)));
			return groupRoles.has(normalizedRole);
		});

		if (matchingGroup) {
			const primaryAgent = matchingGroup.agents?.[0] || stageInfo.agents?.find((agent) => deriveAgentRoleKey(agent) === normalizedRole) || stageInfo.agents?.[0] || null;
			return {
				roleKey: normalizedRole,
				stageName: stageInfo.name,
				groupName: matchingGroup.name,
				nextStageName: stageViews[index + 1]?.name || null,
				nodeId: primaryAgent ? getAgentNodeId(primaryAgent) : `wf-${normalizedRole}`,
				toolsId: primaryAgent ? `${getAgentNodeId(primaryAgent)}-tools` : `wf-${normalizedRole}-tools`,
			};
		}
	}

	const fallback = liveStageFallbacks[normalizedRole] || { stageName: getRoleDisplayName(normalizedRole), nextStageName: null };
	return {
		roleKey: normalizedRole,
		stageName: fallback.stageName,
		groupName: `${fallback.stageName} execution`,
		nextStageName: fallback.nextStageName,
		nodeId: `wf-${normalizedRole}`,
		toolsId: `wf-${normalizedRole}-tools`,
	};
}

window.getLiveStageContextForRole = getLiveStageContextForRole;

function getHumanReviewLogLabel() {
	const approvalContext = getLiveStageContextForRole("approval");
	return `${approvalContext.stageName} - Human review`;
}

function formatLatencyMs(latencyMs) {
	if (!latencyMs) return "0.0s";
	return `${(latencyMs / 1000).toFixed(1)}s`;
}

function getStageAccentColor(stageInfo) {
	const firstAgent = stageInfo.agents?.[0];
	if (firstAgent?.color) return firstAgent.color;
	const firstRoleKey = stageInfo.executionGroups?.[0]?.runtimeRoleKeys?.[0] || deriveAgentRoleKey(firstAgent || {});
	const colorByRole = {
		intake: "var(--color-intake)",
		drafting: "#1d4ed8",
		extraction: "var(--color-extraction)",
		review: "#6d28d9",
		compliance: "var(--color-compliance)",
		approval: "var(--color-approval)",
		negotiation: "#b45309",
	};
	return colorByRole[firstRoleKey] || firstAgent?.color || "var(--color-accent)";
}

function buildMonitorStageModels(workflow, monitorData) {
	if (monitorData?.contract_stages?.length) {
		return monitorData.contract_stages.map((stage) => ({
			id: stage.id,
			stage: Math.max((stage.order || 1) - 1, 0),
			order: stage.order || 0,
			name: stage.name,
			summary: stage.summary,
			executionGroups: (stage.execution_groups || []).map((group) => ({
				id: group.id,
				name: group.name,
				runtimeRoleKeys: group.runtime_role_keys || [],
				agents: [],
			})),
			roleTelemetry: (stage.execution_groups || []).map((group) => ({
				roleKey: (group.runtime_role_keys || [])[0] || group.id,
				displayName: group.name,
				latency_ms: group.latency_ms || 0,
				tokens_in: group.tokens_in || 0,
				tokens_out: group.tokens_out || 0,
				cost: group.cost || 0,
			})),
			auditEntries: stage.audit_trail || [],
			totals: {
				latency_ms: stage.latency_ms || 0,
				tokens_in: stage.tokens_in || 0,
				tokens_out: stage.tokens_out || 0,
				cost: stage.cost || 0,
			},
			isParallel: (stage.execution_groups || []).length > 1,
			agents: [],
		}));
	}

	const stageViews = getWorkflowStagesForTesting(workflow);
	const roleMetrics = new Map();
	(monitorData?.agents || []).forEach((agent) => {
		roleMetrics.set(normalizeRoleKey(agent.agent), agent);
	});

	return stageViews.map((stageInfo) => {
		const roleKeys = [...new Set(stageInfo.executionGroups.flatMap((group) => {
			const fromGroups = group.runtimeRoleKeys || [];
			const fromAgents = (group.agents || []).map((agent) => deriveAgentRoleKey(agent));
			return [...fromGroups, ...fromAgents].map((key) => normalizeRoleKey(key)).filter(Boolean);
		}))];

		const roleTelemetry = roleKeys.map((roleKey) => {
			const runtimeMetric = roleMetrics.get(roleKey);
			const defaultMetric = dashboardMode === "real" ? null : monitorMetricDefaults[roleKey] || null;
			return {
				roleKey,
				displayName: getRoleDisplayName(roleKey),
				...(runtimeMetric || defaultMetric || { latency_ms: 0, tokens_in: 0, tokens_out: 0, cost: 0 }),
			};
		});

		const auditEntries = (monitorData?.audit_trail || []).filter((entry) => {
			const entryRole = normalizeRoleKey(entry.agent);
			return roleKeys.includes(entryRole) || (entryRole === "human" && roleKeys.includes("approval"));
		});

		const totals = roleTelemetry.reduce((acc, metric) => ({
			latency_ms: acc.latency_ms + (metric.latency_ms || 0),
			tokens_in: acc.tokens_in + (metric.tokens_in || 0),
			tokens_out: acc.tokens_out + (metric.tokens_out || 0),
			cost: acc.cost + (metric.cost || 0),
		}), { latency_ms: 0, tokens_in: 0, tokens_out: 0, cost: 0 });

		return {
			...stageInfo,
			roleTelemetry,
			auditEntries,
			totals,
		};
	});
}

function renderMonitorStatePlaceholder(message) {
	const traceTree = document.querySelector(".trace-tree");
	const latencyContainer = document.getElementById("latency-bars");
	const tokenBody = document.getElementById("token-usage-body");
	const auditBody = document.getElementById("audit-trail-body");

	if (traceTree) {
		traceTree.innerHTML = `<div class="trace-empty">${escapeHtmlApp(message)}</div>`;
	}
	if (latencyContainer) {
		latencyContainer.innerHTML = `<div class="trace-empty">${escapeHtmlApp(message)}</div>`;
	}
	if (tokenBody) {
		tokenBody.innerHTML = `<tr><td colspan="4" style="color:var(--color-text-disabled);text-align:center;padding:24px">${escapeHtmlApp(message)}</td></tr>`;
	}
	if (auditBody) {
		auditBody.innerHTML = `<tr><td colspan="4" style="color:var(--color-text-disabled);text-align:center;padding:24px">${escapeHtmlApp(message)}</td></tr>`;
	}
}

function renderMonitorStageMap(monitorData) {
	const workflow = getActiveWorkflow();
	if (!workflow || !workflow.agents?.length) {
		renderMonitorStatePlaceholder("Activate a workflow in Design to map contract-stage monitoring.");
		return;
	}

	const stageModels = buildMonitorStageModels(workflow, monitorData);
	if (stageModels.length === 0) {
		renderMonitorStatePlaceholder("The active workflow does not yet expose any mapped contract stages.");
		return;
	}

	const traceTree = document.querySelector(".trace-tree");
	if (traceTree) {
		traceTree.innerHTML = stageModels.map((stageInfo) => {
			const stageBadge = stageInfo.totals.latency_ms > 0 ? "badge-pass" : "badge-info";
			const stageStatus = stageInfo.totals.latency_ms > 0 ? "ACTIVE" : (dashboardMode === "real" ? "MAPPED" : "SIMULATED");
			const groupLines = stageInfo.executionGroups.map((group) => {
				const members = group.agents.map((agent) => escapeHtmlApp(agent.name)).join(group.agents.length > 1 ? " + " : " -> ");
				return `<div class="trace-tool"><span class="trace-tool-time">map</span>${escapeHtmlApp(group.name)} <span class="badge badge-info">[MAP]</span></div><div class="trace-tool trace-tool-detail">${members || escapeHtmlApp(group.name)}</div>`;
			}).join("");
			const telemetryLines = stageInfo.roleTelemetry.map((metric) => {
				const metricBadge = metric.latency_ms > 0 || metric.tokens_in > 0 ? "badge-pass" : "badge-info";
				const metricLabel = metric.latency_ms > 0 || metric.tokens_in > 0 ? "LIVE" : (dashboardMode === "real" ? "WAIT" : "SIM");
				return `<div class="trace-tool"><span class="trace-tool-time">${formatLatencyMs(metric.latency_ms)}</span>${escapeHtmlApp(metric.displayName)} <span class="badge ${metricBadge}">[${metricLabel}]</span></div><div class="trace-tool trace-tool-detail">${metric.tokens_in.toLocaleString()} in / ${metric.tokens_out.toLocaleString()} out / $${metric.cost.toFixed(4)}</div>`;
			}).join("");

			return `<div class="trace-agent"><div class="trace-agent-header" onclick="toggleTrace(this)"><span class="trace-toggle">[-]</span><span class="trace-agent-name" style="color:${getStageAccentColor(stageInfo)}">${escapeHtmlApp(stageInfo.name)}</span><span class="trace-agent-time">${formatLatencyMs(stageInfo.totals.latency_ms)}</span></div><div class="trace-tools"><div class="trace-tool"><span class="trace-tool-time">stage</span>${escapeHtmlApp(stageInfo.summary || "Mapped contract stage execution")} <span class="badge ${stageBadge}">[${stageStatus}]</span></div>${groupLines}${telemetryLines}</div></div>`;
		}).join("");
	}

	const latencyContainer = document.getElementById("latency-bars");
	if (latencyContainer) {
		latencyContainer.innerHTML = "";
		const maxLatency = Math.max(...stageModels.map((stageInfo) => stageInfo.totals.latency_ms), 0);
		stageModels.forEach((stageInfo) => {
			const pct = maxLatency > 0 ? Math.max(Math.round((stageInfo.totals.latency_ms / maxLatency) * 100), stageInfo.totals.latency_ms > 0 ? 8 : 0) : 0;
			const speedClass = stageInfo.totals.latency_ms < 2000 ? "fast" : stageInfo.totals.latency_ms < 4000 ? "medium" : "slow";
			const bar = document.createElement("div");
			bar.className = "latency-bar";
			bar.innerHTML = `<div class="latency-label">${escapeHtmlApp(stageInfo.name)}</div><div class="latency-fill-wrapper"><div class="latency-fill ${speedClass}" style="width:${pct}%"></div></div><div class="latency-time">${formatLatencyMs(stageInfo.totals.latency_ms)}</div>`;
			latencyContainer.appendChild(bar);
		});
		const totalLatency = monitorData?.totals?.latency_ms ?? stageModels.reduce((sum, stageInfo) => sum + stageInfo.totals.latency_ms, 0);
		const totalDiv = document.createElement("div");
		totalDiv.style.cssText = "margin-top:12px;font-size:13px;color:var(--color-text-tertiary)";
		totalDiv.textContent = `Total: ${formatLatencyMs(totalLatency)} (${dashboardMode === "real" ? "live telemetry" : "simulated contract-stage flow"})`;
		latencyContainer.appendChild(totalDiv);
	}

	const tokenBody = document.getElementById("token-usage-body");
	if (tokenBody) {
		tokenBody.innerHTML = stageModels.map((stageInfo) => {
			return `<tr><td>${escapeHtmlApp(stageInfo.name)}</td><td>${stageInfo.totals.tokens_in.toLocaleString()}</td><td>${stageInfo.totals.tokens_out.toLocaleString()}</td><td>$${stageInfo.totals.cost.toFixed(4)}</td></tr>`;
		}).join("");
		const totals = monitorData?.totals || stageModels.reduce((acc, stageInfo) => ({
			tokens_in: acc.tokens_in + stageInfo.totals.tokens_in,
			tokens_out: acc.tokens_out + stageInfo.totals.tokens_out,
			cost: acc.cost + stageInfo.totals.cost,
		}), { tokens_in: 0, tokens_out: 0, cost: 0 });
		tokenBody.innerHTML += `<tr style="font-weight:600"><td>Total</td><td>${totals.tokens_in.toLocaleString()}</td><td>${totals.tokens_out.toLocaleString()}</td><td>$${Number(totals.cost || 0).toFixed(4)}</td></tr>`;
	}

	const auditBody = document.getElementById("audit-trail-body");
	if (auditBody) {
		const auditRows = [];
		stageModels.forEach((stageInfo) => {
			if (stageInfo.auditEntries.length > 0) {
				stageInfo.auditEntries.forEach((entry) => {
					const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--";
					auditRows.push(`<tr><td>${time}</td><td>${escapeHtmlApp(stageInfo.name)}</td><td>${escapeHtmlApp(entry.action || "--")}</td><td>${escapeHtmlApp(entry.reasoning || getRoleDisplayName(entry.agent))}</td></tr>`);
				});
			} else if (dashboardMode !== "real") {
				auditRows.push(`<tr><td>--</td><td>${escapeHtmlApp(stageInfo.name)}</td><td>Mapped to execution group</td><td>${escapeHtmlApp(stageInfo.executionGroups.map((group) => group.name).join(" | "))}</td></tr>`);
			}
		});

		auditBody.innerHTML = auditRows.join("") || `<tr><td colspan="4" style="color:var(--color-text-disabled);text-align:center;padding:24px">Awaiting runtime audit events for the active contract stages.</td></tr>`;
	}
}

window.renderMonitorStageMap = renderMonitorStageMap;

function syncMonitorTab() {
	if (dashboardMode === "real") {
		renderMonitorStageMap(null);
		const select = document.getElementById("monitor-contract-select");
		const contractId = select?.value || "";
		if (contractId) {
			loadMonitorReal(contractId);
		} else {
			loadMonitorContractListReal();
		}
		return;
	}

	renderMonitorStageMap(null);
}

function renderLiveNode(agent, color) {
	const nodeId = getAgentNodeId(agent);
	const roleKey = deriveAgentRoleKey(agent);
	const roleLabel = roleKey ? roleKey.replace(/^./, (c) => c.toUpperCase()) : (agent.kind ? String(agent.kind).replace(/^./, (c) => c.toUpperCase()) : "Agent");
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

	const intakeStage = getLiveStageContextForRole("intake");
	const extractionStage = getLiveStageContextForRole("extraction");
	const complianceStage = getLiveStageContextForRole("compliance");
	const approvalStage = getLiveStageContextForRole("approval");

	const timeline = [
		// Request and initiation
		{
			time: 500,
			action: () => {
				setNodeState(intakeStage.nodeId, "processing", "In progress");
				setNodeProgress(intakeStage.nodeId, 30);
				addLog("10:04:01", intakeStage.stageName, "classify_document started");
			},
		},
		{
			time: 1200,
			action: () => {
				setNodeProgress(intakeStage.nodeId, 60);
				addToolCall(intakeStage.toolsId, 'classify_document => "NDA" (0.97)');
				addLog("10:04:01", intakeStage.stageName, "classify_document => NDA (0.97)");
				document.getElementById("cd-type").textContent = "NDA";
			},
		},
		{
			time: 1800,
			action: () => {
				setNodeProgress(intakeStage.nodeId, 100);
				addToolCall(intakeStage.toolsId, "extract_metadata => {parties: 2, pages: 4}");
				addLog("10:04:02", intakeStage.stageName, "extract_metadata => {parties: 2}");
				document.getElementById("cd-parties").textContent = "Acme Corp, Beta Inc";
				document.getElementById("cd-pages").textContent = "4";
			},
		},
		{
			time: 2300,
			action: () => {
				setNodeState(intakeStage.nodeId, "complete", "Complete (1.2s)");
				addLog("10:04:03", intakeStage.stageName, `[PASS] Complete. Next: ${intakeStage.nextStageName || extractionStage.stageName}`);
			},
		},
		// Authoring and drafting
		{
			time: 2800,
			action: () => {
				setNodeState(extractionStage.nodeId, "processing", "In progress");
				setNodeProgress(extractionStage.nodeId, 20);
				addLog("10:04:03", extractionStage.stageName, "Execution started");
			},
		},
		{
			time: 3500,
			action: () => {
				setNodeProgress(extractionStage.nodeId, 50);
				addToolCall(extractionStage.toolsId, "extract_clauses => 6 clauses found");
				addLog("10:04:04", extractionStage.stageName, "extract_clauses => 6 clauses");
			},
		},
		{
			time: 4200,
			action: () => {
				setNodeProgress(extractionStage.nodeId, 80);
				addToolCall(extractionStage.toolsId, "identify_parties => Acme Corp, Beta Inc");
				addLog("10:04:04", extractionStage.stageName, "identify_parties => 2 parties");
			},
		},
		{
			time: 4800,
			action: () => {
				setNodeProgress(extractionStage.nodeId, 100);
				addToolCall(extractionStage.toolsId, "extract_dates_values => effective: 2026-03-01");
				addLog("10:04:05", extractionStage.stageName, "extract_dates_values => 2 dates");
			},
		},
		{
			time: 5200,
			action: () => {
				setNodeState(extractionStage.nodeId, "complete", "Complete (2.8s)");
				addLog("10:04:05", extractionStage.stageName, `[PASS] Complete. Next: ${extractionStage.nextStageName || complianceStage.stageName}`);
			},
		},
		// Compliance check
		{
			time: 5700,
			action: () => {
				setNodeState(complianceStage.nodeId, "processing", "In progress");
				setNodeProgress(complianceStage.nodeId, 30);
				addLog("10:04:06", complianceStage.stageName, "Policy evaluation started");
			},
		},
		{
			time: 6400,
			action: () => {
				setNodeProgress(complianceStage.nodeId, 70);
				addToolCall(complianceStage.toolsId, "check_policy => [WARN] Liability $2.5M");
				addLog("10:04:06", complianceStage.stageName, "check_policy => [WARN] Liability exceeds $1M");
			},
		},
		{
			time: 7000,
			action: () => {
				setNodeProgress(complianceStage.nodeId, 100);
				addToolCall(complianceStage.toolsId, "flag_risk => [WARN] No termination clause");
				addLog("10:04:06", complianceStage.stageName, "flag_risk => [WARN] Missing termination for convenience");
				document.getElementById("cd-risk").innerHTML = '<span class="badge badge-fail">HIGH</span>';
			},
		},
		{
			time: 7500,
			action: () => {
				setNodeState(complianceStage.nodeId, "warning", "2 flags (1.5s)");
				addLog("10:04:06", complianceStage.stageName, `[WARN] Complete. 2 flags raised. Next: ${complianceStage.nextStageName || approvalStage.stageName}`);
			},
		},
		// Approval and routing
		{
			time: 8000,
			action: () => {
				setNodeState(approvalStage.nodeId, "processing", "In progress");
				setNodeProgress(approvalStage.nodeId, 50);
				addLog("10:04:07", approvalStage.stageName, "route_approval => Risk: HIGH");
			},
		},
		{
			time: 8500,
			action: () => {
				setNodeProgress(approvalStage.nodeId, 100);
				addToolCall(approvalStage.toolsId, "escalate_to_human => HITL required");
				addLog("10:04:07", approvalStage.stageName, "escalate_to_human => AWAITING HUMAN REVIEW");
			},
		},
		{
			time: 9000,
			action: () => {
				setNodeState(approvalStage.nodeId, "hitl", "Awaiting review");
				document.getElementById("hitl-panel").classList.add("visible");
				addLog("10:04:07", "System", `--- PAUSED: ${approvalStage.stageName} awaiting human review ---`);
				dropArea.textContent = `Pipeline paused - ${approvalStage.stageName} requires review`;
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
	if (!node) return;
	node.className = `workflow-node ${state}`;
	const statusEl = node.querySelector(".workflow-node-status");
	if (statusEl) {
		statusEl.textContent = statusText;
	}
}

function setNodeProgress(nodeId, pct) {
	const node = document.getElementById(nodeId);
	if (!node) return;
	const fill = node.querySelector(".progress-fill");
	if (!fill) return;
	fill.style.width = `${pct}%`;
}

function addToolCall(containerId, text) {
	const container = document.getElementById(containerId);
	if (!container) return;
	const div = document.createElement("div");
	div.className = "workflow-tool-call";
	div.textContent = `- ${text}`;
	div.style.animation = "viewFadeIn 0.2s ease";
	container.appendChild(div);
}

function addLog(time, agent, message) {
	const log = document.getElementById("activity-log");
	if (!log) return;
	const entry = document.createElement("div");
	entry.className = "log-entry";
	entry.innerHTML = `<span class="log-time">${escapeHtmlApp(time)}</span><span class="log-agent">${escapeHtmlApp(agent)}</span><span class="log-message">${escapeHtmlApp(message)}</span>`;
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
	const approvalStage = getLiveStageContextForRole("approval");
	setNodeState(
		approvalStage.nodeId,
		decision === "approved" ? "complete" : decision === "rejected" ? "warning" : "warning",
		result.text,
	);

	addLog("10:04:52", getHumanReviewLogLabel(), result.log);
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

document.addEventListener("DOMContentLoaded", () => {
	refreshActiveWorkflowFromGateway();
	syncMonitorTab();
});

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
