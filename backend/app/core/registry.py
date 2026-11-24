"""The shared component & simulation registry (generated from the frontend's templates.ts)."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from .config import settings


@lru_cache(maxsize=1)
def registry() -> dict[str, Any]:
    return json.loads(settings.registry_path.read_text())


def templates() -> dict[str, dict[str, Any]]:
    return {t["id"]: t for t in registry()["templates"]}


def template(template_id: str) -> dict[str, Any] | None:
    return templates().get(template_id)
