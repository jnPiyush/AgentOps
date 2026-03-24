"""Contract Drift MCP Server (Python port).

Tools: detect_llm_drift, detect_data_drift, simulate_model_swap.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("contract-drift-mcp")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

_cached_data: dict[str, Any] | None = None


def _load_drift() -> dict[str, Any]:
    global _cached_data
    if _cached_data is not None:
        return _cached_data
    _cached_data = json.loads((DATA_DIR / "drift.json").read_text("utf-8"))
    return _cached_data  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def detect_llm_drift() -> dict[str, Any]:
    data = _load_drift()
    timeline = data["llm_drift"]["timeline"]
    latest = timeline[-1]
    threshold = 0.85
    drift_detected = latest["accuracy"] < threshold
    return {
        "drift_detected": drift_detected,
        "current_accuracy": latest["accuracy"],
        "threshold": threshold,
        "timeline": timeline,
        "alerts": data["llm_drift"]["alerts"],
        "recommendation": (
            "Accuracy below threshold. Consider retraining prompts or evaluating model updates."
            if drift_detected
            else "Accuracy within acceptable range. Continue monitoring."
        ),
    }


def detect_data_drift() -> dict[str, Any]:
    data = _load_drift()
    known = {"NDA", "MSA", "SOW", "Amendment", "SLA"}
    dist = data["data_drift"]["distribution"]
    new_types = [k for k in dist if k not in known]
    return {
        "shift_detected": len(new_types) > 0,
        "distribution": dist,
        "new_types": new_types,
        "timeline": data["data_drift"]["timeline"],
        "alerts": data["data_drift"]["alerts"],
        "recommendation": (
            f"New contract types detected: {', '.join(new_types)}. Update training data and compliance rules."
            if new_types
            else "No new contract types detected. Distribution stable."
        ),
    }


def simulate_model_swap() -> dict[str, Any]:
    data = _load_drift()
    swap = data["model_swap"]
    threshold = 0.05
    verdict = "ACCEPTABLE" if abs(swap["comparison"]["accuracy_delta"]) <= threshold else "DEGRADED"
    acc_drop = abs(swap["comparison"]["accuracy_delta"] * 100)
    cost_save = abs(swap["comparison"]["cost_delta"] * 100)
    return {
        "current_model": "GPT-5.4",
        "candidate_model": "GPT-4o-mini",
        "current": swap["gpt4o"],
        "candidate": swap["gpt4o_mini"],
        "delta": {
            "accuracy": f"{swap['comparison']['accuracy_delta'] * 100:.1f}%",
            "latency": f"{swap['comparison']['latency_delta'] * 100:.0f}%",
            "cost": f"{swap['comparison']['cost_delta'] * 100:.0f}%",
        },
        "verdict": verdict,
        "reasoning": (
            f"Accuracy drop of {acc_drop:.1f}% within threshold. Save {cost_save:.0f}% cost."
            if verdict == "ACCEPTABLE"
            else f"Accuracy drop of {acc_drop:.1f}% exceeds {threshold * 100}% threshold. Keep current model."
        ),
    }


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_detect_llm_drift() -> str:
    """Detect LLM accuracy drift over time by comparing weekly performance metrics against threshold."""
    return json.dumps(detect_llm_drift())


@mcp.tool()
def tool_detect_data_drift() -> str:
    """Detect shifts in contract type distribution and identify new contract types not in training data."""
    return json.dumps(detect_data_drift())


@mcp.tool()
def tool_simulate_model_swap() -> str:
    """Compare GPT-5.4 vs GPT-4o-mini on accuracy, latency, and cost metrics."""
    return json.dumps(simulate_model_swap())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    port = int(os.environ.get("MCP_DRIFT_PORT", "9007"))
    mcp.settings.port = port

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[
        Route("/health", health),
        Mount("/", app=mcp.sse_app()),
    ])
    uvicorn.run(app, host="127.0.0.1", port=port)
