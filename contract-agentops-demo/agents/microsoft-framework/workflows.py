"""Microsoft Agent Framework - Contract Processing Workflows"""

import asyncio
import json
import logging
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum

from opentelemetry import trace
from pydantic import BaseModel, Field

from .config import config, initialize_tracing
from .agents import AgentFactory

# Mock implementations for Microsoft Agent Framework workflow classes
class WorkflowStep:
    """Mock WorkflowStep class for framework compatibility"""
    def __init__(self, step_name: str):
        self.step_name = step_name
    
    async def execute(self, context: 'WorkflowContext') -> Dict[str, Any]:
        """Execute workflow step - to be implemented by subclasses"""
        raise NotImplementedError

class WorkflowConfig:
    """Mock WorkflowConfig class for framework compatibility"""
    def __init__(self, max_retries: int = 3, timeout_seconds: int = 300):
        self.max_retries = max_retries
        self.timeout_seconds = timeout_seconds

class SequentialWorkflow:
    """Mock SequentialWorkflow class for framework compatibility"""
    def __init__(self, name: str, steps: List[WorkflowStep], workflow_config: WorkflowConfig):
        self.name = name
        self.steps = steps
        self.config = workflow_config

class ConditionalWorkflow:
    """Mock ConditionalWorkflow class for framework compatibility"""
    def __init__(self, name: str):
        self.name = name
        self.conditions = []
    
    def add_condition(self, name: str, condition: Callable, true_workflow: Any, false_workflow: Any):
        """Add routing condition"""
        self.conditions.append({
            'name': name,
            'condition': condition, 
            'true_workflow': true_workflow,
            'false_workflow': false_workflow
        })

class WorkflowMonitor:
    """Mock WorkflowMonitor class for framework compatibility"""
    def __init__(self):
        self.active_workflows = {}
    
    def start_monitoring(self, workflow_id: str):
        """Start monitoring workflow"""
        self.active_workflows[workflow_id] = datetime.now()
    
    def stop_monitoring(self, workflow_id: str):
        """Stop monitoring workflow"""
        if workflow_id in self.active_workflows:
            del self.active_workflows[workflow_id]

# Initialize tracing
tracer = initialize_tracing() or trace.get_tracer(__name__)


class WorkflowStatus(Enum):
    """Workflow execution status"""
    PENDING = "pending"
    RUNNING = "running" 
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class HITLDecision(BaseModel):
    """Human-in-the-Loop decision structure"""
    decision: str = Field(description="PROCEED, REJECT, MODIFY")
    reviewer: str = Field(description="Name/ID of reviewer")
    timestamp: datetime = Field(default_factory=datetime.now)
    comments: Optional[str] = Field(description="Reviewer comments")
    modifications: Optional[Dict[str, Any]] = Field(description="Requested modifications")


@dataclass
class WorkflowContext:
    """Workflow execution context and state"""
    workflow_id: str
    contract_id: str
    status: WorkflowStatus
    current_step: int
    total_steps: int
    started_at: datetime
    updated_at: datetime
    results: Dict[str, Any]
    errors: List[str]
    hitl_decisions: List[HITLDecision]
    
    def update_status(self, new_status: WorkflowStatus):
        """Update workflow status with timestamp"""
        self.status = new_status
        self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return asdict(self)


