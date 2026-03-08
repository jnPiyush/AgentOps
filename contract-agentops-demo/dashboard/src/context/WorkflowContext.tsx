import React, {
	createContext,
	useContext,
	useReducer,
	useCallback,
	type ReactNode,
} from "react";

// Workflow types matching the gateway API
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
	order: number;
}

export type WorkflowType = "sequential" | "parallel" | "sequential-hitl" | "fan-out" | "conditional";

export interface Workflow {
	id: string | null;
	name: string;
	type: WorkflowType;
	agents: WorkflowAgent[];
	createdAt: string | null;
	updatedAt: string | null;
	active?: boolean;
}

export const AGENT_COLORS = [
	"#0078d4", "#00b294", "#8861c4", "#ff8c00",
	"#e74c3c", "#3498db", "#2ecc71", "#9b59b6",
	"#1abc9c", "#e67e22", "#e91e63", "#00bcd4"
];

export const WORKFLOW_TYPES = [
	{ id: "sequential" as const, label: "Sequential", description: "Agents execute one after another in order" },
	{ id: "parallel" as const, label: "Parallel", description: "Agents execute simultaneously, results merged" },
	{ id: "sequential-hitl" as const, label: "Sequential + HITL", description: "Sequential with human-in-the-loop checkpoint" },
	{ id: "fan-out" as const, label: "Fan-out / Fan-in", description: "One agent fans out to parallel, then merges" },
	{ id: "conditional" as const, label: "Conditional", description: "Agent routes to different agents based on output" },
];

export const MODEL_OPTIONS = ["GPT-4o", "GPT-4o-mini", "GPT-4.1", "GPT-4.1-mini", "GPT-4.1-nano", "o3-mini", "o4-mini"];

export const AVAILABLE_TOOLS = {
	"contract-intake-mcp": ["upload_contract", "classify_document", "extract_metadata"],
	"contract-extraction-mcp": ["extract_clauses", "identify_parties", "extract_dates_values"],
	"contract-compliance-mcp": ["check_policy", "flag_risk", "get_policy_rules"],
	"contract-workflow-mcp": ["route_approval", "escalate_to_human", "notify_stakeholder"],
	"contract-audit-mcp": ["get_audit_log", "create_audit_entry"],
	"contract-eval-mcp": ["run_evaluation", "get_baseline"],
	"contract-drift-mcp": ["detect_drift", "model_swap_analysis"],
	"contract-feedback-mcp": ["submit_feedback", "optimize_feedback"],
};

// Action types for workflow reducer
type WorkflowAction =
	| { type: "SET_WORKFLOW"; payload: Workflow }
	| { type: "UPDATE_NAME"; payload: string }
	| { type: "UPDATE_TYPE"; payload: WorkflowType }
	| { type: "ADD_AGENT"; payload: Omit<WorkflowAgent, "id" | "order"> }
	| { type: "UPDATE_AGENT"; payload: { id: string; agent: Partial<WorkflowAgent> } }
	| { type: "DELETE_AGENT"; payload: string }
	| { type: "REORDER_AGENTS"; payload: { sourceId: string; destinationId: string } }
	| { type: "RESET_WORKFLOW" };

interface WorkflowState {
	workflow: Workflow;
	isLoading: boolean;
	error: string | null;
	hasUnsavedChanges: boolean;
}

interface WorkflowContextType extends WorkflowState {
	addAgent: (agent: Omit<WorkflowAgent, "id" | "order">) => void;
	updateAgent: (id: string, updates: Partial<WorkflowAgent>) => void;
	deleteAgent: (id: string) => void;
	reorderAgents: (sourceId: string, destinationId: string) => void;
	updateWorkflowName: (name: string) => void;
	updateWorkflowType: (type: WorkflowType) => void;
	saveWorkflow: () => Promise<void>;
	loadWorkflow: (workflowId: string) => Promise<void>;
	pushToPipeline: () => Promise<void>;
	resetWorkflow: () => void;
	getNextAgentId: () => string;
}

const DEFAULT_WORKFLOW: Workflow = {
	id: null,
	name: "Untitled Workflow",
	type: "sequential",
	agents: [],
	createdAt: null,
	updatedAt: null,
};

function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
	switch (action.type) {
		case "SET_WORKFLOW":
			return {
				...state,
				workflow: action.payload,
				hasUnsavedChanges: false,
			};

		case "UPDATE_NAME":
			return {
				...state,
				workflow: { ...state.workflow, name: action.payload },
				hasUnsavedChanges: true,
			};

		case "UPDATE_TYPE":
			return {
				...state,
				workflow: { ...state.workflow, type: action.payload },
				hasUnsavedChanges: true,
			};

		case "ADD_AGENT": {
			const newAgent: WorkflowAgent = {
				...action.payload,
				id: `agent-${Date.now()}`,
				order: state.workflow.agents.length,
			};
			return {
				...state,
				workflow: {
					...state.workflow,
					agents: [...state.workflow.agents, newAgent],
				},
				hasUnsavedChanges: true,
			};
		}

		case "UPDATE_AGENT": {
			const updatedAgents = state.workflow.agents.map((agent) =>
				agent.id === action.payload.id
					? { ...agent, ...action.payload.agent }
					: agent
			);
			return {
				...state,
				workflow: { ...state.workflow, agents: updatedAgents },
				hasUnsavedChanges: true,
			};
		}

		case "DELETE_AGENT": {
			const filteredAgents = state.workflow.agents
				.filter((agent) => agent.id !== action.payload)
				.map((agent, index) => ({ ...agent, order: index }));
			return {
				...state,
				workflow: { ...state.workflow, agents: filteredAgents },
				hasUnsavedChanges: true,
			};
		}

		case "REORDER_AGENTS": {
			const { sourceId, destinationId } = action.payload;
			const agents = [...state.workflow.agents];
			const sourceIndex = agents.findIndex((a) => a.id === sourceId);
			const destIndex = agents.findIndex((a) => a.id === destinationId);

			if (sourceIndex === -1 || destIndex === -1) return state;

			// Reorder the agents
			const [movedAgent] = agents.splice(sourceIndex, 1);
			agents.splice(destIndex, 0, movedAgent);

			// Update order indices
			const reorderedAgents = agents.map((agent, index) => ({
				...agent,
				order: index,
			}));

			return {
				...state,
				workflow: { ...state.workflow, agents: reorderedAgents },
				hasUnsavedChanges: true,
			};
		}

		case "RESET_WORKFLOW":
			return {
				workflow: { ...DEFAULT_WORKFLOW },
				isLoading: false,
				error: null,
				hasUnsavedChanges: false,
			};

		default:
			return state;
	}
}

