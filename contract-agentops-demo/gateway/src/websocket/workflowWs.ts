import type { WebSocket } from "ws";
import type { WebSocketEvent } from "../types.js";

const clients = new Set<WebSocket>();

export function addWsClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
}

export function broadcast(event: WebSocketEvent): void {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}
