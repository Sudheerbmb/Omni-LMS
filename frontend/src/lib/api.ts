export const getApiBaseUrl = (): string => {

  if (import.meta.env.VITE_API_URL && typeof import.meta.env.VITE_API_URL === 'string') {

    return import.meta.env.VITE_API_URL

  }

  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {

    return 'https://omni-lms.onrender.com'

  }

  return 'http://127.0.0.1:8000'

}

export const getWsBaseUrl = (): string => {

  const api = getApiBaseUrl()

  try {

    const parsed = new URL(api)

    const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:'

    return `${wsProto}//${parsed.host}`

  } catch {

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

    return `${wsProto}//${window.location.host}`

  }

}

export class ApiError extends Error {

  status: number

  constructor(status: number, message: string) {

    super(message)

    this.status = status

  }

}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {

  const token = localStorage.getItem('lms_access_token')

  const headers = new Headers(options.headers)

  if (!(options.body instanceof FormData)) {

    headers.set('Content-Type', 'application/json')

  }

  if (token) headers.set('Authorization', `Bearer ${token}`)

  const apiBase = getApiBaseUrl()

  const baseUrl = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed'
    throw new ApiError(0, `Cannot reach the LMS backend at ${baseUrl}. ${message}. Please retry after the service wakes up.`)
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {

    if (response.status === 401) localStorage.removeItem('lms_access_token')

    throw new ApiError(response.status, body?.detail ?? 'The request could not be completed.')

  }

  return body as T

}

// Data Types

export type User = { id: string; email: string; phone_number: string | null; display_name: string; role: 'admin' | 'teacher' | 'student'; status: string; avatar_url?: string }

export type Organization = { id: string; name: string; slug: string; status: string }

export type OrgMember = { id: string; user_id: string; role: string; user?: User }

export type Course = { 

  id: string; 

  organization_id: string; 

  title: string; 

  slug: string; 

  description?: string;

  level?: string;

  status: string; 

  current_version: number;

  thumbnail_url?: string;

  rating_avg?: number;

  rating_count?: number;

}

export type CourseListResponse = { items: Course[]; total: number; page: number; page_size: number; pages: number }

export type DashboardSummary = { role: User['role']; user: User; stats: Record<string, number> }

export type AdminUser = User & { created_at: string }

export type Notification = { id: string; notification_type: string; title: string; body: string; read_at: string | null; created_at: string }

export type AssessmentQuestion = { id: string; question_text: string; question_type: string; options?: any; points: number }

export type Assessment = { id: string; course_id: string; title: string; description?: string; passing_score: number; questions: AssessmentQuestion[] }

export type AssessmentAttempt = { id: string; assessment_id: string; score: number; passed: boolean; created_at: string }

export type AssignmentSubmission = { id: string; assignment_id: string; student_id?: string; user_id?: string; content: string; file_url?: string; grade?: number; score?: number | null; status?: string; feedback?: string | null; created_at?: string }

export type Assignment = { id: string; course_id: string; title: string; description: string; instructions?: string; status?: string; due_date?: string; max_score: number; submissions?: AssignmentSubmission[] }

export type Certificate = { id: string; user_id: string; course_id: string; certificate_number: string; issued_at: string; pdf_url?: string }

export type Enrollment = { id: string; user_id: string; course_id: string; status: string; enrolled_at: string; course?: Course }

export type CodingExercise = { id: string; title: string; prompt: string; starter_code: string; language: string }

export type CodingSubmission = { id: string; exercise_id: string; code: string; status: string; output?: string; passed?: boolean }

export type ClassroomSession = { id: string; course_id: string; title: string; start_time: string; end_time: string; meeting_url?: string }

export type Announcement = { id: string; course_id?: string; title: string; content: string; created_at: string }

export type Review = { id: string; course_id: string; user_id: string; rating: number; comment?: string; created_at: string }

