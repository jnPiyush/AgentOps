import { describe, expect, it } from "vitest";
import {
	type WorkflowDefinition,
	buildWorkflowPackage,
	getContractStageCatalog,
	validateWorkflowInput,
} from "../gateway/src/services/workflowRegistry.js";

const baseWorkflow: WorkflowDefinition = {
	id: "wf-contract-core",
	name: "Contract Core Flow",
	type: "sequential-hitl",
	active: false,
	createdAt: "2026-03-10T10:00:00.000Z",
	updatedAt: "2026-03-10T10:05:00.000Z",
	agents: [
		{
			id: "intake-1",
			name: "Intake Agent",
			role: "Classify contracts and extract metadata",
			icon: "I",
			model: "gpt-5.4",
			tools: ["upload_contract", "classify_document", "extract_metadata"],
			boundary: "Classify only",
			output: "Contract metadata",
			color: "#3B82F6",
			kind: "agent",
			stage: 0,
			lane: 0,
			order: 0,
		},
		{
			id: "approval-1",
			name: "Approval Agent",
			role: "Route approval and escalate when required",
			icon: "A",
			model: "gpt-5.4",
			tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
			boundary: "Approval only",
			output: "Approval decision",
			color: "#10B981",
			kind: "agent",
			stage: 1,
			lane: 0,
			order: 1,
		},
	],
};

const lifecycleWorkflow: WorkflowDefinition = {
	id: "wf-contract-lifecycle",
	name: "Contract Lifecycle Pipeline",
	type: "sequential-hitl",
	active: false,
	createdAt: "2026-03-12T08:00:00.000Z",
	updatedAt: "2026-03-12T08:05:00.000Z",
	agents: [
		{
			id: "intake-1",
			name: "Intake Agent",
			role: "Classify contracts and extract metadata",
			icon: "I",
			model: "gpt-5.4",
			tools: ["upload_contract", "classify_document", "extract_metadata"],
			boundary: "Classify only",
			output: "Contract metadata",
			color: "#3B82F6",
			kind: "agent",
			stage: 0,
			lane: 0,
			order: 0,
		},
		{
			id: "drafting-1",
			name: "Drafting Agent",
			role: "Assemble the initial draft package and recommend approved clause language",
			icon: "D",
			model: "gpt-5.4",
			tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
			boundary: "Draft only",
			output: "Draft package",
			color: "#2563EB",
			kind: "agent",
			stage: 1,
			lane: 0,
			order: 1,
		},
		{
			id: "review-1",
			name: "Internal Review Agent",
			role: "Summarize redlines and internal review decisions",
			icon: "R",
			model: "gpt-5.4",
			tools: ["get_audit_log", "create_audit_entry"],
			boundary: "Review only",
			output: "Review summary",
			color: "#7C3AED",
			kind: "agent",
			stage: 2,
			lane: 0,
			order: 2,
		},
		{
			id: "compliance-1",
			name: "Compliance Agent",
			role: "Check policies and flag risk",
			icon: "C",
			model: "gpt-5.4",
			tools: ["check_policy", "flag_risk", "get_policy_rules"],
			boundary: "Compliance only",
			output: "Risk findings",
			color: "#F59E0B",
			kind: "agent",
			stage: 3,
			lane: 0,
			order: 3,
		},
		{
			id: "negotiation-1",
			name: "Negotiation Agent",
			role: "Assess counterparty changes and recommend fallback positions",
			icon: "N",
			model: "gpt-5.4",
			tools: ["route_approval", "notify_stakeholder"],
			boundary: "Negotiation only",
			output: "Negotiation brief",
			color: "#B45309",
			kind: "agent",
			stage: 4,
			lane: 0,
			order: 4,
		},
		{
			id: "approval-1",
			name: "Approval Agent",
			role: "Route approvals and escalate when required",
			icon: "A",
			model: "gpt-5.4",
			tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
			boundary: "Approval only",
			output: "Approval decision",
			color: "#10B981",
			kind: "human",
			stage: 5,
			lane: 0,
			order: 5,
		},
		{
			id: "signature-1",
			name: "Signature Agent",
			role: "Coordinate execution, signature reminders, and completion evidence",
			icon: "S",
			model: "gpt-5.4",
			tools: ["notify_stakeholder", "get_audit_log", "create_audit_entry"],
			boundary: "Execution only",
			output: "Signature status",
			color: "#0EA5E9",
			kind: "agent",
			stage: 6,
			lane: 0,
			order: 6,
		},
		{
			id: "obligations-1",
			name: "Obligations Agent",
			role: "Extract obligations, milestones, and post-signature owners",
			icon: "O",
			model: "gpt-5.4",
			tools: ["extract_clauses", "extract_dates_values", "notify_stakeholder"],
			boundary: "Obligations only",
			output: "Obligation register",
			color: "#14B8A6",
			kind: "agent",
			stage: 7,
			lane: 0,
			order: 7,
		},
		{
			id: "renewal-1",
			name: "Renewal Agent",
			role: "Detect renewal windows, expiry risk, and amendment triggers",
			icon: "Y",
			model: "gpt-5.4",
			tools: ["extract_dates_values", "flag_risk", "notify_stakeholder"],
			boundary: "Renewal only",
			output: "Renewal alert package",
			color: "#F97316",
			kind: "agent",
			stage: 8,
			lane: 0,
			order: 8,
		},
		{
			id: "analytics-1",
			name: "Analytics Agent",
			role: "Summarize lifecycle metrics, backlog, and portfolio risk insights",
			icon: "L",
			model: "gpt-5.4",
			tools: ["run_evaluation", "get_baseline", "detect_drift"],
			boundary: "Analytics only",
			output: "Portfolio insights",
			color: "#8B5CF6",
			kind: "agent",
			stage: 9,
			lane: 0,
			order: 9,
		},
	],
};

