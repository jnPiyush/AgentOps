/* ============================================================
   Contract AgentOps Dashboard - Interactions & Mock Data
   Handles tab navigation, animations, and simulated workflows
   ============================================================ */

// --- Tab Navigation ---
document.addEventListener("DOMContentLoaded", () => {
	var tabs = document.querySelectorAll(".tab");
	var dots = document.querySelectorAll(".stage-dot");
	var visitedStages = new Set([0]);

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
		var viewNames = ["design", "build", "deploy", "live", "monitor", "evaluate", "drift", "feedback"];
		// Update tabs
		tabs.forEach((t, i) => {
			t.classList.toggle("active", i === index);
			t.setAttribute("aria-selected", i === index ? "true" : "false");
			t.setAttribute("tabindex", i === index ? "0" : "-1");
		});
		// Update views
		var views = document.querySelectorAll(".view");
		views.forEach((v) => {
			v.classList.remove("active");
		});
		var target = document.getElementById("view-" + viewNames[index]);
		if (target) {
			target.classList.add("active");
		}
		// Update stage dots
		visitedStages.add(index);
		dots.forEach((d, i) => {
			d.classList.toggle("active", i === index);
			d.classList.toggle("completed", visitedStages.has(i) && i !== index);
		});
	}
});

// --- View 1: Design Canvas ---
function toggleAgentDetail(card) {
	var expanded = card.getAttribute("data-expanded") === "true";
	if (expanded) {
		card.style.transform = "";
		card.removeAttribute("data-expanded");
	} else {
		card.style.transform = "scale(1.05)";
		card.setAttribute("data-expanded", "true");
	}
}

function resetLayout() {
	document.querySelectorAll(".agent-card").forEach((c) => {
		c.style.transform = "";
		c.removeAttribute("data-expanded");
	});
}

// --- View 2: Build Console ---
var toolOutputs = {
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
	extract_dates: {
		output:
			'{\n  "dates": [\n    {\n      "type": "effective_date",\n      "value": "2026-03-01",\n      "source": "Preamble"\n    },\n    {\n      "type": "term_end",\n      "value": "2028-03-01",\n      "source": "Section 7.1"\n    }\n  ],\n  "confidence": 0.92\n}',
		latency: "0.6s",
		tokens: "180 in / 120 out",
	},
};

var mcpTools = {
	"contract-extraction-mcp": ["extract_clauses", "identify_parties", "extract_dates"],
	"contract-intake-mcp": ["upload_contract", "classify_doc", "extract_meta"],
	"contract-compliance-mcp": ["check_policy", "flag_risk", "get_rules"],
	"contract-approval-mcp": ["route_approval", "escalate_to_human", "notify"],
};

function updateToolList() {
	var server = document.getElementById("mcp-server-select").value;
	var toolSelect = document.getElementById("tool-select");
	var tools = mcpTools[server] || [];
	toolSelect.innerHTML = "";
	tools.forEach((t) => {
		var opt = document.createElement("option");
		opt.textContent = t;
		opt.value = t;
		toolSelect.appendChild(opt);
	});
}

function runTool() {
	var tool = document.getElementById("tool-select").value;
	var outputEl = document.getElementById("console-output");
	var statsEl = document.getElementById("console-stats");

	outputEl.textContent = "// Running " + tool + "...";
	outputEl.style.color = "var(--color-accent)";

	var data = toolOutputs[tool];
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
	var stages = [
		{ id: "stage-build", time: "12s" },
		{ id: "stage-test", time: "8s" },
		{ id: "stage-deploy", time: "15s" },
		{ id: "stage-register", time: "3s" },
	];

	var btn = document.getElementById("deploy-btn");
	btn.disabled = true;
	btn.textContent = "Deploying...";

	var agents = [
		{ name: "Intake Agent", id: "agt-7f3a-intake-001" },
		{ name: "Extraction Agent", id: "agt-7f3a-extract-002" },
		{ name: "Compliance Agent", id: "agt-7f3a-comply-003" },
		{ name: "Approval Agent", id: "agt-7f3a-approve-004" },
	];

	stages.forEach((stage, i) => {
		setTimeout(
			() => {
				var el = document.getElementById(stage.id);
				el.classList.add("completed");
				el.querySelector(".deploy-stage-status").innerHTML = '<span class="badge badge-pass">[PASS]</span>';
				el.querySelector(".deploy-stage-time").textContent = stage.time;

				if (i === stages.length - 1) {
					btn.textContent = "Deployed";
					var tbody = document.getElementById("agent-registry-body");
					tbody.innerHTML = "";
					agents.forEach((agent, j) => {
						setTimeout(() => {
							var row = document.createElement("tr");
							row.style.animation = "viewFadeIn 0.3s ease";
							row.innerHTML =
								"<td>" +
								agent.name +
								'</td><td style="font-family:var(--font-mono);font-size:12px">' +
								agent.id +
								'</td><td><span class="badge badge-pass">Registered</span></td><td>Contracts</td>';
							tbody.appendChild(row);
						}, j * 200);
					});
				}
			},
			(i + 1) * 700,
		);
	});
}

