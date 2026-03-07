/* ============================================================
   Contract AgentOps Dashboard - API Integration Layer
   Handles Simulated/Real mode switching and gateway API calls
   ============================================================ */

const GATEWAY_URL = "http://localhost:8000";
window.GATEWAY_URL = GATEWAY_URL;
let dashboardMode = "simulated"; // 'simulated' | 'real'
let ws = null; // WebSocket connection for live workflow
let currentContractId = null; // Track the active contract ID for HITL

// --- Mode Toggle ---
function setMode(mode) {
	dashboardMode = mode;
	const btns = document.querySelectorAll(".mode-btn");
	btns.forEach((btn) => {
		btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
	});
	document.getElementById("mode-status-item").textContent = `Mode: ${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;

	if (mode === "real") {
		apiCall("POST", "/api/v1/mode", { mode: "live" })
			.then(() => {
				checkGatewayHealth();
				loadToolListReal();
				loadMonitorContractListReal();
			})
			.catch(() => {
				checkGatewayHealth();
				loadToolListReal();
				loadMonitorContractListReal();
			});
	} else {
		apiCall("POST", "/api/v1/mode", { mode: "simulated" }).catch(() => {});
		const dot = document.getElementById("mcp-status-dot");
		dot.className = "status-dot";
		document.getElementById("mcp-status-text").textContent = "MCP Status: 8/8 [PASS]";
	}
}

// --- Health Check ---
function checkGatewayHealth() {
	const dot = document.getElementById("mcp-status-dot");
	const text = document.getElementById("mcp-status-text");

	fetch(`${GATEWAY_URL}/api/v1/health`, { signal: AbortSignal.timeout(3000) })
		.then((res) => res.json())
		.then((data) => {
			const servers = data.servers || {};
			const online = Object.values(servers).filter((s) => s === "online").length;
			const total = Object.keys(servers).length || 8;
			dot.className = `status-dot ${online === total ? "connected" : "disconnected"}`;
			text.textContent = `MCP Status: ${online}/${total}${online === total ? " [PASS]" : " [WARN]"}`;
		})
		.catch(() => {
			dot.className = "status-dot disconnected";
			text.textContent = "MCP Status: Gateway offline";
		});
}

// --- API Helper ---
function apiCall(method, path, body) {
	const opts = {
		method: method,
		headers: { "Content-Type": "application/json" },
		signal: AbortSignal.timeout(15000),
	};
	if (body) {
		opts.body = JSON.stringify(body);
	}
	return fetch(GATEWAY_URL + path, opts).then((res) => {
		if (!res.ok) {
			return res.json().then((err) => {
				throw new Error(err.message || err.error || `API error ${res.status}`);
			});
		}
		return res.json();
	});
}

// --- Real Mode: Build Console ---
function runToolReal(server, tool) {
	const outputEl = document.getElementById("console-output");
	const statsEl = document.getElementById("console-stats");
	const inputText = document.getElementById("console-input").textContent;

	outputEl.textContent = `// Calling ${server}/${tool} via gateway...`;
	outputEl.style.color = "var(--color-accent)";

	let input = {};
	try {
		input = JSON.parse(inputText);
	} catch (_e) {
		input = { text: inputText };
	}

	const startTime = Date.now();
	apiCall("POST", `/api/v1/tools/${server}/${tool}`, { input: input })
		.then((data) => {
			const elapsed = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
			outputEl.textContent = JSON.stringify(data.output || data.result || data, null, 2);
			outputEl.style.color = "var(--color-text-secondary)";
			statsEl.style.display = "flex";
			document.getElementById("stat-latency").textContent = data.latency_ms
				? `${(data.latency_ms / 1000).toFixed(1)}s`
				: elapsed;
			document.getElementById("stat-tokens").textContent =
				`${data.tokens_in || "--"} in / ${data.tokens_out || "--"} out`;
			document.getElementById("stat-status").innerHTML = '<span class="badge badge-pass">[PASS] Success</span>';
		})
		.catch((err) => {
			outputEl.textContent = `// Error: ${err.message}`;
			outputEl.style.color = "var(--color-fail)";
			statsEl.style.display = "flex";
			document.getElementById("stat-status").innerHTML = '<span class="badge badge-fail">[FAIL] Error</span>';
		});
}

