from app.agents.tutor import ground, plan_actions

LAB = {
    "parts": [{"id": "pulley", "name": "Pulley"}, {"id": "blockm", "name": "Hanging mass m"}, {"id": "incline", "name": "Inclined plane"}],
    "params": [{"id": "theta", "label": "Incline angle", "min": 5, "max": 60, "value": 30}],
    "actions": [{"id": "restart", "label": "Restart"}],
}


def test_grounds_questions_onto_part_ids():
    assert ground("Why does the hanging mass fall?", LAB["parts"]) == "blockm"
    assert ground("what is the inclined plane for", LAB["parts"]) == "incline"
    assert ground("tell me about gravity", LAB["parts"]) is None


def test_plans_safe_actions():
    acts = plan_actions("show me from all sides", LAB, {"highlight": "pulley", "set": {"theta": 90, "fake": 3}, "trigger": "restart"}, None)
    assert {"type": "highlight", "part": "pulley"} in acts
    assert {"type": "focus", "part": "pulley"} in acts
    assert {"type": "set", "param": "theta", "value": 60} in acts
    assert {"type": "trigger", "action": "restart"} in acts
    assert {"type": "rotate"} in acts
    assert not any(a.get("param") == "fake" for a in acts)


def test_ignores_invented_ids():
    acts = plan_actions("hm", LAB, {"highlight": "rocket", "trigger": "explode"}, None)
    assert acts == []
