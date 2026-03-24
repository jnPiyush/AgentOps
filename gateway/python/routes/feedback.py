"""Feedback routes: submit, summary, optimize."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..stores import feedback_store

router = APIRouter(prefix="/api/v1")


@router.post("/feedback")
async def submit_feedback(request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json()

    for field in ("contract_id", "agent", "sentiment", "comment"):
        if not body.get(field):
            return JSONResponse(status_code=400, content={
                "error": "ValidationError",
                "message": "contract_id, agent, sentiment, and comment are required",
                "request_id": str(uuid.uuid4()),
            })

    if body["sentiment"] not in ("positive", "negative"):
        return JSONResponse(status_code=400, content={
            "error": "ValidationError",
            "message": "Sentiment must be 'positive' or 'negative'",
            "request_id": str(uuid.uuid4()),
        })

    now = __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime())
    entry = {
        "id": str(uuid.uuid4()),
        "contract_id": body["contract_id"],
        "agent": body["agent"],
        "sentiment": body["sentiment"],
        "comment": body["comment"],
        "reviewer": body.get("reviewer", "anonymous"),
        "submitted_at": now,
        "converted_to_test": False,
    }
    await feedback_store.add(entry)
    return JSONResponse(status_code=201, content=entry)


@router.get("/feedback/summary")
async def feedback_summary() -> dict[str, Any]:
    entries = feedback_store.get_all()
    positive = sum(1 for e in entries if e.get("sentiment") == "positive")
    negative = sum(1 for e in entries if e.get("sentiment") == "negative")
    converted = sum(1 for e in entries if e.get("converted_to_test"))

    by_agent: dict[str, dict[str, Any]] = {}
    for e in entries:
        ag = e.get("agent", "unknown")
        if ag not in by_agent:
            by_agent[ag] = {"positive": 0, "negative": 0, "satisfaction": 0}
        by_agent[ag][e["sentiment"]] += 1
    for v in by_agent.values():
        total = v["positive"] + v["negative"]
        v["satisfaction"] = round((v["positive"] / total) * 100) if total else 0

    return {
        "total": len(entries),
        "positive": positive,
        "negative": negative,
        "converted_to_tests": converted,
        "by_agent": by_agent,
        "recent": list(reversed(entries[-10:])),
    }


@router.post("/feedback/optimize")
async def feedback_optimize() -> JSONResponse:
    entries = feedback_store.get_all()
    negatives = [e for e in entries if e.get("sentiment") == "negative" and not e.get("converted_to_test")]

    now = __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime())
    test_cases = []
    for fb in negatives:
        test_cases.append({
            "id": f"tc-{str(uuid.uuid4())[:8]}",
            "source_feedback_id": fb["id"],
            "contract_id": fb["contract_id"],
            "agent": fb["agent"],
            "test_description": f"Verify {fb['agent']} handles: {fb['comment'][:80]}",
            "expected_behavior": f"Agent should correctly address: {fb['comment'][:100]}",
            "created_at": now,
        })
        await feedback_store.update(fb["id"], {"converted_to_test": True})

    return JSONResponse(status_code=201, content={
        "test_cases_created": len(test_cases),
        "test_cases": test_cases,
        "feedbacks_converted": len(negatives),
    })
