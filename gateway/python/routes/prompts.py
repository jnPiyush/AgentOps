"""Prompt routes: get/update agent system prompts."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .. import config

router = APIRouter(prefix="/api/v1")

PROMPTS_DIR = config.ROOT_DIR / "prompts"

AGENT_PROMPT_FILES: dict[str, str] = {
    "intake": "intake-system.md",
    "extraction": "extraction-system.md",
    "compliance": "compliance-system.md",
    "approval": "approval-system.md",
}


@router.get("/prompts/{agent}")
async def get_prompt(agent: str) -> JSONResponse:
    filename = AGENT_PROMPT_FILES.get(agent)
    if not filename:
        return JSONResponse(status_code=404, content={
            "error": "NotFound",
            "message": f"Unknown agent: {agent}. Valid agents: {', '.join(AGENT_PROMPT_FILES)}",
        })
    path = PROMPTS_DIR / filename
    try:
        prompt = path.read_text(encoding="utf-8")
    except Exception:
        prompt = ""
    return JSONResponse(content={"agent": agent, "prompt": prompt, "filename": filename})


@router.post("/prompts/{agent}")
async def save_prompt(agent: str, request: Request) -> JSONResponse:
    filename = AGENT_PROMPT_FILES.get(agent)
    if not filename:
        return JSONResponse(status_code=404, content={
            "error": "NotFound", "message": f"Unknown agent: {agent}",
        })
    body: dict[str, Any] = await request.json()
    prompt = body.get("prompt")
    if not prompt or not isinstance(prompt, str):
        return JSONResponse(status_code=400, content={
            "error": "ValidationError", "message": "prompt field is required",
        })
    (PROMPTS_DIR / filename).write_text(prompt, encoding="utf-8")
    return JSONResponse(content={"agent": agent, "saved": True, "filename": filename})
