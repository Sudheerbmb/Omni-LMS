import React, { useState, useEffect } from 'react'
import type { 
  User, 
  SchoolCourse
} from '../lib/api'
import { getSchoolCourses, updateSchoolCourse } from '../lib/api'
import { 
  BookOpen, 
  Search, 
  X, 
  GraduationCap, 
  Layers, 
  Clock, 
  CheckCircle2, 
  CircleDot, 
  Sparkles, 
  Calculator, 
  FlaskConical, 
  Globe, 
  Code2, 
  Palette, 
  Trophy, 
  ShieldCheck, 
  ChevronRight,
  Filter,
  Pencil,
  Save
} from 'lucide-react'

type CoursesPageProps = {
  user: User
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<SchoolCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all')
  const [activeCourse, setActiveCourse] = useState<SchoolCourse | null>(null)
  const [editingCourse, setEditingCourse] = useState<SchoolCourse | null>(null)
  const [editSubjectName, setEditSubjectName] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editColor, setEditColor] = useState('#06b6d4')
  const [editAcademicYear, setEditAcademicYear] = useState('2026-2027')
  const [editPeriods, setEditPeriods] = useState(5)
  const [editChaptersJson, setEditChaptersJson] = useState('[]')
  const [savingCourse, setSavingCourse] = useState(false)
  const [editError, setEditError] = useState('')
  
  // Chapter progress tracker (local persistence per user/course)
  const [completedChapters, setCompletedChapters] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`course_progress_${user.id}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const role = user.role || 'student'
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isStudent = role === 'student'

  useEffect(() => {
    fetchCourses()
  }, [user.email, user.role, selectedGrade])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const params: any = {
        user_email: user.email,
        user_role: user.role
      }
      if (isAdmin && selectedGrade !== 'all') {
        params.grade_number = selectedGrade
      }
      const data = await getSchoolCourses(params)
      setCourses(data || [])
    } catch (err) {
      console.error('Failed to load courses:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleChapterDone = (courseId: string, chapterNum: number) => {
    const key = `${courseId}_ch_${chapterNum}`
    const updated = { ...completedChapters, [key]: !completedChapters[key] }
    setCompletedChapters(updated)
    try {
      localStorage.setItem(`course_progress_${user.id}`, JSON.stringify(updated))
    } catch (e) {
      console.error(e)
    }
  }

  const openCourseEditor = (course: SchoolCourse) => {
    setEditingCourse(course)
    setEditSubjectName(course.subject_name)
    setEditTitle(course.title)
    setEditCategory(course.category)
    setEditColor(course.color)
    setEditAcademicYear(course.academic_year)
    setEditPeriods(course.periods_per_week)
    setEditChaptersJson(JSON.stringify(course.chapters, null, 2))
    setEditError('')
  }

  const saveCourseEdits = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingCourse) return
    try {
      setSavingCourse(true)
      setEditError('')
      const chapters = JSON.parse(editChaptersJson)
      if (!Array.isArray(chapters)) throw new Error('Chapters must be a JSON array.')
      await updateSchoolCourse(editingCourse.grade_number, editingCourse.subject_code, {
        title: editTitle.trim(),
        subject_name: editSubjectName.trim(),
        category: editCategory.trim(),
        color: editColor,
        academic_year: editAcademicYear.trim(),
        periods_per_week: editPeriods,
        chapters
      })
      setEditingCourse(null)
      await fetchCourses()
    } catch (error: any) {
      setEditError(error.message || 'Unable to update this curriculum course.')
    } finally {
      setSavingCourse(false)
    }
  }

  const getSubjectIcon = (code: string) => {
    switch (code) {
      case 'MATH': return Calculator
      case 'SCI':
      case 'PHY':
      case 'CHEM':
      case 'BIO': return FlaskConical
      case 'SST':
      case 'HIST':
      case 'GEOG':
      case 'EVS': return Globe
      case 'CS': return Code2
      case 'ART': return Palette
      case 'PET': return Trophy
      default: return BookOpen
    }
  }

  const filteredCourses = courses.filter(c => {
    const q = search.toLowerCase()
    return (
      c.title.toLowerCase().includes(q) ||
      c.subject_name.toLowerCase().includes(q) ||
      c.instructor_name.toLowerCase().includes(q) ||
      c.chapters.some(ch => ch.title.toLowerCase().includes(q) || ch.topics.some(t => t.toLowerCase().includes(q)))
    )
  })

  const userGradeMatch = user.email.match(/class(\\d+)/i) || user.display_name?.match(/Class\\s*(\\d+)/i)
  const studentGradeNum = userGradeMatch ? userGradeMatch[1] : '9'

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            {isAdmin && <ShieldCheck className="w-3.5 h-3.5" />}
            {isTeacher && <GraduationCap className="w-3.5 h-3.5" />}
            {isStudent && <BookOpen className="w-3.5 h-3.5" />}
            {isAdmin 
              ? 'Institutional Master Curriculum' 
              : isTeacher 
              ? 'Assigned Teaching Syllabi' 
              : `Class ${studentGradeNum} Prescribed Curriculum`}
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {isAdmin && 'CBSE Course Catalog & Chapter Syllabi'}
            {isTeacher && `${user.display_name} — Teaching Courses`}
            {isStudent && `Class ${studentGradeNum} — Academic Subjects & Syllabus`}
          </h1>

          <p className="text-slate-400 text-sm max-w-2xl">
            {isAdmin && 'Comprehensive curriculum across Classes 1-10 with detailed chapter breakdowns, weekly periods, learning outcomes, and assigned instructors.'}
            {isTeacher && 'Subjects and class levels you are assigned to teach according to the school timetable. Review chapter topics, duration, and curriculum pacing.'}
            {isStudent && 'Your complete course schedule and detailed textbook chapters for Academic Year 2026-27. Click any subject to explore its full chapter syllabus.'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-right shrink-0 relative z-10 space-y-1">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Courses</div>
          <div className="text-3xl font-black text-cyan-400">{courses.length}</div>
          <div className="text-[11px] text-slate-500">
            {isStudent ? 'Enrolled Subjects' : isTeacher ? 'Assigned Classes' : 'Grades 1-10 Total'}
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects, chapters, topics, or faculty..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-cyan-400" /> Grade:
            </span>
            <button
              onClick={() => setSelectedGrade('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                selectedGrade === 'all'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Grades
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  selectedGrade === g
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Cl {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Loading curriculum and chapter syllabi...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No courses match your search filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((c) => {
            const Icon = getSubjectIcon(c.subject_code)
            const completedCount = c.chapters.filter(ch => completedChapters[`${c.id}_ch_${ch.num}`]).length
            const percent = c.total_chapters > 0 ? Math.round((completedCount / c.total_chapters) * 100) : 0

            return (
              <div
                key={c.id}
                onClick={() => setActiveCourse(c)}
                className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 transition-all hover:shadow-2xl hover:shadow-cyan-500/10 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg"
                        style={{ backgroundColor: `${c.color}25`, borderColor: c.color, border: '1px solid' }}
                      >
                        <Icon className="w-5 h-5" style={{ color: c.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider"
                            style={{ backgroundColor: `${c.color}20`, color: c.color }}
                          >
                            {c.subject_code}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {c.grade_name}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-white mt-1 group-hover:text-cyan-400 transition-colors line-clamp-1">
                          {c.subject_name}
                        </h3>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openCourseEditor(c)
                        }}
                        className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                        title="Edit curriculum course"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Highlights */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{c.periods_per_week} Periods / Wk</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{c.total_chapters} Chapters ({c.estimated_weeks} Wks)</span>
                    </div>
                  </div>

                  {/* Instructor */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-[10px]">
                        {c.instructor_name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Instructor</div>
                        <div className="text-xs font-bold text-slate-200 truncate">{c.instructor_name}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                      2026-27
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span className="text-slate-400">Syllabus Progress</span>
                      <span className="text-cyan-400">{completedCount} / {c.total_chapters} Chapters ({percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                  <span>Explore Chapters & Syllabus</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isAdmin && editingCourse && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveCourseEdits} className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white">Edit Curriculum Course</h2>
                <p className="text-xs text-slate-400">{editingCourse.grade_name} &bull; {editingCourse.subject_code}</p>
              </div>
              <button type="button" onClick={() => setEditingCourse(null)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{editError}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-xs text-slate-400">Subject name
                <input required value={editSubjectName} onChange={e => setEditSubjectName(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white" />
              </label>
              <label className="text-xs text-slate-400">Course title
                <input required value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white" />
              </label>
              <label className="text-xs text-slate-400">Category
                <input required value={editCategory} onChange={e => setEditCategory(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white" />
              </label>
              <label className="text-xs text-slate-400">Academic year
                <input required value={editAcademicYear} onChange={e => setEditAcademicYear(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white" />
              </label>
              <label className="text-xs text-slate-400">Periods per week
                <input required type="number" min={1} max={20} value={editPeriods} onChange={e => setEditPeriods(Number(e.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white" />
              </label>
              <label className="text-xs text-slate-400">Course color
                <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="mt-1 w-full h-11 bg-slate-950 border border-slate-700 rounded-xl p-1" />
              </label>
            </div>

            <label className="block text-xs text-slate-400">Chapters JSON
              <textarea required rows={16} value={editChaptersJson} onChange={e => setEditChaptersJson(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono" />
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingCourse(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
              <button disabled={savingCourse} type="submit" className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2">
                <Save className="w-4 h-4" /> {savingCourse ? 'Saving...' : 'Save Curriculum'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Chapter Syllabus Modal ─────────────────────────────────────────── */}
      {activeCourse && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg"
                  style={{ backgroundColor: `${activeCourse.color}25`, borderColor: activeCourse.color, border: '1px solid' }}
                >
                  <BookOpen className="w-6 h-6" style={{ color: activeCourse.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase"
                      style={{ backgroundColor: `${activeCourse.color}20`, color: activeCourse.color }}
                    >
                      {activeCourse.subject_code}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {activeCourse.grade_name} &bull; Academic Year {activeCourse.academic_year}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-1">
                    {activeCourse.title}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setActiveCourse(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Course Meta Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Assigned Instructor</div>
                <div className="text-xs font-bold text-slate-200 mt-0.5">{activeCourse.instructor_name}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Weekly Periods</div>
                <div className="text-xs font-bold text-cyan-400 mt-0.5">{activeCourse.periods_per_week} Periods / Wk</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Chapters</div>
                <div className="text-xs font-bold text-indigo-400 mt-0.5">{activeCourse.total_chapters} Chapters</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Estimated Pacing</div>
                <div className="text-xs font-bold text-amber-400 mt-0.5">{activeCourse.estimated_weeks} Weeks Total</div>
              </div>
            </div>

            {/* Chapters List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Prescribed NCERT/CBSE Chapters & Curriculum</span>
                <span className="text-slate-500 text-[11px]">Click checkbox to toggle topic completion</span>
              </div>

              <div className="space-y-3">
                {activeCourse.chapters.map((ch) => {
                  const doneKey = `${activeCourse.id}_ch_${ch.num}`
                  const isDone = !!completedChapters[doneKey]

                  return (
                    <div
                      key={ch.num}
                      className={`p-4 rounded-2xl border transition-all ${
                        isDone 
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200' 
                          : 'bg-slate-950/80 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleChapterDone(activeCourse.id, ch.num)}
                            className={`w-7 h-7 rounded-lg border mt-0.5 flex items-center justify-center transition-all ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-cyan-500'
                            }`}
                          >
                            {isDone ? <CheckCircle2 className="w-4 h-4 font-bold" /> : <CircleDot className="w-3.5 h-3.5" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-cyan-400">
                                Chapter {ch.num}
                              </span>
                              <span className="text-xs text-slate-500">&bull; {ch.duration_weeks} Weeks</span>
                              {isDone && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                  Completed
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-extrabold text-white mt-0.5">
                              {ch.title}
                            </h4>
                          </div>
                        </div>
                      </div>

                      {/* Topics */}
                      <div className="mt-3 pl-10 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {ch.topics.map((tp, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60 font-medium"
                            >
                              {tp}
                            </span>
                          ))}
                        </div>

                        {ch.outcomes && (
                          <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-1">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span><strong className="text-slate-300">Target Outcome:</strong> {ch.outcomes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800 pt-4 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-400">
                Official CBSE Board Standard Syllabus &bull; Session 2026-27
              </div>
              <button
                onClick={() => setActiveCourse(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
              >
                Close Syllabus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
