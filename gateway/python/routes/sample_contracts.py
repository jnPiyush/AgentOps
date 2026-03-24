"""Sample contracts routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .. import config

router = APIRouter(prefix="/api/v1")

SAMPLES_DIR = config.DATA_DIR / "sample-contracts"


@router.get("/sample-contracts")
async def list_samples() -> list[dict[str, str]]:
    try:
        files = sorted(p.name for p in SAMPLES_DIR.iterdir() if p.suffix == ".txt")
        return [{"filename": f} for f in files]
    except Exception:
        return []


@router.get("/sample-contracts/{filename}")
async def get_sample(filename: str) -> JSONResponse:
    if ".." in filename or "/" in filename or "\\" in filename:
        return JSONResponse(status_code=400, content={"error": "Invalid filename"})
    path = SAMPLES_DIR / filename
    try:
        text = path.read_text(encoding="utf-8")
        return JSONResponse(content={"filename": filename, "text": text})
    except Exception:
        return JSONResponse(status_code=404, content={
            "error": "NotFound",
            "message": f"Sample contract '{filename}' not found",
        })
