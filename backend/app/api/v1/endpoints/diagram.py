import logging
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status

from app.core.config import settings
from app.schemas.diagram import (
    DiagramAnalysisResult,
    SimulationSpec,
    TelemetryComputeRequest,
    TelemetryComputeResponse,
)
from app.services.vision_service import vision_service
from app.services.simulation_service import simulation_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/upload", response_model=DiagramAnalysisResult, status_code=status.HTTP_200_OK)
async def upload_and_analyze_diagram(
    file: UploadFile = File(..., description="Uploaded textbook diagram or screenshot"),
    context_hint: Optional[str] = Form(None, description="Optional textbook chapter or topic hint")
):
    """
    Step 1 & 2: Ingests an unfamiliar textbook diagram, identifies the concept, components,
    connections, scientific principles, and generates the interactive 3D simulation spec.
    """
    content_type = file.content_type or ""
    if content_type not in settings.ALLOWED_IMAGE_TYPES and not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Please upload a PNG, JPG, or WEBP image."
        )

    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds maximum size limit of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    try:
        result = await vision_service.analyze_diagram_image(
            image_bytes=file_bytes,
            filename=file.filename or "diagram.png",
            context_hint=context_hint
        )
        return result
    except Exception as e:
        logger.error(f"Error during diagram analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process scientific diagram: {str(e)}"
        )


@router.get("/templates", response_model=List[SimulationSpec])
async def list_simulation_templates():
    """Returns all pre-validated scientific simulation models."""
    return simulation_service.list_templates()


@router.get("/templates/{template_id}", response_model=SimulationSpec)
async def get_simulation_template(template_id: str):
    """Retrieves a specific simulation model specification."""
    try:
        return simulation_service.get_template(template_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/telemetry", response_model=TelemetryComputeResponse)
async def compute_telemetry(request: TelemetryComputeRequest):
    """
    Computes real-time physical telemetry values (RPM, torque, gas rates, ATP flux)
    driven by scientific equations whenever the student adjusts controls.
    """
    return simulation_service.compute_telemetry(request)
