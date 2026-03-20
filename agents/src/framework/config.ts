/**
 * Microsoft Agent Framework – Configuration
 *
 * Direct TypeScript port of agents/microsoft-framework/config.py
 * (AgentFrameworkConfig, get_model_config, resolve_asset_path, etc.)
 *
 * All paths are resolved relative to the repo root so prompt files,
 * templates, examples and YAML configs can be located the same way
 * the Python framework locates them.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Resolve project root  (agents/src/framework → ../../.. → repo root)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../..");

// ---------------------------------------------------------------------------
// Framework Settings (mirrors Python AgentFrameworkConfig)
// ---------------------------------------------------------------------------

export interface FrameworkSettings {
	// Microsoft Foundry
	foundryEndpoint: string;
	foundryApiKey: string;
	foundryProjectEndpoint: string;

	// Models (pinned versions)
	primaryModel: string;
	fallbackModel: string;
	emergencyModel: string;

	// Agent defaults
	temperature: number;
	maxTokens: number;
	timeoutSeconds: number;

	// Directory paths
	projectRoot: string;
	promptsDir: string;
	templatesDir: string;
	examplesDir: string;
	configDir: string;
	schemasDir: string;
	agentsConfigDir: string;
	workflowsConfigDir: string;
	dataDir: string;
	runtimeDir: string;

	// Reliability
	maxRetries: number;
	retryBackoffBase: number;
}

export function getFrameworkSettings(): FrameworkSettings {
	return {
		foundryEndpoint: process.env.FOUNDRY_ENDPOINT ?? "",
		foundryApiKey: process.env.FOUNDRY_API_KEY ?? "",
		foundryProjectEndpoint: process.env.FOUNDRY_PROJECT_ENDPOINT ?? process.env.FOUNDRY_ENDPOINT ?? "",

		primaryModel: process.env.PRIMARY_MODEL ?? "gpt-5.1-2026-01-15",
		fallbackModel: process.env.FALLBACK_MODEL ?? "gpt-4o-2026-01-15",
		emergencyModel: process.env.EMERGENCY_MODEL ?? "gpt-4o-mini-2026-01-15",

		temperature: Number(process.env.AGENT_TEMPERATURE ?? 0),
		maxTokens: Number(process.env.AGENT_MAX_TOKENS ?? 2048),
		timeoutSeconds: Number(process.env.AGENT_TIMEOUT ?? 30),

		projectRoot: PROJECT_ROOT,
		promptsDir: resolve(PROJECT_ROOT, "prompts"),
		templatesDir: resolve(PROJECT_ROOT, "templates"),
		examplesDir: resolve(PROJECT_ROOT, "examples"),
		configDir: resolve(PROJECT_ROOT, "config"),
		schemasDir: resolve(PROJECT_ROOT, "config", "schemas"),
		agentsConfigDir: resolve(PROJECT_ROOT, "config", "agents"),
		workflowsConfigDir: resolve(PROJECT_ROOT, "config", "workflows"),
		dataDir: resolve(PROJECT_ROOT, "data"),
		runtimeDir: resolve(PROJECT_ROOT, "data", "runtime"),

		maxRetries: Number(process.env.MAX_RETRIES ?? 3),
		retryBackoffBase: Number(process.env.RETRY_BACKOFF_BASE ?? 1),
	};
}

// ---------------------------------------------------------------------------
// Model Configuration  (mirrors Python get_model_config)
// ---------------------------------------------------------------------------

export interface ModelConfig {
	model: string;
	apiKey: string;
	endpoint: string;
	projectEndpoint: string;
	temperature: number;
	maxTokens: number;
	timeout: number;
}

export function getModelConfig(modelType: "primary" | "fallback" | "emergency" = "primary"): ModelConfig {
	const s = getFrameworkSettings();
	const models: Record<string, string> = {
		primary: s.primaryModel,
		fallback: s.fallbackModel,
		emergency: s.emergencyModel,
	};
	return {
		model: models[modelType] ?? s.primaryModel,
		apiKey: s.foundryApiKey,
		endpoint: s.foundryEndpoint,
		projectEndpoint: s.foundryProjectEndpoint,
		temperature: s.temperature,
		maxTokens: s.maxTokens,
		timeout: s.timeoutSeconds,
	};
}

// ---------------------------------------------------------------------------
// Asset helpers  (mirrors Python resolve_asset_path / read_text_asset / read_json_asset)
// ---------------------------------------------------------------------------

export function resolveAssetPath(relativePath: string): string {
	if (resolve(relativePath) === relativePath) return relativePath; // absolute
	return resolve(PROJECT_ROOT, relativePath);
}

export async function readTextAsset(relativePath: string): Promise<string> {
	return readFile(resolveAssetPath(relativePath), "utf-8");
}

export async function readJsonAsset(relativePath: string): Promise<unknown> {
	const text = await readTextAsset(relativePath);
	return JSON.parse(text);
}
