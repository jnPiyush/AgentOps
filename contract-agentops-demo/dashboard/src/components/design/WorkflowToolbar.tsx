import React from "react";
import type { WorkflowType, Workflow } from "../../context/WorkflowContext.js";
import { WORKFLOW_TYPES } from "../../context/WorkflowContext.js";

interface Props {
	workflow: Workflow;
	hasUnsavedChanges: boolean;
	onUpdateName: (name: string) => void;
	onUpdateType: (type: WorkflowType) => void;
	onSave: () => void;
	onLoad: () => void;
	onPushToPipeline: () => void;
	onAddAgent: () => void;
	onReset: () => void;
}

export function WorkflowToolbar({
	workflow,
	hasUnsavedChanges,
	onUpdateName,
	onUpdateType,
	onSave,
	onLoad,
	onPushToPipeline,
	onAddAgent,
	onReset
}: Props) {
	const canPushToPipeline = workflow.agents.length > 0 && !hasUnsavedChanges;

	return (
		<div className="workflow-toolbar">
			{/* Workflow Metadata */}
			<div className="workflow-meta">
				<div className="form-group workflow-name">
					<label htmlFor="workflow-name" className="sr-only">Workflow Name</label>
					<input
						id="workflow-name"
						type="text"
						value={workflow.name}
						onChange={e => onUpdateName(e.target.value)}
						placeholder="Workflow Name"
						className="workflow-name-input"
						maxLength={100}
					/>
					{hasUnsavedChanges && <span className="unsaved-indicator" title="Unsaved changes">●</span>}
				</div>

				<div className="form-group workflow-type">
					<label htmlFor="workflow-type" className="sr-only">Workflow Type</label>
					<select
						id="workflow-type"
						value={workflow.type}
						onChange={e => onUpdateType(e.target.value as WorkflowType)}
						className="workflow-type-select"
					>
						{WORKFLOW_TYPES.map(type => (
							<option key={type.id} value={type.id} title={type.description}>
								{type.label}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Action Buttons */}
			<div className="toolbar-actions">
				<button
					type="button"
					className="btn btn-primary add-agent-btn"
					onClick={onAddAgent}
					title="Add a new agent to the workflow"
					disabled={workflow.agents.length >= 20}
				>
					+ Add Agent
				</button>

				<div className="btn-group">
					<button
						type="button"
						className="btn btn-secondary"
						onClick={onSave}
						title="Save workflow to gateway"
						disabled={!workflow.name.trim()}
					>
						Save
					</button>

					<button
						type="button"
						className="btn btn-secondary"
						onClick={onLoad}
						title="Load saved workflow"
					>
						Load
					</button>
				</div>

				<div className="btn-group">
					<button
						type="button"
						className="btn btn-success push-pipeline-btn"
						onClick={onPushToPipeline}
						title="Push workflow to pipeline and activate for execution"
						disabled={!canPushToPipeline}
					>
						Push to Pipeline →
					</button>

					<button
						type="button"
						className="btn btn-outline reset-btn"
						onClick={() => {
							const confirmReset = confirm('Reset workflow? This will clear all agents and cannot be undone.');
							if (confirmReset) onReset();
						}}
						title="Reset workflow to empty state"
					>
						Reset
					</button>
				</div>
			</div>

			{/* Workflow Status */}
			<div className="workflow-status">
				<div className="status-item">
					<span className="status-label">Agents:</span>
					<span className="status-value">{workflow.agents.length}/20</span>
				</div>
				<div className="status-item">
					<span className="status-label">Type:</span>
					<span className="status-value">
						{WORKFLOW_TYPES.find(t => t.id === workflow.type)?.label || workflow.type}
					</span>
				</div>
				{workflow.active && (
					<div className="status-item active-indicator">
						<span className="status-badge active">ACTIVE</span>
					</div>
				)}
			</div>
		</div>
	);
}