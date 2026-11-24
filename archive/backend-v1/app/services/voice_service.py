import base64
import logging
import httpx
from typing import Optional

from app.core.config import settings
from app.schemas.voice import VoiceRequest, VoiceResponse

logger = logging.getLogger(__name__)

# Default ElevenLabs voice IDs for high quality educational narration
VOICE_MAP = {
    "en": "21m00Tcm4TlvDq8ikWAM",  # Rachel (calm, clear tutor)
    "hi": "pNInz6obpgDQGcFmaJgB",  # Adam / Multilingual
    "es": "ErXwobaYiN019PkySvjV",  # Antoni
    "fr": "VR6AewLTigWG4xSOukaG",  # Arnold
    "default": "21m00Tcm4TlvDq8ikWAM"
}


class VoiceService:
    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self.base_url = "https://api.elevenlabs.io/v1/text-to-speech"

    async def generate_speech(self, request: VoiceRequest) -> VoiceResponse:
        voice_id = request.voice_id or VOICE_MAP.get(request.language, VOICE_MAP["default"])
        
        if self.api_key:
            try:
                headers = {
                    "xi-api-key": self.api_key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg"
                }
                payload = {
                    "text": request.text,
                    "model_id": request.model_id or "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75
                    }
                }
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{self.base_url}/{voice_id}",
                        headers=headers,
                        json=payload
                    )
                    if resp.status_code == 200:
                        audio_b64 = base64.b64encode(resp.content).decode("utf-8")
                        return VoiceResponse(
                            audio_base64=audio_b64,
                            mime_type="audio/mpeg",
                            characters_used=len(request.text),
                            language=request.language
                        )
                    else:
                        logger.warning(f"ElevenLabs API returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"ElevenLabs TTS call failed: {e}")

        # Synthetic fallback audio for local testing / offline environments
        mock_audio_b64 = self._generate_silent_audio_payload()
        return VoiceResponse(
            audio_base64=mock_audio_b64,
            mime_type="audio/wav",
            characters_used=len(request.text),
            language=request.language
        )

    def _generate_silent_audio_payload(self) -> str:
        # Minimal valid 44-byte PCM WAV header with 0.1s silence
        # Enables frontend Audio players to initialize without error
        wav_header = bytearray([
            0x52, 0x49, 0x46, 0x46,  # "RIFF"
            0x24, 0x00, 0x00, 0x00,  # File size - 8
            0x57, 0x41, 0x56, 0x45,  # "WAVE"
            0x66, 0x6D, 0x74, 0x20,  # "fmt "
            0x10, 0x00, 0x00, 0x00,  # Subchunk1Size (16 for PCM)
            0x01, 0x00,              # AudioFormat (1 = PCM)
            0x01, 0x00,              # NumChannels (1 = Mono)
            0x44, 0xAC, 0x00, 0x00,  # SampleRate (44100)
            0x88, 0x58, 0x01, 0x00,  # ByteRate (44100 * 2)
            0x02, 0x00,              # BlockAlign (2)
            0x10, 0x00,              # BitsPerSample (16)
            0x64, 0x61, 0x74, 0x61,  # "data"
            0x00, 0x00, 0x00, 0x00   # Data size (0 bytes of audio)
        ])
        return base64.b64encode(wav_header).decode("utf-8")


voice_service = VoiceService()
