/**
 * Microsoft Agent Framework – Workflow Orchestration
 *
 * Direct TypeScript port of agents/microsoft-framework/workflows.py
 * (WorkflowStatus, HITLDecision, WorkflowContext,
 *  ContractProcessingStep, ContractProcessingWorkflow).
 */

import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { getFrameworkSettings } from "./config.js";
import { createAgent } from "./agentFactory.js";
import type { DeclarativeContractAgent } from "./declarativeAgent.js";

// ---------------------------------------------------------------------------
// Enums & Models  (mirrors Python WorkflowStatus, HITLDecision, WorkflowContext)
// ---------------------------------------------------------------------------

export type WorkflowStatus =
	| "pending"
	| "running"
	| "waiting_approval"
	| "completed"
	| "failed"
	| "cancelled";

export interface HITLDecision {
	decision: "PROCEED" | "REJECT" | "MODIFY";
	reviewer: string;
	timestamp: string;
	comments?: string;
	modifications?: Record<string, unknown>;
}

export interface WorkflowContext {
	workflowId: string;
	contractId: string;
	status: WorkflowStatus;
	currentStep: number;
	totalSteps: number;
	startedAt: string;
	updatedAt: string;
	results: Record<string, unknown>;
	errors: string[];
	hitlDecisions: HITLDecision[];
}

// ---------------------------------------------------------------------------
// Workflow Step  (mirrors Python ContractProcessingStep)
// ---------------------------------------------------------------------------

export interface StepConfig {
	name: string;
	agent_type: string;
	required_inputs: string[];
	output_key: string;
	hitl_required?: boolean;
	retry_count?: number;
}

export class ContractProcessingStep {
	readonly stepName: string;
	readonly agentType: string;
	readonly requiredInputs: string[];
	readonly outputKey: string;
	readonly hitlRequired: boolean;
	readonly retryCount: number;
	private agent: DeclarativeContractAgent;

	constructor(cfg: StepConfig) {
		this.stepName = cfg.name;
		this.agentType = cfg.agent_type;
		this.requiredInputs = cfg.required_inputs;
		this.outputKey = cfg.output_key;
		this.hitlRequired = cfg.hitl_required ?? false;
		this.retryCount = cfg.retry_count ?? 3;
		this.agent = createAgent(this.agentType);
	}

	async execute(ctx: WorkflowContext): Promise<Record<string, unknown>> {
		const missing = this.requiredInputs.filter((k) => !(k in ctx.results));
		if (missing.length > 0) {
			throw new Error(`Missing required inputs: ${missing.join(", ")}`);
		}

		const agentInput: Record<string, unknown> = {};
		for (const key of this.requiredInputs) {
			agentInput[key] = ctx.results[key];
		}

		let lastError: Error | undefined;
		for (let attempt = 0; attempt < this.retryCount; attempt++) {
			try {
				const result = await this.agent.execute(agentInput);

				if (this.hitlRequired) {
					return { [this.outputKey]: await this.handleHitl(ctx, result) };
				}
				return { [this.outputKey]: result };
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
				if (attempt < this.retryCount - 1) {
					await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
				}
			}
		}
		throw lastError;
	}

	private async handleHitl(
		ctx: WorkflowContext,
		result: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		// Simulated HITL approval  (mirrors Python _handle_hitl_checkpoint)
		const decision: HITLDecision = {
			decision: "PROCEED",
			reviewer: "demo-reviewer",
			timestamp: new Date().toISOString(),
			comments: "Simulated approval for demo",
		};
		ctx.hitlDecisions.push(decision);

		if (decision.decision === "REJECT") {
			throw new Error("Human reviewer rejected the result");
		}
		if (decision.decision === "MODIFY" && decision.modifications) {
			return { ...result, ...decision.modifications };
		}
		return result;
	}
}

// ---------------------------------------------------------------------------
// Workflow Orchestrator  (mirrors Python ContractProcessingWorkflow)
// ---------------------------------------------------------------------------

export class ContractProcessingWorkflow {
	readonly steps: ContractProcessingStep[];

	constructor(steps: ContractProcessingStep[]) {
		this.steps = steps;
	}

	static async fromYaml(yamlPath?: string): Promise<ContractProcessingWorkflow> {
		const settings = getFrameworkSettings();
		const path = yamlPath ?? `${settings.workflowsConfigDir}/contract-processing.yaml`;

		let stepConfigs: StepConfig[];
		try {
			const raw = await readFile(path, "utf-8");
			const parsed = parseYaml(raw) as { steps?: StepConfig[] } | null;
			stepConfigs = parsed?.steps ?? [];
		} catch {
			stepConfigs = defaultStepConfigs();
		}

		return new ContractProcessingWorkflow(stepConfigs.map((c) => new ContractProcessingStep(c)));
	}

	async execute(
		contractData: Record<string, unknown>,
		workflowId?: string,
	): Promise<WorkflowContext> {
		const id = workflowId ?? `workflow_${Date.now()}`;
		const now = new Date().toISOString();

		const ctx: WorkflowContext = {
			workflowId: id,
			contractId: (contractData.contract_id as string) ?? "unknown",
			status: "pending",
			currentStep: 0,
			totalSteps: this.steps.length,
			startedAt: now,
			updatedAt: now,
			results: { ...contractData },
			errors: [],
			hitlDecisions: [],
		};

		ctx.status = "running";
		for (let i = 0; i < this.steps.length; i++) {
			ctx.currentStep = i + 1;
			ctx.updatedAt = new Date().toISOString();
			try {
				const stepResult = await this.steps[i].execute(ctx);
				Object.assign(ctx.results, stepResult);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.errors.push(`Step ${this.steps[i].stepName}: ${msg}`);
				ctx.status = "failed";
				ctx.updatedAt = new Date().toISOString();
				throw err;
			}
		}

		ctx.status = "completed";
		ctx.updatedAt = new Date().toISOString();
		return ctx;
	}
}

// ---------------------------------------------------------------------------
// Default step configs  (fallback when YAML is missing – matches Python default)
// ---------------------------------------------------------------------------

function defaultStepConfigs(): StepConfig[] {
	return [
		{ name: "intake", agent_type: "intake", required_inputs: ["document_text", "document_name"], output_key: "contract_metadata", hitl_required: false },
		{ name: "extraction", agent_type: "extraction", required_inputs: ["contract_metadata", "document_text"], output_key: "extracted_data", hitl_required: false },
		{ name: "compliance", agent_type: "compliance", required_inputs: ["extracted_data", "contract_metadata"], output_key: "compliance_assessment", hitl_required: true },
		{ name: "approval", agent_type: "approval", required_inputs: ["compliance_assessment", "extracted_data"], output_key: "approval_decision", hitl_required: true },
	];
}