class ContractProcessingStep(WorkflowStep):
    """Custom workflow step for contract processing"""
    
    def __init__(self, 
                 step_name: str,
                 agent_type: str,
                 required_inputs: List[str],
                 output_key: str,
                 quality_gate: Optional[Callable] = None,
                 hitl_required: bool = False,
                 retry_count: int = 3):
        super().__init__(step_name)
        self.agent_type = agent_type
        self.required_inputs = required_inputs
        self.output_key = output_key
        self.quality_gate = quality_gate
        self.hitl_required = hitl_required
        self.retry_count = retry_count
        self.agent = AgentFactory.create_agent(agent_type)
    
    async def execute(self, context: WorkflowContext) -> Dict[str, Any]:
        """Execute contract processing step"""
        with tracer.start_as_current_span(f"workflow_step.{self.step_name}") as span:
            span.set_attribute("step.name", self.step_name)
            span.set_attribute("agent.type", self.agent_type)
            
            # Validate required inputs
            missing_inputs = [inp for inp in self.required_inputs 
                            if inp not in context.results]
            if missing_inputs:
                raise ValueError(f"Missing required inputs: {missing_inputs}")
            
            # Prepare agent input
            agent_input = {key: context.results[key] for key in self.required_inputs}
            
            # Execute with retry logic
            last_error = None
            for attempt in range(self.retry_count):
                try:
                    span.set_attribute("execution.attempt", attempt + 1)
                    result = await self.agent.execute(agent_input)
                    
                    # Apply quality gate if configured
                    if self.quality_gate and not self.quality_gate(result):
                        raise ValueError(f"Quality gate failed for {self.step_name}")
                    
                    # Human-in-the-Loop checkpoint
                    if self.hitl_required:
                        result = await self._handle_hitl_checkpoint(context, result)
                    
                    span.set_attribute("execution.status", "success")
                    return {self.output_key: result}
                    
                except (ValueError, RuntimeError, asyncio.TimeoutError) as e:
                    last_error = e
                    span.set_attribute("execution.error", str(e))
                    if attempt < self.retry_count - 1:
                        await asyncio.sleep(2 ** attempt)  # Exponential backoff
                except Exception as e:
                    last_error = e
                    logging.error("Unexpected error in step %s: %s", self.step_name, str(e))
                    span.set_attribute("execution.unexpected_error", str(e))
                    break  # Don't retry on unexpected errors
                    
            # All retries exhausted
            span.set_attribute("execution.status", "failed")
            raise last_error
    
    async def _handle_hitl_checkpoint(self, context: WorkflowContext, result: Dict[str, Any]) -> Dict[str, Any]:
        """Handle Human-in-the-Loop approval checkpoint"""
        # In production, this would integrate with approval UI/email system
        # For now, simulate or provide API hook
        
        logging.info("HITL checkpoint required for workflow %s, step %s", context.workflow_id, self.step_name)
        
        # Actual HITL integration implementation placeholder
        # - Send notification to legal team
        # - Create approval task in workflow UI
        # - Wait for human decision with timeout
        
        # For demo, we'll simulate approval
        hitl_decision = HITLDecision(
            decision="PROCEED",
            reviewer="demo-reviewer",
            comments="Simulated approval for demo"
        )
        
        context.hitl_decisions.append(hitl_decision)
        
        if hitl_decision.decision == "REJECT":
            raise ValueError("Human reviewer rejected the result")
        elif hitl_decision.decision == "MODIFY" and hitl_decision.modifications:
            # Apply modifications to result
            result.update(hitl_decision.modifications)
        
        return result


