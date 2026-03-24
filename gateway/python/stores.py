"""JSON file-backed data stores (equivalent to gateway/src/stores/jsonStore.ts)."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

from . import config


class JsonStore:
    """Thread-safe, file-backed JSON array store with serialised writes."""

    def __init__(self, file_path: str | Path) -> None:
        self._path = Path(file_path)
        self._items: list[dict[str, Any]] = []
        self._loaded = False
        self._write_lock = asyncio.Lock()

    async def load(self) -> None:
        try:
            raw = self._path.read_text(encoding="utf-8")
            self._items = json.loads(raw)
        except FileNotFoundError:
            self._items = []
        except Exception as exc:
            print(f"[JsonStore] Failed to load {self._path}: {exc}. Starting empty.")
            self._items = []
        self._loaded = True

    def _ensure(self) -> None:
        if not self._loaded:
            raise RuntimeError(f"Store not loaded: {self._path}")

    def get_all(self) -> list[dict[str, Any]]:
        self._ensure()
        return list(self._items)

    def get_by_id(self, item_id: str) -> dict[str, Any] | None:
        self._ensure()
        return next((i for i in self._items if i.get("id") == item_id), None)

    def get_by_field(self, field: str, value: Any) -> list[dict[str, Any]]:
        self._ensure()
        return [i for i in self._items if i.get(field) == value]

    async def add(self, item: dict[str, Any]) -> dict[str, Any]:
        self._ensure()
        self._items.append(item)
        await self._save()
        return item

    async def update(self, item_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        self._ensure()
        for i, item in enumerate(self._items):
            if item.get("id") == item_id:
                self._items[i] = {**item, **updates}
                await self._save()
                return self._items[i]
        return None

    async def remove(self, item_id: str) -> bool:
        self._ensure()
        before = len(self._items)
        self._items = [i for i in self._items if i.get("id") != item_id]
        if len(self._items) < before:
            await self._save()
            return True
        return False

    async def _save(self) -> None:
        async with self._write_lock:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(
                json.dumps(self._items, indent=2, default=str),
                encoding="utf-8",
            )


# ---------------------------------------------------------------------------
# Store instances
# ---------------------------------------------------------------------------
contract_store = JsonStore(config.DATA_DIR / "contracts.json")
audit_store = JsonStore(config.DATA_DIR / "audit.json")
feedback_store = JsonStore(config.DATA_DIR / "feedback.json")
evaluation_store = JsonStore(config.DATA_DIR / "evaluations.json")
test_scenario_store = JsonStore(config.DATA_DIR / "test-scenarios.json")

# ---------------------------------------------------------------------------
# Contract text helpers
# ---------------------------------------------------------------------------
_text_dir = config.DATA_DIR / "contract-texts"


async def save_contract_text(contract_id: str, text: str) -> None:
    _text_dir.mkdir(parents=True, exist_ok=True)
    (_text_dir / f"{contract_id}.txt").write_text(text, encoding="utf-8")


async def load_contract_text(contract_id: str) -> str | None:
    p = _text_dir / f"{contract_id}.txt"
    return p.read_text(encoding="utf-8") if p.exists() else None


async def hydrate_contract_text(contract: dict[str, Any] | None) -> dict[str, Any] | None:
    if contract is None:
        return None
    text = await load_contract_text(contract["id"])
    out = dict(contract)
    if text is not None:
        out["text"] = text
    return out


# ---------------------------------------------------------------------------
# Trace storage (in-memory LRU, max 500 contracts)
# ---------------------------------------------------------------------------
_traces: dict[str, list[dict[str, Any]]] = {}
_MAX_TRACES = 500


def store_traces(contract_id: str, traces: list[dict[str, Any]]) -> None:
    if len(_traces) >= _MAX_TRACES:
        oldest = next(iter(_traces))
        del _traces[oldest]
    _traces[contract_id] = traces


def get_traces(contract_id: str) -> list[dict[str, Any]]:
    return _traces.get(contract_id, [])


async def init_stores() -> None:
    await asyncio.gather(
        contract_store.load(),
        audit_store.load(),
        feedback_store.load(),
        evaluation_store.load(),
        test_scenario_store.load(),
    )
