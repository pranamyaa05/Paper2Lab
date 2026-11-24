"""
Spatial AI Tutor Agent (layer 7).

 * Object grounding   maps the question onto the 3D model's own part ids (the shared registry ids).
 * Action generation  plans what the 3D view should do: highlight, focus the camera, rotate the model,
                      change a slider, or run one of the lab's demonstrations.
 * Explanation        a short, grounded answer from Gemini, given a snapshot of the live simulation
                      (slider values and readouts) taken in the browser, where the physics runs.

Every action is checked against the lab's real part ids, parameter ranges and demonstrations.
"""
from __future__ import annotations

import re
from typing import Any

from ..core.gemini import GeminiClient

LANG_NAMES = {"en": "English", "hi": "Hindi", "kn": "Kannada", "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "mr": "Marathi", "es": "Spanish", "fr": "French"}
ROTATE_WORDS = re.compile(r"\b(rotate|spin it|turn it|all sides|other side|from behind|around it|360)\b")
SHOW_WORDS = re.compile(r"\b(show|demonstrate|demo|run|fire|trigger|watch|try)\b")


def _words(s: str) -> str:
    return " " + re.sub(r"[^a-z0-9 ]", " ", s.lower()) + " "


def ground(question: str, parts: list[dict[str, Any]]) -> str | None:
    """The part the question is about, by its name or id. Longer, more specific matches win."""
    q = _words(question)
    best: tuple[int, str] | None = None
    for p in parts:
        name = re.sub(r"\(.*?\)", "", str(p.get("name", ""))).lower().strip()
        score = 10 if name and f" {name} " in q else 0
        score += 3 * sum(1 for tok in name.split() if len(tok) >= 4 and f" {tok.rstrip('s')}" in q)
        score += 2 if f" {str(p.get('id', '')).lower()} " in q else 0
        if score and (best is None or score > best[0]):
            best = (score, p["id"])
    return best[1] if best else None


def plan_actions(question: str, lab: dict[str, Any], ai: dict[str, Any], grounded: str | None) -> list[dict[str, Any]]:
    """Merge the AI's suggestions with local grounding into a safe, ordered action list."""
    part_ids = {p["id"] for p in lab.get("parts", [])}
    params = {p["id"]: p for p in lab.get("params", [])}
    demos = {a["id"] for a in lab.get("actions", [])}
    actions: list[dict[str, Any]] = []

    target = ai.get("highlight") if ai.get("highlight") in part_ids else grounded
    if target:
        actions.append({"type": "highlight", "part": target})
        if ai.get("focus", True) is not False:
            actions.append({"type": "focus", "part": target})

    for pid, value in (ai.get("set") or {}).items():
        p = params.get(pid)
        if p and isinstance(value, (int, float)) and not isinstance(value, bool):
            actions.append({"type": "set", "param": pid, "value": min(p["max"], max(p["min"], float(value)))})

    trigger = ai.get("trigger")
    if trigger in demos:
        actions.append({"type": "trigger", "action": trigger})
    elif SHOW_WORDS.search(question.lower()):
        for d in demos:
            if d in question.lower() or any(w in question.lower() for w in d.split("_")):
                actions.append({"type": "trigger", "action": d})
                break

    if ai.get("rotate") is True or ROTATE_WORDS.search(question.lower()):
        actions.append({"type": "rotate"})
    return actions


class SpatialTutorAgent:
    def __init__(self, gemini: GeminiClient):
        self.gemini = gemini

    async def ask(self, question: str, lab: dict[str, Any], language: str = "en") -> dict[str, Any]:
        grounded = ground(question, lab.get("parts", []))
        lang = LANG_NAMES.get(language[:2], "English")
        snapshot = {
            "title": lab.get("title"),
            "template": lab.get("template"),
            "equations": lab.get("equations", []),
            "parts": [{"id": p["id"], "name": p.get("name")} for p in lab.get("parts", [])],
            "params": [{k: p.get(k) for k in ("id", "label", "unit", "min", "max", "value")} for p in lab.get("params", [])],
            "demos": [a["id"] for a in lab.get("actions", [])],
            "now": lab.get("readout"),
        }
        prompt = (
            f"Science tutor in a 3D lab. Live lab state: {snapshot}\n"
            f"Question: {question!r}" + (f" (it is about part {grounded!r})" if grounded else "") + "\n"
            f'JSON only: {{"answer": 2-4 short spoken sentences in {lang}, accurate to the equations and the live values, '
            '"highlight": part id or omit, "set": {param id: value within min..max} only if changing it demonstrates the answer, '
            '"trigger": a demo id or omit, "rotate": true if seeing the model from all sides helps}. Use only ids listed above.'
        )
        ai, meta = await self.gemini.json("ask", {"v": 2, "q": question.strip().lower(), "lab": snapshot, "lang": lang}, [{"text": prompt}])
        answer = str(ai.get("answer") or "").strip() or "I couldn't work that out. Try asking about one part."
        return {"answer": answer, "actions": plan_actions(question, lab, ai, grounded), "grounded": grounded, "meta": meta}
