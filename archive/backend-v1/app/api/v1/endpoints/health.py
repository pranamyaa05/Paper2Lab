from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "features": {
            "gemini_multimodal_enabled": bool(settings.GEMINI_API_KEY),
            "elevenlabs_voice_enabled": bool(settings.ELEVENLABS_API_KEY),
            "physics_equation_solver": True,
            "agentic_simulation_control": True
        }
    }
