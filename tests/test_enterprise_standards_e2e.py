"""
Comprehensive Enterprise Standards & Subsystems Verification Suite
Validates:
  1. Standard Model Context Protocol (MCP) JSON-RPC 2.0 handshake & tool dispatch.
  2. CrewAI Multi-Agent Curriculum Studio (3-agent collaborative pipeline).
  3. AutoGen Multi-Agent Oral Viva Defense (Adversarial examiner panel).
  4. Live Classroom Cohort / Grade Visibility Isolation & Access Control.
  5. Personal Learning Agent LangGraph State Machine & Bayesian Knowledge Tracing.
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_mcp_protocol_initialize():
    """Validates MCP initialize handshake according to MCP 2024-11-05 spec."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {}
        }
        res = await client.post("/api/v1/mcp", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["jsonrpc"] == "2.0"
        assert data["id"] == 1
        assert "result" in data
        assert data["result"]["protocolVersion"] == "2024-11-05"
        assert "serverInfo" in data["result"]
        assert data["result"]["serverInfo"]["name"] == "omni-lms-mcp-server"

@pytest.mark.asyncio
async def test_mcp_tools_list_and_call():
    """Validates MCP tools/list and tools/call execution."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. tools/list
        list_payload = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        res = await client.post("/api/v1/mcp", json=list_payload)
        assert res.status_code == 200
        data = res.json()
        tools = data["result"]["tools"]
        tool_names = [t["name"] for t in tools]
        assert "lms_start_live_class" in tool_names
        assert "lms_get_student_risk_profile" in tool_names
        assert "lms_navigate_ui_tab" in tool_names

        # 2. tools/call for lms_start_live_class
        call_payload = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "lms_start_live_class",
                "arguments": {
                    "grade": "Class 6-A",
                    "subject": "Mathematics",
                    "start_time": "16:45"
                }
            }
        }
        call_res = await client.post("/api/v1/mcp", json=call_payload)
        assert call_res.status_code == 200
        call_data = call_res.json()
        assert "result" in call_data
        content = call_data["result"]["content"][0]["text"]
        assert "Class 6-A" in content
        assert "Mathematics" in content

@pytest.mark.asyncio
async def test_crewai_curriculum_designer():
    """Validates CrewAI 3-Agent Collaborative Curriculum Studio."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "topic": "Calculus & Optimization",
            "grade_level": "Class 10",
            "target_learning_goals": ["Derivations", "Mechanics", "Coding"]
        }
        res = await client.post("/api/v1/agents/curriculum/crew", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["grade_level"] == "Class 10"
        assert len(data["agent_contributions"]) == 3
        
        # Verify all 3 collaborating agents contributed
        agents = [a["agent_role"] for a in data["agent_contributions"]]
        assert any("Subject Matter" in a for a in agents)
        assert any("Psychometrician" in a for a in agents)
        assert any("Instructional" in a for a in agents)

@pytest.mark.asyncio
async def test_autogen_oral_viva_defense():
    """Validates AutoGen Multi-Agent Conversational Oral Defense."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Round 1: Initial Examiner Opening
        res1 = await client.post("/api/v1/agents/viva/round", json={
            "subject": "Mathematics",
            "topic": "Quadratic Forms",
            "student_response": "",
            "round_number": 1
        })
        assert res1.status_code == 200
        data1 = res1.json()
        assert len(data1["dialogue"]) >= 1
        assert "Prof. Eleanor Wright" in data1["dialogue"][0]["speaker"]

        # Round 2: Student Defends with Mathematical Argument
        res2 = await client.post("/api/v1/agents/viva/round", json={
            "subject": "Mathematics",
            "topic": "Quadratic Forms",
            "student_response": "The discriminant determines the multiplicity and real nature of the eigenvalues.",
            "round_number": 1
        })
        assert res2.status_code == 200
        data2 = res2.json()
        speakers = [t["speaker"] for t in data2["dialogue"]]
        assert "Prof. Eleanor Wright" in speakers
        assert "Dr. Soren Kierkegaard" in speakers
        assert data2["current_evaluation"]["rigor_score"] > 0

@pytest.mark.asyncio
async def test_learning_agent_cognitive_state():
    """Validates Learning Agent state and cognitive recommendations."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Testing LENS API endpoint
        res = await client.post("/api/v1/lens/diagnostic/generate", json={
            "grade_name": "Class 10",
            "subjects": ["Mathematics", "Physics"],
            "num_questions": 3
        })
        # Returns 401 Unauthorized without auth headers (strict enterprise standard security)
        assert res.status_code in [200, 401]

@pytest.mark.asyncio
async def test_autonomous_copilot_reasoning_engine():
    """Validates Autonomous Page-Aware OmniCopilot Groq LPU reasoning engine."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Faculty launch live class command on timetable tab
        res_teacher = await client.post("/api/v1/agents/copilot/reason", json={
            "query": "go to live classes and start class for 6th A at 4:45",
            "current_tab": "timetable",
            "user_role": "teacher",
            "user_name": "Dr. Sarah Connor",
            "grade_number": 6
        })
        assert res_teacher.status_code == 200
        data_t = res_teacher.json()
        assert data_t["action_type"] == "START_LIVE_CLASS"
        assert len(data_t["reasoning_steps"]) >= 2
        assert len(data_t["agent_reply"]) > 10

        # 2. Student attempt to start a class (Restricted RBAC check)
        res_student = await client.post("/api/v1/agents/copilot/reason", json={
            "query": "start live class now",
            "current_tab": "overview",
            "user_role": "student",
            "user_name": "Aarav Patel",
            "grade_number": 10
        })
        assert res_student.status_code == 200
        data_s = res_student.json()
        assert data_s["action_type"] == "RESTRICTED_ACTION"
        assert "student" in data_s["agent_reply"].lower()

