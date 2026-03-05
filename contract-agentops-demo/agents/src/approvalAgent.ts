import type { ILlmAdapter, LlmRequest, LlmResponse } from "../../gateway/src/types.js";
import { loadSystemPrompt } from "./agentConfig.js";

export interface ApprovalAgentResult {
  contractId: string;
  action: "auto_approve" | "escalate_to_human";
  reasoning: string;
  assignedTo: string | null;
  traceId: string;
}

export async function runApprovalAgent(
  adapter: ILlmAdapter,
  riskLevel: string,
  flagsCount: number,
  contractId: string,
  traceId: string,
): Promise<ApprovalAgentResult> {
  const systemPrompt = await loadSystemPrompt("approval");

  const request: LlmRequest = {
    system_prompt: systemPrompt,
    prompt: `Determine the approval action for this contract.\n\nRisk level: ${riskLevel}\nFlags count: ${flagsCount}\nContract ID: ${contractId}`,
    response_format: "json",
  };

  const response: LlmResponse = await adapter.complete(request);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    parsed = {
      action: flagsCount > 0 || riskLevel === "high" ? "escalate_to_human" : "auto_approve",
      reasoning: "Fallback decision based on risk and flags",
      assigned_to: null,
    };
  }

  return {
    contractId,
    action: (parsed.action as "auto_approve" | "escalate_to_human") ?? "escalate_to_human",
    reasoning: (parsed.reasoning as string) ?? "",
    assignedTo: (parsed.assigned_to as string) ?? null,
    traceId,
  };
}