export type AdaptiveState = {
  id: string; user_id: string; course_id: string | null; concept: string
  mastery: number; retention: number; transfer: number; competency: number
  misconception: number; uncertainty: number; evidence_adequacy: number; velocity: number
  evidence_count: number; evidence_types: string[]; bottleneck: string; learning_mode: string
  recommendation: { action: string; reason: string; concept: string; mode: string; priority: number; candidates?: Array<{ action: string; utility: number; estimated_minutes: number }> }
  model_version: string
}
export type AdaptiveDashboard = {
  user_id: string; states: AdaptiveState[]; overall_competency: number; needs_diagnostic: boolean
  learning_patterns: { observations?: number; performance_by_evidence?: Record<string, number>; strongest_evidence_context?: string | null; best_observed_hour?: number | null; recurring_misconceptions?: Record<string, number>; notice?: string }
  agent_plan: AdaptiveState['recommendation'][]
}
export type CohortLearner = { user_id: string; display_name: string; email: string; concept_count: number; average_competency: number; high_risk_concepts: number; primary_bottleneck: string }

export const getMyAdaptiveDashboard = () => request<AdaptiveDashboard>('/api/v1/learning/adaptive/me')
export const getStudentAdaptiveDashboard = (studentId: string) => request<AdaptiveDashboard>(`/api/v1/learning/adaptive/students/${studentId}`)
export const getAdaptiveCohort = () => request<CohortLearner[]>('/api/v1/learning/adaptive/cohort')
export const submitLearningEvidence = (payload: {
  user_id?: string; course_id?: string; concept: string
  evidence_type: 'diagnostic' | 'quiz' | 'retrieval' | 'practice' | 'transfer' | 'project' | 'teacher_observation'
  score: number; difficulty?: number; attempts?: number; transfer_distance?: number; misconception_code?: string
}) => request<AdaptiveState>('/api/v1/learning/adaptive/evidence', { method: 'POST', body: JSON.stringify(payload) })
export const submitAdaptiveFeedback = (stateId: string, payload: { action: string; accepted?: boolean; helpfulness?: number; outcome_score?: number; notes?: string }) =>
  request<{ id: string; status: string }>(`/api/v1/learning/adaptive/states/${stateId}/feedback`, { method: 'POST', body: JSON.stringify(payload) })

// Identity & Auth

export const register = (payload: { email: string; phone_number: string; display_name: string; password: string; role: 'student' | 'teacher' }) =>

  request<User>('/api/v1/identity/register', { method: 'POST', body: JSON.stringify(payload) })

export const login = (payload: { email: string; password: string }) =>

  request<{ access_token: string; token_type: string; user: User }>('/api/v1/identity/login', {

    method: 'POST',

    body: JSON.stringify(payload),

  })

export const getCurrentUser = () => request<User>('/api/v1/identity/me')

// Organizations / Tenancy

export const getOrganizations = () => request<Organization[]>('/api/v1/tenants')

export const createOrganization = (payload: { name: string; slug: string }) =>

  request<Organization>('/api/v1/tenants', { method: 'POST', body: JSON.stringify(payload) })

export const getOrgMembers = (orgId: string) => request<OrgMember[]>(`/api/v1/tenants/${orgId}/members`)

export const inviteOrgMember = (orgId: string, email: string, role: string) =>

  request<{ id: string; email: string }>(`/api/v1/tenants/${orgId}/invitations`, { method: 'POST', body: JSON.stringify({ email, role }) })

// Courses

export const getCourses = (params?: { search?: string; status?: string; level?: string }) => {

  const query = new URLSearchParams()

  if (params?.search) query.set('search', params.search)

  if (params?.status) query.set('status', params.status)

  if (params?.level) query.set('level', params.level)

  const qStr = query.toString()

  return request<CourseListResponse>(`/api/v1/courses${qStr ? `?${qStr}` : ''}`)

}

export const getCourseDetail = (courseId: string) => request<Course>(`/api/v1/courses/${courseId}`)

export const createCourse = (payload: { organization_id: string; slug: string; title: string; description?: string }) =>

  request<Course>('/api/v1/courses', { method: 'POST', body: JSON.stringify(payload) })

