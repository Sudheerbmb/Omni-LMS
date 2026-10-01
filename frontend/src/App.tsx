import React, { useState, useEffect } from 'react'
import type { 
  User, 
  Notification, 
  DashboardSummary 
} from './lib/api'
import { 
  getCurrentUser, 
  getDashboardSummary, 
  getNotifications, 
  login as loginApi, 
  register as registerApi 
} from './lib/api'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { DashboardPage } from './pages/DashboardPage'
import { CoursesPage } from './pages/CoursesPage'
import { AssessmentsPage } from './pages/AssessmentsPage'
import { AssignmentsPage } from './pages/AssignmentsPage'
import { OrganizationsPage } from './pages/OrganizationsPage'
import { CodingPage } from './pages/CodingPage'
import { ClassroomPage } from './pages/ClassroomPage'
import { AdminPage } from './pages/AdminPage'
import { TimetablePage } from './pages/TimetablePage'
import { LearningIntelligencePage } from './pages/LearningIntelligencePage'

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('lms_access_token'))
  const [user, setUser] = useState<User | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [currentTab, setCurrentTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authRole, setAuthRole] = useState<'student' | 'teacher'>('student')
  const [authError, setAuthError] = useState('')
  const [submittingAuth, setSubmittingAuth] = useState(false)

  useEffect(() => {
    if (token) {
      loadInitialData()
    } else {
      setLoading(false)
    }
  }, [token])

  // Safeguard: Ensure Admin is redirected if on removed tabs (Assessments / Assignments)
  useEffect(() => {
    if (user?.role === 'admin' && (currentTab === 'assessments' || currentTab === 'assignments')) {
      setCurrentTab('overview')
    }
  }, [user?.role, currentTab])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      const summary = await getDashboardSummary()
      setDashboardSummary(summary)
      const notifs = await getNotifications()
      setNotifications(notifs || [])
    } catch (err) {
      console.error(err)
      handleLogout()
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setSubmittingAuth(true)
    try {
      if (authMode === 'login') {
        const res = await loginApi({ email: authEmail, password: authPassword })
        localStorage.setItem('lms_access_token', res.access_token)
        setToken(res.access_token)
      } else {
        await registerApi({
          email: authEmail,
          password: authPassword,
          display_name: authName,
          phone_number: authPhone,
          role: authRole
        })
        alert('Registration complete! Please log in.')
        setAuthMode('login')
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.')
    } finally {
      setSubmittingAuth(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('lms_access_token')
    setToken(null)
    setUser(null)
    setDashboardSummary(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Loading Zoom LMS...</p>
        </div>
      </div>
    )
  }

  if (!user || !token) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-black text-2xl mx-auto shadow-lg shadow-cyan-500/20">
              Z
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Zoom LMS Platform</h1>
            <p className="text-slate-400 text-xs">
              {authMode === 'login' ? 'Sign in to access your learning portal' : 'Create an account to start learning'}
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
              {authError}
            </div>
          )}

          {/* Quick 1-Click Login Selector for instant access */}
          {authMode === 'login' && (
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>⚡ Instant One-Click Login</span>
                <span className="text-[10px] text-cyan-400 font-mono">100% Fail-Proof</span>
              </div>

              <div className="space-y-2 pt-1">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Administrator:</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('admin@example.com'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition-all"
                    >
                      🛡️ Admin (System)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Faculty Teachers:</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('sarah.connor@school.edu'); setAuthPassword('Teacher123!'); setAuthError(''); }}
                      className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition-all"
                    >
                      👩‍🏫 Dr. Sarah (Math)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('alan.turing@school.edu'); setAuthPassword('Teacher123!'); setAuthError(''); }}
                      className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition-all"
                    >
                      👨‍🏫 Prof. Turing (CS)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Enrolled Students (Classes 1 - 10):</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('student.class1@school.edu'); setAuthPassword('Student123!'); setAuthError(''); }}
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition-all"
                    >
                      🎒 Class 1-A
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('student.class4@school.edu'); setAuthPassword('Student123!'); setAuthError(''); }}
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition-all"
                    >
                      🎒 Class 4-A
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('student.class6@school.edu'); setAuthPassword('Student123!'); setAuthError(''); }}
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition-all"
                    >
                      🎒 Class 6-A
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('student.class9@school.edu'); setAuthPassword('Student123!'); setAuthError(''); }}
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition-all"
                    >
                      🎒 Class 9-A
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('student.class10@school.edu'); setAuthPassword('Student123!'); setAuthError(''); }}
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition-all"
                    >
                      🎒 Class 10-A
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {authMode === 'register' && (
              <>
                <div>
                  <label className="text-xs text-slate-400 font-semibold">Full Display Name</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold">Phone Number</label>
                  <input
                    type="tel"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    placeholder="+1 555 0192"
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold">Account Role</label>
                  <select
                    value={authRole}
                    onChange={(e) => setAuthRole(e.target.value as 'student' | 'teacher')}
                    className="w-full mt-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl p-3 text-xs focus:border-cyan-500"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Instructor / Teacher</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-slate-400 font-semibold">Email Address</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold">Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingAuth}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-xs"
            >
              {submittingAuth
                ? 'Processing...'
                : authMode === 'login'
                ? 'Sign In to Portal'
                : 'Create Account'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login')
                setAuthError('')
              }}
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        userRole={user.role}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} notifications={notifications} />

        <main className="flex-1 overflow-y-auto">
          {currentTab === 'overview' && (
            <DashboardPage user={user} summary={dashboardSummary} setCurrentTab={setCurrentTab} />
          )}
          {currentTab === 'timetable' && <TimetablePage user={user} />}
          {currentTab === 'courses' && <CoursesPage user={user} />}
          {currentTab === 'assessments' && user.role !== 'admin' && <AssessmentsPage user={user} />}
          {currentTab === 'learning-intelligence' && <LearningIntelligencePage user={user} />}
          {currentTab === 'assignments' && user.role !== 'admin' && <AssignmentsPage user={user} />}
          {currentTab === 'organizations' && <OrganizationsPage user={user} />}
          {currentTab === 'coding' && <CodingPage user={user} />}
          {currentTab === 'classroom' && <ClassroomPage user={user} />}
          {currentTab === 'admin' && <AdminPage user={user} />}
        </main>
      </div>
    </div>
  )
}
export default App
