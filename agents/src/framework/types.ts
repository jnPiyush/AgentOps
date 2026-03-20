/**
 * Microsoft Agent Framework – Structured Output Models & YAML Types
 *
 * Direct TypeScript port of agents/microsoft-framework/agents.py Pydantic models
 * and the YAML agent-definition schema used by config/agents/*.yaml.
 */

// ---------------------------------------------------------------------------
// Structured Output Models  (mirrors Pydantic BaseModel classes in agents.py)
// ---------------------------------------------------------------------------

export interface ContractMetadata {
	contract_id: string;
	title: string;
	parties: string[];
	contract_type: string;
	effective_date?: string;
	expiry_date?: string;
	value?: number;
	currency?: string;
	jurisdiction?: string;
	confidence_score: number;
}

export interface ComplianceAssessment {
	overall_score: number;
	policy_violations: string[];
	recommendations: string[];
	risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	approval_required: boolean;
	blocking_issues: string[];
}

export interface ApprovalDecision {
	decision: "APPROVE" | "REJECT" | "CONDITIONAL";
	confidence: number;
	reasoning: string;
	conditions: string[];
	escalation_required: boolean;
	next_actions: string[];
}

export interface ExtractedClause {
	type: string;
	text: string;
	section: string;
}

export interface ExtractedValue {
	label: string;
	value: number | string;
}

export interface ExtractionResult {
	clauses: ExtractedClause[];
	parties: string[];
	dates: string[];
	values: ExtractedValue[];
	confidence: number;
}

// ---------------------------------------------------------------------------
// YAML Agent Definition  (shape produced by config/agents/*.yaml files)
// ---------------------------------------------------------------------------

export interface YamlToolBinding {
	name: string;
	mcp_server?: string;
	description?: string;
	required?: boolean;
	timeout?: string;
}

export interface YamlAgentDefinition {
	agent_id: string;
	name: string;
	version?: string;
	created?: string;

	model?: {
		provider?: string;
		name?: string;
		temperature?: number;
		max_tokens?: number;
		top_p?: number;
		response_format?: string;
		timeout?: string;
	};

	prompts?: {
		system_prompt?: string;
		output_template?: string;
		few_shot_examples?: string;
	};

	tools?: YamlToolBinding[];

	behavior?: {
		role?: string;
		boundary?: string;
		output_schema?: string;
		validation?: Record<string, unknown>;
		retry_policy?: Record<string, unknown>;
		performance?: Record<string, unknown>;
	};

	workflow?: Record<string, unknown>;
	observability?: Record<string, unknown>;
	security?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Deploy-pipeline agent definition  (consumed by foundryDeploy.ts)
// ---------------------------------------------------------------------------

export interface FrameworkAgentDef {
	key: string;
	name: string;
	promptFile: string;
	tools: string[];
	evalPrompt: string;
}
