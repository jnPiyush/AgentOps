import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { appConfig } from "../gateway/src/config.js";
import { deployRoutes } from "../gateway/src/routes/deploy.js";

const mutableConfig = appConfig as {
	demoMode: "live" | "simulated";
	deployAdminKey: string;
	foundryApiKey: string;
	foundryEndpoint: string;
	foundryProjectEndpoint: string;
	foundryModel: string;
};

const originalConfig = {
	demoMode: appConfig.demoMode,
	deployAdminKey: appConfig.deployAdminKey,
	foundryApiKey: appConfig.foundryApiKey,
	foundryEndpoint: appConfig.foundryEndpoint,
	foundryProjectEndpoint: appConfig.foundryProjectEndpoint,
	foundryModel: appConfig.foundryModel,
};

afterEach(() => {
	Object.assign(mutableConfig, originalConfig);
});

describe("deploy routes auth", () => {
	it("allows deploy status access in simulated mode without an admin key", async () => {
		Object.assign(mutableConfig, {
			demoMode: "simulated",
			deployAdminKey: "",
		});

		const app = Fastify();
		await app.register(deployRoutes);

		const response = await app.inject({ method: "GET", url: "/api/v1/deploy/status" });
		expect(response.statusCode).toBe(404);

		await app.close();
	});

	it("rejects live deploy status access without the admin key", async () => {
		Object.assign(mutableConfig, {
			demoMode: "live",
			deployAdminKey: "secret-key",
		});

		const app = Fastify();
		await app.register(deployRoutes);

		const response = await app.inject({ method: "GET", url: "/api/v1/deploy/status" });
		expect(response.statusCode).toBe(401);

		await app.close();
	});

	it("returns not found in live mode when the admin key is valid and there is no deployment yet", async () => {
		Object.assign(mutableConfig, {
			demoMode: "live",
			deployAdminKey: "secret-key",
		});

		const app = Fastify();
		await app.register(deployRoutes);

		const response = await app.inject({
			method: "GET",
			url: "/api/v1/deploy/status",
			headers: { "x-admin-key": "secret-key" },
		});
		expect(response.statusCode).toBe(404);

		await app.close();
	});

	it("blocks live deployment execution before any external call when the admin key is missing", async () => {
		Object.assign(mutableConfig, {
			demoMode: "live",
			deployAdminKey: "secret-key",
			foundryApiKey: "api-key",
			foundryEndpoint: "https://example.test",
			foundryProjectEndpoint: "https://example.test/projects/demo",
			foundryModel: "gpt-4o",
		});

		const app = Fastify();
		await app.register(deployRoutes);

		const response = await app.inject({ method: "POST", url: "/api/v1/deploy/pipeline" });
		expect(response.statusCode).toBe(401);

		await app.close();
	});
});