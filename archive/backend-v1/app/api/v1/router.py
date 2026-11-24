from fastapi import APIRouter
from app.api.v1.endpoints import diagram, ask, voice, health

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(diagram.router, prefix="/diagram", tags=["Diagram & Simulation"])
api_router.include_router(ask.router, prefix="/ask", tags=["Ask Your Diagram"])
api_router.include_router(voice.router, prefix="/voice", tags=["Multilingual Voice"])
