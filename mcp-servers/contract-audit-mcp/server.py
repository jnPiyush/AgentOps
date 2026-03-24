"""Contract Audit MCP Server (Python port).

Tools: log_decision, get_audit_trail, generate_report.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("contract-audit-mcp")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
AUDIT_FILE = DATA_DIR / "audit.json"


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def _load_audit() -> list[dict]:
    try:
        return json.loads(AUDIT_FILE.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_audit(entries: list[dict]) -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_FILE.write_text(json.dumps(entries, indent=2), "utf-8")


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def log_decision(contract_id: str, agent: str, action: str, reasoning: str) -> dict:
    entry = {
        "id": f"audit-{uuid.uuid4().hex[:8]}",
        "contract_id": contract_id,
        "agent": agent,
        "action": action,
        "reasoning": reasoning,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    entries = _load_audit()
    entries.append(entry)
    _save_audit(entries)
    return entry


def get_audit_trail(contract_id: str) -> list[dict]:
    entries = _load_audit()
    trail = [e for e in entries if e["contract_id"] == contract_id]
    trail.sort(key=lambda e: e["timestamp"])
    return trail


def generate_report(contract_id: str) -> dict:
    trail = get_audit_trail(contract_id)
    agents = list(dict.fromkeys(e["agent"] for e in trail))
    if trail:
        last = trail[-1]
        summary = (
            f"Contract {contract_id} processed through {len(agents)} agent(s) with {len(trail)} decision(s). "
            f"Final action: {last['action']} by {last['agent']}."
        )
    else:
        summary = f"No audit trail found for contract {contract_id}."
    return {
        "contract_id": contract_id,
        "total_decisions": len(trail),
        "agents_involved": agents,
        "timeline": trail,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_log_decision(contract_id: str, agent: str, action: str, reasoning: str) -> str:
    """Log an agent or human decision to the audit trail."""
    return json.dumps(log_decision(contract_id, agent, action, reasoning))


@mcp.tool()
def tool_get_audit_trail(contract_id: str) -> str:
    """Retrieve the decision audit trail for a contract."""
    return json.dumps(get_audit_trail(contract_id))


@mcp.tool()
def tool_generate_report(contract_id: str) -> str:
    """Generate a summary audit report for a contract."""
    return json.dumps(generate_report(contract_id))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    port = int(os.environ.get("MCP_AUDIT_PORT", "9005"))
    mcp.settings.port = port

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[
        Route("/health", health),
        Mount("/", app=mcp.sse_app()),
    ])
    uvicorn.run(app, host="127.0.0.1", port=port)
