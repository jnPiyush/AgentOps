"""FastAPI gateway configuration loaded from environment variables."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

_env_file = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_file.exists():
    load_dotenv(_env_file)

DemoMode = Literal["live", "simulated"]
FoundryAuthMode = Literal["api-key", "managed-identity"]


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _port(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if not raw:
        return default
    val = int(raw)
    if val < 1 or val > 65535:
        raise ValueError(f"{key} must be 1-65535, got {raw}")
    return val


def _csv(key: str) -> list[str]:
    raw = os.environ.get(key, "").strip()
    if not raw:
        return []
    return [v.strip() for v in raw.split(",") if v.strip()]


DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
ROOT_DIR = Path(__file__).resolve().parent.parent.parent

DEMO_MODE: DemoMode = _env("DEMO_MODE", "simulated")  # type: ignore[assignment]
ALLOWED_ORIGINS: list[str] = _csv("ALLOWED_ORIGINS")
DEPLOY_ADMIN_KEY: str = _env("DEPLOY_ADMIN_KEY", "")
FOUNDRY_AUTH_MODE: FoundryAuthMode = _env("FOUNDRY_AUTH_MODE", "api-key")  # type: ignore[assignment]
FOUNDRY_API_KEY: str = _env("FOUNDRY_API_KEY", "")
FOUNDRY_ENDPOINT: str = _env("FOUNDRY_ENDPOINT", "")
FOUNDRY_PROJECT_ENDPOINT: str = _env("FOUNDRY_PROJECT_ENDPOINT", FOUNDRY_ENDPOINT)
FOUNDRY_MANAGED_IDENTITY_CLIENT_ID: str = _env("FOUNDRY_MANAGED_IDENTITY_CLIENT_ID", "")
FOUNDRY_MODEL: str = _env("FOUNDRY_MODEL", "gpt-5.4")
FOUNDRY_MODEL_SWAP: str = _env("FOUNDRY_MODEL_SWAP", "gpt-4o-mini")
LEGAL_REVIEW_EMAIL: str = _env("LEGAL_REVIEW_EMAIL", "legal-review@company.com")
GATEWAY_PORT: int = _port("GATEWAY_PORT", 8000)
MCP_BASE_PORT: int = _port("MCP_BASE_PORT", 9001)
LOG_LEVEL: str = _env("LOG_LEVEL", "INFO")

MCP_SERVERS = [
    {"name": "contract-intake-mcp", "port": MCP_BASE_PORT},
    {"name": "contract-extraction-mcp", "port": MCP_BASE_PORT + 1},
    {"name": "contract-compliance-mcp", "port": MCP_BASE_PORT + 2},
    {"name": "contract-workflow-mcp", "port": MCP_BASE_PORT + 3},
    {"name": "contract-audit-mcp", "port": MCP_BASE_PORT + 4},
    {"name": "contract-eval-mcp", "port": MCP_BASE_PORT + 5},
    {"name": "contract-drift-mcp", "port": MCP_BASE_PORT + 6},
    {"name": "contract-feedback-mcp", "port": MCP_BASE_PORT + 7},
]
