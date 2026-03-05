import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { appConfig, MCP_SERVERS } from "./config.js";
import { initStores } from "./stores/contractStore.js";
import { contractRoutes } from "./routes/contracts.js";
import { toolRoutes } from "./routes/tools.js";
import { auditRoutes } from "./routes/audit.js";
import { evaluationRoutes } from "./routes/evaluations.js";
import { driftRoutes } from "./routes/drift.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { deployRoutes } from "./routes/deploy.js";
import { addWsClient } from "./websocket/workflowWs.js";

export async function startGateway(): Promise<void> {
  await initStores();

  const app = Fastify({ logger: appConfig.logLevel === "DEBUG" });

  await app.register(cors, {
    origin: `http://localhost:${appConfig.dashboardPort}`,
  });

  await app.register(websocket);

  // WebSocket endpoint
  app.register(async (fastify) => {
    fastify.get("/ws/workflow", { websocket: true }, (socket, _req) => {
      addWsClient(socket);
    });
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

  await app.listen({ port: appConfig.gatewayPort, host: "0.0.0.0" });
  console.log(`Gateway listening on http://localhost:${appConfig.gatewayPort}`);
  console.log(`Mode: ${appConfig.demoMode}`);
}

// Allow running directly
startGateway().catch((err) => {
  console.error("Failed to start gateway:", err);
  process.exit(1);
});
