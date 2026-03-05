import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { z } from "zod";
import { checkPolicy, flagRisk, getPolicyRules } from "./engine.js";

const PORT = parseInt(process.env["MCP_COMPLIANCE_PORT"] ?? "9003", 10);

const server = new McpServer({
  name: "contract-compliance-mcp",
  version: "1.0.0",
});

server.tool(
  "check_policy",
  "Check extracted clauses against company policies",
  {
    clauses: z.string().describe("JSON array of extracted clauses"),
    contract_type: z.string().optional().describe("Type of contract"),
  },
  async ({ clauses, contract_type }) => {
    const parsedClauses = JSON.parse(clauses) as Array<{
      type: string;
      text: string;
      section: string;
    }>;
    const result = await checkPolicy(parsedClauses, contract_type);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "flag_risk",
  "Assess overall risk level based on compliance results",
  {
    clause_results: z.string().describe("JSON array of clause compliance results"),
  },
  async ({ clause_results }) => {
    const parsed = JSON.parse(clause_results) as Array<{
      clause_type: string;
      status: string;
      policy_ref: string;
      reason: string;
    }>;
    const result = await flagRisk(parsed);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "get_policy_rules",
  "Retrieve company policy rules for compliance checking",
  {},
  async () => {
    const rules = await getPolicyRules();
    return { content: [{ type: "text" as const, text: JSON.stringify(rules) }] };
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
    res.end(JSON.stringify({ status: "ok", server: "contract-compliance-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`contract-compliance-mcp listening on port ${PORT}`);
});
