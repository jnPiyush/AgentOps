"""Evaluation routes: results, run, baseline comparison."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..stores import evaluation_store

router = APIRouter(prefix="/api/v1")


def _simulate_eval(version: str) -> dict[str, Any]:
    seed = ord(version[-1]) if version else 0
    base_acc = 0.82 + (seed % 10) * 0.015
    total = 20
    passed = round(total * min(0.95, base_acc + 0.03))

    judge = {
        "relevance": round(min(5, 4.0 + (seed % 10) * 0.07) * 10) / 10,
        "groundedness": round(min(5, 3.8 + (seed % 8) * 0.08) * 10) / 10,
        "coherence": round(min(5, 4.2 + (seed % 6) * 0.08) * 10) / 10,
    }

    return {
        "id": f"eval-{str(uuid.uuid4())[:8]}",
        "version": version,
        "run_at": __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime()),
        "total_cases": total,
        "passed": passed,
        "accuracy": round((passed / total) * 1000) / 10,
        "per_metric": {
            "extraction_accuracy": round(min(0.98, base_acc + 0.04) * 1000) / 10,
            "compliance_accuracy": round(min(0.95, base_acc) * 1000) / 10,
            "classification_accuracy": round(min(0.99, base_acc + 0.08) * 1000) / 10,
            "false_flag_rate": round((1 - min(0.95, base_acc)) * 0.6 * 1000) / 10,
            "latency_p95_s": round((2.0 + (seed % 5) * 0.3) * 10) / 10,
        },
        "per_contract": {},
        "quality_gate": "PASS" if passed / total >= 0.8 and judge["relevance"] >= 4.0 else "FAIL",
        "judge_scores": judge,
    }


@router.get("/evaluations/results")
async def eval_results() -> list[dict[str, Any]]:
    return evaluation_store.get_all()


@router.post("/evaluations/run")
async def eval_run(request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json() if await request.body() else {}
    version = body.get("version", "v1.3")
    result = _simulate_eval(version)
    await evaluation_store.add(result)
    return JSONResponse(status_code=201, content=result)


@router.get("/evaluations/baseline")
async def eval_baseline() -> dict[str, Any]:
    baseline = _simulate_eval("v1.2")
    results = evaluation_store.get_all()
    latest = results[-1] if results else None
    if latest:
        bj = baseline.get("judge_scores", {})
        lj = latest.get("judge_scores", {})
        return {
            "baseline": baseline,
            "current": latest,
            "delta": {
                "accuracy": round((latest["accuracy"] - baseline["accuracy"]) * 10) / 10,
                "relevance": round((lj.get("relevance", 0) - bj.get("relevance", 0)) * 10) / 10,
                "groundedness": round((lj.get("groundedness", 0) - bj.get("groundedness", 0)) * 10) / 10,
                "coherence": round((lj.get("coherence", 0) - bj.get("coherence", 0)) * 10) / 10,
            },
        }
    return {"baseline": baseline, "current": None, "delta": None}
