import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { appConfig } from "../config.js";
import { JsonStore } from "../stores/jsonStore.js";

export interface WorkflowAgent {
	id: string;
	name: string;
	role: string;
	icon: string;
	model: string;
	tools: string[];
	boundary: string;
	output: string;
	color: string;
	kind?: "agent" | "orchestrator" | "human" | "merge";
	stage?: number;
	lane?: number;
	order: number;
}

export interface WorkflowDefinition {
	id: string;
	name: string;
	type: string;
	agents: WorkflowAgent[];
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface RuntimeAgentBinding {
	id: string;
	name: string;
	role: string;
	kind: "agent" | "orchestrator" | "human" | "merge";
	stage: number;
	lane: number;
	order: number;
	model: string;
	tools: string[];
	boundary: string;
	output: string;
	runtime_role_key: string;
	declarative: {
		agent_config?: string;
		prompt?: string;
		output_schema?: string;
	};
}

export interface WorkflowPackage {
	id: string;
	workflow_id: string;
	workflow_name: string;
	workflow_version: string;
	activated_at: string;
	authoring_source: {
		workflow_definition_id: string;
		updated_at: string;
	};
	execution_topology: string;
	mode_policy: {
		mode: "live" | "simulated";
		supported_modes: Array<"live" | "simulated">;
	};
	model_policy: {
		primary_model: string;
		fallback_model: string;
		emergency_model: string;
	};
	hitl_policy: {
		enabled: boolean;
		reviewer_role: string;
		timeout_hours: number;
		escalation_email: string;
		checkpoints: string[];
	};
	manifest_references: string[];
	policy_references: string[];
	agents: RuntimeAgentBinding[];
}

interface RoleAssetDefinition {
	agentConfig: string;
	prompt: string;
	outputSchema: string;
}

const workflowStore = new JsonStore<WorkflowDefinition>(
	resolve(appConfig.dataDir, "workflows", "definitions.json"),
);
const runtimeDir = resolve(appConfig.dataDir, "runtime");
const activePackagePath = resolve(runtimeDir, "active-workflow.json");
const packagesDir = resolve(runtimeDir, "packages");

const roleAssetMap: Record<string, RoleAssetDefinition> = {
	intake: {
		agentConfig: "config/agents/intake-agent.yaml",
		prompt: "prompts/intake-system.md",
		outputSchema: "config/schemas/intake-result.json",
	},
	extraction: {
		agentConfig: "config/agents/extraction-agent.yaml",
		prompt: "prompts/extraction-system.md",
		outputSchema: "config/schemas/extraction-result.json",
	},
	compliance: {
		agentConfig: "config/agents/compliance-agent.yaml",
		prompt: "prompts/compliance-system.md",
		outputSchema: "config/schemas/compliance-result.json",
	},
	approval: {
		agentConfig: "config/agents/approval-agent.yaml",
		prompt: "prompts/approval-system.md",
		outputSchema: "config/schemas/approval-result.json",
	},
};

let initialized = false;
let activePackageCache: WorkflowPackage | null = null;

function normalizeText(value: string): string {
	return value.trim().toLowerCase();
}

function inferRoleKey(agent: WorkflowAgent): string {
	const tools = new Set(agent.tools.map((tool) => normalizeText(tool)));
	const name = normalizeText(agent.name);
	const role = normalizeText(agent.role);

	if (
		tools.has("upload_contract") ||
		tools.has("classify_document") ||
		name.includes("intake") ||
		role.includes("classif")
	) {
		return "intake";
	}

	if (
		tools.has("extract_clauses") ||
		tools.has("identify_parties") ||
		name.includes("extract") ||
		role.includes("extract")
	) {
		return "extraction";
	}

	if (
		tools.has("check_policy") ||
		tools.has("flag_risk") ||
		name.includes("compliance") ||
		role.includes("compliance")
	) {
		return "compliance";
	}

	if (
		tools.has("route_approval") ||
		tools.has("escalate_to_human") ||
		name.includes("approval") ||
		role.includes("approval")
	) {
		return "approval";
	}

	return agent.kind === "human" ? "human" : agent.kind === "merge" ? "merge" : agent.kind === "orchestrator" ? "orchestrator" : "custom";
}

function buildRuntimeAgentBinding(agent: WorkflowAgent): RuntimeAgentBinding {
	const runtimeRoleKey = inferRoleKey(agent);
	const declarativeAssets = roleAssetMap[runtimeRoleKey];

	return {
		id: agent.id,
		name: agent.name,
		role: agent.role,
		kind: agent.kind ?? "agent",
		stage: agent.stage ?? 0,
		lane: agent.lane ?? 0,
		order: agent.order,
		model: agent.model,
		tools: [...agent.tools],
		boundary: agent.boundary,
		output: agent.output,
		runtime_role_key: runtimeRoleKey,
		declarative: declarativeAssets
			? {
				agent_config: declarativeAssets.agentConfig,
				prompt: declarativeAssets.prompt,
				output_schema: declarativeAssets.outputSchema,
			}
			: {},
	};
}

function buildWorkflowVersion(activatedAt: string): string {
	const compact = activatedAt.replace(/[-:.TZ]/g, "").slice(0, 14);
	return `v-${compact}-${randomUUID().slice(0, 6)}`;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
	try {
		const raw = await readFile(filePath, "utf-8");
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function ensureInitialized(): void {
	if (!initialized) {
		throw new Error("Workflow registry not initialized. Call initWorkflowRegistry() first.");
	}
}

export function validateWorkflowInput(input: {
	name?: string;
	type?: string;
	agents?: WorkflowAgent[];
} | null): string[] {
	const errors: string[] = [];
	if (!input?.name?.trim()) {
		errors.push("Workflow name is required.");
	}
	if (!input?.agents || !Array.isArray(input.agents) || input.agents.length === 0) {
		errors.push("At least one workflow agent is required.");
	}
	if ((input?.agents?.length ?? 0) > 20) {
		errors.push("Maximum 20 agents per workflow.");
	}
	if (!input?.type?.trim()) {
		errors.push("Workflow type is required.");
	}
	if (input?.agents) {
		const ids = new Set<string>();
		for (const agent of input.agents) {
			if (!agent.id?.trim()) {
				errors.push("Every workflow agent requires an id.");
			}
			if (ids.has(agent.id)) {
				errors.push(`Duplicate workflow agent id: ${agent.id}`);
			}
			ids.add(agent.id);
			if (!agent.name?.trim()) {
				errors.push(`Workflow agent ${agent.id || "<unknown>"} requires a name.`);
			}
			if (!agent.role?.trim()) {
				errors.push(`Workflow agent ${agent.id || "<unknown>"} requires a role.`);
			}
			if (!Array.isArray(agent.tools)) {
				errors.push(`Workflow agent ${agent.id || "<unknown>"} must define a tools array.`);
			}
		}
	}
	return errors;
}

export function buildWorkflowPackage(workflow: WorkflowDefinition): WorkflowPackage {
	const activatedAt = new Date().toISOString();
	const workflowVersion = buildWorkflowVersion(activatedAt);
	const bindings = workflow.agents
		.slice()
		.sort((left, right) => left.order - right.order)
		.map(buildRuntimeAgentBinding);
	const hasApprovalAgent = bindings.some((binding) => binding.runtime_role_key === "approval");

	return {
		id: `pkg-${workflow.id}-${workflowVersion}`,
		workflow_id: workflow.id,
		workflow_name: workflow.name,
		workflow_version: workflowVersion,
		activated_at: activatedAt,
		authoring_source: {
			workflow_definition_id: workflow.id,
			updated_at: workflow.updatedAt,
		},
		execution_topology: workflow.type,
		mode_policy: {
			mode: appConfig.demoMode,
			supported_modes: ["simulated", "live"],
		},
		model_policy: {
			primary_model: appConfig.foundryModel,
			fallback_model: appConfig.foundryModelSwap,
			emergency_model: "gpt-4o-mini",
		},
		hitl_policy: {
			enabled: hasApprovalAgent || workflow.type.includes("hitl"),
			reviewer_role: "legal-reviewer",
			timeout_hours: 24,
			escalation_email: "legal-review@company.com",
			checkpoints: hasApprovalAgent ? ["approval"] : [],
		},
		manifest_references: [
			"config/workflows/contract-processing.yaml",
			"config/schemas/workflow-package.json",
		],
		policy_references: [
			"data/policies/contract_policies.json",
			"data/policies.json",
			"data/clauses.json",
		],
		agents: bindings,
	};
}

export async function initWorkflowRegistry(): Promise<void> {
	if (initialized) {
		return;
	}
	await workflowStore.load();
	activePackageCache = await readJsonFile<WorkflowPackage>(activePackagePath);
	initialized = true;
}

export function listWorkflows(): WorkflowDefinition[] {
	ensureInitialized();
	const activeWorkflowId = activePackageCache?.workflow_id ?? null;
	return workflowStore.getAll().map((workflow) => ({
		...workflow,
		active: workflow.id === activeWorkflowId,
	}));
}

export function getWorkflowById(id: string): WorkflowDefinition | undefined {
	ensureInitialized();
	const workflow = workflowStore.getById(id);
	if (!workflow) {
		return undefined;
	}
	return {
		...workflow,
		active: workflow.id === activePackageCache?.workflow_id,
	};
}

export function getActiveWorkflow(): WorkflowDefinition | undefined {
	ensureInitialized();
	if (!activePackageCache) {
		return undefined;
	}
	return getWorkflowById(activePackageCache.workflow_id);
}

export function getActiveWorkflowPackage(): WorkflowPackage | null {
	ensureInitialized();
	return activePackageCache ? { ...activePackageCache, agents: activePackageCache.agents.map((agent) => ({ ...agent, tools: [...agent.tools], declarative: { ...agent.declarative } })) } : null;
}

export async function saveWorkflowDefinition(input: {
	id?: string;
	name: string;
	type: string;
	agents: WorkflowAgent[];
}): Promise<WorkflowDefinition> {
	ensureInitialized();
	const errors = validateWorkflowInput(input);
	if (errors.length > 0) {
		throw new Error(errors.join(" "));
	}
	const now = new Date().toISOString();
	const existing = input.id ? workflowStore.getById(input.id) : undefined;
	if (existing) {
		const updated = await workflowStore.update(existing.id, {
			name: input.name,
			type: input.type,
			agents: input.agents,
			updatedAt: now,
		});
		if (!updated) {
			throw new Error(`Unable to update workflow ${existing.id}`);
		}
		return getWorkflowById(updated.id) ?? updated;
	}

	const created: WorkflowDefinition = {
		id: input.id || `wf-${randomUUID().slice(0, 8)}`,
		name: input.name,
		type: input.type,
		agents: input.agents,
		active: false,
		createdAt: now,
		updatedAt: now,
	};
	await workflowStore.add(created);
	return created;
}

export async function activateWorkflowDefinition(id: string): Promise<{ workflow: WorkflowDefinition; workflowPackage: WorkflowPackage }> {
	ensureInitialized();
	const workflow = workflowStore.getById(id);
	if (!workflow) {
		throw new Error("Workflow not found");
	}
	const workflowPackage = buildWorkflowPackage(workflow);
	const currentWorkflows = workflowStore.getAll();
	for (const current of currentWorkflows) {
		const shouldBeActive = current.id === id;
		if (current.active !== shouldBeActive) {
			await workflowStore.update(current.id, { active: shouldBeActive });
		}
	}
	await mkdir(packagesDir, { recursive: true });
	await writeJsonFile(resolve(packagesDir, `${workflowPackage.id}.json`), workflowPackage);
	await writeJsonFile(activePackagePath, workflowPackage);
	activePackageCache = workflowPackage;
	const activeWorkflow = getWorkflowById(id);
	if (!activeWorkflow) {
		throw new Error(`Workflow ${id} became unavailable after activation`);
	}
	return { workflow: activeWorkflow, workflowPackage };
}

export async function deleteWorkflowDefinition(id: string): Promise<boolean> {
	ensureInitialized();
	const removed = await workflowStore.remove(id);
	if (!removed) {
		return false;
	}
	if (activePackageCache?.workflow_id === id) {
		activePackageCache = null;
		try {
			await unlink(activePackagePath);
		} catch {
			// Ignore missing active package file.
		}
	}
	return true;
}