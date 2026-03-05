import React from "react";

interface Props {
  name: string;
  role: string;
  status?: "idle" | "running" | "complete" | "error";
  tools: string[];
  latency?: number;
}

export function AgentCard({ name, role, status = "idle", tools, latency }: Props) {
  const statusColors: Record<string, string> = {
    idle: "bg-gray-200 text-gray-700",
    running: "bg-blue-100 text-blue-700 animate-pulse",
    complete: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">{name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[status]}`}>
          {status}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{role}</p>
      <div className="flex flex-wrap gap-1">
        {tools.map((tool) => (
          <span key={tool} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
            {tool}
          </span>
        ))}
      </div>
      {latency !== undefined && (
        <p className="text-xs text-gray-400 mt-2">{latency}ms</p>
      )}
    </div>
  );
}