// --- Real Mode: Deploy Pipeline ---
function runDeployPipelineReal() {
	const btn = document.getElementById("deploy-btn");
	btn.disabled = true;
	btn.textContent = "Deploying...";

	const stages = ["stage-build", "stage-test", "stage-deploy", "stage-register"];

	apiCall("POST", "/api/v1/deploy/pipeline")
		.then((data) => {
			// Animate stages with real data
			const pipelineStages = data.stages || [];
			stages.forEach((stageId, i) => {
				const el = document.getElementById(stageId);
				const stageData = pipelineStages[i] || {};
				setTimeout(
					() => {
						el.classList.add("completed");
						const passed =
							stageData.status === "passed" || stageData.status === "completed" || stageData.status === "registered";
						el.querySelector(".deploy-stage-status").innerHTML =
							`<span class="badge badge-${passed ? "pass" : "fail"}">[${passed ? "PASS" : "FAIL"}]</span>`;
						el.querySelector(".deploy-stage-time").textContent =
							typeof stageData.duration_ms === "number" ? `${stageData.duration_ms}ms` : "--";
					},
					(i + 1) * 400,
				);
			});

			// Populate agent registry from real data
			const agentDelay = (stages.length + 1) * 400;
			setTimeout(() => {
				const tbody = document.getElementById("agent-registry-body");
				tbody.innerHTML = "";
				const agents = data.agents || [];
				agents.forEach((agent, j) => {
					setTimeout(() => {
						const row = document.createElement("tr");
						row.style.animation = "viewFadeIn 0.3s ease";
						const statusBadge = agent.status === "registered" ? "pass" : "fail";
						row.innerHTML = `<td>${agent.agent_name}</td><td style="font-family:var(--font-mono);font-size:12px">${agent.foundry_agent_id || "--"}</td><td><span class="badge badge-${statusBadge}">${agent.status}</span></td><td>Contracts</td>`;
						tbody.appendChild(row);
					}, j * 200);
				});
				const summary = document.getElementById("deploy-summary");
				if (summary && data.summary) {
					summary.textContent = `${data.summary.agents_deployed} agents deployed, ${data.summary.tools_registered} tools registered`;
					summary.style.color = "var(--color-text-secondary)";
				}
				btn.textContent = "Deployed";
			}, agentDelay);
		})
		.catch((err) => {
			btn.textContent = "Deploy Failed";
			btn.disabled = false;
			const summary = document.getElementById("deploy-summary");
			summary.textContent = `Error: ${err.message}`;
			summary.style.color = "var(--color-fail)";
		});
}

// --- Real Mode: Live Workflow (WebSocket) ---
function startWorkflowReal() {
	const dropArea = document.getElementById("drop-area");
	dropArea.textContent = "Processing via gateway...";
	dropArea.style.borderColor = "var(--color-accent)";
	dropArea.style.color = "var(--color-accent)";

	const log = document.getElementById("activity-log");
	log.innerHTML = "";
	document.getElementById("contract-details").style.display = "flex";

	// Get contract text from the drop area or use default sample
	const dropAreaEl = document.getElementById("drop-area");
	const contractText = dropAreaEl?.dataset.contractText
		? dropAreaEl.dataset.contractText
		: "This Non-Disclosure Agreement is entered into between Acme Corp and Beta Inc effective March 1, 2026. Recipient shall not disclose any Confidential Information for a period of 2 years. Liability cap: $2,500,000.";

	// Submit contract to gateway
	addLog(new Date().toLocaleTimeString(), "System", "Submitting contract to gateway...");

	apiCall("POST", "/api/v1/contracts", {
		text: contractText,
		filename: "NDA.pdf",
	})
		.then((data) => {
			currentContractId = data.contract_id;
			addLog(new Date().toLocaleTimeString(), "System", `Contract submitted: ${data.contract_id}`);
			// Connect WebSocket for real-time updates
			connectWorkflowWs(data.contract_id);
		})
		.catch((err) => {
			addLog(new Date().toLocaleTimeString(), "System", `Error: ${err.message}`);
			dropArea.textContent = `Error - ${err.message}`;
			dropArea.style.borderColor = "var(--color-fail)";
			dropArea.style.color = "var(--color-fail)";
			workflowRunning = false;
		});
}

