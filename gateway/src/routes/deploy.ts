import type { FastifyInstance } from "fastify";
import { appConfig } from "../config.js";
import { getFoundryConfigurationError, isFoundryConfigured } from "../services/foundryAuth.js";
import {
	type DeployPipelineResult,
	type FoundryDeployConfig,
	cleanupAgents,
	deploySimulated,
	deployToFoundry,
} from "../services/foundryDeploy.js";

// Track last deployment for cleanup
let lastDeployment: DeployPipelineResult | null = null;

function ensureDeployAdminAccess(headerValue: string | undefined): {
	allowed: boolean;
	statusCode?: 401 | 503;
	error?: string;
	message?: string;
} {
	if (appConfig.demoMode !== "live") {
		return { allowed: true };
	}

	if (!appConfig.deployAdminKey) {
		return {
			allowed: false,
			statusCode: 503,
			error: "deploy_admin_not_configured",
			message: "DEPLOY_ADMIN_KEY must be configured for live deployment routes",
		};
	}

	if (headerValue !== appConfig.deployAdminKey) {
		return {
			allowed: false,
			statusCode: 401,
			error: "unauthorized",
			message: "Missing or invalid deploy admin key",
		};
	}

	return { allowed: true };
}

function getFoundryConfig(): FoundryDeployConfig {
	return {
		endpoint: appConfig.foundryEndpoint,
		projectEndpoint: appConfig.foundryProjectEndpoint,
		authMode: appConfig.foundryAuthMode,
		apiKey: appConfig.foundryApiKey,
		managedIdentityClientId: appConfig.foundryManagedIdentityClientId,
		model: appConfig.foundryModel,
	};
}

export async function deployRoutes(app: FastifyInstance): Promise<void> {
	// POST /api/v1/deploy/pipeline - Run full deployment pipeline
	app.post("/api/v1/deploy/pipeline", async (request, reply) => {
		const access = ensureDeployAdminAccess(request.headers["x-admin-key"] as string | undefined);
		if (!access.allowed) {
			return reply.status(access.statusCode ?? 401).send({
				error: access.error,
				message: access.message,
			});
		}

		if (appConfig.demoMode === "live") {
			const cfg = getFoundryConfig();
			const configError = getFoundryConfigurationError(cfg);
			if (configError) {
				return reply.status(400).send({
					error: "missing_config",
					message: configError,
				});
			}
			const result = await deployToFoundry(cfg);
			lastDeployment = result;
			return reply.status(201).send(result);
		}

		// Simulated mode
		const result = await deploySimulated();
		lastDeployment = result;
		return reply.status(201).send(result);
	});

	// GET /api/v1/deploy/status - Get last deployment result
	app.get("/api/v1/deploy/status", async (request, reply) => {
		const access = ensureDeployAdminAccess(request.headers["x-admin-key"] as string | undefined);
		if (!access.allowed) {
			return reply.status(access.statusCode ?? 401).send({
				error: access.error,
				message: access.message,
			});
		}

		if (!lastDeployment) {
			return reply.status(404).send({
				error: "no_deployment",
				message: "No deployment has been run yet",
			});
		}
		return reply.send(lastDeployment);
	});

	// DELETE /api/v1/deploy/agents - Cleanup registered agents
	app.delete("/api/v1/deploy/agents", async (request, reply) => {
		const access = ensureDeployAdminAccess(request.headers["x-admin-key"] as string | undefined);
		if (!access.allowed) {
			return reply.status(access.statusCode ?? 401).send({
				error: access.error,
				message: access.message,
			});
		}

		if (!lastDeployment || lastDeployment.agents.length === 0) {
			return reply.status(404).send({
				error: "no_agents",
				message: "No registered agents to clean up",
			});
		}

		const agentIds = lastDeployment.agents.filter((a) => a.status === "registered").map((a) => a.foundry_agent_id);

		if (appConfig.demoMode === "live" && agentIds.length > 0) {
			const cfg = getFoundryConfig();
			const result = await cleanupAgents(cfg, agentIds);
			lastDeployment = null;
			return reply.send({
				deleted: result.deleted,
				errors: result.errors,
				message: `Cleaned up ${result.deleted} agents from Foundry`,
			});
		}

		// Simulated cleanup
		lastDeployment = null;
		return reply.send({
			deleted: agentIds.length,
			errors: [],
			message: `Cleaned up ${agentIds.length} simulated agents`,
		});
	});

	// GET /api/v1/deploy/mode - Get current deployment mode
	app.get("/api/v1/deploy/mode", async (_request, reply) => {
		const cfg = getFoundryConfig();
		return reply.send({
			mode: appConfig.demoMode,
			foundry_auth_mode: appConfig.foundryAuthMode,
			foundry_configured: isFoundryConfigured(cfg),
		});
	});
}
