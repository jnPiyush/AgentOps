import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { detectLlmDrift, detectDataDrift, simulateModelSwap } from "./engine.js";

const PORT = parseInt(process.env["MCP_DRIFT_PORT"] ?? "9007", 10);

const server = new McpServer({
  name: "contract-drift-mcp",
  version: "1.0.0",
});

server.tool(
  "detect_llm_drift",
  "Detect LLM accuracy drift over time by comparing weekly performance metrics against threshold",
  {},
  async () => {
    const result = await detectLlmDrift();
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "detect_data_drift",
  "Detect shifts in contract type distribution and identify new contract types not in training data",
  {},
  async () => {
    const result = await detectDataDrift();
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "simulate_model_swap",
  "Compare GPT-4o vs GPT-4o-mini on accuracy, latency, and cost metrics to evaluate model swap viability",
  {},
  async () => {
    const result = await simulateModelSwap();
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

let transport: SSEServerTransport | undefined;

const httpServer = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/sse") {
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
  } else if (req.method === "POST" && req.url === "/messages") {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.writeHead(503);
      res.end("Server not connected");
    }
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "contract-drift-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`contract-drift-mcp listening on port ${PORT}`);
});
