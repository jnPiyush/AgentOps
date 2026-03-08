import React, { useState, useEffect } from "react";
import {
	type WorkflowAgent,
	MODEL_OPTIONS,
	AGENT_COLORS,
	AVAILABLE_TOOLS,
} from "../../context/WorkflowContext.js";

interface Props {
	agent?: WorkflowAgent | null;
	onSave: (agent: Omit<WorkflowAgent, "id" | "order">) => void;
	onCancel: () => void;
}

type BoundaryType = "internal" | "external" | "human";
type OutputFormat = "text" | "json" | "markdown";

interface AgentFormData {
	name: string;
	role: string;
	icon: string;
	model: string;
	tools: string[];
	boundary: BoundaryType;
	output: OutputFormat;
	color: string;
}

export function AgentModal({ agent, onSave, onCancel }: Props) {
	const [formData, setFormData] = useState<AgentFormData>({
		name: "",
		role: "",
		icon: "",
		model: "GPT-4o",
		tools: [],
		boundary: "internal",
		output: "json",
		color: AGENT_COLORS[0],
	});

	const [errors, setErrors] = useState<Partial<Record<keyof AgentFormData, string>>>({});

	// Initialize form data when agent prop changes
	useEffect(() => {
		if (agent) {
			// Edit mode - populate with existing agent data
			setFormData({
				name: agent.name,
				role: agent.role,
				icon: agent.icon,
				model: agent.model,
				tools: agent.tools,
				boundary: agent.boundary as BoundaryType,
				output: agent.output as OutputFormat,
				color: agent.color,
			});
		} else {
			// Add mode - reset to defaults
			const defaultColor = AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)];
			setFormData({
				name: "",
				role: "",
				icon: "",
				model: "GPT-4o",
				tools: [],
				boundary: "internal",
				output: "json",
				color: defaultColor,
			});
		}
		setErrors({});
	}, [agent]);

	// Generate icon from name when name changes
	useEffect(() => {
		if (formData.name) {
			const firstLetter = formData.name.charAt(0).toUpperCase();
			setFormData(prev => ({ ...prev, icon: firstLetter }));
		}
	}, [formData.name]);

	const validateForm = (): boolean => {
		const newErrors: Partial<Record<keyof AgentFormData, string>> = {};

		if (!formData.name.trim()) {
			newErrors.name = "Name is required";
		} else if (formData.name.length > 50) {
			newErrors.name = "Name must be 50 characters or less";
		}

		if (!formData.role.trim()) {
			newErrors.role = "Role is required";
		}

		if (formData.tools.length === 0) {
			newErrors.tools = "At least one tool must be selected";
		} else if (formData.tools.length > 10) {
			newErrors.tools = "Maximum 10 tools allowed per agent";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!validateForm()) return;

		onSave({
			name: formData.name.trim(),
			role: formData.role.trim(),
			icon: formData.icon,
			model: formData.model,
			tools: formData.tools,
			boundary: formData.boundary,
			output: formData.output,
			color: formData.color,
		});
	};

	const handleCancel = () => {
		// Check for unsaved changes
		const hasChanges = agent 
		? (
			agent.name !== formData.name ||
			agent.role !== formData.role ||
			agent.model !== formData.model ||
			JSON.stringify(agent.tools) !== JSON.stringify(formData.tools) ||
			agent.boundary !== formData.boundary ||
			agent.output !== formData.output ||
			agent.color !== formData.color
		)
		: (formData.name || formData.role || formData.tools.length > 0);

		if (hasChanges) {
			const confirmDiscard = confirm("You have unsaved changes. Are you sure you want to close?");
			if (!confirmDiscard) return;
		}

		onCancel();
	};

	const handleToolToggle = (tool: string) => {
		setFormData(prev => ({
			...prev,
			tools: prev.tools.includes(tool)
				? prev.tools.filter(t => t !== tool)
				: [...prev.tools, tool]
		}));
	};

	const handleServerToggle = (server: string) => {
		const serverTools = AVAILABLE_TOOLS[server as keyof typeof AVAILABLE_TOOLS] || [];
		const allSelected = serverTools.every(tool => formData.tools.includes(tool));

		setFormData(prev => ({
			...prev,
			tools: allSelected
				? prev.tools.filter(tool => !serverTools.includes(tool))
				: [...new Set([...prev.tools, ...serverTools])]
		}));
	};

	return (
		<div className="agent-modal-overlay" onClick={handleCancel}>
			<div className="agent-modal" onClick={e => e.stopPropagation()}>
				<form onSubmit={handleSubmit}>
					<header className="modal-header">
						<h2>{agent ? "Edit Agent" : "Add Agent"}</h2>
						<button type="button" className="modal-close" onClick={handleCancel}>
							×
						</button>
					</header>

					<div className="modal-body">
						{/* Basic Information */}
						<div className="form-section">
							<h3>Basic Information</h3>
							<div className="form-row">
								<div className="form-group">
									<label htmlFor="agent-name">Agent Name *</label>
									<input
										id="agent-name"
										type="text"
										value={formData.name}
										onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
										placeholder="e.g., Contract Intake Agent"
										maxLength={50}
										className={errors.name ? "error" : ""}
									/>
									{errors.name && <span className="error-message">{errors.name}</span>}
								</div>
								<div className="form-group color-picker">
									<label>Color</label>
									<div className="color-palette">
										{AGENT_COLORS.map(color => (
											<button
												key={color}
												type="button"
												className={`color-swatch ${formData.color === color ? 'selected' : ''}`}
												style={{ backgroundColor: color }}
												onClick={() => setFormData(prev => ({ ...prev, color }))}
												title={color}
											/>
										))}
									</div>
								</div>
							</div>

							<div className="form-group">
								<label htmlFor="agent-role">Role Description *</label>
								<textarea
									id="agent-role"
									value={formData.role}
									onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
									placeholder="Describe what this agent does in the workflow..."
									rows={3}
									className={errors.role ? "error" : ""}
								/>
								{errors.role && <span className="error-message">{errors.role}</span>}
							</div>
						</div>

						{/* Model Configuration */}
						<div className="form-section">
							<h3>Model Configuration</h3>
							<div className="form-row">
								<div className="form-group">
									<label htmlFor="agent-model">Model</label>
									<select
										id="agent-model"
										value={formData.model}
										onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
									>
										{MODEL_OPTIONS.map(model => (
											<option key={model} value={model}>{model}</option>
										))}
									</select>
								</div>
								<div className="form-group">
									<label htmlFor="agent-boundary">Trust Boundary</label>
									<select
										id="agent-boundary"
										value={formData.boundary}
										onChange={e => setFormData(prev => ({ ...prev, boundary: e.target.value as BoundaryType }))}
									>
										<option value="internal">Internal</option>
										<option value="external">External</option>
										<option value="human">Human</option>
									</select>
								</div>
								<div className="form-group">
									<label htmlFor="agent-output">Output Format</label>
									<select
										id="agent-output"
										value={formData.output}
										onChange={e => setFormData(prev => ({ ...prev, output: e.target.value as OutputFormat }))}
									>
										<option value="text">Text</option>
										<option value="json">JSON</option>
										<option value="markdown">Markdown</option>
									</select>
								</div>
							</div>
						</div>

						{/* Tool Selection */}
						<div className="form-section">
							<h3>Tool Selection *</h3>
							<p className="form-hint">
								Select tools for this agent (maximum 10). Click server headers to select all tools in a group.
							</p>
							
							<div className="selected-tools-summary">
								<strong>Selected: {formData.tools.length}/10 tools</strong>
								{formData.tools.length > 0 && (
									<div className="tool-badges">
										{formData.tools.slice(0, 5).map(tool => (
											<span key={tool} className="tool-badge">{tool}</span>
										))}
										{formData.tools.length > 5 && (
											<span className="tool-badge">+{formData.tools.length - 5} more</span>
										)}
									</div>
								)}
							</div>
							
							<div className="tools-panel">
								{Object.entries(AVAILABLE_TOOLS).map(([server, tools]) => {
									const serverToolsSelected = tools.filter(tool => formData.tools.includes(tool)).length;
									const allServerSelected = serverToolsSelected === tools.length;
									
									return (
										<div key={server} className="tool-server-group">
											<button
												type="button"
												className={`server-header ${allServerSelected ? 'all-selected' : serverToolsSelected > 0 ? 'partial-selected' : ''}`}
												onClick={() => handleServerToggle(server)}
											>
												<span className="server-name">{server}</span>
												<span className="server-count">({serverToolsSelected}/{tools.length})</span>
											</button>
											<div className="tool-list">
												{tools.map(tool => (
													<label key={tool} className="tool-checkbox">
														<input
															type="checkbox"
															checked={formData.tools.includes(tool)}
															onChange={() => handleToolToggle(tool)}
															disabled={!formData.tools.includes(tool) && formData.tools.length >= 10}
														/>
														<span>{tool}</span>
													</label>
												))}
											</div>
										</div>
									);
								})}
							</div>
							{errors.tools && <span className="error-message">{errors.tools}</span>}
						</div>
					</div>

					<footer className="modal-footer">
						<button type="button" className="btn btn-secondary" onClick={handleCancel}>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary">
							{agent ? "Update Agent" : "Add Agent"}
						</button>
					</footer>
				</form>
			</div>
		</div>
	);
}