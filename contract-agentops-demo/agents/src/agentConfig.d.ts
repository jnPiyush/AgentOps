export interface AgentDefinition {
    readonly name: string;
    readonly role: string;
    readonly mcpServer: string;
    readonly tools: string[];
    readonly systemPromptFile: string;
}
export declare const AGENTS: Record<string, AgentDefinition>;
export declare function loadSystemPrompt(agentKey: string): Promise<string>;
export declare function getAgentPipeline(): string[];
//# sourceMappingURL=agentConfig.d.ts.map