class ContractProcessingWorkflow:
    """Main contract processing workflow orchestrator"""
    
    def __init__(self, workflow_config_path: Optional[Path] = None):
        self.config_path = workflow_config_path or config.config_dir / "workflows" / "contract-processing.yaml"
        self.workflow_config = self._load_workflow_config()
        self.steps = self._create_workflow_steps()
        self.monitor = WorkflowMonitor()
        
        # Create Microsoft Agent Framework SequentialWorkflow
        self.workflow = SequentialWorkflow(
            name="contract-processing",
            steps=self.steps,
            config=WorkflowConfig(
                max_retries=config.max_retries,
                timeout_seconds=config.timeout_seconds * len(self.steps)
            )
        )
    
    def _load_workflow_config(self) -> Dict[str, Any]:
        """Load workflow configuration from YAML"""
        if self.config_path.exists():
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        
        # Default configuration if YAML not found
        return {
            "name": "contract-processing",
            "description": "End-to-end contract processing pipeline",
            "steps": [
                {
                    "name": "intake",
                    "agent_type": "intake",
                    "required_inputs": ["document_text", "document_name"],
                    "output_key": "contract_metadata",
                    "hitl_required": False
                },
                {
                    "name": "extraction",
                    "agent_type": "extraction", 
                    "required_inputs": ["contract_metadata", "document_text"],
                    "output_key": "extracted_data",
                    "hitl_required": False
                },
                {
                    "name": "compliance",
                    "agent_type": "compliance",
                    "required_inputs": ["extracted_data", "contract_metadata"],
                    "output_key": "compliance_assessment",
                    "hitl_required": True
                },
                {
                    "name": "approval",
                    "agent_type": "approval",
                    "required_inputs": ["compliance_assessment", "extracted_data"],
                    "output_key": "approval_decision",
                    "hitl_required": True
                }
            ]
        }
    
    def _create_workflow_steps(self) -> List[ContractProcessingStep]:
        """Create workflow steps from configuration"""
        steps = []
        
        for step_config in self.workflow_config["steps"]:
            step = ContractProcessingStep(
                step_name=step_config["name"],
                agent_type=step_config["agent_type"],
                required_inputs=step_config["required_inputs"],
                output_key=step_config["output_key"],
                hitl_required=step_config.get("hitl_required", False),
                retry_count=step_config.get("retry_count", 3)
            )
            steps.append(step)
        
        return steps
    
    async def execute(self, 
                     contract_data: Dict[str, Any],
                     workflow_id: Optional[str] = None) -> WorkflowContext:
        """Execute complete contract processing workflow"""
        
        workflow_id = workflow_id or f"workflow_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Initialize workflow context
        context = WorkflowContext(
            workflow_id=workflow_id,
            contract_id=contract_data.get("contract_id", "unknown"),
            status=WorkflowStatus.PENDING,
            current_step=0,
            total_steps=len(self.steps),
            started_at=datetime.now(),
            updated_at=datetime.now(),
            results=contract_data.copy(),
            errors=[],
            hitl_decisions=[]
        )
        
        with tracer.start_as_current_span(f"contract_workflow.{workflow_id}") as span:
            span.set_attribute("workflow.id", workflow_id)
            span.set_attribute("workflow.steps_total", context.total_steps)
            
            try:
                context.update_status(WorkflowStatus.RUNNING)
                
                # Execute workflow using Microsoft Agent Framework
                for i, step in enumerate(self.steps):
                    context.current_step = i + 1
                    span.set_attribute("workflow.current_step", context.current_step)
                    
                    try:
                        step_result = await step.execute(context)
                        context.results.update(step_result)
                        
                        logging.info("Completed step %s in workflow %s", step.step_name, workflow_id)
                        
                    except (ValueError, RuntimeError) as e:
                        context.errors.append(f"Step {step.step_name}: {str(e)}")
                        context.update_status(WorkflowStatus.FAILED)
                        span.set_attribute("workflow.status", "failed")
                        raise
                    except Exception as e:
                        context.errors.append(f"Step {step.step_name}: Unexpected error: {str(e)}")
                        context.update_status(WorkflowStatus.FAILED)
                        span.set_attribute("workflow.status", "failed")
                        logging.error("Unexpected error in workflow step %s: %s", step.step_name, str(e))
                        raise RuntimeError(f"Workflow step {step.step_name} failed unexpectedly") from e
                
                context.update_status(WorkflowStatus.COMPLETED)
                span.set_attribute("workflow.status", "completed")
                
            except Exception as e:
                context.update_status(WorkflowStatus.FAILED)
                span.set_attribute("workflow.status", "failed")
                span.set_attribute("workflow.error", str(e))
                logging.error("Workflow %s failed: %s", workflow_id, e)
                raise
            
            finally:
                # Log workflow completion metrics
                duration = (datetime.now() - context.started_at).total_seconds()
                span.set_attribute("workflow.duration_seconds", duration)
                
                await self._log_workflow_completion(context, duration)
        
        return context
    
    async def _log_workflow_completion(self, context: WorkflowContext, duration: float):
        """Log workflow completion for monitoring and analytics"""
        completion_data = {
            "workflow_id": context.workflow_id,
            "contract_id": context.contract_id,
            "status": context.status.value,
            "duration_seconds": duration,
            "steps_completed": context.current_step,
            "total_steps": context.total_steps,
            "error_count": len(context.errors),
            "hitl_decisions_count": len(context.hitl_decisions),
            "timestamp": context.updated_at.isoformat()
        }
        
        # In production, send to monitoring dashboard/database
        logging.info("Workflow completion: %s", json.dumps(completion_data, indent=2))


