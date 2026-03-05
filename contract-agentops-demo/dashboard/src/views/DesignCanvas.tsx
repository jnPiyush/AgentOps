import React from "react";
import { AgentCard } from "../components/shared/AgentCard.js";

const AGENTS = [
  {
    name: "Intake Agent",
    role: "Classify contracts by type and extract initial metadata",
    tools: ["upload_contract", "classify_document", "extract_metadata"],
  },
  {
    name: "Extraction Agent",
    role: "Extract key clauses, parties, dates, and monetary values",
    tools: ["extract_clauses", "identify_parties", "extract_dates_values"],
  },
  {
    name: "Compliance Agent",
    role: "Check extracted terms against company policies and flag risks",
    tools: ["check_policy", "flag_risk", "get_policy_rules"],
  },
  {
    name: "Approval Agent",
    role: "Route contracts for approval or escalate to human review",
    tools: ["route_approval", "escalate_to_human", "notify_stakeholder"],
  },
];

export function DesignCanvas() {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-2">Agent Design Canvas</h2>
      <p className="text-sm text-gray-500 mb-6">
        4-agent pipeline: Intake -&gt; Extraction -&gt; Compliance -&gt; Approval
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {AGENTS.map((agent, i) => (
          <div key={agent.name} className="relative">
            <AgentCard name={agent.name} role={agent.role} tools={agent.tools} />
            {i < AGENTS.length - 1 && (
              <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2 text-gray-400 text-lg">
                -&gt;
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-sm mb-3">Pipeline Flow</h3>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded">Upload Contract</span>
          <span className="text-gray-400">-&gt;</span>
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded">Classify Type</span>
          <span className="text-gray-400">-&gt;</span>
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded">Extract Clauses</span>
          <span className="text-gray-400">-&gt;</span>
          <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded">Check Compliance</span>
          <span className="text-gray-400">-&gt;</span>
          <span className="px-3 py-1 bg-green-50 text-green-700 rounded">Auto-Approve / Escalate</span>
        </div>
      </div>
    </div>
  );
}
