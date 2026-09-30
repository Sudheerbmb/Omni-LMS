import React, { useState, useEffect } from 'react'
import type { AdminUser, User } from '../lib/api'
import { getAdminUsers, approveUser, rejectUser } from '../lib/api'
import { Users, UserCheck, UserX } from 'lucide-react'

type AdminPageProps = {
  user: User
}

export const AdminPage: React.FC<AdminPageProps> = () => {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const list = await getAdminUsers()
      setAdminUsers(list || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string, role: 'student' | 'teacher') => {
    try {
      await approveUser(userId, role)
      setAdminUsers(adminUsers.map(u => u.id === userId ? { ...u, status: 'approved', role } : u))
    } catch (err: any) {
      alert(err.message || 'Failed to approve user')
    }
  }

  const handleReject = async (userId: string) => {
    try {
      await rejectUser(userId)
      setAdminUsers(adminUsers.map(u => u.id === userId ? { ...u, status: 'rejected' } : u))
    } catch (err: any) {
      alert(err.message || 'Failed to reject user')
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <Users className="w-7 h-7 text-cyan-400" />
          User Administration Console
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Review pending registrations, assign roles, and grant system access.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading users...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="p-4">User</th>
                <th className="p-4">Requested Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Registered Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {adminUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-slate-200">{u.display_name}</p>
                    <p className="text-[11px] text-slate-400">{u.email}</p>
                  </td>
                  <td className="p-4 uppercase tracking-wider font-mono text-cyan-400 font-bold">{u.role}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      u.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : u.status === 'rejected'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right space-x-2">
                    {u.status !== 'approved' && (
                      <button
                        onClick={() => handleApprove(u.id, u.role as 'student' | 'teacher')}
                        className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs inline-flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {u.status !== 'rejected' && (
                      <button
                        onClick={() => handleReject(u.id)}
                        className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 font-bold px-3 py-1.5 rounded-lg border border-rose-500/30 text-xs inline-flex items-center gap-1"
                      >
                        <UserX className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
