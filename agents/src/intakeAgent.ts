import type { ILlmAdapter, LlmRequest, LlmResponse } from "../../gateway/src/types.js";
import { AGENTS, loadSystemPrompt } from "./agentConfig.js";

export interface IntakeResult {
	contractId: string;
	type: string;
	confidence: number;
	parties: string[];
	metadata: Record<string, string>;
	traceId: string;
}

export async function runIntakeAgent(
	adapter: ILlmAdapter,
	contractText: string,
	contractId: string,
	traceId: string,
): Promise<IntakeResult> {
	const systemPrompt = await loadSystemPrompt("intake");
	const agent = AGENTS.intake;

	const classifyRequest: LlmRequest = {
		system_prompt: systemPrompt,
		prompt: `Classify this contract and extract metadata.\n\nContract text:\n${contractText}`,
		response_format: "json",
	};

	const response: LlmResponse = await adapter.complete(classifyRequest);

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			contract_type: "UNKNOWN",
			confidence_score: 0,
			parties: [],
		};
	}

	const parsedType = parsed.contract_type ?? parsed.type;
	const parsedConfidence = parsed.confidence_score ?? parsed.confidence;

	return {
		contractId,
		type: (parsedType as string) ?? "UNKNOWN",
		confidence: (parsedConfidence as number) ?? 0,
		parties: (parsed.parties as string[]) ?? [],
		metadata: (parsed.metadata as Record<string, string>) ?? {
			title: parsed.title as string,
			effective_date: parsed.effective_date as string,
			expiry_date: parsed.expiry_date as string,
			value: parsed.value != null ? String(parsed.value) : undefined,
			currency: parsed.currency as string,
			jurisdiction: parsed.jurisdiction as string,
		},
		traceId,
	};
}
