import React, { useState, useEffect } from 'react'
import type { Assignment, Course, User } from '../lib/api'
import { getCourses, createAssignment, submitAssignment } from '../lib/api'
import { FileText, Plus, Upload, Clock, X } from 'lucide-react'

type AssignmentsPageProps = {
  user: User
}

export const AssignmentsPage: React.FC<AssignmentsPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')

  // Create Assignment Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxScore, setMaxScore] = useState(100)
  const [dueDate, setDueDate] = useState('')

  // Submit Assignment Modal
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null)
  const [subContent, setSubContent] = useState('')
  const [subFileUrl, setSubFileUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    try {
      const res = await getCourses()
      setCourses(res.items || [])
      if (res.items.length > 0) setSelectedCourse(res.items[0].id)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse) return
    try {
      const created = await createAssignment(selectedCourse, {
        title,
        description,
        max_score: maxScore,
        due_date: dueDate || undefined
      })
      setAssignments([...assignments, created])
      setShowCreateModal(false)
      setTitle('')
      setDescription('')
    } catch (err: any) {
      alert(err.message || 'Failed to create assignment')
    }
  }

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAssignment) return
    setSubmitting(true)
    try {
      await submitAssignment(activeAssignment.id, {
        content: subContent,
        file_url: subFileUrl || undefined
      })

      // Closed-loop LENS-Ω evidence ingestion
      try {
        const { ingestLearningEvidenceEvent } = await import('../lib/evidenceEngine')
        const courseName = courses.find(c => c.id === selectedCourse)?.title || 'Mathematics'
        const subjectName = courseName.toLowerCase().includes('science') ? 'Science (EVS)' :
                            courseName.toLowerCase().includes('english') ? 'English Grammar' :
                            courseName.toLowerCase().includes('social') ? 'Social Studies' : 'Mathematics'

        ingestLearningEvidenceEvent({
          id: `assignment_sub_${Date.now()}`,
          timestamp: new Date().toISOString(),
          student_id: user.id,
          grade_name: user.display_name?.includes('Class') ? user.display_name : 'Class 4',
          subject: subjectName,
          concept_name: activeAssignment.title,
          event_type: 'ASSIGNMENT',
          title: activeAssignment.title,
          score_ratio: 0.85,
          difficulty: 0.55,
          misconception_detected: false,
          feedback: `Submitted assignment: ${activeAssignment.title}.`
        })
      } catch (ingestErr) {
        console.warn('LENS ingestion non-fatal warning:', ingestErr)
      }

      alert('Assignment submitted successfully!')
      setActiveAssignment(null)
      setSubContent('')
      setSubFileUrl('')
    } catch (err: any) {
      alert(err.message || 'Failed to submit assignment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <FileText className="w-7 h-7 text-cyan-400" />
            Assignment Desk
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Submit projects, view feedback, and manage coursework submissions.
          </p>
        </div>

        {user.role !== 'student' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            New Assignment
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

      {/* Assignments List */}
      <div className="space-y-4">
        {assignments.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No assignments created yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Assignments will be displayed here for students to submit work and teachers to grade.
            </p>
          </div>
        ) : (
          assignments.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-slate-700 transition-all">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                    Max: {item.max_score} pts
                  </span>
                  {item.due_date && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Due: {new Date(item.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-100 text-lg">{item.title}</h3>
                <p className="text-slate-400 text-xs">{item.description}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {user.role === 'student' ? (
                  <button
                    onClick={() => setActiveAssignment(item)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Submit Work
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 font-medium">Teacher View</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create New Assignment</h3>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lab Report 1"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Instructions / Prompt</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the submission requirements..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 h-24"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold">Max Points</label>
                  <input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                  />
                </div>
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
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Work Modal */}
      {activeAssignment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActiveAssignment(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white">Submit Work for {activeAssignment.title}</h3>
            <p className="text-xs text-slate-400">{activeAssignment.description}</p>

            <form onSubmit={handleSubmitWork} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Written Response / Notes</label>
                <textarea
                  required
                  value={subContent}
                  onChange={(e) => setSubContent(e.target.value)}
                  placeholder="Paste your solution or text explanation here..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 h-28"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">File URL / GitHub Repository Link</label>
                <input
                  type="url"
                  value={subFileUrl}
                  onChange={(e) => setSubFileUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveAssignment(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs"
                >
                  {submitting ? 'Submitting...' : 'Confirm Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
