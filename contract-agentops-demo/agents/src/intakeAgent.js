import { AGENTS, loadSystemPrompt } from "./agentConfig.js";
export async function runIntakeAgent(adapter, contractText, contractId, traceId) {
    const systemPrompt = await loadSystemPrompt("intake");
    const agent = AGENTS.intake;
    const classifyRequest = {
        system_prompt: systemPrompt,
        prompt: `Classify this contract and extract metadata.\n\nContract text:\n${contractText}`,
        response_format: "json",
    };
    const response = await adapter.complete(classifyRequest);
    let parsed;
    try {
        parsed = JSON.parse(response.content);
    }
    catch {
        parsed = {
            type: "UNKNOWN",
            confidence: 0,
            parties: [],
            metadata: {},
        };
    }
    return {
        contractId,
        type: parsed.type ?? "UNKNOWN",
        confidence: parsed.confidence ?? 0,
        parties: parsed.parties ?? [],
        metadata: parsed.metadata ?? {},
        traceId,
    };
}
//# sourceMappingURL=intakeAgent.js.map