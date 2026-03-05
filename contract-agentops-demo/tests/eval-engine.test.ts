import { describe, it, expect } from "vitest";

/**
 * Tests for the Evaluation MCP engine.
 * These test the deterministic eval simulation, ground truth data, and baseline.
 */

// We import the engine functions directly. Since they use __dirname-based paths,
// we need the data directory to exist (which it does at ./data/).
import { getGroundTruth, getBaseline } from "../mcp-servers/contract-eval-mcp/src/engine.js";

describe("contract-eval-mcp engine", () => {
  describe("getGroundTruth", () => {
    it("returns 20 ground truth entries", () => {
      const gt = getGroundTruth();
      expect(gt).toHaveLength(20);
    });

    it("each entry has required fields", () => {
      const gt = getGroundTruth();
      for (const entry of gt) {
        expect(entry).toHaveProperty("contract_id");
        expect(entry).toHaveProperty("expected_type");
        expect(entry).toHaveProperty("expected_clauses");
        expect(entry).toHaveProperty("expected_parties");
        expect(entry).toHaveProperty("expected_risk");
        expect(Array.isArray(entry.expected_clauses)).toBe(true);
        expect(Array.isArray(entry.expected_parties)).toBe(true);
      }
    });

    it("covers all contract types", () => {
      const gt = getGroundTruth();
      const types = new Set(gt.map((e) => e.expected_type));
      expect(types).toContain("NDA");
      expect(types).toContain("MSA");
      expect(types).toContain("SOW");
      expect(types).toContain("Amendment");
      expect(types).toContain("SLA");
    });

    it("has unique contract IDs", () => {
      const gt = getGroundTruth();
      const ids = gt.map((e) => e.contract_id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("getBaseline", () => {
    it("returns a well-formed baseline eval result", () => {
      const baseline = getBaseline();
      expect(baseline.version).toBe("v1.2");
      expect(baseline.total_cases).toBe(20);
      expect(baseline.passed).toBeGreaterThan(0);
      expect(baseline.accuracy).toBeGreaterThan(0);
      expect(baseline.quality_gate).toMatch(/^(PASS|FAIL)$/);
    });

    it("has judge scores between 0 and 5", () => {
      const baseline = getBaseline();
      expect(baseline.judge_scores.relevance).toBeGreaterThanOrEqual(0);
      expect(baseline.judge_scores.relevance).toBeLessThanOrEqual(5);
      expect(baseline.judge_scores.groundedness).toBeGreaterThanOrEqual(0);
      expect(baseline.judge_scores.groundedness).toBeLessThanOrEqual(5);
      expect(baseline.judge_scores.coherence).toBeGreaterThanOrEqual(0);
      expect(baseline.judge_scores.coherence).toBeLessThanOrEqual(5);
    });

    it("has per_metric data", () => {
      const baseline = getBaseline();
      expect(baseline.per_metric).toHaveProperty("extraction_accuracy");
      expect(baseline.per_metric).toHaveProperty("compliance_accuracy");
      expect(baseline.per_metric).toHaveProperty("classification_accuracy");
      expect(baseline.per_metric).toHaveProperty("false_flag_rate");
      expect(baseline.per_metric).toHaveProperty("latency_p95_s");
    });

    it("is deterministic across calls", () => {
      const a = getBaseline();
      const b = getBaseline();
      expect(a.accuracy).toBe(b.accuracy);
      expect(a.passed).toBe(b.passed);
      expect(a.judge_scores).toEqual(b.judge_scores);
    });
  });
});
