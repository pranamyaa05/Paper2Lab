from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ActionType(str, Enum):
    HIGHLIGHT = "highlight"
    FOCUS_CAMERA = "focus_camera"
    SET_VARIABLE = "set_variable"
    TRIGGER_EFFECT = "trigger_effect"
    RESET = "reset"


class SimulationAction(BaseModel):
    action_type: ActionType
    target_id: Optional[str] = Field(None, description="Component ID or Entity ID")
    value: Optional[Any] = Field(None, description="Value to set if SET_VARIABLE, or duration/color")
    description: str = Field(..., description="What this action demonstrates visually to the student")


class AskDiagramRequest(BaseModel):
    diagram_id: str
    question: str
    current_variables: Dict[str, float] = Field(default_factory=dict)
    active_component_id: Optional[str] = None
    language: str = Field(default="en", description="Target language code, e.g. 'en', 'hi', 'es', 'fr', 'ta'")
    generate_speech: bool = Field(default=False)


class AskDiagramResponse(BaseModel):
    diagram_id: str
    question: str
    answer: str
    scientific_rationale: str
    simulation_actions: List[SimulationAction] = Field(default_factory=list)
    suggested_followups: List[str] = Field(default_factory=list)
    audio_base64: Optional[str] = None
    audio_url: Optional[str] = None
