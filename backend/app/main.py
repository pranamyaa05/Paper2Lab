"""
Paper2Lab backend.

  UI ──► API gateway (/api/v1) ──► Vision agent ──► Reasoning & validation ──► Simulation orchestrator
                                └► Spatial tutor agent ──► actions for the 3D view
                                └► Voice agent (translation + speech)
  Every Gemini call passes through the efficiency layer (cache · coalesce · route · cool-down · pace).

The simulation itself runs in the browser at 60 fps from the same shared registry, so the backend is
never in the animation loop; the tutor receives a snapshot of the live state with each question.

Run:  uvicorn app.main:app --reload --port 8000   (from backend/)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .agents.orchestrator import SimulationOrchestrator
from .agents.reasoning import ScientificReasoningEngine
from .agents.tutor import SpatialTutorAgent
from .agents.vision import VisionAgent
from .agents.voice import VoiceAgent
from .api.v1.routes import router
from .core.config import settings
from .core.efficiency import Efficiency
from .core.gemini import GeminiClient

logging.basicConfig(level=logging.INFO, format="[paper2lab] %(message)s")


@dataclass
class Agents:
    gemini: GeminiClient
    orchestrator: SimulationOrchestrator
    tutor: SpatialTutorAgent
    voice: VoiceAgent


def build_agents(http: httpx.AsyncClient, cache: bool = True) -> Agents:
    gemini = GeminiClient(Efficiency(settings.cache_dir if cache else None, settings.gemini_rpm), http)
    return Agents(
        gemini=gemini,
        orchestrator=SimulationOrchestrator(VisionAgent(gemini), ScientificReasoningEngine()),
        tutor=SpatialTutorAgent(gemini),
        voice=VoiceAgent(gemini, http),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient() as http:
        app.state.agents = build_agents(http)
        yield


app = FastAPI(title="Paper2Lab API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
