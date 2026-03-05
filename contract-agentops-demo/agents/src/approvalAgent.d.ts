import type { ILlmAdapter } from "../../gateway/src/types.js";
export interface ApprovalAgentResult {
    contractId: string;
    action: "auto_approve" | "escalate_to_human";
    reasoning: string;
    assignedTo: string | null;
    traceId: string;
}
export declare function runApprovalAgent(adapter: ILlmAdapter, riskLevel: string, flagsCount: number, contractId: string, traceId: string): Promise<ApprovalAgentResult>;
//# sourceMappingURL=approvalAgent.d.ts.map