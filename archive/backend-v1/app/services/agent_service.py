import json
import logging
from typing import Optional, List

from app.core.config import settings
from app.schemas.ask import (
    AskDiagramRequest,
    AskDiagramResponse,
    SimulationAction,
    ActionType,
)

logger = logging.getLogger(__name__)

ASK_DIAGRAM_SYSTEM_PROMPT = """
You are Paper2Lab's AI Scientific Learning Companion.
A student is interacting with a scientific 3D simulation generated from their textbook diagram.
When answering their question:
1. Explain the scientific principle clearly, intuitively, and rigorously.
2. Direct the 3D simulation to physically demonstrate the answer! You can command the simulation to:
   - "highlight": Highlight a specific component (e.g. target_id: "rotor_coil", "commutator", "cathode").
   - "set_variable": Change a simulation slider value (e.g. target_id: "voltage", value: 24.0).
   - "focus_camera": Move the 3D camera to frame a specific component.
   - "trigger_effect": Pulse current arrows, reverse polarity, or speed up bubble emission.
3. Suggest 2-3 logical follow-up questions to stimulate curiosity.

Respond strictly in valid JSON format:
{
  "answer": "Clear explanation for the student",
  "scientific_rationale": "Underlying equation or theorem",
  "simulation_actions": [
    {
      "action_type": "highlight|focus_camera|set_variable|trigger_effect|reset",
      "target_id": "component_or_variable_id",
      "value": "optional value or null",
      "description": "Visual explanation of what the user will see in 3D"
    }
  ],
  "suggested_followups": ["Question 1?", "Question 2?"]
}
"""