export const publishCourse = (courseId: string) =>

  request<Course>(`/api/v1/courses/${courseId}/publish`, { method: 'POST' })

export const getCourseReviews = (courseId: string) => request<Review[]>(`/api/v1/courses/${courseId}/reviews`)

export const addCourseReview = (courseId: string, payload: { rating: number; comment?: string }) =>

  request<Review>(`/api/v1/courses/${courseId}/reviews`, { method: 'POST', body: JSON.stringify(payload) })

// Enrollments

export const enrollInCourse = (courseId: string) =>

  request<Enrollment>(`/api/v1/enrollments/${courseId}`, { method: 'POST' })

export const getMyEnrollments = () => request<Enrollment[]>('/api/v1/enrollments/me')

// Assessments

export const createAssessment = (courseId: string, payload: { title: string; description?: string; passing_score: number }) =>

  request<Assessment>(`/api/v1/assessment/courses/${courseId}`, { method: 'POST', body: JSON.stringify(payload) })

export const addQuestion = (assessmentId: string, payload: { question_text: string; question_type: string; options?: any; points: number }) =>

  request<AssessmentQuestion>(`/api/v1/assessment/${assessmentId}/questions`, { method: 'POST', body: JSON.stringify(payload) })

export const submitAssessmentAttempt = (assessmentId: string, payload: { answers: Record<string, any> }) =>

  request<AssessmentAttempt>(`/api/v1/assessment/${assessmentId}/attempts`, { method: 'POST', body: JSON.stringify(payload) })

// Assignments

export const getAssignments = (courseId: string) =>
  request<Assignment[]>(`/api/v1/assignments/courses/${courseId}`)

export const getAssignmentSubmissions = (assignmentId: string) =>
  request<AssignmentSubmission[]>(`/api/v1/assignments/${assignmentId}/submissions`)

export const createAssignment = (courseId: string, payload: { title: string; description: string; due_date?: string; max_score: number }) =>

  request<Assignment>(`/api/v1/assignments/courses/${courseId}`, { method: 'POST', body: JSON.stringify(payload) })

export const submitAssignment = (assignmentId: string, payload: { content: string; file_url?: string }) =>

  request<AssignmentSubmission>(`/api/v1/assignments/${assignmentId}/submissions`, { method: 'POST', body: JSON.stringify(payload) })

export const gradeSubmission = (submissionId: string, payload: { grade: number; feedback?: string }) =>

  request<AssignmentSubmission>(`/api/v1/assignments/submissions/${submissionId}/grade`, { method: 'POST', body: JSON.stringify(payload) })

// Certificates

export const issueCertificate = (courseId: string) =>

  request<Certificate>(`/api/v1/certificates/courses/${courseId}`, { method: 'POST' })

export const verifyCertificate = (certificateNumber: string) =>

  request<Certificate>(`/api/v1/certificates/verify/${certificateNumber}`)

// Coding Exercises

export const createCodingExercise = (courseId: string, payload: { title: string; prompt: string; starter_code: string; language: string }) =>

  request<CodingExercise>(`/api/v1/coding/courses/${courseId}/exercises`, { method: 'POST', body: JSON.stringify(payload) })

export const getCodingExercises = (courseId: string) => request<CodingExercise[]>(`/api/v1/coding/courses/${courseId}/exercises`)

export const submitCodingSolution = (exerciseId: string, payload: { code: string }) =>

  request<CodingSubmission>(`/api/v1/coding/exercises/${exerciseId}/submissions`, { method: 'POST', body: JSON.stringify(payload) })

// Classroom & Communication

export const createClassroomSession = (courseId: string, payload: { title: string; start_time: string; end_time: string }) =>

  request<ClassroomSession>(`/api/v1/classroom/courses/${courseId}/classes`, { method: 'POST', body: JSON.stringify(payload) })

export const getClassroomSessions = () => request<ClassroomSession[]>('/api/v1/classroom/schedule')

export const getAnnouncements = () => request<Announcement[]>('/api/v1/communication/announcements')

