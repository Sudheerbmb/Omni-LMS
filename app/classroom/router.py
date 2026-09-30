from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.classroom.schemas import LiveClassCreate, LiveClassRead, TeacherTimetableSlotRead
from app.classroom.service import (
    ClassroomAccessError,
    ScheduleConflictError,
    get_school_live_classes,
    get_teacher_timetable_slots_for_scheduling,
    schedule_school_live_class,
    update_live_class_status,
)
from app.identity.auth import get_current_user
from app.identity.models import User
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/classroom", tags=["classroom"])


# ── In-Memory Real-Time Room WebSocket Manager ─────────────────────────────────
class RoomConnectionManager:
    def __init__(self):
        self.active_rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_rooms:
            self.active_rooms[room_id] = set()
        self.active_rooms[room_id].add(websocket)
        print(f"[WS] Peer joined room {room_id}. Total peers in room: {len(self.active_rooms[room_id])}")

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.active_rooms:
            self.active_rooms[room_id].discard(websocket)
            if not self.active_rooms[room_id]:
                del self.active_rooms[room_id]
        print(f"[WS] Peer disconnected from room {room_id}")

    async def broadcast(self, room_id: str, message: dict, sender: Optional[WebSocket] = None):
        if room_id in self.active_rooms:
            for connection in list(self.active_rooms[room_id]):
                if connection != sender:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass


room_manager = RoomConnectionManager()


@router.websocket("/ws/{room_id}")
async def classroom_websocket_endpoint(websocket: WebSocket, room_id: str):
    """
    High-speed real-time WebSocket channel for:
    - Real-time whiteboard vector synchronization
    - Cross-browser in-call chat
    - Live polls broadcasting & voting
    - Floating reaction emojis
    - WebRTC signaling (SDP offer/answer, ICE candidates)
    """
    await room_manager.connect(room_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # Broadcast the signal/message to all other peers in this room
            await room_manager.broadcast(room_id, data, sender=websocket)
    except WebSocketDisconnect:
        room_manager.disconnect(room_id, websocket)
    except Exception as e:
        print(f"[WS ERROR] {e}")
        room_manager.disconnect(room_id, websocket)


@router.get("/teacher-slots", response_model=List[TeacherTimetableSlotRead])
async def get_teacher_slots_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> List[Dict[str, Any]]:
    """
    Retrieves the allowed timetable periods for this teacher according to the master schedule.
    Filters strictly to subjects and classes assigned to this teacher.
    """
    return await get_teacher_timetable_slots_for_scheduling(session, current_user)


@router.post("/classes", response_model=LiveClassRead, status_code=status.HTTP_201_CREATED)
async def create_school_live_class_endpoint(
    data: LiveClassCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """
    Schedules or launches an instant live classroom session.
    Automatically links to grade, section, subject, and period from timetable.
    """
    try:
        live_class = await schedule_school_live_class(session, data, current_user)
        return {
            "id": live_class.id,
            "title": live_class.title,
            "teacher_id": live_class.teacher_id,
            "teacher_name": current_user.display_name,
            "starts_at": live_class.starts_at,
            "ends_at": live_class.ends_at,
            "meeting_url": live_class.meeting_url,
            "status": live_class.status,
            "grade_number": live_class.grade_number,
            "section_name": live_class.section_name,
            "subject_code": live_class.subject_code,
            "subject_name": live_class.subject_name,
            "period_number": live_class.period_number,
            "room_number": live_class.room_number,
        }
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/classes", response_model=List[LiveClassRead])
async def get_school_live_classes_endpoint(
    grade_number: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> List[Dict[str, Any]]:
    """
    Returns live classroom sessions:
    - Students see active/scheduled classes for their grade.
    - Teachers see sessions they lead.
    - Admins see all sessions.
    """
    return await get_school_live_classes(
        session=session,
        user=current_user,
        grade_number=grade_number,
        status_filter=status_filter,
    )


@router.put("/classes/{class_id}/status")
async def update_class_status_endpoint(
    class_id: UUID,
    new_status: str = Query(..., regex="^(scheduled|live|ended)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Updates the status of a live class (start live session or end meeting)."""
    updated = await update_live_class_status(session, class_id, new_status)
    if not updated:
        raise HTTPException(status_code=404, detail="Live class not found")
    return {"id": str(updated.id), "status": updated.status}
