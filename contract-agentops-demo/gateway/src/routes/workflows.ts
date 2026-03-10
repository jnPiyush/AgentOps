import type { FastifyInstance } from "fastify";
import {
	activateWorkflowDefinition,
	deleteWorkflowDefinition,
	getActiveWorkflow,
	getActiveWorkflowPackage,
	getWorkflowById,
	listWorkflows,
	saveWorkflowDefinition,
	type WorkflowAgent,
	validateWorkflowInput,
} from "../services/workflowRegistry.js";

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/workflows - list all saved workflows
	app.get("/api/v1/workflows", async (_request, reply) => {
		return reply.send({
			workflows: listWorkflows(),
			active_workflow_id: getActiveWorkflowPackage()?.workflow_id ?? null,
		});
	});

	// GET /api/v1/workflows/active - get the active workflow
	app.get("/api/v1/workflows/active", async (_request, reply) => {
		const workflow = getActiveWorkflow();
		if (!workflow) {
			return reply.status(404).send({ error: "No active workflow set" });
		}
		return reply.send(workflow);
	});

	// GET /api/v1/workflows/active/package - get the active runtime package
	app.get("/api/v1/workflows/active/package", async (_request, reply) => {
		const workflowPackage = getActiveWorkflowPackage();
		if (!workflowPackage) {
			return reply.status(404).send({ error: "No active workflow package set" });
		}
		return reply.send(workflowPackage);
	});

	// GET /api/v1/workflows/:id - get a specific workflow
	app.get("/api/v1/workflows/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		const wf = getWorkflowById(id);
		if (!wf) {
			return reply.status(404).send({ error: "Workflow not found" });
		}
		return reply.send(wf);
	});

	// POST /api/v1/workflows - save a workflow
	app.post("/api/v1/workflows", async (request, reply) => {
		const body = request.body as {
			id?: string;
			name?: string;
			type?: string;
			agents?: WorkflowAgent[];
		} | null;

		const errors = validateWorkflowInput({
			name: body?.name,
			type: body?.type,
			agents: body?.agents,
		});
		if (errors.length > 0) {
			return reply.status(400).send({
				error: "ValidationError",
				message: errors.join(" "),
			});
		}

		const existing = body?.id ? getWorkflowById(body.id) : undefined;
		try {
			const workflow = await saveWorkflowDefinition({
				id: body?.id,
				name: body?.name ?? "",
				type: body?.type ?? "sequential",
				agents: body?.agents ?? [],
			});
			return reply.status(existing ? 200 : 201).send(workflow);
		} catch (error) {
			return reply.status(400).send({
				error: "ValidationError",
				message: error instanceof Error ? error.message : "Unable to save workflow",
			});
		}
	});

	// POST /api/v1/workflows/:id/activate - set as the active workflow for the dashboard
	app.post("/api/v1/workflows/:id/activate", async (request, reply) => {
		const { id } = request.params as { id: string };
		try {
			const activation = await activateWorkflowDefinition(id);
			return reply.send({
				message: "Workflow activated",
				workflow: activation.workflow,
				workflow_package: {
					id: activation.workflowPackage.id,
					workflow_version: activation.workflowPackage.workflow_version,
					activated_at: activation.workflowPackage.activated_at,
				},
			});
		} catch (error) {
			return reply.status(404).send({
				error: "Workflow not found",
				message: error instanceof Error ? error.message : "Workflow activation failed",
			});
		}
	});

	// DELETE /api/v1/workflows/:id - delete a workflow
	app.delete("/api/v1/workflows/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		const removed = await deleteWorkflowDefinition(id);
		if (!removed) {
			return reply.status(404).send({ error: "Workflow not found" });
		}
		return reply.send({ message: "Workflow deleted" });
	});
}

