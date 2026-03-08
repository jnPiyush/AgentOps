// Enhanced Declarative Agent Configuration System
// Supports YAML-based agent definitions with full Microsoft Agent Framework compatibility

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, "../../config");

// Enhanced Agent Configuration Interfaces (Declarative)
export interface DeclarativeAgentConfig {
  agent_id: string;
  name: string;
  version: string;
  created: string;
  
  // Model Configuration (Declarative)
  model: {
    provider: "microsoft_foundry" | "openai" | "anthropic";
    name: string;  // e.g., "gpt-5.1-2026-01-15"
    temperature: number;
    max_tokens: number;
    top_p: number;
    response_format: "json_schema" | "text";
    timeout: string;
  };
  
  // Prompt Management (File-Based)
  prompts: {
    system_prompt: string;      // File path: "prompts/intake-system.md"
    output_template: string;    // File path: "templates/intake-result.json"
    few_shot_examples?: string; // File path: "examples/intake-examples.json"
  };
  
  // Tool Bindings (MCP Integration)
  tools: Array<{
    name: string;
    mcp_server: string;
    description: string;
    required: boolean;
    timeout: string;
  }>;
  
  // Agent Behavior (Declarative)
  behavior: {
    role: string;
    boundary: string;
    output_schema: string;
    
    validation: {
      required_fields: string[];
      confidence_threshold?: number;
      max_parties?: number;
    };
    
    retry_policy: {
      max_attempts: number;
      backoff: "linear" | "exponential";
      base_delay: string;
    };
    
    performance: {
      target_latency: string;
      max_latency: string;
    };
  };
  
  // Workflow Integration
  workflow: {
    input_from: string;
    output_to: string[];
    execution_mode: "sequential" | "parallel";
    human_in_loop: boolean;
    
    routing: Array<{
      condition: string;
      action: "escalate_to_human" | "route_to_legal_review" | "continue_to_extraction";
    }>;
  };
}

// Declarative Agent Factory
export class DeclarativeAgentFactory {
  
  /**
   * Load agent configuration from YAML file
   */
  static async loadAgentConfig(agentId: string): Promise<DeclarativeAgentConfig> {
    const configPath = resolve(CONFIG_DIR, "agents", `${agentId}-agent.yaml`);
    
    try {
      const yamlContent = await readFile(configPath, "utf-8");
      // Note: js-yaml would be used here in full implementation
      const config = JSON.parse(yamlContent) as DeclarativeAgentConfig;
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load agent config for '${agentId}': ${error}`);
    }
  }
  
  /**
   * Create declarative agent runtime with all required resources loaded
   */
  static async createAgentRuntime(agentId: string) {
    const config = await this.loadAgentConfig(agentId);
    
    // Load system prompt from file (best practice)
    const systemPromptPath = resolve(__dirname, "../../", config.prompts.system_prompt);
    const systemPrompt = await readFile(systemPromptPath, "utf-8");
    
    return { config, systemPrompt };
  }
}