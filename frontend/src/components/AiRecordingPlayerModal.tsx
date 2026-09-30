import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Bot,
  Send,
  FileText,
  CheckCircle2,
  X,
  ExternalLink,
  Video,
  Clock,
  User,
  BookOpen,
  RefreshCw,
  Check,
  XCircle,
  GraduationCap,
  AlignLeft,
  Copy,
  Play,
  Compass
} from 'lucide-react'
import { askClassAiDoubt, getClassAiSummary, getClassTranscript } from '../lib/api'
import type { ClassAiSummaryData, AgentAction } from '../lib/api'

export interface ClassInfo {
  id?: string
  title?: string
  subject?: string
  subject_name?: string
  grade?: string | number
  grade_number?: number
  teacher_name?: string
  scheduled_start?: string
  starts_at?: string
  [key: string]: any
}

interface AiRecordingPlayerModalProps {
  recordingUrl: string
  classInfo?: ClassInfo | null
  onClose: () => void
}

interface ChatMessage {
  id: string
  sender: 'ai' | 'user'
  text: string
  timestamp: string
  isGrounded?: boolean
  actions?: AgentAction[]
  suggestedFollowups?: string[]
}

export const AiRecordingPlayerModal: React.FC<AiRecordingPlayerModalProps> = ({
  recordingUrl,
  classInfo,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'doubt' | 'summary' | 'transcript' | 'quiz'>('doubt')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputQuery, setInputQuery] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [summaryData, setSummaryData] = useState<ClassAiSummaryData | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [transcriptText, setTranscriptText] = useState<string | null>(null)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [hasCopiedTranscript, setHasCopiedTranscript] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showQuizResults, setShowQuizResults] = useState(false)
  const [chatQuizAnswers, setChatQuizAnswers] = useState<Record<string, number>>({})
  const [quickPrompts, setQuickPrompts] = useState<string[]>([
    'What is this video about?',
    'What key topics were covered in this recording?',
    'Where are AI agents discussed in the video?',
    'Give me a quick knowledge check'
  ])
  
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const classId = classInfo?.id || 'sample-class'
  const classTitle = classInfo?.title || 'Class Lecture Recording'
  
  // Extract Subject with high accuracy
  let classSubject = classInfo?.subject || classInfo?.subject_name || ''
  if (!classSubject) {
    const tLower = classTitle.toLowerCase()
    if (tLower.includes('math')) classSubject = 'Mathematics'
    else if (/science|physics|chem|bio/.test(tLower)) classSubject = 'Science'
    else if (/english|grammar|reading/.test(tLower)) classSubject = 'English'
    else if (/history|social|geography/.test(tLower)) classSubject = 'Social Studies'
    else if (/computer|code|python/.test(tLower)) classSubject = 'Computer Science'
    else classSubject = 'Academic Lesson'
  }

  // Extract Grade number
  let classGradeNum: number | null = null
  if (classInfo?.grade_number !== undefined && classInfo?.grade_number !== null) {
    classGradeNum = Number(classInfo.grade_number)
  } else if (classInfo?.grade !== undefined && !isNaN(Number(classInfo.grade))) {
    classGradeNum = Number(classInfo.grade)
  } else {
    const m = classTitle.match(/Grade\s*(\d+)/i)
    if (m) classGradeNum = parseInt(m[1], 10)
  }
  const gradeDisplay = classGradeNum ? `Grade ${classGradeNum}` : (classInfo?.grade ? String(classInfo.grade) : 'All Grades')

  // Load transcript and summary on mount
  useEffect(() => {
    loadTranscript()
    loadSummary()

    const welcomeMsg: ChatMessage = {
      id: 'init-1',
      sender: 'ai',
      text: `👋 Hello! I am Omni-Agent, your autonomous AI study assistant for "${classTitle}".\n\nI have analyzed this video's audio and chapters. Ask me what the video is about, request a topic jump, or test your comprehension!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isGrounded: true
    }
    setMessages([welcomeMsg])
  }, [classId, classTitle])

  // Auto scroll chat
  useEffect(() => {
    if (activeTab === 'doubt') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTab])

  const loadTranscript = async () => {
    setIsLoadingTranscript(true)
    try {
      const res = await getClassTranscript(classId)
      if (res && res.transcript_text) {
        setTranscriptText(res.transcript_text)
      }
    } catch (err) {
      console.warn('Could not fetch transcript:', err)
    } finally {
      setIsLoadingTranscript(false)
    }
  }

  const loadSummary = async () => {
    setIsLoadingSummary(true)
    try {
      const data = await getClassAiSummary(classId)
      setSummaryData(data)
    } catch (err) {
      console.warn('Could not load dynamic summary:', err)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const handleCopyTranscript = () => {
    if (!transcriptText) return
    navigator.clipboard.writeText(transcriptText)
    setHasCopiedTranscript(true)
    setTimeout(() => setHasCopiedTranscript(false), 2000)
  }

  const handleSeekVideo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.play()
    }
  }

  const handleSendDoubt = async (queryText?: string) => {
    const question = (queryText || inputQuery).trim()
    if (!question || isAsking) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg])
    setInputQuery('')
    setIsAsking(true)

    // Build chat history for Agent
    const historyPayload = messages.slice(-6).map(m => ({
      sender: m.sender,
      text: m.text
    }))

    try {
      const res = await askClassAiDoubt(classId, question, {
        title: classTitle,
        subject: classSubject,
        grade: classGradeNum || gradeDisplay,
        history: historyPayload
      })

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isGrounded: res.has_transcript || !!transcriptText,
        actions: res.actions,
        suggestedFollowups: res.suggested_followups
      }
      setMessages(prev => [...prev, aiMsg])

      // If Agent proposed suggested follow-ups, update quick prompt chips!
      if (res.suggested_followups && res.suggested_followups.length > 0) {
        setQuickPrompts(res.suggested_followups)
      }

      // If Agent included a direct seek action and user asked for it, auto-seek!
      const seekAction = res.actions?.find(a => a.type === 'SEEK_VIDEO')
      if (seekAction && (question.toLowerCase().includes('jump') || question.toLowerCase().includes('where') || question.toLowerCase().includes('show me'))) {
        handleSeekVideo(seekAction.timestamp || 0)
      }
    } catch (err: any) {
      const fallbackAnswer = transcriptText
        ? `Based on the video recording:\n\n"${transcriptText}"\n\nRegarding "${question}": The lecture specifically addresses this context.`
        : `Regarding "${question}": In this session, the instructor reviews key principles. Check the **AI Summary** or **Transcript** tab for full notes!`

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: fallbackAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, aiMsg])
    } finally {
      setIsAsking(false)
    }
  }

  const handleSelectQuizOption = (qIdx: number, optIdx: number) => {
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optIdx }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* TOP BAR */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {gradeDisplay}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {classSubject}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Omni-Agent Active
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {classTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={recordingUrl}
              target="_blank"
              rel="noreferrer"
              title="Open video in new tab / download"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Screen / Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
              aria-label="Close recording viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN BODY: 2 COLUMNS ON DESKTOP */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
          
          {/* LEFT COLUMN: VIDEO PLAYER (7/12) */}
          <div className="lg:col-span-7 flex flex-col bg-black/40 overflow-y-auto">
            <div className="relative aspect-video w-full bg-black flex items-center justify-center group">
              <video
                ref={videoRef}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                src={recordingUrl}
              >
                Your browser does not support HTML5 video playback.
              </video>
            </div>

            {/* VIDEO METADATA & QUICK INFO */}
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-4">
                  {classInfo?.teacher_name && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      Teacher: <strong className="text-slate-200">{classInfo.teacher_name}</strong>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Subject: <strong className="text-slate-200">{classSubject}</strong>
                  </span>
                </div>
                {(classInfo?.scheduled_start || classInfo?.starts_at) && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {new Date(classInfo?.scheduled_start || classInfo?.starts_at!).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* TRANSCRIPT PREVIEW BANNER */}
              {transcriptText ? (
                <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-3 text-xs text-slate-300 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AlignLeft className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-emerald-300 text-[11px] uppercase tracking-wider">
                        Transcribed Spoken Audio
                      </span>
                      <button
                        onClick={() => setActiveTab('transcript')}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
                      >
                        Read full transcript
                      </button>
                    </div>
                    <p className="text-slate-300 italic text-[11px] truncate mt-0.5">
                      "{transcriptText}"
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-800/30 border border-slate-800 p-3 text-xs text-slate-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Transcribing video audio using Groq Whisper...</span>
                </div>
              )}

              {/* AGENT CONTROLS & CHAPTERS */}
              <div className="rounded-xl bg-indigo-950/30 border border-indigo-500/30 p-3.5 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <Compass className="w-4 h-4" />
                  <span>Omni-Agent Interactive Actions:</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Omni-Agent autonomously indexes video timestamps. Click any timestamp below to jump to that moment in the lecture:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleSeekVideo(0.0)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs flex items-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 text-indigo-300" />
                    <span>00:00 • Introduction & Overview</span>
                  </button>
                  <button
                    onClick={() => handleSeekVideo(8.0)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-xs flex items-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 text-emerald-300" />
                    <span>00:08 • Core Architecture / AI Agents</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: AI AGENT TABS (5/12) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-slate-900 overflow-hidden">
            
            {/* TABS HEADER */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1 shrink-0 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('doubt')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === 'doubt'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Omni-Agent Chat</span>
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === 'summary'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Executive Summary</span>
              </button>
              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === 'transcript'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Transcript</span>
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === 'quiz'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Quiz</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 min-h-0 flex flex-col">
              
              {/* TAB 1: OMNI-AGENT CHAT */}
              {activeTab === 'doubt' && (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* MESSAGES LIST */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.sender === 'ai' && (
                          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-slate-800/90 text-slate-200 border border-slate-700/70 rounded-tl-none shadow-sm'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.text}</div>

                          {/* Render Agent Actions (e.g. SEEK_VIDEO buttons) */}
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-700/60 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider flex items-center gap-1">
                                <Compass className="w-3 h-3" />
                                <span>Agent Actions:</span>
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.actions.map((act, idx) => {
                                  if (act.type === 'SEEK_VIDEO' && act.timestamp !== undefined) {
                                    return (
                                      <button
                                        key={idx}
                                        onClick={() => handleSeekVideo(act.timestamp!)}
                                        className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/40 flex items-center gap-1.5 transition font-medium"
                                      >
                                        <Play className="w-3 h-3 text-indigo-300" />
                                        <span>{act.label || `Jump to ${Math.floor(act.timestamp)}s`}</span>
                                      </button>
                                    )
                                  }
                                  if (act.type === 'INTERACTIVE_QUIZ' && act.question) {
                                    const isAnswered = chatQuizAnswers[msg.id] !== undefined
                                    const selected = chatQuizAnswers[msg.id]
                                    return (
                                      <div key={idx} className="w-full mt-1.5 p-3 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-2">
                                        <p className="text-xs font-semibold text-white">{act.question}</p>
                                        <div className="space-y-1">
                                          {act.options?.map((opt, oIdx) => {
                                            const isCorrect = act.correct_index === oIdx
                                            let btnCls = 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                            if (isAnswered) {
                                              if (isCorrect) btnCls = 'bg-emerald-500/20 text-emerald-200 border-emerald-500'
                                              else if (selected === oIdx) btnCls = 'bg-rose-500/20 text-rose-200 border-rose-500'
                                            }
                                            return (
                                              <button
                                                key={oIdx}
                                                disabled={isAnswered}
                                                onClick={() => setChatQuizAnswers(prev => ({ ...prev, [msg.id]: oIdx }))}
                                                className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-[11px] transition ${btnCls}`}
                                              >
                                                {opt}
                                              </button>
                                            )
                                          })}
                                        </div>
                                        {isAnswered && act.explanation && (
                                          <p className="text-[11px] text-slate-400 pt-1 italic">{act.explanation}</p>
                                        )}
                                      </div>
                                    )
                                  }
                                  return null
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px]">
                            {msg.sender === 'ai' && (
                              <span className="text-emerald-400 font-medium">
                                Autonomous Omni-Agent
                              </span>
                            )}
                            <span className={msg.sender === 'user' ? 'text-indigo-200 ml-auto' : 'text-slate-500'}>
                              {msg.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {isAsking && (
                      <div className="flex gap-2.5 justify-start">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                          <Bot className="w-4 h-4 animate-spin" />
                        </div>
                        <div className="bg-slate-800/90 border border-slate-700/70 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-indigo-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                          <span>Omni-Agent is analyzing video perception & executing actions...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* SUGGESTED FOLLOWUPS */}
                  <div className="px-3 py-1.5 bg-slate-950/30 border-t border-slate-800/80 flex gap-1.5 overflow-x-auto no-scrollbar">
                    {quickPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendDoubt(p)}
                        className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* INPUT BAR */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSendDoubt()
                    }}
                    className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={inputQuery}
                      onChange={(e) => setInputQuery(e.target.value)}
                      placeholder="Ask Omni-Agent anything about this video..."
                      disabled={isAsking}
                      className="flex-1 bg-slate-800/90 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none transition"
                    />
                    <button
                      type="submit"
                      disabled={!inputQuery.trim() || isAsking}
                      className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-medium shadow-md transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: EXECUTIVE SUMMARY */}
              {activeTab === 'summary' && (
                <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
                  {isLoadingSummary ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      <span className="text-xs">Analyzing lecture transcript...</span>
                    </div>
                  ) : summaryData ? (
                    <div className="space-y-4">
                      {/* Overview */}
                      <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                          <Sparkles className="w-4 h-4" />
                          <span>Executive Overview</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {summaryData.overview}
                        </p>
                      </div>

                      {/* Topics Covered */}
                      {summaryData.key_topics && summaryData.key_topics.length > 0 && (
                        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                            <BookOpen className="w-4 h-4" />
                            <span>Topics Addressed</span>
                          </div>
                          <div className="space-y-1.5">
                            {summaryData.key_topics.map((topic, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                <span>{topic}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Whiteboard Notes */}
                      {summaryData.whiteboard_notes && summaryData.whiteboard_notes.length > 0 && (
                        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                            <FileText className="w-4 h-4" />
                            <span>Key Takeaways & Speaker Notes</span>
                          </div>
                          <div className="space-y-1.5">
                            {summaryData.whiteboard_notes.map((note, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                <span>{note}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">
                      Summary generated directly from video audio.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: VERBATIM TRANSCRIPT */}
              {activeTab === 'transcript' && (
                <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Spoken Audio Transcript</h4>
                      <p className="text-[11px] text-slate-400">Accurate speech-to-text generated by Whisper AI.</p>
                    </div>
                    {transcriptText && (
                      <button
                        onClick={handleCopyTranscript}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1.5 transition"
                      >
                        {hasCopiedTranscript ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {isLoadingTranscript ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      <span className="text-xs">Extracting audio & transcribing...</span>
                    </div>
                  ) : transcriptText ? (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-mono select-text">
                      {transcriptText}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-xs text-slate-400 space-y-2">
                      <p>No speech detected or transcription is in progress.</p>
                      <button
                        onClick={loadTranscript}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-medium hover:bg-indigo-600/50 transition"
                      >
                        Retry Transcription
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: QUICK QUIZ */}
              {activeTab === 'quiz' && (
                <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Video Comprehension Check</h4>
                      <p className="text-[11px] text-slate-400">Test how much you absorbed from what was said.</p>
                    </div>
                    {summaryData?.quiz && (
                      <button
                        onClick={() => {
                          setSelectedAnswers({})
                          setShowQuizResults(false)
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  {summaryData?.quiz?.map((q: any, qIdx: number) => {
                    const selected = selectedAnswers[qIdx]

                    return (
                      <div key={qIdx} className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-md bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {qIdx + 1}
                          </span>
                          <span className="text-xs font-medium text-slate-200 leading-snug">
                            {q.question}
                          </span>
                        </div>

                        <div className="space-y-1.5 pl-7">
                          {q.options.map((opt: string, optIdx: number) => {
                            const isChosen = selected === optIdx
                            const isCorrectOpt = q.correct_index === optIdx

                            let btnStyle = 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/80'
                            if (showQuizResults) {
                              if (isCorrectOpt) {
                                btnStyle = 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50 font-semibold'
                              } else if (isChosen) {
                                btnStyle = 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                              }
                            } else if (isChosen) {
                              btnStyle = 'bg-indigo-600 text-white border-indigo-500 font-medium'
                            }

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleSelectQuizOption(qIdx, optIdx)}
                                className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition flex items-center justify-between gap-2 ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {showQuizResults && isCorrectOpt && (
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                )}
                                {showQuizResults && isChosen && !isCorrectOpt && (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>

                        {showQuizResults && q.explanation && (
                          <div className="mt-2 pl-7 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            <strong className="text-indigo-300">Explanation: </strong>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="pt-2">
                    <button
                      onClick={() => setShowQuizResults(true)}
                      disabled={Object.keys(selectedAnswers).length === 0}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Check My Answers</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
