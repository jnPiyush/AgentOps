/**
 * Microsoft Agent Framework – Declarative Contract Agents
 *
 * Direct TypeScript port of agents/microsoft-framework/agents.py
 * (DeclarativeContractAgent base class + concrete agent subclasses).
 *
 * This file is SELF-CONTAINED – it only imports from the framework's
 * own config.ts / types.ts and Node built-ins.  No references to
 * agents/src/agentConfig.ts or any other agents/src/ modules.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	getFrameworkSettings,
	getModelConfig,
	readTextAsset,
	type ModelConfig,
} from "./config.js";
import type {
	ApprovalDecision,
	ComplianceAssessment,
	ContractMetadata,
	ExtractionResult,
	YamlAgentDefinition,
} from "./types.js";

// ---------------------------------------------------------------------------
// Mock framework primitives  (mirrors Python's mock Tool / Agent / OpenAIChatClient)
// ---------------------------------------------------------------------------

interface ToolDef {
	name: string;
	description: string;
}

// ---------------------------------------------------------------------------
// Base Agent  (mirrors Python DeclarativeContractAgent)
// ---------------------------------------------------------------------------

export class DeclarativeContractAgent {
	agentId: string;
	modelConfig: ModelConfig;
	tools: ToolDef[];
	systemPrompt: string;
	yamlDef?: YamlAgentDefinition;

	constructor(agentName: string, modelType: "primary" | "fallback" | "emergency" = "primary") {
		this.agentId = agentName;
		this.modelConfig = getModelConfig(modelType);
		this.tools = this.loadTools();
		this.systemPrompt = "";
	}

	/**
	 * Apply declarative YAML model overrides at runtime.
	 * Mirrors Python apply_model_settings().
	 */
	applyModelSettings(modelSettings: Record<string, unknown>): void {
		let timeout = this.modelConfig.timeout;
		const raw = modelSettings.timeout;
		if (typeof raw === "string" && raw.endsWith("s")) {
			const parsed = Number.parseInt(raw.slice(0, -1), 10);
			if (!Number.isNaN(parsed)) timeout = parsed;
		} else if (typeof raw === "number") {
			timeout = raw;
		}

		this.modelConfig = {
			...this.modelConfig,
			model: (modelSettings.name as string) ?? this.modelConfig.model,
			temperature: (modelSettings.temperature as number) ?? this.modelConfig.temperature,
			maxTokens: (modelSettings.max_tokens as number) ?? this.modelConfig.maxTokens,
			timeout,
		};
	}

	/**
	 * Load system prompt from file.
	 * Mirrors Python _load_system_prompt():
	 *   config.prompts_dir / f"{agent_name.replace('_','-')}-system.md"
	 */
	async loadPrompt(): Promise<string> {
		if (this.systemPrompt) return this.systemPrompt;

		// 1. YAML-declared prompt path takes priority
		if (this.yamlDef?.prompts?.system_prompt) {
			try {
				this.systemPrompt = await readTextAsset(this.yamlDef.prompts.system_prompt);
				return this.systemPrompt;
			} catch {
				// Fall through to convention-based loading
			}
		}

		// 2. Convention: prompts/{agent-id}-system.md  (Python framework pattern)
		const settings = getFrameworkSettings();
		const baseName = this.agentId.replace(/_/g, "-");
		const primaryFile = resolve(settings.promptsDir, `${baseName}-system.md`);
		try {
			this.systemPrompt = await readFile(primaryFile, "utf-8");
			return this.systemPrompt;
		} catch {
			// 3. Legacy fallback: prompts/{agent-id}.md
			const legacyFile = resolve(settings.promptsDir, `${baseName}.md`);
			try {
				this.systemPrompt = await readFile(legacyFile, "utf-8");
				return this.systemPrompt;
			} catch {
				throw new Error(`System prompt file not found: ${primaryFile}`);
			}
		}
	}

	/** Override in subclasses to return agent-specific MCP tools. */
	protected loadTools(): ToolDef[] {
		return [];
	}

	/** Override in subclasses to return structured output type name. */
	getOutputSchemaName(): string | undefined {
		return undefined;
	}

	/** Execute the agent (mock – matches Python's Agent.run). */
	async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
		return { status: "completed", data: input, agent: this.agentId };
	}
}