const WorkflowContext = createContext<WorkflowContextType | null>(null);

export function WorkflowProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(workflowReducer, {
		workflow: { ...DEFAULT_WORKFLOW },
		isLoading: false,
		error: null,
		hasUnsavedChanges: false,
	});

	// Action creators
	const addAgent = useCallback((agent: Omit<WorkflowAgent, "id" | "order">) => {
		// Enforce maximum 20 agents
		if (state.workflow.agents.length >= 20) {
			console.warn("Maximum 20 agents allowed per workflow");
			return;
		}
		dispatch({ type: "ADD_AGENT", payload: agent });
	}, [state.workflow.agents.length]);

	const updateAgent = useCallback((id: string, updates: Partial<WorkflowAgent>) => {
		dispatch({ type: "UPDATE_AGENT", payload: { id, agent: updates } });
	}, []);

	const deleteAgent = useCallback((id: string) => {
		// Prevent deletion if only one agent remains
		if (state.workflow.agents.length <= 1) {
			console.warn("Minimum 1 agent required in workflow");
			return;
		}
		dispatch({ type: "DELETE_AGENT", payload: id });
	}, [state.workflow.agents.length]);

	const reorderAgents = useCallback((sourceId: string, destinationId: string) => {
		dispatch({ type: "REORDER_AGENTS", payload: { sourceId, destinationId } });
	}, []);

	const updateWorkflowName = useCallback((name: string) => {
		dispatch({ type: "UPDATE_NAME", payload: name });
	}, []);

	const updateWorkflowType = useCallback((type: WorkflowType) => {
		dispatch({ type: "UPDATE_TYPE", payload: type });
	}, []);

	const saveWorkflow = useCallback(async () => {
		try {
			const workflowData = {
				...state.workflow,
				updatedAt: new Date().toISOString(),
				...(state.workflow.id === null && { createdAt: new Date().toISOString() }),
			};

			const response = await fetch("/api/v1/workflows", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(workflowData),
			});

			if (!response.ok) {
				throw new Error("Failed to save workflow");
			}

			const savedWorkflow = await response.json();
			dispatch({ type: "SET_WORKFLOW", payload: savedWorkflow });
			
			// Show success notification
			console.log(`Workflow '${savedWorkflow.name}' saved successfully`);
		} catch (error) {
			console.error("Failed to save workflow:", error);
			// In a real app, you'd set error state here
		}
	}, [state.workflow]);

	const loadWorkflow = useCallback(async (workflowId: string) => {
		try {
			const response = await fetch(`/api/v1/workflows/${workflowId}`);
			if (!response.ok) {
				throw new Error("Failed to load workflow");
			}
			const workflow = await response.json();
			dispatch({ type: "SET_WORKFLOW", payload: workflow });
		} catch (error) {
			console.error("Failed to load workflow:", error);
		}
	}, []);

	const pushToPipeline = useCallback(async () => {
		try {
			// First save the workflow if it has changes
			if (state.hasUnsavedChanges) {
				await saveWorkflow();
			}

			// Activate the workflow
			const response = await fetch(`/api/v1/workflows/${state.workflow.id}/activate`, {
				method: "POST",
			});

			if (!response.ok) {
				throw new Error("Failed to activate workflow");
			}

			// Dispatch custom event for other tabs to listen
			const event = new CustomEvent("workflow-activated", {
				detail: { workflowId: state.workflow.id },
			});
			window.dispatchEvent(event);

			console.log("Workflow activated — switch to Build tab to test");
		} catch (error) {
			console.error("Failed to push workflow to pipeline:", error);
		}
	}, [state.workflow.id, state.hasUnsavedChanges, saveWorkflow]);

	const resetWorkflow = useCallback(() => {
		dispatch({ type: "RESET_WORKFLOW" });
	}, []);

	const getNextAgentId = useCallback(() => {
		return `agent-${Date.now()}`;
	}, []);

	const contextValue: WorkflowContextType = {
		...state,
		addAgent,
		updateAgent,
		deleteAgent,
		reorderAgents,
		updateWorkflowName,
		updateWorkflowType,
		saveWorkflow,
		loadWorkflow,
		pushToPipeline,
		resetWorkflow,
		getNextAgentId,
	};

	return (
		<WorkflowContext.Provider value={contextValue}>
			{children}
		</WorkflowContext.Provider>
	);
}

export function useWorkflow() {
	const context = useContext(WorkflowContext);
	if (!context) {
		throw new Error("useWorkflow must be used within a WorkflowProvider");
	}
	return context;
}