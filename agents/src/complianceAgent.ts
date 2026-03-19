import type { ClauseResult, ExtractedClause, ILlmAdapter, LlmRequest, LlmResponse } from "../../gateway/src/types.js";
import { loadSystemPrompt } from "./agentConfig.js";

export interface ComplianceAgentResult {
	contractId: string;
	clauseResults: ClauseResult[];
	overallRisk: "low" | "medium" | "high";
	flagsCount: number;
	policyReferences: string[];
	traceId: string;
}

export async function runComplianceAgent(
	adapter: ILlmAdapter,
	clauses: ExtractedClause[],
	contractId: string,
	traceId: string,
): Promise<ComplianceAgentResult> {
	const systemPrompt = await loadSystemPrompt("compliance");

	const clauseSummary = clauses.map((c) => `- [${c.type}] ${c.text.slice(0, 200)}`).join("\n");

	const request: LlmRequest = {
		system_prompt: systemPrompt,
		prompt: `Check these extracted clauses against company policies and flag any risks.\n\nClauses:\n${clauseSummary}`,
		response_format: "json",
	};

	const response: LlmResponse = await adapter.complete(request);

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(response.content);
	} catch {
		parsed = {
			clause_results: [],
			overall_risk: "medium",
			flags_count: 0,
			policy_references: [],
		};
	}

	// Support both old schema (clause_results + overall_risk from simulated data)
	// and new prompt schema (policy_violations + risk_level from compliance-system.md)
	const clauseResults: ClauseResult[] =
		(parsed.clause_results as ClauseResult[] | undefined) ??
		(parsed.policy_violations as string[] | undefined)?.map((v) => ({
			clause_type: "policy",
			status: "fail" as const,
			policy_ref: "policy-unknown",
			reason: v,
		})) ??
		[];

	const rawRisk = (parsed.overall_risk ?? parsed.risk_level) as string | undefined;
	const overallRisk = (rawRisk?.toLowerCase() as "low" | "medium" | "high" | undefined) ?? "medium";

	const flagsCount =
		(parsed.flags_count as number | undefined) ??
		clauseResults.filter((r) => r.status === "fail" || r.status === "warn").length;

	return {
		contractId,
		clauseResults,
		overallRisk,
		flagsCount,
		policyReferences: (parsed.policy_references as string[]) ?? [],
		traceId,
	};
}
