import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

interface WorkflowAgent {
	id: string;
	name: string;
	role: string;
	icon: string;
	model: string;
	tools: string[];
	boundary: string;
	output: string;
	color: string;
	kind?: "agent" | "orchestrator" | "human" | "merge";
	stage?: number;
	lane?: number;
	order: number;
}

interface Workflow {
	id: string;
	name: string;
	type: string;
	agents: WorkflowAgent[];
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

// In-memory store (persists for the lifetime of the gateway process)
let workflows: Workflow[] = [];
let activeWorkflowId: string | null = null;

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/workflows - list all saved workflows
	app.get("/api/v1/workflows", async (_request, reply) => {
		return reply.send({
			workflows: workflows.map((w) => ({
				...w,
				active: w.id === activeWorkflowId,
			})),
			active_workflow_id: activeWorkflowId,
		});
	});

	// GET /api/v1/workflows/active - get the active workflow
	app.get("/api/v1/workflows/active", async (_request, reply) => {
		if (!activeWorkflowId) {
			return reply.status(404).send({ error: "No active workflow set" });
		}
		const wf = workflows.find((w) => w.id === activeWorkflowId);
		if (!wf) {
			return reply.status(404).send({ error: "Active workflow not found" });
		}
		return reply.send(wf);
	});

	// GET /api/v1/workflows/:id - get a specific workflow
	app.get("/api/v1/workflows/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		const wf = workflows.find((w) => w.id === id);
		if (!wf) {
			return reply.status(404).send({ error: "Workflow not found" });
		}
		return reply.send({ ...wf, active: wf.id === activeWorkflowId });
	});

	// POST /api/v1/workflows - save a workflow
	app.post("/api/v1/workflows", async (request, reply) => {
		const body = request.body as {
			id?: string;
			name?: string;
			type?: string;
			agents?: WorkflowAgent[];
		} | null;

		if (!body?.name || !body.agents || !Array.isArray(body.agents)) {
			return reply.status(400).send({
				error: "ValidationError",
				message: "Workflow name and agents array are required",
			});
		}

		if (body.agents.length > 20) {
			return reply.status(400).send({
				error: "ValidationError",
				message: "Maximum 20 agents per workflow",
			});
		}

		const now = new Date().toISOString();
		const existingIdx = body.id ? workflows.findIndex((w) => w.id === body.id) : -1;

		if (existingIdx !== -1) {
			workflows[existingIdx] = {
				...workflows[existingIdx],
				name: body.name,
				type: body.type || workflows[existingIdx].type,
				agents: body.agents,
				updatedAt: now,
			};
			return reply.send({
				...workflows[existingIdx],
				active: workflows[existingIdx].id === activeWorkflowId,
			});
		}

		const wfId = body.id || `wf-${randomUUID().slice(0, 8)}`;
		const wf: Workflow = {
			id: wfId,
			name: body.name,
			type: body.type || "sequential",
			agents: body.agents,
			active: false,
			createdAt: now,
			updatedAt: now,
		};
		workflows.push(wf);
		return reply.status(201).send({ ...wf, active: wf.id === activeWorkflowId });
	});

	// POST /api/v1/workflows/:id/activate - set as the active workflow for the dashboard
	app.post("/api/v1/workflows/:id/activate", async (request, reply) => {
		const { id } = request.params as { id: string };
		const wf = workflows.find((w) => w.id === id);
		if (!wf) {
			return reply.status(404).send({ error: "Workflow not found" });
		}
		activeWorkflowId = id;
		return reply.send({
			message: "Workflow activated",
			workflow: { ...wf, active: true },
		});
	});

	// DELETE /api/v1/workflows/:id - delete a workflow
	app.delete("/api/v1/workflows/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		const before = workflows.length;
		workflows = workflows.filter((w) => w.id !== id);
		if (workflows.length === before) {
			return reply.status(404).send({ error: "Workflow not found" });
		}
		if (activeWorkflowId === id) {
			activeWorkflowId = null;
		}
		return reply.send({ message: "Workflow deleted" });
	});
}

