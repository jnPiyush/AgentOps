import React, { useState, useCallback, useRef } from "react";
import { WorkflowProvider, useWorkflow } from "../../context/WorkflowContext.js";
import { WorkflowToolbar } from "./WorkflowToolbar.js";
import { InteractiveAgentCard } from "./InteractiveAgentCard.js";
import { AgentModal } from "./AgentModal.js";
import type { WorkflowAgent } from "../../context/WorkflowContext.js";

interface CanvasPositions {
	[agentId: string]: { x: number; y: number };
}

function InteractiveCanvas() {
	const { 
		workflow, 
		actions,
		hasUnsavedChanges 
	} = useWorkflow();
	
	const [showAgentModal, setShowAgentModal] = useState(false);
	const [editingAgent, setEditingAgent] = useState<WorkflowAgent | null>(null);
	const [canvasPositions, setCanvasPositions] = useState<CanvasPositions>({});
	const [draggedAgent, setDraggedAgent] = useState<string | null>(null);
	
	const canvasRef = useRef<HTMLDivElement>(null);

	// Agent Modal Handlers
	const handleAddAgent = useCallback(() => {
		setEditingAgent(null);
		setShowAgentModal(true);
	}, []);

	const handleEditAgent = useCallback((agentId: string) => {
		const agent = workflow.agents.find(a => a.id === agentId);
		if (agent) {
			setEditingAgent(agent);
			setShowAgentModal(true);
		}
	}, [workflow.agents]);

	const handleDeleteAgent = useCallback((agentId: string) => {
		actions.deleteAgent(agentId);
		// Remove position tracking
		setCanvasPositions(prev => {
			const next = { ...prev };
			delete next[agentId];
			return next;
		});
	}, [actions]);

	const handleAgentSave = useCallback((agentData: Omit<WorkflowAgent, 'id' | 'order'>) => {
		if (editingAgent) {
			actions.updateAgent(editingAgent.id, agentData);
		} else {
			const newAgent = actions.addAgent(agentData);
			// Set initial position for new agents
			const canvas = canvasRef.current;
			if (canvas && newAgent) {
				const rect = canvas.getBoundingClientRect();
				const position = {
					x: Math.max(50, Math.min(rect.width - 300, 100 + (workflow.agents.length * 50))),
					y: Math.max(50, Math.min(rect.height - 200, 100 + (workflow.agents.length * 30)))
				};
				setCanvasPositions(prev => ({ ...prev, [newAgent.id]: position }));
			}
		}
		setShowAgentModal(false);
		setEditingAgent(null);
	}, [editingAgent, actions, workflow.agents.length]);

	// Drag and Drop Handlers
	const handleDragStart = useCallback((e: React.DragEvent, agentId: string) => {
		setDraggedAgent(agentId);
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', agentId);
		
		const target = e.target as HTMLElement;
		const rect = target.getBoundingClientRect();
		const offsetX = e.clientX - rect.left;
		const offsetY = e.clientY - rect.top;
		
		e.dataTransfer.setData('application/json', JSON.stringify({
			agentId,
			offsetX,
			offsetY
		}));
	}, []);

	const handleDragEnd = useCallback(() => {
		setDraggedAgent(null);
	}, []);

	const handleCanvasDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		
		try {
			const data = JSON.parse(e.dataTransfer.getData('application/json'));
			const { agentId, offsetX, offsetY } = data;
			
			const canvas = canvasRef.current;
			if (!canvas) return;
			
			const rect = canvas.getBoundingClientRect();
			const x = e.clientX - rect.left - offsetX;
			const y = e.clientY - rect.top - offsetY;
			
			// Constrain to canvas bounds
			const constrainedX = Math.max(0, Math.min(rect.width - 280, x));
			const constrainedY = Math.max(0, Math.min(rect.height - 200, y));
			
			setCanvasPositions(prev => ({
				...prev,
				[agentId]: { x: constrainedX, y: constrainedY }
			}));
		} catch (error) {
			console.warn('Failed to parse drag data:', error);
		}
		
		setDraggedAgent(null);
	}, []);

	const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}, []);

	// Agent Reordering Handler
	const handleAgentDrop = useCallback((e: React.DragEvent, targetId: string) => {
		e.stopPropagation();
		
		const draggedId = e.dataTransfer.getData('text/plain');
		if (draggedId && draggedId !== targetId) {
			actions.reorderAgent(draggedId, targetId);
		}
	}, [actions]);

	// Workflow Actions
	const handleSaveWorkflow = useCallback(async () => {
		try {
			await actions.saveWorkflow();
		} catch (error) {
			console.error('Failed to save workflow:', error);
			// Could show a toast notification here
		}
	}, [actions]);

	const handleLoadWorkflow = useCallback(async () => {
		// In a real app, this would open a workflow selection modal
		const workflowId = prompt('Enter workflow ID to load:');
		if (workflowId) {
			try {
				await actions.loadWorkflow(workflowId);
			} catch (error) {
				console.error('Failed to load workflow:', error);
				// Could show error toast
			}
		}
	}, [actions]);

	const handlePushToPipeline = useCallback(async () => {
		if (!workflow.name.trim()) {
			alert('Please name your workflow before pushing to pipeline.');
			return;
		}
		
		if (workflow.agents.length === 0) {
			alert('Cannot push empty workflow to pipeline.');
			return;
		}
		
		const confirmPush = confirm(
			`Push "${workflow.name}" to pipeline? This will activate the workflow for execution.`
		);
		
		if (confirmPush) {
			try {
				await actions.pushToPipeline();
			} catch (error) {
				console.error('Failed to push workflow:', error);
				// Could show error toast
			}
		}
	}, [workflow.name, workflow.agents.length, actions]);

	// Get agent position with fallback to grid layout
	const getAgentPosition = useCallback((agent: WorkflowAgent, index: number) => {
		if (canvasPositions[agent.id]) {
			return canvasPositions[agent.id];
		}
		
		// Default grid positions (3 columns)
		const col = index % 3;
		const row = Math.floor(index / 3);
		return {
			x: 50 + (col * 300),
			y: 50 + (row * 220)
		};
	}, [canvasPositions]);

	return (
		<div className="interactive-design-canvas">
			{/* Workflow Toolbar */}
			<WorkflowToolbar
				workflow={workflow}
				hasUnsavedChanges={hasUnsavedChanges}
				onUpdateName={actions.updateName}
				onUpdateType={actions.updateType}
				onSave={handleSaveWorkflow}
				onLoad={handleLoadWorkflow}
				onPushToPipeline={handlePushToPipeline}
				onAddAgent={handleAddAgent}
				onReset={actions.reset}
			/>

			{/* Canvas Area */}
			<div 
				ref={canvasRef}
				className="workflow-canvas"
				onDrop={handleCanvasDrop}
				onDragOver={handleCanvasDragOver}
			>
				{/* Connection Lines (Visual Enhancement) */}
				<div className="workflow-connections">
					{workflow.agents.map((agent, index) => {
						if (index === workflow.agents.length - 1) return null;
						
						const currentPos = getAgentPosition(agent, index);
						const nextAgent = workflow.agents[index + 1];
						const nextPos = getAgentPosition(nextAgent, index + 1);
						
						// Calculate line position and angle
						const dx = nextPos.x - currentPos.x;
						const dy = nextPos.y - currentPos.y;
						const length = Math.sqrt(dx * dx + dy * dy);
						const angle = Math.atan2(dy, dx) * 180 / Math.PI;
						
						return (
							<div
								key={`connection-${agent.id}-${nextAgent.id}`}
								className="workflow-connection"
								style={{
									left: currentPos.x + 140, // Center of agent card
									top: currentPos.y + 100,
									width: length,
									transform: `rotate(${angle}deg)`,
									transformOrigin: '0 50%'
								}}
							/>
						);
					})}
				</div>

				{/* Agent Cards */}
				{workflow.agents.map((agent, index) => {
					const position = getAgentPosition(agent, index);
					const isDragging = draggedAgent === agent.id;
					
					return (
						<div
							key={agent.id}
							className={`positioned-agent ${isDragging ? 'dragging' : ''}`}
							style={{
								position: 'absolute',
								left: position.x,
								top: position.y,
								zIndex: isDragging ? 1000 : 1
							}}
						>
							<InteractiveAgentCard
								agent={agent}
								onEdit={handleEditAgent}
								onDelete={handleDeleteAgent}
								isDragging={isDragging}
								onDragStart={handleDragStart}
								onDragEnd={handleDragEnd}
								onDrop={handleAgentDrop}
							/>
						</div>
					);
				})}

				{/* Empty State */}
				{workflow.agents.length === 0 && (
					<div className="empty-workflow-state">
						<div className="empty-state-content">
							<h3>No Agents in Workflow</h3>
							<p>Start building your workflow by adding agents.</p>
							<button
								type="button"
								className="btn btn-primary"
								onClick={handleAddAgent}
							>
								+ Add Your First Agent
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Agent Modal */}
			{showAgentModal && (
				<AgentModal
					agent={editingAgent}
					onSave={handleAgentSave}
					onCancel={() => {
						setShowAgentModal(false);
						setEditingAgent(null);
					}}
				/>
			)}
		</div>
	);
}

// Main export with context provider
export function InteractiveDesignCanvas() {
	return (
		<WorkflowProvider>
			<InteractiveCanvas />
		</WorkflowProvider>
	);
}