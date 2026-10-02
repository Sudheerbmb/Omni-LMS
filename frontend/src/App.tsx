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
      <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", background: '#f1f5f9' }}>

        {/* Left branding panel */}
        <div style={{ width: 400, background: '#1e3a5f', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem', color: '#fff', flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '3rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em' }}>O</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>Omni LMS</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>Education Management System</div>
            </div>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, marginBottom: 14, letterSpacing: '-0.01em' }}>
            One platform for your entire school.
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, marginBottom: '2.5rem' }}>
            Omni LMS connects administrators, teachers, and students in a single unified workspace — with timetables, live classrooms, assessments, and learning analytics.
          </p>

          {/* Feature list — text only, no icons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Adaptive Learning Paths', desc: 'Curriculum designed around each student' },
              { label: 'Live Video Classrooms', desc: 'HD sessions with attendance tracking' },
              { label: 'School-wide Analytics', desc: 'Real-time performance dashboards' },
              { label: 'Automated Timetabling', desc: 'AI-generated conflict-free schedules' },
            ].map(f => (
              <div key={f.label} style={{ paddingLeft: 12, borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>

            {/* Heading */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 6, letterSpacing: '-0.01em' }}>
                {authMode === 'login' ? 'Sign in to your account' : 'Create a new account'}
              </h1>
              <p style={{ fontSize: 13, color: '#64748b' }}>
                {authMode === 'login' ? 'Enter your credentials to access your portal.' : 'Fill in your details to register.'}
              </p>
            </div>

            {/* Error */}
            {authError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 12, marginBottom: 20, fontWeight: 500 }}>
                {authError}
              </div>
            )}

            {/* Demo quick-access — no emojis, just clean labels */}
            {authMode === 'login' && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12 }}>
                  Demo Accounts — Click to fill credentials
                </p>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>

                  {/* Admin */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Administrator</p>
                    <button type="button"
                      onClick={() => { setAuthEmail('admin@example.com'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      style={{ padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      System Admin
                    </button>
                  </div>

                  {/* Teachers */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Faculty</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {[
                        ['sarah.connor@school.edu', 'Dr. Sarah — Mathematics'],
                        ['alan.turing@school.edu', 'Prof. Turing — Computer Science'],
                      ].map(([email, label]) => (
                        <button key={email} type="button"
                          onClick={() => { setAuthEmail(email); setAuthPassword('Teacher123!'); setAuthError(''); }}
                          style={{ padding: '6px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#15803d', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Students */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Students</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {[
                        ['student.class1@school.edu', 'Class 1-A'],
                        ['student.class6@school.edu', 'Class 6-A'],
                        ['student.class10@school.edu', 'Class 10-A'],
                      ].map(([email, label]) => (
                        <button key={email} type="button"
                          onClick={() => { setAuthEmail(email); setAuthPassword('Student123!'); setAuthError(''); }}
                          style={{ padding: '6px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, color: '#0369a1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Login / Register form */}
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
              {authMode === 'register' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Full Name</label>
                    <input type="text" required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="e.g. Priya Sharma"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Phone Number</label>
                    <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="+91 98765 43210"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Account Role</label>
                    <select value={authRole} onChange={e => setAuthRole(e.target.value as 'student' | 'teacher')}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }}>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher / Instructor</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Email Address</label>
                <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@school.edu"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Password</label>
                <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Enter your password"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <button type="submit" disabled={submittingAuth}
                style={{ width: '100%', padding: '11px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: submittingAuth ? 'not-allowed' : 'pointer', opacity: submittingAuth ? 0.7 : 1, marginTop: 4 }}>
                {submittingAuth ? 'Signing in...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p style={{ marginTop: 18, textAlign: 'center' as const, fontSize: 12, color: '#64748b' }}>
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                style={{ background: 'none', border: 'none', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', fontSize: 12, padding: 0 }}>
                {authMode === 'login' ? 'Register' : 'Sign In'}
              </button>
            </p>

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
