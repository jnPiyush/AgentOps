"""In-process pipeline orchestrator.

In **simulated** mode the local Microsoft Agent Framework is used with
pre-recorded JSON responses (same as before).

In **live** mode the pipeline calls the real Foundry Agent Service via the
Assistants threads/runs API.  The agents must have been deployed first via
the Deploy tab (scripts/deploy/foundry_deploy.py).
"""

from __future__ import annotations

import asyncio
import json as _json
import logging
import sys
import time
import types
import importlib.util
import uuid
from pathlib import Path
from typing import Any

import httpx

from . import config
from .stores import (
    audit_store,
    contract_store,
    hydrate_contract_text,
    save_contract_text,
    store_traces,
)
from .websocket_manager import broadcast

log = logging.getLogger("pipeline")

# ---------------------------------------------------------------------------
# Bootstrap Microsoft Agent Framework
# ---------------------------------------------------------------------------
_fw_dir = config.ROOT_DIR / "agents" / "microsoft-framework"


def _bootstrap_framework() -> None:
    """Register the agent framework package so AgentFactory is importable."""
    if "_fw" in sys.modules:
        return

    _fw_pkg = types.ModuleType("_fw")
    _fw_pkg.__path__ = [str(_fw_dir)]
    _fw_pkg.__package__ = "_fw"
    sys.modules["_fw"] = _fw_pkg

    for mod_name in ("config", "agents", "workflows"):
        mod_file = _fw_dir / f"{mod_name}.py"
        if mod_file.exists():
            spec = importlib.util.spec_from_file_location(f"_fw.{mod_name}", str(mod_file))
            mod = importlib.util.module_from_spec(spec)
            mod.__package__ = "_fw"
            sys.modules[f"_fw.{mod_name}"] = mod
            setattr(_fw_pkg, mod_name, mod)

    sys.modules["_fw.config"].__spec__.loader.exec_module(sys.modules["_fw.config"])
    sys.modules["_fw.agents"].__spec__.loader.exec_module(sys.modules["_fw.agents"])


_bootstrap_framework()

from _fw.agents import AgentFactory, DeclarativeContractAgent  # noqa: E402

# ---------------------------------------------------------------------------
# Simulated data helpers
# ---------------------------------------------------------------------------
SIMULATED_DIR = config.DATA_DIR / "simulated"


def _load_simulated_response(stage: str, contract_text: str) -> dict[str, Any]:
    lower = contract_text.lower()
    if "non-disclosure" in lower or "nda" in lower:
        key = "nda-001"
    elif "master service" in lower or "msa" in lower:
        key = "msa-001"
    elif "statement of work" in lower or "sow" in lower or "cloud migration" in lower:
        key = "sow-001"
    elif "amendment" in lower or "data processing" in lower:
        key = "amendment-001"
    elif "service level" in lower or "sla" in lower or "uptime" in lower:
        key = "sla-001"
    else:
        key = "nda-001"

    path = SIMULATED_DIR / stage / f"{key}.json"
    if path.exists():
        import json
        return json.loads(path.read_text(encoding="utf-8"))
    return {"status": "simulated", "message": f"No data for {stage}/{key}"}


# ---------------------------------------------------------------------------
# Audit helper
# ---------------------------------------------------------------------------
async def _log_audit(
    contract_id: str,
    agent: str,
    action: str,
    description: str,
) -> None:
    await audit_store.add({
        "id": str(uuid.uuid4()),
        "contract_id": contract_id,
        "agent": agent,
        "action": action,
        "reasoning": description,
        "timestamp": _iso_now(),
    })


def _iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _short_id() -> str:
    return str(uuid.uuid4())[:8]


# ---------------------------------------------------------------------------
# Foundry Agent Service support (live mode)
# ---------------------------------------------------------------------------

AGENT_API_VERSION = "2025-05-15-preview"

# Cached per-process: role_key -> asst_id
_foundry_agent_map: dict[str, str] = {}
_foundry_token: str | None = None


