import type { ILlmAdapter, LlmRequest, LlmResponse, ExtractedClause, ClauseResult } from "../../gateway/src/types.js";
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

  const clauseSummary = clauses
    .map((c) => `- [${c.type}] ${c.text.slice(0, 200)}`)
    .join("\n");

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

  const clauseResults = (parsed.clause_results as ClauseResult[]) ?? [];
  const flagsCount = clauseResults.filter((r) => r.status === "fail" || r.status === "warn").length;

  return {
    contractId,
    clauseResults,
    overallRisk: (parsed.overall_risk as "low" | "medium" | "high") ?? "medium",
    flagsCount,
    policyReferences: (parsed.policy_references as string[]) ?? [],
    traceId,
  };
}
