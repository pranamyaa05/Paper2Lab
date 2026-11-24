import io
import json
import uuid
import logging
from typing import Optional
from PIL import Image

from app.core.config import settings
from app.schemas.diagram import (
    DiagramAnalysisResult,
    Discipline,
    Component,
    ComponentRole,
    Connection,
    GoverningEquation,
    SimulationSpec,
    BoundingBox,
)
from app.templates.registry import (
    find_matching_template,
    get_dc_motor_template,
    get_electrolysis_template,
    get_animal_cell_template,
)

logger = logging.getLogger(__name__)


DIAGRAM_ANALYSIS_PROMPT = """
You are Paper2Lab's expert Scientific Multimodal Vision and Reasoning Engine.
Analyze the provided scientific textbook diagram thoroughly and produce a precise, structured JSON response.

You MUST answer these 6 central scientific questions:
1. WHAT IS REPRESENTED: Scientific concept, domain, and overview.
2. COMPONENTS: Extract every labeled or visible scientific component, its role (input_source, actuator, regulator, measurement, structure, substance, carrier, display), and physical description.
3. CONNECTIONS: Determine how components are connected (electrical, mechanical, fluid, magnetic, chemical, optical, biological), directionality, and what transfers between them.
4. SCIENTIFIC PRINCIPLES: Identify governing physical or chemical laws, equations (in LaTeX), and scientific assumptions.
5. INTERACTIVE 3D SIMULATION SPEC: Determine what kind of interactive experience best explains it, what simulation variables a student should manipulate (e.g. voltage, concentration, temperature, force), and key telemetry metrics to compute.
6. EXPERIMENTAL QUESTIONS & SUGGESTIONS: Provide hypotheses for students to test and questions they can ask.

Output strictly valid JSON with this exact structure:
{
  "concept_title": "string",
  "discipline": "physics|chemistry|biology|earth_science|engineering",
  "summary": "string",
  "representation_overview": "string",
  "components": [
    {
      "id": "unique_snake_case_id",
      "name": "Component Name",
      "role": "input_source|actuator|regulator|measurement|structure|substance|carrier|display",
      "description": "Role in the experiment",
      "bbox": {"ymin": 0.0, "xmin": 0.0, "ymax": 1.0, "xmax": 1.0},
      "properties": {}
    }
  ],
  "connections": [
    {
      "source_id": "component_id_1",
      "target_id": "component_id_2",
      "relation_type": "electrical|mechanical|fluid|magnetic|chemical|optical|biological",
      "description": "How they interact",
      "bidirectional": false
    }
  ],
  "governing_principles": [
    {
      "name": "Law Name",
      "latex": "LaTeX formula",
      "description": "Physical meaning",
      "variables": ["v1", "v2"]
    }
  ],
  "scientific_assumptions": ["Assumption 1", "Assumption 2"],
  "recommended_experience": "string",
  "template_id": "dc_motor_3d|electrolysis_cell_3d|animal_cell_3d|generic_rig",
  "suggested_experiments": ["Experiment hypothesis 1", "Experiment hypothesis 2"],
  "sample_questions": ["Question 1", "Question 2"]
}
"""


