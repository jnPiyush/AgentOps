import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");

interface FeedbackEntry {
  id: string;
  contract_id: string;
  agent: string;
  sentiment: "positive" | "negative";
  comment: string;
  reviewer: string;
  submitted_at: string;
  converted_to_test: boolean;
}

interface TestCase {
  id: string;
  source_feedback_id: string;
  contract_id: string;
  agent: string;
  test_description: string;
  expected_behavior: string;
  created_at: string;
}

async function loadFeedback(): Promise<FeedbackEntry[]> {
  try {
    const raw = await readFile(resolve(DATA_DIR, "feedback.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveFeedback(entries: FeedbackEntry[]): Promise<void> {
  await writeFile(resolve(DATA_DIR, "feedback.json"), JSON.stringify(entries, null, 2));
}

export async function submitFeedback(
  contractId: string,
  agent: string,
  sentiment: "positive" | "negative",
  comment: string,
  reviewer: string,
): Promise<FeedbackEntry> {
  const entry: FeedbackEntry = {
    id: `fb-${randomUUID().slice(0, 8)}`,
    contract_id: contractId,
    agent,
    sentiment,
    comment,
    reviewer,
    submitted_at: new Date().toISOString(),
    converted_to_test: false,
  };

  const entries = await loadFeedback();
  entries.push(entry);
  await saveFeedback(entries);
  return entry;
}

export async function convertToTestCases(): Promise<{
  test_cases_created: number;
  test_cases: TestCase[];
  feedbacks_converted: number;
}> {
  const entries = await loadFeedback();
  const negative = entries.filter((e) => e.sentiment === "negative" && !e.converted_to_test);

  const testCases: TestCase[] = negative.map((fb) => ({
    id: `tc-${randomUUID().slice(0, 8)}`,
    source_feedback_id: fb.id,
    contract_id: fb.contract_id,
    agent: fb.agent,
    test_description: `Verify ${fb.agent} handles: ${fb.comment.slice(0, 80)}`,
    expected_behavior: `Agent should correctly address the issue: ${fb.comment.slice(0, 100)}`,
    created_at: new Date().toISOString(),
  }));

  // Mark feedbacks as converted
  for (const fb of negative) {
    fb.converted_to_test = true;
  }
  await saveFeedback(entries);

  return {
    test_cases_created: testCases.length,
    test_cases: testCases,
    feedbacks_converted: negative.length,
  };
}

export async function getFeedbackSummary(): Promise<{
  total: number;
  positive: number;
  negative: number;
  converted_to_tests: number;
  by_agent: Record<string, { positive: number; negative: number; satisfaction: number }>;
  recent: FeedbackEntry[];
}> {
  const entries = await loadFeedback();
  const positive = entries.filter((e) => e.sentiment === "positive").length;
  const negative = entries.filter((e) => e.sentiment === "negative").length;
  const converted = entries.filter((e) => e.converted_to_test).length;

  const byAgent: Record<string, { positive: number; negative: number; satisfaction: number }> = {};
  for (const e of entries) {
    if (!byAgent[e.agent]) {
      byAgent[e.agent] = { positive: 0, negative: 0, satisfaction: 0 };
    }
    byAgent[e.agent][e.sentiment]++;
  }
  for (const key of Object.keys(byAgent)) {
    const a = byAgent[key];
    const total = a.positive + a.negative;
    a.satisfaction = total > 0 ? Math.round((a.positive / total) * 100) : 0;
  }

  const recent = entries.slice(-10).reverse();

  return {
    total: entries.length,
    positive,
    negative,
    converted_to_tests: converted,
    by_agent: byAgent,
    recent,
  };
}