function connectWorkflowWs(contractId) {
	if (ws) {
		try {
			ws.close();
		} catch (_e) {
			/* ignore */
		}
	}

	const wsUrl = `${GATEWAY_URL.replace("http", "ws")}/ws/workflow`;
	ws = new WebSocket(wsUrl);

	ws.onopen = () => {
		addLog(new Date().toLocaleTimeString(), "System", "WebSocket connected - streaming events");
	};

	ws.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);
			handleWorkflowEvent(msg);
		} catch (_e) {
			// non-JSON message
		}
	};

	ws.onclose = () => {
		addLog(new Date().toLocaleTimeString(), "System", "WebSocket disconnected");
	};

	ws.onerror = () => {
		addLog(new Date().toLocaleTimeString(), "System", "WebSocket error - falling back to polling");
		// Fallback: just let the simulated workflow run
		workflowRunning = false;
	};
}

function handleWorkflowEvent(msg) {
	const event = msg.event || msg.type || "";
	const agentName = msg.agent || "";
	const status = msg.status || "";
	const time = new Date().toLocaleTimeString();

	// Map agent names to workflow node IDs
	const agentNodeMap = {
		intake: "wf-intake",
		extraction: "wf-extraction",
		compliance: "wf-compliance",
		approval: "wf-approval",
	};

	const nodeId = agentNodeMap[agentName.toLowerCase()] || "";

	if (event === "pipeline_status" && status === "processing_started") {
		addLog(time, "System", "Pipeline started");
	} else if (event === "agent_step_complete") {
		if (nodeId) {
			setNodeState(nodeId, "complete", "Complete");
			setNodeProgress(nodeId, 100);
		}
		addLog(time, agentName, `[PASS] ${status.replace(/_/g, " ")}`);

		// Update contract details from result
		if (msg.result) {
			if (msg.result.type) document.getElementById("cd-type").textContent = msg.result.type;
			if (msg.result.parties) document.getElementById("cd-parties").textContent = msg.result.parties;
			if (msg.result.pages) document.getElementById("cd-pages").textContent = msg.result.pages;
			const risk = msg.result.overallRisk || msg.result.overall_risk || msg.result.risk;
			if (risk) {
				const normalizedRisk = risk.toString().toUpperCase();
				const riskBadge =
					normalizedRisk === "HIGH" || normalizedRisk === "CRITICAL"
						? "fail"
						: normalizedRisk === "MEDIUM"
							? "warn"
							: "pass";
				document.getElementById("cd-risk").innerHTML =
					`<span class="badge badge-${riskBadge}">${normalizedRisk}</span>`;
			}
		}
	} else if (event === "pipeline_status" && status === "awaiting_human_review") {
		if (nodeId) setNodeState(nodeId, "hitl", "Awaiting Human");
		document.getElementById("hitl-panel").classList.add("visible");
		addLog(time, "System", "--- PAUSED: Awaiting human review ---");
		const dropArea = document.getElementById("drop-area");
		dropArea.textContent = "Pipeline paused - Human review required";
		dropArea.style.borderColor = "var(--color-approval)";
		dropArea.style.color = "var(--color-approval)";
	} else if (
		event === "pipeline_status" &&
		(status === "pipeline_complete" || status === "approved" || status === "rejected")
	) {
		addLog(time, "System", "--- Pipeline COMPLETE ---");
		const dropArea2 = document.getElementById("drop-area");
		dropArea2.textContent = "Pipeline complete";
		dropArea2.style.borderColor = "var(--color-pass)";
		dropArea2.style.color = "var(--color-pass)";
		workflowRunning = false;
	} else if (event === "pipeline_status" && status === "pipeline_failed") {
		addLog(time, "System", "Pipeline failed");
		workflowRunning = false;
	} else if (event === "error") {
		addLog(time, "System", `Error: ${msg.result ? msg.result.error : "Unknown"}`);
		workflowRunning = false;
	}
}

