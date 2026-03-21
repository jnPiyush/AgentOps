import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluationRoutes } from "../gateway/src/routes/evaluations.js";

const engineMocks = vi.hoisted(() => ({
	mockGetEvalResults: vi.fn(),
	mockRunEvalSuite: vi.fn(),
	mockGetBaseline: vi.fn(),
}));

vi.mock("../mcp-servers/contract-eval-mcp/src/engine.js", () => ({
	getEvalResults: engineMocks.mockGetEvalResults,
	runEvalSuite: engineMocks.mockRunEvalSuite,
	getBaseline: engineMocks.mockGetBaseline,
}));

describe("evaluation routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("runs the canonical evaluation suite and returns the persisted result", async () => {
		const evalResult = {
			id: "eval-1234",
			version: "v1.3",
			run_at: "2026-03-20T10:00:00.000Z",
			total_cases: 57,
			passed: 39,
			accuracy: 68.4,
			per_metric: {
				extraction_accuracy: 72.1,
				compliance_accuracy: 66.7,
				classification_accuracy: 74.6,
				false_flag_rate: 11.1,
				latency_p95_s: 2.6,
			},
			per_contract: {},
			quality_gate: "FAIL",
			judge_scores: {
				relevance: 4.1,
				groundedness: 3.5,
				coherence: 4.3,
			},
		};

		engineMocks.mockRunEvalSuite.mockResolvedValue(evalResult);

		const app = Fastify();
		await app.register(evaluationRoutes);

		const response = await app.inject({
			method: "POST",
			url: "/api/v1/evaluations/run",
			payload: { version: "v1.3" },
		});

		expect(response.statusCode).toBe(201);
		expect(engineMocks.mockRunEvalSuite).toHaveBeenCalledWith("v1.3");
		expect(response.json()).toMatchObject({
			version: "v1.3",
			total_cases: 57,
			quality_gate: "FAIL",
			judge_scores: expect.objectContaining({ groundedness: 3.5 }),
		});

		await app.close();
	});

	it("compares the latest canonical result against the canonical baseline", async () => {
		const baseline = {
			id: "eval-baseline",
			version: "v1.2",
			run_at: "2026-03-19T10:00:00.000Z",
			total_cases: 57,
			passed: 46,
			accuracy: 80.7,
			per_metric: {},
			per_contract: {},
			quality_gate: "PASS",
			judge_scores: { relevance: 4.2, groundedness: 3.9, coherence: 4.4 },
		};
		const latest = {
			id: "eval-latest",
			version: "v1.3",
			run_at: "2026-03-20T10:00:00.000Z",
			total_cases: 57,
			passed: 39,
			accuracy: 68.4,
			per_metric: {},
			per_contract: {},
			quality_gate: "FAIL",
			judge_scores: { relevance: 4.1, groundedness: 3.5, coherence: 4.3 },
		};

		engineMocks.mockGetBaseline.mockReturnValue(baseline);
		engineMocks.mockGetEvalResults.mockResolvedValue([latest]);

		const app = Fastify();
		await app.register(evaluationRoutes);

		const response = await app.inject({ method: "GET", url: "/api/v1/evaluations/baseline" });

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			baseline: expect.objectContaining({ total_cases: 57, version: "v1.2" }),
			current: expect.objectContaining({ total_cases: 57, version: "v1.3" }),
			delta: {
				accuracy: -12.3,
				relevance: -0.1,
				groundedness: -0.4,
				coherence: -0.1,
			},
		});

		await app.close();
	});
});