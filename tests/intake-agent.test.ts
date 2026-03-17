import { describe, expect, it, vi } from "vitest";
import { runIntakeAgent } from "../agents/src/intakeAgent.js";
import type { ILlmAdapter, LlmRequest, LlmResponse } from "../gateway/src/types.js";

class StaticAdapter implements ILlmAdapter {
	constructor(private readonly content: string) {}

	async complete(_request: LlmRequest): Promise<LlmResponse> {
		return {
			content: this.content,
			tokens_in: 10,
			tokens_out: 10,
			latency_ms: 5,
			model: "test",
		};
	}
}

describe("runIntakeAgent", () => {
	it("maps schema-shaped prompt output into the runtime intake result", async () => {
		const adapter = new StaticAdapter(
			JSON.stringify({
				contract_type: "License Agreement",
				confidence_score: 0.91,
				parties: ["SoftwareCorp", "Licensee Inc"],
				metadata: { jurisdiction: "Delaware" },
			}),
		);

		const result = await runIntakeAgent(adapter, "license text", "contract-123", "trace-123");

		expect(result.type).toBe("License Agreement");
		expect(result.confidence).toBe(0.91);
		expect(result.parties).toEqual(["SoftwareCorp", "Licensee Inc"]);
		expect(result.metadata).toEqual({ jurisdiction: "Delaware" });
	});

	it("still accepts the legacy runtime shape for backward compatibility", async () => {
		const adapter = new StaticAdapter(
			JSON.stringify({
				type: "NDA",
				confidence: 0.95,
				parties: ["A", "B"],
				metadata: {},
			}),
		);

		const result = await runIntakeAgent(adapter, "nda text", "contract-456", "trace-456");

		expect(result.type).toBe("NDA");
		expect(result.confidence).toBe(0.95);
	});

	it("falls back to UNKNOWN when the model response is invalid JSON", async () => {
		const adapter = new StaticAdapter("not-json");

		const result = await runIntakeAgent(adapter, "text", "contract-789", "trace-789");

		expect(result.type).toBe("UNKNOWN");
		expect(result.confidence).toBe(0);
	});
});