"""Check traces and audit for the last pipeline run."""
import httpx
import json
import sys

BASE = "http://localhost:8099"
CID = sys.argv[1] if len(sys.argv) > 1 else "contract-047e4231"

# Check traces
print("=== Traces ===")
r = httpx.get(f"{BASE}/api/v1/traces/{CID}", timeout=10)
print(f"Traces endpoint: {r.status_code}")
if r.status_code == 200:
    traces = r.json() if isinstance(r.json(), list) else []
    print(f"Found {len(traces)} traces for {CID}")
    for t in traces:
        agent = t.get("agent", "?")
        lat = t.get("latency_ms", "?")
        out = t.get("output", {})
        print(f"  {agent}: latency={lat}ms, output_keys={list(out.keys())[:6]}")
        # Show first-level values for intake to debug mapping
        if agent == "intake":
            print(f"    INTAKE RESULT: {json.dumps(out, indent=2, default=str)[:500]}")
else:
    print(f"  Response: {r.text[:300]}")

# Check audit
print("\n=== Audit ===")
r = httpx.get(f"{BASE}/api/v1/audit", timeout=10)
print(f"Audit endpoint: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    if isinstance(data, list):
        entries = [e for e in data if e.get("contract_id") == CID]
    elif isinstance(data, dict):
        entries = data.get("entries", data.get("data", []))
        entries = [e for e in entries if e.get("contract_id") == CID]
    else:
        entries = []
    print(f"Found {len(entries)} audit entries for {CID}")
    for e in entries:
        agent = e.get("agent", "?")
        action = e.get("action", "?")
        detail = e.get("detail", "?")
        print(f"  {agent}: {action} - {detail}")
