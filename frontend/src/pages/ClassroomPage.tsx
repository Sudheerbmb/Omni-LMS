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
  BookOpen,
  Radio,
  CheckCircle,
  Eye
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

interface PeerUser {
  id: string
  display_name: string
  role: string
  avatar: string
  isMicOn?: boolean
  isCameraOn?: boolean
  isHandRaised?: boolean
}

export const ClassroomPage: React.FC<ClassroomPageProps> = ({ user }) => {
  const [classes, setClasses] = useState<SchoolLiveClass[]>([])
  const [teacherSlots, setTeacherSlots] = useState<TeacherTimetableSlot[]>([])
  const [loading, setLoading] = useState(true)

  // Scheduling Modal State
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
  const remoteScreenVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  // Remote Screen Share State (Received from Presenter)
  const [remoteScreenInfo, setRemoteScreenInfo] = useState<{
    active: boolean
    sharerName: string
    sharerId: string
  }>({ active: false, sharerName: '', sharerId: '' })
  const [remoteScreenFrame, setRemoteScreenFrame] = useState<string | null>(null)
  const [hasRemoteWebRTCStream, setHasRemoteWebRTCStream] = useState(false)

  // Connected Peers Roster State
  const [connectedPeers, setConnectedPeers] = useState<Record<string, PeerUser>>({})
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  // Real-Time WebSocket & WebRTC references
  const wsRef = useRef<WebSocket | null>(null)
  const myPeerIdRef = useRef<string>(`peer_${user.id ? user.id.substring(0, 8) : Math.random().toString(36).substring(2, 8)}_${Math.random().toString(36).substring(2, 6)}`)
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({})
  const screenFrameIntervalRef = useRef<number | null>(null)
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

  // Live Poll State
  const [activePoll, setActivePoll] = useState<PollData>({
    id: 'poll-1',
    question: 'How clear is the concept presented in this session?',
    options: [
      { text: 'Extremely clear, fully understood!', votes: 2 },
      { text: 'Understood most parts, need slight revision', votes: 1 },
      { text: 'Need a brief recap / clarification', votes: 0 }
    ],
    totalVotes: 3,
    isActive: true
  })
  const [hasVoted, setHasVoted] = useState(false)

  // Meeting duration timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Filter state
  const [filterGrade, setFilterGrade] = useState<number | 'all'>('all')

  const isTeacher = user.role === 'teacher'
  const isAdmin = user.role === 'admin'

  // ── Helper to send WebSocket message safely ───────────────────────────────────
  const sendWsMessage = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  // ── WebRTC Configuration with Public STUN Servers ─────────────────────────────
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  }

  // ── Scroll chat to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ── Load Classroom Schedule & Teacher Slots on Mount ────────────────────────
  useEffect(() => {
    loadClassroomData()
  }, [filterGrade])

  const loadClassroomData = async () => {
    try {
      setLoading(true)
      const gradeQuery = filterGrade === 'all' ? undefined : filterGrade
      const liveData = await getSchoolLiveClasses(gradeQuery !== undefined ? { grade_number: gradeQuery } : undefined)
      setClasses(liveData)

      if (isTeacher || isAdmin) {
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

  // ── Meeting Timer Interval ──────────────────────────────────────────────────
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

  // ── WebRTC / WebSocket Room Connection Lifecycle ─────────────────────────────
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
      setConnectedPeers({})
      setRemoteScreenInfo({ active: false, sharerName: '', sharerId: '' })
      setRemoteScreenFrame(null)
      setHasRemoteWebRTCStream(false)
      return
    }

    const roomId = activeCallRoom.id
    const myPeerId = myPeerIdRef.current
    const myDisplayName = user.display_name || user.email || (isTeacher ? 'Instructor' : 'Student')
    const myRole = user.role || 'student'

    // Form connection URL: if frontend is on Vercel and backend on Railway, connect directly to backend:
    let wsBase = ''
    const apiUrl = import.meta.env.VITE_API_URL
    if (apiUrl && typeof apiUrl === 'string' && apiUrl.startsWith('http')) {
      const parsed = new URL(apiUrl)
      const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
      wsBase = `${wsProto}//${parsed.host}`
    } else {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsBase = `${wsProto}//${window.location.host}`
    }

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
      // Announce initial presence payload
      socket.send(JSON.stringify({
        type: 'peer_join',
        peerId: myPeerId,
        user: myUserPayload
      }))

      // Heartbeat presence ping every 2.5s to guarantee 100% presence
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'peer_presence',
            peerId: myPeerId,
            user: {
              id: myPeerId,
              display_name: myDisplayName,
              role: myRole,
              avatar: myDisplayName.charAt(0).toUpperCase(),
              isMicOn,
              isCameraOn,
              isHandRaised
            }
          }))
        }
      }, 2500)
    }

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          // ── Authoritative Room State from Server ────────────────────────────
          case 'room_state': {
            console.log('[Classroom WS] Received authoritative room_state:', data.peers)
            const peerMap: Record<string, PeerUser> = {}
            if (Array.isArray(data.peers)) {
              data.peers.forEach((p: any) => {
                if (p.peerId && p.peerId !== myPeerId) {
                  peerMap[p.peerId] = p.user
                }
              })
            }
            setConnectedPeers(peerMap)
            break
          }

          // ── Peer Joined / Presence Update ───────────────────────────────────
          case 'peer_join':
          case 'peer_presence':
          case 'peer_announce': {
            if (data.peerId && data.peerId !== myPeerId && data.user) {
              setConnectedPeers(prev => ({
                ...prev,
                [data.peerId]: data.user
              }))

              // If WE are sharing screen, initiate WebRTC offer to this peer
              if (screenStreamRef.current && isScreenSharing) {
                createPeerOfferForStream(data.peerId, screenStreamRef.current)
              }
            }
            break
          }

          // ── Peer Left ───────────────────────────────────────────────────────
          case 'peer_leave': {
            if (data.peerId) {
              setConnectedPeers(prev => {
                const next = { ...prev }
                delete next[data.peerId]
                return next
              })
              if (peerConnectionsRef.current[data.peerId]) {
                peerConnectionsRef.current[data.peerId].close()
                delete peerConnectionsRef.current[data.peerId]
              }
              if (remoteScreenInfo.sharerId === data.peerId) {
                setRemoteScreenInfo({ active: false, sharerName: '', sharerId: '' })
                setRemoteScreenFrame(null)
                setHasRemoteWebRTCStream(false)
                setCallView('gallery')
              }
            }
            break
          }

          // ── Real-Time Chat Message ──────────────────────────────────────────
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

          // ── Real-Time Collaborative Whiteboard Vector Strokes ───────────────
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

          // ── Floating Emoji Reaction ─────────────────────────────────────────
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

          // ── Live Poll Voting ─────────────────────────────────────────────────
          case 'poll_vote': {
            if (typeof data.optionIndex === 'number') {
              setActivePoll(prev => {
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

          // ── Screen Share State Broadcasts ───────────────────────────────────
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
            setHasRemoteWebRTCStream(false)
            if (remoteScreenVideoRef.current) {
              remoteScreenVideoRef.current.srcObject = null
            }
            setCallView('gallery')
            break
          }

          // ── Fallback High-Speed Screen Snapshot Broadcast ───────────────────
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

          // ── WebRTC Signaling ────────────────────────────────────────────────
          case 'webrtc_offer': {
            if (data.targetPeerId === myPeerId && data.offer) {
              await handleIncomingPeerOffer(data.senderPeerId, data.offer, data.sharerName)
            }
            break
          }

          case 'webrtc_answer': {
            if (data.targetPeerId === myPeerId && data.answer) {
              const pc = peerConnectionsRef.current[data.senderPeerId]
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
              }
            }
            break
          }

          case 'webrtc_ice': {
            if (data.targetPeerId === myPeerId && data.candidate) {
              const pc = peerConnectionsRef.current[data.senderPeerId]
              if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(err => {
                  console.warn('ICE Candidate add error:', err)
                })
              }
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
    }

    socket.onclose = () => {
      console.log('[Classroom WS] Disconnected')
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      socket.close()
    }
  }, [activeCallRoom])

  // ── WebRTC Presenter: Create Offer to Broadcast Screen Track ──────────────────
  const createPeerOfferForStream = async (targetPeerId: string, stream: MediaStream) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig)
      peerConnectionsRef.current[targetPeerId] = pc

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

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

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      sendWsMessage({
        type: 'webrtc_offer',
        targetPeerId,
        senderPeerId: myPeerIdRef.current,
        sharerName: user.display_name || 'Presenter',
        offer
      })
    } catch (err) {
      console.error('[WebRTC] Failed to create offer for peer:', targetPeerId, err)
    }
  }

  // ── WebRTC Attendee: Handle Incoming Offer & Render Remote Stream ──────────────
  const handleIncomingPeerOffer = async (senderPeerId: string, offer: RTCSessionDescriptionInit, sharerName?: string) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig)
      peerConnectionsRef.current[senderPeerId] = pc

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0]
          if (remoteScreenVideoRef.current) {
            remoteScreenVideoRef.current.srcObject = remoteStream
            remoteScreenVideoRef.current.play().catch(() => {})
          }
          setHasRemoteWebRTCStream(true)
          setRemoteScreenInfo({
            active: true,
            sharerName: sharerName || 'Presenter',
            sharerId: senderPeerId
          })
          setCallView('spotlight')
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWsMessage({
            type: 'webrtc_ice',
            targetPeerId: senderPeerId,
            senderPeerId: myPeerIdRef.current,
            candidate: event.candidate
          })
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      sendWsMessage({
        type: 'webrtc_answer',
        targetPeerId: senderPeerId,
        senderPeerId: myPeerIdRef.current,
        answer
      })
    } catch (err) {
      console.error('[WebRTC] Failed to answer incoming offer:', err)
    }
  }

  // ── Camera and Microphone Local Media Handling ─────────────────────────────────
  const startCameraStream = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true
        })
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        setIsCameraOn(true)
        setIsMicOn(true)
      }
    } catch (err) {
      console.warn('Media devices camera/mic permission not granted:', err)
      setIsCameraOn(false)
      setIsMicOn(false)
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
    if (screenFrameIntervalRef.current) {
      clearInterval(screenFrameIntervalRef.current)
      screenFrameIntervalRef.current = null
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

  // ── Screen Sharing with Dual WebRTC + High-Speed Frame Broadcaster ─────────────
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

          // Broadcast Screen Share Start notification
          sendWsMessage({
            type: 'screen_share_start',
            sharerId: myPeerIdRef.current,
            sharerName: user.display_name || (isTeacher ? 'Dr. Sarah Connor' : 'Presenter')
          })

          // Create WebRTC Offer for each peer in the room
          Object.keys(connectedPeers).forEach(peerId => {
            createPeerOfferForStream(peerId, screenStream)
          })

          // Real-time canvas snapshot broadcaster
          const hiddenCanvas = document.createElement('canvas')
          hiddenCanvas.width = 960
          hiddenCanvas.height = 540
          const hiddenCtx = hiddenCanvas.getContext('2d')

          screenFrameIntervalRef.current = window.setInterval(() => {
            if (screenVideoRef.current && hiddenCtx && screenVideoRef.current.videoWidth > 0) {
              hiddenCtx.drawImage(screenVideoRef.current, 0, 0, hiddenCanvas.width, hiddenCanvas.height)
              const frameData = hiddenCanvas.toDataURL('image/jpeg', 0.65)
              sendWsMessage({
                type: 'screen_frame',
                sharerId: myPeerIdRef.current,
                sharerName: user.display_name || (isTeacher ? 'Dr. Sarah Connor' : 'Presenter'),
                frameData
              })
            }
          }, 150)

          screenStream.getVideoTracks()[0].onended = () => {
            handleStopScreenShare()
          }
        }
      } catch (err) {
        console.warn('Screen share cancelled or not allowed:', err)
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
    handleStopScreenShare()
    stopCameraStream()
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
    sendWsMessage({ type: 'reaction', emoji })
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id))
    }, 2800)
  }

  // ── Live In-Call Chat ────────────────────────────────────────────────────────
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatText.trim()) return

    const msg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: user.display_name || user.email || (isTeacher ? 'Dr. Sarah Connor' : 'Student'),
      role: user.role || 'student',
      text: newChatText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    // Broadcast through WebSocket to all other participants
    sendWsMessage({ type: 'chat', payload: msg })

    // Add to local state immediately
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
    sendWsMessage({ type: 'poll_vote', optionIndex })
  }

  // ── Interactive Collaborative Whiteboard Drawing ────────────────────────────
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

    // Broadcast stroke to other peers via WebSocket
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

  // ── RENDER 1: FULL-SCREEN IN-CALL VIDEO ROOM (Zoom / Teams / Omni-Classroom) ──
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
        <header className="h-16 px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-cyan-500/20">
              {activeCallRoom.subject_code ? activeCallRoom.subject_code.slice(0, 3) : 'LMS'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-white truncate max-w-sm sm:max-w-md">
                  {activeCallRoom.title}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                  <Radio className="w-3 h-3 animate-pulse text-red-500" />
                  LIVE
                </span>
                {isPresenterActive && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                    <Monitor className="w-3 h-3" />
                    {isScreenSharing ? 'Sharing Your Screen' : `${remoteScreenInfo.sharerName} is Presenting`}
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
                {activeCallRoom.room_number && (
                  <>
                    <span>&bull;</span>
                    <span>Venue: {activeCallRoom.room_number}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
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

            {/* End / Leave Button */}
            {(isTeacher || isAdmin) ? (
              <button
                onClick={handleEndClassAsHost}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center gap-1.5"
              >
                End Meeting
              </button>
            ) : (
              <button
                onClick={handleLeaveClass}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all flex items-center gap-1.5 border border-slate-700"
              >
                Leave
              </button>
            )}
          </div>
        </header>

        {/* Remote Screen Share Alert Pill for Students */}
        {remoteScreenInfo.active && callView !== 'spotlight' && (
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 flex items-center justify-between text-xs font-bold text-white shadow-md z-30">
            <span className="flex items-center gap-2">
              <Monitor className="w-4 h-4 animate-bounce" />
              {remoteScreenInfo.sharerName} is sharing their screen right now!
            </span>
            <button
              onClick={() => setCallView('spotlight')}
              className="px-3 py-0.5 bg-white text-slate-900 rounded-lg font-black hover:bg-slate-100 flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" /> View Screen
            </button>
          </div>
        )}

        {/* MAIN STAGE CONTENT AREA */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
            {callView === 'whiteboard' ? (
              /* VIEW MODE A: REAL-TIME COLLABORATIVE WHITEBOARD */
              <div className="flex-1 flex flex-col bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl relative">
                {/* Whiteboard Toolbar */}
                <div className="h-14 px-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <PenTool className="w-4 h-4" /> Live Collaborative Canvas
                    </span>
                    <div className="h-4 w-px bg-slate-800" />
                    <button
                      onClick={() => setWhiteboardTool('pen')}
                      className={`p-2 rounded-lg transition-all ${
                        whiteboardTool === 'pen' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Pen Tool"
                    >
                      <PenTool className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setWhiteboardTool('eraser')}
                      className={`p-2 rounded-lg transition-all ${
                        whiteboardTool === 'eraser' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Eraser"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>

                    {/* Color palette */}
                    <div className="flex items-center gap-1.5 ml-2">
                      {['#38bdf8', '#4ade80', '#f43f5e', '#fbbf24', '#ffffff'].map(c => (
                        <button
                          key={c}
                          onClick={() => { setWhiteboardColor(c); setWhiteboardTool('pen') }}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full transition-transform ${whiteboardColor === c && whiteboardTool === 'pen' ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`}
                        />
                      ))}
                    </div>

                    {/* Width selector */}
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={whiteboardWidth}
                      onChange={(e) => setWhiteboardWidth(Number(e.target.value))}
                      className="w-20 accent-cyan-400 cursor-pointer ml-2"
                      title="Pen Stroke Width"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearWhiteboard}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear All
                    </button>
                    <button
                      onClick={downloadWhiteboard}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" /> Export PNG
                    </button>
                  </div>
                </div>

                {/* Whiteboard Surface */}
                <div className="flex-1 bg-[#0f172a] relative overflow-hidden flex items-center justify-center cursor-crosshair">
                  <canvas
                    ref={canvasRef}
                    width={1920}
                    height={1080}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-3 right-4 px-3 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 pointer-events-none">
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
                    /* REMOTE ATTENDEE: Viewing Teacher / Presenter's Screen */
                    <div className="w-full h-full relative bg-black flex items-center justify-center">
                      {/* WebRTC Video Element (High-framerate video stream) */}
                      <video
                        ref={remoteScreenVideoRef}
                        autoPlay
                        playsInline
                        className={`w-full h-full object-contain ${hasRemoteWebRTCStream ? 'block' : 'hidden'}`}
                      />

                      {/* Fallback Screen Frame Broadcaster (Instant snapshot image) */}
                      {!hasRemoteWebRTCStream && remoteScreenFrame && (
                        <img
                          src={remoteScreenFrame}
                          alt="Remote Screen Broadcast"
                          className="w-full h-full object-contain"
                        />
                      )}

                      {!hasRemoteWebRTCStream && !remoteScreenFrame && (
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <Monitor className="w-12 h-12 text-cyan-400 animate-pulse" />
                          <p className="text-sm font-semibold">Connecting to {remoteScreenInfo.sharerName}'s screen share...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Regular Spotlight (Teacher Stage) */
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
                  {/* Local camera preview */}
                  <div className="h-36 rounded-2xl bg-slate-900 border border-slate-800 p-3 relative overflow-hidden flex flex-col justify-between shrink-0 shadow-lg">
                    <div className="w-full h-full flex items-center justify-center">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover rounded-xl ${isCameraOn && localStreamRef.current ? 'block' : 'hidden'}`}
                      />
                      {(!isCameraOn || !localStreamRef.current) && (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-base font-bold text-white shadow-md">
                          {user.display_name?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 text-[10px] font-bold text-slate-300 flex items-center gap-1">
                      <span>You ({isTeacher ? 'Teacher' : 'Student'})</span>
                      {!isMicOn && <MicOff className="w-2.5 h-2.5 text-red-400" />}
                    </div>
                  </div>

                  {/* Connected remote peers filmstrip */}
                  {Object.entries(connectedPeers).map(([pId, peer]) => (
                    <div key={pId} className="h-36 rounded-2xl bg-slate-900 border border-slate-800 p-3 relative overflow-hidden flex flex-col justify-between shrink-0 shadow-lg animate-in fade-in duration-300">
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border border-cyan-400 flex items-center justify-center text-base font-bold text-white shadow-md">
                          {peer.avatar || peer.display_name.charAt(0)}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-200 mt-2 truncate max-w-[140px]">
                          {peer.display_name}
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 text-[10px] font-bold text-slate-300 flex items-center gap-1">
                        <span>{peer.display_name}</span>
                        <span className="text-[9px] text-cyan-400 font-normal">({peer.role})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* VIEW MODE C: GALLERY GRID VIEW (Equal video tiles for all participants) */
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4 overflow-y-auto pr-1">
                {/* 1. Local User Tile */}
                <div className="rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl flex flex-col min-h-[240px]">
                  <div className="flex-1 flex items-center justify-center relative bg-gradient-to-tr from-slate-900 to-slate-950">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isCameraOn && localStreamRef.current ? 'block' : 'hidden'}`}
                    />
                    {(!isCameraOn || !localStreamRef.current) && (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 border-2 border-cyan-400 flex items-center justify-center text-3xl font-black text-white shadow-2xl">
                          {user.display_name?.charAt(0) || 'U'}
                        </div>
                        <span className="text-sm font-bold text-slate-300">{user.display_name || user.email}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-bold text-white flex items-center gap-2">
                    <span>You ({user.display_name || user.email})</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      {isTeacher ? 'Host' : 'Student'}
                    </span>
                    {!isMicOn && <MicOff className="w-3 h-3 text-red-400 ml-1" />}
                  </div>
                  {isHandRaised && (
                    <div className="absolute top-3 right-3 p-1.5 rounded-full bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 animate-bounce">
                      <Hand className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* 2. Connected Remote Peers Tiles */}
                {Object.entries(connectedPeers).map(([pId, peer]) => (
                  <div key={pId} className="rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl flex flex-col min-h-[240px] animate-in zoom-in-95 duration-300">
                    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 to-slate-950">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border-2 border-cyan-400 flex items-center justify-center text-3xl font-black text-white shadow-2xl">
                        {peer.avatar || peer.display_name.charAt(0)}
                      </div>
                      <h4 className="text-base font-bold text-white mt-3">{peer.display_name}</h4>
                      <p className="text-xs text-slate-400 capitalize">{peer.role}</p>
                    </div>
                    <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-bold text-white flex items-center gap-2">
                      <span>{peer.display_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {peer.role}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Fallback tile only if alone */}
                {totalParticipantCount === 1 && (
                  <div className="rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-6 min-h-[240px]">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3">
                      <Users className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h4 className="font-bold text-sm text-slate-300">Waiting for others to join...</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      When attendees join this Grade {activeCallRoom.grade_number}-{activeCallRoom.section_name} session, their video tiles will appear right here automatically.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SIDE DRAWER (Chat, Participants, Polls) */}
          {activeSideDrawer && (
            <aside className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-30 animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeSideDrawer === 'chat' && (
                    <>
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-bold text-sm text-white">Live In-Call Chat</h3>
                    </>
                  )}
                  {activeSideDrawer === 'participants' && (
                    <>
                      <Users className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-bold text-sm text-white">Attendees ({totalParticipantCount})</h3>
                    </>
                  )}
                  {activeSideDrawer === 'polls' && (
                    <>
                      <BarChart2 className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-bold text-sm text-white">Interactive Live Poll</h3>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setActiveSideDrawer(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* DRAWER 1: IN-CALL CHAT */}
              {activeSideDrawer === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {chatMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          m.sender === (user.display_name || user.email) ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                          <span className="font-bold text-slate-300">{m.sender}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                            m.role === 'teacher' ? 'bg-cyan-500/20 text-cyan-400' :
                            m.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                            m.role === 'system' ? 'bg-slate-800 text-slate-400' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {m.role}
                          </span>
                          <span className="text-slate-500 text-[10px]">{m.timestamp}</span>
                        </div>
                        <div className={`p-3 rounded-2xl text-xs max-w-[85%] break-words ${
                          m.sender === (user.display_name || user.email)
                            ? 'bg-cyan-600 text-white rounded-tr-none'
                            : m.role === 'system'
                            ? 'bg-slate-800/80 text-cyan-300 italic border border-slate-700 w-full text-center'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/60'
                        }`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>

                  <form onSubmit={handleSendChat} className="p-3 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      placeholder="Type message to class..."
                      value={newChatText}
                      onChange={(e) => setNewChatText(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={!newChatText.trim()}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* DRAWER 2: PARTICIPANTS ROSTER */}
              {activeSideDrawer === 'participants' && (
                <div className="flex-1 p-4 overflow-y-auto space-y-2">
                  {/* Current User */}
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs border border-cyan-500/30">
                        {user.display_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          {user.display_name || user.email} (You)
                        </h4>
                        <span className="text-[10px] text-cyan-400 font-semibold uppercase">{user.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      {isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}
                      {isCameraOn ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                  </div>

                  {/* Connected Remote Peers */}
                  {Object.entries(connectedPeers).map(([pId, peer]) => (
                    <div key={pId} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-md">
                          {peer.avatar || peer.display_name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">{peer.display_name}</h4>
                          <span className="text-[10px] text-slate-400 capitalize">{peer.role}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DRAWER 3: INTERACTIVE LIVE POLL */}
              {activeSideDrawer === 'polls' && (
                <div className="flex-1 p-5 overflow-y-auto flex flex-col justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      Question of the Hour
                    </span>
                    <h4 className="text-sm font-bold text-white mt-2 leading-relaxed">
                      {activePoll.question}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">Total votes submitted: {activePoll.totalVotes}</p>

                    <div className="mt-4 space-y-3">
                      {activePoll.options.map((opt, i) => {
                        const pct = activePoll.totalVotes > 0 ? Math.round((opt.votes / activePoll.totalVotes) * 100) : 0
                        return (
                          <button
                            key={i}
                            disabled={hasVoted}
                            onClick={() => handleVote(i)}
                            className={`w-full p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                              hasVoted
                                ? 'bg-slate-800/80 border-slate-700 cursor-default'
                                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-cyan-500/50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-semibold z-10">
                              <span className="text-slate-200">{opt.text}</span>
                              <span className="text-cyan-400 font-bold ml-2">{pct}%</span>
                            </div>
                            <div
                              className="absolute left-0 top-0 bottom-0 bg-cyan-500/20 transition-all duration-500 ease-out"
                              style={{ width: `${pct}%` }}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {hasVoted && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-300 font-bold flex items-center justify-center gap-2 mt-4">
                      <CheckCircle className="w-4 h-4" /> Thank you for voting! Results sync live.
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* BOTTOM CALL CONTROL BAR */}
        <footer className="h-20 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between shrink-0 z-30">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Classroom:</span>
            <span className="text-xs font-bold text-slate-200">{activeCallRoom.title}</span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 mx-auto sm:mx-0">
            <button
              onClick={toggleMic}
              className={`p-3.5 rounded-2xl font-bold transition-all shadow-md ${
                isMicOn ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
              title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleCamera}
              className={`p-3.5 rounded-2xl font-bold transition-all shadow-md ${
                isCameraOn ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
              title={isCameraOn ? 'Turn Video Off' : 'Turn Video On'}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-2xl font-bold transition-all shadow-md ${
                isScreenSharing
                  ? 'bg-cyan-500 text-slate-950 font-black ring-4 ring-cyan-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen (Broadcast to Students)'}
            >
              <Monitor className="w-5 h-5" />
            </button>

            <button
              onClick={() => setCallView(callView === 'whiteboard' ? 'gallery' : 'whiteboard')}
              className={`p-3.5 rounded-2xl font-bold transition-all shadow-md ${
                callView === 'whiteboard'
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title="Interactive Collaborative Whiteboard"
            >
              <PenTool className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                const next = !isHandRaised
                setIsHandRaised(next)
                if (next) triggerReaction('✋')
              }}
              className={`p-3.5 rounded-2xl font-bold transition-all shadow-md ${
                isHandRaised ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title="Raise / Lower Hand"
            >
              <Hand className="w-5 h-5" />
            </button>

            <div className="hidden lg:flex items-center gap-1 bg-slate-950 px-2 py-1.5 rounded-2xl border border-slate-800">
              {['👏', '❤️', '🎉', '💡', '🔥'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => triggerReaction(emoji)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-800 flex items-center justify-center text-lg transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveSideDrawer(activeSideDrawer === 'chat' ? null : 'chat')
                setUnreadChatCount(0)
              }}
              className={`p-3 rounded-xl text-xs font-semibold relative transition-all ${
                activeSideDrawer === 'chat' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="In-call Chat"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSideDrawer(activeSideDrawer === 'participants' ? null : 'participants')}
              className={`p-3 rounded-xl text-xs font-semibold transition-all ${
                activeSideDrawer === 'participants' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="Attendees Roster"
            >
              <Users className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveSideDrawer(activeSideDrawer === 'polls' ? null : 'polls')}
              className={`p-3 rounded-xl text-xs font-semibold transition-all ${
                activeSideDrawer === 'polls' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="Live Polls"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </div>
    )
  }

  // ── RENDER 2: CLASSROOM HUB / DASHBOARD VIEW ─────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Live Interactive Classrooms
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
              Timetable Linked
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time HD audio/video lectures, collaborative whiteboards, live polls, and instant screen sharing.
          </p>
        </div>

        {(isTeacher || isAdmin) && (
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Schedule / Launch Live Class
          </button>
        )}
      </div>

      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 ml-2">Grade Filter:</span>
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Grades (1 to 10)</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(g => (
              <option key={g} value={g}>Class {g}</option>
            ))}
          </select>
        </div>

        <button
          onClick={loadClassroomData}
          className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 px-3 py-1.5 rounded-lg hover:bg-cyan-50 transition-colors"
        >
          Refresh Sessions
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Loading live classes...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Active Live Sessions</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {isTeacher || isAdmin
              ? 'Click the "Schedule / Launch Live Class" button to pick a timetable slot and begin teaching your students.'
              : 'There are currently no active or scheduled live lectures for your grade. Check back during scheduled class hours!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => {
            const isLive = cls.status === 'live'
            const isEnded = cls.status === 'ended'

            return (
              <div
                key={cls.id}
                className={`bg-white rounded-3xl border p-5 transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                  isLive ? 'border-red-500/40 ring-2 ring-red-500/10' : 'border-slate-200/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-slate-100 text-slate-700">
                      Class {cls.grade_number}-{cls.section_name}
                    </span>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        LIVE NOW
                      </span>
                    ) : isEnded ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                        Ended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600">
                        Scheduled
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-cyan-600 transition-colors line-clamp-1">
                    {cls.title}
                  </h3>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-600" />
                      <span className="font-semibold text-slate-700">{cls.subject_name}</span>
                      {cls.period_number && (
                        <span className="text-slate-400">&bull; Period {cls.period_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                      <span>Instructor: {cls.teacher_name || 'Assigned Teacher'}</span>
                    </div>
                    {cls.room_number && (
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Assigned Room: {cls.room_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 font-medium">
                    {new Date(cls.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  {!isEnded ? (
                    <button
                      onClick={() => handleJoinClass(cls)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                        isLive
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isLive ? 'Join Live Lecture' : (isTeacher || isAdmin) ? 'Start Lecture Now' : 'Join Classroom'}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 italic">Session Concluded</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Schedule School Live Class</h3>
                  <p className="text-xs text-slate-500">Pick from your assigned timetable periods</p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Assigned Timetable Period & Class
                </label>
                {teacherSlots.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    No scheduled timetable slots found for your profile. Please check school master timetable.
                  </div>
                ) : (
                  <select
                    value={selectedSlotIndex}
                    onChange={(e) => setSelectedSlotIndex(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:border-cyan-500"
                  >
                    {teacherSlots.map((slot, idx) => (
                      <option key={idx} value={idx}>
                        Period {slot.period_number} &bull; {slot.grade_name} &bull; {slot.subject_name} ({slot.start_time} - {slot.end_time})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Session Topic / Custom Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4: Quadratic Equations & Graphing"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="instantLaunch"
                  checked={instantLaunch}
                  onChange={(e) => setInstantLaunch(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 accent-cyan-600 cursor-pointer"
                />
                <label htmlFor="instantLaunch" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Launch Live Classroom Immediately (Enter session right away)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSchedule || teacherSlots.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {submittingSchedule ? 'Scheduling...' : instantLaunch ? 'Start Live Class' : 'Schedule Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
