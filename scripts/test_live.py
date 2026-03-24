"""Quick test: set live mode and submit a contract, then check for events."""
import httpx
import time

BASE = "http://localhost:8099"
ADMIN_KEY = "local-dev-key"
HEADERS = {"x-admin-key": ADMIN_KEY}

# 1. Ensure live mode
r = httpx.post(f"{BASE}/api/v1/mode", json={"mode": "live"}, headers=HEADERS, timeout=10)
print(f"Mode: {r.status_code} {r.text}")

# 2. Submit a contract
contract_text = (
    "This Master Services Agreement (MSA) is entered into between "
    "GlobalTech Corp and Acme Solutions Inc, effective January 1, 2026, "
    "for a total contract value of $2,500,000 USD. The agreement shall "
    "remain in effect for three years with automatic renewal every 12 months. "
    "Either party may terminate with 90 days written notice."
)
r = httpx.post(
    f"{BASE}/api/v1/contracts",
    json={"text": contract_text, "filename": "test-msa.txt"},
    timeout=30,
)
print(f"Submit: {r.status_code} {r.text}")

if r.status_code != 202:
    print("FAILED to submit contract")
    raise SystemExit(1)

cid = r.json().get("contract_id")
print(f"Contract ID: {cid}")

# 3. Wait for pipeline to complete (check contracts endpoint periodically)
for i in range(30):
    time.sleep(5)
    try:
        r = httpx.get(f"{BASE}/api/v1/contracts/{cid}", timeout=5)
        if r.status_code == 200:
            data = r.json()
            status = data.get("status", "unknown")
            print(f"  [{i*5}s] status={status}")
            if status in ("approved", "awaiting_review", "failed"):
                print(f"PIPELINE_DONE: status={status}")
                break
        else:
            # Try list endpoint
            r2 = httpx.get(f"{BASE}/api/v1/contracts", timeout=5)
            if r2.status_code == 200:
                contracts = r2.json() if isinstance(r2.json(), list) else r2.json().get("contracts", [])
                for c in contracts:
                    if c.get("id") == cid:
                        status = c.get("status", "unknown")
                        print(f"  [{i*5}s] status={status}")
                        if status in ("approved", "awaiting_review", "failed"):
                            print(f"PIPELINE_DONE: status={status}")
                            break
    except Exception as e:
        print(f"  [{i*5}s] error: {e}")
else:
    print("TIMEOUT: pipeline did not complete in 150s")
