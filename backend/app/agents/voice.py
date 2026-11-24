"""Voice agent: batched, cached translation (Gemini) and multilingual speech (ElevenLabs)."""
from __future__ import annotations

from typing import Any

import httpx

from ..core.config import settings
from ..core.efficiency import CallResult
from ..core.gemini import GeminiClient
from .tutor import LANG_NAMES


class VoiceAgent:
    def __init__(self, gemini: GeminiClient, http: httpx.AsyncClient):
        self.gemini = gemini
        self.http = http

    async def translate(self, texts: list[str], language: str) -> dict[str, Any]:
        """Each line is cached on its own; lines never translated before go out together in ONE request."""
        lang = LANG_NAMES.get(language[:2], "English")
        if lang == "English" or not texts:
            return {"texts": texts, "sent": 0, "cached": 0}
        eff = self.gemini.eff
        out: list[str | None] = [(hit.text if (hit := eff.lookup("translate", {"lang": lang, "t": t})) else None) for t in texts]
        missing = list(dict.fromkeys(t for t, o in zip(texts, out) if o is None))
        if missing:
            prompt = (
                f"Translate each string into {lang} for a school student. Keep scientific terms accurate and symbols unchanged. "
                f'JSON only: {{"texts":[...]}} in the same order.\n{missing}'
            )
            data, _ = await self.gemini.json("translate", {"batch": missing, "lang": lang}, [{"text": prompt}])
            translated = [str(x) for x in data.get("texts", [])]
            for t, tr in zip(missing, translated):
                eff.store("translate", {"lang": lang, "t": t}, CallResult(tr, "cache"))
            lookup = dict(zip(missing, translated))
            out = [o if o is not None else lookup.get(t, t) for t, o in zip(texts, out)]
        return {"texts": out, "sent": len(missing), "cached": len(texts) - len(missing)}

    @property
    def can_speak(self) -> bool:
        return bool(settings.elevenlabs_api_key)

    async def speak(self, text: str) -> bytes:
        r = await self.http.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}",
            headers={"xi-api-key": settings.elevenlabs_api_key, "accept": "audio/mpeg"},
            json={"text": text[:2500], "model_id": settings.elevenlabs_model},
            timeout=30,
        )
        r.raise_for_status()
        return r.content
