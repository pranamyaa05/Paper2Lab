from typing import Optional
from pydantic import BaseModel, Field


class VoiceRequest(BaseModel):
    text: str = Field(..., description="Text content to speak")
    language: str = Field(default="en", description="Language code e.g. en, hi, es, fr, de, ta")
    voice_id: Optional[str] = Field(None, description="Optional custom ElevenLabs Voice ID")
    model_id: str = Field(default="eleven_multilingual_v2")


class VoiceResponse(BaseModel):
    audio_base64: str = Field(..., description="Base64 encoded MP3 audio data")
    mime_type: str = "audio/mpeg"
    characters_used: int = 0
    language: str = "en"