def _get_foundry_token() -> str | None:
    """Get Azure AD Bearer token for the Agent Service endpoint."""
    global _foundry_token
    if _foundry_token is not None:
        return _foundry_token

    env_tok = config._env("FOUNDRY_BEARER_TOKEN", "")
    if env_tok:
        _foundry_token = env_tok
        return _foundry_token

    scope = "https://ai.azure.com/.default"
    try:
        from azure.identity import AzureCliCredential
        _foundry_token = AzureCliCredential().get_token(scope).token
        log.info("Obtained Azure AD token via Azure CLI")
        return _foundry_token
    except Exception:
        pass

    try:
        from azure.identity import DefaultAzureCredential
        _foundry_token = DefaultAzureCredential().get_token(scope).token
        log.info("Obtained Azure AD token via DefaultAzureCredential")
        return _foundry_token
    except Exception as exc:
        log.warning("Failed to obtain Azure AD token: %s", exc)
        return None


def _foundry_headers() -> dict[str, str]:
    """Auth headers for the Foundry Agent Service endpoint."""
    token = _get_foundry_token()
    if token:
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    return {"api-key": config.FOUNDRY_API_KEY, "Content-Type": "application/json"}


async def _ensure_foundry_agents(client: httpx.AsyncClient) -> dict[str, str]:
    """Look up deployed contract-management agents from Foundry.

    Results are cached in ``_foundry_agent_map`` for the gateway lifetime.
    """
    global _foundry_agent_map
    if _foundry_agent_map:
        return _foundry_agent_map

    ep = (config.FOUNDRY_PROJECT_ENDPOINT or config.FOUNDRY_ENDPOINT).rstrip("/")
    headers = _foundry_headers()

    res = await client.get(
        f"{ep}/assistants?api-version={AGENT_API_VERSION}&limit=100",
        headers=headers,
        timeout=30,
    )
    if res.status_code != 200:
        log.error("Failed to list Foundry agents: %d %s", res.status_code, res.text[:200])
        return _foundry_agent_map

    for asst in res.json().get("data", []):
        meta = (
            (asst.get("versions") or {})
            .get("latest", {})
            .get("definition", {})
            .get("metadata")
        ) or asst.get("metadata") or {}
        if meta.get("domain") == "contract-management":
            role_key = meta.get("pipeline_role")
            if role_key:
                _foundry_agent_map[role_key] = asst["id"]

    log.info("Loaded %d Foundry agent mappings: %s", len(_foundry_agent_map), list(_foundry_agent_map.keys()))
    return _foundry_agent_map