// --- View 4: Live Workflow ---
var workflowRunning = false;

function startWorkflow() {
	if (workflowRunning) return;
	workflowRunning = true;

	var dropArea = document.getElementById("drop-area");
	dropArea.textContent = "Processing NDA.pdf...";
	dropArea.style.borderColor = "var(--color-accent)";
	dropArea.style.color = "var(--color-accent)";

	var log = document.getElementById("activity-log");
	log.innerHTML = "";

	document.getElementById("contract-details").style.display = "flex";

	var timeline = [
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
				addToolCall("wf-intake-tools", 'classify_doc => "NDA" (0.97)');
				addLog("10:04:01", "Intake Agent", "classify_doc => NDA (0.97)");
				document.getElementById("cd-type").textContent = "NDA";
			},
		},
		{
			time: 1800,
			action: () => {
				setNodeProgress("wf-intake", 100);
				addToolCall("wf-intake-tools", "extract_meta => {parties: 2, pages: 4}");
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
				addToolCall("wf-extraction-tools", "extract_dates => effective: 2026-03-01");
				addLog("10:04:05", "Extraction Agent", "extract_dates => 2 dates");
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
	var node = document.getElementById(nodeId);
	node.className = "workflow-node " + state;
	node.querySelector(".workflow-node-status").textContent = statusText;
}

function setNodeProgress(nodeId, pct) {
	var node = document.getElementById(nodeId);
	var fill = node.querySelector(".progress-fill");
	fill.style.width = pct + "%";
}

function addToolCall(containerId, text) {
	var container = document.getElementById(containerId);
	var div = document.createElement("div");
	div.className = "workflow-tool-call";
	div.textContent = "- " + text;
	div.style.animation = "viewFadeIn 0.2s ease";
	container.appendChild(div);
}

function addLog(time, agent, message) {
	var log = document.getElementById("activity-log");
	var entry = document.createElement("div");
	entry.className = "log-entry";
	entry.innerHTML =
		'<span class="log-time">' +
		time +
		'</span><span class="log-agent">' +
		agent +
		'</span><span class="log-message">' +
		message +
		"</span>";
	log.appendChild(entry);
	log.scrollTop = log.scrollHeight;
}

function resolveHitl(decision) {
	var panel = document.getElementById("hitl-panel");
	panel.classList.remove("visible");

	var statusMap = {
		approved: { text: "Approved", badge: "pass", log: "Approved with comment" },
		rejected: { text: "Rejected", badge: "fail", log: "Rejected" },
		changes: {
			text: "Changes Requested",
			badge: "warn",
			log: "Requested changes",
		},
	};

	var result = statusMap[decision];
	setNodeState(
		"wf-approval",
		decision === "approved" ? "complete" : decision === "rejected" ? "warning" : "warning",
		result.text,
	);

	addLog("10:04:52", "Human", result.log);
	addLog(
		"10:04:52",
		"System",
		"--- Pipeline " + (decision === "approved" ? "COMPLETE" : "STOPPED: " + result.text) + " ---",
	);

	var dropArea = document.getElementById("drop-area");
	dropArea.textContent = "Pipeline complete - " + result.text;
	dropArea.style.borderColor = decision === "approved" ? "var(--color-pass)" : "var(--color-warn)";
	dropArea.style.color = decision === "approved" ? "var(--color-pass)" : "var(--color-warn)";

	workflowRunning = false;
}

// --- View 5: Monitor - Trace toggle ---
function toggleTrace(header) {
	var tools = header.parentElement.querySelector(".trace-tools");
	var toggle = header.querySelector(".trace-toggle");
	if (tools.style.display === "none") {
		tools.style.display = "block";
		toggle.textContent = "[-]";
	} else {
		tools.style.display = "none";
		toggle.textContent = "[+]";
	}
}

// --- View 6: Evaluation Lab ---
function runEvalSuite() {
	var btn = document.getElementById("run-suite-btn");
	btn.disabled = true;
	btn.textContent = "Running...";

	// Ground-truth metrics
	var metrics = [
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
	var judgeMetrics = [
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
				var el = document.getElementById(m.id);
				el.textContent = m.value;
				el.parentElement.style.animation = "scaleIn 0.3s ease";

				if (m.bId) {
					document.getElementById(m.bId).textContent = m.baseline;
					var deltaEl = document.getElementById(m.dId);
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
	var judgeDelay = (metrics.length + 1) * 300;
	judgeMetrics.forEach((j, i) => {
		setTimeout(
			() => {
				var el = document.getElementById(j.id);
				el.textContent = j.value;
				el.parentElement.style.animation = "scaleIn 0.3s ease";
				// Color the score based on value
				var score = Number.parseFloat(j.value);
				if (score >= 4.0) {
					el.style.color = "var(--color-pass)";
				} else if (score >= 3.0) {
					el.style.color = "var(--color-warn)";
				} else {
					el.style.color = "var(--color-fail)";
				}

				if (j.bId) {
					document.getElementById(j.bId).textContent = j.baseline;
					var deltaEl = document.getElementById(j.dId);
					deltaEl.textContent = j.bdelta;
					deltaEl.classList.add("positive");
				}
			},
			judgeDelay + (i + 1) * 200,
		);
	});

	var totalDelay = judgeDelay + (judgeMetrics.length + 1) * 200 + 200;
	setTimeout(() => {
		document.getElementById("eval-overall").textContent = "Overall: 39/57 passed (68.4%) | Judge Avg: 4.2/5";
		document.getElementById("eval-last-run").textContent = "Just now";
		var gate = document.getElementById("quality-gate");
		gate.style.animation = "scaleIn 0.3s ease";
		gate.classList.add("animate-pulse-green");
		btn.textContent = "Run Suite";
		btn.disabled = false;
	}, totalDelay);
}

// --- View 7: Model Swap ---
function simulateModelSwap() {
	var btn = document.getElementById("swap-btn");
	btn.disabled = true;
	btn.textContent = "Simulating...";

	setTimeout(() => {
		document.getElementById("cand-accuracy").textContent = "88.1%";
		document.getElementById("cand-latency").textContent = "1.1s";
		document.getElementById("cand-cost").textContent = "$0.024";
	}, 600);

	setTimeout(() => {
		var verdict = document.getElementById("verdict-card");
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
	var btn = document.getElementById("optimize-btn");
	btn.disabled = true;
	btn.textContent = "Converting...";

	setTimeout(() => {
		btn.textContent = "5 test cases created";
		btn.classList.remove("btn-primary");
		btn.classList.add("btn-outline");
	}, 1000);
}

function savePrompt() {
	var editor = document.getElementById("prompt-editor");
	editor.style.borderColor = "var(--color-pass)";
	setTimeout(() => {
		editor.style.borderColor = "#3A3A3A";
	}, 1500);
}

function reEvaluate() {
	var btn = document.getElementById("re-eval-btn");
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
	var btn = document.getElementById("deploy-v14-btn");
	btn.disabled = true;
	btn.textContent = "Deploying...";

	setTimeout(() => {
		btn.textContent = "v1.4 Deployed";
		btn.classList.remove("btn-success");
		btn.classList.add("btn-outline");
	}, 1000);
}
