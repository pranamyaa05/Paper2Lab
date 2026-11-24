"""
Efficiency layer for Gemini calls. Every request goes through here so the app spends as few
requests and tokens as possible, and never hammers a model that is overloaded or out of quota:

 1. Cache     identical requests (same image, question or sentence) are answered from memory or
              disk at zero cost; analyses and translations never expire.
 2. Coalesce  a request already in flight is awaited instead of being sent again.
 3. Route     lite models go first: they read diagrams well and have a far larger free quota
              (bigger Flash models allow only ~20 free requests a day each).
 4. Cool-down a model that answers 503/429 is skipped, for Google's own retry delay when given.
 5. Pace      a requests-per-minute budget keeps the key under its quota.
 6. Meter     requests, cache hits and tokens are counted for the usage badge.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Literal

Task = Literal["analyze", "ask", "translate"]
TASKS: tuple[Task, ...] = ("analyze", "ask", "translate")

MAX_OUTPUT_TOKENS: dict[Task, int] = {"analyze": 3072, "ask": 400, "translate": 2048}
ATTEMPT_TIMEOUT_S: dict[Task, float] = {"analyze": 30.0, "ask": 15.0, "translate": 15.0}
TTL_S: dict[Task, float] = {"analyze": float("inf"), "translate": float("inf"), "ask": 24 * 3600.0}
MAX_ATTEMPTS = 3
TOTAL_BUDGET_S = 40.0


@dataclass
class CallResult:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    thinking_tokens: int = 0

    def to_json(self) -> dict[str, Any]:
        return self.__dict__.copy()


def route_models(configured: str | None, models: list[str]) -> list[str]:
    """Cheapest-first: every lite model, then the configured model, then the rest."""
    lite = [m for m in models if "lite" in m]
    full = [m for m in models if "lite" not in m]
    seen: dict[str, None] = {}
    for m in [*lite, configured, *full]:
        if m:
            seen.setdefault(m, None)
    return list(seen)


def cache_key(task: str, payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(f"{task}\0{raw}".encode()).hexdigest()


def retry_delay_s(body: str) -> float | None:
    """Google's RetryInfo, e.g. "retryDelay": "17s" (can be many hours for a daily quota)."""
    m = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', body)
    return float(m.group(1)) if m else None


class RateLimiter:
    """Sliding one-minute window of request start times."""

    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic):
        self.per_minute = per_minute
        self._clock = clock
        self._starts: list[float] = []

    def wait_time(self) -> float:
        now = self._clock()
        self._starts = [s for s in self._starts if now - s < 60]
        if len(self._starts) < self.per_minute:
            return 0.0
        return 60 - (now - self._starts[0]) + 0.05

    def take(self) -> None:
        self._starts.append(self._clock())


class CoolDown:
    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self._clock = clock
        self._until: dict[str, float] = {}

    def mark(self, model: str, seconds: float) -> None:
        self._until[model] = self._clock() + seconds

    def is_cooling(self, model: str) -> bool:
        return self._until.get(model, 0) > self._clock()

    def cooling(self, models: list[str]) -> list[str]:
        return [m for m in models if self.is_cooling(m)]


@dataclass
class Stats:
    requests: int = 0
    cache_hits: int = 0
    coalesced: int = 0
    skipped_busy: int = 0
    failures: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    thinking_tokens: int = 0
    by_task: dict[str, dict[str, int]] = field(default_factory=lambda: {t: {"requests": 0, "cache_hits": 0, "tokens": 0} for t in TASKS})
    last_model: str | None = None


class Efficiency:
    def __init__(self, cache_dir: Path | None, per_minute: int):
        self.cache_dir = cache_dir
        self.limiter = RateLimiter(per_minute)
        self.cooldown = CoolDown()
        self.stats = Stats()
        self._memory: dict[str, tuple[float, CallResult]] = {}
        self._inflight: dict[str, asyncio.Future[CallResult]] = {}

    # ---- cache -------------------------------------------------------------------------------
    def _read_disk(self, key: str) -> tuple[float, CallResult] | None:
        if not self.cache_dir:
            return None
        try:
            raw = json.loads((self.cache_dir / f"{key}.json").read_text())
            return raw["at"], CallResult(**raw["value"])
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def _write_disk(self, key: str, at: float, value: CallResult) -> None:
        if not self.cache_dir:
            return
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            (self.cache_dir / f"{key}.json").write_text(json.dumps({"at": at, "value": value.to_json()}, ensure_ascii=False))
        except OSError:
            pass  # the cache is an optimisation; never fail a request because of it

    def lookup(self, task: Task, payload: Any) -> CallResult | None:
        key = cache_key(task, payload)
        entry = self._memory.get(key) or self._read_disk(key)
        if not entry or time.time() - entry[0] >= TTL_S[task]:
            return None
        self._memory[key] = entry
        self.stats.cache_hits += 1
        self.stats.by_task[task]["cache_hits"] += 1
        return entry[1]

    def store(self, task: Task, payload: Any, value: CallResult) -> None:
        key = cache_key(task, payload)
        at = time.time()
        self._memory[key] = (at, value)
        self._write_disk(key, at, value)

    async def run(self, task: Task, payload: Any, send: Callable[[], Awaitable[CallResult]]) -> tuple[CallResult, bool]:
        """Return (result, came_from_cache). Calls `send` only when nothing can be reused."""
        hit = self.lookup(task, payload)
        if hit:
            return hit, True
        key = cache_key(task, payload)
        if key in self._inflight:
            self.stats.coalesced += 1
            return await asyncio.shield(self._inflight[key]), True
        fut: asyncio.Future[CallResult] = asyncio.get_running_loop().create_future()
        self._inflight[key] = fut
        try:
            value = await send()
            self.store(task, payload, value)
            fut.set_result(value)
            return value, False
        except BaseException as e:
            fut.set_exception(e)
            fut.exception()  # mark retrieved so asyncio doesn't warn when nobody else was waiting
            raise
        finally:
            self._inflight.pop(key, None)

    # ---- metering ----------------------------------------------------------------------------
    def record(self, task: Task, r: CallResult) -> None:
        s = self.stats
        s.requests += 1
        s.by_task[task]["requests"] += 1
        s.input_tokens += r.input_tokens
        s.output_tokens += r.output_tokens
        s.thinking_tokens += r.thinking_tokens
        s.by_task[task]["tokens"] += r.input_tokens + r.output_tokens + r.thinking_tokens
        s.last_model = r.model
