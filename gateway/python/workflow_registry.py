"""Workflow registry service (port of gateway/src/services/workflowRegistry.ts)."""

from __future__ import annotations

import asyncio
import copy
import json
import os
import uuid
from pathlib import Path
from typing import Any

from . import config
from .stores import JsonStore

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_workflow_store = JsonStore(config.DATA_DIR / "workflows" / "definitions.json")
_contract_stage_catalog_ref = "config/stages/contract-lifecycle.json"
_runtime_dir = config.DATA_DIR / "runtime"
_active_pkg_path = _runtime_dir / "active-workflow.json"
_packages_dir = _runtime_dir / "packages"
_catalog_path = config.ROOT_DIR / "config" / "stages" / "contract-lifecycle.json"

_catalog_asset: dict[str, Any] = {}
if _catalog_path.exists():
    _catalog_asset = json.loads(_catalog_path.read_text(encoding="utf-8"))

_active_cache: dict[str, Any] | None = None
_init_done = False

# ---------------------------------------------------------------------------
# Role asset map
# ---------------------------------------------------------------------------
_role_asset_map: dict[str, dict[str, str]] = {
    k: {
        "agent_config": f"config/agents/{k}-agent.yaml",
        "prompt": f"prompts/{k}-system.md",
        "output_schema": f"config/schemas/{k}-result.json",
    }
    for k in [
        "intake", "drafting", "extraction", "review", "compliance",
        "negotiation", "approval", "signature", "obligations", "renewal", "analytics",
    ]
}


# ---------------------------------------------------------------------------
# inferRoleKey
# ---------------------------------------------------------------------------
def _normalize(value: str) -> str:
    return value.strip().lower()


def _infer_role_key(agent: dict[str, Any]) -> str:
    tools = {_normalize(t) for t in agent.get("tools", [])}
    name = _normalize(agent.get("name", ""))
    role = _normalize(agent.get("role", ""))
    searchable = f"{name} {role}"

    if any(kw in searchable for kw in ("draft", "authoring", "clause library", "fallback language")):
        return "drafting"
    if any(kw in searchable for kw in ("internal review", "redline", "version diff", "review summary")):
        return "review"
    if any(kw in searchable for kw in ("negotiat", "counterparty", "fallback recommendation", "external review")):
        return "negotiation"
    if any(kw in searchable for kw in ("obligation", "task assignment", "post-execution", "post-signature", "milestone")):
        return "obligations"
    if any(kw in searchable for kw in ("signature", "execution", "signing")):
        return "signature"
    if any(kw in searchable for kw in ("analytic", "insight", "reporting", "executive summary")):
        return "analytics"
    if any(kw in searchable for kw in ("renewal", "expiry", "expiration")):
        return "renewal"
    if "upload_contract" in tools or "classify_document" in tools or "intake" in name or "classif" in role:
        return "intake"
    if "check_policy" in tools or "flag_risk" in tools or "compliance" in name or "compliance" in role:
        return "compliance"
    if "extract_clauses" in tools or "identify_parties" in tools or "extract" in name or "extract" in role:
        return "extraction"
    if "route_approval" in tools or "escalate_to_human" in tools or "approval" in name or "approval" in role:
        return "approval"

    kind = agent.get("kind", "")
    non_agent = {"human": "human", "merge": "merge", "orchestrator": "orchestrator"}
    return non_agent.get(kind, "custom")


# ---------------------------------------------------------------------------
# Stage inference
# ---------------------------------------------------------------------------
_STAGE_IDS = [
    "request-initiation",
    "authoring-drafting",
    "internal-review",
    "compliance-check",
    "negotiation-external-review",
    "approval-routing",
    "execution-signature",
    "obligation-management",
    "renewal-expiry",
    "portfolio-analytics",
]

_ROLE_TO_STAGE: dict[str, str] = {
    "intake": "request-initiation",
    "drafting": "authoring-drafting",
    "extraction": "authoring-drafting",
    "review": "internal-review",
    "compliance": "compliance-check",
    "negotiation": "negotiation-external-review",
    "approval": "approval-routing",
    "signature": "execution-signature",
    "obligations": "obligation-management",
    "renewal": "renewal-expiry",
    "analytics": "portfolio-analytics",
}


def _infer_stage_id(agent: dict[str, Any], role_key: str) -> str | None:
    if role_key in _ROLE_TO_STAGE:
        return _ROLE_TO_STAGE[role_key]

    searchable = f"{_normalize(agent.get('name', ''))} {_normalize(agent.get('role', ''))}"

    if any(kw in searchable for kw in ("review", "redline", "diff")):
        return "internal-review"
    if any(kw in searchable for kw in ("negotiat", "counterparty", "fallback")):
        return "negotiation-external-review"
    if any(kw in searchable for kw in ("obligation", "milestone", "post-execution", "post-signature")):
        return "obligation-management"
    if any(kw in searchable for kw in ("signature", "execution", "signing")):
        return "execution-signature"
    if any(kw in searchable for kw in ("analytic", "insight", "report")):
        return "portfolio-analytics"
    if any(kw in searchable for kw in ("renewal", "expiry", "expiration")):
        return "renewal-expiry"

    stage_num = agent.get("stage")
    if isinstance(stage_num, int) and 0 <= stage_num < len(_STAGE_IDS):
        return _STAGE_IDS[stage_num]

    return None


