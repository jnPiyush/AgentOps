import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { feedbackStore } from "../stores/contractStore.js";
import { appConfig } from "../config.js";
import type { FeedbackEntry } from "../types.js";

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/feedback - submit feedback
  app.post("/api/v1/feedback", async (request, reply) => {
    const body = request.body as {
      contract_id?: string;
      agent?: string;
      sentiment?: string;
      comment?: string;
      reviewer?: string;
    } | null;

    if (!body?.contract_id || !body.agent || !body.sentiment || !body.comment) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "contract_id, agent, sentiment, and comment are required",
        request_id: randomUUID(),
      });
    }

    if (!["positive", "negative"].includes(body.sentiment)) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Sentiment must be 'positive' or 'negative'",
        request_id: randomUUID(),
      });
    }

    const entry: FeedbackEntry = {
      id: randomUUID(),
      contract_id: body.contract_id,
      agent: body.agent,
      sentiment: body.sentiment as FeedbackEntry["sentiment"],
      comment: body.comment,
      reviewer: body.reviewer ?? "anonymous",
      submitted_at: new Date().toISOString(),
      converted_to_test: false,
    };

    await feedbackStore.add(entry);
    return reply.status(201).send(entry);
  });

  // GET /api/v1/feedback/summary - feedback trends
  app.get("/api/v1/feedback/summary", async (_request, reply) => {
    const entries = feedbackStore.getAll();
    const positive = entries.filter((e) => e.sentiment === "positive").length;
    const negative = entries.filter((e) => e.sentiment === "negative").length;
    const converted = entries.filter((e) => e.converted_to_test).length;

    const byAgent: Record<string, { positive: number; negative: number; satisfaction: number }> = {};
    for (const entry of entries) {
      if (!byAgent[entry.agent]) {
        byAgent[entry.agent] = { positive: 0, negative: 0, satisfaction: 0 };
      }
      byAgent[entry.agent][entry.sentiment]++;
    }
    for (const key of Object.keys(byAgent)) {
      const a = byAgent[key];
      const total = a.positive + a.negative;
      a.satisfaction = total > 0 ? Math.round((a.positive / total) * 100) : 0;
    }

    return reply.send({
      total: entries.length,
      positive,
      negative,
      converted_to_tests: converted,
      by_agent: byAgent,
      recent: entries.slice(-10).reverse(),
    });
  });

  // POST /api/v1/feedback/optimize - convert negative feedback to test cases
  app.post("/api/v1/feedback/optimize", async (_request, reply) => {
    const entries = feedbackStore.getAll();
    const negative = entries.filter((e) => e.sentiment === "negative" && !e.converted_to_test);

    const testCases = negative.map((fb) => ({
      id: `tc-${randomUUID().slice(0, 8)}`,
      source_feedback_id: fb.id,
      contract_id: fb.contract_id,
      agent: fb.agent,
      test_description: `Verify ${fb.agent} handles: ${fb.comment.slice(0, 80)}`,
      expected_behavior: `Agent should correctly address: ${fb.comment.slice(0, 100)}`,
      created_at: new Date().toISOString(),
    }));

    // Mark feedbacks as converted
    for (const fb of negative) {
      await feedbackStore.update(fb.id, { converted_to_test: true });
    }

    return reply.status(201).send({
      test_cases_created: testCases.length,
      test_cases: testCases,
      feedbacks_converted: negative.length,
    });
  });

  // GET /api/v1/prompts/:agent - get current agent prompt
  app.get("/api/v1/prompts/:agent", async (request, reply) => {
    const { agent } = request.params as { agent: string };
    const validAgents = ["intake", "extraction", "compliance", "approval"];
    if (!validAgents.includes(agent)) {
      return reply.status(400).send({ error: "Invalid agent name" });
    }

    try {
      const promptPath = resolve(appConfig.dataDir, `../prompts/${agent}-system.md`);
      const content = await readFile(promptPath, "utf-8");
      return reply.send({ agent, prompt: content });
    } catch {
      return reply.status(404).send({ error: "Prompt not found" });
    }
  });

  // POST /api/v1/prompts/:agent - update agent prompt
  app.post("/api/v1/prompts/:agent", async (request, reply) => {
    const { agent } = request.params as { agent: string };
    const body = request.body as { prompt?: string } | null;
    const validAgents = ["intake", "extraction", "compliance", "approval"];

    if (!validAgents.includes(agent)) {
      return reply.status(400).send({ error: "Invalid agent name" });
    }
    if (!body?.prompt) {
      return reply.status(400).send({ error: "prompt field required" });
    }

    const MAX_PROMPT_LENGTH = 50_000;
    if (body.prompt.length > MAX_PROMPT_LENGTH) {
      return reply.status(400).send({ error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` });
    }

    const promptPath = resolve(appConfig.dataDir, `../prompts/${agent}-system.md`);
    await writeFile(promptPath, body.prompt, "utf-8");
    return reply.send({ agent, updated: true, version: `v1.${Date.now() % 100}` });
  });
}
