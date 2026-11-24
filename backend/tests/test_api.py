"""End-to-end through FastAPI with Gemini replaced by a stub (no network, no quota)."""
import base64
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import main
from app.core import config
from app.core.efficiency import CallResult


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(config.settings.__class__, "gemini_api_key", property(lambda self: "test-key"), raising=False)
    replies: list[dict] = []
    calls: list[str] = []

    async def fake_send(self, task, parts):
        calls.append(task)
        return CallResult(json.dumps(replies.pop(0)), "stub-lite", 50, 10, 0)

    monkeypatch.setattr("app.core.gemini.GeminiClient.send", fake_send)
    monkeypatch.setattr(main, "build_agents", lambda http, cache=True, _orig=main.build_agents: _orig(http, cache=False))
    with TestClient(main.app) as c:
        c.replies = replies  # type: ignore[attr-defined]
        c.calls = calls  # type: ignore[attr-defined]
        yield c


IMG = base64.b64encode(b"\xff\xd8\xff fake jpeg").decode()


def test_health_and_registry(client):
    assert client.get("/api/v1/health").json() == {"status": "ok"}
    ids = [t["id"] for t in client.get("/api/v1/registry").json()["templates"]]
    assert "dc-motor" in ids and len(ids) == 6


def test_analyze_template_flow_and_cache(client):
    client.replies.append({"template": "dc-motor", "title": "Motor", "confidence": 0.9, "parts": [{"id": "coil", "bbox": [0.3, 0.3, 0.3, 0.3]}], "params": [{"id": "voltage", "value": 50}]})
    out = client.post("/api/v1/diagram/analyze", json={"image": IMG}).json()
    assert out["mode"] == "template" and out["spec"]["template"] == "dc-motor"
    assert out["spec"]["params"] == [{"id": "voltage", "value": 12}]
    again = client.post("/api/v1/diagram/analyze", json={"image": IMG}).json()
    assert again["meta"]["cached"] is True and client.calls == ["analyze"]


def test_analyze_rejects_bad_base64(client):
    assert client.post("/api/v1/diagram/analyze", json={"image": "not base64!!"}).status_code == 400


def test_tutor_returns_grounded_actions(client):
    client.replies.append({"answer": "The pulley only changes the direction of the tension.", "highlight": "pulley", "rotate": True})
    lab = {"title": "Pulley", "template": "pulley-incline", "parts": [{"id": "pulley", "name": "Pulley"}], "params": [], "actions": []}
    out = client.post("/api/v1/tutor/ask", json={"question": "why is the pulley there?", "lab": lab}).json()
    assert out["grounded"] == "pulley"
    assert {"type": "focus", "part": "pulley"} in out["actions"] and {"type": "rotate"} in out["actions"]


def test_translate_batches_and_caches_lines(client):
    client.replies.append({"texts": ["A-hi", "B-hi"]})
    first = client.post("/api/v1/voice/translate", json={"texts": ["A", "B"], "language": "hi-IN"}).json()
    assert first["texts"] == ["A-hi", "B-hi"] and first["sent"] == 2
    second = client.post("/api/v1/voice/translate", json={"texts": ["B", "A"], "language": "hi-IN"}).json()
    assert second["texts"] == ["B-hi", "A-hi"] and second["sent"] == 0
    usage = client.get("/api/v1/usage").json()
    assert usage["cacheHits"] >= 2
