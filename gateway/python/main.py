"""FastAPI gateway - replaces the Fastify TypeScript gateway entirely.

Run with:
    python -m uvicorn gateway.python.main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from . import config
from .routes import (
    audit,
    contracts,
    deploy,
    drift,
    evaluations,
    feedback,
    prompts,
    sample_contracts,
    test_scenarios,
    tools,
    workflows,
)
from .stores import init_stores
from .websocket_manager import add_ws_client, remove_ws_client
from .workflow_registry import init_workflow_registry

# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_stores()
    await init_workflow_registry()
    print(f"Gateway listening on http://localhost:{config.GATEWAY_PORT}")
    print(f"Mode: {config.DEMO_MODE}")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="AgentOps Gateway", lifespan=lifespan)

# Rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"error": "Rate limit exceeded"})


# CORS
_origins = config.ALLOWED_ORIGINS or [
    "http://localhost:8000",
    f"http://localhost:{config.GATEWAY_PORT}",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws/workflow")
async def websocket_endpoint(ws: WebSocket):
    await add_ws_client(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        remove_ws_client(ws)


# ---------------------------------------------------------------------------
# Inline endpoints (mode, client-config, health)
# ---------------------------------------------------------------------------

def _ensure_admin(request: Request) -> dict[str, Any] | None:
    if not config.DEPLOY_ADMIN_KEY:
        return {"status": 503, "body": {
            "error": "admin_key_not_configured",
            "message": "DEPLOY_ADMIN_KEY must be configured for admin routes",
        }}
    if request.headers.get("x-admin-key") != config.DEPLOY_ADMIN_KEY:
        return {"status": 401, "body": {
            "error": "unauthorized",
            "message": "Missing or invalid admin key",
        }}
    return None


@app.post("/api/v1/mode")
async def set_mode(request: Request) -> JSONResponse:
    err = _ensure_admin(request)
    if err:
        return JSONResponse(status_code=err["status"], content=err["body"])
    body: dict[str, Any] = await request.json()
    mode = body.get("mode")
    if mode not in ("live", "simulated"):
        return JSONResponse(status_code=400, content={"error": "Invalid mode. Use 'live' or 'simulated'."})
    config.DEMO_MODE = mode
    return JSONResponse(content={"mode": config.DEMO_MODE})


@app.get("/api/v1/client-config")
async def client_config() -> dict[str, Any]:
    return {
        "mode": config.DEMO_MODE,
        "requiresAdminKey": config.DEMO_MODE == "live" and bool(config.DEPLOY_ADMIN_KEY),
    }


@app.get("/api/v1/health")
async def health() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=2.0) as client:
        results = {}
        for srv in config.MCP_SERVERS:
            try:
                res = await client.get(f"http://localhost:{srv['port']}/health")
                results[srv["name"]] = "online" if res.status_code == 200 else "error"
            except Exception:
                results[srv["name"]] = "offline"

    return {
        "status": "ok",
        "mode": config.DEMO_MODE,
        "servers": results,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ---------------------------------------------------------------------------
# Register route modules
# ---------------------------------------------------------------------------
app.include_router(contracts.router)
app.include_router(audit.router)
app.include_router(workflows.router)
app.include_router(deploy.router)
app.include_router(drift.router)
app.include_router(evaluations.router)
app.include_router(feedback.router)
app.include_router(prompts.router)
app.include_router(sample_contracts.router)
app.include_router(test_scenarios.router)
app.include_router(tools.router)

# ---------------------------------------------------------------------------
# Static files (UI) - must be last so it doesn't shadow API routes
# ---------------------------------------------------------------------------
_ui_dir = config.ROOT_DIR / "ui"
if _ui_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_ui_dir), html=True), name="ui")
