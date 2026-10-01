/**
 * LENS-Ω Closed-Loop Evidence Ingestion & State Calibration Engine
 * Ingests every quiz, scheduled test, assignment, poll, doubt, and practice trial
 */

import {
  computeBayesianMastery,
  computeCompetency,
  computeUncertainty,
  classifyBottleneck,
} from './langgraphAgent'
import type {
  FullStudentNeuralState,
  SubjectBenchmarkState,
  ConceptEvidence,
} from './langgraphAgent'

export interface LearningEvidenceEvent {
  id: string
  timestamp: string
  student_id: string
  grade_name: string
  subject: string
  concept_name: string
  event_type: 'QUIZ' | 'TEST' | 'ASSIGNMENT' | 'POLL' | 'DOUBT' | 'PRACTICE' | 'CODING'
  title: string
  score_ratio: number // 0.0 to 1.0
  difficulty: number // 0.1 to 1.0
  misconception_detected: boolean
  misconception_tag?: string
  feedback?: string
}

export function getStorageKeyForStudent(studentId: string, gradeNumber: number): string {
  return `lens_granular_v3_${studentId || 'demo'}_grade_${gradeNumber}`
}

export function loadStudentState(studentId: string, gradeNumber: number, studentName: string = 'Student'): FullStudentNeuralState {
  const key = getStorageKeyForStudent(studentId, gradeNumber)
  const saved = localStorage.getItem(key)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      // pass
    }
  }

  // Generate initial state if not found
  const isElementary = gradeNumber <= 5
  const gradeName = `Class ${gradeNumber}`
  const subjectsConfig: Record<string, string[]> = isElementary
    ? {
        'Mathematics': [
          'Multi-digit Arithmetic & Place Values',
          'Fractions, Decimals & Geometry Basics',
          'Applied Word Problems & Measurement',
        ],
        'Science (EVS)': [
          'Plant Nutrition & Photosynthesis',
          'States of Matter & Water Cycle',
          'Animal Habitats & Adaptations',
        ],
        'English Grammar': [
          'Parts of Speech (Nouns, Verbs, Adjectives)',
          'Tenses & Subject-Verb Agreement',
          'Reading Comprehension & Vocabulary',
        ],
        'Social Studies': [
          'Maps, Cardinal Directions & Solar System',
          'Community Governance & Heritage',
          'Physical Geography & Natural Resources',
        ],
      }
    : {
        'Mathematics': [
          'Quadratic Equations & Arithmetic Progressions',
          'Trigonometric Ratios & Heights',
          'Coordinate Geometry & Triangles',
        ],
        'Physics & Chemistry': [
          'Chemical Reactions & Stoichiometry',
          'Acids, Bases & Salts',
          'Light: Reflection, Refraction & Optics',
        ],
        'Life Sciences': [
          'Life Processes & Cellular Respiration',
          'Control & Coordination',
          'Heredity & Genetics',
        ],
        'Social Science': [
          'Nationalism in India & Democratic Politics',
          'Resources, Development & Agriculture',
          'Money, Credit & Globalization',
        ],
      }

  const subjectsState: Record<string, SubjectBenchmarkState> = {}

  Object.entries(subjectsConfig).forEach(([subjName, conceptsList]) => {
    const conceptObjs: ConceptEvidence[] = conceptsList.map((cName, idx) => ({
      concept_id: `c_${subjName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${idx + 1}`,
      concept_name: cName,
      subject: subjName,
      attempts_count: 0,
      correct_count: 0,
      mastery: 0.00,
      retention: 0.00,
      transfer: 0.00,
      misconception: 0.00,
      competency: 0.00,
      uncertainty: 0.95,
      identifiability: 0.00,
      bottleneck: 'INSUFFICIENT_EVIDENCE',
      learning_mode: 'DIAGNOSTIC',
      active_misconceptions: [],
      last_updated: new Date().toISOString(),
    }))

    subjectsState[subjName] = {
      subject: subjName,
      is_calibrated: false,
      overall_mastery: 0.00,
      overall_retention: 0.00,
      overall_transfer: 0.00,
      overall_misconception: 0.00,
      overall_competency: 0.00,
      overall_uncertainty: 0.95,
      identifiability: 0.00,
      active_bottleneck: 'INSUFFICIENT_EVIDENCE',
      active_mode: 'DIAGNOSTIC',
      concepts: conceptObjs,
    }
  })

  return {
    student_id: studentId,
    student_name: studentName,
    grade_name: gradeName,
    subjects: subjectsState,
    overall_competency: 0.00,
    overall_mastery: 0.00,
    overall_uncertainty: 0.95,
    primary_bottleneck: 'INSUFFICIENT_EVIDENCE',
    primary_mode: 'DIAGNOSTIC',
    total_evidence_events: 0,
  }
}

