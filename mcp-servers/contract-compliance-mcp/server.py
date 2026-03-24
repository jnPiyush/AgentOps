"""Contract Compliance MCP Server (Python port).

Tools: check_policy, flag_risk, get_policy_rules, add_policy_rule,
       update_policy_rule, delete_policy_rule.

Includes the DynamicPolicyEngine ported from policyEngine.ts.
"""

from __future__ import annotations

import json
import math
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("contract-compliance-mcp")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
POLICY_DIR = DATA_DIR / "policies"
POLICY_FILE = POLICY_DIR / "contract_policies.json"


# ---------------------------------------------------------------------------
# DynamicPolicyEngine
# ---------------------------------------------------------------------------

class DynamicPolicyEngine:
    def __init__(self) -> None:
        self.policies: list[dict[str, Any]] = []
        self._last_loaded: float | None = None
        self._load_policies()

    # -- persistence ---------------------------------------------------------

    def _load_policies(self) -> None:
        try:
            self.policies = json.loads(POLICY_FILE.read_text("utf-8"))
            self._last_loaded = time.time()
        except (FileNotFoundError, json.JSONDecodeError):
            self._initialize_default_policies()

    def _save_policies(self) -> None:
        POLICY_DIR.mkdir(parents=True, exist_ok=True)
        POLICY_FILE.write_text(json.dumps(self.policies, indent=2), "utf-8")

    # -- evaluation ----------------------------------------------------------

    def evaluate_clause(
        self,
        clause_type: str,
        clause_text: str,
        extracted_data: dict[str, Any] | None = None,
        contract_type: str | None = None,
    ) -> list[dict[str, Any]]:
        if self._last_loaded is None or time.time() - self._last_loaded > 300:
            self._load_policies()

        violations: list[dict[str, Any]] = []
        applicable = [
            p for p in self.policies
            if p.get("enabled")
            and clause_type in p.get("clause_types", [])
            and self._is_effective(p)
            and self._applies_to_contract_type(p, contract_type)
        ]
        for policy in applicable:
            v = self._evaluate_policy(policy, clause_type, clause_text, extracted_data)
            if v:
                violations.append(v)
        return violations

    def _evaluate_policy(
        self,
        policy: dict[str, Any],
        clause_type: str,
        clause_text: str,
        extracted_data: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        condition = policy["condition"]
        field = condition["field"]

        extractors: dict[str, Any] = {
            "clause_text": lambda: clause_text,
            "liability_amount": lambda: self._extract_monetary_value(clause_text),
            "payment_days": lambda: self._extract_payment_terms(clause_text),
            "retention_years": lambda: self._extract_retention_period(clause_text),
            "jurisdiction": lambda: self._extract_jurisdiction(clause_text),
            "notice_days": lambda: self._extract_notice_period(clause_text),
            "indemnification_type": lambda: self._analyze_indemnification_type(clause_text),
            "uptime_percentage": lambda: self._extract_uptime_requirement(clause_text),
            "interest_rate": lambda: self._extract_interest_rate(clause_text),
        }
        actual = extractors.get(field, lambda: (extracted_data or {}).get(field))()

        op = condition["operator"]
        val = condition["value"]
        violated = False

        if op == "gt":
            violated = _num(actual) > _num(val)
        elif op == "lt":
            violated = _num(actual) < _num(val)
        elif op == "eq":
            violated = actual == val
        elif op == "ne":
            violated = actual != val
        elif op == "contains":
            violated = str(val).lower() in str(actual).lower()
        elif op == "not_contains":
            violated = str(val).lower() not in str(actual).lower()
        elif op == "in":
            violated = isinstance(val, list) and actual in val
        elif op == "not_in":
            violated = isinstance(val, list) and actual not in val
        elif op == "regex":
            violated = bool(re.search(str(val), str(actual)))

        if violated:
            return {
                "rule_id": policy["id"],
                "clause_type": clause_type,
                "status": "warning" if policy.get("severity") == "low" else "fail",
                "severity": policy.get("severity", "medium"),
                "message": self._format_message(policy.get("message_template", ""), actual, val),
                "extracted_value": actual,
                "policy_threshold": ", ".join(val) if isinstance(val, list) else val,
            }
        return None

    # -- helpers -------------------------------------------------------------

    @staticmethod
    def _is_effective(policy: dict[str, Any]) -> bool:
        now = datetime.now(timezone.utc)
        eff = datetime.fromisoformat(policy["effective_date"])
        if eff.tzinfo is None:
            eff = eff.replace(tzinfo=timezone.utc)
        if now < eff:
            return False
        exp = policy.get("expiry_date")
        if exp:
            exp_dt = datetime.fromisoformat(exp)
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if now > exp_dt:
                return False
        return True

    @staticmethod
    def _applies_to_contract_type(policy: dict[str, Any], contract_type: str | None) -> bool:
        scoped = (policy.get("metadata") or {}).get("contract_types")
        if not isinstance(scoped, list) or len(scoped) == 0:
            return True
        return isinstance(contract_type, str) and contract_type in scoped

    # -- extractors ----------------------------------------------------------

    @staticmethod
    def _extract_monetary_value(text: str) -> float:
        for p in [r"\$([0-9,]+(?:\.[0-9]{2})?)", r"USD\s*([0-9,]+(?:\.[0-9]{2})?)", r"([0-9,]+(?:\.[0-9]{2})?)\s*(?:USD|dollars?)"]:
            m = re.search(p, text, re.I)
            if m:
                return float(m.group(1).replace(",", ""))
        if re.search(r"unlimited|uncapped|no\s*limit", text, re.I):
            return math.inf
        return 0

    @staticmethod
    def _extract_payment_terms(text: str) -> int:
        for p in [r"net[\s-]?(\d+)", r"payment\s+is\s+due\s+within\s+(\d+)\s*days", r"(\d+)\s*days?\s*from\s*invoice", r"payment\s*(?:due\s*)?(?:in\s*)?(\d+)\s*days"]:
            m = re.search(p, text, re.I)
            if m:
                return int(m.group(1))
        return 0

    @staticmethod
    def _extract_retention_period(text: str) -> int:
        for p in [r"(\d+)\s*years?\s*(?:retention|retained|keep|maintain)", r"(?:retain(?:ed)?|keep|maintain)\s*(?:for\s*)?(\d+)\s*years?"]:
            m = re.search(p, text, re.I)
            if m:
                return int(m.group(1))
        return 0

    @staticmethod
    def _extract_jurisdiction(text: str) -> str:
        for j in ["Delaware", "New York", "California", "Texas", "Florida", "Singapore", "London", "Hong Kong", "Ontario", "Quebec"]:
            if j.lower() in text.lower():
                return j
        return "Unknown"

    @staticmethod
    def _extract_notice_period(text: str) -> int:
        for p in [r"(\d+)\s*days?\s*(?:notice|written\s*notice)", r"(?:notice|written\s*notice)\s*(?:of\s*)?(\d+)\s*days?"]:
            m = re.search(p, text, re.I)
            if m:
                return int(m.group(1))
        return 0

    @staticmethod
    def _analyze_indemnification_type(text: str) -> str:
        if re.search(r"mutual", text, re.I):
            return "mutual"
        if re.search(r"unlimited|uncapped", text, re.I):
            return "unlimited"
        if re.search(r"one[\s-]?way|unilateral", text, re.I):
            return "one_way"
        return "standard"

    @staticmethod
    def _extract_uptime_requirement(text: str) -> float:
        for p in [r"(\d{1,3}(?:\.\d+)?)%\s*uptime", r"uptime\s*(?:of\s*)?(\d{1,3}(?:\.\d+)?)%", r"availability\s*(?:of\s*)?(\d{1,3}(?:\.\d+)?)%"]:
            m = re.search(p, text, re.I)
            if m:
                return float(m.group(1))
        return 0

    @staticmethod
    def _extract_interest_rate(text: str) -> float:
        for p in [r"(\d+(?:\.\d+)?)%\s*(?:per\s+annum|annual|interest)", r"interest\s*(?:rate)?\s*(?:of\s*)?(\d+(?:\.\d+)?)%", r"(\d+(?:\.\d+)?)\s*percent\s*(?:per\s+annum|interest)"]:
            m = re.search(p, text, re.I)
            if m:
                return float(m.group(1))
        return 0

    @staticmethod
    def _format_message(template: str, actual: Any, policy_value: Any) -> str:
        msg = template.replace("{actual_value}", str(actual)).replace("{policy_value}", str(policy_value))
        if isinstance(actual, (int, float)) and math.isfinite(actual):
            formatted = f"${actual:,.2f}" if actual != 0 else "$0.00"
        elif actual == math.inf:
            formatted = "unlimited"
        else:
            formatted = str(actual)
        return msg.replace("{currency}", formatted)

    # -- CRUD ----------------------------------------------------------------

    def get_policies(self) -> list[dict[str, Any]]:
        return list(self.policies)

    def add_policy(self, rule: dict[str, Any]) -> None:
        self.policies.append(rule)
        self._save_policies()

    def update_policy(self, rule_id: str, updates: dict[str, Any]) -> bool:
        for i, p in enumerate(self.policies):
            if p["id"] == rule_id:
                self.policies[i] = {**p, **updates}
                self._save_policies()
                return True
        return False

    def delete_policy(self, rule_id: str) -> bool:
        for i, p in enumerate(self.policies):
            if p["id"] == rule_id:
                self.policies.pop(i)
                self._save_policies()
                return True
        return False

    # -- defaults ------------------------------------------------------------

    def _initialize_default_policies(self) -> None:
        self.policies = [
            {"id": "FIN-001", "category": "financial", "clause_types": ["liability"], "rule_type": "threshold", "condition": {"operator": "gt", "field": "liability_amount", "value": 5000000}, "severity": "high", "message_template": "Liability cap {actual_value} exceeds policy maximum of {policy_value}", "effective_date": "2024-01-01", "enabled": True},
            {"id": "FIN-002", "category": "financial", "clause_types": ["payment"], "rule_type": "threshold", "condition": {"operator": "gt", "field": "payment_days", "value": 45}, "severity": "medium", "message_template": "Payment terms of {actual_value} days exceed standard limit of {policy_value} days", "effective_date": "2024-01-01", "enabled": True},
            {"id": "FIN-003", "category": "financial", "clause_types": ["indemnification"], "rule_type": "pattern", "condition": {"operator": "contains", "field": "indemnification_type", "value": "unlimited"}, "severity": "critical", "message_template": "Unlimited indemnification is prohibited by policy", "effective_date": "2024-01-01", "enabled": True},
            {"id": "DATA-001", "category": "data", "clause_types": ["data_protection"], "rule_type": "threshold", "condition": {"operator": "gt", "field": "retention_years", "value": 7}, "severity": "medium", "message_template": "Data retention period of {actual_value} years exceeds policy maximum of {policy_value} years", "effective_date": "2024-01-01", "enabled": True},
            {"id": "LEG-001", "category": "legal", "clause_types": ["governing_law"], "rule_type": "lookup", "condition": {"operator": "not_in", "field": "jurisdiction", "value": ["Delaware", "New York", "California"]}, "severity": "low", "message_template": "Jurisdiction '{actual_value}' is not preferred; Delaware, New York, or California preferred", "effective_date": "2024-01-01", "enabled": True},
            {"id": "OPS-001", "category": "operational", "clause_types": ["sla"], "rule_type": "threshold", "condition": {"operator": "lt", "field": "uptime_percentage", "value": 99.9}, "severity": "medium", "message_template": "SLA uptime requirement of {actual_value}% below policy minimum of {policy_value}%", "effective_date": "2024-01-01", "enabled": True},
        ]
        self._save_policies()
        self._last_loaded = time.time()


def _num(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


# Singleton
policy_engine = DynamicPolicyEngine()


# ---------------------------------------------------------------------------
# Engine functions
# ---------------------------------------------------------------------------

def check_policy(clauses: list[dict[str, Any]], contract_type: str | None = None) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    policy_refs: set[str] = set()
    total_violations = 0

    for clause in clauses:
        violations = policy_engine.evaluate_clause(
            clause["type"], clause["text"], {"section": clause.get("section", "")}, contract_type,
        )
        if not violations:
            results.append({
                "clause_type": clause["type"], "status": "pass", "policy_ref": "",
                "reason": f"No policy violations detected for {clause['type']} clause",
            })
        else:
            for v in violations:
                policy_refs.add(v["rule_id"])
                total_violations += 1
                results.append({
                    "clause_type": v["clause_type"], "status": v["status"], "policy_ref": v["rule_id"],
                    "reason": v["message"], "severity": v.get("severity"),
                    "extracted_value": v.get("extracted_value"), "policy_threshold": v.get("policy_threshold"),
                })

    fail_count = sum(1 for r in results if r["status"] == "fail")
    warn_count = sum(1 for r in results if r["status"] == "warning")
    critical_count = sum(1 for r in results if r.get("severity") == "critical")
    high_count = sum(1 for r in results if r.get("severity") == "high")

    if critical_count > 0:
        overall_risk = "critical"
    elif high_count >= 2 or fail_count >= 3:
        overall_risk = "high"
    elif high_count == 1 or fail_count >= 1 or warn_count >= 3:
        overall_risk = "medium"
    else:
        overall_risk = "low"

    return {
        "clause_results": results, "overall_risk": overall_risk,
        "flags_count": fail_count, "warnings_count": warn_count,
        "policy_references": sorted(policy_refs), "total_violations": total_violations,
    }


def flag_risk(clause_results: list[dict[str, Any]]) -> dict[str, Any]:
    fail_count = sum(1 for r in clause_results if r.get("status") == "fail")
    warn_count = sum(1 for r in clause_results if r.get("status") == "warning")
    critical_count = sum(1 for r in clause_results if r.get("severity") == "critical")
    high_count = sum(1 for r in clause_results if r.get("severity") == "high")

    if critical_count > 0:
        overall_risk = "critical"
    elif high_count >= 2 or fail_count >= 3:
        overall_risk = "high"
    elif high_count == 1 or fail_count >= 1 or warn_count >= 3:
        overall_risk = "medium"
    else:
        overall_risk = "low"

    critical_violations = [
        f"{r['clause_type']} ({r.get('policy_ref', '')}): {r.get('reason', '')}"
        for r in clause_results if r.get("severity") == "critical" and r.get("status") == "fail"
    ]
    high_violations = [
        f"{r['clause_type']} ({r.get('policy_ref', '')}): {r.get('reason', '')}"
        for r in clause_results if r.get("severity") == "high" and r.get("status") == "fail"
    ]

    if critical_count > 0:
        summary = f"CRITICAL: {critical_count} critical violation(s) detected. Immediate action required. Also {fail_count - critical_count} other failures and {warn_count} warnings."
    elif fail_count > 0:
        summary = f"{fail_count} policy violation(s) detected. {warn_count} warnings noted. Review required before approval."
    elif warn_count > 0:
        summary = f"No policy violations. {warn_count} warning(s) noted for review."
    else:
        summary = "All clauses pass policy compliance checks."

    return {
        "overall_risk": overall_risk, "flags_count": fail_count, "warnings_count": warn_count,
        "summary": summary, "critical_violations": critical_violations, "high_violations": high_violations,
    }


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_check_policy(clauses: str, contract_type: str = "") -> str:
    """Check extracted clauses against company policies."""
    parsed = json.loads(clauses)
    return json.dumps(check_policy(parsed, contract_type or None))


@mcp.tool()
def tool_flag_risk(clause_results: str) -> str:
    """Assess overall risk level based on compliance results."""
    parsed = json.loads(clause_results)
    return json.dumps(flag_risk(parsed))


@mcp.tool()
def tool_get_policy_rules() -> str:
    """Retrieve company policy rules for compliance checking."""
    return json.dumps(policy_engine.get_policies())


@mcp.tool()
def tool_add_policy_rule(rule: str) -> str:
    """Add a new dynamic policy rule."""
    policy_engine.add_policy(json.loads(rule))
    return json.dumps({"success": True, "message": "Policy rule added successfully"})


@mcp.tool()
def tool_update_policy_rule(rule_id: str, updates: str) -> str:
    """Update an existing policy rule."""
    ok = policy_engine.update_policy(rule_id, json.loads(updates))
    return json.dumps({"success": ok, "message": "Policy rule updated successfully" if ok else "Policy rule not found"})


@mcp.tool()
def tool_delete_policy_rule(rule_id: str) -> str:
    """Delete a policy rule."""
    ok = policy_engine.delete_policy(rule_id)
    return json.dumps({"success": ok, "message": "Policy rule deleted successfully" if ok else "Policy rule not found"})


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    port = int(os.environ.get("MCP_COMPLIANCE_PORT", "9003"))
    mcp.settings.port = port

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[
        Route("/health", health),
        Mount("/", app=mcp.sse_app()),
    ])
    uvicorn.run(app, host="127.0.0.1", port=port)
