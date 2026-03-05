interface ApprovalResult {
  contract_id: string;
  action: "auto_approve" | "escalate_to_human";
  risk_level: string;
  reasoning: string;
}

interface EscalationResult {
  contract_id: string;
  status: "awaiting_review";
  escalation_reason: string;
  risk_level: string;
  assigned_to: string;
  timestamp: string;
}

interface NotificationResult {
  contract_id: string;
  stakeholder: string;
  message: string;
  delivered: boolean;
  timestamp: string;
}

export async function routeApproval(
  contractId: string,
  riskLevel: string,
  flagsCount: number,
  reasoning?: string,
): Promise<ApprovalResult> {
  // Auto-approve low-risk contracts with no flags
  if (riskLevel === "low" && flagsCount === 0) {
    return {
      contract_id: contractId,
      action: "auto_approve",
      risk_level: riskLevel,
      reasoning:
        reasoning ?? "Low-risk contract with no policy violations. Auto-approved.",
    };
  }

  // Escalate medium/high/critical risk or contracts with flags
  return {
    contract_id: contractId,
    action: "escalate_to_human",
    risk_level: riskLevel,
    reasoning:
      reasoning ??
      `Contract has ${flagsCount} policy violation(s) with ${riskLevel} risk level. Human review required.`,
  };
}

export async function escalateToHuman(
  contractId: string,
  reason: string,
  riskLevel: string,
): Promise<EscalationResult> {
  return {
    contract_id: contractId,
    status: "awaiting_review",
    escalation_reason: reason,
    risk_level: riskLevel,
    assigned_to: "Legal Review Team",
    timestamp: new Date().toISOString(),
  };
}

export async function notifyStakeholder(
  contractId: string,
  stakeholder: string,
  message: string,
): Promise<NotificationResult> {
  // In demo mode, notifications are logged but not actually sent
  return {
    contract_id: contractId,
    stakeholder,
    message,
    delivered: true,
    timestamp: new Date().toISOString(),
  };
}