// --- Real Mode: HITL Review ---
function resolveHitlReal(decision) {
	const panel = document.getElementById("hitl-panel");
	panel.classList.remove("visible");

	const comment = document.querySelector(".hitl-comment").value || "";

	// If we have a contract ID from the WebSocket, submit review
	if (currentContractId) {
		apiCall("POST", `/api/v1/contracts/${currentContractId}/review`, {
			decision: decision === "approved" ? "approve" : decision === "rejected" ? "reject" : "request_changes",
			reviewer: "demo-user",
			comment: comment,
		}).catch(() => {
			// Non-critical - the UI already shows the result
		});
	}

	// Update UI same as simulated
	const statusMap = {
		approved: { text: "Approved", log: "Approved" },
		rejected: { text: "Rejected", log: "Rejected" },
		changes: { text: "Changes Requested", log: "Requested changes" },
	};
	const result = statusMap[decision];
	setNodeState("wf-approval", decision === "approved" ? "complete" : "warning", result.text);
	addLog(new Date().toLocaleTimeString(), "Human", result.log);
	addLog(
		new Date().toLocaleTimeString(),
		"System",
		`--- Pipeline ${decision === "approved" ? "COMPLETE" : `STOPPED: ${result.text}`} ---`,
	);

	const dropArea = document.getElementById("drop-area");
	dropArea.textContent = `Pipeline complete - ${result.text}`;
	dropArea.style.borderColor = decision === "approved" ? "var(--color-pass)" : "var(--color-warn)";
	dropArea.style.color = decision === "approved" ? "var(--color-pass)" : "var(--color-warn)";
	workflowRunning = false;
}

// --- Real Mode: Evaluation ---
function runEvalSuiteReal() {
	const btn = document.getElementById("run-suite-btn");
	btn.disabled = true;
	btn.textContent = "Running...";

	apiCall("POST", "/api/v1/evaluations/run", { version: "v1.3" })
		.then((data) => {
			// Populate ground-truth metrics
			const pm = data.per_metric || {};
			setMetricAnimated("m-extraction", `${pm.extraction_accuracy || "--"}%`, 300);
			setMetricAnimated("m-compliance", `${pm.compliance_accuracy || "--"}%`, 600);
			setMetricAnimated("m-classification", `${pm.classification_accuracy || "--"}%`, 900);
			setMetricAnimated("m-false-flags", `${pm.false_flag_rate || "--"}%`, 1200);
			setMetricAnimated("m-latency", `${pm.latency_p95_s || "--"}s`, 1500);

			// Judge scores
			const js = data.judge_scores || {};
			setTimeout(() => {
				setJudgeMetric("j-relevance", js.relevance);
			}, 1800);
			setTimeout(() => {
				setJudgeMetric("j-groundedness", js.groundedness);
			}, 2000);
			setTimeout(() => {
				setJudgeMetric("j-coherence", js.coherence);
			}, 2200);

			// Overall + quality gate
			setTimeout(() => {
				document.getElementById("eval-overall").textContent =
					`Overall: ${data.passed}/${data.total_cases} passed (${data.accuracy}%)`;
				document.getElementById("eval-last-run").textContent = "Just now";
				const gate = document.getElementById("quality-gate");
				gate.className = `quality-gate ${data.quality_gate === "PASS" ? "pass" : "fail"}`;
				gate.querySelector(".quality-gate-status").textContent = `[${data.quality_gate}]`;
				gate.querySelector(".quality-gate-text").textContent =
					data.quality_gate === "PASS" ? "READY TO DEPLOY" : "NOT READY";
				gate.style.animation = "scaleIn 0.3s ease";
				btn.textContent = "Run Suite";
				btn.disabled = false;
			}, 2500);

			// Fetch baseline comparison
			return apiCall("GET", "/api/v1/evaluations/baseline");
		})
		.then((baseline) => {
			if (baseline?.delta) {
				setBaselineDelta(
					"b-extraction",
					`${baseline.current.per_metric.extraction_accuracy || "--"}%`,
					"d-extraction",
					baseline.delta.accuracy > 0 ? `+${baseline.delta.accuracy}%` : `${baseline.delta.accuracy}%`,
				);
				setBaselineDelta(
					"b-compliance",
					`${baseline.current.per_metric.compliance_accuracy || "--"}%`,
					"d-compliance",
					baseline.delta.accuracy > 0 ? `+${baseline.delta.accuracy}%` : `${baseline.delta.accuracy}%`,
				);
			}
		})
		.catch((err) => {
			btn.textContent = `Error: ${err.message}`;
			btn.disabled = false;
		});
}

