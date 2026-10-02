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
      <div style={{ minHeight: '100vh', background: '#080A12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#8B5CF6', borderRightColor: '#22D3EE', animation: 'spin 0.75s linear infinite', margin: '0 auto 16px', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }} />
          <p style={{ fontSize: 11, color: '#A7B0C0', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Loading Acharya LMS...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }


  if (!user || !token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", background: '#080A12', color: '#F8FAFC' }}>

        {/* Left branding panel */}
        {/* Left branding panel */}
        <div style={{ width: 420, background: '#06080F', borderRight: '1px solid rgba(245,158,11,0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3.5rem 3rem', color: '#F8FAFC', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          {/* Subtle Ambient Glow */}
          <div style={{ position: 'absolute', top: -100, left: -100, width: 320, height: 320, background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -100, right: -100, width: 320, height: 320, background: 'radial-gradient(circle, rgba(234,88,12,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '2.5rem', position: 'relative', zIndex: 1 }}>
            <img
              src="/acharya_logo.png"
              alt="Acharya LMS Logo"
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                objectFit: 'cover',
                boxShadow: '0 0 24px rgba(245, 158, 11, 0.35)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
              }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#F8FAFC' }}>Acharya LMS</div>
              <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Academic AI OS</div>
            </div>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25, marginBottom: 14, letterSpacing: '-0.02em', color: '#F8FAFC', position: 'relative', zIndex: 1 }}>
            Illuminating Minds Through Knowledge & AI
          </h2>
          <p style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.75, marginBottom: '2.25rem', position: 'relative', zIndex: 1 }}>
            Rooted in timeless scholarly traditions, Acharya LMS empowers educators, enriches student learning, and unifies institutional intelligence with real-time classrooms and cognitive defense agents.
          </p>

          {/* Feature list — sleek dark border items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', zIndex: 1 }}>
            {[
              { label: 'Cognitive Learner Radar', desc: 'Real-time telemetry and adaptive learning paths' },
              { label: 'Live Video Classrooms', desc: 'Cloud recording, attendance, and interaction streams' },
              { label: 'School-Wide AI Analytics', desc: 'Predictive performance and institutional oversight' },
              { label: 'Autonomous Timetabling', desc: 'Conflict-free constraint-satisfaction scheduling' },
            ].map(f => (
              <div key={f.label} style={{ paddingLeft: 14, borderLeft: '2px solid rgba(245,158,11,0.6)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#F8FAFC' }}>{f.label}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem', overflowY: 'auto', background: '#06080F' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>

            {/* Heading */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC', marginBottom: 6, letterSpacing: '-0.02em' }}>
                {authMode === 'login' ? 'Sign in to Acharya LMS' : 'Create an Account'}
              </h1>
              <p style={{ fontSize: 13, color: '#CBD5E1' }}>
                {authMode === 'login' ? 'Enter your credentials to access your portal.' : 'Fill in your details to register.'}
              </p>
            </div>

            {/* Error */}
            {authError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#F87171', fontSize: 12, marginBottom: 20, fontWeight: 500 }}>
                {authError}
              </div>
            )}

            {/* Demo quick-access */}
            {authMode === 'login' && (
              <div style={{ background: '#111726', border: '1px solid rgba(245,158,11,0.14)', borderRadius: 12, padding: '16px', marginBottom: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12 }}>
                  Instant Demo Access — Click to autofill
                </p>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>

                  {/* Admin */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#FBBF24', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Administrator</p>
                    <button type="button"
                      onClick={() => { setAuthEmail('admin@example.com'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, color: '#FDE68A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      System Admin
                    </button>
                  </div>

                  {/* Teachers */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#FB923C', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Faculty</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {[
                        ['sarah.connor@school.edu', 'Dr. Sarah — Math'],
                        ['alan.turing@school.edu', 'Prof. Turing — CS'],
                      ].map(([email, label]) => (
                        <button key={email} type="button"
                          onClick={() => { setAuthEmail(email); setAuthPassword('Teacher123!'); setAuthError(''); }}
                          style={{ padding: '6px 12px', background: 'rgba(234,88,12,0.14)', border: '1px solid rgba(234,88,12,0.35)', borderRadius: 8, color: '#FDBA74', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Students */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#FDE047', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Students</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {[
                        ['student.class1@school.edu', 'Class 1-A'],
                        ['student.class6@school.edu', 'Class 6-A'],
                        ['student.class10@school.edu', 'Class 10-A'],
                      ].map(([email, label]) => (
                        <button key={email} type="button"
                          onClick={() => { setAuthEmail(email); setAuthPassword('Student123!'); setAuthError(''); }}
                          style={{ padding: '6px 12px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, color: '#FEF08A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
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
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', display: 'block', marginBottom: 5 }}>Full Name</label>
                    <input type="text" required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="e.g. Priya Sharma"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 13, color: '#F8FAFC', background: '#111726', outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', display: 'block', marginBottom: 5 }}>Phone Number</label>
                    <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="+91 98765 43210"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 13, color: '#F8FAFC', background: '#111726', outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', display: 'block', marginBottom: 5 }}>Account Role</label>
                    <select value={authRole} onChange={e => setAuthRole(e.target.value as 'student' | 'teacher')}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 13, color: '#F8FAFC', background: '#111726', outline: 'none', boxSizing: 'border-box' as const }}>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher / Instructor</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', display: 'block', marginBottom: 5 }}>Email Address</label>
                <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@school.edu"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 13, color: '#F8FAFC', background: '#111726', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', display: 'block', marginBottom: 5 }}>Password</label>
                <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Enter your password"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 13, color: '#F8FAFC', background: '#111726', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <button type="submit" disabled={submittingAuth}
                style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)', color: '#111827', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: submittingAuth ? 'not-allowed' : 'pointer', opacity: submittingAuth ? 0.7 : 1, marginTop: 6, boxShadow: '0 4px 18px rgba(245,158,11,0.35)', letterSpacing: '-0.01em' }}>
                {submittingAuth ? 'Signing in...' : authMode === 'login' ? 'Sign In to Workspace' : 'Create Account'}
              </button>
            </form>

            <p style={{ marginTop: 20, textAlign: 'center' as const, fontSize: 12, color: '#94A3B8' }}>
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                style={{ background: 'none', border: 'none', color: '#F59E0B', fontWeight: 700, cursor: 'pointer', fontSize: 12, padding: 0 }}>
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
