import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/shared/StatusBadge";

interface StageResult {
  name: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  duration_ms: number;
  details?: Record<string, unknown>;
  error?: string;
}

interface FoundryAgentInfo {
  agent_name: string;
  foundry_agent_id: string;
  model: string;
  status: "registered" | "failed";
  tools_count: number;
}

interface SecurityCheck {
  check: string;
  status: string;
  detail?: string;
}

interface DeployResult {
  pipeline_id: string;
  mode: "live" | "simulated";
  stages: StageResult[];
  agents: FoundryAgentInfo[];
  security: {
    identity_access: SecurityCheck[];
    content_safety: SecurityCheck[];
  };
  evaluation?: {
    test_count: number;
    passed: number;
    accuracy: number;
  };
  summary: {
    agents_deployed: number;
    tools_registered: number;
    errors: number;
    total_duration_ms: number;
  };
}

interface ModeInfo {
  mode: "live" | "simulated";
  foundry_configured: boolean;
}

export function DeployDashboard() {
  const { post, loading } = useApi<DeployResult>();
  const modeApi = useApi<ModeInfo>();
  const cleanupApi = useApi<{ deleted: number; errors: string[]; message: string }>();
  const [result, setResult] = useState<DeployResult | null>(null);
  const [animStage, setAnimStage] = useState(-1);
  const [modeInfo, setModeInfo] = useState<ModeInfo | null>(null);

  useEffect(() => {
    modeApi.get("/deploy/mode").then((data) => {
      if (data) setModeInfo(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageNames = [
    "Preflight",
    "Model Deployment",
    "Agent Registration",
    "Content Safety",
    "Evaluation",
    "Health Check",
  ];

  async function runDeploy() {
    setAnimStage(0);
    setResult(null);

    const data = await post("/deploy/pipeline", {});
    if (!data) return;

    // Animate stages sequentially
    for (let i = 0; i < data.stages.length; i++) {
      setAnimStage(i);
      await new Promise((r) => setTimeout(r, 600));
    }
    setAnimStage(data.stages.length);
    setResult(data);
  }

  async function handleCleanup() {
    const data = await cleanupApi.post("/deploy/agents", {});
    if (data) {
      setResult(null);
      setAnimStage(-1);
    }
  }

  function stageStatusColor(status: string): string {
    switch (status) {
      case "passed": return "border-green-500 bg-green-50";
      case "failed": return "border-red-500 bg-red-50";
      case "skipped": return "border-yellow-500 bg-yellow-50";
      default: return "border-gray-200 bg-gray-50";
    }
  }

  function stageLabel(status: string): string {
    switch (status) {
      case "passed": return "[PASS]";
      case "failed": return "[FAIL]";
      case "skipped": return "[SKIP]";
      default: return "Pending";
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Deploy to Azure AI Foundry</h2>
          <p className="text-sm text-gray-500">
            {modeInfo?.mode === "live"
              ? "Live deployment to Azure AI Foundry"
              : "Simulated deployment pipeline (set DEMO_MODE=live for real deployment)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode badge */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              modeInfo?.mode === "live"
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {modeInfo?.mode === "live" ? "LIVE" : "SIMULATED"}
          </span>
          {result && result.agents.some((a) => a.status === "registered") && (
            <button
              onClick={handleCleanup}
              disabled={cleanupApi.loading}
              className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {cleanupApi.loading ? "Cleaning..." : "Cleanup Agents"}
            </button>
          )}
          <button
            onClick={runDeploy}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Deploying..." : "Deploy Pipeline ->"}
          </button>
        </div>
      </div>

      {/* Pipeline stages - 6-stage real pipeline */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-4">Deployment Pipeline</h3>
        <div className="grid grid-cols-6 gap-2">
          {stageNames.map((name, i) => {
            const stage = result?.stages[i];
            const isActive = animStage === i;
            const isDone = animStage > i;

            return (
              <div
                key={name}
                className={`rounded-lg p-3 text-center border-2 transition-all duration-500 ${
                  isDone && stage
                    ? stageStatusColor(stage.status)
                    : isActive
                    ? "border-blue-500 bg-blue-50 animate-pulse"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="font-semibold text-xs">{name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {isDone && stage
                    ? stageLabel(stage.status)
                    : isActive
                    ? "Running..."
                    : "Pending"}
                </div>
                {isDone && stage && (
                  <div className="text-xs text-gray-400 mt-1">
                    {stage.duration_ms < 1000
                      ? `${stage.duration_ms}ms`
                      : `${(stage.duration_ms / 1000).toFixed(1)}s`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Show stage errors */}
        {result?.stages.some((s) => s.error) && (
          <div className="mt-3 space-y-1">
            {result.stages
              .filter((s) => s.error)
              .map((s) => (
                <div key={s.name} className="text-xs text-red-600 bg-red-50 rounded px-3 py-1">
                  {s.name}: {s.error}
                </div>
              ))}
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Agent Registration */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">
              Foundry Agent Registration
              {result.mode === "live" && (
                <span className="ml-2 text-xs text-green-600 font-normal">(Azure AI Foundry)</span>
              )}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">Foundry ID</th>
                  <th className="pb-2">Model</th>
                  <th className="pb-2">Tools</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.agents.map((agent) => (
                  <tr key={agent.agent_name} className="border-b">
                    <td className="py-2 font-medium">{agent.agent_name}</td>
                    <td className="py-2 font-mono text-xs">
                      {agent.foundry_agent_id || "-"}
                    </td>
                    <td className="py-2 text-xs">{agent.model}</td>
                    <td className="py-2 text-xs">{agent.tools_count}</td>
                    <td className="py-2">
                      <StatusBadge
                        status={agent.status === "registered" ? "pass" : "fail"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Security + Evaluation */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-3">Identity & Access</h4>
              {result.security.identity_access.map((c) => (
                <div key={c.check} className="flex items-center gap-2 mb-2 text-sm">
                  <StatusBadge status={c.status === "passed" ? "pass" : "fail"} />
                  <span>{c.check}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-3">Content Safety</h4>
              {result.security.content_safety.map((c) => (
                <div key={c.check} className="flex items-center gap-2 mb-2 text-sm">
                  <StatusBadge
                    status={
                      c.status === "passed"
                        ? "pass"
                        : c.status === "unknown"
                        ? "warn"
                        : "fail"
                    }
                  />
                  <span>{c.check}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-3">Evaluation</h4>
              {result.evaluation ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-500">Test Cases:</span>{" "}
                    <span className="font-semibold">{result.evaluation.test_count}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Passed:</span>{" "}
                    <span className="font-semibold text-green-600">
                      {result.evaluation.passed}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Accuracy:</span>{" "}
                    <span className="font-semibold">{result.evaluation.accuracy}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400">Evaluation skipped</div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div
            className={`rounded-lg border p-4 text-sm ${
              result.summary.errors === 0
                ? "bg-green-50 text-green-800 border-green-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
          >
            <span className="font-semibold">
              {result.mode === "live" ? "Live" : "Simulated"} Deployment:
            </span>{" "}
            {result.summary.agents_deployed} agents deployed |{" "}
            {result.summary.tools_registered} tools registered |{" "}
            {result.summary.errors} errors |{" "}
            {result.summary.total_duration_ms < 1000
              ? `${result.summary.total_duration_ms}ms`
              : `${(result.summary.total_duration_ms / 1000).toFixed(1)}s`}{" "}
            total | Pipeline: {result.pipeline_id}
          </div>
        </>
      )}
    </div>
  );
}
