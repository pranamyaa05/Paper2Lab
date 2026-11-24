# Paper2Lab

**Don't just read science. See it. Interact with it. Experiment with it. Understand it.**

Paper2Lab turns a 2D textbook diagram into an interactive 3D science lab. Upload or photograph any diagram: it is analysed, its parts are found, and it *materializes* into 3D (every coloured region of the drawing rises off the page) before becoming a live simulation driven by real equations, with a multilingual voice tutor and an "Ask your diagram" assistant that changes the simulation to show its answers.

## Run it

```bash
npm install
python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt
npm run dev:all        # FastAPI on :8000 + Vite on :5173 (or `npm run backend` and `npm run dev` separately)
npm test               # frontend: physics, formulas, tutor, segmentation, registry sync
npm run test:backend   # backend: validation engine, tutor grounding, efficiency layer, API
```

API docs: http://localhost:8000/docs. Everything still works with **no backend and no keys**: the frontend falls back to on-device mode.

Copy `.env.example` to `.env` to switch on the AI (keys stay in the backend, never in the browser):

| Key | What it switches on |
| --- | --- |
| `GEMINI_API_KEY` | Diagram reading, AI-designed simulations, open-ended tutor answers, translation |
| `ELEVENLABS_API_KEY` | Natural multilingual voice (otherwise the browser's built-in voice) |
| `GEMINI_RPM` | Requests per minute the backend allows itself (default 8, for the free tier) |

## Architecture

```
 8 Interactive learning experience ─ React Three Fiber · highlights · camera moves · labels · voice
   ▲ actions (highlight · focus · rotate · set slider · demo)        ▲ live state snapshot with each question
 6 Simulation environment (in the browser, 60 fps)
   ├─ Scientific engine   src/lib/sim/*        equations, numerical integration, state
   └─ 3D scene engine     src/components/lab/* models with part ids
        └── shared component & simulation registry: shared/registry.json (generated from src/labs/templates.ts)
                                   ▲
 2 API gateway  FastAPI /api/v1    │  backend/app/api/v1/routes.py
   ├─ POST /diagram/analyze ─► 3 Vision agent ─► 4 Scientific reasoning & validation ─► 5 Simulation orchestrator
   ├─ POST /tutor/ask ───────► 7 Spatial tutor agent: object grounding · action planning · explanation
   ├─ POST /voice/translate, /voice/speak ─► Voice agent (Gemini translation · ElevenLabs speech)
   └─ GET  /status, /usage, /registry, /health
        every Gemini call ─► efficiency layer: cache · coalesce · lite-first routing · cool-down · pacing · metering
```

**One deliberate difference from a "telemetry" design:** sliders don't stream to the backend. The physics
has to update 60 times a second, so it runs in the browser; a server round trip per slider move would add
lag, cost and fragility on school Wi-Fi. The tutor receives a snapshot of the live state with each question
instead, which is all it needs.

| Layer | Where | What it does |
| --- | --- | --- |
| Vision agent | `backend/app/agents/vision.py` | Gemini reads concept, components, outlines and printed values. Prompt built from the shared registry. |
| Reasoning & validation | `backend/app/agents/reasoning.py` | Keeps only known part ids, clamps values to tested ranges, checks every AI formula is safe and finite at every slider position, keeps the scene on stage, flags low confidence. Rejects what it can't repair. |
| Orchestrator | `backend/app/agents/orchestrator.py` | Chooses tested template, validated AI simulation, or the on-device 3D pop-up. |
| Scientific engine | `src/lib/sim/` | Newton's 2nd law with friction · DC motor with back-EMF · neuron threshold & conduction · osmosis (Boyle–van 't Hoff) & respiration · phenolphthalein · Faraday electrolysis. |
| Spatial tutor | `backend/app/agents/tutor.py` + `src/lib/ask.ts` | Grounds questions on part ids and plans actions; confident questions are answered on-device for free. |
| Efficiency layer | `backend/app/core/efficiency.py` | Free-tier Flash models allow ~20 requests/day; this keeps a demo within budget. |

## Project layout

```
backend/app/                  FastAPI: api/v1 gateway, agents/ (vision, reasoning, orchestrator, tutor, voice), core/ (Gemini, efficiency, registry, formulas)
backend/tests/                pytest suite
shared/registry.json          shared component & simulation registry (generated; `npm run registry`)
src/labs/                     LabSpec schema (zod), the six templates, registry export
src/lib/sim/                  equations for each template (+ tests)
src/lib/analyze/              on-device segmentation and the analysis pipeline
src/components/story/         homepage scroll story (from the Lovable prototype)
src/components/lab/           3D models, the pop-up, and the LabCanvas stage
src/components/studio/        upload, analysing card, lab view and panels
src/components/sections/      pipeline, lab picker, header and footer
```

Built with React 19, React Three Fiber, drei, Three.js, Tailwind CSS v4 and Vite. The scroll story, glass design system and the pulley, neuron and indicator models started in the Lovable prototype.

The first backend prototype by pranamyaa05 is kept in `archive/backend-v1/`.