/**
 * Closed-Loop Universal Ingestion Function (Section 14-22 of LENS-Ω Master Spec)
 */
export function ingestLearningEvidenceEvent(event: LearningEvidenceEvent): FullStudentNeuralState {
  const gradeMatch = event.grade_name.match(/Class\s*(\d+)/i) || event.grade_name.match(/(\d+)/)
  const gradeNumber = gradeMatch ? parseInt(gradeMatch[1], 10) : 4
  const currentState = loadStudentState(event.student_id, gradeNumber)

  const subjectState = currentState.subjects[event.subject]
  if (!subjectState) {
    return currentState
  }

  // Find targeted concept or fallback to first concept in subject
  const targetConcept =
    subjectState.concepts.find((c) =>
      c.concept_name.toLowerCase().includes(event.concept_name.toLowerCase()) ||
      event.concept_name.toLowerCase().includes(c.concept_name.toLowerCase())
    ) || subjectState.concepts[0]

  // 1. Bayesian Mastery Update
  let nextM = targetConcept.mastery
  let nextR = targetConcept.retention || 0.85
  let nextT = targetConcept.transfer || 0.40
  let nextMS = targetConcept.misconception || 0.02

  if (event.event_type === 'DOUBT') {
    // Asking a doubt signals conceptual confusion or uncalibrated understanding
    nextMS = Math.min(0.60, nextMS + 0.12)
  } else if (event.event_type === 'PRACTICE') {
    // Practice specifically reinforces Ebbinghaus retention
    nextR = Math.min(1.0, nextR + 0.08)
    nextM = computeBayesianMastery(nextM > 0 ? nextM : 0.20, event.score_ratio, event.difficulty)
  } else if (event.event_type === 'ASSIGNMENT' || event.event_type === 'CODING') {
    // Assignments and coding tasks heavily stress cross-context transfer
    nextM = computeBayesianMastery(nextM > 0 ? nextM : 0.20, event.score_ratio, event.difficulty)
    nextT = Math.min(1.0, 0.3 * event.score_ratio + 0.7 * nextT)
  } else {
    // Tests, Quizzes, Polls
    nextM = computeBayesianMastery(nextM > 0 ? nextM : 0.20, event.score_ratio, event.difficulty, event.event_type === 'TEST')
    if (event.misconception_detected) {
      nextMS = Math.min(0.75, nextMS + 0.25)
    } else if (event.score_ratio >= 0.80) {
      nextMS = Math.max(0.01, nextMS * 0.70)
    }
  }

  const nextAttempts = targetConcept.attempts_count + 1
  const nextCorrect = targetConcept.correct_count + (event.score_ratio >= 0.60 ? 1 : 0)
  const nextC = computeCompetency(nextM, nextR, nextT, nextMS)
  const nextU = computeUncertainty(nextAttempts)
  const nextI = Math.min(1.0, 0.40 + nextAttempts * 0.1)
  const { bottleneck, mode } = classifyBottleneck(nextM, nextR, nextT, nextMS, nextU, nextI)

  const updatedMisconceptions = [...targetConcept.active_misconceptions]
  if (event.misconception_tag && !updatedMisconceptions.includes(event.misconception_tag)) {
    updatedMisconceptions.push(event.misconception_tag)
  }

  const updatedConcept: ConceptEvidence = {
    ...targetConcept,
    attempts_count: nextAttempts,
    correct_count: nextCorrect,
    mastery: Number(nextM.toFixed(4)),
    retention: Number(nextR.toFixed(4)),
    transfer: Number(nextT.toFixed(4)),
    misconception: Number(nextMS.toFixed(4)),
    competency: Number(nextC.toFixed(4)),
    uncertainty: Number(nextU.toFixed(4)),
    identifiability: Number(nextI.toFixed(4)),
    bottleneck: bottleneck as any,
    learning_mode: mode as any,
    active_misconceptions: updatedMisconceptions,
    last_updated: new Date().toISOString(),
  }

  // Update concepts array
  const updatedConcepts = subjectState.concepts.map((c) =>
    c.concept_id === updatedConcept.concept_id ? updatedConcept : c
  )

  const avgM = updatedConcepts.reduce((acc, c) => acc + c.mastery, 0) / updatedConcepts.length
  const avgT = updatedConcepts.reduce((acc, c) => acc + c.transfer, 0) / updatedConcepts.length
  const avgMS = updatedConcepts.reduce((acc, c) => acc + c.misconception, 0) / updatedConcepts.length
  const avgC = computeCompetency(avgM, 0.85, avgT, avgMS)
  const avgU = updatedConcepts.reduce((acc, c) => acc + c.uncertainty, 0) / updatedConcepts.length
  const { bottleneck: subjB, mode: subjM } = classifyBottleneck(avgM, 0.85, avgT, avgMS, avgU, 0.75)

  const updatedSubjectState: SubjectBenchmarkState = {
    ...subjectState,
    is_calibrated: true,
    overall_mastery: Number(avgM.toFixed(4)),
    overall_retention: 0.85,
    overall_transfer: Number(avgT.toFixed(4)),
    overall_misconception: Number(avgMS.toFixed(4)),
    overall_competency: Number(avgC.toFixed(4)),
    overall_uncertainty: Number(avgU.toFixed(4)),
    active_bottleneck: subjB,
    active_mode: subjM,
    concepts: updatedConcepts,
    last_assessed: new Date().toISOString(),
  }

  const nextSubjects = { ...currentState.subjects, [event.subject]: updatedSubjectState }
  const allSubjs = Object.values(nextSubjects)
  const globalC = allSubjs.reduce((acc, s) => acc + s.overall_competency, 0) / allSubjs.length
  const globalM = allSubjs.reduce((acc, s) => acc + s.overall_mastery, 0) / allSubjs.length
  const globalU = allSubjs.reduce((acc, s) => acc + s.overall_uncertainty, 0) / allSubjs.length

  const nextFullState: FullStudentNeuralState = {
    ...currentState,
    subjects: nextSubjects,
    overall_competency: Number(globalC.toFixed(4)),
    overall_mastery: Number(globalM.toFixed(4)),
    overall_uncertainty: Number(globalU.toFixed(4)),
    primary_bottleneck: updatedSubjectState.active_bottleneck,
    primary_mode: updatedSubjectState.active_mode,
    total_evidence_events: currentState.total_evidence_events + 1,
  }

  const key = getStorageKeyForStudent(event.student_id, gradeNumber)
  localStorage.setItem(key, JSON.stringify(nextFullState))

  // Append to chronological events feed
  const feedKey = `lens_evidence_feed_${event.student_id || 'demo'}`
  const existingFeed: LearningEvidenceEvent[] = JSON.parse(localStorage.getItem(feedKey) || '[]')
  existingFeed.unshift(event)
  localStorage.setItem(feedKey, JSON.stringify(existingFeed.slice(0, 50)))

  return nextFullState
}

