import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { auditRoutes } from "../gateway/src/routes/audit.js";
import { storeTraces } from "../gateway/src/orchestrator/pipeline.js";
import { activateWorkflowDefinition, initWorkflowRegistry, saveWorkflowDefinition } from "../gateway/src/services/workflowRegistry.js";
import { auditStore, contractStore, initStores } from "../gateway/src/stores/contractStore.js";
import type { Contract, ILlmAdapter, LlmRequest, LlmResponse, WebSocketEvent } from "../gateway/src/types.js";

class AuditTestAdapter implements ILlmAdapter {
	async complete(req: LlmRequest): Promise<LlmResponse> {
		const prompt = req.prompt.toLowerCase();
		if (prompt.includes("classify") || prompt.includes("intake")) {
			return {
				content: JSON.stringify({ type: "NDA", confidence: 0.97, metadata: { parties: ["Acme", "Beta"] } }),
				tokens_in: 120,
				tokens_out: 40,
				latency_ms: 11,
				model: "test",
			};
		}
		if (prompt.includes("extract") || prompt.includes("clause")) {
			return {
				content: JSON.stringify({ clauses: [{ type: "confidentiality", text: "...", section: "3" }] }),
				tokens_in: 240,
				tokens_out: 80,
				latency_ms: 13,
				model: "test",
			};
		}
		if (prompt.includes("compliance") || prompt.includes("policy")) {
			return {
				content: JSON.stringify({ overallRisk: "medium", flagsCount: 1, results: [] }),
				tokens_in: 180,
				tokens_out: 60,
				latency_ms: 17,
				model: "test",
			};
		}
		return {
			content: JSON.stringify({ action: "escalate_to_human", reasoning: "Requires human review" }),
			tokens_in: 90,
			tokens_out: 30,
			latency_ms: 9,
			model: "test",
		};
	}
}

describe("audit routes", () => {
	it("returns native contract stage telemetry alongside legacy agent telemetry", async () => {
		await initStores();
		await initWorkflowRegistry();

		const workflowId = `wf-audit-${Date.now().toString(36)}`;
		await saveWorkflowDefinition({
			id: workflowId,
			name: "Audit Stage Flow",
			type: "sequential-hitl",
			agents: [
				{
					id: "intake-test",
					name: "Intake Agent",
					role: "Classify and intake contracts",
					icon: "I",
					model: "gpt-5.4",
					tools: ["upload_contract", "classify_document", "extract_metadata"],
					boundary: "Classify only",
					output: "Metadata",
					color: "#3B82F6",
					kind: "agent",
					stage: 0,
					lane: 0,
					order: 0,
				},
				{
					id: "approval-test",
					name: "Approval Agent",
					role: "Route approvals and escalate to human review",
					icon: "A",
					model: "gpt-5.4",
					tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
					boundary: "Approval only",
					output: "Decision",
					color: "#10B981",
					kind: "agent",
					stage: 1,
					lane: 0,
					order: 1,
				},
			],
		});
		await activateWorkflowDefinition(workflowId);

		const contractId = `contract-audit-${Date.now().toString(36)}`;
		const now = new Date().toISOString();
		await contractStore.add({
			id: contractId,
			filename: "audit-stage-test.txt",
			text: "Audit route contract",
			status: "awaiting_review",
			submitted_at: now,
			type: "NDA",
		} satisfies Contract);

		storeTraces(contractId, [
			{
				id: "trace-intake",
				contract_id: contractId,
				agent: "intake",
				tool: "classify_document",
				input: {},
				output: {},
				latency_ms: 1200,
				tokens_in: 100,
				tokens_out: 40,
				timestamp: now,
			},
			{
				id: "trace-approval",
				contract_id: contractId,
				agent: "approval",
				tool: "route_approval",
				input: {},
				output: {},
				latency_ms: 300,
				tokens_in: 50,
				tokens_out: 20,
				timestamp: now,
			},
		]);

		await auditStore.add({
			id: `audit-${Date.now().toString(36)}`,
			contract_id: contractId,
			agent: "approval",
			action: "escalated",
			reasoning: "Requires human review",
			timestamp: now,
		});

		const app = Fastify();
		await app.register(auditRoutes);

		const response = await app.inject({ method: "GET", url: `/api/v1/monitor/${contractId}` });
		expect(response.statusCode).toBe(200);

		const payload = response.json();
		expect(payload.stage_map_reference).toBe("config/stages/contract-lifecycle.json");
		expect(payload.agents).toEqual(expect.arrayContaining([
			expect.objectContaining({ agent: "intake", tokens_in: 100, tokens_out: 40, latency_ms: 1200 }),
			expect.objectContaining({ agent: "approval", tokens_in: 50, tokens_out: 20, latency_ms: 300 }),
		]));
		expect(payload.contract_stages).toEqual(expect.arrayContaining([
			expect.objectContaining({
				id: "request-initiation",
				name: "Request and Initiation",
				tokens_in: 100,
				tokens_out: 40,
				latency_ms: 1200,
			}),
			expect.objectContaining({
				id: "approval-routing",
				name: "Approval Routing",
				tokens_in: 50,
				tokens_out: 20,
				latency_ms: 300,
				audit_trail: [expect.objectContaining({ action: "escalated", reasoning: "Requires human review" })],
			}),
		]));
		expect(payload.contract_stages.find((stage: { id: string; }) => stage.id === "approval-routing")?.execution_groups[0]).toMatchObject({
			id: "group-approval-routing",
			runtime_role_keys: ["approval"],
			tokens_in: 50,
			tokens_out: 20,
			latency_ms: 300,
		});

		await app.close();
	});
});