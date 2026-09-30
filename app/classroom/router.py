import cloudinary
import cloudinary.uploader
from fastapi import File, UploadFile
from app.classroom.service import attach_class_recording
from app.platform.config import settings

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name or "zy4qhemm",
    api_key=settings.cloudinary_api_key or "348774342517364",
    api_secret=settings.cloudinary_api_secret or "iUM25wdg_Mzbi8dWq1oUMD8GTls",
    secure=True
)

import urllib.parse
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


# ── Authoritative Real-Time Room & Peer Presence Manager ───────────────────────
class RoomConnectionManager:
    def __init__(self):
        # room_id -> { peer_id: (WebSocket, user_dict) }
        self.rooms: Dict[str, Dict[str, tuple[WebSocket, dict]]] = {}

    async def register_peer(self, room_id: str, peer_id: str, websocket: WebSocket, user_info: dict):
        if room_id not in self.rooms:
            self.rooms[room_id] = {}

        # 1. Gather all other peers currently in this room
        current_peers = [
            {"peerId": pid, "user": info}
            for pid, (ws, info) in self.rooms[room_id].items()
            if pid != peer_id
        ]

        # 2. Add or update this peer
        self.rooms[room_id][peer_id] = (websocket, user_info)
        print(f"[WS] Peer '{user_info.get('display_name', peer_id)}' (id={peer_id}) registered in room {room_id}. Total peers: {len(self.rooms[room_id])}")

        # 3. Immediately send the newly connected peer the full list of existing attendees
        try:
            await websocket.send_json({
                "type": "room_state",
                "peers": current_peers,
                "roomId": room_id
            })
        except Exception as err:
            print(f"[WS] Error sending room_state to {peer_id}: {err}")

        # 4. Broadcast to all other peers that this new attendee has joined
        join_broadcast = {
            "type": "peer_join",
            "peerId": peer_id,
            "user": user_info
        }
        await self.broadcast(room_id, join_broadcast, sender_peer_id=peer_id)

    async def unregister_peer(self, room_id: str, peer_id: str):
        if room_id in self.rooms and peer_id in self.rooms[room_id]:
            del self.rooms[room_id][peer_id]
            print(f"[WS] Peer {peer_id} removed from room {room_id}. Remaining: {len(self.rooms[room_id])}")
            if not self.rooms[room_id]:
                del self.rooms[room_id]

            # Notify remaining attendees that this peer has left
            leave_broadcast = {
                "type": "peer_leave",
                "peerId": peer_id
            }
            await self.broadcast(room_id, leave_broadcast)

    async def broadcast(self, room_id: str, message: dict, sender_peer_id: Optional[str] = None):
        if room_id in self.rooms:
            target_peer_id = message.get("targetPeerId")
            for pid, (ws, _) in list(self.rooms[room_id].items()):
                # If message specifies a single recipient peer, send only to them
                if target_peer_id:
                    if pid == target_peer_id:
                        try:
                            await ws.send_json(message)
                        except Exception:
                            pass
                else:
                    # Broadcast to everyone except the sender
                    if pid != sender_peer_id:
                        try:
                            await ws.send_json(message)
                        except Exception:
                            pass


room_manager = RoomConnectionManager()


