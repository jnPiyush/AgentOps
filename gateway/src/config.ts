import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../.env") });

export type DemoMode = "live" | "simulated";
export type FoundryAuthMode = "api-key" | "managed-identity";

export interface AppConfig {
	demoMode: DemoMode;
	readonly allowedOrigins: string[];
	readonly deployAdminKey: string;
	readonly foundryAuthMode: FoundryAuthMode;
	readonly foundryApiKey: string;
	readonly foundryEndpoint: string;
	readonly foundryProjectEndpoint: string;
	readonly foundryManagedIdentityClientId: string;
	readonly foundryModel: string;
	readonly foundryModelSwap: string;
	readonly legalReviewEmail: string;
	readonly gatewayPort: number;
	readonly mcpBasePort: number;
	readonly logLevel: string;
	readonly dataDir: string;
}

function envOrDefault(key: string, fallback: string): string {
	return process.env[key] ?? fallback;
}

function readFoundryAuthMode(): FoundryAuthMode {
	const value = envOrDefault("FOUNDRY_AUTH_MODE", "api-key");
	if (value === "api-key" || value === "managed-identity") {
		return value;
	}

	throw new Error("FOUNDRY_AUTH_MODE must be either 'api-key' or 'managed-identity'");
}

function parsePort(key: string, fallback: number): number {
	const raw = process.env[key];
	if (!raw) return fallback;
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
		throw new Error(`${key} must be a valid port number (1-65535), got: "${raw}"`);
	}
	return parsed;
}

function parseCsvEnv(key: string): string[] {
	const raw = process.env[key]?.trim();
	if (!raw) {
		return [];
	}

	return raw
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

export const appConfig: AppConfig = {
	demoMode: envOrDefault("DEMO_MODE", "simulated") as DemoMode,
	allowedOrigins: parseCsvEnv("ALLOWED_ORIGINS"),
	deployAdminKey: envOrDefault("DEPLOY_ADMIN_KEY", ""),
	foundryAuthMode: readFoundryAuthMode(),
	foundryApiKey: envOrDefault("FOUNDRY_API_KEY", ""),
	foundryEndpoint: envOrDefault("FOUNDRY_ENDPOINT", ""),
	foundryProjectEndpoint: envOrDefault("FOUNDRY_PROJECT_ENDPOINT", envOrDefault("FOUNDRY_ENDPOINT", "")),
	foundryManagedIdentityClientId: envOrDefault("FOUNDRY_MANAGED_IDENTITY_CLIENT_ID", ""),
	foundryModel: envOrDefault("FOUNDRY_MODEL", "gpt-5.4"),
	foundryModelSwap: envOrDefault("FOUNDRY_MODEL_SWAP", "gpt-4o-mini"),
	legalReviewEmail: envOrDefault("LEGAL_REVIEW_EMAIL", "legal-review@company.com"),
	gatewayPort: parsePort("GATEWAY_PORT", 8000),
	mcpBasePort: parsePort("MCP_BASE_PORT", 9001),
	logLevel: envOrDefault("LOG_LEVEL", "INFO"),
	dataDir: resolve(__dirname, "../../data"),
};

export const MCP_SERVERS = [
	{ name: "contract-intake-mcp", port: appConfig.mcpBasePort },
	{ name: "contract-extraction-mcp", port: appConfig.mcpBasePort + 1 },
	{ name: "contract-compliance-mcp", port: appConfig.mcpBasePort + 2 },
	{ name: "contract-workflow-mcp", port: appConfig.mcpBasePort + 3 },
	{ name: "contract-audit-mcp", port: appConfig.mcpBasePort + 4 },
	{ name: "contract-eval-mcp", port: appConfig.mcpBasePort + 5 },
	{ name: "contract-drift-mcp", port: appConfig.mcpBasePort + 6 },
	{ name: "contract-feedback-mcp", port: appConfig.mcpBasePort + 7 },
] as const;

// Validate required env vars when running in live mode
if (appConfig.demoMode === "live") {
	const required = ["FOUNDRY_ENDPOINT"];
	if (appConfig.foundryAuthMode === "api-key") {
		required.push("FOUNDRY_API_KEY");
	}
	const missing = required.filter((k) => !process.env[k]);
	if (missing.length > 0) {
		throw new Error(
			`Live mode requires environment variables: ${missing.join(", ")}. Set them in .env or export them.`,
		);
	}
}
