import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../.env") });

export type DemoMode = "live" | "simulated";

export interface AppConfig {
  readonly demoMode: DemoMode;
  readonly foundryApiKey: string;
  readonly foundryEndpoint: string;
  readonly foundryProjectEndpoint: string;
  readonly foundryModel: string;
  readonly foundryModelSwap: string;
  readonly gatewayPort: number;
  readonly dashboardPort: number;
  readonly mcpBasePort: number;
  readonly logLevel: string;
  readonly dataDir: string;
}

function envOrDefault(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const appConfig: AppConfig = {
  demoMode: (envOrDefault("DEMO_MODE", "simulated") as DemoMode),
  foundryApiKey: envOrDefault("FOUNDRY_API_KEY", ""),
  foundryEndpoint: envOrDefault("FOUNDRY_ENDPOINT", ""),
  foundryProjectEndpoint: envOrDefault("FOUNDRY_PROJECT_ENDPOINT", ""),
  foundryModel: envOrDefault("FOUNDRY_MODEL", "gpt-4o"),
  foundryModelSwap: envOrDefault("FOUNDRY_MODEL_SWAP", "gpt-4o-mini"),
  gatewayPort: parseInt(envOrDefault("GATEWAY_PORT", "8000"), 10),
  dashboardPort: parseInt(envOrDefault("DASHBOARD_PORT", "3000"), 10),
  mcpBasePort: parseInt(envOrDefault("MCP_BASE_PORT", "9001"), 10),
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