class VisionService:
    def __init__(self):
        self._gemini_client = None
        if settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._gemini_client = genai.GenerativeModel("gemini-1.5-flash")
                logger.info("Gemini multimodal vision model initialized successfully.")
            except Exception as e:
                logger.warning(f"Could not initialize Gemini client: {e}")

    async def analyze_diagram_image(
        self,
        image_bytes: bytes,
        filename: str = "diagram.png",
        context_hint: Optional[str] = None
    ) -> DiagramAnalysisResult:
        diagram_id = f"diag_{uuid.uuid4().hex[:10]}"
        
        # Try processing with Gemini if API key is present
        if self._gemini_client and settings.GEMINI_API_KEY:
            try:
                pil_image = Image.open(io.BytesIO(image_bytes))
                prompt = DIAGRAM_ANALYSIS_PROMPT
                if context_hint:
                    prompt += f"\nAdditional Context / User Hint: {context_hint}"
                
                response = self._gemini_client.generate_content([prompt, pil_image])
                text = response.text.strip()
                # Clean code fences if present
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                
                parsed = json.loads(text.strip())
                return self._build_result_from_parsed(diagram_id, parsed)
            except Exception as e:
                logger.error(f"Gemini vision call failed, falling back to heuristic engine: {e}")

        # Fallback heuristic analysis engine
        return self._heuristic_fallback_analysis(diagram_id, filename, context_hint)

    def _build_result_from_parsed(self, diagram_id: str, data: dict) -> DiagramAnalysisResult:
        discipline_str = data.get("discipline", "physics").lower()
        try:
            discipline = Discipline(discipline_str)
        except ValueError:
            discipline = Discipline.PHYSICS

        template_id = data.get("template_id", "dc_motor_3d")
        matched_spec = find_matching_template([data.get("concept_title", ""), template_id])
        if not matched_spec:
            matched_spec = get_dc_motor_template()

        components = []
        for c in data.get("components", []):
            bbox = None
            if "bbox" in c and c["bbox"]:
                bbox = BoundingBox(**c["bbox"])
            components.append(Component(
                id=c.get("id", f"comp_{len(components)}"),
                name=c.get("name", "Component"),
                role=ComponentRole(c.get("role", "structure")),
                description=c.get("description", ""),
                bbox=bbox,
                properties=c.get("properties", {})
            ))

        connections = [
            Connection(
                source_id=conn.get("source_id", ""),
                target_id=conn.get("target_id", ""),
                relation_type=conn.get("relation_type", "mechanical"),
                description=conn.get("description", ""),
                bidirectional=conn.get("bidirectional", False)
            )
            for conn in data.get("connections", [])
        ]

        principles = [
            GoverningEquation(
                name=eq.get("name", "Physical Law"),
                latex=eq.get("latex", ""),
                description=eq.get("description", ""),
                variables=eq.get("variables", [])
            )
            for eq in data.get("governing_principles", [])
        ]

        return DiagramAnalysisResult(
            diagram_id=diagram_id,
            concept_title=data.get("concept_title", "Scientific Diagram Analysis"),
            discipline=discipline,
            summary=data.get("summary", "Multimodal breakdown of scientific principles."),
            representation_overview=data.get("representation_overview", "Scientific experiment setup."),
            components=components,
            connections=connections,
            governing_principles=principles,
            scientific_assumptions=data.get("scientific_assumptions", ["Ideal steady-state conditions"]),
            recommended_experience=data.get("recommended_experience", "Interactive 3D laboratory environment"),
            simulation_spec=matched_spec,
            suggested_experiments=data.get("suggested_experiments", []),
            sample_questions=data.get("sample_questions", [])
        )

    def _heuristic_fallback_analysis(
        self,
        diagram_id: str,
        filename: str,
        context_hint: Optional[str]
    ) -> DiagramAnalysisResult:
        query = f"{filename} {context_hint or ''}".lower()
        
        # Check if chemical / electrolysis
        if any(w in query for w in ["electrolysis", "water", "chemistry", "acid", "cathode", "anode", "cell_voltameter"]):
            return self._build_electrolysis_analysis(diagram_id)
        # Check if biological / cell
        elif any(w in query for w in ["cell", "biology", "mitochondria", "nucleus", "organelle", "animal_cell"]):
            return self._build_animal_cell_analysis(diagram_id)
        # Default: DC Motor / Electromagnetism
        else:
            return self._build_dc_motor_analysis(diagram_id)

    def _build_dc_motor_analysis(self, diagram_id: str) -> DiagramAnalysisResult:
        spec = get_dc_motor_template()
        components = [
            Component(id="north_pole", name="Permanent Magnet (North Stator Pole)", role=ComponentRole.STRUCTURE, description="Produces outward magnetic field flux B directing towards South Pole.", properties={"polarity": "North", "flux_density_T": 0.5}),
            Component(id="south_pole", name="Permanent Magnet (South Stator Pole)", role=ComponentRole.STRUCTURE, description="Receives magnetic field flux completing the stator magnetic circuit.", properties={"polarity": "South"}),
            Component(id="rotor_coil", name="Armature Rectangular Coil", role=ComponentRole.ACTUATOR, description="Carries electric current perpendicular to the magnetic field, generating Lorentz forces on opposing arms.", properties={"material": "Copper", "turns": 50}),
            Component(id="commutator", name="Split-Ring Commutator", role=ComponentRole.REGULATOR, description="Reverses current direction in the coil every half-rotation (180°) to maintain unidirectional torque.", properties={"type": "Two-segment split copper ring"}),
            Component(id="brush_pos", name="Positive Carbon Brush (+)", role=ComponentRole.INPUT_SOURCE, description="Maintains sliding electrical contact with the rotating split ring.", properties={"material": "Graphite"}),
            Component(id="brush_neg", name="Negative Carbon Brush (-)", role=ComponentRole.INPUT_SOURCE, description="Completes the return circuit path back to the DC power source.", properties={"material": "Graphite"}),
            Component(id="central_shaft", name="Mechanical Drive Shaft", role=ComponentRole.CARRIER, description="Transfers rotational mechanical power and torque to external load.", properties={"material": "Hardened Steel"})
        ]
        connections = [
            Connection(source_id="brush_pos", target_id="commutator", relation_type="electrical", description="Sliding conductive contact delivering current into active commutator segment."),
            Connection(source_id="commutator", target_id="rotor_coil", relation_type="electrical", description="Delivers current into armature winding loops."),
            Connection(source_id="north_pole", target_id="south_pole", relation_type="magnetic", description="Uniform magnetic flux B permeates the armature volume."),
            Connection(source_id="rotor_coil", target_id="central_shaft", relation_type="mechanical", description="Lorentz torque couples to rotate the central shaft.")
        ]
        principles = [
            GoverningEquation(
                name="Lorentz Force Law",
                latex=r"\vec{F} = I (\vec{L} \times \vec{B})",
                description="Force acting on each armature conductor segment perpendicular to current and magnetic flux vectors.",
                variables=["F (Force, N)", "I (Current, A)", "L (Coil Length, m)", "B (Flux Density, T)"]
            ),
            GoverningEquation(
                name="Back Electromotive Force (Counter EMF)",
                latex=r"E_b = k_e \Phi \omega",
                description="Induced voltage opposing the applied voltage proportional to rotational angular speed omega.",
                variables=["E_b (Volts)", "k_e (Constant)", "Phi (Flux)", "omega (Angular velocity, rad/s)"]
            ),
            GoverningEquation(
                name="Armature Circuit Voltage Equilibrium",
                latex=r"V = E_b + I_a R_a",
                description="Governs armature current draw as a function of supply voltage, back-EMF, and winding resistance.",
                variables=["V (Supply voltage, V)", "I_a (Armature current, A)", "R_a (Resistance, Ohm)"]
            )
        ]
        return DiagramAnalysisResult(
            diagram_id=diagram_id,
            concept_title="Working Principle of a Direct Current (DC) Electric Motor",
            discipline=Discipline.PHYSICS,
            summary="A classic electromagnetic energy transducer converting direct electric current into continuous mechanical rotation via Lorentz force and split-ring commutation.",
            representation_overview="The diagram depicts a stator permanent magnetic field enclosing a rotating rectangular armature coil with a split-ring commutator and stationary graphite brushes connected to a DC power supply.",
            components=components,
            connections=connections,
            governing_principles=principles,
            scientific_assumptions=[
                "Uniform magnetic flux density across the armature air gap",
                "Negligible brush friction and air aerodynamic drag",
                "Linear magnetic permeability without saturation"
            ],
            recommended_experience="Interactive 3D mechanical laboratory with adjustable voltage, magnetic field strength, coil turns, and mechanical load sliders with live torque vectors.",
            simulation_spec=spec,
            suggested_experiments=[
                "Increase voltage from 6V to 24V and observe how RPM and Back-EMF scale linearly.",
                "Increase mechanical load torque to 0.4 N·m to observe speed droop and current surge toward stall conditions.",
                "Observe the commutator split-ring passing the brush gap and inspect why unidirectional torque is maintained."
            ],
            sample_questions=[
                "Why is a split-ring commutator required instead of continuous slip rings?",
                "What prevents the motor from accelerating indefinitely when no mechanical load is attached?",
                "How does Fleming's Left-Hand Rule determine the direction of rotation?"
            ]
        )

    def _build_electrolysis_analysis(self, diagram_id: str) -> DiagramAnalysisResult:
        spec = get_electrolysis_template()
        components = [
            Component(id="anode", name="Anode Electrode (+)", role=ComponentRole.ACTUATOR, description="Positive electrode where oxidation takes place, releasing oxygen gas.", properties={"charge": "positive", "material": "Platinum"}),
            Component(id="cathode", name="Cathode Electrode (-)", role=ComponentRole.ACTUATOR, description="Negative electrode where reduction takes place, liberating hydrogen gas.", properties={"charge": "negative", "material": "Platinum"}),
            Component(id="acid_solution", name="Acidulated Water Electrolyte", role=ComponentRole.SUBSTANCE, description="Aqueous solution containing H+ and SO4(2-) ions providing high electrical conductivity.", properties={"solute": "H2SO4", "solvent": "H2O"}),
            Component(id="cathode_gas_trap", name="Cathode Collection Tube", role=ComponentRole.MEASUREMENT, description="Inverted graduated tube collecting liberated gaseous Hydrogen (H2)."),
            Component(id="anode_gas_trap", name="Anode Collection Tube", role=ComponentRole.MEASUREMENT, description="Inverted graduated tube collecting liberated gaseous Oxygen (O2).")
        ]
        connections = [
            Connection(source_id="anode", target_id="acid_solution", relation_type="chemical", description="Water molecules donate electrons at the anode surface producing O2 and H+ ions."),
            Connection(source_id="cathode", target_id="acid_solution", relation_type="chemical", description="Hydronium ions accept electrons at the cathode surface forming gaseous H2.")
        ]
        principles = [
            GoverningEquation(
                name="Anode Half-Reaction (Oxidation)",
                latex=r"2H_2O (l) \rightarrow O_2 (g) + 4H^+ (aq) + 4e^- \quad (E^\circ = +1.23\,\text{V})",
                description="Electrochemical oxidation of water releasing oxygen gas and hydronium ions."
            ),
            GoverningEquation(
                name="Cathode Half-Reaction (Reduction)",
                latex=r"4H^+ (aq) + 4e^- \rightarrow 2H_2 (g) \quad (E^\circ = 0.00\,\text{V})",
                description="Electrochemical reduction of protons consuming electrons to produce hydrogen gas."
            ),
            GoverningEquation(
                name="Faraday's Law of Electrolysis",
                latex=r"m = \frac{I \cdot t \cdot M}{z \cdot F}",
                description="Direct relationship between total charge passed and mass of substance liberated at the electrodes."
            )
        ]
        return DiagramAnalysisResult(
            diagram_id=diagram_id,
            concept_title="Electrochemical Decomposition (Electrolysis) of Water",
            discipline=Discipline.CHEMISTRY,
            summary="Demonstrates electrolytic water splitting into hydrogen and oxygen gases at a stoichiometric 2:1 ratio driven by an external DC potential.",
            representation_overview="A Hofmann voltameter or dual-electrode electrolytic cell submerged in acidulated aqueous electrolyte with DC power and inverted graduated collection columns.",
            components=components,
            connections=connections,
            governing_principles=principles,
            scientific_assumptions=[
                "Ideal gas behavior for evolved H2 and O2 gases",
                "Negligible gas solubility in water at operating temperatures",
                "100% Faradaic charge efficiency under dilute acid conditions"
            ],
            recommended_experience="Interactive 3D chemical cell with bubble generation particle systems, voltage sweep slider, and live gas collection telemetry.",
            simulation_spec=spec,
            suggested_experiments=[
                "Increase applied voltage above 1.23V and verify why current remains zero until overpotential is overcome.",
                "Compare the accumulation level in the cathode tube vs anode tube to verify the 2:1 volumetric stoichiometry.",
                "Increase acid concentration to observe dramatic reduction in electrolytic solution resistance."
            ],
            sample_questions=[
                "Why is pure distilled water unable to undergo rapid electrolysis without an electrolyte?",
                "Why is the volume of gas collected at the cathode twice that at the anode?",
                "What would happen if alternating current (AC) were used instead of direct current (DC)?"
            ]
        )

    def _build_animal_cell_analysis(self, diagram_id: str) -> DiagramAnalysisResult:
        spec = get_animal_cell_template()
        components = [
            Component(id="plasma_membrane", name="Plasma Membrane (Phospholipid Bilayer)", role=ComponentRole.STRUCTURE, description="Selectively permeable boundary regulating solute and water exchange.", properties={"type": "Lipid bilayer with cholesterol"}),
            Component(id="nucleus_core", name="Nucleus & Nuclear Envelope", role=ComponentRole.REGULATOR, description="Contains genomic DNA and directs cellular transcription and protein synthesis."),
            Component(id="mitochondria", name="Mitochondria (Powerhouse of the Cell)", role=ComponentRole.ACTUATOR, description="Generates adenosine triphosphate (ATP) through oxidative phosphorylation via the electron transport chain."),
            Component(id="rough_er", name="Endoplasmic Reticulum (Rough & Smooth)", role=ComponentRole.CARRIER, description="Synthesizes membrane proteins, lipids, and facilitates intracellular transport."),
            Component(id="golgi", name="Golgi Apparatus", role=ComponentRole.CARRIER, description="Modifies, sorts, and packages macromolecules for secretion or delivery.")
        ]
        connections = [
            Connection(source_id="nucleus_core", target_id="rough_er", relation_type="biological", description="mRNA transcripts exit nuclear pores and are translated on membrane-bound ribosomes."),
            Connection(source_id="rough_er", target_id="golgi", relation_type="biological", description="Transport vesicles shuttle synthesized peptides to the cis-face of the Golgi apparatus."),
            Connection(source_id="mitochondria", target_id="plasma_membrane", relation_type="biological", description="ATP produced by ATP synthase fuels active transport pumps (Na+/K+ ATPase) in the membrane.")
        ]
        principles = [
            GoverningEquation(
                name="Chemiosmotic ATP Synthesis",
                latex=r"\text{ADP} + \text{P}_i + \text{H}^+_{\text{intermembrane}} \xrightarrow{\text{ATP Synthase}} \text{ATP} + \text{H}_2\text{O}",
                description="Electrochemical proton gradient across the inner mitochondrial membrane powers rotational ATP synthase."
            ),
            GoverningEquation(
                name="Van 't Hoff Law for Osmotic Pressure",
                latex=r"\Pi = i M R T",
                description="Determines osmotic water flux across the semipermeable cell membrane."
            )
        ]
        return DiagramAnalysisResult(
            diagram_id=diagram_id,
            concept_title="Eukaryotic Animal Cell Architecture & Organelle Dynamics",
            discipline=Discipline.BIOLOGY,
            summary="A comprehensive model of an animal cell highlighting cellular respiration, compartmentalized organelle functions, and membrane transport.",
            representation_overview="Cross-sectional illustration of a eukaryotic animal cell displaying internal organelles suspended in the cytoplasm enclosed by a plasma membrane.",
            components=components,
            connections=connections,
            governing_principles=principles,
            scientific_assumptions=[
                "Steady state cytosolic pH of 7.2",
                "Intracellular osmolarity regulated around 300 mOsm/L",
                "Continuous ATP turnover with dynamic metabolic feedback"
            ],
            recommended_experience="Explorable 3D cellular model with zoomable organelle focus, osmotic tonicity sliders, and metabolic flux animations.",
            simulation_spec=spec,
            suggested_experiments=[
                "Lower extracellular tonicity below 200 mOsm/L to observe hypotonic swelling and membrane stress.",
                "Simulate hypoxia by lowering oxygen pO2 and watch lactic acid fermentation activate.",
                "Inspect the cristae folds of the mitochondrion to understand surface area optimization for ATP synthase."
            ],
            sample_questions=[
                "Why do animal cells burst in pure water whereas plant cells do not?",
                "How does the inner mitochondrial membrane maintain a proton gradient?",
                "What is the functional difference between the rough ER and smooth ER?"
            ]
        )


vision_service = VisionService()
