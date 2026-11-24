from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class Discipline(str, Enum):
    PHYSICS = "physics"
    CHEMISTRY = "chemistry"
    BIOLOGY = "biology"
    EARTH_SCIENCE = "earth_science"
    ENGINEERING = "engineering"
    GENERAL = "general"


class ComponentRole(str, Enum):
    INPUT_SOURCE = "input_source"
    ACTUATOR = "actuator"
    REGULATOR = "regulator"
    MEASUREMENT = "measurement"
    STRUCTURE = "structure"
    SUBSTANCE = "substance"
    CARRIER = "carrier"
    DISPLAY = "display"
    OTHER = "other"


class BoundingBox(BaseModel):
    ymin: float = Field(..., ge=0.0, le=1000.0, description="Normalized or pixel Y minimum")
    xmin: float = Field(..., ge=0.0, le=1000.0, description="Normalized or pixel X minimum")
    ymax: float = Field(..., ge=0.0, le=1000.0, description="Normalized or pixel Y maximum")
    xmax: float = Field(..., ge=0.0, le=1000.0, description="Normalized or pixel X maximum")


class Component(BaseModel):
    id: str = Field(..., description="Unique component ID (e.g., 'armature_coil', 'anode')")
    name: str = Field(..., description="Human readable label")
    role: ComponentRole = Field(default=ComponentRole.STRUCTURE)
    description: str = Field(..., description="Scientific purpose of this component")
    bbox: Optional[BoundingBox] = None
    properties: Dict[str, Any] = Field(default_factory=dict, description="Physical traits (material, charge, resistance, etc.)")


class Connection(BaseModel):
    source_id: str = Field(..., description="Component ID where connection begins")
    target_id: str = Field(..., description="Component ID where connection ends")
    relation_type: str = Field(..., description="Type of coupling: 'electrical', 'magnetic', 'mechanical', 'fluid', 'osmotic', 'optical'")
    description: str = Field(..., description="What flows or transfers across this connection")
    bidirectional: bool = False


class GoverningEquation(BaseModel):
    name: str = Field(..., description="Law or theorem name, e.g. 'Lorentz Force Law'")
    latex: str = Field(..., description="LaTeX representation, e.g. 'F = I (L \\times B)'")
    description: str = Field(..., description="Explanation of what this equation calculates")
    variables: List[str] = Field(default_factory=list, description="Variables involved")


class SimVariable(BaseModel):
    key: str = Field(..., description="Programmatic identifier, e.g. 'current_amp'")
    label: str = Field(..., description="Display label, e.g. 'Electric Current'")
    symbol: str = Field(..., description="Symbol, e.g. 'I'")
    unit: str = Field(..., description="SI unit, e.g. 'A'")
    min_value: float = Field(...)
    max_value: float = Field(...)
    step: float = Field(default=0.1)
    default_value: float = Field(...)
    current_value: float = Field(...)
    description: str = Field(default="")


class TelemetryMetric(BaseModel):
    key: str = Field(..., description="Metric key, e.g. 'rpm' or 'gas_volume_o2'")
    label: str = Field(..., description="Display label, e.g. 'Rotational Speed'")
    unit: str = Field(..., description="Unit, e.g. 'RPM' or 'mL'")
    formula_hint: str = Field(default="")


class ControlWidgetType(str, Enum):
    SLIDER = "slider"
    TOGGLE = "toggle"
    RADIO = "radio"
    BUTTON_TRIGGER = "button_trigger"


class InteractiveControl(BaseModel):
    control_id: str
    variable_key: str
    widget_type: ControlWidgetType
    label: str
    tooltip: str = ""


class ThreeJsEntity(BaseModel):
    id: str
    component_id: str
    geometry: str = Field(..., description="e.g. 'box', 'cylinder', 'sphere', 'ring', 'custom_path'")
    position: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    rotation: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    scale: List[float] = Field(default_factory=lambda: [1.0, 1.0, 1.0])
    color: str = Field(default="#3b82f6")
    material: str = Field(default="standard")
    animation_behavior: Optional[str] = Field(None, description="e.g. 'spin_y_proportional_to_rpm', 'bubble_emitter'")


class SimulationSpec(BaseModel):
    template_id: str = Field(..., description="Simulation model identifier (e.g. 'dc_motor_3d', 'electrolysis_cell_3d', 'animal_cell_3d', 'ray_optics_2d', 'generic_rig')")
    title: str
    summary: str
    discipline: Discipline
    variables: List[SimVariable] = Field(default_factory=list)
    telemetry: List[TelemetryMetric] = Field(default_factory=list)
    controls: List[InteractiveControl] = Field(default_factory=list)
    entities_3d: List[ThreeJsEntity] = Field(default_factory=list)
    dynamic_code_snippet: Optional[str] = Field(None, description="Client-side React Three Fiber / Three.js update loop logic")


class DiagramAnalysisResult(BaseModel):
    diagram_id: str
    concept_title: str
    discipline: Discipline
    summary: str
    
    # 6 Core questions answered:
    # 1. What is represented?
    representation_overview: str
    
    # 2. What are its components?
    components: List[Component]
    
    # 3. How are the components connected?
    connections: List[Connection]
    
    # 4. What scientific or logical principles govern it?
    governing_principles: List[GoverningEquation]
    scientific_assumptions: List[str]
    
    # 5. What kind of interactive experience would best explain it?
    recommended_experience: str
    simulation_spec: SimulationSpec
    
    # 6. How can the student experiment with it and ask questions?
    suggested_experiments: List[str]
    sample_questions: List[str]


class TelemetryComputeRequest(BaseModel):
    template_id: str
    variables: Dict[str, float]


class TelemetryComputeResponse(BaseModel):
    telemetry_values: Dict[str, float]
    state_description: str
    warnings: List[str] = Field(default_factory=list)
