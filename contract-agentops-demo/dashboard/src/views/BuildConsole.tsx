import React, { useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { JsonViewer } from "../components/shared/JsonViewer.js";

const MCP_SERVERS = [
  {
    name: "contract-intake-mcp",
    tools: [
      { name: "upload_contract", hint: '{"text": "This Non-Disclosure Agreement..."}' },
      { name: "classify_document", hint: '{"text": "This Non-Disclosure Agreement..."}' },
      { name: "extract_metadata", hint: '{"text": "Agreement between Acme Corp and Beta Inc..."}' },
    ],
  },
  {
    name: "contract-extraction-mcp",
    tools: [
      { name: "extract_clauses", hint: '{"text": "Confidentiality: Each party agrees..."}' },
      { name: "identify_parties", hint: '{"text": "between Acme Corp and Beta Inc"}' },
      { name: "extract_dates_values", hint: '{"text": "effective January 15, 2026... $500,000"}' },
    ],
  },
  {
    name: "contract-compliance-mcp",
    tools: [
      { name: "check_policy", hint: '{"clauses": [{"type":"liability","text":"..."}]}' },
      { name: "flag_risk", hint: '{"clauses": [{"type":"liability","text":"..."}]}' },
      { name: "get_policy_rules", hint: "{}" },
    ],
  },
];

export function BuildConsole() {
  const [selectedServer, setSelectedServer] = useState(MCP_SERVERS[0].name);
  const [selectedTool, setSelectedTool] = useState(MCP_SERVERS[0].tools[0].name);
  const [input, setInput] = useState(MCP_SERVERS[0].tools[0].hint);
  const { data, loading, error, post } = useApi<unknown>();

  const currentServer = MCP_SERVERS.find((s) => s.name === selectedServer) ?? MCP_SERVERS[0];
  const currentTool = currentServer.tools.find((t) => t.name === selectedTool) ?? currentServer.tools[0];

  function handleServerChange(name: string) {
    setSelectedServer(name);
    const server = MCP_SERVERS.find((s) => s.name === name);
    if (server) {
      setSelectedTool(server.tools[0].name);
      setInput(server.tools[0].hint);
    }
  }

  function handleToolChange(name: string) {
    setSelectedTool(name);
    const tool = currentServer.tools.find((t) => t.name === name);
    if (tool) setInput(tool.hint);
  }

  async function handleExecute() {
    try {
      const parsed = JSON.parse(input);
      await post(`/tools/${selectedServer}/${selectedTool}`, { input: parsed });
    } catch {
      // input parsing error handled by the UI
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-2">Build Console</h2>
      <p className="text-sm text-gray-500 mb-6">Test individual MCP tools interactively</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MCP Server</label>
            <select
              value={selectedServer}
              onChange={(e) => handleServerChange(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {MCP_SERVERS.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tool</label>
            <select
              value={selectedTool}
              onChange={(e) => handleToolChange(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {currentServer.tools.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Input JSON</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={8}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
            />
          </div>

          <button
            onClick={handleExecute}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Executing..." : "Execute Tool"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Response</h3>
          {data ? (
            <JsonViewer data={data} maxHeight="500px" />
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-400 text-sm">
              Execute a tool to see the response
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
