import React, { useState } from 'react'
import {
  Brain,
  Zap,
  Clock,
  Send,
  Activity,
  ArrowRight,
  Play,
  Loader2,
  Award,
  Users,
  Search,
  AlertTriangle,
  TrendingUp,
  Target,
  Edit3,
  Sliders,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Check
} from 'lucide-react'
import {
  generateLensDrill,
  submitLensDrill,
  submitLensDiagnostic
} from '../lib/api'
import type { User, LensDrillQuestion } from '../lib/api'
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
import {
  getCohortForGrade,
  getAllSchoolStudents,
  updateStudentCognitiveProfile
} from '../lib/evidenceEngine'
import type { CohortStudentProfile } from '../lib/evidenceEngine'

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
  const isAdmin = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'
  const isStaff = isAdmin || isTeacher

  // ── STAFF (ADMIN / TEACHER) COHORT VIEW STATE ─────────────────────────────
  // Admin defaults to 0 (Entire School), Teacher defaults to 10 (Class 10)
  const [selectedClassGrade, setSelectedClassGrade] = useState<number>(isAdmin ? 0 : 10)
  const [cohortSearch, setCohortSearch] = useState('')
  const [filterBottleneck, setFilterBottleneck] = useState<string>('ALL')
  const [filterRisk, setFilterRisk] = useState<string>('ALL')
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<CohortStudentProfile | null>(null)

  // Admin Profile Edit Modal State
  const [editingStudent, setEditingStudent] = useState<CohortStudentProfile | null>(null)
  const [editRiskLevel, setEditRiskLevel] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('LOW')
  const [editBottleneck, setEditBottleneck] = useState<string>('BALANCED')
  const [editCompetencyPercent, setEditCompetencyPercent] = useState<number>(75)
  const [editMasteryPercent, setEditMasteryPercent] = useState<number>(75)
  const [editNotes, setEditNotes] = useState<string>('')
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)

  const [cohortData, setCohortData] = useState<CohortStudentProfile[]>(() => {
    if (isAdmin) {
      return getAllSchoolStudents()
    }
    return getCohortForGrade(10)
  })

  const refreshStaffData = (gradeNum: number) => {
    if (isAdmin) {
      if (gradeNum === 0) {
        setCohortData(getAllSchoolStudents())
      } else {
        setCohortData(getCohortForGrade(gradeNum))
      }
    } else {
      setCohortData(getCohortForGrade(gradeNum))
    }
  }

  const handleClassSwitch = (gradeNum: number) => {
    setSelectedClassGrade(gradeNum)
    refreshStaffData(gradeNum)
    setSelectedStudentForModal(null)
  }

  // Open Edit Modal for Admin
  const handleOpenEditModal = (student: CohortStudentProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingStudent(student)
    setEditRiskLevel(student.risk_level)
    setEditBottleneck(student.state.primary_bottleneck)
    setEditCompetencyPercent(Math.round(student.state.overall_competency * 100))
    setEditMasteryPercent(Math.round(student.state.overall_mastery * 100))
    setEditNotes(student.admin_override?.notes || '')
    setSaveSuccessMessage(null)
  }

  // Save Admin Cognitive Profile Edit
  const handleSaveAdminOverride = () => {
    if (!editingStudent) return
    updateStudentCognitiveProfile(editingStudent.student_id, editingStudent.grade_number, {
      risk_level: editRiskLevel,
      bottleneck: editBottleneck,
      competency_percent: editCompetencyPercent,
      mastery_percent: editMasteryPercent,
      notes: editNotes,
    })

    // Refresh data in view
    refreshStaffData(selectedClassGrade)

    setSaveSuccessMessage(`Successfully updated and saved cognitive profile for ${editingStudent.student_name}.`)
    setTimeout(() => {
      setEditingStudent(null)
      setSaveSuccessMessage(null)
    }, 1200)
  }

  // ── STUDENT VIEW STATE ───────────────────────────────────────────────────
  const userGradeMatch = user?.display_name?.match(/Class\s*(\d+)/i) || user?.display_name?.match(/(\d+)/)
  const gradeNumber = userGradeMatch ? parseInt(userGradeMatch[1], 10) : 4
  const storageKey = `lens_granular_v3_${user?.id || 'demo'}_grade_${gradeNumber}`

  const [neuralState, setNeuralState] = useState<FullStudentNeuralState>(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error(e)
      }
    }
    return initializeCurriculumStructure(gradeNumber, user?.id || 'demo_student', user?.display_name || 'Student')
  })

  const [activeSubjectTab, setActiveSubjectTab] = useState<string>('All Subjects')
  const [benchmarkModalOpen, setBenchmarkModalOpen] = useState(false)
  const [activeTestSubject, setActiveTestSubject] = useState<string>('')
  const [questions, setQuestions] = useState<SubjectQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [testSubmitting, setTestSubmitting] = useState(false)
  const [testSummary, setTestSummary] = useState<any>(null)

  // Interactive Drill Modal State
  const [drillModalOpen, setDrillModalOpen] = useState(false)
  const [activeDrillConcept, setActiveDrillConcept] = useState<ConceptEvidence | null>(null)
  const [drillQuestions, setDrillQuestions] = useState<LensDrillQuestion[]>([])
  const [drillAnswers, setDrillAnswers] = useState<Record<string, number>>({})
  const [drillSubmitting, setDrillSubmitting] = useState(false)
  const [drillResult, setDrillResult] = useState<any>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  // Chat State
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string }>>([
    {
      sender: 'agent',
      text: `Hello ${user?.display_name || 'Learner'}! I am your Autonomous Learning Agent. Ask me about your study plan, learning bottlenecks, or exam preparation!`,
      time: 'Just now',
    },
  ])
  const [chatLoading, setChatLoading] = useState(false)
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const subjectList = Object.keys(neuralState.subjects)

  // Staff Cohort Analytics calculations
  const classAvgCompetency = Math.round(
    (cohortData.reduce((acc, s) => acc + s.state.overall_competency, 0) / Math.max(1, cohortData.length)) * 100
  )
  const classAvgMastery = Math.round(
    (cohortData.reduce((acc, s) => acc + s.state.overall_mastery, 0) / Math.max(1, cohortData.length)) * 100
  )
  const misconceptionCount = cohortData.filter((s) => s.state.primary_bottleneck === 'MISCONCEPTION').length
  const retrievalCount = cohortData.filter((s) => s.state.primary_bottleneck === 'RETRIEVAL_DECAY').length
  const transferCount = cohortData.filter((s) => s.state.primary_bottleneck === 'TRANSFER_DEFICIT').length
  const balancedCount = cohortData.filter((s) => s.state.primary_bottleneck === 'BALANCED').length
  const highRiskCount = cohortData.filter((s) => s.risk_level === 'HIGH').length
  const overriddenCount = cohortData.filter((s) => !!s.admin_override).length

  const filteredCohort = cohortData.filter((s) => {
    const matchesName =
      s.student_name.toLowerCase().includes(cohortSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(cohortSearch.toLowerCase())
    const matchesBottleneck = filterBottleneck === 'ALL' || s.state.primary_bottleneck === filterBottleneck
    const matchesRisk = filterRisk === 'ALL' || s.risk_level === filterRisk
    return matchesName && matchesBottleneck && matchesRisk
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // STAFF PORTAL: ADMIN (WHOLE SCHOOL) / TEACHER COGNITIVE COHORT RADAR
  // ═══════════════════════════════════════════════════════════════════════════
  if (isStaff) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
          <div className="space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5" />
              {isAdmin
                ? 'School Administrator • Whole-School Cognitive Intelligence'
                : 'Teacher Cognitive Intelligence • Multi-Class Student Radar'}
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              {isAdmin ? 'School-Wide Cognitive Health & Learning Curve Radar' : 'Class Cognitive Health & Telemetry'}
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              {isAdmin
                ? 'Comprehensive learning curves and psychometric state vectors for all students across the entire institution (Class 1 to Class 12). Inspect bottlenecks, monitor cognitive baselines, and administratively edit student risk evaluations.'
                : 'Real-time psychometric state vectors across your assigned classes (Class 10, Class 7, Class 4). Monitor Bayesian mastery, isolate error misconceptions, and deploy class-wide unblocking interventions.'}
            </p>
          </div>

          {/* Class Grade Switcher */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 relative z-10">
            {isAdmin && (
              <button
                onClick={() => handleClassSwitch(0)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedClassGrade === 0
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>All School</span>
              </button>
            )}

            {[10, 7, 4].map((gNum) => (
              <button
                key={gNum}
                onClick={() => handleClassSwitch(gNum)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedClassGrade === gNum
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Class {gNum}
              </button>
            ))}

            {isAdmin && (
              <select
                value={selectedClassGrade > 0 && ![10, 7, 4].includes(selectedClassGrade) ? selectedClassGrade : ''}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (val) handleClassSwitch(val)
                }}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Other Grades...</option>
                {[1, 2, 3, 5, 6, 8, 9, 11, 12].map((g) => (
                  <option key={g} value={g}>
                    Class {g}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Macro Telemetry Metric Cards ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>Students Evaluated</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-cyan-400 font-mono">{cohortData.length}</div>
            <div className="text-[11px] text-slate-500">
              {selectedClassGrade === 0 ? 'Across Entire School' : `Enrolled in Class ${selectedClassGrade}`}
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>Mean Competency</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-cyan-400 font-mono">{classAvgCompetency}%</div>
            <div className="text-[11px] text-slate-500">Global C Index</div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>Bayesian Mastery</span>
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400 font-mono">{classAvgMastery}%</div>
            <div className="text-[11px] text-slate-500">Average Knowledge Density</div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>High Risk Students</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-black text-rose-400 font-mono">{highRiskCount}</div>
            <div className="text-[11px] text-slate-500">Require Direct Intervention</div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
              <span>Active Misconceptions</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-400 font-mono">{misconceptionCount}</div>
            <div className="text-[11px] text-slate-500">
              {isAdmin ? `${overriddenCount} Admin Overrides Active` : 'Cognitive Deficiencies'}
            </div>
          </div>
        </div>

        {/* ── Student Cohort Directory & Cognitive Radar ───────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                {isAdmin && selectedClassGrade === 0
                  ? 'All-School Student Cognitive Directory (All Grades)'
                  : `Class ${selectedClassGrade} Student Cognitive Directory`}
              </h2>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? 'As an Administrator, you can inspect each student and edit their cognitive risk level, bottleneck status, or competency baseline.'
                  : 'Click on any student to inspect their granular Bayesian concept radar and active learning roadmaps.'}
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={cohortSearch}
                  onChange={(e) => setCohortSearch(e.target.value)}
                  placeholder="Search student or email..."
                  className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="HIGH">High Risk ({highRiskCount})</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="LOW">Low Risk</option>
              </select>

              <select
                value={filterBottleneck}
                onChange={(e) => setFilterBottleneck(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Bottlenecks</option>
                <option value="MISCONCEPTION">Misconceptions ({misconceptionCount})</option>
                <option value="RETRIEVAL_DECAY">Memory Decay ({retrievalCount})</option>
                <option value="TRANSFER_DEFICIT">Transfer Deficit ({transferCount})</option>
                <option value="BALANCED">Balanced ({balancedCount})</option>
              </select>
            </div>
          </div>

          {/* Student Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCohort.map((student) => {
              const compPercent = Math.round(student.state.overall_competency * 100)
              const mastPercent = Math.round(student.state.overall_mastery * 100)
              const bColor =
                student.state.primary_bottleneck === 'MISCONCEPTION'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : student.state.primary_bottleneck === 'RETRIEVAL_DECAY'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : student.state.primary_bottleneck === 'TRANSFER_DEFICIT'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'

              return (
                <div
                  key={student.student_id}
                  onClick={() => setSelectedStudentForModal(student)}
                  className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-xl group hover:scale-[1.02] relative"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${student.avatar_color} text-white font-bold flex items-center justify-center shadow`}
                        >
                          {student.student_name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                            {student.student_name}
                          </h4>
                          <span className="text-[10px] text-cyan-400 font-mono font-bold">{student.grade_name}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          student.risk_level === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : student.risk_level === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {student.risk_level} RISK
                      </span>
                    </div>

                    {student.admin_override && (
                      <div className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px] text-indigo-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-indigo-400" />
                        <span className="font-semibold">Admin Override Applied</span>
                      </div>
                    )}

                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Competency:</span>
                        <span className="font-mono font-bold text-cyan-400">{compPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full rounded-full transition-all"
                          style={{ width: `${compPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-500">Mastery:</span>
                        <span className="font-mono text-emerald-400">{mastPercent}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Bottleneck:</span>
                      <span className={`px-2 py-0.5 rounded border font-semibold ${bColor}`}>
                        {student.state.primary_bottleneck}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={(e) => handleOpenEditModal(student, e)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <div className="flex items-center text-xs text-cyan-400 font-bold group-hover:translate-x-1 transition-transform">
                          <span>Radar</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-cyan-400 font-bold group-hover:translate-x-1 transition-transform w-full">
                        <span>Inspect Neural Radar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── ADMIN EDIT COGNITIVE PROFILE MODAL ──────────────────────────────── */}
        {editingStudent && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Edit Student Cognitive Profile</h3>
                    <p className="text-xs text-slate-400">
                      {editingStudent.student_name} &bull; {editingStudent.grade_name} ({editingStudent.email})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingStudent(null)}
                  className="text-slate-400 hover:text-white text-2xl font-bold p-1"
                >
                  &times;
                </button>
              </div>

              {saveSuccessMessage && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* Risk Level Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Administrative Risk Classification:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEditRiskLevel(lvl)}
                        className={`py-2 rounded-xl font-bold border transition-all ${
                          editRiskLevel === lvl
                            ? lvl === 'HIGH'
                              ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow'
                              : lvl === 'MEDIUM'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow'
                              : 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {lvl} RISK
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Bottleneck Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Primary Learning Bottleneck:</label>
                  <select
                    value={editBottleneck}
                    onChange={(e) => setEditBottleneck(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="BALANCED">BALANCED (Steady learning progression)</option>
                    <option value="MISCONCEPTION">MISCONCEPTION (Systemic error reversal needed)</option>
                    <option value="RETRIEVAL_DECAY">RETRIEVAL_DECAY (Memory decay / recall deficiency)</option>
                    <option value="TRANSFER_DEFICIT">TRANSFER_DEFICIT (Difficulty applying knowledge to new problems)</option>
                    <option value="INSUFFICIENT_EVIDENCE">INSUFFICIENT_EVIDENCE (Requires diagnostic benchmark)</option>
                  </select>
                </div>

                {/* Competency Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-300">Competency Baseline ($C$ Index):</label>
                    <span className="font-mono text-cyan-400 font-bold text-sm">{editCompetencyPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={editCompetencyPercent}
                    onChange={(e) => setEditCompetencyPercent(Number(e.target.value))}
                    className="w-full accent-cyan-500 bg-slate-950 cursor-pointer"
                  />
                </div>

                {/* Mastery Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-300">Bayesian Knowledge Density ($M$ Index):</label>
                    <span className="font-mono text-emerald-400 font-bold text-sm">{editMasteryPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={editMasteryPercent}
                    onChange={(e) => setEditMasteryPercent(Number(e.target.value))}
                    className="w-full accent-emerald-500 bg-slate-950 cursor-pointer"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Administrative Override Rationale / Notes:</label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Risk level adjusted following remedial clinic and 1-on-1 counselor evaluation..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdminOverride}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Apply Override</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Deep Student Neural State Radar Modal ────────────────────────────── */}
        {selectedStudentForModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${selectedStudentForModal.avatar_color} text-white font-extrabold flex items-center justify-center text-lg shadow-lg`}
                  >
                    {selectedStudentForModal.student_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {selectedStudentForModal.student_name}
                      <span className="text-xs font-mono font-normal text-cyan-400">
                        ({selectedStudentForModal.email})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedStudentForModal.grade_name} &bull; Primary Bottleneck:{' '}
                      <strong className="text-cyan-300">{selectedStudentForModal.state.primary_bottleneck}</strong> &bull; Total Evidence Events:{' '}
                      {selectedStudentForModal.recent_events_count}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudentForModal(null)}
                  className="text-slate-400 hover:text-white text-2xl font-bold p-1"
                >
                  &times;
                </button>
              </div>

              {selectedStudentForModal.admin_override && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-xs text-indigo-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>Administrator Override in Effect</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {selectedStudentForModal.admin_override.notes || 'Manually reviewed and adjusted by School Administrator.'}
                  </p>
                </div>
              )}

              {/* Subject Breakdowns */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  Subject-Wise Bayesian State Breakdown
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.values(selectedStudentForModal.state.subjects).map((subj) => (
                    <div key={subj.subject} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{subj.subject}</span>
                        <span className="font-mono text-cyan-400 text-xs font-bold">
                          {Math.round(subj.overall_competency * 100)}% C
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {subj.concepts.map((c) => (
                          <div
                            key={c.concept_id}
                            className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                          >
                            <span className="text-slate-300 truncate max-w-[180px]">{c.concept_name}</span>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-emerald-400">{Math.round(c.mastery * 100)}% M</span>
                              <span className="text-slate-500">|</span>
                              <span className="text-cyan-400">{Math.round(c.competency * 100)}% C</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                {isAdmin && (
                  <button
                    onClick={() => {
                      const s = selectedStudentForModal
                      setSelectedStudentForModal(null)
                      handleOpenEditModal(s)
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold text-xs flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Cognitive Profile</span>
                  </button>
                )}
                {isTeacher && (
                  <button
                    onClick={() => {
                      alert(`Targeted unblocking assignment dispatched to ${selectedStudentForModal.student_name}!`)
                      setSelectedStudentForModal(null)
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Assign Targeted Remediation Drill</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STUDENT PERSONAL LEARNING INTELLIGENCE VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const displayedConcepts = React.useMemo(() => {
    if (activeSubjectTab === 'All Subjects') {
      return Object.values(neuralState.subjects).flatMap((s) => s.concepts)
    }
    return neuralState.subjects[activeSubjectTab]?.concepts || []
  }, [neuralState, activeSubjectTab])

  const currentQ = questions[qIndex]

  // Launch Subject Benchmark Test
  const handleStartSubjectBenchmark = async (subjectName: string) => {
    setActiveTestSubject(subjectName)
    setSelectedAnswers({})
    setQIndex(0)
    setTestSummary(null)
    setBenchmarkModalOpen(true)
    setLoadingQuestions(true)

    try {
      const qList = await fetchSubjectBenchmarkQuestions(neuralState.grade_name, subjectName, 6)
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

    currentSubjectState.concepts.forEach((c) => {
      conceptStats[c.concept_id] = { correct: 0, total: 0, diffSum: 0, misconceptions: [] }
    })

    questions.forEach((q) => {
      const isCorrect = selectedAnswers[q.id] === q.correct_index
      if (isCorrect) totalCorrect++

      const cId = q.concept_id
      if (conceptStats[cId]) {
        conceptStats[cId].total += 1
        conceptStats[cId].diffSum += q.difficulty
        if (isCorrect) {
          conceptStats[cId].correct += 1
        } else if (q.misconception_tag) {
          conceptStats[cId].misconceptions.push(q.misconception_tag)
        }
      }
    })

    const totalQuestions = questions.length
    const overallScoreRatio = totalQuestions > 0 ? totalCorrect / totalQuestions : 0

    // Calibrate each concept in this subject individually
    const updatedConcepts: ConceptEvidence[] = currentSubjectState.concepts.map((c) => {
      const s = conceptStats[c.concept_id]
      if (!s || s.total === 0) return c

      const conceptScoreRatio = s.correct / s.total
      const avgDiff = s.diffSum / s.total
      const prevM = c.mastery > 0 ? c.mastery : 0.20
      const newM = computeBayesianMastery(prevM, conceptScoreRatio, avgDiff, true)
      const newR = Math.min(1.0, 0.85 + (conceptScoreRatio >= 0.7 ? 0.08 : -0.15))
      const newT = Math.min(1.0, 0.40 + conceptScoreRatio * 0.45)
      const newMS = s.misconceptions.length > 0 ? 0.35 : Math.max(0.01, c.misconception * 0.7)
      const newAttempts = c.attempts_count + s.total
      const newCorrect = c.correct_count + s.correct
      const newU = computeUncertainty(newAttempts)
      const newI = Math.min(1.0, 0.50 + newAttempts * 0.08)
      const newC = computeCompetency(newM, newR, newT, newMS)
      const { bottleneck, mode } = classifyBottleneck(newM, newR, newT, newMS, newU, newI)

      const mergedMisconceptions = Array.from(new Set([...c.active_misconceptions, ...s.misconceptions]))

      return {
        ...c,
        attempts_count: newAttempts,
        correct_count: newCorrect,
        mastery: Number(newM.toFixed(4)),
        retention: Number(newR.toFixed(4)),
        transfer: Number(newT.toFixed(4)),
        misconception: Number(newMS.toFixed(4)),
        competency: Number(newC.toFixed(4)),
        uncertainty: Number(newU.toFixed(4)),
        identifiability: Number(newI.toFixed(4)),
        bottleneck: bottleneck as any,
        learning_mode: mode as any,
        active_misconceptions: mergedMisconceptions,
        last_updated: new Date().toISOString(),
      }
    })

    const avgMastery = updatedConcepts.reduce((acc, c) => acc + c.mastery, 0) / updatedConcepts.length
    const avgCompetency = updatedConcepts.reduce((acc, c) => acc + c.competency, 0) / updatedConcepts.length
    const avgUncertainty = updatedConcepts.reduce((acc, c) => acc + c.uncertainty, 0) / updatedConcepts.length
    const { bottleneck: subjBottleneck, mode: subjMode } = classifyBottleneck(
      avgMastery,
      0.85,
      0.60,
      0.05,
      avgUncertainty,
      0.80
    )

    const updatedSubject: SubjectBenchmarkState = {
      ...currentSubjectState,
      is_calibrated: true,
      benchmark_score_percent: Math.round(overallScoreRatio * 100),
      overall_mastery: Number(avgMastery.toFixed(4)),
      overall_competency: Number(avgCompetency.toFixed(4)),
      overall_uncertainty: Number(avgUncertainty.toFixed(4)),
      active_bottleneck: subjBottleneck,
      active_mode: subjMode,
      concepts: updatedConcepts,
      last_assessed: new Date().toISOString(),
    }

    // Persist to backend database
    submitLensDiagnostic(
      neuralState.grade_name,
      [activeTestSubject],
      selectedAnswers,
      questions as any
    ).catch((e: any) => console.warn('Diagnostic backend calibration sync:', e))

    const nextSubjects = { ...neuralState.subjects, [activeTestSubject]: updatedSubject }
    const allSubjects = Object.values(nextSubjects)
    const calibratedSubjs = allSubjects.filter((s) => s.is_calibrated)
    const globalCompetency =
      calibratedSubjs.length > 0
        ? calibratedSubjs.reduce((acc, s) => acc + s.overall_competency, 0) / calibratedSubjs.length
        : 0
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
  }


  // ── DYNAMIC INTERACTIVE CONCEPT DRILL HANDLERS ────────────────────────────
  const handleStartPracticeDrill = async (concept: ConceptEvidence) => {
    setActiveDrillConcept(concept)
    setDrillAnswers({})
    setDrillResult(null)
    setDrillModalOpen(true)
    setDrillLoading(true)

    try {
      const res = await generateLensDrill(
        neuralState.grade_name,
        concept.subject,
        concept.concept_id,
        concept.concept_name,
        2
      )
      if (res && res.questions && res.questions.length > 0) {
        setDrillQuestions(res.questions)
      } else {
        setDrillQuestions([
          {
            id: `d_${concept.concept_id}_1`,
            prompt: `What is the core prerequisite principle for mastering ${concept.concept_name} in ${concept.subject}?`,
            options: [
              `Consistent validation of boundary conditions and foundational axioms of ${concept.concept_name}`,
              'Applying random heuristic guesses without formula validation',
              'Skipping conceptual definitions',
              'Ignoring dimensional constants'
            ],
            correct_index: 0,
            difficulty: 0.40,
            explanation: `Foundational analytical clarity is the primary requirement for mastering ${concept.concept_name}.`
          },
          {
            id: `d_${concept.concept_id}_2`,
            prompt: `Which real-world application directly relies on ${concept.concept_name}?`,
            options: [
              `Modeling physical state transitions and quantitative calculations in ${concept.subject}`,
              'Arbitrary non-deterministic approximations',
              'Disregarding conservation laws',
              'Ignoring dimensional balance'
            ],
            correct_index: 0,
            difficulty: 0.50,
            explanation: `${concept.concept_name} governs the exact physical and mathematical relationships.`
          }
        ])
      }
    } catch (err) {
      console.warn('Drill load fallback:', err)
    } finally {
      setDrillLoading(false)
    }
  }

  const handleSubmitPracticeDrill = async () => {
    if (!activeDrillConcept || drillQuestions.length === 0) return
    setDrillSubmitting(true)

    try {
      const payload = {
        concept_id: activeDrillConcept.concept_id,
        concept_name: activeDrillConcept.concept_name,
        subject: activeDrillConcept.subject,
        grade_name: neuralState.grade_name,
        answers: drillAnswers,
        questions: drillQuestions,
        current_mastery: activeDrillConcept.mastery,
        current_retention: activeDrillConcept.retention,
        current_attempts: activeDrillConcept.attempts_count,
        current_correct: activeDrillConcept.correct_count
      }

      const res = await submitLensDrill(payload)
      if (res && res.updated_state) {
        const u = res.updated_state
        const subjName = activeDrillConcept.subject
        const curSubj = neuralState.subjects[subjName]

        if (curSubj) {
          const updatedConcepts = curSubj.concepts.map((c) =>
            c.concept_id === activeDrillConcept.concept_id
              ? {
                  ...c,
                  attempts_count: u.attempts_count,
                  correct_count: u.correct_count,
                  mastery: u.mastery,
                  retention: u.retention,
                  transfer: u.transfer,
                  misconception: u.misconception,
                  competency: u.competency,
                  uncertainty: u.uncertainty,
                  identifiability: u.identifiability,
                  bottleneck: u.bottleneck,
                  learning_mode: u.learning_mode,
                  last_updated: 'Just now'
                }
              : c
          )

          const avgM = updatedConcepts.reduce((acc, c) => acc + c.mastery, 0) / updatedConcepts.length
          const avgC = updatedConcepts.reduce((acc, c) => acc + c.competency, 0) / updatedConcepts.length

          const updatedSubj: SubjectBenchmarkState = {
            ...curSubj,
            is_calibrated: true,
            overall_mastery: Number(avgM.toFixed(4)),
            overall_competency: Number(avgC.toFixed(4)),
            concepts: updatedConcepts
          }

          const nextSubjects = { ...neuralState.subjects, [subjName]: updatedSubj }
          const nextFull: FullStudentNeuralState = {
            ...neuralState,
            subjects: nextSubjects,
            total_evidence_events: neuralState.total_evidence_events + drillQuestions.length
          }

          setNeuralState(nextFull)
          localStorage.setItem(storageKey, JSON.stringify(nextFull))
        }

        setDrillResult({
          scorePercent: res.score_percent,
          correctCount: res.correct_count,
          totalCount: res.total_questions,
          newMastery: Math.round(u.mastery * 100),
          newRetention: Math.round(u.retention * 100),
          conceptName: activeDrillConcept.concept_name
        })
      }
    } catch (err) {
      console.error('Submit drill error:', err)
    } finally {
      setDrillSubmitting(false)
    }
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
        {
          sender: 'agent',
          text: agentReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setHistory([...updatedHistory, { role: 'assistant', content: agentReply }])
    } catch (err) {
      console.error(err)
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `Grounded in your live ${neuralState.grade_name} neural state vector across ${subjectList.join(', ')}, your primary bottleneck is ${neuralState.primary_bottleneck}. Please follow today's scheduled roadmap blocks.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Brain className="w-3.5 h-3.5" />
            LENS-Ω + SN1 &bull; {neuralState.grade_name} Granular Multi-Subject Graph
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {user?.display_name || 'Student'} &bull; Cognitive Neural Engine
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Enrolled in <strong>{neuralState.grade_name}</strong> ({subjectList.join(', ')}). Psychometric state
            estimation tracking each subject individually with Bayesian updates.
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
            <div
              className={`text-xs font-black px-2 py-1 rounded mt-1 ${
                neuralState.primary_bottleneck === 'INSUFFICIENT_EVIDENCE'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {neuralState.primary_bottleneck}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Events: {neuralState.total_evidence_events}</div>
          </div>
        </div>
      </div>

      {/* ── Subject-Wise Benchmark Assessment Hub ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Subject-Wise Benchmark Assessment Hub &bull; {neuralState.grade_name}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subjectList.map((subjName) => {
            const subj = neuralState.subjects[subjName]
            const isTaken = subj.is_calibrated
            const scorePct = subj.benchmark_score_percent ?? Math.round(subj.overall_competency * 100)

            return (
              <div
                key={subjName}
                className={`p-5 rounded-3xl border flex flex-col justify-between space-y-4 shadow-xl transition-all ${
                  isTaken
                    ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-500/5'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{subjName}</span>
                    {isTaken ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Already Completed</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Pending Test
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-2xl font-black text-cyan-400 font-mono">
                        {Math.round(subj.overall_competency * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-400">Bayesian Competency</div>
                    </div>
                    {isTaken && (
                      <div className="text-right">
                        <div className="text-sm font-black text-emerald-400 font-mono">
                          {scorePct}% Score
                        </div>
                        <div className="text-[10px] text-slate-400">Diagnostic Result</div>
                      </div>
                    )}
                  </div>

                  {isTaken && (
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] flex items-center justify-between text-slate-300">
                      <span>Neural Status:</span>
                      <span className="font-mono text-cyan-300 font-bold uppercase">{subj.active_bottleneck}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleStartSubjectBenchmark(subjName)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                    isTaken
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-extrabold shadow-cyan-500/20'
                  }`}
                >
                  {isTaken ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Retake Benchmark Test</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Benchmark Test</span>
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Subject Granular Concepts Matrix ───────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Granular Concept-Level Knowledge Tracing Matrix
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {['All Subjects', ...subjectList].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubjectTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeSubjectTab === tab
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedConcepts.map((concept) => (
            <div key={concept.concept_id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-400">{concept.subject}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                  {concept.learning_mode}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white line-clamp-1">{concept.concept_name}</h4>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Mastery:</span>
                <span className="font-mono text-emerald-400 font-bold">{Math.round(concept.mastery * 100)}%</span>
              </div>
              <button
                onClick={() => handleStartPracticeDrill(concept)}
                className="w-full py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start Practice Drill</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Interactive SN1 AI Assistant Chat ─────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-400" />
          Interactive Learning Agent Assistant (SN1 LangGraph)
        </h3>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`p-3 rounded-2xl max-w-lg text-xs ${
                  msg.sender === 'user'
                    ? 'bg-cyan-500 text-slate-950 font-medium'
                    : 'bg-slate-950 border border-slate-800 text-slate-200'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder="Ask your learning agent a question..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => handleSendChat()}
            disabled={chatLoading}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
          >
            {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* ── Subject Benchmark Test Modal ────────────────────────────────────── */}
      {benchmarkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Benchmark: {activeTestSubject}</h3>
                <p className="text-xs text-slate-400">
                  {testSummary ? 'Diagnostic Complete' : `Question ${qIndex + 1} of ${questions.length}`}
                </p>
              </div>
              <button onClick={() => setBenchmarkModalOpen(false)} className="text-slate-400 hover:text-white text-xl">
                &times;
              </button>
            </div>

            {loadingQuestions ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
                <p>Generating psychometrically calibrated benchmark items...</p>
              </div>
            ) : testSummary ? (
              <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/30 text-center space-y-4">
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  Score: {testSummary.scorePercent}% ({testSummary.correctCount}/{testSummary.totalCount})
                </div>
                <p className="text-xs text-slate-300">
                  Bayesian state vectors calibrated for all concepts under {testSummary.subject}.
                </p>
                <button
                  onClick={() => setBenchmarkModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                >
                  Close & View Updated Matrix
                </button>
              </div>
            ) : currentQ ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <p className="text-sm font-semibold text-white">{currentQ.prompt}</p>
                </div>

                <div className="space-y-2">
                  {currentQ.options.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optIdx }))}
                      className={`w-full p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                        selectedAnswers[currentQ.id] === optIdx
                          ? 'bg-cyan-500/20 border-cyan-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    disabled={qIndex === 0}
                    onClick={() => setQIndex((prev) => prev - 1)}
                    className="text-xs text-slate-400 hover:text-white disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {qIndex < questions.length - 1 ? (
                    <button
                      disabled={selectedAnswers[currentQ.id] === undefined}
                      onClick={() => setQIndex((prev) => prev + 1)}
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      disabled={testSubmitting}
                      onClick={handleSubmitBenchmark}
                      className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      {testSubmitting ? 'Calibrating...' : 'Submit Benchmark'}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Interactive Practice Drill Modal (Dynamic & Bayesian Calibrated) ────────────────── */}
      {drillModalOpen && activeDrillConcept && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{activeDrillConcept.subject} &bull; Practice Drill</span>
                <h3 className="font-bold text-white text-base">{activeDrillConcept.concept_name}</h3>
              </div>
              <button onClick={() => setDrillModalOpen(false)} className="text-slate-400 hover:text-white text-xl">
                &times;
              </button>
            </div>

            {drillLoading ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
                <p>Generating psychometric conceptual drill items for {activeDrillConcept.concept_name}...</p>
              </div>
            ) : drillResult ? (
              <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/30 text-center space-y-4 animate-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white">Drill Complete: {drillResult.conceptName}</h4>
                  <p className="text-xs text-emerald-400 font-mono font-bold mt-1">
                    Score: {drillResult.scorePercent}% ({drillResult.correctCount}/{drillResult.totalCount} Correct)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400">New Mastery:</span>
                    <div className="text-base font-black text-cyan-400 font-mono">{drillResult.newMastery}%</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Memory Retention:</span>
                    <div className="text-base font-black text-emerald-400 font-mono">{drillResult.newRetention}%</div>
                  </div>
                </div>
                <button
                  onClick={() => setDrillModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                >
                  Save & Return to Knowledge Matrix
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {drillQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-cyan-400">Question {idx + 1} of {drillQuestions.length}</span>
                      <span className="font-mono">Difficulty: {(q.difficulty * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-xs font-semibold text-white">{q.prompt}</p>

                    <div className="space-y-1.5 pt-1">
                      {q.options.map((opt: string, optIdx: number) => (
                        <button
                          key={optIdx}
                          onClick={() => setDrillAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                            drillAnswers[q.id] === optIdx
                              ? 'bg-cyan-500/20 border-cyan-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  disabled={drillSubmitting || Object.keys(drillAnswers).length < drillQuestions.length}
                  onClick={handleSubmitPracticeDrill}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-black text-xs disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {drillSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Calibrating Neural Engine...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Submit Practice Drill & Calibrate Node</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default LearningIntelligencePage
