from typing import Dict, Any, List
from app.schemas.diagram import (
    SimulationSpec,
    TelemetryComputeRequest,
    TelemetryComputeResponse,
)
from app.templates.registry import (
    TEMPLATE_REGISTRY,
    compute_dc_motor_telemetry,
    compute_electrolysis_telemetry,
    compute_animal_cell_telemetry,
)


class SimulationService:
    def list_templates(self) -> List[SimulationSpec]:
        return list(TEMPLATE_REGISTRY.values())

    def get_template(self, template_id: str) -> SimulationSpec:
        if template_id in TEMPLATE_REGISTRY:
            return TEMPLATE_REGISTRY[template_id]
        raise ValueError(f"Simulation template '{template_id}' not found.")

    def compute_telemetry(self, request: TelemetryComputeRequest) -> TelemetryComputeResponse:
        template_id = request.template_id
        variables = request.variables
        
        if template_id == "dc_motor_3d":
            return compute_dc_motor_telemetry(variables)
        elif template_id == "electrolysis_cell_3d":
            return compute_electrolysis_telemetry(variables)
        elif template_id == "animal_cell_3d":
            return compute_animal_cell_telemetry(variables)
        else:
            # Fallback general linear/proportional simulation telemetry
            return TelemetryComputeResponse(
                telemetry_values={f"{k}_metric": round(v * 1.5, 2) for k, v in variables.items()},
                state_description=f"Generic simulation updated with {len(variables)} variable inputs.",
                warnings=[]
            )


simulation_service = SimulationService()
