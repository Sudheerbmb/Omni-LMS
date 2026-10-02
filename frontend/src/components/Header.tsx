import React, { useState } from 'react'
import type { User, Notification as LMSNotification } from '../lib/api'
import { Bell, X, ChevronDown } from 'lucide-react'

type HeaderProps = {
  user: User
  notifications: LMSNotification[]
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:   { bg: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', text: '#fff', border: 'rgba(99,102,241,0.4)' },
  teacher: { bg: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', text: '#fff', border: 'rgba(139,92,246,0.4)' },
  student: { bg: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)', text: '#fff', border: 'rgba(6,182,212,0.4)' },
}

const ROLE_LABELS: Record<string, string> = {
  admin:   'Administrator',
  teacher: 'Faculty',
  student: 'Student',
}

export const Header: React.FC<HeaderProps> = ({ user, notifications }) => {
  const [showNotifs, setShowNotifs] = useState(false)
  const unreadCount = notifications.filter((n) => !n.read_at).length
  const roleColor = ROLE_COLORS[user.role] ?? ROLE_COLORS.student
  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  return (
    <header
      className="h-16 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30 select-none"
      style={{
        background: '#0D101A',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {/* ── Left: breadcrumb ───────────────────── */}
      <div className="flex items-center gap-2.5">
        <span
          className="text-[11px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md"
          style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' }}
        >
          Omni LMS
        </span>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.875rem' }}>›</span>
        <span
          className="text-xs sm:text-sm font-bold capitalize text-white flex items-center gap-1.5"
        >
          {ROLE_LABELS[user.role] ?? user.role} Workspace
        </span>
      </div>

      {/* ── Right: actions ─────────────────────── */}
      <div className="flex items-center gap-3.5">

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all"
            style={{
              background: showNotifs ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
              border: showNotifs ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: showNotifs ? '#A78BFA' : '#A7B0C0',
              cursor: 'pointer',
            }}
            title="Notifications"
          >
            <Bell style={{ width: 16, height: 16 }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-white font-extrabold shadow-sm"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #22D3EE 100%)', fontSize: '0.6rem' }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifs && (
            <div
              className="absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{
                background: '#151A28',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#111522' }}
              >
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {notifications.length} total
                  </span>
                  <button
                    onClick={() => setShowNotifs(false)}
                    style={{ color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {notifications.length === 0 ? (
                  <p
                    className="text-xs text-center py-6 text-slate-400"
                  >
                    No notifications yet
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="px-4 py-3 flex items-start gap-3 transition-colors hover:bg-white/[0.03]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: n.read_at ? 'rgba(255,255,255,0.2)' : '#8B5CF6', boxShadow: n.read_at ? 'none' : '0 0 8px #8B5CF6' }}
                      />
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {n.title}
                        </p>
                        <p className="text-[11px] mt-0.5 text-slate-400 leading-relaxed">
                          {n.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* User Pill */}
        <div
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors cursor-default"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs select-none shadow-sm"
            style={{ background: roleColor.bg, color: roleColor.text, border: `1px solid ${roleColor.border}` }}
          >
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold leading-tight text-white">
              {user.display_name}
            </p>
            <p className="text-[10px] leading-tight text-slate-400 font-medium">
              {roleLabel}
            </p>
          </div>
          <ChevronDown style={{ width: 13, height: 13, color: '#6B7280' }} />
        </div>
      </div>
    </header>
  )
}
