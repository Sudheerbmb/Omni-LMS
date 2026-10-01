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
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Play,
  Check,
  RefreshCw,
  Loader2,
  Award
} from 'lucide-react'
import type { User } from '../lib/api'
import {
  computeBayesianMastery,
  computeCompetency,
  computeUncertainty,
  classifyBottleneck,
  runLangGraphAgentPipeline
} from '../lib/langgraphAgent'
import type {
  FullStudentNeuralState,
  SubjectBenchmarkState,
  ConceptEvidence
} from '../lib/langgraphAgent'
import { fetchSubjectBenchmarkQuestions } from '../lib/subjectQuestions'
import type { SubjectQuestion } from '../lib/subjectQuestions'

// ── Initial Grade Configurations ─────────────────────────────────────────────

function initializeCurriculumStructure(gradeNumber: number, studentId: string, studentName: string): FullStudentNeuralState {
  const isElementary = gradeNumber <= 5
  const gradeName = `Class ${gradeNumber}`

  const subjectsConfig: Record<string, string[]> = isElementary
    ? {
        'Mathematics': [
          'Multi-digit Arithmetic & Place Values',
          'Fractions, Decimals & Geometry Basics',
          'Applied Word Problems & Measurement',
        ],
        'Science (EVS)': [
          'Plant Nutrition & Photosynthesis',
          'States of Matter & Water Cycle',
          'Animal Habitats & Adaptations',
        ],
        'English Grammar': [
          'Parts of Speech (Nouns, Verbs, Adjectives)',
          'Tenses & Subject-Verb Agreement',
          'Reading Comprehension & Vocabulary',
        ],
        'Social Studies': [
          'Maps, Cardinal Directions & Solar System',
          'Community Governance & Heritage',
          'Physical Geography & Natural Resources',
        ],
      }
    : {
        'Mathematics': [
          'Quadratic Equations & Arithmetic Progressions',
          'Trigonometric Ratios & Heights',
          'Coordinate Geometry & Triangles',
        ],
        'Physics & Chemistry': [
          'Chemical Reactions & Stoichiometry',
          'Acids, Bases & Salts',
          'Light: Reflection, Refraction & Optics',
        ],
        'Life Sciences': [
          'Life Processes & Cellular Respiration',
          'Control & Coordination',
          'Heredity & Genetics',
        ],
        'Social Science': [
          'Nationalism in India & Democratic Politics',
          'Resources, Development & Agriculture',
          'Money, Credit & Globalization',
        ],
      }

  const subjectsState: Record<string, SubjectBenchmarkState> = {}

  Object.entries(subjectsConfig).forEach(([subjName, conceptsList]) => {
    const conceptObjs: ConceptEvidence[] = conceptsList.map((cName, idx) => ({
      concept_id: `c_${subjName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${idx + 1}`,
      concept_name: cName,
      subject: subjName,
      attempts_count: 0,
      correct_count: 0,
      mastery: 0.00,
      retention: 0.00,
      transfer: 0.00,
      misconception: 0.00,
      competency: 0.00,
      uncertainty: 0.95,
      identifiability: 0.00,
      bottleneck: 'INSUFFICIENT_EVIDENCE',
      learning_mode: 'DIAGNOSTIC',
      active_misconceptions: [],
      last_updated: new Date().toISOString(),
    }))

    subjectsState[subjName] = {
      subject: subjName,
      is_calibrated: false,
      overall_mastery: 0.00,
      overall_retention: 0.00,
      overall_transfer: 0.00,
      overall_misconception: 0.00,
      overall_competency: 0.00,
      overall_uncertainty: 0.95,
      identifiability: 0.00,
      active_bottleneck: 'INSUFFICIENT_EVIDENCE',
      active_mode: 'DIAGNOSTIC',
      concepts: conceptObjs,
    }
  })

  return {
    student_id: studentId,
    student_name: studentName,
    grade_name: gradeName,
    subjects: subjectsState,
    overall_competency: 0.00,
    overall_mastery: 0.00,
    overall_uncertainty: 0.95,
    primary_bottleneck: 'INSUFFICIENT_EVIDENCE',
    primary_mode: 'DIAGNOSTIC',
    total_evidence_events: 0,
  }
}

