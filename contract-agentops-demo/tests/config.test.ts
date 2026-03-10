import { describe, expect, it } from "vitest";
import { AGENTS, getAgentPipeline } from "../agents/src/agentConfig.js";
import { MCP_SERVERS, appConfig } from "../gateway/src/config.js";

describe("gateway config", () => {
	it("defines 8 MCP servers", () => {
		expect(MCP_SERVERS).toHaveLength(8);
	});

	it("each server has name and port", () => {
		for (const server of MCP_SERVERS) {
			expect(server).toHaveProperty("name");
			expect(server).toHaveProperty("port");
			expect(typeof server.port).toBe("number");
		}
	});

	it("ports are unique and in 9001-9008 range", () => {
		const ports = MCP_SERVERS.map((s) => s.port);
		expect(new Set(ports).size).toBe(ports.length);
		for (const port of ports) {
			expect(port).toBeGreaterThanOrEqual(9001);
			expect(port).toBeLessThanOrEqual(9008);
		}
	});

	it("appConfig has correct defaults", () => {
		expect(appConfig.gatewayPort).toBe(8000);
		expect(appConfig.demoMode).toMatch(/^(simulated|live)$/);
		expect(appConfig.dataDir).toContain("data");
		expect(appConfig.legalReviewEmail).toBeTruthy();
	});
});

describe("agent config", () => {
	it("defines 4 agents", () => {
		expect(Object.keys(AGENTS)).toHaveLength(4);
	});

	it("each agent has required properties", () => {
		for (const [key, agent] of Object.entries(AGENTS)) {
			expect(agent).toHaveProperty("name");
			expect(agent).toHaveProperty("role");
			expect(agent).toHaveProperty("mcpServer");
			expect(agent).toHaveProperty("tools");
			expect(typeof key).toBe("string");
			expect(Array.isArray(agent.tools)).toBe(true);
		}
	});

	it("pipeline returns ordered agent keys", () => {
		const pipeline = getAgentPipeline();
		expect(Array.isArray(pipeline)).toBe(true);
		expect(pipeline.length).toBe(4);
		expect(pipeline[0]).toBe("intake");
		expect(pipeline[pipeline.length - 1]).toBe("approval");
	});
});
