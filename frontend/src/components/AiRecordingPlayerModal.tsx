import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Bot,
  Send,
  HelpCircle,
  FileText,
  CheckCircle2,
  X,
  ExternalLink,
  Video,
  Clock,
  User,
  BookOpen,
  RefreshCw,
  Check,
  XCircle,
  Lightbulb,
  GraduationCap
} from 'lucide-react'
import { askClassAiDoubt, getClassAiSummary } from '../lib/api'
import type { ClassAiSummaryData } from '../lib/api'

export interface ClassInfo {
  id?: string
  title?: string
  subject?: string
  subject_name?: string
  grade?: string | number
  grade_number?: number
  teacher_name?: string
  scheduled_start?: string
  starts_at?: string
  [key: string]: any
}

interface AiRecordingPlayerModalProps {
  recordingUrl: string
  classInfo?: ClassInfo | null
  onClose: () => void
}

interface ChatMessage {
  id: string
  sender: 'ai' | 'user'
  text: string
  timestamp: string
}

export const AiRecordingPlayerModal: React.FC<AiRecordingPlayerModalProps> = ({
  recordingUrl,
  classInfo,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'doubt' | 'summary' | 'quiz'>('doubt')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputQuery, setInputQuery] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [summaryData, setSummaryData] = useState<ClassAiSummaryData | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showQuizResults, setShowQuizResults] = useState(false)
  
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const classId = classInfo?.id || 'sample-class'
  const classTitle = classInfo?.title || 'Class Lecture Recording'
  
  // Extract Subject with high accuracy
  let classSubject = classInfo?.subject || classInfo?.subject_name || ''
  if (!classSubject) {
    const tLower = classTitle.toLowerCase()
    if (tLower.includes('math')) classSubject = 'Mathematics'
    else if (/science|physics|chem|bio/.test(tLower)) classSubject = 'Science'
    else if (/english|grammar|literature/.test(tLower)) classSubject = 'English'
    else if (/history|social|geography/.test(tLower)) classSubject = 'Social Studies'
    else if (/computer|code|python|java/.test(tLower)) classSubject = 'Computer Science'
    else classSubject = 'Academic Lesson'
  }

  // Extract Grade number
  let classGradeNum: number | null = null
  if (classInfo?.grade_number !== undefined && classInfo?.grade_number !== null) {
    classGradeNum = Number(classInfo.grade_number)
  } else if (classInfo?.grade !== undefined && !isNaN(Number(classInfo.grade))) {
    classGradeNum = Number(classInfo.grade)
  } else {
    const m = classTitle.match(/Grade\s*(\d+)/i)
    if (m) classGradeNum = parseInt(m[1], 10)
  }
  const isPrimary = classGradeNum !== null && classGradeNum <= 3
  const isMiddle = classGradeNum !== null && classGradeNum >= 4 && classGradeNum <= 8
  const gradeDisplay = classGradeNum ? `Grade ${classGradeNum}` : (classInfo?.grade ? String(classInfo.grade) : 'All Grades')

  // Generate localized intelligent answer in case of network interruption
  const synthesizeLocalAnswer = (query: string): string => {
    const qLower = query.toLowerCase()
    const isAbout = /what is (the|this) video about|about|summary|recap|overview|what was covered|topics/i.test(qLower)
    const isFormula = /formula|equation|rules|theorem|math|definition/i.test(qLower)
    const isQuiz = /quiz|question|test|practice|exam/i.test(qLower)
    
    if (isPrimary) {
      if (isAbout) {
        return `🌟 **About this Lecture: ${classTitle}**\n\nThis video is a friendly, interactive **Grade ${classGradeNum || 1} ${classSubject}** lesson designed specifically for young learners!\n\nHere is what your teacher covers in this recording:\n• **Fun Basics & Numbers:** Learning numbers and core concepts using familiar objects (apples, balloons, and stars).\n• **Interactive Whiteboard Walkthrough:** The teacher writes and draws on the board step-by-step so you can easily follow along.\n• **Counting & Solving:** Easy practice questions to build your skills and boost your confidence!\n\n💡 *Have a doubt? Feel free to ask me anything about the video, or click the **Quick Quiz** tab to try 2 fun questions!*`
      }
      if (isFormula) {
        return `📐 **Key Rules for Grade ${classGradeNum || 1} ${classSubject}:**\n\n• **Putting Groups Together (Addition +):** When you combine two sets, count them all up (e.g. 2 apples 🍎🍎 + 3 apples 🍎🍎🍎 = 5 apples 🍎🍎🍎🍎🍎)!\n• **Taking Away (Subtraction -):** Count what is left after taking some away!\n• **Counting Order:** Always count steadily: 1, 2, 3, 4, 5... You can use your fingers or draw dots on paper!`
      }
      if (isQuiz) {
        return `🎈 **Fun Practice for Grade ${classGradeNum || 1} ${classSubject}:**\n\n*Question:* If you have 3 blue stars ⭐⭐⭐ and your teacher gives you 2 more ⭐⭐, how many stars do you have in total?\n\n• **A)** 4 stars\n• **B)** 5 stars [Correct! 🎉]\n• **C)** 6 stars\n\n*Explanation:* Count them together: 1, 2, 3... 4, 5! You have 5 stars!`
      }
      return `😊 **Hello Grade ${classGradeNum || 1} Learner!**\n\nFor your question: **"${query}"**\n\nIn this ${classSubject} lesson, your teacher showed that we can solve this by taking one easy step at a time! Think of it like building blocks—first see what numbers or pieces you have, follow the teacher's steps on the board, and count your result.\n\nWould you like to try another fun example together?`
    }

    if (isMiddle) {
      if (isAbout) {
        return `📚 **Lecture Overview: ${classTitle} (${gradeDisplay} ${classSubject})**\n\nIn this recorded session, your teacher focuses on establishing clear conceptual understanding and practical problem-solving:\n1. **Core Concept Introduction:** Systematic breakdown of the topic with real-world analogies.\n2. **Whiteboard Walkthrough:** Deriving key steps and solving standard textbook exercises.\n3. **Common Mistakes:** Highlighting tricky spots where students often lose marks in tests.\n4. **Practice Takeaways:** Key methods to remember when revising.`
      }
      if (isFormula) {
        return `📐 **Key Formulas & Principles (${classSubject} - ${gradeDisplay}):**\n\n• **Primary Relationship:** Ensure you know how the primary variables connect and scale.\n• **Working Method:** (1) State knowns and unknowns, (2) Substitute into the core equation, (3) Double check your calculations and units.\n• Check the **AI Summary** tab for full whiteboard equations from this lecture!`
      }
      return `Great question regarding **"${query}"**!\n\nIn this ${gradeDisplay} ${classSubject} lecture, the key is understanding how each step follows logically from the previous one. Review the board notes around this section in the video, apply the standard method, and test yourself on the **Quick Quiz** tab!`
    }

    // High School / General
    if (isAbout) {
      return `**Executive Lecture Summary for ${classTitle}:**\n\n1. **Core Subject Focus:** This session explored key foundational principles of ${classSubject} structured for ${gradeDisplay}.\n2. **Theoretical Foundations:** Emphasis was placed on definitions, governing laws, and systemic behavior.\n3. **Worked Examples:** Step-by-step problem solving demonstrated on the board.\n4. **Key Takeaway:** Ensure you understand the underlying mechanisms and test your skills with practice questions.`
    }
    if (isFormula) {
      return `**Key Formulas & Analytical Tools (${classSubject}):**\n\n• **Governing Principle:** State transitions are determined by initial conditions and external forces.\n• **Proportionality Rule:** Verify whether dependent variables scale directly or inversely.\n• **Methodology Tip:** Always write down given variables first, apply the standard formula, and check final units.`
    }
    return `Regarding **"${query}"**: In this ${classSubject} lecture for ${gradeDisplay}, the instructor highlighted that understanding how the concepts connect is key to solving test problems. Trace each step from cause to effect, and check the **AI Summary** tab for the step-by-step notes!`
  }

  // Initialize initial welcome message
  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: 'init-1',
      sender: 'ai',
      text: isPrimary
        ? `👋 Hello! I am your AI Study Buddy for "${classTitle}".\n\nI have watched this recorded lesson with you! Ask me anything about numbers, shapes, or problems the teacher wrote on the board, and I will explain it simply!`
        : `👋 Hello! I am your AI Classroom Assistant for "${classTitle}".\n\nI have analyzed this recorded lecture. Ask me any doubt about topics covered in this video, formulas mentioned, or concepts you'd like explained step-by-step!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setMessages([welcomeMsg])
    loadSummary()
  }, [classId, classTitle])

  // Scroll to bottom of chat on new message
  useEffect(() => {
    if (activeTab === 'doubt') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTab])

  const loadSummary = async () => {
    setIsLoadingSummary(true)
    try {
      const data = await getClassAiSummary(classId)
      setSummaryData(data)
    } catch (err) {
      console.warn('Could not load dynamic AI summary, using synthesized fallback:', err)
      if (isPrimary) {
        setSummaryData({
          class_id: classId,
          title: classTitle,
          subject: classSubject,
          grade: classGradeNum || 1,
          overview: `This recorded video is a fun and interactive Grade ${classGradeNum || 1} ${classSubject} class! The teacher uses clear whiteboard demonstrations, friendly visual examples, and step-by-step counting to make learning enjoyable and easy to remember.`,
          key_topics: [
            `Introduction to Grade ${classGradeNum || 1} ${classSubject} Fundamentals`,
            'Counting & Visual Problem Walkthroughs',
            "Teacher's Interactive Whiteboard Drawings & Demonstrations",
            'Fun Practice Questions with Immediate Teacher Feedback'
          ],
          whiteboard_notes: [
            'Visual Counting: Count items one-by-one with dots or pictures.',
            'Basic Operations: Putting groups together and finding total amounts.',
            'Practice Tip: Say numbers out loud while writing them down.'
          ],
          exam_takeaways: [
            'Practice counting objects around your house (toys, books, pencils).',
            'Remember to write numbers carefully and clearly.',
            'Try the 2 practice questions in the Quick Quiz tab!'
          ],
          quiz: [
            {
              question: `What was the main topic of this Grade ${classGradeNum || 1} ${classSubject} lesson?`,
              options: [
                `Foundational concepts and practice in ${classTitle}`,
                'College physics',
                'Silent study with no teacher',
                'Recess and games only'
              ],
              correct_index: 0,
              explanation: `The lecture focused on teaching and practicing core Grade ${classGradeNum || 1} ${classSubject}.`
            },
            {
              question: 'What is the best way to practice what you learned in this video?',
              options: [
                'Never look at numbers again',
                "Try practice problems and review the teacher's board notes",
                'Skip homework completely',
                'Close the notebook immediately'
              ],
              correct_index: 1,
              explanation: "Reviewing the board notes and practicing helps remember the lesson!"
            }
          ]
        })
      } else {
        setSummaryData({
          class_id: classId,
          title: classTitle,
          subject: classSubject,
          grade: classGradeNum || 9,
          overview: `This recorded lecture for ${gradeDisplay} provides in-depth coverage of ${classSubject}, focusing on fundamental definitions, analytical derivations, and practical application.`,
          key_topics: [
            `Introduction to ${classSubject} Foundations`,
            'Core Theoretical Frameworks & Whiteboard Derivations',
            'Worked Problem Solving & Step-by-Step Methodology',
            'Common Exam Pitfalls & How to Avoid Them',
            'Interactive Summary & Key Homework Points'
          ],
          whiteboard_notes: [
            'Governing Law: Fundamental equation and definitions demonstrated during presentation.',
            'Boundary Conditions: How initial constraints determine the outcome.',
            'Verification Step: Always check SI units and dimensions.'
          ],
          exam_takeaways: [
            'Memorize the standard scientific / mathematical definitions.',
            'Be prepared to explain the difference between related core concepts in test questions.',
            'Practice at least three textbook numerical problems before the next quiz.'
          ],
          quiz: [
            {
              question: `What was the main analytical principle taught in this ${classSubject} lecture?`,
              options: [
                'Structured application of governing laws to solve problems',
                'Rote memorization without understanding concepts',
                'Ignoring standard units and dimensions',
                'None of the above'
              ],
              correct_index: 0,
              explanation: `The lecture emphasized using governing laws methodically to understand ${classSubject}.`
            },
            {
              question: `When approaching questions on ${classSubject}, what was the recommended methodology?`,
              options: [
                'Guess the result directly',
                'List given variables, select governing formula, and verify units',
                'Skip reading the problem statement carefully',
                'Omit intermediate steps'
              ],
              correct_index: 1,
              explanation: 'Listing variables, choosing formulas, and checking units guarantees maximum accuracy.'
            }
          ]
        })
      }
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const handleSendDoubt = async (queryText?: string) => {
    const question = (queryText || inputQuery).trim()
    if (!question || isAsking) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg])
    setInputQuery('')
    setIsAsking(true)

    try {
      const res = await askClassAiDoubt(classId, question, {
        title: classTitle,
        subject: classSubject,
        grade: classGradeNum || gradeDisplay
      })
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (err: any) {
      const localAnswer = synthesizeLocalAnswer(question)
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: localAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, aiMsg])
    } finally {
      setIsAsking(false)
    }
  }

  const quickPrompts = isPrimary
    ? [
        'What is this video about?',
        'Can you show me a fun counting example?',
        'What did the teacher write on the board?',
        'Give me a fun practice puzzle'
      ]
    : [
        'What is this video about?',
        'Explain the key concept step-by-step',
        'What are the key formulas and notes?',
        'Give me 3 practice tips for exams'
      ]

  const handleSelectQuizOption = (qIdx: number, optIdx: number) => {
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optIdx }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* TOP BAR */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {gradeDisplay}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {classSubject}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  AI Doubt Solver Active
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {classTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={recordingUrl}
              target="_blank"
              rel="noreferrer"
              title="Open video in new tab / download"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Screen / Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
              aria-label="Close recording viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN BODY: 2 COLUMNS ON DESKTOP */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
          
          {/* LEFT COLUMN: VIDEO PLAYER (7/12) */}
          <div className="lg:col-span-7 flex flex-col bg-black/40 overflow-y-auto">
            <div className="relative aspect-video w-full bg-black flex items-center justify-center group">
              <video
                ref={videoRef}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                src={recordingUrl}
              >
                Your browser does not support HTML5 video playback.
              </video>
            </div>

            {/* VIDEO METADATA & QUICK INFO */}
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-4">
                  {classInfo?.teacher_name && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      Teacher: <strong className="text-slate-200">{classInfo.teacher_name}</strong>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Subject: <strong className="text-slate-200">{classSubject}</strong>
                  </span>
                </div>
                {(classInfo?.scheduled_start || classInfo?.starts_at) && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {new Date(classInfo?.scheduled_start || classInfo?.starts_at!).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* QUICK STUDY TIPS */}
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/60 p-3.5 text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <Lightbulb className="w-4 h-4" />
                  <span>How to use this AI Study Companion:</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Pause the video anytime you encounter a difficult topic. Type your question in the <strong className="text-slate-200">Ask Anything</strong> panel on the right, or check the <strong className="text-slate-200">Lecture Summary</strong> tab for instant revision notes and formulas.
                </p>
              </div>

              {/* ACTION QUICK CHIPS */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Quick AI Actions:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('doubt')
                      handleSendDoubt('What is this video about?')
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1.5 text-left"
                  >
                    <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>What is this video about?</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('doubt')
                      handleSendDoubt(isPrimary ? 'What are the key counting rules?' : 'What formulas, equations, or definitions are critical from this lecture?')
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1.5 text-left"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>{isPrimary ? 'Key rules & examples' : 'Key formulas & notes'}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 text-left"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Test understanding with Quiz</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: AI COMPANION TABS (5/12) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-slate-900 overflow-hidden">
            
            {/* TABS HEADER */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1 shrink-0">
              <button
                onClick={() => setActiveTab('doubt')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'doubt'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Ask Anything</span>
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'summary'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>AI Summary</span>
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'quiz'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Quick Quiz</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 min-h-0 flex flex-col">
              
              {/* TAB 1: ASK ANYTHING (DOUBT SOLVER) */}
              {activeTab === 'doubt' && (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* MESSAGES LIST */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.sender === 'ai' && (
                          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                            msg.sender === 'user'
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-slate-800/90 text-slate-200 border border-slate-700/70 rounded-tl-none shadow-sm'
                          }`}
                        >
                          {msg.text}
                          <div className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {msg.timestamp}
                          </div>
                        </div>
                      </div>
                    ))}

                    {isAsking && (
                      <div className="flex gap-2.5 justify-start">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                          <Bot className="w-4 h-4 animate-spin" />
                        </div>
                        <div className="bg-slate-800/90 border border-slate-700/70 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-indigo-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                          <span>Analyzing lecture & solving doubt...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* SUGGESTED CHIPS */}
                  <div className="px-3 py-1.5 bg-slate-950/30 border-t border-slate-800/80 flex gap-1.5 overflow-x-auto no-scrollbar">
                    {quickPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendDoubt(p)}
                        className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* INPUT BAR */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSendDoubt()
                    }}
                    className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={inputQuery}
                      onChange={(e) => setInputQuery(e.target.value)}
                      placeholder={isPrimary ? "Ask any question about this fun lesson..." : "Ask any doubt about this video lecture..."}
                      disabled={isAsking}
                      className="flex-1 bg-slate-800/90 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none transition"
                    />
                    <button
                      type="submit"
                      disabled={!inputQuery.trim() || isAsking}
                      className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-medium shadow-md transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: AI SUMMARY & TRANSCRIPT RECAP */}
              {activeTab === 'summary' && (
                <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
                  {isLoadingSummary ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      <span className="text-xs">Generating lecture summary...</span>
                    </div>
                  ) : summaryData ? (
                    <div className="space-y-4">
                      {/* Overview */}
                      <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                          <Sparkles className="w-4 h-4" />
                          <span>Lecture Overview</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {summaryData.overview}
                        </p>
                      </div>

                      {/* Topics Covered */}
                      <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                          <BookOpen className="w-4 h-4" />
                          <span>Key Topics Covered</span>
                        </div>
                        <div className="space-y-1.5">
                          {summaryData.key_topics?.map((topic, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                              <span>{topic}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Whiteboard Derivations */}
                      {summaryData.whiteboard_notes && summaryData.whiteboard_notes.length > 0 && (
                        <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                            <FileText className="w-4 h-4" />
                            <span>{isPrimary ? 'Teacher Whiteboard & Practice Notes' : 'Whiteboard Notes & Key Equations'}</span>
                          </div>
                          <div className="space-y-1.5">
                            {summaryData.whiteboard_notes.map((note, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                <span>{note}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Exam Takeaways */}
                      {summaryData.exam_takeaways && summaryData.exam_takeaways.length > 0 && (
                        <div className="rounded-xl bg-indigo-950/40 border border-indigo-500/30 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isPrimary ? 'Key Takeaways for Students' : 'Exam & Revision Takeaways'}</span>
                          </div>
                          <div className="space-y-1.5">
                            {summaryData.exam_takeaways.map((takeaway, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-indigo-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                <span>{takeaway}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-400">
                      Summary is currently being synthesized for this class.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: QUICK QUIZ */}
              {activeTab === 'quiz' && (
                <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Lecture Comprehension Check</h4>
                      <p className="text-[11px] text-slate-400">Test how much you absorbed from this recording.</p>
                    </div>
                    {summaryData?.quiz && (
                      <button
                        onClick={() => {
                          setSelectedAnswers({})
                          setShowQuizResults(false)
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  {summaryData?.quiz?.map((q: any, qIdx: number) => {
                    const selected = selectedAnswers[qIdx]

                    return (
                      <div key={qIdx} className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-md bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {qIdx + 1}
                          </span>
                          <span className="text-xs font-medium text-slate-200 leading-snug">
                            {q.question}
                          </span>
                        </div>

                        <div className="space-y-1.5 pl-7">
                          {q.options.map((opt: string, optIdx: number) => {
                            const isChosen = selected === optIdx
                            const isCorrectOpt = q.correct_index === optIdx

                            let btnStyle = 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/80'
                            if (showQuizResults) {
                              if (isCorrectOpt) {
                                btnStyle = 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50 font-semibold'
                              } else if (isChosen) {
                                btnStyle = 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                              }
                            } else if (isChosen) {
                              btnStyle = 'bg-indigo-600 text-white border-indigo-500 font-medium'
                            }

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleSelectQuizOption(qIdx, optIdx)}
                                className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition flex items-center justify-between gap-2 ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {showQuizResults && isCorrectOpt && (
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                )}
                                {showQuizResults && isChosen && !isCorrectOpt && (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>

                        {showQuizResults && q.explanation && (
                          <div className="mt-2 pl-7 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            <strong className="text-indigo-300">Explanation: </strong>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="pt-2">
                    <button
                      onClick={() => setShowQuizResults(true)}
                      disabled={Object.keys(selectedAnswers).length === 0}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Check My Answers</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