class ConditionalContractWorkflow(ConditionalWorkflow):
    """Conditional workflow for complex contract routing"""
    
    def __init__(self):
        super().__init__("conditional-contract-workflow")
        
        # Risk-based routing conditions
        self.add_condition(
            name="high_value_contract",
            condition=lambda ctx: ctx.results.get("contract_value", 0) > 100000,
            true_workflow=self._create_high_value_workflow(),
            false_workflow=self._create_standard_workflow()
        )
        
        self.add_condition(
            name="regulatory_contract", 
            condition=lambda ctx: ctx.results.get("regulatory_scope", False),
            true_workflow=self._create_regulatory_workflow(),
            false_workflow=None  # Continue with previous workflow
        )
    
    def _create_high_value_workflow(self) -> SequentialWorkflow:
        """Specialized workflow for high-value contracts"""
        # Additional approval steps for high-value contracts
        raise NotImplementedError("High-value workflow not yet implemented")
    
    def _create_standard_workflow(self) -> SequentialWorkflow:
        """Standard contract processing workflow"""
        return ContractProcessingWorkflow().workflow
    
    def _create_regulatory_workflow(self) -> SequentialWorkflow:
        """Specialized workflow for regulatory contracts"""
        # Additional compliance steps for regulatory contracts
        raise NotImplementedError("Regulatory workflow not yet implemented")


# Quality Gates and Validation Functions
def validate_extraction_quality(result: Dict[str, Any]) -> bool:
    """Quality gate for extraction results"""
    if not result or "confidence_score" not in result:
        return False
    
    return result["confidence_score"] >= 0.8


def validate_compliance_assessment(result: Dict[str, Any]) -> bool:
    """Quality gate for compliance assessment"""
    if not result or "overall_score" not in result:
        return False
    
    # Block if critical issues found
    if result.get("risk_level") == "CRITICAL":
        return len(result.get("blocking_issues", [])) == 0
    
    return result["overall_score"] >= 0.7


# Workflow Factory
class WorkflowFactory:
    """Factory for creating different workflow types"""
    
    @staticmethod
    def create_standard_workflow() -> ContractProcessingWorkflow:
        """Create standard contract processing workflow"""
        return ContractProcessingWorkflow()
    
    @staticmethod
    def create_conditional_workflow() -> ConditionalContractWorkflow:
        """Create conditional contract workflow with routing"""
        return ConditionalContractWorkflow()
    
    @staticmethod
    def create_custom_workflow(config_path: Path) -> ContractProcessingWorkflow:
        """Create workflow from custom configuration"""
        return ContractProcessingWorkflow(workflow_config_path=config_path)


# Monitoring and Analytics
async def get_workflow_metrics(time_range_hours: int = 24) -> Dict[str, Any]:
    """Get workflow execution metrics"""
    # Metrics collection from monitoring system implementation placeholder
    
    # Use the time_range_hours parameter for actual implementation
    _ = time_range_hours  # Suppress unused variable warning
    
    return {
        "total_workflows": 0,
        "completed_workflows": 0,
        "failed_workflows": 0,
        "average_duration_seconds": 0.0,
        "hitl_intervention_rate": 0.0,
        "success_rate": 0.0
    }


if __name__ == "__main__":
    # Example usage and testing
    async def main():
        # Create workflow
        workflow = WorkflowFactory.create_standard_workflow()
        
        # Sample contract data
        sample_contract = {
            "document_text": "This Service Agreement is entered into...",
            "document_name": "service-agreement-2026.pdf",
            "contract_id": "SA-2026-001"
        }
        
        try:
            # Execute workflow
            context = await workflow.execute(sample_contract)
            print("Workflow Results:")
            print(json.dumps(context.to_dict(), indent=2, default=str))
            
        except (ValueError, RuntimeError, FileNotFoundError) as e:
            print(f"Workflow execution failed: {e}")
        except Exception as e:
            print(f"Unexpected workflow error: {e}")
    
    asyncio.run(main())