export function getStudentEvidenceFeed(studentId: string): LearningEvidenceEvent[] {
  const feedKey = `lens_evidence_feed_${studentId || 'demo'}`
  try {
    return JSON.parse(localStorage.getItem(feedKey) || '[]')
  } catch {
    return []
  }
}

export interface CohortStudentProfile {
  student_id: string
  student_name: string
  grade_number: number
  grade_name: string
  email: string
  avatar_color: string
  state: FullStudentNeuralState
  recent_events_count: number
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  admin_override?: {
    risk_level?: 'HIGH' | 'MEDIUM' | 'LOW'
    bottleneck?: string
    competency?: number
    mastery?: number
    notes?: string
    updated_at?: string
  }
}

const GRADE_STUDENT_NAMES: Record<number, Array<{ name: string; email: string; color: string; mBoost: number; bType: string }>> = {
  10: [
    { name: 'Aarav Patel', email: 'aarav.patel@school.edu', color: 'from-cyan-500 to-blue-600', mBoost: 0.15, bType: 'BALANCED' },
    { name: 'Priya Sharma', email: 'priya.sharma@school.edu', color: 'from-pink-500 to-rose-600', mBoost: 0.22, bType: 'BALANCED' },
    { name: 'Rohan Gupta', email: 'rohan.gupta@school.edu', color: 'from-amber-500 to-orange-600', mBoost: -0.10, bType: 'MISCONCEPTION' },
    { name: 'Ananya Roy', email: 'ananya.roy@school.edu', color: 'from-purple-500 to-indigo-600', mBoost: 0.08, bType: 'RETRIEVAL_DECAY' },
    { name: 'Vikram Malhotra', email: 'vikram.m@school.edu', color: 'from-emerald-500 to-teal-600', mBoost: -0.15, bType: 'TRANSFER_DEFICIT' },
    { name: 'Neha Verma', email: 'neha.v@school.edu', color: 'from-blue-500 to-indigo-600', mBoost: 0.28, bType: 'BALANCED' },
    { name: 'Devansh Singh', email: 'devansh.s@school.edu', color: 'from-teal-500 to-cyan-600', mBoost: -0.05, bType: 'RETRIEVAL_DECAY' },
    { name: 'Ishita Sen', email: 'ishita.s@school.edu', color: 'from-rose-500 to-pink-600', mBoost: 0.12, bType: 'BALANCED' },
  ],
  7: [
    { name: 'Harsh Vardhan', email: 'harsh.v@school.edu', color: 'from-amber-500 to-red-600', mBoost: -0.12, bType: 'MISCONCEPTION' },
    { name: 'Prisha Mehra', email: 'prisha.m@school.edu', color: 'from-fuchsia-500 to-purple-600', mBoost: 0.18, bType: 'BALANCED' },
    { name: 'Aditya Nair', email: 'aditya.n@school.edu', color: 'from-blue-500 to-cyan-600', mBoost: 0.05, bType: 'RETRIEVAL_DECAY' },
    { name: 'Sneha Kapoor', email: 'sneha.k@school.edu', color: 'from-rose-500 to-orange-600', mBoost: 0.24, bType: 'BALANCED' },
    { name: 'Rahul Joshi', email: 'rahul.j@school.edu', color: 'from-emerald-500 to-teal-600', mBoost: -0.18, bType: 'TRANSFER_DEFICIT' },
    { name: 'Pooja Bhat', email: 'pooja.b@school.edu', color: 'from-indigo-500 to-violet-600', mBoost: 0.10, bType: 'BALANCED' },
  ],
  4: [
    { name: 'Kabir Das', email: 'kabir.d@school.edu', color: 'from-cyan-500 to-sky-600', mBoost: 0.20, bType: 'BALANCED' },
    { name: 'Tanvi Shah', email: 'tanvi.s@school.edu', color: 'from-pink-500 to-rose-600', mBoost: -0.14, bType: 'MISCONCEPTION' },
    { name: 'Atharv Kulkarni', email: 'atharv.k@school.edu', color: 'from-amber-500 to-yellow-600', mBoost: -0.05, bType: 'RETRIEVAL_DECAY' },
    { name: 'Meera Pillai', email: 'meera.p@school.edu', color: 'from-purple-500 to-indigo-600', mBoost: 0.15, bType: 'BALANCED' },
    { name: 'Samar Khan', email: 'samar.k@school.edu', color: 'from-emerald-500 to-green-600', mBoost: 0.02, bType: 'BALANCED' },
  ]
}

