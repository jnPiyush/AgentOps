"""Contract pipeline runner using Microsoft Agent Framework.

This script replaces the TypeScript agent runners at runtime.
The Node.js gateway spawns this process, streams NDJSON lines
from stdout (one per stage), and broadcasts WebSocket events to
the UI.

Usage:
    echo "<contract text>" | python scripts/live/pipeline_runner.py \
        --contract-id cid --trace-id tid --mode simulated --json

Each completed stage emits a JSON line to stdout:
    {"event":"stage_complete","agent":"intake","result":{...},...}

The final line is:
    {"event":"pipeline_complete","traces":[...],"final_status":"..."}

All logging goes to stderr so it never mixes with JSON output.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT / "data"
SIMULATED_DIR = DATA_DIR / "simulated"

# Ensure the microsoft-framework package is importable
# The directory has a hyphen so standard import won't work. We register
# it as a virtual package "_fw" in sys.modules so that relative imports
# inside agents.py (from .config import ...) resolve correctly.
import types
import importlib.util

_fw_dir = ROOT / "agents" / "microsoft-framework"

_fw_pkg = types.ModuleType("_fw")
_fw_pkg.__path__ = [str(_fw_dir)]
_fw_pkg.__package__ = "_fw"
sys.modules["_fw"] = _fw_pkg

# Pre-register submodules (must load config before agents — dependency order)
for _mod_name in ("config", "agents", "workflows"):
    _mod_file = _fw_dir / f"{_mod_name}.py"
    if _mod_file.exists():
        _spec = importlib.util.spec_from_file_location(f"_fw.{_mod_name}", str(_mod_file))
        _mod = importlib.util.module_from_spec(_spec)
        _mod.__package__ = "_fw"
        sys.modules[f"_fw.{_mod_name}"] = _mod
        setattr(_fw_pkg, _mod_name, _mod)

# Execute in dependency order: config first, then agents
sys.modules["_fw.config"].__spec__.loader.exec_module(sys.modules["_fw.config"])
sys.modules["_fw.agents"].__spec__.loader.exec_module(sys.modules["_fw.agents"])

# ---------------------------------------------------------------------------
# Microsoft Agent Framework imports
# ---------------------------------------------------------------------------
from _fw.agents import AgentFactory, DeclarativeContractAgent  # noqa: E402

# ---------------------------------------------------------------------------
# Logging (stderr only - stdout is reserved for JSON)
# ---------------------------------------------------------------------------
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pipeline_runner")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def emit(data: dict[str, Any]) -> None:
    """Print a single JSON line to stdout and flush immediately."""
    sys.stdout.write(json.dumps(data, default=str) + "\n")
    sys.stdout.flush()


def load_simulated_response(stage: str, contract_text: str) -> dict[str, Any]:
    """Load a pre-recorded JSON response from data/simulated/<stage>/."""
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
        return json.loads(path.read_text(encoding="utf-8"))

    return {"status": "simulated", "message": f"No data for {stage}/{key}"}


# ---------------------------------------------------------------------------
# Pipeline Runner (Microsoft Agent Framework)
# ---------------------------------------------------------------------------
class PipelineRunner:
    """Runs the 10-stage contract pipeline using Microsoft Agent Framework."""

    STAGES = [
        "intake", "extraction", "review", "compliance", "negotiation",
        "approval", "signature", "obligations", "renewal", "analytics",
    ]

    def __init__(
        self,
        contract_text: str,
        contract_id: str,
        trace_id: str,
        mode: str,
    ) -> None:
        self.contract_text = contract_text
        self.contract_id = contract_id
        self.trace_id = trace_id
        self.mode = mode  # "simulated" or "live"
        self.traces: list[dict[str, Any]] = []

    # -- Create and execute a framework agent ------------------------------
    async def _run_framework_agent(
        self,
        stage: str,
        input_data: dict[str, Any],
    ) -> tuple[dict[str, Any], int]:
        """Create a framework agent, optionally inject simulated data, and execute."""
        import random

        agent: DeclarativeContractAgent = AgentFactory.create_agent(stage)

        if self.mode == "simulated":
            # Inject pre-recorded response into the framework agent
            simulated = load_simulated_response(stage, self.contract_text)
            agent.agent.set_simulated_response(simulated)
            # Simulate realistic latency
            time.sleep(0.3 + random.random() * 0.5)

        start = time.time()
        result = await agent.execute(input_data)
        latency_ms = int((time.time() - start) * 1000)

        return result, latency_ms

    def _add_trace(
        self,
        agent: str,
        tool: str,
        input_summary: dict[str, Any],
        output: dict[str, Any],
        latency_ms: int,
    ) -> None:
        self.traces.append({
            "contract_id": self.contract_id,
            "agent": agent,
            "tool": tool,
            "input": input_summary,
            "output": output,
            "latency_ms": latency_ms,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })

    # -- Stage 1: Intake ---------------------------------------------------
    async def stage_intake(self) -> dict[str, Any]:
        input_data = {
            "contract_text": self.contract_text,
            "contract_id": self.contract_id,
            "action": "classify_and_extract_metadata",
        }
        parsed, lat = await self._run_framework_agent("intake", input_data)

        result = {
            "contractId": self.contract_id,
            "type": parsed.get("contract_type", parsed.get("type", "UNKNOWN")),
            "confidence": parsed.get("confidence_score", parsed.get("confidence", 0.0)),
            "parties": parsed.get("parties", []),
            "metadata": {
                k: parsed.get(k)
                for k in [
                    "title", "contract_category", "source_channel",
                    "industry", "counterparty_type", "risk_level",
                    "compliance_needs", "effective_date", "expiry_date",
                    "value", "currency", "jurisdiction",
                ]
                if parsed.get(k) is not None
            },
            "traceId": self.trace_id,
        }

        self._add_trace("intake", "classify_document", {"text": self.contract_text[:200]}, result, lat)

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "intake",
            "status": "intake_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 2: Extraction -----------------------------------------------
    async def stage_extraction(self) -> dict[str, Any]:
        input_data = {
            "contract_text": self.contract_text,
            "contract_id": self.contract_id,
            "action": "extract_clauses_and_values",
        }
        parsed, lat = await self._run_framework_agent("extraction", input_data)

        result = {
            "contractId": self.contract_id,
            "clauses": parsed.get("clauses", []),
            "parties": parsed.get("parties", []),
            "dates": parsed.get("dates", []),
            "values": parsed.get("values", []),
            "traceId": self.trace_id,
        }

        self._add_trace("extraction", "extract_clauses", {"text": self.contract_text[:200]}, result, lat)

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "extraction",
            "status": "extraction_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 3: Review ---------------------------------------------------
    async def stage_review(self, clauses: list[dict[str, Any]]) -> dict[str, Any]:
        input_data = {
            "clauses": clauses,
            "contract_id": self.contract_id,
            "action": "review_clauses",
        }
        parsed, lat = await self._run_framework_agent("review", input_data)

        result = {
            "contractId": self.contract_id,
            "reviewSummary": parsed.get("review_summary", "Review completed"),
            "materialChanges": parsed.get("material_changes", []),
            "unresolvedItems": parsed.get("unresolved_items", []),
            "confidence": parsed.get("confidence_score", 0.7),
            "traceId": self.trace_id,
        }

        self._add_trace("review", "internal_review", {"clauses_count": len(clauses)}, result, lat)

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "review",
            "status": "review_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 4: Compliance -----------------------------------------------
    async def stage_compliance(self, clauses: list[dict[str, Any]]) -> dict[str, Any]:
        input_data = {
            "clauses": clauses,
            "contract_id": self.contract_id,
            "action": "check_compliance",
        }
        parsed, lat = await self._run_framework_agent("compliance", input_data)

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

        result = {
            "contractId": self.contract_id,
            "clauseResults": clause_results,
            "overallRisk": overall_risk,
            "flagsCount": flags_count,
            "policyReferences": parsed.get("policy_references", []),
            "traceId": self.trace_id,
        }

        self._add_trace("compliance", "check_policy", {"clauses_count": len(clauses)}, result, lat)

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "compliance",
            "status": "compliance_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 5: Negotiation ----------------------------------------------
    async def stage_negotiation(
        self,
        clauses: list[dict[str, Any]],
        risk_level: str,
        flags_count: int,
    ) -> dict[str, Any]:
        input_data = {
            "clauses": clauses,
            "risk_level": risk_level,
            "flags_count": flags_count,
            "contract_id": self.contract_id,
            "action": "assess_negotiation",
        }
        parsed, lat = await self._run_framework_agent("negotiation", input_data)

        result = {
            "contractId": self.contract_id,
            "counterpartyPositions": parsed.get("counterparty_positions", []),
            "fallbackRecommendations": parsed.get("fallback_recommendations", []),
            "escalationRequired": parsed.get("escalation_required", False),
            "confidence": parsed.get("confidence_score", 0.7),
            "traceId": self.trace_id,
        }

        self._add_trace(
            "negotiation", "assess_negotiation",
            {"risk": risk_level, "flags": flags_count, "clauses_count": len(clauses)},
            result, lat,
        )

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "negotiation",
            "status": "negotiation_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 6: Approval -------------------------------------------------
    async def stage_approval(self, risk_level: str, flags_count: int) -> dict[str, Any]:
        input_data = {
            "risk_level": risk_level,
            "flags_count": flags_count,
            "contract_id": self.contract_id,
            "action": "determine_approval",
        }
        parsed, lat = await self._run_framework_agent("approval", input_data)

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

        result = {
            "contractId": self.contract_id,
            "action": action,
            "reasoning": parsed.get("reasoning", ""),
            "assignedTo": parsed.get("assigned_to"),
            "traceId": self.trace_id,
        }

        self._add_trace(
            "approval", "route_approval",
            {"risk": risk_level, "flags": flags_count},
            result, lat,
        )

        final_status = "approved" if action == "auto_approve" else "awaiting_human_review"

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "approval",
            "status": final_status,
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 7: Signature ------------------------------------------------
    async def stage_signature(self, approval_action: str) -> dict[str, Any]:
        input_data = {
            "approval_action": approval_action,
            "contract_id": self.contract_id,
            "action": "track_signatures",
        }
        parsed, lat = await self._run_framework_agent("signature", input_data)

        result = {
            "contractId": self.contract_id,
            "signatureStatus": parsed.get("signature_status", "pending"),
            "pendingSigners": parsed.get("pending_signers", []),
            "completedSigners": parsed.get("completed_signers", []),
            "nextAction": parsed.get("next_action", ""),
            "executionDate": parsed.get("execution_date"),
            "confidence": parsed.get("confidence_score", 0.8),
            "traceId": self.trace_id,
        }

        self._add_trace(
            "signature", "track_signatures",
            {"approval_action": approval_action},
            result, lat,
        )

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "signature",
            "status": "signature_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 8: Obligations ----------------------------------------------
    async def stage_obligations(self, signature_status: str) -> dict[str, Any]:
        input_data = {
            "signature_status": signature_status,
            "contract_text": self.contract_text[:2000],
            "contract_id": self.contract_id,
            "action": "extract_obligations",
        }
        parsed, lat = await self._run_framework_agent("obligations", input_data)

        result = {
            "contractId": self.contract_id,
            "obligations": parsed.get("obligations", []),
            "ownerAssignments": parsed.get("owner_assignments", []),
            "totalObligations": parsed.get("total_obligations", len(parsed.get("obligations", []))),
            "followUpWindowDays": parsed.get("follow_up_window_days", 30),
            "confidence": parsed.get("confidence_score", 0.8),
            "traceId": self.trace_id,
        }

        self._add_trace(
            "obligations", "extract_obligations",
            {"signature_status": signature_status},
            result, lat,
        )

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "obligations",
            "status": "obligations_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 9: Renewal --------------------------------------------------
    async def stage_renewal(self, total_obligations: int) -> dict[str, Any]:
        input_data = {
            "total_obligations": total_obligations,
            "contract_text": self.contract_text[:2000],
            "contract_id": self.contract_id,
            "action": "check_renewal",
        }
        parsed, lat = await self._run_framework_agent("renewal", input_data)

        result = {
            "contractId": self.contract_id,
            "renewalWindowDays": parsed.get("renewal_window_days", 90),
            "riskLevel": parsed.get("risk_level", "low"),
            "contractsDue": parsed.get("contracts_due", 1),
            "recommendedActions": parsed.get("recommended_actions", []),
            "expiryDate": parsed.get("expiry_date"),
            "autoRenewal": parsed.get("auto_renewal", False),
            "confidence": parsed.get("confidence_score", 0.8),
            "traceId": self.trace_id,
        }

        self._add_trace(
            "renewal", "check_renewal",
            {"total_obligations": total_obligations},
            result, lat,
        )

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "renewal",
            "status": "renewal_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Stage 10: Analytics -----------------------------------------------
    async def stage_analytics(self, risk_level: str, total_obligations: int) -> dict[str, Any]:
        input_data = {
            "risk_level": risk_level,
            "total_obligations": total_obligations,
            "contract_id": self.contract_id,
            "action": "lifecycle_analytics",
        }
        parsed, lat = await self._run_framework_agent("analytics", input_data)

        result = {
            "contractId": self.contract_id,
            "portfolioSummary": parsed.get("portfolio_summary", ""),
            "keyMetrics": parsed.get("key_metrics", []),
            "totalContractsAnalyzed": parsed.get("total_contracts_analyzed", 1),
            "recommendedActions": parsed.get("recommended_actions", []),
            "confidence": parsed.get("confidence_score", 0.8),
            "traceId": self.trace_id,
        }

        self._add_trace(
            "analytics", "lifecycle_analytics",
            {"risk_level": risk_level, "total_obligations": total_obligations},
            result, lat,
        )

        emit({
            "event": "agent_step_complete",
            "contract_id": self.contract_id,
            "agent": "analytics",
            "status": "analytics_complete",
            "result": result,
            "latency_ms": lat,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return result

    # -- Full pipeline -----------------------------------------------------
    async def run(self) -> None:
        """Execute the full 10-stage pipeline, emitting NDJSON lines."""
        emit({
            "event": "pipeline_status",
            "contract_id": self.contract_id,
            "status": "processing_started",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })

        try:
            # Stage 1
            intake = await self.stage_intake()
            log.info("Intake complete: type=%s confidence=%s", intake.get("type"), intake.get("confidence"))

            # Stage 2
            extraction = await self.stage_extraction()
            clauses = extraction.get("clauses", [])
            log.info("Extraction complete: %d clauses", len(clauses))

            # Stage 3
            review = await self.stage_review(clauses)
            log.info(
                "Review complete: %d material changes, %d unresolved",
                len(review.get("materialChanges", [])),
                len(review.get("unresolvedItems", [])),
            )

            # Stage 4
            compliance = await self.stage_compliance(clauses)
            overall_risk = compliance.get("overallRisk", "medium")
            flags_count = compliance.get("flagsCount", 0)
            log.info("Compliance complete: risk=%s flags=%d", overall_risk, flags_count)

            # Stage 5
            negotiation = await self.stage_negotiation(clauses, overall_risk, flags_count)
            log.info(
                "Negotiation complete: %d positions, escalation=%s",
                len(negotiation.get("counterpartyPositions", [])),
                negotiation.get("escalationRequired"),
            )

            # Stage 6
            approval = await self.stage_approval(overall_risk, flags_count)
            approval_action = approval.get("action", "escalate_to_human")
            final_status = "approved" if approval_action == "auto_approve" else "awaiting_review"
            log.info("Approval complete: action=%s", approval_action)

            # Stage 7
            signature = await self.stage_signature(approval_action)
            sig_status = signature.get("signatureStatus", "pending")
            log.info("Signature complete: status=%s", sig_status)

            # Stage 8
            obligations = await self.stage_obligations(sig_status)
            total_obligations = obligations.get("totalObligations", 0)
            log.info("Obligations complete: %d obligations", total_obligations)

            # Stage 9
            renewal = await self.stage_renewal(total_obligations)
            log.info(
                "Renewal complete: window=%d days, risk=%s",
                renewal.get("renewalWindowDays", 0),
                renewal.get("riskLevel"),
            )

            # Stage 10
            analytics = await self.stage_analytics(overall_risk, total_obligations)
            log.info("Analytics complete: %s", analytics.get("portfolioSummary", "")[:80])

            # Final summary line
            emit({
                "event": "pipeline_complete",
                "contract_id": self.contract_id,
                "status": "pipeline_complete" if final_status == "approved" else "awaiting_human_review",
                "final_status": final_status,
                "intake": intake,
                "compliance": compliance,
                "approval": approval,
                "signature": signature,
                "obligations": obligations,
                "renewal": renewal,
                "analytics": analytics,
                "traces": self.traces,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })

        except Exception as exc:
            log.exception("Pipeline failed")
            emit({
                "event": "pipeline_error",
                "contract_id": self.contract_id,
                "status": "pipeline_error",
                "error": str(exc),
                "traces": self.traces,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })
            sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Contract pipeline runner (Microsoft Agent Framework)")
    parser.add_argument("--contract-id", required=True, help="Contract identifier")
    parser.add_argument("--trace-id", default="trace-0000", help="Trace identifier")
    parser.add_argument("--mode", choices=["simulated", "live"], default="simulated")
    args = parser.parse_args()

    # Read contract text from stdin
    contract_text = sys.stdin.read().strip()
    if not contract_text:
        emit({"event": "pipeline_error", "error": "No contract text provided on stdin"})
        sys.exit(1)

    runner = PipelineRunner(
        contract_text=contract_text,
        contract_id=args.contract_id,
        trace_id=args.trace_id,
        mode=args.mode,
    )
    asyncio.run(runner.run())


if __name__ == "__main__":
    main()
