import type { FastifyInstance } from "fastify";
import { getBaseline, getEvalResults, runEvalSuite } from "../../../mcp-servers/contract-eval-mcp/src/engine.js";

export async function evaluationRoutes(app: FastifyInstance): Promise<void> {
	app.get("/api/v1/evaluations/results", async (_request, reply) => {
		return reply.send(await getEvalResults());
	});

	app.post("/api/v1/evaluations/run", async (request, reply) => {
		const body = request.body as { version?: string } | null;
		const version = body?.version ?? "v1.3";

		const result = await runEvalSuite(version);

		return reply.status(201).send(result);
	});

	app.get("/api/v1/evaluations/baseline", async (_request, reply) => {
		const baseline = getBaseline();
		const results = await getEvalResults();
		const latest = results[results.length - 1];
		if (latest) {
			return reply.send({
				baseline,
				current: latest,
				delta: {
					accuracy: Math.round((latest.accuracy - baseline.accuracy) * 10) / 10,
					relevance:
						latest.judge_scores && baseline.judge_scores
							? Math.round((latest.judge_scores.relevance - baseline.judge_scores.relevance) * 10) / 10
							: 0,
					groundedness:
						latest.judge_scores && baseline.judge_scores
							? Math.round((latest.judge_scores.groundedness - baseline.judge_scores.groundedness) * 10) / 10
							: 0,
					coherence:
						latest.judge_scores && baseline.judge_scores
							? Math.round((latest.judge_scores.coherence - baseline.judge_scores.coherence) * 10) / 10
							: 0,
				},
			});
		}
		return reply.send({ baseline, current: null, delta: null });
	});
}
