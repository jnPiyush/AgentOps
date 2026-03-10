"""Microsoft Agent Framework Configuration"""

import json
from pathlib import Path
from typing import Any, Optional
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings
from pydantic import Field


class AgentFrameworkConfig(BaseSettings):
    """Configuration for Microsoft Agent Framework agents"""
    
    # Microsoft Foundry Configuration
    foundry_endpoint: str = Field(..., env="FOUNDRY_ENDPOINT")
    foundry_api_key: str = Field(..., env="FOUNDRY_API_KEY")
    foundry_project_endpoint: Optional[str] = Field(None, env="FOUNDRY_PROJECT_ENDPOINT")
    
    # Model Configuration (Pinned Versions)
    primary_model: str = Field("gpt-5.1-2026-01-15", env="PRIMARY_MODEL")
    fallback_model: str = Field("gpt-4o-2026-01-15", env="FALLBACK_MODEL")
    emergency_model: str = Field("gpt-4o-mini-2026-01-15", env="EMERGENCY_MODEL")
    
    # Agent Configuration
    temperature: float = Field(0.0, env="AGENT_TEMPERATURE")
    max_tokens: int = Field(2048, env="AGENT_MAX_TOKENS")
    timeout_seconds: int = Field(30, env="AGENT_TIMEOUT")
    
    # Directory Paths
    project_root: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent)
    prompts_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "prompts")
    templates_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "templates")
    examples_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "examples")
    config_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "config")
    schemas_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "config" / "schemas")
    agents_config_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "config" / "agents")
    workflows_config_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "config" / "workflows")
    data_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "data")
    runtime_dir: Path = Field(default_factory=lambda: Path(__file__).parent.parent.parent / "data" / "runtime")
    
    # MCP Server Configuration
    mcp_servers: dict = Field(default_factory=lambda: {
        "contract-intake-mcp": "http://localhost:9001",
        "contract-extraction-mcp": "http://localhost:9002",
        "contract-compliance-mcp": "http://localhost:9003",
        "contract-workflow-mcp": "http://localhost:9004",
        "contract-audit-mcp": "http://localhost:9005",
        "contract-eval-mcp": "http://localhost:9006",
        "contract-drift-mcp": "http://localhost:9007",
        "contract-feedback-mcp": "http://localhost:9008"
    })
    
    # Tracing & Observability
    tracing_enabled: bool = Field(True, env="TRACING_ENABLED")
    trace_endpoint: Optional[str] = Field(None, env="TRACE_ENDPOINT")
    
    # Evaluation Configuration
    evaluation_enabled: bool = Field(True, env="EVALUATION_ENABLED")
    baseline_comparison: bool = Field(True, env="BASELINE_COMPARISON")
    
    # Human-in-the-Loop
    hitl_enabled: bool = Field(True, env="HITL_ENABLED")
    hitl_timeout_hours: int = Field(24, env="HITL_TIMEOUT_HOURS")
    legal_review_email: str = Field("legal-review@company.com", env="LEGAL_REVIEW_EMAIL")
    
    # Performance & Reliability
    max_retries: int = Field(3, env="MAX_RETRIES")
    retry_backoff_base: float = Field(1.0, env="RETRY_BACKOFF_BASE")
    circuit_breaker_threshold: int = Field(5, env="CIRCUIT_BREAKER_THRESHOLD")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global configuration instance
config = AgentFrameworkConfig()


def get_model_config(model_type: str = "primary") -> dict:
    """Get model configuration for specific model type"""
    models = {
        "primary": config.primary_model,
        "fallback": config.fallback_model,
        "emergency": config.emergency_model
    }
    
    return {
        "model": models.get(model_type, config.primary_model),
        "api_key": config.foundry_api_key,
        "endpoint": config.foundry_endpoint,
        "project_endpoint": config.foundry_project_endpoint or config.foundry_endpoint,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "timeout": config.timeout_seconds
    }


def resolve_asset_path(relative_path: str) -> Path:
    """Resolve a repo-relative declarative asset path."""
    path = Path(relative_path)
    if path.is_absolute():
        return path
    return config.project_root / path


def read_text_asset(relative_path: str) -> str:
    """Read a UTF-8 text asset from the repo."""
    asset_path = resolve_asset_path(relative_path)
    return asset_path.read_text(encoding="utf-8")


def read_json_asset(relative_path: str) -> Any:
    """Read a JSON asset from the repo."""
    asset_path = resolve_asset_path(relative_path)
    with asset_path.open("r", encoding="utf-8") as asset_file:
        return json.load(asset_file)


def get_active_workflow_package_path() -> Path:
    """Get the active workflow package path materialized by the gateway."""
    return config.runtime_dir / "active-workflow.json"


def initialize_tracing() -> Optional[object]:
    """Initialize OpenTelemetry tracing"""
    if not config.tracing_enabled:
        return
        
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    
    # Set up tracer provider
    trace.set_tracer_provider(TracerProvider())
    tracer = trace.get_tracer(__name__)
    
    # Add OTLP exporter if endpoint configured
    if config.trace_endpoint:
        otlp_exporter = OTLPSpanExporter(endpoint=config.trace_endpoint)
        span_processor = BatchSpanProcessor(otlp_exporter)
        trace.get_tracer_provider().add_span_processor(span_processor)
    
    return tracer