export function getCohortForGrade(gradeNumber: number): CohortStudentProfile[] {
  const gradeName = `Class ${gradeNumber}`
  const templateList = GRADE_STUDENT_NAMES[gradeNumber] || [
    { name: `Student Alpha (${gradeName})`, email: `alpha.${gradeNumber}@school.edu`, color: 'from-cyan-500 to-blue-600', mBoost: 0.10, bType: 'BALANCED' },
    { name: `Student Beta (${gradeName})`, email: `beta.${gradeNumber}@school.edu`, color: 'from-rose-500 to-pink-600', mBoost: -0.15, bType: 'MISCONCEPTION' },
    { name: `Student Gamma (${gradeName})`, email: `gamma.${gradeNumber}@school.edu`, color: 'from-amber-500 to-orange-600', mBoost: -0.08, bType: 'RETRIEVAL_DECAY' },
    { name: `Student Delta (${gradeName})`, email: `delta.${gradeNumber}@school.edu`, color: 'from-emerald-500 to-teal-600', mBoost: 0.22, bType: 'BALANCED' },
  ]

  // Retrieve any admin overrides
  const overridesKey = 'omni_admin_student_overrides'
  let overridesMap: Record<string, any> = {}
  try {
    overridesMap = JSON.parse(localStorage.getItem(overridesKey) || '{}')
  } catch {
    overridesMap = {}
  }

  return templateList.map((item, idx) => {
    const studentId = `student_${gradeNumber}_${idx + 1}`
    const baseState = loadStudentState(studentId, gradeNumber, item.name)

    // Adjust values to reflect authentic psychometric variance across the cohort
    const adjustedSubjects: Record<string, SubjectBenchmarkState> = {}
    Object.entries(baseState.subjects).forEach(([sName, sState]) => {
      const updatedConcepts = sState.concepts.map((c, cIdx) => {
        const customM = Math.min(0.98, Math.max(0.35, 0.65 + item.mBoost + (cIdx === 1 ? -0.12 : 0.05)))
        const customR = Math.min(0.95, Math.max(0.50, 0.85 + (item.bType === 'RETRIEVAL_DECAY' ? -0.25 : 0.05)))
        const customT = Math.min(0.95, Math.max(0.40, 0.70 + (item.bType === 'TRANSFER_DEFICIT' ? -0.30 : 0.05)))
        const customMS = item.bType === 'MISCONCEPTION' && cIdx === 0 ? 0.42 : 0.04
        const customC = computeCompetency(customM, customR, customT, customMS)
        const customU = 0.22

        return {
          ...c,
          attempts_count: 6 + idx,
          correct_count: Math.round((6 + idx) * customM),
          mastery: Number(customM.toFixed(2)),
          retention: Number(customR.toFixed(2)),
          transfer: Number(customT.toFixed(2)),
          misconception: Number(customMS.toFixed(2)),
          competency: Number(customC.toFixed(2)),
          uncertainty: Number(customU.toFixed(2)),
          bottleneck: item.bType as any,
          active_misconceptions: item.bType === 'MISCONCEPTION' && cIdx === 0 ? ['sign_reversal_error'] : [],
        }
      })

      const avgM = updatedConcepts.reduce((a, b) => a + b.mastery, 0) / updatedConcepts.length
      const avgC = updatedConcepts.reduce((a, b) => a + b.competency, 0) / updatedConcepts.length
      adjustedSubjects[sName] = {
        ...sState,
        is_calibrated: true,
        overall_mastery: Number(avgM.toFixed(2)),
        overall_competency: Number(avgC.toFixed(2)),
        active_bottleneck: item.bType as any,
        concepts: updatedConcepts,
      }
    })

    const allS = Object.values(adjustedSubjects)
    let globalC = allS.reduce((a, b) => a + b.overall_competency, 0) / allS.length
    let globalM = allS.reduce((a, b) => a + b.overall_mastery, 0) / allS.length
    let primaryBottleneck = item.bType as any

    let risk: 'HIGH' | 'MEDIUM' | 'LOW' =
      globalC < 0.55 || item.bType === 'MISCONCEPTION' ? 'HIGH' : globalC < 0.70 ? 'MEDIUM' : 'LOW'

    // Apply Admin Override if present
    const override = overridesMap[studentId]
    if (override) {
      if (override.risk_level) risk = override.risk_level
      if (override.bottleneck) primaryBottleneck = override.bottleneck
      if (typeof override.competency === 'number') globalC = override.competency
      if (typeof override.mastery === 'number') globalM = override.mastery
    }

    const fullState: FullStudentNeuralState = {
      ...baseState,
      subjects: adjustedSubjects,
      overall_competency: Number(globalC.toFixed(2)),
      overall_mastery: Number(globalM.toFixed(2)),
      overall_uncertainty: 0.20,
      primary_bottleneck: primaryBottleneck,
      total_evidence_events: 12 + idx * 2,
    }

    return {
      student_id: studentId,
      student_name: item.name,
      grade_number: gradeNumber,
      grade_name: gradeName,
      email: item.email,
      avatar_color: item.color,
      state: fullState,
      recent_events_count: 12 + idx * 2,
      risk_level: risk,
      admin_override: override,
    }
  })
}

