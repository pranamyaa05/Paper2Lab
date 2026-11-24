import logging
from fastapi import APIRouter, HTTPException, status

from app.schemas.voice import VoiceRequest, VoiceResponse
from app.services.voice_service import voice_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/speak", response_model=VoiceResponse, status_code=status.HTTP_200_OK)
async def generate_voice_narration(request: VoiceRequest):
    """
    Step 7: Multilingual Voice Explanation powered by ElevenLabs.
    Converts scientific explanations into spoken audio in the student's chosen language.
    """
    try:
        return await voice_service.generate_speech(request)
    except Exception as e:
        logger.error(f"Voice generation endpoint error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech synthesis error: {str(e)}"
        )
