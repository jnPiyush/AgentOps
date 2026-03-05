import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { appConfig } from "../config.js";
import type { DriftData } from "../types.js";

let driftData: {
  llm_drift: Record<string, unknown>;
  data_drift: Record<string, unknown>;
  model_swap: Record<string, unknown>;
} | null = null;

async function loadDriftData(): Promise<typeof driftData> {
  if (driftData) return driftData;
  const raw = await readFile(resolve(appConfig.dataDir, "drift.json"), "utf-8");
  driftData = JSON.parse(raw);
  return driftData;
}

export async function driftRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/drift/llm - LLM drift timeline
  app.get("/api/v1/drift/llm", async (_request, reply) => {
    const data = await loadDriftData();
    return reply.send(data?.llm_drift ?? {});
  });

  // GET /api/v1/drift/data - data drift analysis
  app.get("/api/v1/drift/data", async (_request, reply) => {
    const data = await loadDriftData();
    return reply.send(data?.data_drift ?? {});
  });

  // POST /api/v1/drift/model-swap - model swap comparison
  app.post("/api/v1/drift/model-swap", async (_request, reply) => {
    const data = await loadDriftData();
    return reply.send(data?.model_swap ?? {});
  });
}
