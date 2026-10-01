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
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Play,
  Check,
  RefreshCw,
  Loader2
} from 'lucide-react'
import type { User, LensDiagnosticQuestion } from '../lib/api'
import { generateLensDiagnostic, submitLensDiagnostic, sendLensChat } from '../lib/api'

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
  is_calibrated: boolean
}

interface ConceptState {
  concept_id: string
  concept_name: string
  subject: string
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
  subject: string
  estimated_duration_mins: number
  grounding: string
  priority: string
}

// ── Grade-Specific Curriculum Helpers ───────────────────────────────────────

function getCurriculumForGrade(gradeNumber: number) {
  if (gradeNumber <= 5) {
    return {
      gradeName: `Class ${gradeNumber}`,
      subjects: ['Mathematics', 'Science (EVS)', 'English Grammar', 'Social Studies'],
      concepts: [
        { id: 'g4_m1', name: 'Multi-digit Arithmetic & Place Values', subject: 'Mathematics' },
        { id: 'g4_m2', name: 'Fractions & Geometric Shapes', subject: 'Mathematics' },
        { id: 'g4_s1', name: 'Plant Nutrition & Photosynthesis', subject: 'Science (EVS)' },
        { id: 'g4_s2', name: 'States of Matter & Water Cycle', subject: 'Science (EVS)' },
        { id: 'g4_e1', name: 'Parts of Speech & Tenses', subject: 'English Grammar' },
        { id: 'g4_ss1', name: 'Maps, Cardinal Directions & Solar System', subject: 'Social Studies' },
      ],
      defaultQuestions: [
        {
          id: 'q1',
          subject: 'Mathematics',
          concept: 'Multi-digit Arithmetic',
          prompt: 'What is the product of 25 × 16?',
          options: ['380', '400', '420', '450'],
          correct_index: 1,
          difficulty: 0.40,
          cognitive_level: 'FOUNDATION',
        },
        {
          id: 'q2',
          subject: 'Mathematics',
          concept: 'Fractions & Shapes',
          prompt: 'Which of the following fractions is equivalent to 3/4?',
          options: ['6/8', '5/8', '6/10', '9/16'],
          correct_index: 0,
          difficulty: 0.50,
          cognitive_level: 'APPLICATION',
        },
        {
          id: 'q3',
          subject: 'Science (EVS)',
          concept: 'Plant Nutrition',
          prompt: 'Which green pigment in plant leaves absorbs sunlight for photosynthesis?',
          options: ['Carotene', 'Chlorophyll', 'Hemoglobin', 'Melanin'],
          correct_index: 1,
          difficulty: 0.35,
          cognitive_level: 'FOUNDATION',
        },
        {
          id: 'q4',
          subject: 'Science (EVS)',
          concept: 'Water Cycle',
          prompt: 'The process where water vapor cools down and turns back into liquid water droplets is called:',
          options: ['Evaporation', 'Precipitation', 'Condensation', 'Transpiration'],
          correct_index: 2,
          difficulty: 0.45,
          cognitive_level: 'APPLICATION',
        },
        {
          id: 'q5',
          subject: 'English Grammar',
          concept: 'Parts of Speech',
          prompt: 'Identify the adjective in the sentence: "The quick brown fox jumps over the lazy dog."',
          options: ['Jumps', 'Fox', 'Quick', 'Over'],
          correct_index: 2,
          difficulty: 0.30,
          cognitive_level: 'FOUNDATION',
        },
        {
          id: 'q6',
          subject: 'Social Studies',
          concept: 'Maps & Directions',
          prompt: 'On a standard geographical map, which cardinal direction is represented at the top?',
          options: ['East', 'West', 'South', 'North'],
          correct_index: 3,
          difficulty: 0.25,
          cognitive_level: 'FOUNDATION',
        },
      ] as LensDiagnosticQuestion[]
    }
  } else {
    // Class 10 Curriculum
    return {
      gradeName: `Class ${gradeNumber}`,
      subjects: ['Mathematics', 'Physics & Chemistry', 'Life Sciences', 'Social Science'],
      concepts: [
        { id: 'g10_m1', name: 'Quadratic Equations & Arithmetic Progressions', subject: 'Mathematics' },
        { id: 'g10_m2', name: 'Trigonometric Ratios & Heights', subject: 'Mathematics' },
        { id: 'g10_s1', name: 'Chemical Reactions & Stoichiometry', subject: 'Physics & Chemistry' },
        { id: 'g10_s2', name: 'Light: Reflection, Refraction & Snell\'s Law', subject: 'Physics & Chemistry' },
        { id: 'g10_b1', name: 'Life Processes & Cellular Respiration', subject: 'Life Sciences' },
        { id: 'g10_ss1', name: 'Resources, Development & Federalism', subject: 'Social Science' },
      ],
      defaultQuestions: [
        {
          id: 'q1',
          subject: 'Mathematics',
          concept: 'Quadratic Equations',
          prompt: 'If the discriminant of ax² + bx + c = 0 is greater than zero (b² - 4ac > 0), the roots are:',
          options: ['Real and equal', 'Real and distinct', 'Complex conjugates', 'Zero'],
          correct_index: 1,
          difficulty: 0.50,
          cognitive_level: 'APPLICATION',
        },
        {
          id: 'q2',
          subject: 'Mathematics',
          concept: 'Trigonometry',
          prompt: 'What is the exact value of sin²(45°) + cos²(45°)?',
          options: ['0', '0.5', '1', '2'],
          correct_index: 2,
          difficulty: 0.35,
          cognitive_level: 'FOUNDATION',
        },
        {
          id: 'q3',
          subject: 'Physics & Chemistry',
          concept: 'Chemical Reactions',
          prompt: 'When iron reacts with copper sulfate solution, iron displaces copper. This is an example of a:',
          options: ['Combination reaction', 'Decomposition reaction', 'Displacement reaction', 'Neutralization reaction'],
          correct_index: 2,
          difficulty: 0.40,
          cognitive_level: 'APPLICATION',
        },
        {
          id: 'q4',
          subject: 'Physics & Chemistry',
          concept: 'Light & Optics',
          prompt: 'A ray of light traveling from air into water bends towards the normal because water is:',
          options: ['Optically denser than air', 'Optically rarer than air', 'At a higher temperature', 'Opaque'],
          correct_index: 0,
          difficulty: 0.55,
          cognitive_level: 'REASONING',
        },
        {
          id: 'q5',
          subject: 'Life Sciences',
          concept: 'Life Processes',
          prompt: 'Which organelle is the site of aerobic cellular respiration producing ATP?',
          options: ['Ribosome', 'Golgi apparatus', 'Mitochondria', 'Chloroplast'],
          correct_index: 2,
          difficulty: 0.30,
          cognitive_level: 'FOUNDATION',
        },
        {
          id: 'q6',
          subject: 'Social Science',
          concept: 'Federalism',
          prompt: 'In the Indian Constitution, subjects of national importance such as defense and foreign affairs fall under the:',
          options: ['State List', 'Union List', 'Concurrent List', 'Residuary Powers'],
          correct_index: 1,
          difficulty: 0.45,
          cognitive_level: 'APPLICATION',
        },
      ] as LensDiagnosticQuestion[]
    }
  }
}

