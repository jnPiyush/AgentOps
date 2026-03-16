import type { ExtractedClause, ILlmAdapter, LlmRequest, LlmResponse } from "../../gateway/src/types.js";
import { loadSystemPrompt } from "./agentConfig.js";

export interface NegotiationAgentResult {
	contractId: string;
	counterpartyPositions: string[];
	fallbackRecommendations: string[];
	escalationRequired: boolean;
	confidence: number;
	traceId: string;
}

export async function runNegotiationAgent(
	adapter: ILlmAdapter,
	clauses: ExtractedClause[],
	riskLevel: string,
	flagsCount: number,
	contractId: string,
	traceId: string,
): Promise<NegotiationAgentResult> {
	const systemPrompt = await loadSystemPrompt("negotiation");

	const clauseSummary = clauses.map((c) => `- [${c.type}] ${c.text.slice(0, 200)}`).join("\n");

	const request: LlmRequest = {
		system_prompt: systemPrompt,
		prompt: `Assess counterparty positions and recommend fallback language for negotiation.\n\nRisk level: ${riskLevel}\nFlags count: ${flagsCount}\n\nClauses:\n${clauseSummary}`,
		response_format: "json",
	};

	const response: LlmResponse = await adapter.complete(request);

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			counterparty_positions: [],
			fallback_recommendations: [],
			escalation_required: flagsCount > 0 || riskLevel === "high",
			confidence_score: 0.7,
		};
	}

	return {
		contractId,
		counterpartyPositions: (parsed.counterparty_positions as string[]) ?? [],
		fallbackRecommendations: (parsed.fallback_recommendations as string[]) ?? [],
		escalationRequired: (parsed.escalation_required as boolean) ?? false,
		confidence: (parsed.confidence_score as number) ?? 0.7,
		traceId,
	};
}
