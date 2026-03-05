import type { FastifyInstance } from "fastify";
import { MCP_SERVERS } from "../config.js";
import type { McpServerInfo } from "../types.js";

export async function toolRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/tools - list all MCP servers and their tools
  app.get("/api/v1/tools", async (_request, reply) => {
    const servers: McpServerInfo[] = [];

    for (const server of MCP_SERVERS) {
      try {
        const healthRes = await fetch(`http://localhost:${server.port}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        const healthData = (await healthRes.json()) as { tools?: Array<{ name: string; description?: string }> };

        servers.push({
          name: server.name,
          port: server.port,
          tools: (healthData.tools ?? []).map((t) => ({
            name: t.name,
            description: t.description ?? "",
            inputSchema: {},
          })),
          status: "online",
        });
      } catch {
        servers.push({
          name: server.name,
          port: server.port,
          tools: [],
          status: "offline",
        });
      }
    }

    return reply.send(servers);
  });

  // POST /api/v1/tools/:server/:tool - execute a single MCP tool
  app.post("/api/v1/tools/:server/:tool", async (request, reply) => {
    const { server, tool } = request.params as { server: string; tool: string };
    const body = request.body as { input?: Record<string, unknown> } | null;

    const mcpServer = MCP_SERVERS.find((s) => s.name === server);
    if (!mcpServer) {
      return reply.status(404).send({
        error: "NotFound",
        message: `MCP server '${server}' not found`,
      });
    }

    const startTime = Date.now();

    try {
      // Call the MCP server's tool via SSE/MCP protocol
      // For the demo, we make a direct HTTP call to the MCP server
      const toolInput = body?.input ?? {};

      const response = await fetch(`http://localhost:${mcpServer.port}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: tool, arguments: toolInput },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const result = (await response.json()) as {
        result?: { content?: Array<{ text?: string }> };
        error?: { message: string };
      };

      if (result.error) {
        return reply.status(500).send({
          error: "ToolError",
          message: result.error.message,
        });
      }

      const outputText = result.result?.content?.[0]?.text ?? "{}";
      let output: unknown;
      try {
        output = JSON.parse(outputText);
      } catch {
        output = outputText;
      }

      return reply.send({
        output,
        latency_ms: Date.now() - startTime,
        status: "success",
      });
    } catch (err) {
      return reply.status(503).send({
        error: "ServiceUnavailable",
        message: `MCP server '${server}' is not responding`,
      });
    }
  });
}
