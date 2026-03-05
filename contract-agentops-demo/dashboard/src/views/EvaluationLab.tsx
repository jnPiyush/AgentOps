import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { MetricCard } from "../components/shared/MetricCard";
import { StatusBadge } from "../components/shared/StatusBadge";

interface JudgeScores {
  relevance: number;
  groundedness: number;
  coherence: number;
}

interface EvalResult {
  id: string;
  version: string;
  run_at: string;
  total_cases: number;
  passed: number;
  accuracy: number;
  per_metric: Record<string, number>;
  quality_gate: "PASS" | "FAIL";
  judge_scores?: JudgeScores;
}

interface BaselineComparison {
  baseline: EvalResult;
  current: EvalResult | null;
  delta: { accuracy: number; relevance: number; groundedness: number; coherence: number } | null;
}

export function EvaluationLab() {
  const { get, post, loading } = useApi<EvalResult[] | EvalResult>();
  const [results, setResults] = useState<EvalResult[]>([]);
  const [latest, setLatest] = useState<EvalResult | null>(null);
  const [baseline, setBaseline] = useState<BaselineComparison | null>(null);
  const [version, setVersion] = useState("v1.3");

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    const data = await get("/api/v1/evaluations/results") as EvalResult[] | null;
    if (data && Array.isArray(data)) {
      setResults(data);
      if (data.length > 0) setLatest(data[data.length - 1]);
    }
    const bl = await get("/api/v1/evaluations/baseline") as unknown as BaselineComparison | null;
    if (bl) setBaseline(bl);
  }

  async function runSuite() {
    const data = await post("/api/v1/evaluations/run", { version }) as EvalResult | null;
    if (data && "id" in data) {
      setLatest(data);
      setResults((prev) => [...prev, data]);
      await loadResults();
    }
  }

  const metrics = latest?.per_metric ?? {};
  const judge = latest?.judge_scores;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Evaluation Lab</h2>
          <p className="text-sm text-gray-500">
            Ground-truth metrics + LLM-as-judge scoring + quality gates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="px-3 py-2 border rounded text-sm w-20"
            placeholder="v1.3"
          />
          <button
            onClick={runSuite}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Running..." : "Run Suite ->"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Test Suite Config */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Test Suite Config</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Test Set</span>
              <span>{latest?.total_cases ?? 20} contracts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Coverage</span>
              <span>95%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last Run</span>
              <span>{latest ? new Date(latest.run_at).toLocaleTimeString() : "Never"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Baseline</span>
              <span>{baseline?.baseline?.version ?? "v1.2"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Current</span>
              <span>{latest?.version ?? "N/A"}</span>
            </div>
          </div>

          {latest && (
            <div
              className={`mt-4 p-3 rounded-lg text-center font-bold text-sm ${
                latest.quality_gate === "PASS"
                  ? "bg-green-50 text-green-700 border border-green-300"
                  : "bg-red-50 text-red-700 border border-red-300"
              }`}
            >
              Quality Gate: [{latest.quality_gate}]
              <div className="text-xs font-normal mt-1">
                {latest.quality_gate === "PASS" ? "Ready to deploy" : "Blocking deployment"}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="col-span-2 space-y-4">
          {latest && (
            <>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-500">Overall</h3>
                  <span className="text-lg font-bold">
                    {latest.passed}/{latest.total_cases} passed ({latest.accuracy}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      latest.accuracy >= 85 ? "bg-green-500" : latest.accuracy >= 70 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${latest.accuracy}%` }}
                  />
                </div>
              </div>

              {/* Ground Truth Metrics */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-gray-500 mb-3">Ground-Truth Metrics</h3>
                <div className="grid grid-cols-5 gap-3">
                  <MetricCard
                    label="Extraction"
                    value={`${metrics.extraction_accuracy ?? 0}%`}
                    subtitle={Number(metrics.extraction_accuracy) >= 85 ? "PASS" : "FAIL"}
                    trend={Number(metrics.extraction_accuracy) >= 85 ? "up" : "down"}
                  />
                  <MetricCard
                    label="Compliance"
                    value={`${metrics.compliance_accuracy ?? 0}%`}
                    subtitle={Number(metrics.compliance_accuracy) >= 80 ? "PASS" : "WARN"}
                    trend={Number(metrics.compliance_accuracy) >= 80 ? "up" : "down"}
                  />
                  <MetricCard
                    label="Classification"
                    value={`${metrics.classification_accuracy ?? 0}%`}
                    subtitle={Number(metrics.classification_accuracy) >= 90 ? "PASS" : "FAIL"}
                    trend={Number(metrics.classification_accuracy) >= 90 ? "up" : "down"}
                  />
                  <MetricCard
                    label="False Flags"
                    value={`${metrics.false_flag_rate ?? 0}%`}
                    subtitle={Number(metrics.false_flag_rate) <= 15 ? "PASS" : "WARN"}
                    trend={Number(metrics.false_flag_rate) <= 15 ? "up" : "down"}
                  />
                  <MetricCard
                    label="Latency P95"
                    value={`${metrics.latency_p95_s ?? 0}s`}
                    subtitle={Number(metrics.latency_p95_s) <= 5 ? "PASS" : "WARN"}
                    trend={Number(metrics.latency_p95_s) <= 5 ? "up" : "down"}
                  />
                </div>
              </div>

              {/* LLM-as-Judge Scores */}
              {judge && (
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="text-sm font-semibold text-gray-500 mb-3">
                    LLM-as-Judge Scores (GPT-4o)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {(["relevance", "groundedness", "coherence"] as const).map((dim) => (
                      <div key={dim} className="text-center">
                        <div className="text-2xl font-bold">
                          {judge[dim]}/5
                        </div>
                        <div className="text-xs text-gray-500 capitalize mt-1">{dim}</div>
                        <div className="mt-2">
                          <StatusBadge status={judge[dim] >= 4.0 ? "pass" : judge[dim] >= 3.0 ? "warn" : "fail"} />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Threshold: &gt;=4.0</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Baseline Comparison */}
          {baseline?.delta && latest && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">
                Baseline Comparison ({baseline.baseline.version} vs {latest.version})
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Metric</th>
                    <th className="pb-2">{baseline.baseline.version}</th>
                    <th className="pb-2">{latest.version}</th>
                    <th className="pb-2">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-1.5">Accuracy</td>
                    <td>{baseline.baseline.accuracy}%</td>
                    <td>{latest.accuracy}%</td>
                    <td className={baseline.delta.accuracy >= 0 ? "text-green-600" : "text-red-600"}>
                      {baseline.delta.accuracy >= 0 ? "+" : ""}{baseline.delta.accuracy}%
                    </td>
                  </tr>
                  {baseline.baseline.judge_scores && (
                    <>
                      <tr className="border-b">
                        <td className="py-1.5">Relevance</td>
                        <td>{baseline.baseline.judge_scores.relevance}/5</td>
                        <td>{judge?.relevance ?? 0}/5</td>
                        <td className={baseline.delta.relevance >= 0 ? "text-green-600" : "text-red-600"}>
                          {baseline.delta.relevance >= 0 ? "+" : ""}{baseline.delta.relevance}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1.5">Groundedness</td>
                        <td>{baseline.baseline.judge_scores.groundedness}/5</td>
                        <td>{judge?.groundedness ?? 0}/5</td>
                        <td className={baseline.delta.groundedness >= 0 ? "text-green-600" : "text-red-600"}>
                          {baseline.delta.groundedness >= 0 ? "+" : ""}{baseline.delta.groundedness}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5">Coherence</td>
                        <td>{baseline.baseline.judge_scores.coherence}/5</td>
                        <td>{judge?.coherence ?? 0}/5</td>
                        <td className={baseline.delta.coherence >= 0 ? "text-green-600" : "text-red-600"}>
                          {baseline.delta.coherence >= 0 ? "+" : ""}{baseline.delta.coherence}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
