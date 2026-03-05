import { loadSystemPrompt } from "./agentConfig.js";
export async function runApprovalAgent(adapter, riskLevel, flagsCount, contractId, traceId) {
    const systemPrompt = await loadSystemPrompt("approval");
    const request = {
        system_prompt: systemPrompt,
        prompt: `Determine the approval action for this contract.\n\nRisk level: ${riskLevel}\nFlags count: ${flagsCount}\nContract ID: ${contractId}`,
        response_format: "json",
    };
    const response = await adapter.complete(request);
    let parsed;
    try {
        parsed = JSON.parse(response.content);
    }
    catch {
        parsed = {
            action: flagsCount > 0 || riskLevel === "high" ? "escalate_to_human" : "auto_approve",
            reasoning: "Fallback decision based on risk and flags",
            assigned_to: null,
        };
    }
    return {
        contractId,
        action: parsed.action ?? "escalate_to_human",
        reasoning: parsed.reasoning ?? "",
        assignedTo: parsed.assigned_to ?? null,
        traceId,
    };
}
//# sourceMappingURL=approvalAgent.js.map