import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { contractStore, auditStore } from "../stores/contractStore.js";
import { runPipeline, storeTraces } from "../orchestrator/pipeline.js";
import { broadcast } from "../websocket/workflowWs.js";
import { createLlmAdapter } from "../adapters/llmAdapter.js";
import type { ReviewEntry, AuditEntry } from "../types.js";

const MAX_TEXT_LENGTH = 50_000;

export async function contractRoutes(app: FastifyInstance): Promise<void> {
  const adapter = createLlmAdapter();

  // POST /api/v1/contracts - submit a contract for processing
  app.post("/api/v1/contracts", async (request, reply) => {
    const body = request.body as { text?: string; filename?: string; source?: string } | null;

    if (!body?.text || typeof body.text !== "string" || body.text.trim().length === 0) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Contract text is required",
        details: { field: "text", reason: "required" },
        request_id: randomUUID(),
      });
    }

    if (body.text.length > MAX_TEXT_LENGTH) {
      return reply.status(400).send({
        error: "ValidationError",
        message: `Contract text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
        details: { field: "text", reason: "too_long" },
        request_id: randomUUID(),
      });
    }

    const filename = typeof body.filename === "string" ? body.filename : "unnamed-contract.txt";

    // Run pipeline asynchronously, return 202 immediately
    const contractId = `contract-${randomUUID().slice(0, 8)}`;

    // Start pipeline in background
    runPipeline(body.text, filename, adapter, broadcast)
      .then((result) => storeTraces(result.contract.id, result.traces))
      .catch((err) => {
        console.error("Pipeline error:", err);
        broadcast({
          event: "error",
          contract_id: contractId,
          status: "pipeline_error",
          result: { error: String(err) },
          timestamp: new Date().toISOString(),
        });
      });

    return reply.status(202).send({
      contract_id: contractId,
      status: "processing",
      message: "Contract submitted. Follow /ws/workflow for real-time updates.",
    });
  });

  // GET /api/v1/contracts - list all contracts
  app.get("/api/v1/contracts", async (_request, reply) => {
    const contracts = contractStore.getAll();
    return reply.send(contracts);
  });

  // GET /api/v1/contracts/:id - get contract details
  app.get("/api/v1/contracts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const contract = contractStore.getById(id);
    if (!contract) {
      return reply.status(404).send({
        error: "NotFound",
        message: `Contract ${id} not found`,
        request_id: randomUUID(),
      });
    }
    return reply.send(contract);
  });

  // POST /api/v1/contracts/:id/review - submit HITL review
  app.post("/api/v1/contracts/:id/review", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { decision?: string; reviewer?: string; comment?: string } | null;

    const contract = contractStore.getById(id);
    if (!contract) {
      return reply.status(404).send({
        error: "NotFound",
        message: `Contract ${id} not found`,
        request_id: randomUUID(),
      });
    }

    if (!body?.decision || !["approve", "reject", "request_changes"].includes(body.decision)) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Decision must be one of: approve, reject, request_changes",
        details: { field: "decision", reason: "invalid" },
        request_id: randomUUID(),
      });
    }

    const newStatus = body.decision === "approve" ? "approved" : body.decision === "reject" ? "rejected" : "awaiting_review";

    await contractStore.update(id, {
      status: newStatus,
      completed_at: new Date().toISOString(),
    });

    const auditEntry: AuditEntry = {
      id: randomUUID(),
      contract_id: id,
      agent: "human",
      action: body.decision as AuditEntry["action"],
      reasoning: body.comment ?? "",
      timestamp: new Date().toISOString(),
    };
    await auditStore.add(auditEntry);

    broadcast({
      event: "pipeline_status",
      contract_id: id,
      status: newStatus === "approved" ? "approved" : "rejected",
      timestamp: new Date().toISOString(),
    });

    return reply.send({
      contract_id: id,
      decision: body.decision,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });
  });
}