function setMetricAnimated(id, value, delay) {
	setTimeout(() => {
		const el = document.getElementById(id);
		el.textContent = value;
		el.parentElement.style.animation = "scaleIn 0.3s ease";
	}, delay);
}

function setJudgeMetric(id, value) {
	const el = document.getElementById(id);
	if (value === undefined || value === null) {
		el.textContent = "--";
		return;
	}
	el.textContent = `${value.toFixed(1)} / 5`;
	el.style.color = value >= 4.0 ? "var(--color-pass)" : value >= 3.0 ? "var(--color-warn)" : "var(--color-fail)";
	el.parentElement.style.animation = "scaleIn 0.3s ease";
}

function setBaselineDelta(baseId, baseValue, deltaId, deltaValue) {
	const bEl = document.getElementById(baseId);
	const dEl = document.getElementById(deltaId);
	if (bEl) bEl.textContent = baseValue;
	if (dEl) {
		dEl.textContent = deltaValue;
		dEl.classList.add(deltaValue.charAt(0) === "+" ? "positive" : "negative");
	}
}

// --- Real Mode: Drift ---
function simulateModelSwapReal() {
	const btn = document.getElementById("swap-btn");
	btn.disabled = true;
	btn.textContent = "Simulating...";

	apiCall("POST", "/api/v1/drift/model-swap")
		.then((data) => {
			const candidate = data.gpt4o_mini || data.candidate || data;
			setTimeout(() => {
				document.getElementById("cand-accuracy").textContent =
					candidate.accuracy !== undefined ? `${Math.round(candidate.accuracy * 100)}%` : "--";
				document.getElementById("cand-latency").textContent =
					candidate.latency_ms !== undefined ? `${(candidate.latency_ms / 1000).toFixed(2)}s` : "--";
				document.getElementById("cand-cost").textContent =
					candidate.cost_per_contract !== undefined ? `$${candidate.cost_per_contract.toFixed(3)}` : "--";
			}, 400);

			setTimeout(() => {
				const verdict = document.getElementById("verdict-card");
				verdict.style.opacity = "1";
				verdict.style.animation = "scaleIn 0.3s ease";
				const comparison = data.comparison || {};
				const accuracyDelta =
					comparison.accuracy_delta !== undefined ? `${(comparison.accuracy_delta * 100).toFixed(1)}%` : "--";
				const costDelta = comparison.cost_delta !== undefined ? `${(comparison.cost_delta * 100).toFixed(1)}%` : "--";
				const latencyDelta =
					comparison.latency_delta !== undefined ? `${(comparison.latency_delta * 100).toFixed(1)}%` : "--";
				document.getElementById("verdict-title").textContent =
					comparison.accuracy_delta !== undefined && comparison.accuracy_delta > -0.05 ? "ACCEPTABLE" : "DEGRADED";
				document.getElementById("v-accuracy").textContent = accuracyDelta;
				document.getElementById("v-cost").textContent = costDelta;
				document.getElementById("v-latency").textContent = latencyDelta;
				btn.textContent = "Simulate Swap";
				btn.disabled = false;
			}, 900);
		})
		.catch((err) => {
			btn.textContent = "Error";
			btn.disabled = false;
			console.error("Model swap error:", err);
		});
}

// --- Real Mode: Feedback ---
function optimizeFeedbackReal() {
	const btn = document.getElementById("optimize-btn");
	btn.disabled = true;
	btn.textContent = "Converting...";

	apiCall("POST", "/api/v1/feedback/optimize")
		.then((data) => {
			btn.textContent = `${data.test_cases_created} test cases created`;
			btn.classList.remove("btn-primary");
			btn.classList.add("btn-outline");
		})
		.catch((err) => {
			btn.textContent = `Error: ${err.message}`;
			btn.disabled = false;
		});
}