export function getAllSchoolStudents(): CohortStudentProfile[] {
  const grades = [10, 7, 4, 1, 2, 3, 5, 6, 8, 9, 11, 12]
  const all: CohortStudentProfile[] = []
  grades.forEach((g) => {
    all.push(...getCohortForGrade(g))
  })
  return all
}

export function updateStudentCognitiveProfile(
  studentId: string,
  gradeNumber: number,
  updates: {
    risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
    bottleneck: string
    competency_percent: number
    mastery_percent: number
    notes?: string
  }
): void {
  const overridesKey = 'omni_admin_student_overrides'
  let overridesMap: Record<string, any> = {}
  try {
    overridesMap = JSON.parse(localStorage.getItem(overridesKey) || '{}')
  } catch {
    overridesMap = {}
  }

  overridesMap[studentId] = {
    risk_level: updates.risk_level,
    bottleneck: updates.bottleneck,
    competency: updates.competency_percent / 100,
    mastery: updates.mastery_percent / 100,
    notes: updates.notes,
    updated_at: new Date().toISOString(),
  }
  localStorage.setItem(overridesKey, JSON.stringify(overridesMap))

  // Also update student storage key if present
  const studentKey = getStorageKeyForStudent(studentId, gradeNumber)
  const existingRaw = localStorage.getItem(studentKey)
  if (existingRaw) {
    try {
      const state: FullStudentNeuralState = JSON.parse(existingRaw)
      state.overall_competency = updates.competency_percent / 100
      state.overall_mastery = updates.mastery_percent / 100
      state.primary_bottleneck = updates.bottleneck as any
      localStorage.setItem(studentKey, JSON.stringify(state))
    } catch (e) {
      console.warn('Error updating student state in storage:', e)
    }
  }
}


