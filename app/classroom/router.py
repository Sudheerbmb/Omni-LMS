import asyncio
import io
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.classroom.models import LiveClass
from app.classroom.schemas import (
    EndClassSessionRequest,
    LiveClassCreate,
    LiveClassRead,
    TeacherTimetableSlotRead,
)
from app.classroom.service import (
    ClassroomAccessError,
    ScheduleConflictError,
    attach_class_recording,
    get_school_live_classes,
    get_teacher_timetable_slots_for_scheduling,
    schedule_school_live_class,
    update_live_class_status,
)
from app.identity.auth import get_current_user
from app.identity.models import User
from app.platform.config import settings
from app.platform.database import get_session

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name or "zy4qhemm",
    api_key=settings.cloudinary_api_key or "348774342517364",
    api_secret=settings.cloudinary_api_secret or "iUM25wdg_Mzbi8dWq1oUMD8GTls",
    secure=True
)

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

@router.post("/classes/{class_id}/end-session")
async def end_live_class_session_endpoint(
    class_id: UUID,
    payload: EndClassSessionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    res = await session.execute(select(LiveClass).where(LiveClass.id == class_id))
    live_class = res.scalars().first()
    if not live_class:
        raise HTTPException(status_code=404, detail="Live class not found")

    live_class.status = "ended"
    transcript_to_save = (payload.live_transcript or "").strip()
    if transcript_to_save:
        live_class.transcript_text = transcript_to_save

    title = live_class.title or "Class Lecture"
    subject = live_class.subject_name or "Academic Subject"
    grade_num = live_class.grade_number or 1

    prompt = (
        f"You are an expert AI academic director analyzing the completed live classroom lecture: '{title}' (Subject: {subject}, Grade: {grade_num}).\n"
        f"Live Verbatim Lecture Transcript:\n"
        f"\"\"\"\n{transcript_to_save if transcript_to_save else f'Teacher delivered comprehensive live instruction on {title}.'}\n\"\"\"\n\n"
        "Generate a professional, fully functional JSON summary with:\n"
        "- 'overview': 2-3 sentences summarizing the exact concepts covered in this session\n"
        "- 'key_topics': array of 3-5 specific topics\n"
        "- 'whiteboard_notes': array of 2-4 key takeaways and core formulas/rules\n"
        "- 'exam_takeaways': array of 2-3 exam study points\n"
        "- 'case_studies': array of 1-2 real-world applications or case studies\n"
        "- 'quiz': array of 2 multiple-choice questions based on the lecture, each with 'question', 'options' (4 choices), 'correct_index' (0-3), and 'explanation'\n"
        "Return ONLY valid JSON."
    )
    json_res = await call_groq_llm([
        {"role": "system", "content": "You are an executive educational JSON synthesizer. Output valid JSON."},
        {"role": "user", "content": prompt}
    ], json_mode=True, max_tokens=700)

    summary_data = None
    if json_res:
        try:
            summary_data = json.loads(json_res)
            summary_data["class_id"] = str(class_id)
            summary_data["title"] = title
            summary_data["subject"] = subject
            summary_data["grade"] = grade_num
            live_class.summary_json = summary_data
        except Exception as e:
            print(f"Error parsing summary JSON: {e}")

    await session.commit()

    await room_manager.broadcast(str(class_id), {
        "type": "meeting_ended",
        "reason": "The instructor has ended this live class session for all participants.",
        "summary": summary_data
    })

    return {
        "id": str(class_id),
        "status": "ended",
        "summary_json": summary_data
    }


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


class AiDoubtRequest(BaseModel):
    question: str
    timestamp_seconds: Optional[float] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    grade: Optional[Any] = None
    history: Optional[List[Dict[str, str]]] = None


class TeacherCopilotRequest(BaseModel):
    current_topic: str
    grade: Optional[Any] = None
    subject: Optional[str] = None
    action: Optional[str] = "enhance"  # enhance | fun_fact | analogy | quick_poll | engagement_question | diagram
    live_transcript: Optional[str] = None
    elapsed_seconds: Optional[int] = None


class StudentTutorRequest(BaseModel):
    action: str = "doubt"  # doubt | summary | milestones
    query: Optional[str] = None
    live_transcript: Optional[str] = None
    elapsed_seconds: Optional[int] = None
    grade: Optional[Any] = None
    subject: Optional[str] = None
    topic: Optional[str] = None


async def transcribe_video_url_with_groq(media_url: str) -> tuple[Optional[str], Optional[list]]:
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not api_key or not media_url:
        return None, None

    try:
        def _fetch_and_transcribe():
            req_dl = urllib.request.Request(media_url, headers={'User-Agent': 'OmniLMS/1.0'})
            with urllib.request.urlopen(req_dl, timeout=40) as resp:
                media_data = resp.read()

            boundary = '----WebKitFormBoundaryGroqWhisperOmni'
            body = io.BytesIO()

            def add_field(name, value):
                body.write(f'--{boundary}\r\n'.encode('utf-8'))
                body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode('utf-8'))
                body.write(f'{value}\r\n'.encode('utf-8'))

            add_field('model', 'whisper-large-v3-turbo')
            add_field('response_format', 'verbose_json')

            body.write(f'--{boundary}\r\n'.encode('utf-8'))
            body.write(b'Content-Disposition: form-data; name="file"; filename="recording.webm"\r\n')
            body.write(b'Content-Type: video/webm\r\n\r\n')
            body.write(media_data)
            body.write(b'\r\n')
            body.write(f'--{boundary}--\r\n'.encode('utf-8'))

            req = urllib.request.Request(
                'https://api.groq.com/openai/v1/audio/transcriptions',
                data=body.getvalue(),
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': f'multipart/form-data; boundary={boundary}',
                    'User-Agent': 'OmniLMS/1.0'
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                res = json.loads(resp.read().decode('utf-8'))
                text_out = res.get('text', '').strip()
                raw_segments = res.get('segments', [])
                cleaned_segments = [
                    {
                        "start": round(s.get("start", 0.0), 1),
                        "end": round(s.get("end", 0.0), 1),
                        "text": s.get("text", "").strip()
                    }
                    for s in raw_segments if s.get("text")
                ]
                return text_out, cleaned_segments

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _fetch_and_transcribe)
    except Exception as e:
        print(f"Whisper verbose transcription error for {media_url[:60]}: {e}")
        return None, None


