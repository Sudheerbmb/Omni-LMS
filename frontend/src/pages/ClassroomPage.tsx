import React, { useState, useEffect, useRef, useCallback } from 'react'

import {

  Video,

  Mic,

  MicOff,

  VideoOff,

  PhoneOff,

  Share2,

  Users,

  MessageSquare,

  BarChart2,

  Calendar,

  Sparkles,

  Plus,

  Play,

  Monitor,

  PenTool,
  Lightbulb,
  HelpCircle,

  RotateCcw,

  Download,

  Hand,

  Radio,

  CheckCircle2,
  AlertCircle,
  Volume2,
  AlertTriangle,

  RefreshCw,

  UserX,

  VolumeX,

  X,

  Check,

  Bot,

  Square,

  Circle,

  Minus,

  MoveRight,

  Highlighter,
  Copy,
  CheckCheck,
  Subtitles,
  Clock,

  Zap,

  BookOpen,

  FileText,

  Send,

  Layers,

  Grid,

  Loader2

} from 'lucide-react'

import {

  getSchoolLiveClasses,

  getTeacherTimetableSlots,

  createSchoolLiveClass,

  updateLiveClassStatus,
  endLiveClassSession,

  uploadClassRecording,
  getTeacherCopilotAssistance,
  getStudentTutorAssistance,

  getWsBaseUrl

} from '../lib/api'

import type { SchoolLiveClass, TeacherTimetableSlot } from '../lib/api'
import { AiRecordingPlayerModal } from '../components/AiRecordingPlayerModal'

interface PeerUser {

  id: string

  display_name: string

  role: string

  avatar?: string

  isMicOn?: boolean

  isCameraOn?: boolean

  isHandRaised?: boolean

}

interface ChatMessage {

  id: string

  sender: string

  role: 'teacher' | 'student' | 'system'

  text: string

  timestamp: string

}

interface PollOption {

  text: string

  votes: number

}

interface PollData {

  id: string

  question: string

  options: PollOption[]

  totalVotes: number

  isActive: boolean

  creatorName?: string

}

interface WhiteboardStroke {

  id?: string

  x0: number

  y0: number

  x1: number

  y1: number

  color: string

  width: number

  tool: 'pen' | 'highlighter' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'arrow'

}

interface ClassroomPageProps {

  user: {

    id?: string

    display_name?: string

    email?: string

    role?: 'admin' | 'teacher' | 'student'

  }

}

// Public Google & Cloudflare STUN servers for NAT traversal

const RTC_CONFIG: RTCConfiguration = {

  iceServers: [

    { urls: 'stun:stun.l.google.com:19302' },

    { urls: 'stun:stun1.l.google.com:19302' },

    { urls: 'stun:stun2.l.google.com:19302' },

    { urls: 'stun:stun.cloudflare.com:3478' }

  ]

}

// Dedicated Peer Video & Audio Card Component

interface PeerCardProps {

  peerId: string

  displayName: string

  role: string

  avatar?: string

  stream?: MediaStream | null

  isLocal?: boolean

  isMicOn?: boolean

  isCameraOn?: boolean

  isHandRaised?: boolean

  isSpotlight?: boolean

}

const PeerVideoCard: React.FC<PeerCardProps> = ({

  displayName,

  role,

  avatar,

  stream,

  isLocal = false,

  isMicOn = true,

  isCameraOn = true,

  isHandRaised = false,

  isSpotlight = false

}) => {

  const videoRef = useRef<HTMLVideoElement | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {

    if (videoRef.current && stream) {

      if (videoRef.current.srcObject !== stream) {

        videoRef.current.srcObject = stream

      }

      videoRef.current.play().catch(err => {

        console.warn(`[Video Playback] ${displayName} autoplay handled:`, err)

      })

    }

    if (audioRef.current && stream && !isLocal) {

      if (audioRef.current.srcObject !== stream) {

        audioRef.current.srcObject = stream

      }

      audioRef.current.play().catch(err => {

        console.warn(`[Audio Playback] ${displayName} autoplay handled:`, err)

      })

    }

  }, [stream, isLocal, displayName])

  const hasVideoTrack = Boolean(stream && stream.getVideoTracks().length > 0 && isCameraOn)

  return (

    <div

      className={`rounded-2xl sm:rounded-3xl bg-[#0B0F19] border border-amber-500/15 relative overflow-hidden shadow-xl flex flex-col transition-all duration-300 ${

        isSpotlight ? 'h-full w-full' : 'min-h-[220px] sm:min-h-[260px]'

      }`}

    >

      <div className="flex-1 flex items-center justify-center relative bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 overflow-hidden">

        <video

          ref={videoRef}

          autoPlay

          playsInline

          muted={isLocal}

          className={`w-full h-full object-cover transition-opacity duration-300 ${

            hasVideoTrack ? 'opacity-100 block' : 'opacity-0 hidden'

          }`}

        />

        {!isLocal && (

          <audio

            ref={audioRef}

            autoPlay

            playsInline

          />

        )}

        {!hasVideoTrack && (

          <div className="flex flex-col items-center justify-center gap-3 p-4">

            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 border-2 border-cyan-400 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-cyan-500/20">

              {avatar || displayName.charAt(0).toUpperCase()}

            </div>

            <span className="text-sm font-bold text-slate-300 truncate max-w-[180px]">{displayName}</span>

          </div>

        )}

      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">

        <div className="px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-bold text-white flex items-center gap-2 max-w-[80%] truncate">

          <span className="truncate">{displayName} {isLocal && '(You)'}</span>

          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-amber-400 border border-cyan-500/30 uppercase font-semibold">

            {role}

          </span>

          {!isMicOn && <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}

        </div>

      </div>

      {isHandRaised && (

        <div className="absolute top-3 right-3 p-2 rounded-full bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 animate-bounce">

          <Hand className="w-4 h-4" />

        </div>

      )}

    </div>

  )

}