# ---------------------------------------------------------------------------
# Build bindings
# ---------------------------------------------------------------------------
def _build_binding(agent: dict[str, Any]) -> dict[str, Any]:
    role_key = _infer_role_key(agent)
    assets = _role_asset_map.get(role_key, {})
    return {
        "id": agent.get("id"),
        "name": agent.get("name"),
        "role": agent.get("role"),
        "kind": agent.get("kind", "agent"),
        "stage": agent.get("stage", 0),
        "lane": agent.get("lane", 0),
        "order": agent.get("order", 0),
        "model": agent.get("model"),
        "tools": list(agent.get("tools", [])),
        "boundary": agent.get("boundary"),
        "output": agent.get("output"),
        "runtime_role_key": role_key,
        "declarative": {
            "agent_config": assets.get("agent_config"),
            "prompt": assets.get("prompt"),
            "output_schema": assets.get("output_schema"),
        } if assets else {},
    }


# ---------------------------------------------------------------------------
# Stage catalog / map
# ---------------------------------------------------------------------------
def get_contract_stage_catalog() -> list[dict[str, Any]]:
    return [
        {**stage, "primary_mcp_affinity": list(stage.get("primary_mcp_affinity", []))}
        for stage in _catalog_asset.get("stages", [])
    ]


def _build_stage_map(bindings: list[dict[str, Any]]) -> dict[str, Any]:
    stage_assign: dict[str, list[dict[str, Any]]] = {}
    unmapped: list[str] = []

    for b in bindings:
        sid = _infer_stage_id(b, b["runtime_role_key"])
        if not sid:
            unmapped.append(b["id"])
            continue
        stage_assign.setdefault(sid, []).append(b)

    stages = []
    for stage in get_contract_stage_catalog():
        assigned = sorted(stage_assign.get(stage["id"], []), key=lambda x: x.get("order", 0))
        egs = []
        if assigned:
            egs.append({
                "id": f"group-{stage['id']}",
                "name": stage.get("default_execution_group_name", ""),
                "runtime_agent_ids": [a["id"] for a in assigned],
                "runtime_role_keys": [a["runtime_role_key"] for a in assigned],
                "primary_mcp_affinity": list(stage.get("primary_mcp_affinity", [])),
            })
        stages.append({
            **stage,
            "primary_mcp_affinity": list(stage.get("primary_mcp_affinity", [])),
            "execution_groups": egs,
        })

    return {
        "catalog_reference": _contract_stage_catalog_ref,
        "stages": stages,
        "unmapped_agent_ids": unmapped,
    }


def _build_version(activated_at: str) -> str:
    compact = activated_at.replace("-", "").replace(":", "").replace(".", "").replace("T", "").replace("Z", "")[:14]
    return f"v-{compact}-{str(uuid.uuid4())[:6]}"