async def call_groq_llm(messages: List[Dict[str, str]], json_mode: bool = False, max_tokens: int = 700, temperature: float = 0.25) -> Optional[str]:
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return None

    try:
        def _call_chat():
            req_data = {
                'model': settings.groq_model or 'qwen/qwen3.8-27b',
                'messages': messages,
                'max_tokens': max_tokens,
                'temperature': temperature
            }
            if json_mode:
                req_data['response_format'] = {'type': 'json_object'}

            req = urllib.request.Request(
                'https://api.groq.com/openai/v1/chat/completions',
                data=json.dumps(req_data).encode('utf-8'),
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'User-Agent': 'OmniLMS/1.0'
                }
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                res = json.loads(resp.read().decode('utf-8'))
                return res['choices'][0]['message']['content'].strip()

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _call_chat)
    except Exception as e:
        print(f"Groq LLM call error: {e}")
        return None


async def get_or_transcribe_class(class_id_str: str, session: AsyncSession) -> tuple[Optional[str], Optional[list], Optional[LiveClass]]:
    live_class = None
    try:
        import uuid as _uuid_mod
        c_uuid = _uuid_mod.UUID(class_id_str)
        live_class = await session.scalar(select(LiveClass).where(LiveClass.id == c_uuid))
    except Exception:
        pass

    if not live_class:
        return None, None, None

    if live_class.transcript_text and live_class.transcript_text.strip():
        return live_class.transcript_text.strip(), live_class.transcript_segments or [], live_class

    if live_class.recording_url:
        transcript, segments = await transcribe_video_url_with_groq(live_class.recording_url)
        if transcript:
            live_class.transcript_text = transcript
            live_class.transcript_segments = segments
            await session.commit()
            return transcript, segments, live_class

    return None, None, live_class


