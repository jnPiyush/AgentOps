import { type ChildProcess, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { waitForHealth } from "./startup/health.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHELL_BINARY = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "/bin/sh";

const MCP_SERVERS = [
	{ name: "contract-intake-mcp", port: 9001 },
	{ name: "contract-extraction-mcp", port: 9002 },
	{ name: "contract-compliance-mcp", port: 9003 },
	{ name: "contract-workflow-mcp", port: 9004 },
	{ name: "contract-audit-mcp", port: 9005 },
	{ name: "contract-eval-mcp", port: 9006 },
	{ name: "contract-drift-mcp", port: 9007 },
	{ name: "contract-feedback-mcp", port: 9008 },
];

const processes: ChildProcess[] = [];

function startProcess(label: string, cwd: string): ChildProcess {
	const proc =
		process.platform === "win32"
			? spawn(SHELL_BINARY, ["/d", "/s", "/c", "npm run start"], {
					cwd,
					stdio: ["ignore", "pipe", "pipe"],
				})
			: spawn(SHELL_BINARY, ["-lc", "npm run start"], {
					cwd,
					stdio: ["ignore", "pipe", "pipe"],
				});

	proc.stdout?.on("data", (data: Buffer) => {
		console.log(`[${label}] ${data.toString().trim()}`);
	});

	proc.stderr?.on("data", (data: Buffer) => {
		console.error(`[${label}] ${data.toString().trim()}`);
	});

	proc.on("exit", (code) => {
		if (code !== null && code !== 0) {
			console.error(`[${label}] exited with code ${code}`);
		}
	});

	processes.push(proc);
	return proc;
}

function shutdown(): void {
	console.log("\nShutting down...");
	for (const proc of processes) {
		proc.kill("SIGTERM");
	}
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main(): Promise<void> {
	console.log("=== Contract AgentOps Demo ===\n");

	// Start MCP servers
	console.log("Starting MCP servers...");
	for (const server of MCP_SERVERS) {
		const serverDir = resolve(__dirname, "mcp-servers", server.name);
		startProcess(server.name, serverDir);
	}

	// Wait for MCP health
	console.log("\nWaiting for MCP servers to be ready...");
	const healthResults = await Promise.all(
		MCP_SERVERS.map((server, index) =>
			waitForHealth(server.port, server.name, {
				process: processes[index],
			}),
		),
	);

	const healthy = healthResults.filter(Boolean).length;
	console.log(`\n${healthy}/${MCP_SERVERS.length} MCP servers ready`);

	// Start Gateway
	const gatewayPort = Number.parseInt(process.env.GATEWAY_PORT ?? "8000", 10);
	console.log("\nStarting API Gateway...");
	const gatewayProcess = startProcess("gateway", resolve(__dirname, "gateway"));
	await waitForHealth(gatewayPort, "gateway", {
		path: "/api/v1/health",
		process: gatewayProcess,
	});

	console.log("\n=== Ready ===");
	console.log(`UI:        http://localhost:${gatewayPort}`);
	console.log(`Gateway:   http://localhost:${gatewayPort}`);
	console.log(`Health:    http://localhost:${gatewayPort}/api/v1/health`);
	console.log("\nPress Ctrl+C to stop all services\n");

	// Keep the main process alive — setInterval creates an active handle
	// that prevents Node.js from draining the event loop and exiting.
	setInterval(() => {}, 60_000);
}

main().catch((err) => {
	console.error("Startup failed:", err);
	shutdown();
});
