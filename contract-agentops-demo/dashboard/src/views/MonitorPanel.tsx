import React, { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { MetricCard } from "../components/shared/MetricCard.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { JsonViewer } from "../components/shared/JsonViewer.js";

interface ContractSummary {
  id: string;
  filename: string;
  type?: string;
  status: string;
  submitted_at: string;
}

interface AuditEntry {
  id: string;
  agent: string;
  action: string;
  reasoning: string;
  timestamp: string;
}

export function MonitorPanel() {
  const contractsApi = useApi<ContractSummary[]>();
  const auditApi = useApi<AuditEntry[]>();
  const [selectedContract, setSelectedContract] = useState<string | null>(null);

  useEffect(() => {
    contractsApi.get("/contracts");
  }, []);

  useEffect(() => {
    if (selectedContract) {
      auditApi.get(`/audit/${selectedContract}`);
    }
  }, [selectedContract]);

  const contracts = contractsApi.data ?? [];
  const auditEntries = auditApi.data ?? [];

  const approved = contracts.filter((c) => c.status === "approved").length;
  const awaiting = contracts.filter((c) => c.status === "awaiting_review").length;
  const processing = contracts.filter((c) => c.status === "processing").length;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-2">Monitor Panel</h2>
      <p className="text-sm text-gray-500 mb-6">Track contracts, audit trails, and agent activity</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Contracts" value={contracts.length} />
        <MetricCard label="Approved" value={approved} subtitle={`${contracts.length > 0 ? Math.round((approved / contracts.length) * 100) : 0}%`} trend="up" />
        <MetricCard label="Awaiting Review" value={awaiting} trend={awaiting > 0 ? "down" : "neutral"} />
        <MetricCard label="Processing" value={processing} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contract List */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Contracts</h3>
          <div className="space-y-2 max-h-96 overflow-auto">
            {contracts.length === 0 ? (
              <p className="text-sm text-gray-400">No contracts processed yet</p>
            ) : (
              contracts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContract(c.id)}
                  className={`w-full text-left bg-white rounded border p-3 hover:border-blue-300 transition-colors ${
                    selectedContract === c.id ? "border-blue-500 ring-1 ring-blue-200" : ""
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{c.filename}</p>
                      <p className="text-xs text-gray-400">{c.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.type && <span className="text-xs text-gray-500">{c.type}</span>}
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Audit Trail */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Audit Trail {selectedContract && `- ${selectedContract}`}
          </h3>
          {selectedContract ? (
            auditEntries.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-auto">
                {auditEntries.map((entry) => (
                  <div key={entry.id} className="bg-white rounded border p-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium capitalize">{entry.agent}</span>
                      <StatusBadge status={entry.action === "approved" ? "approved" : entry.action === "escalated" ? "awaiting_review" : "processing"} />
                    </div>
                    <p className="text-gray-600">{entry.reasoning}</p>
                    <p className="text-gray-400 mt-1">{new Date(entry.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No audit entries for this contract</p>
            )
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-400 text-sm">
              Select a contract to view its audit trail
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