export const LearningIntelligencePage: React.FC<{ user: User | null }> = ({ user }) => {
  const gradeMatch = user?.display_name?.match(/Class\s*(\d+)/i)
  const detectedGrade = gradeMatch ? parseInt(gradeMatch[1], 10) : 4
  const storageKey = `lens_granular_v3_${user?.id || 'demo'}_grade_${detectedGrade}`

  // Multi-Subject Granular State Graph
  const [neuralState, setNeuralState] = useState<FullStudentNeuralState>(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // pass
      }
    }
    return initializeCurriculumStructure(detectedGrade, user?.id || 'std_demo', user?.display_name || 'Student')
  })

  // Active Selected Subject Filter for View
  const subjectList = Object.keys(neuralState.subjects)
  const [activeSubjectTab, setActiveSubjectTab] = useState<string>('All Subjects')

  // Subject Benchmark Test Modal State
  const [benchmarkModalOpen, setBenchmarkModalOpen] = useState(false)
  const [activeTestSubject, setActiveTestSubject] = useState<string>('')
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [questions, setQuestions] = useState<SubjectQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [testSubmitting, setTestSubmitting] = useState(false)
  const [testSummary, setTestSummary] = useState<{
    subject: string
    scorePercent: number
    correctCount: number
    totalCount: number
    conceptBreakdown: Record<string, { correct: number; total: number; mastery: number }>
  } | null>(null)

  // Interactive Drill Modal for Roadmap Items
  const [drillModalOpen, setDrillModalOpen] = useState(false)
  const [activeDrillConcept, setActiveDrillConcept] = useState<ConceptEvidence | null>(null)
  const [drillCompleted, setDrillCompleted] = useState(false)

  // LangGraph SN1 Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string }>>([
    {
      sender: 'agent',
      text: neuralState.total_evidence_events === 0
        ? `Hello ${user?.display_name || 'Learner'}! I am SN1, your autonomous Student Neural Intelligence agent. You are enrolled in **${neuralState.grade_name}** covering **${subjectList.join(', ')}**. Currently, I have zero baseline evidence for your subjects (Uncertainty: 95%). Please complete a benchmark test for each subject to calibrate your multi-dimensional state graph!`
        : `Hello ${user?.display_name || 'Learner'}! I am SN1. Your **${neuralState.grade_name}** state vector has ingested **${neuralState.total_evidence_events} evidence events**. Overall Competency is at **${(neuralState.overall_competency * 100).toFixed(0)}%** with primary bottleneck **${neuralState.primary_bottleneck}**. How can I assist your study plan today?`,
      time: 'Just now',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  // Dynamic Daily Roadmap
  const dynamicRoadmap = React.useMemo(() => {
    // Find subjects with lowest competency or uncalibrated
    const uncalibratedSubjs = subjectList.filter((s) => !neuralState.subjects[s].is_calibrated)
    const weakSubjs = subjectList.filter((s) => neuralState.subjects[s].is_calibrated)
      .sort((a, b) => neuralState.subjects[a].overall_competency - neuralState.subjects[b].overall_competency)

    if (uncalibratedSubjs.length > 0) {
      return [
        {
          time: '08:00 - 08:30',
          type: 'DIAGNOSTIC' as const,
          subject: uncalibratedSubjs[0],
          title: `Initial Benchmark: ${uncalibratedSubjs[0]}`,
          duration: 30,
          grounding: `Uncertainty at ${(neuralState.subjects[uncalibratedSubjs[0]].overall_uncertainty * 100).toFixed(0)}%. Complete 8-question benchmark to calibrate.`,
          priority: 'CRITICAL' as const,
        },
        {
          time: '12:00 - 12:45',
          type: 'DIAGNOSTIC' as const,
          subject: uncalibratedSubjs[1] || uncalibratedSubjs[0],
          title: `Diagnostic Evaluation: ${uncalibratedSubjs[1] || uncalibratedSubjs[0]}`,
          duration: 45,
          grounding: `Collect foundational baseline evidence across enrolled syllabus.`,
          priority: 'HIGH' as const,
        },
        {
          time: '17:00 - 17:30',
          type: 'RETRIEVAL' as const,
          subject: weakSubjs[0] || subjectList[0],
          title: `Curriculum Orientation & Baseline Recall`,
          duration: 30,
          grounding: `Establish baseline retrieval confidence.`,
          priority: 'MEDIUM' as const,
        },
      ]
    }

    // If calibrated, generate targeting the weakest concept
    const targetSubj = weakSubjs[0] || subjectList[0]
    const subjState = neuralState.subjects[targetSubj]
    const targetConcept = subjState.concepts.slice().sort((a, b) => a.competency - b.competency)[0]

    return [
      {
        time: '08:00 - 08:30',
        type: 'RETRIEVAL' as const,
        subject: targetSubj,
        title: `Spaced Recall: ${targetConcept?.concept_name || targetSubj}`,
        duration: 30,
        grounding: `Memory retention reinforcement (R = ${(targetConcept?.retention * 100 || 85).toFixed(0)}%).`,
        priority: 'HIGH' as const,
      },
      {
        time: '12:00 - 12:45',
        type: 'REMEDIATION' as const,
        subject: targetSubj,
        title: `Targeted Problem Solving: ${targetConcept?.concept_name || targetSubj}`,
        duration: 45,
        grounding: `Unblocks active bottleneck (${subjState.active_bottleneck}) and clears error misconceptions.`,
        priority: 'CRITICAL' as const,
      },
      {
        time: '17:00 - 17:45',
        type: 'TRANSFER' as const,
        subject: weakSubjs[1] || subjectList[1] || targetSubj,
        title: `Transfer Challenge: ${weakSubjs[1] || subjectList[1]} Applied Reasoning`,
        duration: 45,
        grounding: `Cross-context generalization challenge across unseen formulations.`,
        priority: 'HIGH' as const,
      },
    ]
  }, [neuralState, subjectList])

  // Launch Subject Benchmark Test
  const handleStartSubjectBenchmark = async (subjectName: string) => {
    setActiveTestSubject(subjectName)
    setSelectedAnswers({})
    setQIndex(0)
    setTestSummary(null)
    setBenchmarkModalOpen(true)
    setLoadingQuestions(true)

    try {
      const qList = await fetchSubjectBenchmarkQuestions(neuralState.grade_name, subjectName, 8)
      setQuestions(qList)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingQuestions(false)
    }
  }

  // Submit Benchmark and Compute Granular Bayesian Updates Per Concept
  const handleSubmitBenchmark = () => {
    setTestSubmitting(true)
    const currentSubjectState = neuralState.subjects[activeTestSubject]
    if (!currentSubjectState) return

    let totalCorrect = 0
    const conceptStats: Record<string, { correct: number; total: number; diffSum: number; misconceptions: string[] }> = {}

    // Initialize map
    currentSubjectState.concepts.forEach((c) => {
      conceptStats[c.concept_id] = { correct: 0, total: 0, diffSum: 0, misconceptions: [] }
    })

    questions.forEach((q, idx) => {
      // Map question to concept
      const targetConcept = currentSubjectState.concepts.find(c =>
        c.concept_id === q.concept_id || q.concept_name.toLowerCase().includes(c.concept_name.split(' ')[0].toLowerCase())
      ) || currentSubjectState.concepts[idx % currentSubjectState.concepts.length]

      if (!conceptStats[targetConcept.concept_id]) {
        conceptStats[targetConcept.concept_id] = { correct: 0, total: 0, diffSum: 0, misconceptions: [] }
      }

      const isCorrect = selectedAnswers[q.id] === q.correct_index
      conceptStats[targetConcept.concept_id].total += 1
      conceptStats[targetConcept.concept_id].diffSum += q.difficulty

      if (isCorrect) {
        totalCorrect += 1
        conceptStats[targetConcept.concept_id].correct += 1
      } else {
        conceptStats[targetConcept.concept_id].misconceptions.push(q.misconception_tag)
      }
    })

    const totalQuestions = questions.length
    const overallScoreRatio = totalCorrect / Math.max(1, totalQuestions)

    // Update EACH individual concept using real individual evidence!
    const updatedConcepts: ConceptEvidence[] = currentSubjectState.concepts.map((c) => {
      const stat = conceptStats[c.concept_id]
      if (!stat || stat.total === 0) {
        // Unassessed concept retains previous or neutral
        return c
      }

      const cRatio = stat.correct / stat.total
      const avgDiff = stat.diffSum / stat.total
      const newM = computeBayesianMastery(c.mastery > 0 ? c.mastery : 0.15, cRatio, avgDiff, true)
      const newR = 0.85
      const newT = Math.max(0.10, cRatio * 0.75)
      const newMS = stat.misconceptions.length > 0 ? Math.min(0.60, 0.15 + 0.25 * stat.misconceptions.length) : 0.02
      const newC = computeCompetency(newM, newR, newT, newMS)
      const newU = computeUncertainty(stat.total)
      const newI = 0.60
      const { bottleneck, mode } = classifyBottleneck(newM, newR, newT, newMS, newU, newI)

      return {
        ...c,
        attempts_count: c.attempts_count + stat.total,
        correct_count: c.correct_count + stat.correct,
        mastery: Number(newM.toFixed(4)),
        retention: Number(newR.toFixed(4)),
        transfer: Number(newT.toFixed(4)),
        misconception: Number(newMS.toFixed(4)),
        competency: Number(newC.toFixed(4)),
        uncertainty: Number(newU.toFixed(4)),
        identifiability: Number(newI.toFixed(4)),
        bottleneck: bottleneck as any,
        learning_mode: mode as any,
        active_misconceptions: stat.misconceptions,
        last_updated: new Date().toISOString(),
      }
    })

    // Compute Subject Aggregate
    const avgMastery = updatedConcepts.reduce((acc, c) => acc + c.mastery, 0) / updatedConcepts.length
    const avgRetention = 0.85
    const avgTransfer = updatedConcepts.reduce((acc, c) => acc + c.transfer, 0) / updatedConcepts.length
    const avgMisconception = updatedConcepts.reduce((acc, c) => acc + c.misconception, 0) / updatedConcepts.length
    const avgCompetency = computeCompetency(avgMastery, avgRetention, avgTransfer, avgMisconception)
    const avgUncertainty = updatedConcepts.reduce((acc, c) => acc + c.uncertainty, 0) / updatedConcepts.length
    const { bottleneck: subjBottleneck, mode: subjMode } = classifyBottleneck(avgMastery, avgRetention, avgTransfer, avgMisconception, avgUncertainty, 0.7)

    const updatedSubject: SubjectBenchmarkState = {
      subject: activeTestSubject,
      is_calibrated: true,
      overall_mastery: Number(avgMastery.toFixed(4)),
      overall_retention: Number(avgRetention.toFixed(4)),
      overall_transfer: Number(avgTransfer.toFixed(4)),
      overall_misconception: Number(avgMisconception.toFixed(4)),
      overall_competency: Number(avgCompetency.toFixed(4)),
      overall_uncertainty: Number(avgUncertainty.toFixed(4)),
      identifiability: 0.70,
      active_bottleneck: subjBottleneck,
      active_mode: subjMode,
      concepts: updatedConcepts,
      benchmark_score_percent: Math.round(overallScoreRatio * 100),
      last_assessed: new Date().toISOString(),
    }

    const nextSubjects = { ...neuralState.subjects, [activeTestSubject]: updatedSubject }

    // Compute Global Student Aggregate across all subjects
    const allSubjects = Object.values(nextSubjects)
    const calibratedSubjs = allSubjects.filter(s => s.is_calibrated)
    const globalCompetency = allSubjects.reduce((acc, s) => acc + s.overall_competency, 0) / allSubjects.length
    const globalMastery = allSubjects.reduce((acc, s) => acc + s.overall_mastery, 0) / allSubjects.length
    const globalUncertainty = allSubjects.reduce((acc, s) => acc + s.overall_uncertainty, 0) / allSubjects.length
    const primaryBottleneck = calibratedSubjs.length === 0 ? 'INSUFFICIENT_EVIDENCE' : updatedSubject.active_bottleneck

    const nextFullState: FullStudentNeuralState = {
      ...neuralState,
      subjects: nextSubjects,
      overall_competency: Number(globalCompetency.toFixed(4)),
      overall_mastery: Number(globalMastery.toFixed(4)),
      overall_uncertainty: Number(globalUncertainty.toFixed(4)),
      primary_bottleneck: primaryBottleneck,
      primary_mode: updatedSubject.active_mode,
      total_evidence_events: neuralState.total_evidence_events + totalQuestions,
    }

    setNeuralState(nextFullState)
    localStorage.setItem(storageKey, JSON.stringify(nextFullState))

    // Concept breakdown summary
    const breakdown: Record<string, { correct: number; total: number; mastery: number }> = {}
    updatedConcepts.forEach((c) => {
      const s = conceptStats[c.concept_id]
      if (s) {
        breakdown[c.concept_name] = { correct: s.correct, total: s.total, mastery: Math.round(c.mastery * 100) }
      }
    })

    setTestSummary({
      subject: activeTestSubject,
      scorePercent: Math.round(overallScoreRatio * 100),
      correctCount: totalCorrect,
      totalCount: totalQuestions,
      conceptBreakdown: breakdown,
    })
    setTestSubmitting(false)

    // Append LangGraph Agent Notification
    const agentMsg = `Benchmark Completed for **${activeTestSubject}**! You scored **${Math.round(overallScoreRatio * 100)}%** (${totalCorrect}/${totalQuestions} correct).
• **${activeTestSubject} Mastery**: ${(avgMastery * 100).toFixed(0)}%
• **Competency**: ${(avgCompetency * 100).toFixed(0)}%
• **Epistemic Uncertainty**: reduced to ${(avgUncertainty * 100).toFixed(0)}%
• **Active Bottleneck**: **${subjBottleneck}** (Mode: ${subjMode})

Your per-concept breakdown has been updated below.`
    setChatMessages((prev) => [
      ...prev,
      { sender: 'agent', text: agentMsg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ])
  }

  // Handle SN1 LangGraph Autonomous Chat
  const handleSendChat = async (promptToSend?: string) => {
    const query = promptToSend || chatInput
    if (!query.trim()) return

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { sender: 'user' as const, text: query, time: nowStr }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    const updatedHistory = [...history, { role: 'user' as const, content: query }]
    setHistory(updatedHistory)

    try {
      const agentReply = await runLangGraphAgentPipeline(
        user?.display_name || 'Learner',
        neuralState.grade_name,
        neuralState,
        query,
        history
      )

      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: agentReply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ])
      setHistory([...updatedHistory, { role: 'assistant', content: agentReply }])
    } catch (err) {
      console.error(err)
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `Grounded in your live ${neuralState.grade_name} neural state vector across ${subjectList.join(', ')}, your primary bottleneck is ${neuralState.primary_bottleneck}. Please follow today's scheduled roadmap blocks.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const handleResetCalibration = () => {
    localStorage.removeItem(storageKey)
    window.location.reload()
  }

  // Filter concepts based on selected subject tab
  const displayedConcepts = React.useMemo(() => {
    if (activeSubjectTab === 'All Subjects') {
      return Object.values(neuralState.subjects).flatMap(s => s.concepts)
    }
    return neuralState.subjects[activeSubjectTab]?.concepts || []
  }, [neuralState, activeSubjectTab])

  const currentQ = questions[qIndex]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Brain className="w-3.5 h-3.5" />
            LENS-Ω + SN1 &bull; {neuralState.grade_name} Granular Multi-Subject Graph
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {user?.display_name || 'Student'} &bull; Cognitive Neural Engine
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Enrolled in <strong>{neuralState.grade_name}</strong> ({subjectList.join(', ')}). Psychometric state estimation tracking each subject individually with Bayesian updates.
          </p>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[120px]">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Holistic Competency</div>
            <div className="text-3xl font-black text-cyan-400 font-mono">
              {(neuralState.overall_competency * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-500">Global C Index</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[140px]">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Primary Bottleneck</div>
            <div className={`text-xs font-black px-2 py-1 rounded mt-1 ${
              neuralState.primary_bottleneck === 'INSUFFICIENT_EVIDENCE'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {neuralState.primary_bottleneck}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Events: {neuralState.total_evidence_events}</div>
          </div>
        </div>
      </div>

      {/* ── Subject-Wise Benchmark Assessment Hub ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Subject-Wise Benchmark Assessment Hub &bull; {neuralState.grade_name}
            </h2>
            <p className="text-xs text-slate-400">
              Each subject tracks its own calibrated state vector. Take a benchmark test to calibrate each individual subject.
            </p>
          </div>
          <button
            onClick={handleResetCalibration}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 transition-colors w-fit"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset All Subject Baselines</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subjectList.map((subjName) => {
            const subj = neuralState.subjects[subjName]
            return (
              <div
                key={subjName}
                className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between space-y-4 ${
                  subj.is_calibrated
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    : 'bg-gradient-to-b from-slate-900 to-amber-950/20 border-amber-500/30 shadow-lg shadow-amber-500/5'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 font-mono">{subjName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        subj.is_calibrated
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {subj.is_calibrated ? `Score: ${subj.benchmark_score_percent}%` : 'UNCALIBRATED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500">Mastery</div>
                      <div className="text-sm font-bold text-emerald-400 font-mono">
                        {(subj.overall_mastery * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Competency</div>
                      <div className="text-sm font-bold text-cyan-400 font-mono">
                        {(subj.overall_competency * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Uncertainty</div>
                      <div className={`text-sm font-bold font-mono ${subj.overall_uncertainty > 0.5 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {(subj.overall_uncertainty * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>Bottleneck:</span>
                    <span className="font-bold text-amber-400">{subj.active_bottleneck}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleStartSubjectBenchmark(subjName)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    subj.is_calibrated
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-slate-950 shadow-md shadow-amber-500/20'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{subj.is_calibrated ? `Retake ${subjName} Test` : `Take ${subjName} Benchmark`}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Granular Concepts Matrix with Subject Tabs ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Concept Matrix */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Granular Concept Evidence & Bottleneck Matrix
                </h3>
                <p className="text-xs text-slate-400">Individual concept progress updated strictly per question answered.</p>
              </div>

              {/* Subject Tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                {['All Subjects', ...subjectList].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSubjectTab(tab)}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      activeSubjectTab === tab
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="pb-3">Subject & Concept</th>
                    <th className="pb-3 text-center">Mastery</th>
                    <th className="pb-3 text-center">Retention</th>
                    <th className="pb-3 text-center">Transfer</th>
                    <th className="pb-3 text-center">Misconception</th>
                    <th className="pb-3 text-center">Bottleneck</th>
                    <th className="pb-3 text-right">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedConcepts.map((c) => (
                    <tr key={c.concept_id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-slate-200">{c.concept_name}</div>
                        <div className="text-[10px] text-cyan-400 font-mono">{c.subject}</div>
                      </td>
                      <td className="py-3 text-center font-mono text-emerald-400 font-bold">
                        {(c.mastery * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 text-center font-mono text-cyan-400">
                        {(c.retention * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 text-center font-mono text-indigo-400">
                        {(c.transfer * 100).toFixed(0)}%
                      </td>
                      <td className={`py-3 text-center font-mono ${c.misconception > 0.2 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                        {(c.misconception * 100).toFixed(0)}%
                      </td>
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

          {/* Dynamic Daily Roadmap (Section 86) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  Today's Dynamic Roadmap &bull; {neuralState.grade_name}
                </h3>
                <p className="text-xs text-slate-400">Synthesized by LangGraph policy optimizer targeting your active bottlenecks.</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">Total: 2.0 hrs</span>
            </div>

            <div className="space-y-3">
              {dynamicRoadmap.map((block, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0 text-xs">
                      {block.type === 'RETRIEVAL' && <Clock className="w-5 h-5" />}
                      {block.type === 'DIAGNOSTIC' && <ShieldAlert className="w-5 h-5 text-amber-400" />}
                      {block.type === 'REMEDIATION' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                      {block.type === 'TRANSFER' && <Zap className="w-5 h-5 text-indigo-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-300">{block.time}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                          {block.subject} &bull; {block.type}
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

                  <button
                    onClick={() => {
                      if (block.type === 'DIAGNOSTIC') {
                        handleStartSubjectBenchmark(block.subject)
                      } else {
                        const targetC = neuralState.subjects[block.subject]?.concepts[0]
                        if (targetC) {
                          setActiveDrillConcept(targetC)
                          setDrillCompleted(false)
                          setDrillModalOpen(true)
                        }
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shrink-0 transition-all hover:scale-105 active:scale-95"
                  >
                    Start Drill
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Autonomous LangGraph SN1 Agent */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col h-[680px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">SN1 Autonomous Agent</h3>
                  <p className="text-[10px] text-cyan-400 font-mono">LangGraph + Groq Cloud LPU</p>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-3.5 rounded-2xl max-w-[88%] leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950 border border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">{m.time}</span>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-cyan-400 p-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  SN1 LangGraph Agent is synthesizing answer...
                </div>
              )}
            </div>

            {/* Quick Prompts */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400">Grounded Prompts:</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'What is my weakest subject right now?',
                  'Why is my uncertainty high?',
                  'How do I improve my Mathematics mastery?',
                  'What should I study today?',
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendChat(q)}
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
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder={`Ask SN1 about ${neuralState.grade_name} concepts, math derivations...`}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => handleSendChat()}
                disabled={chatLoading || !chatInput.trim()}
                className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all disabled:opacity-50 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Subject Benchmark Test Modal ─────────────────────────────────────── */}
      {benchmarkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {neuralState.grade_name} &bull; {activeTestSubject} Benchmark Test
                  </h3>
                  <p className="text-xs text-slate-400">
                    {loadingQuestions
                      ? 'Groq Cloud LPU synthesizing psychometric test items...'
                      : testSummary
                      ? 'Benchmark Assessment Evaluated'
                      : `Question ${qIndex + 1} of ${questions.length} • Concept: ${currentQ?.concept_name}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBenchmarkModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl p-1 font-bold"
              >
                &times;
              </button>
            </div>

            {loadingQuestions ? (
              <div className="p-12 text-center space-y-4">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-base">Generating {activeTestSubject} Benchmark Items...</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Synthesizing psychometric questions covering {activeTestSubject} standards for {neuralState.grade_name}.
                  </p>
                </div>
              </div>
            ) : testSummary ? (
              <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/30 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-white">{testSummary.subject} Benchmark Evaluated!</h4>
                  <p className="text-sm text-slate-300">
                    Overall Score: <strong className="text-emerald-400 text-lg">{testSummary.scorePercent}%</strong> ({testSummary.correctCount}/{testSummary.totalCount} correct)
                  </p>
                </div>

                {/* Per-Concept Detailed Breakdown */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per-Concept Calibration:</div>
                  <div className="space-y-2">
                    {Object.entries(testSummary.conceptBreakdown).map(([cName, data]) => (
                      <div key={cName} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-medium text-slate-200">{cName}</div>
                          <div className="text-[10px] text-slate-500">{data.correct}/{data.total} items correct</div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-400 text-sm">{data.mastery}%</span>
                          <div className="text-[10px] text-cyan-400 font-mono">Mastery</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setBenchmarkModalOpen(false)}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-extrabold text-sm transition-all shadow-lg shadow-cyan-500/20"
                >
                  View Updated State Vector & Roadmap
                </button>
              </div>
            ) : currentQ ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-300 font-bold">
                      Concept: {currentQ.concept_name}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-amber-300 font-bold">
                      Level: {currentQ.cognitive_level}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <p className="text-sm font-semibold text-white leading-relaxed">{currentQ.prompt}</p>
                  </div>

                  <div className="space-y-2">
                    {currentQ.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQ.id] === optIdx
                      return (
                        <button
                          key={optIdx}
                          onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optIdx }))}
                          className={`w-full p-3.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md shadow-cyan-500/10'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={qIndex === 0}
                    onClick={() => setQIndex((prev) => prev - 1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {qIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      disabled={selectedAnswers[currentQ.id] === undefined}
                      onClick={() => setQIndex((prev) => prev + 1)}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Object.keys(selectedAnswers).length < questions.length || testSubmitting}
                      onClick={handleSubmitBenchmark}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 hover:scale-105"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{testSubmitting ? 'Computing Bayesian Updates...' : `Submit ${activeTestSubject} Benchmark`}</span>
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Interactive Practice Drill Modal for Specific Concepts ────────────── */}
      {drillModalOpen && activeDrillConcept && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Practice Drill: {activeDrillConcept.concept_name}</h3>
                  <p className="text-xs text-indigo-400 font-mono">{activeDrillConcept.subject} &bull; Mode: {activeDrillConcept.learning_mode}</p>
                </div>
              </div>
              <button onClick={() => setDrillModalOpen(false)} className="text-slate-400 hover:text-white text-xl p-1">
                &times;
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase">Target Intervention:</div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Complete 5 focused practice items on <strong>{activeDrillConcept.concept_name}</strong> to resolve active bottleneck <strong>{activeDrillConcept.bottleneck}</strong>.
              </p>
              <div className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <strong>Current State:</strong> Mastery: {(activeDrillConcept.mastery * 100).toFixed(0)}%, Competency: {(activeDrillConcept.competency * 100).toFixed(0)}%.
              </div>
            </div>

            {drillCompleted ? (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Drill Successfully Recorded!</h4>
                <p className="text-xs text-slate-300">Bayesian belief updated (+4% mastery boost on this concept).</p>
                <button
                  onClick={() => setDrillModalOpen(false)}
                  className="mt-2 w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDrillCompleted(true)
                  // Apply targeted concept Bayesian update
                  setNeuralState((prev) => {
                    const subj = prev.subjects[activeDrillConcept.subject]
                    if (!subj) return prev
                    const updatedC = subj.concepts.map(c => {
                      if (c.concept_id === activeDrillConcept.concept_id) {
                        const newM = Math.min(1.0, c.mastery + 0.04)
                        const newC = computeCompetency(newM, c.retention || 0.85, c.transfer || 0.5, c.misconception || 0.02)
                        return { ...c, mastery: newM, competency: newC }
                      }
                      return c
                    })
                    const avgM = updatedC.reduce((a, b) => a + b.mastery, 0) / updatedC.length
                    const avgC = updatedC.reduce((a, b) => a + b.competency, 0) / updatedC.length
                    const updatedSubj = { ...subj, concepts: updatedC, overall_mastery: avgM, overall_competency: avgC }
                    const nextS = { ...prev.subjects, [activeDrillConcept.subject]: updatedSubj }
                    const nextFull = { ...prev, subjects: nextS, total_evidence_events: prev.total_evidence_events + 5 }
                    localStorage.setItem(storageKey, JSON.stringify(nextFull))
                    return nextFull
                  })
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Log Practice Completion & Record Evidence</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default LearningIntelligencePage
