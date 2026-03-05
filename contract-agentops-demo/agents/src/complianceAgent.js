import { loadSystemPrompt } from "./agentConfig.js";
export async function runComplianceAgent(adapter, clauses, contractId, traceId) {
    const systemPrompt = await loadSystemPrompt("compliance");
    const clauseSummary = clauses
        .map((c) => `- [${c.type}] ${c.text.slice(0, 200)}`)
        .join("\n");
    const request = {
        system_prompt: systemPrompt,
        prompt: `Check these extracted clauses against company policies and flag any risks.\n\nClauses:\n${clauseSummary}`,
        response_format: "json",
    };
    const response = await adapter.complete(request);
    let parsed;
    try {
        parsed = JSON.parse(response.content);
    }
    catch {
        parsed = {
            clause_results: [],
            overall_risk: "medium",
            flags_count: 0,
            policy_references: [],
        };
    }
    const clauseResults = parsed.clause_results ?? [];
    const flagsCount = clauseResults.filter((r) => r.status === "fail" || r.status === "warning").length;
    return {
        contractId,
        clauseResults,
        overallRisk: parsed.overall_risk ?? "medium",
        flagsCount,
        policyReferences: parsed.policy_references ?? [],
        traceId,
    };
}
//# sourceMappingURL=complianceAgent.js.map