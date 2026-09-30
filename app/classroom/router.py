from pydantic import BaseModel
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


class AiDoubtRequest(BaseModel):
    question: str
    timestamp_seconds: Optional[float] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    grade: Optional[Any] = None


class TeacherCopilotRequest(BaseModel):
    current_topic: str
    grade: Optional[Any] = None
    subject: Optional[str] = None
    action: Optional[str] = "enhance"  # enhance | fun_fact | analogy | quick_poll | engagement_question


async def transcribe_video_url_with_groq(media_url: str) -> Optional[str]:
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not api_key or not media_url:
        return None

    try:
        def _fetch_and_transcribe():
            import urllib.request
            import urllib.error
            import io
            import json

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
            add_field('response_format', 'json')

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
                return res.get('text', '').strip()

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _fetch_and_transcribe)
    except Exception as e:
        print(f"Whisper transcription error for {media_url[:60]}: {e}")
        return None


async def call_groq_llm(messages: List[Dict[str, str]], json_mode: bool = False, max_tokens: int = 650, temperature: float = 0.3) -> Optional[str]:
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return None

    try:
        def _call_chat():
            import urllib.request
            import urllib.error
            import json

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


async def get_or_transcribe_class(class_id_str: str, session: AsyncSession) -> tuple[Optional[str], Optional[LiveClass]]:
    live_class = None
    try:
        import uuid as _uuid_mod
        c_uuid = _uuid_mod.UUID(class_id_str)
        live_class = await session.scalar(select(LiveClass).where(LiveClass.id == c_uuid))
    except Exception:
        pass

    if not live_class:
        return None, None

    if live_class.transcript_text and live_class.transcript_text.strip():
        return live_class.transcript_text.strip(), live_class

    if live_class.recording_url:
        transcript = await transcribe_video_url_with_groq(live_class.recording_url)
        if transcript:
            live_class.transcript_text = transcript
            await session.commit()
            return transcript, live_class

    return None, live_class


