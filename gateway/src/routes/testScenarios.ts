import type { FastifyInstance } from "fastify";
import { testScenarioStore, type TestScenarioRecord } from "../stores/contractStore.js";

export type TestScenario = TestScenarioRecord;

export async function testScenarioRoutes(app: FastifyInstance): Promise<void> {
	// GET /api/v1/test-scenarios - list all test scenarios
	app.get("/api/v1/test-scenarios", async (_request, reply) => {
		return reply.send(testScenarioStore.getAll());
	});

	// POST /api/v1/test-scenarios - add a new test scenario
	app.post("/api/v1/test-scenarios", async (request, reply) => {
		const body = request.body as Partial<TestScenario> | null;

		if (!body?.id || !body?.name || !body?.description) {
			return reply.status(400).send({
				error: "ValidationError",
				message: "Fields id, name, and description are required",
			});
		}

		const scenarios = testScenarioStore.getAll();
		if (scenarios.some((s) => s.id === body.id)) {
			return reply.status(409).send({
				error: "ConflictError",
				message: `Scenario with id '${body.id}' already exists`,
			});
		}

		const scenario: TestScenario = {
			id: body.id,
			name: body.name,
			description: body.description,
			inputSummary: body.inputSummary ?? "",
			expectations: body.expectations ?? [],
			requiredCapabilities: body.requiredCapabilities ?? [],
			requiresHumanReview: body.requiresHumanReview ?? false,
			prefersParallel: body.prefersParallel ?? false,
		};

		await testScenarioStore.add(scenario);
		return reply.status(201).send(scenario);
	});

	// DELETE /api/v1/test-scenarios/:id - remove a test scenario
	app.delete("/api/v1/test-scenarios/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		const removed = await testScenarioStore.remove(id);

		if (!removed) {
			return reply.status(404).send({
				error: "NotFound",
				message: `Scenario '${id}' not found`,
			});
		}
		return reply.send({ message: `Scenario '${id}' deleted` });
	});
}
