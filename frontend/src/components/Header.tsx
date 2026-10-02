import React, { useState } from 'react'
import type { User, Notification as LMSNotification } from '../lib/api'
import { Bell, X, ChevronDown } from 'lucide-react'

type HeaderProps = {
  user: User
  notifications: LMSNotification[]
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:   { bg: '#1d4ed8', text: '#fff', border: '#3b82f6' },
  teacher: { bg: '#0f766e', text: '#fff', border: '#14b8a6' },
  student: { bg: '#0284c7', text: '#fff', border: '#38bdf8' },
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
      className="h-14 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Left: breadcrumb ───────────────────── */}
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--muted)' }}
        >
          Omni LMS
        </span>
        <span style={{ color: 'var(--border)', fontSize: '1rem', lineHeight: 1 }}>›</span>
        <span
          className="text-sm font-semibold capitalize"
          style={{ color: 'var(--text)' }}
        >
          {ROLE_LABELS[user.role] ?? user.role} Workspace
        </span>
      </div>

      {/* ── Right: actions ─────────────────────── */}
      <div className="flex items-center gap-3">

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg"
            style={{
              background: showNotifs ? 'var(--active-bg)' : 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
            title="Notifications"
          >
            <Bell style={{ width: 16, height: 16 }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-white font-bold"
                style={{ background: 'var(--accent)', fontSize: '0.6rem' }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifs && (
            <div
              className="absolute right-0 mt-2 w-80 rounded-xl shadow-lg z-50"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {notifications.length} total
                  </span>
                  <button
                    onClick={() => setShowNotifs(false)}
                    style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-2">
                {notifications.length === 0 ? (
                  <p
                    className="text-xs text-center py-6"
                    style={{ color: 'var(--muted)' }}
                  >
                    No notifications yet
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="px-4 py-3 flex items-start gap-3"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: n.read_at ? 'var(--border)' : 'var(--accent)' }}
                      />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                          {n.title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
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
        <div className="h-8 w-px" style={{ background: 'var(--border)' }} />

        {/* User Pill */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm select-none"
            style={{ background: roleColor.bg, color: roleColor.text }}
          >
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
              {user.display_name}
            </p>
            <p className="text-[10px] leading-tight" style={{ color: 'var(--muted)' }}>
              {roleLabel}
            </p>
          </div>
          <ChevronDown style={{ width: 13, height: 13, color: 'var(--muted)' }} />
        </div>
      </div>
    </header>
  )
}