@router.post("/classes/{class_id}/ai-doubt")
async def ask_class_ai_doubt(
    class_id: str,
    payload: AiDoubtRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    transcript, segments, live_class = await get_or_transcribe_class(class_id, session)

    title = payload.title or (live_class.title if live_class else "Class Lecture")
    subject = payload.subject or (live_class.subject_name if live_class and live_class.subject_name else "Academic Subject")
    grade_num = live_class.grade_number if live_class and live_class.grade_number else 1

    question = payload.question.strip()
    
    agent_output = None

    if transcript:
        # Build segments summary for agent perception
        seg_json = json.dumps(segments or [{"start": 0.0, "end": 15.0, "text": transcript}])
        
        system_agent_prompt = f"""You are Omni-Agent, an autonomous AI educational study agent for this recorded video lecture.
You have direct perception of the lecture's timestamped audio transcript:
{seg_json}

Lecture Metadata: Title: "{title}", Subject: "{subject}", Grade: {grade_num}.

CRITICAL AGENT RULES:
1. BE OPTIMIZED & PROFESSIONAL: Provide a clean, direct, executive explanation. Do NOT apologize, do NOT say "Did you upload the wrong video?", and avoid conversational fluff.
2. AGENTIC ACTIONS:
   - Include 'SEEK_VIDEO' actions with the exact timestamp in seconds whenever topics or moments are mentioned so the student can jump directly to that point in the video.
   - If the student asks for practice or a quiz, include an 'INTERACTIVE_QUIZ' action with question, options (4), and correct_index (0-3).
3. SUGGESTED FOLLOWUPS: Provide 3 smart, context-aware followup questions.
4. RESPONSE FORMAT: Strictly output valid JSON matching this schema:
{{
  "thought": "Internal reasoning about the video content and user query",
  "answer": "Clean, structured markdown response with clear sections and takeaways",
  "actions": [
    {{"type": "SEEK_VIDEO", "timestamp": 0.0, "label": "00:00 • Introduction"}},
    {{"type": "SEEK_VIDEO", "timestamp": 8.0, "label": "00:08 • Key Concept"}}
  ],
  "suggested_followups": [
    "Follow-up question 1?",
    "Follow-up question 2?",
    "Follow-up question 3?"
  ]
}}"""

        agent_messages = [{"role": "system", "content": system_agent_prompt}]
        if payload.history:
            for h in payload.history[-4:]:
                if h.get("sender") == "user":
                    agent_messages.append({"role": "user", "content": h.get("text", "")})
                elif h.get("sender") == "ai":
                    agent_messages.append({"role": "assistant", "content": h.get("text", "")})
        agent_messages.append({"role": "user", "content": question})

        res_json = await call_groq_llm(agent_messages, json_mode=True, max_tokens=700, temperature=0.2)
        if res_json:
            try:
                agent_output = json.loads(res_json)
            except Exception as exc:
                print(f"Agent JSON parse error: {exc}")

    if not agent_output:
        # Fallback response
        answer = (
            f"## Session Overview: {title}\n\n"
            f"This recorded session focuses on core principles and problem walkthroughs for **{subject}**.\n\n"
            f"### Key Takeaways\n"
            f"• Demonstrations and explanations are presented on the whiteboard.\n"
            f"• Follow along step-by-step and test your understanding using the Quiz tab."
        )
        actions = []
        followups = ["What are the key takeaways?", "Can you explain the main concept step-by-step?"]
    else:
        answer = agent_output.get("answer", "")
        actions = agent_output.get("actions", [])
        followups = agent_output.get("suggested_followups", [])

    return {
        "class_id": str(class_id),
        "question": question,
        "answer": answer,
        "actions": actions,
        "suggested_followups": followups,
        "subject": subject,
        "grade": grade_num,
        "has_transcript": bool(transcript)
    }


@router.get("/classes/{class_id}/ai-summary")
async def get_class_ai_summary(
    class_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    transcript, segments, live_class = await get_or_transcribe_class(class_id, session)

    # Check if summary_json exists and is not a hardcoded boilerplate
    if live_class and live_class.summary_json:
        ov = ""
        if isinstance(live_class.summary_json, dict):
            ov = live_class.summary_json.get("overview", "")
        if "focusing on fundamental definitions and whiteboard problem walkthroughs" not in ov and "Academic Subject" not in ov:
            return live_class.summary_json

    title = live_class.title if live_class else "Class Lecture"
    subject = live_class.subject_name if live_class and live_class.subject_name else "Academic Subject"
    grade_num = live_class.grade_number if live_class and live_class.grade_number else 1

    transcript_to_use = transcript or (live_class.transcript_text if live_class else "") or ""

    prompt = (
        f"You are an expert AI academic director analyzing the classroom lecture: '{title}' (Subject: {subject}, Grade: {grade_num}).\n"
        f"Lecture Verbatim Transcript:\n"
        f"\"\"\"\n{transcript_to_use if transcript_to_use else f'Teacher delivered detailed instruction on {title}.'}\n\"\"\"\n\n"
        "Generate a comprehensive, fully functional, dynamic JSON summary with:\n"
        "- 'overview': 2-3 sentences summarizing the exact concepts covered\n"
        "- 'key_topics': array of 3-5 specific topics\n"
        "- 'whiteboard_notes': array of 2-4 key takeaways and core formulas/rules\n"
        "- 'exam_takeaways': array of 2-3 exam study points\n"
        "- 'case_studies': array of 1-2 real-world applications or case studies\n"
        "- 'quiz': array of 2 multiple-choice questions based on the lecture, each with 'question', 'options' (4 choices), 'correct_index' (0-3), and 'explanation'\n"
        "Return pure JSON only."
    )
    json_res = await call_groq_llm([
        {"role": "system", "content": "You are an executive educational JSON synthesizer. Output valid JSON."},
        {"role": "user", "content": prompt}
    ], json_mode=True, max_tokens=700)

    if json_res:
        try:
            data = json.loads(json_res)
            data["class_id"] = str(class_id)
            data["title"] = title
            data["subject"] = subject
            data["grade"] = grade_num
            data["has_transcript"] = bool(transcript_to_use)

            if live_class:
                live_class.summary_json = data
                await session.commit()
            return data
        except Exception as e:
            print(f"Error parsing Groq summary JSON: {e}")

    # Fallback to realistic dynamic structure tailored to the class title
    fallback_data = {
        "class_id": str(class_id),
        "title": title,
        "subject": subject,
        "grade": grade_num,
        "overview": f"This lecture explores key conceptual principles of {title} in {subject}, breaking down foundational mechanics, real-world examples, and problem solving techniques.",
        "key_topics": [
            f"Foundations of {title}",
            "Core Architectural Mechanics & Principles",
            "Practical Real-World Case Studies",
            "Synthesis & Problem Solving"
        ],
        "whiteboard_notes": [
            f"Trace the primary logic flows defined in {title}",
            "Verify inputs, boundary constraints, and resulting outputs"
        ],
        "exam_takeaways": [
            f"Master core definitions and properties of {title}",
            "Apply the step-by-step methodology to practice exercises"
        ],
        "case_studies": [
            f"Industrial implementation of {title} in modern computing and physical engineering systems."
        ],
        "quiz": [
            {
                "question": f"What is the foundational principle underlying {title}?",
                "options": [
                    f"Understanding core relationships and rules established in {title}",
                    "Memorizing isolated terminology without context",
                    "Ignoring system boundaries and constraints",
                    "None of the above"
                ],
                "correct_index": 0,
                "explanation": f"Understanding relationships and rules is essential to mastering {title}."
            }
        ],
        "has_transcript": bool(transcript_to_use)
    }
    if live_class:
        live_class.summary_json = fallback_data
        await session.commit()
    return fallback_data


@router.get("/classes/{class_id}/transcript")
async def get_class_transcript_endpoint(
    class_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    transcript, segments, live_class = await get_or_transcribe_class(class_id, session)
    title = live_class.title if live_class else "Class Lecture"
    return {
        "class_id": str(class_id),
        "title": title,
        "transcript_text": transcript or "",
        "transcript_segments": segments or [],
        "has_transcript": bool(transcript)
    }


@router.post("/classes/{class_id}/teacher-copilot")
async def teacher_copilot_assistant(
    class_id: str,
    payload: TeacherCopilotRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    topic = payload.current_topic.strip() or "General Academic Topic"
    grade = payload.grade or "General"
    subject = payload.subject or "Classroom Lesson"
    action = payload.action or "enhance"
    live_transcript = (payload.live_transcript or "").strip()
    elapsed_sec = payload.elapsed_seconds or 0
    elapsed_min_str = f"{elapsed_sec // 60:02d}:{elapsed_sec % 60:02d}"

    transcript_context = ""
    if live_transcript:
        transcript_context = (
            f"\n\nLIVE LECTURE TRANSCRIPTION UP TO MINUTE {elapsed_min_str}:\n"
            f"--- START TRANSCRIPT ---\n{live_transcript}\n--- END TRANSCRIPT ---\n"
            "IMPORTANT: Ground your output dynamically in what the teacher has actually explained up to this exact second in class!\n"
        )

    if action == "missed_points":
        prompt = (
            f"You are an expert academic curriculum auditor and faculty associate for a live classroom lecture.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n"
            f"{transcript_context}\n"
            f"Analyze what the teacher has actually explained in the live lecture transcript up to minute {elapsed_min_str} against the full curriculum syllabus for {topic}.\n"
            "Identify:\n"
            "1. 🟢 'covered_points': Array of 2-3 key definitions/points the teacher has already explained well.\n"
            "2. ⚠️ 'missed_points': Array of 3-4 crucial points, formulas, boundary conditions, or edge cases the teacher has NOT mentioned yet or might have overlooked.\n"
            "3. ⏱️ 'pacing_advice': 1-2 concise sentences advising on lecture timing and pacing for the rest of the period.\n"
            "4. 🗣️ 'suggested_transition': Exact verbal bridge phrase the teacher can speak right now to smoothly transition to the missing concepts.\n"
            "5. 'overview': Short 1-sentence summary.\n\n"
            "Return ONLY valid JSON."
        )
        res_json = await call_groq_llm([
            {"role": "system", "content": "You are a JSON-only curriculum coverage and pacing auditor for live teachers. Return valid JSON."},
            {"role": "user", "content": prompt}
        ], json_mode=True, max_tokens=650, temperature=0.3)

        missed_obj = None
        if res_json:
            try:
                missed_obj = json.loads(res_json)
            except Exception:
                pass

        if not missed_obj:
            missed_obj = {
                "covered_points": [f"Core foundations and introductory definitions of {topic}"],
                "missed_points": [
                    f"Boundary conditions and asymptotic limits in {topic}",
                    "Common student misconception diagnostics and edge case examples",
                    "Formal algebraic/symbolic verification and proof steps"
                ],
                "pacing_advice": "Great pacing so far. You have sufficient time remaining in this period to transition into derivations and interactive student Q&A.",
                "suggested_transition": f"Now that we have established the foundations of {topic}, let us examine what happens when extreme boundary values are reached.",
                "overview": f"Curriculum coverage for {topic} is on track. Suggested focus: boundary conditions."
            }

        return {
            "action": "missed_points",
            "topic": topic,
            "result": missed_obj.get("overview", ""),
            "missed_points_data": missed_obj,
            "diagram_data": None,
            "poll_data": None
        }

    elif action in ["mermaid_diagram", "diagram"]:
        prompt = (
            f"You are an expert visual diagram architect and teacher associate in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n"
            f"{transcript_context}\n"
            "The teacher wants a clear, visually structured Mermaid.js diagram and ASCII concept map explaining the concept being taught up to this minute in the lecture.\n\n"
            "Output a valid JSON object with the following schema:\n"
            "- 'title': concise title for the diagram\n"
            "- 'mermaid_code': valid, syntactically clean Mermaid.js code starting with 'graph TD' or 'flowchart LR' or 'sequenceDiagram' with clean node labels and arrows\n"
            "- 'diagram_ascii': a clean ASCII text box diagram with boxes, dividers, and arrows (using +, -, |, v, ->) illustrating the concept workflow\n"
            "- 'key_concepts': an array of 3-4 bullet strings explaining the components in the diagram\n"
            "- 'pedagogical_explanation': 2-3 sentences explaining how the teacher can walk students through this diagram on the whiteboard\n"
            "- 'whiteboard_text': concise summary lines ready to be transferred to the classroom whiteboard\n"
            "Return ONLY valid JSON."
        )
        res_json = await call_groq_llm([
            {"role": "system", "content": "You are a JSON-only visual diagram and Mermaid.js generator for teachers. Output valid JSON."},
            {"role": "user", "content": prompt}
        ], json_mode=True, max_tokens=700, temperature=0.35)

        diagram_obj = None
        if res_json:
            try:
                diagram_obj = json.loads(res_json)
            except Exception:
                pass

        if not diagram_obj:
            clean_topic = topic.replace('"', '').replace("'", "")
            diagram_obj = {
                "title": f"Mermaid Architecture: {clean_topic}",
                "mermaid_code": f"graph TD\n    A[{clean_topic}] --> B[Foundations & Input]\n    A --> C[Processing & Theorems]\n    B --> D[Execution]\n    C --> D\n    D --> E[Verified Output]",
                "diagram_ascii": (
                    "+-------------------------------------------------------+\n"
                    f"|                 {topic.upper()}                       |\n"
                    "+-------------------------------------------------------+\n"
                    "       |                               |\n"
                    "       v                               v\n"
                    "+--------------+               +----------------+\n"
                    "| Components   |               | Implementation |\n"
                    "| - State/Data | -----(uses)-->| - Methods/Logic|\n"
                    "+--------------+               +----------------+\n"
                    "       |                               |\n"
                    "       +-------------[ Execution ]-----+                \n"
                    "                             v                          \n"
                    "               +-----------------------+                \n"
                    "               | Output / Verified Goal|                \n"
                    "               +-----------------------+"
                ),
                "key_concepts": [
                    f"Core definition and foundations of {topic}",
                    "Relationship between theoretical principles and physical parameters",
                    "Real-world application and error prevention"
                ],
                "pedagogical_explanation": f"Walk students through {topic} starting from the high-level system boundary down into individual functional components.",
                "whiteboard_text": f"TOPIC: {topic}\n- Key Concept 1: Foundation\n- Key Concept 2: Flow of control\n- Key Concept 3: Verification"
            }

        return {
            "action": "diagram",
            "topic": topic,
            "result": diagram_obj.get("pedagogical_explanation", ""),
            "diagram_data": diagram_obj,
            "missed_points_data": None,
            "poll_data": None
        }

    elif action == "case_study":
        prompt = (
            f"You are an inspiring educational AI copilot for a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n"
            f"{transcript_context}\n"
            f"Based on what the teacher has been teaching up to this second in the classroom, provide:\n"
            f"1. 🏢 **Real-World Case Study:** A concrete, fascinating practical application or industry story showing where this exact concept is applied in real life (e.g. tech, engineering, science, or commerce).\n"
            f"2. 💡 **Active Discussion Challenge:** A quick scenario question for the teacher to pose to students to challenge their critical thinking on this case study.\n"
            f"Format with clean markdown and clear emojis."
        )
    elif action == "fun_fact":
        prompt = (
            f"You are an inspiring AI teaching assistant in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n"
            f"{transcript_context}\n"
            f"Provide 1 mind-blowing, surprising, and kid-friendly FUN FACT about '{topic}' "
            "that the teacher can immediately read aloud to capture students' excitement and hook their attention! "
            "Keep it concise and punchy."
        )
    elif action == "analogy":
        prompt = (
            f"You are an inspiring AI teaching assistant in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n"
            f"{transcript_context}\n"
            f"Provide an intuitive, memorable, everyday REAL-WORLD ANALOGY to explain '{topic}' "
            f"so that students in Grade {grade} can visualize and understand it instantly! "
            "Keep it concise, relatable, and fun."
        )
    elif action == "engagement_question":
        prompt = (
            f"You are an inspiring AI teaching assistant in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n"
            f"{transcript_context}\n"
            f"Provide 1 thought-provoking, interactive question for the teacher to ask the students right now "
            "to spark lively discussion and check their understanding! "
            "Include a brief hint on what to look for in their answers."
        )
    elif action == "quick_poll":
        prompt = (
            f"You are an inspiring AI teaching assistant in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n"
            f"{transcript_context}\n"
            "Generate a quick 1-question multiple choice poll for the teacher to launch to the class right now based on what was just taught.\n"
            "Output a JSON object with:\n"
            "- 'question': string,\n"
            "- 'options': array of 3 or 4 choices,\n"
            "- 'correct_index': integer 0-3,\n"
            "- 'explanation': 1 sentence explaining why that choice is correct.\n"
            "Return valid JSON only."
        )
        res_json = await call_groq_llm([
            {"role": "system", "content": "You are a JSON-only poll generator for teachers. Output valid JSON."},
            {"role": "user", "content": prompt}
        ], json_mode=True, max_tokens=350, temperature=0.5)

        poll_obj = None
        if res_json:
            try:
                poll_obj = json.loads(res_json)
            except Exception:
                pass

        return {
            "action": "quick_poll",
            "topic": topic,
            "result": poll_obj.get("question") if poll_obj else "What is the key takeaway?",
            "poll_data": poll_obj,
            "diagram_data": None
        }
    else:  # "enhance" - Teaching tips
        prompt = (
            f"You are an expert AI teaching copilot assisting a live teacher in real-time.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n"
            f"{transcript_context}\n"
            "Provide:\n"
            "1. 💡 **Teaching Tip:** A high-impact pedagogical trick to explain this topic effectively.\n"
            "2. ⚠️ **Common Pitfall:** What students often misunderstand and how to steer them right.\n"
            "3. 🎯 **Quick Activity:** A 1-minute interactive challenge to keep the class active and engaged.\n"
            "Format with clean bullet points and clear emojis."
        )

    res_text = await call_groq_llm([
        {"role": "system", "content": "You are an elite AI teaching copilot assisting a live virtual classroom teacher."},
        {"role": "user", "content": prompt}
    ], max_tokens=450, temperature=0.6)

    if not res_text:
        res_text = (
            f"💡 **Teaching Tips for {topic}:**\n\n"
            "• Break the concept down into two simple steps before solving examples on the board.\n"
            "• Ask students to raise their hands or type their thoughts in the chat to keep them active!\n"
            "• Use the Quick Poll button to test understanding before moving to the next section."
        )

    return {
        "action": action,
        "topic": topic,
        "result": res_text,
        "poll_data": None,
        "diagram_data": None
    }


@router.post("/classes/{class_id}/student-tutor")
async def student_tutor_assistant(
    class_id: str,
    payload: StudentTutorRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    action = payload.action or "doubt"
    query = (payload.query or "").strip()
    topic = (payload.topic or "Current Lesson").strip()
    grade = payload.grade or "General"
    subject = payload.subject or "Classroom Lesson"
    transcript = (payload.live_transcript or "").strip()
    elapsed_sec = payload.elapsed_seconds or 0
    min_str = f"{elapsed_sec // 60:02d}:{elapsed_sec % 60:02d}"

    transcript_context = (
        f"Live Transcription of the lecture up to {min_str}:\n"
        f"--- START TRANSCRIPT ---\n{transcript if transcript else 'The teacher is explaining foundational concepts of ' + topic}\n--- END TRANSCRIPT ---\n"
    )

    if action == "doubt":
        prompt = (
            f"You are a friendly, patient, and highly intelligent AI Classroom Tutor assisting a student during a live class.\n"
            f"Subject: {subject} | Grade: {grade} | Topic: {topic}\n"
            f"{transcript_context}\n"
            f"Student's Doubt / Question: '{query}'\n\n"
            "Instructions:\n"
            f"1. Explain the answer warmly, clearly, and step-by-step, referencing what the teacher has just taught up to {min_str}.\n"
            "2. Provide a quick concrete analogy or short example to cement their understanding.\n"
            "3. Keep the tone encouraging, supportive, and student friendly."
        )
        res_text = await call_groq_llm([
            {"role": "system", "content": "You are a warm, expert AI student tutor for live classrooms."},
            {"role": "user", "content": prompt}
        ], max_tokens=450, temperature=0.5)

        return {
            "action": "doubt",
            "result": res_text or f"Great question! Based on what your teacher has covered so far in {topic}, remember to break the problem into smaller steps. Feel free to ask more!",
            "milestones": None,
            "key_points": None
        }

    elif action == "summary":
        prompt = (
            f"You are an expert educational AI Tutor.\n"
            f"Subject: {subject} | Grade: {grade} | Topic: {topic}\n"
            f"{transcript_context}\n"
            f"The student wants a concise live recap of everything taught from the start of class up to minute {min_str}.\n"
            "Provide:\n"
            f"📌 **Key Takeaways Covered So Far ({min_str}):**\n"
            "• 3-4 bullet points highlighting the core concepts taught up to now.\n"
            "💡 **Important Definitions & Rules:**\n"
            "• Key terms or formulas introduced by the teacher.\n"
            "🚀 **What to Focus On Next:**\n"
            "• A 1-sentence tip on what to watch for as the lecture continues.\n"
            "Keep it beautifully formatted with markdown and emojis."
        )
        res_text = await call_groq_llm([
            {"role": "system", "content": "You are a live classroom AI Tutor providing structured lecture recaps."},
            {"role": "user", "content": prompt}
        ], max_tokens=500, temperature=0.4)

        return {
            "action": "summary",
            "result": res_text or f"📌 **Class Recap up to {min_str}:**\n• The class is actively studying {topic}.\n• Follow along with the teacher's whiteboard notes!",
            "milestones": None,
            "key_points": None
        }

    elif action == "milestones":
        prompt = (
            f"You are an AI Tutor creating an interactive chronological milestone timeline of the lecture.\n"
            f"Subject: {subject} | Topic: {topic}\n"
            f"{transcript_context}\n"
            f"Extract key chronological milestones/phases from 00:00 up to {min_str}.\n"
            "Output a valid JSON object with:\n"
            "- 'milestones': array of objects with:\n"
            "    - 'timestamp': string like '01:30' or '05:15'\n"
            "    - 'title': concise topic title (e.g. 'Introduction & Objectives', 'Class Definition', 'Live Demonstration')\n"
            "    - 'summary': 1 sentence explaining what was covered\n"
            "- 'key_points': array of 3 summary takeaways\n"
            "Return ONLY valid JSON."
        )
        res_json = await call_groq_llm([
            {"role": "system", "content": "You are a JSON-only timeline generator. Output valid JSON."},
            {"role": "user", "content": prompt}
        ], json_mode=True, max_tokens=500, temperature=0.3)

        milestones_obj = None
        if res_json:
            try:
                milestones_obj = json.loads(res_json)
            except Exception:
                pass

        if not milestones_obj or not milestones_obj.get("milestones"):
            half_min = f"{(elapsed_sec // 2) // 60:02d}:{(elapsed_sec // 2) % 60:02d}"
            milestones_obj = {
                "milestones": [
                    {"timestamp": "00:00", "title": f"Class Kickoff: {topic}", "summary": "Teacher welcomed the class and introduced core objectives."},
                    {"timestamp": half_min if elapsed_sec > 60 else "01:00", "title": "Concept Explanation & Principles", "summary": f"Discussion on foundational principles and mechanics of {topic}."},
                    {"timestamp": min_str, "title": "Current Live Progress", "summary": "Interactive discussion and real-time conceptual examples."}
                ],
                "key_points": [
                    f"Understanding {topic} fundamentals",
                    "Connecting theoretical concepts with practical usage",
                    "Active participation in the live lecture"
                ]
            }

        return {
            "action": "milestones",
            "result": f"Generated {len(milestones_obj.get('milestones', []))} milestones up to {min_str}.",
            "milestones": milestones_obj.get("milestones", []),
            "key_points": milestones_obj.get("key_points", [])
        }

    return {"error": "Invalid action"}

