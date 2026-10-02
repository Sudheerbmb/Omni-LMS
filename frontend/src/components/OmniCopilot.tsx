import React, { useState, useEffect, useRef } from 'react'
import {
  Brain,
  Sparkles,
  Mic,
  MicOff,
  Send,
  X,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  GraduationCap,
  Briefcase,
  ShieldCheck
} from 'lucide-react'
import type { User } from '../lib/api'
import { createSchoolLiveClass } from '../lib/api'
import { executeMcpToolCall } from '../lib/mcpClient'
import { CrewCurriculumModal } from './CrewCurriculumModal'
import { AutoGenVivaModal } from './AutoGenVivaModal'

type OmniCopilotProps = {
  user: User | null
  currentTab?: string
  setCurrentTab: (tab: string) => void
}

interface ActionStep {
  text: string
  status: 'pending' | 'active' | 'done' | 'restricted'
}

export const OmniCopilot: React.FC<OmniCopilotProps> = ({
  user,
  setCurrentTab
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [actionSteps, setActionSteps] = useState<ActionStep[]>([])

  // Role detection
  const role = user?.role || 'student'
  const isStudent = role === 'student'
  const isTeacher = role === 'teacher'
  const isAdmin = role === 'admin'

  const studentGradeMatch = user?.display_name?.match(/class\s*(\d+)/i) || user?.email?.match(/class(\d+)/i)
  const studentGrade = studentGradeMatch ? parseInt(studentGradeMatch[1], 10) : 10
  const firstName = user?.display_name?.split(' ')[0] || (isStudent ? 'Student' : isTeacher ? 'Teacher' : 'Admin')

  // Initial role-tailored greeting
  const getInitialMessage = () => {
    if (isStudent) {
      return `Hello ${firstName}! I am your Student AI Study Copilot. How can I help you excel today? You can ask me: "What should I study today?", "Join my Class ${studentGrade} live class", or "Practice oral viva defense".`
    } else if (isTeacher) {
      return `Hello ${firstName}! I am your Faculty Classroom Copilot. You can tell me to: "Start live class for 6th A at 4:45", "Launch CrewAI Curriculum Studio", or "Review homework desk".`
    } else {
      return `Hello ${firstName}! I am your Enterprise Executive Copilot. You can instruct me to: "Audit school-wide high risk students", "Trigger AI master timetable", or "Check live platform telemetry".`
    }
  }

  const [lastAgentMessage, setLastAgentMessage] = useState<string | null>(getInitialMessage())

  // Sub-modal states
  const [crewModalOpen, setCrewModalOpen] = useState(false)
  const [vivaModalOpen, setVivaModalOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  // Reset greeting if user changes
  useEffect(() => {
    setLastAgentMessage(getInitialMessage())
  }, [user?.id, role])

  // Speech Recognition hook
  const toggleSpeech = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => setIsListening(true)
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setQuery(transcript)
        setIsListening(false)
        handleExecute(transcript)
      }
      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)

      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  // Role-Based Action Dispatcher & MCP Tool Caller
  const handleExecute = async (inputQuery?: string) => {
    const text = (inputQuery || query).trim()
    if (!text || isProcessing) return

    setQuery('')
    setIsProcessing(true)
    setActionSteps([
      { text: `Analyzing command: "${text}"`, status: 'active' }
    ])

    const lower = text.toLowerCase()

    try {
      // ═════════════════════════════════════════════════════════════════════════
      // 1. LIVE CLASSROOM (Start vs Join based on Role)
      // ═════════════════════════════════════════════════════════════════════════
      if (
        lower.includes('live class') ||
        lower.includes('start class') ||
        lower.includes('launch class') ||
        lower.includes('join class') ||
        lower.includes('start lecture') ||
        lower.includes('my class')
      ) {
        // STUDENT ATTEMPTS TO START A CLASS ── Block & Offer Join
        if (isStudent && (lower.includes('start') || lower.includes('launch') || lower.includes('create'))) {
          setActionSteps((prev: ActionStep[]) => [
            ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
            { text: `🔒 Role Guard: Students cannot initiate or host live classes`, status: 'restricted' },
            { text: `Routing to your Class ${studentGrade} live lecture stream...`, status: 'done' }
          ])
          setCurrentTab('classroom')
          setLastAgentMessage(
            `As a student, you cannot initiate or host live classes. I have routed you to your Class ${studentGrade} Live Classrooms lobby so you can join ongoing lectures delivered by your teachers.`
          )
          return
        }

        // STUDENT WANTS TO JOIN THEIR CLASS
        if (isStudent) {
          setActionSteps((prev: ActionStep[]) => [
            ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
            { text: `Navigating to Class ${studentGrade} Live Lecture Stream...`, status: 'done' }
          ])
          setCurrentTab('classroom')
          setLastAgentMessage(
            `Navigated to Live Classrooms. You can enter active lectures and view official recordings for Class ${studentGrade}.`
          )
          return
        }

        // TEACHER / ADMIN STARTS LIVE CLASS
        const gradeMatch =
          text.match(/(?:for\s+|class\s+|grade\s+)(\d+(?:[a-zA-Z\s\-]+)?)/i) ||
          text.match(/(\d+th\s*[a-zA-Z]?)/i)
        const gradeStr = gradeMatch ? `Class ${gradeMatch[1].trim()}` : 'Class 6-A'

        const timeMatch = text.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i)
        const timeStr = timeMatch ? timeMatch[1] : '4:45 PM'

        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: `Calling MCP Tool: lms_start_live_class(grade: "${gradeStr}", time: "${timeStr}")`, status: 'active' }
        ])

        // Call MCP Tool
        await executeMcpToolCall('lms_start_live_class', {
          grade: gradeStr,
          subject: 'Academic Mathematics Lecture',
          start_time: timeStr
        })

        // Create active live class in backend
        try {
          await createSchoolLiveClass({
            title: `${gradeStr} Interactive Live Lecture`,
            subject_name: 'Mathematics',
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
            status: 'live'
          })
        } catch (e) {
          console.warn('Backend live class creation warning:', e)
        }

        setCurrentTab('classroom')

        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: `Switched UI to Live Classrooms & launched active room for ${gradeStr}`, status: 'done' }
        ])

        setLastAgentMessage(
          `Navigated to Live Classrooms and launched active WebRTC lecture room for ${gradeStr} scheduled at ${timeStr}. Room status: LIVE.`
        )
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 2. CREWAI CURRICULUM STUDIO (Faculty & Admin Feature)
      // ═════════════════════════════════════════════════════════════════════════
      else if (
        lower.includes('crew') ||
        lower.includes('curriculum studio') ||
        lower.includes('generate curriculum') ||
        lower.includes('design course')
      ) {
        if (isStudent) {
          setActionSteps((prev: ActionStep[]) => [
            ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
            { text: '🔒 Role Guard: Curriculum design is reserved for Faculty & Academic Directors', status: 'restricted' },
            { text: 'Opening Course Catalog for your learning roadmap...', status: 'done' }
          ])
          setCurrentTab('courses')
          setLastAgentMessage(
            'The CrewAI Curriculum Design Studio is an instructor tool for generating syllabus rubrics. I have opened the Course Catalog where you can explore approved courses.'
          )
          return
        }

        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: 'Assembling CrewAI Agent Team (SME, Psychometrician, Designer)...', status: 'done' }
        ])
        setCrewModalOpen(true)
        setLastAgentMessage('Opened the CrewAI Multi-Agent Curriculum Design Studio.')
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 3. AUTOGEN ORAL VIVA DEFENSE (Student & Teacher Feature)
      // ═════════════════════════════════════════════════════════════════════════
      else if (
        lower.includes('viva') ||
        lower.includes('oral defense') ||
        lower.includes('autogen') ||
        lower.includes('examiner')
      ) {
        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: 'Convening AutoGen Oral Defense Committee (Chair & Adversarial Auditor)...', status: 'done' }
        ])
        setVivaModalOpen(true)
        setLastAgentMessage(
          isStudent
            ? 'Launched your AutoGen Multi-Agent Oral Viva Defense session. Defend your mathematical and conceptual derivations with real-time scoring!'
            : 'Opened the AutoGen Multi-Agent Oral Viva Defense simulation chamber for faculty evaluation.'
        )
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 4. COGNITIVE RISK & LEARNING ROADMAP (Role-Tailored)
      // ═════════════════════════════════════════════════════════════════════════
      else if (
        lower.includes('risk') ||
        lower.includes('bottleneck') ||
        lower.includes('learning curve') ||
        lower.includes('study plan') ||
        lower.includes('what should i study') ||
        lower.includes('cognitive')
      ) {
        if (isStudent) {
          setActionSteps((prev: ActionStep[]) => [
            ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
            { text: 'Querying LangGraph Bayesian Knowledge Tracer for personal bottlenecks...', status: 'done' },
            { text: 'Opening Personal Learning Agent...', status: 'done' }
          ])
          setCurrentTab('learning-intelligence')
          setLastAgentMessage(
            `Opened your Personal Learning Agent. Your closed-loop roadmap is analyzing your prerequisite retention and cognitive mastery across Class ${studentGrade} subjects.`
          )
        } else {
          setActionSteps((prev: ActionStep[]) => [
            ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
            { text: 'Calling MCP Tool: lms_get_student_risk_profile()', status: 'done' },
            { text: 'Navigating to School Cognitive Radar...', status: 'done' }
          ])
          await executeMcpToolCall('lms_get_student_risk_profile', { grade_number: studentGrade })
          setCurrentTab('learning-intelligence')
          setLastAgentMessage('Opened School Cognitive Radar. Filtering high-risk student learning curves and misconceptions.')
        }
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 5. TIMETABLE (Student Schedule vs Faculty Substitution vs Admin Master)
      // ═════════════════════════════════════════════════════════════════════════
      else if (
        lower.includes('timetable') ||
        lower.includes('schedule') ||
        lower.includes('period') ||
        lower.includes('substitute') ||
        lower.includes('leave')
      ) {
        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: 'Calling MCP Tool: lms_navigate_ui_tab(tab: "timetable")', status: 'done' }
        ])
        await executeMcpToolCall('lms_navigate_ui_tab', { tab: 'timetable' })
        setCurrentTab('timetable')
        setLastAgentMessage(
          isStudent
            ? `Navigated to your Class ${studentGrade} Timetable Grid. You can view all period schedules and faculty assignments.`
            : isTeacher
            ? 'Navigated to AI Timetable Engine. You can launch period sessions or file automated leave substitutions.'
            : 'Navigated to Master School Timetable Management. Genetic conflict-free scheduling engine is ready.'
        )
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 6. CODING PLAYGROUND (Universal)
      // ═════════════════════════════════════════════════════════════════════════
      else if (
        lower.includes('coding') ||
        lower.includes('python') ||
        lower.includes('playground') ||
        lower.includes('algorithm') ||
        lower.includes('code')
      ) {
        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: 'Navigating to Sandboxed Coding Playground...', status: 'done' }
        ])
        setCurrentTab('coding')
        setLastAgentMessage('Opened the Sandboxed Python Coding Lab. Interactive tests and Big-O evaluation active.')
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 7. COURSEWORK / ASSIGNMENTS (Student Submission vs Teacher Grading)
      // ═════════════════════════════════════════════════════════════════════════
      else if (
        lower.includes('assignment') ||
        lower.includes('homework') ||
        lower.includes('submission') ||
        lower.includes('grade')
      ) {
        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: 'Navigating to Assignments Desk...', status: 'done' }
        ])
        setCurrentTab('assignments')
        setLastAgentMessage(
          isStudent
            ? 'Opened your Assignment Desk. View pending homework deadlines and submit coursework.'
            : 'Opened Assignment Grading Desk. Review student submissions and assign rubric scores.'
        )
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 8. CERTIFICATES & CREDENTIALS
      // ═════════════════════════════════════════════════════════════════════════
      else if (lower.includes('certificate') || lower.includes('credential')) {
        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: 'Navigating to Certificates & Credentials Desk...', status: 'done' }
        ])
        setCurrentTab('certificates')
        setLastAgentMessage('Opened Certificates Desk to verify and claim official course completion credentials.')
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 9. ADMIN SYSTEM OPERATIONS
      // ═════════════════════════════════════════════════════════════════════════
      else if (
        lower.includes('telemetry') ||
        lower.includes('tenant') ||
        lower.includes('organization') ||
        lower.includes('audit') ||
        lower.includes('admin')
      ) {
        if (!isAdmin) {
          setActionSteps((prev: ActionStep[]) => [
            ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
            { text: '🔒 Role Guard: System governance requires Administrator authorization', status: 'restricted' }
          ])
          setLastAgentMessage('Platform multi-tenancy and audit logs require Administrator privileges.')
          return
        }

        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: 'Navigating to Executive Organization Console...', status: 'done' }
        ])
        setCurrentTab('organizations')
        setLastAgentMessage('Opened Organization & Multi-Tenancy Governance Console.')
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 10. GENERAL INTENT FALLBACK
      // ═════════════════════════════════════════════════════════════════════════
      else {
        setActionSteps((prev: ActionStep[]) => [
          ...prev.map((s: ActionStep) => ({ ...s, status: 'done' as const })),
          { text: 'Processed query through Omni-LMS MCP Knowledge Graph', status: 'done' }
        ])
        setLastAgentMessage(
          `Command recognized. Navigating to Dashboard and synchronizing telemetry for: "${text}".`
        )
        setCurrentTab('overview')
      }
    } catch (err: any) {
      setActionSteps((prev: ActionStep[]) => [
        ...prev,
        { text: `Execution failed: ${err.message || 'Unknown error'}`, status: 'done' }
      ])
    } finally {
      setIsProcessing(false)
    }
  }

  // Visual Theme Config per Role
  const themeConfig = {
    student: {
      title: 'Student Study Copilot',
      badge: 'Student AI',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      gradient: 'from-emerald-500 to-cyan-600',
      borderGlow: 'border-emerald-500/40 hover:border-emerald-400',
      icon: GraduationCap
    },
    teacher: {
      title: 'Faculty Live Copilot',
      badge: 'Faculty AI',
      badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      gradient: 'from-cyan-500 to-indigo-600',
      borderGlow: 'border-cyan-500/40 hover:border-cyan-400',
      icon: Briefcase
    },
    admin: {
      title: 'Executive Admin Copilot',
      badge: 'Admin AI',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      gradient: 'from-rose-500 to-amber-600',
      borderGlow: 'border-rose-500/40 hover:border-rose-400',
      icon: ShieldCheck
    }
  }[role] || {
    title: 'Omni Universal Copilot',
    badge: 'MCP AI',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    gradient: 'from-cyan-500 to-blue-600',
    borderGlow: 'border-cyan-500/40 hover:border-cyan-400',
    icon: Brain
  }

  const RoleIcon = themeConfig.icon

  return (
    <>
      {/* ── FLOATING TRIGGER BUTTON (Present on every page) ────────────────── */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className={`flex items-center gap-3 px-4 py-3 rounded-full bg-slate-900/90 border ${themeConfig.borderGlow} text-white shadow-2xl backdrop-blur-md hover:scale-105 transition-all group`}
          >
            <div
              className={`w-8 h-8 rounded-full bg-gradient-to-tr ${themeConfig.gradient} flex items-center justify-center text-slate-950 font-black shadow-lg group-hover:rotate-12 transition-transform`}
            >
              <RoleIcon className="w-4 h-4" />
            </div>
            <div className="text-left pr-1 hidden sm:block">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{themeConfig.title}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[10px] text-cyan-400 font-mono capitalize">
                {role} Mode &bull; MCP Online
              </p>
            </div>
          </button>
        )}
      </div>

      {/* ── EXPANDED ROLE-SPECIFIC HUD ─────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[440px] bg-slate-950/95 border border-cyan-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-xl space-y-4 animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${themeConfig.gradient} flex items-center justify-center text-slate-950 font-bold shadow`}
              >
                <RoleIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  {themeConfig.title}
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${themeConfig.badgeBg}`}>
                    {themeConfig.badge}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isStudent && `Personalized Study Assistant for Class ${studentGrade}`}
                  {isTeacher && 'Classroom Launcher & Faculty Subsystem Control'}
                  {isAdmin && 'Executive Governance & System Telemetry'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Agent Response Stream */}
          {lastAgentMessage && (
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 leading-relaxed space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>Agent Report</span>
              </div>
              <p>{lastAgentMessage}</p>
            </div>
          )}

          {/* Action Step-by-Step Visualization */}
          {actionSteps.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-1.5 text-[11px] font-mono">
              {actionSteps.map((step: ActionStep, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-slate-300">
                  {step.status === 'done' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : step.status === 'restricted' ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                  )}
                  <span
                    className={
                      step.status === 'active'
                        ? 'text-cyan-300 font-bold'
                        : step.status === 'restricted'
                        ? 'text-rose-300 font-bold'
                        : ''
                    }
                  >
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Role-Specific Quick Action Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isStudent && 'Student Study Actions:'}
              {isTeacher && 'Faculty 1-Click Actions:'}
              {isAdmin && 'Executive Governance Actions:'}
            </span>

            <div className="flex flex-wrap gap-1.5">
              {/* STUDENT CHIPS */}
              {isStudent && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecute(`Join my Class ${studentGrade} live class`)}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-[10px] font-semibold transition-all"
                  >
                    🎒 Join Class {studentGrade} Live Lecture
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('What should I study today?')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold transition-all"
                  >
                    🗺️ What should I study today?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Start AutoGen Oral Viva')}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[10px] font-semibold transition-all"
                  >
                    🎙️ AutoGen Oral Viva
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Open python coding playground')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold transition-all"
                  >
                    💻 Python Coding Lab
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('View pending assignments')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-semibold transition-all"
                  >
                    📝 Pending Homework
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Claim course certificates')}
                    className="px-2.5 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 text-[10px] font-semibold transition-all"
                  >
                    🏆 Claim Certificates
                  </button>
                </>
              )}

              {/* TEACHER CHIPS */}
              {isTeacher && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecute('Go to live classes and start class for 6th A at 4:45')}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-[10px] font-semibold transition-all"
                  >
                    🔴 Start Class for 6th A
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Launch CrewAI Curriculum Studio')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold transition-all"
                  >
                    👥 CrewAI Curriculum Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Show cognitive radar for my class')}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[10px] font-semibold transition-all"
                  >
                    📊 Class Cognitive Radar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Grade homework desk submissions')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold transition-all"
                  >
                    📝 Grade Submissions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('View AI timetable and substitution')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-semibold transition-all"
                  >
                    📅 Timetable & Leave Sub
                  </button>
                </>
              )}

              {/* ADMIN CHIPS */}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecute('Show high risk students across school')}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[10px] font-semibold transition-all"
                  >
                    ⚠️ High Risk School Audit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Generate master timetable')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold transition-all"
                  >
                    ⚙️ Generate Master Timetable
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Manage organization tenancy')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-semibold transition-all"
                  >
                    🏢 Organization Tenancy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Launch CrewAI Curriculum Studio')}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-[10px] font-semibold transition-all"
                  >
                    👥 CrewAI Studio
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleExecute()
            }}
            className="flex items-center gap-2 pt-2 border-t border-slate-800"
          >
            <button
              type="button"
              onClick={toggleSpeech}
              className={`p-2.5 rounded-xl border transition-all ${
                isListening
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Click to speak your command"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isStudent
                  ? 'Ask about study plan, homework, viva...'
                  : isTeacher
                  ? 'e.g. Start class for 6th A at 4:45...'
                  : 'e.g. Audit high risk students, timetable...'
              }
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />

            <button
              type="submit"
              disabled={isProcessing || !query.trim()}
              className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-all shadow"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}

      {/* ── MULTI-AGENT SUB-MODALS (CrewAI & AutoGen) ────────────────────────── */}
      <CrewCurriculumModal
        isOpen={crewModalOpen}
        onClose={() => setCrewModalOpen(false)}
      />

      <AutoGenVivaModal
        isOpen={vivaModalOpen}
        onClose={() => setVivaModalOpen(false)}
      />
    </>
  )
}
export default OmniCopilot