function savePromptReal() {
	const editor = document.getElementById("prompt-editor");
	const promptText = editor.value;

	apiCall("POST", "/api/v1/prompts/extraction", { prompt: promptText })
		.then(() => {
			editor.style.borderColor = "var(--color-pass)";
			setTimeout(() => {
				editor.style.borderColor = "#3A3A3A";
			}, 1500);
		})
		.catch(() => {
			editor.style.borderColor = "var(--color-fail)";
			setTimeout(() => {
				editor.style.borderColor = "#3A3A3A";
			}, 1500);
		});
}

function reEvaluateReal() {
	const btn = document.getElementById("re-eval-btn");
	btn.disabled = true;
	btn.textContent = "Evaluating...";

	apiCall("POST", "/api/v1/evaluations/run", { version: "v1.4" })
		.then((data) => {
			document.getElementById("re-eval-results").style.display = "grid";
			document.getElementById("re-eval-results").style.animation = "viewFadeIn 0.3s ease";

			// Show before/after comparison
			const beforeEl = document.querySelector("#re-eval-results .re-eval-value");
			const afterEl = document.querySelectorAll("#re-eval-results .re-eval-value")[1];
			const deltaEl = document.querySelector("#re-eval-results .re-eval-delta");
			if (afterEl) afterEl.textContent = `${data.accuracy}%`;
			if (deltaEl) deltaEl.textContent = `+${(data.accuracy - 85.0).toFixed(1)}%`;

			document.getElementById("re-eval-gate").style.display = "block";
			document.getElementById("re-eval-gate").style.animation = "scaleIn 0.3s ease";

			const gate = document.querySelector("#re-eval-gate .quality-gate");
			gate.className = `quality-gate ${data.quality_gate === "PASS" ? "pass" : "fail"}`;
			gate.querySelector(".quality-gate-status").textContent = `[${data.quality_gate}]`;

			btn.textContent = "Re-Evaluate";
			btn.disabled = false;
		})
		.catch((err) => {
			btn.textContent = "Error";
			btn.disabled = false;
			console.error("Re-eval error:", err);
		});
}

// --- Real Mode: Build Console Tool List ---
function loadToolListReal() {
	apiCall("GET", "/api/v1/tools")
		.then((servers) => {
			// Update server dropdown with real data
			const serverSelect = document.getElementById("mcp-server-select");
			serverSelect.innerHTML = "";
			servers.forEach((server) => {
				const opt = document.createElement("option");
				opt.value = server.name;
				opt.textContent = server.name + (server.status === "online" ? "" : " (offline)");
				serverSelect.appendChild(opt);
			});

			// Build real tool map
			window.realMcpTools = {};
			servers.forEach((server) => {
				window.realMcpTools[server.name] = server.tools.map((t) => t.name);
			});

			// Update tool dropdown for first server
			updateToolList();
		})
		.catch(() => {
			// Keep default simulated tool list on error
		});
}

// --- Real Mode: Monitor Panel ---
function loadMonitorReal(contractId) {
	if (!contractId) {
		// Load contract list first to find available contracts
		loadMonitorContractListReal();
		return;
	}

	apiCall("GET", `/api/v1/monitor/${encodeURIComponent(contractId)}`)
		.then((data) => {
			renderMonitorData(data);
		})
		.catch((err) => {
			console.error("Monitor load error:", err);
		});
}

function loadMonitorContractListReal() {
	apiCall("GET", "/api/v1/monitor")
		.then((contracts) => {
			const select = document.getElementById("monitor-contract-select");
			if (!select) return;
			select.innerHTML = "";
			if (contracts.length === 0) {
				const opt = document.createElement("option");
				opt.textContent = "No contracts processed yet";
				opt.value = "";
				select.appendChild(opt);
				return;
			}
			contracts.forEach((c) => {
				const opt = document.createElement("option");
				opt.value = c.contract_id;
				opt.textContent = `${c.filename || c.contract_id} (${c.status})`;
				select.appendChild(opt);
			});
			// Auto-load the first contract
			if (contracts.length > 0) {
				loadMonitorReal(contracts[0].contract_id);
			}
		})
		.catch(() => {
			// Keep static content on error
		});
}

