import React, { useState, useEffect, useRef } from 'react'
import type { 
  User, 
  SchoolLiveClass, 
  TeacherTimetableSlot 
} from '../lib/api'
import { 
  getSchoolLiveClasses, 
  getTeacherTimetableSlots, 
  createSchoolLiveClass, 
  updateLiveClassStatus 
} from '../lib/api'
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  PenTool, 
  Eraser, 
  Trash2, 
  Download, 
  Hand, 
  MessageSquare, 
  Users, 
  BarChart2, 
  Play, 
  Plus, 
  X, 
  Send, 
  ShieldCheck, 
  GraduationCap,
  BookOpen
} from 'lucide-react'

type ClassroomPageProps = {
  user: User
}

interface ChatMessage {
  id: string
  sender: string
  role: string
  text: string
  timestamp: string
}

interface PollData {
  id: string
  question: string
  options: { text: string; votes: number }[]
  totalVotes: number
  isActive: boolean
}

export const ClassroomPage: React.FC<ClassroomPageProps> = ({ user }) => {
  const [classes, setClasses] = useState<SchoolLiveClass[]>([])
  const [teacherSlots, setTeacherSlots] = useState<TeacherTimetableSlot[]>([])
  const [loading, setLoading] = useState(true)

  // Scheduling Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0)
  const [customTitle, setCustomTitle] = useState('')
  const [instantLaunch, setInstantLaunch] = useState(true)
  const [submittingSchedule, setSubmittingSchedule] = useState(false)

  // Active Video Call Room State
  const [activeCallRoom, setActiveCallRoom] = useState<SchoolLiveClass | null>(null)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isHandRaised, setIsHandRaised] = useState(false)
  
  // Classroom Views: 'gallery' | 'spotlight' | 'whiteboard'
  const [callView, setCallView] = useState<'gallery' | 'spotlight' | 'whiteboard'>('gallery')
  const [activeSideDrawer, setActiveSideDrawer] = useState<'chat' | 'participants' | 'polls' | null>(null)

  // Media Stream references
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  // Whiteboard Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'eraser' | 'line' | 'rect' | 'circle'>('pen')
  const [whiteboardColor, setWhiteboardColor] = useState('#38bdf8')
  const [whiteboardWidth, setWhiteboardWidth] = useState(3)

  // Floating Emoji Reactions State
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; left: number }[]>([])

  // Live Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'System', role: 'system', text: 'Welcome to Zoom LMS High-Definition Live Classroom!', timestamp: '10:00 AM' }
  ])
  const [newChatText, setNewChatText] = useState('')

  // Live Poll State
  const [activePoll, setActivePoll] = useState<PollData>({
    id: 'poll-1',
    question: 'How clear is the current concept of rational fractions?',
    options: [
      { text: 'Completely Understood 👍', votes: 8 },
      { text: 'Need One More Example 🤔', votes: 4 },
      { text: 'Please Repeat From Start ✋', votes: 1 }
    ],
    totalVotes: 13,
    isActive: true
  })
  const [hasVoted, setHasVoted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  const role = user.role || 'student'
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isStudent = role === 'student'

  const userGradeMatch = user.email.match(/class(\\d+)/i) || user.display_name?.match(/Class\\s*(\\d+)/i)
  const studentGradeNum = userGradeMatch ? parseInt(userGradeMatch[1], 10) : 9

  useEffect(() => {
    loadClassroomData()
  }, [user.email, user.role])

  // Call timer effect
  useEffect(() => {
    let timer: any
    if (activeCallRoom) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      setCallDuration(0)
    }
    return () => clearInterval(timer)
  }, [activeCallRoom])

  const loadClassroomData = async () => {
    try {
      setLoading(true)
      const classesList = await getSchoolLiveClasses()
      setClasses(classesList || [])

      if (isTeacher || isAdmin) {
        const slots = await getTeacherTimetableSlots()
        setTeacherSlots(slots || [])
      }
    } catch (err) {
      console.error('Failed to load classroom data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Video & Audio Media Stream Initializers ──────────────────────────────────
  const startCameraStream = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        })
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
      }
    } catch (err) {
      console.warn('Camera/mic access skipped (fallback to simulated avatar video):', err)
    }
  }

  const stopCameraStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }
  }

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
    setIsMicOn(!isMicOn)
  }

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
      }
    }
    setIsCameraOn(!isCameraOn)
  }

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
          screenStreamRef.current = screenStream
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = screenStream
          }
          screenStream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false)
          }
          setIsScreenSharing(true)
          setCallView('spotlight')
        }
      } catch (err) {
        console.warn('Screen share cancelled or not supported:', err)
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop())
        screenStreamRef.current = null
      }
      setIsScreenSharing(false)
      setCallView('gallery')
    }
  }

  // ── Enter and Leave Meeting Handlers ─────────────────────────────────────────
  const handleJoinClass = async (liveClass: SchoolLiveClass) => {
    setActiveCallRoom(liveClass)
    await startCameraStream()
    if (liveClass.status === 'scheduled' && (isTeacher || isAdmin)) {
      try {
        await updateLiveClassStatus(liveClass.id, 'live')
        setClasses(prev => prev.map(c => c.id === liveClass.id ? { ...c, status: 'live' } : c))
      } catch (e) {
        console.error(e)
      }
    }
  }

  const handleLeaveClass = async () => {
    stopCameraStream()
    setIsScreenSharing(false)
    setActiveCallRoom(null)
  }

  const handleEndClassAsHost = async () => {
    if (!activeCallRoom) return
    if (confirm('End this live class for all attendees?')) {
      try {
        await updateLiveClassStatus(activeCallRoom.id, 'ended')
        setClasses(prev => prev.map(c => c.id === activeCallRoom.id ? { ...c, status: 'ended' } : c))
      } catch (e) {
        console.error(e)
      }
      handleLeaveClass()
    }
  }

  // ── Schedule or Start Instant Live Class ────────────────────────────────────
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (teacherSlots.length === 0) {
      alert('No timetable slots available to schedule.')
      return
    }
    const chosenSlot = teacherSlots[selectedSlotIndex] || teacherSlots[0]
    try {
      setSubmittingSchedule(true)
      const now = new Date()
      const end = new Date(now.getTime() + 50 * 60 * 1000)

      const payload = {
        title: customTitle || `${chosenSlot.grade_name} — ${chosenSlot.subject_name} Live Lecture (Period ${chosenSlot.period_number})`,
        starts_at: now.toISOString(),
        ends_at: end.toISOString(),
        grade_number: chosenSlot.grade_number,
        section_name: chosenSlot.section_name,
        subject_code: chosenSlot.subject_code,
        subject_name: chosenSlot.subject_name,
        period_number: chosenSlot.period_number,
        room_number: chosenSlot.room_or_venue,
        status: instantLaunch ? 'live' : 'scheduled'
      }

      const created = await createSchoolLiveClass(payload)
      setClasses([created, ...classes])
      setShowScheduleModal(false)
      setCustomTitle('')

      if (instantLaunch) {
        await handleJoinClass(created)
      }
    } catch (err: any) {
      alert('Failed to schedule class: ' + err.message)
    } finally {
      setSubmittingSchedule(false)
    }
  }

  // ── Floating Reactions ───────────────────────────────────────────────────────
  const triggerReaction = (emoji: string) => {
    const id = Date.now() + Math.random()
    const left = Math.floor(Math.random() * 80) + 10
    setFloatingReactions(prev => [...prev, { id, emoji, left }])
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id))
    }, 2800)
  }

  // ── Live In-Call Chat ────────────────────────────────────────────────────────
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatText.trim()) return
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: user.display_name || (isTeacher ? 'Dr. Sarah Connor' : 'Student'),
      role: user.role || 'student',
      text: newChatText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setChatMessages(prev => [...prev, msg])
    setNewChatText('')
  }

  // ── Live Poll Voting ─────────────────────────────────────────────────────────
  const handleVote = (optionIndex: number) => {
    if (hasVoted) return
    setActivePoll(prev => {
      const updated = { ...prev }
      updated.options[optionIndex].votes += 1
      updated.totalVotes += 1
      return updated
    })
    setHasVoted(true)
    triggerReaction('👍')
  }

  // ── Interactive Collaborative Whiteboard Drawing ────────────────────────────
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setIsDrawing(true)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = whiteboardTool === 'eraser' ? '#0f172a' : whiteboardColor
    ctx.lineWidth = whiteboardTool === 'eraser' ? 24 : whiteboardWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (whiteboardTool === 'pen' || whiteboardTool === 'eraser') {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearWhiteboard = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }

  const downloadWhiteboard = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `whiteboard_notes_${activeCallRoom?.title || 'session'}.png`
    a.click()
  }

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const secs = (totalSeconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  // ── RENDER 1: FULL-SCREEN IN-CALL VIDEO ROOM (Zoom / Teams / Court Tantra) ───
  if (activeCallRoom) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden text-slate-100 select-none animate-in fade-in duration-300">
        {/* Floating Animated Reaction Emojis */}
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
          {floatingReactions.map((r) => (
            <div
              key={r.id}
              className="absolute bottom-20 text-4xl animate-bounce transition-all duration-1000 ease-out"
              style={{
                left: `${r.left}%`,
                transform: 'translateY(-200px) scale(1.4)',
                opacity: 0.95
              }}
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* Top Header Bar */}
        <header className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              REC {formatTimer(callDuration)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {activeCallRoom.title}
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">
                  {activeCallRoom.subject_code || 'MATH'}
                </span>
              </h2>
              <div className="text-[11px] text-slate-400">
                Host: <strong className="text-slate-200">{activeCallRoom.teacher_name || 'Dr. Sarah Connor'}</strong> &bull; {activeCallRoom.room_number || 'Room 701'}
              </div>
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setCallView('gallery')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                callView === 'gallery' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gallery View
            </button>
            <button
              onClick={() => setCallView('spotlight')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                callView === 'spotlight' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              Speaker Spotlight
            </button>
            <button
              onClick={() => setCallView('whiteboard')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                callView === 'whiteboard' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Whiteboard
            </button>
          </div>

          {/* Host Controls */}
          <div className="flex items-center gap-3">
            {(isTeacher || isAdmin) && (
              <button
                onClick={handleEndClassAsHost}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition-all shadow-md shadow-rose-600/30"
              >
                End Class for All
              </button>
            )}
            <button
              onClick={handleLeaveClass}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
            >
              Leave Room
            </button>
          </div>
        </header>

        {/* Main Stage & Interactive Workspaces */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 p-4 flex flex-col justify-between overflow-hidden relative">
            {/* Screen Sharing Alert Bar */}
            {isScreenSharing && (
              <div className="px-4 py-2 mb-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>You are actively broadcasting your screen to all students.</span>
                </div>
                <button
                  onClick={toggleScreenShare}
                  className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold border border-rose-500/30"
                >
                  Stop Share
                </button>
              </div>
            )}

            {/* VIEW MODE A: INTERACTIVE COLLABORATIVE WHITEBOARD */}
            {callView === 'whiteboard' ? (
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col gap-3 shadow-2xl relative">
                {/* Whiteboard Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWhiteboardTool('pen')}
                      className={`p-2 rounded-xl transition-all ${
                        whiteboardTool === 'pen' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                      title="Pen Tool"
                    >
                      <PenTool className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setWhiteboardTool('eraser')}
                      className={`p-2 rounded-xl transition-all ${
                        whiteboardTool === 'eraser' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                      title="Eraser"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>

                    <div className="h-6 w-px bg-slate-800 mx-1" />

                    {/* Color Palette */}
                    <div className="flex items-center gap-1.5">
                      {['#38bdf8', '#facc15', '#f43f5e', '#10b981', '#a855f7', '#ffffff'].map((c) => (
                        <button
                          key={c}
                          onClick={() => { setWhiteboardColor(c); setWhiteboardTool('pen'); }}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            whiteboardColor === c ? 'scale-110 border-white' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>

                    <div className="h-6 w-px bg-slate-800 mx-1" />

                    {/* Stroke Width */}
                    <input
                      type="range"
                      min={2}
                      max={18}
                      value={whiteboardWidth}
                      onChange={(e) => setWhiteboardWidth(parseInt(e.target.value))}
                      className="w-20 accent-cyan-400"
                      title="Brush Stroke Width"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearWhiteboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      Clear
                    </button>
                    <button
                      onClick={downloadWhiteboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Save Canvas
                    </button>
                  </div>
                </div>

                {/* Whiteboard Canvas */}
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={1200}
                    height={700}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="w-full h-full cursor-crosshair touch-none"
                  />
                  <div className="absolute bottom-3 left-4 text-[11px] text-slate-500 pointer-events-none">
                    Interactive Stylus/Touch Whiteboard &bull; Real-time Drawing Board
                  </div>
                </div>
              </div>
            ) : callView === 'spotlight' || isScreenSharing ? (
              /* VIEW MODE B: SPOTLIGHT / SCREEN SHARE */
              <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-2xl flex items-center justify-center">
                  {isScreenSharing ? (
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 via-indigo-950/30 to-slate-900 relative">
                      <div className="w-28 h-28 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-4xl font-extrabold text-cyan-300 shadow-2xl shadow-cyan-500/30 animate-pulse">
                        {activeCallRoom.teacher_name?.charAt(0) || 'T'}
                      </div>
                      <h3 className="text-xl font-black text-white mt-4">{activeCallRoom.teacher_name}</h3>
                      <p className="text-xs text-slate-400 mt-1">Speaking &bull; Primary Instructor Stage</p>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 px-3.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 flex items-center gap-2 text-xs font-bold text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isScreenSharing ? 'Host Screen Broadcast' : `${activeCallRoom.teacher_name} (Spotlight)`}
                  </div>
                </div>

                {/* Side participant filmstrip */}
                <div className="w-full md:w-64 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto shrink-0">
                  <div className="h-36 rounded-2xl bg-slate-900 border border-slate-800 p-3 relative overflow-hidden flex flex-col justify-between">
                    <div className="w-full h-full flex items-center justify-center">
                      <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover rounded-xl ${isCameraOn ? 'block' : 'hidden'}`} />
                      {!isCameraOn && (
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
                          {user.display_name?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 text-[10px] font-bold text-white">
                      You {isMicOn ? '🎙️' : '🔇'}
                    </div>
                  </div>

                  {/* Student attendee avatars */}
                  {[
                    { name: 'Aarav Patel', role: 'Student', mic: false, avatar: 'A' },
                    { name: 'Diya Sharma', role: 'Student', mic: true, avatar: 'D' },
                    { name: 'Ishaan Verma', role: 'Student', mic: false, avatar: 'I' },
                    { name: 'Ananya Iyer', role: 'Student', mic: false, avatar: 'A' }
                  ].map((s, idx) => (
                    <div key={idx} className="h-28 rounded-2xl bg-slate-900 border border-slate-800 p-2.5 relative flex flex-col justify-between shrink-0">
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                          {s.avatar}
                        </div>
                      </div>
                      <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-semibold text-slate-300 flex items-center gap-1">
                        <span>{s.name}</span>
                        <span>{s.mic ? '🎙️' : '🔇'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* VIEW MODE C: GALLERY GRID VIEW (Zoom / Teams Style) */
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                {/* 1. Host / Teacher Card */}
                <div className="relative bg-slate-900 border-2 border-cyan-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4 group">
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-3xl font-extrabold text-slate-950 shadow-xl shadow-cyan-500/20 relative">
                      {activeCallRoom.teacher_name?.charAt(0) || 'T'}
                      <span className="absolute -top-2 -right-2 text-xl">👑</span>
                    </div>
                    <div className="mt-3 text-center">
                      <div className="text-sm font-extrabold text-white">{activeCallRoom.teacher_name || 'Dr. Sarah Connor'}</div>
                      <div className="text-[11px] text-cyan-400 font-semibold">Teacher & Host</div>
                    </div>
                  </div>

                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active Host 🎙️</span>
                  </div>
                </div>

                {/* 2. Current User (You) */}
                <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4">
                  <div className="w-full h-full flex items-center justify-center">
                    <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover rounded-2xl ${isCameraOn ? 'block' : 'hidden'}`} />
                    {!isCameraOn && (
                      <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-black text-slate-300">
                        {user.display_name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-200">
                    <span>{user.display_name || 'You'} (You)</span>
                    <span>{isMicOn ? '🎙️' : '🔇'}</span>
                    {isHandRaised && <span className="animate-bounce">✋</span>}
                  </div>
                </div>

                {/* 3. Class Attendees / Students */}
                {[
                  { name: 'Aarav Patel', role: 'Student', mic: false, avatar: 'A' },
                  { name: 'Diya Sharma', role: 'Student', mic: true, avatar: 'D' },
                  { name: 'Ishaan Verma', role: 'Student', mic: false, avatar: 'I' },
                  { name: 'Ananya Iyer', role: 'Student', mic: false, avatar: 'A' }
                ].map((st, i) => (
                  <div key={i} className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4">
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg">
                        {st.avatar}
                      </div>
                      <div className="text-xs font-bold text-slate-300 mt-2">{st.name}</div>
                    </div>

                    <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 flex items-center gap-1.5 text-xs text-slate-300">
                      <span>{st.name}</span>
                      <span>{st.mic ? '🎙️' : '🔇'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Meeting Controls Bar (Zoom/Teams dock) */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              {/* Audio/Video Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMic}
                  className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all ${
                    isMicOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                  title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isMicOn ? 'Mute' : 'Unmuted'}</span>
                </button>

                <button
                  onClick={toggleCamera}
                  className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all ${
                    isCameraOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                  title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                  {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isCameraOn ? 'Stop Video' : 'Start Video'}</span>
                </button>
              </div>

              {/* Collaborative Features (Screen Share, Whiteboard, Raise Hand) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all ${
                    isScreenSharing ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Share Screen (DisplayMedia)"
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden sm:inline">{isScreenSharing ? 'Sharing' : 'Share Screen'}</span>
                </button>

                <button
                  onClick={() => setCallView(callView === 'whiteboard' ? 'gallery' : 'whiteboard')}
                  className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all ${
                    callView === 'whiteboard' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Interactive Whiteboard"
                >
                  <PenTool className="w-4 h-4" />
                  <span className="hidden sm:inline">Whiteboard</span>
                </button>

                <button
                  onClick={() => {
                    setIsHandRaised(!isHandRaised)
                    if (!isHandRaised) triggerReaction('✋')
                  }}
                  className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all ${
                    isHandRaised ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Raise Hand"
                >
                  <Hand className="w-4 h-4" />
                  <span className="hidden sm:inline">{isHandRaised ? 'Hand Up' : 'Raise Hand'}</span>
                </button>
              </div>

              {/* Floating Reaction Emojis Bar */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl px-2 py-1.5">
                {[
                  { icon: '👍', name: 'Thumbs Up' },
                  { icon: '👎', name: 'Thumbs Down' },
                  { icon: '👏', name: 'Clap' },
                  { icon: '❤️', name: 'Love' },
                  { icon: '🔥', name: 'Fire' },
                  { icon: '💡', name: 'Idea' }
                ].map((em) => (
                  <button
                    key={em.icon}
                    onClick={() => triggerReaction(em.icon)}
                    className="p-1.5 hover:bg-slate-800 rounded-xl text-base transition-transform hover:scale-125"
                    title={em.name}
                  >
                    {em.icon}
                  </button>
                ))}
              </div>

              {/* Side Panels Toggle (Polls, Chat, Roster) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSideDrawer(activeSideDrawer === 'polls' ? null : 'polls')}
                  className={`p-3 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition-all relative ${
                    activeSideDrawer === 'polls' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Class Polls"
                >
                  <BarChart2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Polls</span>
                  {activePoll.isActive && !hasVoted && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 absolute top-2 right-2 animate-ping" />
                  )}
                </button>

                <button
                  onClick={() => setActiveSideDrawer(activeSideDrawer === 'chat' ? null : 'chat')}
                  className={`p-3 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition-all ${
                    activeSideDrawer === 'chat' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="In-call Chat"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Chat</span>
                </button>

                <button
                  onClick={() => setActiveSideDrawer(activeSideDrawer === 'participants' ? null : 'participants')}
                  className={`p-3 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition-all ${
                    activeSideDrawer === 'participants' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Participants Roster"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">5</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── SIDE DRAWER PANELS (Chat / Polls / Participants) ──────────────── */}
          {activeSideDrawer && (
            <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col justify-between shrink-0 z-30 animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  {activeSideDrawer === 'chat' && <><MessageSquare className="w-4 h-4 text-cyan-400" /> In-Call Messages</>}
                  {activeSideDrawer === 'polls' && <><BarChart2 className="w-4 h-4 text-cyan-400" /> Interactive Class Polls</>}
                  {activeSideDrawer === 'participants' && <><Users className="w-4 h-4 text-cyan-400" /> Participants (5)</>}
                </h3>
                <button
                  onClick={() => setActiveSideDrawer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {activeSideDrawer === 'chat' && (
                  <div className="space-y-3">
                    {chatMessages.map((m) => (
                      <div key={m.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-cyan-400">{m.sender}</span>
                          <span className="text-slate-500">{m.timestamp}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeSideDrawer === 'polls' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                        Active Teacher Poll
                      </div>
                      <h4 className="text-xs font-extrabold text-white">
                        {activePoll.question}
                      </h4>

                      <div className="space-y-2 pt-1">
                        {activePoll.options.map((opt, oIdx) => {
                          const pct = activePoll.totalVotes > 0 ? Math.round((opt.votes / activePoll.totalVotes) * 100) : 0
                          return (
                            <button
                              key={oIdx}
                              disabled={hasVoted}
                              onClick={() => handleVote(oIdx)}
                              className="w-full text-left p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/60 transition-all space-y-1.5 disabled:cursor-default"
                            >
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-slate-200">{opt.text}</span>
                                <span className="text-cyan-400">{pct}% ({opt.votes})</span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="text-[10px] text-slate-500 text-center pt-1">
                        {hasVoted ? '✓ Your vote has been submitted' : 'Click any option to vote in real-time'} &bull; {activePoll.totalVotes} total responses
                      </div>
                    </div>
                  </div>
                )}

                {activeSideDrawer === 'participants' && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-cyan-500 text-slate-950 font-black flex items-center justify-center text-xs">
                          {activeCallRoom.teacher_name?.charAt(0) || 'T'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            {activeCallRoom.teacher_name}
                            <span className="text-[10px]">👑</span>
                          </div>
                          <div className="text-[10px] text-cyan-400">Host / Teacher</div>
                        </div>
                      </div>
                      <span className="text-xs">🎙️</span>
                    </div>

                    {[
                      { name: user.display_name + ' (You)', mic: isMicOn },
                      { name: 'Aarav Patel', mic: false },
                      { name: 'Diya Sharma', mic: true },
                      { name: 'Ishaan Verma', mic: false },
                      { name: 'Ananya Iyer', mic: false }
                    ].map((p, pIdx) => (
                      <div key={pIdx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[11px]">
                            {p.name.charAt(0)}
                          </div>
                          <span className="text-slate-200 font-semibold">{p.name}</span>
                        </div>
                        <span>{p.mic ? '🎙️' : '🔇'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input Footer */}
              {activeSideDrawer === 'chat' && (
                <form onSubmit={handleSendChat} className="p-3 border-t border-slate-800 flex gap-2">
                  <input
                    type="text"
                    value={newChatText}
                    onChange={(e) => setNewChatText(e.target.value)}
                    placeholder="Type message to class..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── RENDER 2: CLASSROOM DASHBOARD / LOBBY ──────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            {isAdmin && <ShieldCheck className="w-3.5 h-3.5" />}
            {isTeacher && <GraduationCap className="w-3.5 h-3.5" />}
            {isStudent && <BookOpen className="w-3.5 h-3.5" />}
            {isAdmin 
              ? 'Administrator Virtual Classroom Suite' 
              : isTeacher 
              ? 'Faculty Live Class Scheduling' 
              : `Class ${studentGradeNum} Live Classroom`}
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Video className="w-8 h-8 text-cyan-400" />
            Live Video Classrooms (Zoom & Teams Style)
          </h1>

          <p className="text-slate-400 text-sm max-w-2xl">
            {isAdmin && 'Supervise synchronous video classrooms, conduct live broadcasts, inspect attendance, and manage schedule slots across all 10 grades.'}
            {isTeacher && 'Schedule and launch real-time video classes matching your timetable periods. Share screen, use collaborative whiteboard, conduct polls, and teach interactively.'}
            {isStudent && `Join your official Class ${studentGradeNum} live video lectures. Speak with your teacher, ask questions in chat, vote in polls, and view screen sharing.`}
          </p>
        </div>

        {/* Action Button */}
        {(isTeacher || isAdmin) && (
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-all shadow-xl shadow-cyan-500/20 shrink-0 relative z-10"
          >
            <Plus className="w-4 h-4" />
            Schedule / Launch Live Class
          </button>
        )}
      </div>

      {/* Active Live Classrooms Notice */}
      {classes.some(c => c.status === 'live') && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <div>
              <div className="text-xs font-extrabold text-rose-400 uppercase tracking-wider">
                🟢 Live Video Class Active Now
              </div>
              <div className="text-sm font-bold text-white">
                {classes.find(c => c.status === 'live')?.title}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleJoinClass(classes.find(c => c.status === 'live')!)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 transition-all"
          >
            <Play className="w-4 h-4 fill-white" />
            Join Live Class Now
          </button>
        </div>
      )}

      {/* Classroom Schedule Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white">
            {isStudent ? `Class ${studentGradeNum} Scheduled Video Sessions` : 'Classroom Broadcast Sessions'}
          </h2>
          <span className="text-xs text-slate-500">{classes.length} Total Sessions</span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm">Loading virtual classroom schedule...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
            <VideoOff className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No live or upcoming sessions scheduled.</p>
            {(isTeacher || isAdmin) && (
              <p className="text-xs text-slate-500">Click &quot;Schedule / Launch Live Class&quot; above to initiate a class from your timetable.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((c) => {
              const isLive = c.status === 'live'
              return (
                <div
                  key={c.id}
                  className={`bg-slate-900 border rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-2xl ${
                    isLive 
                      ? 'border-rose-500/50 shadow-rose-950/20' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isLive 
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' 
                              : c.status === 'ended' 
                              ? 'bg-slate-800 text-slate-400' 
                              : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {isLive ? '🟢 LIVE NOW' : c.status}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            Class {c.grade_number || 7} &bull; Period {c.period_number || 4}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-white mt-1.5 line-clamp-2">
                          {c.title}
                        </h3>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Instructor:</span>
                        <strong className="text-slate-200">{c.teacher_name || 'Dr. Sarah Connor'}</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Virtual Room:</span>
                        <span className="font-mono text-cyan-400">{c.room_number || 'Room 701'}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Subject:</span>
                        <span>{c.subject_name || 'Mathematics'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500 font-mono">
                      {new Date(c.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {isLive ? (
                      <button
                        onClick={() => handleJoinClass(c)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        Join Call
                      </button>
                    ) : c.status === 'scheduled' ? (
                      <button
                        onClick={() => handleJoinClass(c)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs shadow-md shadow-cyan-500/20 transition-all"
                      >
                        <Video className="w-3.5 h-3.5" />
                        {isTeacher || isAdmin ? 'Start Class' : 'Enter Lobby'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Session Ended</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SCHEDULE / LAUNCH CLASS MODAL (Teacher Timetable Slot Integrated) ─── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Video className="w-5 h-5 text-cyan-400" />
                Schedule Live Class (Timetable Aligned)
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Select Your Assigned Teaching Slot (From Master Timetable)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Only subjects and time periods you are assigned to teach appear here.
                </p>
                <select
                  value={selectedSlotIndex}
                  onChange={(e) => setSelectedSlotIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {teacherSlots.map((slot, idx) => (
                    <option key={idx} value={idx}>
                      {slot.grade_name} Sec {slot.section_name} &bull; {slot.subject_name} &bull; Period {slot.period_number} ({slot.start_time} - {slot.end_time})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Lecture Topic / Title (Optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Rational Numbers — Problem Solving Workshop"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Start Live Video Immediately</div>
                  <div className="text-[11px] text-slate-400">Launch live call and alert students right away</div>
                </div>
                <input
                  type="checkbox"
                  checked={instantLaunch}
                  onChange={(e) => setInstantLaunch(e.target.checked)}
                  className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSchedule}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {submittingSchedule ? 'Launching...' : instantLaunch ? '🚀 Launch Class Now' : 'Schedule Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
