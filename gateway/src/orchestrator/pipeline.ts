import { randomUUID } from "node:crypto";
import { runApprovalAgent } from "../../../agents/src/approvalAgent.js";
import { runComplianceAgent } from "../../../agents/src/complianceAgent.js";
import { runExtractionAgent } from "../../../agents/src/extractionAgent.js";
import { runIntakeAgent } from "../../../agents/src/intakeAgent.js";
import { runNegotiationAgent } from "../../../agents/src/negotiationAgent.js";
import { runReviewAgent } from "../../../agents/src/reviewAgent.js";
import { TrackingAdapter } from "../adapters/trackingAdapter.js";
import { auditStore, contractStore, hydrateContractText, saveContractText } from "../stores/contractStore.js";
import type { AuditEntry, Contract, ILlmAdapter, TraceEntry, WebSocketEvent } from "../types.js";

export type WsBroadcast = (event: WebSocketEvent) => void;

interface RetryConfig {
	maxRetries: number;
	baseDelayMs: number;
	maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 10000,
};

class PipelineError extends Error {
	constructor(
		public stage: string,
		public agent: string,
		public originalError: Error,
		public contractId: string,
	) {
		super(`Pipeline failed at ${stage} (${agent}): ${originalError.message}`);
		this.name = "PipelineError";
	}
}

async function withRetry<T>(
	operation: () => Promise<T>,
	stage: string,
	agent: string,
	contractId: string,
	config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
	let lastError: Error = new Error("All retries exhausted");

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < config.maxRetries) {
				const delay = Math.min(config.baseDelayMs * 2 ** attempt, config.maxDelayMs);

				await logAudit(
					contractId,
					agent as AuditEntry["agent"],
					"error",
					`Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms`,
				);

				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	throw new PipelineError(stage, agent, lastError, contractId);
}

export interface PipelineResult {
	contract: Contract;
	traces: TraceEntry[];
}

