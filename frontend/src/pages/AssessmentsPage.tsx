import React, { useState, useEffect, useRef } from 'react'
import type { User } from '../lib/api'
import {
  CheckSquare,
  Plus,
  CheckCircle,
  Sparkles,
  Upload,
  Clock,
  BookOpen,
  Award,
  Users,
  Check,
  Loader2,
  Trash2,
  ArrowRight,
  Shield,
  Camera,
  Mic,
  AlertTriangle,
  Eye,
  FileCheck,
  Zap
} from 'lucide-react'
import {
  getScheduledAssessments,
  saveScheduledAssessment,
  deleteScheduledAssessment,
  getAssessmentsForStudent,
  generateAIQuestionSet,
  submitStudentAssessment,
  getAllSubmissions,
  isAssessmentCompletedByStudent
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
  const [documentContent, setDocumentContent] = useState<string>('')

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

  // Student Examination & AI Proctoring State
  const [takingTest, setTakingTest] = useState<ScheduledAssessment | null>(null)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string | number>>({})
  const [submittingTest, setSubmittingTest] = useState(false)
  const [testResult, setTestResult] = useState<StudentSubmission | null>(null)
  const [viewingPastSubmission, setViewingPastSubmission] = useState<StudentSubmission | null>(null)

  // AI Proctoring Security Telemetry
  const [proctorActive, setProctorActive] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [violations, setViolations] = useState<string[]>([])
  const [violationCount, setViolationCount] = useState(0)
  const [showWarningModal, setShowWarningModal] = useState<string | null>(null)
  const [isDisqualified, setIsDisqualified] = useState(false)
  const [micVolumeLevel, setMicVolumeLevel] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

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

  // ── AI Proctoring Video & Audio Hardware Setup ────────────────────────────
  const startProctoringSession = async () => {
    try {
      // 1. Request Webcam and Mic
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // 2. Setup Audio Decibel Meter
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const audioCtx = new AudioCtx()
        audioContextRef.current = audioCtx
        const analyser = audioCtx.createAnalyser()
        analyserRef.current = analyser
        analyser.fftSize = 256
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const checkVolume = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
          const avg = sum / dataArray.length
          setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)))

          // If sustained loud noise occurs
          if (avg > 90) {
            recordViolation('Loud background noise / voice assistance detected')
          }
          if (proctorActive) {
            requestAnimationFrame(checkVolume)
          }
        }
        requestAnimationFrame(checkVolume)
      } catch (audioErr) {
        console.warn('Audio analyser fallback:', audioErr)
      }

      // 3. Request Fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      }

      setProctorActive(true)
      setViolations([])
      setViolationCount(0)
      setIsDisqualified(false)
    } catch (err) {
      console.warn('Camera/Mic permission warning:', err)
      // Allow proceeding with soft proctoring fallback
      setProctorActive(true)
    }
  }

  const stopProctoringSession = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
    setProctorActive(false)
  }

  // ── Anti-Cheat Event Listeners (Tab switch, Blur, Fullscreen exit) ────────
  useEffect(() => {
    if (!proctorActive || !takingTest || testResult || isDisqualified) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('Browser tab switch / application minimized')
      }
    }

    const handleWindowBlur = () => {
      recordViolation('Focus lost / mouse exited examination window')
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && proctorActive) {
        recordViolation('Exited fullscreen examination security mode')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [proctorActive, takingTest, testResult, isDisqualified, violationCount])

  const recordViolation = (reason: string) => {
    if (isDisqualified || testResult) return

    const newCount = violationCount + 1
    const newViolations = [...violations, `${reason} (at ${new Date().toLocaleTimeString()})`]
    setViolations(newViolations)
    setViolationCount(newCount)

    if (newCount >= 3) {
      // 3 Strikes => Immediate Disqualification
      setIsDisqualified(true)
      setShowWarningModal(null)
      if (takingTest) {
        const sub = submitStudentAssessment(
          takingTest,
          user?.id || 'demo_student',
          user?.display_name || 'Student',
          studentGrade,
          studentAnswers,
          { cheated: true, violations: newViolations, count: newCount }
        )
        setTestResult(sub)
        refreshData()
      }
      stopProctoringSession()
    } else {
      setShowWarningModal(`SECURITY ALERT (Strike ${newCount}/3): ${reason}. Please remain focused on the exam screen.`)
    }
  }

  // Handle AI Question Generation
  const handleAIGenerate = async () => {
    setIsGeneratingAI(true)
    try {
      const generated = await generateAIQuestionSet(
        targetGrade,
        subject,
        topicSyllabus,
        5,
        documentContent || undefined
      )
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
      requires_proctoring: true,
      pdf_attachment_name: pdfFileName || undefined,
      question_sets: [
        {
          set_name: 'Set A',
          questions: questionItems.length > 0 ? questionItems : [
            {
              id: 'q_default_1',
              question_text: `Fundamental analytical theorem verification for ${topicSyllabus || subject}.`,
              question_type: 'multiple_choice',
              options: ['Core Derivation (Correct)', 'Misconception A', 'Misconception B', 'Misconception C'],
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
    setDocumentContent('')
    alert(`Assessment "${newAssessment.title}" successfully scheduled and published for ${targetGrade}!`)
  }

  // Handle Student Start Test with Proctoring
  const handleStartTest = async (asmt: ScheduledAssessment) => {
    // Check if already completed
    const existing = isAssessmentCompletedByStudent(asmt.id, user?.id || 'demo_student')
    if (existing) {
      setViewingPastSubmission(existing)
      return
    }

    setTakingTest(asmt)
    setCurrentQIndex(0)
    setStudentAnswers({})
    setTestResult(null)
    setViolations([])
    setViolationCount(0)
    setIsDisqualified(false)

    // Launch Proctoring
    await startProctoringSession()
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
      studentAnswers,
      { cheated: false, violations, count: violationCount }
    )

    setTestResult(submission)
    setSubmittingTest(false)
    stopProctoringSession()
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
            <Shield className="w-3.5 h-3.5" />
            {isTeacher ? 'Teacher Examination & Security Studio' : `Secure Examination Portal • Enrolled in ${studentGrade}`}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {isTeacher ? 'Assessment Scheduling & AI Proctoring' : 'My Scheduled Tests & Security Hub'}
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            {isTeacher
              ? 'Schedule high-precision tests for your classes (Class 10, Class 7, Class 4) with syllabus-grounded AI generation, PDF document parsing, and anti-cheat telemetry.'
              : `Access your scheduled examinations for ${studentGrade}. One attempt per assessment with active camera and screen security.`}
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {isTeacher && (
            <button
              onClick={() => {
                setShowCreateModal(true)
                setCreateStep('details')
                setQuestionItems([])
                setDocumentContent('')
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
            <span>Student Submissions & Security Audit ({submissionsList.length})</span>
          </button>
        </div>
      )}

      {/* ── Assessments Grid ─────────────────────────────────────────────────── */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              {isTeacher ? 'Active & Scheduled Tests Across Classes' : `Examinations for ${studentGrade}`}
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
                const pastSub = !isTeacher ? isAssessmentCompletedByStudent(asmt.id, user?.id || 'demo_student') : null
                const isCompleted = !!pastSub

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
                        {isCompleted ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <FileCheck className="w-3 h-3" />
                            Completed ({pastSub?.score_percent}%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Proctored
                          </span>
                        )}
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
                          <span className="font-mono text-slate-200">{totalQs} Items ({asmt.total_points} Pts)</span>
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
                      ) : isCompleted ? (
                        <button
                          onClick={() => setViewingPastSubmission(pastSub)}
                          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Completed Submission ({pastSub?.score_percent}%)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartTest(asmt)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/10 hover:scale-105"
                        >
                          <Shield className="w-4 h-4" />
                          <span>Start Proctored Exam &rarr;</span>
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

      {/* ── Submissions & Anti-Cheat Audit Tab (For Teachers) ───────────────── */}
      {isTeacher && activeTab === 'submissions' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Live Student Test Submissions & Anti-Cheat Audit Telemetry
              </h3>
              <p className="text-xs text-slate-400">
                Live inspection of student submissions, cognitive state adjustments, and automated proctoring violation alerts.
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
                    <th className="pb-3 text-center">Security Status</th>
                    <th className="pb-3 text-center">Violations</th>
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
                      <td className="py-3 text-center font-mono font-bold text-sm">
                        {sub.cheated ? (
                          <span className="text-rose-400 font-black">0% (DQ)</span>
                        ) : (
                          <span className="text-emerald-400">{sub.score_percent}%</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {sub.cheated ? (
                          <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-extrabold text-[10px] flex items-center gap-1 justify-center">
                            <AlertTriangle className="w-3 h-3" />
                            FLAGGED CHEATING
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            PASSED SECURE
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {sub.cheated ? (
                          <div className="text-[10px] text-rose-300 max-w-xs truncate mx-auto" title={sub.cheating_reasons?.join('; ')}>
                            {sub.violation_count} Strikes: {sub.cheating_reasons?.[0] || 'Tab switch'}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[10px]">0 Infractions</span>
                        )}
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
                      setTitle(`${targetGrade} ${subject}: ${topicSyllabus || 'Examination Paper'}`)
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
                      { id: 'PDF', label: 'Drop PDF / Document Parser', icon: Upload },
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
                        Synthesize Deeply Calibrated Examination Items for {targetGrade} {subject}
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Groq Cloud LPU will generate high-precision mathematical derivations, scientific mechanisms, and misconception distractors for "{topicSyllabus}".
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isGeneratingAI}
                      onClick={handleAIGenerate}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 mx-auto disabled:opacity-50 transition-all hover:scale-105"
                    >
                      {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>{isGeneratingAI ? 'Synthesizing Rigorous Items...' : 'Generate 5 Examination Questions with AI'}</span>
                    </button>
                  </div>
                )}

                {/* PDF Drop View with Content Parsing */}
                {creationMode === 'PDF' && (
                  <div className="space-y-3">
                    <div className="p-6 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 text-center space-y-3 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-white text-sm">Upload & Parse Syllabus Notes or Question Bank</h4>
                        <p className="text-xs text-slate-400">
                          {pdfFileName ? `Parsed File: ${pdfFileName}` : 'Select a PDF, DOCX, or text file to extract exam questions with AI'}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setPdfFileName(file.name)
                            const reader = new FileReader()
                            reader.onload = (ev) => {
                              const text = ev.target?.result as string || ''
                              setDocumentContent(text)
                            }
                            reader.readAsText(file)
                          }
                        }}
                        className="text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500 file:text-slate-950 hover:file:bg-cyan-400 cursor-pointer"
                      />
                    </div>

                    {pdfFileName && (
                      <button
                        type="button"
                        disabled={isGeneratingAI}
                        onClick={handleAIGenerate}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                      >
                        {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        <span>Extract & Generate Questions from {pdfFileName}</span>
                      </button>
                    )}
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
                      placeholder="Enter question text (e.g. Solve 2x² - 7x + 3 = 0)..."
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
                        <label className="text-[10px] text-slate-400 font-bold">Options (Select correct radio):</label>
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

      {/* ── View Completed Submission Modal ──────────────────────────────────── */}
      {viewingPastSubmission && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold text-white">{viewingPastSubmission.assessment_title}</h4>
              <p className="text-xs text-slate-400">
                Submitted on {new Date(viewingPastSubmission.submitted_at).toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-3xl font-black text-emerald-400 font-mono">
                {viewingPastSubmission.score_percent}%
              </div>
              <div className="text-xs text-slate-300">
                Earned {viewingPastSubmission.total_points_earned} of {viewingPastSubmission.max_points} Points
              </div>
              <p className="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                {viewingPastSubmission.feedback}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 text-xs text-slate-400">
              <strong>Single-Attempt Policy:</strong> Assessment completed. Results have been recorded in your LENS state vector.
            </div>

            <button
              onClick={() => setViewingPastSubmission(null)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
            >
              Close Summary
            </button>
          </div>
        </div>
      )}

      {/* ── Student Taking Proctored Test Modal with Live HUD ────────────────── */}
      {takingTest && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 animate-in fade-in select-none">
          {/* Top Proctoring Security Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{takingTest.title}</h3>
                <p className="text-xs text-slate-400">
                  Question {currentQIndex + 1} of {currentQuestions.length} &bull; Security Level: SECURE PROCTORED
                </p>
              </div>
            </div>

            {/* Live Camera Feed & Status HUD */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Camera className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Cam Active</span>
                <span className="text-slate-600">|</span>
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mic: {micVolumeLevel}%</span>
              </div>

              {/* Live Picture-in-Picture Video */}
              <div className="w-24 h-16 rounded-xl bg-black border border-cyan-500/40 overflow-hidden relative shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 left-1 px-1 rounded bg-rose-500 text-[8px] font-bold text-white uppercase tracking-wider">
                  REC
                </div>
              </div>

              <div className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                violationCount > 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                <Shield className="w-3.5 h-3.5" />
                <span>Strikes: {violationCount}/3</span>
              </div>
            </div>
          </div>

          {/* Center Question View */}
          <div className="max-w-3xl w-full mx-auto my-auto space-y-6">
            {testResult ? (
              <div className="p-8 rounded-3xl bg-slate-900 border border-indigo-500/30 text-center space-y-5">
                <div
                  className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center font-bold ${
                    testResult.cheated
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : testResult.passed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {testResult.cheated ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
                </div>

                <div className="space-y-1">
                  <h4 className="text-2xl font-bold text-white">
                    {testResult.cheated ? 'DISQUALIFIED / FLAGGED FOR CHEATING' : 'Examination Submitted Successfully!'}
                  </h4>
                  <p className="text-sm text-slate-300">
                    Final Score: <strong className="text-emerald-400 text-xl">{testResult.score_percent}%</strong> (
                    {testResult.total_points_earned}/{testResult.max_points} Points)
                  </p>
                  <p className="text-xs text-slate-400 max-w-lg mx-auto pt-2">{testResult.feedback}</p>
                </div>

                {testResult.cheated && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 text-left">
                    <strong>Recorded Infractions:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      {testResult.cheating_reasons?.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => {
                    setTakingTest(null)
                    stopProctoringSession()
                  }}
                  className="px-8 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all"
                >
                  Return to Examination Hub
                </button>
              </div>
            ) : activeQ ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="px-3 py-1 rounded-lg bg-slate-900 text-cyan-300 font-bold border border-slate-800">
                    Concept: {activeQ.concept_name}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-slate-900 text-amber-300 font-bold border border-slate-800">
                    {activeQ.cognitive_level} &bull; {activeQ.points} Points
                  </span>
                </div>

                <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
                  <p className="text-base font-semibold text-white leading-relaxed">{activeQ.question_text}</p>
                </div>

                {activeQ.question_type === 'multiple_choice' && activeQ.options ? (
                  <div className="space-y-3">
                    {activeQ.options.map((opt, optIdx) => {
                      const isSelected = studentAnswers[activeQ.id] === optIdx
                      return (
                        <button
                          key={optIdx}
                          onClick={() => setStudentAnswers((prev) => ({ ...prev, [activeQ.id]: optIdx }))}
                          className={`w-full p-4 rounded-2xl border text-left text-xs font-medium flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
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
                    <label className="text-xs text-slate-400">Your Analytical Derivation:</label>
                    <textarea
                      rows={5}
                      value={(studentAnswers[activeQ.id] as string) || ''}
                      onChange={(e) => setStudentAnswers((prev) => ({ ...prev, [activeQ.id]: e.target.value }))}
                      placeholder="Type your derivation steps, formulas, and final answer..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Bottom Navigation */}
          {!testResult && activeQ && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 max-w-3xl w-full mx-auto">
              <button
                type="button"
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex((prev) => prev - 1)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
              >
                Previous
              </button>

              {currentQIndex < currentQuestions.length - 1 ? (
                <button
                  type="button"
                  disabled={studentAnswers[activeQ.id] === undefined}
                  onClick={() => setCurrentQIndex((prev) => prev + 1)}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submittingTest}
                  onClick={handleSubmitTest}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{submittingTest ? 'Evaluating...' : 'Submit Proctored Exam'}</span>
                </button>
              )}
            </div>
          )}

          {/* Warning Modal / Alert Overlay */}
          {showWarningModal && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
              <div className="p-6 rounded-3xl bg-rose-950/90 border border-rose-500 max-w-md w-full text-center space-y-4 shadow-2xl">
                <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-white">Examination Security Infraction</h4>
                <p className="text-xs text-rose-200 leading-relaxed">{showWarningModal}</p>
                <button
                  onClick={() => setShowWarningModal(null)}
                  className="w-full py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-400"
                >
                  I Understand • Return to Examination
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default AssessmentsPage
