"""Workflow routes: CRUD, activate, stage-map, catalog."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..workflow_registry import (
    activate_workflow_definition,
    delete_workflow_definition,
    get_active_workflow,
    get_active_workflow_package,
    get_contract_stage_catalog,
    get_workflow_by_id,
    list_workflows,
    save_workflow_definition,
    validate_workflow_input,
)

router = APIRouter(prefix="/api/v1")


@router.get("/workflows")
async def list_wf() -> dict[str, Any]:
    return {
        "workflows": list_workflows(),
        "active_workflow_id": (get_active_workflow_package() or {}).get("workflow_id"),
    }


@router.get("/workflows/active")
async def active_wf() -> JSONResponse:
    wf = get_active_workflow()
    if not wf:
        return JSONResponse(status_code=404, content={"error": "No active workflow set"})
    return JSONResponse(content=wf)


@router.get("/workflows/active/package")
async def active_package() -> JSONResponse:
    pkg = get_active_workflow_package()
    if not pkg:
        return JSONResponse(status_code=404, content={"error": "No active workflow package set"})
    return JSONResponse(content=pkg)


@router.get("/workflows/active/stage-map")
async def active_stage_map() -> JSONResponse:
    pkg = get_active_workflow_package()
    if not pkg:
        return JSONResponse(status_code=404, content={"error": "No active workflow package set"})
    return JSONResponse(content=pkg.get("contract_stage_map", {}))


@router.get("/workflows/stages/catalog")
async def stage_catalog() -> dict[str, Any]:
    return {
        "catalog_reference": "config/stages/contract-lifecycle.json",
        "stages": get_contract_stage_catalog(),
    }


@router.get("/workflows/{wf_id}")
async def get_wf(wf_id: str) -> JSONResponse:
    wf = get_workflow_by_id(wf_id)
    if not wf:
        return JSONResponse(status_code=404, content={"error": "Workflow not found"})
    return JSONResponse(content=wf)


@router.post("/workflows")
async def save_wf(request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json()

    errors = validate_workflow_input({
        "name": body.get("name"),
        "type": body.get("type"),
        "agents": body.get("agents"),
    })
    if errors:
        return JSONResponse(status_code=400, content={
            "error": "ValidationError", "message": " ".join(errors),
        })

    existing = get_workflow_by_id(body["id"]) if body.get("id") else None
    try:
        wf = await save_workflow_definition({
            "id": body.get("id"),
            "name": body.get("name", ""),
            "type": body.get("type", "sequential"),
            "agents": body.get("agents", []),
        })
        return JSONResponse(status_code=200 if existing else 201, content=wf)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={
            "error": "ValidationError", "message": str(exc),
        })


@router.post("/workflows/{wf_id}/activate")
async def activate_wf(wf_id: str) -> JSONResponse:
    try:
        result = await activate_workflow_definition(wf_id)
        pkg = result["workflow_package"]
        return JSONResponse(content={
            "message": "Workflow activated",
            "workflow": result["workflow"],
            "workflow_package": {
                "id": pkg["id"],
                "workflow_version": pkg["workflow_version"],
                "activated_at": pkg["activated_at"],
            },
        })
    except ValueError as exc:
        return JSONResponse(status_code=404, content={
            "error": "Workflow not found", "message": str(exc),
        })


@router.delete("/workflows/{wf_id}")
async def delete_wf(wf_id: str) -> JSONResponse:
    removed = await delete_workflow_definition(wf_id)
    if not removed:
        return JSONResponse(status_code=404, content={"error": "Workflow not found"})
    return JSONResponse(content={"message": "Workflow deleted"})
