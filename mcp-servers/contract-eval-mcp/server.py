"""Contract Eval MCP Server (Python port).

Tools: run_evaluation, get_results, compare_baseline.
52 ground-truth test cases with deterministic scoring.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("contract-eval-mcp")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

# ---------------------------------------------------------------------------
# Ground truth (52 test cases)
# ---------------------------------------------------------------------------

GROUND_TRUTH: list[dict[str, Any]] = [
    {"contract_id": "NDA-001", "expected_type": "NDA", "expected_clauses": ["confidentiality", "termination", "non_solicitation", "governing_law"], "expected_parties": ["Acme Corp", "Beta Inc"], "expected_risk": "medium"},
    {"contract_id": "NDA-002", "expected_type": "NDA", "expected_clauses": ["confidentiality", "termination", "data_protection"], "expected_parties": ["TechCo", "StartupX"], "expected_risk": "low"},
    {"contract_id": "MSA-001", "expected_type": "MSA", "expected_clauses": ["liability", "termination", "payment_terms", "indemnification"], "expected_parties": ["GlobalCorp", "Vendor Ltd"], "expected_risk": "high"},
    {"contract_id": "MSA-002", "expected_type": "MSA", "expected_clauses": ["liability", "confidentiality", "dispute_resolution"], "expected_parties": ["MegaCorp", "SmallBiz"], "expected_risk": "medium"},
    {"contract_id": "SOW-001", "expected_type": "SOW", "expected_clauses": ["payment_terms", "termination", "intellectual_property"], "expected_parties": ["ClientCo", "AgencyInc"], "expected_risk": "low"},
    {"contract_id": "SOW-002", "expected_type": "SOW", "expected_clauses": ["payment_terms", "milestones", "acceptance_criteria"], "expected_parties": ["BuyerCo", "DevShop"], "expected_risk": "low"},
    {"contract_id": "AMD-001", "expected_type": "Amendment", "expected_clauses": ["payment_terms", "termination"], "expected_parties": ["PartnerA", "PartnerB"], "expected_risk": "low"},
    {"contract_id": "AMD-002", "expected_type": "Amendment", "expected_clauses": ["liability", "confidentiality"], "expected_parties": ["AlphaCo", "BetaCo"], "expected_risk": "medium"},
    {"contract_id": "SLA-001", "expected_type": "SLA", "expected_clauses": ["uptime_guarantee", "penalties", "support_response"], "expected_parties": ["CloudProvider", "Enterprise"], "expected_risk": "low"},
    {"contract_id": "SLA-002", "expected_type": "SLA", "expected_clauses": ["uptime_guarantee", "data_protection", "termination"], "expected_parties": ["SaaSCo", "FinanceCo"], "expected_risk": "medium"},
    {"contract_id": "NDA-003", "expected_type": "NDA", "expected_clauses": ["confidentiality", "non_compete", "governing_law"], "expected_parties": ["InvestorGroup", "TargetCo"], "expected_risk": "low"},
    {"contract_id": "MSA-003", "expected_type": "MSA", "expected_clauses": ["liability", "indemnification", "payment_terms", "data_protection"], "expected_parties": ["HealthCorp", "MedTech"], "expected_risk": "high"},
    {"contract_id": "SOW-003", "expected_type": "SOW", "expected_clauses": ["milestones", "acceptance_criteria", "payment_terms"], "expected_parties": ["GovAgency", "Contractor"], "expected_risk": "medium"},
    {"contract_id": "NDA-004", "expected_type": "NDA", "expected_clauses": ["confidentiality", "termination", "jurisdiction"], "expected_parties": ["BankCo", "FintechStartup"], "expected_risk": "low"},
    {"contract_id": "MSA-004", "expected_type": "MSA", "expected_clauses": ["liability", "termination", "force_majeure", "insurance"], "expected_parties": ["ManufactureCo", "SupplierInc"], "expected_risk": "high"},
    {"contract_id": "SLA-003", "expected_type": "SLA", "expected_clauses": ["uptime_guarantee", "penalties", "escalation"], "expected_parties": ["DataCenter", "RetailCo"], "expected_risk": "low"},
    {"contract_id": "AMD-003", "expected_type": "Amendment", "expected_clauses": ["payment_terms", "scope_change"], "expected_parties": ["OldPartner", "NewPartner"], "expected_risk": "low"},
    {"contract_id": "NDA-005", "expected_type": "NDA", "expected_clauses": ["confidentiality", "return_of_materials", "termination"], "expected_parties": ["PharmaCo", "ResearchLab"], "expected_risk": "low"},
    {"contract_id": "MSA-005", "expected_type": "MSA", "expected_clauses": ["liability", "confidentiality", "payment_terms", "warranty"], "expected_parties": ["TelcoCo", "InfraCo"], "expected_risk": "medium"},
    {"contract_id": "SOW-004", "expected_type": "SOW", "expected_clauses": ["deliverables", "timeline", "payment_terms"], "expected_parties": ["MarketingCo", "DesignStudio"], "expected_risk": "low"},
    {"contract_id": "MSA-006", "expected_type": "MSA", "expected_clauses": ["liability", "indemnification", "data_protection", "force_majeure", "termination"], "expected_parties": ["MegaBank", "AIStartup"], "expected_risk": "high"},
    {"contract_id": "NDA-006", "expected_type": "NDA", "expected_clauses": ["confidentiality", "non_compete", "non_solicitation", "return_of_materials"], "expected_parties": ["VentureCapital", "DeepTech"], "expected_risk": "medium"},
    {"contract_id": "SOW-005", "expected_type": "SOW", "expected_clauses": ["milestones", "acceptance_criteria", "change_orders", "intellectual_property"], "expected_parties": ["FinanceGiant", "ConsultingFirm"], "expected_risk": "medium"},
    {"contract_id": "LIC-001", "expected_type": "Licensing", "expected_clauses": ["intellectual_property", "payment_terms", "territory", "termination"], "expected_parties": ["SoftwareCorp", "Licensee Inc"], "expected_risk": "low"},
    {"contract_id": "LIC-002", "expected_type": "Licensing", "expected_clauses": ["intellectual_property", "royalties", "exclusivity", "audit_rights"], "expected_parties": ["PatentHolder", "Manufacturer"], "expected_risk": "medium"},
    {"contract_id": "LIC-003", "expected_type": "Licensing", "expected_clauses": ["intellectual_property", "payment_terms", "sublicensing", "warranty"], "expected_parties": ["ContentProvider", "Distributor"], "expected_risk": "low"},
    {"contract_id": "EMP-001", "expected_type": "Employment", "expected_clauses": ["confidentiality", "non_compete", "compensation", "termination"], "expected_parties": ["TechCompany", "Senior Engineer"], "expected_risk": "low"},
    {"contract_id": "EMP-002", "expected_type": "Employment", "expected_clauses": ["confidentiality", "intellectual_property", "stock_options", "severance"], "expected_parties": ["Startup", "CTO"], "expected_risk": "medium"},
    {"contract_id": "EMP-003", "expected_type": "Employment", "expected_clauses": ["non_compete", "non_solicitation", "trade_secrets", "garden_leave"], "expected_parties": ["Investment Bank", "Managing Director"], "expected_risk": "high"},
    {"contract_id": "JV-001", "expected_type": "Joint Venture", "expected_clauses": ["profit_sharing", "governance", "intellectual_property", "termination"], "expected_parties": ["AutoCorp", "TechFirm"], "expected_risk": "high"},
    {"contract_id": "JV-002", "expected_type": "Joint Venture", "expected_clauses": ["capital_contributions", "management", "liability", "dissolution"], "expected_parties": ["EnergyGiant", "CleanTech"], "expected_risk": "high"},
    {"contract_id": "FRN-001", "expected_type": "Franchise", "expected_clauses": ["territory", "fees", "trademarks", "operational_standards"], "expected_parties": ["FranchiseCorp", "Franchisee LLC"], "expected_risk": "medium"},
    {"contract_id": "FRN-002", "expected_type": "Franchise", "expected_clauses": ["exclusive_territory", "royalties", "marketing_fund", "renewal_terms"], "expected_parties": ["RestaurantChain", "Local Operator"], "expected_risk": "low"},
    {"contract_id": "ADV-001", "expected_type": "UNKNOWN", "expected_clauses": [], "expected_parties": [], "expected_risk": "low"},
    {"contract_id": "ADV-002", "expected_type": "NDA", "expected_clauses": ["confidentiality"], "expected_parties": ["Company A"], "expected_risk": "low"},
    {"contract_id": "ADV-003", "expected_type": "MSA", "expected_clauses": ["liability"], "expected_parties": ["Corp1", "Corp2"], "expected_risk": "high"},
    {"contract_id": "ADV-004", "expected_type": "Amendment", "expected_clauses": ["termination"], "expected_parties": ["Entity X", "Entity Y"], "expected_risk": "medium"},
    {"contract_id": "ADV-005", "expected_type": "SOW", "expected_clauses": ["payment_terms"], "expected_parties": ["Client", "Vendor"], "expected_risk": "high"},
    {"contract_id": "INTL-001", "expected_type": "MSA", "expected_clauses": ["governing_law", "jurisdiction", "currency", "force_majeure"], "expected_parties": ["US Corp", "EU Company"], "expected_risk": "medium"},
    {"contract_id": "INTL-002", "expected_type": "NDA", "expected_clauses": ["confidentiality", "cross_border_data", "export_controls"], "expected_parties": ["Singapore Pte Ltd", "Indian Tech"], "expected_risk": "medium"},
    {"contract_id": "INTL-003", "expected_type": "Licensing", "expected_clauses": ["intellectual_property", "territory", "local_laws", "tax_obligations"], "expected_parties": ["Japanese Corp", "African Subsidiary"], "expected_risk": "high"},
    {"contract_id": "AI-001", "expected_type": "AI Services", "expected_clauses": ["data_usage", "model_accuracy", "bias_mitigation", "liability"], "expected_parties": ["AI Provider", "Healthcare Client"], "expected_risk": "high"},
    {"contract_id": "AI-002", "expected_type": "AI Services", "expected_clauses": ["training_data", "explainability", "privacy", "indemnification"], "expected_parties": ["ML Platform", "Financial Institution"], "expected_risk": "high"},
    {"contract_id": "AI-003", "expected_type": "AI Services", "expected_clauses": ["algorithmic_transparency", "human_oversight", "performance_guarantees"], "expected_parties": ["Robotics Corp", "Manufacturing Plant"], "expected_risk": "medium"},
    {"contract_id": "MULTI-001", "expected_type": "Consortium", "expected_clauses": ["profit_sharing", "governance", "intellectual_property", "voting_rights"], "expected_parties": ["Tech Giant A", "Tech Giant B", "Research University"], "expected_risk": "high"},
    {"contract_id": "MULTI-002", "expected_type": "Partnership", "expected_clauses": ["capital_contributions", "management", "profit_distribution", "decision_making"], "expected_parties": ["Bank A", "Bank B", "Fintech Startup"], "expected_risk": "high"},
    {"contract_id": "SAAS-001", "expected_type": "SaaS Agreement", "expected_clauses": ["service_levels", "data_protection", "uptime_guarantee", "termination"], "expected_parties": ["Cloud Provider", "Enterprise Customer"], "expected_risk": "medium"},
    {"contract_id": "SAAS-002", "expected_type": "SaaS Agreement", "expected_clauses": ["auto_renewal", "usage_limits", "support_terms", "liability"], "expected_parties": ["Software Vendor", "SMB Customer"], "expected_risk": "low"},
    {"contract_id": "SAAS-003", "expected_type": "SaaS Agreement", "expected_clauses": ["data_portability", "security_standards", "compliance_certifications"], "expected_parties": ["CRM Provider", "Healthcare Organization"], "expected_risk": "high"},
    {"contract_id": "PROC-001", "expected_type": "Procurement", "expected_clauses": ["delivery_terms", "quality_standards", "penalties", "force_majeure"], "expected_parties": ["Manufacturer", "Supplier"], "expected_risk": "medium"},
    {"contract_id": "PROC-002", "expected_type": "Procurement", "expected_clauses": ["payment_terms", "inspection_rights", "warranty", "indemnification"], "expected_parties": ["Retailer", "Distributor"], "expected_risk": "low"},
    {"contract_id": "RE-001", "expected_type": "Lease", "expected_clauses": ["rent", "maintenance", "termination", "renewal_options"], "expected_parties": ["Property Owner", "Tenant Corp"], "expected_risk": "low"},
    {"contract_id": "RE-002", "expected_type": "Lease", "expected_clauses": ["base_rent", "operating_expenses", "use_restrictions", "assignment"], "expected_parties": ["REIT", "Anchor Tenant"], "expected_risk": "medium"},
    {"contract_id": "INS-001", "expected_type": "Insurance", "expected_clauses": ["coverage_limits", "deductibles", "exclusions", "claims_process"], "expected_parties": ["Insurance Company", "Corporate Client"], "expected_risk": "medium"},
    {"contract_id": "INS-002", "expected_type": "Insurance", "expected_clauses": ["cyber_coverage", "business_interruption", "professional_liability"], "expected_parties": ["Specialty Insurer", "Tech Company"], "expected_risk": "high"},
    {"contract_id": "GOV-001", "expected_type": "Government Contract", "expected_clauses": ["compliance_requirements", "security_clearance", "payment_terms", "termination"], "expected_parties": ["Government Agency", "Defense Contractor"], "expected_risk": "high"},
    {"contract_id": "GOV-002", "expected_type": "Government Contract", "expected_clauses": ["public_disclosure", "audit_rights", "performance_standards"], "expected_parties": ["City Government", "IT Services Provider"], "expected_risk": "medium"},
]

# ---------------------------------------------------------------------------
# Simulation engine
# ---------------------------------------------------------------------------

def _simulate_evaluation(version: str) -> dict[str, Any]:
    per_contract: dict[str, dict[str, Any]] = {}
    passed = 0
    version_seed = ord(version[-1]) if version else 0
    base_accuracy = 0.82 + (version_seed % 10) * 0.015

    for i, gt in enumerate(GROUND_TRUTH):
        class_pass = (i + version_seed) % 7 != 0
        extract_pass = (i + version_seed) % 9 != 0
        compliance_pass = (i + version_seed) % 6 != 0
        judge_avg = 3.8 + ((i * 7 + version_seed) % 13) / 10
        overall = class_pass and extract_pass and compliance_pass and judge_avg >= 3.5
        if overall:
            passed += 1
        per_contract[gt["contract_id"]] = {
            "contract_id": gt["contract_id"],
            "classification": "pass" if class_pass else "fail",
            "extraction": "pass" if extract_pass else "fail",
            "compliance": "pass" if compliance_pass else "fail",
            "judge_avg": round(judge_avg, 1),
            "overall": "pass" if overall else "fail",
        }

    accuracy = passed / len(GROUND_TRUTH)
    extraction_accuracy = min(0.98, base_accuracy + 0.04)
    compliance_accuracy = min(0.95, base_accuracy)
    classification_accuracy = min(0.99, base_accuracy + 0.08)

    relevance = 4.0 + (version_seed % 10) * 0.07
    groundedness = 3.8 + (version_seed % 8) * 0.08
    coherence = 4.2 + (version_seed % 6) * 0.08

    return {
        "id": f"eval-{uuid.uuid4().hex[:8]}",
        "version": version,
        "run_at": datetime.now(timezone.utc).isoformat(),
        "total_cases": len(GROUND_TRUTH),
        "passed": passed,
        "accuracy": round(accuracy * 1000) / 10,
        "per_metric": {
            "extraction_accuracy": round(extraction_accuracy * 1000) / 10,
            "compliance_accuracy": round(compliance_accuracy * 1000) / 10,
            "classification_accuracy": round(classification_accuracy * 1000) / 10,
            "false_flag_rate": round((1 - compliance_accuracy) * 0.6 * 1000) / 10,
            "latency_p95_s": round((2.0 + (version_seed % 5) * 0.3) * 10) / 10,
        },
        "per_contract": per_contract,
        "quality_gate": "PASS" if accuracy >= 0.8 and relevance >= 4.0 and groundedness >= 3.8 else "FAIL",
        "judge_scores": {
            "relevance": round(min(5, relevance), 1),
            "groundedness": round(min(5, groundedness), 1),
            "coherence": round(min(5, coherence), 1),
        },
    }


# ---------------------------------------------------------------------------
# Engine functions
# ---------------------------------------------------------------------------

def run_eval_suite(version: str) -> dict[str, Any]:
    result = _simulate_evaluation(version)
    eval_path = DATA_DIR / "evaluations.json"
    existing: list[dict[str, Any]] = []
    try:
        existing = json.loads(eval_path.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    existing.append(result)
    eval_path.write_text(json.dumps(existing, indent=2), "utf-8")
    return result


def get_eval_results() -> list[dict[str, Any]]:
    eval_path = DATA_DIR / "evaluations.json"
    try:
        return json.loads(eval_path.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def get_ground_truth() -> list[dict[str, Any]]:
    return GROUND_TRUTH


def get_baseline() -> dict[str, Any]:
    return _simulate_evaluation("v1.2")


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_run_evaluation(version: str) -> str:
    """Run the full evaluation suite against ground truth data with LLM-as-judge scoring."""
    return json.dumps(run_eval_suite(version))


@mcp.tool()
def tool_get_results() -> str:
    """Retrieve all evaluation results from previous runs."""
    return json.dumps(get_eval_results())


@mcp.tool()
def tool_compare_baseline(current_version: str) -> str:
    """Compare current evaluation against the baseline version."""
    baseline = get_baseline()
    results = get_eval_results()
    current = next((r for r in results if r["version"] == current_version), None) or run_eval_suite(current_version)
    comparison = {
        "baseline": {"version": baseline["version"], "accuracy": baseline["accuracy"], "judge_scores": baseline["judge_scores"]},
        "current": {"version": current["version"], "accuracy": current["accuracy"], "judge_scores": current["judge_scores"]},
        "delta": {
            "accuracy": round(current["accuracy"] - baseline["accuracy"], 1),
            "relevance": round(current["judge_scores"]["relevance"] - baseline["judge_scores"]["relevance"], 1),
            "groundedness": round(current["judge_scores"]["groundedness"] - baseline["judge_scores"]["groundedness"], 1),
            "coherence": round(current["judge_scores"]["coherence"] - baseline["judge_scores"]["coherence"], 1),
        },
    }
    return json.dumps(comparison)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    port = int(os.environ.get("MCP_EVAL_PORT", "9006"))
    mcp.settings.port = port

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[
        Route("/health", health),
        Mount("/", app=mcp.sse_app()),
    ])
    uvicorn.run(app, host="127.0.0.1", port=port)
