import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { classifyDocument, extractMetadata, uploadContract } from "./engine.js";

const PORT = Number.parseInt(process.env.MCP_INTAKE_PORT ?? "9001", 10);

const server = new McpServer({
	name: "contract-intake-mcp",
	version: "1.0.0",
});

server.tool(
	"upload_contract",
	"Upload a contract document for processing",
	{
		text: z.string().describe("The full text content of the contract"),
		filename: z.string().describe("Original filename of the contract"),
	},
	async ({ text, filename }) => {
		const result = await uploadContract(text, filename);
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

server.tool(
	"classify_document",
	"Classify a contract by type (NDA, MSA, Services Agreement, SOW, Amendment, SLA, Sales, Distribution, Supply, License, SaaS/Cloud, Promissory Note, Loan Agreement)",
	{
		text: z.string().describe("The contract text to classify"),
	},
	async ({ text }) => {
		const result = await classifyDocument(text);
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

server.tool(
	"extract_metadata",
	"Extract metadata from a contract (parties, dates, jurisdiction)",
	{
		text: z.string().describe("The contract text to extract metadata from"),
	},
	async ({ text }) => {
		const result = await extractMetadata(text);
		return {
			content: [{ type: "text" as const, text: JSON.stringify(result) }],
		};
	},
);

// SSE transports keyed by session ID for concurrent client support
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
		res.end(JSON.stringify({ status: "ok", server: "contract-intake-mcp" }));
	} else {
		res.writeHead(404);
		res.end("Not found");
	}
});

httpServer.listen(PORT, () => {
	console.log(`contract-intake-mcp listening on port ${PORT}`);
});
