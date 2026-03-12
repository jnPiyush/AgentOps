import type { ILlmAdapter, LlmRequest, LlmResponse } from "../types.js";
import { withFoundryAuthHeaders, type FoundryAuthConfig } from "../services/foundryAuth.js";

const DEPLOY_API_VERSION = "2024-10-21";

export class FoundryAdapter implements ILlmAdapter {
	constructor(
		private readonly endpoint: string,
		private readonly authConfig: FoundryAuthConfig,
		private readonly model: string,
	) {
		if (!endpoint) {
			throw new Error("FOUNDRY_ENDPOINT is required for live mode");
		}

		if (authConfig.authMode === "api-key" && !authConfig.apiKey) {
			throw new Error("FOUNDRY_API_KEY is required when FOUNDRY_AUTH_MODE=api-key");
		}
	}

	async complete(request: LlmRequest): Promise<LlmResponse> {
		const startTime = Date.now();

		const body = {
			messages: [
				...(request.system_prompt ? [{ role: "system" as const, content: request.system_prompt }] : []),
				{ role: "user" as const, content: request.prompt },
			],
			temperature: request.temperature ?? 0,
			max_tokens: request.max_tokens ?? 2048,
			...(request.response_format === "json" ? { response_format: { type: "json_object" } } : {}),
		};

		const response = await fetch(
			`${this.endpoint}/openai/deployments/${encodeURIComponent(this.model)}/chat/completions?api-version=${DEPLOY_API_VERSION}`,
			{
				method: "POST",
				headers: await withFoundryAuthHeaders(this.authConfig, {
					"Content-Type": "application/json",
				}),
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(30_000),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Foundry API error ${response.status}: ${errorText}`);
		}

		const data = (await response.json()) as {
			choices: Array<{ message: { content: string } }>;
			usage: { prompt_tokens: number; completion_tokens: number };
		};

		return {
			content: data.choices[0]?.message.content ?? "",
			tokens_in: data.usage.prompt_tokens,
			tokens_out: data.usage.completion_tokens,
			latency_ms: Date.now() - startTime,
			model: this.model,
		};
	}
}
