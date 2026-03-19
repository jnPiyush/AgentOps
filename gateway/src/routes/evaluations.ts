import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { evaluationStore } from "../stores/contractStore.js";
import type { EvaluationResult, JudgeScores } from "../types.js";

function simulateEvalRun(version: string): EvaluationResult {
	const seed = version.charCodeAt(version.length - 1);
	const baseAcc = 0.82 + (seed % 10) * 0.015;
	const totalCases = 20;
	const passed = Math.round(totalCases * Math.min(0.95, baseAcc + 0.03));

	const judgeScores: JudgeScores = {
		relevance: Math.round(Math.min(5, 4.0 + (seed % 10) * 0.07) * 10) / 10,
		groundedness: Math.round(Math.min(5, 3.8 + (seed % 8) * 0.08) * 10) / 10,
		coherence: Math.round(Math.min(5, 4.2 + (seed % 6) * 0.08) * 10) / 10,
	};

	return {
		id: `eval-${randomUUID().slice(0, 8)}`,
		version,
		run_at: new Date().toISOString(),
		total_cases: totalCases,
		passed,
		accuracy: Math.round((passed / totalCases) * 1000) / 10,
		per_metric: {
			extraction_accuracy: Math.round(Math.min(0.98, baseAcc + 0.04) * 1000) / 10,
			compliance_accuracy: Math.round(Math.min(0.95, baseAcc) * 1000) / 10,
			classification_accuracy: Math.round(Math.min(0.99, baseAcc + 0.08) * 1000) / 10,
			false_flag_rate: Math.round((1 - Math.min(0.95, baseAcc)) * 0.6 * 1000) / 10,
			latency_p95_s: Math.round((2.0 + (seed % 5) * 0.3) * 10) / 10,
		},
		per_contract: {},
		quality_gate: passed / totalCases >= 0.8 && judgeScores.relevance >= 4.0 ? "PASS" : "FAIL",
		judge_scores: judgeScores,
	};
}

export async function evaluationRoutes(app: FastifyInstance): Promise<void> {
	app.get("/api/v1/evaluations/results", async (_request, reply) => {
		return reply.send(evaluationStore.getAll());
	});

	app.post("/api/v1/evaluations/run", async (request, reply) => {
		const body = request.body as { version?: string } | null;
		const version = body?.version ?? "v1.3";

		const result = simulateEvalRun(version);
		await evaluationStore.add(result);

		return reply.status(201).send(result);
	});

	app.get("/api/v1/evaluations/baseline", async (_request, reply) => {
		const baseline = simulateEvalRun("v1.2");
		const results = evaluationStore.getAll();
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
