import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function startProcess(label: string, cwd: string, args: string[]): ChildProcess {
  const proc = spawn("npx", ["tsx", ...args], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
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

async function waitForHealth(port: number, label: string, retries = 10): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        console.log(`[${label}] healthy on port ${port}`);
        return true;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.warn(`[${label}] not healthy after ${retries} retries`);
  return false;
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
    startProcess(server.name, serverDir, ["src/server.ts"]);
  }

  // Wait for MCP health
  console.log("\nWaiting for MCP servers to be ready...");
  const healthResults = await Promise.all(
    MCP_SERVERS.map((s) => waitForHealth(s.port, s.name)),
  );

  const healthy = healthResults.filter(Boolean).length;
  console.log(`\n${healthy}/${MCP_SERVERS.length} MCP servers ready`);

  // Start Gateway
  console.log("\nStarting API Gateway...");
  startProcess("gateway", resolve(__dirname, "gateway"), ["src/index.ts"]);
  await waitForHealth(8000, "gateway");

  // Start Dashboard
  console.log("\nStarting Dashboard...");
  const dashboardDir = resolve(__dirname, "dashboard");
  const dashProc = spawn("npx", ["vite", "--port", "3000"], {
    cwd: dashboardDir,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  dashProc.stdout?.on("data", (data: Buffer) => {
    console.log(`[dashboard] ${data.toString().trim()}`);
  });
  dashProc.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[dashboard] ${msg}`);
  });
  processes.push(dashProc);

  console.log("\n=== Ready ===");
  console.log("Dashboard: http://localhost:3000");
  console.log("Gateway:   http://localhost:8000");
  console.log("Health:    http://localhost:8000/api/v1/health");
  console.log("\nPress Ctrl+C to stop all services\n");
}

main().catch((err) => {
  console.error("Startup failed:", err);
  shutdown();
});