class AgentService:
    def __init__(self):
        self._gemini_client = None
        if settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._gemini_client = genai.GenerativeModel("gemini-1.5-flash")
            except Exception as e:
                logger.warning(f"Could not initialize Gemini agent client: {e}")

    async def answer_question(self, request: AskDiagramRequest) -> AskDiagramResponse:
        q_lower = request.question.lower()
        
        # If Gemini is configured, use it for contextual reasoning
        if self._gemini_client and settings.GEMINI_API_KEY:
            try:
                user_msg = f"""
Diagram ID: {request.diagram_id}
Current Variables: {json.dumps(request.current_variables)}
Active Component Selected: {request.active_component_id or 'None'}
Target Response Language: {request.language}
Student Question: {request.question}
"""
                response = self._gemini_client.generate_content([ASK_DIAGRAM_SYSTEM_PROMPT, user_msg])
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                parsed = json.loads(text.strip())
                
                actions = [
                    SimulationAction(
                        action_type=ActionType(a.get("action_type", "highlight")),
                        target_id=a.get("target_id"),
                        value=a.get("value"),
                        description=a.get("description", "")
                    )
                    for a in parsed.get("simulation_actions", [])
                ]
                
                return AskDiagramResponse(
                    diagram_id=request.diagram_id,
                    question=request.question,
                    answer=parsed.get("answer", ""),
                    scientific_rationale=parsed.get("scientific_rationale", ""),
                    simulation_actions=actions,
                    suggested_followups=parsed.get("suggested_followups", [])
                )
            except Exception as e:
                logger.error(f"Gemini agent failed, using scientific rule engine: {e}")

        # Intelligent Scientific Rule-Based Engine
        return self._rule_based_answer(request)

    def _rule_based_answer(self, request: AskDiagramRequest) -> AskDiagramResponse:
        q = request.question.lower()
        actions: List[SimulationAction] = []
        followups: List[str] = []
        
        # DC Motor scenarios
        if any(w in q for w in ["commutator", "split ring", "reverse current", "half rotation"]):
            answer = (
                "The split-ring commutator is the ingenious component that keeps the motor spinning in one continuous direction! "
                "As the coil rotates through the vertical neutral plane, each half of the split ring switches contact from one carbon brush "
                "to the other. This instantly reverses the current flow inside the coil every 180°, ensuring that the Lorentz torque "
                "remains in the same rotational sense rather than oscillating back and forth."
            )
            rationale = "Commutation maintains tau = k_t * B * I > 0 over full 360 degrees."
            actions = [
                SimulationAction(action_type=ActionType.HIGHLIGHT, target_id="commutator_split_ring", description="Highlighting the split-ring commutator segments as they alternate contacts."),
                SimulationAction(action_type=ActionType.FOCUS_CAMERA, target_id="commutator_split_ring", description="Zooming in on the brush-commutator interface.")
            ]
            followups = [
                "What would happen if we used continuous slip rings instead of split rings?",
                "Why do carbon brushes spark occasionally during commutation?"
            ]
        elif ("voltage" in q and any(w in q for w in ["increase", "raise", "double", "higher", "more", "20", "24", "speed", "rpm"])) or any(w in q for w in ["speed up", "faster", "rpm"]):
            answer = (
                "When you increase the applied voltage V, a higher armature current initially surges through the coil (I = (V - E_b) / R). "
                "According to the Lorentz force law (F = I * L x B), this multiplies electromagnetic torque, causing the armature to rapidly accelerate "
                "until the induced Back-EMF (E_b = k_e * B * omega) balances the new voltage. Let's set the voltage to 20V so you can see it speed up!"
            )
            rationale = "Steady state angular velocity omega = (V - I*R) / (k_e * B); RPM is directly proportional to net voltage."
            actions = [
                SimulationAction(action_type=ActionType.SET_VARIABLE, target_id="voltage", value=20.0, description="Increasing voltage slider to 20.0 V to demonstrate acceleration."),
                SimulationAction(action_type=ActionType.TRIGGER_EFFECT, target_id="rotor_coil", description="Accelerating coil rotation and strengthening force vectors.")
            ]
            followups = [
                "Why doesn't the speed increase to infinity with infinite voltage?",
                "What is Back-EMF and why is it called the natural governor of a motor?"
            ]
        elif any(w in q for w in ["brush", "carbon", "graphite"]):
            answer = (
                "Carbon brushes are stationary graphite blocks that press against the rotating commutator rings with light spring pressure. "
                "Graphite is chosen because it conducts electricity well while also serving as a self-lubricating dry lubricant, minimizing mechanical friction and wear."
            )
            rationale = "Graphite's layered hexagonal crystalline structure allows layers to slide with low coefficient of friction."
            actions = [
                SimulationAction(action_type=ActionType.HIGHLIGHT, target_id="carbon_brush_pos", description="Highlighting positive carbon brush."),
                SimulationAction(action_type=ActionType.HIGHLIGHT, target_id="carbon_brush_neg", description="Highlighting negative carbon brush.")
            ]
            followups = [
                "Why are brushes made of carbon instead of copper or steel?",
                "How do modern brushless DC (BLDC) motors eliminate mechanical brushes?"
            ]
        # Electrolysis scenarios
        elif any(w in q for w in ["cathode", "hydrogen", "bubble", "2:1", "ratio", "twice"]):
            answer = (
                "Twice as much gas volume collects at the cathode compared to the anode because of stoichiometry! "
                "Every water molecule (H2O) contains two hydrogen atoms for every one oxygen atom. "
                "At the cathode, 4 electrons produce 2 molecules of H2 gas (4H+ + 4e- -> 2H2), while at the anode, those same 4 electrons "
                "only liberate 1 molecule of O2 gas (2H2O -> O2 + 4H+ + 4e-). According to Avogadro's law, equal moles of gas occupy equal volume, "
                "yielding an exact 2:1 volume ratio!"
            )
            rationale = "Stoichiometric water decomposition 2H2O -> 2H2 + O2; V(H2):V(O2) = 2:1."
            actions = [
                SimulationAction(action_type=ActionType.HIGHLIGHT, target_id="cathode_rod", description="Highlighting cathode where rapid H2 bubbles evolve."),
                SimulationAction(action_type=ActionType.HIGHLIGHT, target_id="h2_gas_column", description="Highlighting the taller gas column in the cathode collection tube.")
            ]
            followups = [
                "Why is pure water an electrical insulator, and why do we add sulfuric acid?",
                "What test can we do to scientifically confirm which gas is hydrogen and which is oxygen?"
            ]
        # Cell Biology scenarios
        elif any(w in q for w in ["mitochondria", "atp", "powerhouse", "energy"]):
            answer = (
                "Mitochondria are known as the powerhouses of the cell because they synthesize the bulk of cellular ATP (adenosine triphosphate) "
                "via oxidative phosphorylation. Across the highly folded inner cristae membrane, protons (H+) are pumped into the intermembrane space, "
                "creating a steep electrochemical gradient that powers the rotary nanomotor ATP synthase!"
            )
            rationale = "Chemiosmotic coupling; ADP + Pi + delta_mu_H+ -> ATP."
            actions = [
                SimulationAction(action_type=ActionType.HIGHLIGHT, target_id="mitochondria_1", description="Highlighting mitochondrion and zooming in on internal cristae folds."),
                SimulationAction(action_type=ActionType.FOCUS_CAMERA, target_id="mitochondria_1", description="Focusing 3D view on the energy powerhouse.")
            ]
            followups = [
                "What happens to the cell if oxygen supply drops below critical levels?",
                "Why do mitochondria have their own separate circular DNA and ribosomes?"
            ]
        else:
            # General answer
            answer = (
                f"Great question! In this setup, every component functions as part of a coupled scientific system. "
                f"When you adjust the physical parameters on the left panel, the governing equations recalculate the forces, currents, or biochemical fluxes in real time."
            )
            rationale = "Systemic equilibrium governed by fundamental physical conservation laws."
            actions = [
                SimulationAction(action_type=ActionType.TRIGGER_EFFECT, target_id=None, description="Pulsing active components to illustrate dynamic equilibrium.")
            ]
            followups = [
                "Try adjusting the primary input slider and check the telemetry readout.",
                "Would you like an explanation of Fleming's rule or Faraday's law?"
            ]

        return AskDiagramResponse(
            diagram_id=request.diagram_id,
            question=request.question,
            answer=answer,
            scientific_rationale=rationale,
            simulation_actions=actions,
            suggested_followups=followups
        )


agent_service = AgentService()
