/**
 * Microsoft Agent Framework – Agent Factory & YAML Loader
 *
 * Direct TypeScript port of agents/microsoft-framework/agents.py
 * (AgentFactory class + load_agent_from_yaml utility).
 *
 * Also provides loadDeployAgentDefs() which reads every YAML file in
 * config/agents/ and returns FrameworkAgentDef[] for the deploy pipeline.
 */

import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { getFrameworkSettings, readJsonAsset, resolveAssetPath, readTextAsset } from "./config.js";
import {
	ContractApprovalAgent,
	ContractComplianceAgent,
	ContractDraftingAgent,
	ContractExtractionAgent,
	ContractIntakeAgent,
	ContractNegotiationAgent,
	ContractReviewAgent,
	DeclarativeContractAgent,
} from "./declarativeAgent.js";
import type { FrameworkAgentDef, YamlAgentDefinition } from "./types.js";

// ---------------------------------------------------------------------------
// Agent Registry  (mirrors Python AgentFactory._agent_registry)
// ---------------------------------------------------------------------------

type AgentCtor = new (modelType?: "primary" | "fallback" | "emergency") => DeclarativeContractAgent;

const AGENT_REGISTRY: Record<string, AgentCtor> = {
	intake: ContractIntakeAgent,
	drafting: ContractDraftingAgent,
	extraction: ContractExtractionAgent,
	review: ContractReviewAgent,
	compliance: ContractComplianceAgent,
	negotiation: ContractNegotiationAgent,
	approval: ContractApprovalAgent,
};

// ---------------------------------------------------------------------------
// Factory helpers  (mirrors Python AgentFactory classmethod API)
// ---------------------------------------------------------------------------

export function createAgent(
	agentType: string,
	modelType: "primary" | "fallback" | "emergency" = "primary",
): DeclarativeContractAgent {
	const Ctor = AGENT_REGISTRY[agentType];
	if (!Ctor) {
		throw new Error(
			`Unknown agent type: ${agentType}. Available: ${Object.keys(AGENT_REGISTRY).join(", ")}`,
		);
	}
	return new Ctor(modelType);
}

export function listAvailableAgents(): string[] {
	return Object.keys(AGENT_REGISTRY);
}

export function registerAgent(agentType: string, ctor: AgentCtor): void {
	AGENT_REGISTRY[agentType] = ctor;
}

// ---------------------------------------------------------------------------
// YAML Loader  (mirrors Python load_agent_from_yaml)
// ---------------------------------------------------------------------------

export async function loadAgentFromYaml(yamlPath: string): Promise<DeclarativeContractAgent> {
	const resolvedPath = resolveAssetPath(yamlPath);
	const raw = await readFile(resolvedPath, "utf-8");
	const def = parseYaml(raw) as YamlAgentDefinition | null;
	if (!def) throw new Error(`Empty YAML file: ${resolvedPath}`);

	const agentId = def.agent_id?.trim();
	if (!agentId) throw new Error(`agent_id is required in ${resolvedPath}`);

	// Validate referenced assets exist
	const refs = [
		def.prompts?.system_prompt,
		def.prompts?.output_template,
		def.prompts?.few_shot_examples,
		def.behavior?.output_schema,
	].filter(Boolean) as string[];

	const missing: string[] = [];
	for (const ref of refs) {
		try {
			await readTextAsset(ref);
		} catch {
			missing.push(ref);
		}
	}
	if (missing.length > 0) {
		throw new Error(`Agent config ${resolvedPath} references missing assets: ${missing.join(", ")}`);
	}

	// Validate JSON assets parse correctly
	if (def.behavior?.output_schema) await readJsonAsset(def.behavior.output_schema as string);
	if (def.prompts?.output_template) await readJsonAsset(def.prompts.output_template);
	if (def.prompts?.few_shot_examples) await readJsonAsset(def.prompts.few_shot_examples);

	const agent = createAgent(agentId);
	if (def.model) agent.applyModelSettings(def.model as Record<string, unknown>);
	agent.yamlDef = def;
	return agent;
}

// ---------------------------------------------------------------------------
// Deploy-pipeline integration
// ---------------------------------------------------------------------------

/**
 * Default evaluation prompts keyed by agent_id.
 * These are used by the deploy pipeline's quick-evaluation stage.
 */
const DEFAULT_EVAL_PROMPTS: Record<string, string> = {
	intake:
		'Classify this agreement: "This Non-Disclosure Agreement is entered into between Acme Corp and Beta Inc, effective January 1, 2025, for two years."',
	drafting:
		"Assemble a first-pass draft package for this vendor services contract and recommend approved clause language for the indemnification section.",
	extraction:
		'Extract all key clauses, parties, dates, and monetary values from this agreement: "This Master Services Agreement between TechCorp and ClientCo is effective January 1, 2025, with a total contract value of $500,000 USD and auto-renewal every 12 months."',
	review:
		"Summarize the internal redlines for a vendor contract and identify the top three items that need legal review before compliance routing.",
	compliance:
		'Assess this clause for policy risk: "Vendor liability is capped at $10,000,000 and personal data may be transferred outside approved jurisdictions."',
	negotiation:
		"Assess counterparty markup that removes audit rights and increases termination notice periods, then recommend fallback language for the negotiator.",
	approval:
		'Route this contract for approval: "The contract includes a data transfer exception, a high liability cap, and two unresolved compliance warnings."',
	signature:
		"Track the signature status for the NDA between Acme Corp and Beta Inc and send a reminder to the missing signatory.",
	obligations:
		"Convert the final NDA commitments into tracked obligations with owners and due dates.",
	renewal:
		"Analyze the upcoming renewal for Service Agreement SA-2025 and flag any drift from the original baseline.",
	analytics:
		"Run a baseline evaluation on the intake agent and compare it with the last known accuracy benchmark.",
};

/**
 * Read every YAML in config/agents/ and produce the FrameworkAgentDef[]
 * array consumed by foundryDeploy.ts.
 */
export async function loadDeployAgentDefs(): Promise<FrameworkAgentDef[]> {
	const settings = getFrameworkSettings();
	const dir = settings.agentsConfigDir;

	let files: string[];
	try {
		files = (await readdir(dir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
	} catch {
		return [];
	}

	const defs: FrameworkAgentDef[] = [];

	for (const file of files) {
		const raw = await readFile(resolve(dir, file), "utf-8");
		const yaml = parseYaml(raw) as YamlAgentDefinition | null;
		if (!yaml?.agent_id) continue;

		const key = yaml.agent_id;
		const name = yaml.name ?? key;

		// Derive prompt filename from the prompts.system_prompt path
		// e.g. "prompts/intake-system.md" → "intake-system.md"
		let promptFile = `${key.replace(/_/g, "-")}-system.md`;
		if (yaml.prompts?.system_prompt) {
			promptFile = basename(yaml.prompts.system_prompt);
		}

		const tools = (yaml.tools ?? []).map((t) => t.name);
		const evalPrompt = DEFAULT_EVAL_PROMPTS[key] ?? `Evaluate the ${name} with a representative contract scenario.`;

		defs.push({ key, name, promptFile, tools, evalPrompt });
	}

	return defs;
}
