"""WebSocket connection manager (equivalent to gateway/src/websocket/workflowWs.ts)."""

from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket

_clients: set[WebSocket] = set()


async def add_ws_client(ws: WebSocket) -> None:
    await ws.accept()
    _clients.add(ws)


def remove_ws_client(ws: WebSocket) -> None:
    _clients.discard(ws)


async def broadcast(event: dict[str, Any]) -> None:
    message = json.dumps(event, default=str)
    dead: list[WebSocket] = []
    for client in _clients:
        try:
            await client.send_text(message)
        except Exception:
            dead.append(client)
    for d in dead:
        _clients.discard(d)
