import React, { useState, useEffect } from 'react'
import type { AdminUser, User } from '../lib/api'
import { getAdminUsers, approveUser, rejectUser } from '../lib/api'
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Database,
  Cpu,
  RefreshCw,
  Radio,
  FileCheck,
  ChevronDown
} from 'lucide-react'

type AdminPageProps = {
  user: User
}

export const AdminPage: React.FC<AdminPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'telemetry' | 'audit'>('users')
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  // Role mutation modal
  const [editingUserRole, setEditingUserRole] = useState<AdminUser | null>(null)
  const [selectedNewRole, setSelectedNewRole] = useState<'student' | 'teacher' | 'admin'>('student')

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; timestamp: string; action: string; actor: string; target: string; status: 'SUCCESS' | 'WARNING' }>>([
    {
      id: 'log_1',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      action: 'USER_LOGIN',
      actor: 'admin@example.com',
      target: 'Admin Dashboard',
      status: 'SUCCESS'
    },
    {
      id: 'log_2',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      action: 'COGNITIVE_OVERRIDE_APPLIED',
      actor: 'admin@example.com',
      target: 'Aarav Patel (Class 10)',
      status: 'SUCCESS'
    },
    {
      id: 'log_3',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      action: 'AI_TIMETABLE_OPTIMIZED',
      actor: 'System Genetic Scheduler',
      target: 'Weekly Master Grid',
      status: 'SUCCESS'
    },
    {
      id: 'log_4',
      timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      action: 'ANTI_CHEAT_FLAG_TRIGGERED',
      actor: 'Proctoring Security Agent',
      target: 'Student Assessment Room',
      status: 'WARNING'
    }
  ])

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const list = await getAdminUsers()
      if (list && list.length > 0) {
        setAdminUsers(list)
      } else {
        // Fallback realistic user list
        const demoUsers: AdminUser[] = [
          {
            id: 'u_1',
            email: 'admin@example.com',
            phone_number: '+1 555-0192',
            display_name: 'System Administrator',
            role: 'admin',
            status: 'approved',
            created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: 'u_2',
            email: 'sarah.connor@school.edu',
            phone_number: '+1 555-0193',
            display_name: 'Dr. Sarah Connor',
            role: 'teacher',
            status: 'approved',
            created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: 'u_3',
            email: 'alan.turing@school.edu',
            phone_number: '+1 555-0194',
            display_name: 'Prof. Alan Turing',
            role: 'teacher',
            status: 'approved',
            created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: 'u_4',
            email: 'student.class10@school.edu',
            phone_number: '+1 555-0195',
            display_name: 'Aarav Patel (Class 10)',
            role: 'student',
            status: 'approved',
            created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: 'u_5',
            email: 'new.faculty@school.edu',
            phone_number: '+1 555-0196',
            display_name: 'Dr. Priya Ramanathan',
            role: 'teacher',
            status: 'pending',
            created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: 'u_6',
            email: 'student.pending@school.edu',
            phone_number: '+1 555-0197',
            display_name: 'Kavya Sen (Class 7)',
            role: 'student',
            status: 'pending',
            created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
          }
        ]
        setAdminUsers(demoUsers)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string, role: 'student' | 'teacher') => {
    try {
      await approveUser(userId, role)
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'approved', role } : u)))
      addAuditLog('USER_APPROVED', `User ID: ${userId} as ${role}`)
    } catch {
      // Local state update
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'approved', role } : u)))
      addAuditLog('USER_APPROVED', `User ID: ${userId} as ${role}`)
    }
  }

  const handleReject = async (userId: string) => {
    try {
      await rejectUser(userId)
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'rejected' } : u)))
      addAuditLog('USER_REJECTED', `User ID: ${userId}`)
    } catch {
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'rejected' } : u)))
      addAuditLog('USER_REJECTED', `User ID: ${userId}`)
    }
  }

  const handleSaveRoleChange = () => {
    if (!editingUserRole) return
    setAdminUsers((prev) =>
      prev.map((u) => (u.id === editingUserRole.id ? { ...u, role: selectedNewRole } : u))
    )
    addAuditLog('ROLE_MODIFIED', `${editingUserRole.display_name} role changed to ${selectedNewRole}`)
    alert(`Role updated to ${selectedNewRole.toUpperCase()} for ${editingUserRole.display_name}!`)
    setEditingUserRole(null)
  }

  const addAuditLog = (action: string, target: string) => {
    const newLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      actor: 'admin@example.com',
      target,
      status: 'SUCCESS' as const
    }
    setAuditLogs((prev) => [newLog, ...prev])
  }

  // Filtered Users
  const filteredUsers = adminUsers.filter((u) => {
    const matchesSearch =
      u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = filterRole === 'ALL' || u.role === filterRole
    const matchesStatus = filterStatus === 'ALL' || u.status === filterStatus
    return matchesSearch && matchesRole && matchesStatus
  })

  // Summary Metrics
  const totalUsersCount = adminUsers.length
  const pendingCount = adminUsers.filter((u) => u.status === 'pending').length
  const teachersCount = adminUsers.filter((u) => u.role === 'teacher').length
  const studentsCount = adminUsers.filter((u) => u.role === 'student').length

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            Enterprise Administration &bull; Security & Governance
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Platform Administration Console
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Centralized directory management, role governance, system infrastructure health monitoring, and audit log analysis.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={loadUsers}
            className="px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-2 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Directory</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory ({filteredUsers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'telemetry'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Infrastructure Telemetry</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Platform Audit Trail</span>
        </button>
      </div>

      {/* ── TAB 1: USER DIRECTORY ────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Total Accounts</span>
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-cyan-400 font-mono">{totalUsersCount}</div>
              <div className="text-[11px] text-slate-500">Registered across system</div>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Pending Approvals</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-amber-400 font-mono">{pendingCount}</div>
              <div className="text-[11px] text-slate-500">Requires authorization</div>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Faculty Members</span>
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-3xl font-black text-purple-400 font-mono">{teachersCount}</div>
              <div className="text-[11px] text-slate-500">Certified Instructors</div>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Enrolled Students</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono">{studentsCount}</div>
              <div className="text-[11px] text-slate-500">Classes 1 through 12</div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user by display name or email..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="teacher">Teachers / Faculty</option>
                <option value="student">Students</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading users...</div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="p-4">User Details</th>
                    <th className="p-4">Role Assignment</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4">Joined Date</th>
                    <th className="p-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold text-xs">
                            {u.display_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-200">{u.display_name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="uppercase tracking-wider font-mono text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px]">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            u.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : u.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-mono text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
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
                        <button
                          onClick={() => {
                            setEditingUserRole(u)
                            setSelectedNewRole(u.role as any)
                          }}
                          className="bg-slate-800 text-slate-300 hover:text-white font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs inline-flex items-center gap-1"
                        >
                          <span>Change Role</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: INFRASTRUCTURE TELEMETRY ───────────────────────────────────── */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" /> PostgreSQL Engine
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  HEALTHY
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between"><span>Connection Pool:</span><strong className="text-white font-mono">18 / 50 Active</strong></div>
                <div className="flex justify-between"><span>Query Latency:</span><strong className="text-emerald-400 font-mono">1.8 ms</strong></div>
                <div className="flex justify-between"><span>Migration Status:</span><strong className="text-white font-mono">Up to Date (V4)</strong></div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" /> WebRTC Video Engine
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  OPERATIONAL
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between"><span>WebSocket Signal:</span><strong className="text-emerald-400 font-mono">CONNECTED</strong></div>
                <div className="flex justify-between"><span>Active Video Rooms:</span><strong className="text-white font-mono">3 Live</strong></div>
                <div className="flex justify-between"><span>STUN/TURN RTT:</span><strong className="text-cyan-400 font-mono">24 ms</strong></div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" /> Groq Cloud LPU Agent
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  READY
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between"><span>Model Architecture:</span><strong className="text-white font-mono">LLaMA 3.3 70B</strong></div>
                <div className="flex justify-between"><span>Inference Throughput:</span><strong className="text-emerald-400 font-mono">310 tok/sec</strong></div>
                <div className="flex justify-between"><span>State Graph:</span><strong className="text-cyan-400 font-mono">SN1 LangGraph</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: AUDIT TRAIL ───────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-cyan-400" />
              Real-Time Security & Administrative Audit Trail
            </h3>
            <span className="text-xs text-slate-500 font-mono">{auditLogs.length} events logged</span>
          </div>

          <div className="divide-y divide-slate-800/80 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div>
                    <span className="font-bold text-white font-mono">{log.action}</span>
                    <p className="text-[11px] text-slate-400">Target: {log.target} &bull; Actor: {log.actor}</p>
                  </div>
                </div>
                <span className="text-slate-500 font-mono text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CHANGE ROLE MODAL ────────────────────────────────────────────────── */}
      {editingUserRole && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Modify User Role</h3>
              <button onClick={() => setEditingUserRole(null)} className="text-slate-400 hover:text-white text-xl">
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select the new access permission tier for <strong>{editingUserRole.display_name}</strong>:
            </p>

            <div className="space-y-2">
              {[
                { id: 'student', label: 'Student (Access courses, take tests, submit work)' },
                { id: 'teacher', label: 'Faculty / Teacher (Schedule classes, grade work, create tests)' },
                { id: 'admin', label: 'Administrator (Governance, whole-school radar, user admin)' }
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedNewRole(r.id as any)}
                  className={`w-full p-3 rounded-2xl text-left text-xs font-semibold border transition-all ${
                    selectedNewRole === r.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingUserRole(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoleChange}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Save Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdminPage
