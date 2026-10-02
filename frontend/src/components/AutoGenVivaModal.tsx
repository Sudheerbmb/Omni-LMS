import React, { useState, useEffect } from 'react'
import {
  Mic,
  MicOff,
  Send,
  Brain,
  Loader2
} from 'lucide-react'
import { getApiBaseUrl } from '../lib/api'

type AutoGenVivaModalProps = {
  isOpen: boolean
  onClose: () => void
  initialSubject?: string
  initialTopic?: string
}

export const AutoGenVivaModal: React.FC<AutoGenVivaModalProps> = ({
  isOpen,
  onClose,
  initialSubject = 'Mathematics',
  initialTopic = 'Quadratic Models & Asymptotic Stability'
}) => {
  const [subject] = useState(initialSubject)
  const [topic] = useState(initialTopic)
  const [roundNumber, setRoundNumber] = useState(1)
  const [studentInput, setStudentInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dialogue, setDialogue] = useState<Array<{ speaker: string; speaker_role: string; avatar_color: string; message: string }>>([])
  const [evaluation, setEvaluation] = useState<any>({ rigor_score: 75, conceptual_clarity: 'Evaluated' })
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    if (isOpen && dialogue.length === 0) {
      startInitialRound()
    }
  }, [isOpen])

  if (!isOpen) return null

  const startInitialRound = async () => {
    setLoading(true)
    try {
      const baseUrl = getApiBaseUrl().replace(/\/$/, '')
      const res = await fetch(`${baseUrl}/api/v1/agents/viva/round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          topic,
          student_response: '',
          round_number: 1
        })
      })

      if (res.ok) {
        const data = await res.json()
        setDialogue(data.dialogue || [])
        setEvaluation(data.current_evaluation || {})
      }
    } catch {
      // Local fallback
      setDialogue([
        {
          speaker: 'Prof. Eleanor Wright',
          speaker_role: 'Academic Committee Chair',
          avatar_color: 'from-cyan-500 to-blue-600',
          message: `Welcome to your oral defense on ${topic}. To begin, please state the primary governing equation and describe what happens to the roots when the discriminant approaches zero.`
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSendResponse = async () => {
    if (!studentInput.trim() || loading) return
    const currentAnswer = studentInput
    setStudentInput('')
    setLoading(true)

    // Add student turn to dialogue
    const updated = [
      ...dialogue,
      {
        speaker: 'You (Student Candidate)',
        speaker_role: 'Oral Defense Candidate',
        avatar_color: 'from-slate-700 to-slate-900',
        message: currentAnswer
      }
    ]
    setDialogue(updated)

    try {
      const baseUrl = getApiBaseUrl().replace(/\/$/, '')
      const res = await fetch(`${baseUrl}/api/v1/agents/viva/round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          topic,
          student_response: currentAnswer,
          round_number: roundNumber
        })
      })

      if (res.ok) {
        const data = await res.json()
        setDialogue([...updated, ...(data.dialogue || [])])
        setEvaluation(data.current_evaluation || {})
        setRoundNumber(data.round_number || roundNumber + 1)
      }
    } catch {
      // Local fallback response from Dr. Kierkegaard
      setDialogue([
        ...updated,
        {
          speaker: 'Prof. Eleanor Wright',
          speaker_role: 'Academic Committee Chair',
          avatar_color: 'from-cyan-500 to-blue-600',
          message: `Thank you. You correctly identified that roots become degenerate and real.`
        },
        {
          speaker: 'Dr. Soren Kierkegaard',
          speaker_role: 'Adversarial Logic Auditor',
          avatar_color: 'from-amber-500 to-orange-600',
          message: `Hold on. That holds only over real Euclidean coordinates. If complex perturbations exist, how do you verify phase space stability under damping?`
        }
      ])
      setRoundNumber(roundNumber + 1)
    } finally {
      setLoading(false)
    }
  }

  // Speech Recognition
  const toggleSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your response.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => setIsListening(true)
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setStudentInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
        setIsListening(false)
      }
      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)

      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                AutoGen Multi-Agent Oral Viva Defense
                <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                  Round {roundNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Cross-examination by Academic Committee Chair &bull; Adversarial Logic Auditor
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl font-bold">
            &times;
          </button>
        </div>

        {/* Real-Time Telemetry Bar */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-bold">Rigor Score:</span>
            <span className="font-mono text-cyan-400 font-extrabold text-sm">{evaluation.rigor_score || 80}/100</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-bold">Topic Defense:</span>
            <span className="text-emerald-400 font-bold truncate max-w-[150px]">{topic}</span>
          </div>
        </div>

        {/* Conversation Stream */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
          {dialogue.map((turn, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${turn.avatar_color} text-slate-950 font-bold flex items-center justify-center text-[10px]`}
                  >
                    {turn.speaker.charAt(0)}
                  </div>
                  <strong className="text-white">{turn.speaker}</strong>
                  <span className="text-[10px] text-cyan-400 font-mono">({turn.speaker_role})</span>
                </div>
              </div>
              <p className="text-slate-300 leading-relaxed pl-8">{turn.message}</p>
            </div>
          ))}

          {loading && (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Examiners are debating your answer...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSpeech}
              className={`p-3 rounded-2xl border transition-all ${
                isListening
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Speak your answer"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={studentInput}
              onChange={(e) => setStudentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendResponse()}
              placeholder="State your mathematical derivation or conceptual justification..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500"
            />

            <button
              onClick={handleSendResponse}
              disabled={loading || !studentInput.trim()}
              className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
            >
              <Send className="w-4 h-4" />
              <span>Defend</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Tip: You can click the microphone icon to speak your answer aloud directly to the examiners.
          </p>
        </div>
      </div>
    </div>
  )
}
export default AutoGenVivaModal
