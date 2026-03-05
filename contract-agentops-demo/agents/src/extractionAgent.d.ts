import type { ILlmAdapter, ExtractedClause } from "../../gateway/src/types.js";
export interface ExtractionAgentResult {
    contractId: string;
    clauses: ExtractedClause[];
    parties: string[];
    dates: Record<string, string>;
    values: Record<string, string>;
    traceId: string;
}
export declare function runExtractionAgent(adapter: ILlmAdapter, contractText: string, contractId: string, traceId: string): Promise<ExtractionAgentResult>;
//# sourceMappingURL=extractionAgent.d.ts.map