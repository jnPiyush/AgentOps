import React from "react";
import { AgentCard } from "../shared/AgentCard.js";
import type { WorkflowAgent } from "../../context/WorkflowContext.js";

interface Props {
	agent: WorkflowAgent;
	onEdit: (agentId: string) => void;
	onDelete: (agentId: string) => void;
	isDragging?: boolean;
	onDragStart?: (e: React.DragEvent, agentId: string) => void;
	onDragEnd?: (e: React.DragEvent) => void;
	onDragOver?: (e: React.DragEvent) => void;
	onDrop?: (e: React.DragEvent, targetId: string) => void;
}

export function InteractiveAgentCard({ 
	agent, 
	onEdit, 
	onDelete, 
	isDragging = false,
	onDragStart,
	onDragEnd,
	onDragOver,
	onDrop
}: Props) {
	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation();
		onEdit(agent.id);
	};

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		const confirmDelete = confirm(`Remove ${agent.name}? This cannot be undone.`);
		if (confirmDelete) {
			onDelete(agent.id);
		}
	};

	const handleDragStart = (e: React.DragEvent) => {
		if (onDragStart) {
			onDragStart(e, agent.id);
		}
	};

	const handleDragEnd = (e: React.DragEvent) => {
		if (onDragEnd) {
			onDragEnd(e);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		if (onDragOver) {
			onDragOver(e);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (onDrop) {
			onDrop(e, agent.id);
		}
	};

	return (
		<div 
			className={`interactive-agent-card ${isDragging ? 'dragging' : ''}`}
			draggable={true}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			{/* Agent Actions Overlay */}
			<div className="agent-actions">
				<button
					type="button"
					className="action-btn edit-btn"
					onClick={handleEdit}
					title="Edit Agent"
				>
					✏️
				</button>
				<button
					type="button"
					className="action-btn delete-btn"
					onClick={handleDelete}
					title="Delete Agent"
				>
					✕
				</button>
				<div className="drag-handle" title="Drag to reorder">
					≡
				</div>
			</div>

			{/* Existing AgentCard Component */}
			<AgentCard
				name={agent.name}
				role={agent.role}
				model={agent.model}
				boundary={agent.boundary}
				tools={agent.tools}
				status="idle"
			/>

			{/* Tool Count Badge */}
			<div className="tool-count-badge">
				{agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
			</div>

			{/* Order Number */}
			<div className="agent-order">
				{agent.order + 1}
			</div>
		</div>
	);
}