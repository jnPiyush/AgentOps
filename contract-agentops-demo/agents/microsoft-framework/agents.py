"""Microsoft Agent Framework - Declarative Contract Agents"""

import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from opentelemetry import trace
from pydantic import BaseModel, Field

from .config import config, get_model_config, initialize_tracing

# Mock implementations for Microsoft Agent Framework classes
class Tool(BaseModel):
    """Mock Tool class for framework compatibility"""
    name: str
    description: str
    parameters: Dict[str, Any] = Field(default_factory=dict)

class AgentConfig(BaseModel):
    """Mock AgentConfig class for framework compatibility"""
    name: str
    model: str
    temperature: float = 0.0
    max_tokens: int = 1000

class OpenAIChatClient:
    """Mock OpenAI client for framework compatibility"""
    def __init__(self, api_key: str, base_url: str, model: str, 
                 temperature: float = 0.0, max_tokens: int = 1000, timeout: int = 30):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout

class Agent:
    """Mock Agent class for framework compatibility"""
    def __init__(self, agent_config: AgentConfig, client: OpenAIChatClient, 
                 tools: List[Tool], system_prompt: str):
        self.config = agent_config
        self.client = client
        self.tools = tools
        self.system_prompt = system_prompt
    
    async def run(self, input_data: Dict[str, Any], structured_output: Optional[BaseModel] = None) -> Dict[str, Any]:
        """Mock run method - returns simulated response"""
        # structured_output parameter reserved for future use
        _ = structured_output  # Suppress unused parameter warning
        return {"status": "completed", "data": input_data, "agent": self.config.name}

# Initialize tracing
tracer = initialize_tracing() or trace.get_tracer(__name__)

# Structured Output Models
class ContractMetadata(BaseModel):
    """Structured output for contract metadata extraction"""
    contract_id: str = Field(description="Unique contract identifier")
    title: str = Field(description="Contract title or name")
    parties: List[str] = Field(description="Contracting parties")
    contract_type: str = Field(description="Type/category of contract")
    effective_date: Optional[str] = Field(description="Contract effective date (ISO format)")
    expiry_date: Optional[str] = Field(description="Contract expiry date (ISO format)")
    value: Optional[float] = Field(description="Contract value if specified")
    currency: Optional[str] = Field(description="Currency code (USD, EUR, etc.)")
    jurisdiction: Optional[str] = Field(description="Governing law/jurisdiction")
    confidence_score: float = Field(description="Extraction confidence (0.0-1.0)")


class ComplianceAssessment(BaseModel):
    """Structured output for compliance evaluation"""
    overall_score: float = Field(description="Overall compliance score (0.0-1.0)")
    policy_violations: List[str] = Field(description="List of policy violations found")
    recommendations: List[str] = Field(description="Compliance improvement recommendations")
    risk_level: str = Field(description="Risk level: LOW, MEDIUM, HIGH, CRITICAL")
    approval_required: bool = Field(description="Whether legal approval is required")
    blocking_issues: List[str] = Field(description="Issues that block contract execution")


class ApprovalDecision(BaseModel):
    """Structured output for contract approval decisions"""
    decision: str = Field(description="APPROVE, REJECT, or CONDITIONAL")
    confidence: float = Field(description="Decision confidence (0.0-1.0)")
    reasoning: str = Field(description="Detailed reasoning for the decision")
    conditions: List[str] = Field(description="Conditions for conditional approvals")
    escalation_required: bool = Field(description="Whether human escalation is needed")
    next_actions: List[str] = Field(description="Required next actions")


