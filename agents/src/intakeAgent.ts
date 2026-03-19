import type { ILlmAdapter, LlmRequest, LlmResponse } from "../../gateway/src/types.js";
import { AGENTS, loadSystemPrompt } from "./agentConfig.js";

export interface IntakeResult {
	contractId: string;
	type: string;
	confidence: number;
	parties: string[];
	metadata: Record<string, string | number | string[] | null | undefined>;
	traceId: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildMetadata(parsed: Record<string, unknown>): Record<string, string | number | string[] | null | undefined> {
	const candidate = parsed.metadata;
	if (isPlainObject(candidate)) {
		return candidate as Record<string, string | number | string[] | null | undefined>;
	}

	return {
		title: parsed.title as string,
		contract_category: parsed.contract_category as string,
		source_channel: parsed.source_channel as string,
		industry: parsed.industry as string,
		counterparty_type: parsed.counterparty_type as string,
		risk_level: parsed.risk_level as string,
		compliance_needs: Array.isArray(parsed.compliance_needs) ? (parsed.compliance_needs as string[]) : undefined,
		effective_date: parsed.effective_date as string,
		expiry_date: parsed.expiry_date as string,
		value: typeof parsed.value === "number" ? parsed.value : parsed.value != null ? String(parsed.value) : undefined,
		currency: parsed.currency as string,
		jurisdiction: parsed.jurisdiction as string,
		source_system: parsed.source_system as string,
	};
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
		metadata: buildMetadata(parsed),
		traceId,
	};
}
