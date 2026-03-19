import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ILlmAdapter, LlmRequest, LlmResponse } from "../types.js";

export class SimulatedAdapter implements ILlmAdapter {
	private readonly cache = new Map<string, string>();

	constructor(private readonly dataDir: string) {}

	async complete(request: LlmRequest): Promise<LlmResponse> {
		const startTime = Date.now();

		// Simulate realistic latency (300-1500ms)
		const simulatedLatency = 300 + Math.floor(Math.random() * 1200);
		await new Promise((r) => setTimeout(r, simulatedLatency));

		// Try to find a pre-recorded response
		const content = await this.findSimulatedResponse(request.prompt);

		return {
			content,
			tokens_in: Math.floor(request.prompt.length / 4),
			tokens_out: Math.floor(content.length / 4),
			latency_ms: Date.now() - startTime,
			model: "simulated",
		};
	}

	private async findSimulatedResponse(prompt: string): Promise<string> {
		// Detect the agent/stage from prompt keywords
		const lowerPrompt = prompt.toLowerCase();

		let stage: string;
		let contractKey: string;

		if (lowerPrompt.includes("classify") || lowerPrompt.includes("intake")) {
			stage = "intake";
		} else if (lowerPrompt.includes("review") || lowerPrompt.includes("redline") || lowerPrompt.includes("material change")) {
			stage = "review";
		} else if (lowerPrompt.includes("negotiat") || lowerPrompt.includes("counterparty") || lowerPrompt.includes("fallback language")) {
			stage = "negotiation";
		} else if (lowerPrompt.includes("compliance") || lowerPrompt.includes("policy")) {
			stage = "compliance";
		} else if (lowerPrompt.includes("approv") || lowerPrompt.includes("route")) {
			stage = "approval";
		} else if (lowerPrompt.includes("extract") || lowerPrompt.includes("clause")) {
			stage = "extraction";
		} else {
			console.warn(
				`[SimulatedAdapter] No keyword match for prompt, defaulting to intake. Prompt start: "${prompt.slice(0, 80)}..."`,
			);
			stage = "intake";
		}

		// Detect contract type from prompt
		if (lowerPrompt.includes("non-disclosure") || lowerPrompt.includes("nda")) {
			contractKey = "nda-001";
		} else if (lowerPrompt.includes("master service") || lowerPrompt.includes("msa")) {
			contractKey = "msa-001";
		} else if (
			lowerPrompt.includes("statement of work") ||
			lowerPrompt.includes("sow") ||
			lowerPrompt.includes("cloud migration")
		) {
			contractKey = "sow-001";
		} else if (lowerPrompt.includes("amendment") || lowerPrompt.includes("data processing")) {
			contractKey = "amendment-001";
		} else if (lowerPrompt.includes("service level") || lowerPrompt.includes("sla") || lowerPrompt.includes("uptime")) {
			contractKey = "sla-001";
		} else {
			contractKey = "nda-001";
		}

		const filePath = resolve(this.dataDir, "simulated", stage, `${contractKey}.json`);
		const cacheKey = `${stage}/${contractKey}`;

		const cached = this.cache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		try {
			const content = await readFile(filePath, "utf-8");
			this.cache.set(cacheKey, content);
			return content;
		} catch {
			// Return a generic response if no simulated data found
			return JSON.stringify({
				status: "simulated",
				message: `No pre-recorded response for ${stage}/${contractKey}`,
			});
		}
	}
}