export const ClassroomPage: React.FC<ClassroomPageProps> = ({ user }) => {

  // Live classes & scheduling state

  const [classes, setClasses] = useState<SchoolLiveClass[]>([])

  const [teacherSlots, setTeacherSlots] = useState<TeacherTimetableSlot[]>([])

  const [loading, setLoading] = useState(true)

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

  const [mediaPermissionDenied, setMediaPermissionDenied] = useState(false)

  // Live Class Cloudinary Recording State

  const [isRecording, setIsRecording] = useState(false)

  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const [isUploadingRecording, setIsUploadingRecording] = useState(false)

  const [recordingUploadProgress, setRecordingUploadProgress] = useState<string | null>(null)

  const [selectedRecordingUrl, setSelectedRecordingUrl] = useState<string | null>(null)
  const [selectedRecordingClass, setSelectedRecordingClass] = useState<SchoolLiveClass | null>(null)
  
  // Teacher AI Copilot State
  const [showTeacherCopilot, setShowTeacherCopilot] = useState(false)
  // Teacher AI Faculty Associate State
  const [copilotMissedPointsData, setCopilotMissedPointsData] = useState<{
    covered_points: string[]
    missed_points: string[]
    pacing_advice: string
    suggested_transition: string
    overview: string
  } | null>(null)
  const [teacherAiTab, setTeacherAiTab] = useState<'missed_points' | 'mermaid' | 'analogies' | 'poll'>('missed_points')
  const [isTeacherAiLoading, setIsTeacherAiLoading] = useState(false)
  const [copiedTransitionToast, setCopiedTransitionToast] = useState(false)
  const [copiedMermaidToast, setCopiedMermaidToast] = useState(false)
  
  const [copilotDiagramData, setCopilotDiagramData] = useState<{
    title: string
    mermaid_code?: string
    diagram_ascii: string
    key_concepts: string[]
    pedagogical_explanation: string
    whiteboard_text?: string
  } | null>(null)
  const [copiedDiagramToast, setCopiedDiagramToast] = useState(false)

  // Student AI Tutor State (Visible only to students)
  const [showStudentTutorModal, setShowStudentTutorModal] = useState(false)
  const [postSessionSummary, setPostSessionSummary] = useState<any | null>(null)
  const [showPostSessionSummaryModal, setShowPostSessionSummaryModal] = useState(false)
  const [studentTutorTab, setStudentTutorTab] = useState<'doubt' | 'summary' | 'milestones'>('doubt')
  const [studentDoubtInput, setStudentDoubtInput] = useState('')
  const [studentDoubtHistory, setStudentDoubtHistory] = useState<Array<{ id: string; question: string; answer: string; timestamp: string }>>([])
  const [studentSummaryResult, setStudentSummaryResult] = useState<string | null>(null)
  const [studentMilestones, setStudentMilestones] = useState<Array<{ timestamp: string; title: string; summary: string }>>([])
  const [isStudentTutorLoading, setIsStudentTutorLoading] = useState(false)

  // Live Transcription & Captions State
  const [showLiveCaptions, setShowLiveCaptions] = useState(true)
  const [latestTranscriptSnippet, setLatestTranscriptSnippet] = useState<string>('')
  const [liveTranscript, setLiveTranscript] = useState<Array<{ id: string; second: number; text: string; speaker: string; timestamp: number }>>([])
  
  const [copilotTopic, setCopilotTopic] = useState('')
  const [copilotAction, setCopilotAction] = useState<'enhance' | 'diagram' | 'case_study' | 'fun_fact' | 'analogy' | 'quick_poll' | 'engagement_question'>('diagram')
  const [copilotResult, setCopilotResult] = useState<string | null>(null)
  const [copilotPollData, setCopilotPollData] = useState<any | null>(null)
  const [isCopilotLoading, setIsCopilotLoading] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const recordedChunksRef = useRef<BlobPart[]>([])

  const recordingTimerRef = useRef<any>(null)

  const activeCallRoomRef = useRef<SchoolLiveClass | null>(null)

  useEffect(() => {

    if (activeCallRoom) {

      activeCallRoomRef.current = activeCallRoom

    }

  }, [activeCallRoom])

  useEffect(() => {

    if (isRecording) {

      recordingTimerRef.current = setInterval(() => {

        setRecordingSeconds(s => s + 1)

      }, 1000)

    } else {

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)

      setRecordingSeconds(0)

    }

    return () => {

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)

    }

  }, [isRecording])

  const handleUploadRecording = async (classId: string, blob: Blob) => {

    setIsUploadingRecording(true)

    setRecordingUploadProgress('Uploading class lecture recording to Cloudinary...')

    try {

      const res = await uploadClassRecording(classId, blob)

      setRecordingUploadProgress('Class recording uploaded and saved!')

      setClasses(prev => prev.map(c => c.id === classId ? { ...c, recording_url: res.recording_url } : c))

      if (activeCallRoomRef.current?.id === classId) {

        setActiveCallRoom(prev => prev ? { ...prev, recording_url: res.recording_url } : null)

      }

      setTimeout(() => {

        setIsUploadingRecording(false)

        setRecordingUploadProgress(null)

      }, 3500)

    } catch (err: any) {

      console.error('Upload recording failed:', err)

      setRecordingUploadProgress(`Upload note: ${err?.message || 'Upload complete'}`)

      setTimeout(() => {

        setIsUploadingRecording(false)

        setRecordingUploadProgress(null)

      }, 4000)

    }

  }

  const startRecording = async () => {

    try {

      let streamToRecord: MediaStream | null = null

      // Attempt screen/display capture with system audio

      try {

        streamToRecord = await navigator.mediaDevices.getDisplayMedia({

          video: { frameRate: { ideal: 30 } },

          audio: true

        })

      } catch (dispErr) {

        console.warn('Display media capture skipped or cancelled:', dispErr)

      }

      // Fallback to webcam/mic local stream if display stream was not selected

      if (!streamToRecord) {

        if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {

          streamToRecord = localStreamRef.current

        } else {

          alert('Please enable camera or microphone, or allow screen sharing to record.')

          return

        }

      }

      // If display stream was selected and teacher microphone is available, mix mic into recording

      if (localStreamRef.current && streamToRecord !== localStreamRef.current) {

        const micTracks = localStreamRef.current.getAudioTracks()

        if (micTracks.length > 0) {

          try {

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext

            const audioCtx = new AudioCtx()

            const dest = audioCtx.createMediaStreamDestination()

            const micSource = audioCtx.createMediaStreamSource(new MediaStream([micTracks[0]]))

            micSource.connect(dest)

            const dispAudio = streamToRecord.getAudioTracks()

            if (dispAudio.length > 0) {

              const dispSource = audioCtx.createMediaStreamSource(new MediaStream([dispAudio[0]]))

              dispSource.connect(dest)

            }

            streamToRecord = new MediaStream([

              streamToRecord.getVideoTracks()[0],

              ...dest.stream.getAudioTracks()

            ])

          } catch (mixErr) {

            console.warn('Audio mix error, proceeding with available tracks:', mixErr)

          }

        }

      }

      const mimeCandidates = [

        'video/webm;codecs=vp9,opus',

        'video/webm;codecs=vp8,opus',

        'video/webm',

        'video/mp4'

      ]

      let mimeType = ''

      for (const m of mimeCandidates) {

        if (MediaRecorder.isTypeSupported(m)) {

          mimeType = m

          break

        }

      }

      const recorder = new MediaRecorder(streamToRecord, mimeType ? { mimeType } : undefined)

      recordedChunksRef.current = []

      recorder.ondataavailable = (e) => {

        if (e.data && e.data.size > 0) {

          recordedChunksRef.current.push(e.data)

        }

      }

      const targetRoomId = activeCallRoomRef.current?.id

      recorder.onstop = async () => {

        setIsRecording(false)

        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' })

        if (blob.size > 0 && targetRoomId) {

          await handleUploadRecording(targetRoomId, blob)

        }

      }

      const videoTrack = streamToRecord.getVideoTracks()[0]

      if (videoTrack) {

        videoTrack.onended = () => {

          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {

            mediaRecorderRef.current.stop()

          }

        }

      }

      mediaRecorderRef.current = recorder

      recorder.start(1000)

      setIsRecording(true)

      setRecordingSeconds(0)

    } catch (err: any) {

      console.error('Error starting recording:', err)

      alert(`Could not start recording: ${err?.message || 'Permission denied'}`)

    }

  }

  const stopRecording = () => {

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {

      mediaRecorderRef.current.stop()

    }

  }

  const toggleRecording = () => {

    if (isRecording) {

      stopRecording()

    } else {

      startRecording()

    }

  }

  // Modals & Notifications

  const [showEndMeetingModal, setShowEndMeetingModal] = useState(false)

  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const [teacherPresentingWhiteboard, setTeacherPresentingWhiteboard] = useState<string | null>(null)

  // Classroom Views: 'gallery' | 'spotlight' | 'whiteboard'

  const [callView, setCallView] = useState<'gallery' | 'spotlight' | 'whiteboard'>('gallery')

  const [activeSideDrawer, setActiveSideDrawer] = useState<'chat' | 'participants' | 'polls' | 'ai' | null>(null)

  // Media Streams

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})

  const localStreamRef = useRef<MediaStream | null>(null)

  const screenStreamRef = useRef<MediaStream | null>(null)

  const remoteStreamsRef = useRef<Record<string, MediaStream>>({})

  // Screen share

  const screenVideoRef = useRef<HTMLVideoElement | null>(null)

  const [remoteScreenInfo, setRemoteScreenInfo] = useState<{

    active: boolean

    sharerName: string

    sharerId: string

  }>({ active: false, sharerName: '', sharerId: '' })

  const [remoteScreenFrame, setRemoteScreenFrame] = useState<string | null>(null)

  const screenFrameIntervalRef = useRef<number | null>(null)

  // Connected Peers Roster State

  const [connectedPeers, setConnectedPeers] = useState<Record<string, PeerUser>>({})

  const [unreadChatCount, setUnreadChatCount] = useState(0)

  // Real-Time WebSocket & WebRTC

  const wsRef = useRef<WebSocket | null>(null)

  const [wsConnected, setWsConnected] = useState(false)

  const myPeerIdRef = useRef<string>(`peer_${user.id ? user.id.substring(0, 8) : Math.random().toString(36).substring(2, 8)}_${Math.random().toString(36).substring(2, 6)}`)

  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({})

  const iceQueueRef = useRef<Record<string, RTCIceCandidateInit[]>>({})

  const heartbeatIntervalRef = useRef<number | null>(null)

  // AUTHORITATIVE VECTOR WHITEBOARD STATE & ENGINE

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const strokesRef = useRef<WhiteboardStroke[]>([])

  const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'highlighter' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'arrow'>('pen')

  const [whiteboardColor, setWhiteboardColor] = useState('#38bdf8')

  const [whiteboardWidth, setWhiteboardWidth] = useState(3)

  const [whiteboardTheme, setWhiteboardTheme] = useState<'dark' | 'grid' | 'blueprint' | 'white'>('dark')

  const [isDrawing, setIsDrawing] = useState(false)

  const startPointRef = useRef<{ x: number; y: number } | null>(null)

  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  // Floating Emoji Reactions State

  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; left: number }[]>([])

  // Live Chat State

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([

    { id: 'init_1', sender: 'System', role: 'system', text: 'Welcome to Acharya-LMS Real-Time Classroom!', timestamp: 'Now' }

  ])

  const [newChatText, setNewChatText] = useState('')

  const chatBottomRef = useRef<HTMLDivElement | null>(null)

  // Live Poll State & Teacher Poll Creator State

  const [activePoll, setActivePoll] = useState<PollData>({

    id: 'poll-1',

    question: 'How clear is the concept presented in this session?',

    options: [

      { text: 'Extremely clear, fully understood!', votes: 2 },

      { text: 'Understood most parts, need slight revision', votes: 1 },

      { text: 'Need a brief recap / clarification', votes: 0 }

    ],

    totalVotes: 3,

    isActive: true,

    creatorName: 'Instructor'

  })

  const [hasVoted, setHasVoted] = useState(false)

  const [showPollCreator, setShowPollCreator] = useState(false)

  const [pollQuestionInput, setPollQuestionInput] = useState('')

  const [pollOptionsInput, setPollOptionsInput] = useState(['Yes, completely clear', 'Needs slight explanation', 'Did not understand'])



  const [showAiDiagramModal, setShowAiDiagramModal] = useState(false)

  // Meeting duration timer & Timetable Auto-End Engine
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [extraTimeSeconds, setExtraTimeSeconds] = useState(0)
  const [timetableWarningToast, setTimetableWarningToast] = useState<string | null>(null)

  const isStudent = user.role === 'student'
  const isTeacher = user.role === 'teacher'
  const isAdmin = user.role === 'admin'
  const isHost = isTeacher || isAdmin

  const studentGradeMatch = user.display_name?.match(/class\s*(\d+)/i) || user.email?.match(/class(\d+)/i)
  const studentGrade = studentGradeMatch ? parseInt(studentGradeMatch[1], 10) : 10

  const [filterGrade, setFilterGrade] = useState<number | 'all'>(isStudent ? studentGrade : 'all')
  const [filterRecordingOnly, setFilterRecordingOnly] = useState(false)

  // Helper to send WebSocket message safely

  const sendWsMessage = useCallback((msg: any) => {

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {

      wsRef.current.send(JSON.stringify(msg))

    }

  }, [])

  // Scroll chat to bottom

  useEffect(() => {

    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  }, [chatMessages])

  // Load Classroom Schedule & Teacher Slots on Mount

  useEffect(() => {

    loadClassroomData()

  }, [filterGrade])

  const loadClassroomData = async () => {

    try {

      setLoading(true)

      const gradeQuery = filterGrade === 'all' ? undefined : filterGrade

      const liveData = await getSchoolLiveClasses(gradeQuery !== undefined ? { grade_number: gradeQuery } : undefined)

      setClasses(liveData)

      if (isHost) {

        try {

          const slots = await getTeacherTimetableSlots()

          setTeacherSlots(slots)

        } catch (e) {

          console.warn('Teacher slots error:', e)

        }

      }

    } catch (err) {

      console.error('Failed to load classroom data:', err)

    } finally {

      setLoading(false)

    }

  }

  // Timetable-Synchronized Auto-End Countdown Computation
  const scheduledDurationSeconds = activeCallRoom
    ? (activeCallRoom.ends_at && activeCallRoom.starts_at
        ? Math.max(600, Math.round((new Date(activeCallRoom.ends_at).getTime() - new Date(activeCallRoom.starts_at).getTime()) / 1000))
        : 45 * 60)
    : 45 * 60

  const totalAllowedSeconds = scheduledDurationSeconds + extraTimeSeconds
  const remainingSeconds = Math.max(0, totalAllowedSeconds - elapsedSeconds)

  // Meeting Timer & Timetable Auto-End Interval
  useEffect(() => {
    let interval: any = null

    if (activeCallRoom) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1
          const remaining = totalAllowedSeconds - next

          if (remaining === 300) {
            setTimetableWarningToast('⚠️ 5 Minutes remaining in this scheduled period.')
          } else if (remaining === 60) {
            setTimetableWarningToast('🚨 1 Minute remaining. Class will auto-end according to timetable.')
          } else if (remaining <= 0) {
            // Auto-end class gracefully as per timetable
            if (isHost) {
              handleEndMeetingForAll()
            } else {
              handleLeaveMeetingOnly()
            }
          }

          return next
        })
      }, 1000)
    } else {
      setElapsedSeconds(0)
      setExtraTimeSeconds(0)
      setTimetableWarningToast(null)
    }

    return () => clearInterval(interval)
  }, [activeCallRoom, totalAllowedSeconds, isHost])

  // ==========================================

  // VECTOR WHITEBOARD RENDERING ENGINE

  // ==========================================

  const renderSingleStroke = (ctx: CanvasRenderingContext2D, s: WhiteboardStroke) => {

    ctx.save()

    ctx.beginPath()

    if (s.tool === 'eraser') {

      ctx.strokeStyle = whiteboardTheme === 'white' ? '#ffffff' : '#090d16'

      ctx.lineWidth = 32

      ctx.lineCap = 'round'

      ctx.lineJoin = 'round'

      ctx.moveTo(s.x0, s.y0)

      ctx.lineTo(s.x1, s.y1)

      ctx.stroke()

    } else if (s.tool === 'highlighter') {

      ctx.strokeStyle = s.color

      ctx.globalAlpha = 0.35

      ctx.lineWidth = s.width * 4

      ctx.lineCap = 'square'

      ctx.moveTo(s.x0, s.y0)

      ctx.lineTo(s.x1, s.y1)

      ctx.stroke()

    } else if (s.tool === 'line') {

      ctx.strokeStyle = s.color

      ctx.lineWidth = s.width

      ctx.lineCap = 'round'

      ctx.moveTo(s.x0, s.y0)

      ctx.lineTo(s.x1, s.y1)

      ctx.stroke()

    } else if (s.tool === 'rectangle') {

      ctx.strokeStyle = s.color

      ctx.lineWidth = s.width

      const w = s.x1 - s.x0

      const h = s.y1 - s.y0

      ctx.strokeRect(s.x0, s.y0, w, h)

    } else if (s.tool === 'circle') {

      ctx.strokeStyle = s.color

      ctx.lineWidth = s.width

      const rx = Math.abs(s.x1 - s.x0) / 2

      const ry = Math.abs(s.y1 - s.y0) / 2

      const cx = (s.x0 + s.x1) / 2

      const cy = (s.y0 + s.y1) / 2

      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)

      ctx.stroke()

    } else if (s.tool === 'arrow') {

      ctx.strokeStyle = s.color

      ctx.lineWidth = s.width

      ctx.lineCap = 'round'

      // Draw main line

      ctx.moveTo(s.x0, s.y0)

      ctx.lineTo(s.x1, s.y1)

      ctx.stroke()

      // Draw arrow head

      const angle = Math.atan2(s.y1 - s.y0, s.x1 - s.x0)

      const headLen = 16

      ctx.beginPath()

      ctx.moveTo(s.x1, s.y1)

      ctx.lineTo(s.x1 - headLen * Math.cos(angle - Math.PI / 6), s.y1 - headLen * Math.sin(angle - Math.PI / 6))

      ctx.moveTo(s.x1, s.y1)

      ctx.lineTo(s.x1 - headLen * Math.cos(angle + Math.PI / 6), s.y1 - headLen * Math.sin(angle + Math.PI / 6))

      ctx.stroke()

    } else {

      // Regular pen

      ctx.strokeStyle = s.color

      ctx.lineWidth = s.width

      ctx.lineCap = 'round'

      ctx.lineJoin = 'round'

      ctx.moveTo(s.x0, s.y0)

      ctx.lineTo(s.x1, s.y1)

      ctx.stroke()

    }

    ctx.restore()

  }

  const redrawFullWhiteboard = useCallback(() => {

    const canvas = canvasRef.current

    if (!canvas) return

    const ctx = canvas.getContext('2d')

    if (!ctx) return

    // Background color based on theme

    let bg = '#090d16'

    if (whiteboardTheme === 'white') bg = '#ffffff'

    if (whiteboardTheme === 'blueprint') bg = '#0d2038'

    ctx.fillStyle = bg

    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Optional Grid lines

    if (whiteboardTheme === 'grid' || whiteboardTheme === 'blueprint') {

      ctx.save()

      ctx.strokeStyle = whiteboardTheme === 'blueprint' ? '#17365d' : '#1e293b'

      ctx.lineWidth = 1

      const gridSize = 40

      for (let x = 0; x < canvas.width; x += gridSize) {

        ctx.beginPath()

        ctx.moveTo(x, 0)

        ctx.lineTo(x, canvas.height)

        ctx.stroke()

      }

      for (let y = 0; y < canvas.height; y += gridSize) {

        ctx.beginPath()

        ctx.moveTo(0, y)

        ctx.lineTo(canvas.width, y)

        ctx.stroke()

      }

      ctx.restore()

    }

    // Replay every stroke in buffer

    strokesRef.current.forEach(s => renderSingleStroke(ctx, s))

  }, [whiteboardTheme])

  // Redraw whenever view switches to whiteboard or theme changes

  useEffect(() => {

    if (callView === 'whiteboard') {

      setTimeout(() => redrawFullWhiteboard(), 50)

    }

  }, [callView, whiteboardTheme, redrawFullWhiteboard])

  // Camera and Microphone Local Media Handling

  const startCameraStream = async (): Promise<MediaStream | null> => {

    let stream: MediaStream | null = null

    setMediaPermissionDenied(false)

    try {

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {

        stream = await navigator.mediaDevices.getUserMedia({

          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },

          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

        })

        console.log('[Media] Acquired HD video + audio')

      }

    } catch (err1) {

      console.warn('[Media] HD Video+Audio failed, trying standard video+audio:', err1)

      try {

        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

        console.log('[Media] Acquired standard video + audio')

      } catch (err2) {

        console.warn('[Media] Standard video+audio failed, trying audio-only:', err2)

        try {

          stream = await navigator.mediaDevices.getUserMedia({ audio: true })

          console.log('[Media] Acquired audio-only stream')

        } catch (err3) {

          console.warn('[Media] Audio-only failed, trying video-only:', err3)

          try {

            stream = await navigator.mediaDevices.getUserMedia({ video: true })

            console.log('[Media] Acquired video-only stream')

          } catch (err4) {

            console.warn('[Media] All media access denied:', err4)

            setMediaPermissionDenied(true)

          }

        }

      }

    }

    if (stream) {

      localStreamRef.current = stream

      setLocalStream(stream)

      const hasVideo = stream.getVideoTracks().length > 0

      const hasAudio = stream.getAudioTracks().length > 0

      setIsCameraOn(hasVideo)

      setIsMicOn(hasAudio)

      Object.entries(peerConnectionsRef.current).forEach(([targetPeerId, pc]) => {

        stream!.getTracks().forEach(track => {

          const senders = pc.getSenders()

          const exists = senders.some(s => s.track && s.track.kind === track.kind)

          if (!exists) {

            pc.addTrack(track, stream!)

          }

        })

        createPeerOffer(targetPeerId, pc)

      })

    } else {

      setIsCameraOn(false)

      setIsMicOn(false)

    }

    return stream

  }

  const stopCameraStream = () => {

    if (localStreamRef.current) {

      localStreamRef.current.getTracks().forEach(track => track.stop())

      localStreamRef.current = null

      setLocalStream(null)

    }

    if (screenStreamRef.current) {

      screenStreamRef.current.getTracks().forEach(track => track.stop())

      screenStreamRef.current = null

    }

    if (screenFrameIntervalRef.current) {

      clearInterval(screenFrameIntervalRef.current)

      screenFrameIntervalRef.current = null

    }

  }

  const toggleMic = () => {

    const next = !isMicOn

    setIsMicOn(next)

    if (localStreamRef.current) {

      localStreamRef.current.getAudioTracks().forEach(track => {

        track.enabled = next

      })

    }

    sendWsMessage({

      type: 'media_state_change',

      peerId: myPeerIdRef.current,

      isMicOn: next,

      isCameraOn

    })

  }

  const toggleCamera = () => {

    const next = !isCameraOn

    setIsCameraOn(next)

    if (localStreamRef.current) {

      localStreamRef.current.getVideoTracks().forEach(track => {

        track.enabled = next

      })

    }

    sendWsMessage({

      type: 'media_state_change',

      peerId: myPeerIdRef.current,

      isMicOn,

      isCameraOn: next

    })

  }

  // WebRTC Peer Connection Factory

  const getOrCreatePeerConnection = (targetPeerId: string): RTCPeerConnection => {

    if (peerConnectionsRef.current[targetPeerId]) {

      return peerConnectionsRef.current[targetPeerId]

    }

    console.log('[WebRTC] Creating RTCPeerConnection for peer:', targetPeerId)

    const pc = new RTCPeerConnection(RTC_CONFIG)

    peerConnectionsRef.current[targetPeerId] = pc

    iceQueueRef.current[targetPeerId] = []

    if (localStreamRef.current) {

      localStreamRef.current.getTracks().forEach(track => {

        pc.addTrack(track, localStreamRef.current!)

      })

    }

    if (screenStreamRef.current && isScreenSharing) {

      screenStreamRef.current.getTracks().forEach(track => {

        pc.addTrack(track, screenStreamRef.current!)

      })

    }

    pc.ontrack = (event) => {

      console.log(`[WebRTC] Received remote track (${event.track.kind}) from:`, targetPeerId)

      let remoteStream = remoteStreamsRef.current[targetPeerId]

      if (!remoteStream) {

        remoteStream = new MediaStream()

        remoteStreamsRef.current[targetPeerId] = remoteStream

      }

      if (event.streams && event.streams[0]) {

        event.streams[0].getTracks().forEach(t => {

          if (!remoteStream!.getTracks().some(existing => existing.id === t.id)) {

            remoteStream!.addTrack(t)

          }

        })

      } else if (event.track) {

        if (!remoteStream.getTracks().some(existing => existing.id === event.track.id)) {

          remoteStream.addTrack(event.track)

        }

      }

      setRemoteStreams(prev => ({

        ...prev,

        [targetPeerId]: remoteStream!

      }))

    }

    pc.onicecandidate = (event) => {

      if (event.candidate) {

        sendWsMessage({

          type: 'webrtc_ice',

          targetPeerId,

          senderPeerId: myPeerIdRef.current,

          candidate: event.candidate

        })

      }

    }

    pc.onconnectionstatechange = () => {

      console.log(`[WebRTC] Peer ${targetPeerId} connectionState:`, pc.connectionState)

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {

        setRemoteStreams(prev => {

          const next = { ...prev }

          delete next[targetPeerId]

          return next

        })

      }

    }

    return pc

  }

  const flushIceQueue = async (targetPeerId: string, pc: RTCPeerConnection) => {

    const queue = iceQueueRef.current[targetPeerId] || []

    for (const cand of queue) {

      try {

        await pc.addIceCandidate(new RTCIceCandidate(cand))

      } catch (err) {

        console.warn(`[WebRTC] Error adding queued ICE candidate for ${targetPeerId}:`, err)

      }

    }

    iceQueueRef.current[targetPeerId] = []

  }

  const createPeerOffer = async (targetPeerId: string, pc?: RTCPeerConnection) => {

    try {

      const peerConn = pc || getOrCreatePeerConnection(targetPeerId)

      const offer = await peerConn.createOffer({

        offerToReceiveAudio: true,

        offerToReceiveVideo: true

      })

      await peerConn.setLocalDescription(offer)

      sendWsMessage({

        type: 'webrtc_offer',

        targetPeerId,

        senderPeerId: myPeerIdRef.current,

        sharerName: user.display_name || user.email || 'Peer',

        offer

      })

    } catch (err) {

      console.error('[WebRTC] Error creating offer for peer:', targetPeerId, err)

    }

  }

  // Room Connection & WebSocket Messaging Lifecycle

  useEffect(() => {

    if (!activeCallRoom) {

      if (wsRef.current) {

        wsRef.current.close()

        wsRef.current = null

      }

      if (heartbeatIntervalRef.current) {

        clearInterval(heartbeatIntervalRef.current)

        heartbeatIntervalRef.current = null

      }

      Object.values(peerConnectionsRef.current).forEach(pc => pc.close())

      peerConnectionsRef.current = {}

      iceQueueRef.current = {}

      remoteStreamsRef.current = {}

      setConnectedPeers({})

      setRemoteStreams({})

      setRemoteScreenInfo({ active: false, sharerName: '', sharerId: '' })

      setRemoteScreenFrame(null)

      setWsConnected(false)

      return

    }

    const roomId = activeCallRoom.id

    const myPeerId = myPeerIdRef.current

    const myDisplayName = user.display_name || user.email || (isTeacher ? 'Instructor' : 'Student')

    const myRole = user.role || 'student'

    const wsBase = getWsBaseUrl()

    const wsUrl = `${wsBase}/api/v1/classroom/ws/${roomId}?peer_id=${encodeURIComponent(myPeerId)}&name=${encodeURIComponent(myDisplayName)}&role=${encodeURIComponent(myRole)}`

    console.log('[Classroom WS] Connecting to:', wsUrl)

    const socket = new WebSocket(wsUrl)

    wsRef.current = socket

    const myUserPayload: PeerUser = {

      id: myPeerId,

      display_name: myDisplayName,

      role: myRole,

      avatar: myDisplayName.charAt(0).toUpperCase(),

      isMicOn,

      isCameraOn,

      isHandRaised

    }

    socket.onopen = () => {

      console.log('[Classroom WS] Connected to live room:', roomId)

      setWsConnected(true)

      socket.send(JSON.stringify({

        type: 'peer_join',

        peerId: myPeerId,

        user: myUserPayload

      }))

      // Periodic presence ping every 3s

      heartbeatIntervalRef.current = window.setInterval(() => {

        if (socket.readyState === WebSocket.OPEN) {

          socket.send(JSON.stringify({

            type: 'peer_presence',

            peerId: myPeerId,

            user: {

              ...myUserPayload,

              isMicOn,

              isCameraOn,

              isHandRaised

            }

          }))

        }

      }, 3000)

    }

    socket.onmessage = async (event) => {

      try {

        const data = JSON.parse(event.data)

        switch (data.type) {

          case 'room_state': {

            console.log('[Classroom WS] Received room_state with existing peers:', data.peers)

            const peerMap: Record<string, PeerUser> = {}

            if (Array.isArray(data.peers)) {

              for (const p of data.peers) {

                if (p.peerId && p.peerId !== myPeerId) {

                  peerMap[p.peerId] = p.user

                  const pc = getOrCreatePeerConnection(p.peerId)

                  await createPeerOffer(p.peerId, pc)

                }

              }

            }

            setConnectedPeers(peerMap)

            break

          }

          case 'peer_join': {

            if (data.peerId && data.peerId !== myPeerId && data.user) {

              setConnectedPeers(prev => ({

                ...prev,

                [data.peerId]: data.user

              }))

              getOrCreatePeerConnection(data.peerId)

              // If we have whiteboard drawings and we are host, sync full vector state to new attendee!

              if (isHost && strokesRef.current.length > 0) {

                sendWsMessage({

                  type: 'whiteboard_sync',

                  targetPeerId: data.peerId,

                  strokes: strokesRef.current

                })

              }

            }

            break

          }

          case 'peer_presence': {

            if (data.peerId && data.peerId !== myPeerId && data.user) {

              setConnectedPeers(prev => ({

                ...prev,

                [data.peerId]: {

                  ...prev[data.peerId],

                  ...data.user

                }

              }))

            }

            break

          }

          case 'media_state_change': {

            if (data.peerId && data.peerId !== myPeerId) {

              setConnectedPeers(prev => {

                if (!prev[data.peerId]) return prev

                return {

                  ...prev,

                  [data.peerId]: {

                    ...prev[data.peerId],

                    isMicOn: data.isMicOn,

                    isCameraOn: data.isCameraOn

                  }

                }

              })

            }

            break

          }

          case 'peer_leave': {

            if (data.peerId) {

              setConnectedPeers(prev => {

                const next = { ...prev }

                delete next[data.peerId]

                return next

              })

              setRemoteStreams(prev => {

                const next = { ...prev }

                delete next[data.peerId]

                return next

              })

              delete remoteStreamsRef.current[data.peerId]

              delete iceQueueRef.current[data.peerId]

              if (peerConnectionsRef.current[data.peerId]) {

                peerConnectionsRef.current[data.peerId].close()

                delete peerConnectionsRef.current[data.peerId]

              }

              if (remoteScreenInfo.sharerId === data.peerId) {

                setRemoteScreenInfo({ active: false, sharerName: '', sharerId: '' })

                setRemoteScreenFrame(null)

                setCallView('gallery')

              }

            }

            break

          }

          case 'meeting_ended': {
            stopCameraStream()
            if (data.summary) {
              setPostSessionSummary(data.summary)
              setShowPostSessionSummaryModal(true)
            } else {
              setAlertMessage(data.reason || 'The instructor has ended this live class session for all attendees.')
            }
            setActiveCallRoom(null)
            loadClassroomData()
            break
          }

          case 'kick_peer': {

            if (data.targetPeerId === myPeerId) {

              stopCameraStream()

              setActiveCallRoom(null)

              setAlertMessage('You have been removed from this live class by the instructor.')

              loadClassroomData()

            }

            break

          }

          case 'mute_all': {

            if (!isHost) {

              setIsMicOn(false)

              if (localStreamRef.current) {

                localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false })

              }

              sendWsMessage({

                type: 'media_state_change',

                peerId: myPeerIdRef.current,

                isMicOn: false,

                isCameraOn

              })

              setChatMessages(prev => [...prev, {

                id: `sys_${Date.now()}`,

                sender: 'System',

                role: 'system',

                text: 'The instructor has muted all participant microphones.',

                timestamp: 'Now'

              }])

            }

            break

          }

          // SYNCHRONIZED VECTOR WHITEBOARD DRAW STROKE

          case 'live_transcript_chunk': {
            if (data.text) {
              setLiveTranscript(prev => {
                const exists = prev.some(item => item.second === data.second && item.text === data.text)
                if (exists) return prev
                return [...prev, {
                  id: Math.random().toString(36).substring(7),
                  second: data.second ?? elapsedSeconds,
                  text: data.text,
                  speaker: data.speaker || 'Teacher',
                  timestamp: Date.now()
                }]
              })
              setLatestTranscriptSnippet(`${data.speaker || 'Teacher'}: "${data.text}"`)
            }
            break
          }

          case 'whiteboard_draw': {

            if (data.stroke) {

              // 1. ALWAYS buffer into authoritative vector memory (even if canvas is not currently mounted!)

              strokesRef.current.push(data.stroke)

              // 2. If canvas is currently visible in DOM, draw it immediately!

              const canvas = canvasRef.current

              if (canvas) {

                const ctx = canvas.getContext('2d')

                if (ctx) {

                  renderSingleStroke(ctx, data.stroke)

                }

              }

            }

            break

          }

          // SYNCHRONIZED BATCH OF STROKES (e.g. from AI Diagram generator)

          case 'whiteboard_draw_batch': {

            if (Array.isArray(data.strokes)) {

              data.strokes.forEach((s: WhiteboardStroke) => {

                strokesRef.current.push(s)

              })

              const canvas = canvasRef.current

              if (canvas) {

                const ctx = canvas.getContext('2d')

                if (ctx) {

                  data.strokes.forEach((s: WhiteboardStroke) => renderSingleStroke(ctx, s))

                }

              }

            }

            break

          }

          // WHITEBOARD FULL STATE SYNC (For late joiners)

          case 'whiteboard_sync': {

            if (Array.isArray(data.strokes)) {

              strokesRef.current = data.strokes

              if (callView === 'whiteboard') {

                redrawFullWhiteboard()

              }

            }

            break

          }

          // WHITEBOARD CLEAR

          case 'whiteboard_clear': {

            strokesRef.current = []

            redrawFullWhiteboard()

            break

          }

          // TEACHER OPENED WHITEBOARD NOTIFICATION

          case 'teacher_present_whiteboard': {

            if (!isHost) {

              setTeacherPresentingWhiteboard(data.teacherName || 'Instructor')

              setTimeout(() => setTeacherPresentingWhiteboard(null), 8000)

            }

            break

          }

          // WebRTC Signaling: Incoming Offer

          case 'webrtc_offer': {

            if (data.targetPeerId === myPeerId && data.offer) {

              const pc = getOrCreatePeerConnection(data.senderPeerId)

              if (pc.signalingState !== 'stable') {

                const isPolite = myPeerId < data.senderPeerId

                if (isPolite) {

                  console.log(`[WebRTC] Colliding offer from ${data.senderPeerId}. Rolling back as polite peer.`)

                  await pc.setLocalDescription({ type: 'rollback' })

                } else {

                  console.log(`[WebRTC] Colliding offer from ${data.senderPeerId}. Ignoring as impolite peer.`)

                  return

                }

              }

              await pc.setRemoteDescription(new RTCSessionDescription(data.offer))

              await flushIceQueue(data.senderPeerId, pc)

              const answer = await pc.createAnswer()

              await pc.setLocalDescription(answer)

              sendWsMessage({

                type: 'webrtc_answer',

                targetPeerId: data.senderPeerId,

                senderPeerId: myPeerId,

                answer

              })

            }

            break

          }

          case 'webrtc_answer': {

            if (data.targetPeerId === myPeerId && data.answer) {

              const pc = peerConnectionsRef.current[data.senderPeerId]

              if (pc && pc.signalingState === 'have-local-offer') {

                await pc.setRemoteDescription(new RTCSessionDescription(data.answer))

                await flushIceQueue(data.senderPeerId, pc)

              }

            }

            break

          }

          case 'webrtc_ice': {

            if (data.targetPeerId === myPeerId && data.candidate) {

              const pc = peerConnectionsRef.current[data.senderPeerId]

              if (pc) {

                if (!pc.remoteDescription || !pc.remoteDescription.type) {

                  if (!iceQueueRef.current[data.senderPeerId]) {

                    iceQueueRef.current[data.senderPeerId] = []

                  }

                  iceQueueRef.current[data.senderPeerId].push(data.candidate)

                } else {

                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(err => {

                    console.warn('[WebRTC] ICE candidate error:', err)

                  })

                }

              }

            }

            break

          }

          case 'screen_share_start': {

            if (data.sharerId !== myPeerId) {

              setRemoteScreenInfo({

                active: true,

                sharerName: data.sharerName || 'Presenter',

                sharerId: data.sharerId

              })

              setCallView('spotlight')

            }

            break

          }

          case 'screen_share_stop': {

            setRemoteScreenInfo({ active: false, sharerName: '', sharerId: '' })

            setRemoteScreenFrame(null)

            setCallView('gallery')

            break

          }

          case 'screen_frame': {

            if (data.sharerId !== myPeerId) {

              setRemoteScreenFrame(data.frameData)

              if (!remoteScreenInfo.active) {

                setRemoteScreenInfo({

                  active: true,

                  sharerName: data.sharerName || 'Presenter',

                  sharerId: data.sharerId

                })

                setCallView('spotlight')

              }

            }

            break

          }

          case 'chat': {

            if (data.payload) {

              setChatMessages(prev => {

                if (prev.some(m => m.id === data.payload.id)) return prev

                return [...prev, data.payload]

              })

              if (activeSideDrawer !== 'chat') {

                setUnreadChatCount(prev => prev + 1)

              }

            }

            break

          }

          case 'reaction': {

            if (data.emoji) {

              const id = Date.now() + Math.random()

              const left = Math.floor(Math.random() * 80) + 10

              setFloatingReactions(prev => [...prev, { id, emoji: data.emoji, left }])

              setTimeout(() => {

                setFloatingReactions(prev => prev.filter(r => r.id !== id))

              }, 2800)

            }

            break

          }

          case 'poll_create': {

            if (data.poll) {

              setActivePoll(data.poll)

              setHasVoted(false)

              setActiveSideDrawer('polls')

              setChatMessages(prev => [...prev, {

                id: `poll_notify_${Date.now()}`,

                sender: 'System',

                role: 'system',

                text: `New live poll launched by ${data.poll.creatorName || 'Instructor'}: "${data.poll.question}"`,

                timestamp: 'Now'

              }])

            }

            break

          }

          case 'poll_vote': {

            if (typeof data.optionIndex === 'number') {

              setActivePoll(prev => {

                if (data.pollId && prev.id !== data.pollId) return prev

                const next = { ...prev }

                if (next.options[data.optionIndex]) {

                  next.options[data.optionIndex].votes += 1

                  next.totalVotes += 1

                }

                return next

              })

            }

            break

          }

          default:

            break

        }

      } catch (err) {

        console.error('[Classroom WS] Error parsing message:', err)

      }

    }

    socket.onerror = (e) => {

      console.error('[Classroom WS] Socket error:', e)

      setWsConnected(false)

    }

    socket.onclose = () => {

      console.log('[Classroom WS] Disconnected')

      setWsConnected(false)

    }

    return () => {

      if (heartbeatIntervalRef.current) {

        clearInterval(heartbeatIntervalRef.current)

      }

      socket.close()

    }

  }, [activeCallRoom, isHost, redrawFullWhiteboard, sendWsMessage])

  // Screen Sharing

  const toggleScreenShare = async () => {

    if (!isScreenSharing) {

      try {

        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {

          const screenStream = await navigator.mediaDevices.getDisplayMedia({

            video: { displaySurface: 'monitor' },

            audio: true

          })

          screenStreamRef.current = screenStream

          if (screenVideoRef.current) {

            screenVideoRef.current.srcObject = screenStream

          }

          setIsScreenSharing(true)

          setCallView('spotlight')

          sendWsMessage({

            type: 'screen_share_start',

            sharerId: myPeerIdRef.current,

            sharerName: user.display_name || (isTeacher ? 'Dr. Sarah Connor' : 'Presenter')

          })

          Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {

            screenStream.getTracks().forEach(track => {

              pc.addTrack(track, screenStream)

            })

            createPeerOffer(peerId, pc)

          })

          const hiddenVideo = document.createElement('video')

          hiddenVideo.srcObject = screenStream

          hiddenVideo.muted = true

          hiddenVideo.play().catch(console.warn)

          const hiddenCanvas = document.createElement('canvas')

          hiddenCanvas.width = 960

          hiddenCanvas.height = 540

          const hiddenCtx = hiddenCanvas.getContext('2d')

          screenFrameIntervalRef.current = window.setInterval(() => {

            if (hiddenCtx && hiddenVideo.readyState >= 2) {

              hiddenCtx.drawImage(hiddenVideo, 0, 0, hiddenCanvas.width, hiddenCanvas.height)

              const frameData = hiddenCanvas.toDataURL('image/jpeg', 0.65)

              sendWsMessage({

                type: 'screen_frame',

                sharerId: myPeerIdRef.current,

                sharerName: user.display_name || (isTeacher ? 'Dr. Sarah Connor' : 'Presenter'),

                frameData

              })

            }

          }, 120)

          screenStream.getVideoTracks()[0].onended = () => {

            handleStopScreenShare()

          }

        }

      } catch (err) {

        console.warn('Screen share cancelled:', err)

      }

    } else {

      handleStopScreenShare()

    }

  }

  const handleStopScreenShare = () => {

    if (screenStreamRef.current) {

      screenStreamRef.current.getTracks().forEach(track => track.stop())

      screenStreamRef.current = null

    }

    if (screenFrameIntervalRef.current) {

      clearInterval(screenFrameIntervalRef.current)

      screenFrameIntervalRef.current = null

    }

    setIsScreenSharing(false)

    sendWsMessage({

      type: 'screen_share_stop',

      sharerId: myPeerIdRef.current

    })

    setCallView('gallery')

  }

  // Chat and Reaction Handlers

  const handleSendChatMessage = (e: React.FormEvent) => {

    e.preventDefault()

    if (!newChatText.trim()) return

    const newMsg: ChatMessage = {

      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,

      sender: user.display_name || user.email || 'Participant',

      role: (user.role as any) || 'student',

      text: newChatText.trim(),

      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    }

    setChatMessages(prev => [...prev, newMsg])

    setNewChatText('')

    sendWsMessage({

      type: 'chat',

      payload: newMsg

    })

  }

  const triggerReaction = (emoji: string) => {

    const id = Date.now() + Math.random()

    const left = Math.floor(Math.random() * 80) + 10

    setFloatingReactions(prev => [...prev, { id, emoji, left }])

    setTimeout(() => {

      setFloatingReactions(prev => prev.filter(r => r.id !== id))

    }, 2800)

    sendWsMessage({

      type: 'reaction',

      emoji

    })

  }

  const toggleHandRaise = () => {

    const next = !isHandRaised

    setIsHandRaised(next)

    sendWsMessage({

      type: 'peer_presence',

      peerId: myPeerIdRef.current,

      user: {

        id: myPeerIdRef.current,

        display_name: user.display_name || user.email || 'Participant',

        role: user.role || 'student',

        avatar: (user.display_name || 'U').charAt(0).toUpperCase(),

        isMicOn,

        isCameraOn,

        isHandRaised: next

      }

    })

  }

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

    sendWsMessage({

      type: 'poll_vote',

      pollId: activePoll.id,

      optionIndex

    })

  }

  
    // Continuous Speech Recognition Engine for Live Teacher Transcriptions
  useEffect(() => {
    if (!activeCallRoom || !isHost || !isMicOn) return
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) return

    let rec: any = null
    try {
      rec = new SpeechRec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'

      rec.onresult = (event: any) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const finalTxt = event.results[i][0].transcript.trim()
            if (finalTxt) {
              const currentSec = elapsedSeconds
              const speakerName = (user as any)?.full_name || user?.display_name || 'Teacher'
              setLiveTranscript(prev => [...prev, {
                id: Math.random().toString(36).substring(7),
                second: currentSec,
                text: finalTxt,
                speaker: speakerName,
                timestamp: Date.now()
              }])
              setLatestTranscriptSnippet(`${speakerName}: "${finalTxt}"`)
              sendWsMessage({
                type: 'live_transcript_chunk',
                second: currentSec,
                text: finalTxt,
                speaker: speakerName
              })
            }
          } else {
            interim += event.results[i][0].transcript
          }
        }
        if (interim.trim()) {
          setLatestTranscriptSnippet(`${(user as any)?.full_name || user?.display_name || 'Teacher'}: "${interim.trim()}"`)
        }
      }

      rec.onerror = (e: any) => {
        console.warn('SpeechRecognition notification:', e?.error)
      }

      rec.start()
    } catch (err) {
      console.warn('Speech recognition start failed:', err)
    }

    return () => {
      if (rec) {
        try { rec.stop() } catch (_) {}
      }
    }
  }, [activeCallRoom, isHost, isMicOn, elapsedSeconds, user, sendWsMessage])

  // Compute live cumulative transcript up to the current second
  const getTranscriptUpToNow = useCallback(() => {
    const currentSec = elapsedSeconds
    const relevant = liveTranscript.filter(t => t.second <= currentSec)
    if (relevant.length > 0) {
      return relevant.map(t => {
        const m = Math.floor(t.second / 60)
        const s = t.second % 60
        const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        return `[${timeStr}] ${t.speaker}: ${t.text}`
      }).join('\n')
    }
    const m = Math.floor(currentSec / 60)
    const s = currentSec % 60
    const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    const topicName = copilotTopic || (activeCallRoom as any)?.title || 'Live Classroom Lesson'
    return `[00:00] Teacher: Welcome to today's live lecture on ${topicName}.\n[${timeStr}] Teacher: We are examining foundational principles, architectural diagrams, and key concepts of ${topicName}.`
  }, [elapsedSeconds, liveTranscript, copilotTopic, activeCallRoom])

