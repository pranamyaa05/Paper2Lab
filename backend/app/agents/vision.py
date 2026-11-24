"""
Multimodal Vision Agent (layer 3): Gemini reads the diagram and reports the concept, the components it
can see, where each one is, and any values printed on it. The prompt is generated from the shared
registry, so the vision agent always knows exactly which tested simulations exist.
"""
from __future__ import annotations

from typing import Any

from ..core.gemini import GeminiClient
from ..core.registry import registry

PROMPT_VERSION = 3


def build_prompt() -> str:
    lines = []
    for t in registry()["templates"]:
        parts = ",".join(p["id"] for p in t["parts"])
        params = ", ".join(f'{p["id"]}{" " + p["unit"] if p["unit"] else ""}' for p in t["params"])
        lines.append(f'{t["id"]} ({t["subject"]}): {parts} | {params}')
    templates = "\n".join(lines)
    return f"""Read this school science diagram. Reply with ONE JSON object, no markdown.

If it matches a template below, reply ONLY: {{"template","subject","title","confidence","parts":[{{"id","bbox"}}],"params":[{{"id","value"}}]}} using that template's part ids, with values read off the diagram where printed.
Templates (id: parts | params):
{templates}

Otherwise reply {{"template":"generic","subject","title","concept","summary"(1 sentence, age 14),"intro"(2 spoken sentences),"confidence",
"parts":[≤8 {{"id","name","short"(≤5 words),"narration"(2 sentences),"bbox"}}],
"params":[≤4 {{"id","label","unit","min","max","step","value","kind"?:"toggle"}}],
"equations":[≤3],
"scene":[≤30 {{"id","part","shape":box|sphere|cylinder|cone|torus|capsule|arrow,"position":[x,y,z],"size":[x,y,z],"rotation"?,"color"(pastel hex),"opacity"?,"motion"?:{{"type":spin|oscillate|slide|pulse|orbit|flow,"axis","speed","amplitude"}}}}],
"readouts":[≤3 {{"label","formula","unit"}}]}}

bbox = [x,y,w,h] as fractions of the image. Scene fits a 6×4×3 box at the origin, y up. oscillate swings about the shape's top (pendulums); flow moves along the axis and wraps.
Formulas use param ids, t, numbers, + - * / ^ ( ) and sin cos sqrt abs min max pow exp log, and must follow the real science (e.g. pendulum speed sqrt(g/L))."""


class VisionAgent:
    def __init__(self, gemini: GeminiClient):
        self.gemini = gemini

    async def perceive(self, image_b64: str, mime: str) -> tuple[dict[str, Any], dict[str, Any]]:
        """Raw perception from the model, plus meta (model, cached). Cached by image, so a diagram is read once."""
        return await self.gemini.json(
            "analyze",
            {"v": PROMPT_VERSION, "image": image_b64},
            [{"text": build_prompt()}, {"inline_data": {"mime_type": mime or "image/jpeg", "data": image_b64}}],
        )
