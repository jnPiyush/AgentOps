#!/usr/bin/env python3
"""Deploy contract agents to Azure AI Foundry.

Simplified Python alternative to gateway/src/services/foundryDeploy.ts.
Reads the same config/agents/*.yaml definitions and prompts/*.md files,
then registers each agent as an Assistant on Azure AI Foundry.

Usage:
    # Live deployment (requires FOUNDRY_ENDPOINT + FOUNDRY_API_KEY):
    python scripts/deploy/foundry_deploy.py

    # Simulated (no Azure credentials needed):
    python scripts/deploy/foundry_deploy.py --simulate

    # Cleanup previously deployed agents:
    python scripts/deploy/foundry_deploy.py --cleanup <id1> <id2> ...
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import yaml

# ---------------------------------------------------------------------------
# Paths (relative to repo root, same as the TS version)
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_CONFIG_DIR = REPO_ROOT / "config" / "agents"
PROMPTS_DIR = REPO_ROOT / "prompts"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AGENT_API_VERSION = "2025-05-15-preview"
DEPLOY_API_VERSION = "2024-10-21"
REQUEST_TIMEOUT = 300  # seconds

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("foundry_deploy")

# ---------------------------------------------------------------------------
# Default evaluation prompts (same as the TS version)
# ---------------------------------------------------------------------------

DEFAULT_EVAL_PROMPTS: dict[str, str] = {
    "intake": (
        'Classify this agreement: "This Non-Disclosure Agreement is entered '
        "into between Acme Corp and Beta Inc, effective January 1, 2025, "
        'for two years."'
    ),
    "drafting": (
        "Assemble a first-pass draft package for this vendor services contract "
        "and recommend approved clause language for the indemnification section."
    ),
    "extraction": (
        "Extract all key clauses, parties, dates, and monetary values from "
        'this agreement: "This Master Services Agreement between TechCorp '
        "and ClientCo is effective January 1, 2025, with a total contract "
        'value of $500,000 USD and auto-renewal every 12 months."'
    ),
    "review": (
        "Summarize the internal redlines for a vendor contract and identify "
        "the top three items that need legal review before compliance routing."
    ),
    "compliance": (
        'Assess this clause for policy risk: "Vendor liability is capped at '
        "$10,000,000 and personal data may be transferred outside approved "
        'jurisdictions."'
    ),
    "negotiation": (
        "Assess counterparty markup that removes audit rights and increases "
        "termination notice periods, then recommend fallback language for "
        "the negotiator."
    ),
    "approval": (
        'Route this contract for approval: "The contract includes a data '
        "transfer exception, a high liability cap, and two unresolved "
        'compliance warnings."'
    ),
    "signature": (
        "Track the signature status for the NDA between Acme Corp and Beta "
        "Inc and send a reminder to the missing signatory."
    ),
    "obligations": (
        "Convert the final NDA commitments into tracked obligations with "
        "owners and due dates."
    ),
    "renewal": (
        "Analyze the upcoming renewal for Service Agreement SA-2025 and flag "
        "any drift from the original baseline."
    ),
    "analytics": (
        "Run a baseline evaluation on the intake agent and compare it with "
        "the last known accuracy benchmark."
    ),
}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class DeployConfig:
    """Mirrors FoundryDeployConfig in the TS version."""

    endpoint: str
    project_endpoint: str
    api_key: str
    model: str
    _bearer_token: str | None = field(default=None, repr=False)

    @property
    def agent_endpoint(self) -> str:
        return self.project_endpoint or self.endpoint

    @property
    def bearer_token(self) -> str | None:
        """Obtain an Azure AD token for the Agent Service endpoint."""
        if self._bearer_token is not None:
            return self._bearer_token

        # 1. Check if a token was passed via environment
        env_token = os.environ.get("FOUNDRY_BEARER_TOKEN", "")
        if env_token:
            self._bearer_token = env_token
            return self._bearer_token

        # 2. Try Azure CLI credential (most common for local dev)
        scope = "https://ai.azure.com/.default"
        try:
            from azure.identity import AzureCliCredential
            credential = AzureCliCredential()
            token = credential.get_token(scope)
            self._bearer_token = token.token
            log.info("Obtained Azure AD token via Azure CLI")
            return self._bearer_token
        except Exception:
            pass

        # 3. Fallback to full DefaultAzureCredential chain
        try:
            from azure.identity import DefaultAzureCredential
            credential = DefaultAzureCredential()
            token = credential.get_token(scope)
            self._bearer_token = token.token
            log.info("Obtained Azure AD token via DefaultAzureCredential")
            return self._bearer_token
        except Exception as exc:
            log.warning("Failed to obtain Azure AD token: %s", exc)
            return None


@dataclass
class AgentDef:
    """One agent loaded from config/agents/*.yaml."""

    key: str
    name: str
    prompt_file: str
    tools: list[str]
    eval_prompt: str


@dataclass
class StageResult:
    name: str
    status: str  # "passed" | "failed" | "skipped"
    duration_ms: int
    details: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass
class AgentInfo:
    agent_name: str
    foundry_agent_id: str
    model: str
    status: str  # "registered" | "failed"
    tools_count: int


# ---------------------------------------------------------------------------
# YAML loader  (reads the same config/agents/*.yaml files as TS)
# ---------------------------------------------------------------------------


def load_agent_defs() -> list[AgentDef]:
    """Load all agent definitions from config/agents/*.yaml."""
    if not AGENTS_CONFIG_DIR.is_dir():
        log.warning("Agent config directory not found: %s", AGENTS_CONFIG_DIR)
        return []

    defs: list[AgentDef] = []
    for path in sorted(AGENTS_CONFIG_DIR.glob("*.yaml")):
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not raw or "agent_id" not in raw:
            continue

        key = str(raw["agent_id"])
        name = str(raw.get("name", key))

        # Derive prompt filename from prompts.system_prompt path
        prompts = raw.get("prompts") or {}
        if prompts.get("system_prompt"):
            prompt_file = Path(prompts["system_prompt"]).name
        else:
            prompt_file = f"{key.replace('_', '-')}-system.md"

        tool_bindings = raw.get("tools") or []
        tools = [str(t["name"]) for t in tool_bindings if "name" in t]

        eval_prompt = DEFAULT_EVAL_PROMPTS.get(
            key, f"Evaluate the {name} with a representative contract scenario."
        )
        defs.append(AgentDef(key, name, prompt_file, tools, eval_prompt))

    log.info("Loaded %d agent definitions from YAML", len(defs))
    return defs


def load_prompt(filename: str) -> str:
    """Read a system prompt from prompts/."""
    path = PROMPTS_DIR / filename
    if path.is_file():
        return path.read_text(encoding="utf-8")
    log.warning("Prompt file not found: %s  (using fallback)", path)
    return "Contract processing agent."


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _headers(api_key: str) -> dict[str, str]:
    return {"api-key": api_key, "Content-Type": "application/json"}


def _agent_headers(cfg: DeployConfig) -> dict[str, str]:
    """Headers for the Agent Service endpoint.

    Uses Azure AD Bearer token (required by .services.ai.azure.com),
    falls back to api-key if token is unavailable.
    """
    token = cfg.bearer_token
    if token:
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    return _headers(cfg.api_key)


def _resolve_headers(cfg: DeployConfig, endpoint: str) -> dict[str, str]:
    """Pick the right auth headers based on which endpoint is being called."""
    if "services.ai.azure.com" in endpoint:
        return _agent_headers(cfg)
    return _headers(cfg.api_key)


def foundry_get(
    client: httpx.Client, cfg: DeployConfig, endpoint: str, path: str
) -> httpx.Response:
    url = endpoint.rstrip("/") + path
    return client.get(url, headers=_resolve_headers(cfg, endpoint), timeout=REQUEST_TIMEOUT)


def foundry_post(
    client: httpx.Client,
    cfg: DeployConfig,
    endpoint: str,
    path: str,
    body: dict[str, Any],
) -> httpx.Response:
    url = endpoint.rstrip("/") + path
    return client.post(
        url,
        headers=_resolve_headers(cfg, endpoint),
        json=body,
        timeout=REQUEST_TIMEOUT,
    )


def foundry_delete(
    client: httpx.Client, cfg: DeployConfig, endpoint: str, path: str
) -> httpx.Response:
    url = endpoint.rstrip("/") + path
    return client.delete(url, headers=_resolve_headers(cfg, endpoint), timeout=REQUEST_TIMEOUT)


# ---------------------------------------------------------------------------
# Stage 1 -- Preflight
# ---------------------------------------------------------------------------


def stage_preflight(client: httpx.Client, cfg: DeployConfig) -> StageResult:
    """Verify API connectivity by listing available models."""
    t0 = time.monotonic()
    try:
        res = foundry_get(
            client,
            cfg,
            cfg.endpoint,
            f"/openai/models?api-version={DEPLOY_API_VERSION}",
        )
        if res.status_code != 200:
            return StageResult(
                "Preflight",
                "failed",
                _elapsed(t0),
                error=f"API access denied ({res.status_code}): {res.text[:200]}",
            )
        data = res.json()
        models_found = len(data.get("data", []))
        return StageResult(
            "Preflight",
            "passed",
            _elapsed(t0),
            details={"endpoint_reachable": True, "models_found": models_found},
        )
    except Exception as exc:
        return StageResult("Preflight", "failed", _elapsed(t0), error=str(exc))


# ---------------------------------------------------------------------------
# Stage 2 -- Model Verification
# ---------------------------------------------------------------------------


def stage_verify_model(client: httpx.Client, cfg: DeployConfig) -> StageResult:
    """Send a minimal chat completion to confirm the model is deployed."""
    t0 = time.monotonic()
    try:
        res = foundry_post(
            client,
            cfg,
            cfg.endpoint,
            f"/openai/deployments/{cfg.model}/chat/completions"
            f"?api-version={DEPLOY_API_VERSION}",
            {"messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
        )
        if res.status_code == 200:
            data = res.json()
            return StageResult(
                "Model Deployment",
                "passed",
                _elapsed(t0),
                details={
                    "deployment_name": cfg.model,
                    "model": data.get("model", cfg.model),
                    "status": "succeeded",
                },
            )
        if res.status_code == 404:
            return StageResult(
                "Model Deployment",
                "failed",
                _elapsed(t0),
                error=f"Model deployment '{cfg.model}' not found. "
                "Provision it in the Azure deployment workflow first.",
            )
        return StageResult(
            "Model Deployment",
            "failed",
            _elapsed(t0),
            error=f"Model check failed ({res.status_code}). Verify API permissions.",
        )
    except Exception as exc:
        return StageResult("Model Deployment", "failed", _elapsed(t0), error=str(exc))


# ---------------------------------------------------------------------------
# Stage 3 -- Agent Registration (idempotent)
# ---------------------------------------------------------------------------


def _build_tools(agent_def: AgentDef) -> list[dict[str, Any]]:
    """Build Assistants API function tool definitions."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool,
                "description": f"Registered MCP tool for {agent_def.name}: {tool}",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        }
        for tool in agent_def.tools
    ]


def _bootstrap_agent_framework() -> Any:
    """Bootstrap the Microsoft Agent Framework so AgentFactory is importable."""
    import importlib
    import importlib.util
    import types

    fw_dir = REPO_ROOT / "agents" / "microsoft-framework"
    if "_fw" in sys.modules:
        return sys.modules["_fw.agents"]

    _fw_pkg = types.ModuleType("_fw")
    _fw_pkg.__path__ = [str(fw_dir)]
    _fw_pkg.__package__ = "_fw"
    sys.modules["_fw"] = _fw_pkg

    for mod_name in ("config", "agents", "workflows"):
        mod_file = fw_dir / f"{mod_name}.py"
        if mod_file.exists():
            spec = importlib.util.spec_from_file_location(f"_fw.{mod_name}", str(mod_file))
            mod = importlib.util.module_from_spec(spec)
            mod.__package__ = "_fw"
            sys.modules[f"_fw.{mod_name}"] = mod
            setattr(_fw_pkg, mod_name, mod)

    sys.modules["_fw.config"].__spec__.loader.exec_module(sys.modules["_fw.config"])
    sys.modules["_fw.agents"].__spec__.loader.exec_module(sys.modules["_fw.agents"])
    return sys.modules["_fw.agents"]


def stage_register_agents(
    client: httpx.Client, cfg: DeployConfig, agent_defs: list[AgentDef]
) -> tuple[StageResult, list[AgentInfo]]:
    """Register agents on Azure AI Foundry Agent Service via /assistants API.

    Falls back to local Microsoft Agent Framework if the API is unavailable.
    """
    t0 = time.monotonic()
    agents: list[AgentInfo] = []
    errors: list[str] = []

    # ---------- Try Foundry Agent Service API first ----------
    ep = cfg.agent_endpoint
    log.info("Registering agents via Foundry Agent Service: %s", ep)

    # Discover existing agents to enable idempotent re-runs
    existing_map: dict[str, str] = {}
    api_available = True
    try:
        res = foundry_get(
            client, cfg, ep, f"/assistants?api-version={AGENT_API_VERSION}&limit=100"
        )
        if res.status_code == 200:
            for asst in res.json().get("data", []):
                meta = (
                    (asst.get("versions") or {})
                    .get("latest", {})
                    .get("definition", {})
                    .get("metadata")
                ) or asst.get("metadata") or {}
                if meta.get("domain") == "contract-management":
                    existing_map[asst["name"]] = asst["id"]
        else:
            log.warning("GET /assistants returned %d -- will try POST per agent", res.status_code)
    except Exception as exc:
        log.warning("Failed to list assistants (%s) -- will try POST per agent", exc)

    log.info("Found %d existing contract-management agents", len(existing_map))

    first_failure_status: int | None = None
    for defn in agent_defs:
        # Re-use existing agent
        if defn.name in existing_map:
            log.info("  REUSED  %-30s id=%s", defn.name, existing_map[defn.name])
            agents.append(
                AgentInfo(defn.name, existing_map[defn.name], cfg.model, "registered", len(defn.tools))
            )
            continue

        instructions = load_prompt(defn.prompt_file)
        body = {
            "model": cfg.model,
            "name": defn.name,
            "description": f"Contract AgentOps - {defn.name}",
            "instructions": instructions,
            "tools": _build_tools(defn),
            "temperature": 0.1,
            "metadata": {
                "domain": "contract-management",
                "pipeline_role": defn.key,
                "mcp_tools": ",".join(defn.tools),
                "version": "1.0",
            },
        }
        try:
            res = foundry_post(
                client, cfg, ep, f"/assistants?api-version={AGENT_API_VERSION}", body
            )
            if res.status_code in (200, 201):
                aid = res.json()["id"]
                log.info("  CREATED %-30s id=%s", defn.name, aid)
                agents.append(AgentInfo(defn.name, aid, cfg.model, "registered", len(defn.tools)))
            else:
                if first_failure_status is None:
                    first_failure_status = res.status_code
                msg = f"{defn.name}: {res.status_code} - {res.text[:150]}"
                log.error("  FAILED  %s", msg)
                errors.append(msg)
                agents.append(AgentInfo(defn.name, "", cfg.model, "failed", len(defn.tools)))
                # If 403 on the very first agent, abort API path early
                if res.status_code == 403 and len(agents) == 1:
                    api_available = False
                    break
        except Exception as exc:
            errors.append(f"{defn.name}: {exc}")
            agents.append(AgentInfo(defn.name, "", cfg.model, "failed", len(defn.tools)))

    # ---------- Fallback: local Microsoft Agent Framework ----------
    failed_agents = [a for a in agents if a.status == "failed"]
    if not api_available or (failed_agents and first_failure_status == 403):
        log.warning(
            "Foundry API returned 403 -- falling back to Microsoft Agent Framework"
        )
        # Clear the failed agents list and retry all via framework
        agents.clear()
        errors.clear()
        try:
            fw_agents = _bootstrap_agent_framework()
            AgentFactory = getattr(fw_agents, "AgentFactory")
            DeclarativeContractAgent = getattr(fw_agents, "DeclarativeContractAgent")
            log.info("Using Microsoft Agent Framework for agent registration (fallback)")

            available = set(AgentFactory.list_available_agents())
            for defn in agent_defs:
                try:
                    if defn.key in available:
                        agent_obj = AgentFactory.create_agent(defn.key)
                    else:
                        agent_obj = DeclarativeContractAgent(defn.key)
                    agent_id = f"fw_{defn.key}_{uuid.uuid4().hex[:8]}"
                    log.info("  REGISTERED %-30s id=%s (framework)", defn.name, agent_id)
                    agents.append(AgentInfo(defn.name, agent_id, cfg.model, "registered", len(defn.tools)))
                except Exception as exc:
                    msg = f"{defn.name}: {exc}"
                    log.error("  FAILED  %s", msg)
                    errors.append(msg)
                    agents.append(AgentInfo(defn.name, "", cfg.model, "failed", len(defn.tools)))
        except Exception as fw_exc:
            log.error("Agent Framework also unavailable: %s", fw_exc)

    registered = sum(1 for a in agents if a.status == "registered")
    framework_used = any(a.foundry_agent_id.startswith("fw_") for a in agents if a.status == "registered")
    return (
        StageResult(
            "Agent Registration",
            "passed" if registered > 0 else "failed",
            _elapsed(t0),
            details={
                "registered": registered,
                "total": len(agents),
                "framework": "microsoft-agent-framework" if framework_used else "foundry-agent-service",
                "tool_definitions_registered": sum(len(d.tools) for d in agent_defs),
            },
            error="; ".join(errors) if errors else None,
        ),
        agents,
    )


# ---------------------------------------------------------------------------
# Stage 4 -- Content Safety Verification
# ---------------------------------------------------------------------------


def stage_content_safety(client: httpx.Client, cfg: DeployConfig) -> StageResult:
    """Verify that content safety filters are active on the deployment."""
    t0 = time.monotonic()
    try:
        res = foundry_post(
            client,
            cfg,
            cfg.endpoint,
            f"/openai/deployments/{cfg.model}/chat/completions"
            f"?api-version={DEPLOY_API_VERSION}",
            {
                "messages": [
                    {"role": "system", "content": "Reply with OK."},
                    {"role": "user", "content": "Test: verify content safety filters are active."},
                ],
                "max_tokens": 5,
                "temperature": 0,
            },
        )
        if res.status_code == 400 and "content_filter" in res.text:
            return StageResult(
                "Content Safety", "passed", _elapsed(t0),
                details={"filters_active": True, "triggered_on_test": True},
            )
        if res.status_code != 200:
            return StageResult(
                "Content Safety", "failed", _elapsed(t0),
                error=f"Safety verification failed ({res.status_code})",
            )
        data = res.json()
        has_filters = (
            data.get("choices", [{}])[0].get("content_filter_results") is not None
        )
        return StageResult(
            "Content Safety",
            "passed" if has_filters else "failed",
            _elapsed(t0),
            details={"filters_active": has_filters},
            error=None if has_filters else "Content filters not detected on deployment.",
        )
    except Exception as exc:
        return StageResult("Content Safety", "failed", _elapsed(t0), error=str(exc))


# ---------------------------------------------------------------------------
# Stage 5 -- Quick Evaluation
# ---------------------------------------------------------------------------


def _eval_framework_agent(defn: AgentDef) -> bool:
    """Evaluate a framework-registered agent locally via AgentFactory."""
    import asyncio
    try:
        fw_agents = _bootstrap_agent_framework()
        AgentFactory = getattr(fw_agents, "AgentFactory")
        DeclarativeAgent = getattr(fw_agents, "DeclarativeContractAgent")
        available = set(AgentFactory.list_available_agents())
        if defn.key in available:
            agent_obj = AgentFactory.create_agent(defn.key)
        else:
            agent_obj = DeclarativeAgent(defn.key)
        result = asyncio.new_event_loop().run_until_complete(
            agent_obj.execute({"prompt": defn.eval_prompt})
        )
        return result is not None and len(str(result)) > 0
    except Exception:
        return False


def stage_evaluation(
    client: httpx.Client,
    cfg: DeployConfig,
    agents: list[AgentInfo],
    agent_defs: list[AgentDef],
) -> StageResult:
    """Run a quick eval for each registered agent.

    Framework agents (fw_* IDs) are evaluated locally via AgentFactory.
    Foundry agents are evaluated via the /threads + /runs API.
    """
    t0 = time.monotonic()
    ep = cfg.agent_endpoint
    registered = [a for a in agents if a.status == "registered"]
    if not registered:
        return StageResult("Evaluation", "skipped", _elapsed(t0), error="No agents to evaluate")

    passed = 0
    failures: list[str] = []
    defs_by_name = {d.name: d for d in agent_defs}

    for agent in registered:
        defn = defs_by_name.get(agent.agent_name)
        if not defn:
            failures.append(f"{agent.agent_name}: missing eval definition")
            continue

        # Framework-registered agents: evaluate locally
        if agent.foundry_agent_id.startswith("fw_"):
            if _eval_framework_agent(defn):
                passed += 1
                log.info("  EVAL PASS  %s (framework)", agent.agent_name)
            else:
                failures.append(f"{agent.agent_name}: framework eval returned empty")
                log.warning("  EVAL FAIL  %s (framework)", agent.agent_name)
            continue

        # Foundry-registered agents: evaluate via /threads + /runs API
        try:
            tres = foundry_post(client, cfg, ep, f"/threads?api-version={AGENT_API_VERSION}", {})
            if tres.status_code not in (200, 201):
                failures.append(f"{agent.agent_name}: thread creation failed ({tres.status_code})")
                continue
            tid = tres.json()["id"]

            foundry_post(
                client, cfg, ep,
                f"/threads/{tid}/messages?api-version={AGENT_API_VERSION}",
                {"role": "user", "content": defn.eval_prompt},
            )

            rres = foundry_post(
                client, cfg, ep,
                f"/threads/{tid}/runs?api-version={AGENT_API_VERSION}",
                {"assistant_id": agent.foundry_agent_id},
            )
            if rres.status_code not in (200, 201):
                failures.append(f"{agent.agent_name}: run failed ({rres.status_code})")
                _try_delete_thread(client, cfg, ep, tid)
                continue
            run = rres.json()
            rid, status = run["id"], run["status"]

            for _ in range(15):
                if status in ("completed", "failed", "cancelled"):
                    break
                time.sleep(2)
                pres = foundry_get(
                    client, cfg, ep,
                    f"/threads/{tid}/runs/{rid}?api-version={AGENT_API_VERSION}",
                )
                if pres.status_code == 200:
                    status = pres.json()["status"]

            _try_delete_thread(client, cfg, ep, tid)

            if status == "completed":
                passed += 1
            else:
                failures.append(f"{agent.agent_name}: run ended with status {status}")
        except Exception as exc:
            failures.append(f"{agent.agent_name}: {exc}")

    total = len(registered)
    return StageResult(
        "Evaluation",
        "passed" if passed > 0 else "failed",
        _elapsed(t0),
        details={
            "test_count": total,
            "passed": passed,
            "accuracy": round(passed / total * 100) if total else 0,
            "agents_tested": total,
        },
        error="; ".join(failures) if failures else None,
    )


def _try_delete_thread(
    client: httpx.Client, cfg: DeployConfig, ep: str, tid: str
) -> None:
    try:
        foundry_delete(client, cfg, ep, f"/threads/{tid}?api-version={AGENT_API_VERSION}")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Stage 6 -- Health Check
# ---------------------------------------------------------------------------


def stage_health_check(
    client: httpx.Client, cfg: DeployConfig, agents: list[AgentInfo]
) -> StageResult:
    """Verify each registered agent is retrievable.

    Framework agents (fw_* IDs) are verified by re-instantiating via AgentFactory.
    Foundry agents are verified via GET /assistants/{id}.
    """
    t0 = time.monotonic()
    ep = cfg.agent_endpoint
    registered = [a for a in agents if a.status == "registered"]
    if not registered:
        return StageResult("Health Check", "skipped", _elapsed(t0), error="No agents to verify")

    healthy = 0
    for agent in registered:
        # Framework-registered agents: verify via AgentFactory
        if agent.foundry_agent_id.startswith("fw_"):
            try:
                fw_agents = _bootstrap_agent_framework()
                AgentFactory = getattr(fw_agents, "AgentFactory")
                DeclarativeAgent = getattr(fw_agents, "DeclarativeContractAgent")
                key = agent.foundry_agent_id.split("_")[1]
                available = set(AgentFactory.list_available_agents())
                if key in available:
                    AgentFactory.create_agent(key)
                else:
                    DeclarativeAgent(key)
                healthy += 1
            except Exception:
                pass
            continue

        # Foundry-registered agents: verify via GET /assistants/{id}
        try:
            res = foundry_get(
                client, cfg, ep,
                f"/assistants/{agent.foundry_agent_id}?api-version={AGENT_API_VERSION}",
            )
            if res.status_code == 200:
                healthy += 1
        except Exception:
            pass

    return StageResult(
        "Health Check",
        "passed" if healthy == len(registered) else "failed",
        _elapsed(t0),
        details={"healthy": healthy, "total": len(registered)},
    )


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------


def cleanup_agents(
    client: httpx.Client, cfg: DeployConfig, agent_ids: list[str]
) -> tuple[int, list[str]]:
    """Delete agents by ID. Returns (deleted_count, errors)."""
    ep = cfg.agent_endpoint
    deleted = 0
    errors: list[str] = []
    for aid in agent_ids:
        try:
            res = foundry_delete(
                client, cfg, ep, f"/assistants/{aid}?api-version={AGENT_API_VERSION}"
            )
            if res.status_code in (200, 204, 404):
                deleted += 1
            else:
                errors.append(f"{aid}: HTTP {res.status_code}")
        except Exception as exc:
            errors.append(f"{aid}: {exc}")
    return deleted, errors


# ---------------------------------------------------------------------------
# Simulated deploy  (no Azure credentials needed)
# ---------------------------------------------------------------------------


def simulated_deploy(agent_defs: list[AgentDef]) -> dict[str, Any]:
    """Return a realistic-looking deploy result without calling Azure."""
    agents = [
        {
            "agent_name": d.name,
            "foundry_agent_id": f"agent_sim_{uuid.uuid4().hex[:12]}",
            "model": "gpt-5.4",
            "status": "registered",
            "tools_count": len(d.tools),
        }
        for d in agent_defs
    ]
    return {
        "pipeline_id": f"deploy-{uuid.uuid4().hex[:8]}",
        "mode": "simulated",
        "stages": [
            {"name": "Preflight", "status": "passed", "duration_ms": 320},
            {"name": "Model Deployment", "status": "passed", "duration_ms": 180},
            {"name": "Agent Registration", "status": "passed", "duration_ms": 2400},
            {"name": "Content Safety", "status": "passed", "duration_ms": 450},
            {"name": "Evaluation", "status": "passed", "duration_ms": 3200},
            {"name": "Health Check", "status": "passed", "duration_ms": 600},
        ],
        "agents": agents,
        "summary": {
            "agents_deployed": len(agents),
            "tools_registered": sum(a["tools_count"] for a in agents),
            "errors": 0,
        },
    }


# ---------------------------------------------------------------------------
# Full live pipeline
# ---------------------------------------------------------------------------


def deploy_live(cfg: DeployConfig) -> dict[str, Any]:
    """Run the 6-stage deploy pipeline against Azure AI Foundry."""
    pipeline_id = f"deploy-{uuid.uuid4().hex[:8]}"
    stages: list[StageResult] = []
    agents: list[AgentInfo] = []

    with httpx.Client() as client:
        # Stage 1
        s1 = stage_preflight(client, cfg)
        stages.append(s1)
        _log_stage(1, s1)
        if s1.status == "failed":
            return _build_result(pipeline_id, stages, agents)

        # Stage 2
        s2 = stage_verify_model(client, cfg)
        stages.append(s2)
        _log_stage(2, s2)
        if s2.status == "failed":
            return _build_result(pipeline_id, stages, agents)

        # Stage 3
        agent_defs = load_agent_defs()
        s3, agents = stage_register_agents(client, cfg, agent_defs)
        stages.append(s3)
        _log_stage(3, s3)

        # Stage 4
        s4 = stage_content_safety(client, cfg)
        stages.append(s4)
        _log_stage(4, s4)

        # Stage 5
        s5 = stage_evaluation(client, cfg, agents, agent_defs)
        stages.append(s5)
        _log_stage(5, s5)

        # Stage 6
        s6 = stage_health_check(client, cfg, agents)
        stages.append(s6)
        _log_stage(6, s6)

    return _build_result(pipeline_id, stages, agents)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _elapsed(t0: float) -> int:
    return int((time.monotonic() - t0) * 1000)


def _log_stage(num: int, s: StageResult) -> None:
    msg = f"Stage {num} {s.name}: {s.status} ({s.duration_ms}ms)"
    if s.error:
        msg += f"  -- {s.error}"
    if s.status == "failed":
        log.error(msg)
    else:
        log.info(msg)


def _build_result(
    pipeline_id: str, stages: list[StageResult], agents: list[AgentInfo]
) -> dict[str, Any]:
    registered = [a for a in agents if a.status == "registered"]
    return {
        "pipeline_id": pipeline_id,
        "mode": "live",
        "stages": [
            {
                "name": s.name,
                "status": s.status,
                "duration_ms": s.duration_ms,
                "details": s.details,
                **({"error": s.error} if s.error else {}),
            }
            for s in stages
        ],
        "agents": [
            {
                "agent_name": a.agent_name,
                "foundry_agent_id": a.foundry_agent_id,
                "model": a.model,
                "status": a.status,
                "tools_count": a.tools_count,
            }
            for a in agents
        ],
        "summary": {
            "agents_deployed": len(registered),
            "tools_registered": sum(a.tools_count for a in registered),
            "errors": sum(1 for s in stages if s.status == "failed"),
            "total_duration_ms": sum(s.duration_ms for s in stages),
        },
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Deploy contract agents to Azure AI Foundry"
    )
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Run in simulated mode (no Azure credentials needed)",
    )
    parser.add_argument(
        "--cleanup",
        nargs="+",
        metavar="AGENT_ID",
        help="Delete previously deployed agents by ID",
    )
    parser.add_argument(
        "--json", action="store_true", help="Output raw JSON instead of summary"
    )
    args = parser.parse_args()

    # Simulated mode
    if args.simulate:
        defs = load_agent_defs()
        result = simulated_deploy(defs)
        _print_result(result, as_json=args.json)
        return

    # Load config from environment
    endpoint = os.environ.get("FOUNDRY_ENDPOINT", "")
    api_key = os.environ.get("FOUNDRY_API_KEY", "")
    project_endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT", endpoint)
    model = os.environ.get("FOUNDRY_MODEL", "gpt-5.4")

    if not endpoint:
        log.error("FOUNDRY_ENDPOINT environment variable is required")
        sys.exit(1)
    if not api_key:
        log.error("FOUNDRY_API_KEY environment variable is required")
        sys.exit(1)

    cfg = DeployConfig(
        endpoint=endpoint,
        project_endpoint=project_endpoint,
        api_key=api_key,
        model=model,
    )

    # Cleanup mode
    if args.cleanup:
        with httpx.Client() as client:
            deleted, errors = cleanup_agents(client, cfg, args.cleanup)
        log.info("Deleted %d agents, %d errors", deleted, len(errors))
        for err in errors:
            log.error("  %s", err)
        sys.exit(1 if errors else 0)

    # Live deploy
    result = deploy_live(cfg)
    _print_result(result, as_json=args.json)
    errors = result["summary"]["errors"]
    sys.exit(1 if errors > 0 else 0)


def _print_result(result: dict[str, Any], *, as_json: bool = False) -> None:
    if as_json:
        print(json.dumps(result, indent=2))
        return

    print()
    print(f"Pipeline: {result['pipeline_id']}  ({result['mode']} mode)")
    print("-" * 55)
    for s in result["stages"]:
        tag = "[PASS]" if s["status"] == "passed" else "[FAIL]" if s["status"] == "failed" else "[SKIP]"
        line = f"  {tag}  {s['name']:<22} {s.get('duration_ms', 0):>5}ms"
        print(line)
    print("-" * 55)
    summary = result["summary"]
    print(
        f"  Agents: {summary['agents_deployed']}  "
        f"Tools: {summary['tools_registered']}  "
        f"Errors: {summary['errors']}"
    )
    if result.get("agents"):
        print()
        for a in result["agents"]:
            tag = "[PASS]" if a["status"] == "registered" else "[FAIL]"
            print(f"  {tag}  {a['agent_name']:<30} {a.get('foundry_agent_id', '')}")
    print()


if __name__ == "__main__":
    main()
