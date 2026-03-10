import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { detectDataDrift, detectLlmDrift, simulateModelSwap } from "./engine.js";

const PORT = Number.parseInt(process.env.MCP_DRIFT_PORT ?? "9007", 10);

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
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

server.tool(
	"detect_data_drift",
	"Detect shifts in contract type distribution and identify new contract types not in training data",
	{},
	async () => {
		const result = await detectDataDrift();
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

server.tool(
	"simulate_model_swap",
	"Compare GPT-5.4 vs GPT-4o-mini on accuracy, latency, and cost metrics to evaluate model swap viability",
	{},
	async () => {
		const result = await simulateModelSwap();
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

const transports = new Map<string, SSEServerTransport>();

const httpServer = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

	if (req.method === "GET" && url.pathname === "/sse") {
		const transport = new SSEServerTransport("/messages", res);
		transports.set(transport.sessionId, transport);
		res.on("close", () => transports.delete(transport.sessionId));
		await server.connect(transport);
	} else if (req.method === "POST" && url.pathname === "/messages") {
		const sessionId = url.searchParams.get("sessionId");
		const transport = sessionId ? transports.get(sessionId) : undefined;
		if (transport) {
			await transport.handlePostMessage(req, res);
		} else {
			res.writeHead(503);
			res.end("Server not connected");
		}
	} else if (req.method === "GET" && url.pathname === "/health") {
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
