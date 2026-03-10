import { describe, expect, it } from "vitest";
import { detectDataDrift, detectLlmDrift, simulateModelSwap } from "../mcp-servers/contract-drift-mcp/src/engine.js";

describe("contract-drift-mcp engine", () => {
	describe("detectLlmDrift", () => {
		it("returns drift data with timeline", async () => {
			const result = await detectLlmDrift();
			expect(result).toHaveProperty("drift_detected");
			expect(result).toHaveProperty("current_accuracy");
			expect(result).toHaveProperty("threshold", 0.85);
			expect(result).toHaveProperty("timeline");
			expect(result).toHaveProperty("recommendation");
			expect(Array.isArray(result.timeline)).toBe(true);
			expect(result.timeline.length).toBeGreaterThan(0);
		});

		it("marks drift when accuracy below threshold", async () => {
			const result = await detectLlmDrift();
			if (result.current_accuracy < result.threshold) {
				expect(result.drift_detected).toBe(true);
			} else {
				expect(result.drift_detected).toBe(false);
			}
		});

		it("provides actionable recommendation", async () => {
			const result = await detectLlmDrift();
			expect(typeof result.recommendation).toBe("string");
			expect(result.recommendation.length).toBeGreaterThan(10);
		});
	});

	describe("detectDataDrift", () => {
		it("returns distribution and new types", async () => {
			const result = await detectDataDrift();
			expect(result).toHaveProperty("shift_detected");
			expect(result).toHaveProperty("distribution");
			expect(result).toHaveProperty("new_types");
			expect(result).toHaveProperty("recommendation");
			expect(typeof result.distribution).toBe("object");
		});

		it("detects AI Services as new type", async () => {
			const result = await detectDataDrift();
			expect(result.shift_detected).toBe(true);
			expect(result.new_types).toContain("AI Services");
		});

		it("includes known types in distribution", async () => {
			const result = await detectDataDrift();
			const types = Object.keys(result.distribution);
			expect(types).toContain("NDA");
			expect(types).toContain("MSA");
		});

		it("keeps the distribution normalized", async () => {
			const result = await detectDataDrift();
			const total = Object.values(result.distribution).reduce((sum, value) => sum + value, 0);
			expect(total).toBeCloseTo(1, 5);
		});
	});

	describe("simulateModelSwap", () => {
		it("returns comparison of two models", async () => {
			const result = await simulateModelSwap();
			expect(result.current_model).toBe("GPT-5.4");
			expect(result.candidate_model).toBe("GPT-4o-mini");
			expect(result).toHaveProperty("current");
			expect(result).toHaveProperty("candidate");
			expect(result).toHaveProperty("delta");
			expect(result).toHaveProperty("verdict");
		});

		it("verdict is ACCEPTABLE or DEGRADED", async () => {
			const result = await simulateModelSwap();
			expect(["ACCEPTABLE", "DEGRADED"]).toContain(result.verdict);
		});

		it("has numeric current model metrics", async () => {
			const result = await simulateModelSwap();
			expect(typeof result.current.accuracy).toBe("number");
			expect(typeof result.current.latency_ms).toBe("number");
			expect(typeof result.current.cost_per_contract).toBe("number");
		});

		it("provides reasoning for verdict", async () => {
			const result = await simulateModelSwap();
			expect(typeof result.reasoning).toBe("string");
			expect(result.reasoning.length).toBeGreaterThan(10);
		});
	});
});
