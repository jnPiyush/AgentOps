import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export interface AgentDefinition {
	readonly name: string;
	readonly role: string;
	readonly mcpServer: string;
	readonly tools: string[];
	readonly systemPromptFile: string;
}

export const AGENTS: Record<string, AgentDefinition> = {
	intake: {
		name: "Intake Agent",
		role: "Classify contracts by type and extract initial metadata",
		mcpServer: "contract-intake-mcp",
		tools: ["upload_contract", "classify_document", "extract_metadata"],
		systemPromptFile: "intake-system.md",
	},
	drafting: {
		name: "Drafting Agent",
		role: "Assemble the first-pass draft package and recommend approved clause language",
		mcpServer: "contract-extraction-mcp",
		tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
		systemPromptFile: "drafting-system.md",
	},
	extraction: {
		name: "Extraction Agent",
		role: "Extract key clauses, parties, dates, and monetary values",
		mcpServer: "contract-extraction-mcp",
		tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
		systemPromptFile: "extraction-system.md",
	},
	review: {
		name: "Internal Review Agent",
		role: "Summarize redlines, version differences, and internal review outcomes",
		mcpServer: "contract-audit-mcp",
		tools: ["get_audit_log", "create_audit_entry"],
		systemPromptFile: "review-system.md",
	},
	compliance: {
		name: "Compliance Agent",
		role: "Check extracted terms against company policies and flag risks",
		mcpServer: "contract-compliance-mcp",
		tools: ["check_policy", "flag_risk", "get_policy_rules"],
		systemPromptFile: "compliance-system.md",
	},
	negotiation: {
		name: "Negotiation Agent",
		role: "Assess counterparty changes and recommend fallback positions",
		mcpServer: "contract-workflow-mcp",
		tools: ["notify_stakeholder", "route_approval"],
		systemPromptFile: "negotiation-system.md",
	},
	approval: {
		name: "Approval Agent",
		role: "Route contracts for approval or escalate to human review",
		mcpServer: "contract-workflow-mcp",
		tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
		systemPromptFile: "approval-system.md",
	},
	signature: {
		name: "Signature Agent",
		role: "Coordinate execution milestones, signature status, and reminder actions",
		mcpServer: "contract-workflow-mcp",
		tools: ["notify_stakeholder", "create_audit_entry"],
		systemPromptFile: "signature-system.md",
	},
	obligations: {
		name: "Obligations Agent",
		role: "Convert final contract commitments into tracked obligations and owners",
		mcpServer: "contract-workflow-mcp",
		tools: ["notify_stakeholder", "create_audit_entry"],
		systemPromptFile: "obligations-system.md",
	},
	renewal: {
		name: "Renewal Agent",
		role: "Detect renewal and expiry risk and prepare alerts before deadlines are missed",
		mcpServer: "contract-drift-mcp",
		tools: ["detect_drift", "model_swap_analysis"],
		systemPromptFile: "renewal-system.md",
	},
	analytics: {
		name: "Analytics Agent",
		role: "Summarize lifecycle outcomes, evaluation signals, and operational insights",
		mcpServer: "contract-eval-mcp",
		tools: ["run_evaluation", "get_baseline"],
		systemPromptFile: "analytics-system.md",
	},
};

export async function loadSystemPrompt(agentKey: string): Promise<string> {
	const agent = AGENTS[agentKey];
	if (!agent) throw new Error(`Unknown agent: ${agentKey}`);

	const promptPath = resolve(PROMPTS_DIR, agent.systemPromptFile);
	return readFile(promptPath, "utf-8");
}

export function getAgentPipeline(): string[] {
	return ["intake", "extraction", "review", "compliance", "negotiation", "approval"];
}
