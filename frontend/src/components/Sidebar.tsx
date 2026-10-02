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
      className="w-60 shrink-0 flex flex-col h-screen"
      style={{
        background: 'var(--sidebar)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Brand ──────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-white text-base select-none"
            style={{ background: 'var(--accent)' }}
          >
            O
          </div>
          <div>
            <p className="text-white font-bold text-[15px] leading-tight tracking-tight">Omni LMS</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem', fontWeight: 500 }}>
              {meta.label}
            </p>
          </div>
        </div>
      </div>

      {/* ── Role pill ───────────────────────────────── */}
      <div className="px-4 py-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div
            className={`w-6 h-6 rounded-full ${meta.avatarBg} flex items-center justify-center text-white font-bold text-[11px]`}
          >
            {meta.initials}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 600 }}>
            {meta.badge} Portal
          </span>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────── */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = currentTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left group"
              style={{
                background: active ? 'var(--active-bg)' : 'transparent',
                color: active ? 'var(--active-t)' : 'rgba(255,255,255,0.55)',
                fontWeight: active ? 600 : 400,
                fontSize: '0.8125rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.88)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                }
              }}
            >
              <Icon
                style={{
                  width: 15,
                  height: 15,
                  color: active ? 'var(--active-t)' : 'rgba(255,255,255,0.4)',
                  flexShrink: 0,
                }}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {active && (
                <ChevronRight style={{ width: 13, height: 13, color: 'var(--active-t)', opacity: 0.7 }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Logout ──────────────────────────────────── */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
            e.currentTarget.style.color = '#fca5a5'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
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
