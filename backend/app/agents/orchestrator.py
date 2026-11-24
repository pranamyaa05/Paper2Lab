"""
Simulation Orchestrator (layer 5): turns a validated reading of the diagram into the simulation the
frontend should run: a tested template (with the AI's part outlines and printed values), an
AI-designed generic simulation, or nothing, in which case the frontend shows its on-device 3D pop-up.
"""
from __future__ import annotations

from typing import Any

from ..core.registry import template
from .reasoning import Report, ScientificReasoningEngine
from .vision import VisionAgent


class SimulationOrchestrator:
    def __init__(self, vision: VisionAgent, reasoning: ScientificReasoningEngine):
        self.vision = vision
        self.reasoning = reasoning

    async def from_image(self, image_b64: str, mime: str) -> dict[str, Any]:
        raw, meta = await self.vision.perceive(image_b64, mime)
        return self.plan(raw, meta)

    def plan(self, raw: dict[str, Any], meta: dict[str, Any] | None = None) -> dict[str, Any]:
        spec, report = self.reasoning.validate(raw)
        return {"mode": self._mode(spec, report), "spec": spec if report.ok else None, "validation": report.to_json(), "note": self._note(spec, report, meta or {}), "meta": meta or {}}

    @staticmethod
    def _mode(spec: dict[str, Any] | None, report: Report) -> str:
        if not report.ok or not spec:
            return "none"
        return "template" if spec["template"] != "generic" else "generic"

    @staticmethod
    def _note(spec: dict[str, Any] | None, report: Report, meta: dict[str, Any]) -> str:
        cached = " (from cache, no AI cost)" if meta.get("cached") else ""
        if not report.ok or not spec:
            return f"Gemini couldn't build a reliable simulation ({'; '.join(report.errors)}), so you get the 3D pop-up instead{cached}."
        if spec["template"] != "generic":
            t = template(spec["template"]) or {}
            note = f"Gemini recognised {t.get('title', spec['template']).lower()} and loaded the matching tested simulation{cached}."
        else:
            note = f"Gemini built a custom simulation; the validation engine checked its formulas and scene{cached}."
        checks = [*report.repairs[:2], *report.warnings[:2]]
        return note + (f" Checks: {'; '.join(checks)}." if checks else "")
