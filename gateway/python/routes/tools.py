"""MCP tool discovery and invocation routes."""

from __future__ import annotations

import json
from typing import Any

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .. import config

router = APIRouter(prefix="/api/v1")

TOOL_REGISTRY: dict[str, list[dict[str, str]]] = {
    "contract-intake-mcp": [
        {"name": "upload_contract", "description": "Upload and register a new contract"},
        {"name": "classify_document", "description": "Classify the type of contract document"},
        {"name": "extract_metadata", "description": "Extract metadata from a contract"},
    ],
    "contract-extraction-mcp": [
        {"name": "extract_clauses", "description": "Extract key clauses from a contract"},
        {"name": "identify_parties", "description": "Identify all parties involved in a contract"},
        {"name": "extract_dates_values", "description": "Extract key dates and monetary values"},
    ],
    "contract-compliance-mcp": [
        {"name": "check_policy", "description": "Check clauses against compliance policies"},
        {"name": "flag_risk", "description": "Flag risky clauses that need review"},
        {"name": "get_policy_rules", "description": "Get all active compliance policy rules"},
        {"name": "add_policy_rule", "description": "Add a new policy rule"},
        {"name": "update_policy_rule", "description": "Update an existing policy rule"},
        {"name": "delete_policy_rule", "description": "Delete a policy rule"},
    ],
    "contract-workflow-mcp": [
        {"name": "route_approval", "description": "Route contract for approval based on risk"},
        {"name": "escalate_to_human", "description": "Escalate contract for human review"},
        {"name": "notify_stakeholder", "description": "Notify a stakeholder about a contract"},
    ],
    "contract-audit-mcp": [
        {"name": "log_decision", "description": "Log a decision to the audit trail"},
        {"name": "get_audit_trail", "description": "Get audit trail for a contract"},
        {"name": "generate_report", "description": "Generate an audit report"},
    ],
    "contract-eval-mcp": [
        {"name": "run_evaluation", "description": "Run evaluation suite for an agent"},
        {"name": "get_results", "description": "Get evaluation results"},
        {"name": "compare_baseline", "description": "Compare results against a baseline"},
    ],
    "contract-drift-mcp": [
        {"name": "detect_llm_drift", "description": "Detect LLM output drift"},
        {"name": "detect_data_drift", "description": "Detect data distribution drift"},
        {"name": "simulate_model_swap", "description": "Simulate swapping the model"},
    ],
    "contract-feedback-mcp": [
        {"name": "submit_feedback", "description": "Submit feedback for an agent"},
        {"name": "convert_to_tests", "description": "Convert negative feedback to test cases"},
        {"name": "get_summary", "description": "Get feedback summary"},
    ],
}


async def _call_mcp_tool(
    port: int,
    tool: str,
    input_data: dict[str, Any],
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        # Connect to SSE to get sessionId
        async with client.stream("GET", f"http://localhost:{port}/sse") as sse:
            session_id = ""
            async for line in sse.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:].strip()
                    import re
                    match = re.search(r"sessionId=([a-zA-Z0-9_-]+)", data)
                    if match:
                        session_id = match.group(1)
                        break

            if not session_id:
                return {"result": None, "error": "Failed to get sessionId from SSE"}

            # Send JSON-RPC call
            rpc_res = await client.post(
                f"http://localhost:{port}/messages",
                params={"sessionId": session_id},
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {"name": tool, "arguments": input_data},
                },
            )

            if rpc_res.status_code != 200:
                return {"result": None, "error": f"RPC failed ({rpc_res.status_code}): {rpc_res.text}"}

            # Read response from SSE stream
            async for line in sse.aiter_lines():
                if line.startswith("data: "):
                    event_data = line[6:].strip()
                    try:
                        parsed = json.loads(event_data)
                        if parsed.get("id") == 1 and ("result" in parsed or "error" in parsed):
                            if "error" in parsed:
                                return {"result": None, "error": parsed["error"].get("message", "Unknown error")}
                            output_text = parsed.get("result", {}).get("content", [{}])[0].get("text", "{}")
                            try:
                                return {"result": json.loads(output_text)}
                            except json.JSONDecodeError:
                                return {"result": output_text}
                    except json.JSONDecodeError:
                        continue

    return {"result": None, "error": "No response from MCP server"}


@router.get("/tools")
async def list_tools() -> list[dict[str, Any]]:
    servers = []
    async with httpx.AsyncClient(timeout=3.0) as client:
        for srv in config.MCP_SERVERS:
            status = "offline"
            try:
                res = await client.get(f"http://localhost:{srv['port']}/health")
                if res.status_code == 200:
                    status = "online"
            except Exception:
                pass

            known_tools = TOOL_REGISTRY.get(srv["name"], [])
            servers.append({
                "name": srv["name"],
                "port": srv["port"],
                "tools": [{"name": t["name"], "description": t["description"], "inputSchema": {}} for t in known_tools],
                "status": status,
            })
    return servers


@router.post("/tools/{server}/{tool}")
async def invoke_tool(server: str, tool: str, request: Request) -> JSONResponse:
    mcp_server = next((s for s in config.MCP_SERVERS if s["name"] == server), None)
    if not mcp_server:
        return JSONResponse(status_code=404, content={
            "error": "NotFound",
            "message": f"MCP server '{server}' not found",
        })

    body: dict[str, Any] = await request.json() if await request.body() else {}
    input_data = body.get("input", {})
    start = __import__("time").time()

    try:
        res = await _call_mcp_tool(mcp_server["port"], tool, input_data)
        elapsed = int((__import__("time").time() - start) * 1000)

        if res.get("error"):
            return JSONResponse(status_code=500, content={
                "error": "ToolError",
                "message": res["error"],
                "latency_ms": elapsed,
            })

        return JSONResponse(content={
            "output": res["result"],
            "latency_ms": elapsed,
            "status": "success",
        })
    except Exception:
        elapsed = int((__import__("time").time() - start) * 1000)
        return JSONResponse(status_code=503, content={
            "error": "ServiceUnavailable",
            "message": f"MCP server '{server}' is not responding",
            "latency_ms": elapsed,
        })
