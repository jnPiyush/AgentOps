"""Contract Feedback MCP Server (Python port).

Tools: submit_feedback, convert_to_tests, get_summary.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("contract-feedback-mcp")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
FEEDBACK_FILE = DATA_DIR / "feedback.json"


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def _load_feedback() -> list[dict[str, Any]]:
    try:
        return json.loads(FEEDBACK_FILE.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_feedback(entries: list[dict[str, Any]]) -> None:
    FEEDBACK_FILE.write_text(json.dumps(entries, indent=2), "utf-8")


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def submit_feedback(
    contract_id: str, agent: str, sentiment: str, comment: str, reviewer: str,
) -> dict[str, Any]:
    entry = {
        "id": f"fb-{uuid.uuid4().hex[:8]}",
        "contract_id": contract_id,
        "agent": agent,
        "sentiment": sentiment,
        "comment": comment,
        "reviewer": reviewer,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "converted_to_test": False,
    }
    entries = _load_feedback()
    entries.append(entry)
    _save_feedback(entries)
    return entry


def convert_to_test_cases() -> dict[str, Any]:
    entries = _load_feedback()
    negative = [e for e in entries if e["sentiment"] == "negative" and not e.get("converted_to_test")]
    test_cases = [
        {
            "id": f"tc-{uuid.uuid4().hex[:8]}",
            "source_feedback_id": fb["id"],
            "contract_id": fb["contract_id"],
            "agent": fb["agent"],
            "test_description": f"Verify {fb['agent']} handles: {fb['comment'][:80]}",
            "expected_behavior": f"Agent should correctly address the issue: {fb['comment'][:100]}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        for fb in negative
    ]
    for fb in negative:
        fb["converted_to_test"] = True
    _save_feedback(entries)
    return {
        "test_cases_created": len(test_cases),
        "test_cases": test_cases,
        "feedbacks_converted": len(negative),
    }


def get_feedback_summary() -> dict[str, Any]:
    entries = _load_feedback()
    positive = sum(1 for e in entries if e["sentiment"] == "positive")
    negative = sum(1 for e in entries if e["sentiment"] == "negative")
    converted = sum(1 for e in entries if e.get("converted_to_test"))

    by_agent: dict[str, dict[str, Any]] = {}
    for e in entries:
        a = e["agent"]
        if a not in by_agent:
            by_agent[a] = {"positive": 0, "negative": 0, "satisfaction": 0}
        by_agent[a][e["sentiment"]] += 1
    for stats in by_agent.values():
        total = stats["positive"] + stats["negative"]
        stats["satisfaction"] = round(stats["positive"] / total * 100) if total > 0 else 0

    recent = list(reversed(entries[-10:]))
    return {
        "total": len(entries),
        "positive": positive,
        "negative": negative,
        "converted_to_tests": converted,
        "by_agent": by_agent,
        "recent": recent,
    }


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_submit_feedback(
    contract_id: str, agent: str, sentiment: str, comment: str, reviewer: str,
) -> str:
    """Submit human feedback (thumbs up/down with comment) on an agent output."""
    return json.dumps(submit_feedback(contract_id, agent, sentiment, comment, reviewer))


@mcp.tool()
def tool_convert_to_tests() -> str:
    """Convert all unconverted negative feedback into evaluation test cases."""
    return json.dumps(convert_to_test_cases())


@mcp.tool()
def tool_get_summary() -> str:
    """Get feedback trends and per-agent satisfaction summary."""
    return json.dumps(get_feedback_summary())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    port = int(os.environ.get("MCP_FEEDBACK_PORT", "9008"))
    mcp.settings.port = port

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[
        Route("/health", health),
        Mount("/", app=mcp.sse_app()),
    ])
    uvicorn.run(app, host="127.0.0.1", port=port)