@router.websocket("/ws/{room_id}")
async def classroom_websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    peer_id: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
):
    """
    Real-Time WebSocket channel for:
    - Authoritative instantaneous peer presence roster
    - Cross-browser in-call chat with zero delay
    - Live collaborative whiteboard vector synchronization
    - Screen share broadcast notifications & high-speed frame snapshots
    - WebRTC signaling (offers, answers, ICE candidates)
    - Interactive live polls & floating animated reactions
    """
    await websocket.accept()

    # Determine peer identifier and display info from query params
    active_peer_id = peer_id or f"peer_{id(websocket)}"
    display_name = urllib.parse.unquote(name) if name else ("Teacher" if role == "teacher" else "Student")
    user_role = role or "student"

    user_info = {
        "id": active_peer_id,
        "display_name": display_name,
        "role": user_role,
        "avatar": display_name[:1].upper() if display_name else "U",
        "isMicOn": True,
        "isCameraOn": True,
        "isHandRaised": False,
    }

    # Register peer in room and send initial room roster
    await room_manager.register_peer(room_id, active_peer_id, websocket, user_info)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # Handle heartbeat presence update (DO NOT re-trigger room_state or join offers)
            if msg_type == "peer_presence":
                pid = data.get("peerId", active_peer_id)
                u_info = data.get("user", user_info)
                active_peer_id = pid
                user_info = u_info
                if room_id in room_manager.rooms:
                    room_manager.rooms[room_id][active_peer_id] = (websocket, user_info)
                # Broadcast updated user state (mic, cam, hand) without resetting WebRTC mesh
                await room_manager.broadcast(room_id, {
                    "type": "peer_presence",
                    "peerId": active_peer_id,
                    "user": user_info
                }, sender_peer_id=active_peer_id)

            elif msg_type in ("init", "peer_join"):
                pid = data.get("peerId", active_peer_id)
                u_info = data.get("user", user_info)
                active_peer_id = pid
                user_info = u_info
                # Only register if not already registered in room
                if room_id not in room_manager.rooms or active_peer_id not in room_manager.rooms[room_id]:
                    await room_manager.register_peer(room_id, active_peer_id, websocket, user_info)

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "meeting_ended":
                reason = data.get("reason") or "The instructor has ended the live session for all participants."
                # Broadcast to ALL attendees in the room
                await room_manager.broadcast(room_id, {
                    "type": "meeting_ended",
                    "reason": reason
                })

            elif msg_type == "kick_peer":
                target_pid = data.get("targetPeerId")
                if target_pid:
                    await room_manager.broadcast(room_id, {
                        "type": "kick_peer",
                        "targetPeerId": target_pid,
                        "reason": data.get("reason", "You have been removed from this live class by the instructor.")
                    })

            else:
                # Forward all other messages (chat, whiteboard, screen frames, reactions, polls, webrtc)
                sender = data.get("senderPeerId") or active_peer_id
                await room_manager.broadcast(room_id, data, sender_peer_id=sender)

    except WebSocketDisconnect:
        await room_manager.unregister_peer(room_id, active_peer_id)
    except Exception as exc:
        print(f"[WS Exception] {exc}")
        await room_manager.unregister_peer(room_id, active_peer_id)


@router.get("/teacher-slots", response_model=List[TeacherTimetableSlotRead])
async def get_teacher_slots_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> List[Dict[str, Any]]:
    return await get_teacher_timetable_slots_for_scheduling(session, current_user)


@router.post("/classes", response_model=LiveClassRead, status_code=status.HTTP_201_CREATED)
async def create_school_live_class_endpoint(
    data: LiveClassCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
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
    return await get_school_live_classes(
        session=session,
        user=current_user,
        grade_number=grade_number,
        status_filter=status_filter,
    )


@router.put("/classes/{class_id}/status")
async def update_class_status_endpoint(
    class_id: UUID,
    new_status: str = Query(..., pattern="^(scheduled|live|ended)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    updated = await update_live_class_status(session, class_id, new_status)
    if not updated:
        raise HTTPException(status_code=404, detail="Live class not found")

    # If status is set to ended, broadcast meeting_ended to all students in room!
    if new_status == "ended":
        await room_manager.broadcast(str(class_id), {
            "type": "meeting_ended",
            "reason": "The instructor has ended this live class session for all participants."
        })

    return {"id": str(updated.id), "status": updated.status}

@router.get("/cloudinary-config")
async def get_cloudinary_config_endpoint():
    return {
        "cloud_name": settings.cloudinary_cloud_name or "zy4qhemm",
        "api_key": settings.cloudinary_api_key or "348774342517364"
    }


@router.post("/classes/{class_id}/recording")
async def upload_class_recording_endpoint(
    class_id: UUID,
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    if not file:
        raise HTTPException(status_code=400, detail="Video file is required")

    try:
        # Read file bytes and stream to Cloudinary
        file_bytes = await file.read()
        import io
        file_io = io.BytesIO(file_bytes)

        upload_result = cloudinary.uploader.upload_large(
            file_io,
            resource_type="video",
            folder="omni_live_classrooms",
            public_id=f"lecture_{class_id}",
            overwrite=True
        )

        recording_url = upload_result.get("secure_url") or upload_result.get("url")
        if not recording_url:
            raise HTTPException(status_code=500, detail="Failed to obtain secure URL from Cloudinary")

        await attach_class_recording(session, class_id, recording_url)
        return {
            "id": str(class_id),
            "recording_url": recording_url,
            "duration": upload_result.get("duration"),
            "format": upload_result.get("format")
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cloudinary upload error: {str(exc)}") from exc
