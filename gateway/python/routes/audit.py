"""Audit, traces, and monitor routes."""

from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter

from ..stores import audit_store, contract_store, get_traces

router = APIRouter(prefix="/api/v1")

COST_PER_1K_IN = 0.005
COST_PER_1K_OUT = 0.015


def _round_cost(value: float) -> float:
    return round(value * 10000) / 10000


def _aggregate(tokens_in: int, tokens_out: int, latency_ms: int) -> dict[str, Any]:
    cost = (tokens_in / 1000) * COST_PER_1K_IN + (tokens_out / 1000) * COST_PER_1K_OUT
    return {"tokens_in": tokens_in, "tokens_out": tokens_out, "latency_ms": latency_ms, "cost": _round_cost(cost)}


def _build_stage_telemetry(contract_id: str) -> list[dict[str, Any]]:
    # Lazy import to avoid circular deps at module level
    from ..workflow_registry import get_active_workflow_package

    pkg = get_active_workflow_package()
    if not pkg:
        return []
    stage_map = pkg.get("contract_stage_map", {})
    stages = stage_map.get("stages", [])
    if not stages:
        return []

    traces = get_traces(contract_id)
    audit_entries = audit_store.get_by_field("contract_id", contract_id)

    result = []
    for stage in stages:
        eg_list = stage.get("execution_groups", [])
        eg_out = []
        for group in eg_list:
            role_keys = list({rk.strip().lower() for rk in group.get("runtime_role_keys", [])})
            g_traces = [t for t in traces if t.get("agent", "").strip().lower() in role_keys]
            t_in = sum(t.get("tokens_in", 0) for t in g_traces)
            t_out = sum(t.get("tokens_out", 0) for t in g_traces)
            lat = sum(t.get("latency_ms", 0) for t in g_traces)
            eg_out.append({
                "id": group.get("id"),
                "name": group.get("name"),
                "runtime_agent_ids": group.get("runtime_agent_ids", []),
                "runtime_role_keys": group.get("runtime_role_keys", []),
                "primary_mcp_affinity": group.get("primary_mcp_affinity", []),
                "traces_count": len(g_traces),
                **_aggregate(t_in, t_out, lat),
            })

        stage_rks = list({
            rk.strip().lower()
            for g in eg_out
            for rk in g.get("runtime_role_keys", [])
        })
        s_traces = [t for t in traces if t.get("agent", "").strip().lower() in stage_rks]
        s_audit = [
            {"timestamp": e.get("timestamp"), "agent": e.get("agent"),
             "action": e.get("action"), "reasoning": e.get("reasoning")}
            for e in audit_entries
            if e.get("agent", "").strip().lower() in stage_rks
            or (e.get("agent", "").strip().lower() == "human" and "approval" in stage_rks)
        ]
        t_in = sum(t.get("tokens_in", 0) for t in s_traces)
        t_out = sum(t.get("tokens_out", 0) for t in s_traces)
        lat = sum(t.get("latency_ms", 0) for t in s_traces)

        result.append({
            "id": stage.get("id"),
            "order": stage.get("order"),
            "name": stage.get("name"),
            "summary": stage.get("summary"),
            "primary_mcp_affinity": stage.get("primary_mcp_affinity", []),
            "mvp_shape": stage.get("mvp_shape"),
            "notes": stage.get("notes"),
            "default_execution_group_name": stage.get("default_execution_group_name"),
            "execution_groups": eg_out,
            "audit_trail": s_audit,
            "traces_count": len(s_traces),
            **_aggregate(t_in, t_out, lat),
        })

    return result


@router.get("/audit/{contract_id}")
async def get_audit(contract_id: str) -> list[dict[str, Any]]:
    return audit_store.get_by_field("contract_id", contract_id)


@router.get("/traces/{contract_id}")
async def get_traces_route(contract_id: str) -> list[dict[str, Any]]:
    return get_traces(contract_id)


@router.get("/monitor/{contract_id}")
async def get_monitor(contract_id: str) -> dict[str, Any]:
    from ..workflow_registry import get_active_workflow_package

    traces = get_traces(contract_id)
    audit_entries = audit_store.get_by_field("contract_id", contract_id)
    contract = contract_store.get_by_id(contract_id)
    pkg = get_active_workflow_package()

    agents_list: list[str] = []
    if pkg:
        agents_list = list({
            a.get("runtime_role_key") or a.get("id", "")
            for a in pkg.get("agents", [])
            if a.get("runtime_role_key") or a.get("id")
        })
    if not agents_list:
        agents_list = ["intake", "extraction", "compliance", "approval"]

    agent_costs = []
    for agent in agents_list:
        a_traces = [t for t in traces if t.get("agent") == agent]
        t_in = sum(t.get("tokens_in", 0) for t in a_traces)
        t_out = sum(t.get("tokens_out", 0) for t in a_traces)
        lat = sum(t.get("latency_ms", 0) for t in a_traces)
        agent_costs.append({"agent": agent, **_aggregate(t_in, t_out, lat)})

    total_in = sum(a["tokens_in"] for a in agent_costs)
    total_out = sum(a["tokens_out"] for a in agent_costs)
    total_cost = sum(a["cost"] for a in agent_costs)
    total_lat = sum(a["latency_ms"] for a in agent_costs)

    return {
        "contract_id": contract_id,
        "status": contract.get("status", "unknown") if contract else "unknown",
        "stage_map_reference": pkg.get("contract_stage_map", {}).get("catalog_reference") if pkg else None,
        "contract_stages": _build_stage_telemetry(contract_id),
        "agents": agent_costs,
        "totals": {
            "tokens_in": total_in,
            "tokens_out": total_out,
            "cost": round(total_cost * 10000) / 10000,
            "latency_ms": total_lat,
        },
        "audit_trail": [
            {"timestamp": e.get("timestamp"), "agent": e.get("agent"),
             "action": e.get("action"), "reasoning": e.get("reasoning")}
            for e in audit_entries
        ],
        "traces_count": len(traces),
    }


@router.get("/monitor")
async def list_monitor() -> list[dict[str, Any]]:
    contracts = contract_store.get_all()
    result = []
    for c in contracts:
        traces = get_traces(c["id"])
        t_in = sum(t.get("tokens_in", 0) for t in traces)
        t_out = sum(t.get("tokens_out", 0) for t in traces)
        lat = sum(t.get("latency_ms", 0) for t in traces)
        cost = (t_in / 1000) * COST_PER_1K_IN + (t_out / 1000) * COST_PER_1K_OUT
        result.append({
            "contract_id": c["id"],
            "filename": c.get("filename"),
            "status": c.get("status"),
            "tokens_in": t_in,
            "tokens_out": t_out,
            "latency_ms": lat,
            "cost": round(cost * 10000) / 10000,
            "submitted_at": c.get("submitted_at"),
        })
    return result
