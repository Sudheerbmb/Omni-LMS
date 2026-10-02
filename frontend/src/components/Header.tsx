import React, { useState } from 'react'
import type { User, Notification as LMSNotification } from '../lib/api'
import { Bell, X, ChevronDown } from 'lucide-react'

type HeaderProps = {
  user: User
  notifications: LMSNotification[]
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:   { bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', text: '#ffffff', border: 'rgba(245,158,11,0.5)' },
  teacher: { bg: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)', text: '#ffffff', border: 'rgba(234,88,12,0.5)' },
  student: { bg: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)', text: '#0F172A', border: 'rgba(251,191,36,0.6)' },
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
        background: '#06080F',
        borderBottom: '1px solid rgba(245, 158, 11, 0.12)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Left: breadcrumb ───────────────────── */}
      <div className="flex items-center gap-2.5">
        <span
          className="text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-md"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.35)' }}
        >
          Acharya LMS
        </span>
        <span style={{ color: 'rgba(245,158,11,0.4)', fontSize: '0.875rem' }}>›</span>
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
              background: showNotifs ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)',
              border: showNotifs ? '1px solid rgba(245,158,11,0.45)' : '1px solid rgba(255,255,255,0.08)',
              color: showNotifs ? '#FDE68A' : '#CBD5E1',
              cursor: 'pointer',
            }}
            title="Notifications"
          >
            <Bell style={{ width: 16, height: 16 }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-white font-extrabold shadow-sm"
                style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)', fontSize: '0.6rem' }}
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
                background: '#111726',
                border: '1px solid rgba(245,158,11,0.2)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid rgba(245,158,11,0.12)', background: '#0B0F19' }}
              >
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
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
                        style={{ background: n.read_at ? 'rgba(255,255,255,0.2)' : '#F59E0B', boxShadow: n.read_at ? 'none' : '0 0 8px #F59E0B' }}
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
        <div className="h-6 w-px" style={{ background: 'rgba(245,158,11,0.15)' }} />

        {/* User Pill */}
        <div
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors cursor-default"
          style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}
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
            <p className="text-[10px] leading-tight text-amber-400/80 font-medium">
              {roleLabel}
            </p>
          </div>
          <ChevronDown style={{ width: 13, height: 13, color: '#F59E0B' }} />
        </div>
      </div>
    </header>
  )
}
