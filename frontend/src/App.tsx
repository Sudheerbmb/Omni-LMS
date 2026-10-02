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
import { CertificatesPage } from './pages/CertificatesPage'
import { OmniCopilot } from './components/OmniCopilot'

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
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#0ea5e9', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading Omni LMS...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user || !token) {
    return (
        {/* Left branding panel */}
        <div style={{ width: 420, background: 'linear-gradient(160deg, #1e3a5f 0%, #1d4ed8 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem 3.5rem', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '3rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>O</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>Omni LMS</div>
              <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>Education Management System</div>
            </div>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.02em' }}>Empowering Learning,<br />One Classroom at a Time.</h2>
          <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.7, marginBottom: '2.5rem' }}>A unified platform for administrators, teachers, and students — with AI-powered insights, live classrooms, and intelligent assessments.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { icon: '🎓', label: 'Smart Learning Paths', desc: 'Adaptive curriculum powered by LENS-Ω' },
              { icon: '📊', label: 'Real-time Analytics', desc: 'School-wide cognitive health dashboards' },
              { icon: '🖥️', label: 'Live Classrooms', desc: 'HD video, whiteboard & breakout rooms' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 20, marginTop: 1 }}>{f.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{f.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right form panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6, letterSpacing: '-0.02em' }}>
                {authMode === 'login' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p style={{ fontSize: 13, color: '#64748b' }}>
                {authMode === 'login' ? 'Sign in to access your portal' : 'Register to start your learning journey'}
              </p>
            </div>

            {authError && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, color: '#b91c1c', fontSize: 12, marginBottom: 20, fontWeight: 500 }}>
                {authError}
              </div>
            )}

            {/* Quick demo login */}
            {authMode === 'login' && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12 }}>⚡ Quick Login (Demo)</div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' as const }}>Administrator</div>
                    <button type="button" onClick={() => { setAuthEmail('admin@example.com'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      style={{ padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, color: '#1d4ed8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      🛡️ Admin (System)
                    </button>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' as const }}>Faculty</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {[['sarah.connor@school.edu','👩‍🏫 Dr. Sarah (Math)'],['alan.turing@school.edu','👨‍🏫 Prof. Turing (CS)']].map(([email, label]) => (
                        <button key={email} type="button" onClick={() => { setAuthEmail(email); setAuthPassword('Teacher123!'); setAuthError(''); }}
                          style={{ padding: '6px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, color: '#15803d', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' as const }}>Students</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {[['student.class1@school.edu','🎒 Class 1-A'],['student.class6@school.edu','🎒 Class 6-A'],['student.class10@school.edu','🎒 Class 10-A']].map(([email, label]) => (
                        <button key={email} type="button" onClick={() => { setAuthEmail(email); setAuthPassword('Student123!'); setAuthError(''); }}
                          style={{ padding: '6px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7, color: '#0369a1', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
              {authMode === 'register' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Full Name</label>
                    <input type="text" required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="John Doe"
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Phone Number</label>
                    <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="+91 99999 00000"
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Account Role</label>
                    <select value={authRole} onChange={e => setAuthRole(e.target.value as 'student' | 'teacher')}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }}>
                      <option value="student">Student</option>
                      <option value="teacher">Instructor / Teacher</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email Address</label>
                <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@school.edu"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Password</label>
                <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <button type="submit" disabled={submittingAuth}
                style={{ width: '100%', padding: '11px', background: submittingAuth ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: submittingAuth ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                {submittingAuth ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center' as const }}>
              <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                style={{ background: 'none', border: 'none', fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
                {authMode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      data-role={user.role}
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        userRole={user.role}
        onLogout={handleLogout}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header user={user} notifications={notifications} />

        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          {currentTab === 'overview' && (
            <DashboardPage user={user} summary={dashboardSummary} setCurrentTab={setCurrentTab} />
          )}
          {currentTab === 'timetable' && <TimetablePage user={user} />}
          {currentTab === 'courses' && <CoursesPage user={user} />}
          {currentTab === 'assessments' && user.role !== 'admin' && <AssessmentsPage user={user} />}
          {currentTab === 'learning-intelligence' && <LearningIntelligencePage user={user} />}
          {currentTab === 'assignments' && user.role !== 'admin' && <AssignmentsPage user={user} />}
          {currentTab === 'certificates' && user.role !== 'admin' && <CertificatesPage user={user} />}
          {currentTab === 'organizations' && <OrganizationsPage user={user} />}
          {currentTab === 'coding' && <CodingPage user={user} />}
          {currentTab === 'classroom' && <ClassroomPage user={user} />}
          {currentTab === 'admin' && <AdminPage user={user} />}
        </main>
      </div>

      {/* Global Universal Omni-Copilot on Every Page */}
      <OmniCopilot
        user={user}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
      />
    </div>
  )
}
export default App
