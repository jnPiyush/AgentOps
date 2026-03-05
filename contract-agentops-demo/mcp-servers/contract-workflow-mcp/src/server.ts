import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { z } from "zod";
import { routeApproval, escalateToHuman, notifyStakeholder } from "./engine.js";

const PORT = parseInt(process.env["MCP_WORKFLOW_PORT"] ?? "9004", 10);

const server = new McpServer({
  name: "contract-workflow-mcp",
  version: "1.0.0",
});

server.tool(
  "route_approval",
  "Route contract for approval based on risk level",
  {
    contract_id: z.string().describe("The contract ID"),
    risk_level: z.string().describe("Risk level: low, medium, high, critical"),
    flags_count: z.number().describe("Number of policy violations"),
    reasoning: z.string().optional().describe("Risk assessment reasoning"),
  },
  async ({ contract_id, risk_level, flags_count, reasoning }) => {
    const result = await routeApproval(contract_id, risk_level, flags_count, reasoning);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "escalate_to_human",
  "Escalate a contract for human review",
  {
    contract_id: z.string().describe("The contract ID to escalate"),
    reason: z.string().describe("Reason for escalation"),
    risk_level: z.string().describe("Current risk level"),
  },
  async ({ contract_id, reason, risk_level }) => {
    const result = await escalateToHuman(contract_id, reason, risk_level);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "notify_stakeholder",
  "Send notification to stakeholders about contract status",
  {
    contract_id: z.string().describe("The contract ID"),
    stakeholder: z.string().describe("Stakeholder name or role"),
    message: z.string().describe("Notification message"),
  },
  async ({ contract_id, stakeholder, message }) => {
    const result = await notifyStakeholder(contract_id, stakeholder, message);
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
    res.end(JSON.stringify({ status: "ok", server: "contract-workflow-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`contract-workflow-mcp listening on port ${PORT}`);
});
