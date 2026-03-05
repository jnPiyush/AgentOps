import { useEffect, useRef, useState, useCallback } from "react";

export interface WsMessage {
  event: string;
  contract_id: string;
  agent?: string;
  status: string;
  result?: unknown;
  latency_ms?: number;
  tokens?: { input: number; output: number };
  timestamp: string;
}

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        setMessages((prev) => [...prev, data]);
      } catch {
        // ignore non-JSON messages
      }
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, connected, clearMessages };
}
