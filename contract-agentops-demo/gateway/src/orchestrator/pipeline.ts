import { randomUUID } from "node:crypto";
import type {
  Contract,
  AuditEntry,
  TraceEntry,
  WebSocketEvent,
  ILlmAdapter,
} from "../types.js";
import { contractStore, auditStore } from "../stores/contractStore.js";
import { runIntakeAgent } from "../../../agents/src/intakeAgent.js";
import { runExtractionAgent } from "../../../agents/src/extractionAgent.js";
import { runComplianceAgent } from "../../../agents/src/complianceAgent.js";
import { runApprovalAgent } from "../../../agents/src/approvalAgent.js";

export type WsBroadcast = (event: WebSocketEvent) => void;

export interface PipelineResult {
  contract: Contract;
  traces: TraceEntry[];
}

export async function runPipeline(
  contractText: string,
  filename: string,
  adapter: ILlmAdapter,
  broadcast: WsBroadcast,
): Promise<PipelineResult> {
  const contractId = `contract-${randomUUID().slice(0, 8)}`;
  const traceId = `trace-${randomUUID().slice(0, 8)}`;
  const traces: TraceEntry[] = [];

  const contract: Contract = {
    id: contractId,
    filename,
    text: contractText,
    status: "processing",
    submitted_at: new Date().toISOString(),
  };
  await contractStore.add(contract);

  broadcast({
    event: "pipeline_status",
    contract_id: contractId,
    status: "processing_started",
    timestamp: new Date().toISOString(),
  });

  // Stage 1: Intake
  const intakeStart = Date.now();
  const intakeResult = await runIntakeAgent(adapter, contractText, contractId, traceId);
  const intakeLatency = Date.now() - intakeStart;

  traces.push({
    id: randomUUID(),
    contract_id: contractId,
    agent: "intake",
    tool: "classify_document",
    input: { text: contractText.slice(0, 200) },
    output: intakeResult,
    latency_ms: intakeLatency,
    tokens_in: 0,
    tokens_out: 0,
    timestamp: new Date().toISOString(),
  });

  await contractStore.update(contractId, {
    type: intakeResult.type as Contract["type"],
    classification_confidence: intakeResult.confidence,
  });

  await logAudit(contractId, "intake", "classified", `Classified as ${intakeResult.type} with ${intakeResult.confidence} confidence`);

  broadcast({
    event: "agent_step_complete",
    contract_id: contractId,
    agent: "intake",
    status: "intake_complete",
    result: intakeResult,
    latency_ms: intakeLatency,
    timestamp: new Date().toISOString(),
  });

  // Stage 2: Extraction
  const extractStart = Date.now();
  const extractResult = await runExtractionAgent(adapter, contractText, contractId, traceId);
  const extractLatency = Date.now() - extractStart;

  traces.push({
    id: randomUUID(),
    contract_id: contractId,
    agent: "extraction",
    tool: "extract_clauses",
    input: { text: contractText.slice(0, 200) },
    output: extractResult,
    latency_ms: extractLatency,
    tokens_in: 0,
    tokens_out: 0,
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

  // Stage 3: Compliance
  const complianceStart = Date.now();
  const complianceResult = await runComplianceAgent(adapter, extractResult.clauses, contractId, traceId);
  const complianceLatency = Date.now() - complianceStart;

  traces.push({
    id: randomUUID(),
    contract_id: contractId,
    agent: "compliance",
    tool: "check_policy",
    input: { clauses_count: extractResult.clauses.length },
    output: complianceResult,
    latency_ms: complianceLatency,
    tokens_in: 0,
    tokens_out: 0,
    timestamp: new Date().toISOString(),
  });

  await logAudit(contractId, "compliance", "flagged", `Risk: ${complianceResult.overallRisk}, Flags: ${complianceResult.flagsCount}`);

  broadcast({
    event: "agent_step_complete",
    contract_id: contractId,
    agent: "compliance",
    status: "compliance_complete",
    result: complianceResult,
    latency_ms: complianceLatency,
    timestamp: new Date().toISOString(),
  });

  // Stage 4: Approval
  const approvalStart = Date.now();
  const approvalResult = await runApprovalAgent(
    adapter,
    complianceResult.overallRisk,
    complianceResult.flagsCount,
    contractId,
    traceId,
  );
  const approvalLatency = Date.now() - approvalStart;

  traces.push({
    id: randomUUID(),
    contract_id: contractId,
    agent: "approval",
    tool: "route_approval",
    input: { risk: complianceResult.overallRisk, flags: complianceResult.flagsCount },
    output: approvalResult,
    latency_ms: approvalLatency,
    tokens_in: 0,
    tokens_out: 0,
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

  broadcast({
    event: "pipeline_status",
    contract_id: contractId,
    status: "pipeline_complete",
    timestamp: new Date().toISOString(),
  });

  const updatedContract = await contractStore.getById(contractId);
  return { contract: updatedContract ?? contract, traces };
}

type PipelineStageForBroadcast = WebSocketEvent["status"];

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

async function logAudit(
  contractId: string,
  agent: AuditEntry["agent"],
  action: AuditEntry["action"],
  reasoning: string,
): Promise<void> {
  const entry: AuditEntry = {
    id: randomUUID(),
    contract_id: contractId,
    agent,
    action,
    reasoning,
    timestamp: new Date().toISOString(),
  };
  await auditStore.add(entry);
}
