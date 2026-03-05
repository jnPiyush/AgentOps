import { describe, it, expect, beforeEach } from "vitest";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

// Reset feedback.json before each test to ensure clean state
beforeEach(async () => {
  await writeFile(resolve(DATA_DIR, "feedback.json"), "[]");
});

// Dynamic import to avoid module-level side effects with caching
async function loadEngine() {
  // Each call gets a fresh module with the cleared file
  const mod = await import("../mcp-servers/contract-feedback-mcp/src/engine.js");
  return mod;
}

describe("contract-feedback-mcp engine", () => {
  describe("submitFeedback", () => {
    it("creates a feedback entry with correct shape", async () => {
      const { submitFeedback } = await loadEngine();
      const entry = await submitFeedback("NDA-001", "extraction", "negative", "Missed a clause", "Alice");
      expect(entry).toHaveProperty("id");
      expect(entry.contract_id).toBe("NDA-001");
      expect(entry.agent).toBe("extraction");
      expect(entry.sentiment).toBe("negative");
      expect(entry.comment).toBe("Missed a clause");
      expect(entry.reviewer).toBe("Alice");
      expect(entry.converted_to_test).toBe(false);
    });

    it("persists multiple entries", async () => {
      const { submitFeedback, getFeedbackSummary } = await loadEngine();
      await submitFeedback("NDA-001", "extraction", "negative", "Bad extraction", "Alice");
      await submitFeedback("MSA-001", "compliance", "positive", "Good job", "Bob");
      const summary = await getFeedbackSummary();
      expect(summary.total).toBe(2);
    });
  });

  describe("getFeedbackSummary", () => {
    it("returns correct counts", async () => {
      const { submitFeedback, getFeedbackSummary } = await loadEngine();
      await submitFeedback("NDA-001", "extraction", "negative", "Bad", "A");
      await submitFeedback("NDA-002", "extraction", "positive", "Good", "B");
      await submitFeedback("MSA-001", "compliance", "negative", "Issue", "C");

      const summary = await getFeedbackSummary();
      expect(summary.total).toBe(3);
      expect(summary.positive).toBe(1);
      expect(summary.negative).toBe(2);
    });

    it("calculates per-agent satisfaction correctly", async () => {
      const { submitFeedback, getFeedbackSummary } = await loadEngine();
      await submitFeedback("NDA-001", "extraction", "positive", "g1", "A");
      await submitFeedback("NDA-002", "extraction", "positive", "g2", "B");
      await submitFeedback("NDA-003", "extraction", "negative", "b1", "C");

      const summary = await getFeedbackSummary();
      // 2 positive out of 3 total = 67% satisfaction
      expect(summary.by_agent.extraction.satisfaction).toBe(67);
    });

    it("returns recent entries in reverse order", async () => {
      const { submitFeedback, getFeedbackSummary } = await loadEngine();
      await submitFeedback("NDA-001", "extraction", "positive", "first", "A");
      await submitFeedback("NDA-002", "extraction", "negative", "second", "B");

      const summary = await getFeedbackSummary();
      expect(summary.recent[0].comment).toBe("second");
      expect(summary.recent[1].comment).toBe("first");
    });
  });

  describe("convertToTestCases", () => {
    it("converts negative feedback to test cases", async () => {
      const { submitFeedback, convertToTestCases } = await loadEngine();
      await submitFeedback("NDA-001", "extraction", "negative", "Missed liability clause", "Alice");
      await submitFeedback("MSA-001", "compliance", "positive", "Good", "Bob");

      const result = await convertToTestCases();
      expect(result.test_cases_created).toBe(1);
      expect(result.feedbacks_converted).toBe(1);
      expect(result.test_cases[0].agent).toBe("extraction");
    });

    it("skips already converted feedback", async () => {
      const { submitFeedback, convertToTestCases } = await loadEngine();
      await submitFeedback("NDA-001", "extraction", "negative", "Issue", "A");

      const first = await convertToTestCases();
      expect(first.test_cases_created).toBe(1);

      const second = await convertToTestCases();
      expect(second.test_cases_created).toBe(0);
    });

    it("skips positive feedback", async () => {
      const { submitFeedback, convertToTestCases } = await loadEngine();
      await submitFeedback("NDA-001", "extraction", "positive", "All good", "A");

      const result = await convertToTestCases();
      expect(result.test_cases_created).toBe(0);
    });
  });
});
