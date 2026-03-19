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

	// Support both old schema (action: "auto_approve"|"escalate_to_human" from simulated data)
	// and new prompt schema (decision: "APPROVE"|"REJECT"|"CONDITIONAL" from approval-system.md)
	const rawAction = parsed.action as string | undefined;
	const rawDecision = (parsed.decision as string | undefined)?.toUpperCase();

	let action: "auto_approve" | "escalate_to_human";
	if (rawAction === "auto_approve" || rawAction === "escalate_to_human") {
		action = rawAction;
	} else if (rawDecision === "APPROVE") {
		action = "auto_approve";
	} else if (rawDecision === "REJECT" || rawDecision === "CONDITIONAL") {
		action = "escalate_to_human";
	} else if ((parsed.escalation_required as boolean | undefined) === false) {
		action = "auto_approve";
	} else {
		action = "escalate_to_human";
	}

	return {
		contractId,
		action,
		reasoning: (parsed.reasoning as string) ?? "",
		assignedTo: (parsed.assigned_to as string) ?? null,
		traceId,
	};
}
