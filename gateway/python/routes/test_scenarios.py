"""Test scenarios routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..stores import test_scenario_store

router = APIRouter(prefix="/api/v1")


@router.get("/test-scenarios")
async def list_scenarios() -> list[dict[str, Any]]:
    return test_scenario_store.get_all()


@router.post("/test-scenarios")
async def add_scenario(request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json()

    if not body.get("id") or not body.get("name") or not body.get("description"):
        return JSONResponse(status_code=400, content={
            "error": "ValidationError",
            "message": "Fields id, name, and description are required",
        })

    existing = test_scenario_store.get_all()
    if any(s.get("id") == body["id"] for s in existing):
        return JSONResponse(status_code=409, content={
            "error": "ConflictError",
            "message": f"Scenario with id '{body['id']}' already exists",
        })

    scenario = {
        "id": body["id"],
        "name": body["name"],
        "description": body["description"],
        "inputSummary": body.get("inputSummary", ""),
        "expectations": body.get("expectations", []),
        "requiredCapabilities": body.get("requiredCapabilities", []),
        "requiresHumanReview": body.get("requiresHumanReview", False),
        "prefersParallel": body.get("prefersParallel", False),
    }
    await test_scenario_store.add(scenario)
    return JSONResponse(status_code=201, content=scenario)


@router.delete("/test-scenarios/{scenario_id}")
async def delete_scenario(scenario_id: str) -> JSONResponse:
    removed = await test_scenario_store.remove(scenario_id)
    if not removed:
        return JSONResponse(status_code=404, content={
            "error": "NotFound",
            "message": f"Scenario '{scenario_id}' not found",
        })
    return JSONResponse(content={"message": f"Scenario '{scenario_id}' deleted"})
