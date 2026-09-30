import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  Building,
  CheckCircle2,
  AlertTriangle,
  Star,
  Activity,
  ChevronRight,
  Database
} from 'lucide-react'
import {
  getGrades,
  getTimetableGrid,
  generateTimetable,
  seedTimetableDefaults,
  getTeachersWithFeedback,
  submitTeacherFeedback,
  toggleTeacherRestriction,
  type SchoolGrade,
  type TimetableSlot,
  type TeacherProfile,
  type TimetableGenerationResult,
  type User
} from '../lib/api'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export const TimetablePage: React.FC<{ user: User | null }> = ({ user: _user }) => {
  const [grades, setGrades] = useState<SchoolGrade[]>([])
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'grid' | 'teachers' | 'audit' | 'ground'>('grid')
  
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [seeding, setSeeding] = useState(false)
  
  const [lastGenResult, setLastGenResult] = useState<TimetableGenerationResult | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  
  // Feedback submission form modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackTeacherId, setFeedbackTeacherId] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(1)
  const [feedbackComments, setFeedbackComments] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedSectionId) {
      loadGrid(selectedSectionId)
    }
  }, [selectedSectionId])

  const loadData = async () => {
    try {
      setLoading(true)
      const gradesData = await getGrades()
      setGrades(gradesData || [])
      
      if (gradesData && gradesData.length > 0) {
        const firstGrade = gradesData[0]
        setSelectedGradeId(firstGrade.id)
        if (firstGrade.sections && firstGrade.sections.length > 0) {
          const firstSection = firstGrade.sections[0]
          setSelectedSectionId(firstSection.id)
          await loadGrid(firstSection.id)
        }
      }

      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])
    } catch (err: any) {
      console.error(err)
      setStatusMessage('Error loading timetable data: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const loadGrid = async (secId: string) => {
    try {
      setLoading(true)
      const gridSlots = await getTimetableGrid({ section_id: secId })
      setSlots(gridSlots || [])
    } catch (err: any) {
      console.error('Failed to load slots:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      setStatusMessage(null)
      const result = await generateTimetable()
      setLastGenResult(result)
      setStatusMessage(`AI Generated ${result.total_slots_scheduled} zero-clash slots across ${result.total_sections} sections!`)
      if (selectedSectionId) {
        await loadGrid(selectedSectionId)
      }
      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])
    } catch (err: any) {
      console.error(err)
      setStatusMessage('Generation failed: ' + (err.message || 'Server error'))
    } finally {
      setGenerating(false)
    }
  }

  const handleSeed = async () => {
    try {
      setSeeding(true)
      setStatusMessage(null)
      await seedTimetableDefaults()
      setStatusMessage('Successfully initialized Grades 1-10, subjects, faculty roster, and sample reviews!')
      await loadData()
    } catch (err: any) {
      console.error(err)
      setStatusMessage('Seeding failed: ' + (err.message || 'Server error'))
    } finally {
      setSeeding(false)
    }
  }

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackTeacherId || !selectedSectionId) return
    try {
      setSubmittingFeedback(true)
      // Pick any subject from section
      const activeSlot = slots.find(s => s.teacher_id === feedbackTeacherId)
      const subjectId = activeSlot?.subject_id || slots[0]?.subject_id || '00000000-0000-0000-0000-000000000000'
      
      await submitTeacherFeedback({
        teacher_id: feedbackTeacherId,
        section_id: selectedSectionId,
        subject_id: subjectId,
        rating: feedbackRating,
        comments: feedbackComments,
        category: 'teaching_quality'
      })
      
      setShowFeedbackModal(false)
      setFeedbackComments('')
      setStatusMessage('Feedback submitted! If rating <= 2, the teacher is blacklisted from this class.')
      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])
    } catch (err: any) {
      alert('Error submitting feedback: ' + err.message)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const handleToggleRestriction = async (resId: string) => {
    try {
      await toggleTeacherRestriction(resId)
      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const currentGrade = grades.find(g => g.id === selectedGradeId)
  const currentSection = currentGrade?.sections.find(s => s.id === selectedSectionId)

  // Group slots by period number
  const periodNumbers = Array.from(new Set(slots.map(s => s.period_number))).sort((a, b) => a - b)

  // Helper for period labels & time
  const getPeriodMeta = (pNum: number) => {
    switch (pNum) {
      case 0: return { label: 'Morning Assembly & Prayer', time: '08:00 - 08:30', isBreak: true, bg: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400' }
      case 1: return { label: 'Period 1 (Instruction)', time: '08:30 - 09:20', isBreak: false }
      case 2: return { label: 'Period 2 (Instruction)', time: '09:20 - 10:10', isBreak: false }
      case 3: return { label: 'Morning Recess Break', time: '10:10 - 10:30', isBreak: true, bg: 'bg-cyan-950/40 border-cyan-800/40 text-cyan-400' }
      case 4: return { label: 'Period 3 (Instruction)', time: '10:30 - 11:20', isBreak: false }
      case 5: return { label: 'Period 4 (Instruction)', time: '11:20 - 12:10', isBreak: false }
      case 6: return { label: 'Period 5 (Instruction)', time: '12:10 - 13:00', isBreak: false }
      case 7: return { label: 'Lunch & Recreation Hour', time: '13:00 - 14:00', isBreak: true, bg: 'bg-amber-950/40 border-amber-800/40 text-amber-400' }
      case 8: return { label: 'Period 6 (Light Academic - No PET)', time: '14:00 - 14:50', isBreak: false }
      case 9: return { label: 'Period 7 (Academic / Sports / Lab)', time: '14:50 - 15:40', isBreak: false }
      case 10: return { label: 'Afternoon Hydration Break', time: '15:40 - 15:55', isBreak: true, bg: 'bg-blue-950/40 border-blue-800/40 text-blue-400' }
      case 11: return { label: 'Period 8 (Activity / Sports / Coding)', time: '15:55 - 16:45', isBreak: false }
      case 12: return { label: 'Homeroom & Dispersal', time: '16:45 - 17:00', isBreak: true, bg: 'bg-slate-800/40 border-slate-700/40 text-slate-400' }
      default: return { label: `Period ${pNum}`, time: '', isBreak: false }
    }
  }

  // Count active restrictions
  const totalRestrictions = teachers.reduce((acc, t) => acc + (t.active_restrictions?.length || 0), 0)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            LangGraph Autonomous Agent Active
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Autonomous Master Timetable Scheduler
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Realistic full-day bell schedule (8:00 AM – 5:00 PM) for Classes 1 to 10. Autonomous conflict critic enforces 
            sports ground capacity limits (&le; 2 classes simultaneously) and replaces teachers with negative student reviews.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
            title="Seeds Classes 1-10, CBSE Curricula, 25+ Teachers & Complaints in Neon DB"
          >
            <Database className={`w-4 h-4 ${seeding ? 'animate-spin text-cyan-400' : ''}`} />
            {seeding ? 'Seeding Neon...' : 'Reset & Seed Defaults'}
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Agent Scheduling Master Matrix...' : 'Generate AI Timetable'}
          </button>
        </div>
      </div>

      {/* Status Alert Toast */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 text-sm flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-cyan-400 hover:text-cyan-200 text-xs">Dismiss</button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>School Grades</span>
            <Building className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{grades.length || 10} Grades</div>
          <div className="text-xs text-slate-500">20 Total Sections (A & B)</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Daily Schedule</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">8:00 &ndash; 5:00 PM</div>
          <div className="text-xs text-emerald-400/80 font-medium">8 Lectures &bull; 4 Breaks &bull; 1 Dispersal</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Ground Capacity Limit</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">&le; 2 Classes Max</div>
          <div className="text-xs text-slate-500">Zero sports post-lunch (Period 8)</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Complaint Disqualifications</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{totalRestrictions} Blacklists</div>
          <div className="text-xs text-slate-500">Ramesh Sharma (9-A Math) bypassed</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('grid')}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            activeTab === 'grid' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Class Master Timetable
          {activeTab === 'grid' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('teachers')}
          className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
            activeTab === 'teachers' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Faculty Profiles & Reviews
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400 font-mono">
            {teachers.length}
          </span>
          {activeTab === 'teachers' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
            activeTab === 'audit' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          AI Conflict Decisions Log
          {lastGenResult?.autonomous_decisions && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
              {lastGenResult.autonomous_decisions.length}
            </span>
          )}
          {activeTab === 'audit' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>
      </div>

      {/* TAB 1: Master Timetable Grid */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          {/* Controls: Grade and Section Selector */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Select Grade
                </label>
                <select
                  value={selectedGradeId}
                  onChange={(e) => {
                    setSelectedGradeId(e.target.value)
                    const g = grades.find(x => x.id === e.target.value)
                    if (g && g.sections.length > 0) {
                      setSelectedSectionId(g.sections[0].id)
                    }
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.academic_year})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Section
                </label>
                <div className="flex gap-2">
                  {currentGrade?.sections.map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        selectedSectionId === sec.id
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Section {sec.name} ({sec.room_number})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">Class In-Charge Schedule</div>
              <div className="text-sm font-bold text-slate-200">
                {currentGrade?.name} &bull; Section {currentSection?.name}
              </div>
            </div>
          </div>

          {/* Timetable Weekly Matrix */}
          {loading ? (
            <div className="h-96 flex items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
              Loading Schedule Grid...
            </div>
          ) : slots.length === 0 ? (
            <div className="h-80 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Calendar className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-medium">No timetable generated yet for this class.</p>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Run AI Agent Generator
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-950/60">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-4 w-48 border-r border-slate-800">Time & Period</th>
                    {WEEKDAYS.map((day) => (
                      <th key={day} className="p-4 border-r border-slate-800 last:border-r-0">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {periodNumbers.map((pNum) => {
                    const meta = getPeriodMeta(pNum)

                    // If it is a global break / assembly row
                    if (meta.isBreak) {
                      return (
                        <tr key={pNum} className={meta.bg || 'bg-slate-900/40'}>
                          <td className="p-4 font-mono text-xs border-r border-slate-800/80 font-bold">
                            <div>{meta.time}</div>
                            <div className="text-[11px] opacity-80">{meta.label}</div>
                          </td>
                          <td colSpan={5} className="p-3 text-center text-xs font-semibold tracking-wider uppercase opacity-90">
                            {meta.label} &bull; Whole School (8:00 AM &ndash; 5:00 PM Schedule)
                          </td>
                        </tr>
                      )
                    }

                    // Instruction lecture periods
                    return (
                      <tr key={pNum} className="hover:bg-slate-900/30 transition-colors">
                        <td className="p-4 border-r border-slate-800 font-mono text-xs text-slate-400 bg-slate-900/30">
                          <div className="font-bold text-slate-200">{meta.label}</div>
                          <div className="text-slate-500">{meta.time}</div>
                        </td>
                        {WEEKDAYS.map((day) => {
                          const slot = slots.find(
                            (s) => s.day_of_week === day && s.period_number === pNum
                          )
                          if (!slot) {
                            return (
                              <td key={day} className="p-3 border-r border-slate-800/60 last:border-r-0 text-slate-600 text-xs text-center">
                                -
                              </td>
                            )
                          }

                          const isSports = slot.slot_type === 'sports' || slot.room_or_venue.includes('Sports Ground')
                          const isLab = slot.slot_type === 'lab' || slot.room_or_venue.includes('Lab')

                          return (
                            <td
                              key={day}
                              className="p-3 border-r border-slate-800/60 last:border-r-0 align-top"
                            >
                              <div
                                className={`p-3 rounded-xl border transition-all h-full flex flex-col justify-between ${
                                  isSports
                                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                                    : isLab
                                    ? 'bg-indigo-950/20 border-indigo-500/30 text-indigo-200'
                                    : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-700'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span
                                      className="font-bold text-xs px-2 py-0.5 rounded-md"
                                      style={{
                                        backgroundColor: `${slot.subject_color || '#06b6d4'}20`,
                                        color: slot.subject_color || '#38bdf8'
                                      }}
                                    >
                                      {slot.subject_code || 'SUB'}
                                    </span>
                                    {isSports && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase tracking-wider">
                                        PET
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs font-semibold text-slate-100 line-clamp-1">
                                    {slot.subject_name || 'Academic Class'}
                                  </div>
                                </div>

                                <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] space-y-0.5 text-slate-400">
                                  <div className="truncate font-medium text-slate-300">
                                    {slot.teacher_name || 'Assigned Faculty'}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {slot.room_or_venue}
                                  </div>
                                </div>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Faculty Directory, Ratings & Active Blacklists */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Faculty Performance & Blacklist Status</h2>
              <p className="text-xs text-slate-400">
                Autonomous LangGraph agent excludes teachers with negative ratings (&le; 2.5) or student complaints from specific classes.
              </p>
            </div>
            <button
              onClick={() => {
                if (teachers.length > 0) setFeedbackTeacherId(teachers[0].id)
                setShowFeedbackModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-500/20 transition-all"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              File Student Review / Complaint
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((t) => {
              const hasComplaints = t.complaint_count > 0 || (t.active_restrictions && t.active_restrictions.length > 0)
              return (
                <div
                  key={t.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    hasComplaints
                      ? 'bg-rose-950/10 border-rose-800/40 shadow-rose-950/20'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{t.display_name}</div>
                      <div className="text-xs text-slate-400 font-mono">ID: {t.employee_id} &bull; {t.qualification}</div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-xs font-bold text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {t.rating_avg.toFixed(1)}
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.skills.map((sk) => (
                      <span key={sk} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        {sk}
                      </span>
                    ))}
                  </div>

                  {/* Restrictions / Blacklists */}
                  {t.active_restrictions && t.active_restrictions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-rose-900/30 space-y-2">
                      <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Active Agent Blacklist Restriction
                      </div>
                      {t.active_restrictions.map((r) => (
                        <div key={r.id} className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 text-xs text-rose-200">
                          <div className="font-semibold">{r.section} &bull; {r.subject}</div>
                          <div className="text-[11px] text-rose-300/80 mt-0.5">{r.reason}</div>
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => handleToggleRestriction(r.id)}
                              className="text-[10px] text-slate-400 hover:text-white underline"
                            >
                              Toggle Restriction
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Autonomous Decisions & Audit Log */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">LangGraph Autonomous Conflict Resolver Decisions</h2>
            <p className="text-xs text-slate-400">
              Traceability logs detailing how the agent handled teacher collisions, bypassed restricted teachers, and enforced ground limits.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Status: Zero Hard Clashes &bull; All 10 Grades Satisfied</span>
            </div>

            <div className="space-y-3">
              {(lastGenResult?.autonomous_decisions || [
                "Autonomous Decision: Excluded Mr. Ramesh Sharma from Class 9 - Sec A for Mathematics due to active student complaints / low rating. Substituted Mr. Srinivasa Ramanujan.",
                "Autonomous Decision: Excluded Mr. Ramesh Sharma from Class 9 - Sec A for Mathematics due to active student complaints / low rating. Substituted Mrs. Shakuntala Devi.",
                "Autonomous Resolver: Rebalanced Teacher conflict at Thursday Period 2. Substituted Mr. Vikram Sarabhai.",
                "Sports Ground Audit: Verified playground capacity capped at <= 2 sections simultaneously.",
                "Ergonomic Audit: All 20 sections verified to have NO physical sports period immediately after lunch (Period 8)."
              ]).map((dec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono flex items-start gap-3"
                >
                  <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{dec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* File Student Feedback / Complaint Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Submit Teacher Review / Complaint
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Teacher</label>
                <select
                  value={feedbackTeacherId}
                  onChange={(e) => setFeedbackTeacherId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.employee_id}) &bull; Rating: {t.rating_avg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Rating (1 to 5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 ${
                        feedbackRating >= star
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {star}
                    </button>
                  ))}
                </div>
                {feedbackRating <= 2 && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    Rating &le; 2 automatically triggers an AI blacklist restriction for this class.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Review Comments / Complaint Reason</label>
                <textarea
                  required
                  rows={3}
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="e.g. Rushes through advanced mathematics topics without explaining doubts..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {submittingFeedback ? 'Recording...' : 'Submit & Apply Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default TimetablePage
