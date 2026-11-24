"""Settings, read from the project's .env file (one level above backend/) and the environment."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # paper2lab/


def _load_dotenv(path: Path) -> None:
    """Minimal .env reader so the backend needs no extra dependency. Real env vars win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.8-flash"))
    gemini_rpm: int = field(default_factory=lambda: max(1, int(os.getenv("GEMINI_RPM", "8") or 8)))
    elevenlabs_api_key: str = field(default_factory=lambda: os.getenv("ELEVENLABS_API_KEY", ""))
    elevenlabs_voice_id: str = field(default_factory=lambda: os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"))
    elevenlabs_model: str = field(default_factory=lambda: os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2"))
    cache_dir: Path = field(default_factory=lambda: Path(os.getenv("PAPER2LAB_CACHE_DIR", str(ROOT / ".cache" / "gemini"))))
    registry_path: Path = ROOT / "shared" / "registry.json"
    cors_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")


settings = Settings()
