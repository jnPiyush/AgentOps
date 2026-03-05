import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { z } from "zod";
import {
  classifyDocument,
  extractMetadata,
  uploadContract,
} from "./engine.js";

const PORT = parseInt(process.env["MCP_INTAKE_PORT"] ?? "9001", 10);

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
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "classify_document",
  "Classify a contract by type (NDA, MSA, SOW, Amendment, SLA)",
  {
    text: z.string().describe("The contract text to classify"),
  },
  async ({ text }) => {
    const result = await classifyDocument(text);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
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
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

// SSE transport for HTTP-based communication
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
    res.end(JSON.stringify({ status: "ok", server: "contract-intake-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`contract-intake-mcp listening on port ${PORT}`);
});