# ---------------------------------------------------------------------------
# Build workflow package
# ---------------------------------------------------------------------------
def build_workflow_package(workflow: dict[str, Any]) -> dict[str, Any]:
    activated_at = __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime())
    version = _build_version(activated_at)
    agents = sorted(workflow.get("agents", []), key=lambda a: a.get("order", 0))
    bindings = [_build_binding(a) for a in agents]
    stage_map = _build_stage_map(bindings)

    checkpoints = [
        b["runtime_role_key"]
        for b in bindings
        if b["runtime_role_key"] in ("approval", "signature")
    ]

    return {
        "id": f"pkg-{workflow['id']}-{version}",
        "workflow_id": workflow["id"],
        "workflow_name": workflow.get("name"),
        "workflow_version": version,
        "activated_at": activated_at,
        "authoring_source": {
            "workflow_definition_id": workflow["id"],
            "updated_at": workflow.get("updatedAt"),
        },
        "execution_topology": workflow.get("type"),
        "mode_policy": {
            "mode": config.DEMO_MODE,
            "supported_modes": ["simulated", "live"],
        },
        "model_policy": {
            "primary_model": config.FOUNDRY_MODEL,
            "fallback_model": config.FOUNDRY_MODEL_SWAP,
            "emergency_model": "gpt-4o-mini",
        },
        "hitl_policy": {
            "enabled": len(checkpoints) > 0 or "hitl" in (workflow.get("type") or ""),
            "reviewer_role": "legal-reviewer",
            "timeout_hours": 24,
            "escalation_email": config.LEGAL_REVIEW_EMAIL,
            "checkpoints": checkpoints,
        },
        "manifest_references": [
            "config/workflows/contract-processing.yaml",
            "config/schemas/workflow-package.json",
            _contract_stage_catalog_ref,
        ],
        "policy_references": [
            "data/policies/contract_policies.json",
            "data/policies.json",
            "data/clauses.json",
        ],
        "contract_stage_map": stage_map,
        "agents": bindings,
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_workflow_input(inp: dict[str, Any] | None) -> list[str]:
    errors: list[str] = []
    if not inp:
        return ["Input is required."]
    if not (inp.get("name") or "").strip():
        errors.append("Workflow name is required.")
    agents = inp.get("agents")
    if not agents or not isinstance(agents, list) or len(agents) == 0:
        errors.append("At least one workflow agent is required.")
    if isinstance(agents, list) and len(agents) > 20:
        errors.append("Maximum 20 agents per workflow.")
    if not (inp.get("type") or "").strip():
        errors.append("Workflow type is required.")
    if isinstance(agents, list):
        ids: set[str] = set()
        for a in agents:
            aid = (a.get("id") or "").strip()
            if not aid:
                errors.append("Every workflow agent requires an id.")
            if aid in ids:
                errors.append(f"Duplicate workflow agent id: {aid}")
            ids.add(aid)
            if not (a.get("name") or "").strip():
                errors.append(f"Workflow agent {aid or '<unknown>'} requires a name.")
            if not (a.get("role") or "").strip():
                errors.append(f"Workflow agent {aid or '<unknown>'} requires a role.")
            if not isinstance(a.get("tools"), list):
                errors.append(f"Workflow agent {aid or '<unknown>'} must define a tools array.")
    return errors


# ---------------------------------------------------------------------------
# Init / CRUD
# ---------------------------------------------------------------------------
async def init_workflow_registry() -> None:
    global _active_cache, _init_done
    if _init_done:
        return
    await _workflow_store.load()
    try:
        raw = _active_pkg_path.read_text(encoding="utf-8")
        _active_cache = json.loads(raw)
    except Exception:
        _active_cache = None
    _init_done = True


def _ensure() -> None:
    if not _init_done:
        raise RuntimeError("Workflow registry not initialized. Call init_workflow_registry() first.")


def list_workflows() -> list[dict[str, Any]]:
    _ensure()
    active_id = _active_cache.get("workflow_id") if _active_cache else None
    return [
        {**wf, "active": wf.get("id") == active_id}
        for wf in _workflow_store.get_all()
    ]


def get_workflow_by_id(wf_id: str) -> dict[str, Any] | None:
    _ensure()
    wf = _workflow_store.get_by_id(wf_id)
    if not wf:
        return None
    active_id = _active_cache.get("workflow_id") if _active_cache else None
    return {**wf, "active": wf.get("id") == active_id}


def get_active_workflow() -> dict[str, Any] | None:
    _ensure()
    if not _active_cache:
        return None
    return get_workflow_by_id(_active_cache["workflow_id"])


def get_active_workflow_package() -> dict[str, Any] | None:
    _ensure()
    return copy.deepcopy(_active_cache) if _active_cache else None


async def save_workflow_definition(inp: dict[str, Any]) -> dict[str, Any]:
    _ensure()
    errors = validate_workflow_input(inp)
    if errors:
        raise ValueError(" ".join(errors))

    now = __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime())
    existing = _workflow_store.get_by_id(inp["id"]) if inp.get("id") else None

    if existing:
        updated = await _workflow_store.update(existing["id"], {
            "name": inp["name"],
            "type": inp["type"],
            "agents": inp["agents"],
            "updatedAt": now,
        })
        if not updated:
            raise ValueError(f"Unable to update workflow {existing['id']}")
        return get_workflow_by_id(updated["id"]) or updated

    created = {
        "id": inp.get("id") or f"wf-{str(uuid.uuid4())[:8]}",
        "name": inp["name"],
        "type": inp["type"],
        "agents": inp["agents"],
        "active": False,
        "createdAt": now,
        "updatedAt": now,
    }
    await _workflow_store.add(created)
    return created


async def activate_workflow_definition(wf_id: str) -> dict[str, Any]:
    global _active_cache
    _ensure()
    wf = _workflow_store.get_by_id(wf_id)
    if not wf:
        raise ValueError("Workflow not found")

    pkg = build_workflow_package(wf)

    # Toggle active flags
    for w in _workflow_store.get_all():
        should_be = w["id"] == wf_id
        if w.get("active") != should_be:
            await _workflow_store.update(w["id"], {"active": should_be})

    # Persist
    _packages_dir.mkdir(parents=True, exist_ok=True)
    (_packages_dir / f"{pkg['id']}.json").write_text(
        json.dumps(pkg, indent=2, default=str), encoding="utf-8",
    )
    _runtime_dir.mkdir(parents=True, exist_ok=True)
    _active_pkg_path.write_text(
        json.dumps(pkg, indent=2, default=str), encoding="utf-8",
    )
    _active_cache = pkg

    active_wf = get_workflow_by_id(wf_id)
    if not active_wf:
        raise ValueError(f"Workflow {wf_id} became unavailable after activation")
    return {"workflow": active_wf, "workflow_package": pkg}


async def delete_workflow_definition(wf_id: str) -> bool:
    global _active_cache
    _ensure()
    removed = await _workflow_store.remove(wf_id)
    if not removed:
        return False
    if _active_cache and _active_cache.get("workflow_id") == wf_id:
        _active_cache = None
        try:
            _active_pkg_path.unlink()
        except Exception:
            pass
    return True
