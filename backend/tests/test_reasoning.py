from app.agents.reasoning import ScientificReasoningEngine

engine = ScientificReasoningEngine()


def test_template_hit_is_cleaned_against_the_registry():
    spec, report = engine.validate({
        "template": "pulley-incline", "title": "Pulley", "confidence": 0.9,
        "parts": [{"id": "pulley", "bbox": [0.7, 0.1, 0.2, 0.2]}, {"id": "spaceship", "bbox": [0, 0, 1, 1]}, {"id": "incline", "bbox": [0.9, 0.9, 0.5, 0.5]}],
        "params": [{"id": "theta", "value": 85}, {"id": "M", "value": 4}, {"id": "nonsense", "value": 1}],
    })
    assert report.ok
    assert [p["id"] for p in spec["parts"]] == ["pulley", "incline"]
    incline = spec["parts"][1]["bbox"]
    assert incline[0] + incline[2] <= 1 and incline[1] + incline[3] <= 1
    assert {p["id"]: p["value"] for p in spec["params"]} == {"theta": 60, "M": 4}
    assert any("tested range" in r for r in report.repairs)


def test_unknown_template_fails():
    spec, report = engine.validate({"template": "warp-drive"})
    assert spec is None and not report.ok


PENDULUM = {
    "template": "generic", "subject": "physics", "title": "Simple pendulum", "confidence": 0.8,
    "parts": [{"id": "bob", "name": "Bob"}, {"id": "string", "name": "String"}],
    "params": [{"id": "L", "label": "Length", "unit": "m", "min": 0.2, "max": 2, "step": 0.1, "value": 1}],
    "equations": ["T = 2π√(L/g)"],
    "scene": [
        {"id": "s", "part": "string", "shape": "cylinder", "position": [0, 0.5, 0], "size": [0.03, 2, 0.03], "motion": {"type": "oscillate", "axis": "z", "speed": "sqrt(9.8 / L)", "amplitude": 0.4}},
        {"id": "far", "part": "bob", "shape": "sphere", "position": [99, 0, 0], "size": [0.3, 0.3, 0.3], "color": "not-a-colour"},
        {"id": "evil", "shape": "box", "position": [0, 0, 0], "motion": {"type": "spin", "speed": "__import__('os').system('x')"}},
        {"id": "nan", "shape": "box", "position": [0, 0, 0], "motion": {"type": "spin", "speed": "1 / (L - 1)"}},
    ],
    "readouts": [{"label": "Period", "formula": "2 * pi * sqrt(L / 9.8)", "unit": "s"}, {"label": "Bad", "formula": "mass * 2"}],
}


def test_generic_spec_is_checked_and_repaired():
    spec, report = engine.validate(PENDULUM)
    assert report.ok
    shapes = {s["id"]: s for s in spec["scene"]}
    assert shapes["s"]["motion"]["speed"] == "sqrt(9.8 / L)"
    assert shapes["far"]["position"][0] <= 3.2 and shapes["far"]["color"].startswith("#")
    assert "motion" not in shapes["evil"]
    assert "motion" not in shapes["nan"]  # 1/(L−1) blows up at L = 1
    assert [r["label"] for r in spec["readouts"]] == ["Period"]
    assert any("onto the stage" in r for r in report.repairs)


def test_generic_without_parts_fails():
    spec, report = engine.validate({"template": "generic", "title": "Thing", "parts": []})
    assert spec is None and not report.ok


def test_low_confidence_is_flagged():
    _, report = engine.validate({**PENDULUM, "confidence": 0.2})
    assert any("only 20% sure" in w for w in report.warnings)
