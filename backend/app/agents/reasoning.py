"""
Scientific Reasoning & Validation Engine (layer 4).

Nothing the vision model says reaches a student unchecked. For a recognised template it confirms the
template exists, keeps only known part ids, clips bounding boxes to the image and clamps every
parameter into the tested range. For an AI-designed ("generic") simulation it checks the structure,
the parameter ranges, every formula's safety and behaviour across the whole parameter range, and that
the 3D scene fits the stage, repairing what it can and rejecting what it can't.
"""
from __future__ import annotations

import itertools
import math
import re
from dataclasses import dataclass, field
from typing import Any

from ..core import expr
from ..core.registry import template

SUBJECTS = {"physics", "biology", "chemistry"}
SHAPES = {"box", "sphere", "cylinder", "cone", "torus", "capsule", "arrow"}
MOTIONS = {"spin", "oscillate", "slide", "pulse", "orbit", "flow"}
STAGE = (3.2, 2.2, 1.7)  # half-extents of the 6×4×3 stage, with a little margin
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
LOW_CONFIDENCE = 0.4
MAX_SPEED = 40.0  # rad/s or units/s: faster than this can't be followed on screen


@dataclass
class Report:
    ok: bool = True
    confidence: float | None = None
    warnings: list[str] = field(default_factory=list)
    repairs: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def fail(self, msg: str) -> None:
        self.ok = False
        self.errors.append(msg)

    def to_json(self) -> dict[str, Any]:
        return {"ok": self.ok, "confidence": self.confidence, "warnings": self.warnings, "repairs": self.repairs, "errors": self.errors}


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None


def _vec3(v: Any, default: float) -> list[float]:
    items = list(v)[:3] if isinstance(v, (list, tuple)) else []
    out = [n if (n := _num(x)) is not None else default for x in items]
    return out + [default] * (3 - len(out))


def _bbox(v: Any) -> list[float] | None:
    if not isinstance(v, list) or len(v) != 4 or any(_num(x) is None for x in v):
        return None
    x, y, w, h = (min(1.0, max(0.0, float(n))) for n in v)
    w, h = min(w, 1 - x), min(h, 1 - y)
    return [x, y, w, h] if w > 0.005 and h > 0.005 else None


def validate_template_hit(raw: dict[str, Any], report: Report) -> dict[str, Any] | None:
    t = template(str(raw.get("template")))
    if not t:
        report.fail(f"unknown template {raw.get('template')!r}")
        return None
    known_parts = {p["id"] for p in t["parts"]}
    parts = []
    for p in raw.get("parts") or []:
        if not isinstance(p, dict) or p.get("id") not in known_parts:
            report.repairs.append(f"dropped unknown part {p.get('id') if isinstance(p, dict) else p!r}")
            continue
        box = _bbox(p.get("bbox"))
        if p.get("bbox") is not None and box is None:
            report.repairs.append(f"dropped an invalid outline for {p['id']}")
        parts.append({"id": p["id"], **({"bbox": box} if box else {})})
    params = []
    ranges = {p["id"]: p for p in t["params"]}
    for p in raw.get("params") or []:
        spec = ranges.get(p.get("id")) if isinstance(p, dict) else None
        value = _num(p.get("value")) if isinstance(p, dict) else None
        if not spec or value is None:
            continue
        clamped = min(spec["max"], max(spec["min"], value))
        if clamped != value:
            report.repairs.append(f"{spec['label']} read as {value:g}, kept inside the tested range ({clamped:g})")
        params.append({"id": spec["id"], "value": clamped})
    return {
        "template": t["id"],
        "subject": t["subject"],
        "title": str(raw.get("title") or t["title"])[:80],
        **({"summary": str(raw["summary"])[:240]} if raw.get("summary") else {}),
        **({"confidence": report.confidence} if report.confidence is not None else {}),
        "parts": parts,
        "params": params,
    }


