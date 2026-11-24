import logging
from fastapi import APIRouter, HTTPException, status

from app.schemas.ask import AskDiagramRequest, AskDiagramResponse
from app.schemas.voice import VoiceRequest
from app.services.agent_service import agent_service
from app.services.voice_service import voice_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=AskDiagramResponse, status_code=status.HTTP_200_OK)
async def ask_diagram_companion(request: AskDiagramRequest):
    """
    Step 6: 'Ask Your Diagram' AI Learning Companion.
    Provides contextual explanations AND returns physical simulation actions (highlights, slider moves).
    Optionally returns synthesized voice audio if generate_speech is True.
    """
    try:
        response = await agent_service.answer_question(request)
        
        if request.generate_speech and response.answer:
            try:
                voice_resp = await voice_service.generate_speech(
                    VoiceRequest(text=response.answer, language=request.language)
                )
                response.audio_base64 = voice_resp.audio_base64
            except Exception as e:
                logger.warning(f"Voice generation failed inside ask endpoint: {e}")
        
        return response
    except Exception as e:
        logger.error(f"Error answering student question: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process inquiry: {str(e)}"
        )