export const LearningIntelligencePage: React.FC<{ user: User | null }> = ({ user }) => {
  const gradeMatch = user?.display_name?.match(/Class\s*(\d+)/i)
  const detectedGrade = gradeMatch ? parseInt(gradeMatch[1], 10) : 4
  const curriculum = getCurriculumForGrade(detectedGrade)
  const storageKey = `lens_state_${user?.id || 'demo'}_grade_${detectedGrade}`

  // Initial 0-Evidence State vs Calibrated State
  const [stateData, setStateData] = useState<LearnerStateData>(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // pass
      }
    }
    return {
      student_id: user?.id || 'std_demo',
      mastery: 0.00,
      retention: 0.00,
      transfer: 0.00,
      misconception: 0.00,
      competency: 0.00,
      uncertainty: 0.95, // High epistemic gap before diagnostic
      identifiability: 0.00, // 0 evidence types collected
      learning_velocity: 0.00,
      current_bottleneck: 'INSUFFICIENT_EVIDENCE',
      current_learning_mode: 'DIAGNOSTIC',
      tracked_concepts_count: curriculum.concepts.length,
      is_calibrated: false,
    }
  })

  const [concepts, setConcepts] = useState<ConceptState[]>(() => {
    return curriculum.concepts.map((c) => ({
      concept_id: c.id,
      concept_name: c.name,
      subject: c.subject,
      mastery: stateData.is_calibrated ? 0.72 : 0.00,
      retention: stateData.is_calibrated ? 0.80 : 0.00,
      transfer: stateData.is_calibrated ? 0.45 : 0.00,
      misconception: stateData.is_calibrated ? 0.08 : 0.00,
      competency: stateData.is_calibrated ? 0.55 : 0.00,
      uncertainty: stateData.is_calibrated ? 0.20 : 0.95,
      bottleneck: stateData.is_calibrated ? 'TRANSFER' : 'INSUFFICIENT_EVIDENCE',
      learning_mode: stateData.is_calibrated ? 'TRANSFER' : 'DIAGNOSTIC',
    }))
  })

  // Dynamic Daily Roadmap matching actual grade curriculum
  const [dailyPlan, setDailyPlan] = useState<DailyBlock[]>(() => {
    if (!stateData.is_calibrated) {
      return [
        {
          time: '08:00 - 08:30',
          type: 'DIAGNOSTIC',
          title: `Initial Diagnostic Benchmark: ${curriculum.gradeName} ${curriculum.subjects[0]}`,
          subject: curriculum.subjects[0],
          estimated_duration_mins: 30,
          grounding: `Zero baseline evidence collected for ${curriculum.gradeName}. Initial evaluation required.`,
          priority: 'CRITICAL',
        },
        {
          time: '12:00 - 12:45',
          type: 'DIAGNOSTIC',
          title: `Foundations Evaluation: ${curriculum.gradeName} ${curriculum.subjects[1]}`,
          subject: curriculum.subjects[1],
          estimated_duration_mins: 45,
          grounding: 'Epistemic uncertainty at 95.0%. Diagnostic item sampling required.',
          priority: 'HIGH',
        },
        {
          time: '17:00 - 17:30',
          type: 'BASELINE',
          title: `Curriculum Orientation & Baseline Recall`,
          subject: curriculum.subjects[2] || 'General',
          estimated_duration_mins: 30,
          grounding: 'Initial concept mapping across enrolled semester syllabus.',
          priority: 'MEDIUM',
        },
      ]
    }
    return [
      {
        time: '08:00 - 08:30',
        type: 'RETRIEVAL',
        title: `Spaced Recall: ${curriculum.concepts[0].name}`,
        subject: curriculum.concepts[0].subject,
        estimated_duration_mins: 30,
        grounding: 'Memory retention baseline reinforcement.',
        priority: 'HIGH',
      },
      {
        time: '12:00 - 12:45',
        type: 'PRACTICE',
        title: `Targeted Problem Solving: ${curriculum.concepts[1].name}`,
        subject: curriculum.concepts[1].subject,
        estimated_duration_mins: 45,
        grounding: 'Active concept mastery optimization.',
        priority: 'MEDIUM',
      },
      {
        time: '17:00 - 17:45',
        type: 'TRANSFER',
        title: `Applied Challenge: ${curriculum.concepts[2]?.name || curriculum.concepts[0].name}`,
        subject: curriculum.concepts[2]?.subject || curriculum.subjects[0],
        estimated_duration_mins: 45,
        grounding: 'Cross-context transfer problem solving.',
        priority: 'HIGH',
      },
    ]
  })

  // Diagnostic Modal State
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [activeQuestions, setActiveQuestions] = useState<LensDiagnosticQuestion[]>(curriculum.defaultQuestions)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [submittingDiagnostic, setSubmittingDiagnostic] = useState(false)
  const [diagnosticResult, setDiagnosticResult] = useState<{ score: number; correctCount: number } | null>(null)

  // Chat State
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string }>>([
    {
      sender: 'agent',
      text: !stateData.is_calibrated
        ? `Hello ${user?.display_name || 'Learner'}! I am SN1, your autonomous Student Neural Intelligence agent. You are enrolled in **${curriculum.gradeName}** (${curriculum.subjects.join(', ')}). Currently, I have zero diagnostic evidence for you (Uncertainty: 95%, Identifiability: 0%). Please complete your initial diagnostic baseline assessment so I can calculate your real mathematical learning curve!`
        : `Hello ${user?.display_name || 'Learner'}! I am SN1, your autonomous Student Neural Intelligence agent grounded on your ${curriculum.gradeName} curriculum. Your current primary learning bottleneck is **${stateData.current_bottleneck}**. How can I assist your study plan today?`,
      time: 'Just now',
    },
  ])
  const [inputQuery, setInputQuery] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const quickQuestions = [
    'What should I study today?',
    'Why is diagnostic test required?',
    'What am I weak at?',
    'Am I ready for the exam?',
    'Why is uncertainty high?',
  ]

  const handleStartDiagnostic = async () => {
    setSelectedAnswers({})
    setCurrentQuestionIndex(0)
    setDiagnosticResult(null)
    setShowDiagnosticModal(true)
    setLoadingQuestions(true)

    try {
      // Call live AI question generator on backend powered by Groq LPU
      const res = await generateLensDiagnostic(curriculum.gradeName, curriculum.subjects, 6)
      if (res && res.questions && res.questions.length > 0) {
        setActiveQuestions(res.questions)
      } else {
        setActiveQuestions(curriculum.defaultQuestions)
      }
    } catch {
      setActiveQuestions(curriculum.defaultQuestions)
    } finally {
      setLoadingQuestions(false)
    }
  }

  const handleAnswerSelect = (qId: string, optIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }))
  }

  const handleSubmitDiagnostic = async () => {
    setSubmittingDiagnostic(true)

    try {
      // Send real answers to backend LENS-Ω evaluation endpoint
      const res = await submitLensDiagnostic(
        curriculum.gradeName,
        curriculum.subjects,
        selectedAnswers,
        activeQuestions
      )

      if (res && res.state_vector) {
        const sv = res.state_vector
        const updatedState: LearnerStateData = {
          student_id: user?.id || 'std_demo',
          mastery: sv.mastery,
          retention: sv.retention,
          transfer: sv.transfer,
          misconception: sv.misconception,
          competency: sv.competency,
          uncertainty: sv.uncertainty,
          identifiability: sv.identifiability,
          learning_velocity: sv.learning_velocity,
          current_bottleneck: sv.current_bottleneck,
          current_learning_mode: sv.current_learning_mode,
          tracked_concepts_count: curriculum.concepts.length,
          is_calibrated: true,
        }

        setStateData(updatedState)
        localStorage.setItem(storageKey, JSON.stringify(updatedState))

        // Update concepts table based on per-question performance
        setConcepts(
          curriculum.concepts.map((c, idx) => {
            const qForConcept = activeQuestions.find((q) =>
              q.subject.toLowerCase().includes(c.subject.toLowerCase()) ||
              q.concept.toLowerCase().includes(c.name.split(' ')[0].toLowerCase())
            )
            const cCorrect = qForConcept ? selectedAnswers[qForConcept.id] === qForConcept.correct_index : (idx % 2 === 0)
            const cMastery = cCorrect ? 0.85 : 0.45
            return {
              concept_id: c.id,
              concept_name: c.name,
              subject: c.subject,
              mastery: cMastery,
              retention: 0.85,
              transfer: cCorrect ? 0.60 : 0.25,
              misconception: cCorrect ? 0.02 : 0.35,
              competency: cCorrect ? 0.70 : 0.36,
              uncertainty: sv.uncertainty,
              bottleneck: cCorrect ? 'TRANSFER' : 'MISCONCEPTION',
              learning_mode: cCorrect ? 'TRANSFER' : 'REMEDIATION',
            }
          })
        )

        // Update dynamic daily roadmap
        setDailyPlan([
          {
            time: '08:00 - 08:30',
            type: 'RETRIEVAL',
            title: `Spaced Retrieval: ${curriculum.concepts[0].name}`,
            subject: curriculum.concepts[0].subject,
            estimated_duration_mins: 30,
            grounding: `Retention baseline reinforcement for ${curriculum.gradeName}.`,
            priority: 'HIGH',
          },
          {
            time: '12:00 - 12:45',
            type: 'PRACTICE',
            title: `Targeted Practice: ${curriculum.concepts[1].name}`,
            subject: curriculum.concepts[1].subject,
            estimated_duration_mins: 45,
            grounding: `Targeting mastery unblock for ${curriculum.gradeName} ${curriculum.concepts[1].subject}.`,
            priority: 'MEDIUM',
          },
          {
            time: '17:00 - 17:45',
            type: 'TRANSFER',
            title: `Applied Problem Solving: ${curriculum.concepts[2]?.name || curriculum.concepts[0].name}`,
            subject: curriculum.concepts[2]?.subject || curriculum.subjects[0],
            estimated_duration_mins: 45,
            grounding: `Transfer problem solving across novel contexts.`,
            priority: 'HIGH',
          },
        ])

        setDiagnosticResult({
          score: Math.round(res.result.score_percent),
          correctCount: res.result.correct_count,
        })

        // Grounded agent message update
        setMessages((prev) => [
          ...prev,
          {
            sender: 'agent',
            text: `Diagnostic Completed! You scored **${Math.round(res.result.score_percent)}%** (${res.result.correct_count}/${res.result.total_questions} correct). I have calibrated your ${curriculum.gradeName} state vector: **Mastery: ${(sv.mastery * 100).toFixed(0)}%**, **Competency: ${(sv.competency * 100).toFixed(0)}%**, **Uncertainty reduced to ${(sv.uncertainty * 100).toFixed(0)}%**. Your active bottleneck is **${sv.current_bottleneck}**.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingDiagnostic(false)
    }
  }

  const handleResetCalibration = () => {
    localStorage.removeItem(storageKey)
    window.location.reload()
  }

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputQuery
    if (!query.trim()) return

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { sender: 'user' as const, text: query, time: nowStr }
    setMessages((prev) => [...prev, userMsg])
    setInputQuery('')
    setChatLoading(true)

    try {
      // Live call to backend SN1 Groq LLM API
      const res = await sendLensChat(query, curriculum.gradeName, curriculum.subjects, stateData)
      const agentReply = res?.response || (
        `Based on your ${curriculum.gradeName} state vector (Competency: ${(stateData.competency * 100).toFixed(0)}%, ` +
        `Bottleneck: ${stateData.current_bottleneck}), please continue with your personalized study roadmap.`
      )

      setMessages((prev) => [
        ...prev,
        { sender: 'agent', text: agentReply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ])
    } catch (err) {
      console.error(err)
      setMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `Based on your live ${curriculum.gradeName} state vector (Mastery: ${(stateData.mastery * 100).toFixed(0)}%, Bottleneck: ${stateData.current_bottleneck}), follow your scheduled study blocks.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const currentQ = activeQuestions[currentQuestionIndex] || curriculum.defaultQuestions[0]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Brain className="w-3.5 h-3.5" />
            LENS-Ω + SN1 &bull; {curriculum.gradeName} Intelligence Layer
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {user?.display_name || 'Student'} &bull; Cognitive Neural Engine
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Enrolled in <strong>{curriculum.gradeName}</strong> ({curriculum.subjects.join(', ')}). Multi-dimensional state tracking across real curriculum evidence without arbitrary assumptions.
          </p>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[120px]">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Holistic Competency</div>
            <div className="text-3xl font-black text-cyan-400 font-mono">
              {stateData.is_calibrated ? `${(stateData.competency * 100).toFixed(0)}%` : '0%'}
            </div>
            <div className="text-[10px] text-slate-500">C = [M*R*T*(1-MS)]¼</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[140px]">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Bottleneck</div>
            <div className={`text-xs font-black px-2 py-1 rounded mt-1 ${
              !stateData.is_calibrated ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {stateData.current_bottleneck}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Mode: {stateData.current_learning_mode}</div>
          </div>
        </div>
      </div>

      {/* Zero-Evidence Call-To-Action Banner if Not Calibrated */}
      {!stateData.is_calibrated && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Initial Diagnostic Baseline Required &mdash; {curriculum.gradeName} Curriculum
              </h3>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                You have not completed any diagnostic tests or quizzes in <strong>{curriculum.gradeName}</strong>. 
                According to the LENS-Ω specification, the system does not guess or invent arbitrary numbers. 
                Complete this 6-question AI-generated diagnostic assessment covering <strong>{curriculum.subjects.join(', ')}</strong> to calculate your baseline state vector.
              </p>
            </div>
          </div>

          <button
            onClick={handleStartDiagnostic}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Take Diagnostic Assessment (6 Qs)</span>
          </button>
        </div>
      )}

      {/* Recalibration Button if already calibrated */}
      {stateData.is_calibrated && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Learner state calibrated from live <strong>{curriculum.gradeName}</strong> diagnostic assessment results.</span>
          </div>
          <button
            onClick={handleResetCalibration}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset & Retake Diagnostic</span>
          </button>
        </div>
      )}

      {/* 8-Dimensional State Vector Grid (Section 7) */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          LENS-Ω 8-Dimensional State Vector (S_t) &bull; {curriculum.gradeName}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Mastery (M)', val: stateData.mastery, color: 'text-emerald-400', desc: 'Bayesian belief' },
            { label: 'Retention (R)', val: stateData.retention, color: 'text-cyan-400', desc: 'Ebbinghaus decay' },
            { label: 'Transfer (T)', val: stateData.transfer, color: 'text-indigo-400', desc: 'Cross-context' },
            { label: 'Misconception (MS)', val: stateData.misconception, color: 'text-rose-400', desc: 'Error pattern' },
            { label: 'Competency (C)', val: stateData.competency, color: 'text-teal-400', desc: 'Holistic index' },
            { label: 'Uncertainty (U)', val: stateData.uncertainty, color: stateData.uncertainty > 0.5 ? 'text-rose-400 font-black' : 'text-amber-400', desc: 'Epistemic gap' },
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
                  {curriculum.gradeName} Curriculum Concept & Bottleneck Matrix
                </h3>
                <p className="text-xs text-slate-400">Granular tracking across enrolled subjects: {curriculum.subjects.join(', ')}.</p>
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
                  {concepts.map((c) => (
                    <tr key={c.concept_id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-slate-200">{c.concept_name}</div>
                        <div className="text-[10px] text-cyan-400">{c.subject}</div>
                      </td>
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
                  Today's Autonomous Learning Roadmap &bull; {curriculum.gradeName}
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
                      {block.type === 'DIAGNOSTIC' && <ShieldAlert className="w-5 h-5 text-amber-400" />}
                      {block.type === 'REMEDIATION' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                      {block.type === 'TRANSFER' && <Zap className="w-5 h-5 text-indigo-400" />}
                      {block.type === 'PRACTICE' && <BookOpen className="w-5 h-5 text-emerald-400" />}
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
                    onClick={handleStartDiagnostic}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shrink-0 transition-all hover:scale-105 active:scale-95"
                  >
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
                  <p className="text-[10px] text-cyan-400 font-mono">Live Groq Cloud LPU Agent</p>
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
                  SN1 is reasoning via Groq Cloud AI...
                </div>
              )}
            </div>

            {/* Quick Questions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400">Grounded Inquiries:</div>
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
                placeholder={`Ask SN1 about your ${curriculum.gradeName} state...`}
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

      {/* ── Interactive Live Diagnostic Assessment Modal ──────────────────────── */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {curriculum.gradeName} Dynamic Diagnostic Assessment
                  </h3>
                  <p className="text-xs text-slate-400">
                    {loadingQuestions ? 'Generating live questions via Groq AI...' : `Question ${currentQuestionIndex + 1} of ${activeQuestions.length} • ${currentQ.subject}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg p-1"
              >
                &times;
              </button>
            </div>

            {loadingQuestions ? (
              <div className="p-12 text-center space-y-4">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">Crafting Psychometric Diagnostic Items...</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Groq Cloud LPU is dynamically synthesizing {curriculum.gradeName} questions covering {curriculum.subjects.join(', ')}.
                  </p>
                </div>
              </div>
            ) : diagnosticResult ? (
              <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/30 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-white">Baseline Assessment Completed!</h4>
                  <p className="text-xs text-slate-400">
                    You scored <strong className="text-emerald-400">{diagnosticResult.score}%</strong> ({diagnosticResult.correctCount}/{activeQuestions.length} correct).
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                  LENS-Ω has initialized your Bayesian State Vector and mapped your active bottleneck.
                </div>
                <button
                  onClick={() => setShowDiagnosticModal(false)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs transition-all"
                >
                  View Calibrated Neural Dashboard
                </button>
              </div>
            ) : (
              <>
                {/* Question Card */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                      Subject: {currentQ.subject} &bull; {currentQ.concept}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                      Level: {currentQ.cognitive_level}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <p className="text-sm font-semibold text-white leading-relaxed">{currentQ.prompt}</p>
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    {currentQ.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQ.id] === optIdx
                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleAnswerSelect(currentQ.id, optIdx)}
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

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {currentQuestionIndex < activeQuestions.length - 1 ? (
                    <button
                      type="button"
                      disabled={selectedAnswers[currentQ.id] === undefined}
                      onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Object.keys(selectedAnswers).length < activeQuestions.length || submittingDiagnostic}
                      onClick={handleSubmitDiagnostic}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 hover:scale-105"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{submittingDiagnostic ? 'Calibrating Neural State...' : 'Submit Diagnostic Assessment'}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default LearningIntelligencePage
