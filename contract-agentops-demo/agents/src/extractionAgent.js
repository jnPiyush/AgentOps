import { loadSystemPrompt } from "./agentConfig.js";
export async function runExtractionAgent(adapter, contractText, contractId, traceId) {
    const systemPrompt = await loadSystemPrompt("extraction");
    const request = {
        system_prompt: systemPrompt,
        prompt: `Extract all key clauses, parties, dates, and monetary values from this contract.\n\nContract text:\n${contractText}`,
        response_format: "json",
    };
    const response = await adapter.complete(request);
    let parsed;
    try {
        parsed = JSON.parse(response.content);
    }
    catch {
        parsed = { clauses: [], parties: [], dates: {}, values: {} };
    }
    return {
        contractId,
        clauses: parsed.clauses ?? [],
        parties: parsed.parties ?? [],
        dates: parsed.dates ?? {},
        values: parsed.values ?? {},
        traceId,
    };
}
//# sourceMappingURL=extractionAgent.js.map