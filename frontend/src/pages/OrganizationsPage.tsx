import React, { useState, useEffect } from 'react'
import type { Organization, OrgMember, User } from '../lib/api'
import { getOrganizations, createOrganization, getOrgMembers, inviteOrgMember } from '../lib/api'
import { Building2, Plus, Users, Mail } from 'lucide-react'

type OrganizationsPageProps = {
  user: User
}

export const OrganizationsPage: React.FC<OrganizationsPageProps> = ({ user }) => {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])

  // Create Org Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')

  useEffect(() => {
    loadOrgs()
  }, [])

  const loadOrgs = async () => {
    try {
      const list = await getOrganizations()
      setOrgs(list)
      if (list.length > 0) {
        setSelectedOrg(list[0])
        loadMembers(list[0].id)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadMembers = async (orgId: string) => {
    try {
      const mems = await getOrgMembers(orgId)
      setMembers(mems)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const created = await createOrganization({ name, slug: slug.toLowerCase() })
      setOrgs([...orgs, created])
      setSelectedOrg(created)
      setShowCreateModal(false)
      setName('')
      setSlug('')
    } catch (err: any) {
      alert(err.message || 'Failed to create organization')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrg) return
    try {
      await inviteOrgMember(selectedOrg.id, inviteEmail, inviteRole)
      alert(`Invitation sent to ${inviteEmail}`)
      setShowInviteModal(false)
      setInviteEmail('')
    } catch (err: any) {
      alert(err.message || 'Failed to send invite')
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-cyan-400" />
            Organization Control Center
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage multi-tenant institutions, team members, and role invitations.
          </p>
        </div>

        {user.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            New Organization
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Organizations List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-200 text-base flex items-center justify-between">
            <span>Organizations</span>
            <span className="text-xs text-slate-500">{orgs.length} Active</span>
          </h3>

          <div className="space-y-2">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setSelectedOrg(org)
                  loadMembers(org.id)
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  selectedOrg?.id === org.id
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <p className="font-bold text-sm">{org.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">slug: {org.slug}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Org Detail & Members */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          {selectedOrg ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Active Workspace</span>
                  <h3 className="text-xl font-bold text-white mt-1">{selectedOrg.name}</h3>
                </div>

                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg border border-slate-700"
                >
                  <Mail className="w-3.5 h-3.5 text-cyan-400" /> Invite Member
                </button>
              </div>

              <div>
                <h4 className="font-bold text-slate-300 text-sm mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" /> Organization Members ({members.length})
                </h4>

                <div className="space-y-2">
                  {members.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">No members registered under this tenant yet.</p>
                  ) : (
                    members.map((m) => (
                      <div key={m.id} className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs">
                            {m.user?.display_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-200">{m.user?.display_name || 'Member'}</p>
                            <p className="text-[10px] text-slate-400">{m.user?.email}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                          {m.role}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 py-12 text-center">Select an organization to manage details.</p>
          )}
        </div>
      </div>

      {/* Create Org Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create Organization</h3>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Organization Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
                  }}
                  placeholder="e.g. Acme Academy"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Tenant Slug</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Save Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Invite Member</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">User Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@organization.com"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full mt-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-2.5 text-xs focus:border-cyan-500"
                >
                  <option value="member">Member</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Tenant Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
