import { useState, useCallback } from "react";

const BASE = "/api/v1";

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
      return json;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const post = useCallback(async (path: string, body: unknown) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
      return json;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, get, post };
}
