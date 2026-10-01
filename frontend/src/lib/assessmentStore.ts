/**
 * Industry-Grade Assessment Scheduling & Dynamic Question Studio Store
 * Supports Teacher Multi-Class Scheduling, AI Generation, PDF Drop, and Closed-Loop Student Ingestion
 */

import { callGroqDirect } from './langgraphAgent'
import { ingestLearningEvidenceEvent } from './evidenceEngine'

export interface QuestionItem {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'descriptive' | 'true_false' | 'problem_solving'
  options?: string[]
  correct_answer?: string | number
  points: number
  cognitive_level: 'FOUNDATION' | 'APPLICATION' | 'REASONING' | 'TRANSFER'
  concept_name: string
  explanation?: string
}

export interface ScheduledAssessment {
  id: string
  title: string
  description: string
  target_grade: string // e.g. "Class 10", "Class 7", "Class 4"
  subject: string // e.g. "Mathematics", "Science", "English Grammar"
  topic_syllabus: string
  teacher_id: string
  teacher_name: string
  created_at: string
  schedule_type: 'EXACT_TIME' | 'TIME_WINDOW' | 'ALWAYS_AVAILABLE'
  start_time?: string // ISO string
  end_time?: string // ISO string
  duration_minutes: number
  passing_score: number
  question_sets: Array<{
    set_name: string // "Set A", "Set B"
    questions: QuestionItem[]
  }>
  pdf_attachment_name?: string
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'
  total_points: number
  submissions_count: number
}

export interface StudentSubmission {
  submission_id: string
  assessment_id: string
  assessment_title: string
  student_id: string
  student_name: string
  student_grade: string
  subject: string
  submitted_at: string
  score_percent: number
  total_points_earned: number
  max_points: number
  answers: Record<string, string | number>
  feedback: string
  passed: boolean
}

const STORAGE_KEY = 'omni_scheduled_assessments_v2'
const SUBMISSIONS_KEY = 'omni_assessment_submissions_v2'

