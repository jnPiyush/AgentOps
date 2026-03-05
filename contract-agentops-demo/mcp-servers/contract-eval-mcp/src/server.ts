import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { z } from "zod";
import { runEvalSuite, getEvalResults, getGroundTruth, getBaseline } from "./engine.js";

const PORT = parseInt(process.env["MCP_EVAL_PORT"] ?? "9006", 10);

const server = new McpServer({
  name: "contract-eval-mcp",
  version: "1.0.0",
});

server.tool(
  "run_evaluation",
  "Run the full evaluation suite against ground truth data with LLM-as-judge scoring",
  {
    version: z.string().describe("Version label for this evaluation run (e.g. v1.3)"),
  },
  async ({ version }) => {
    const result = await runEvalSuite(version);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

server.tool(
  "get_results",
  "Retrieve all evaluation results from previous runs",
  {},
  async () => {
    const results = await getEvalResults();
    return { content: [{ type: "text" as const, text: JSON.stringify(results) }] };
  },
);

server.tool(
  "compare_baseline",
  "Compare current evaluation against the baseline version",
  {
    current_version: z.string().describe("The current version to compare against baseline"),
  },
  async ({ current_version }) => {
    const baseline = getBaseline();
    const results = await getEvalResults();
    const current = results.find((r) => r.version === current_version) ?? await runEvalSuite(current_version);
    const comparison = {
      baseline: { version: baseline.version, accuracy: baseline.accuracy, judge_scores: baseline.judge_scores },
      current: { version: current.version, accuracy: current.accuracy, judge_scores: current.judge_scores },
      delta: {
        accuracy: Math.round((current.accuracy - baseline.accuracy) * 10) / 10,
        relevance: current.judge_scores ? Math.round((current.judge_scores.relevance - baseline.judge_scores.relevance) * 10) / 10 : 0,
        groundedness: current.judge_scores ? Math.round((current.judge_scores.groundedness - baseline.judge_scores.groundedness) * 10) / 10 : 0,
        coherence: current.judge_scores ? Math.round((current.judge_scores.coherence - baseline.judge_scores.coherence) * 10) / 10 : 0,
      },
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(comparison) }] };
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
    res.end(JSON.stringify({ status: "ok", server: "contract-eval-mcp" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`contract-eval-mcp listening on port ${PORT}`);
});
