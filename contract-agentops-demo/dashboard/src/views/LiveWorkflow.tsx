import React, { useState } from "react";
import { useWebSocket, type WsMessage } from "../hooks/useWebSocket.js";
import { useApi } from "../hooks/useApi.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { ProgressBar } from "../components/shared/ProgressBar.js";
import { JsonViewer } from "../components/shared/JsonViewer.js";

const SAMPLE_CONTRACTS = [
  { name: "NDA-Acme-Beta-2026.txt", label: "NDA - Acme Corp" },
  { name: "MSA-GlobalTech-2026.txt", label: "MSA - GlobalTech (High Risk)" },
  { name: "SOW-CloudMigration-2026.txt", label: "SOW - Cloud Migration" },
  { name: "Amendment-DataPolicy-2026.txt", label: "Amendment - Data Policy" },
  { name: "SLA-InfraUptime-2026.txt", label: "SLA - Infrastructure Uptime" },
];

const STAGES = ["intake", "extraction", "compliance", "approval"];

export function LiveWorkflow() {
  const { messages, connected, clearMessages } = useWebSocket("ws://localhost:8000/ws/workflow");
  const { loading, post } = useApi<{ contract_id: string }>();
  const [selectedContract, setSelectedContract] = useState(SAMPLE_CONTRACTS[0].name);

  const completedStages = messages
    .filter((m) => m.event === "agent_step_complete")
    .map((m) => m.agent ?? "");

  const progressPercent = (completedStages.length / STAGES.length) * 100;

  async function handleSubmit() {
    clearMessages();
    // Fetch the sample contract text
    try {
      const res = await fetch(`/api/v1/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Sample contract: ${selectedContract}`,
          filename: selectedContract,
          source: "dashboard",
        }),
      });
      // Pipeline runs asynchronously; updates come via WebSocket
    } catch {
      // Error handled through WS error events
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-2">Live Workflow</h2>
      <p className="text-sm text-gray-500 mb-1">
        Submit a contract and watch the 4-agent pipeline process it in real-time
      </p>
      <p className="text-xs mb-6">
        WebSocket: <StatusBadge status={connected ? "online" : "offline"} />
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Submit */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sample Contract</label>
            <select
              value={selectedContract}
              onChange={(e) => setSelectedContract(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {SAMPLE_CONTRACTS.map((c) => (
                <option key={c.name} value={c.name}>{c.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Contract"}
          </button>
        </div>

        {/* Center: Pipeline Progress */}
        <div className="space-y-4">
          <ProgressBar value={progressPercent} label="Pipeline Progress" />
          <div className="space-y-2">
            {STAGES.map((stage) => {
              const msg = messages.find((m) => m.agent === stage && m.event === "agent_step_complete");
              return (
                <div key={stage} className="flex items-center justify-between bg-white rounded border p-3">
                  <span className="text-sm font-medium capitalize">{stage}</span>
                  <div className="flex items-center gap-2">
                    {msg?.latency_ms && (
                      <span className="text-xs text-gray-400">{msg.latency_ms}ms</span>
                    )}
                    <StatusBadge status={msg ? "pass" : completedStages.length > 0 ? "idle" : "idle"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Events Log */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Event Log</h3>
          {messages.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-auto">
              {messages.map((msg, i) => (
                <div key={i} className="bg-white rounded border p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{msg.event}</span>
                    <span className="text-gray-400">{msg.agent ?? msg.status}</span>
                  </div>
                  {msg.result != null && <JsonViewer data={msg.result} maxHeight="100px" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-400 text-sm">
              Submit a contract to see real-time updates
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