function renderMonitorData(data) {
	if (!data || !data.agents) return;

	const agentColors = {
		intake: "var(--color-intake)",
		extraction: "var(--color-extraction)",
		compliance: "var(--color-compliance)",
		approval: "var(--color-approval)",
	};

	// Update Trace Tree
	const traceTree = document.querySelector(".trace-tree");
	if (traceTree) {
		traceTree.innerHTML = "";
		data.agents.forEach((agent) => {
			const latencySec = (agent.latency_ms / 1000).toFixed(1);
			const div = document.createElement("div");
			div.className = "trace-agent";
			div.innerHTML = `<div class="trace-agent-header" onclick="toggleTrace(this)"><span class="trace-toggle">[-]</span><span class="trace-agent-name" style="color:${agentColors[agent.agent] || "var(--color-text)"}">${agent.agent.charAt(0).toUpperCase()}${agent.agent.slice(1)}</span><span class="trace-agent-time">${latencySec}s</span></div><div class="trace-tools"><div class="trace-tool"><span class="trace-tool-time">${latencySec}s</span> ${agent.agent} <span class="badge badge-pass">[PASS]</span></div><div class="trace-tool" style="font-size:11px;color:var(--color-text-tertiary)">${agent.tokens_in.toLocaleString()} tokens in / ${agent.tokens_out.toLocaleString()} tokens out</div></div>`;
			traceTree.appendChild(div);
		});
	}

	// Update Latency Breakdown
	const latencyContainer = document.getElementById("latency-bars");
	if (latencyContainer) {
		latencyContainer.innerHTML = "";
		const maxLatency = Math.max.apply(
			null,
			data.agents.map((a) => a.latency_ms),
		);
		data.agents.forEach((agent) => {
			const pct = maxLatency > 0 ? Math.round((agent.latency_ms / maxLatency) * 100) : 0;
			const sec = (agent.latency_ms / 1000).toFixed(1);
			const speedClass = agent.latency_ms < 2000 ? "fast" : agent.latency_ms < 4000 ? "medium" : "slow";
			const bar = document.createElement("div");
			bar.className = "latency-bar";
			bar.innerHTML = `<div class="latency-label">${agent.agent.charAt(0).toUpperCase()}${agent.agent.slice(1)}</div><div class="latency-fill-wrapper"><div class="latency-fill ${speedClass}" style="width:${pct}%"></div></div><div class="latency-time">${sec}s</div>`;
			latencyContainer.appendChild(bar);
		});
		const totalSec = (data.totals.latency_ms / 1000).toFixed(1);
		const totalDiv = document.createElement("div");
		totalDiv.style.cssText = "margin-top:12px;font-size:13px;color:var(--color-text-tertiary)";
		totalDiv.textContent = `Total: ${totalSec}s (agent pipeline)`;
		latencyContainer.appendChild(totalDiv);
	}

	// Update Token Usage table
	const tokenBody = document.getElementById("token-usage-body");
	if (tokenBody) {
		tokenBody.innerHTML = "";
		data.agents.forEach((agent) => {
			const tr = document.createElement("tr");
			tr.innerHTML = `<td>${agent.agent.charAt(0).toUpperCase()}${agent.agent.slice(1)}</td><td>${agent.tokens_in.toLocaleString()}</td><td>${agent.tokens_out.toLocaleString()}</td><td>$${agent.cost.toFixed(4)}</td>`;
			tokenBody.appendChild(tr);
		});
		// Totals row
		const totalRow = document.createElement("tr");
		totalRow.style.fontWeight = "600";
		totalRow.innerHTML = `<td>Total</td><td>${data.totals.tokens_in.toLocaleString()}</td><td>${data.totals.tokens_out.toLocaleString()}</td><td>$${data.totals.cost.toFixed(4)}</td>`;
		tokenBody.appendChild(totalRow);
	}

	// Update Decision Audit Trail
	const auditBody = document.getElementById("audit-trail-body");
	if (auditBody && data.audit_trail) {
		auditBody.innerHTML = "";
		data.audit_trail.forEach((entry) => {
			const tr = document.createElement("tr");
			const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--";
			tr.innerHTML = `<td>${time}</td><td>${entry.agent ? entry.agent.charAt(0).toUpperCase() + entry.agent.slice(1) : "--"}</td><td>${entry.action || "--"}</td><td>${entry.reasoning || "--"}</td>`;
			auditBody.appendChild(tr);
		});
	}
}
