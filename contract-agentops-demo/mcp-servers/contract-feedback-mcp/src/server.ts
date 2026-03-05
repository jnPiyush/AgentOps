import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { z } from "zod";
import { submitFeedback, convertToTestCases, getFeedbackSummary } from "./engine.js";

const PORT = parseInt(process.env["MCP_FEEDBACK_PORT"] ?? "9008", 10);

const server = new McpServer({
  name: "contract-feedback-mcp",
  version: "1.0.0",
});

server.tool(
  "submit_feedback",
  "Submit human feedback (thumbs up/down with comment) on an agent output for a specific contract",
  {
    contract_id: z.string().describe("The contract ID the feedback relates to"),
    agent: z.string().describe("The agent name (intake, extraction, compliance, approval)"),
    sentiment: z.enum(["positive", "negative"]).describe("Positive or negative feedback"),
    comment: z.string().describe("Detailed feedback comment"),
    reviewer: z.string().describe("Name of the reviewer"),
  },
  async ({ contract_id, agent, sentiment, comment, reviewer }) => {
    const result = await submitFeedback(contract_id, agent, sentiment, comment, reviewer);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "convert_to_tests",
  "Convert all unconverted negative feedback into evaluation test cases for the improvement cycle",
  {},
  async () => {
    const result = await convertToTestCases();
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "get_summary",
  "Get feedback trends and per-agent satisfaction summary with recent entries",
  {},
  async () => {
    const result = await getFeedbackSummary();
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
    res.end(JSON.stringify({ status: "ok", server: "contract-feedback-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`contract-feedback-mcp listening on port ${PORT}`);
});
