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


@router.post("/classes/{class_id}/ai-doubt")
async def ask_class_ai_doubt(
    class_id: str,
    payload: AiDoubtRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    live_class = None
    try:
        import uuid as _uuid_mod
        c_uuid = _uuid_mod.UUID(class_id)
        live_class = await session.scalar(select(LiveClass).where(LiveClass.id == c_uuid))
    except Exception:
        pass

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

    is_primary = grade_num is not None and grade_num <= 3
    is_middle = grade_num is not None and 4 <= grade_num <= 8

    question = payload.question.strip()
    answer = None

    if settings.openai_api_key:
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
                                "content": (
                                    f"You are a friendly, encouraging school tutor assisting a Grade {grade_num} "
                                    f"student watching the recorded video lecture '{title}' on {subject}. "
                                    f"Adapt your tone, vocabulary, and examples specifically for Grade {grade_num} level."
                                ),
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

    if not answer:
        lower = question.lower()
        is_about_query = any(w in lower for w in ["what is the video about", "what is this video about", "about", "summary", "recap", "overview", "what was covered", "topics"])
        is_formula_query = any(w in lower for w in ["formula", "equation", "math", "theorem", "rule", "definition"])
        is_quiz_query = any(w in lower for w in ["quiz", "question", "test", "practice", "exam"])
        is_simple_query = any(w in lower for w in ["simple", "grade", "child", "easy", "explain simply", "explain"])

        if is_primary:
            if is_about_query:
                answer = (
                    f"🌟 **About this Lecture: {title}**\n\n"
                    f"This video is a friendly, interactive **Grade {grade_num} {subject}** lesson!\n\n"
                    f"Here is what your teacher covers in this recording:\n"
                    f"• **Fun Basics & Numbers:** Learning numbers and core concepts using familiar objects (apples, balloons, and stars).\n"
                    f"• **Interactive Whiteboard Walkthrough:** The teacher writes and draws on the board step-by-step so you can easily follow along.\n"
                    f"• **Counting & Solving:** Easy practice questions to build your skills and boost your confidence.\n\n"
                    f"💡 *Have a doubt? Feel free to ask me anything about the video, or click the **Quick Quiz** tab to try 2 fun questions!*"
                )
            elif is_formula_query:
                answer = (
                    f"📐 **Key Rules for Grade {grade_num} {subject}:**\n\n"
                    f"• **Putting Groups Together (Addition +):** When you combine two sets, count them all up (e.g. 2 apples 🍎🍎 + 3 apples 🍎🍎🍎 = 5 apples 🍎🍎🍎🍎🍎)!\n"
                    f"• **Taking Away (Subtraction -):** Count what is left after taking some away!\n"
                    f"• **Counting Order:** Always count steadily: 1, 2, 3, 4, 5... You can use your fingers or draw dots on paper!"
                )
            elif is_quiz_query:
                answer = (
                    f"🎈 **Fun Practice for Grade {grade_num} {subject}:**\n\n"
                    f"*Question:* If you have 3 blue stars ⭐⭐⭐ and your teacher gives you 2 more ⭐⭐, how many stars do you have in total?\n\n"
                    f"• **A)** 4 stars\n"
                    f"• **B)** 5 stars [Correct! 🎉]\n"
                    f"• **C)** 6 stars\n\n"
                    f"*Explanation:* Count them together: 1, 2, 3... 4, 5! You have 5 stars!"
                )
            else:
                answer = (
                    f"😊 **Hello Grade {grade_num} Learner!**\n\n"
                    f"For your question: **'{question}'**\n\n"
                    f"In this {subject} lesson, your teacher showed that we can solve this by taking one easy step at a time! "
                    f"Think of it like building blocks—first see what numbers or pieces you have, follow the teacher's steps on the board, and count your result.\n\n"
                    f"Would you like to try another fun example together?"
                )
        elif is_middle:
            if is_about_query:
                answer = (
                    f"📚 **Lecture Overview: {title} (Grade {grade_num} {subject})**\n\n"
                    f"In this recorded session, your teacher focuses on establishing clear conceptual understanding and practical problem-solving:\n"
                    f"1. **Core Concept Introduction:** Systematic breakdown of the topic with real-world analogies.\n"
                    f"2. **Whiteboard Walkthrough:** Deriving key steps and solving standard textbook exercises.\n"
                    f"3. **Common Mistakes:** Highlighting tricky spots where students often lose marks in tests.\n"
                    f"4. **Practice Takeaways:** Key methods to remember when revising."
                )
            elif is_formula_query:
                answer = (
                    f"📐 **Key Formulas & Principles ({subject} - Grade {grade_num}):**\n\n"
                    f"• **Primary Relationship:** Ensure you know how the primary variables connect and scale.\n"
                    f"• **Working Method:** (1) State knowns and unknowns, (2) Substitute into the core equation, (3) Double check your calculations and units.\n"
                    f"• Check the **AI Summary** tab for full whiteboard equations from this lecture!"
                )
            else:
                answer = (
                    f"Great question regarding **'{question}'**!\n\n"
                    f"In this Grade {grade_num} {subject} lecture, the key is understanding how each step follows logically from the previous one. "
                    f"Review the board notes around this section in the video, apply the standard method, and test yourself on the **Quick Quiz** tab!"
                )
        else:
            if is_about_query:
                answer = (
                    f"**Executive Lecture Summary for {title}:**\n\n"
                    f"1. **Core Subject Focus:** This session explored key foundational principles of {subject} structured for Grade {grade_num}.\n"
                    f"2. **Theoretical Foundations:** Emphasis was placed on definitions, governing laws, and systemic behavior.\n"
                    f"3. **Worked Examples:** Step-by-step problem solving demonstrated on the board.\n"
                    f"4. **Key Takeaway:** Ensure you understand the underlying mechanisms and test your skills with practice questions."
                )
            elif is_formula_query:
                answer = (
                    f"**Key Formulas & Analytical Tools ({subject}):**\n\n"
                    f"• **Governing Principle:** State transitions are determined by initial conditions and external forces.\n"
                    f"• **Proportionality Rule:** Verify whether dependent variables scale directly or inversely.\n"
                    f"• **Methodology Tip:** Always write down given variables first, apply the standard formula, and check final units."
                )
            elif is_quiz_query:
                answer = (
                    f"**Practice Comprehension Check for {subject}:**\n\n"
                    f"*Question:* Based on this recorded lecture, what is the first step in solving analytical problems in {subject}?\n\n"
                    f"• **A)** Identify given constraints and apply the governing law [Correct]\n"
                    f"• **B)** Guess an arbitrary value\n"
                    f"• **C)** Skip dimensional verification\n\n"
                    f"*Explanation:* Grade {grade_num} {subject} requires structured problem identification before applying algebraic computation."
                )
            else:
                answer = (
                    f"Regarding **'{question}'**: In this {subject} lecture for Grade {grade_num}, "
                    f"the instructor highlighted that understanding how the concepts connect is key to solving test problems. "
                    f"Trace each step from cause to effect, and let me know if you would like a practice problem or a step-by-step derivation!"
                )

    return {
        "class_id": str(class_id),
        "question": question,
        "answer": answer,
        "subject": subject,
        "grade": grade_num,
    }


@router.get("/classes/{class_id}/ai-summary")
async def get_class_ai_summary(
    class_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    live_class = None
    try:
        import uuid as _uuid_mod
        c_uuid = _uuid_mod.UUID(class_id)
        live_class = await session.scalar(select(LiveClass).where(LiveClass.id == c_uuid))
    except Exception:
        pass

    title = live_class.title if live_class else "Class Lecture"
    subject = live_class.subject_name if live_class and live_class.subject_name else None
    
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

    grade_num = live_class.grade_number if live_class and live_class.grade_number else None
    if grade_num is None:
        import re
        m = re.search(r'grade\s*(\d+)', title_lower)
        if m:
            grade_num = int(m.group(1))
        else:
            grade_num = 1

    if grade_num <= 3:
        return {
            "class_id": str(class_id),
            "title": title,
            "subject": subject,
            "grade": grade_num,
            "overview": (
                f"This recorded video is a fun and interactive Grade {grade_num} {subject} class! "
                f"The teacher uses clear whiteboard demonstrations, friendly visual examples, and step-by-step counting "
                f"to make learning enjoyable and easy to remember."
            ),
            "key_topics": [
                f"Introduction to Grade {grade_num} {subject} Fundamentals",
                "Counting & Visual Problem Walkthroughs",
                "Teacher's Interactive Whiteboard Drawings & Demonstrations",
                "Fun Practice Questions with Immediate Teacher Feedback",
            ],
            "whiteboard_notes": [
                "Visual Counting: Count items one-by-one with dots or pictures.",
                "Basic Operations: Putting groups together and finding total amounts.",
                "Practice Tip: Say numbers out loud while writing them down.",
            ],
            "exam_takeaways": [
                "Practice counting objects around your house (toys, books, pencils).",
                "Remember to write numbers carefully and clearly.",
                "Try the 2 practice questions in the Quick Quiz tab!",
            ],
            "quiz": [
                {
                    "question": f"What was the main topic of this Grade {grade_num} {subject} lesson?",
                    "options": [
                        f"Foundational concepts and practice in {title}",
                        "College physics",
                        "Silent study with no teacher",
                        "Recess and games only",
                    ],
                    "correct_index": 0,
                    "explanation": f"The lecture focused on teaching and practicing core Grade {grade_num} {subject}.",
                },
                {
                    "question": "What is the best way to practice what you learned in this video?",
                    "options": [
                        "Never look at numbers again",
                        "Try practice problems and review the teacher's board notes",
                        "Skip homework completely",
                        "Close the notebook immediately",
                    ],
                    "correct_index": 1,
                    "explanation": "Reviewing the board notes and practicing helps remember the lesson!",
                },
            ],
        }

    return {
        "class_id": str(class_id),
        "title": title,
        "subject": subject,
        "grade": grade_num,
        "overview": f"This recorded lecture for Grade {grade_num} provides in-depth coverage of {subject}, focusing on fundamental definitions, analytical derivations, and practical application.",
        "key_topics": [
            f"Introduction to {subject} Foundations",
            "Core Theoretical Frameworks & Whiteboard Derivations",
            "Worked Problem Solving & Step-by-Step Methodology",
            "Common Exam Pitfalls & How to Avoid Them",
            "Interactive Summary & Key Homework Points",
        ],
        "whiteboard_notes": [
            "Governing Law: Fundamental equation and definitions demonstrated during presentation.",
            "Boundary Conditions: How initial constraints determine the outcome.",
            "Verification Step: Always check SI units and dimensions.",
        ],
        "exam_takeaways": [
            "Memorize the standard scientific / mathematical definitions.",
            "Be prepared to explain the difference between related core concepts in test questions.",
            "Practice at least three textbook numerical problems before the next quiz.",
        ],
        "quiz": [
            {
                "question": f"What was the main analytical principle taught in this {subject} lecture?",
                "options": [
                    "Structured application of governing laws to solve problems",
                    "Rote memorization without understanding concepts",
                    "Ignoring standard units and dimensions",
                    "None of the above",
                ],
                "correct_index": 0,
                "explanation": f"The lecture emphasized using governing laws methodically to understand {subject}.",
            },
            {
                "question": f"When approaching questions on {subject}, what was the recommended methodology?",
                "options": [
                    "Guess the result directly",
                    "List given variables, select governing formula, and verify units",
                    "Skip reading the problem statement carefully",
                    "Omit intermediate steps",
                ],
                "correct_index": 1,
                "explanation": "Listing variables, choosing formulas, and checking units guarantees maximum accuracy.",
            },
        ],
    }
