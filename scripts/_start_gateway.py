"""Start the gateway with a fresh Foundry bearer token."""
import os
import sys

# Get token from azure-identity
try:
    from azure.identity import AzureCliCredential
    token = AzureCliCredential().get_token("https://ai.azure.com/.default").token
    print(f"Got bearer token via AzureCliCredential (len={len(token)})")
except Exception as e:
    print(f"AzureCliCredential failed: {e}")
    # Try reading from file
    token_file = os.path.join(os.path.dirname(__file__), "_token.txt")
    if os.path.exists(token_file):
        token = open(token_file).read().strip()
        print(f"Got bearer token from file (len={len(token)})")
    else:
        print("No token available!")
        sys.exit(1)

os.environ["FOUNDRY_BEARER_TOKEN"] = token
os.environ["DEPLOY_ADMIN_KEY"] = "local-dev-key"

port = os.environ.get("GATEWAY_PORT", "8000")
os.environ["GATEWAY_PORT"] = port

# Ensure workspace root is on sys.path for uvicorn import
workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(workspace_root)
sys.path.insert(0, workspace_root)

import uvicorn
uvicorn.run("gateway.python.main:app", host="0.0.0.0", port=int(port), log_level="info")
