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
			model: "gpt-4o",
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
			model: "gpt-4o",
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