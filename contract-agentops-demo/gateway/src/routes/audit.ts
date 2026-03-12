import type { FastifyInstance } from "fastify";
import { getTraces } from "../orchestrator/pipeline.js";
import { getActiveWorkflowPackage } from "../services/workflowRegistry.js";
import { auditStore, contractStore } from "../stores/contractStore.js";

// GPT-4o pricing: $0.005 per 1K input tokens, $0.015 per 1K output tokens
const COST_PER_1K_IN = 0.005;
const COST_PER_1K_OUT = 0.015;

function normalizeRoleKey(value: string): string {
	return value.trim().toLowerCase();
}

function roundCost(value: number): number {
	return Math.round(value * 10000) / 10000;
}

function aggregateTelemetry(tokensIn: number, tokensOut: number, latencyMs: number) {
	const cost = (tokensIn / 1000) * COST_PER_1K_IN + (tokensOut / 1000) * COST_PER_1K_OUT;
	return {
		tokens_in: tokensIn,
		tokens_out: tokensOut,
		latency_ms: latencyMs,
		cost: roundCost(cost),
	};
}

function buildContractStageTelemetry(contractId: string) {
	const activeWorkflowPackage = getActiveWorkflowPackage();
	if (!activeWorkflowPackage?.contract_stage_map?.stages?.length) {
		return [];
	}

	const traces = getTraces(contractId);
	const auditEntries = auditStore.getByField("contract_id", contractId);

	return activeWorkflowPackage.contract_stage_map.stages.map((stage) => {
		const executionGroups = stage.execution_groups.map((group) => {
			const roleKeys = [...new Set(group.runtime_role_keys.map((roleKey) => normalizeRoleKey(roleKey)))];
			const groupTraces = traces.filter((trace) => roleKeys.includes(normalizeRoleKey(trace.agent)));
			const tokensIn = groupTraces.reduce((sum, trace) => sum + trace.tokens_in, 0);
			const tokensOut = groupTraces.reduce((sum, trace) => sum + trace.tokens_out, 0);
			const latencyMs = groupTraces.reduce((sum, trace) => sum + trace.latency_ms, 0);

			return {
				id: group.id,
				name: group.name,
				runtime_agent_ids: group.runtime_agent_ids,
				runtime_role_keys: group.runtime_role_keys,
				primary_mcp_affinity: group.primary_mcp_affinity,
				traces_count: groupTraces.length,
				...aggregateTelemetry(tokensIn, tokensOut, latencyMs),
			};
		});

		const stageRoleKeys = [...new Set(executionGroups.flatMap((group) => group.runtime_role_keys.map((roleKey) => normalizeRoleKey(roleKey))))];
		const stageTraces = traces.filter((trace) => stageRoleKeys.includes(normalizeRoleKey(trace.agent)));
		const stageAuditEntries = auditEntries
			.filter((entry) => stageRoleKeys.includes(normalizeRoleKey(entry.agent)) || (normalizeRoleKey(entry.agent) === "human" && stageRoleKeys.includes("approval")))
			.map((entry) => ({
				timestamp: entry.timestamp,
				agent: entry.agent,
				action: entry.action,
				reasoning: entry.reasoning,
			}));

		const tokensIn = stageTraces.reduce((sum, trace) => sum + trace.tokens_in, 0);
		const tokensOut = stageTraces.reduce((sum, trace) => sum + trace.tokens_out, 0);
		const latencyMs = stageTraces.reduce((sum, trace) => sum + trace.latency_ms, 0);

		return {
			id: stage.id,
			order: stage.order,
			name: stage.name,
			summary: stage.summary,
			primary_mcp_affinity: stage.primary_mcp_affinity,
			mvp_shape: stage.mvp_shape,
			notes: stage.notes,
			default_execution_group_name: stage.default_execution_group_name,
			execution_groups: executionGroups,
			audit_trail: stageAuditEntries,
			traces_count: stageTraces.length,
			...aggregateTelemetry(tokensIn, tokensOut, latencyMs),
		};
	});
}

