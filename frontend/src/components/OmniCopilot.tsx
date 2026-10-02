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
import { askCopilotReasoning } from '../lib/mcpClient'
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
  currentTab = 'overview',
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
      return `Hello ${firstName}! I am your Student AI Study Copilot powered by Groq LPU. I know you are currently on the "${currentTab}" page. You can ask: "What should I study today?", "Join my Class ${studentGrade} live class", or "Practice oral viva defense".`
    } else if (isTeacher) {
      return `Hello ${firstName}! I am your Faculty Classroom Copilot powered by Groq LPU. Active page: "${currentTab}". You can say: "Start live class for 6th A at 4:45", "Launch CrewAI Curriculum Studio", or "Grade student homework".`
    } else {
      return `Hello ${firstName}! I am your Enterprise Executive Copilot powered by Groq LPU. Active page: "${currentTab}". You can say: "Audit school-wide high risk students", "Trigger AI master timetable", or "Check platform telemetry".`
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

  // Reset greeting if user changes or page changes
  useEffect(() => {
    setLastAgentMessage(getInitialMessage())
  }, [user?.id, role, currentTab])

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

  // ── AUTONOMOUS GROQ LPU INTENT REASONER & DISPATCHER ──────────────────────
  const handleExecute = async (inputQuery?: string) => {
    const text = (inputQuery || query).trim()
    if (!text || isProcessing) return

    setQuery('')
    setIsProcessing(true)
    setActionSteps([
      { text: `Reading on-page context ('${currentTab}') & evaluating intent via Groq Cloud LPU...`, status: 'active' }
    ])

    try {
      // 1. Invoke Backend Groq Reasoning Engine with complete page & user context
      const reasonRes = await askCopilotReasoning({
        query: text,
        current_tab: currentTab,
        user_role: role,
        user_name: user?.display_name || (isStudent ? 'Student' : isTeacher ? 'Teacher' : 'Admin'),
        user_email: user?.email || '',
        grade_number: studentGrade
      })

      // 2. Render dynamic reasoning steps directly from Groq
      const dynamicSteps: ActionStep[] = (reasonRes.reasoning_steps || []).map((st: string, idx: number) => ({
        text: st,
        status:
          reasonRes.action_type === 'RESTRICTED_ACTION' && idx === reasonRes.reasoning_steps.length - 1
            ? 'restricted'
            : 'done'
      }))

      setActionSteps(
        dynamicSteps.length > 0
          ? dynamicSteps
          : [{ text: `Executed intent for: "${text}"`, status: 'done' }]
      )

      setLastAgentMessage(reasonRes.agent_reply)

      // 3. Autonomous Tool Action Execution
      const actionType = reasonRes.action_type
      const params = reasonRes.action_params || {}

      if (actionType === 'START_LIVE_CLASS') {
        const gradeStr = params.grade || 'Class 6-A'
        const timeStr = params.start_time || '4:45 PM'
        try {
          await createSchoolLiveClass({
            title: `${gradeStr} Interactive Live Lecture (${timeStr})`,
            subject_name: params.subject || 'Mathematics',
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
            status: 'live'
          })
        } catch (e) {
          console.warn('Backend live class creation warning:', e)
        }
        setCurrentTab('classroom')
      } else if (actionType === 'JOIN_LIVE_CLASS') {
        setCurrentTab('classroom')
      } else if (actionType === 'OPEN_CREWAI_STUDIO') {
        setCrewModalOpen(true)
      } else if (actionType === 'OPEN_AUTOGEN_VIVA') {
        setVivaModalOpen(true)
      } else if (
        actionType === 'NAVIGATE_TAB' ||
        actionType === 'ANALYZE_COGNITIVE_RISK' ||
        actionType === 'RUN_CODE_LAB' ||
        actionType === 'OPEN_ASSIGNMENTS_DESK'
      ) {
        if (params.target_tab) {
          setCurrentTab(params.target_tab)
        }
      } else if (actionType === 'RESTRICTED_ACTION') {
        if (params.target_tab) {
          setCurrentTab(params.target_tab)
        }
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
    title: 'Acharya Copilot',
    badge: 'MCP AI',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    gradient: 'from-cyan-500 to-blue-600',
    borderGlow: 'border-cyan-500/40 hover:border-cyan-400',
    icon: Brain
  }

  return (
    <>
      {/* ── FLOATING TRIGGER BUTTON (Present on every page) ────────────────── */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900/90 border border-amber-500/40 text-white shadow-2xl backdrop-blur-md hover:scale-105 transition-all group`}
            style={{ boxShadow: '0 0 20px rgba(245, 158, 11, 0.25)' }}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-amber-500/50 shadow-md group-hover:scale-110 transition-transform">
              <img src="/acharya_logo.png" alt="Acharya Copilot" className="w-full h-full object-cover" />
            </div>
            <div className="text-left pr-1 hidden sm:block">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{themeConfig.title}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[10px] text-amber-400 font-mono capitalize">
                {role} Mode &bull; Page: {currentTab}
              </p>
            </div>
          </button>
        )}
      </div>

      {/* ── EXPANDED ROLE-SPECIFIC HUD ─────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[440px] bg-slate-950/95 border border-amber-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-xl space-y-4 animate-in fade-in slide-in-from-bottom-5"
          style={{ boxShadow: '0 0 30px rgba(245, 158, 11, 0.2)' }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden ring-1 ring-amber-500/50 shadow">
                <img src="/acharya_logo.png" alt="Acharya Copilot" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  {themeConfig.title}
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${themeConfig.badgeBg}`}>
                    {themeConfig.badge}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span>Context: <b className="text-cyan-300 capitalize">{currentTab}</b></span>
                  <span>&bull;</span>
                  <span>Groq LPU Active</span>
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
                <span>Agent Reasoning Report</span>
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
                    Join Class {studentGrade} Live Lecture
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('What should I study today?')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold transition-all"
                  >
                    What should I study today?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Start AutoGen Oral Viva')}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[10px] font-semibold transition-all"
                  >
                    AutoGen Oral Viva
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Open python coding playground')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold transition-all"
                  >
                    Python Coding Lab
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('View pending assignments')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-semibold transition-all"
                  >
                    Pending Homework
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Claim course certificates')}
                    className="px-2.5 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 text-[10px] font-semibold transition-all"
                  >
                    Claim Certificates
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
                    Start Class for 6th A
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Launch CrewAI Curriculum Studio')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold transition-all"
                  >
                    CrewAI Curriculum Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Show cognitive radar for my class')}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[10px] font-semibold transition-all"
                  >
                    Class Cognitive Radar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Grade homework desk submissions')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold transition-all"
                  >
                    Grade Submissions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('View AI timetable and substitution')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-semibold transition-all"
                  >
                    Timetable & Leave Sub
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
                    High Risk School Audit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Generate master timetable')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-semibold transition-all"
                  >
                    Generate Master Timetable
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Manage organization tenancy')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-semibold transition-all"
                  >
                    Organization Tenancy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Launch CrewAI Curriculum Studio')}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-[10px] font-semibold transition-all"
                  >
                    CrewAI Studio
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
                  ? `Ask about ${currentTab}, study plan, viva...`
                  : isTeacher
                  ? `e.g. Start class for 6th A at 4:45 on ${currentTab}...`
                  : `e.g. Audit high risk students on ${currentTab}...`
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
