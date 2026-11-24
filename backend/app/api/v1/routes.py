"""Backend API gateway, /api/v1 (layer 2). Each route hands off to one agent."""
from __future__ import annotations

import base64
import binascii
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ...core.config import settings
from ...core.gemini import GeminiBusy, GeminiError, MODELS
from ...core.registry import registry

router = APIRouter(prefix="/api/v1")

MAX_IMAGE_BYTES = 8 * 1024 * 1024


class AnalyzeIn(BaseModel):
    image: str = Field(description="Base64 image, ideally a ≤768 px JPEG")
    mime: str = "image/jpeg"


class LabSnapshot(BaseModel):
    """The live simulation state, sent from the browser where the physics runs."""
    title: str | None = None
    template: str | None = None
    equations: list[str] = []
    parts: list[dict[str, Any]] = []
    params: list[dict[str, Any]] = []
    actions: list[dict[str, Any]] = []
    readout: dict[str, Any] | None = None


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    language: str = "en-IN"
    lab: LabSnapshot


class TranslateIn(BaseModel):
    texts: list[str] = Field(max_length=60)
    language: str


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=2500)


def _agents(request: Request):
    return request.app.state.agents


def _need_gemini(request: Request) -> None:
    if not _agents(request).gemini.enabled:
        raise HTTPException(503, "No GEMINI_API_KEY in .env, so Paper2Lab is in on-device mode.")


async def _guard(coro):
    try:
        return await coro
    except GeminiBusy as e:
        raise HTTPException(503, str(e)) from e
    except GeminiError as e:
        raise HTTPException(502, str(e)) from e


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/status")
async def status(request: Request) -> dict[str, Any]:
    a = _agents(request)
    return {
        "gemini": a.gemini.enabled,
        "elevenlabs": a.voice.can_speak,
        "model": (a.gemini.eff.stats.last_model or settings.gemini_model) if a.gemini.enabled else None,
        "backend": "fastapi",
    }


@router.get("/usage")
async def usage(request: Request) -> dict[str, Any]:
    eff = _agents(request).gemini.eff
    s = eff.stats
    return {
        "requests": s.requests,
        "cacheHits": s.cache_hits,
        "coalesced": s.coalesced,
        "skippedBusy": s.skipped_busy,
        "failures": s.failures,
        "tokens": {"input": s.input_tokens, "output": s.output_tokens, "thinking": s.thinking_tokens},
        "byTask": s.by_task,
        "cooling": eff.cooldown.cooling(MODELS),
        "perMinute": eff.limiter.per_minute,
    }


@router.get("/registry")
async def get_registry() -> dict[str, Any]:
    """The shared component & simulation registry, so any client sees the same parts and ranges."""
    return registry()


@router.post("/diagram/analyze")
async def analyze(body: AnalyzeIn, request: Request) -> dict[str, Any]:
    """Vision agent → scientific reasoning & validation → simulation orchestrator."""
    _need_gemini(request)
    try:
        size = len(base64.b64decode(body.image, validate=True))
    except (binascii.Error, ValueError) as e:
        raise HTTPException(400, "The image is not valid base64.") from e
    if size > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large; send a ≤768 px JPEG.")
    return await _guard(_agents(request).orchestrator.from_image(body.image, body.mime))


@router.post("/tutor/ask")
async def ask(body: AskIn, request: Request) -> dict[str, Any]:
    """Spatial tutor: grounding, action planning and a grounded explanation."""
    _need_gemini(request)
    return await _guard(_agents(request).tutor.ask(body.question, body.lab.model_dump(), body.language))


@router.post("/voice/translate")
async def translate(body: TranslateIn, request: Request) -> dict[str, Any]:
    _need_gemini(request)
    return await _guard(_agents(request).voice.translate(body.texts, body.language))


@router.post("/voice/speak")
async def speak(body: SpeakIn, request: Request) -> Response:
    voice = _agents(request).voice
    if not voice.can_speak:
        raise HTTPException(503, "No ELEVENLABS_API_KEY in .env.")
    try:
        return Response(await voice.speak(body.text), media_type="audio/mpeg")
    except Exception as e:  # noqa: BLE001 - surface any provider failure as a clean 502
        raise HTTPException(502, f"ElevenLabs error: {e}") from e
