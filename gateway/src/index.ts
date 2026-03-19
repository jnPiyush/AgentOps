import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { MCP_SERVERS, appConfig } from "./config.js";
import { auditRoutes } from "./routes/audit.js";
import { contractRoutes } from "./routes/contracts.js";
import { deployRoutes } from "./routes/deploy.js";
import { driftRoutes } from "./routes/drift.js";
import { evaluationRoutes } from "./routes/evaluations.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { promptRoutes } from "./routes/prompts.js";
import { sampleContractRoutes } from "./routes/sampleContracts.js";
import { testScenarioRoutes } from "./routes/testScenarios.js";
import { toolRoutes } from "./routes/tools.js";
import { workflowRoutes } from "./routes/workflows.js";
import { initWorkflowRegistry } from "./services/workflowRegistry.js";
import { initStores } from "./stores/contractStore.js";
import { addWsClient } from "./websocket/workflowWs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getCorsOrigins(): string[] {
	if (appConfig.allowedOrigins.length > 0) {
		return appConfig.allowedOrigins;
	}

	return ["http://localhost:8000", `http://localhost:${appConfig.gatewayPort}`];
}

function ensureAdminAccess(headerValue: string | undefined): {
	allowed: boolean;
	statusCode?: 401 | 503;
	error?: string;
	message?: string;
} {
	if (!appConfig.deployAdminKey) {
		return {
			allowed: false,
			statusCode: 503,
			error: "admin_key_not_configured",
			message: "DEPLOY_ADMIN_KEY must be configured for admin routes",
		};
	}

	if (headerValue !== appConfig.deployAdminKey) {
		return {
			allowed: false,
			statusCode: 401,
			error: "unauthorized",
			message: "Missing or invalid admin key",
		};
	}

	return { allowed: true };
}

export async function startGateway(): Promise<void> {
	await initStores();
	await initWorkflowRegistry();

	const app = Fastify({ logger: appConfig.logLevel === "DEBUG" });

	await app.register(rateLimit, {
		global: true,
		max: 100,
		timeWindow: "1 minute",
	});

	await app.register(cors, {
		origin: getCorsOrigins(),
	});

	// Serve the static UI as default
	await app.register(fastifyStatic, {
		root: resolve(__dirname, "../../ui"),
		prefix: "/",
	});

	await app.register(websocket);

	// WebSocket endpoint
	app.register(async (fastify) => {
		fastify.get("/ws/workflow", { websocket: true }, (socket, _req) => {
			addWsClient(socket);
		});
	});

	// Mode toggle endpoint
	app.post("/api/v1/mode", async (request, reply) => {
		const access = ensureAdminAccess(request.headers["x-admin-key"] as string | undefined);
		if (!access.allowed) {
			return reply.status(access.statusCode ?? 401).send({
				error: access.error,
				message: access.message,
			});
		}

		const body = request.body as { mode?: string } | null;
		const mode = body?.mode;
		if (mode !== "live" && mode !== "simulated") {
			return reply.status(400).send({ error: "Invalid mode. Use 'live' or 'simulated'." });
		}
		appConfig.demoMode = mode;
		return reply.send({ mode: appConfig.demoMode });
	});

	// Client config (returns non-secret UI settings)
	// NOTE: deployAdminKey is intentionally NOT returned here — leaking it over a
	// public GET endpoint would allow any browser user to call protected deploy
	// routes in live mode.  The azd postdeploy hook supplies the key server-side.
	// In simulated mode the deploy endpoint performs no key check, so the UI
	// default key ("local-dev-key") continues to work without exposure.
	app.get("/api/v1/client-config", async (_request, reply) => {
		return reply.send({
			mode: appConfig.demoMode,
			// requiresAdminKey lets the UI show/hide deploy controls without
			// exposing the actual secret.
			requiresAdminKey: appConfig.demoMode === "live" && Boolean(appConfig.deployAdminKey),
		});
	});

	// Health check
	app.get("/api/v1/health", async (_request, reply) => {
		const results = await Promise.all(
			MCP_SERVERS.map(async (server) => {
				try {
					const res = await fetch(`http://localhost:${server.port}/health`, {
						signal: AbortSignal.timeout(2000),
					});
					return [server.name, res.ok ? "online" : "error"] as const;
				} catch {
					return [server.name, "offline"] as const;
				}
			}),
		);
		const serverStatuses: Record<string, string> = Object.fromEntries(results);

		return reply.send({
			status: "ok",
			mode: appConfig.demoMode,
			servers: serverStatuses,
			timestamp: new Date().toISOString(),
		});
	});

	// Register routes
	await app.register(contractRoutes, {
		config: {
			rateLimit: {
				max: 10,
				timeWindow: "1 minute",
			},
		},
	});
	await app.register(toolRoutes);
	await app.register(auditRoutes);
	await app.register(evaluationRoutes, {
		config: {
			rateLimit: {
				max: 20,
				timeWindow: "1 minute",
			},
		},
	});
	await app.register(driftRoutes);
	await app.register(feedbackRoutes);
	await app.register(deployRoutes);
	await app.register(promptRoutes);
	await app.register(sampleContractRoutes);
	await app.register(testScenarioRoutes, {
		config: {
			rateLimit: {
				max: 20,
				timeWindow: "1 minute",
			},
		},
	});
	await app.register(workflowRoutes);

	await app.listen({ port: appConfig.gatewayPort, host: "0.0.0.0" });
	console.log(`Gateway listening on http://localhost:${appConfig.gatewayPort}`);
	console.log(`Mode: ${appConfig.demoMode}`);
}

// Allow running directly
startGateway().catch((err) => {
	console.error("Failed to start gateway:", err);
	process.exit(1);
});
