import React from 'react'
import type { DashboardSummary, User } from '../lib/api'
import { BookOpen, CheckSquare, FileText, Award, TrendingUp } from 'lucide-react'

type DashboardPageProps = {
  user: User
  summary: DashboardSummary | null
  setCurrentTab: (tab: string) => void
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, summary, setCurrentTab }) => {
  const stats = summary?.stats || {}

  const statCards = [
    { label: 'Active Courses', value: stats.courses ?? 0, icon: BookOpen, color: 'text-cyan-400', tab: 'courses' },
    { label: 'Total Assessments', value: stats.assessments ?? 0, icon: CheckSquare, color: 'text-blue-400', tab: 'assessments' },
    { label: 'Assignments', value: stats.assignments ?? 0, icon: FileText, color: 'text-indigo-400', tab: 'assignments' },
    { label: 'Certificates Earned', value: stats.certificates ?? 0, icon: Award, color: 'text-amber-400', tab: 'certificates' },
  ]

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-cyan-900/40 via-blue-950 to-slate-900 border border-cyan-500/20 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-400">Welcome Back</span>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Hello, {user.display_name} 👋
          </h2>
          <p className="text-slate-300 text-sm max-w-xl">
            You are logged into the <span className="text-cyan-400 capitalize font-bold">{user.role}</span> workspace portal. Track your progress, manage courses, and complete assignments.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <button
              key={idx}
              onClick={() => setCurrentTab(card.tab)}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left hover:border-slate-700 transition-all hover:scale-[1.02] group"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-400">{card.label}</span>
                <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center ${card.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-white">{card.value}</p>
              <p className="text-[11px] text-cyan-400 mt-2 font-medium flex items-center gap-1">
                View details →
              </p>
            </button>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-slate-200 text-base flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" /> Quick Launch Desk
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => setCurrentTab('courses')}
            className="p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 text-left transition-colors"
          >
            <p className="font-bold text-sm text-slate-100">Explore Catalog</p>
            <p className="text-xs text-slate-400 mt-1">Browse courses and enroll in new subjects.</p>
          </button>

          <button
            onClick={() => setCurrentTab('assessments')}
            className="p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 text-left transition-colors"
          >
            <p className="font-bold text-sm text-slate-100">Take Quizzes</p>
            <p className="text-xs text-slate-400 mt-1">Complete assessments and check scores.</p>
          </button>

          <button
            onClick={() => setCurrentTab('classroom')}
            className="p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 text-left transition-colors"
          >
            <p className="font-bold text-sm text-slate-100">Live Zoom Classes</p>
            <p className="text-xs text-slate-400 mt-1">Join scheduled online lectures.</p>
          </button>
        </div>
      </div>
    </div>
  )
}