describe("workflow registry validation", () => {
	it("rejects missing workflow fields", () => {
		const errors = validateWorkflowInput({
			name: "",
			type: "",
			agents: [],
		});

		expect(errors.length).toBeGreaterThan(0);
		expect(errors.join(" ")).toContain("Workflow name is required.");
		expect(errors.join(" ")).toContain("At least one workflow agent is required.");
	});

	it("returns no errors for a valid workflow input", () => {
		const errors = validateWorkflowInput({
			name: "Valid Workflow",
			type: "sequential",
			agents: [
				{
					id: "a1",
					name: "Intake",
					role: "Classify contract",
					icon: "I",
					model: "gpt-5.4",
					tools: ["upload_contract"],
					boundary: "Classify only",
					output: "metadata",
					color: "#000",
					order: 0,
				},
			],
		});

		expect(errors).toHaveLength(0);
	});

	it("rejects duplicate agent ids", () => {
		const agent = {
			id: "dup-id",
			name: "Agent",
			role: "Do something",
			icon: "A",
			model: "gpt-5.4",
			tools: [],
			boundary: "bounded",
			output: "result",
			color: "#fff",
			order: 0,
		};
		const errors = validateWorkflowInput({ name: "Test", type: "sequential", agents: [agent, { ...agent }] });
		expect(errors.join(" ")).toContain("Duplicate workflow agent id: dup-id");
	});

	it("rejects workflow with more than 20 agents", () => {
		const agents = Array.from({ length: 21 }, (_, i) => ({
			id: `agent-${i}`,
			name: `Agent ${i}`,
			role: "role",
			icon: "A",
			model: "gpt-5.4",
			tools: [] as string[],
			boundary: "bounded",
			output: "result",
			color: "#000",
			order: i,
		}));
		const errors = validateWorkflowInput({ name: "Too Many", type: "sequential", agents });
		expect(errors.join(" ")).toContain("Maximum 20 agents per workflow.");
	});
});

