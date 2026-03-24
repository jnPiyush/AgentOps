"""Contract AgentOps Demo - Orchestrator.

Starts all MCP servers, waits for health, then launches the FastAPI gateway.
"""

from __future__ import annotations

import asyncio
import os
import signal
import subprocess
import sys
from pathlib import Path

import httpx

ROOT_DIR = Path(__file__).resolve().parent

MCP_SERVERS = [
    {"name": "contract-intake-mcp", "port": 9001},
    {"name": "contract-extraction-mcp", "port": 9002},
    {"name": "contract-compliance-mcp", "port": 9003},
    {"name": "contract-workflow-mcp", "port": 9004},
    {"name": "contract-audit-mcp", "port": 9005},
    {"name": "contract-eval-mcp", "port": 9006},
    {"name": "contract-drift-mcp", "port": 9007},
    {"name": "contract-feedback-mcp", "port": 9008},
]

processes: list[subprocess.Popen] = []


def start_process(label: str, cwd: str | Path) -> subprocess.Popen:
    """Spawn a Python MCP server process."""
    proc = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=str(cwd),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    processes.append(proc)

    # Background reader threads for stdout / stderr
    import threading

    def _pipe_reader(pipe, prefix: str) -> None:
        assert pipe is not None
        for raw_line in iter(pipe.readline, b""):
            line = raw_line.decode("utf-8", errors="replace").rstrip()
            if line:
                print(f"[{prefix}] {line}", flush=True)
        pipe.close()

    threading.Thread(target=_pipe_reader, args=(proc.stdout, label), daemon=True).start()
    threading.Thread(target=_pipe_reader, args=(proc.stderr, label), daemon=True).start()

    return proc


def shutdown() -> None:
    """Terminate all child processes."""
    print("\nShutting down...")
    for proc in processes:
        try:
            proc.terminate()
        except OSError:
            pass
    sys.exit(0)


async def wait_for_health(
    port: int,
    label: str,
    *,
    path: str = "/health",
    retries: int = 30,
    interval: float = 1.0,
    timeout: float = 2.0,
    proc: subprocess.Popen | None = None,
) -> bool:
    """Poll an HTTP endpoint until it returns 2xx or retries are exhausted."""
    async with httpx.AsyncClient() as client:
        for attempt in range(1, retries + 1):
            if proc is not None and proc.poll() is not None:
                print(f"[{label}] exited before becoming healthy", file=sys.stderr, flush=True)
                return False
            try:
                resp = await client.get(f"http://localhost:{port}{path}", timeout=timeout)
                if resp.is_success:
                    print(f"[{label}] healthy on port {port}", flush=True)
                    return True
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout, OSError):
                pass

            if attempt < retries:
                await asyncio.sleep(interval)

    print(f"[{label}] not healthy after {retries} retries", file=sys.stderr, flush=True)
    return False


async def main() -> None:
    print("=== Contract AgentOps Demo ===\n")

    # --- MCP servers ---
    print("Starting MCP servers...")
    for server in MCP_SERVERS:
        server_dir = ROOT_DIR / "mcp-servers" / server["name"]
        start_process(server["name"], server_dir)

    print("\nWaiting for MCP servers to be ready...")
    health_results = await asyncio.gather(
        *(
            wait_for_health(server["port"], server["name"], proc=processes[i])
            for i, server in enumerate(MCP_SERVERS)
        )
    )
    healthy = sum(health_results)
    print(f"\n{healthy}/{len(MCP_SERVERS)} MCP servers ready")

    # --- FastAPI Gateway ---
    gateway_port = int(os.environ.get("GATEWAY_PORT", "8000"))
    print("\nStarting API Gateway (FastAPI)...")
    gateway_proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "gateway.python.main:app",
            "--host", "0.0.0.0",
            "--port", str(gateway_port),
        ],
        cwd=str(ROOT_DIR),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    processes.append(gateway_proc)

    import threading

    def _pipe(pipe, prefix: str) -> None:
        assert pipe is not None
        for raw_line in iter(pipe.readline, b""):
            line = raw_line.decode("utf-8", errors="replace").rstrip()
            if line:
                print(f"[{prefix}] {line}", flush=True)
        pipe.close()

    threading.Thread(target=_pipe, args=(gateway_proc.stdout, "gateway"), daemon=True).start()
    threading.Thread(target=_pipe, args=(gateway_proc.stderr, "gateway"), daemon=True).start()

    await wait_for_health(
        gateway_port, "gateway", path="/api/v1/health", proc=gateway_proc,
    )

    print("\n=== Ready ===")
    print(f"UI:        http://localhost:{gateway_port}")
    print(f"Gateway:   http://localhost:{gateway_port}")
    print(f"Health:    http://localhost:{gateway_port}/api/v1/health")
    print("\nPress Ctrl+C to stop all services\n", flush=True)

    # Keep alive until interrupted
    try:
        while True:
            await asyncio.sleep(60)
    except asyncio.CancelledError:
        pass


if __name__ == "__main__":
    signal.signal(signal.SIGINT, lambda *_: shutdown())
    if sys.platform != "win32":
        signal.signal(signal.SIGTERM, lambda *_: shutdown())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        shutdown()
