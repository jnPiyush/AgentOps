import React, { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/shared/StatusBadge";
import { MetricCard } from "../components/shared/MetricCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AgentFeedback {
  positive: number;
  negative: number;
  satisfaction: number;
}

interface FeedbackSummary {
  total: number;
  positive: number;
  negative: number;
  converted_to_tests: number;
  by_agent: Record<string, AgentFeedback>;
  recent: Array<{
    id: string;
    contract_id: string;
    agent: string;
    sentiment: "positive" | "negative";
    comment: string;
    reviewer: string;
    submitted_at: string;
    converted_to_test: boolean;
  }>;
}

interface OptimizeResult {
  test_cases_created: number;
  feedbacks_converted: number;
}

export function FeedbackLoop() {
  const { get, post, loading } = useApi();
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("extraction");
  const [prompt, setPrompt] = useState("");
  const [promptSaved, setPromptSaved] = useState(false);

  // Feedback form
  const [form, setForm] = useState({
    contract_id: "",
    agent: "extraction",
    sentiment: "negative",
    comment: "",
    reviewer: "",
  });

  useEffect(() => {
    loadSummary();
    loadPrompt("extraction");
  }, []);

  async function loadSummary() {
    const data = await get("/api/v1/feedback/summary") as FeedbackSummary | null;
    if (data) setSummary(data);
  }

  async function loadPrompt(agent: string) {
    const data = await get(`/api/v1/prompts/${agent}`) as { prompt: string } | null;
    if (data) setPrompt(data.prompt);
    setPromptSaved(false);
  }

  async function submitFeedback() {
    if (!form.contract_id || !form.comment) return;
    await post("/api/v1/feedback", form);
    setForm({ contract_id: "", agent: "extraction", sentiment: "negative", comment: "", reviewer: "" });
    await loadSummary();
  }

  async function runOptimize() {
    const data = await post("/api/v1/feedback/optimize", {}) as OptimizeResult | null;
    if (data) setOptimizeResult(data);
    await loadSummary();
  }

  async function savePrompt() {
    await post(`/api/v1/prompts/${selectedAgent}`, { prompt });
    setPromptSaved(true);
  }

  const agentData = summary
    ? Object.entries(summary.by_agent).map(([name, data]) => ({
        name,
        satisfaction: data.satisfaction,
        positive: data.positive,
        negative: data.negative,
      }))
    : [];

  const agents = ["intake", "extraction", "compliance", "approval"];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Feedback & Improvement Loop</h2>
        <p className="text-sm text-gray-500">
          Collect feedback, convert to test cases, refine agent prompts
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Feedback" value={summary?.total ?? 0} />
        <MetricCard label="Positive" value={summary?.positive ?? 0} />
        <MetricCard label="Negative" value={summary?.negative ?? 0} />
        <MetricCard label="Converted to Tests" value={summary?.converted_to_tests ?? 0} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Submit Feedback */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Submit Feedback</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Contract ID (e.g., NDA-001)"
              value={form.contract_id}
              onChange={(e) => setForm({ ...form, contract_id: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <div className="flex gap-2">
              <select
                value={form.agent}
                onChange={(e) => setForm({ ...form, agent: e.target.value })}
                className="flex-1 px-3 py-2 border rounded text-sm"
              >
                {agents.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <select
                value={form.sentiment}
                onChange={(e) => setForm({ ...form, sentiment: e.target.value })}
                className="flex-1 px-3 py-2 border rounded text-sm"
              >
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Reviewer name"
              value={form.reviewer}
              onChange={(e) => setForm({ ...form, reviewer: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <textarea
              placeholder="Describe what went right or wrong..."
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm h-20 resize-none"
            />
            <button
              onClick={submitFeedback}
              disabled={loading || !form.contract_id || !form.comment}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              Submit Feedback
            </button>
          </div>
        </div>

        {/* Agent Satisfaction Chart */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Agent Satisfaction (%)</h3>
          {agentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="satisfaction" fill="#00B294" name="Satisfaction %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
              No feedback data yet. Submit feedback to see trends.
            </div>
          )}
        </div>
      </div>

      {/* Improvement Cycle */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500">Improvement Cycle</h3>
          <button
            onClick={runOptimize}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {loading ? "Optimizing..." : "Optimize Now ->"}
          </button>
        </div>
        {optimizeResult && (
          <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm">
            Converted {optimizeResult.feedbacks_converted} negative feedback(s) into{" "}
            {optimizeResult.test_cases_created} test case(s).
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded">1. Collect Feedback</span>
          <span>-&gt;</span>
          <span className="px-2 py-1 bg-gray-100 rounded">2. Optimize (Convert to Tests)</span>
          <span>-&gt;</span>
          <span className="px-2 py-1 bg-gray-100 rounded">3. Refine Prompts</span>
          <span>-&gt;</span>
          <span className="px-2 py-1 bg-gray-100 rounded">4. Re-Evaluate</span>
        </div>
      </div>

      {/* Prompt Editor */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">Agent Prompt Editor</h3>
        <div className="flex gap-2 mb-3">
          {agents.map((a) => (
            <button
              key={a}
              onClick={() => {
                setSelectedAgent(a);
                loadPrompt(a);
              }}
              className={`px-3 py-1 rounded text-sm ${
                selectedAgent === a
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setPromptSaved(false);
          }}
          className="w-full h-40 px-3 py-2 border rounded text-sm font-mono resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={savePrompt}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
          >
            Save Prompt
          </button>
          {promptSaved && (
            <span className="text-green-600 text-sm">Saved</span>
          )}
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">Recent Feedback</h3>
        {(summary?.recent ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">No feedback submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {summary?.recent.map((fb) => (
              <div key={fb.id} className="flex items-start gap-3 p-2 border rounded text-sm">
                <StatusBadge status={fb.sentiment === "positive" ? "pass" : "fail"} />
                <div className="flex-1">
                  <div className="font-medium">
                    {fb.agent} - {fb.contract_id}
                  </div>
                  <div className="text-gray-500">{fb.comment}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {fb.reviewer} - {new Date(fb.submitted_at).toLocaleString()}
                    {fb.converted_to_test && (
                      <span className="ml-2 text-green-600">[converted to test]</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
