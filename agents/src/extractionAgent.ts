import type { ExtractedClause, ILlmAdapter, LlmRequest, LlmResponse } from "../../gateway/src/types.js";
import { loadSystemPrompt } from "./agentConfig.js";

export interface ExtractionAgentResult {
	contractId: string;
	clauses: ExtractedClause[];
	parties: string[];
	dates: string[];
	values: Array<{ label: string; value: number | string }> | string[];
	traceId: string;
}

export async function runExtractionAgent(
	adapter: ILlmAdapter,
	contractText: string,
	contractId: string,
	traceId: string,
): Promise<ExtractionAgentResult> {
	const systemPrompt = await loadSystemPrompt("extraction");

	const request: LlmRequest = {
		system_prompt: systemPrompt,
		prompt: `Extract all key clauses, parties, dates, and monetary values from this contract.\n\nContract text:\n${contractText}`,
		response_format: "json",
	};

	const response: LlmResponse = await adapter.complete(request);

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = { clauses: [], parties: [], dates: {}, values: {} };
	}

	return {
		contractId,
		clauses: (parsed.clauses as ExtractedClause[]) ?? [],
		parties: (parsed.parties as string[]) ?? [],
		dates: (parsed.dates as string[]) ?? [],
		values: (parsed.values as Array<{ label: string; value: number | string }> | string[]) ?? [],
		traceId,
	};
}