async def _run_foundry_agent(
    client: httpx.AsyncClient,
    stage: str,
    input_data: dict[str, Any],
) -> tuple[dict[str, Any], int]:
    """Call a deployed Foundry agent via threads / runs API."""
    agents = await _ensure_foundry_agents(client)
    asst_id = agents.get(stage)
    if not asst_id:
        raise ValueError(
            f"No deployed Foundry agent for stage '{stage}'. "
            f"Available: {list(agents.keys())}.  Run the Deploy pipeline first."
        )

    ep = (config.FOUNDRY_PROJECT_ENDPOINT or config.FOUNDRY_ENDPOINT).rstrip("/")
    headers = _foundry_headers()
    user_message = _json.dumps(input_data, default=str)

    start = time.time()

    # 1. Create thread
    tres = await client.post(f"{ep}/threads?api-version={AGENT_API_VERSION}", headers=headers, json={}, timeout=30)
    tres.raise_for_status()
    tid = tres.json()["id"]

    try:
        # 2. Add user message
        await client.post(
            f"{ep}/threads/{tid}/messages?api-version={AGENT_API_VERSION}",
            headers=headers,
            json={"role": "user", "content": user_message},
            timeout=30,
        )

        # 3. Create run
        rres = await client.post(
            f"{ep}/threads/{tid}/runs?api-version={AGENT_API_VERSION}",
            headers=headers,
            json={"assistant_id": asst_id},
            timeout=30,
        )
        rres.raise_for_status()
        run = rres.json()
        rid, status = run["id"], run["status"]

        # 4. Poll until terminal state (up to ~60 s)
        for _ in range(30):
            if status in ("completed", "failed", "cancelled", "requires_action", "expired"):
                break
            await asyncio.sleep(2)
            pres = await client.get(
                f"{ep}/threads/{tid}/runs/{rid}?api-version={AGENT_API_VERSION}",
                headers=headers,
                timeout=30,
            )
            if pres.status_code == 200:
                status = pres.json()["status"]

        # 5. Extract response
        result: dict[str, Any] = {}
        if status == "completed":
            mres = await client.get(
                f"{ep}/threads/{tid}/messages?api-version={AGENT_API_VERSION}&limit=10&order=desc",
                headers=headers,
                timeout=30,
            )
            if mres.status_code == 200:
                for msg in mres.json().get("data", []):
                    if msg.get("role") == "assistant":
                        for part in msg.get("content", []):
                            if part.get("type") == "text":
                                text = part["text"].get("value", "")
                                # Strip markdown code fences if present
                                stripped = text.strip()
                                if stripped.startswith("```"):
                                    # Remove opening fence (```json or ```)
                                    first_nl = stripped.find("\n")
                                    if first_nl != -1:
                                        stripped = stripped[first_nl + 1:]
                                    if stripped.endswith("```"):
                                        stripped = stripped[:-3].strip()
                                try:
                                    result = _json.loads(stripped)
                                except _json.JSONDecodeError:
                                    result = {"response": text}
                        break
        elif status == "requires_action":
            # Agent tried to call a function tool -- treat as partial success
            log.info("Foundry agent '%s' requires_action (tool call) -- using partial result", stage)
            result = {"status": "requires_action", "note": "Agent attempted tool calls"}
        else:
            log.warning("Foundry agent '%s' run ended with status: %s", stage, status)
            result = {"status": status}

    finally:
        # Cleanup thread
        try:
            await client.delete(f"{ep}/threads/{tid}?api-version={AGENT_API_VERSION}", headers=headers, timeout=10)
        except Exception:
            pass

    latency_ms = int((time.time() - start) * 1000)
    return result, latency_ms


# ---------------------------------------------------------------------------
# Framework agent runner (simulated mode)
# ---------------------------------------------------------------------------
import random  # noqa: E402


async def _run_agent(
    stage: str,
    input_data: dict[str, Any],
    contract_text: str,
    mode: str,
    foundry_client: httpx.AsyncClient | None = None,
) -> tuple[dict[str, Any], int]:
    if mode == "live" and foundry_client is not None:
        return await _run_foundry_agent(foundry_client, stage, input_data)

    # Simulated mode: local framework with pre-recorded responses
    agent: DeclarativeContractAgent = AgentFactory.create_agent(stage)
    simulated = _load_simulated_response(stage, contract_text)
    agent.agent.set_simulated_response(simulated)
    await asyncio.sleep(0.3 + random.random() * 0.5)

    start = time.time()
    result = await agent.execute(input_data)
    latency_ms = int((time.time() - start) * 1000)
    return result, latency_ms


