import React, { useState } from 'react'
import {
  Brain,
  Sparkles,
  Zap,
  AlertTriangle,
  Clock,
  Send,
  Calendar,
  Activity,
  Layers,
} from 'lucide-react'
import type { User } from '../lib/api'

interface LearnerStateData {
  student_id: string
  mastery: number
  retention: number
  transfer: number
  misconception: number
  competency: number
  uncertainty: number
  identifiability: number
  learning_velocity: number
  current_bottleneck: string
  current_learning_mode: string
  tracked_concepts_count: number
}

interface ConceptState {
  concept_id: string
  concept_name: string
  mastery: number
  retention: number
  transfer: number
  misconception: number
  competency: number
  uncertainty: number
  bottleneck: string
  learning_mode: string
}

interface DailyBlock {
  time: string
  type: string
  title: string
  estimated_duration_mins: number
  grounding: string
  priority: string
}

export const LearningIntelligencePage: React.FC<{ user: User | null }> = ({ user }) => {
  const [stateData] = useState<LearnerStateData>({
    student_id: user?.id || 'std_demo',
    mastery: 0.74,
    retention: 0.68,
    transfer: 0.38,
    misconception: 0.12,
    competency: 0.58,
    uncertainty: 0.22,
    identifiability: 0.88,
    learning_velocity: 0.045,
    current_bottleneck: 'TRANSFER',
    current_learning_mode: 'TRANSFER',
    tracked_concepts_count: 6,
  })

  const [concepts] = useState<ConceptState[]>([
    {
      concept_id: 'c1',
      concept_name: 'Graph Traversal & Topological Sort',
      mastery: 0.84,
      retention: 0.78,
      transfer: 0.42,
      misconception: 0.05,
      competency: 0.64,
      uncertainty: 0.18,
      bottleneck: 'TRANSFER',
      learning_mode: 'TRANSFER',
    },
    {
      concept_id: 'c2',
      concept_name: 'Dynamic Programming & Memoization',
      mastery: 0.62,
      retention: 0.55,
      transfer: 0.30,
      misconception: 0.38,
      competency: 0.42,
      uncertainty: 0.28,
      bottleneck: 'MISCONCEPTION',
      learning_mode: 'REMEDIATION',
    },
    {
      concept_id: 'c3',
      concept_name: 'Binary Search & Monotonic Predicates',
      mastery: 0.92,
      retention: 0.88,
      transfer: 0.76,
      misconception: 0.00,
      competency: 0.85,
      uncertainty: 0.08,
      bottleneck: 'MASTERY',
      learning_mode: 'ACQUISITION',
    },
    {
      concept_id: 'c4',
      concept_name: 'Recursive Backtracking & State Space',
      mastery: 0.58,
      retention: 0.50,
      transfer: 0.25,
      misconception: 0.22,
      competency: 0.41,
      uncertainty: 0.32,
      bottleneck: 'RETENTION',
      learning_mode: 'RETRIEVAL',
    },
  ])

  const [dailyPlan] = useState<DailyBlock[]>([
    {
      time: '08:00 - 08:30',
      type: 'RETRIEVAL',
      title: 'Spaced Retrieval: Recursive State Space',
      estimated_duration_mins: 30,
      grounding: 'Retention decayed to 50.0%. Memory reinforcement required.',
      priority: 'HIGH',
    },
    {
      time: '12:00 - 12:45',
      type: 'REMEDIATION',
      title: 'Targeted Remediation: Overlapping Subproblems',
      estimated_duration_mins: 45,
      grounding: 'Misconception score at 38.0% in state-transition recurrence.',
      priority: 'CRITICAL',
    },
    {
      time: '17:00 - 17:45',
      type: 'TRANSFER',
      title: 'Transfer Challenge: Applied Network Routing',
      estimated_duration_mins: 45,
      grounding: 'Mastery is 84.0% but transfer across unseen topologies is 42.0%.',
      priority: 'HIGH',
    },
  ])

  // Chat State
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string }>>([
    {
      sender: 'agent',
      text: `Hello ${user?.display_name || 'Learner'}! I am SN1, your autonomous Student Neural Intelligence agent grounded on the LENS-Ω state engine. Your current primary learning bottleneck is **TRANSFER** across new problem contexts. How can I assist your study plan today?`,
      time: 'Just now',
    },
  ])
  const [inputQuery, setInputQuery] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const quickQuestions = [
    'What should I study today?',
    'Why am I getting transfer problems?',
    'What am I weak at?',
    'Am I ready for the exam?',
    'Why did my score drop?',
  ]

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputQuery
    if (!query.trim()) return

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { sender: 'user' as const, text: query, time: nowStr }
    setMessages((prev) => [...prev, userMsg])
    setInputQuery('')
    setChatLoading(true)

    try {
      // Simulate/call LENS-Ω SN1 chat endpoint
      await new Promise((r) => setTimeout(r, 600))
      let agentReply = ''
      const qLower = query.toLowerCase()

      if (qLower.includes('what should i study') || qLower.includes('today')) {
        agentReply = `Based on your live LENS-Ω state vector, your primary focus today is **${dailyPlan[1].title}** (${dailyPlan[1].estimated_duration_mins} mins). Your retention on recursive state space also decayed to 50%, so I scheduled an 8:00 AM spaced retrieval block.`
      } else if (qLower.includes('transfer') || qLower.includes('why am i getting')) {
        agentReply = `Your **Mastery** on Graph Traversal is solid at **84.0%**, but your **Transfer Score** across novel problem formulations is currently **42.0%**. According to policy optimization, assigning real-world transfer problems maximizes your expected competency gain.`
      } else if (qLower.includes('ready for the exam') || qLower.includes('exam')) {
        agentReply = `Your multi-dimensional **Exam Readiness Score is 68.4% (NEEDS REVISION)**. While your foundation mastery is high, you need to unblock Dynamic Programming misconceptions and complete 2 transfer drills before exam day.`
      } else if (qLower.includes('weak')) {
        agentReply = `Your most urgent concept bottleneck is **Dynamic Programming & Memoization** with an active misconception score of **38.0%** and competency of **42.0%**.`
      } else {
        agentReply = `Based on your LENS-Ω state vector (Mastery: ${(stateData.mastery * 100).toFixed(1)}%, Competency: ${(stateData.competency * 100).toFixed(1)}%, Identifiability: ${(stateData.identifiability * 100).toFixed(1)}%), I recommend following today's scheduled roadmap to resolve the ${stateData.current_bottleneck} bottleneck.`
      }

      setMessages((prev) => [
        ...prev,
        { sender: 'agent', text: agentReply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Brain className="w-3.5 h-3.5" />
            LENS-Ω + SN1 Autonomous Intelligence Layer
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Learner State & Cognitive Neural Engine
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Evidence-driven multi-dimensional state tracking across Mastery, Retention, Transfer, and Misconception signals. Autonomous LangGraph agent dynamically optimizing your learning loop.
          </p>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Holistic Competency</div>
            <div className="text-3xl font-black text-cyan-400 font-mono">{(stateData.competency * 100).toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">C = [M*R*T*(1-MS)]¼</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Bottleneck</div>
            <div className="text-sm font-black text-amber-400 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 mt-1">
              {stateData.current_bottleneck}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Mode: {stateData.current_learning_mode}</div>
          </div>
        </div>
      </div>

      {/* 8-Dimensional State Vector Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          LENS-Ω 8-Dimensional State Vector (S_t)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Mastery (M)', val: stateData.mastery, color: 'text-emerald-400', desc: 'Bayesian belief' },
            { label: 'Retention (R)', val: stateData.retention, color: 'text-cyan-400', desc: 'Ebbinghaus decay' },
            { label: 'Transfer (T)', val: stateData.transfer, color: 'text-indigo-400', desc: 'Cross-context' },
            { label: 'Misconception (MS)', val: stateData.misconception, color: 'text-rose-400', desc: 'Error pattern' },
            { label: 'Competency (C)', val: stateData.competency, color: 'text-teal-400', desc: 'Holistic index' },
            { label: 'Uncertainty (U)', val: stateData.uncertainty, color: 'text-amber-400', desc: 'Epistemic gap' },
            { label: 'Identifiability (I)', val: stateData.identifiability, color: 'text-purple-400', desc: 'Evidence breadth' },
            { label: 'Velocity (V)', val: stateData.learning_velocity, isRate: true, color: 'text-blue-400', desc: 'ΔScore / ΔDay' },
          ].map((dim) => (
            <div key={dim.label} className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 truncate">{dim.label}</div>
              <div className={`text-xl font-black font-mono ${dim.color}`}>
                {dim.isRate ? `+${(dim.val * 100).toFixed(1)}%/d` : `${(dim.val * 100).toFixed(0)}%`}
              </div>
              <div className="text-[10px] text-slate-500 truncate">{dim.desc}</div>
              {!dim.isRate && (
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                  <div className="bg-current h-full" style={{ width: `${dim.val * 100}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Concept Map & Daily Roadmap */}
        <div className="lg:col-span-2 space-y-8">
          {/* Concept Breakdown Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Concept Mastery & Bottleneck Matrix
                </h3>
                <p className="text-xs text-slate-400">Granular tracking per concept node with automated learning mode mapping.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="pb-3">Concept</th>
                    <th className="pb-3 text-center">Mastery</th>
                    <th className="pb-3 text-center">Retention</th>
                    <th className="pb-3 text-center">Transfer</th>
                    <th className="pb-3 text-center">Misconception</th>
                    <th className="pb-3 text-center">Bottleneck</th>
                    <th className="pb-3 text-right">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {concepts.map((c) => (
                    <tr key={c.concept_id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 font-semibold text-slate-200">{c.concept_name}</td>
                      <td className="py-3 text-center font-mono text-emerald-400">{(c.mastery * 100).toFixed(0)}%</td>
                      <td className="py-3 text-center font-mono text-cyan-400">{(c.retention * 100).toFixed(0)}%</td>
                      <td className="py-3 text-center font-mono text-indigo-400">{(c.transfer * 100).toFixed(0)}%</td>
                      <td className="py-3 text-center font-mono text-rose-400">{(c.misconception * 100).toFixed(0)}%</td>
                      <td className="py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700">
                          {c.bottleneck}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {c.learning_mode}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 86: Dynamic Daily Roadmap */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  Today's Autonomous Learning Roadmap
                </h3>
                <p className="text-xs text-slate-400">Grounded schedule synthesized by SN1 policy optimizer.</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">Total: 2.0 hrs</span>
            </div>

            <div className="space-y-3">
              {dailyPlan.map((block, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0 text-xs">
                      {block.type === 'RETRIEVAL' && <Clock className="w-5 h-5" />}
                      {block.type === 'REMEDIATION' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                      {block.type === 'TRANSFER' && <Zap className="w-5 h-5 text-amber-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-300">{block.time}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                          {block.type}
                        </span>
                        {block.priority === 'CRITICAL' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                            Critical
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white mt-0.5">{block.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{block.grounding}</p>
                    </div>
                  </div>

                  <button className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shrink-0 transition-all">
                    Start
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: SN1 Agent Interactive Assistant (Section 39) */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col h-[640px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">SN1 Student Intelligence</h3>
                  <p className="text-[10px] text-cyan-400 font-mono">LangGraph State Machine Grounded</p>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-cyan-500 text-slate-950 font-medium'
                        : 'bg-slate-950 border border-slate-800 text-slate-200'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">{m.time}</span>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  SN1 is querying LENS-Ω state vector...
                </div>
              )}
            </div>

            {/* Quick Questions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400">Quick Inquiries:</div>
              <div className="flex flex-wrap gap-1.5">
                {quickQuestions.slice(0, 3).map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask SN1 about your learning state..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={chatLoading || !inputQuery.trim()}
                className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all disabled:opacity-50 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export default LearningIntelligencePage
