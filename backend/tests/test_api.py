import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def create_test_image_bytes():
    file = io.BytesIO()
    image = Image.new('RGB', (200, 200), color='blue')
    image.save(file, 'PNG')
    file.seek(0)
    return file.read()


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "features" in data


def test_list_templates():
    response = client.get("/api/v1/diagram/templates")
    assert response.status_code == 200
    templates = response.json()
    assert len(templates) >= 3
    template_ids = [t["template_id"] for t in templates]
    assert "dc_motor_3d" in template_ids
    assert "electrolysis_cell_3d" in template_ids
    assert "animal_cell_3d" in template_ids


def test_get_single_template():
    response = client.get("/api/v1/diagram/templates/dc_motor_3d")
    assert response.status_code == 200
    template = response.json()
    assert template["template_id"] == "dc_motor_3d"
    assert len(template["variables"]) > 0
    assert len(template["telemetry"]) > 0
    assert len(template["entities_3d"]) > 0


def test_compute_telemetry_dc_motor():
    payload = {
        "template_id": "dc_motor_3d",
        "variables": {
            "voltage": 12.0,
            "magnetic_field": 0.5,
            "coil_turns": 50.0,
            "load_torque": 0.05,
            "armature_resistance": 1.2
        }
    }
    response = client.post("/api/v1/diagram/telemetry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "telemetry_values" in data
    assert "rpm" in data["telemetry_values"]
    assert data["telemetry_values"]["rpm"] > 0
    assert data["telemetry_values"]["current_amp"] > 0


def test_compute_telemetry_electrolysis():
    payload = {
        "template_id": "electrolysis_cell_3d",
        "variables": {
            "cell_voltage": 6.0,
            "electrolyte_concentration": 0.5,
            "temperature_c": 25.0,
            "electrode_surface_area": 5.0
        }
    }
    response = client.post("/api/v1/diagram/telemetry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "telemetry_values" in data
    assert data["telemetry_values"]["h2_rate_ml_min"] > 0
    assert data["telemetry_values"]["o2_rate_ml_min"] > 0
    # Stoichiometric ratio check: H2 rate should be ~ 2x O2 rate
    h2 = data["telemetry_values"]["h2_rate_ml_min"]
    o2 = data["telemetry_values"]["o2_rate_ml_min"]
    assert abs((h2 / o2) - 2.0) < 0.1


def test_upload_and_analyze_diagram():
    img_bytes = create_test_image_bytes()
    files = {"file": ("test_dc_motor.png", img_bytes, "image/png")}
    data = {"context_hint": "Electric motor with split ring commutator"}
    
    response = client.post("/api/v1/diagram/upload", files=files, data=data)
    assert response.status_code == 200
    res = response.json()
    
    # Verify answers to all 6 core questions:
    # 1. What is represented?
    assert "representation_overview" in res
    assert "concept_title" in res
    # 2. What are its components?
    assert len(res["components"]) > 0
    # 3. How are the components connected?
    assert len(res["connections"]) > 0
    # 4. What scientific or logical principles govern it?
    assert len(res["governing_principles"]) > 0
    # 5. What kind of interactive experience would best explain it?
    assert "simulation_spec" in res
    assert res["simulation_spec"]["template_id"] == "dc_motor_3d"
    # 6. How can the student experiment with it and ask questions?
    assert len(res["suggested_experiments"]) > 0
    assert len(res["sample_questions"]) > 0


def test_ask_diagram_with_actions():
    payload = {
        "diagram_id": "diag_test_123",
        "question": "What happens if I increase the voltage to 20V?",
        "current_variables": {"voltage": 12.0},
        "language": "en",
        "generate_speech": True
    }
    response = client.post("/api/v1/ask", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["simulation_actions"]) > 0
    # Should include action setting the variable
    actions = [a["action_type"] for a in data["simulation_actions"]]
    assert "set_variable" in actions or "highlight" in actions
    assert "audio_base64" in data


def test_voice_speak():
    payload = {
        "text": "The Lorentz force drives the rotation of the motor armature.",
        "language": "en"
    }
    response = client.post("/api/v1/voice/speak", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "audio_base64" in data
    assert len(data["audio_base64"]) > 0
