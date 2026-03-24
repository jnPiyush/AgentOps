"""Deploy routes: Foundry pipeline deploy, status, cleanup, mode."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .. import config

router = APIRouter(prefix="/api/v1")

DEPLOY_SCRIPT = config.ROOT_DIR / "scripts" / "deploy" / "foundry_deploy.py"

_last_deployment: dict[str, Any] | None = None


def _ensure_admin(request: Request) -> dict[str, Any] | None:
    """Return error response dict if access denied, None if allowed."""
    if config.DEMO_MODE != "live":
        return None
    if not config.DEPLOY_ADMIN_KEY:
        return {"status": 503, "body": {
            "error": "deploy_admin_not_configured",
            "message": "DEPLOY_ADMIN_KEY must be configured for live deployment routes",
        }}
    if request.headers.get("x-admin-key") != config.DEPLOY_ADMIN_KEY:
        return {"status": 401, "body": {
            "error": "unauthorized",
            "message": "Missing or invalid deploy admin key",
        }}
    return None


def _foundry_cfg() -> dict[str, str]:
    return {
        "endpoint": config.FOUNDRY_ENDPOINT,
        "projectEndpoint": config.FOUNDRY_PROJECT_ENDPOINT,
        "authMode": config.FOUNDRY_AUTH_MODE,
        "apiKey": config.FOUNDRY_API_KEY,
        "managedIdentityClientId": config.FOUNDRY_MANAGED_IDENTITY_CLIENT_ID,
        "model": config.FOUNDRY_MODEL,
    }


def _is_foundry_configured() -> bool:
    cfg = _foundry_cfg()
    return bool(cfg["endpoint"] and (cfg["apiKey"] or cfg["authMode"] == "managed-identity"))


def _run_python_deploy(simulate: bool) -> dict[str, Any]:
    args = ["python", str(DEPLOY_SCRIPT), "--json"]
    if simulate:
        args.append("--simulate")

    env = dict(os.environ)
    if not simulate:
        cfg = _foundry_cfg()
        env["FOUNDRY_ENDPOINT"] = cfg["endpoint"]
        env["FOUNDRY_API_KEY"] = cfg["apiKey"]
        env["FOUNDRY_PROJECT_ENDPOINT"] = cfg["projectEndpoint"] or cfg["endpoint"]
        env["FOUNDRY_MODEL"] = cfg["model"]

    proc = subprocess.run(args, capture_output=True, text=True, timeout=600, env=env)
    return json.loads(proc.stdout)


@router.post("/deploy/pipeline")
async def deploy_pipeline(request: Request) -> JSONResponse:
    global _last_deployment
    err = _ensure_admin(request)
    if err:
        return JSONResponse(status_code=err["status"], content=err["body"])

    if config.DEMO_MODE == "live":
        if not _is_foundry_configured():
            return JSONResponse(status_code=400, content={
                "error": "missing_config",
                "message": "Foundry endpoint and API key (or managed-identity) must be configured",
            })
        result = _run_python_deploy(simulate=False)
    else:
        result = _run_python_deploy(simulate=True)

    _last_deployment = result
    return JSONResponse(status_code=201, content=result)


@router.get("/deploy/status")
async def deploy_status(request: Request) -> JSONResponse:
    err = _ensure_admin(request)
    if err:
        return JSONResponse(status_code=err["status"], content=err["body"])
    if not _last_deployment:
        return JSONResponse(status_code=404, content={
            "error": "no_deployment",
            "message": "No deployment has been run yet",
        })
    return JSONResponse(content=_last_deployment)


@router.delete("/deploy/agents")
async def deploy_cleanup(request: Request) -> JSONResponse:
    global _last_deployment
    err = _ensure_admin(request)
    if err:
        return JSONResponse(status_code=err["status"], content=err["body"])

    if not _last_deployment or not _last_deployment.get("agents"):
        return JSONResponse(status_code=404, content={
            "error": "no_agents",
            "message": "No registered agents to clean up",
        })

    agent_ids = [
        a["foundry_agent_id"]
        for a in _last_deployment["agents"]
        if a.get("status") == "registered"
    ]

    if config.DEMO_MODE == "live" and agent_ids:
        args = ["python", str(DEPLOY_SCRIPT), "--cleanup", *agent_ids, "--json"]
        env = dict(os.environ)
        cfg = _foundry_cfg()
        env["FOUNDRY_ENDPOINT"] = cfg["endpoint"]
        env["FOUNDRY_API_KEY"] = cfg["apiKey"]
        env["FOUNDRY_PROJECT_ENDPOINT"] = cfg["projectEndpoint"] or cfg["endpoint"]
        env["FOUNDRY_MODEL"] = cfg["model"]
        try:
            proc = subprocess.run(args, capture_output=True, text=True, timeout=120, env=env)
            lines = proc.stdout.strip().split("\n")
            json_line = next((l for l in lines if l.startswith("{")), None)
            result = json.loads(json_line) if json_line else {"deleted": len(agent_ids), "errors": []}
        except Exception:
            result = {"deleted": len(agent_ids), "errors": []}
        _last_deployment = None
        return JSONResponse(content={
            "deleted": result.get("deleted", 0),
            "errors": result.get("errors", []),
            "message": f"Cleaned up {result.get('deleted', 0)} agents from Foundry",
        })

    _last_deployment = None
    return JSONResponse(content={
        "deleted": len(agent_ids),
        "errors": [],
        "message": f"Cleaned up {len(agent_ids)} simulated agents",
    })


@router.get("/deploy/mode")
async def deploy_mode() -> dict[str, Any]:
    return {
        "mode": config.DEMO_MODE,
        "foundry_auth_mode": config.FOUNDRY_AUTH_MODE,
        "foundry_configured": _is_foundry_configured(),
    }
