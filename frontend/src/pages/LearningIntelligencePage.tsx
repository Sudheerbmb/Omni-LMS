import React, { useEffect, useState } from 'react'
import { Activity, AlertTriangle, BrainCircuit, Clock3, Loader2, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react'
import type { AdaptiveDashboard, CohortLearner, User } from '../lib/api'
import { getAdaptiveCohort, getMyAdaptiveDashboard, getStudentAdaptiveDashboard, submitAdaptiveFeedback, submitLearningEvidence } from '../lib/api'

const pct = (value: number) => `${Math.round(value * 100)}%`
const title = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

export const LearningIntelligencePage: React.FC<{ user: User }> = ({ user }) => {
  const [dashboard, setDashboard] = useState<AdaptiveDashboard | null>(null)
  const [cohort, setCohort] = useState<CohortLearner[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [concept, setConcept] = useState('')
  const [score, setScore] = useState(50)

  const load = async () => {
    setLoading(true); setError('')
    try {
      if (user.role === 'student') setDashboard(await getMyAdaptiveDashboard())
      else setCohort(await getAdaptiveCohort())
    } catch (e: any) { setError(e.message || 'Could not load learning intelligence.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [user.role])

  const openLearner = async (id: string) => {
    setSelected(id); setLoading(true)
    try { setDashboard(await getStudentAdaptiveDashboard(id)) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const submitDiagnostic = async (event: React.FormEvent) => {
    event.preventDefault(); if (!concept.trim()) return
    setSaving(true); setError('')
    try {
      await submitLearningEvidence({ user_id: user.role === 'student' ? undefined : selected || undefined, concept: concept.trim(), evidence_type: 'diagnostic', score: score / 100, difficulty: .5 })
      setConcept('')
      setDashboard(user.role === 'student' ? await getMyAdaptiveDashboard() : await getStudentAdaptiveDashboard(selected!))
      if (user.role !== 'student') setCohort(await getAdaptiveCohort())
    } catch (e: any) { setError(e.message || 'Could not record diagnostic evidence.') }
    finally { setSaving(false) }
  }

  if (loading && !dashboard && cohort.length === 0) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>

  return <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
    <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-cyan-950/30 p-7 flex flex-wrap gap-5 items-center justify-between">
      <div><div className="text-cyan-400 text-xs font-bold uppercase tracking-widest flex gap-2 items-center"><BrainCircuit className="w-4 h-4" /> LENS-Ω Adaptive Engine</div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mt-2">{user.role === 'student' ? 'Your Learning Agent' : 'Learning Intelligence Center'}</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">Evidence-based mastery, retention, transfer and misconception analysis with a transparent next-best learning action.</p></div>
      <button onClick={load} className="p-3 rounded-xl bg-slate-800 text-cyan-300 hover:bg-slate-700"><RefreshCw className="w-4 h-4" /></button>
    </div>

    {error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}

    {user.role !== 'student' && <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <h2 className="font-bold text-white">Student cohort</h2>
        <p className="text-xs text-slate-400">Select a learner to review patterns or add an observation.</p>
        <div className="space-y-2 max-h-[520px] overflow-y-auto">{cohort.map(student => <button key={student.user_id} onClick={() => openLearner(student.user_id)} className={`w-full text-left p-3 rounded-xl border transition ${selected === student.user_id ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}>
          <div className="flex justify-between gap-2"><span className="text-sm font-bold text-white truncate">{student.display_name}</span><span className="text-xs text-cyan-400">{pct(student.average_competency)}</span></div>
          <div className="text-[11px] text-slate-500 mt-1">{student.concept_count} concepts · {student.high_risk_concepts} at risk · {title(student.primary_bottleneck)}</div>
        </button>)}</div>
      </section>
      <section>{selected ? <LearnerPanel dashboard={dashboard} onDiagnostic={submitDiagnostic} concept={concept} setConcept={setConcept} score={score} setScore={setScore} saving={saving} teacher /> : <Empty message="Select a student to open their learner model." />}</section>
    </div>}

    {user.role === 'student' && <LearnerPanel dashboard={dashboard} onDiagnostic={submitDiagnostic} concept={concept} setConcept={setConcept} score={score} setScore={setScore} saving={saving} />}
  </div>
}

const Empty = ({ message }: { message: string }) => <div className="rounded-3xl border border-slate-800 bg-slate-900 p-12 text-center text-slate-400"><BrainCircuit className="w-10 h-10 mx-auto mb-3 text-slate-600" />{message}</div>

const LearnerPanel = ({ dashboard, onDiagnostic, concept, setConcept, score, setScore, saving, teacher = false }: any) => {
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({})
  const sendFeedback = async (state: any, helpfulness: number) => {
    await submitAdaptiveFeedback(state.id, { action: state.recommendation.action, accepted: true, helpfulness })
    setFeedbackSent(current => ({ ...current, [state.id]: true }))
  }
  if (!dashboard) return <Empty message="No learner data is available." />
  return <div className="space-y-5">
    <div className="grid sm:grid-cols-3 gap-3">
      <Metric icon={<Target />} label="Overall competency" value={pct(dashboard.overall_competency)} />
      <Metric icon={<Activity />} label="Concepts observed" value={String(dashboard.states.length)} />
      <Metric icon={<AlertTriangle />} label="Needs diagnostic" value={dashboard.needs_diagnostic ? 'Yes' : 'No'} warning={dashboard.needs_diagnostic} />
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-cyan-400" /> Agent learning pattern</h3>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Pattern label="Evidence observed" value={String(dashboard.learning_patterns?.observations || 0)} />
          <Pattern label="Strongest context" value={title(dashboard.learning_patterns?.strongest_evidence_context || 'collecting evidence')} />
          <Pattern label="Best observed time" value={dashboard.learning_patterns?.best_observed_hour == null ? 'Collecting evidence' : `${String(dashboard.learning_patterns.best_observed_hour).padStart(2, '0')}:00`} />
          <Pattern label="Recurring errors" value={String(Object.keys(dashboard.learning_patterns?.recurring_misconceptions || {}).length)} />
        </div>
        <p className="text-[10px] text-slate-500 mt-3">{dashboard.learning_patterns?.notice}</p>
      </section>
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /> Agent priority plan</h3>
        <div className="space-y-2 mt-3">{(dashboard.agent_plan || []).slice(0, 3).map((item: any, index: number) => <div key={`${item.concept}-${index}`} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
          <span className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs font-black flex items-center justify-center">{index + 1}</span>
          <div className="min-w-0"><div className="text-xs font-bold text-white">{item.concept}: {title(item.action)}</div><div className="text-[10px] text-slate-500 truncate">{item.reason}</div></div>
        </div>)}{(!dashboard.agent_plan || dashboard.agent_plan.length === 0) && <p className="text-xs text-slate-500 mt-3">Complete a diagnostic to create the first personalized plan.</p>}</div>
      </section>
    </div>
    <form onSubmit={onDiagnostic} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid sm:grid-cols-[1fr_150px_auto] gap-3 items-end">
      <label className="text-xs text-slate-400">Concept<input value={concept} onChange={e => setConcept(e.target.value)} required placeholder="e.g. Fractions" className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white" /></label>
      <label className="text-xs text-slate-400">Diagnostic score: {score}%<input type="range" min="0" max="100" value={score} onChange={e => setScore(Number(e.target.value))} className="mt-3 w-full accent-cyan-500" /></label>
      <button disabled={saving} className="h-10 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-black">{saving ? 'Analyzing...' : teacher ? 'Record evidence' : 'Save diagnostic'}</button>
    </form>
    {dashboard.states.length === 0 ? <Empty message="Start with a short diagnostic. The agent will become more reliable as diverse evidence accumulates." /> : <div className="grid xl:grid-cols-2 gap-4">{dashboard.states.map((state: any) => <div key={state.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex justify-between"><div><h3 className="font-bold text-white">{state.concept}</h3><p className="text-[11px] text-slate-500">{state.evidence_count} observations · {title(state.bottleneck)} bottleneck</p></div><span className="text-xl font-black text-cyan-400">{pct(state.competency)}</span></div>
      <div className="grid grid-cols-4 gap-2">{[['Mastery',state.mastery],['Retention',state.retention],['Transfer',state.transfer],['Confidence',1-state.uncertainty]].map(([label,value]: any) => <div key={label}><div className="text-[10px] text-slate-500 mb-1">{label}</div><div className="h-1.5 bg-slate-800 rounded-full"><div className="h-full bg-cyan-500 rounded-full" style={{width:pct(value)}} /></div><div className="text-[10px] text-slate-400 mt-1">{pct(value)}</div></div>)}</div>
      <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20"><div className="flex items-center gap-2 text-xs font-bold text-cyan-300"><Sparkles className="w-3.5 h-3.5" /> Next: {title(state.recommendation.action)}</div><p className="text-xs text-slate-300 mt-1">{state.recommendation.reason}</p></div>
      {!teacher && <div className="flex items-center gap-2 text-[10px] text-slate-500">{feedbackSent[state.id] ? <span className="text-emerald-400">Feedback recorded for your agent.</span> : <><span>Was this useful?</span><button onClick={() => sendFeedback(state, 5)} className="px-2 py-1 rounded bg-slate-800 hover:text-cyan-300">Yes</button><button onClick={() => sendFeedback(state, 2)} className="px-2 py-1 rounded bg-slate-800 hover:text-rose-300">Not really</button></>}</div>}
      {state.recommendation.candidates?.length > 0 && <div className="flex flex-wrap gap-2">{state.recommendation.candidates.slice(0, 3).map((candidate: any) => <span key={candidate.action} className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400 flex items-center gap-1"><Clock3 className="w-3 h-3" /> {title(candidate.action)} · {candidate.estimated_minutes} min</span>)}</div>}
    </div>)}</div>}
    <p className="text-[11px] text-slate-500">This is decision support, not a psychological diagnosis. Low evidence adequacy triggers more measurement rather than a high-stakes conclusion.</p>
  </div>
}

const Metric = ({ icon, label, value, warning = false }: any) => <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><div className={`w-5 h-5 mb-2 ${warning ? 'text-amber-400' : 'text-cyan-400'}`}>{icon}</div><div className="text-[11px] text-slate-500">{label}</div><div className="text-xl font-black text-white">{value}</div></div>

const Pattern = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="text-xs font-bold text-slate-200 mt-1 truncate">{value}</div></div>