# Agent Base Class with Framework Integration
class DeclarativeContractAgent:
    """Base class for Microsoft Agent Framework contract agents"""
    
    def __init__(self, agent_name: str, model_type: str = "primary"):
        self.agent_name = agent_name
        self.model_config = get_model_config(model_type)
        self.client = self._create_client()
        self.tools = self._load_tools()
        self.system_prompt = self._load_system_prompt()
        
        # Agent Framework configuration
        self.agent_config = AgentConfig(
            name=agent_name,
            model=self.model_config["model"],
            temperature=self.model_config["temperature"],
            max_tokens=self.model_config["max_tokens"]
        )
        
        # Initialize agent with framework
        self.agent = Agent(
            config=self.agent_config,
            client=self.client,
            tools=self.tools,
            system_prompt=self.system_prompt
        )
        
    def _create_client(self) -> OpenAIChatClient:
        """Create OpenAI client with Microsoft Foundry configuration"""
        return OpenAIChatClient(
            api_key=self.model_config["api_key"],
            base_url=f"{self.model_config['endpoint']}/openai",
            model=self.model_config["model"],
            temperature=self.model_config["temperature"],
            max_tokens=self.model_config["max_tokens"],
            timeout=self.model_config["timeout"]
        )
    
    def _load_system_prompt(self) -> str:
        """Load system prompt from file"""
        prompt_file = config.prompts_dir / f"{self.agent_name.replace('_', '-')}-system.md"
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8")
        
        # Fallback to legacy naming
        legacy_file = config.prompts_dir / f"{self.agent_name.replace('_', '-')}.md"
        if legacy_file.exists():
            return legacy_file.read_text(encoding="utf-8")
            
        raise FileNotFoundError(f"System prompt file not found: {prompt_file}")
    
    def _load_tools(self) -> List[Tool]:
        """Load MCP tools for this agent - to be implemented by subclasses"""
        return []
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent with structured input/output"""
        with tracer.start_as_current_span(f"{self.agent_name}.execute") as span:
            span.set_attribute("agent.name", self.agent_name)
            span.set_attribute("input.size", len(str(input_data)))
            
            try:
                # Execute using Agent Framework
                result = await self.agent.run(
                    input_data=input_data,
                    structured_output=self._get_output_schema()
                )
                
                span.set_attribute("execution.status", "success")
                span.set_attribute("output.size", len(str(result)))
                
                return result
                
            except (ValueError, RuntimeError, FileNotFoundError) as e:
                span.set_attribute("execution.status", "error")
                span.set_attribute("error.message", str(e))
                raise
            except Exception as e:
                span.set_attribute("execution.status", "unexpected_error")
                logging.error("Unexpected error in agent execution: %s", str(e))
                raise RuntimeError(f"Agent execution failed: {str(e)}") from e
    
    def _get_output_schema(self) -> Optional[BaseModel]:
        """Get structured output schema - to be overridden by subclasses"""
        return None


# Specific Agent Implementations
class ContractIntakeAgent(DeclarativeContractAgent):
    """Contract intake and initial processing agent"""
    
    def __init__(self, model_type: str = "primary"):
        super().__init__("contract_intake", model_type)
    
    def _load_tools(self) -> List[Tool]:
        """Load intake-specific MCP tools"""
        # Integration with contract-intake-mcp server
        return [
            Tool(name="document_upload", description="Tool for document upload"),
            Tool(name="metadata_extraction", description="Tool for metadata extraction"),
            Tool(name="format_validation", description="Tool for format validation")
        ]
    
    def _get_output_schema(self) -> BaseModel:
        return ContractMetadata


class ContractExtractionAgent(DeclarativeContractAgent):
    """Contract data extraction and analysis agent"""
    
    def __init__(self, model_type: str = "primary"):
        super().__init__("contract_extraction", model_type)
    
    def _load_tools(self) -> List[Tool]:
        """Load extraction-specific MCP tools"""
        # Integration with contract-extraction-mcp server
        return [
            Tool(name="text_extraction", description="Tool for text extraction"),
            Tool(name="clause_identification", description="Tool for clause identification"),
            Tool(name="entity_recognition", description="Tool for entity recognition")
        ]
    
    def _get_output_schema(self) -> BaseModel:
        return ContractMetadata


class ContractComplianceAgent(DeclarativeContractAgent):
    """Contract compliance evaluation agent"""
    
    def __init__(self, model_type: str = "primary"):
        super().__init__("contract_compliance", model_type)
    
    def _load_tools(self) -> List[Tool]:
        """Load compliance-specific MCP tools"""
        # Integration with contract-compliance-mcp server
        return [
            Tool(name="policy_lookup", description="Tool for policy lookup"),
            Tool(name="risk_assessment", description="Tool for risk assessment"),
            Tool(name="regulation_checking", description="Tool for regulation checking")
        ]
    
    def _get_output_schema(self) -> BaseModel:
        return ComplianceAssessment


class ContractApprovalAgent(DeclarativeContractAgent):
    """Contract approval decision agent"""
    
    def __init__(self, model_type: str = "primary"):
        super().__init__("contract_approval", model_type)
    
    def _load_tools(self) -> List[Tool]:
        """Load approval-specific MCP tools"""
        # Integration with contract-workflow-mcp server
        return [
            Tool(name="approval_workflow", description="Tool for approval workflow"),
            Tool(name="escalation_routing", description="Tool for escalation routing"),
            Tool(name="notification_sending", description="Tool for notification sending")
        ]
    
    def _get_output_schema(self) -> BaseModel:
        return ApprovalDecision


# Agent Factory for Dynamic Creation
class AgentFactory:
    """Factory for creating declarative contract agents"""
    
    _agent_registry = {
        "intake": ContractIntakeAgent,
        "extraction": ContractExtractionAgent,
        "compliance": ContractComplianceAgent,
        "approval": ContractApprovalAgent
    }
    
    @classmethod
    def create_agent(cls, agent_type: str, model_type: str = "primary") -> DeclarativeContractAgent:
        """Create agent instance by type"""
        if agent_type not in cls._agent_registry:
            raise ValueError(f"Unknown agent type: {agent_type}. Available: {list(cls._agent_registry.keys())}")
        
        agent_class = cls._agent_registry[agent_type]
        return agent_class(model_type=model_type)
    
    @classmethod
    def list_available_agents(cls) -> List[str]:
        """List all available agent types"""
        return list(cls._agent_registry.keys())
    
    @classmethod
    def register_agent(cls, agent_type: str, agent_class: type) -> None:
        """Register new agent type"""
        cls._agent_registry[agent_type] = agent_class


# Utility Functions
async def test_agent_connectivity() -> Dict[str, bool]:
    """Test connectivity to all agents and their dependencies"""
    results = {}
    
    for agent_type in AgentFactory.list_available_agents():
        try:
            agent = AgentFactory.create_agent(agent_type)
            # Simple connectivity test
            test_input = {"test": True}
            await asyncio.wait_for(agent.execute(test_input), timeout=10.0)
            results[agent_type] = True
        except (ValueError, RuntimeError, asyncio.TimeoutError) as e:
            logging.error("Agent %s connectivity test failed: %s", agent_type, e)
            results[agent_type] = False
        except Exception as e:
            logging.error("Unexpected error testing agent %s: %s", agent_type, e)
            results[agent_type] = False
    
    return results


def load_agent_from_yaml(yaml_path: Path) -> DeclarativeContractAgent:
    """Load agent configuration from YAML file (future enhancement)"""
    # YAML-driven agent configuration implementation placeholder
    # This would read the YAML configs created earlier and dynamically
    # configure agents based on the declarative specifications
    raise NotImplementedError("YAML configuration loading not yet implemented")


if __name__ == "__main__":
    # Example usage and testing
    async def main():
        # Test agent connectivity
        connectivity_results = await test_agent_connectivity()
        print("Agent Connectivity Results:", connectivity_results)
        
        # Example agent execution
        intake_agent = AgentFactory.create_agent("intake")
        sample_contract = {
            "document_text": "This is a sample contract...",
            "document_name": "sample-contract.pdf"
        }
        
        try:
            result = await intake_agent.execute(sample_contract)
            print("Intake Result:", result)
        except Exception as e:
            print(f"Execution failed: {e}")
    
    asyncio.run(main())