export async function auditRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/audit/:contractId - decision audit trail
	app.get("/api/v1/audit/:contractId", async (request, reply) => {
		const { contractId } = request.params as { contractId: string };
		const entries = auditStore.getByField("contract_id", contractId);
		return reply.send(entries);
	});

	// GET /api/v1/traces/:contractId - trace data
	app.get("/api/v1/traces/:contractId", async (request, reply) => {
		const { contractId } = request.params as { contractId: string };
		const traces = getTraces(contractId);
		return reply.send(traces);
	});

	// GET /api/v1/monitor/:contractId - aggregated cost and token data
	app.get("/api/v1/monitor/:contractId", async (request, reply) => {
		const { contractId } = request.params as { contractId: string };
		const traces = getTraces(contractId);
		const auditEntries = auditStore.getByField("contract_id", contractId);
		const contract = contractStore.getById(contractId);
		const activePackage = getActiveWorkflowPackage();

		const agents = [...new Set((activePackage?.agents ?? []).map((agent) => agent.runtime_role_key || agent.id).filter(Boolean))];
		const monitoredAgents = agents.length > 0 ? agents : ["intake", "extraction", "compliance", "approval"];
		const agentCosts = monitoredAgents.map((agent) => {
			const agentTraces = traces.filter((t) => t.agent === agent);
			const tokensIn = agentTraces.reduce((sum, t) => sum + t.tokens_in, 0);
			const tokensOut = agentTraces.reduce((sum, t) => sum + t.tokens_out, 0);
			const latencyMs = agentTraces.reduce((sum, t) => sum + t.latency_ms, 0);

			return {
				agent,
				...aggregateTelemetry(tokensIn, tokensOut, latencyMs),
			};
		});

		const totalIn = agentCosts.reduce((s, a) => s + a.tokens_in, 0);
		const totalOut = agentCosts.reduce((s, a) => s + a.tokens_out, 0);
		const totalCost = agentCosts.reduce((s, a) => s + a.cost, 0);
		const totalLatency = agentCosts.reduce((s, a) => s + a.latency_ms, 0);

		const contractStages = buildContractStageTelemetry(contractId);

		return reply.send({
			contract_id: contractId,
			status: contract?.status ?? "unknown",
			stage_map_reference: activePackage?.contract_stage_map?.catalog_reference ?? null,
			contract_stages: contractStages,
			agents: agentCosts,
			totals: {
				tokens_in: totalIn,
				tokens_out: totalOut,
				cost: Math.round(totalCost * 10000) / 10000,
				latency_ms: totalLatency,
			},
			audit_trail: auditEntries.map((e) => ({
				timestamp: e.timestamp,
				agent: e.agent,
				action: e.action,
				reasoning: e.reasoning,
			})),
			traces_count: traces.length,
		});
	});

	// GET /api/v1/monitor - list all contracts with cost summaries
	app.get("/api/v1/monitor", async (_request, reply) => {
		const contracts = contractStore.getAll();
		const summaries = contracts.map((c) => {
			const traces = getTraces(c.id);
			const totalIn = traces.reduce((s, t) => s + t.tokens_in, 0);
			const totalOut = traces.reduce((s, t) => s + t.tokens_out, 0);
			const totalLatency = traces.reduce((s, t) => s + t.latency_ms, 0);
			const cost = (totalIn / 1000) * COST_PER_1K_IN + (totalOut / 1000) * COST_PER_1K_OUT;

			return {
				contract_id: c.id,
				filename: c.filename,
				status: c.status,
				tokens_in: totalIn,
				tokens_out: totalOut,
				latency_ms: totalLatency,
				cost: Math.round(cost * 10000) / 10000,
				submitted_at: c.submitted_at,
			};
		});

		return reply.send(summaries);
	});
}