export async function runPipeline(
	contractText: string,
	filename: string,
	adapter: ILlmAdapter,
	broadcast: WsBroadcast,
	providedContractId?: string,
): Promise<PipelineResult> {
	const contractId = providedContractId ?? `contract-${randomUUID().slice(0, 8)}`;
	const traceId = `trace-${randomUUID().slice(0, 8)}`;
	const traces: TraceEntry[] = [];

	await saveContractText(contractId, contractText);

	const contract: Contract = {
		id: contractId,
		filename,
		status: "processing",
		submitted_at: new Date().toISOString(),
	};
	await contractStore.add(contract);

	const tracker = new TrackingAdapter(adapter);

	try {
		broadcast({
			event: "pipeline_status",
			contract_id: contractId,
			status: "processing_started",
			timestamp: new Date().toISOString(),
		});

		// Stage 1: Intake with retry logic
		tracker.reset();
		const intakeStart = Date.now();
		const intakeResult = await withRetry(
			() => runIntakeAgent(tracker, contractText, contractId, traceId),
			"intake",
			"intake",
			contractId,
		);
		const intakeLatency = Date.now() - intakeStart;
		const intakeTokens = tracker.lastResponse;

		// Validate intake result
		if (!intakeResult?.type || intakeResult.confidence < 0.3) {
			throw new Error(`Invalid intake result: type=${intakeResult?.type}, confidence=${intakeResult?.confidence}`);
		}

		traces.push({
			id: randomUUID(),
			contract_id: contractId,
			agent: "intake",
			tool: "classify_document",
			input: { text: contractText.slice(0, 200) },
			output: intakeResult,
			latency_ms: intakeLatency,
			tokens_in: intakeTokens?.tokens_in ?? 0,
			tokens_out: intakeTokens?.tokens_out ?? 0,
			timestamp: new Date().toISOString(),
		});

		await contractStore.update(contractId, {
			type: intakeResult.type as Contract["type"],
			classification_confidence: intakeResult.confidence,
		});

		await logAudit(
			contractId,
			"intake",
			"classified",
			`Classified as ${intakeResult.type} with ${intakeResult.confidence} confidence`,
		);

		broadcast({
			event: "agent_step_complete",
			contract_id: contractId,
			agent: "intake",
			status: "intake_complete",
			result: intakeResult,
			latency_ms: intakeLatency,
			timestamp: new Date().toISOString(),
		});

		// Stage 2: Extraction with retry logic
		tracker.reset();
		const extractStart = Date.now();
		const extractResult = await withRetry(
			() => runExtractionAgent(tracker, contractText, contractId, traceId),
			"extraction",
			"extraction",
			contractId,
		);
		const extractLatency = Date.now() - extractStart;
		const extractTokens = tracker.lastResponse;

		// Validate extraction result
		if (!extractResult?.clauses || extractResult.clauses.length === 0) {
			throw new Error("Invalid extraction result: no clauses extracted");
		}

		traces.push({
			id: randomUUID(),
			contract_id: contractId,
			agent: "extraction",
			tool: "extract_clauses",
			input: { text: contractText.slice(0, 200) },
			output: extractResult,
			latency_ms: extractLatency,
			tokens_in: extractTokens?.tokens_in ?? 0,
			tokens_out: extractTokens?.tokens_out ?? 0,
			timestamp: new Date().toISOString(),
		});

		await logAudit(contractId, "extraction", "extracted", `Extracted ${extractResult.clauses.length} clauses`);

		broadcast({
			event: "agent_step_complete",
			contract_id: contractId,
			agent: "extraction",
			status: "extraction_complete",
			result: extractResult,
			latency_ms: extractLatency,
			timestamp: new Date().toISOString(),
		});

		// Stage 3: Internal Review with retry logic
		tracker.reset();
		const reviewStart = Date.now();
		const reviewResult = await withRetry(
			() => runReviewAgent(tracker, extractResult.clauses, contractId, traceId),
			"review",
			"review",
			contractId,
		);
		const reviewLatency = Date.now() - reviewStart;
		const reviewTokens = tracker.lastResponse;

		traces.push({
			id: randomUUID(),
			contract_id: contractId,
			agent: "review",
			tool: "internal_review",
			input: { clauses_count: extractResult.clauses.length },
			output: reviewResult,
			latency_ms: reviewLatency,
			tokens_in: reviewTokens?.tokens_in ?? 0,
			tokens_out: reviewTokens?.tokens_out ?? 0,
			timestamp: new Date().toISOString(),
		});

		await logAudit(
			contractId,
			"review",
			"reviewed",
			`Review: ${reviewResult.materialChanges.length} material changes, ${reviewResult.unresolvedItems.length} unresolved items`,
		);

		broadcast({
			event: "agent_step_complete",
			contract_id: contractId,
			agent: "review",
			status: "review_complete",
			result: reviewResult,
			latency_ms: reviewLatency,
			timestamp: new Date().toISOString(),
		});

		// Stage 4: Compliance with retry logic
		tracker.reset();
		const complianceStart = Date.now();
		const complianceResult = await withRetry(
			() => runComplianceAgent(tracker, extractResult.clauses, contractId, traceId),
			"compliance",
			"compliance",
			contractId,
		);
		const complianceLatency = Date.now() - complianceStart;
		const complianceTokens = tracker.lastResponse;

		// Validate compliance result
		if (!complianceResult?.overallRisk) {
			throw new Error("Invalid compliance result: missing overall risk assessment");
		}

		traces.push({
			id: randomUUID(),
			contract_id: contractId,
			agent: "compliance",
			tool: "check_policy",
			input: { clauses_count: extractResult.clauses.length },
			output: complianceResult,
			latency_ms: complianceLatency,
			tokens_in: complianceTokens?.tokens_in ?? 0,
			tokens_out: complianceTokens?.tokens_out ?? 0,
			timestamp: new Date().toISOString(),
		});

		await logAudit(
			contractId,
			"compliance",
			"flagged",
			`Risk: ${complianceResult.overallRisk}, Flags: ${complianceResult.flagsCount}`,
		);

		broadcast({
			event: "agent_step_complete",
			contract_id: contractId,
			agent: "compliance",
			status: "compliance_complete",
			result: complianceResult,
			latency_ms: complianceLatency,
			timestamp: new Date().toISOString(),
		});

		// Stage 5: Negotiation with retry logic
		tracker.reset();
		const negotiationStart = Date.now();
		const negotiationResult = await withRetry(
			() =>
				runNegotiationAgent(
					tracker,
					extractResult.clauses,
					complianceResult.overallRisk,
					complianceResult.flagsCount,
					contractId,
					traceId,
				),
			"negotiation",
			"negotiation",
			contractId,
		);
		const negotiationLatency = Date.now() - negotiationStart;
		const negotiationTokens = tracker.lastResponse;

		traces.push({
			id: randomUUID(),
			contract_id: contractId,
			agent: "negotiation",
			tool: "assess_negotiation",
			input: {
				risk: complianceResult.overallRisk,
				flags: complianceResult.flagsCount,
				clauses_count: extractResult.clauses.length,
			},
			output: negotiationResult,
			latency_ms: negotiationLatency,
			tokens_in: negotiationTokens?.tokens_in ?? 0,
			tokens_out: negotiationTokens?.tokens_out ?? 0,
			timestamp: new Date().toISOString(),
		});

		await logAudit(
			contractId,
			"negotiation",
			"negotiated",
			`Negotiation: ${negotiationResult.counterpartyPositions.length} positions, escalation=${negotiationResult.escalationRequired}`,
		);

		broadcast({
			event: "agent_step_complete",
			contract_id: contractId,
			agent: "negotiation",
			status: "negotiation_complete",
			result: negotiationResult,
			latency_ms: negotiationLatency,
			timestamp: new Date().toISOString(),
		});

		// Stage 6: Approval with retry logic
		tracker.reset();
		const approvalStart = Date.now();
		const approvalResult = await withRetry(
			() => runApprovalAgent(tracker, complianceResult.overallRisk, complianceResult.flagsCount, contractId, traceId),
			"approval",
			"approval",
			contractId,
		);
		const approvalLatency = Date.now() - approvalStart;
		const approvalTokens = tracker.lastResponse;

		// Validate approval result
		if (!approvalResult?.action || !["auto_approve", "escalate_to_human"].includes(approvalResult.action)) {
			throw new Error(`Invalid approval result: action=${approvalResult?.action}`);
		}

		traces.push({
			id: randomUUID(),
			contract_id: contractId,
			agent: "approval",
			tool: "route_approval",
			input: {
				risk: complianceResult.overallRisk,
				flags: complianceResult.flagsCount,
			},
			output: approvalResult,
			latency_ms: approvalLatency,
			tokens_in: approvalTokens?.tokens_in ?? 0,
			tokens_out: approvalTokens?.tokens_out ?? 0,
			timestamp: new Date().toISOString(),
		});

		const finalStatus = approvalResult.action === "auto_approve" ? "approved" : "awaiting_review";
		const auditAction = approvalResult.action === "auto_approve" ? "approved" : "escalated";

		await contractStore.update(contractId, {
			status: finalStatus,
			completed_at: finalStatus === "approved" ? new Date().toISOString() : undefined,
		});

		await logAudit(contractId, "approval", auditAction as AuditEntry["action"], approvalResult.reasoning);

		const finalEvent: PipelineStageForBroadcast = finalStatus === "approved" ? "approved" : "awaiting_human_review";

		broadcast({
			event: "agent_step_complete",
			contract_id: contractId,
			agent: "approval",
			status: finalEvent,
			result: approvalResult,
			latency_ms: approvalLatency,
			timestamp: new Date().toISOString(),
		});

		if (finalStatus === "approved") {
			broadcast({
				event: "pipeline_status",
				contract_id: contractId,
				status: "pipeline_complete",
				timestamp: new Date().toISOString(),
			});
		} else {
			broadcast({
				event: "pipeline_status",
				contract_id: contractId,
				status: "awaiting_human_review",
				timestamp: new Date().toISOString(),
			});
		}

		const updatedContract = await hydrateContractText(contractStore.getById(contractId));
		return { contract: updatedContract ?? { ...contract, text: contractText }, traces };
	} catch (error) {
		// Handle pipeline failure
		const pipelineError =
			error instanceof PipelineError
				? error
				: new PipelineError(
						"unknown",
						"pipeline",
						error instanceof Error ? error : new Error(String(error)),
						contractId,
					);

		await contractStore.update(contractId, {
			status: "failed",
			error_message: pipelineError.message,
			completed_at: new Date().toISOString(),
		});

		await logAudit(contractId, pipelineError.agent as AuditEntry["agent"], "error", pipelineError.message);

		broadcast({
			event: "pipeline_status",
			contract_id: contractId,
			status: "pipeline_failed",
			timestamp: new Date().toISOString(),
		});

		throw pipelineError;
	}
}

type PipelineStageForBroadcast = WebSocketEvent["status"];

async function logAudit(
	contractId: string,
	agent: AuditEntry["agent"],
	action: AuditEntry["action"],
	description: string,
) {
	const audit: AuditEntry = {
		id: randomUUID(),
		contract_id: contractId,
		agent,
		action,
		reasoning: description,
		timestamp: new Date().toISOString(),
	};
	await auditStore.add(audit);
}

// --- In-memory trace storage (bounded to prevent memory leaks) ---
const MAX_TRACE_ENTRIES = 500;
const traceMap = new Map<string, TraceEntry[]>();

export function storeTraces(contractId: string, traces: TraceEntry[]): void {
	// Evict oldest entry if at capacity
	if (traceMap.size >= MAX_TRACE_ENTRIES && !traceMap.has(contractId)) {
		const oldest = traceMap.keys().next().value;
		if (oldest !== undefined) {
			traceMap.delete(oldest);
		}
	}
	traceMap.set(contractId, traces);
}

export function getTraces(contractId: string): TraceEntry[] {
	return traceMap.get(contractId) ?? [];
}
