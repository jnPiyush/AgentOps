"""Contract Workflow MCP Server (Python port).

Tools: route_approval, escalate_to_human, notify_stakeholder.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("contract-workflow-mcp")


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def route_approval(contract_id: str, risk_level: str, flags_count: int, reasoning: str | None = None) -> dict:
    if risk_level == "low" and flags_count == 0:
        return {
            "contract_id": contract_id,
            "action": "auto_approve",
            "risk_level": risk_level,
            "reasoning": reasoning or "Low-risk contract with no policy violations. Auto-approved.",
        }
    return {
        "contract_id": contract_id,
        "action": "escalate_to_human",
        "risk_level": risk_level,
        "reasoning": reasoning or f"Contract has {flags_count} policy violation(s) with {risk_level} risk level. Human review required.",
    }


def escalate_to_human(contract_id: str, reason: str, risk_level: str) -> dict:
    return {
        "contract_id": contract_id,
        "status": "awaiting_review",
        "escalation_reason": reason,
        "risk_level": risk_level,
        "assigned_to": "Legal Review Team",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def notify_stakeholder(contract_id: str, stakeholder: str, message: str) -> dict:
    return {
        "contract_id": contract_id,
        "stakeholder": stakeholder,
        "message": message,
        "delivered": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_route_approval(contract_id: str, risk_level: str, flags_count: int, reasoning: str = "") -> str:
    """Route contract for approval based on risk level."""
    return json.dumps(route_approval(contract_id, risk_level, flags_count, reasoning or None))


@mcp.tool()
def tool_escalate_to_human(contract_id: str, reason: str, risk_level: str) -> str:
    """Escalate a contract for human review."""
    return json.dumps(escalate_to_human(contract_id, reason, risk_level))


@mcp.tool()
def tool_notify_stakeholder(contract_id: str, stakeholder: str, message: str) -> str:
    """Send notification to stakeholders about contract status."""
    return json.dumps(notify_stakeholder(contract_id, stakeholder, message))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    port = int(os.environ.get("MCP_WORKFLOW_PORT", "9004"))
    mcp.settings.port = port

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[
        Route("/health", health),
        Mount("/", app=mcp.sse_app()),
    ])
    uvicorn.run(app, host="127.0.0.1", port=port)