def _positions(p: dict[str, Any], cap: int = 200) -> list[float]:
    """Every value the slider can actually take (its step positions), thinned out if there are very many."""
    n = int(round((p["max"] - p["min"]) / p["step"])) + 1
    stride = max(1, -(-n // cap))
    vals = [round(p["min"] + i * p["step"], 9) for i in range(0, n, stride)]
    return [*vals, p["max"]]


def _sample_points(params: list[dict[str, Any]]):
    """Sweep each slider through all its positions while the others sit at min, middle or max."""
    if not params:
        yield {}
        return
    anchors = [[p["min"], (p["min"] + p["max"]) / 2, p["max"]] for p in params]
    for i, p in enumerate(params):
        others = [a for j, a in enumerate(anchors) if j != i]
        for combo in itertools.product(*others):
            rest = dict(zip((q["id"] for j, q in enumerate(params) if j != i), combo))
            for v in _positions(p):
                yield {**rest, p["id"]: v}


def _check_formula(src: Any, params: list[dict[str, Any]], what: str, report: Report, limit: float | None = None) -> str | float | None:
    """A formula is kept only if it is safe, uses known names and stays finite over the whole parameter range."""
    if src is None:
        return None
    try:
        tree = expr.parse(src)
    except expr.FormulaError as e:
        report.repairs.append(f"removed {what}: {e}")
        return None
    known = {p["id"] for p in params} | {"t"}
    unknown = expr.names(tree) - known
    if unknown:
        report.repairs.append(f"removed {what}: unknown name(s) {', '.join(sorted(unknown))}")
        return None
    worst = 0.0
    for point in _sample_points(params):
        for t in (0.0, 1.3, 7.7):
            v = expr.evaluate(tree, {**point, "t": t})
            if math.isnan(v) or abs(v) > 1e6:
                report.repairs.append(f"removed {what}: it blows up for some slider settings")
                return None
            worst = max(worst, abs(v))
    if limit is not None and worst > limit:
        report.warnings.append(f"{what} reaches {worst:.3g}, too fast to follow; it will look like a blur")
    return src


def validate_generic(raw: dict[str, Any], report: Report) -> dict[str, Any] | None:
    title = str(raw.get("title") or "").strip()
    if not title:
        report.fail("the AI gave no title, so it probably didn't recognise a science system")
        return None
    subject = raw.get("subject") if raw.get("subject") in SUBJECTS else "physics"
    if subject != raw.get("subject"):
        report.repairs.append(f"subject {raw.get('subject')!r} set to physics")

    params: list[dict[str, Any]] = []
    for p in (raw.get("params") or [])[:4]:
        if not isinstance(p, dict) or not IDENT.match(str(p.get("id", ""))):
            report.repairs.append("dropped a parameter with an invalid id")
            continue
        lo, hi, step, val = (_num(p.get(k)) for k in ("min", "max", "step", "value"))
        if lo is None or hi is None or lo >= hi:
            report.repairs.append(f"dropped parameter {p['id']}: its range is empty or missing")
            continue
        step = step if step and step > 0 else (hi - lo) / 100
        val = min(hi, max(lo, val if val is not None else lo))
        params.append({"id": p["id"], "label": str(p.get("label") or p["id"])[:40], "unit": str(p["unit"])[:12] if p.get("unit") else None,
                       "min": lo, "max": hi, "step": step, "value": val, "kind": "toggle" if p.get("kind") == "toggle" else "slider"})

    parts: list[dict[str, Any]] = []
    for p in (raw.get("parts") or [])[:8]:
        if not isinstance(p, dict) or not p.get("id") or not p.get("name"):
            continue
        box = _bbox(p.get("bbox"))
        parts.append({"id": str(p["id"])[:40], "name": str(p["name"])[:60], "short": str(p.get("short") or "")[:60],
                      "narration": str(p.get("narration") or "")[:400], **({"bbox": box} if box else {})})
    if not parts:
        report.fail("no recognisable components")
        return None
    part_ids = {p["id"] for p in parts}

    scene: list[dict[str, Any]] = []
    clipped = 0
    for i, s in enumerate((raw.get("scene") or [])[:40]):
        if not isinstance(s, dict) or s.get("shape") not in SHAPES:
            continue
        pos = _vec3(s.get("position"), 0.0)
        size = [max(0.02, min(4.0, abs(v))) for v in _vec3(s.get("size"), 0.5)]
        rot = _vec3(s.get("rotation"), 0.0)
        fixed = [max(-h, min(h, v)) for v, h in zip(pos, STAGE)]
        if fixed != pos:
            clipped += 1
        prim: dict[str, Any] = {"id": str(s.get("id") or f"shape{i}")[:40], "shape": s["shape"], "position": fixed, "size": size, "rotation": rot,
                                "color": s["color"] if isinstance(s.get("color"), str) and HEX.match(s["color"]) else "#a9c6f7",
                                "opacity": min(1.0, max(0.1, _num(s.get("opacity")) or 1.0))}
        if s.get("part") in part_ids:
            prim["part"] = s["part"]
        m = s.get("motion")
        if isinstance(m, dict) and m.get("type") in MOTIONS:
            speed = _check_formula(m.get("speed", 1), params, f"the speed of {prim['id']}", report, MAX_SPEED)
            amp = _check_formula(m.get("amplitude", 0.3), params, f"the amplitude of {prim['id']}", report)
            if speed is not None:
                prim["motion"] = {"type": m["type"], "axis": m.get("axis") if m.get("axis") in ("x", "y", "z") else "y", "speed": speed,
                                  **({"amplitude": amp} if amp is not None else {})}
        scene.append(prim)
    if clipped:
        report.repairs.append(f"moved {clipped} shape(s) back onto the stage")
    if not scene:
        report.warnings.append("no 3D scene; the diagram will be shown as a 3D pop-up instead")

    readouts = []
    for r in (raw.get("readouts") or [])[:3]:
        if isinstance(r, dict) and r.get("label"):
            f = _check_formula(r.get("formula"), params, f"the readout {r['label']!r}", report)
            if f is not None:
                readouts.append({"label": str(r["label"])[:40], "formula": f, **({"unit": str(r["unit"])[:12]} if r.get("unit") else {})})

    equations = [str(e)[:120] for e in (raw.get("equations") or [])[:3] if isinstance(e, str)]
    if not equations:
        report.warnings.append("no governing equations given; treat this simulation as illustrative")

    return {
        "template": "generic", "subject": subject, "title": title[:80], "concept": str(raw.get("concept") or "")[:120],
        "summary": str(raw.get("summary") or "")[:240], "intro": str(raw.get("intro") or "")[:500],
        **({"confidence": report.confidence} if report.confidence is not None else {}),
        "params": [{k: v for k, v in p.items() if v is not None} for p in params],
        "parts": parts, "equations": equations, "scene": scene, "readouts": readouts,
    }


class ScientificReasoningEngine:
    def validate(self, raw: dict[str, Any]) -> tuple[dict[str, Any] | None, Report]:
        report = Report()
        conf = _num(raw.get("confidence"))
        report.confidence = min(1.0, max(0.0, conf)) if conf is not None else None
        if report.confidence is not None and report.confidence < LOW_CONFIDENCE:
            report.warnings.append(f"the AI is only {round(report.confidence * 100)}% sure what this diagram shows")
        if raw.get("template") and raw.get("template") != "generic":
            return validate_template_hit(raw, report), report
        return validate_generic(raw, report), report
