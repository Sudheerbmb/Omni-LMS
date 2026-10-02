import React, { useState, useEffect } from 'react'
import type { Course, Certificate, User } from '../lib/api'
import { getCourses, issueCertificate, verifyCertificate } from '../lib/api'
import { Award, Search, ShieldCheck, CheckCircle2, Download, Sparkles } from 'lucide-react'

type CertificatesPageProps = {
  user: User
}

export const CertificatesPage: React.FC<CertificatesPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [myCertificate, setMyCertificate] = useState<Certificate | null>(null)
  const [issuing, setIssuing] = useState(false)

  // Verification lookup
  const [verifyNum, setVerifyNum] = useState('')
  const [verifiedCert, setVerifiedCert] = useState<Certificate | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    try {
      const res = await getCourses()
      setCourses(res.items || [])
      if (res.items.length > 0) setSelectedCourseId(res.items[0].id)
    } catch (err) {
      console.error(err)
    }
  }

  const handleIssueCertificate = async () => {
    if (!selectedCourseId) return
    setIssuing(true)
    try {
      const cert = await issueCertificate(selectedCourseId)
      setMyCertificate(cert)
    } catch (err: any) {
      alert(err.message || 'Could not issue certificate')
    } finally {
      setIssuing(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyNum.trim()) return
    setVerifying(true)
    setVerifyError('')
    setVerifiedCert(null)
    try {
      const cert = await verifyCertificate(verifyNum.trim())
      setVerifiedCert(cert)
    } catch (err: any) {
      setVerifyError(err.message || 'Invalid or non-existent certificate number.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <Award className="w-7 h-7 text-amber-400" />
          Certificates & Credentials
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Issue verifiable course completion certificates and validate student credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Issue Certificate Box */}
        <div className="bg-[#0B0F19] border border-amber-500/15 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-amber-400 border border-cyan-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Claim Course Certificate</h3>
              <p className="text-xs text-slate-400">Claim your official credential upon course completion</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold">Select Completed Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full mt-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-cyan-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleIssueCertificate}
              disabled={issuing}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
            >
              {issuing ? 'Generating Certificate...' : 'Generate Official Certificate'}
            </button>
          </div>

          {/* Render Certificate Card if Issued */}
          {myCertificate && (
            <div className="mt-6 p-6 bg-gradient-to-br from-slate-950 to-slate-900 border border-cyan-500/30 rounded-2xl shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full filter blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Official Certificate of Completion</span>
                  <h4 className="text-lg font-black text-white mt-1">{user.display_name}</h4>
                </div>
                <Award className="w-8 h-8 text-amber-400" />
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1 text-xs">
                <p className="text-slate-400">Certificate No: <span className="font-mono text-yellow-300">{myCertificate.certificate_number}</span></p>
                <p className="text-slate-400">Issued On: {new Date(myCertificate.issued_at).toLocaleDateString()}</p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => alert(`Certificate verified: ${myCertificate.certificate_number}`)}
                  className="bg-slate-800 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Export PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Certificate Verification Lookup */}
        <div className="bg-[#0B0F19] border border-amber-500/15 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Public Verification Desk</h3>
              <p className="text-xs text-slate-400">Verify authenticity of any certificate number</p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold">Enter Certificate Number</label>
              <div className="relative mt-1">
                <input
                  type="text"
                  required
                  value={verifyNum}
                  onChange={(e) => setVerifyNum(e.target.value)}
                  placeholder="e.g. CERT-2026-XXXX"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pr-10 text-xs text-slate-200 focus:border-cyan-500 font-mono"
                />
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl border border-slate-700 transition-colors text-xs"
            >
              {verifying ? 'Checking Verification Database...' : 'Verify Credential'}
            </button>
          </form>

          {verifyError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
              {verifyError}
            </div>
          )}

          {verifiedCert && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Certificate Verified & Authentic
              </div>
              <p className="text-slate-300">Certificate Number: <span className="font-mono">{verifiedCert.certificate_number}</span></p>
              <p className="text-slate-300">Issued Date: {new Date(verifiedCert.issued_at).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
