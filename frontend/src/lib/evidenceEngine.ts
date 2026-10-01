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
