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
  BrainCircuit
} from 'lucide-react'

type SidebarProps = {
  currentTab: string
  setCurrentTab: (tab: string) => void
  userRole?: 'admin' | 'teacher' | 'student'
  onLogout: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  userRole = 'student',
  onLogout
}) => {
  const timetableLabel = userRole === 'admin' 
    ? 'AI Timetable Engine' 
    : userRole === 'teacher' 
    ? 'My Teaching Timetable' 
    : 'Class Timetable'

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'timetable', label: timetableLabel, icon: CalendarDays },
    { id: 'courses', label: 'Course Catalog', icon: BookOpen },
    { id: 'assessments', label: 'Assessments & Quizzes', icon: CheckSquare },
    { id: 'learning-intelligence', label: userRole === 'student' ? 'My Learning Agent' : 'Learning Intelligence', icon: BrainCircuit },
    { id: 'assignments', label: 'Assignments Desk', icon: FileText },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'coding', label: 'Coding Playground', icon: Code2 },
    { id: 'classroom', label: 'Live Classrooms', icon: Video },
    ...(userRole === 'admin' ? [{ id: 'admin', label: 'User Admin', icon: Users }] : [])
  ]

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 shrink-0 text-slate-300">
      <div>
        <div className="flex items-center gap-3 px-3 py-4 border-b border-slate-800 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-cyan-500/20">
            Z
          </div>
          <div>
            <h1 className="font-bold text-white tracking-wide text-base">Zoom LMS</h1>
            <p className="text-xs text-slate-400 capitalize">{userRole} Portal</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = currentTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
