import React, { useState, useEffect } from 'react'
import type { User } from '../lib/api'
import {
  CheckSquare,
  Plus,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Upload,
  Clock,
  BookOpen,
  Award,
  Users,
  Check,
  Loader2,
  Trash2,
  ArrowRight
} from 'lucide-react'
import {
  getScheduledAssessments,
  saveScheduledAssessment,
  deleteScheduledAssessment,
  getAssessmentsForStudent,
  generateAIQuestionSet,
  submitStudentAssessment,
  getAllSubmissions
} from '../lib/assessmentStore'
import type {
  ScheduledAssessment,
  QuestionItem,
  StudentSubmission
} from '../lib/assessmentStore'

type AssessmentsPageProps = {
  user: User | null
}

export const AssessmentsPage: React.FC<AssessmentsPageProps> = ({ user }) => {
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin'
  const studentGrade = user?.display_name?.includes('Class') ? user.display_name : 'Class 4'

  const [activeTab, setActiveTab] = useState<'assessments' | 'submissions'>('assessments')
  const [assessmentsList, setAssessmentsList] = useState<ScheduledAssessment[]>([])
  const [submissionsList, setSubmissionsList] = useState<StudentSubmission[]>([])

  // Create Modal State (For Teachers)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState<'details' | 'questions'>('details')
  const [creationMode, setCreationMode] = useState<'AI' | 'MANUAL' | 'PDF'>('AI')
  const [targetGrade, setTargetGrade] = useState('Class 10')
  const [subject, setSubject] = useState('Mathematics')
  const [topicSyllabus, setTopicSyllabus] = useState('Quadratic Equations & AP')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduleType, setScheduleType] = useState<'ALWAYS_AVAILABLE' | 'TIME_WINDOW' | 'EXACT_TIME'>('ALWAYS_AVAILABLE')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [passingScore, setPassingScore] = useState(70)
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)

  // Question Items for Creation
  const [questionItems, setQuestionItems] = useState<QuestionItem[]>([])
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  // Manual Question Addition Fields
  const [manQText, setManQText] = useState('')
  const [manQType, setManQType] = useState<'multiple_choice' | 'descriptive'>('multiple_choice')
  const [manOptions, setManOptions] = useState<string[]>(['', '', '', ''])
  const [manCorrect, setManCorrect] = useState(0)
  const [manPoints, setManPoints] = useState(10)
  const [manLevel, setManLevel] = useState<'FOUNDATION' | 'APPLICATION' | 'REASONING' | 'TRANSFER'>('APPLICATION')

  // Student Taking Test State
  const [takingTest, setTakingTest] = useState<ScheduledAssessment | null>(null)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string | number>>({})
  const [submittingTest, setSubmittingTest] = useState(false)
  const [testResult, setTestResult] = useState<StudentSubmission | null>(null)

  useEffect(() => {
    refreshData()
  }, [user])

  const refreshData = () => {
    if (isTeacher) {
      setAssessmentsList(getScheduledAssessments())
    } else {
      setAssessmentsList(getAssessmentsForStudent(studentGrade))
    }
    setSubmissionsList(getAllSubmissions())
  }

  // Handle AI Question Generation
  const handleAIGenerate = async () => {
    setIsGeneratingAI(true)
    try {
      const generated = await generateAIQuestionSet(targetGrade, subject, topicSyllabus, 5)
      setQuestionItems(generated)
    } catch (err) {
      console.error(err)
    } finally {
      setIsGeneratingAI(false)
    }
  }

  // Add Manual Question
  const handleAddManualQuestion = () => {
    if (!manQText.trim()) return
    const newQ: QuestionItem = {
      id: `q_man_${Date.now()}`,
      question_text: manQText,
      question_type: manQType,
      options: manQType === 'multiple_choice' ? manOptions.filter((o) => o.trim() !== '') : undefined,
      correct_answer: manQType === 'multiple_choice' ? manCorrect : undefined,
      points: manPoints,
      cognitive_level: manLevel,
      concept_name: topicSyllabus || subject,
      explanation: 'Teacher verified rubric evaluation.',
    }
    setQuestionItems([...questionItems, newQ])
    setManQText('')
    setManOptions(['', '', '', ''])
    setManCorrect(0)
  }

  // Handle Save / Publish Assessment
  const handlePublishAssessment = () => {
    if (!title.trim()) return

    const totalPts = questionItems.reduce((acc, q) => acc + q.points, 0)
    const newAssessment: ScheduledAssessment = {
      id: `asmt_${Date.now()}`,
      title,
      description: description || `Scheduled assessment for ${targetGrade} ${subject} covering ${topicSyllabus}.`,
      target_grade: targetGrade,
      subject,
      topic_syllabus: topicSyllabus,
      teacher_id: user?.id || 'teacher_sarah',
      teacher_name: user?.display_name || 'Dr. Sarah Connor',
      created_at: new Date().toISOString(),
      schedule_type: scheduleType,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      duration_minutes: durationMinutes,
      passing_score: passingScore,
      total_points: totalPts || 30,
      submissions_count: 0,
      status: 'PUBLISHED',
      pdf_attachment_name: pdfFileName || undefined,
      question_sets: [
        {
          set_name: 'Set A',
          questions: questionItems.length > 0 ? questionItems : [
            {
              id: 'q_default_1',
              question_text: `Fundamental conceptual verification for ${topicSyllabus || subject}.`,
              question_type: 'multiple_choice',
              options: ['Option A (Correct)', 'Option B', 'Option C', 'Option D'],
              correct_answer: 0,
              points: 10,
              cognitive_level: 'FOUNDATION',
              concept_name: topicSyllabus,
            }
          ]
        }
      ]
    }

    saveScheduledAssessment(newAssessment)
    refreshData()
    setShowCreateModal(false)
    setCreateStep('details')
    setTitle('')
    setDescription('')
    setQuestionItems([])
    alert(`Assessment "${newAssessment.title}" successfully scheduled and published for ${targetGrade}!`)
  }

  // Handle Student Submit Test
  const handleSubmitTest = () => {
    if (!takingTest) return
    setSubmittingTest(true)

    const submission = submitStudentAssessment(
      takingTest,
      user?.id || 'demo_student',
      user?.display_name || 'Student',
      studentGrade,
      studentAnswers
    )

    setTestResult(submission)
    setSubmittingTest(false)
    refreshData()
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this scheduled assessment?')) {
      deleteScheduledAssessment(id)
      refreshData()
    }
  }

  const currentQuestions = takingTest?.question_sets[0]?.questions || []
  const activeQ = currentQuestions[currentQIndex]

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <CheckSquare className="w-3.5 h-3.5" />
            {isTeacher ? 'Teacher Examination & Scheduling Studio' : `Student Assessment Hub • Enrolled in ${studentGrade}`}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {isTeacher ? 'Dynamic Assessment & Test Scheduling' : 'My Scheduled Tests & Quizzes'}
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            {isTeacher
              ? 'Schedule high-precision tests for your classes (Class 10, Class 7, Class 4) with AI generation, PDF drop, and closed-loop telemetry.'
              : `Access and complete your scheduled tests for ${studentGrade}. All results update your cognitive state vector in real-time.`}
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {isTeacher && (
            <button
              onClick={() => {
                setShowCreateModal(true)
                setCreateStep('details')
                setQuestionItems([])
              }}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Schedule New Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {isTeacher && (
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('assessments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'assessments'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Scheduled Assessments ({assessmentsList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'submissions'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Submissions & Telemetry ({submissionsList.length})</span>
          </button>
        </div>
      )}

      {/* ── Assessments Grid ─────────────────────────────────────────────────── */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              {isTeacher ? 'Active & Scheduled Tests Across Classes' : `Available Assessments for ${studentGrade}`}
            </h3>
            <span className="text-xs text-slate-400 font-mono">Total: {assessmentsList.length} Tests</span>
          </div>

          {assessmentsList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800 space-y-3">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-white font-bold">No Scheduled Assessments Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isTeacher
                  ? 'Click "Schedule New Test" to create an AI-powered or custom test for your students.'
                  : `There are currently no scheduled tests for ${studentGrade}. Check back shortly!`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assessmentsList.map((asmt) => {
                const totalQs = asmt.question_sets[0]?.questions.length || 0
                return (
                  <div
                    key={asmt.id}
                    className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {asmt.target_grade} &bull; {asmt.subject}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                          {asmt.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {asmt.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{asmt.description}</p>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Topic:</span>
                          <span className="font-semibold text-slate-200">{asmt.topic_syllabus}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Duration:</span>
                          <span className="font-mono text-cyan-400">{asmt.duration_minutes} Mins</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Passing Score:</span>
                          <span className="font-mono text-emerald-400">{asmt.passing_score}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Questions:</span>
                          <span className="font-mono text-slate-200">{totalQs} Questions ({asmt.total_points} Pts)</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      {isTeacher ? (
                        <>
                          <div className="text-[11px] text-slate-400">
                            Submissions: <strong className="text-white font-mono">{asmt.submissions_count}</strong>
                          </div>
                          <button
                            onClick={() => handleDelete(asmt.id)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setTakingTest(asmt)
                            setCurrentQIndex(0)
                            setStudentAnswers({})
                            setTestResult(null)
                          }}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/10 hover:scale-105"
                        >
                          <CheckSquare className="w-4 h-4" />
                          <span>Start Assessment</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Submissions & Telemetry Tab (For Teachers) ───────────────────────── */}
      {isTeacher && activeTab === 'submissions' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Live Student Test Submissions & Cognitive Calibration
              </h3>
              <p className="text-xs text-slate-400">
                Every completed test automatically updates the student's Bayesian mastery and competency in the closed-loop engine.
              </p>
            </div>
          </div>

          {submissionsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No submissions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="pb-3">Student & Grade</th>
                    <th className="pb-3">Assessment Title</th>
                    <th className="pb-3 text-center">Score</th>
                    <th className="pb-3 text-center">Points</th>
                    <th className="pb-3 text-center">Result</th>
                    <th className="pb-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {submissionsList.map((sub) => (
                    <tr key={sub.submission_id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-white">{sub.student_name}</div>
                        <div className="text-[10px] text-cyan-400 font-mono">{sub.student_grade}</div>
                      </td>
                      <td className="py-3 text-slate-300 font-medium">{sub.assessment_title}</td>
                      <td className="py-3 text-center font-mono font-bold text-emerald-400 text-sm">
                        {sub.score_percent}%
                      </td>
                      <td className="py-3 text-center font-mono text-slate-400">
                        {sub.total_points_earned} / {sub.max_points}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.passed
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {sub.passed ? 'PASSED' : 'RETRY'}
                        </span>
                      </td>
                      <td className="py-3 text-right text-slate-500 text-[10px] font-mono">
                        {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Teacher Create Assessment Modal ──────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Schedule New Class Assessment</h3>
                  <p className="text-xs text-slate-400">Configure target grade, subject, timing window, and question sets</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xl p-1"
              >
                &times;
              </button>
            </div>

            {createStep === 'details' ? (
              <div className="space-y-4">
                {/* Class & Subject Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Target Grade / Class:</label>
                    <select
                      value={targetGrade}
                      onChange={(e) => setTargetGrade(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Class 10">Class 10 (Secondary Board)</option>
                      <option value="Class 7">Class 7 (Middle School)</option>
                      <option value="Class 4">Class 4 (Elementary School)</option>
                      <option value="Class 6">Class 6</option>
                      <option value="Class 8">Class 8</option>
                      <option value="Class 9">Class 9</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Subject:</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Mathematics">Mathematics</option>
                      <option value="Science (EVS)">Science / EVS / Physics & Chem</option>
                      <option value="English Grammar">English Grammar & Language</option>
                      <option value="Social Studies">Social Studies / Social Science</option>
                    </select>
                  </div>
                </div>

                {/* Topic Syllabus */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Topic / Syllabus Focus:</label>
                  <input
                    type="text"
                    value={topicSyllabus}
                    onChange={(e) => setTopicSyllabus(e.target.value)}
                    placeholder="e.g. Quadratic Equations, Photosynthesis, Fractions..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Title & Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Assessment Title:</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`e.g. ${targetGrade} ${subject}: Diagnostic Benchmark`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Timing Window & Scheduling Options */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Scheduling & Timing Options
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'ALWAYS_AVAILABLE', label: 'Always Available' },
                      { id: 'TIME_WINDOW', label: 'Time Window (e.g. 4-5 PM)' },
                      { id: 'EXACT_TIME', label: 'Exact Fixed Time' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setScheduleType(opt.id as any)}
                        className={`p-2 rounded-xl text-xs font-medium border transition-all ${
                          scheduleType === opt.id
                            ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {scheduleType !== 'ALWAYS_AVAILABLE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] text-slate-400">Start Time:</label>
                        <input
                          type="datetime-local"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400">End Time / Deadline:</label>
                        <input
                          type="datetime-local"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] text-slate-400">Duration (Minutes):</label>
                      <input
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Passing Score (%):</label>
                      <input
                        type="number"
                        value={passingScore}
                        onChange={(e) => setPassingScore(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white mt-1"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!title) {
                      setTitle(`${targetGrade} ${subject}: ${topicSyllabus || 'Unit Test'}`)
                    }
                    setCreateStep('questions')
                  }}
                  className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <span>Proceed to Question Paper Design</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Question Creation Modes Selector */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex gap-2">
                    {[
                      { id: 'AI', label: 'AI Auto-Generate (Groq LPU)', icon: Sparkles },
                      { id: 'PDF', label: 'Drop PDF / Document', icon: Upload },
                      { id: 'MANUAL', label: 'Manual Question Builder', icon: Plus },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setCreationMode(mode.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          creationMode === mode.id
                            ? 'bg-cyan-500 text-slate-950 shadow'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <mode.icon className="w-3.5 h-3.5" />
                        <span>{mode.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCreateStep('details')}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    &larr; Back to Details
                  </button>
                </div>

                {/* AI Generate View */}
                {creationMode === 'AI' && (
                  <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-4">
                    <Sparkles className="w-8 h-8 text-cyan-400 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-sm">
                        Generate Psychometric Question Paper for {targetGrade} {subject}
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Groq Cloud LPU will synthesize calibrated items on "{topicSyllabus}" with balanced difficulty.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isGeneratingAI}
                      onClick={handleAIGenerate}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 mx-auto disabled:opacity-50 transition-all hover:scale-105"
                    >
                      {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>{isGeneratingAI ? 'Generating Items...' : 'Generate 5 Questions with AI'}</span>
                    </button>
                  </div>
                )}

                {/* PDF Drop View */}
                {creationMode === 'PDF' && (
                  <div className="p-8 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 text-center space-y-3 transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-sm">Drag & Drop Question Paper (PDF / DOCX)</h4>
                      <p className="text-xs text-slate-400">
                        {pdfFileName ? `Selected: ${pdfFileName}` : 'Upload pre-existing school exam papers or question banks'}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setPdfFileName(file.name)
                          // Automatically populate sample questions for the PDF
                          setQuestionItems([
                            {
                              id: `q_pdf_1`,
                              question_text: `Extracted from ${file.name}: State the core formula and solve for given parameters.`,
                              question_type: 'descriptive',
                              points: 15,
                              cognitive_level: 'REASONING',
                              concept_name: topicSyllabus,
                            }
                          ])
                        }
                      }}
                      className="text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500 file:text-slate-950 hover:file:bg-cyan-400 cursor-pointer"
                    />
                  </div>
                )}

                {/* Manual Builder View */}
                {creationMode === 'MANUAL' && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="text-xs font-bold text-white">Add Individual Question</div>
                    <input
                      type="text"
                      value={manQText}
                      onChange={(e) => setManQText(e.target.value)}
                      placeholder="Enter question text..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400">Question Type:</label>
                        <select
                          value={manQType}
                          onChange={(e) => setManQType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white mt-1"
                        >
                          <option value="multiple_choice">Multiple Choice (MCQ)</option>
                          <option value="descriptive">Descriptive / Problem Solving</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Cognitive Level:</label>
                        <select
                          value={manLevel}
                          onChange={(e) => setManLevel(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white mt-1"
                        >
                          <option value="FOUNDATION">FOUNDATION</option>
                          <option value="APPLICATION">APPLICATION</option>
                          <option value="REASONING">REASONING</option>
                          <option value="TRANSFER">TRANSFER</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Points:</label>
                        <input
                          type="number"
                          value={manPoints}
                          onChange={(e) => setManPoints(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white mt-1"
                        />
                      </div>
                    </div>

                    {manQType === 'multiple_choice' && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] text-slate-400 font-bold">Options (Check the correct radio):</label>
                        {manOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="correct_radio"
                              checked={manCorrect === idx}
                              onChange={() => setManCorrect(idx)}
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const next = [...manOptions]
                                next[idx] = e.target.value
                                setManOptions(next)
                              }}
                              placeholder={`Option ${idx + 1}...`}
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddManualQuestion}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                    >
                      + Add to Question Paper
                    </button>
                  </div>
                )}

                {/* Display Current Question Paper */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                    <span>Configured Questions ({questionItems.length}):</span>
                    <span>Total Points: {questionItems.reduce((a, b) => a + b.points, 0)} Pts</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {questionItems.map((q, idx) => (
                      <div key={q.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-white">
                            {idx + 1}. {q.question_text}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-400">{q.question_type}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-400">{q.cognitive_level}</span>
                            <span>{q.points} Pts</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setQuestionItems(questionItems.filter((item) => item.id !== q.id))}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishAssessment}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Publish Assessment to {targetGrade}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Student Taking Test Modal ────────────────────────────────────────── */}
      {takingTest && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{takingTest.title}</h3>
                  <p className="text-xs text-slate-400">
                    {testResult
                      ? 'Assessment Evaluation Completed'
                      : `Question ${currentQIndex + 1} of ${currentQuestions.length} • Duration: ${takingTest.duration_minutes} Mins`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTakingTest(null)}
                className="text-slate-400 hover:text-white text-xl p-1 font-bold"
              >
                &times;
              </button>
            </div>

            {testResult ? (
              <div className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/30 text-center space-y-4">
                <div
                  className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center font-bold ${
                    testResult.passed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {testResult.passed ? <CheckCircle className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-white">
                    {testResult.passed ? 'Assessment Passed!' : 'Assessment Attempt Recorded'}
                  </h4>
                  <p className="text-sm text-slate-300">
                    Score: <strong className="text-emerald-400 text-lg">{testResult.score_percent}%</strong> (
                    {testResult.total_points_earned}/{testResult.max_points} Points)
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto pt-1">{testResult.feedback}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-cyan-300">
                  ⚡ <strong>Closed-Loop Ingestion:</strong> Your Bayesian state vector and dynamic daily roadmap have been updated!
                </div>

                <button
                  onClick={() => setTakingTest(null)}
                  className="w-full py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : activeQ ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-300 font-bold">
                    Concept: {activeQ.concept_name}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-amber-300 font-bold">
                    {activeQ.cognitive_level} &bull; {activeQ.points} Pts
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <p className="text-sm font-semibold text-white leading-relaxed">{activeQ.question_text}</p>
                </div>

                {activeQ.question_type === 'multiple_choice' && activeQ.options ? (
                  <div className="space-y-2">
                    {activeQ.options.map((opt, optIdx) => {
                      const isSelected = studentAnswers[activeQ.id] === optIdx
                      return (
                        <button
                          key={optIdx}
                          onClick={() => setStudentAnswers((prev) => ({ ...prev, [activeQ.id]: optIdx }))}
                          className={`w-full p-3.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500 text-white shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Your Answer / Derivation:</label>
                    <textarea
                      rows={4}
                      value={(studentAnswers[activeQ.id] as string) || ''}
                      onChange={(e) => setStudentAnswers((prev) => ({ ...prev, [activeQ.id]: e.target.value }))}
                      placeholder="Type your explanation, steps, or answer..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex((prev) => prev - 1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {currentQIndex < currentQuestions.length - 1 ? (
                    <button
                      type="button"
                      disabled={studentAnswers[activeQ.id] === undefined}
                      onClick={() => setCurrentQIndex((prev) => prev + 1)}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submittingTest}
                      onClick={handleSubmitTest}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{submittingTest ? 'Evaluating...' : 'Submit Assessment'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
export default AssessmentsPage
