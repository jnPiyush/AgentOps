// Shared types for Contract AgentOps Demo

// --- Contracts ---

export type ContractType =
	| "NDA"
	| "MSA"
	| "Services Agreement"
	| "SOW"
	| "Amendment"
	| "SLA"
	| "Sales Agreement"
	| "Distribution Agreement"
	| "Supply Agreement"
	| "License Agreement"
	| "SaaS / Cloud Services Agreement"
	| "Promissory Note"
	| "Loan Agreement"
	| "Employment"
	| "Joint Venture"
	| "Franchise"
	| "AI Services"
	| "Procurement"
	| "Consortium"
	| "Partnership"
	| "Lease"
	| "Insurance"
	| "Government Contract"
	| "UNKNOWN";

export type ContractStatus = "processing" | "awaiting_review" | "approved" | "rejected" | "archived" | "failed";

export interface Contract {
	readonly id: string;
	readonly filename: string;
	readonly text: string;
	type?: ContractType;
	status: ContractStatus;
	classification_confidence?: number;
	submitted_at: string;
	completed_at?: string;
	error_message?: string;
}

// --- Extraction ---

export interface ExtractedClause {
	readonly type: string;
	readonly text: string;
	readonly section: string;
}

export interface ExtractionResult {
	readonly id: string;
	readonly contract_id: string;
	readonly clauses: ExtractedClause[];
	readonly parties: string[];
	readonly dates: string[];
	readonly values: string[];
	readonly confidence: number;
}

// --- Compliance ---

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ClauseStatus = "pass" | "warn" | "fail";

export interface ClauseResult {
	readonly clause_type: string;
	readonly status: ClauseStatus;
	readonly policy_ref: string;
	readonly reason: string;
}

export interface ComplianceResult {
	readonly id: string;
	readonly contract_id: string;
	readonly clause_results: ClauseResult[];
	readonly overall_risk: RiskLevel;
	readonly flags_count: number;
	readonly policy_references: string[];
}

// --- Review / HITL ---

export type ReviewDecision = "approve" | "reject" | "request_changes";

export interface ReviewEntry {
	readonly id: string;
	readonly contract_id: string;
	readonly decision: ReviewDecision;
	readonly reviewer: string;
	readonly comment: string;
	readonly decided_at: string;
}

// --- Audit ---

export type AuditAgent = "intake" | "extraction" | "review" | "compliance" | "negotiation" | "approval" | "human";

export type AuditAction =
	| "classified"
	| "extracted"
	| "reviewed"
	| "flagged"
	| "negotiated"
	| "escalated"
	| "approved"
	| "rejected"
	| "request_changes"
	| "error";

export interface AuditEntry {
	readonly id: string;
	readonly contract_id: string;
	readonly agent: AuditAgent;
	readonly action: AuditAction;
	readonly reasoning: string;
	readonly description?: string;
	readonly timestamp: string;
}

// --- Trace ---

export interface TraceEntry {
	readonly id: string;
	readonly contract_id: string;
	readonly agent: string;
	readonly tool: string;
	readonly input: unknown;
	readonly output: unknown;
	readonly latency_ms: number;
	readonly tokens_in: number;
	readonly tokens_out: number;
	readonly timestamp: string;
}

// --- Evaluation ---

export type QualityGate = "PASS" | "FAIL";

export interface JudgeScores {
	readonly relevance: number;
	readonly groundedness: number;
	readonly coherence: number;
}

export interface EvaluationResult {
	readonly id: string;
	readonly version: string;
	readonly run_at: string;
	readonly total_cases: number;
	readonly passed: number;
	readonly accuracy: number;
	readonly per_metric: Record<string, number>;
	readonly per_contract: Record<string, unknown>;
	readonly quality_gate: QualityGate;
	readonly judge_scores?: JudgeScores;
}

// --- Drift ---

export type DriftType = "llm_drift" | "data_drift" | "model_swap";

export interface DriftDataPoint {
	readonly week: string;
	readonly accuracy: number;
}

export interface DriftAlert {
	readonly type: string;
	readonly message: string;
	readonly severity: "info" | "warning" | "critical";
	readonly detected_at: string;
}

export interface DriftData {
	readonly id: string;
	readonly type: DriftType;
	readonly timeline: DriftDataPoint[];
	readonly distribution: Record<string, number>;
	readonly alerts: DriftAlert[];
	readonly generated_at: string;
}

// --- Feedback ---

export type Sentiment = "positive" | "negative";

export interface FeedbackEntry {
	readonly id: string;
	readonly contract_id: string;
	readonly agent: string;
	readonly sentiment: Sentiment;
	readonly comment: string;
	readonly reviewer: string;
	readonly submitted_at: string;
	converted_to_test: boolean;
}

// --- Policy ---

export interface PolicyRule {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly category: string;
	readonly clause_type: string;
	readonly check: string;
	readonly severity: RiskLevel;
}

// --- WebSocket Events ---

export type PipelineStage =
	| "processing_started"
	| "intake_complete"
	| "extraction_complete"
	| "review_complete"
	| "compliance_complete"
	| "negotiation_complete"
	| "awaiting_human_review"
	| "approved"
	| "rejected"
	| "pipeline_complete"
	| "pipeline_error"
	| "pipeline_failed";

export interface WebSocketEvent {
	readonly event: "agent_step_complete" | "pipeline_status" | "error";
	readonly contract_id: string;
	readonly agent?: string;
	readonly status: PipelineStage;
	readonly result?: unknown;
	readonly latency_ms?: number;
	readonly tokens?: { input: number; output: number };
	readonly timestamp: string;
}

// --- API Errors ---

export interface ApiError {
	readonly error: string;
	readonly message: string;
	readonly details?: Record<string, unknown>;
	readonly request_id: string;
}

// --- LLM Adapter ---

export interface LlmRequest {
	readonly prompt: string;
	readonly system_prompt?: string;
	readonly temperature?: number;
	readonly max_tokens?: number;
	readonly response_format?: "json" | "text";
}

export interface LlmResponse {
	readonly content: string;
	readonly tokens_in: number;
	readonly tokens_out: number;
	readonly latency_ms: number;
	readonly model: string;
}

export interface ILlmAdapter {
	complete(request: LlmRequest): Promise<LlmResponse>;
}

// --- MCP Server Info ---

export interface McpToolInfo {
	readonly name: string;
	readonly description: string;
	readonly inputSchema: Record<string, unknown>;
}

export interface McpServerInfo {
	readonly name: string;
	readonly port: number;
	readonly tools: McpToolInfo[];
	readonly status: "online" | "offline" | "error";
}
