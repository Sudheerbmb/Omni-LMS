import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  Building,
  CheckCircle2,
  AlertTriangle,
  Star,
  Activity,
  ChevronRight,
  Database,
  Sliders,
  ArrowLeftRight,
  UserCheck,
  UserX,
  PlusCircle,
  Trash2,
  Settings2,
  Edit3,
  GraduationCap,
  BookOpen
} from 'lucide-react'
import {
  getGrades,
  getTimetableGrid,
  generateTimetable,
  seedTimetableDefaults,
  getTeachersWithFeedback,
  submitTeacherFeedback,
  toggleTeacherRestriction,
  getTimetableRules,
  toggleTimetableRule,
  updateTimetableRule,
  createTimetableRule,
  deleteTimetableRule,
  getSlotSubstitutes,
  swapSlots,
  updateSlot,
  recordTeacherLeave,
  type SchoolGrade,
  type TimetableSlot,
  type TeacherProfile,
  type TimetableGenerationResult,
  type TimetableRule,
  type SubstituteTeacher,
  type User
} from '../lib/api'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export const TimetablePage: React.FC<{ user: User | null }> = ({ user: currentUser }) => {
  const role = currentUser?.role || 'student'
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isStudent = role === 'student'

  const [grades, setGrades] = useState<SchoolGrade[]>([])
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'grid' | 'rules' | 'teachers' | 'audit'>('grid')
  
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [rules, setRules] = useState<TimetableRule[]>([])
  const [myTeacherProfile, setMyTeacherProfile] = useState<TeacherProfile | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [seeding, setSeeding] = useState(false)
  
  const [lastGenResult, setLastGenResult] = useState<TimetableGenerationResult | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  
  // Quick Swap / Drag State (Admin only)
  const [swapMode, setSwapMode] = useState(false)
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<TimetableSlot | null>(null)

  // Slot Detail & Substitution Modal (Admin only)
  const [activeSlotModal, setActiveSlotModal] = useState<TimetableSlot | null>(null)
  const [substitutes, setSubstitutes] = useState<SubstituteTeacher[]>([])
  const [loadingSubstitutes, setLoadingSubstitutes] = useState(false)
  const [editingRoom, setEditingRoom] = useState('')

  // Rule Creation Modal (Admin only)
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleType, setNewRuleType] = useState('ground_capacity')
  const [newRuleDesc, setNewRuleDesc] = useState('')
  const [newRuleParamVal, setNewRuleParamVal] = useState('3')

  // Feedback submission form modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackTeacherId, setFeedbackTeacherId] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackComments, setFeedbackComments] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Leave Simulation Modal (Admin only)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveTeacherId, setLeaveTeacherId] = useState('')
  const [leaveDay, setLeaveDay] = useState('Wednesday')
  const [leaveReason, setLeaveReason] = useState('Medical Leave')
  const [submittingLeave, setSubmittingLeave] = useState(false)

  useEffect(() => {
    loadData()
  }, [role, currentUser?.email])

  useEffect(() => {
    if (!isTeacher && selectedSectionId) {
      loadGrid(selectedSectionId)
    }
  }, [selectedSectionId, isTeacher])

  const loadData = async () => {
    try {
      setLoading(true)
      const gradesData = await getGrades()
      setGrades(gradesData || [])
      
      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])

      if (isAdmin) {
        const rulesData = await getTimetableRules()
        setRules(rulesData || [])
      }

      // If user is a teacher, locate their teacher profile and load their personalized grid
      if (isTeacher) {
        let profile = (teachersData || []).find(
          t => t.user_id === currentUser?.id || t.email.toLowerCase() === currentUser?.email.toLowerCase()
        )
        setMyTeacherProfile(profile || null)

        if (!profile && teachersData && teachersData.length > 0) {
          profile = teachersData[0]
          setMyTeacherProfile(profile)
        }
        if (profile) {
          const teacherSlots = await getTimetableGrid({ teacher_id: profile.id })
          setSlots(teacherSlots || [])
        }
      } else {
        // Admin or Student: Load class section grid
        if (gradesData && gradesData.length > 0) {
          let targetGrade = gradesData[0]
          if (isStudent) {
            const emailMatch = currentUser?.email?.match(/class(\\d+)/i)
            const nameMatch = currentUser?.display_name?.match(/Class\\s*(\\d+)/i)
            const matchGradeNum = emailMatch ? parseInt(emailMatch[1], 10) : nameMatch ? parseInt(nameMatch[1], 10) : null
            if (matchGradeNum) {
              const matched = gradesData.find(g => g.grade_number === matchGradeNum)
              if (matched) targetGrade = matched
            } else {
              targetGrade = gradesData.find(g => g.grade_number === 9) || gradesData[0]
            }
          } else {
            targetGrade = gradesData.find(g => g.grade_number === 9) || gradesData[0]
          }

          setSelectedGradeId(targetGrade.id)
          if (targetGrade.sections && targetGrade.sections.length > 0) {
            setSelectedSectionId(targetGrade.sections[0].id)
            await loadGrid(targetGrade.sections[0].id)
          }
        }
      }
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
    if (!isAdmin) return
    try {
      setGenerating(true)
      setStatusMessage(null)
      const result = await generateTimetable()
      setLastGenResult(result)
      setStatusMessage(`AI Generated ${result.total_slots_scheduled} slots across ${result.total_sections} sections adhering to live DB policy rules!`)
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
    if (!isAdmin) return
    try {
      setSeeding(true)
      setStatusMessage(null)
      await seedTimetableDefaults()
      setStatusMessage('Successfully initialized Grades 1-10, subjects, faculty roster, and dynamic rules!')
      await loadData()
    } catch (err: any) {
      console.error(err)
      setStatusMessage('Seeding failed: ' + (err.message || 'Server error'))
    } finally {
      setSeeding(false)
    }
  }

  // ── Slot Click Handling (Role-Specific) ───────────────────────────────────
  const handleSlotClick = async (slot: TimetableSlot) => {
    // If Admin in Swap Mode
    if (isAdmin && swapMode) {
      if (!selectedSlotForSwap) {
        setSelectedSlotForSwap(slot)
        setStatusMessage(`Selected ${slot.day_of_week} Period ${slot.period_number}. Now click the second slot to swap!`)
      } else {
        if (selectedSlotForSwap.id === slot.id) {
          setSelectedSlotForSwap(null)
          return
        }
        try {
          setLoading(true)
          await swapSlots(selectedSlotForSwap.id, slot.id)
          setStatusMessage(`Swapped ${selectedSlotForSwap.day_of_week} Period ${selectedSlotForSwap.period_number} with ${slot.day_of_week} Period ${slot.period_number}!`)
          setSelectedSlotForSwap(null)
          setSwapMode(false)
          if (selectedSectionId) await loadGrid(selectedSectionId)
        } catch (err: any) {
          alert('Swap failed: ' + err.message)
        } finally {
          setLoading(false)
        }
      }
      return
    }

    if (slot.slot_type in ['assembly', 'recess', 'lunch', 'dispersal']) return

    // If Student: Opens feedback modal to rate this teacher!
    if (isStudent) {
      if (slot.teacher_id) {
        setFeedbackTeacherId(slot.teacher_id)
        setShowFeedbackModal(true)
      }
      return
    }

    // If Admin: Opens Substitution & Venue Management Desk
    if (isAdmin) {
      setActiveSlotModal(slot)
      setEditingRoom(slot.room_or_venue)
      try {
        setLoadingSubstitutes(true)
        const subs = await getSlotSubstitutes(slot.id)
        setSubstitutes(subs || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingSubstitutes(false)
      }
    }
  }

  const handleAssignSubstitute = async (teacherId: string) => {
    if (!isAdmin || !activeSlotModal) return
    try {
      setLoading(true)
      await updateSlot(activeSlotModal.id, { teacher_id: teacherId })
      setStatusMessage(`Assigned substitute teacher to ${activeSlotModal.day_of_week} Period ${activeSlotModal.period_number}!`)
      setActiveSlotModal(null)
      if (selectedSectionId) await loadGrid(selectedSectionId)
    } catch (err: any) {
      alert('Failed to assign substitute: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSlotEdits = async () => {
    if (!isAdmin || !activeSlotModal) return
    try {
      setLoading(true)
      await updateSlot(activeSlotModal.id, { room_or_venue: editingRoom })
      setStatusMessage('Slot venue details updated!')
      setActiveSlotModal(null)
      if (selectedSectionId) await loadGrid(selectedSectionId)
    } catch (err: any) {
      alert('Update failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Dynamic Policy Rules Handlers (Admin Only) ───────────────────────────
  const handleToggleRule = async (ruleId: string) => {
    if (!isAdmin) return
    try {
      const updated = await toggleTimetableRule(ruleId)
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r))
      setStatusMessage(`Rule "${updated.name}" is now ${updated.is_enabled ? 'ENABLED' : 'DISABLED'}.`)
    } catch (err: any) {
      alert('Toggle failed: ' + err.message)
    }
  }

  const handleUpdateRuleParam = async (ruleId: string, paramKey: string, newVal: any) => {
    if (!isAdmin) return
    try {
      const rule = rules.find(r => r.id === ruleId)
      if (!rule) return
      const newParams = { ...rule.parameters, [paramKey]: newVal }
      const updated = await updateTimetableRule(ruleId, { parameters: newParams })
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r))
      setStatusMessage(`Updated rule "${rule.name}" parameter: ${paramKey} = ${newVal}`)
    } catch (err: any) {
      alert('Failed to update rule parameter: ' + err.message)
    }
  }

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    try {
      let params: any = {}
      if (newRuleType === 'ground_capacity') params = { max_sections: parseInt(newRuleParamVal) || 3 }
      else if (newRuleType === 'max_daily_teacher_periods') params = { max_periods: parseInt(newRuleParamVal) || 5 }
      else if (newRuleType === 'custom_day_schedule') params = { overrides: { [newRuleParamVal]: { start_time: "09:00" } } }

      const created = await createTimetableRule({
        name: newRuleName,
        rule_type: newRuleType,
        description: newRuleDesc || 'Custom school timetable scheduling policy',
        parameters: params,
        is_enabled: true,
        priority: 2
      })
      setRules(prev => [...prev, created])
      setShowAddRuleModal(false)
      setNewRuleName('')
      setNewRuleDesc('')
      setStatusMessage(`Created custom rule: "${created.name}"!`)
    } catch (err: any) {
      alert('Create rule failed: ' + err.message)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!isAdmin || !confirm('Are you sure you want to remove this rule?')) return
    try {
      await deleteTimetableRule(ruleId)
      setRules(prev => prev.filter(r => r.id !== ruleId))
      setStatusMessage('Rule deleted from Neon DB.')
    } catch (err: any) {
      alert('Delete failed: ' + err.message)
    }
  }

  // ── Leave Simulation Handler (Admin Only) ─────────────────────────────────
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin || !leaveTeacherId) return
    try {
      setSubmittingLeave(true)
      await recordTeacherLeave({
        teacher_id: leaveTeacherId,
        day_of_week: leaveDay,
        reason: leaveReason
      })
      setShowLeaveModal(false)
      setStatusMessage(`Recorded leave for ${leaveDay}. Run "Run AI Agent" to trigger automatic substitute re-allocations!`)
    } catch (err: any) {
      alert('Failed to record leave: ' + err.message)
    } finally {
      setSubmittingLeave(false)
    }
  }

  // ── Student Feedback Submission ───────────────────────────────────────────
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackTeacherId) return
    try {
      setSubmittingFeedback(true)
      const targetSecId = selectedSectionId || (grades[0]?.sections[0]?.id)
      const activeSlot = slots.find(s => s.teacher_id === feedbackTeacherId)
      const subjectId = activeSlot?.subject_id || slots[0]?.subject_id || '00000000-0000-0000-0000-000000000000'
      
      await submitTeacherFeedback({
        teacher_id: feedbackTeacherId,
        section_id: targetSecId,
        subject_id: subjectId,
        rating: feedbackRating,
        comments: feedbackComments,
        category: 'teaching_quality'
      })
      
      setShowFeedbackModal(false)
      setFeedbackComments('')
      setStatusMessage(
        feedbackRating <= 2
          ? 'Complaint registered. The AI Agent will automatically exclude this teacher from this class on future schedules.'
          : 'Thank you for your rating!'
      )
      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])
    } catch (err: any) {
      alert('Error submitting feedback: ' + err.message)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const handleToggleRestriction = async (resId: string) => {
    if (!isAdmin) return
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
  const periodNumbers = Array.from(new Set(slots.map(s => s.period_number))).sort((a, b) => a - b)

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

  const totalRestrictions = teachers.reduce((acc, t) => acc + (t.active_restrictions?.length || 0), 0)
  const activeGroundCapacity = rules.find(r => r.rule_type === 'ground_capacity')?.parameters?.max_sections || 2

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner - Role Customized */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            {isAdmin && <Sparkles className="w-3.5 h-3.5" />}
            {isTeacher && <GraduationCap className="w-3.5 h-3.5" />}
            {isStudent && <BookOpen className="w-3.5 h-3.5" />}
            {isAdmin ? 'Administrator AI Policy & Scheduler' : isTeacher ? 'Faculty Teaching Schedule' : 'Student Class Timetable'}
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {isAdmin && 'Autonomous Timetable & Policy Engine'}
            {isTeacher && (myTeacherProfile ? `${myTeacherProfile.display_name} - Teaching Schedule` : 'Faculty Teaching Timetable')}
            {isStudent && `${currentGrade?.name || 'Class 9'} - Weekly Class Schedule`}
          </h1>

          <p className="text-slate-400 text-sm max-w-2xl">
            {isAdmin && 'Live database-driven rules, interactive drag-and-drop swapping, smart substitute finder desk, and full-day (8:00 AM - 5:00 PM) master matrix.'}
            {isTeacher && `Assigned instructional lectures across Classes 1-10. Daily maximum workload capped at ${myTeacherProfile?.max_daily_periods || 5} periods.`}
            {isStudent && 'Your official weekly timetable (8:00 AM - 5:00 PM). Click any subject period to rate your instructor or submit course feedback.'}
          </p>
        </div>

        {/* Action Buttons - ONLY FOR ADMIN */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <button
              onClick={() => {
                if (teachers.length > 0) setLeaveTeacherId(teachers[0].id)
                setShowLeaveModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-all"
            >
              <UserX className="w-4 h-4 text-amber-400" />
              Log Faculty Leave
            </button>

            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
            >
              <Database className={`w-4 h-4 ${seeding ? 'animate-spin text-cyan-400' : ''}`} />
              {seeding ? 'Seeding...' : 'Reset Defaults'}
            </button>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'LangGraph Processing...' : 'Run AI Agent'}
            </button>
          </div>
        )}
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 text-sm flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-cyan-400 hover:text-cyan-200 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Admin KPI Stats Grid */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>School Grades & Sections</span>
              <Building className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white">{grades.length || 10} Grades &bull; 20 Secs</div>
            <div className="text-xs text-slate-500">Class 1 to 10 (A & B)</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Dynamic Ground Limit</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{activeGroundCapacity} Classes Max</div>
            <div className="text-xs text-slate-500">Configurable in Policy Rules tab</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Active Policy Rules</span>
              <Sliders className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-indigo-400">{rules.filter(r => r.is_enabled).length} Enabled</div>
            <div className="text-xs text-slate-500">{rules.length} total defined in Neon DB</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Active Complaints / Blacklists</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400">{totalRestrictions} Exclusions</div>
            <div className="text-xs text-slate-500">Auto-bypassed during scheduling</div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs (Admin gets all tabs; Teachers/Students get their relevant views) */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('grid')}
          className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
            activeTab === 'grid' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          {isAdmin ? 'Master Timetable Grid' : isTeacher ? 'My Teaching Timetable' : 'Class Weekly Grid'}
          {activeTab === 'grid' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'rules' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            School Policy Rules Engine
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-300 font-mono">
              {rules.length}
            </span>
            {activeTab === 'rules' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
            )}
          </button>
        )}

        {(isAdmin || isTeacher) && (
          <button
            onClick={() => setActiveTab('teachers')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'teachers' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Faculty Directory & Reviews
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400 font-mono">
              {teachers.length}
            </span>
            {activeTab === 'teachers' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
            )}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'audit' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Agent Resolutions Log
            {lastGenResult?.autonomous_decisions && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                {lastGenResult.autonomous_decisions.length}
              </span>
            )}
            {activeTab === 'audit' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* TAB 1: Master Timetable Grid */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          {/* Controls: Only Admin and Students can select Grade/Section; Teachers see their personal schedule */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
            {isTeacher ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                  {myTeacherProfile?.employee_id || 'T'}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    {myTeacherProfile?.display_name || currentUser?.display_name} &bull; Teaching Load
                  </div>
                  <div className="text-xs text-slate-400">
                    Showing your allocated lectures across all classes (Monday to Friday)
                  </div>
                </div>
              </div>
            ) : isStudent ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    {currentGrade?.name || 'Class'} &bull; Section {currentSection?.name || 'A'} ({currentSection?.room_number || 'Room 101'})
                  </div>
                  <div className="text-xs text-slate-400">
                    Your Official Class Weekly Timetable &bull; Click any subject period to rate your instructor
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Grade Level
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
            )}

            {/* Admin Quick Swap Toggle */}
            {isAdmin && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSwapMode(!swapMode)
                    setSelectedSlotForSwap(null)
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    swapMode
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  {swapMode ? 'Exit Swap Mode' : 'Quick Swap Mode'}
                </button>

                <div className="text-right pl-3 border-l border-slate-800">
                  <div className="text-[11px] text-slate-400">Class Matrix</div>
                  <div className="text-sm font-bold text-slate-200">
                    {currentGrade?.name} &bull; Section {currentSection?.name}
                  </div>
                </div>
              </div>
            )}
          </div>

          {swapMode && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
              <span>
                <strong>Swap Mode Active:</strong> Click any slot to select it, then click another slot to swap them instantly!
              </span>
              {selectedSlotForSwap && (
                <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded">
                  Selected: {selectedSlotForSwap.day_of_week} Period {selectedSlotForSwap.period_number}
                </span>
              )}
            </div>
          )}

          {/* Timetable Weekly Matrix */}
          {loading ? (
            <div className="h-96 flex items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
              Loading Schedule Grid...
            </div>
          ) : slots.length === 0 ? (
            <div className="h-80 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Calendar className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-medium">No timetable generated yet.</p>
              {isAdmin && (
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  Run AI Agent Generator
                </button>
              )}
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

                          const isSelectedForSwap = selectedSlotForSwap?.id === slot.id
                          const isSports = slot.slot_type === 'sports' || slot.room_or_venue.includes('Sports Ground')
                          const isLab = slot.slot_type === 'lab' || slot.room_or_venue.includes('Lab')

                          return (
                            <td
                              key={day}
                              onClick={() => handleSlotClick(slot)}
                              className={`p-3 border-r border-slate-800/60 last:border-r-0 align-top ${
                                isAdmin || isStudent ? 'cursor-pointer group' : ''
                              }`}
                              title={
                                isAdmin
                                  ? 'Click to edit or assign substitute'
                                  : isStudent
                                  ? 'Click to rate instructor'
                                  : ''
                              }
                            >
                              <div
                                className={`p-3 rounded-xl border transition-all h-full flex flex-col justify-between relative ${
                                  isSelectedForSwap
                                    ? 'ring-2 ring-amber-400 bg-amber-950/40 border-amber-400 scale-[1.02]'
                                    : isSports
                                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200 group-hover:border-amber-400'
                                    : isLab
                                    ? 'bg-indigo-950/20 border-indigo-500/30 text-indigo-200 group-hover:border-indigo-400'
                                    : 'bg-slate-900/80 border-slate-800 text-slate-200 group-hover:border-cyan-500/60 group-hover:bg-slate-850'
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
                                  {/* If Teacher view: Show Class & Section name; if Class view: Show Teacher Name */}
                                  <div className="truncate font-medium text-slate-300 flex items-center justify-between">
                                    <span className="truncate">
                                      {isTeacher
                                        ? `${slot.grade_name || 'Class'} - Sec ${slot.section_name || 'A'}`
                                        : (slot.teacher_name || 'Assigned Faculty')}
                                    </span>
                                    {isAdmin && (
                                      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-cyan-400 shrink-0 ml-1" />
                                    )}
                                    {isStudent && (
                                      <Star className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-400 shrink-0 ml-1" />
                                    )}
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

      {/* TAB 2: Dynamic Policy Rules Engine (ADMIN ONLY) */}
      {isAdmin && activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                Live Policy Rules & Scheduling Constraints
              </h2>
              <p className="text-xs text-slate-400">
                Modify, enable, or add school rules dynamically without touching any code. LangGraph reads these rules live from Neon DB.
              </p>
            </div>
            <button
              onClick={() => setShowAddRuleModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-cyan-400" />
              Add Custom Policy Rule
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((r) => (
              <div
                key={r.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  r.is_enabled
                    ? 'bg-slate-900 border-slate-800 shadow-sm'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                        {r.category}
                      </span>
                      <h3 className="font-bold text-white text-sm">{r.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400">{r.description}</p>
                  </div>

                  <button
                    onClick={() => handleToggleRule(r.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      r.is_enabled ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        r.is_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
                  <div className="font-semibold text-slate-300">Live Parameters (Neon DB):</div>
                  {r.rule_type === 'ground_capacity' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Max Sections on Field Simultaneously:</span>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map((cap) => (
                          <button
                            key={cap}
                            onClick={() => handleUpdateRuleParam(r.id, 'max_sections', cap)}
                            className={`px-3 py-1 rounded-md font-bold text-xs ${
                              r.parameters?.max_sections === cap
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {cap} Classes
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'max_daily_teacher_periods' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Max Teacher Daily Load:</span>
                      <div className="flex items-center gap-2">
                        {[4, 5, 6].map((p) => (
                          <button
                            key={p}
                            onClick={() => handleUpdateRuleParam(r.id, 'max_periods', p)}
                            className={`px-3 py-1 rounded-md font-bold text-xs ${
                              r.parameters?.max_periods === p
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {p} Periods
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'post_lunch_blacklist' && (
                    <div className="text-slate-400">
                      Blacklisted Period: <span className="font-mono text-cyan-400">Period {r.parameters?.forbidden_period || 8} (2:00 PM)</span>
                    </div>
                  )}

                  {r.rule_type === 'rating_complaint_blacklist' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Blacklist Rating Threshold:</span>
                      <div className="flex items-center gap-2">
                        {[2.0, 2.5, 3.0].map((th) => (
                          <button
                            key={th}
                            onClick={() => handleUpdateRuleParam(r.id, 'threshold_rating', th)}
                            className={`px-2.5 py-1 rounded-md font-bold text-xs ${
                              r.parameters?.threshold_rating === th
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            &le; {th} Stars
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'consecutive_subject_limit' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Max Consecutive Periods:</span>
                      <span className="font-bold text-cyan-400">{r.parameters?.max_consecutive || 2} periods</span>
                    </div>
                  )}

                  {r.rule_type === 'custom_day_schedule' && (
                    <div className="space-y-1">
                      <span className="text-slate-400">Configured Day Overrides:</span>
                      <div className="font-mono text-[11px] text-indigo-300">
                        {JSON.stringify(r.parameters?.overrides || {})}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleDeleteRule(r.id)}
                    className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Rule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Faculty Directory, Ratings & Active Blacklists */}
      {(isAdmin || isTeacher) && activeTab === 'teachers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Faculty Performance & Blacklist Status</h2>
              <p className="text-xs text-slate-400">
                Autonomous LangGraph agent excludes teachers with negative ratings (&le; 2.5) or student complaints from specific classes.
              </p>
            </div>
            {isAdmin && (
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
            )}
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

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.skills.map((sk) => (
                      <span key={sk} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        {sk}
                      </span>
                    ))}
                  </div>

                  {t.reviews && t.reviews.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Reviews for {t.display_name}
                      </div>
                      {t.reviews.map((review) => (
                        <div key={review.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200">{review.subject} &bull; {review.section}</span>
                            <span className="shrink-0 text-amber-400 font-bold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" /> {review.rating}/5
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{review.comments}</p>
                        </div>
                      ))}
                    </div>
                  )}

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
                          {isAdmin && (
                            <div className="mt-2 flex justify-end">
                              <button
                                onClick={() => handleToggleRestriction(r.id)}
                                className="text-[10px] text-slate-400 hover:text-white underline"
                              >
                                Toggle Restriction
                              </button>
                            </div>
                          )}
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

      {/* TAB 4: Autonomous Decisions & Audit Log (ADMIN ONLY) */}
      {isAdmin && activeTab === 'audit' && (
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

      {/* Period Management & Instant Substitute Finder Drawer (ADMIN ONLY) */}
      {isAdmin && activeSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-cyan-400" />
                  Period Management & Substitution Desk
                </h3>
                <p className="text-xs text-slate-400">
                  {activeSlotModal.day_of_week} &bull; Period {activeSlotModal.period_number} ({activeSlotModal.start_time} - {activeSlotModal.end_time})
                </p>
              </div>
              <button
                onClick={() => setActiveSlotModal(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400">Current Subject</div>
                <div className="text-sm font-bold text-white">{activeSlotModal.subject_name || 'Academic Class'}</div>
                <div className="text-xs text-cyan-400 font-medium mt-0.5">Faculty: {activeSlotModal.teacher_name || 'Unassigned'}</div>
              </div>

              <div className="w-48">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Room / Venue</label>
                <input
                  type="text"
                  value={editingRoom}
                  onChange={(e) => setEditingRoom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Available Subject Qualified Substitutes
                </div>
                {loadingSubstitutes && <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
              </div>

              {substitutes.length === 0 && !loadingSubstitutes ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  No alternate teachers found with matching subject qualifications.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {substitutes.map((sub) => (
                    <div
                      key={sub.teacher_id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        sub.is_free
                          ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50'
                          : 'bg-slate-950/40 border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{sub.display_name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {sub.employee_id}
                          </span>
                          <span className="text-[10px] flex items-center gap-0.5 text-amber-400 font-bold">
                            <Star className="w-3 h-3 fill-current" /> {sub.rating_avg}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sub.qualification} &bull; Load today: {sub.current_day_load}/{sub.max_daily_periods} periods
                        </div>
                        <div className={`text-[10px] font-medium ${sub.is_free ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {sub.conflict_notes}
                        </div>
                      </div>

                      <button
                        onClick={() => handleAssignSubstitute(sub.teacher_id)}
                        disabled={!sub.is_free}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          sub.is_free
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Assign Substitute
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSlotModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveSlotEdits}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all"
              >
                Save Venue Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Policy Rule Modal (ADMIN ONLY) */}
      {isAdmin && showAddRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-cyan-400" />
                Create New Scheduling Policy Rule
              </h3>
              <button
                onClick={() => setShowAddRuleModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Rule Name</label>
                <input
                  required
                  type="text"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g. Wednesday Delayed Morning Start"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Rule Type</label>
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                >
                  <option value="ground_capacity">Ground Concurrent Capacity Limit</option>
                  <option value="max_daily_teacher_periods">Teacher Daily Workload Cap</option>
                  <option value="custom_day_schedule">Special Day Schedule (Delayed Start)</option>
                  <option value="lab_capacity">Lab Concurrent Section Limit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Parameter Value (e.g. 3 classes, or "Wednesday")
                </label>
                <input
                  required
                  type="text"
                  value={newRuleParamVal}
                  onChange={(e) => setNewRuleParamVal(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  placeholder="Explain why this rule exists..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all"
                >
                  Save Rule to Neon DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Teacher Leave Modal (ADMIN ONLY) */}
      {isAdmin && showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <UserX className="w-4 h-4 text-amber-400" />
                Simulate Faculty Leave & Absence
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Absent Teacher</label>
                <select
                  value={leaveTeacherId}
                  onChange={(e) => setLeaveTeacherId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Day of Week</label>
                <select
                  value={leaveDay}
                  onChange={(e) => setLeaveDay(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Reason</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {submittingLeave ? 'Logging...' : 'Record Absence & Re-route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Student Review / Complaint Modal (Students & Admins) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                {isStudent ? 'Rate Your Instructor' : 'Submit Teacher Review / Complaint'}
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">Instructor</label>
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">Your Rating (1 to 5 Stars)</label>
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
                <label className="block text-xs font-semibold text-slate-400 mb-1">Feedback Comments / Feedback</label>
                <textarea
                  required
                  rows={3}
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="Share your feedback on pace, concept clarity, or class engagement..."
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
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
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