# ---------------------------------------------------------------------------
# Pipeline runner
# ---------------------------------------------------------------------------
async def run_pipeline(
    contract_text: str,
    filename: str,
    contract_id: str | None = None,
) -> dict[str, Any]:
    """Run the full 10-stage pipeline in-process.

    Returns the final contract dict.  All WebSocket events and audit entries
    are emitted inline.
    """
    cid = contract_id or f"contract-{_short_id()}"
    trace_id = f"trace-{_short_id()}"
    mode = config.DEMO_MODE
    traces: list[dict[str, Any]] = []

    await save_contract_text(cid, contract_text)

    contract: dict[str, Any] = {
        "id": cid,
        "filename": filename,
        "status": "processing",
        "submitted_at": _iso_now(),
    }
    await contract_store.add(contract)

    await broadcast({
        "event": "pipeline_status",
        "contract_id": cid,
        "status": "processing_started",
        "timestamp": _iso_now(),
    })

    def add_trace(agent: str, tool: str, inp: dict, out: dict, lat: int) -> None:
        traces.append({
            "contract_id": cid,
            "agent": agent,
            "tool": tool,
            "input": inp,
            "output": out,
            "latency_ms": lat,
            "timestamp": _iso_now(),
        })

    # Shared async HTTP client for Foundry calls in live mode
    fc: httpx.AsyncClient | None = None
    if mode == "live":
        fc = httpx.AsyncClient()

    try:
        parsed, lat = await _run_agent("intake", {
            "contract_text": contract_text,
            "contract_id": cid,
            "action": "classify_and_extract_metadata",
        }, contract_text, mode, fc)

        intake = {
            "contractId": cid,
            "type": parsed.get("contract_type", parsed.get("type", "UNKNOWN")),
            "confidence": parsed.get("confidence_score", parsed.get("confidence", 0.0)),
            "parties": parsed.get("parties", []),
            "metadata": {k: parsed.get(k) for k in [
                "title", "contract_category", "source_channel", "industry",
                "counterparty_type", "risk_level", "compliance_needs",
                "effective_date", "expiry_date", "value", "currency", "jurisdiction",
            ] if parsed.get(k) is not None},
            "traceId": trace_id,
        }
        add_trace("intake", "classify_document", {"text": contract_text[:200]}, intake, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "intake",
                         "status": "intake_complete", "result": intake, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "intake", "classified",
                         f"Classified as {intake['type']} (confidence {intake['confidence']})")
        await contract_store.update(cid, {
            "type": intake["type"],
            "classification_confidence": intake["confidence"],
        })

        # ---- Stage 2: Extraction ----
        parsed, lat = await _run_agent("extraction", {
            "contract_text": contract_text, "contract_id": cid,
            "action": "extract_clauses_and_values",
        }, contract_text, mode, fc)

        extraction = {
            "contractId": cid,
            "clauses": parsed.get("clauses", []),
            "parties": parsed.get("parties", []),
            "dates": parsed.get("dates", []),
            "values": parsed.get("values", []),
            "traceId": trace_id,
        }
        add_trace("extraction", "extract_clauses", {"text": contract_text[:200]}, extraction, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "extraction",
                         "status": "extraction_complete", "result": extraction, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "extraction", "extracted",
                         f"Extracted {len(extraction['clauses'])} clauses")

        clauses = extraction["clauses"]

        # ---- Stage 3: Review ----
        parsed, lat = await _run_agent("review", {
            "clauses": clauses, "contract_id": cid, "action": "review_clauses",
        }, contract_text, mode, fc)

        review = {
            "contractId": cid,
            "reviewSummary": parsed.get("review_summary", "Review completed"),
            "materialChanges": parsed.get("material_changes", []),
            "unresolvedItems": parsed.get("unresolved_items", []),
            "confidence": parsed.get("confidence_score", 0.7),
            "traceId": trace_id,
        }
        add_trace("review", "internal_review", {"clauses_count": len(clauses)}, review, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "review",
                         "status": "review_complete", "result": review, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "review", "reviewed",
                         f"Review: {len(review['materialChanges'])} material changes")

        # ---- Stage 4: Compliance ----
        parsed, lat = await _run_agent("compliance", {
            "clauses": clauses, "contract_id": cid, "action": "check_compliance",
        }, contract_text, mode, fc)

        raw_risk = parsed.get("overall_risk", parsed.get("risk_level", "medium"))
        overall_risk = str(raw_risk).lower() if raw_risk else "medium"
        if overall_risk not in ("low", "medium", "high"):
            overall_risk = "medium"

        clause_results = parsed.get("clause_results", [])
        if not clause_results:
            violations = parsed.get("policy_violations", [])
            clause_results = [
                {"clause_type": "policy", "status": "fail", "policy_ref": "policy-unknown", "reason": v}
                for v in violations
            ]
        flags_count = parsed.get("flags_count", sum(1 for r in clause_results if r.get("status") in ("fail", "warn")))

        compliance = {
            "contractId": cid,
            "clauseResults": clause_results,
            "overallRisk": overall_risk,
            "flagsCount": flags_count,
            "policyReferences": parsed.get("policy_references", []),
            "traceId": trace_id,
        }
        add_trace("compliance", "check_policy", {"clauses_count": len(clauses)}, compliance, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "compliance",
                         "status": "compliance_complete", "result": compliance, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "compliance", "flagged",
                         f"Risk: {overall_risk}, Flags: {flags_count}")

        # ---- Stage 5: Negotiation ----
        parsed, lat = await _run_agent("negotiation", {
            "clauses": clauses, "risk_level": overall_risk, "flags_count": flags_count,
            "contract_id": cid, "action": "assess_negotiation",
        }, contract_text, mode, fc)

        negotiation = {
            "contractId": cid,
            "counterpartyPositions": parsed.get("counterparty_positions", []),
            "fallbackRecommendations": parsed.get("fallback_recommendations", []),
            "escalationRequired": parsed.get("escalation_required", False),
            "confidence": parsed.get("confidence_score", 0.7),
            "traceId": trace_id,
        }
        add_trace("negotiation", "assess_negotiation",
                  {"risk": overall_risk, "flags": flags_count, "clauses_count": len(clauses)}, negotiation, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "negotiation",
                         "status": "negotiation_complete", "result": negotiation, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "negotiation", "negotiated",
                         f"{len(negotiation['counterpartyPositions'])} positions, escalation={negotiation['escalationRequired']}")

        # ---- Stage 6: Approval ----
        parsed, lat = await _run_agent("approval", {
            "risk_level": overall_risk, "flags_count": flags_count,
            "contract_id": cid, "action": "determine_approval",
        }, contract_text, mode, fc)

        raw_action = parsed.get("action")
        raw_decision = str(parsed.get("decision", "")).upper()
        if raw_action in ("auto_approve", "escalate_to_human"):
            action = raw_action
        elif raw_decision == "APPROVE":
            action = "auto_approve"
        elif raw_decision in ("REJECT", "CONDITIONAL"):
            action = "escalate_to_human"
        elif parsed.get("escalation_required") is False:
            action = "auto_approve"
        else:
            action = "escalate_to_human"

        approval = {
            "contractId": cid,
            "action": action,
            "reasoning": parsed.get("reasoning", ""),
            "assignedTo": parsed.get("assigned_to"),
            "traceId": trace_id,
        }
        final_status = "approved" if action == "auto_approve" else "awaiting_review"
        add_trace("approval", "route_approval", {"risk": overall_risk, "flags": flags_count}, approval, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "approval",
                         "status": final_status, "result": approval, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "approval",
                         "approved" if action == "auto_approve" else "escalated",
                         approval.get("reasoning", ""))
        await contract_store.update(cid, {
            "status": final_status,
            "completed_at": _iso_now() if final_status == "approved" else None,
        })

        # ---- Stage 7: Signature ----
        parsed, lat = await _run_agent("signature", {
            "approval_action": action, "contract_id": cid, "action": "track_signatures",
        }, contract_text, mode, fc)

        signature = {
            "contractId": cid,
            "signatureStatus": parsed.get("signature_status", "pending"),
            "pendingSigners": parsed.get("pending_signers", []),
            "completedSigners": parsed.get("completed_signers", []),
            "nextAction": parsed.get("next_action", ""),
            "executionDate": parsed.get("execution_date"),
            "confidence": parsed.get("confidence_score", 0.8),
            "traceId": trace_id,
        }
        add_trace("signature", "track_signatures", {"approval_action": action}, signature, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "signature",
                         "status": "signature_complete", "result": signature, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "signature", "signed",
                         f"Signature: {signature['signatureStatus']}, pending: {len(signature['pendingSigners'])}")
        sig_status = signature["signatureStatus"]

        # ---- Stage 8: Obligations ----
        parsed, lat = await _run_agent("obligations", {
            "signature_status": sig_status, "contract_text": contract_text[:2000],
            "contract_id": cid, "action": "extract_obligations",
        }, contract_text, mode, fc)

        obligations = {
            "contractId": cid,
            "obligations": parsed.get("obligations", []),
            "ownerAssignments": parsed.get("owner_assignments", []),
            "totalObligations": parsed.get("total_obligations", len(parsed.get("obligations", []))),
            "followUpWindowDays": parsed.get("follow_up_window_days", 30),
            "confidence": parsed.get("confidence_score", 0.8),
            "traceId": trace_id,
        }
        add_trace("obligations", "extract_obligations", {"signature_status": sig_status}, obligations, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "obligations",
                         "status": "obligations_complete", "result": obligations, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "obligations", "tracked",
                         f"{obligations['totalObligations']} obligations extracted")
        total_obligations = obligations["totalObligations"]

        # ---- Stage 9: Renewal ----
        parsed, lat = await _run_agent("renewal", {
            "total_obligations": total_obligations, "contract_text": contract_text[:2000],
            "contract_id": cid, "action": "check_renewal",
        }, contract_text, mode, fc)

        renewal = {
            "contractId": cid,
            "renewalWindowDays": parsed.get("renewal_window_days", 90),
            "riskLevel": parsed.get("risk_level", "low"),
            "contractsDue": parsed.get("contracts_due", 1),
            "recommendedActions": parsed.get("recommended_actions", []),
            "expiryDate": parsed.get("expiry_date"),
            "autoRenewal": parsed.get("auto_renewal", False),
            "confidence": parsed.get("confidence_score", 0.8),
            "traceId": trace_id,
        }
        add_trace("renewal", "check_renewal", {"total_obligations": total_obligations}, renewal, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "renewal",
                         "status": "renewal_complete", "result": renewal, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "renewal", "renewal_checked",
                         f"Renewal risk: {renewal['riskLevel']}, window: {renewal['renewalWindowDays']} days")

        # ---- Stage 10: Analytics ----
        parsed, lat = await _run_agent("analytics", {
            "risk_level": overall_risk, "total_obligations": total_obligations,
            "contract_id": cid, "action": "lifecycle_analytics",
        }, contract_text, mode, fc)

        analytics = {
            "contractId": cid,
            "portfolioSummary": parsed.get("portfolio_summary", ""),
            "keyMetrics": parsed.get("key_metrics", []),
            "totalContractsAnalyzed": parsed.get("total_contracts_analyzed", 1),
            "recommendedActions": parsed.get("recommended_actions", []),
            "confidence": parsed.get("confidence_score", 0.8),
            "traceId": trace_id,
        }
        add_trace("analytics", "lifecycle_analytics",
                  {"risk_level": overall_risk, "total_obligations": total_obligations}, analytics, lat)
        await broadcast({"event": "agent_step_complete", "contract_id": cid, "agent": "analytics",
                         "status": "analytics_complete", "result": analytics, "latency_ms": lat, "timestamp": _iso_now()})
        await _log_audit(cid, "analytics", "analyzed",
                         f"{len(analytics['keyMetrics'])} metrics, {len(analytics['recommendedActions'])} recommendations")

        # ---- Pipeline complete ----
        await broadcast({
            "event": "pipeline_status",
            "contract_id": cid,
            "status": "pipeline_complete" if final_status == "approved" else "awaiting_human_review",
            "final_status": final_status,
            "timestamp": _iso_now(),
        })

        # Store traces
        full_traces = [
            {
                "id": str(uuid.uuid4()),
                "contract_id": t["contract_id"],
                "agent": t["agent"],
                "tool": t["tool"],
                "input": t["input"],
                "output": t["output"],
                "latency_ms": t["latency_ms"],
                "tokens_in": t.get("tokens_in", 0),
                "tokens_out": t.get("tokens_out", 0),
                "timestamp": t["timestamp"],
            }
            for t in traces
        ]
        store_traces(cid, full_traces)

        updated = await hydrate_contract_text(contract_store.get_by_id(cid))
        return updated or {**contract, "text": contract_text}

    except Exception as exc:
        log.exception("Pipeline failed for %s", cid)
        await contract_store.update(cid, {
            "status": "failed",
            "error_message": str(exc),
            "completed_at": _iso_now(),
        })
        await _log_audit(cid, "pipeline", "error", f"Pipeline failed: {exc}")
        await broadcast({
            "event": "pipeline_status",
            "contract_id": cid,
            "status": "pipeline_failed",
            "timestamp": _iso_now(),
        })
        raise
    finally:
        if fc is not None:
            await fc.aclose()
