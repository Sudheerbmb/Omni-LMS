import React, { useState, useEffect } from 'react'
import type { CodingExercise, Course, User } from '../lib/api'
import { getCourses, getCodingExercises, createCodingExercise, submitCodingSolution } from '../lib/api'
import { Code2, Play, Plus, Terminal, CheckCircle2, AlertCircle } from 'lucide-react'

type CodingPageProps = {
  user: User
}

export const CodingPage: React.FC<CodingPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [exercises, setExercises] = useState<CodingExercise[]>([])
  const [selectedEx, setSelectedEx] = useState<CodingExercise | null>(null)
  const [code, setCode] = useState('')

  // Execution Result State
  const [output, setOutput] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [passed, setPassed] = useState<boolean | null>(null)

  // Create Exercise Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [starterCode, setStarterCode] = useState('')
  const language = 'python'

  useEffect(() => {
    loadCourses()
  }, [])

  useEffect(() => {
    if (selectedCourseId) loadExercises(selectedCourseId)
  }, [selectedCourseId])

  const loadCourses = async () => {
    try {
      const res = await getCourses()
      setCourses(res.items || [])
      if (res.items && res.items.length > 0) setSelectedCourseId(res.items[0].id)
    } catch (err) {
      console.error(err)
    }
  }

  const loadExercises = async (cId: string) => {
    try {
      const list = await getCodingExercises(cId)
      setExercises(list || [])
      if (list && list.length > 0) {
        setSelectedEx(list[0])
        setCode(list[0].starter_code || '# Write code here')
      } else {
        setSelectedEx(null)
        setCode('')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourseId) return
    try {
      const created = await createCodingExercise(selectedCourseId, {
        title,
        prompt,
        starter_code: starterCode,
        language
      })
      setExercises([...exercises, created])
      setSelectedEx(created)
      setCode(created.starter_code)
      setShowCreateModal(false)
      setTitle('')
      setPrompt('')
      setStarterCode('')
    } catch (err: any) {
      alert(err.message || 'Failed to create exercise')
    }
  }

  const handleRunCode = async () => {
    if (!selectedEx) return
    setEvaluating(true)
    setOutput(null)
    setPassed(null)
    try {
      const res = await submitCodingSolution(selectedEx.id, { code })
      setOutput(res.output || 'Code executed successfully with status 0.')
      setPassed(res.passed !== false)
    } catch (err: any) {
      setOutput(err.message || 'SyntaxError / Execution exception')
      setPassed(false)
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Code2 className="w-7 h-7 text-cyan-400" />
            Coding Playground & Sandbox
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Solve algorithms, test code snippets, and receive automated test results.
          </p>
        </div>

        {user.role !== 'student' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            New Problem
          </button>
        )}
      </div>

      {/* Course Filter */}
      <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <label className="text-xs uppercase font-bold tracking-wider text-slate-400">Select Course:</label>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Problems Menu */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-200 text-base flex items-center justify-between">
            <span>Exercises</span>
            <span className="text-xs text-slate-500">{exercises.length} Total</span>
          </h3>

          <div className="space-y-2">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  setSelectedEx(ex)
                  setCode(ex.starter_code || '')
                  setOutput(null)
                  setPassed(null)
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  selectedEx?.id === ex.id
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <p className="font-bold text-sm">{ex.title}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">{ex.language}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Code Editor & Execution Panel */}
        <div className="lg:col-span-2 space-y-6">
          {selectedEx ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
                  {selectedEx.language}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{selectedEx.title}</h3>
                <p className="text-xs text-slate-400 mt-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800 font-sans">
                  {selectedEx.prompt}
                </p>
              </div>

              {/* Code Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400 font-mono font-bold">Solution Editor</label>
                  <button
                    onClick={handleRunCode}
                    disabled={evaluating}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg shadow-md shadow-emerald-500/20 text-xs transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" /> {evaluating ? 'Running...' : 'Run Code'}
                  </button>
                </div>

                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 h-64 resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* Terminal Output */}
              {output && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Terminal Output
                    </span>
                    {passed !== null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {passed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {passed ? 'PASSED' : 'FAILED'}
                      </span>
                    )}
                  </div>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">{output}</pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-12 text-center">Select an exercise to start coding.</p>
          )}
        </div>
      </div>

      {/* Create Exercise Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create Coding Exercise</h3>
            <form onSubmit={handleCreateExercise} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Reverse Binary Tree"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Prompt Instructions</label>
                <textarea
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Problem description and expected input/output..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 h-20"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Starter Code Boilerplate</label>
                <textarea
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                  placeholder="def solution(n): pass"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-cyan-300 focus:border-cyan-500 h-24"
                />
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
                  Save Exercise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
