"""Contract routes: submit, list, get, HITL review."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import JSONResponse

from .. import config
from ..pipeline import run_pipeline
from ..stores import audit_store, contract_store, hydrate_contract_text
from ..websocket_manager import broadcast

router = APIRouter(prefix="/api/v1")

MAX_TEXT_LENGTH = 50_000


@router.post("/contracts")
async def submit_contract(request: Request, background_tasks: BackgroundTasks) -> JSONResponse:
    body: dict[str, Any] = await request.json()
    text = body.get("text")

    if not text or not isinstance(text, str) or not text.strip():
        return JSONResponse(status_code=400, content={
            "error": "ValidationError",
            "message": "Contract text is required",
            "details": {"field": "text", "reason": "required"},
            "request_id": str(uuid.uuid4()),
        })

    if len(text) > MAX_TEXT_LENGTH:
        return JSONResponse(status_code=400, content={
            "error": "ValidationError",
            "message": f"Contract text exceeds maximum length of {MAX_TEXT_LENGTH} characters",
            "details": {"field": "text", "reason": "too_long"},
            "request_id": str(uuid.uuid4()),
        })

    filename = body.get("filename", "unnamed-contract.txt")
    if not isinstance(filename, str):
        filename = "unnamed-contract.txt"

    contract_id = f"contract-{str(uuid.uuid4())[:8]}"

    async def _run() -> None:
        try:
            await run_pipeline(text, filename, contract_id)
        except Exception as exc:
            await broadcast({
                "event": "error",
                "contract_id": contract_id,
                "status": "pipeline_error",
                "result": {"error": str(exc)},
                "timestamp": __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime()),
            })

    background_tasks.add_task(_run)

    return JSONResponse(status_code=202, content={
        "contract_id": contract_id,
        "status": "processing",
        "message": "Contract submitted. Follow /ws/workflow for real-time updates.",
    })


@router.get("/contracts")
async def list_contracts() -> list[dict[str, Any]]:
    contracts = contract_store.get_all()
    return [{k: v for k, v in c.items() if k != "text"} for c in contracts]


@router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str) -> JSONResponse:
    contract = await hydrate_contract_text(contract_store.get_by_id(contract_id))
    if not contract:
        return JSONResponse(status_code=404, content={
            "error": "NotFound",
            "message": f"Contract {contract_id} not found",
            "request_id": str(uuid.uuid4()),
        })
    return JSONResponse(content=contract)


@router.post("/contracts/{contract_id}/review")
async def review_contract(contract_id: str, request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json()
    contract = contract_store.get_by_id(contract_id)
    if not contract:
        return JSONResponse(status_code=404, content={
            "error": "NotFound",
            "message": f"Contract {contract_id} not found",
            "request_id": str(uuid.uuid4()),
        })

    decision = body.get("decision")
    if decision not in ("approve", "reject", "request_changes"):
        return JSONResponse(status_code=400, content={
            "error": "ValidationError",
            "message": "Decision must be one of: approve, reject, request_changes",
            "details": {"field": "decision", "reason": "invalid"},
            "request_id": str(uuid.uuid4()),
        })

    new_status = "approved" if decision == "approve" else "rejected" if decision == "reject" else "awaiting_review"
    reviewer = str(body.get("reviewer", "anonymous")).strip()[:100]
    comment = str(body.get("comment", "")).strip()[:2000]
    now = __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime())

    await contract_store.update(contract_id, {"status": new_status, "completed_at": now})

    await audit_store.add({
        "id": str(uuid.uuid4()),
        "contract_id": contract_id,
        "agent": "human",
        "action": decision,
        "reasoning": comment,
        "timestamp": now,
    })

    await broadcast({
        "event": "pipeline_status",
        "contract_id": contract_id,
        "status": "approved" if new_status == "approved" else "rejected",
        "timestamp": now,
    })

    return JSONResponse(content={
        "contract_id": contract_id,
        "decision": decision,
        "reviewer": reviewer,
        "status": new_status,
        "timestamp": now,
    })
