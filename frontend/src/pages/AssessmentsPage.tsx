import React, { useState, useEffect } from 'react'
import type { Assessment, Course, User } from '../lib/api'
import { getCourses, createAssessment, addQuestion, submitAssessmentAttempt } from '../lib/api'
import { CheckSquare, Plus, CheckCircle, AlertCircle, X } from 'lucide-react'

type AssessmentsPageProps = {
  user: User
}

export const AssessmentsPage: React.FC<AssessmentsPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Quiz Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPassScore, setNewPassScore] = useState(70)

  // Question Modal State
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null)
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState('multiple_choice')
  const [qOptions, setQOptions] = useState('')
  const [qPoints, setQPoints] = useState(10)

  // Taking Quiz State
  const [takingAssessment, setTakingAssessment] = useState<Assessment | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [attemptResult, setAttemptResult] = useState<{ score: number; passed: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    try {
      setLoading(true)
      const res = await getCourses()
      setCourses(res.items || [])
      if (res.items.length > 0) setSelectedCourse(res.items[0].id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse) return
    try {
      const created = await createAssessment(selectedCourse, {
        title: newTitle,
        description: newDesc,
        passing_score: newPassScore
      })
      setAssessments([...assessments, created])
      setShowCreateModal(false)
      setNewTitle('')
      setNewDesc('')
    } catch (err: any) {
      alert(err.message || 'Failed to create assessment')
    }
  }

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAssessmentId) return
    try {
      const opts = qType === 'multiple_choice' ? qOptions.split(',').map(s => s.trim()) : null
      await addQuestion(activeAssessmentId, {
        question_text: qText,
        question_type: qType,
        options: opts,
        points: Number(qPoints)
      })
      alert('Question added successfully!')
      setShowQuestionModal(false)
      setQText('')
      setQOptions('')
    } catch (err: any) {
      alert(err.message || 'Failed to add question')
    }
  }

  const handleSubmitAttempt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!takingAssessment) return
    setSubmitting(true)
    try {
      const res = await submitAssessmentAttempt(takingAssessment.id, { answers })
      setAttemptResult({ score: res.score, passed: res.passed })
    } catch (err: any) {
      alert(err.message || 'Failed to submit attempt')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <CheckSquare className="w-7 h-7 text-cyan-400" />
            Assessment & Quiz Studio
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Test student knowledge with automated grading and instant feedback.
          </p>
        </div>

        {user.role !== 'student' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Quiz
          </button>
        )}
      </div>

      {/* Course Filter */}
      <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <label className="text-xs uppercase font-bold tracking-wider text-slate-400">Select Course:</label>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.slug})
            </option>
          ))}
        </select>
      </div>

      {/* Assessments Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading assessments...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assessments.length === 0 ? (
            <div className="col-span-full bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
              <CheckSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No quizzes created yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Quizzes for this course will appear here. Teachers can create assessments and add questions.
              </p>
            </div>
          ) : (
            assessments.map((quiz) => (
              <div key={quiz.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                      Passing: {quiz.passing_score}%
                    </span>
                    <span className="text-xs text-slate-500">{quiz.questions?.length || 0} Questions</span>
                  </div>
                  <h3 className="font-bold text-slate-100 text-lg">{quiz.title}</h3>
                  <p className="text-slate-400 text-xs mt-2 line-clamp-2">{quiz.description || 'No description provided.'}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                  {user.role !== 'student' && (
                    <button
                      onClick={() => {
                        setActiveAssessmentId(quiz.id)
                        setShowQuestionModal(true)
                      }}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Question
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setTakingAssessment(quiz)
                      setAnswers({})
                      setAttemptResult(null)
                    }}
                    className="ml-auto bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                  >
                    Start Quiz →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Take Quiz Modal */}
      {takingAssessment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setTakingAssessment(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-4">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Assessment</span>
              <h3 className="text-xl font-bold text-white mt-1">{takingAssessment.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{takingAssessment.description}</p>
            </div>

            {attemptResult ? (
              <div className="text-center py-8 space-y-4">
                {attemptResult.passed ? (
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                )}
                <h4 className="text-lg font-bold text-white">
                  {attemptResult.passed ? 'Congratulations! You Passed!' : 'Assessment Not Passed'}
                </h4>
                <p className="text-3xl font-extrabold text-cyan-400">{attemptResult.score}%</p>
                <p className="text-xs text-slate-400">
                  Required score to pass: {takingAssessment.passing_score}%
                </p>
                <button
                  onClick={() => setTakingAssessment(null)}
                  className="mt-4 bg-cyan-500 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs"
                >
                  Close Quiz
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitAttempt} className="space-y-6">
                {(takingAssessment.questions && takingAssessment.questions.length > 0) ? (
                  takingAssessment.questions.map((q, idx) => (
                    <div key={q.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                      <p className="text-sm font-semibold text-slate-200">
                        {idx + 1}. {q.question_text} <span className="text-xs text-slate-500">({q.points} pts)</span>
                      </p>

                      {q.question_type === 'multiple_choice' && q.options && (
                        <div className="space-y-2 pl-2">
                          {(Array.isArray(q.options) ? q.options : []).map((opt: string, i: number) => (
                            <label key={i} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                value={opt}
                                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                className="text-cyan-500 focus:ring-cyan-500"
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      )}

                      {q.question_type !== 'multiple_choice' && (
                        <input
                          type="text"
                          placeholder="Your answer..."
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 py-6 text-center">No questions added to this quiz yet.</p>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setTakingAssessment(null)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs transition-colors"
                  >
                    {submitting ? 'Evaluating...' : 'Submit Assessment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Create Quiz Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create New Assessment</h3>
            <form onSubmit={handleCreateAssessment} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Quiz Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Midterm Physics Quiz"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Instructions for students..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 h-20"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Passing Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newPassScore}
                  onChange={(e) => setNewPassScore(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Save Quiz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Add Question</h3>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Question Text</label>
                <input
                  type="text"
                  required
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="What is..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Question Type</label>
                <select
                  value={qType}
                  onChange={(e) => setQType(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="text">Text Response</option>
                </select>
              </div>

              {qType === 'multiple_choice' && (
                <div>
                  <label className="text-xs text-slate-400 font-semibold">Options (comma separated)</label>
                  <input
                    type="text"
                    required
                    value={qOptions}
                    onChange={(e) => setQOptions(e.target.value)}
                    placeholder="Option A, Option B, Option C"
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 font-semibold">Points</label>
                <input
                  type="number"
                  value={qPoints}
                  onChange={(e) => setQPoints(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
