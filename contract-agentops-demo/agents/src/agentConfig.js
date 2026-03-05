import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");
export const AGENTS = {
    intake: {
        name: "Intake Agent",
        role: "Classify contracts by type and extract initial metadata",
        mcpServer: "contract-intake-mcp",
        tools: ["upload_contract", "classify_document", "extract_metadata"],
        systemPromptFile: "intake-system.md",
    },
    extraction: {
        name: "Extraction Agent",
        role: "Extract key clauses, parties, dates, and monetary values",
        mcpServer: "contract-extraction-mcp",
        tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
        systemPromptFile: "extraction-system.md",
    },
    compliance: {
        name: "Compliance Agent",
        role: "Check extracted terms against company policies and flag risks",
        mcpServer: "contract-compliance-mcp",
        tools: ["check_policy", "flag_risk", "get_policy_rules"],
        systemPromptFile: "compliance-system.md",
    },
    approval: {
        name: "Approval Agent",
        role: "Route contracts for approval or escalate to human review",
        mcpServer: "contract-workflow-mcp",
        tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
        systemPromptFile: "approval-system.md",
    },
};
export async function loadSystemPrompt(agentKey) {
    const agent = AGENTS[agentKey];
    if (!agent)
        throw new Error(`Unknown agent: ${agentKey}`);
    const promptPath = resolve(PROMPTS_DIR, agent.systemPromptFile);
    return readFile(promptPath, "utf-8");
}
export function getAgentPipeline() {
    return ["intake", "extraction", "compliance", "approval"];
}
//# sourceMappingURL=agentConfig.js.map