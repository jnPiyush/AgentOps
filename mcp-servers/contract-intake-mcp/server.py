"""Contract Intake MCP Server (Python port).

Tools: upload_contract, classify_document, extract_metadata.
"""

from __future__ import annotations

import os
import re
import uuid
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("contract-intake-mcp")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CORPORATE_CONTRACT_TYPES = {
    "Promissory Note", "Loan Agreement", "Employment", "Joint Venture",
    "Franchise", "Consortium", "Partnership",
}

INDUSTRY_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("Technology", re.compile(r"software|saas|cloud|platform|ai|technology", re.I)),
    ("Financial Services", re.compile(r"bank|lender|loan|credit|finance|financial", re.I)),
    ("Healthcare", re.compile(r"health|patient|hospital|medical|pharma", re.I)),
    ("Manufacturing", re.compile(r"manufactur|factory|raw materials|supply chain", re.I)),
    ("Public Sector", re.compile(r"government|public sector|federal acquisition|state agency", re.I)),
    ("Insurance", re.compile(r"insurer|insured|policyholder|coverage", re.I)),
]

CONTRACT_PATTERNS: dict[str, list[re.Pattern]] = {
    "NDA": [re.compile(r"non-disclosure", re.I), re.compile(r"\bnda\b", re.I), re.compile(r"confidential\s+information", re.I)],
    "MSA": [re.compile(r"master\s+service", re.I), re.compile(r"\bmsa\b", re.I)],
    "Services Agreement": [re.compile(r"professional\s+services\s+agreement", re.I), re.compile(r"services?\s+agreement", re.I), re.compile(r"consulting\s+services\s+agreement", re.I)],
    "SOW": [re.compile(r"statement\s+of\s+work", re.I), re.compile(r"\bsow\b", re.I), re.compile(r"scope\s+of\s+work", re.I)],
    "Amendment": [re.compile(r"amendment", re.I), re.compile(r"amended\s+to", re.I), re.compile(r"modify.*agreement", re.I)],
    "SLA": [re.compile(r"service\s+level", re.I), re.compile(r"\bsla\b", re.I), re.compile(r"uptime", re.I)],
    "Sales Agreement": [re.compile(r"sales\s+agreement", re.I), re.compile(r"purchase\s+and\s+sale\s+agreement", re.I), re.compile(r"seller\s+agrees\s+to\s+sell", re.I)],
    "Distribution Agreement": [re.compile(r"distribution\s+agreement", re.I), re.compile(r"appointed\s+as\s+(?:an\s+)?(?:authorized\s+)?distributor", re.I), re.compile(r"right\s+to\s+distribute", re.I)],
    "Supply Agreement": [re.compile(r"supply\s+agreement", re.I), re.compile(r"supplier\s+shall\s+supply", re.I), re.compile(r"procure(?:ment)?\s+of\s+goods", re.I)],
    "License Agreement": [re.compile(r"license\s+agreement", re.I), re.compile(r"licensing\s+agreement", re.I), re.compile(r"grants?\s+(?:a\s+)?(?:non-exclusive|exclusive)?\s*license", re.I)],
    "SaaS / Cloud Services Agreement": [re.compile(r"saas\s+(?:subscription\s+)?agreement", re.I), re.compile(r"cloud\s+services\s+agreement", re.I), re.compile(r"software\s+as\s+a\s+service", re.I)],
    "Promissory Note": [re.compile(r"promissory\s+note", re.I), re.compile(r"promises?\s+to\s+pay", re.I), re.compile(r"principal\s+sum\s+of", re.I)],
    "Loan Agreement": [re.compile(r"loan\s+agreement", re.I), re.compile(r"lender\s+agrees\s+to\s+lend", re.I), re.compile(r"borrower\s+shall\s+repay", re.I)],
    "Employment": [re.compile(r"employment\s+agreement", re.I), re.compile(r"employee", re.I), re.compile(r"employer", re.I)],
    "Joint Venture": [re.compile(r"joint\s+venture", re.I), re.compile(r"co-venturers?", re.I), re.compile(r"profit\s+sharing", re.I)],
    "Franchise": [re.compile(r"franchise\s+agreement", re.I), re.compile(r"franchisor", re.I), re.compile(r"franchisee", re.I)],
    "AI Services": [re.compile(r"ai\s+services\s+agreement", re.I), re.compile(r"artificial\s+intelligence\s+services", re.I), re.compile(r"model\s+services", re.I)],
    "Procurement": [re.compile(r"procurement\s+agreement", re.I), re.compile(r"request\s+for\s+proposal", re.I), re.compile(r"vendor\s+procurement", re.I)],
    "Consortium": [re.compile(r"consortium\s+agreement", re.I), re.compile(r"consortium\s+members", re.I), re.compile(r"lead\s+member", re.I)],
    "Partnership": [re.compile(r"partnership\s+agreement", re.I), re.compile(r"general\s+partnership", re.I), re.compile(r"partners?\s+agree", re.I)],
    "Lease": [re.compile(r"lease\s+agreement", re.I), re.compile(r"landlord", re.I), re.compile(r"tenant", re.I)],
    "Insurance": [re.compile(r"insurance\s+policy", re.I), re.compile(r"insured", re.I), re.compile(r"insurer", re.I)],
    "Government Contract": [re.compile(r"government\s+contract", re.I), re.compile(r"public\s+sector", re.I), re.compile(r"federal\s+acquisition", re.I)],
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    from datetime import datetime
    try:
        parsed = datetime.strptime(value.replace(",", ""), "%B %d %Y")
        return parsed.strftime("%Y-%m-%d")
    except ValueError:
        return value


def _infer_contract_category(contract_type: str) -> str:
    if contract_type == "UNKNOWN":
        return "UNKNOWN"
    return "Corporate" if contract_type in CORPORATE_CONTRACT_TYPES else "Commercial"


def _detect_source_channel(text: str, filename: str) -> str:
    if re.search(r"^from:|^subject:|^sent:", text, re.I | re.M) or re.search(r"\.(eml|msg)$", filename, re.I):
        return "email"
    if re.search(r"api payload|webhook|application/json|request body|http/1\.1", text, re.I) or filename.endswith(".json"):
        return "api"
    if re.search(r"database record|crm export|erp extract|db row|salesforce", text, re.I) or re.search(r"\.(csv|tsv)$", filename, re.I):
        return "db"
    if filename:
        return "file"
    return "unknown"


def _detect_industry(text: str) -> str | None:
    for industry, pattern in INDUSTRY_PATTERNS:
        if pattern.search(text):
            return industry
    return None


def _detect_counterparty_type(text: str, contract_type: str) -> str | None:
    mapping = {
        "Loan Agreement": "lender-borrower", "Promissory Note": "lender-borrower",
        "Employment": "employer-employee", "Lease": "landlord-tenant",
        "Insurance": "insurer-insured", "Franchise": "franchisor-franchisee",
    }
    if contract_type in mapping:
        return mapping[contract_type]
    if contract_type in ("Joint Venture", "Partnership", "Consortium"):
        return "partners"
    vendor_types = {
        "NDA", "MSA", "Services Agreement", "SOW", "SLA", "Amendment",
        "Sales Agreement", "Distribution Agreement", "Supply Agreement",
        "License Agreement", "SaaS / Cloud Services Agreement", "AI Services",
        "Procurement", "Government Contract",
    }
    if contract_type in vendor_types:
        return "vendor-customer"
    if re.search(r"customer|client|buyer", text, re.I) and re.search(r"vendor|provider|seller|supplier", text, re.I):
        return "vendor-customer"
    if re.search(r"government|agency|department", text, re.I) and re.search(r"contractor|vendor|supplier", text, re.I):
        return "government-contractor"
    return None


def _extract_value_and_currency(text: str) -> tuple[float | None, str | None]:
    m = re.search(r"(?:USD|EUR|GBP|AUD|CAD|INR|\$|€|£)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)", text, re.I)
    if not m:
        return None, None
    raw = m.group(1).replace(",", "")
    value = float(raw)
    prefix = m.group(0).upper()
    if "EUR" in prefix or "\u20ac" in prefix:
        currency = "EUR"
    elif "GBP" in prefix or "\u00a3" in prefix:
        currency = "GBP"
    elif "AUD" in prefix:
        currency = "AUD"
    elif "CAD" in prefix:
        currency = "CAD"
    elif "INR" in prefix:
        currency = "INR"
    else:
        currency = "USD"
    import math
    return (value if math.isfinite(value) else None), currency


def _detect_compliance_needs(text: str, contract_type: str, industry: str | None) -> list[str]:
    needs: set[str] = set()
    if re.search(r"privacy|personal data|gdpr|ccpa|hipaa|confidential information", text, re.I):
        needs.add("data_privacy")
    if re.search(r"export control|sanctions|restricted party", text, re.I):
        needs.add("export_controls")
    if re.search(r"artificial intelligence|ai model|training data|model output", text, re.I) or contract_type == "AI Services":
        needs.add("ai_governance")
    if re.search(r"ip|intellectual property|license|source code", text, re.I):
        needs.add("ip_protection")
    if re.search(r"employment|employee|labor|benefits", text, re.I) or contract_type == "Employment":
        needs.add("employment_labor")
    if re.search(r"government|public sector|federal acquisition", text, re.I) or contract_type == "Government Contract":
        needs.add("public_sector")
    if re.search(r"insurance|coverage|underwriting", text, re.I) or contract_type == "Insurance":
        needs.add("insurance_regulatory")
    if industry == "Financial Services" or re.search(r"loan|credit|bank|lender|borrower", text, re.I):
        needs.add("financial_regulatory")
    if re.search(r"purchase order|procurement|supplier|vendor onboarding", text, re.I) or contract_type == "Procurement":
        needs.add("procurement_controls")
    return sorted(needs)


def _detect_risk_level(text: str, contract_type: str, value: float | None, compliance_needs: list[str]) -> str | None:
    if (re.search(r"unlimited liability|material breach|indemnif|exclusive jurisdiction|government|public sector", text, re.I)
            or contract_type in ("Loan Agreement", "Insurance", "Joint Venture")
            or (value is not None and value >= 1_000_000)
            or "financial_regulatory" in compliance_needs
            or "public_sector" in compliance_needs):
        return "HIGH"
    if (contract_type in ("MSA", "SaaS / Cloud Services Agreement", "Procurement", "Government Contract")
            or (value is not None and value >= 250_000)):
        return "MEDIUM"
    return "LOW"


# ---------------------------------------------------------------------------
# Engine functions
# ---------------------------------------------------------------------------

def classify_document(text: str) -> dict[str, Any]:
    scores: dict[str, float] = {}
    for ctype, patterns in CONTRACT_PATTERNS.items():
        match_count = sum(1 for p in patterns if p.search(text))
        if match_count > 0:
            scores[ctype] = match_count / len(patterns)
    if not scores:
        return {"type": "UNKNOWN", "confidence": 0.5}
    best_type = max(scores, key=scores.get)  # type: ignore[arg-type]
    best_score = scores[best_type]
    return {"type": best_type, "confidence": min(0.99, 0.7 + best_score * 0.25)}


def extract_metadata(text: str) -> dict[str, Any]:
    party_match = re.search(
        r'between\s+(.+?)\s*(?:,\s*a\s+\w+\s+\w+\s*)?(?:\(".*?"\)\s*)?(?:,?\s*and\s+)(.+?)\s*(?:,\s*a\s+\w+\s+\w+\s*)?(?:\(".*?"\))',
        text, re.I,
    )
    parties = [party_match.group(1).strip(), party_match.group(2).strip()] if party_match else []

    date_match = re.search(r"(?:as\s+of|dated?|effective)\s+(\w+\s+\d{1,2},?\s+\d{4})", text, re.I)
    effective_date = _normalize_date(date_match.group(1) if date_match else None)

    expiry_match = re.search(r"(?:expires?|termination\s+date|until)\s+(\w+\s+\d{1,2},?\s+\d{4})", text, re.I)
    expiry_date = _normalize_date(expiry_match.group(1) if expiry_match else None)

    jurisdiction_match = re.search(r"governed\s+by.*?laws\s+of\s+(?:the\s+)?(?:State\s+of\s+)?(\w[\w\s]*?)(?:\.|,)", text, re.I)
    jurisdiction = jurisdiction_match.group(1).strip() if jurisdiction_match else None

    duration_match = re.search(r"(?:term|period|duration)\s+of\s+(\w+\s+\(\d+\)\s+\w+)", text, re.I)
    duration = duration_match.group(1) if duration_match else None

    classification = classify_document(text)
    ctype = classification["type"]
    industry = _detect_industry(text)
    value, currency = _extract_value_and_currency(text)
    compliance_needs = _detect_compliance_needs(text, ctype, industry)
    counterparty_type = _detect_counterparty_type(text, ctype)
    risk_level = _detect_risk_level(text, ctype, value, compliance_needs)
    source_system_match = re.search(r"(?:salesforce|sap|workday|dynamics|servicenow|oracle)", text, re.I)
    source_system = source_system_match.group(0).lower() if source_system_match else None

    return {
        "parties": parties,
        "contract_category": _infer_contract_category(ctype),
        "source_channel": "unknown",
        "industry": industry,
        "counterparty_type": counterparty_type,
        "risk_level": risk_level,
        "compliance_needs": compliance_needs,
        "effective_date": effective_date,
        "expiry_date": expiry_date,
        "value": value,
        "currency": currency,
        "jurisdiction": jurisdiction,
        "source_system": source_system,
        "duration": duration,
    }


def upload_contract(text: str, filename: str) -> dict[str, Any]:
    classification = classify_document(text)
    metadata = extract_metadata(text)
    metadata["source_channel"] = _detect_source_channel(text, filename)
    metadata["contract_category"] = _infer_contract_category(classification["type"])
    return {
        "contract_id": f"contract-{uuid.uuid4().hex[:8]}",
        "filename": filename,
        "type": classification["type"],
        "confidence": classification["confidence"],
        "parties": metadata["parties"],
        "metadata": metadata,
        "status": "processing",
    }


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_upload_contract(text: str, filename: str) -> str:
    """Upload a contract document for processing."""
    import json
    return json.dumps(upload_contract(text, filename))


@mcp.tool()
def tool_classify_document(text: str) -> str:
    """Classify a contract by type (NDA, MSA, Services Agreement, SOW, Amendment, SLA, etc.)."""
    import json
    return json.dumps(classify_document(text))


@mcp.tool()
def tool_extract_metadata(text: str) -> str:
    """Extract metadata from a contract (parties, dates, jurisdiction)."""
    import json
    return json.dumps(extract_metadata(text))


# ---------------------------------------------------------------------------
# HTTP + SSE transport
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    port = int(os.environ.get("MCP_INTAKE_PORT", "9001"))
    mcp.settings.port = port

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[
        Route("/health", health),
        Mount("/", app=mcp.sse_app()),
    ])
    uvicorn.run(app, host="127.0.0.1", port=port)
