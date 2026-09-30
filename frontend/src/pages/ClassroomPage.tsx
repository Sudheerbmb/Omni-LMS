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
  RotateCcw,
  Download,
  Hand,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UserX,
  VolumeX,
  X,
  Check
} from 'lucide-react'
import {
  getSchoolLiveClasses,
  getTeacherTimetableSlots,
  createSchoolLiveClass,
  updateLiveClassStatus,
  getWsBaseUrl
} from '../lib/api'
import type { SchoolLiveClass, TeacherTimetableSlot } from '../lib/api'

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

  // Attach media stream to video and audio elements
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream
      }
      videoRef.current.play().catch(err => {
        console.warn(`[Video Playback] ${displayName} video autoplay prevented:`, err)
      })
    }
    if (audioRef.current && stream && !isLocal) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream
      }
      audioRef.current.play().catch(err => {
        console.warn(`[Audio Playback] ${displayName} audio autoplay prevented:`, err)
      })
    }
  }, [stream, isLocal, displayName])

  const hasVideoTrack = Boolean(stream && stream.getVideoTracks().length > 0 && isCameraOn)

  return (
    <div
      className={`rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl flex flex-col transition-all duration-300 ${
        isSpotlight ? 'h-full w-full' : 'min-h-[220px] sm:min-h-[260px]'
      }`}
    >
      {/* Video Container */}
      <div className="flex-1 flex items-center justify-center relative bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
        {/* Active Camera Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            hasVideoTrack ? 'opacity-100 block' : 'opacity-0 hidden'
          }`}
        />

        {/* Dedicated Audio Element for Remote Peers */}
        {!isLocal && (
          <audio
            ref={audioRef}
            autoPlay
            playsInline
          />
        )}

        {/* Fallback Avatar Placeholder when Camera is Off */}
        {!hasVideoTrack && (
          <div className="flex flex-col items-center justify-center gap-3 p-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 border-2 border-cyan-400 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-cyan-500/20">
              {avatar || displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-bold text-slate-300 truncate max-w-[180px]">{displayName}</span>
          </div>
        )}
      </div>

      {/* Peer Info & Status Badges */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-bold text-white flex items-center gap-2 max-w-[80%] truncate">
          <span className="truncate">{displayName} {isLocal && '(You)'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase font-semibold">
            {role}
          </span>
          {!isMicOn && <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
        </div>
      </div>

      {/* Hand Raised Floating Badge */}
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

  // Modal Dialogs: End Meeting Confirmation & Kicked Alert
  const [showEndMeetingModal, setShowEndMeetingModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  // Classroom Views: 'gallery' | 'spotlight' | 'whiteboard'
  const [callView, setCallView] = useState<'gallery' | 'spotlight' | 'whiteboard'>('gallery')
  const [activeSideDrawer, setActiveSideDrawer] = useState<'chat' | 'participants' | 'polls' | null>(null)

  // Media Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({})

  // Screen share & fallback frames
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

  // Whiteboard Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [whiteboardTool, setWhiteboardTool] = useState<'pen' | 'eraser'>('pen')
  const [whiteboardColor, setWhiteboardColor] = useState('#38bdf8')
  const [whiteboardWidth, setWhiteboardWidth] = useState(3)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  // Floating Emoji Reactions State
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; left: number }[]>([])

  // Live Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'init_1', sender: 'System', role: 'system', text: 'Welcome to Omni-LMS Real-Time Classroom!', timestamp: 'Now' }
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

  // Meeting duration timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [filterGrade, setFilterGrade] = useState<number | 'all'>('all')

  const isTeacher = user.role === 'teacher'
  const isAdmin = user.role === 'admin'
  const isHost = isTeacher || isAdmin

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

  // Meeting Timer Interval
  useEffect(() => {
    let interval: any = null
    if (activeCallRoom) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else {
      setElapsedSeconds(0)
    }
    return () => clearInterval(interval)
  }, [activeCallRoom])

  // Camera and Microphone Local Media Handling
  const startCameraStream = async (): Promise<MediaStream | null> => {
    let stream: MediaStream | null = null
    setMediaPermissionDenied(false)

    // Attempt 1: HD Video + Audio
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
        // Attempt 2: Standard video + audio
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        console.log('[Media] Acquired standard video + audio')
      } catch (err2) {
        console.warn('[Media] Standard video+audio failed, trying audio-only:', err2)
        try {
          // Attempt 3: Audio-only fallback
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          console.log('[Media] Acquired audio-only stream')
        } catch (err3) {
          console.warn('[Media] Audio-only failed, trying video-only:', err3)
          try {
            // Attempt 4: Video-only fallback
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

      // Add local tracks to all existing peer connections and renegotiate
      Object.entries(peerConnectionsRef.current).forEach(([targetPeerId, pc]) => {
        stream!.getTracks().forEach(track => {
          const senders = pc.getSenders()
          const exists = senders.some(s => s.track && s.track.kind === track.kind)
          if (!exists) {
            pc.addTrack(track, stream!)
          }
        })
        // Trigger renegotiation offer so remote peer receives new tracks immediately
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

    // Attach local camera & mic tracks if already available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    // Attach screen share tracks if active
    if (screenStreamRef.current && isScreenSharing) {
      screenStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, screenStreamRef.current!)
      })
    }

    // Capture incoming remote tracks (audio & video)
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

    // Exchange ICE candidates
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

  // Flush queued ICE candidates after remote description is set
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

  // WebRTC: Create Offer to Target Peer
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

  // WebRTC / WebSocket Room Connection Lifecycle
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

    // Form direct WebSocket URL to Render backend (or local if developing)
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

      // Periodic presence ping every 3s to keep alive and sync mic/cam states
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
          // Initial Room State (Existing Attendees Roster)
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

          // Peer Joined
          case 'peer_join': {
            if (data.peerId && data.peerId !== myPeerId && data.user) {
              setConnectedPeers(prev => ({
                ...prev,
                [data.peerId]: data.user
              }))
              getOrCreatePeerConnection(data.peerId)
            }
            break
          }

          // Peer Presence Update (Mic/Camera/Hand Sync)
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

          // Media State Change
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

          // Peer Left
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

          // MEETING ENDED FOR ALL (Broadcast from Teacher)
          case 'meeting_ended': {
            stopCameraStream()
            setActiveCallRoom(null)
            setAlertMessage(data.reason || 'The instructor has ended this live class session for all attendees.')
            loadClassroomData()
            break
          }

          // REMOVE / KICK STUDENT FROM CLASS
          case 'kick_peer': {
            if (data.targetPeerId === myPeerId) {
              stopCameraStream()
              setActiveCallRoom(null)
              setAlertMessage('You have been removed from this live class by the instructor.')
              loadClassroomData()
            }
            break
          }

          // TEACHER MUTED ALL STUDENTS
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
              // Temporary visual notification
              const id = Date.now() + Math.random()
              setChatMessages(prev => [...prev, {
                id: `sys_${id}`,
                sender: 'System',
                role: 'system',
                text: 'The instructor has muted all participant microphones.',
                timestamp: 'Now'
              }])
            }
            break
          }

          // WebRTC Signaling: Incoming Offer
          case 'webrtc_offer': {
            if (data.targetPeerId === myPeerId && data.offer) {
              const pc = getOrCreatePeerConnection(data.senderPeerId)

              // Polite Peer Glare Prevention:
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

          // WebRTC Signaling: Incoming Answer
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

          // WebRTC Signaling: Incoming ICE Candidate
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

          // Screen Share Broadcasts
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

          // Real-Time In-Call Chat
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

          // Real-Time Collaborative Whiteboard Vector Strokes
          case 'whiteboard_draw': {
            const canvas = canvasRef.current
            if (canvas) {
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.beginPath()
                ctx.moveTo(data.x0, data.y0)
                ctx.lineTo(data.x1, data.y1)
                ctx.strokeStyle = data.tool === 'eraser' ? '#0f172a' : data.color
                ctx.lineWidth = data.tool === 'eraser' ? 26 : data.width
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                ctx.stroke()
              }
            }
            break
          }

          case 'whiteboard_clear': {
            const canvas = canvasRef.current
            if (canvas) {
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.fillStyle = '#0f172a'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
              }
            }
            break
          }

          // Floating Reactions
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

          // NEW CUSTOM POLL CREATED BY TEACHER
          case 'poll_create': {
            if (data.poll) {
              setActivePoll(data.poll)
              setHasVoted(false)
              setActiveSideDrawer('polls')
              // Notify via system message in chat
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

          // Poll Voting
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
  }, [activeCallRoom])

  // Screen Sharing (WebRTC + Fallback Snapshot Broadcaster)
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

          // Add screen tracks to all peer connections
          Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
            screenStream.getTracks().forEach(track => {
              pc.addTrack(track, screenStream)
            })
            createPeerOffer(peerId, pc)
          })

          // High-speed offscreen canvas snapshot broadcaster
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

  // Poll Vote Handler (Now emits real emoji '👍' instead of literal text 'thumbs_up')
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

  // Teacher Custom Poll Creation Handler
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

    // Broadcast new poll to all attendees
    sendWsMessage({
      type: 'poll_create',
      poll: newPoll
    })
  }

  // Teacher "Mute All" Action
  const handleMuteAll = () => {
    if (!isHost) return
    sendWsMessage({ type: 'mute_all' })
    // Mute all remote peers locally in state
    setConnectedPeers(prev => {
      const updated: Record<string, PeerUser> = {}
      Object.entries(prev).forEach(([id, p]) => {
        updated[id] = { ...p, isMicOn: false }
      })
      return updated
    })
  }

  // Teacher "Remove / Kick Student" Action
  const handleKickStudent = (targetPeerId: string, studentName: string) => {
    if (!isHost) return
    const confirmed = window.confirm(`Are you sure you want to remove ${studentName} from this class?`)
    if (!confirmed) return

    sendWsMessage({
      type: 'kick_peer',
      targetPeerId,
      studentName
    })

    // Remove from local peers roster
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

  // Collaborative Whiteboard Drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setIsDrawing(true)
    lastPointRef.current = { x, y }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = whiteboardTool === 'eraser' ? '#0f172a' : whiteboardColor
    ctx.lineWidth = whiteboardTool === 'eraser' ? 26 : whiteboardWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    ctx.lineTo(x, y)
    ctx.stroke()

    sendWsMessage({
      type: 'whiteboard_draw',
      x0: lastPointRef.current.x,
      y0: lastPointRef.current.y,
      x1: x,
      y1: y,
      color: whiteboardColor,
      width: whiteboardWidth,
      tool: whiteboardTool
    })

    lastPointRef.current = { x, y }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    lastPointRef.current = null
  }

  const clearWhiteboard = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
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

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const secs = (totalSeconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  // Enter Meeting Handler: AWAITS LOCAL MEDIA FIRST to guarantee tracks are ready before WebRTC handshake!
  const handleJoinClass = async (liveClass: SchoolLiveClass) => {
    // 1. Acquire media FIRST so tracks are ready when connection opens
    await startCameraStream()
    // 2. Open active room state
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

  // Teacher End Meeting for All
  const handleEndMeetingForAll = async () => {
    if (!activeCallRoom) return
    try {
      // 1. Send WebSocket broadcast to kick all students out
      sendWsMessage({
        type: 'meeting_ended',
        reason: 'The instructor has ended the live session for all participants.'
      })
      // 2. Update status in DB
      await updateLiveClassStatus(activeCallRoom.id, 'ended')
    } catch (err) {
      console.warn('End class error:', err)
    } finally {
      stopCameraStream()
      setActiveCallRoom(null)
      setShowEndMeetingModal(false)
      loadClassroomData()
    }
  }

  // Individual Participant Leaves Meeting
  const handleLeaveMeetingOnly = () => {
    stopCameraStream()
    setActiveCallRoom(null)
    setShowEndMeetingModal(false)
    loadClassroomData()
  }

  // Top Bar Leave/End button click handler
  const handleEndSessionClick = () => {
    if (isHost) {
      setShowEndMeetingModal(true)
    } else {
      handleLeaveMeetingOnly()
    }
  }

  // Schedule New Class Modal Form Handler
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

  // RENDER 1: IN-CALL ROOM (FULLSCREEN VIDEO CLASSROOM)
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

        {/* TOP BAR: Room Title, Timetable Subject, Live Timer, Badges */}
        <header className="h-16 px-4 sm:px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-cyan-500/20">
              {activeCallRoom.subject_code ? activeCallRoom.subject_code.slice(0, 3) : 'LMS'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base text-white truncate max-w-[200px] sm:max-w-md">
                  {activeCallRoom.title}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                  <Radio className="w-3 h-3 animate-pulse text-red-500" />
                  LIVE
                </span>
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
                    <span className="text-cyan-400 font-medium">Period {activeCallRoom.period_number}</span>
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
                onClick={() => setCallView('whiteboard')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  callView === 'whiteboard' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
                }`}
              >
                Whiteboard
              </button>
            </div>

            {/* In-Call Duration Counter */}
            <div className="px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700 font-mono text-xs font-bold text-cyan-300">
              {formatTimer(elapsedSeconds)}
            </div>

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

        {/* Media Permission Warning Banner if device was blocked */}
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
              /* VIEW MODE A: REAL-TIME WHITEBOARD */
              <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
                {/* Whiteboard Toolbar */}
                <div className="h-14 px-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWhiteboardTool('pen')}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        whiteboardTool === 'pen' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <PenTool className="w-4 h-4" />
                      Pen
                    </button>
                    <button
                      onClick={() => setWhiteboardTool('eraser')}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        whiteboardTool === 'eraser' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Eraser
                    </button>

                    <div className="h-5 w-px bg-slate-700 mx-1" />

                    {/* Color Palette */}
                    {['#38bdf8', '#34d399', '#f43f5e', '#fbbf24', '#ffffff'].map(c => (
                      <button
                        key={c}
                        onClick={() => { setWhiteboardColor(c); setWhiteboardTool('pen') }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          whiteboardColor === c && whiteboardTool === 'pen' ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'
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
                          whiteboardWidth === w ? 'bg-slate-700 text-cyan-400' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {w}px
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearWhiteboard}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                    >
                      Clear Canvas
                    </button>
                    <button
                      onClick={downloadWhiteboard}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Download Canvas PNG"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Canvas Area */}
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
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400 pointer-events-none">
                    Multi-user Synchronized Canvas &bull; All students & teachers see updates in real time
                  </div>
                </div>
              </div>
            ) : callView === 'spotlight' || isPresenterActive ? (
              /* VIEW MODE B: SPOTLIGHT / SCREEN SHARING */
              <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col">
                  {/* LOCAL PRESENTER: User is sharing their screen */}
                  {isScreenSharing ? (
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : remoteScreenInfo.active ? (
                    /* REMOTE ATTENDEE: Viewing Presenter's Screen */
                    <div className="w-full h-full relative bg-black flex items-center justify-center">
                      {remoteScreenFrame ? (
                        <img
                          src={remoteScreenFrame}
                          alt="Remote Screen Broadcast"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <Monitor className="w-12 h-12 text-cyan-400 animate-pulse" />
                          <p className="text-sm font-semibold">Connecting to {remoteScreenInfo.sharerName}'s screen share...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Regular Spotlight (Host/Teacher Stage) */
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900">
                      <div className="w-28 h-28 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-3xl font-black text-cyan-400 shadow-xl shadow-cyan-500/10">
                        {activeCallRoom.teacher_name?.charAt(0) || 'T'}
                      </div>
                      <h3 className="text-xl font-black text-white mt-4">{activeCallRoom.teacher_name}</h3>
                      <p className="text-xs text-slate-400 mt-1">Instructor Stage &bull; Primary Speaker</p>
                    </div>
                  )}

                  {/* Stage Label Badge */}
                  <div className="absolute bottom-4 left-4 px-3.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isScreenSharing
                      ? 'You are sharing your screen (Broadcasting Live)'
                      : remoteScreenInfo.active
                      ? `${remoteScreenInfo.sharerName}'s Shared Screen (Live)`
                      : `${activeCallRoom.teacher_name} (Instructor Spotlight)`}
                  </div>
                </div>

                {/* Side participant filmstrip in Spotlight mode */}
                <div className="w-full md:w-64 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto shrink-0">
                  {/* Local preview card */}
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

                  {/* Remote peers filmstrip */}
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
              /* VIEW MODE C: GALLERY GRID VIEW (Equal video tiles for all participants) */
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto pr-1">
                {/* 1. Local User Video Card */}
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

                {/* 2. Remote Peers Cards */}
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

                {/* Helper prompt if alone in the room */}
                {Object.keys(connectedPeers).length === 0 && (
                  <div className="rounded-3xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                    <Users className="w-10 h-10 mb-2 opacity-40 text-cyan-400" />
                    <p className="text-sm font-semibold text-slate-400">Waiting for other participants to join...</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">Share your meeting link with your student or teacher to start conversing!</p>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* SIDE DRAWER: In-Call Chat, Participants, Live Polls */}
          {activeSideDrawer && (
            <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-30 animate-in slide-in-from-right duration-200">
              <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  {activeSideDrawer === 'chat' && (
                    <>
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      In-Call Classroom Chat
                    </>
                  )}
                  {activeSideDrawer === 'participants' && (
                    <>
                      <Users className="w-4 h-4 text-cyan-400" />
                      Attendees ({totalParticipantCount})
                    </>
                  )}
                  {activeSideDrawer === 'polls' && (
                    <>
                      <BarChart2 className="w-4 h-4 text-cyan-400" />
                      Live Comprehension Polls
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
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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

                {/* 2. PARTICIPANTS DRAWER (WITH MUTE ALL & REMOVE STUDENT ACTIONS) */}
                {activeSideDrawer === 'participants' && (
                  <div className="space-y-3">
                    {/* Host Actions: Mute All Students */}
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

                    {/* Local User */}
                    <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center font-bold text-xs text-white">
                          {(user.display_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            {user.display_name || user.email}
                            <span className="text-[9px] px-1 rounded bg-slate-800 text-cyan-400 font-semibold">You</span>
                          </p>
                          <p className="text-[10px] text-slate-400 capitalize">{user.role || 'Participant'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        {isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}
                        {isCameraOn ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                    </div>

                    {/* Remote Attendees */}
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

                          {/* Host Action: Kick/Remove this Student */}
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

                {/* 3. POLLS DRAWER (WITH CUSTOM TEACHER POLL CREATOR) */}
                {activeSideDrawer === 'polls' && (
                  <div className="space-y-4">
                    {/* Teacher Action: Toggle Custom Poll Creator */}
                    {isHost && (
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs text-slate-400 font-medium">Poll Management:</span>
                        <button
                          onClick={() => setShowPollCreator(prev => !prev)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {showPollCreator ? 'Cancel' : 'Create New Poll'}
                        </button>
                      </div>
                    )}

                    {/* Teacher Custom Poll Creation Form */}
                    {showPollCreator && isHost && (
                      <form onSubmit={handleCreatePoll} className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-500/40 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          Launch New Live Poll
                        </h4>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Question:</label>
                          <input
                            type="text"
                            value={pollQuestionInput}
                            onChange={e => setPollQuestionInput(e.target.value)}
                            placeholder="e.g. Do you understand Newton's third law?"
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Options (minimum 2):</label>
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
                                  className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
                              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold mt-2 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Another Option
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

                    {/* Active Live Poll Display */}
                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
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
                                {hasVoted && <span className="font-bold text-cyan-400 text-[11px]">{pct}% ({opt.votes})</span>}
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
              </div>
            </aside>
          )}
        </div>

        {/* BOTTOM CALL CONTROL BAR (Zoom / Teams Style) */}
        <footer className="h-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
          {/* Audio & Video Hardware Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                isMicOn
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30'
              }`}
              title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isMicOn ? <Mic className="w-5 h-5 text-emerald-400" /> : <MicOff className="w-5 h-5 text-red-400" />}
              <span className="hidden sm:inline">{isMicOn ? 'Mute' : 'Unmute'}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                isCameraOn
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30'
              }`}
              title={isCameraOn ? 'Stop Video' : 'Start Video'}
            >
              {isCameraOn ? <Video className="w-5 h-5 text-emerald-400" /> : <VideoOff className="w-5 h-5 text-red-400" />}
              <span className="hidden sm:inline">{isCameraOn ? 'Stop Video' : 'Start Video'}</span>
            </button>
          </div>

          {/* Presentation & Collaboration Center */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                isScreenSharing
                  ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/30 ring-2 ring-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Share2 className="w-5 h-5" />
              <span className="hidden sm:inline">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
            </button>

            <button
              onClick={toggleHandRaise}
              className={`p-3 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all shadow-md active:scale-95 ${
                isHandRaised
                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Hand className="w-5 h-5" />
              <span className="hidden sm:inline">{isHandRaised ? 'Hand Raised' : 'Raise Hand'}</span>
            </button>

            {/* Quick Reactions Bar (Emits real emojis!) */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-950/60 p-1 rounded-2xl border border-slate-800">
              {['👏', '👍', '❤️', '💡', '🎉', '🚀'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => triggerReaction(emoji)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-800 flex items-center justify-center text-sm transition-transform hover:scale-125 active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Right Drawers: Chat, Attendees, Polls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSideDrawer(prev => prev === 'chat' ? null : 'chat')}
              className={`p-3 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition-all relative ${
                activeSideDrawer === 'chat'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="hidden sm:inline">Chat</span>
              {unreadChatCount > 0 && activeSideDrawer !== 'chat' && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSideDrawer(prev => prev === 'participants' ? null : 'participants')}
              className={`p-3 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition-all ${
                activeSideDrawer === 'participants'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="hidden sm:inline">({totalParticipantCount})</span>
            </button>

            <button
              onClick={() => setActiveSideDrawer(prev => prev === 'polls' ? null : 'polls')}
              className={`p-3 rounded-2xl flex items-center gap-1.5 font-bold text-xs transition-all ${
                activeSideDrawer === 'polls'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <BarChart2 className="w-5 h-5" />
            </button>
          </div>
        </footer>

        {/* MODAL: End Session Confirmation for Host */}
        {showEndMeetingModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
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
      </div>
    )
  }

  // RENDER 2: SCHEDULE ROSTER & LAUNCHPAD DASHBOARD
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Alert Banner if kicked or meeting ended */}
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
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
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

      {/* Grade Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterGrade('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filterGrade === 'all'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          All Grades
        </button>
        {[9, 10, 11, 12].map(g => (
          <button
            key={g}
            onClick={() => setFilterGrade(g)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterGrade === g
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Grade {g}
          </button>
        ))}
      </div>

      {/* Live & Scheduled Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-3" />
            <p className="text-sm font-semibold">Loading live classes...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="col-span-full py-16 text-center rounded-3xl bg-slate-900/50 border border-slate-800/80">
            <Calendar className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-300">No Live Classes Scheduled</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {isHost
                ? 'Click "Schedule / Launch Class" above to create an instant session from your assigned timetable periods.'
                : 'Check back when your teachers launch their scheduled timetable sessions.'}
            </p>
          </div>
        ) : (
          classes.map(cls => {
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
                      <span className="text-[11px] font-medium text-cyan-400">Scheduled</span>
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
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
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
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
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
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
    </div>
  )
}
