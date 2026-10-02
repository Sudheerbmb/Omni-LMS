import React from 'react'
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  FileText,
  Building2,
  Code2,
  Video,
  Users,
  LogOut,
  CalendarDays,
  BrainCircuit,
  Award,
  ChevronRight,
} from 'lucide-react'

type SidebarProps = {
  currentTab: string
  setCurrentTab: (tab: string) => void
  userRole?: 'admin' | 'teacher' | 'student'
  onLogout: () => void
}

const ROLE_META = {
  admin: {
    label: 'Administrator',
    badge: 'Admin',
    badgeBg: 'bg-blue-600',
    initials: 'A',
    avatarBg: 'bg-blue-600',
  },
  teacher: {
    label: 'Faculty Portal',
    badge: 'Teacher',
    badgeBg: 'bg-emerald-600',
    initials: 'T',
    avatarBg: 'bg-emerald-600',
  },
  student: {
    label: 'Learning Portal',
    badge: 'Student',
    badgeBg: 'bg-sky-500',
    initials: 'S',
    avatarBg: 'bg-sky-500',
  },
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  userRole = 'student',
  onLogout,
}) => {
  const meta = ROLE_META[userRole]

  const timetableLabel =
    userRole === 'admin'
      ? 'Timetable Engine'
      : userRole === 'teacher'
      ? 'My Timetable'
      : 'Class Schedule'

  const navItems = [
    { id: 'overview',              label: 'Dashboard',            icon: LayoutDashboard },
    { id: 'timetable',             label: timetableLabel,          icon: CalendarDays },
    { id: 'courses',               label: 'Course Catalog',        icon: BookOpen },
    ...(userRole !== 'admin'
      ? [{ id: 'assessments',      label: 'Assessments',          icon: CheckSquare }]
      : []),
    {
      id: 'learning-intelligence',
      label:
        userRole === 'student'
          ? 'My Learning Agent'
          : userRole === 'admin'
          ? 'School Cognitive Radar'
          : 'Learning Intelligence',
      icon: BrainCircuit,
    },
    ...(userRole !== 'admin'
      ? [{ id: 'assignments',      label: 'Assignments',          icon: FileText }]
      : []),
    ...(userRole !== 'admin'
      ? [{ id: 'certificates',     label: 'Certificates',         icon: Award }]
      : []),
    { id: 'organizations',         label: 'Organizations',        icon: Building2 },
    { id: 'coding',                label: 'Coding Playground',    icon: Code2 },
    { id: 'classroom',             label: 'Live Classrooms',      icon: Video },
    ...(userRole === 'admin'
      ? [{ id: 'admin',            label: 'User Management',      icon: Users }]
      : []),
  ]

  return (
    <aside
      className="w-64 shrink-0 flex flex-col h-screen select-none"
      style={{
        background: '#090C16',
        borderRight: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* ── Brand ──────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-base select-none shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #22D3EE 100%)',
              boxShadow: '0 0 16px rgba(139, 92, 246, 0.35)',
            }}
          >
            A
          </div>
          <div>
            <p className="text-white font-extrabold text-[15px] leading-tight tracking-tight">Acharya LMS</p>
            <p style={{ color: '#22D3EE', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {meta.label}
            </p>
          </div>
        </div>
      </div>

      {/* ── Role pill ───────────────────────────────── */}
      <div className="px-4 py-3">
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className={`w-6 h-6 rounded-lg ${meta.avatarBg} flex items-center justify-center text-white font-extrabold text-[11px] shadow-sm`}
          >
            {meta.initials}
          </div>
          <span style={{ color: '#F8FAFC', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
            {meta.badge} Portal
          </span>
          <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────── */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = currentTab === item.id
          const isAiItem = item.id === 'learning-intelligence'
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 relative overflow-hidden"
              style={{
                background: active
                  ? isAiItem
                    ? 'linear-gradient(90deg, rgba(34,211,238,0.18) 0%, rgba(139,92,246,0.10) 100%)'
                    : 'linear-gradient(90deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.08) 100%)'
                  : 'transparent',
                color: active ? '#F8FAFC' : '#A7B0C0',
                fontWeight: active ? 600 : 400,
                fontSize: '0.8125rem',
                border: active
                  ? isAiItem
                    ? '1px solid rgba(34,211,238,0.3)'
                    : '1px solid rgba(139,92,246,0.3)'
                  : '1px solid transparent',
                cursor: 'pointer',
                boxShadow: active ? '0 2px 10px rgba(0,0,0,0.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = '#FFFFFF'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#A7B0C0'
                }
              }}
            >
              <Icon
                style={{
                  width: 16,
                  height: 16,
                  color: active
                    ? isAiItem
                      ? '#22D3EE'
                      : '#A78BFA'
                    : '#6B7280',
                  flexShrink: 0,
                  filter: active ? 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' : 'none',
                }}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {isAiItem && !active && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  AI
                </span>
              )}
              {active && (
                <ChevronRight
                  style={{
                    width: 14,
                    height: 14,
                    color: isAiItem ? '#22D3EE' : '#A78BFA',
                    opacity: 0.9,
                  }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Logout ──────────────────────────────────── */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: '#6B7280',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'
            e.currentTarget.style.color = '#FCA5A5'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
            e.currentTarget.style.color = '#6B7280'
          }}
        >
          <LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