describe("workflow package generation", () => {
	it("exposes the active ten-stage contract lifecycle catalog", () => {
		const catalog = getContractStageCatalog();

		expect(catalog).toHaveLength(10);
		expect(catalog[0]).toMatchObject({
			id: "request-initiation",
			order: 1,
			name: "Request and Initiation",
		});
		expect(catalog[9]).toMatchObject({
			id: "portfolio-analytics",
			order: 10,
			name: "Lifecycle Analytics",
		});
	});

	it("builds a canonical workflow package with declarative references", () => {
		const workflowPackage = buildWorkflowPackage(baseWorkflow);

		expect(workflowPackage.workflow_id).toBe(baseWorkflow.id);
		expect(workflowPackage.agents).toHaveLength(2);
		expect(workflowPackage.agents[0].runtime_role_key).toBe("intake");
		expect(workflowPackage.agents[0].declarative.agent_config).toBe("config/agents/intake-agent.yaml");
		expect(workflowPackage.agents[1].runtime_role_key).toBe("approval");
		expect(workflowPackage.hitl_policy.enabled).toBe(true);
		expect(workflowPackage.manifest_references).toContain("config/schemas/workflow-package.json");
		expect(workflowPackage.manifest_references).toContain("config/stages/contract-lifecycle.json");
		expect(workflowPackage.contract_stage_map.catalog_reference).toBe("config/stages/contract-lifecycle.json");
		expect(workflowPackage.contract_stage_map.stages).toHaveLength(10);
		expect(
			workflowPackage.contract_stage_map.stages.find((stage) => stage.id === "request-initiation")?.execution_groups[0],
		).toMatchObject({
			id: "group-request-initiation",
			runtime_agent_ids: ["intake-1"],
			runtime_role_keys: ["intake"],
		});
		expect(
			workflowPackage.contract_stage_map.stages.find((stage) => stage.id === "approval-routing")?.execution_groups[0],
		).toMatchObject({
			id: "group-approval-routing",
			runtime_agent_ids: ["approval-1"],
			runtime_role_keys: ["approval"],
		});
		expect(workflowPackage.contract_stage_map.unmapped_agent_ids).toHaveLength(0);
	});

	it("maps dedicated lifecycle agents to the active ten-stage catalog", () => {
		const workflowPackage = buildWorkflowPackage(lifecycleWorkflow);

		expect(workflowPackage.agents).toHaveLength(10);
		expect(workflowPackage.agents.find((agent) => agent.id === "drafting-1")?.runtime_role_key).toBe("drafting");
		expect(workflowPackage.agents.find((agent) => agent.id === "review-1")?.runtime_role_key).toBe("review");
		expect(workflowPackage.agents.find((agent) => agent.id === "negotiation-1")?.runtime_role_key).toBe("negotiation");
		expect(workflowPackage.agents.find((agent) => agent.id === "signature-1")?.runtime_role_key).toBe("signature");
		expect(workflowPackage.agents.find((agent) => agent.id === "obligations-1")?.runtime_role_key).toBe("obligations");
		expect(workflowPackage.agents.find((agent) => agent.id === "renewal-1")?.runtime_role_key).toBe("renewal");
		expect(workflowPackage.agents.find((agent) => agent.id === "analytics-1")?.runtime_role_key).toBe("analytics");
		expect(
			workflowPackage.contract_stage_map.stages.find((stage) => stage.id === "internal-review")?.execution_groups[0],
		).toMatchObject({
			runtime_agent_ids: ["review-1"],
			runtime_role_keys: ["review"],
		});
		expect(
			workflowPackage.contract_stage_map.stages.find((stage) => stage.id === "execution-signature")
				?.execution_groups[0],
		).toMatchObject({
			runtime_agent_ids: ["signature-1"],
			runtime_role_keys: ["signature"],
		});
		expect(
			workflowPackage.contract_stage_map.stages.find((stage) => stage.id === "portfolio-analytics")
				?.execution_groups[0],
		).toMatchObject({
			runtime_agent_ids: ["analytics-1"],
			runtime_role_keys: ["analytics"],
		});
		expect(workflowPackage.hitl_policy.checkpoints).toEqual(["approval", "signature"]);
		expect(workflowPackage.contract_stage_map.unmapped_agent_ids).toHaveLength(0);
	});
});
