"""Contract Extraction MCP Server (Python port).

Tools: extract_clauses, identify_parties, extract_dates_values.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("contract-extraction-mcp")

# ---------------------------------------------------------------------------
# Clause patterns
# ---------------------------------------------------------------------------

CLAUSE_PATTERNS: list[dict[str, Any]] = [
    {"type": "confidentiality", "patterns": [re.compile(r"shall not disclose", re.I), re.compile(r"confidential\s+information", re.I), re.compile(r"non-disclosure", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:CONFIDENTIAL|DEFINITION OF CONFIDENTIAL|NON-DISCLOSURE)", re.I)},
    {"type": "termination", "patterns": [re.compile(r"terminat(?:e|ion)", re.I), re.compile(r"written\s+notice", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:TERMINAT)", re.I)},
    {"type": "liability", "patterns": [re.compile(r"liability.*(?:shall not|not)\s+exceed", re.I), re.compile(r"limitation\s+of\s+liability", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:LIMIT.*LIABILITY|LIABILITY)", re.I)},
    {"type": "indemnification", "patterns": [re.compile(r"indemnif", re.I), re.compile(r"hold\s+harmless", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:INDEMNIF)", re.I)},
    {"type": "payment", "patterns": [re.compile(r"payment\s+terms", re.I), re.compile(r"net-\d+", re.I), re.compile(r"invoice", re.I), re.compile(r"fee", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:PAYMENT|FEES)", re.I)},
    {"type": "ip_ownership", "patterns": [re.compile(r"intellectual\s+property", re.I), re.compile(r"work\s+product.*owned", re.I), re.compile(r"ip\s+ownership", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:INTELLECTUAL|IP|OWNERSHIP)", re.I)},
    {"type": "data_protection", "patterns": [re.compile(r"personal\s+data", re.I), re.compile(r"data\s+protection", re.I), re.compile(r"data\s+breach", re.I), re.compile(r"HIPAA", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:DATA\s+PROTECT|DATA\s+PROCESS)", re.I)},
    {"type": "governing_law", "patterns": [re.compile(r"governed\s+by", re.I), re.compile(r"governing\s+law", re.I), re.compile(r"jurisdiction", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:GOVERNING|JURISDICTION)", re.I)},
    {"type": "force_majeure", "patterns": [re.compile(r"force\s+majeure", re.I), re.compile(r"beyond.*reasonable\s+control", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:FORCE\s+MAJEURE)", re.I)},
    {"type": "auto_renewal", "patterns": [re.compile(r"auto.*renew", re.I), re.compile(r"automatically\s+renew", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:RENEWAL|AUTO)", re.I)},
    {"type": "sla", "patterns": [re.compile(r"uptime", re.I), re.compile(r"service\s+level", re.I), re.compile(r"service\s+credits", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:SERVICE\s+LEVEL|UPTIME|SLA)", re.I)},
    {"type": "scope", "patterns": [re.compile(r"scope\s+of\s+(?:work|services)", re.I), re.compile(r"shall\s+provide", re.I)], "section_pattern": re.compile(r"(\d+(?:\.\d+)?)\s*\.?\s*(?:SCOPE)", re.I)},
]


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def extract_clauses(text: str, contract_type: str | None = None) -> dict[str, Any]:
    clauses: list[dict[str, str]] = []
    sentences = re.split(r"(?<=[.!?])\s+", text)

    for clause_def in CLAUSE_PATTERNS:
        for sentence in sentences:
            for pattern in clause_def["patterns"]:
                if pattern.search(sentence):
                    section_match = clause_def["section_pattern"].search(text)
                    section = section_match.group(1) if section_match else "N/A"
                    trimmed = sentence.strip()[:200]
                    if not any(c["type"] == clause_def["type"] and c["text"] == trimmed for c in clauses):
                        clauses.append({"type": clause_def["type"], "text": trimmed, "section": section})
                    break

    confidence = min(0.98, 0.7 + len(clauses) * 0.03) if clauses else 0.5
    return {"clauses": clauses, "confidence": confidence}


def identify_parties(text: str) -> dict[str, Any]:
    parties: list[str] = []
    roles: list[dict[str, str]] = []

    m = re.search(
        r'between\s+(.+?)\s*(?:,\s*a\s+.+?\s*)?(?:\("(.+?)"\)\s*)?(?:,?\s*and\s+)(.+?)\s*(?:,\s*a\s+.+?\s*)?(?:\("(.+?)"\))',
        text, re.I,
    )
    if m:
        party1, role1, party2, role2 = m.group(1).strip(), m.group(2) or "Party A", m.group(3).strip(), m.group(4) or "Party B"
        parties.extend([party1, party2])
        roles.extend([{"name": party1, "role": role1}, {"name": party2, "role": role2}])

    for nm in re.finditer(r"Name:\s*(.+)", text, re.I):
        name = nm.group(1).strip()
        if name not in parties:
            roles.append({"name": name, "role": "Signatory"})

    return {"parties": parties, "roles": roles}


def extract_dates_values(text: str) -> dict[str, Any]:
    date_pattern = re.compile(
        r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}",
        re.I,
    )
    dates = list(dict.fromkeys(m.group(0) for m in date_pattern.finditer(text)))

    value_pattern = re.compile(r"\$[\d,]+(?:\.\d{2})?(?:\s*\([^)]+\))?")
    values = list(dict.fromkeys(m.group(0) for m in value_pattern.finditer(text)))

    return {"dates": dates, "values": values}


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_extract_clauses(text: str, contract_type: str = "") -> str:
    """Extract key clauses from a contract."""
    return json.dumps(extract_clauses(text, contract_type or None))


@mcp.tool()
def tool_identify_parties(text: str) -> str:
    """Identify all parties involved in a contract."""
    return json.dumps(identify_parties(text))


@mcp.tool()
def tool_extract_dates_values(text: str) -> str:
    """Extract key dates and monetary values from a contract."""
    return json.dumps(extract_dates_values(text))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route, Mount

    port = int(os.environ.get("MCP_EXTRACTION_PORT", "9002"))
    mcp.settings.port = port

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[
        Route("/health", health),
        Mount("/", app=mcp.sse_app()),
    ])
    uvicorn.run(app, host="127.0.0.1", port=port)