@router.post("/classes/{class_id}/ai-doubt")
async def ask_class_ai_doubt(
    class_id: str,
    payload: AiDoubtRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    transcript, live_class = await get_or_transcribe_class(class_id, session)

    title = payload.title or (live_class.title if live_class else "Class Lecture")
    subject = payload.subject or (live_class.subject_name if live_class and live_class.subject_name else None)
    
    title_lower = title.lower()
    if not subject:
        if "math" in title_lower:
            subject = "Mathematics"
        elif any(k in title_lower for k in ["science", "physics", "chem", "bio"]):
            subject = "Science"
        elif any(k in title_lower for k in ["english", "grammar", "reading"]):
            subject = "English"
        elif any(k in title_lower for k in ["history", "social", "geography"]):
            subject = "Social Studies"
        elif any(k in title_lower for k in ["computer", "code", "python"]):
            subject = "Computer Science"
        else:
            subject = "Academic Lesson"

    grade_num = None
    if payload.grade is not None:
        try:
            import re
            m = re.search(r'\d+', str(payload.grade))
            if m:
                grade_num = int(m.group(0))
        except Exception:
            pass
    if grade_num is None and live_class and live_class.grade_number:
        grade_num = live_class.grade_number
    if grade_num is None:
        import re
        m = re.search(r'grade\s*(\d+)', title_lower)
        if m:
            grade_num = int(m.group(1))
        else:
            grade_num = 1

    question = payload.question.strip()
    answer = None

    # 1. If real transcript exists, ground the AI answer strictly in what was spoken in the video!
    if transcript:
        system_prompt = (
            f"You are an encouraging, world-class AI study companion assisting a student watching "
            f"the recorded lecture '{title}' ({subject}, Grade {grade_num}).\n\n"
            f"Here is the VERBATIM spoken transcript of what was actually said in this video recording:\n"
            f'\"\"\"{transcript}\"\"\"\n\n'
            f"RULES:\n"
            f"1. Base your answer strictly on the actual words and concepts spoken in the video transcript above.\n"
            f"2. If the user asks 'what is the video about' or asks about topics, summarize the real content from the transcript.\n"
            f"3. If the video discusses specific items (e.g. portal testing, AI agents, mathematics, etc.), refer directly to them.\n"
            f"4. Keep the tone helpful, encouraging, and clear."
        )
        answer = await call_groq_llm([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ])

    # 2. Fallback to OpenAI if configured and no transcript answer
    if not answer and settings.openai_api_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_model or "gpt-4o-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": f"You are a friendly AI tutor assisting a Grade {grade_num} student on '{title}' ({subject}).",
                            },
                            {"role": "user", "content": question},
                        ],
                        "temperature": 0.7,
                    },
                )
                if res.status_code == 200:
                    answer = res.json()["choices"][0]["message"]["content"]
        except Exception:
            pass

    # 3. Intelligent synthesizer fallback if network or transcript unavailable
    if not answer:
        lower = question.lower()
        is_about_query = any(w in lower for w in ["what is the video about", "what is this video about", "about", "summary", "recap", "overview", "what was covered", "topics"])
        is_primary = grade_num <= 3
        if is_about_query:
            answer = (
                f"🌟 **Lecture Overview: {title}**\n\n"
                f"This video is an educational session for **Grade {grade_num} {subject}**.\n"
                f"The instructor explains core concepts, demonstrates key problems on the whiteboard, "
                f"and reviews practical takeaways for students."
            )
        else:
            answer = (
                f"Regarding **'{question}'**: In this {subject} lesson for Grade {grade_num}, "
                f"the instructor highlighted that understanding how the concepts connect step-by-step is key to solving problems. "
                f"Trace each step from cause to effect, and check the **AI Summary** tab for notes!"
            )

    return {
        "class_id": str(class_id),
        "question": question,
        "answer": answer,
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
    transcript, live_class = await get_or_transcribe_class(class_id, session)

    # If cached summary exists in DB, return it immediately
    if live_class and live_class.summary_json:
        return live_class.summary_json

    title = live_class.title if live_class else "Class Lecture"
    subject = live_class.subject_name if live_class and live_class.subject_name else "Academic Subject"
    grade_num = live_class.grade_number if live_class and live_class.grade_number else 1

    # If transcript exists, generate real summary with Groq LLM
    if transcript:
        prompt = (
            f"Based on this verbatim video transcript from the lecture '{title}':\n"
            f'\"\"\"{transcript}\"\"\"\n\n'
            f"Generate a JSON object with:\n"
            f"- 'overview': 2-3 sentences summarizing what was actually discussed in the video\n"
            f"- 'key_topics': array of 3-5 specific topics mentioned\n"
            f"- 'whiteboard_notes': array of 2-4 key takeaways/notes from the speaker\n"
            f"- 'exam_takeaways': array of 2-3 key takeaways\n"
            f"- 'quiz': array of 2 multiple-choice questions based directly on the video transcript, each with:\n"
            f"   'question': string,\n"
            f"   'options': array of 4 choices,\n"
            f"   'correct_index': integer 0-3,\n"
            f"   'explanation': string\n"
            f"Return pure JSON only."
        )
        json_res = await call_groq_llm([
            {"role": "system", "content": "You are a JSON-only educational synthesizer. Output valid JSON."},
            {"role": "user", "content": prompt}
        ], json_mode=True, max_tokens=700)

        if json_res:
            try:
                import json as _json
                data = _json.loads(json_res)
                data["class_id"] = str(class_id)
                data["title"] = title
                data["subject"] = subject
                data["grade"] = grade_num
                data["has_transcript"] = True
                
                # Save to database cache
                if live_class:
                    live_class.summary_json = data
                    await session.commit()
                return data
            except Exception as e:
                print(f"Error parsing Groq summary JSON: {e}")

    # Fallback structured summary
    return {
        "class_id": str(class_id),
        "title": title,
        "subject": subject,
        "grade": grade_num,
        "overview": f"This recorded lecture for Grade {grade_num} covers {subject}, focusing on fundamental definitions and whiteboard problem walkthroughs.",
        "key_topics": [
            f"Introduction to {subject} Concepts",
            "Whiteboard Problem Solving",
            "Interactive Student Discussion",
            "Key Exam Takeaways"
        ],
        "whiteboard_notes": [
            "Follow the step-by-step method shown on the board",
            "Check initial conditions and final units"
        ],
        "exam_takeaways": [
            "Review key definitions from this session",
            "Practice the worked examples before class assessment"
        ],
        "quiz": [
            {
                "question": f"What was the main topic discussed in this {subject} lecture?",
                "options": [
                    f"Core principles demonstrated in {title}",
                    "Unrelated trivia",
                    "Administrative announcements only",
                    "None of the above"
                ],
                "correct_index": 0,
                "explanation": f"The lecture focused on {title}."
            },
            {
                "question": "What is the best way to review this recorded lesson?",
                "options": [
                    "Practice the worked problems and check board notes",
                    "Never look at the notes again",
                    "Skip homework exercises",
                    "Ignore the teacher's steps"
                ],
                "correct_index": 0,
                "explanation": "Active problem review reinforces comprehension."
            }
        ],
        "has_transcript": False
    }


@router.get("/classes/{class_id}/transcript")
async def get_class_transcript_endpoint(
    class_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    transcript, live_class = await get_or_transcribe_class(class_id, session)
    title = live_class.title if live_class else "Class Lecture"
    return {
        "class_id": str(class_id),
        "title": title,
        "transcript_text": transcript or "",
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

    if action == "fun_fact":
        prompt = (
            f"You are an inspiring AI teaching assistant in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n\n"
            f"Provide 1 mind-blowing, surprising, and kid-friendly FUN FACT about '{topic}' "
            f"that the teacher can immediately read aloud to capture students' excitement and hook their attention! "
            f"Keep it under 3 sentences."
        )
    elif action == "analogy":
        prompt = (
            f"You are an inspiring AI teaching assistant in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n\n"
            f"Provide an intuitive, memorable, everyday REAL-WORLD ANALOGY to explain '{topic}' "
            f"so that students in Grade {grade} can visualize and understand it instantly! "
            f"Keep it concise, relatable, and fun."
        )
    elif action == "engagement_question":
        prompt = (
            f"You are an inspiring AI teaching assistant in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n\n"
            f"Provide 1 thought-provoking, interactive question for the teacher to ask the students right now "
            f"to spark lively discussion and check their understanding! "
            f"Include a brief hint on what to look for in their answers."
        )
    elif action == "quick_poll":
        prompt = (
            f"You are an inspiring AI teaching assistant in a live virtual classroom.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n\n"
            f"Generate a quick 1-question multiple choice poll for the teacher to launch to the class right now.\n"
            f"Output a JSON object with:\n"
            f"- 'question': string,\n"
            f"- 'options': array of 3 or 4 choices,\n"
            f"- 'correct_index': integer 0-3,\n"
            f"- 'explanation': 1 sentence explaining why that choice is correct.\n"
            f"Return valid JSON only."
        )
        res_json = await call_groq_llm([
            {"role": "system", "content": "You are a JSON-only poll generator for teachers. Output valid JSON."},
            {"role": "user", "content": prompt}
        ], json_mode=True, max_tokens=350, temperature=0.5)

        poll_obj = None
        if res_json:
            try:
                import json as _json
                poll_obj = _json.loads(res_json)
            except Exception:
                pass

        return {
            "action": "quick_poll",
            "topic": topic,
            "result": poll_obj.get("question") if poll_obj else "What is the key takeaway?",
            "poll_data": poll_obj
        }
    else:  # "enhance" - Teaching tips
        prompt = (
            f"You are an expert AI teaching copilot assisting a live teacher in real-time.\n"
            f"Subject: {subject} | Grade: {grade} | Current Topic: {topic}\n\n"
            f"Provide:\n"
            f"1. 💡 **Teaching Tip:** A high-impact pedagogical trick to explain this topic effectively.\n"
            f"2. ⚠️ **Common Pitfall:** What students often misunderstand and how to steer them right.\n"
            f"3. 🎯 **Quick Activity:** A 1-minute interactive challenge to keep the class active and engaged.\n"
            f"Format with clean bullet points and clear emojis."
        )

    res_text = await call_groq_llm([
        {"role": "system", "content": "You are an elite AI teaching copilot assisting a live virtual classroom teacher."},
        {"role": "user", "content": prompt}
    ], max_tokens=450, temperature=0.6)

    if not res_text:
        res_text = (
            f"💡 **Teaching Tips for {topic}:**\n\n"
            f"• Break the concept down into two simple steps before solving examples on the board.\n"
            f"• Ask students to raise their hands or type their thoughts in the chat to keep them active!\n"
            f"• Use the Quick Poll button to test understanding before moving to the next section."
        )

    return {
        "action": action,
        "topic": topic,
        "result": res_text,
        "poll_data": None
    }
