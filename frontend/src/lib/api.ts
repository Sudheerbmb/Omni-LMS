const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

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

  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers })
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

export type AssignmentSubmission = { id: string; assignment_id: string; student_id: string; content: string; file_url?: string; grade?: number; feedback?: string; created_at: string }
export type Assignment = { id: string; course_id: string; title: string; description: string; due_date?: string; max_score: number; submissions?: AssignmentSubmission[] }

export type Certificate = { id: string; user_id: string; course_id: string; certificate_number: string; issued_at: string; pdf_url?: string }
export type Enrollment = { id: string; user_id: string; course_id: string; status: string; enrolled_at: string; course?: Course }
export type CodingExercise = { id: string; title: string; prompt: string; starter_code: string; language: string }
export type CodingSubmission = { id: string; exercise_id: string; code: string; status: string; output?: string; passed?: boolean }
export type ClassroomSession = { id: string; course_id: string; title: string; start_time: string; end_time: string; meeting_url?: string }
export type Announcement = { id: string; course_id?: string; title: string; content: string; created_at: string }
export type Review = { id: string; course_id: string; user_id: string; rating: number; comment?: string; created_at: string }

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
export const createAnnouncement = (orgId: string, payload: { title: string; body: string; audience_role?: string }) =>
  request<Announcement>(`/api/v1/communication/organizations/${orgId}/announcements`, { method: 'POST', body: JSON.stringify(payload) })

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

export const updateLiveClassStatus = (classId: string, newStatus: string) =>
  request<{ id: string; status: string }>(`/api/v1/classroom/classes/${classId}/status?new_status=${newStatus}`, {
    method: 'PUT'
  })