// Initial Seed Data with Real Curriculum Topics for Class 4, 7, and 10
const SEED_ASSESSMENTS: ScheduledAssessment[] = [
  {
    id: 'asmt_c10_math_quad',
    title: 'Class 10 Mathematics: Quadratic Equations & AP Diagnostic Test',
    description: 'Scheduled assessment covering root finding, discriminant analysis, and nth term of AP.',
    target_grade: 'Class 10',
    subject: 'Mathematics',
    topic_syllabus: 'Quadratic Equations & Arithmetic Progressions',
    teacher_id: 'teacher_sarah',
    teacher_name: 'Dr. Sarah Connor',
    created_at: new Date().toISOString(),
    schedule_type: 'ALWAYS_AVAILABLE',
    duration_minutes: 45,
    passing_score: 70,
    total_points: 40,
    submissions_count: 0,
    status: 'PUBLISHED',
    question_sets: [
      {
        set_name: 'Set A',
        questions: [
          {
            id: 'q1',
            question_text: 'What are the roots of the quadratic equation x² - 5x + 6 = 0?',
            question_type: 'multiple_choice',
            options: ['x = 2 and x = 3', 'x = -2 and x = -3', 'x = 1 and x = 6', 'x = 0 and x = 5'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'APPLICATION',
            concept_name: 'Quadratic Equations & Arithmetic Progressions',
            explanation: 'Factoring gives (x - 2)(x - 3) = 0, so roots are x = 2, 3.'
          },
          {
            id: 'q2',
            question_text: 'If the discriminant D = b² - 4ac > 0, what is the nature of the roots?',
            question_type: 'multiple_choice',
            options: ['Real and distinct', 'Real and equal', 'Complex / imaginary', 'Zero'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'FOUNDATION',
            concept_name: 'Quadratic Equations & Arithmetic Progressions',
            explanation: 'When D > 0, there are two distinct real roots.'
          },
          {
            id: 'q3',
            question_text: 'In an AP where first term a = 3 and common difference d = 4, find the 10th term (a₁₀).',
            question_type: 'multiple_choice',
            options: ['39', '43', '35', '40'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'APPLICATION',
            concept_name: 'Quadratic Equations & Arithmetic Progressions',
            explanation: 'a₁₀ = a + (10 - 1)d = 3 + 9(4) = 3 + 36 = 39.'
          },
          {
            id: 'q4',
            question_text: 'Explain briefly how the sign of the discriminant determines if a quadratic curve touches, crosses, or never intersects the x-axis.',
            question_type: 'descriptive',
            points: 10,
            cognitive_level: 'REASONING',
            concept_name: 'Quadratic Equations & Arithmetic Progressions',
            explanation: 'D > 0 crosses twice, D = 0 touches at the vertex, D < 0 never touches the x-axis.'
          }
        ]
      }
    ]
  },
  {
    id: 'asmt_c4_math_frac',
    title: 'Class 4 Mathematics: Fractions & Geometry Basics Test',
    description: 'Assessment on equal parts, basic fractions, and 2D perimeter identification.',
    target_grade: 'Class 4',
    subject: 'Mathematics',
    topic_syllabus: 'Fractions, Decimals & Geometry Basics',
    teacher_id: 'teacher_sarah',
    teacher_name: 'Dr. Sarah Connor',
    created_at: new Date().toISOString(),
    schedule_type: 'ALWAYS_AVAILABLE',
    duration_minutes: 30,
    passing_score: 70,
    total_points: 30,
    submissions_count: 0,
    status: 'PUBLISHED',
    question_sets: [
      {
        set_name: 'Set A',
        questions: [
          {
            id: 'q1',
            question_text: 'Which fraction is equivalent to 1/2?',
            question_type: 'multiple_choice',
            options: ['2/4', '1/3', '3/5', '2/6'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'FOUNDATION',
            concept_name: 'Fractions, Decimals & Geometry Basics',
            explanation: 'Multiplying numerator and denominator by 2 gives 2/4.'
          },
          {
            id: 'q2',
            question_text: 'A square has sides of 4 cm. What is its perimeter?',
            question_type: 'multiple_choice',
            options: ['16 cm', '8 cm', '12 cm', '20 cm'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'APPLICATION',
            concept_name: 'Fractions, Decimals & Geometry Basics',
            explanation: 'Perimeter of a square = 4 × side = 4 × 4 = 16 cm.'
          },
          {
            id: 'q3',
            question_text: 'If you have a pizza cut into 8 equal slices and you eat 3 slices, what fraction is remaining?',
            question_type: 'multiple_choice',
            options: ['5/8', '3/8', '1/2', '4/8'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'REASONING',
            concept_name: 'Fractions, Decimals & Geometry Basics',
            explanation: '8/8 - 3/8 = 5/8 remaining.'
          }
        ]
      }
    ]
  }
]

export function getScheduledAssessments(): ScheduledAssessment[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error(e)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ASSESSMENTS))
  return SEED_ASSESSMENTS
}

export function saveScheduledAssessment(assessment: ScheduledAssessment): void {
  const all = getScheduledAssessments()
  const idx = all.findIndex((a) => a.id === assessment.id)
  if (idx >= 0) {
    all[idx] = assessment
  } else {
    all.unshift(assessment)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function deleteScheduledAssessment(id: string): void {
  const all = getScheduledAssessments().filter((a) => a.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getAssessmentsForStudent(studentGrade: string): ScheduledAssessment[] {
  const all = getScheduledAssessments()
  // Clean grade matching: "Class 4", "Class 10", "Class 7", "4", "10", "7"
  const gradeNum = studentGrade.match(/\d+/)?.[0] || '4'
  return all.filter((a) => {
    const aGradeNum = a.target_grade.match(/\d+/)?.[0] || '4'
    return aGradeNum === gradeNum && a.status === 'PUBLISHED'
  })
}

export function getAssessmentsForTeacher(_teacherId?: string): ScheduledAssessment[] {
  return getScheduledAssessments()
}

// Dynamic Groq AI Question Generator for Teacher
export async function generateAIQuestionSet(
  grade: string,
  subject: string,
  topic: string,
  questionCount: number = 5
): Promise<QuestionItem[]> {
  const prompt = `You are a certified master assessment designer.
Generate a fluid ${questionCount}-question test set for **${grade} ${subject}** on the topic **"${topic}"**.

Return ONLY a JSON object with key "questions":
{
  "questions": [
    {
      "id": "q1",
      "question_text": "Clear, rigorous question prompt.",
      "question_type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "points": 10,
      "cognitive_level": "APPLICATION",
      "concept_name": "${topic}",
      "explanation": "Step-by-step analytical explanation."
    }
  ]
}

Format Guidelines:
- Tailor strictly to ${grade} difficulty.
- Mix multiple_choice and 1 descriptive or problem-solving question.
- For multiple_choice, provide 4 clear options and integer correct_answer index (0-3).
- Cognitive levels: FOUNDATION, APPLICATION, REASONING, TRANSFER.`

  try {
    const raw = await callGroqDirect(
      [
        { role: 'system', content: 'You are an educational test generator. Output valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      { jsonMode: true, temperature: 0.2 }
    )
    const parsed = JSON.parse(raw)
    if (parsed.questions && Array.isArray(parsed.questions)) {
      return parsed.questions.map((q: any, i: number) => ({
        id: q.id || `q_${Date.now()}_${i + 1}`,
        question_text: q.question_text,
        question_type: q.question_type || 'multiple_choice',
        options: Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D'],
        correct_answer: q.correct_answer ?? 0,
        points: q.points || 10,
        cognitive_level: q.cognitive_level || 'APPLICATION',
        concept_name: topic,
        explanation: q.explanation || 'Standard derivation.'
      }))
    }
  } catch (err) {
    console.warn('AI Question generator fallback:', err)
  }

  // High quality fallback
  return [
    {
      id: `q_fallback_1_${Date.now()}`,
      question_text: `In ${grade} ${subject} (${topic}), which rule applies for standard problem formulation?`,
      question_type: 'multiple_choice',
      options: [
        'Analyze given parameters and systematically apply core principles',
        'Guess without evaluating constraints',
        'Skip intermediate derivations',
        'Ignore unit consistency'
      ],
      correct_answer: 0,
      points: 10,
      cognitive_level: 'FOUNDATION',
      concept_name: topic,
      explanation: 'Foundational analytical methodology prevents compounding calculation errors.'
    }
  ]
}

// Submit Assessment and Ingest into Closed-Loop Engine
export function submitStudentAssessment(
  assessment: ScheduledAssessment,
  studentId: string,
  studentName: string,
  studentGrade: string,
  answers: Record<string, string | number>
): StudentSubmission {
  const set = assessment.question_sets[0] || { questions: [] }
  let earnedPoints = 0
  let totalPoints = 0

  set.questions.forEach((q) => {
    totalPoints += q.points
    const studentAns = answers[q.id]
    if (q.question_type === 'multiple_choice') {
      if (studentAns === q.correct_answer) {
        earnedPoints += q.points
      }
    } else {
      // Descriptive / short answer: give full points if answered with substantive text
      if (typeof studentAns === 'string' && studentAns.trim().length > 10) {
        earnedPoints += q.points
      }
    }
  })

  const scorePercent = Math.round((earnedPoints / Math.max(1, totalPoints)) * 100)
  const passed = scorePercent >= assessment.passing_score

  const submission: StudentSubmission = {
    submission_id: `sub_${Date.now()}`,
    assessment_id: assessment.id,
    assessment_title: assessment.title,
    student_id: studentId,
    student_name: studentName,
    student_grade: studentGrade,
    subject: assessment.subject,
    submitted_at: new Date().toISOString(),
    score_percent: scorePercent,
    total_points_earned: earnedPoints,
    max_points: totalPoints,
    answers,
    feedback: passed
      ? `Passed with ${scorePercent}%. Excellent grasp on ${assessment.topic_syllabus}.`
      : `Scored ${scorePercent}%. Recommended: Review foundational concepts on ${assessment.topic_syllabus}.`,
    passed,
  }

  // Save submission
  const allSubmissions: StudentSubmission[] = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '[]')
  allSubmissions.unshift(submission)
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(allSubmissions))

  // Update submissions count on assessment
  const allAssessments = getScheduledAssessments()
  const asmtIdx = allAssessments.findIndex((a) => a.id === assessment.id)
  if (asmtIdx >= 0) {
    allAssessments[asmtIdx].submissions_count += 1
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allAssessments))
  }

  // Closed-loop LENS-Ω ingestion
  ingestLearningEvidenceEvent({
    id: submission.submission_id,
    timestamp: submission.submitted_at,
    student_id: studentId,
    grade_name: studentGrade,
    subject: assessment.subject,
    concept_name: assessment.topic_syllabus,
    event_type: 'TEST',
    title: assessment.title,
    score_ratio: scorePercent / 100,
    difficulty: 0.60,
    misconception_detected: scorePercent < 60,
    misconception_tag: scorePercent < 60 ? 'scheduled_test_deficiency' : undefined,
    feedback: submission.feedback,
  })

  return submission
}

export function getAllSubmissions(): StudentSubmission[] {
  try {
    return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '[]')
  } catch {
    return []
  }
}
