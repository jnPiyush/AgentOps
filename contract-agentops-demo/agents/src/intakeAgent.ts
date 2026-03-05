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
      type: "UNKNOWN",
      confidence: 0,
      parties: [],
      metadata: {},
    };
  }

  return {
    contractId,
    type: (parsed.type as string) ?? "UNKNOWN",
    confidence: (parsed.confidence as number) ?? 0,
    parties: (parsed.parties as string[]) ?? [],
    metadata: (parsed.metadata as Record<string, string>) ?? {},
    traceId,
  };
}
