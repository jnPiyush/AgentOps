import type { FastifyInstance } from "fastify";
import { auditStore } from "../stores/contractStore.js";
import { getTraces } from "../orchestrator/pipeline.js";

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/audit/:contractId - decision audit trail
  app.get("/api/v1/audit/:contractId", async (request, reply) => {
    const { contractId } = request.params as { contractId: string };
    const entries = auditStore.getByField("contract_id", contractId);
    return reply.send(entries);
  });

  // GET /api/v1/traces/:contractId - trace data
  app.get("/api/v1/traces/:contractId", async (request, reply) => {
    const { contractId } = request.params as { contractId: string };
    const traces = getTraces(contractId);
    return reply.send(traces);
  });
}
