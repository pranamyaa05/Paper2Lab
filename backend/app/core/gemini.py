"""Gemini client: one request to the first suitable model, through the efficiency layer."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import httpx

from .config import settings
from .efficiency import ATTEMPT_TIMEOUT_S, MAX_ATTEMPTS, MAX_OUTPUT_TOKENS, TOTAL_BUDGET_S, CallResult, Efficiency, Task, retry_delay_s, route_models

log = logging.getLogger("paper2lab.gemini")

MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiBusy(Exception):
    """Every suitable model is overloaded, out of quota or cooling down."""


class GeminiError(Exception):
    pass


class GeminiClient:
    def __init__(self, efficiency: Efficiency, http: httpx.AsyncClient | None = None):
        self.eff = efficiency
        self.http = http or httpx.AsyncClient()

    @property
    def enabled(self) -> bool:
        return bool(settings.gemini_api_key)

    async def send(self, task: Task, parts: list[dict[str, Any]]) -> CallResult:
        deadline = time.monotonic() + TOTAL_BUDGET_S
        last_error = "every model is cooling down after recent overloads"
        attempts = 0
        for model in route_models(settings.gemini_model, MODELS):
            if self.eff.cooldown.is_cooling(model):
                self.eff.stats.skipped_busy += 1
                continue
            if attempts >= MAX_ATTEMPTS:
                break
            wait = self.eff.limiter.wait_time()
            if time.monotonic() + wait > deadline - 3:
                if wait:
                    last_error = "per-minute request budget used up"
                break
            if wait:
                await asyncio.sleep(wait)
            self.eff.limiter.take()
            attempts += 1
            timeout = min(ATTEMPT_TIMEOUT_S[task], max(3.0, deadline - time.monotonic()))
            try:
                r = await self.http.post(
                    API.format(model=model),
                    headers={"x-goog-api-key": settings.gemini_api_key},
                    json={
                        "contents": [{"role": "user", "parts": parts}],
                        "generationConfig": {"temperature": 0.2, "maxOutputTokens": MAX_OUTPUT_TOKENS[task], "responseMimeType": "application/json"},
                    },
                    timeout=timeout,
                )
            except httpx.TimeoutException:
                last_error = f"{model} timed out"
                self.eff.cooldown.mark(model, 30)
                log.warning("%s: %s; cooling it down", task, last_error)
                continue
            except httpx.HTTPError as e:
                last_error = f"{model}: {e}"
                continue
            if r.status_code == 200:
                data = r.json()
                text = "".join(p.get("text", "") for p in (data.get("candidates") or [{}])[0].get("content", {}).get("parts", []))
                u = data.get("usageMetadata", {})
                result = CallResult(text, model, u.get("promptTokenCount", 0), u.get("candidatesTokenCount", 0), u.get("thoughtsTokenCount", 0))
                self.eff.record(task, result)
                log.info("%s: %s · %d in / %d out / %d thinking tokens", task, model, result.input_tokens, result.output_tokens, result.thinking_tokens)
                if text:
                    return result
                last_error = f"{model} returned no answer"
                continue
            body = r.text
            last_error = f"{model} → {r.status_code}"
            if r.status_code == 429:
                self.eff.cooldown.mark(model, retry_delay_s(body) or 60)
            elif r.status_code in (500, 503):
                self.eff.cooldown.mark(model, 45)
            elif r.status_code == 404:
                self.eff.cooldown.mark(model, 3600)
            else:
                raise GeminiError(f"Gemini error {last_error}: {body[:200]}")
            log.warning("%s: %s; cooling it down", task, last_error)
        self.eff.stats.failures += 1
        raise GeminiBusy(f"Gemini is busy right now ({last_error}). Try again in a moment.")

    async def json(self, task: Task, cache_payload: Any, parts: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
        """Cached, coalesced call that returns (parsed JSON, meta)."""
        result, cached = await self.eff.run(task, cache_payload, lambda: self.send(task, parts))
        return parse_json(result.text), {"model": result.model, "cached": cached}


def parse_json(text: str) -> dict[str, Any]:
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise GeminiError("The AI's answer was not valid JSON.") from e
    if not isinstance(data, dict):
        raise GeminiError("The AI's answer was not a JSON object.")
    return data
