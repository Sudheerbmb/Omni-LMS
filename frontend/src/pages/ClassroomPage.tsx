import React, { useState, useEffect } from 'react'
import type { ClassroomSession, Course, User } from '../lib/api'
import { getCourses, getClassroomSessions, createClassroomSession } from '../lib/api'
import { Video, Plus, Calendar, Clock, ExternalLink, VideoOff } from 'lucide-react'

type ClassroomPageProps = {
  user: User
}

export const ClassroomPage: React.FC<ClassroomPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [sessions, setSessions] = useState<ClassroomSession[]>([])
  const [loading, setLoading] = useState(true)

  // Schedule Session Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const cList = await getCourses()
      setCourses(cList.items || [])
      if (cList.items.length > 0) setSelectedCourseId(cList.items[0].id)
      const sList = await getClassroomSessions()
      setSessions(sList || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourseId) return
    try {
      const created = await createClassroomSession(selectedCourseId, {
        title,
        start_time: startTime,
        end_time: endTime
      })
      setSessions([...sessions, created])
      setShowCreateModal(false)
      setTitle('')
    } catch (err: any) {
      alert(err.message || 'Failed to schedule live class')
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Video className="w-7 h-7 text-cyan-400" />
            Live Zoom Classrooms & Timetable
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Join live synchronous lectures, view schedule timetables, and launch Zoom video sessions.
          </p>
        </div>

        {user.role !== 'student' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Schedule Class
          </button>
        )}
      </div>

      {/* Class Schedule Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading classroom schedule...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.length === 0 ? (
            <div className="col-span-full bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
              <VideoOff className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No live sessions scheduled</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upcoming Zoom classes will appear here with instant join links.
              </p>
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-cyan-400 font-bold">
                    <Calendar className="w-4 h-4" /> {new Date(s.start_time).toLocaleDateString()}
                  </div>

                  <h3 className="font-bold text-slate-100 text-lg">{s.title}</h3>

                  <div className="space-y-1 text-xs text-slate-400">
                    <p className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> Start: {new Date(s.start_time).toLocaleTimeString()}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> End: {new Date(s.end_time).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                  <a
                    href={s.meeting_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                  >
                    Launch Zoom Class <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Schedule Live Class</h3>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full mt-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-2.5 text-xs focus:border-cyan-500"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Session Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Live Q&A and Problem Solving"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold">Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold">End Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
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
                  Schedule Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
