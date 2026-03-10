import { describe, expect, it } from "vitest";
import {
	buildWorkflowPackage,
	validateWorkflowInput,
	type WorkflowDefinition,
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
	it("builds a canonical workflow package with declarative references", () => {
		const workflowPackage = buildWorkflowPackage(baseWorkflow);

		expect(workflowPackage.workflow_id).toBe(baseWorkflow.id);
		expect(workflowPackage.agents).toHaveLength(2);
		expect(workflowPackage.agents[0].runtime_role_key).toBe("intake");
		expect(workflowPackage.agents[0].declarative.agent_config).toBe(
			"config/agents/intake-agent.yaml",
		);
		expect(workflowPackage.agents[1].runtime_role_key).toBe("approval");
		expect(workflowPackage.hitl_policy.enabled).toBe(true);
		expect(workflowPackage.manifest_references).toContain(
			"config/schemas/workflow-package.json",
		);
	});
});