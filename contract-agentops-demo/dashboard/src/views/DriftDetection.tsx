import React, { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/shared/StatusBadge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  BarChart, Bar, Cell, ResponsiveContainer, Legend,
} from "recharts";

interface DriftTimeline {
  week: string;
  accuracy: number;
}

interface DriftAlert {
  type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  detected_at: string;
}

interface LlmDrift {
  id: string;
  timeline: DriftTimeline[];
  alerts: DriftAlert[];
}

interface DataDrift {
  id: string;
  timeline: DriftTimeline[];
  distribution: Record<string, number>;
  alerts: DriftAlert[];
}

interface ModelSwap {
  gpt4o: { accuracy: number; latency_ms: number; cost_per_contract: number };
  gpt4o_mini: { accuracy: number; latency_ms: number; cost_per_contract: number };
  comparison: { accuracy_delta: number; latency_delta: number; cost_delta: number };
}

const DISTRIBUTION_COLORS = ["#0078D4", "#00B294", "#FFB900", "#8861C4", "#E74C3C", "#FF8C00"];

export function DriftDetection() {
  const { get, post, loading } = useApi();
  const [llmDrift, setLlmDrift] = useState<LlmDrift | null>(null);
  const [dataDrift, setDataDrift] = useState<DataDrift | null>(null);
  const [modelSwap, setModelSwap] = useState<ModelSwap | null>(null);

  useEffect(() => {
    loadDrift();
  }, []);

  async function loadDrift() {
    const llm = await get("/api/v1/drift/llm") as LlmDrift | null;
    const data = await get("/api/v1/drift/data") as DataDrift | null;
    if (llm) setLlmDrift(llm);
    if (data) setDataDrift(data);
  }

  async function runModelSwap() {
    const data = await post("/api/v1/drift/model-swap", {}) as ModelSwap | null;
    if (data) setModelSwap(data);
  }

  const chartTimeline = llmDrift?.timeline.map((d) => ({
    ...d,
    accuracy: Math.round(d.accuracy * 100),
  })) ?? [];

  const distData = dataDrift
    ? Object.entries(dataDrift.distribution).map(([name, pct]) => ({
        name,
        percentage: Math.round(pct * 100),
      }))
    : [];

  const knownTypes = ["NDA", "MSA", "SOW", "Amendment", "SLA"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Drift Detection Center</h2>
          <p className="text-sm text-gray-500">
            Monitor LLM drift, data drift, and model swap impact
          </p>
        </div>
        <span className="text-sm text-gray-400">Time Range: Last 30 days</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* LLM Drift */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            LLM Drift - Extraction Accuracy Over Time
          </h3>
          {chartTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[75, 95]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <ReferenceLine
                  y={85}
                  stroke="#E74C3C"
                  strokeDasharray="5 5"
                  label={{ value: "Threshold 85%", fill: "#E74C3C", fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#0078D4"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Accuracy %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Loading drift data...
            </div>
          )}
          {llmDrift?.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 mt-2 text-xs">
              <StatusBadge
                status={a.severity === "critical" ? "fail" : a.severity === "warning" ? "warn" : "info"}
              />
              <span>{a.message}</span>
            </div>
          ))}
        </div>

        {/* Data Drift */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            Data Drift - Contract Type Distribution
          </h3>
          {distData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 50]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="percentage" name="% of contracts">
                  {distData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={
                        knownTypes.includes(entry.name)
                          ? DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]
                          : "#FF8C00"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Loading distribution...
            </div>
          )}
          {dataDrift?.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 mt-2 text-xs">
              <StatusBadge
                status={a.severity === "critical" ? "fail" : a.severity === "warning" ? "warn" : "info"}
              />
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Model Swap */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500">Model Swap Analysis</h3>
          <button
            onClick={runModelSwap}
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm"
          >
            {loading ? "Simulating..." : "Simulate Swap ->"}
          </button>
        </div>
        {modelSwap && (
          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2">Current: GPT-4o</h4>
              <div className="space-y-1 text-sm">
                <div>Accuracy: {(modelSwap.gpt4o.accuracy * 100).toFixed(1)}%</div>
                <div>Latency: {modelSwap.gpt4o.latency_ms}ms</div>
                <div>Cost/1K: ${(modelSwap.gpt4o.cost_per_contract * 1000).toFixed(2)}</div>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2">Candidate: GPT-4o-mini</h4>
              <div className="space-y-1 text-sm">
                <div>Accuracy: {(modelSwap.gpt4o_mini.accuracy * 100).toFixed(1)}%</div>
                <div>Latency: {modelSwap.gpt4o_mini.latency_ms}ms</div>
                <div>Cost/1K: ${(modelSwap.gpt4o_mini.cost_per_contract * 1000).toFixed(2)}</div>
              </div>
            </div>
            <div
              className={`border-2 rounded-lg p-4 ${
                Math.abs(modelSwap.comparison.accuracy_delta) <= 0.05
                  ? "border-green-500 bg-green-50"
                  : "border-red-500 bg-red-50"
              }`}
            >
              <h4 className="text-sm font-semibold mb-2">VERDICT</h4>
              <div
                className={`text-lg font-bold ${
                  Math.abs(modelSwap.comparison.accuracy_delta) <= 0.05
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {Math.abs(modelSwap.comparison.accuracy_delta) <= 0.05 ? "ACCEPTABLE" : "DEGRADED"}
              </div>
              <div className="space-y-1 text-xs mt-2">
                <div>Accuracy: {(modelSwap.comparison.accuracy_delta * 100).toFixed(1)}%</div>
                <div>Cost: {(modelSwap.comparison.cost_delta * 100).toFixed(0)}%</div>
                <div>Latency: {(modelSwap.comparison.latency_delta * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recommended Actions */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">Recommended Actions</h3>
        <div className="space-y-2 text-sm">
          {llmDrift?.alerts.some((a) => a.severity === "critical" || a.severity === "warning") && (
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold">[!]</span>
              <span>Update compliance rules for AI liability clause (data drift)</span>
            </div>
          )}
          {dataDrift?.alerts.some((a) => a.severity === "warning") && (
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold">[!]</span>
              <span>Retrain extraction prompts on new contract types</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">[i]</span>
            <span>Consider GPT-4o-mini swap for non-critical extractions</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">[i]</span>
            <span>Schedule weekly drift monitoring alerts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