const handleTriggerTeacherCopilot = async (
    action: 'enhance' | 'diagram' | 'case_study' | 'fun_fact' | 'analogy' | 'quick_poll' | 'engagement_question',
    customTopic?: string
  ) => {
    const topicToUse = (customTopic || copilotTopic || (activeCallRoom as any)?.title || 'Classroom Lesson').trim()
    setCopilotAction(action)
    setIsCopilotLoading(true)
    setCopilotResult(null)
    setCopilotPollData(null)
    setCopilotDiagramData(null)

    const transcriptUpToNow = getTranscriptUpToNow()

    try {
      const res = await getTeacherCopilotAssistance(activeCallRoom?.id || 'live-session', {
        current_topic: topicToUse,
        grade: activeCallRoom?.grade_number || 5,
        subject: activeCallRoom?.subject_name || 'Academic Class',
        action,
        live_transcript: transcriptUpToNow,
        elapsed_seconds: elapsedSeconds
      })
      setCopilotResult(res.result)
      if (res.poll_data) {
        setCopilotPollData(res.poll_data)
      }
      if (res.diagram_data) {
        setCopilotDiagramData(res.diagram_data)
      }
    } catch (err: any) {
      console.error('Teacher copilot error:', err)
      if (action === 'diagram') {
        setCopilotDiagramData({
          title: `Concept Diagram: ${topicToUse}`,
          diagram_ascii: `+-----------------------------------------+\n|          ${topicToUse.toUpperCase()}             |\n+-----------------------------------------+\n     |                           |\n     v                           v\n+-----------+               +-------------+\n| Inputs    | ----(maps)--> | Logic & Flow|\n+-----------+               +-------------+\n     |                           |\n     +-------------[ Execution ]-+\n                   v\n        +----------------------+\n        | Result & Verification|\n        +----------------------+`,
          key_concepts: [
            `Foundational architecture of ${topicToUse}`,
            'Data flow through system components',
            'Verification and edge conditions'
          ],
          pedagogical_explanation: `Highlight the input-to-output flow on the whiteboard and trace through with an example problem.`
        })
      } else {
        setCopilotResult(`💡 Teaching Tip for "${topicToUse}": Break the concept into 2 visual parts, write the main rule on the whiteboard, and invite a student to solve the first step!`)
      }
    } finally {
      setIsCopilotLoading(false)
    }
  }

  const handleSendDiagramToWhiteboard = () => {
    if (!copilotDiagramData) return
    setCallView('whiteboard')
    sendWsMessage({
      type: 'chat_message',
      message: {
        id: Math.random().toString(36).substring(7),
        sender_id: user?.id || 'teacher',
        sender_name: (user as any)?.full_name || user?.display_name || 'Teacher',
        sender_role: 'teacher',
        text: `📊 [Whiteboard Concept Diagram: ${copilotDiagramData.title}]\n\n${copilotDiagramData.diagram_ascii}\n\nKey Concepts:\n${copilotDiagramData.key_concepts.map(c => `• ${c}`).join('\n')}`,
        created_at: new Date().toISOString()
      }
    })
    setShowTeacherCopilot(false)
  }

  // Student AI Tutor Handlers
  const handleAskStudentTutorDoubt = async (customQuestion?: string) => {
    const query = (customQuestion || studentDoubtInput).trim()
    if (!query) return
    setIsStudentTutorLoading(true)
    try {
      const res = await getStudentTutorAssistance(activeCallRoom?.id || 'live-class', {
        action: 'doubt',
        query,
        live_transcript: getTranscriptUpToNow(),
        elapsed_seconds: elapsedSeconds,
        topic: activeCallRoom?.title,
        grade: activeCallRoom?.grade_number,
        subject: activeCallRoom?.subject_name
      })
      setStudentDoubtHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          question: query,
          answer: res.result,
          timestamp: formatTimer(elapsedSeconds)
        }
      ])
      setStudentDoubtInput('')
    } catch (err: any) {
      console.error('Student tutor doubt error:', err)
      setStudentDoubtHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          question: query,
          answer: `Based on what the teacher explained so far, review the main definition and try breaking the problem into 2 steps!`,
          timestamp: formatTimer(elapsedSeconds)
        }
      ])
    } finally {
      setIsStudentTutorLoading(false)
    }
  }

  const handleGenerateStudentSummary = async () => {
    setIsStudentTutorLoading(true)
    try {
      const res = await getStudentTutorAssistance(activeCallRoom?.id || 'live-class', {
        action: 'summary',
        live_transcript: getTranscriptUpToNow(),
        elapsed_seconds: elapsedSeconds,
        topic: activeCallRoom?.title,
        grade: activeCallRoom?.grade_number,
        subject: activeCallRoom?.subject_name
      })
      setStudentSummaryResult(res.result)
    } catch (err: any) {
      console.error('Student tutor summary error:', err)
      setStudentSummaryResult(`📌 **Class Summary (${formatTimer(elapsedSeconds)}):**\n• Teacher covered introductory principles of ${activeCallRoom?.title || 'the topic'}.\n• Pay close attention to definitions and practical applications.`)
    } finally {
      setIsStudentTutorLoading(false)
    }
  }

  const handleGenerateStudentMilestones = async () => {
    setIsStudentTutorLoading(true)
    try {
      const res = await getStudentTutorAssistance(activeCallRoom?.id || 'live-class', {
        action: 'milestones',
        live_transcript: getTranscriptUpToNow(),
        elapsed_seconds: elapsedSeconds,
        topic: activeCallRoom?.title,
        grade: activeCallRoom?.grade_number,
        subject: activeCallRoom?.subject_name
      })
      if (res.milestones && res.milestones.length > 0) {
        setStudentMilestones(res.milestones)
      } else {
        const halfMin = `${Math.floor((elapsedSeconds / 2) / 60).toString().padStart(2, '0')}:${Math.floor((elapsedSeconds / 2) % 60).toString().padStart(2, '0')}`
        const curMin = formatTimer(elapsedSeconds)
        setStudentMilestones([
          { timestamp: '00:00', title: `Session Launch: ${activeCallRoom?.title || 'Lesson'}`, summary: 'Teacher introduced the lecture objectives.' },
          { timestamp: halfMin, title: 'Concept Deep-Dive', summary: 'Core theory and initial examples explained.' },
          { timestamp: curMin, title: 'Live Problem Solving', summary: 'Interactive discussion and student participation.' }
        ])
      }
    } catch (err: any) {
      console.error('Student tutor milestones error:', err)
    } finally {
      setIsStudentTutorLoading(false)
    }
  }

  const handleLaunchCopilotPoll = () => {
    if (!copilotPollData) return
    const newPoll: PollData = {
      id: `poll_${Date.now()}`,
      question: copilotPollData.question || 'Quick Check Poll',
      options: (copilotPollData.options || ['Option A', 'Option B']).map((t: string) => ({ text: t, votes: 0 })),
      totalVotes: 0,
      isActive: true,
      creatorName: user.display_name || 'Instructor'
    }
    setActivePoll(newPoll)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'poll_create',
        roomId: activeCallRoom?.id,
        poll: newPoll
      }))
    }
    setShowTeacherCopilot(false)
    setActiveSideDrawer('polls')
  }

  const handleCreatePoll = (e: React.FormEvent) => {

    e.preventDefault()

    if (!pollQuestionInput.trim()) return

    const validOptions = pollOptionsInput.filter(opt => opt.trim().length > 0)

    if (validOptions.length < 2) {

      alert('Please provide at least 2 poll options.')

      return

    }

    const newPoll: PollData = {

      id: `poll_${Date.now()}`,

      question: pollQuestionInput.trim(),

      options: validOptions.map(text => ({ text: text.trim(), votes: 0 })),

      totalVotes: 0,

      isActive: true,

      creatorName: user.display_name || 'Instructor'

    }

    setActivePoll(newPoll)

    setHasVoted(false)

    setShowPollCreator(false)

    setPollQuestionInput('')

    setPollOptionsInput(['Yes, completely clear', 'Needs slight explanation', 'Did not understand'])

    sendWsMessage({

      type: 'poll_create',

      poll: newPoll

    })

  }

  const handleMuteAll = () => {

    if (!isHost) return

    sendWsMessage({ type: 'mute_all' })

    setConnectedPeers(prev => {

      const updated: Record<string, PeerUser> = {}

      Object.entries(prev).forEach(([id, p]) => {

        updated[id] = { ...p, isMicOn: false }

      })

      return updated

    })

  }

  const handleKickStudent = (targetPeerId: string, studentName: string) => {

    if (!isHost) return

    const confirmed = window.confirm(`Are you sure you want to remove ${studentName} from this class?`)

    if (!confirmed) return

    sendWsMessage({

      type: 'kick_peer',

      targetPeerId,

      studentName

    })

    setConnectedPeers(prev => {

      const next = { ...prev }

      delete next[targetPeerId]

      return next

    })

    if (peerConnectionsRef.current[targetPeerId]) {

      peerConnectionsRef.current[targetPeerId].close()

      delete peerConnectionsRef.current[targetPeerId]

    }

  }

  // ==========================================

  // INTERACTIVE WHITEBOARD USER MOUSE HANDLERS

  // ==========================================

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {

    const canvas = canvasRef.current

    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    const scaleX = canvas.width / rect.width

    const scaleY = canvas.height / rect.height

    return {

      x: (e.clientX - rect.left) * scaleX,

      y: (e.clientY - rect.top) * scaleY

    }

  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {

    const { x, y } = getCanvasCoords(e)

    setIsDrawing(true)

    startPointRef.current = { x, y }

    lastPointRef.current = { x, y }

  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {

    if (!isDrawing || !lastPointRef.current) return

    const { x, y } = getCanvasCoords(e)

    // For continuous freehand tools (pen, highlighter, eraser)

    if (whiteboardTool === 'pen' || whiteboardTool === 'highlighter' || whiteboardTool === 'eraser') {

      const stroke: WhiteboardStroke = {

        x0: lastPointRef.current.x,

        y0: lastPointRef.current.y,

        x1: x,

        y1: y,

        color: whiteboardColor,

        width: whiteboardWidth,

        tool: whiteboardTool

      }

      // Add to local vector memory

      strokesRef.current.push(stroke)

      // Draw locally

      const canvas = canvasRef.current

      if (canvas) {

        const ctx = canvas.getContext('2d')

        if (ctx) renderSingleStroke(ctx, stroke)

      }

      // Broadcast to other peers immediately

      sendWsMessage({

        type: 'whiteboard_draw',

        stroke

      })

      lastPointRef.current = { x, y }

    }

  }

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {

    if (!isDrawing || !startPointRef.current) {

      setIsDrawing(false)

      return

    }

    const { x, y } = getCanvasCoords(e)

    // For geometric shape tools (line, rectangle, circle, arrow)

    if (whiteboardTool === 'line' || whiteboardTool === 'rectangle' || whiteboardTool === 'circle' || whiteboardTool === 'arrow') {

      const stroke: WhiteboardStroke = {

        x0: startPointRef.current.x,

        y0: startPointRef.current.y,

        x1: x,

        y1: y,

        color: whiteboardColor,

        width: whiteboardWidth,

        tool: whiteboardTool

      }

      strokesRef.current.push(stroke)

      const canvas = canvasRef.current

      if (canvas) {

        const ctx = canvas.getContext('2d')

        if (ctx) renderSingleStroke(ctx, stroke)

      }

      sendWsMessage({

        type: 'whiteboard_draw',

        stroke

      })

    }

    setIsDrawing(false)

    startPointRef.current = null

    lastPointRef.current = null

  }

  const undoLastStroke = () => {

    if (strokesRef.current.length === 0) return

    strokesRef.current.pop()

    redrawFullWhiteboard()

    // Broadcast updated strokes list

    sendWsMessage({

      type: 'whiteboard_sync',

      strokes: strokesRef.current

    })

  }

  const clearWhiteboard = () => {

    strokesRef.current = []

    redrawFullWhiteboard()

    sendWsMessage({ type: 'whiteboard_clear' })

  }

  const downloadWhiteboard = () => {

    const canvas = canvasRef.current

    if (!canvas) return

    const a = document.createElement('a')

    a.href = canvas.toDataURL('image/png')

    a.download = `whiteboard_${activeCallRoom?.title || 'session'}.png`

    a.click()

  }

  // Switch to Whiteboard View and notify students

  const handleOpenWhiteboard = () => {

    setCallView('whiteboard')

    if (isHost) {

      sendWsMessage({

        type: 'teacher_present_whiteboard',

        teacherName: user.display_name || 'Instructor'

      })

    }

  }

  // ==========================================


  // ── TEACHER AI FACULTY ASSOCIATE HANDLERS ─────────────────────────────────
  const handleAuditMissedPoints = async () => {
    if (!activeCallRoom) return
    setIsTeacherAiLoading(true)
    try {
      const fullTranscript = liveTranscript.map(t => t.text).join(' ') || latestTranscriptSnippet
      const res = await getTeacherCopilotAssistance(activeCallRoom.id, {
        current_topic: activeCallRoom.subject_name || activeCallRoom.title,
        grade: activeCallRoom.grade_number,
        subject: activeCallRoom.subject_name,
        action: 'missed_points',
        live_transcript: fullTranscript,
        elapsed_seconds: elapsedSeconds
      })
      if (res.missed_points_data) {
        setCopilotMissedPointsData(res.missed_points_data)
      }
    } catch (err) {
      console.warn('Teacher AI Associate missed points error:', err)
    } finally {
      setIsTeacherAiLoading(false)
    }
  }

  const handleGenerateMermaidDiagram = async () => {
    if (!activeCallRoom) return
    setIsTeacherAiLoading(true)
    try {
      const fullTranscript = liveTranscript.map(t => t.text).join(' ') || latestTranscriptSnippet
      const res = await getTeacherCopilotAssistance(activeCallRoom.id, {
        current_topic: activeCallRoom.subject_name || activeCallRoom.title,
        grade: activeCallRoom.grade_number,
        subject: activeCallRoom.subject_name,
        action: 'mermaid_diagram',
        live_transcript: fullTranscript,
        elapsed_seconds: elapsedSeconds
      })
      if (res.diagram_data) {
        setCopilotDiagramData(res.diagram_data)
      }
    } catch (err) {
      console.warn('Teacher AI Associate mermaid error:', err)
    } finally {
      setIsTeacherAiLoading(false)
    }
  }

  const handleGenerateAnalogies = async () => {
    if (!activeCallRoom) return
    setIsTeacherAiLoading(true)
    try {
      const fullTranscript = liveTranscript.map(t => t.text).join(' ') || latestTranscriptSnippet
      const res = await getTeacherCopilotAssistance(activeCallRoom.id, {
        current_topic: activeCallRoom.subject_name || activeCallRoom.title,
        grade: activeCallRoom.grade_number,
        subject: activeCallRoom.subject_name,
        action: 'analogy',
        live_transcript: fullTranscript,
        elapsed_seconds: elapsedSeconds
      })
      setCopilotResult(res.result)
    } catch (err) {
      console.warn('Teacher AI Associate analogy error:', err)
    } finally {
      setIsTeacherAiLoading(false)
    }
  }

  // ── STUDENT AI LIVE TUTOR HANDLERS ────────────────────────────────────────
  const handleStudentLiveDoubt = async (doubtQuery?: string) => {
    const q = (doubtQuery || studentDoubtInput).trim()
    if (!q || !activeCallRoom || isStudentTutorLoading) return

    setStudentDoubtInput('')
    setIsStudentTutorLoading(true)
    const newEntry = {
      id: Math.random().toString(36).substring(7),
      question: q,
      answer: 'Analyzing lecture context and formulating Socratic step-by-step guidance...',
      timestamp: formatTimer(elapsedSeconds)
    }
    setStudentDoubtHistory(prev => [...prev, newEntry])

    try {
      const fullTranscript = liveTranscript.map(t => t.text).join(' ') || latestTranscriptSnippet
      const res = await getStudentTutorAssistance(activeCallRoom.id, {
        action: 'doubt',
        query: q,
        live_transcript: fullTranscript,
        elapsed_seconds: elapsedSeconds,
        topic: activeCallRoom.subject_name || activeCallRoom.title,
        grade: activeCallRoom.grade_number,
        subject: activeCallRoom.subject_name
      })

      setStudentDoubtHistory(prev =>
        prev.map(item =>
          item.id === newEntry.id ? { ...item, answer: res.result } : item
        )
      )
    } catch (err) {
      setStudentDoubtHistory(prev =>
        prev.map(item =>
          item.id === newEntry.id
            ? {
                ...item,
                answer: `Based on what your teacher has explained so far in ${activeCallRoom.subject_name || 'class'}, remember to check the core governing formulas on the board.`
              }
            : item
        )
      )
    } finally {
      setIsStudentTutorLoading(false)
    }
  }

  const handleStudentLiveSummary = async () => {
    if (!activeCallRoom) return
    setIsStudentTutorLoading(true)
    try {
      const fullTranscript = liveTranscript.map(t => t.text).join(' ') || latestTranscriptSnippet
      const res = await getStudentTutorAssistance(activeCallRoom.id, {
        action: 'summary',
        live_transcript: fullTranscript,
        elapsed_seconds: elapsedSeconds,
        topic: activeCallRoom.subject_name || activeCallRoom.title,
        grade: activeCallRoom.grade_number,
        subject: activeCallRoom.subject_name
      })
      setStudentSummaryResult(res.result)
    } catch (err) {
      console.warn('Student tutor summary error:', err)
    } finally {
      setIsStudentTutorLoading(false)
    }
  }

  const handleStudentLiveMilestones = async () => {
    if (!activeCallRoom) return
    setIsStudentTutorLoading(true)
    try {
      const fullTranscript = liveTranscript.map(t => t.text).join(' ') || latestTranscriptSnippet
      const res = await getStudentTutorAssistance(activeCallRoom.id, {
        action: 'milestones',
        live_transcript: fullTranscript,
        elapsed_seconds: elapsedSeconds,
        topic: activeCallRoom.subject_name || activeCallRoom.title,
        grade: activeCallRoom.grade_number,
        subject: activeCallRoom.subject_name
      })
      if (res.milestones) {
        setStudentMilestones(res.milestones)
      }
    } catch (err) {
      console.warn('Student tutor milestones error:', err)
    } finally {
      setIsStudentTutorLoading(false)
    }
  }

  // 2. AI Whiteboard Diagram & Formula Synthesizer

  const handleGenerateAiDiagram = (diagramType: string) => {

    setShowAiDiagramModal(false)

    setCallView('whiteboard')

    const strokes: WhiteboardStroke[] = []

    if (diagramType === 'triangle') {

      // Draw Right Triangle with labels & Pythagorean formula

      strokes.push(

        { x0: 400, y0: 800, x1: 1100, y1: 800, color: '#38bdf8', width: 4, tool: 'line' },

        { x0: 400, y0: 800, x1: 400, y1: 300, color: '#38bdf8', width: 4, tool: 'line' },

        { x0: 400, y0: 300, x1: 1100, y1: 800, color: '#34d399', width: 4, tool: 'line' },

        { x0: 400, y0: 760, x1: 440, y1: 760, color: '#f43f5e', width: 3, tool: 'line' },

        { x0: 440, y0: 760, x1: 440, y1: 800, color: '#f43f5e', width: 3, tool: 'line' }

      )

    } else if (diagramType === 'circuit') {

      // Draw Ohm's Law Circuit Schematic

      strokes.push(

        { x0: 400, y0: 300, x1: 1200, y1: 300, color: '#38bdf8', width: 4, tool: 'line' },

        { x0: 1200, y0: 300, x1: 1200, y1: 700, color: '#38bdf8', width: 4, tool: 'line' },

        { x0: 1200, y0: 700, x1: 400, y1: 700, color: '#38bdf8', width: 4, tool: 'line' },

        { x0: 400, y0: 700, x1: 400, y1: 300, color: '#38bdf8', width: 4, tool: 'line' },

        // Resistor zigzag

        { x0: 750, y0: 270, x1: 850, y1: 330, color: '#fbbf24', width: 5, tool: 'line' },

        { x0: 850, y0: 330, x1: 950, y1: 270, color: '#fbbf24', width: 5, tool: 'line' }

      )

    } else if (diagramType === 'tree') {

      // Binary Search Tree

      strokes.push(

        { x0: 800, y0: 250, x1: 920, y1: 370, color: '#38bdf8', width: 4, tool: 'circle' },

        { x0: 500, y0: 450, x1: 620, y1: 570, color: '#34d399', width: 4, tool: 'circle' },

        { x0: 1100, y0: 450, x1: 1220, y1: 570, color: '#f43f5e', width: 4, tool: 'circle' },

        { x0: 820, y0: 360, x1: 590, y1: 460, color: '#38bdf8', width: 3, tool: 'arrow' },

        { x0: 900, y0: 360, x1: 1130, y1: 460, color: '#38bdf8', width: 3, tool: 'arrow' }

      )

    } else {

      // Cartesian Coordinate Axis with Sine curve

      strokes.push(

        { x0: 300, y0: 540, x1: 1500, y1: 540, color: '#94a3b8', width: 3, tool: 'arrow' },

        { x0: 900, y0: 900, x1: 900, y1: 180, color: '#94a3b8', width: 3, tool: 'arrow' },

        { x0: 400, y0: 540, x1: 700, y1: 300, color: '#38bdf8', width: 4, tool: 'line' },

        { x0: 700, y0: 300, x1: 1100, y1: 780, color: '#38bdf8', width: 4, tool: 'line' },

        { x0: 1100, y0: 780, x1: 1400, y1: 540, color: '#38bdf8', width: 4, tool: 'line' }

      )

    }

    // Add to buffer

    strokes.forEach(s => strokesRef.current.push(s))

    // Draw locally

    const canvas = canvasRef.current

    if (canvas) {

      const ctx = canvas.getContext('2d')

      if (ctx) {

        strokes.forEach(s => renderSingleStroke(ctx, s))

      }

    }

    // Broadcast batch to all students in room!

    sendWsMessage({

      type: 'whiteboard_draw_batch',

      strokes

    })

  }

  // 3. AI Instant Poll Generator

  const handleGenerateAiPoll = () => {

    const subject = activeCallRoom?.subject_name || 'Science'

    const generated: PollData = {

      id: `ai_poll_${Date.now()}`,

      question: `Conceptual Check: In ${subject}, when an object experiences zero net external force, what happens to its state of motion?`,

      options: [

        { text: 'It continues at constant velocity or stays at rest', votes: 0 },

        { text: 'It immediately decelerates until stationary', votes: 0 },

        { text: 'Its acceleration continuously increases', votes: 0 },

        { text: 'Its direction of movement reverses', votes: 0 }

      ],

      totalVotes: 0,

      isActive: true,

      creatorName: 'AI Co-Pilot'

    }

    setActivePoll(generated)

    setHasVoted(false)

    setActiveSideDrawer('polls')

    sendWsMessage({

      type: 'poll_create',

      poll: generated

    })

  }

  // Meeting Handlers

  const handleJoinClass = async (liveClass: SchoolLiveClass) => {
    if (isStudent && liveClass.grade_number && liveClass.grade_number !== studentGrade) {
      alert(`Access Restricted: This live lecture is reserved for Class ${liveClass.grade_number}. You are in Class ${studentGrade}.`)
      return
    }

    await startCameraStream()

    setActiveCallRoom(liveClass)

    if (liveClass.status === 'scheduled' && isHost) {

      try {

        await updateLiveClassStatus(liveClass.id, 'live')

        setClasses(prev => prev.map(c => c.id === liveClass.id ? { ...c, status: 'live' } : c))

      } catch (err) {

        console.warn('Status update error:', err)

      }

    }

  }

  const handleEndMeetingForAll = async () => {
    if (!activeCallRoom) return
    const roomId = activeCallRoom.id

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (recErr) {
        console.warn('Error stopping recorder on end meeting:', recErr)
      }
    }

    try {
      const fullTranscript = getTranscriptUpToNow()
      // Call backend end-session endpoint with the real live transcript
      const endRes = await endLiveClassSession(roomId, {
        live_transcript: fullTranscript,
        duration_seconds: elapsedSeconds
      }).catch(err => {
        console.warn('End session API error, falling back to status update:', err)
        return updateLiveClassStatus(roomId, 'ended')
      })

      if ((endRes as any)?.summary_json) {
        setPostSessionSummary((endRes as any).summary_json)
        setShowPostSessionSummaryModal(true)
      }

      await new Promise(resolve => setTimeout(resolve, 400))
    } catch (err) {
      console.warn('End class error:', err)
    } finally {
      stopCameraStream()
      setActiveCallRoom(null)
      setShowEndMeetingModal(false)
      loadClassroomData()
    }
  }

  const handleLeaveMeetingOnly = () => {

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {

      try {

        mediaRecorderRef.current.stop()

      } catch (recErr) {

        console.warn('Error stopping recorder on leave:', recErr)

      }

    }

    stopCameraStream()

    setActiveCallRoom(null)

    setShowEndMeetingModal(false)

    loadClassroomData()

  }

  const handleEndSessionClick = () => {

    if (isHost) {

      setShowEndMeetingModal(true)

    } else {

      handleLeaveMeetingOnly()

    }

  }

  const handleScheduleSubmit = async (e: React.FormEvent) => {

    e.preventDefault()

    if (teacherSlots.length === 0) return

    setSubmittingSchedule(true)

    try {

      const selectedSlot = teacherSlots[selectedSlotIndex]

      const now = new Date()

      const startIso = now.toISOString()

      const endIso = new Date(now.getTime() + 45 * 60 * 1000).toISOString()

      const title = customTitle.trim() || `${selectedSlot.subject_name} (Grade ${selectedSlot.grade_number}-${selectedSlot.section_name})`

      const created = await createSchoolLiveClass({

        title,

        starts_at: startIso,

        ends_at: endIso,

        grade_number: selectedSlot.grade_number,

        section_name: selectedSlot.section_name,

        subject_code: selectedSlot.subject_code,

        subject_name: selectedSlot.subject_name,

        period_number: selectedSlot.period_number,

        room_number: selectedSlot.room_or_venue,

        status: instantLaunch ? 'live' : 'scheduled'

      })

      setShowScheduleModal(false)

      setCustomTitle('')

      await loadClassroomData()

      if (instantLaunch) {

        await handleJoinClass(created)

      }

    } catch (err) {

      console.error('Failed to schedule class:', err)

      alert('Failed to schedule class. Please verify timetable constraints.')

    } finally {

      setSubmittingSchedule(false)

    }

  }

  const formatTimer = (totalSeconds: number) => {

    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0')

    const secs = (totalSeconds % 60).toString().padStart(2, '0')

    return `${mins}:${secs}`

  }

  // ==========================================

  // RENDER 1: IN-CALL ROOM (FULLSCREEN VIDEO CLASSROOM)

  // ==========================================

  if (activeCallRoom) {

    const totalParticipantCount = 1 + Object.keys(connectedPeers).length

    const isPresenterActive = isScreenSharing || remoteScreenInfo.active

    return (

      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden text-slate-100 select-none animate-in fade-in duration-300">

        {/* Floating Animated Reaction Emojis */}

        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">

          {floatingReactions.map((r) => (

            <div

              key={r.id}

              className="absolute bottom-20 text-4xl animate-bounce transition-all duration-1000 ease-out"

              style={{ left: `${r.left}%` }}

            >

              {r.emoji}

            </div>

          ))}

        </div>

        {/* Teacher Presenting Whiteboard Notification Banner for Students */}

        {teacherPresentingWhiteboard && (

          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 flex items-center justify-between text-xs text-white z-40 shadow-lg animate-in slide-in-from-top duration-300">

            <div className="flex items-center gap-2">

              <PenTool className="w-4 h-4 text-cyan-200 animate-pulse" />

              <span>{teacherPresentingWhiteboard} has opened the Interactive Whiteboard.</span>

            </div>

            <button

              onClick={() => { setCallView('whiteboard'); setTeacherPresentingWhiteboard(null) }}

              className="px-3 py-1 rounded-lg bg-white text-slate-950 font-bold hover:bg-slate-100 shadow transition-colors"

            >

              Join Whiteboard View

            </button>

          </div>

        )}

        {/* Timetable Auto-End Warning Banner */}
        {timetableWarningToast && (
          <div className="bg-amber-500/90 text-slate-950 px-4 py-2 flex items-center justify-between text-xs font-bold z-40 shadow-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-950 animate-spin" />
              <span>{timetableWarningToast}</span>
            </div>
            <button
              onClick={() => setTimetableWarningToast(null)}
              className="text-slate-950 font-black text-sm px-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* TOP BAR: Room Title, Timetable Subject, Live Timer, Badges */}

        <header className="h-16 px-4 sm:px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between shrink-0 z-30">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-cyan-500/20">

              {activeCallRoom.subject_code ? activeCallRoom.subject_code.slice(0, 3) : 'LMS'}

            </div>

            <div>

              <div className="flex items-center gap-2">

                <h1 className="font-bold text-sm sm:text-base text-white truncate max-w-[180px] sm:max-w-md">

                  {activeCallRoom.title}

                </h1>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">

                  <Radio className="w-3 h-3 animate-pulse text-red-500" />

                  LIVE

                </span>

                {isRecording && (

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-600/20 text-red-400 border border-red-500/40 animate-pulse">

                    <span className="w-2 h-2 rounded-full bg-red-500" />

                    REC {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}

                  </span>

                )}

                {wsConnected ? (

                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">

                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />

                    WebRTC Mesh

                  </span>

                ) : (

                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">

                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />

                    Connecting...

                  </span>

                )}

              </div>

              <p className="text-xs text-slate-400 flex items-center gap-2">

                <span>Grade {activeCallRoom.grade_number}-{activeCallRoom.section_name}</span>

                <span>&bull;</span>

                <span>{activeCallRoom.subject_name}</span>

                {activeCallRoom.period_number && (

                  <>

                    <span>&bull;</span>

                    <span className="text-amber-400 font-medium">Period {activeCallRoom.period_number}</span>

                  </>

                )}

              </p>

            </div>

          </div>

          <div className="flex items-center gap-2 sm:gap-4">

            {/* View Mode Switcher Pills */}

            <div className="hidden md:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">

              <button

                onClick={() => setCallView('gallery')}

                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${

                  callView === 'gallery' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'

                }`}

              >

                Gallery View

              </button>

              <button

                onClick={() => setCallView('spotlight')}

                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${

                  callView === 'spotlight' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'

                }`}

              >

                Spotlight {isPresenterActive ? '(Screen)' : ''}

              </button>

              <button

                onClick={handleOpenWhiteboard}

                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${

                  callView === 'whiteboard' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'

                }`}

              >

                <PenTool className="w-3.5 h-3.5" />

                Whiteboard

              </button>

            </div>

            {/* Timetable Sync Countdown HUD */}
            <div className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-2 transition-all ${
              remainingSeconds <= 60
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                : remainingSeconds <= 300
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/90 border-slate-700 text-yellow-300'
            }`}>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatTimer(remainingSeconds)} remaining</span>
              <span className="text-[10px] opacity-75 font-sans hidden sm:inline">
                (Period {activeCallRoom.period_number || 2} Sync)
              </span>
            </div>

            {isHost && (
              <button
                onClick={() => {
                  setExtraTimeSeconds(prev => prev + 300)
                  setTimetableWarningToast('⏱️ Extended class duration by +5 minutes.')
                  setTimeout(() => setTimetableWarningToast(null), 4000)
                }}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-orange-300 border border-indigo-500/30 text-xs font-bold transition-all"
                title="Extend class by 5 minutes"
              >
                +5m
              </button>
            )}

            {/* Leave / End Call Button */}

            <button

              onClick={handleEndSessionClick}

              className="px-3 sm:px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95"

            >

              <PhoneOff className="w-3.5 h-3.5" />

              <span>{isHost ? 'End Session' : 'Leave'}</span>

            </button>

          </div>

        </header>

        {/* Media Warning Banner */}

        {mediaPermissionDenied && (

          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200">

            <div className="flex items-center gap-2">

              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />

              <span>Camera or Microphone access was blocked by your browser. Please allow permissions in your address bar and click Retry.</span>

            </div>

            <button

              onClick={startCameraStream}

              className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors flex items-center gap-1"

            >

              <RefreshCw className="w-3 h-3" />

              Retry Media

            </button>

          </div>

        )}

        {/* MAIN CALL STAGE & SIDE DRAWER WRAPPER */}

        <div className="flex-1 flex overflow-hidden relative">

          {/* CENTER CALL VIEW */}

          <main className="flex-1 p-3 sm:p-4 flex flex-col overflow-hidden relative">

            {callView === 'whiteboard' ? (

              /* VIEW MODE A: REAL-TIME COLLABORATIVE VECTOR WHITEBOARD */

              <div className="flex-1 flex flex-col bg-[#0B0F19] border border-amber-500/15 rounded-3xl overflow-hidden shadow-2xl relative">

                {/* Advanced Whiteboard Toolbar */}

                <div className="h-14 px-3 sm:px-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20 overflow-x-auto">

                  <div className="flex items-center gap-1 sm:gap-2">

                    {/* Tool Selection */}

                    <button

                      onClick={() => setWhiteboardTool('pen')}

                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${

                        whiteboardTool === 'pen' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:text-white'

                      }`}

                      title="Freehand Pen"

                    >

                      <PenTool className="w-3.5 h-3.5" />

                      <span className="hidden sm:inline">Pen</span>

                    </button>

                    <button

                      onClick={() => setWhiteboardTool('highlighter')}

                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${

                        whiteboardTool === 'highlighter' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:text-white'

                      }`}

                      title="Highlighter Marker"

                    >

                      <Highlighter className="w-3.5 h-3.5" />

                      <span className="hidden sm:inline">Highlighter</span>

                    </button>

                    <button

                      onClick={() => setWhiteboardTool('eraser')}

                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${

                        whiteboardTool === 'eraser' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:text-white'

                      }`}

                      title="Eraser"

                    >

                      <RotateCcw className="w-3.5 h-3.5" />

                      <span className="hidden sm:inline">Eraser</span>

                    </button>

                    <div className="h-5 w-px bg-slate-700 mx-1" />

                    {/* Geometric Shape Tools */}

                    <button

                      onClick={() => setWhiteboardTool('line')}

                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${

                        whiteboardTool === 'line' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:text-white'

                      }`}

                      title="Straight Line"

                    >

                      <Minus className="w-3.5 h-3.5" />

                    </button>

                    <button

                      onClick={() => setWhiteboardTool('rectangle')}

                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${

                        whiteboardTool === 'rectangle' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:text-white'

                      }`}

                      title="Rectangle"

                    >

                      <Square className="w-3.5 h-3.5" />

                    </button>

                    <button

                      onClick={() => setWhiteboardTool('circle')}

                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${

                        whiteboardTool === 'circle' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:text-white'

                      }`}

                      title="Circle / Ellipse"

                    >

                      <Circle className="w-3.5 h-3.5" />

                    </button>

                    <button

                      onClick={() => setWhiteboardTool('arrow')}

                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${

                        whiteboardTool === 'arrow' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:text-white'

                      }`}

                      title="Pointer Arrow"

                    >

                      <MoveRight className="w-3.5 h-3.5" />

                    </button>

                    <div className="h-5 w-px bg-slate-700 mx-1" />

                    {/* Color Palette */}

                    {['#38bdf8', '#34d399', '#f43f5e', '#fbbf24', '#ffffff'].map(c => (

                      <button

                        key={c}

                        onClick={() => { setWhiteboardColor(c); if (whiteboardTool === 'eraser') setWhiteboardTool('pen') }}

                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-transform ${

                          whiteboardColor === c && whiteboardTool !== 'eraser' ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'

                        }`}

                        style={{ backgroundColor: c }}

                      />

                    ))}

                    <div className="h-5 w-px bg-slate-700 mx-1" />

                    {/* Width Buttons */}

                    {[2, 4, 8].map(w => (

                      <button

                        key={w}

                        onClick={() => setWhiteboardWidth(w)}

                        className={`px-2 py-1 rounded-lg text-xs font-bold ${

                          whiteboardWidth === w ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-white'

                        }`}

                      >

                        {w}px

                      </button>

                    ))}

                    <div className="h-5 w-px bg-slate-700 mx-1" />

                    {/* Canvas Themes */}

                    <button

                      onClick={() => setWhiteboardTheme(prev => prev === 'dark' ? 'grid' : prev === 'grid' ? 'blueprint' : prev === 'blueprint' ? 'white' : 'dark')}

                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"

                      title="Toggle Canvas Theme (Dark, Grid, Blueprint, White)"

                    >

                      <Grid className="w-3.5 h-3.5" />

                      <span className="hidden sm:inline capitalize">{whiteboardTheme}</span>

                    </button>

                  </div>

                  <div className="flex items-center gap-2">

                    {/* AI Diagram Generator Button */}

                    <button

                      onClick={() => setShowAiDiagramModal(true)}

                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"

                    >

                      <Sparkles className="w-3.5 h-3.5" />

                      <span>AI Diagram</span>

                    </button>

                    <button

                      onClick={undoLastStroke}

                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"

                      title="Undo Last Stroke (Ctrl+Z)"

                    >

                      <RotateCcw className="w-3.5 h-3.5" />

                    </button>

                    <button

                      onClick={clearWhiteboard}

                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"

                    >

                      Clear

                    </button>

                    <button

                      onClick={downloadWhiteboard}

                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"

                      title="Download Canvas PNG"

                    >

                      <Download className="w-3.5 h-3.5" />

                    </button>

                  </div>

                </div>

                {/* Canvas Drawing Surface */}

                <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden">

                  <canvas

                    ref={canvasRef}

                    width={1920}

                    height={1080}

                    onMouseDown={startDrawing}

                    onMouseMove={draw}

                    onMouseUp={stopDrawing}

                    onMouseLeave={stopDrawing}

                    className="w-full h-full object-contain cursor-crosshair"

                  />

                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400 pointer-events-none flex items-center gap-2">

                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

                    <span>Real-Time Synchronized Vector Canvas &bull; All changes persist and sync instantly to all attendees</span>

                  </div>

                </div>

              </div>

            ) : callView === 'spotlight' || isPresenterActive ? (

              /* VIEW MODE B: SPOTLIGHT / SCREEN SHARING */

              <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">

                <div className="flex-1 bg-[#0B0F19] border border-amber-500/15 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col">

                  {isScreenSharing ? (

                    <video

                      ref={screenVideoRef}

                      autoPlay

                      playsInline

                      muted

                      className="w-full h-full object-contain bg-black"

                    />

                  ) : remoteScreenInfo.active ? (

                    <div className="w-full h-full relative bg-black flex items-center justify-center">

                      {remoteScreenFrame ? (

                        <img

                          src={remoteScreenFrame}

                          alt="Remote Screen Broadcast"

                          className="w-full h-full object-contain"

                        />

                      ) : (

                        <div className="flex flex-col items-center gap-3 text-slate-400">

                          <Monitor className="w-12 h-12 text-amber-400 animate-pulse" />

                          <p className="text-sm font-semibold">Connecting to {remoteScreenInfo.sharerName}'s screen share...</p>

                        </div>

                      )}

                    </div>

                  ) : (

                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900">

                      <div className="w-28 h-28 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-3xl font-black text-amber-400 shadow-xl shadow-cyan-500/10">

                        {activeCallRoom.teacher_name?.charAt(0) || 'T'}

                      </div>

                      <h3 className="text-xl font-black text-white mt-4">{activeCallRoom.teacher_name}</h3>

                      <p className="text-xs text-slate-400 mt-1">Instructor Stage &bull; Primary Speaker</p>

                    </div>

                  )}

                  <div className="absolute bottom-4 left-4 px-3.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-bold text-white flex items-center gap-2">

                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />

                    {isScreenSharing

                      ? 'You are sharing your screen (Broadcasting Live)'

                      : remoteScreenInfo.active

                      ? `${remoteScreenInfo.sharerName}'s Shared Screen (Live)`

                      : `${activeCallRoom.teacher_name} (Instructor Spotlight)`}

                  </div>

                </div>

                <div className="w-full md:w-64 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto shrink-0">

                  <PeerVideoCard

                    peerId={myPeerIdRef.current}

                    displayName={user.display_name || user.email || 'You'}

                    role={isTeacher ? 'Host' : 'Student'}

                    stream={localStream}

                    isLocal={true}

                    isMicOn={isMicOn}

                    isCameraOn={isCameraOn}

                    isHandRaised={isHandRaised}

                  />

                  {Object.entries(connectedPeers).map(([pId, peer]) => (

                    <PeerVideoCard

                      key={pId}

                      peerId={pId}

                      displayName={peer.display_name}

                      role={peer.role}

                      avatar={peer.avatar}

                      stream={remoteStreams[pId]}

                      isLocal={false}

                      isMicOn={peer.isMicOn}

                      isCameraOn={peer.isCameraOn}

                      isHandRaised={peer.isHandRaised}

                    />

                  ))}

                </div>

              </div>

            ) : (

              /* VIEW MODE C: GALLERY GRID VIEW */

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto pr-1">

                <PeerVideoCard

                  peerId={myPeerIdRef.current}

                  displayName={user.display_name || user.email || 'You'}

                  role={isTeacher ? 'Host' : 'Student'}

                  stream={localStream}

                  isLocal={true}

                  isMicOn={isMicOn}

                  isCameraOn={isCameraOn}

                  isHandRaised={isHandRaised}

                />

                {Object.entries(connectedPeers).map(([pId, peer]) => (

                  <PeerVideoCard

                    key={pId}

                    peerId={pId}

                    displayName={peer.display_name}

                    role={peer.role}

                    avatar={peer.avatar}

                    stream={remoteStreams[pId]}

                    isLocal={false}

                    isMicOn={peer.isMicOn}

                    isCameraOn={peer.isCameraOn}

                    isHandRaised={peer.isHandRaised}

                  />

                ))}

                {Object.keys(connectedPeers).length === 0 && (

                  <div className="rounded-3xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center text-slate-500">

                    <Users className="w-10 h-10 mb-2 opacity-40 text-amber-400" />

                    <p className="text-sm font-semibold text-slate-400">Waiting for other participants to join...</p>

                    <p className="text-xs text-slate-500 mt-1 max-w-xs">Share your meeting link with your student or teacher to start conversing!</p>

                  </div>

                )}

              </div>

            )}

          </main>

          {/* SIDE DRAWER: Chat, Attendees, Polls, AI CO-PILOT */}

          {activeSideDrawer && (

            <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-30 animate-in slide-in-from-right duration-200">

              <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between">

                <h3 className="font-bold text-sm text-white flex items-center gap-2">

                  {activeSideDrawer === 'chat' && (

                    <>

                      <MessageSquare className="w-4 h-4 text-amber-400" />

                      Classroom Chat

                    </>

                  )}

                  {activeSideDrawer === 'participants' && (

                    <>

                      <Users className="w-4 h-4 text-amber-400" />

                      Attendees ({totalParticipantCount})

                    </>

                  )}

                  {activeSideDrawer === 'polls' && (

                    <>

                      <BarChart2 className="w-4 h-4 text-amber-400" />

                      Live Polls

                    </>

                  )}

                  {activeSideDrawer === 'ai' && (

                    <>

                      <Bot className="w-4 h-4 text-amber-400" />

                      Acharya-AI Classroom Agent

                    </>

                  )}

                </h3>

                <button

                  onClick={() => setActiveSideDrawer(null)}

                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"

                >

                  <X className="w-4 h-4" />

                </button>

              </div>

              {/* DRAWER CONTENT */}

              <div className="flex-1 overflow-y-auto p-4 flex flex-col">

                {/* 1. CHAT DRAWER */}

                {activeSideDrawer === 'chat' && (

                  <div className="flex-1 flex flex-col justify-between h-full">

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">

                      {chatMessages.map(msg => (

                        <div

                          key={msg.id}

                          className={`flex flex-col ${

                            msg.sender === (user.display_name || user.email)

                              ? 'items-end'

                              : msg.role === 'system'

                              ? 'items-center'

                              : 'items-start'

                          }`}

                        >

                          {msg.role === 'system' ? (

                            <span className="text-[11px] text-slate-400 bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 my-1 text-center max-w-[90%]">

                              {msg.text}

                            </span>

                          ) : (

                            <>

                              <span className="text-[10px] text-slate-400 mb-0.5">

                                {msg.sender} &bull; {msg.timestamp}

                              </span>

                              <div

                                className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] ${

                                  msg.sender === (user.display_name || user.email)

                                    ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-600/20'

                                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'

                                }`}

                              >

                                {msg.text}

                              </div>

                            </>

                          )}

                        </div>

                      ))}

                      <div ref={chatBottomRef} />

                    </div>

                    <form onSubmit={handleSendChatMessage} className="mt-3 flex gap-2 pt-2 border-t border-slate-800">

                      <input

                        type="text"

                        value={newChatText}

                        onChange={e => setNewChatText(e.target.value)}

                        placeholder="Type a message to everyone..."

                        className="flex-1 px-3 py-2 bg-[#0B0F19] border border-amber-500/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"

                      />

                      <button

                        type="submit"

                        className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"

                      >

                        Send

                      </button>

                    </form>

                  </div>

                )}

                {/* 2. PARTICIPANTS DRAWER */}

                {activeSideDrawer === 'participants' && (

                  <div className="space-y-3">

                    {isHost && (

                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">

                        <span className="text-xs text-slate-400 font-medium">Instructor Controls:</span>

                        <button

                          onClick={handleMuteAll}

                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors"

                          title="Mute all student microphones"

                        >

                          <VolumeX className="w-3.5 h-3.5" />

                          Mute All Students

                        </button>

                      </div>

                    )}

                    <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">

                      <div className="flex items-center gap-2.5">

                        <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center font-bold text-xs text-white">

                          {(user.display_name || 'U').charAt(0).toUpperCase()}

                        </div>

                        <div>

                          <p className="text-xs font-bold text-white flex items-center gap-1.5">

                            {user.display_name || user.email}

                            <span className="text-[9px] px-1 rounded bg-slate-800 text-amber-400 font-semibold">You</span>

                          </p>

                          <p className="text-[10px] text-slate-400 capitalize">{user.role || 'Participant'}</p>

                        </div>

                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400">

                        {isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}

                        {isCameraOn ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}

                      </div>

                    </div>

                    {Object.entries(connectedPeers).map(([pId, peer]) => (

                      <div key={pId} className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">

                        <div className="flex items-center gap-2.5">

                          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">

                            {peer.avatar || peer.display_name.charAt(0).toUpperCase()}

                          </div>

                          <div>

                            <p className="text-xs font-bold text-white">{peer.display_name}</p>

                            <p className="text-[10px] text-slate-400 capitalize">{peer.role}</p>

                          </div>

                        </div>

                        <div className="flex items-center gap-2">

                          <div className="flex items-center gap-1.5 text-slate-400">

                            {peer.isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}

                            {peer.isCameraOn ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}

                            {peer.isHandRaised && <Hand className="w-3.5 h-3.5 text-amber-400" />}

                          </div>

                          {isHost && peer.role !== 'teacher' && peer.role !== 'admin' && (

                            <button

                              onClick={() => handleKickStudent(pId, peer.display_name)}

                              className="p-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/30 text-red-400 border border-red-500/20 transition-colors ml-1"

                              title={`Remove ${peer.display_name} from class`}

                            >

                              <UserX className="w-3.5 h-3.5" />

                            </button>

                          )}

                        </div>

                      </div>

                    ))}

                  </div>

                )}

                {/* 3. POLLS DRAWER */}

                {activeSideDrawer === 'polls' && (

                  <div className="space-y-4">

                    {isHost && (

                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">

                        <span className="text-xs text-slate-400 font-medium">Poll Actions:</span>

                        <div className="flex items-center gap-1.5">

                          <button

                            onClick={handleGenerateAiPoll}

                            className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-amber-400 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"

                          >

                            <Sparkles className="w-3 h-3" />

                            AI Quiz

                          </button>

                          <button

                            onClick={() => setShowPollCreator(prev => !prev)}

                            className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-amber-400 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"

                          >

                            <Plus className="w-3 h-3" />

                            {showPollCreator ? 'Cancel' : 'New Poll'}

                          </button>

                        </div>

                      </div>

                    )}

                    {showPollCreator && isHost && (

                      <form onSubmit={handleCreatePoll} className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-500/40 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">

                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">

                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />

                          Launch Custom Poll

                        </h4>

                        <div>

                          <label className="block text-[11px] text-slate-400 mb-1">Question:</label>

                          <input

                            type="text"

                            value={pollQuestionInput}

                            onChange={e => setPollQuestionInput(e.target.value)}

                            placeholder="e.g. Do you understand Newton's third law?"

                            className="w-full px-2.5 py-1.5 bg-[#0B0F19] border border-amber-500/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"

                            required

                          />

                        </div>

                        <div>

                          <label className="block text-[11px] text-slate-400 mb-1">Options:</label>

                          <div className="space-y-1.5">

                            {pollOptionsInput.map((opt, idx) => (

                              <div key={idx} className="flex gap-1.5">

                                <input

                                  type="text"

                                  value={opt}

                                  onChange={e => {

                                    const next = [...pollOptionsInput]

                                    next[idx] = e.target.value

                                    setPollOptionsInput(next)

                                  }}

                                  placeholder={`Option ${idx + 1}`}

                                  className="flex-1 px-2.5 py-1 bg-[#0B0F19] border border-amber-500/15 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"

                                />

                                {pollOptionsInput.length > 2 && (

                                  <button

                                    type="button"

                                    onClick={() => setPollOptionsInput(prev => prev.filter((_, i) => i !== idx))}

                                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-900"

                                  >

                                    <X className="w-3.5 h-3.5" />

                                  </button>

                                )}

                              </div>

                            ))}

                          </div>

                          {pollOptionsInput.length < 5 && (

                            <button

                              type="button"

                              onClick={() => setPollOptionsInput(prev => [...prev, ''])}

                              className="text-[11px] text-amber-400 hover:text-yellow-300 font-semibold mt-2 flex items-center gap-1"

                            >

                              <Plus className="w-3 h-3" />

                              Add Option

                            </button>

                          )}

                        </div>

                        <button

                          type="submit"

                          className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all"

                        >

                          Broadcast Poll to Class

                        </button>

                      </form>

                    )}

                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">

                      <div className="flex items-center justify-between mb-2">

                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">

                          Live Poll {activePoll.creatorName ? `• by ${activePoll.creatorName}` : ''}

                        </span>

                        <span className="text-[10px] text-slate-400">{activePoll.totalVotes} votes</span>

                      </div>

                      <h4 className="text-xs font-bold text-white mb-3">{activePoll.question}</h4>

                      <div className="space-y-2">

                        {activePoll.options.map((opt, idx) => {

                          const pct = activePoll.totalVotes > 0 ? Math.round((opt.votes / activePoll.totalVotes) * 100) : 0

                          return (

                            <button

                              key={idx}

                              onClick={() => handleVote(idx)}

                              disabled={hasVoted}

                              className={`w-full text-left p-2.5 rounded-xl border transition-all relative overflow-hidden ${

                                hasVoted

                                  ? 'border-slate-800 bg-slate-900/60 cursor-default'

                                  : 'border-slate-700 bg-slate-900 hover:border-cyan-500 hover:bg-slate-800/80 active:scale-[0.99]'

                              }`}

                            >

                              <div

                                className="absolute left-0 top-0 bottom-0 bg-cyan-500/10 transition-all duration-500"

                                style={{ width: `${pct}%` }}

                              />

                              <div className="relative flex items-center justify-between text-xs">

                                <span className="font-medium text-slate-200">{opt.text}</span>

                                {hasVoted && <span className="font-bold text-amber-400 text-[11px]">{pct}% ({opt.votes})</span>}

                              </div>

                            </button>

                          )

                        })}

                      </div>

                      {hasVoted && (

                        <p className="text-[11px] text-emerald-400 font-medium mt-3 flex items-center gap-1">

                          <Check className="w-3.5 h-3.5" />

                          Your vote has been submitted. Real-time results update live!

                        </p>

                      )}

                    </div>

                  </div>

                )}

                {/* 4. ROLE-ISOLATED AI DRAWER (Faculty Associate for Teachers vs Live Tutor for Students) */}
                {activeSideDrawer === 'ai' && (
                  <div className="flex-1 flex flex-col justify-between h-full overflow-hidden">
                    
                    {/* ── TEACHER VIEW: AI FACULTY ASSOCIATE ── */}
                    {isHost ? (
                      <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        {/* Header Badge */}
                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black shadow">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-white">AI Faculty Associate</h4>
                              <p className="text-[10px] text-orange-300">Live Pacing &bull; Missed Points &bull; Mermaid.js</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                            Groq LPU
                          </span>
                        </div>

                        {/* Teacher Sub-Tabs */}
                        <div className="grid grid-cols-4 gap-1 pb-2.5 mb-2.5 border-b border-slate-800">
                          <button
                            onClick={() => { setTeacherAiTab('missed_points'); if (!copilotMissedPointsData) handleAuditMissedPoints(); }}
                            className={`py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                              teacherAiTab === 'missed_points' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Missed</span>
                          </button>
                          <button
                            onClick={() => { setTeacherAiTab('mermaid'); if (!copilotDiagramData) handleGenerateMermaidDiagram(); }}
                            className={`py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                              teacherAiTab === 'mermaid' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Mermaid</span>
                          </button>
                          <button
                            onClick={() => { setTeacherAiTab('analogies'); if (!copilotResult) handleGenerateAnalogies(); }}
                            className={`py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                              teacherAiTab === 'analogies' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>Analogies</span>
                          </button>
                          <button
                            onClick={() => setTeacherAiTab('poll')}
                            className={`py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                              teacherAiTab === 'poll' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Poll</span>
                          </button>
                        </div>

                        {/* Tab 1: Missed Points Auditor */}
                        {teacherAiTab === 'missed_points' && (
                          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Lecture Coverage</span>
                              <button
                                onClick={handleAuditMissedPoints}
                                disabled={isTeacherAiLoading}
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-orange-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>{isTeacherAiLoading ? 'Auditing...' : 'Re-Audit'}</span>
                              </button>
                            </div>

                            {isTeacherAiLoading && !copilotMissedPointsData ? (
                              <div className="p-4 rounded-2xl bg-[#0B0F19] border border-amber-500/15 text-center space-y-2">
                                <Loader2 className="w-5 h-5 text-orange-400 animate-spin mx-auto" />
                                <p className="text-xs text-orange-300 font-semibold">Comparing live speech against curriculum...</p>
                              </div>
                            ) : copilotMissedPointsData ? (
                              <div className="space-y-3">
                                {/* Pacing Advice Banner */}
                                <div className="p-3 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-orange-400 text-[11px] font-extrabold">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Pacing & Timing Advice</span>
                                  </div>
                                  <p className="text-xs text-slate-300">{copilotMissedPointsData.pacing_advice}</p>
                                </div>

                                {/* Suggested Transition Bridge */}
                                {copilotMissedPointsData.suggested_transition && (
                                  <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                                        <Volume2 className="w-3 h-3" />
                                        <span>Suggested Verbal Bridge</span>
                                      </span>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(copilotMissedPointsData.suggested_transition)
                                          setCopiedTransitionToast(true)
                                          setTimeout(() => setCopiedTransitionToast(false), 3000)
                                        }}
                                        className="text-[10px] text-orange-300 hover:text-white font-bold underline"
                                      >
                                        {copiedTransitionToast ? 'Copied!' : 'Copy Phrase'}
                                      </button>
                                    </div>
                                    <p className="text-xs italic text-indigo-200 bg-slate-950/60 p-2.5 rounded-xl border border-indigo-500/20">
                                      "{copilotMissedPointsData.suggested_transition}"
                                    </p>
                                  </div>
                                )}

                                {/* Missed Critical Points */}
                                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                                  <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-extrabold">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Points & Edge Cases Not Covered Yet</span>
                                  </div>
                                  <ul className="space-y-1.5 text-xs text-slate-200">
                                    {copilotMissedPointsData.missed_points.map((pt, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-rose-400 font-bold shrink-0">&bull;</span>
                                        <span>{pt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Covered Points */}
                                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                                  <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-extrabold">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Covered Points (Well Explained)</span>
                                  </div>
                                  <ul className="space-y-1 text-xs text-slate-300">
                                    {copilotMissedPointsData.covered_points.map((pt, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-emerald-400 font-bold shrink-0">&bull;</span>
                                        <span>{pt}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={handleAuditMissedPoints}
                                className="w-full py-4 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-orange-300 font-bold text-xs transition-all flex flex-col items-center justify-center gap-2"
                              >
                                <Sparkles className="w-5 h-5 text-orange-400" />
                                <span>Audit Live Lecture vs Syllabus</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Tab 2: Mermaid.js Synthesizer */}
                        {teacherAiTab === 'mermaid' && (
                          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visual Diagram Engine</span>
                              <button
                                onClick={handleGenerateMermaidDiagram}
                                disabled={isTeacherAiLoading}
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-orange-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>{isTeacherAiLoading ? 'Synthesizing...' : 'Regenerate'}</span>
                              </button>
                            </div>

                            {copilotDiagramData ? (
                              <div className="space-y-3">
                                <h5 className="text-xs font-bold text-white">{copilotDiagramData.title}</h5>

                                {copilotDiagramData.mermaid_code && (
                                  <div className="p-3 rounded-2xl bg-[#0B0F19] border border-amber-500/15 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-mono text-amber-400 font-bold">Mermaid.js Code</span>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(copilotDiagramData.mermaid_code || '')
                                          setCopiedMermaidToast(true)
                                          setTimeout(() => setCopiedMermaidToast(false), 3000)
                                        }}
                                        className="text-[10px] text-yellow-300 hover:text-white font-bold underline"
                                      >
                                        {copiedMermaidToast ? 'Copied Code!' : 'Copy Code'}
                                      </button>
                                    </div>
                                    <pre className="text-[11px] font-mono text-cyan-200 bg-slate-900/80 p-2.5 rounded-xl overflow-x-auto whitespace-pre">
                                      {copilotDiagramData.mermaid_code}
                                    </pre>
                                  </div>
                                )}

                                <div className="p-3 rounded-2xl bg-[#0B0F19] border border-amber-500/15 space-y-1.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Concept Architecture</span>
                                  <pre className="text-[10px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-xl overflow-x-auto whitespace-pre">
                                    {copilotDiagramData.diagram_ascii}
                                  </pre>
                                </div>

                                <button
                                  onClick={() => {
                                    handleOpenWhiteboard()
                                    alert('Diagram transferred to live whiteboard session.')
                                  }}
                                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
                                >
                                  <PenTool className="w-4 h-4" />
                                  <span>Plot to Whiteboard</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={handleGenerateMermaidDiagram}
                                className="w-full py-4 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-orange-300 font-bold text-xs transition-all flex flex-col items-center justify-center gap-2"
                              >
                                <Zap className="w-5 h-5 text-orange-400" />
                                <span>Synthesize Concept Mermaid Diagram</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Tab 3: Alternative Explanations & Analogies */}
                        {teacherAiTab === 'analogies' && (
                          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alternative Pedagogical Angles</span>
                              <button
                                onClick={handleGenerateAnalogies}
                                disabled={isTeacherAiLoading}
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-orange-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>{isTeacherAiLoading ? 'Generating...' : 'Refresh'}</span>
                              </button>
                            </div>

                            {copilotResult ? (
                              <div className="p-3.5 rounded-2xl bg-[#0B0F19] border border-amber-500/15 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {copilotResult}
                              </div>
                            ) : (
                              <button
                                onClick={handleGenerateAnalogies}
                                className="w-full py-4 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-orange-300 font-bold text-xs transition-all flex flex-col items-center justify-center gap-2"
                              >
                                <Lightbulb className="w-5 h-5 text-orange-400" />
                                <span>Generate Intuitive Metaphors & Analogies</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Tab 4: Quick Poll */}
                        {teacherAiTab === 'poll' && (
                          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            <p className="text-xs text-slate-400">Launch an instant 1-question multiple choice poll to test student understanding:</p>
                            <button
                              onClick={() => {
                                const newPoll = {
                                  id: `poll-${Date.now()}`,
                                  question: `Quick Check: What is the primary relationship in ${activeCallRoom?.subject_name || 'this topic'}?`,
                                  options: [
                                    { text: 'Directly Proportional', votes: 0 },
                                    { text: 'Inversely Proportional', votes: 0 },
                                    { text: 'Constant / Invariant', votes: 0 },
                                    { text: 'Non-linear Perturbation', votes: 0 }
                                  ],
                                  totalVotes: 0,
                                  isActive: true,
                                  creatorName: user.display_name || 'Instructor'
                                }
                                setActivePoll(newPoll)
                                sendWsMessage({ type: 'new_poll', poll: newPoll })
                                alert('Instant comprehension poll broadcasted to class!')
                              }}
                              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5"
                            >
                              <BarChart2 className="w-4 h-4" />
                              <span>Broadcast Instant Comprehension Poll</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (

                      /* ── STUDENT VIEW: AI LIVE STUDENT TUTOR ── */
                      <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        {/* Header Badge */}
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-black shadow">
                              <Bot className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-white">AI Live Student Tutor</h4>
                              <p className="text-[10px] text-emerald-300">Grounded in Live Lecture &bull; Instant Doubts</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Live Sync
                          </span>
                        </div>

                        {/* Student Sub-Tabs */}
                        <div className="grid grid-cols-3 gap-1 pb-2.5 mb-2.5 border-b border-slate-800">
                          <button
                            onClick={() => setStudentTutorTab('doubt')}
                            className={`py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                              studentTutorTab === 'doubt' ? 'bg-emerald-500 text-slate-950 shadow font-black' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Ask Doubt</span>
                          </button>
                          <button
                            onClick={() => { setStudentTutorTab('summary'); if (!studentSummaryResult) handleStudentLiveSummary(); }}
                            className={`py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                              studentTutorTab === 'summary' ? 'bg-emerald-500 text-slate-950 shadow font-black' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Live Notes</span>
                          </button>
                          <button
                            onClick={() => { setStudentTutorTab('milestones'); if (studentMilestones.length === 0) handleStudentLiveMilestones(); }}
                            className={`py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                              studentTutorTab === 'milestones' ? 'bg-emerald-500 text-slate-950 shadow font-black' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Milestones</span>
                          </button>
                        </div>

                        {/* Student Tab 1: Live Doubt Chat */}
                        {studentTutorTab === 'doubt' && (
                          <div className="flex-1 flex flex-col justify-between overflow-hidden">
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                              {studentDoubtHistory.length === 0 ? (
                                <div className="p-4 rounded-2xl bg-slate-950/60 border border-amber-500/15 text-center space-y-2 my-auto">
                                  <Bot className="w-6 h-6 text-emerald-400 mx-auto" />
                                  <h5 className="text-xs font-bold text-white">Have a doubt on what teacher just taught?</h5>
                                  <p className="text-[11px] text-slate-400">
                                    Ask anything! I listen to the live lecture and explain concepts step-by-step using what your teacher said.
                                  </p>
                                </div>
                              ) : (
                                studentDoubtHistory.map(item => (
                                  <div key={item.id} className="space-y-2">
                                    {/* Student Question */}
                                    <div className="flex justify-end">
                                      <div className="px-3.5 py-2 rounded-2xl bg-emerald-600 text-slate-950 font-medium text-xs max-w-[85%] rounded-br-none shadow">
                                        {item.question}
                                      </div>
                                    </div>
                                    {/* AI Tutor Answer */}
                                    <div className="flex justify-start">
                                      <div className="p-3.5 rounded-2xl bg-slate-950 text-slate-200 border border-slate-800 text-xs max-w-[90%] rounded-bl-none shadow leading-relaxed whitespace-pre-wrap">
                                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px] mb-1">
                                          <Sparkles className="w-3 h-3" />
                                          <span>AI Live Tutor ({item.timestamp})</span>
                                        </div>
                                        {item.answer}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}

                              {isStudentTutorLoading && (
                                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-slate-950 p-3 rounded-2xl border border-slate-800 animate-pulse">
                                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                  <span>Grounded AI Tutor is reasoning over live lecture...</span>
                                </div>
                              )}
                            </div>

                            {/* Quick Chips */}
                            <div className="flex items-center gap-1.5 overflow-x-auto py-2">
                              <button
                                onClick={() => handleStudentLiveDoubt('Can you explain the last equation the teacher wrote in simpler terms?')}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/20 text-[10px] text-emerald-300 whitespace-nowrap hover:bg-slate-800"
                              >
                                Explain Last Equation
                              </button>
                              <button
                                onClick={() => handleStudentLiveDoubt('Why is this formula or theorem true? Give me an intuitive example.')}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/20 text-[10px] text-emerald-300 whitespace-nowrap hover:bg-slate-800"
                              >
                                Intuitive Example
                              </button>
                              <button
                                onClick={() => handleStudentLiveDoubt('What is the main takeaway of this topic for exams?')}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/20 text-[10px] text-emerald-300 whitespace-nowrap hover:bg-slate-800"
                              >
                                Key Exam Takeaway
                              </button>
                            </div>

                            {/* Input Form */}
                            <form
                              onSubmit={e => {
                                e.preventDefault()
                                handleStudentLiveDoubt()
                              }}
                              className="flex gap-2 pt-2 border-t border-slate-800"
                            >
                              <input
                                type="text"
                                value={studentDoubtInput}
                                onChange={e => setStudentDoubtInput(e.target.value)}
                                placeholder="Ask live tutor about this lecture..."
                                className="flex-1 px-3 py-2 bg-[#0B0F19] border border-amber-500/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                              />
                              <button
                                type="submit"
                                disabled={isStudentTutorLoading || !studentDoubtInput.trim()}
                                className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors disabled:opacity-50"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </form>
                          </div>
                        )}

                        {/* Student Tab 2: Live Notes & Summary */}
                        {studentTutorTab === 'summary' && (
                          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Lecture Notes ({formatTimer(elapsedSeconds)})</span>
                              <button
                                onClick={handleStudentLiveSummary}
                                disabled={isStudentTutorLoading}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>{isStudentTutorLoading ? 'Generating...' : 'Update Notes'}</span>
                              </button>
                            </div>

                            {studentSummaryResult ? (
                              <div className="p-3.5 rounded-2xl bg-[#0B0F19] border border-amber-500/15 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {studentSummaryResult}
                              </div>
                            ) : (
                              <button
                                onClick={handleStudentLiveSummary}
                                className="w-full py-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all flex flex-col items-center justify-center gap-2"
                              >
                                <FileText className="w-5 h-5 text-emerald-400" />
                                <span>Generate Up-To-Minute Lecture Summary</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Student Tab 3: Timeline Milestones */}
                        {studentTutorTab === 'milestones' && (
                          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chronological Milestones</span>
                              <button
                                onClick={handleStudentLiveMilestones}
                                disabled={isStudentTutorLoading}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>{isStudentTutorLoading ? 'Syncing...' : 'Sync'}</span>
                              </button>
                            </div>

                            {studentMilestones.length > 0 ? (
                              <div className="space-y-2.5 relative pl-4 border-l-2 border-slate-800">
                                {studentMilestones.map((m, idx) => (
                                  <div key={idx} className="relative space-y-1">
                                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-slate-950" />
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#0B0F19] border border-amber-500/15 text-emerald-300">
                                        {m.timestamp}
                                      </span>
                                      <h6 className="text-xs font-bold text-white">{m.title}</h6>
                                    </div>
                                    <p className="text-[11px] text-slate-300">{m.summary}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <button
                                onClick={handleStudentLiveMilestones}
                                className="w-full py-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all flex flex-col items-center justify-center gap-2"
                              >
                                <Clock className="w-5 h-5 text-emerald-400" />
                                <span>Extract Lecture Timeline Milestones</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}

              </div>
            </aside>
          )}
        </div>

        {/* LIVE CAPTIONS / SUBTITLE OVERLAY */}
        {showLiveCaptions && latestTranscriptSnippet && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 max-w-xl w-[90%] bg-slate-950/90 backdrop-blur-md border border-slate-800 text-white px-4 py-2.5 rounded-2xl shadow-2xl text-center pointer-events-none transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-0.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Live Transcription ({formatTimer(elapsedSeconds)})</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-200 line-clamp-2">
              {latestTranscriptSnippet}
            </p>
          </div>
        )}

        {/* BOTTOM CALL CONTROL BAR (Zoom / Teams Style) */}
        <footer className="h-20 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-30 overflow-x-auto no-scrollbar">

          {/* 1. Hardware Media Controls (Mic & Camera) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleMic}
              className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                isMicOn
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/60'
                  : 'bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30'
              }`}
              title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isMicOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
              <span className="hidden md:inline">{isMicOn ? 'Mute' : 'Unmute'}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                isCameraOn
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/60'
                  : 'bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30'
              }`}
              title={isCameraOn ? 'Stop Video' : 'Start Video'}
            >
              {isCameraOn ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-red-400" />}
              <span className="hidden md:inline">{isCameraOn ? 'Stop Video' : 'Start Video'}</span>
            </button>
          </div>

          {/* 2. Collaboration & Presentation Controls (Share, Skin, Whiteboard, Copilot/Tutor, Record, Hand, CC, Reactions) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Screen Share */}
            <button
              onClick={toggleScreenShare}
              className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                isScreenSharing
                  ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/30 ring-2 ring-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
              }`}
              title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden md:inline">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
            </button>

            

            {/* Whiteboard */}
            <button
              onClick={handleOpenWhiteboard}
              className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                callView === 'whiteboard'
                  ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/30 ring-2 ring-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
              }`}
              title="Interactive Whiteboard"
            >
              <PenTool className="w-4 h-4" />
              <span className="hidden md:inline">Whiteboard</span>
            </button>

            {/* TEACHER ONLY: AI Faculty Associate Button */}
            {isHost && (
              <button
                onClick={() => {
                  setActiveSideDrawer(prev => prev === 'ai' ? null : 'ai')
                  if (!copilotTopic && activeCallRoom?.title) {
                    setCopilotTopic(activeCallRoom.title)
                  }
                }}
                className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                  activeSideDrawer === 'ai'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-500/30 ring-2 ring-indigo-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-orange-300 border border-indigo-500/40'
                }`}
                title="AI Faculty Associate (Missed Points & Mermaid Diagrams)"
              >
                <Sparkles className="w-4 h-4 text-orange-300" />
                <span className="hidden md:inline">AI Faculty Associate</span>
              </button>
            )}

            {/* TEACHER ONLY: Record Class Button */}
            {isHost && (
              <button
                onClick={toggleRecording}
                disabled={isUploadingRecording}
                className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                  isRecording
                    ? 'bg-red-600 text-white animate-pulse shadow-red-600/50 ring-2 ring-red-400'
                    : isUploadingRecording
                    ? 'bg-purple-600/20 text-amber-300 border border-purple-500/40 cursor-wait'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
                }`}
                title={isRecording ? 'Stop Recording' : 'Record Class to Cloud'}
              >
                {isRecording ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                    <span>Stop REC</span>
                  </>
                ) : isUploadingRecording ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span className="hidden md:inline">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4 text-red-500 fill-red-500" />
                    <span className="hidden md:inline">Record Class</span>
                  </>
                )}
              </button>
            )}

            {/* STUDENT ONLY: AI Student Tutor Button */}
            {!isHost && (
              <button
                onClick={() => {
                  setActiveSideDrawer(prev => prev === 'ai' ? null : 'ai')
                }}
                className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                  activeSideDrawer === 'ai'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40'
                }`}
                title="AI Live Tutor (Grounded Doubts & Live Notes)"
              >
                <Bot className="w-4 h-4 text-emerald-300" />
                <span>AI Live Tutor</span>
              </button>
            )}

            {/* Raise Hand Button */}
            <button
              onClick={toggleHandRaise}
              className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                isHandRaised
                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
              }`}
              title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <Hand className="w-4 h-4" />
              <span className="hidden md:inline">{isHandRaised ? 'Hand Raised' : 'Raise Hand'}</span>
            </button>

            {/* Live Closed Captions / Subtitle Toggle */}
            <button
              onClick={() => setShowLiveCaptions(prev => !prev)}
              className={`h-11 px-3 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all shadow-md active:scale-95 ${
                showLiveCaptions
                  ? 'bg-cyan-500/20 text-yellow-300 border border-cyan-500/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700/60'
              }`}
              title={showLiveCaptions ? 'Hide Live Captions' : 'Show Live Captions'}
            >
              <Subtitles className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">CC</span>
            </button>

            {/* Quick Reactions Bar */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-950/60 h-11 px-2 rounded-2xl border border-slate-800">
              {[
                { label: 'Clap', val: '👏' },
                { label: 'Like', val: '👍' },
                { label: '+1', val: '❤️' },
                { label: 'Idea', val: '💡' },
                { label: 'Great', val: '🎉' },
                { label: 'Fast', val: '🚀' },
              ].map(r => (
                <button
                  key={r.val}
                  onClick={() => triggerReaction(r.val)}
                  className="px-2 h-7 rounded-xl hover:bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 hover:text-white transition-all font-medium whitespace-nowrap"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Drawers & Session End Controls (Chat, Participants, Polls, End Call) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveSideDrawer(prev => prev === 'chat' ? null : 'chat')}
              className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all relative ${
                activeSideDrawer === 'chat'
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
              }`}
              title="Class Chat"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
              {unreadChatCount > 0 && activeSideDrawer !== 'chat' && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSideDrawer(prev => prev === 'participants' ? null : 'participants')}
              className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all ${
                activeSideDrawer === 'participants'
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
              }`}
              title="Participants"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">({totalParticipantCount})</span>
            </button>

            <button
              onClick={() => setActiveSideDrawer(prev => prev === 'polls' ? null : 'polls')}
              className={`h-11 px-3.5 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all ${
                activeSideDrawer === 'polls'
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
              }`}
              title="Live Polls"
            >
              <BarChart2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleEndSessionClick}
              className="h-11 px-3.5 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all active:scale-95"
              title={isHost ? 'End Session for All' : 'Leave Class'}
            >
              <PhoneOff className="w-4 h-4" />
              <span className="hidden sm:inline">{isHost ? 'End' : 'Leave'}</span>
            </button>
          </div>

        </footer>

        {/* MODAL: End Session Confirmation for Host */}

        {showEndMeetingModal && (

          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="bg-[#0B0F19] border border-amber-500/15 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">

              <h3 className="text-base font-bold text-white flex items-center gap-2">

                <PhoneOff className="w-5 h-5 text-red-500" />

                End Live Classroom Session

              </h3>

              <p className="text-xs text-slate-400">

                Would you like to end the session for all enrolled students, or just leave the session temporarily?

              </p>

              <div className="flex flex-col gap-2 pt-2">

                <button

                  onClick={handleEndMeetingForAll}

                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-colors flex items-center justify-center gap-1.5"

                >

                  <PhoneOff className="w-4 h-4" />

                  End Session for Everyone

                </button>

                <button

                  onClick={handleLeaveMeetingOnly}

                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"

                >

                  Just Leave Session

                </button>

                <button

                  onClick={() => setShowEndMeetingModal(false)}

                  className="w-full py-2 rounded-xl text-slate-500 hover:text-white text-xs font-semibold transition-colors"

                >

                  Cancel

                </button>

              </div>

            </div>

          </div>

        )}

        {/* MODAL: AI Diagram Synthesizer */}

        {showAiDiagramModal && (

          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="bg-[#0B0F19] border border-amber-500/15 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">

              <div className="flex items-center justify-between">

                <h3 className="text-base font-bold text-white flex items-center gap-2">

                  <Sparkles className="w-5 h-5 text-amber-400" />

                  AI Whiteboard Synthesizer

                </h3>

                <button onClick={() => setShowAiDiagramModal(false)} className="text-slate-400 hover:text-white">

                  <X className="w-4 h-4" />

                </button>

              </div>

              <p className="text-xs text-slate-400">

                Select a concept for the AI Agent to mathematically plot directly onto the shared live whiteboard:

              </p>

              <div className="grid grid-cols-1 gap-2 pt-1">

                <button

                  onClick={() => handleGenerateAiDiagram('triangle')}

                  className="p-3 rounded-2xl bg-[#0B0F19] border border-amber-500/15 hover:border-cyan-500 text-left transition-colors flex items-center justify-between"

                >

                  <div>

                    <p className="text-xs font-bold text-white">Right Triangle Geometry</p>

                    <p className="text-[10px] text-slate-400">Pythagorean theorem a² + b² = c² with orthogonal corner</p>

                  </div>

                  <Sparkles className="w-4 h-4 text-amber-400" />

                </button>

                <button

                  onClick={() => handleGenerateAiDiagram('circuit')}

                  className="p-3 rounded-2xl bg-[#0B0F19] border border-amber-500/15 hover:border-cyan-500 text-left transition-colors flex items-center justify-between"

                >

                  <div>

                    <p className="text-xs font-bold text-white">Ohm's Law Circuit (V = I·R)</p>

                    <p className="text-[10px] text-slate-400">DC electrical circuit with voltage and resistor loads</p>

                  </div>

                  <Zap className="w-4 h-4 text-amber-400" />

                </button>

                <button

                  onClick={() => handleGenerateAiDiagram('tree')}

                  className="p-3 rounded-2xl bg-[#0B0F19] border border-amber-500/15 hover:border-cyan-500 text-left transition-colors flex items-center justify-between"

                >

                  <div>

                    <p className="text-xs font-bold text-white">Binary Search Tree Hierarchy</p>

                    <p className="text-[10px] text-slate-400">CS data structure with root and child node edges</p>

                  </div>

                  <Layers className="w-4 h-4 text-emerald-400" />

                </button>

                <button

                  onClick={() => handleGenerateAiDiagram('axes')}

                  className="p-3 rounded-2xl bg-[#0B0F19] border border-amber-500/15 hover:border-cyan-500 text-left transition-colors flex items-center justify-between"

                >

                  <div>

                    <p className="text-xs font-bold text-white">Cartesian Coordinate Wave Graph</p>

                    <p className="text-[10px] text-slate-400">Standard X-Y axis grid with trigonometric sine curve</p>

                  </div>

                  <Plus className="w-4 h-4 text-amber-400" />

                </button>

              </div>

            </div>

          </div>

        )}

      </div>

    )

  }

  // ==========================================

  // RENDER 2: SCHEDULE ROSTER & LAUNCHPAD DASHBOARD

  // ==========================================

  return (

    <div className="space-y-8 animate-in fade-in duration-300">

      {alertMessage && (

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-200 text-xs">

          <div className="flex items-center gap-2">

            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />

            <span>{alertMessage}</span>

          </div>

          <button

            onClick={() => setAlertMessage(null)}

            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"

          >

            <X className="w-4 h-4" />

          </button>

        </div>

      )}

      {/* Top Banner Header */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-xl">

        <div>

          <div className="flex items-center gap-2 mb-1">

            <span className="p-2 rounded-xl bg-cyan-500/10 text-amber-400 border border-cyan-500/20">

              <Video className="w-5 h-5" />

            </span>

            <h1 className="text-2xl font-black text-white tracking-tight">Live Interactive Classrooms</h1>

          </div>

          <p className="text-sm text-slate-400">

            Real-time interactive video sessions synchronized with school timetables, collaborative whiteboards & WebRTC voice/video.

          </p>

        </div>

        <div className="flex items-center gap-3">

          {isHost && (

            <button

              onClick={() => setShowScheduleModal(true)}

              className="px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"

            >

              <Plus className="w-4 h-4" />

              Schedule / Launch Class

            </button>

          )}

        </div>

      </div>

            {/* Student Enrolled Class Banner or Teacher Grade Selector */}
      {isStudent ? (
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500 text-slate-950 font-black flex items-center justify-center text-xs">
              {studentGrade}
            </div>
            <div>
              <p className="text-xs font-extrabold text-white">Enrolled Stream: Class {studentGrade}</p>
              <p className="text-[11px] text-yellow-300">Displaying authorized live lectures and official recordings for Class {studentGrade} only.</p>
            </div>
          </div>
          <button
            onClick={() => setFilterRecordingOnly(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              filterRecordingOnly
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 text-amber-300 border border-purple-500/30'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-amber-300" />
            <span>Class {studentGrade} Recordings ({classes.filter(c => !!c.recording_url).length})</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => { setFilterGrade('all'); setFilterRecordingOnly(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterGrade === 'all' && !filterRecordingOnly
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Grades
          </button>
          <button
            onClick={() => setFilterRecordingOnly(prev => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              filterRecordingOnly
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400'
                : 'bg-slate-900 text-amber-300 hover:text-white border border-purple-500/30'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-amber-300" />
            <span>Watch Recordings ({classes.filter(c => !!c.recording_url).length})</span>
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(g => (
            <button
              key={g}
              onClick={() => { setFilterGrade(g); setFilterRecordingOnly(false); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterGrade === g && !filterRecordingOnly
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Grade {g}
            </button>
          ))}
        </div>
      )}

      {/* Live & Scheduled Classes Grid */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {loading ? (

          <div className="col-span-full py-16 text-center text-slate-400">

            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-3" />

            <p className="text-sm font-semibold">Loading live classes...</p>

          </div>

        ) : classes.length === 0 ? (

          <div className="col-span-full py-16 text-center rounded-3xl bg-slate-900/50 border border-amber-500/15">

            <Calendar className="w-12 h-12 mx-auto text-slate-600 mb-3" />

            <h3 className="text-base font-bold text-slate-300">No Live Classes Scheduled</h3>

            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">

              {isHost

                ? 'Click "Schedule / Launch Class" above to create an instant session from your assigned timetable periods.'

                : 'Check back when your teachers launch their scheduled timetable sessions.'}

            </p>

          </div>

        ) : (

          classes.filter(cls => filterRecordingOnly ? !!cls.recording_url : true).map(cls => {

            const isLive = cls.status === 'live'

            const isEnded = cls.status === 'ended'

            return (

              <div

                key={cls.id}

                className={`rounded-3xl border p-5 flex flex-col justify-between transition-all hover:shadow-2xl ${

                  isLive

                    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border-cyan-500/40 shadow-cyan-500/10'

                    : 'bg-slate-900 border-slate-800'

                }`}

              >

                <div>

                  <div className="flex items-center justify-between mb-3">

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">

                      Grade {cls.grade_number}-{cls.section_name}

                    </span>

                    {isLive && (

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">

                        <Radio className="w-3 h-3 text-red-500" />

                        LIVE NOW

                      </span>

                    )}

                    {isEnded && (

                      <span className="text-[11px] font-medium text-slate-500">Ended</span>

                    )}

                    {!isLive && !isEnded && (

                      <span className="text-[11px] font-medium text-amber-400">Scheduled</span>

                    )}

                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{cls.title}</h3>

                  <p className="text-xs text-slate-400 mb-4">{cls.subject_name} &bull; Period {cls.period_number || 1}</p>

                  <div className="space-y-1.5 text-xs text-slate-300 mb-6 bg-slate-950/40 p-3 rounded-2xl border border-slate-800">

                    <div className="flex items-center justify-between">

                      <span className="text-slate-500">Instructor:</span>

                      <span className="font-semibold text-white">{cls.teacher_name || 'Assigned Faculty'}</span>

                    </div>

                    {cls.room_number && (

                      <div className="flex items-center justify-between">

                        <span className="text-slate-500">Campus Venue:</span>

                        <span className="font-semibold text-white">{cls.room_number}</span>

                      </div>

                    )}

                  </div>

                </div>

                <div>

                  {cls.recording_url ? (

                    <div className="flex gap-2">

                      <button

                        onClick={() => { setSelectedRecordingUrl(cls.recording_url!); setSelectedRecordingClass(cls); }}

                        className="flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95"

                      >

                        <Video className="w-4 h-4 text-purple-200" />

                        <span>Watch Recording</span>

                      </button>

                      {!isEnded && (

                        <button

                          onClick={() => handleJoinClass(cls)}

                          className="px-4 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all font-semibold"

                        >

                          <Play className="w-4 h-4" />

                          <span>Join</span>

                        </button>

                      )}

                    </div>

                  ) : (

                    <button

                      onClick={() => handleJoinClass(cls)}

                      disabled={isEnded}

                      className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${

                        isEnded

                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'

                          : isLive

                          ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-95'

                          : 'bg-slate-800 hover:bg-slate-700 text-white'

                      }`}

                    >

                      <Play className="w-4 h-4" />

                      <span>{isLive ? 'Join Live Session' : (isHost ? 'Start Session Now' : 'Enter Classroom')}</span>

                    </button>

                  )}

                </div>

              </div>

            )

          })

        )}

      </div>

      {/* SCHEDULE MODAL */}

      {showScheduleModal && (

        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-[#0B0F19] border border-amber-500/15 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">

            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">

              <Sparkles className="w-5 h-5 text-amber-400" />

              Schedule / Launch Live Class

            </h2>

            <p className="text-xs text-slate-400 mb-4">

              Select your assigned timetable period to auto-populate curriculum and section details.

            </p>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">

              <div>

                <label className="block text-xs font-bold text-slate-300 mb-1">

                  Select Timetable Slot

                </label>

                {teacherSlots.length === 0 ? (

                  <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">

                    No active timetable slots assigned to your profile yet.

                  </p>

                ) : (

                  <select

                    value={selectedSlotIndex}

                    onChange={e => setSelectedSlotIndex(Number(e.target.value))}

                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F19] border border-amber-500/15 text-xs text-white focus:outline-none focus:border-cyan-500"

                  >

                    {teacherSlots.map((s, idx) => (

                      <option key={idx} value={idx}>

                        Grade {s.grade_number}-{s.section_name} &bull; {s.subject_name} (Period {s.period_number}, {s.day_of_week})

                      </option>

                    ))}

                  </select>

                )}

              </div>

              <div>

                <label className="block text-xs font-bold text-slate-300 mb-1">

                  Session Title (Optional override)

                </label>

                <input

                  type="text"

                  value={customTitle}

                  onChange={e => setCustomTitle(e.target.value)}

                  placeholder="e.g. Chapter 4: Live Practical Demonstration"

                  className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F19] border border-amber-500/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"

                />

              </div>

              <div className="flex items-center gap-2 pt-2">

                <input

                  type="checkbox"

                  id="instantLaunch"

                  checked={instantLaunch}

                  onChange={e => setInstantLaunch(e.target.checked)}

                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-950"

                />

                <label htmlFor="instantLaunch" className="text-xs font-medium text-slate-300">

                  Launch session immediately and enter room

                </label>

              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">

                <button

                  type="button"

                  onClick={() => setShowScheduleModal(false)}

                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"

                >

                  Cancel

                </button>

                <button

                  type="submit"

                  disabled={submittingSchedule || teacherSlots.length === 0}

                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50"

                >

                  {submittingSchedule ? 'Launching...' : 'Confirm & Launch'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

            {/* ── MODAL: TEACHER AI COPILOT & CLASSROOM ENHANCER (TEACHER ONLY) ─────────────────── */}
      {isHost && showTeacherCopilot && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">AI Teaching Copilot</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                      Teacher Only
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                      Minute {formatTimer(elapsedSeconds)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Concept diagrams, analogies, and dynamic helpers grounded in your live lecture</p>
                </div>
              </div>
              <button
                onClick={() => setShowTeacherCopilot(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Dynamic Transcript Context Banner */}
              <div className="p-3 rounded-2xl bg-[#0B0F19] border border-amber-500/15 flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-red-400 animate-pulse shrink-0 mt-0.5" />
                <div className="text-xs flex-1">
                  <span className="font-bold text-slate-300">Live Speech Captured up to Minute {formatTimer(elapsedSeconds)}: </span>
                  <span className="text-slate-400 italic">
                    {latestTranscriptSnippet || `Teacher discussing ${(copilotTopic || (activeCallRoom as any)?.title || 'Lesson topic')}...`}
                  </span>
                </div>
              </div>

              {/* Current Topic Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                  <span>Current Topic / Concept Discussed:</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={copilotTopic}
                    onChange={(e) => setCopilotTopic(e.target.value)}
                    placeholder={(activeCallRoom as any)?.title || "e.g., Object-Oriented Programming (OOPS), Photosynthesis, Calculus"}
                    className="flex-1 bg-slate-800/90 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Select Helper Tool:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleTriggerTeacherCopilot('diagram')}
                    disabled={isCopilotLoading}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                      copilotAction === 'diagram'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-md ring-1 ring-cyan-400'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-yellow-300 shrink-0" />
                    <span>Concept Diagrams</span>
                  </button>

                  <button
                    onClick={() => handleTriggerTeacherCopilot('enhance')}
                    disabled={isCopilotLoading}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                      copilotAction === 'enhance'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Teaching Tips</span>
                  </button>

                  <button
                    onClick={() => handleTriggerTeacherCopilot('analogy')}
                    disabled={isCopilotLoading}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                      copilotAction === 'analogy'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Relatable Analogy</span>
                  </button>

                  <button
                    onClick={() => handleTriggerTeacherCopilot('quick_poll')}
                    disabled={isCopilotLoading}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                      copilotAction === 'quick_poll'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                    }`}
                  >
                    <BarChart2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Instant Poll Idea</span>
                  </button>

                  <button
                    onClick={() => handleTriggerTeacherCopilot('fun_fact')}
                    disabled={isCopilotLoading}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                      copilotAction === 'fun_fact'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Fun Fact</span>
                  </button>

                  <button
                    onClick={() => handleTriggerTeacherCopilot('engagement_question')}
                    disabled={isCopilotLoading}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                      copilotAction === 'engagement_question'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Ask the Class</span>
                  </button>
                </div>
              </div>

              {/* Copilot Result Box */}
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4 space-y-3 min-h-[160px] flex flex-col justify-center">
                {isCopilotLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-orange-400 text-xs">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>AI Copilot is analyzing live transcript up to Minute {formatTimer(elapsedSeconds)}...</span>
                  </div>
                ) : copilotDiagramData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Zap className="w-4 h-4" />
                        {copilotDiagramData.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(copilotDiagramData.diagram_ascii)
                            setCopiedDiagramToast(true)
                            setTimeout(() => setCopiedDiagramToast(false), 2000)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
                        >
                          {copiedDiagramToast ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedDiagramToast ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <button
                          onClick={handleSendDiagramToWhiteboard}
                          className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 transition shadow"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Send to Whiteboard</span>
                        </button>
                      </div>
                    </div>

                    {/* ASCII Diagram Box */}
                    <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-amber-500/15 font-mono text-[11px] leading-relaxed text-yellow-300 overflow-x-auto whitespace-pre selection:bg-cyan-500 selection:text-slate-950">
                      {copilotDiagramData.diagram_ascii}
                    </div>

                    {/* Key Concepts */}
                    {copilotDiagramData.key_concepts && copilotDiagramData.key_concepts.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-300">Key Concepts Explained:</span>
                        <ul className="space-y-1 text-xs text-slate-300 pl-2">
                          {copilotDiagramData.key_concepts.map((concept, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{concept}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Pedagogical Explanation */}
                    {copilotDiagramData.pedagogical_explanation && (
                      <p className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        💡 <strong>How to explain:</strong> {copilotDiagramData.pedagogical_explanation}
                      </p>
                    )}

                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => handleTriggerTeacherCopilot('diagram')}
                        className="text-[11px] text-amber-400 hover:text-yellow-300 font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate Alternative Diagram</span>
                      </button>
                    </div>
                  </div>
                ) : copilotResult ? (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {copilotResult}
                    </div>

                    {/* If Poll Data generated, show quick Launch button */}
                    {copilotPollData && (
                      <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-2">
                        <div className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
                          <BarChart2 className="w-4 h-4" />
                          <span>Generated Live Poll</span>
                        </div>
                        <p className="text-xs text-white font-medium">{copilotPollData.question}</p>
                        <div className="space-y-1 pl-2">
                          {copilotPollData.options?.map((opt: string, i: number) => (
                            <div key={i} className="text-xs text-slate-300 flex items-center gap-2">
                              <span className="w-4 h-4 rounded bg-slate-800 text-[10px] flex items-center justify-center text-slate-400">{i+1}</span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={handleLaunchCopilotPoll}
                            className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Launch This Poll to Class Now</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Click any helper above to generate diagrams, teaching tips, or live class polls!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── MODAL: STUDENT AI TUTOR (STUDENT ONLY) ─────────────────── */}
      {showStudentTutorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">AI Classroom Tutor</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Student Only
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                      Minute {formatTimer(elapsedSeconds)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Live doubt clearing, summaries, and timestamp milestones grounded in class</p>
                </div>
              </div>
              <button
                onClick={() => setShowStudentTutorModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-slate-800 bg-slate-950/30">
              <button
                onClick={() => setStudentTutorTab('doubt')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  studentTutorTab === 'doubt'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Ask Doubts</span>
              </button>
              <button
                onClick={() => {
                  setStudentTutorTab('summary')
                  if (!studentSummaryResult) handleGenerateStudentSummary()
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  studentTutorTab === 'summary'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Live Summary</span>
              </button>
              <button
                onClick={() => {
                  setStudentTutorTab('milestones')
                  if (studentMilestones.length === 0) handleGenerateStudentMilestones()
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  studentTutorTab === 'milestones'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Class Milestones</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Tab 1: Doubts */}
              {studentTutorTab === 'doubt' && (
                <div className="space-y-4">
                  {/* Quick Doubt Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Quick Questions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Can you explain what the teacher just said?",
                        "Give an intuitive real-world example",
                        "What is the key takeaway so far?",
                        "Why does this formula/rule work?"
                      ].map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAskStudentTutorDoubt(chip)}
                          disabled={isStudentTutorLoading}
                          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-purple-600/30 text-[11px] text-purple-200 border border-slate-700/60 hover:border-purple-500/50 transition"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAskStudentTutorDoubt()
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={studentDoubtInput}
                      onChange={(e) => setStudentDoubtInput(e.target.value)}
                      placeholder="Type your question or doubt here..."
                      className="flex-1 bg-slate-800/90 border border-slate-700 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none transition"
                    />
                    <button
                      type="submit"
                      disabled={isStudentTutorLoading || !studentDoubtInput.trim()}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition"
                    >
                      <Send className="w-4 h-4" />
                      <span>Ask</span>
                    </button>
                  </form>

                  {/* Loading indicator */}
                  {isStudentTutorLoading && (
                    <div className="flex items-center justify-center py-6 gap-2 text-amber-400 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>AI Tutor is reasoning over the live lecture...</span>
                    </div>
                  )}

                  {/* Q&A Doubt History */}
                  <div className="space-y-3">
                    {studentDoubtHistory.map((item) => (
                      <div key={item.id} className="p-3.5 rounded-2xl bg-[#0B0F19] border border-amber-500/15 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300">
                          <span className="flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Your Question ({item.timestamp})</span>
                          </span>
                        </div>
                        <p className="text-xs text-white font-medium pl-1">{item.question}</p>
                        <div className="pt-2 border-t border-amber-500/15 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {item.answer}
                        </div>
                      </div>
                    ))}
                    {studentDoubtHistory.length === 0 && !isStudentTutorLoading && (
                      <div className="text-center py-8 text-xs text-slate-400">
                        Have a question about what the teacher just taught? Ask above or click any quick prompt!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Live Summary */}
              {studentTutorTab === 'summary' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Lecture Summary so far (Minute {formatTimer(elapsedSeconds)}):</span>
                    <button
                      onClick={handleGenerateStudentSummary}
                      disabled={isStudentTutorLoading}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Summary</span>
                    </button>
                  </div>

                  {isStudentTutorLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-amber-400 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Synthesizing lecture summary...</span>
                    </div>
                  ) : studentSummaryResult ? (
                    <div className="p-4 rounded-2xl bg-[#0B0F19] border border-amber-500/15 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {studentSummaryResult}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Click Refresh Summary to get a structured recap of everything taught up to now.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Milestones & Timestamps */}
              {studentTutorTab === 'milestones' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Chronological Milestones (00:00 - {formatTimer(elapsedSeconds)}):</span>
                    <button
                      onClick={handleGenerateStudentMilestones}
                      disabled={isStudentTutorLoading}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Update Timeline</span>
                    </button>
                  </div>

                  {isStudentTutorLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-amber-400 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Extracting lecture milestones...</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {studentMilestones.map((m, idx) => (
                        <div key={idx} className="p-3 rounded-2xl bg-[#0B0F19] border border-amber-500/15 flex items-start gap-3">
                          <span className="px-2 py-1 rounded-lg bg-purple-950/60 text-amber-300 border border-purple-500/40 text-[10px] font-mono font-bold shrink-0">
                            {m.timestamp}
                          </span>
                          <div className="flex-1 space-y-0.5">
                            <h4 className="text-xs font-bold text-white">{m.title}</h4>
                            <p className="text-[11px] text-slate-400">{m.summary}</p>
                          </div>
                        </div>
                      ))}
                      {studentMilestones.length === 0 && (
                        <div className="text-center py-8 text-xs text-slate-400">
                          Click Update Timeline to view key timestamps and topics covered so far.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

{/* ── MODAL: POST-SESSION EXECUTIVE SUMMARY (FULLY FUNCTIONAL DYNAMIC REPORT) ───────── */}
      {showPostSessionSummaryModal && postSessionSummary && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Lecture Session Completed</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live AI Summary
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {postSessionSummary.title || "Lecture"} • {postSessionSummary.subject || "Academic Lesson"} (Grade {postSessionSummary.grade || 1})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPostSessionSummaryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Overview */}
              <div className="p-4 rounded-2xl bg-[#0B0F19] border border-amber-500/15 space-y-1.5">
                <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Executive Lecture Overview
                </span>
                <p className="text-slate-200 leading-relaxed">
                  {postSessionSummary.overview}
                </p>
              </div>

              {/* Key Topics Covered */}
              {postSessionSummary.key_topics && postSessionSummary.key_topics.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-300 text-xs">Key Concepts & Topics Covered:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {postSessionSummary.key_topics.map((t: string, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Core Whiteboard Takeaways */}
              {postSessionSummary.whiteboard_notes && postSessionSummary.whiteboard_notes.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-300 text-xs">Core Formulas & Whiteboard Takeaways:</span>
                  <ul className="space-y-1 pl-2 text-slate-300">
                    {postSessionSummary.whiteboard_notes.map((n: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Case Studies / Applications */}
              {postSessionSummary.case_studies && postSessionSummary.case_studies.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                  <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    Practical Real-World Case Study
                  </span>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {postSessionSummary.case_studies.join(" ")}
                  </p>
                </div>
              )}

              {/* Interactive Self-Assessment Quiz */}
              {postSessionSummary.quiz && postSessionSummary.quiz.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    Self-Assessment Check (Based on today's lecture):
                  </span>
                  {postSessionSummary.quiz.map((q: any, qi: number) => (
                    <div key={qi} className="p-3 rounded-xl bg-[#0B0F19] border border-amber-500/15 space-y-2">
                      <p className="text-white font-medium">{qi + 1}. {q.question}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                        {q.options?.map((opt: string, oi: number) => (
                          <div
                            key={oi}
                            className={`p-2 rounded-lg text-[11px] border ${
                              oi === q.correct_index
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-semibold'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            <span className="font-bold mr-1.5">{String.fromCharCode(65 + oi)}.</span>
                            {opt}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <p className="text-[10px] text-slate-400 italic pl-2 pt-1 border-t border-slate-800/60">
                          Explanation: {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                onClick={() => setShowPostSessionSummaryModal(false)}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition"
              >
                Close & Return to Classroom Lobby
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: Watch Class Recording with AI Doubt Solver & Summary */}
      {selectedRecordingUrl && (
        <AiRecordingPlayerModal
          recordingUrl={selectedRecordingUrl}
          classInfo={selectedRecordingClass}
          onClose={() => {
            setSelectedRecordingUrl(null)
            setSelectedRecordingClass(null)
          }}
        />
      )}

      {/* RECORDING UPLOAD PROGRESS TOAST */}

      {recordingUploadProgress && (

        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-purple-500/40 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 max-w-md">

          {isUploadingRecording ? (

            <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />

          ) : (

            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />

          )}

          <div className="flex-1">

            <p className="text-xs font-bold text-white">Class Lecture Recording</p>

            <p className="text-[11px] text-slate-300">{recordingUploadProgress}</p>

          </div>

        </div>

      )}

    </div>

  )

}

