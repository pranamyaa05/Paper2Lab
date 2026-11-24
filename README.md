# Paper2Lab 🔬⚡
> **"Don't just read science. See it. Interact with it. Experiment with it. Understand it."**

Paper2Lab is an AI-powered, multilingual virtual science laboratory that transforms ordinary textbook diagrams and scientific illustrations into interactive 3D simulations.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (React + React Three Fiber)"]
        UI[Camera / Image Upload]
        Viewer3D[Interactive 3D Viewport]
        Controls[Dynamic Parameter Sliders]
        Chat[Ask Your Diagram UI & Voice]
    end

    subgraph API ["FastAPI Backend (app/api/v1)"]
        UploadEp["/diagram/upload"]
        TelemEp["/diagram/telemetry"]
        AskEp["/ask"]
        VoiceEp["/voice/speak"]
    end

    subgraph Perception ["Multimodal AI Perception & Reasoning Layer"]
        Gemini[Google Gemini 1.5/2.0 API]
        Decomp[Component & Connection Graph Extractor]
        EquationEngine[Scientific Law & Equation Compiler]
    end

    subgraph SimulationCore ["Scientific Simulation Engine"]
        TemplateReg[Scientific Template Registry]
        DCMotor[DC Motor Solver: Lorentz & Back-EMF]
        Electrolysis[Water Splitting Solver: Faraday & Overpotential]
        CellBio[Animal Cell Solver: Chemiosmotic ATP & Tonicity]
    end

    subgraph AgenticVoice ["AI Learning Companion & Voice"]
        Agent[Ask Your Diagram Agent]
        Actions[Simulation Manipulation Dispatcher]
        ElevenLabs[ElevenLabs Multilingual TTS API]
    end

    UI -->|Image Upload| UploadEp
    UploadEp --> Gemini
    Gemini --> Decomp
    Decomp --> EquationEngine
    EquationEngine --> TemplateReg
    TemplateReg --> UploadEp
    UploadEp -->|SimulationSpec JSON| Viewer3D

    Controls -->|Adjust Variables| TelemEp
    TelemEp --> DCMotor & Electrolysis & CellBio
    DCMotor & Electrolysis & CellBio -->|Real-time Telemetry| Controls

    Chat -->|Natural Language Inquiry| AskEp
    AskEp --> Agent
    Agent --> Actions
    Actions -->|Highlight, Set Slider, Move Camera| Viewer3D
    Agent --> VoiceEp
    VoiceEp --> ElevenLabs
    ElevenLabs -->|Multilingual Audio| Chat
```

---

## 🚀 Quickstart Backend

### Prerequisites
- Python 3.10+
- Pip

### Setup & Run
```bash
cd backend
# Run the FastAPI server
python run.py
```

The server starts at `http://localhost:8000`
- **Swagger Interactive API Docs:** `http://localhost:8000/api/v1/docs`
- **Health Check:** `http://localhost:8000/api/v1/health`

### Environment Variables (.env)
```env
GEMINI_API_KEY="your-gemini-api-key"
ELEVENLABS_API_KEY="your-elevenlabs-api-key"
```
*(Note: If keys are omitted during offline development, Paper2Lab automatically activates its intelligent heuristic simulation solvers and test synthesizer so the entire stack works offline!)*

---

## 🧪 Running Tests
```bash
$env:PYTHONPATH="E:\PROJECTS-2nd Year\Paper2Lab\Paper2Lab\backend"
pytest backend/tests/test_api.py -v
```
All 8 test suites pass, covering multimodal upload, telemetry equation solvers, agentic simulation actions, and multilingual audio.
