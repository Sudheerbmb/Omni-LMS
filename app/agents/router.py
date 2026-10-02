"""
Multi-Agent Orchestration FastAPI Router
Exposes CrewAI and AutoGen endpoints to Omni-LMS.
"""
from fastapi import APIRouter
from app.agents.crew_curriculum import (
    CrewCurriculumRequest,
    CrewCurriculumResponse,
    run_crew_curriculum_designer
)
from app.agents.autogen_viva import (
    VivaRoundRequest,
    VivaRoundResponse,
    process_autogen_viva_round
)

router = APIRouter(prefix="/api/v1/agents", tags=["multi-agents"])

@router.post("/curriculum/crew", response_model=CrewCurriculumResponse)
async def generate_curriculum_crew(req: CrewCurriculumRequest):
    """
    Triggers CrewAI multi-agent curriculum studio with 3 collaborating agents.
    """
    return await run_crew_curriculum_designer(req)

@router.post("/viva/round", response_model=VivaRoundResponse)
async def execute_viva_round(req: VivaRoundRequest):
    """
    Executes a multi-agent AutoGen conversational oral defense round.
    """
    return await process_autogen_viva_round(req)