// ---------------------------------------------------------------------------
// Concrete Agent Subclasses  (mirrors Python Intake / Extraction / … agents)
// ---------------------------------------------------------------------------

export class ContractIntakeAgent extends DeclarativeContractAgent {
	constructor(modelType: "primary" | "fallback" | "emergency" = "primary") {
		super("intake", modelType);
	}
	protected loadTools(): ToolDef[] {
		return [
			{ name: "upload_contract", description: "Upload contract document for processing" },
			{ name: "classify_document", description: "Classify contract by type" },
			{ name: "extract_metadata", description: "Extract parties, dates, jurisdiction metadata" },
		];
	}
	getOutputSchemaName(): string { return "ContractMetadata"; }
}

export class ContractDraftingAgent extends DeclarativeContractAgent {
	constructor(modelType: "primary" | "fallback" | "emergency" = "primary") {
		super("drafting", modelType);
	}
	protected loadTools(): ToolDef[] {
		return [
			{ name: "extract_clauses", description: "Extract clauses from a contract" },
			{ name: "identify_parties", description: "Identify contracting parties" },
			{ name: "extract_dates_values", description: "Extract dates and monetary values" },
		];
	}
}

export class ContractExtractionAgent extends DeclarativeContractAgent {
	constructor(modelType: "primary" | "fallback" | "emergency" = "primary") {
		super("extraction", modelType);
	}
	protected loadTools(): ToolDef[] {
		return [
			{ name: "extract_clauses", description: "Extract clauses from a contract" },
			{ name: "identify_parties", description: "Identify contracting parties" },
			{ name: "extract_dates_values", description: "Extract dates and monetary values" },
		];
	}
	getOutputSchemaName(): string { return "ExtractionResult"; }
}

export class ContractReviewAgent extends DeclarativeContractAgent {
	constructor(modelType: "primary" | "fallback" | "emergency" = "primary") {
		super("review", modelType);
	}
	protected loadTools(): ToolDef[] {
		return [
			{ name: "get_audit_log", description: "Retrieve audit trail" },
			{ name: "create_audit_entry", description: "Log audit decision" },
		];
	}
}

export class ContractComplianceAgent extends DeclarativeContractAgent {
	constructor(modelType: "primary" | "fallback" | "emergency" = "primary") {
		super("compliance", modelType);
	}
	protected loadTools(): ToolDef[] {
		return [
			{ name: "check_policy", description: "Check clause against policy" },
			{ name: "flag_risk", description: "Flag contract risks" },
			{ name: "get_policy_rules", description: "Retrieve policy rules" },
		];
	}
	getOutputSchemaName(): string { return "ComplianceAssessment"; }
}

export class ContractNegotiationAgent extends DeclarativeContractAgent {
	constructor(modelType: "primary" | "fallback" | "emergency" = "primary") {
		super("negotiation", modelType);
	}
	protected loadTools(): ToolDef[] {
		return [
			{ name: "route_approval", description: "Route for approval" },
			{ name: "notify_stakeholder", description: "Send stakeholder notification" },
		];
	}
}

export class ContractApprovalAgent extends DeclarativeContractAgent {
	constructor(modelType: "primary" | "fallback" | "emergency" = "primary") {
		super("approval", modelType);
	}
	protected loadTools(): ToolDef[] {
		return [
			{ name: "route_approval", description: "Route for approval" },
			{ name: "escalate_to_human", description: "Escalate for human review" },
			{ name: "notify_stakeholder", description: "Send stakeholder notification" },
		];
	}
	getOutputSchemaName(): string { return "ApprovalDecision"; }
}

// Suppress unused-import warnings – these types are the structured outputs
// the agents resolve to at runtime and are re-exported from the barrel.
void (0 as unknown as ContractMetadata);
void (0 as unknown as ComplianceAssessment);
void (0 as unknown as ApprovalDecision);
void (0 as unknown as ExtractionResult);
