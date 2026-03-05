import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { z } from "zod";
import { logDecision, getAuditTrail, generateReport } from "./engine.js";

const PORT = parseInt(process.env["MCP_AUDIT_PORT"] ?? "9005", 10);

const server = new McpServer({
  name: "contract-audit-mcp",
  version: "1.0.0",
});

server.tool(
  "log_decision",
  "Log an agent or human decision to the audit trail",
  {
    contract_id: z.string().describe("The contract ID"),
    agent: z.string().describe("Agent or actor name"),
    action: z.string().describe("Action taken"),
    reasoning: z.string().describe("Reasoning for the decision"),
  },
  async ({ contract_id, agent, action, reasoning }) => {
    const result = await logDecision(contract_id, agent, action, reasoning);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "get_audit_trail",
  "Retrieve the decision audit trail for a contract",
  {
    contract_id: z.string().describe("The contract ID to retrieve audit trail for"),
  },
  async ({ contract_id }) => {
    const result = await getAuditTrail(contract_id);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "generate_report",
  "Generate a summary audit report for a contract",
  {
    contract_id: z.string().describe("The contract ID to generate report for"),
  },
  async ({ contract_id }) => {
    const result = await generateReport(contract_id);
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
    res.end(JSON.stringify({ status: "ok", server: "contract-audit-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`contract-audit-mcp listening on port ${PORT}`);
});
