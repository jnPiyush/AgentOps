"""Drift detection routes."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter

from .. import config

router = APIRouter(prefix="/api/v1")


def _load_drift() -> dict[str, Any] | None:
    path = config.DATA_DIR / "drift.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


@router.get("/drift/llm")
async def drift_llm() -> dict[str, Any]:
    data = _load_drift()
    return data.get("llm_drift", {}) if data else {}


@router.get("/drift/data")
async def drift_data() -> dict[str, Any]:
    data = _load_drift()
    return data.get("data_drift", {}) if data else {}


@router.post("/drift/model-swap")
async def drift_model_swap() -> dict[str, Any]:
    data = _load_drift()
    return data.get("model_swap", {}) if data else {}
