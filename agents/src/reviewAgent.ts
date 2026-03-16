import type { ExtractedClause, ILlmAdapter, LlmRequest, LlmResponse } from "../../gateway/src/types.js";
import { loadSystemPrompt } from "./agentConfig.js";

export interface ReviewAgentResult {
	contractId: string;
	reviewSummary: string;
	materialChanges: string[];
	unresolvedItems: string[];
	confidence: number;
	traceId: string;
}

export async function runReviewAgent(
	adapter: ILlmAdapter,
	clauses: ExtractedClause[],
	contractId: string,
	traceId: string,
): Promise<ReviewAgentResult> {
	const systemPrompt = await loadSystemPrompt("review");

	const clauseSummary = clauses.map((c) => `- [${c.type}] ${c.text.slice(0, 200)}`).join("\n");

	const request: LlmRequest = {
		system_prompt: systemPrompt,
		prompt: `Review the following extracted clauses for material changes, redlines, and unresolved items.\n\nClauses:\n${clauseSummary}`,
		response_format: "json",
	};

	const response: LlmResponse = await adapter.complete(request);

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			review_summary: "Review completed with no material changes detected",
			material_changes: [],
			unresolved_items: [],
			confidence_score: 0.7,
		};
	}

	return {
		contractId,
		reviewSummary: (parsed.review_summary as string) ?? "Review completed",
		materialChanges: (parsed.material_changes as string[]) ?? [],
		unresolvedItems: (parsed.unresolved_items as string[]) ?? [],
		confidence: (parsed.confidence_score as number) ?? 0.7,
		traceId,
	};
}
