import React, { useState } from 'react'
import type { User, Notification as LMSNotification } from '../lib/api'
import { Bell } from 'lucide-react'

type HeaderProps = {
  user: User
  notifications: LMSNotification[]
}

export const Header: React.FC<HeaderProps> = ({ user, notifications }) => {
  const [showNotifs, setShowNotifs] = useState(false)
  const unreadCount = notifications.filter(n => !n.read_at).length

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Workspace</span>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-semibold text-slate-200">Global Environment</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-50">
              <h3 className="font-semibold text-sm text-slate-200 mb-3 flex items-center justify-between">
                <span>Notifications</span>
                <span className="text-xs text-slate-500">{notifications.length} total</span>
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No notifications yet</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50">
                      <p className="text-xs font-semibold text-slate-200">{n.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm border border-cyan-500/30">
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">{user.display_name}</p>
            <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
