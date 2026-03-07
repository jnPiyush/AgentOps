import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
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
import { toolRoutes } from "./routes/tools.js";
import { workflowRoutes } from "./routes/workflows.js";
import { initStores } from "./stores/contractStore.js";
import { addWsClient } from "./websocket/workflowWs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startGateway(): Promise<void> {
	await initStores();

	const app = Fastify({ logger: appConfig.logLevel === "DEBUG" });

	await app.register(cors, {
		origin: ["http://localhost:8000", `http://localhost:${appConfig.gatewayPort}`],
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
		const body = request.body as { mode?: string } | null;
		const mode = body?.mode;
		if (mode !== "live" && mode !== "simulated") {
			return reply.status(400).send({ error: "Invalid mode. Use 'live' or 'simulated'." });
		}
		appConfig.demoMode = mode;
		return reply.send({ mode: appConfig.demoMode });
	});

	// Health check
	app.get("/api/v1/health", async (_request, reply) => {
		const serverStatuses: Record<string, string> = {};
		for (const server of MCP_SERVERS) {
			try {
				const res = await fetch(`http://localhost:${server.port}/health`, {
					signal: AbortSignal.timeout(2000),
				});
				serverStatuses[server.name] = res.ok ? "online" : "error";
			} catch {
				serverStatuses[server.name] = "offline";
			}
		}

		return reply.send({
			status: "ok",
			mode: appConfig.demoMode,
			servers: serverStatuses,
			timestamp: new Date().toISOString(),
		});
	});

	// Register routes
	await app.register(contractRoutes);
	await app.register(toolRoutes);
	await app.register(auditRoutes);
	await app.register(evaluationRoutes);
	await app.register(driftRoutes);
	await app.register(feedbackRoutes);
	await app.register(deployRoutes);
	await app.register(promptRoutes);
	await app.register(sampleContractRoutes);
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
