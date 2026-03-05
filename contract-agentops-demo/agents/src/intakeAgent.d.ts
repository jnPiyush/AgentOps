import type { ILlmAdapter } from "../../gateway/src/types.js";
export interface IntakeResult {
    contractId: string;
    type: string;
    confidence: number;
    parties: string[];
    metadata: Record<string, string>;
    traceId: string;
}
export declare function runIntakeAgent(adapter: ILlmAdapter, contractText: string, contractId: string, traceId: string): Promise<IntakeResult>;
//# sourceMappingURL=intakeAgent.d.ts.map