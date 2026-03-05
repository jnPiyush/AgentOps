import type { ILlmAdapter, ExtractedClause, ClauseResult } from "../../gateway/src/types.js";
export interface ComplianceAgentResult {
    contractId: string;
    clauseResults: ClauseResult[];
    overallRisk: "low" | "medium" | "high";
    flagsCount: number;
    policyReferences: string[];
    traceId: string;
}
export declare function runComplianceAgent(adapter: ILlmAdapter, clauses: ExtractedClause[], contractId: string, traceId: string): Promise<ComplianceAgentResult>;
//# sourceMappingURL=complianceAgent.d.ts.map