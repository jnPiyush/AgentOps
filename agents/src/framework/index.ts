/**
 * Microsoft Agent Framework – Public API
 *
 * Barrel re-export for:
 *   import { createAgent, loadDeployAgentDefs, ... } from "./framework/index.js";
 */

// Types
export type {
	ApprovalDecision,
	ComplianceAssessment,
	ContractMetadata,
	ExtractedClause,
	ExtractedValue,
	ExtractionResult,
	FrameworkAgentDef,
	YamlAgentDefinition,
	YamlToolBinding,
} from "./types.js";

// Config
export {
	getFrameworkSettings,
	getModelConfig,
	readJsonAsset,
	readTextAsset,
	resolveAssetPath,
	type FrameworkSettings,
	type ModelConfig,
} from "./config.js";

// Agents
export {
	ContractApprovalAgent,
	ContractComplianceAgent,
	ContractDraftingAgent,
	ContractExtractionAgent,
	ContractIntakeAgent,
	ContractNegotiationAgent,
	ContractReviewAgent,
	DeclarativeContractAgent,
} from "./declarativeAgent.js";

// Factory
export {
	createAgent,
	listAvailableAgents,
	loadAgentFromYaml,
	loadDeployAgentDefs,
	registerAgent,
} from "./agentFactory.js";

// Workflows
export {
	ContractProcessingStep,
	ContractProcessingWorkflow,
	type HITLDecision,
	type StepConfig,
	type WorkflowContext,
	type WorkflowStatus,
} from "./workflowOrchestrator.js";
