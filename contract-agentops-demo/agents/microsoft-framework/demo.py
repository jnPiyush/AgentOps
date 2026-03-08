#!/usr/bin/env python3
"""Microsoft Agent Framework - Contract Processing Demo

This script demonstrates the declarative contract processing agents
using Microsoft Agent Framework with production patterns.

Requirements:
- Set environment variables (copy from .env.template)
- Install dependencies: pip install -r requirements.txt
- Start MCP servers: npm run start:mcp-servers
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import Microsoft Agent Framework components
try:
    from agents.microsoft_framework import (
        AgentFactory,
        WorkflowFactory,
        config,
        initialize_tracing
    )
except ImportError as e:
    logger.error("Failed to import Microsoft Agent Framework: %s", e)
    logger.error("Ensure dependencies are installed: pip install -r requirements.txt")
    exit(1)


class ContractProcessingDemo:
    """Demo class for Microsoft Agent Framework contract processing"""
    
    def __init__(self):
        self.initialize_framework()
        self.sample_contracts = self.load_sample_contracts()
    
    def initialize_framework(self):
        """Initialize Microsoft Agent Framework"""
        logger.info("Initializing Microsoft Agent Framework...")
        
        # Initialize tracing
        initialize_tracing()
        
        # Verify configuration
        try:
            logger.info("Primary Model: %s", config.primary_model)
            logger.info("Foundry Endpoint: %s...", config.foundry_endpoint[:50])
            logger.info("Tracing Enabled: %s", config.tracing_enabled)
            logger.info("HITL Enabled: %s", config.hitl_enabled)
        except Exception as e:
            logger.error("Configuration error: %s", e)
            logger.error("Check your .env file and environment variables")
            raise
    
    def load_sample_contracts(self) -> Dict[str, Dict[str, Any]]:
        """Load sample contract data for testing"""
        return {
            "service_agreement": {
                "document_text": """
                SERVICE AGREEMENT
                
                This Service Agreement ("Agreement") is entered into on January 15, 2026,
                between TechCorp Inc. ("Provider") and Global Industries LLC ("Client").
                
                1. SERVICES: Provider agrees to deliver cloud infrastructure services.
                2. TERM: 24 months from effective date.
                3. COMPENSATION: $50,000 per month, payable monthly in advance.
                4. TERMINATION: Either party may terminate with 30 days written notice.
                5. GOVERNING LAW: This Agreement shall be governed by Delaware law.
                
                [Additional standard clauses...]
                """,
                "document_name": "service-agreement-2026.pdf",
                "contract_id": "SA-2026-001",
                "expected_type": "service_agreement",
                "expected_value": 1200000.0  # $50k/month * 24 months
            },
            
            "high_value_contract": {
                "document_text": """
                MASTER SERVICES AGREEMENT
                
                This Master Services Agreement is entered into between MegaCorp Ltd.
                and Enterprise Solutions Inc. for enterprise software licensing.
                
                Total Contract Value: $5,000,000 USD
                Term: 5 years
                Renewal: Automatic renewal unless terminated
                Governing Law: New York State
                
                REGULATORY COMPLIANCE: This agreement is subject to SOX compliance
                requirements and financial services regulations.
                """,
                "document_name": "master-services-agreement.pdf",
                "contract_id": "MSA-2026-001",
                "expected_type": "master_services_agreement",
                "expected_value": 5000000.0,
                "regulatory_scope": True
            }
        }
    
    async def demo_individual_agents(self):
        """Demonstrate individual agent execution"""
        logger.info("=== Individual Agent Demo ===")
        
        # Test agent connectivity
        logger.info("Testing agent connectivity...")
        try:
            from agents.microsoft_framework.agents import test_agent_connectivity
            connectivity = await test_agent_connectivity()
            logger.info("Agent connectivity: %s", connectivity)
        except Exception as e:
            logger.warning("Connectivity test failed: %s", e)
        
        # Demo each agent type
        agent_types = ["intake", "extraction", "compliance", "approval"]
        contract_data = self.sample_contracts["service_agreement"]
        
        for agent_type in agent_types:
            logger.info("\n--- Testing %s Agent ---", agent_type.title())
            
            try:
                agent = AgentFactory.create_agent(agent_type)
                
                # Prepare input based on agent type
                if agent_type == "intake":
                    agent_input = {
                        "document_text": contract_data["document_text"],
                        "document_name": contract_data["document_name"]
                    }
                else:
                    # For other agents, include previous results (simulated)
                    agent_input = {
                        "document_text": contract_data["document_text"],
                        "contract_metadata": {"contract_id": contract_data["contract_id"]},
                        "extracted_data": {"parties": ["TechCorp Inc.", "Global Industries LLC"]}
                    }
                
                # Execute agent
                start_time = datetime.now()
                result = await agent.execute(agent_input)
                duration = (datetime.now() - start_time).total_seconds()
                
                logger.info("%s executed in %.2fs", agent_type, duration)
                logger.info("Result preview: %s", str(result)[:200])
                
            except (ValueError, RuntimeError, FileNotFoundError) as e:
                logger.error("%s agent failed: %s", agent_type, str(e))
            except Exception as e:
                logger.error("Unexpected error in %s agent: %s", agent_type, str(e))
    
    async def demo_workflow_execution(self):
        """Demonstrate complete workflow execution"""
        logger.info("\n=== Workflow Execution Demo ===")
        
        # Create workflow
        workflow = WorkflowFactory.create_standard_workflow()
        
        # Execute workflow for each sample contract
        for contract_name, contract_data in self.sample_contracts.items():
            logger.info("\\n--- Processing %s ---", contract_name)
            
            try:
                start_time = datetime.now()
                
                # Execute complete workflow
                context = await workflow.execute(
                    contract_data=contract_data,
                    workflow_id=f"demo_{contract_name}_{int(start_time.timestamp())}"
                )
                
                duration = (datetime.now() - start_time).total_seconds()
                
                # Log results
                logger.info("Workflow completed in %.2fs", duration)
                logger.info("Status: %s", context.status.value)
                logger.info("Steps completed: %d/%d", context.current_step, context.total_steps)
                logger.info("HITL decisions: %d", len(context.hitl_decisions))
                
                if context.errors:
                    logger.error("Errors: %s", context.errors)
                
                # Save results
                await self.save_workflow_results(context)
                
            except (ValueError, RuntimeError) as e:
                logger.error("Workflow failed for %s: %s", contract_name, str(e))
            except Exception as e:
                logger.error("Unexpected workflow error for %s: %s", contract_name, str(e))
    
    async def demo_conditional_workflow(self):
        """Demonstrate conditional workflow routing"""
        logger.info("\n=== Conditional Workflow Demo ===")
        
        try:
            conditional_workflow = WorkflowFactory.create_conditional_workflow()
            
            # Test high-value contract routing
            high_value_contract = self.sample_contracts["high_value_contract"]
            
            logger.info("Processing high-value contract with conditional routing...")
            # Note: This would use the conditional workflow once fully implemented
            logger.info("Contract value: $%.2f", high_value_contract['expected_value'])
            logger.info("Regulatory scope: %s", high_value_contract.get('regulatory_scope', False))
            
        except Exception as e:
            logger.error("Conditional workflow demo failed: %s", str(e))
    
    async def save_workflow_results(self, context):
        """Save workflow results to file"""
        results_dir = Path("results")
        results_dir.mkdir(exist_ok=True)
        
        filename = f"workflow_result_{context.workflow_id}.json"
        filepath = results_dir / filename
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(context.to_dict(), f, indent=2, default=str)
            
            logger.info("Results saved to %s", str(filepath))
            
        except (OSError, IOError) as e:
            logger.error("Failed to save results: %s", str(e))
        except Exception as e:
            logger.error("Unexpected error saving results: %s", str(e))
    
    async def run_complete_demo(self):
        """Run complete demonstration"""
        logger.info("🚀 Starting Microsoft Agent Framework Demo")
        logger.info("Timestamp: %s", datetime.now().isoformat())
        
        try:
            # Individual agents
            await self.demo_individual_agents()
            
            # Workflow execution
            await self.demo_workflow_execution()
            
            # Conditional workflows
            await self.demo_conditional_workflow()
            
            logger.info("\n✅ Demo completed successfully!")
            
        except Exception as e:
            logger.error("❌ Demo failed: %s", str(e))
            raise


async def main():
    """Main entry point for the demo"""
    try:
        demo = ContractProcessingDemo()
        await demo.run_complete_demo()
        
    except KeyboardInterrupt:
        logger.info("Demo interrupted by user")
    except Exception as e:
        logger.error("Demo failed: %s", str(e))
        raise


if __name__ == "__main__":
    # Run the demo
    asyncio.run(main())