import React, { useState, useEffect, useCallback } from 'react'
import type {
  DashboardSummary,
  User,
  AdminUser,
  SchoolLiveClass,
  TeacherTimetableSlot,
  Enrollment,
  Announcement,
  Course,
  TimetableSlot
} from '../lib/api'
import {
  getDashboardSummary,
  getAdminUsers,
  approveUser,
  rejectUser,
  getSchoolLiveClasses,
  getTeacherTimetableSlots,
  createSchoolLiveClass,
  getMyEnrollments,
  enrollInCourse,
  getAnnouncements,
  createAnnouncement,
  generateTimetable,
  seedTimetableDefaults,
  getTimetableGrid,
  getCourses,
  recordTeacherLeave
} from '../lib/api'
import {
  BookOpen,
  CheckSquare,
  FileText,
  Award,
  TrendingUp,
  Users,
  UserCheck,
  Radio,
  Video,
  Calendar,
  Sparkles,
  Plus,
  Play,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Bell,
  Send,
  Clock,
  X,
  ChevronRight,
  GraduationCap,
  ShieldCheck,
  Cpu,
  Check,
  Loader2,
  Download
} from 'lucide-react'

type DashboardPageProps = {
  user: User
  summary: DashboardSummary | null
  setCurrentTab: (tab: string) => void
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, summary, setCurrentTab }) => {
  // Live Data States
  const [statsData, setStatsData] = useState<Record<string, number>>(summary?.stats || {})
  const [liveClasses, setLiveClasses] = useState<SchoolLiveClass[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [teacherSlots, setTeacherSlots] = useState<TeacherTimetableSlot[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [studentTimetable, setStudentTimetable] = useState<TimetableSlot[]>([])

  // UI & Loading States
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [selectedRecordingUrl, setSelectedRecordingUrl] = useState<string | null>(null)
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'student' | 'teacher'>('all')

  // Announcement Modal State
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'teacher' | 'student'>('all')

  // Leave Modal State (Teacher)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveSlot, setLeaveSlot] = useState<TeacherTimetableSlot | null>(null)
  const [leaveReason, setLeaveReason] = useState('')

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Load live data based on role
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      // 1. Fetch fresh summary stats
      const freshSummary = await getDashboardSummary().catch(() => null)
      if (freshSummary?.stats) {
        setStatsData(freshSummary.stats)
      }

      // 2. Announcements & Live classes (relevant to everyone)
      const [classesRes, announceRes] = await Promise.all([
        getSchoolLiveClasses().catch(() => []),
        getAnnouncements().catch(() => [])
      ])
      setLiveClasses(classesRes || [])
      setAnnouncements(announceRes || [])

      // 3. Role-specific data
      if (user.role === 'admin') {
        const usersRes = await getAdminUsers().catch(() => [])
        setAdminUsers(usersRes || [])
      } else if (user.role === 'teacher') {
        const slotsRes = await getTeacherTimetableSlots().catch(() => [])
        setTeacherSlots(slotsRes || [])
      } else if (user.role === 'student') {
        const [enrolledRes, coursesRes, gridRes] = await Promise.all([
          getMyEnrollments().catch(() => []),
          getCourses().catch(() => ({ items: [], total: 0 })),
          getTimetableGrid().catch(() => [])
        ])
        setEnrollments(enrolledRes || [])
        setAvailableCourses((coursesRes as any)?.items || [])
        setStudentTimetable(gridRes || [])
      }
    } catch (err: any) {
      console.warn('Dashboard data fetch note:', err)
    } finally {
      setLoading(false)
    }
  }, [user.role])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // ── ADMIN WORKING FUNCTIONS ──────────────────────────────────────────────────
  const handleRunAiScheduler = async () => {
    setActionLoading('scheduler')
    try {
      const res = await generateTimetable()
      showToast(
        `AI Scheduler finished! ${res.total_slots_scheduled} slots scheduled with zero conflicts across ${res.total_sections} sections.`,
        'success'
      )
      loadDashboardData()
    } catch (err: any) {
      showToast(err.message || 'Timetable generation encountered an issue.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSeedDefaults = async () => {
    setActionLoading('seed')
    try {
      const res = await seedTimetableDefaults()
      showToast(res.message || 'Standard curriculum timetable slots initialized!', 'success')
      loadDashboardData()
    } catch (err: any) {
      showToast(err.message || 'Failed to seed timetable defaults.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveUser = async (userId: string, role: 'student' | 'teacher') => {
    setActionLoading(`approve-${userId}`)
    try {
      await approveUser(userId, role)
      showToast(`User successfully activated as ${role}!`, 'success')
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active', role } : u))
      setStatsData(prev => ({
        ...prev,
        pending_users: Math.max(0, (prev.pending_users || 1) - 1),
        active_users: (prev.active_users || 0) + 1
      }))
    } catch (err: any) {
      showToast(err.message || 'Could not approve user.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectUser = async (userId: string) => {
    setActionLoading(`reject-${userId}`)
    try {
      await rejectUser(userId)
      showToast('User account deactivated.', 'info')
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'inactive' } : u))
    } catch (err: any) {
      showToast(err.message || 'Could not deactivate user.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── ANNOUNCEMENT BROADCAST WORKING FUNCTION ─────────────────────────────────
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcementTitle.trim() || !announcementBody.trim()) return

    setActionLoading('announcement')
    try {
      const res = await createAnnouncement({
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        audience_role: announcementAudience
      })
      showToast('School announcement broadcasted successfully!', 'success')
      setAnnouncements(prev => [res, ...prev])
      setShowAnnouncementModal(false)
      setAnnouncementTitle('')
      setAnnouncementBody('')
    } catch (err: any) {
      showToast(err.message || 'Failed to post announcement.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── TEACHER WORKING FUNCTIONS ────────────────────────────────────────────────
  const handleInstantLaunchClass = async (slot: TeacherTimetableSlot) => {
    setActionLoading(`launch-${slot.period_number}`)
    try {
      const now = new Date()
      const end = new Date(now.getTime() + 45 * 60 * 1000)
      await createSchoolLiveClass({
        title: `${slot.subject_name} Live Lecture (Grade ${slot.grade_number}-${slot.section_name})`,
        starts_at: now.toISOString(),
        ends_at: end.toISOString(),
        grade_number: slot.grade_number,
        section_name: slot.section_name,
        subject_code: slot.subject_code,
        subject_name: slot.subject_name,
        period_number: slot.period_number,
        room_number: slot.room_or_venue,
        status: 'live'
      })
      showToast(`Launching Live Classroom for Grade ${slot.grade_number}-${slot.section_name}...`, 'success')
      setCurrentTab('classroom')
    } catch (err: any) {
      showToast(err.message || 'Could not launch class session.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveSlot || !leaveReason.trim()) return

    setActionLoading('leave')
    try {
      await recordTeacherLeave({
        teacher_id: user.id,
        day_of_week: leaveSlot.day_of_week,
        reason: leaveReason.trim()
      })
      showToast('Leave recorded. Timetable AI notified for automatic substitution.', 'success')
      setShowLeaveModal(false)
      setLeaveReason('')
      setLeaveSlot(null)
    } catch (err: any) {
      showToast(err.message || 'Failed to submit leave request.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── STUDENT WORKING FUNCTIONS ────────────────────────────────────────────────
  const handleEnrollCourse = async (courseId: string) => {
    setActionLoading(`enroll-${courseId}`)
    try {
      await enrollInCourse(courseId)
      showToast('Successfully enrolled in subject! Start learning today.', 'success')
      const updated = await getMyEnrollments().catch(() => [])
      setEnrollments(updated)
      setStatsData(prev => ({ ...prev, courses_enrolled: (prev.courses_enrolled || 0) + 1 }))
    } catch (err: any) {
      showToast(err.message || 'Course enrollment could not be completed.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const activeLiveClass = liveClasses.find(c => c.status === 'live')

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto min-h-screen">
      {/* ── TOAST NOTIFICATION ───────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200 max-w-md ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50'
            : toast.type === 'error'
            ? 'bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/50'
            : 'bg-cyan-950/90 border-cyan-500/40 text-cyan-200 shadow-cyan-950/50'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
        </div>
      )}

      {/* ── LIVE DATA REFRESHING BAR ────────────────────────────────────────── */}
      {loading && (
        <div className="h-1 w-full bg-slate-800 overflow-hidden rounded-full">
          <div className="h-full bg-cyan-500 w-1/3 animate-pulse" />
        </div>
      )}

      {/* ── ROLE-SPECIFIC HERO BANNER ────────────────────────────────────────── */}
      {user.role === 'admin' && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Institutional Command Center
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Platform Operational
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome, Administrator {user.display_name}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Manage academy operations, trigger autonomous timetable scheduling, oversee faculty assignments, and broadcast institutional announcements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={handleRunAiScheduler}
                disabled={actionLoading === 'scheduler'}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {actionLoading === 'scheduler' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Cpu className="w-4 h-4 text-indigo-200" />
                )}
                <span>Run AI Auto-Scheduler</span>
              </button>

              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <Bell className="w-4 h-4 text-cyan-400" />
                <span>Broadcast Notice</span>
              </button>

              <button
                onClick={handleSeedDefaults}
                disabled={actionLoading === 'seed'}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                title="Initialize default periods for Grades 1 - 10"
              >
                {actionLoading === 'seed' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                <span className="hidden sm:inline">Seed Defaults</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {user.role === 'teacher' && (
        <div className="bg-gradient-to-r from-slate-900 via-purple-950/70 to-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                  Faculty Instructor Desk
                </span>
                <span className="text-xs text-slate-400">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome back, {user.display_name} 👩‍🏫
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Review your assigned timetable periods for today, initiate live classroom video streams with Cloudinary recording, and track your students.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={() => setCurrentTab('classroom')}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <Video className="w-4 h-4 text-slate-950" />
                <span>Go to Classroom</span>
              </button>

              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <Bell className="w-4 h-4 text-purple-400" />
                <span>Announce to Students</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {user.role === 'student' && (
        <div className="bg-gradient-to-r from-slate-900 via-cyan-950/70 to-slate-900 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-cyan-400" />
                  Student Learning Portal
                </span>
                <span className="text-xs text-slate-400">Academic Year 2025 - 2026</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Hello, {user.display_name} 🎒
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Stay on top of your daily class schedule, join interactive WebRTC live lectures, watch past recordings, and practice coding exercises.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={() => setCurrentTab('classroom')}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <Radio className="w-4 h-4 text-red-600 animate-pulse" />
                <span>Join Live Class</span>
              </button>

              <button
                onClick={() => setCurrentTab('courses')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>Explore Catalog</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE NOW HERO BANNER (Visible if any class is currently live) ─── */}
      {activeLiveClass && (
        <div className="bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-900 border border-red-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6 text-red-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                  CLASS LIVE NOW
                </span>
                <span className="text-xs text-slate-400">
                  Grade {activeLiveClass.grade_number}-{activeLiveClass.section_name} &bull; Period {activeLiveClass.period_number || 1}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">
                {activeLiveClass.title}
              </h3>
              <p className="text-xs text-slate-300">
                Instructor: <span className="text-cyan-400 font-semibold">{activeLiveClass.teacher_name || 'Faculty Member'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCurrentTab('classroom')}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Enter Classroom Room</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STATS CARDS GRID (Role Tailored) ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {user.role === 'admin' && (
          <>
            <div
              onClick={() => setUserFilter('student')}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Enrolled Students</span>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{statsData.students_total ?? 0}</p>
              <p className="text-[11px] text-cyan-400 mt-2 font-medium flex items-center gap-1">
                Filter students &rarr;
              </p>
            </div>

            <div
              onClick={() => setUserFilter('teacher')}
              className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Certified Faculty</span>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{statsData.teachers_total ?? 0}</p>
              <p className="text-[11px] text-purple-400 mt-2 font-medium flex items-center gap-1">
                Filter teachers &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('timetable')}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Scheduled Slots</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{statsData.timetable_slots_total ?? 36}</p>
              <p className="text-[11px] text-emerald-400 mt-2 font-medium flex items-center gap-1">
                View Timetable &rarr;
              </p>
            </div>

            <div
              onClick={() => setUserFilter('pending')}
              className={`bg-slate-900 border rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group ${
                (statsData.pending_users ?? 0) > 0 ? 'border-amber-500/40 shadow-lg shadow-amber-500/5' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Pending Approvals</span>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{statsData.pending_users ?? 0}</p>
              <p className="text-[11px] text-amber-400 mt-2 font-medium flex items-center gap-1">
                Review accounts &rarr;
              </p>
            </div>
          </>
        )}

        {user.role === 'teacher' && (
          <>
            <div
              onClick={() => setCurrentTab('timetable')}
              className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">My Daily Periods</span>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{teacherSlots.length}</p>
              <p className="text-[11px] text-purple-400 mt-2 font-medium flex items-center gap-1">
                Manage schedule &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('classroom')}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Live Lectures Today</span>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{liveClasses.length}</p>
              <p className="text-[11px] text-cyan-400 mt-2 font-medium flex items-center gap-1">
                Open Classroom &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('courses')}
              className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Curriculum Courses</span>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{statsData.courses_total ?? 10}</p>
              <p className="text-[11px] text-blue-400 mt-2 font-medium flex items-center gap-1">
                Edit curriculum &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('assignments')}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Student Submissions</span>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{statsData.submissions ?? 0}</p>
              <p className="text-[11px] text-amber-400 mt-2 font-medium flex items-center gap-1">
                Grade submissions &rarr;
              </p>
            </div>
          </>
        )}

        {user.role === 'student' && (
          <>
            <div
              onClick={() => setCurrentTab('courses')}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Enrolled Courses</span>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{enrollments.length}</p>
              <p className="text-[11px] text-cyan-400 mt-2 font-medium flex items-center gap-1">
                Resume course &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('classroom')}
              className="bg-slate-900 border border-slate-800 hover:border-red-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Live Lectures</span>
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                  <Radio className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{liveClasses.length}</p>
              <p className="text-[11px] text-red-400 mt-2 font-medium flex items-center gap-1">
                Join session &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('assessments')}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Quizzes & Tests</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <CheckSquare className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{statsData.assessments ?? 0}</p>
              <p className="text-[11px] text-emerald-400 mt-2 font-medium flex items-center gap-1">
                Take quiz &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('certificates')}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">Earned Certificates</span>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{statsData.certificates ?? 0}</p>
              <p className="text-[11px] text-amber-400 mt-2 font-medium flex items-center gap-1">
                View awards &rarr;
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── TEACHER INTERACTIVE TIMETABLE SCHEDULE BOARD ──────────────────── */}
      {user.role === 'teacher' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Your Teaching Schedule (Today's Assigned Periods)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                One-click live classroom launching with synchronized whiteboard and automatic Cloudinary recording.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('timetable')}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
            >
              <span>Full Timetable Grid</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {teacherSlots.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
              <Sparkles className="w-8 h-8 text-purple-400 mx-auto opacity-50" />
              <p className="text-sm font-semibold text-slate-300">No timetable periods assigned to your profile today.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Ask the administrator to run the AI Auto-Scheduler or switch to the Timetable tab to configure your periods.
              </p>
              <button
                onClick={() => setCurrentTab('timetable')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20"
              >
                Open Timetable Hub
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teacherSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
                        Period {slot.period_number}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {slot.start_time} - {slot.end_time}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-purple-300 transition-colors">
                        {slot.subject_name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Grade {slot.grade_number}-{slot.section_name} &bull; {slot.subject_code}
                      </p>
                    </div>

                    <div className="text-xs text-slate-400 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-500">Venue:</span>
                      <span className="font-semibold text-slate-200">{slot.room_or_venue || 'Main Lecture Hall'}</span>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleInstantLaunchClass(slot)}
                      disabled={actionLoading === `launch-${slot.period_number}`}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading === `launch-${slot.period_number}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                      )}
                      <span>Launch Class</span>
                    </button>

                    <button
                      onClick={() => { setLeaveSlot(slot); setShowLeaveModal(true); }}
                      className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                      title="Request substitute teacher or report leave"
                    >
                      Sub / Leave
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN LIVE SESSIONS & USER APPROVAL DESK ───────────────────────── */}
      {user.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* USER MANAGEMENT & APPROVAL DESK */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  User Directory & Role Approvals
                </h2>
                <p className="text-xs text-slate-400">
                  {adminUsers.length} total accounts registered across academy
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold">
                {(['all', 'pending', 'student', 'teacher'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setUserFilter(tab)}
                    className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                      userFilter === tab ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {adminUsers
                .filter(u => {
                  if (userFilter === 'pending') return u.status !== 'active'
                  if (userFilter === 'student') return u.role === 'student'
                  if (userFilter === 'teacher') return u.role === 'teacher'
                  return true
                })
                .slice(0, 15)
                .map(u => (
                  <div
                    key={u.id}
                    className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
                        {u.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white truncate">{u.display_name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            u.role === 'admin'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : u.role === 'teacher'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-cyan-500/20 text-cyan-300'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {u.status !== 'active' ? (
                        <>
                          <button
                            onClick={() => handleApproveUser(u.id, u.role === 'teacher' ? 'teacher' : 'student')}
                            disabled={actionLoading === `approve-${u.id}`}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors flex items-center gap-1"
                          >
                            {actionLoading === `approve-${u.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleRejectUser(u.id)}
                            className="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold text-[11px] transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* RECENT LIVE CLASSES & RECORDINGS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-cyan-400" />
                  Live Classroom Sessions & Cloud Recordings
                </h2>
                <p className="text-xs text-slate-400">
                  Real-time status across all grade levels
                </p>
              </div>
              <button
                onClick={() => setCurrentTab('classroom')}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <span>Classroom View</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {liveClasses.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <Video className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No live sessions recorded yet today.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {liveClasses.slice(0, 10).map(cls => (
                  <div
                    key={cls.id}
                    className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                          Grade {cls.grade_number}-{cls.section_name}
                        </span>
                        {cls.status === 'live' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                            ● LIVE NOW
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500">Ended</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-white truncate">{cls.title}</h4>
                      <p className="text-[11px] text-slate-400">
                        Instructor: {cls.teacher_name || 'Assigned Faculty'} &bull; Period {cls.period_number || 1}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {cls.recording_url ? (
                        <button
                          onClick={() => setSelectedRecordingUrl(cls.recording_url!)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-bold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Video className="w-3.5 h-3.5 text-purple-300" />
                          <span>Watch</span>
                        </button>
                      ) : cls.status === 'live' ? (
                        <button
                          onClick={() => setCurrentTab('classroom')}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-colors flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-slate-950" />
                          <span>Join</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STUDENT RECORDED LECTURES & REPLAYS ────────────────────────────── */}
      {user.role === 'student' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                Recorded Class Lectures & Cloud Replays
              </h2>
              <p className="text-xs text-slate-400">
                Watch past classes taught by your faculty with synchronized video and audio playback.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('classroom')}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
            >
              <span>View in Classroom</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {liveClasses.filter(c => !!c.recording_url).length === 0 ? (
            <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
              <Video className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No lecture recordings available yet.</p>
              <p className="text-[11px] text-slate-500">When teachers record their live classes, recordings will show up here for you to watch anytime.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveClasses.filter(c => !!c.recording_url).map(cls => (
                <div
                  key={cls.id}
                  className="bg-slate-950/70 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all group hover:scale-[1.01]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
                        Grade {cls.grade_number}-{cls.section_name}
                      </span>
                      <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Watch
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                        {cls.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {cls.subject_name || 'Subject Lecture'} &bull; Period {cls.period_number || 1}
                      </p>
                    </div>

                    <div className="text-xs text-slate-400 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-500">Instructor:</span>
                      <span className="font-semibold text-slate-200">{cls.teacher_name || 'Faculty Member'}</span>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => setSelectedRecordingUrl(cls.recording_url!)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Watch Recording</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STUDENT ACTIVE COURSES & GRADE TIMETABLE ────────────────────────── */}
      {user.role === 'student' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* MY ENROLLED SUBJECTS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  My Enrolled Courses & Subjects
                </h2>
                <p className="text-xs text-slate-400">Track your progress and continue course material</p>
              </div>
              <button
                onClick={() => setCurrentTab('courses')}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <span>Browse All</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {enrollments.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">You are not enrolled in any course subjects yet.</p>
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Available Courses to Enroll:</p>
                  <div className="flex flex-col gap-2">
                    {availableCourses.slice(0, 3).map(c => (
                      <div key={c.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{c.title}</span>
                        <button
                          onClick={() => handleEnrollCourse(c.id)}
                          disabled={actionLoading === `enroll-${c.id}`}
                          className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                        >
                          {actionLoading === `enroll-${c.id}` ? 'Enrolling...' : 'Enroll Now'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {enrollments.map(en => (
                  <div
                    key={en.id}
                    className="p-4 bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {en.course?.title || 'Academic Course'}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Status: <span className="capitalize text-emerald-400 font-semibold">{en.status}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => setCurrentTab('courses')}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>Study</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CLASS TIMETABLE PREVIEW */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  Today's Classroom Timetable
                </h2>
                <p className="text-xs text-slate-400">Periods and venue schedule for your class</p>
              </div>
              <button
                onClick={() => setCurrentTab('timetable')}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                <span>Full Timetable</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {studentTimetable.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">Check full timetable grid for schedule breakdown.</p>
                <button
                  onClick={() => setCurrentTab('timetable')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
                >
                  View Timetable Grid
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {studentTimetable.slice(0, 6).map((slot, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/30">
                        P{slot.period_number}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white">{slot.subject_name || slot.subject_code || 'Academic Lecture'}</p>
                        <p className="text-[11px] text-slate-400">
                          {slot.room_or_venue || 'Classroom Hall'} &bull; {slot.day_of_week}
                        </p>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-cyan-300 font-semibold shrink-0">
                      {slot.start_time} - {slot.end_time}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SCHOOL ANNOUNCEMENTS FEED (For All Roles) ────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              School Notice Board & Bulletins
            </h2>
            <p className="text-xs text-slate-400">Official updates from faculty and administrators</p>
          </div>

          {(user.role === 'admin' || user.role === 'teacher') && (
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Post Announcement</span>
            </button>
          )}
        </div>

        {announcements.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
            <Bell className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No active announcements posted.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {announcements.slice(0, 6).map(an => (
              <div
                key={an.id}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Official Notice
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(an.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white line-clamp-1">{an.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {an.content || (an as any).body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── QUICK ACTION LAUNCH DESK ────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <h3 className="font-bold text-slate-200 text-base flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" /> Direct Navigation & Learning Hubs
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => setCurrentTab('courses')}
            className="p-4 bg-slate-950/70 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-cyan-500/40 text-left transition-all hover:scale-[1.02] group"
          >
            <BookOpen className="w-5 h-5 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-sm text-slate-100">Course Catalog</p>
            <p className="text-xs text-slate-400 mt-1">Browse courses & subjects</p>
          </button>

          <button
            onClick={() => setCurrentTab('classroom')}
            className="p-4 bg-slate-950/70 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-red-500/40 text-left transition-all hover:scale-[1.02] group"
          >
            <Video className="w-5 h-5 text-red-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-sm text-slate-100">Live Video Classes</p>
            <p className="text-xs text-slate-400 mt-1">WebRTC interactive lectures</p>
          </button>

          <button
            onClick={() => setCurrentTab('coding')}
            className="p-4 bg-slate-950/70 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-emerald-500/40 text-left transition-all hover:scale-[1.02] group"
          >
            <Cpu className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-sm text-slate-100">Coding Practice Lab</p>
            <p className="text-xs text-slate-400 mt-1">Run Python & algorithms</p>
          </button>

          <button
            onClick={() => setCurrentTab('assessments')}
            className="p-4 bg-slate-950/70 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-purple-500/40 text-left transition-all hover:scale-[1.02] group"
          >
            <CheckSquare className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-sm text-slate-100">Quizzes & Tests</p>
            <p className="text-xs text-slate-400 mt-1">Check assessment scores</p>
          </button>
        </div>
      </div>

      {/* ── MODAL: CLOUDINARY CLASS RECORDING PLAYER ───────────────────────── */}
      {selectedRecordingUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Class Lecture Recording</h3>
                  <p className="text-[11px] text-slate-400">High-Definition replay powered by Cloudinary</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedRecordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setSelectedRecordingUrl(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-black aspect-video flex items-center justify-center relative">
              <video
                src={selectedRecordingUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BROADCAST SCHOOL ANNOUNCEMENT ─────────────────────────────── */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                Broadcast School Announcement
              </h3>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mid-Term Examination Schedule & Practical Labs"
                  value={announcementTitle}
                  onChange={e => setAnnouncementTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Target Audience
                </label>
                <select
                  value={announcementAudience}
                  onChange={e => setAnnouncementAudience(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">Everyone (All Students & Faculty)</option>
                  <option value="student">Students Only</option>
                  <option value="teacher">Faculty Teachers Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notice Details / Body Content
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type the announcement details and guidelines..."
                  value={announcementBody}
                  onChange={e => setAnnouncementBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'announcement'}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
                >
                  {actionLoading === 'announcement' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Publish Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: TEACHER LEAVE & SUBSTITUTION REQUEST ─────────────────────── */}
      {showLeaveModal && leaveSlot && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Report Leave & Request Substitution
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1 text-xs">
              <p className="text-white font-bold">{leaveSlot.subject_name}</p>
              <p className="text-slate-400">
                Period {leaveSlot.period_number} &bull; Grade {leaveSlot.grade_number}-{leaveSlot.section_name} ({leaveSlot.day_of_week})
              </p>
            </div>

            <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Reason for Absence
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g., Medical appointment, family emergency, academic conference..."
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'leave'}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all flex items-center gap-1.5"
                >
                  {actionLoading === 'leave' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Submit Leave Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