export const createAnnouncement = (
  payload: { title: string; body: string; audience_role?: string } | string,
  extra?: { title: string; body: string; audience_role?: string }
) => {
  if (typeof payload === 'string' && extra) {
    return request<Announcement>(`/api/v1/communication/organizations/${payload}/announcements`, {
      method: 'POST',
      body: JSON.stringify(extra)
    })
  }
  const body = typeof payload === 'object' ? payload : extra!
  return request<Announcement>('/api/v1/communication/announcements', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

// Dashboard & Admin & Notifications

export const getDashboardSummary = () => request<DashboardSummary>('/api/v1/dashboard/summary')

export const getAdminUsers = () => request<AdminUser[]>('/api/v1/admin/users')

export const approveUser = (userId: string, role: 'student' | 'teacher') =>

  request<{ id: string; role: string; status: string }>(`/api/v1/admin/users/${userId}/approve`, {

    method: 'POST', body: JSON.stringify({ role }),

  })

export const rejectUser = (userId: string) =>

  request<{ id: string; status: string }>(`/api/v1/admin/users/${userId}/reject`, { method: 'POST' })

export const getNotifications = () => request<Notification[]>('/api/v1/notifications')

// ── Timetable Types & API ──────────────────────────────────────────────────

export type TimetableSlot = {

  id: string

  day_of_week: string

  period_number: number

  start_time: string

  end_time: string

  slot_type: 'assembly' | 'lecture' | 'recess' | 'lunch' | 'sports' | 'lab' | 'dispersal'

  room_or_venue: string

  section_id: string

  section_name?: string

  grade_name?: string

  subject_id?: string

  subject_name?: string

  subject_code?: string

  subject_color?: string

  teacher_id?: string

  teacher_name?: string

}

export type SchoolSection = {

  id: string

  grade_id: string

  name: string

  room_number: string

}

export type SchoolGrade = {

  id: string

  grade_number: number

  name: string

  academic_year: string

  sections: SchoolSection[]

}

export type TeacherProfile = {

  id: string

  user_id: string

  display_name: string

  email: string

  employee_id: string

  qualification: string

  max_daily_periods: number

  rating_avg: number

  complaint_count: number

  skills: string[]

  reviews: Array<{

    id: string

    rating: number

    category: string

    comments: string

    section: string

    subject: string

    created_at: string | null

  }>

  active_restrictions: Array<{

    id: string

    section: string

    subject: string

    reason: string

    is_active: boolean

  }>

}

export type TimetableGenerationResult = {

  status: string

  academic_year: string

  total_slots_scheduled: number

  total_sections: number

  ground_capacity_complied: boolean

  autonomous_decisions: string[]

  audit_summary: string

}

export const getGrades = () => request<SchoolGrade[]>('/api/v1/timetable/grades')

export const getTimetableGrid = (params?: { section_id?: string; grade_id?: string; teacher_id?: string; day_of_week?: string }) => {

  const query = new URLSearchParams()

  if (params?.section_id) query.set('section_id', params.section_id)

  if (params?.grade_id) query.set('grade_id', params.grade_id)

  if (params?.teacher_id) query.set('teacher_id', params.teacher_id)

  if (params?.day_of_week) query.set('day_of_week', params.day_of_week)

  const qs = query.toString()

  return request<TimetableSlot[]>(`/api/v1/timetable/grid${qs ? `?${qs}` : ''}`)

}

export const generateTimetable = () =>

  request<TimetableGenerationResult>('/api/v1/timetable/generate', { method: 'POST' })

export const seedTimetableDefaults = () =>

  request<{ status: string; message: string; data: any }>('/api/v1/timetable/seed-defaults', { method: 'POST' })

export const getTeachersWithFeedback = () => request<TeacherProfile[]>('/api/v1/timetable/teachers')

export const submitTeacherFeedback = (payload: {

  teacher_id: string

  section_id: string

  subject_id: string

  rating: number

  category?: string

  comments: string

}) => request<any>('/api/v1/timetable/feedback', { method: 'POST', body: JSON.stringify(payload) })

export const toggleTeacherRestriction = (restrictionId: string) =>

  request<{ status: string; restriction_id: string; is_active: boolean }>(`/api/v1/timetable/restrictions/${restrictionId}/toggle`, { method: 'POST' })

// ── Dynamic Rules, Substitutions, Swapping & Leave API ───────────────────────

export type TimetableRule = {

  id: string

  name: string

  rule_type: string

  category: string

  description: string

  parameters: Record<string, any>

  is_enabled: boolean

  priority: number

}

export type SubstituteTeacher = {

  teacher_id: string

  display_name: string

  employee_id: string

  qualification: string

  rating_avg: number

  current_day_load: number

  max_daily_periods: number

  is_free: boolean

  is_restricted_for_class: boolean

  match_score: number

  conflict_notes?: string

}

export const getTimetableRules = () => request<TimetableRule[]>('/api/v1/timetable/rules')

export const createTimetableRule = (payload: Partial<TimetableRule>) =>

  request<TimetableRule>('/api/v1/timetable/rules', { method: 'POST', body: JSON.stringify(payload) })

export const updateTimetableRule = (ruleId: string, payload: Partial<TimetableRule>) =>
  request<TimetableRule>(`/api/v1/timetable/rules/${ruleId}`, { method: 'PUT', body: JSON.stringify(payload) })

export const deleteTimetableRule = (ruleId: string) =>

  request<{ status: string; message: string }>(`/api/v1/timetable/rules/${ruleId}`, { method: 'DELETE' })

export const toggleTimetableRule = (ruleId: string) =>

  request<TimetableRule>(`/api/v1/timetable/rules/${ruleId}/toggle`, { method: 'POST' })

export const getSlotSubstitutes = (slotId: string) =>

  request<SubstituteTeacher[]>(`/api/v1/timetable/substitutes?slot_id=${slotId}`)

export const swapSlots = (slotId1: string, slotId2: string) =>

  request<{ status: string; message: string }>('/api/v1/timetable/slots/swap', {

    method: 'POST',

    body: JSON.stringify({ slot_id_1: slotId1, slot_id_2: slotId2 })

  })

export const updateSlot = (slotId: string, payload: { subject_id?: string; teacher_id?: string; room_or_venue?: string }) =>

  request<TimetableSlot>(`/api/v1/timetable/slots/${slotId}`, {

    method: 'PUT',

    body: JSON.stringify(payload)

  })

export const recordTeacherLeave = (payload: { teacher_id: string; day_of_week: string; reason: string }) =>

  request<any>('/api/v1/timetable/leaves', { method: 'POST', body: JSON.stringify(payload) })

export const getTeacherLeaves = () => request<any[]>('/api/v1/timetable/leaves')

export interface CurriculumChapter {

  num: number

  title: string

  duration_weeks: number

  topics: string[]

  outcomes: string

}

export interface SchoolCourse {

  id: string

  title: string

  subject_code: string

  subject_name: string

  category: string

  color: string

  grade_number: number

  grade_name: string

  academic_year: string

  periods_per_week: number

  instructor_name: string

  instructor_email: string

  instructor_id: string | null

  total_chapters: number

  estimated_weeks: number

  chapters: CurriculumChapter[]

}

export const getSchoolCourses = (params?: { grade_number?: number; teacher_id?: string; user_email?: string; user_role?: string }) => {

  const query = new URLSearchParams()

  if (params?.grade_number) query.set('grade_number', params.grade_number.toString())

  if (params?.teacher_id) query.set('teacher_id', params.teacher_id)

  if (params?.user_email) query.set('user_email', params.user_email)

  if (params?.user_role) query.set('user_role', params.user_role)

  return request<SchoolCourse[]>(`/api/v1/timetable/courses?${query.toString()}`)

}

export const updateSchoolCourse = (
  gradeNumber: number,
  subjectCode: string,
  payload: {
    title?: string
    subject_name?: string
    category?: string
    color?: string
    academic_year: string
    periods_per_week: number
    chapters: CurriculumChapter[]
  }
) => request<{ status: string; message: string }>(
  `/api/v1/timetable/courses/${gradeNumber}/${encodeURIComponent(subjectCode)}`,
  { method: 'PUT', body: JSON.stringify(payload) }
)

export interface TeacherTimetableSlot {

  grade_number: number

  grade_name: string

  section_name: string

  subject_code: string

  subject_name: string

  period_number: number

  day_of_week: string

  start_time: string

  end_time: string

  room_or_venue: string

}

export interface SchoolLiveClass {

  id: string

  title: string

  teacher_id: string

  teacher_name?: string

  starts_at: string

  ends_at: string

  meeting_url?: string

  recording_url?: string | null

  status: 'scheduled' | 'live' | 'ended'

  grade_number?: number

  section_name?: string

  subject_code?: string

  subject_name?: string

  period_number?: number

  room_number?: string

}

export const getTeacherTimetableSlots = () =>

  request<TeacherTimetableSlot[]>('/api/v1/classroom/teacher-slots')

export const getSchoolLiveClasses = (params?: { grade_number?: number; status_filter?: string }) => {

  const query = new URLSearchParams()

  if (params?.grade_number) query.set('grade_number', params.grade_number.toString())

  if (params?.status_filter) query.set('status_filter', params.status_filter)

  return request<SchoolLiveClass[]>(`/api/v1/classroom/classes?${query.toString()}`)

}

export const createSchoolLiveClass = (payload: {

  title: string

  starts_at: string

  ends_at: string

  grade_number?: number

  section_name?: string

  subject_code?: string

  subject_name?: string

  period_number?: number

  room_number?: string

  status?: string

}) =>

  request<SchoolLiveClass>('/api/v1/classroom/classes', {

    method: 'POST',

    body: JSON.stringify(payload)

  })

export const endLiveClassSession = (
  classId: string,
  payload: { live_transcript?: string; duration_seconds?: number }
) =>
  request<{ id: string; status: string; summary_json?: any }>(
    `/api/v1/classroom/classes/${classId}/end-session`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  )

export const updateLiveClassStatus = (classId: string, newStatus: string) =>

  request<{ id: string; status: string }>(`/api/v1/classroom/classes/${classId}/status?new_status=${newStatus}`, {

    method: 'PUT'

  })

export const uploadClassRecording = (classId: string, videoBlob: Blob) => {
  const formData = new FormData()
  formData.append('file', videoBlob, `lecture_${classId}.webm`)
  return request<{ id: string; recording_url: string; duration?: number; format?: string }>(
    `/api/v1/classroom/classes/${classId}/recording`,
    {
      method: 'POST',
      body: formData
    }
  )
}

export interface ClassAiSummaryData {
  class_id: string
  title: string
  subject: string
  grade: number
  overview: string
  key_topics: string[]
  whiteboard_notes: string[]
  exam_takeaways: string[]
  quiz: Array<{
    question: string
    options: string[]
    correct_index: number
    explanation: string
  }>
}

export interface AgentAction {
  type: 'SEEK_VIDEO' | 'INTERACTIVE_QUIZ' | string
  timestamp?: number
  label?: string
  question?: string
  options?: string[]
  correct_index?: number
  explanation?: string
}

export interface AgentDoubtResponse {
  class_id: string
  question: string
  answer: string
  actions?: AgentAction[]
  suggested_followups?: string[]
  subject: string
  grade: number
  has_transcript: boolean
}

export const askClassAiDoubt = (
  classId: string,
  question: string,
  meta?: { title?: string; subject?: string; grade?: any; history?: Array<{ sender: string; text: string }> }
) =>
  request<AgentDoubtResponse>(`/api/v1/classroom/classes/${classId}/ai-doubt`, {
    method: 'POST',
    body: JSON.stringify({
      question,
      title: meta?.title,
      subject: meta?.subject,
      grade: meta?.grade,
      history: meta?.history
    })
  })


export const getClassAiSummary = (classId: string) =>
  request<ClassAiSummaryData>(`/api/v1/classroom/classes/${classId}/ai-summary`)

export interface ClassTranscriptData {
  class_id: string
  title: string
  transcript_text: string
  has_transcript: boolean
}

export const getClassTranscript = (classId: string) =>
  request<ClassTranscriptData>(`/api/v1/classroom/classes/${classId}/transcript`)

export interface TeacherCopilotData {
  action: string
  topic: string
  result: string
  poll_data?: {
    question: string
    options: string[]
    correct_index: number
    explanation?: string
  } | null
  diagram_data?: {
    title: string
    mermaid_code?: string
    diagram_ascii: string
    key_concepts: string[]
    pedagogical_explanation: string
    whiteboard_text?: string
  } | null
  missed_points_data?: {
    covered_points: string[]
    missed_points: string[]
    pacing_advice: string
    suggested_transition: string
    overview: string
  } | null
}

export const getTeacherCopilotAssistance = (
  classId: string,
  payload: {
    current_topic: string
    grade?: any
    subject?: string
    action: 'missed_points' | 'mermaid_diagram' | 'diagram' | 'enhance' | 'case_study' | 'fun_fact' | 'analogy' | 'quick_poll' | 'engagement_question'
    live_transcript?: string
    elapsed_seconds?: number
  }
) =>
  request<TeacherCopilotData>(`/api/v1/classroom/classes/${classId}/teacher-copilot`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })

export interface StudentTutorData {
  action: 'doubt' | 'summary' | 'milestones'
  result: string
  milestones?: Array<{
    timestamp: string
    title: string
    summary: string
  }>
  key_points?: string[]
}

export const getStudentTutorAssistance = (
  classId: string,
  payload: {
    action: 'doubt' | 'summary' | 'milestones'
    query?: string
    live_transcript?: string
    elapsed_seconds?: number
    grade?: any
    subject?: string
    topic?: string
  }
) =>
  request<StudentTutorData>(`/api/v1/classroom/classes/${classId}/student-tutor`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })




// ── LENS-Ω Adaptive Intelligence & SN1 Agent APIs ──────────────────────────

export interface LensDiagnosticQuestion {
  id: string
  subject: string
  concept: string
  prompt: string
  options: string[]
  correct_index: number
  difficulty: number
  cognitive_level: string
  misconception_tag?: string
}

export interface LensGenerateDiagnosticResponse {
  status: string
  grade_name: string
  subjects: string[]
  questions_count: number
  questions: LensDiagnosticQuestion[]
}

export interface LensSubmitDiagnosticResponse {
  status: string
  result: {
    score_percent: number
    correct_count: number
    total_questions: number
  }
  state_vector: {
    student_id: string
    student_name: string
    grade_name: string
    mastery: number
    retention: number
    transfer: number
    misconception: number
    competency: number
    uncertainty: number
    identifiability: number
    learning_velocity: number
    current_bottleneck: string
    current_learning_mode: string
    is_calibrated: boolean
  }
}

export interface LensChatResponse {
  status: string
  query: string
  response: string
}

export const generateLensDiagnostic = (
  grade_name: string,
  subjects: string[],
  num_questions: number = 6
) =>
  request<LensGenerateDiagnosticResponse>('/api/v1/lens/diagnostic/generate', {
    method: 'POST',
    body: JSON.stringify({ grade_name, subjects, num_questions }),
  })

export const submitLensDiagnostic = (
  grade_name: string,
  subjects: string[],
  answers: Record<string, number>,
  questions: LensDiagnosticQuestion[]
) =>
  request<LensSubmitDiagnosticResponse>('/api/v1/lens/diagnostic/submit', {
    method: 'POST',
    body: JSON.stringify({ grade_name, subjects, answers, questions }),
  })

export const sendLensChat = (
  query: string,
  grade_name: string,
  subjects: string[],
  state_vector?: any
) =>
  request<LensChatResponse>('/api/v1/lens/chat', {
    method: 'POST',
    body: JSON.stringify({ query, grade_name, subjects, state_vector }),
  })
