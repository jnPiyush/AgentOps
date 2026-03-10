"""Microsoft Agent Framework - Contract Processing Agents

This module provides declarative contract processing agents using
Microsoft Agent Framework with production-ready patterns:

- Fully declarative agent configurations
- File-based prompt management
- Pinned model versions (gpt-5.1-2026-01-15)
- Structured outputs with Pydantic models
- OpenTelemetry tracing integration
- Human-in-the-Loop workflows
- MCP tool integration
- Quality gates and evaluation
- Sequential workflow orchestration

Usage:
    from agents.microsoft_framework import AgentFactory, WorkflowFactory
    
    # Create agents
    intake_agent = AgentFactory.create_agent("intake")
    
    # Execute workflows
    workflow = WorkflowFactory.create_standard_workflow()
    result = await workflow.execute(contract_data)
"""

from .agents import (
    AgentFactory,
    DeclarativeContractAgent,
    ContractIntakeAgent,
    ContractExtractionAgent,
    ContractComplianceAgent,
    ContractApprovalAgent,
    ContractMetadata,
    ComplianceAssessment,
    ApprovalDecision
)

from .workflows import (
    WorkflowFactory,
    ContractProcessingWorkflow,
    ConditionalContractWorkflow,
    WorkflowContext,
    WorkflowStatus,
    HITLDecision
)

from .config import (
    config,
    get_model_config,
    initialize_tracing
)

# Version and metadata
__version__ = "1.0.0"
__author__ = "Contract Processing Team"
__description__ = "Microsoft Agent Framework contract processing agents"

# Public API
__all__ = [
    # Agent classes
    "AgentFactory",
    "DeclarativeContractAgent", 
    "ContractIntakeAgent",
    "ContractExtractionAgent",
    "ContractComplianceAgent",
    "ContractApprovalAgent",
    
    # Workflow classes
    "WorkflowFactory",
    "ContractProcessingWorkflow",
    "ConditionalContractWorkflow",
    "WorkflowContext",
    "WorkflowStatus",
    "HITLDecision",
    
    # Data models
    "ContractMetadata",
    "ComplianceAssessment", 
    "ApprovalDecision",
    
    # Configuration
    "config",
    "get_model_config",
    "initialize_tracing"
]

# Module initialization
def initialize():
    """Initialize Microsoft Agent Framework module"""
    # Initialize tracing
    initialize_tracing()
    
    # Verify configuration
    try:
        if not config.foundry_endpoint:
            raise ValueError("FOUNDRY_ENDPOINT not configured")
        if not config.foundry_api_key:
            raise ValueError("FOUNDRY_API_KEY not configured")
    except (AttributeError, ValueError) as e:
        import logging
        logging.warning("Agent Framework configuration incomplete: %s", e)
        logging.warning("Set FOUNDRY_ENDPOINT and FOUNDRY_API_KEY environment variables")

# Auto-initialize when imported
initialize()