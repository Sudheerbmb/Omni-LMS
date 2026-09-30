import React, { useState, useEffect } from 'react'
import type { 
  Course, 
  Organization,
  User,
  Review
} from '../lib/api'
import { 
  getCourses, 
  createCourse, 
  publishCourse, 
  enrollInCourse, 
  getOrganizations, 
  getCourseReviews,
  addCourseReview
} from '../lib/api'
import { BookOpen, Plus, Search, Play, X } from 'lucide-react'

type CoursesPageProps = {
  user: User
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')

  // Create Course Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState('')

  // Course Detail Modal
  const [activeCourse, setActiveCourse] = useState<Course | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState('')
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([])

  useEffect(() => {
    fetchData()
  }, [search, filterLevel])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await getCourses({ search: search || undefined, level: filterLevel || undefined })
      setCourses(res.items || [])
      const orgList = await getOrganizations()
      setOrgs(orgList)
      if (orgList.length > 0) setSelectedOrgId(orgList[0].id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrgId) return
    try {
      const created = await createCourse({
        organization_id: selectedOrgId,
        title,
        slug: slug.toLowerCase().replace(/\s+/g, '-'),
        description
      })
      setCourses([...courses, created])
      setShowCreateModal(false)
      setTitle('')
      setSlug('')
      setDescription('')
    } catch (err: any) {
      alert(err.message || 'Failed to create course')
    }
  }

  const handleEnroll = async (courseId: string) => {
    try {
      await enrollInCourse(courseId)
      setEnrolledCourses([...enrolledCourses, courseId])
      alert('Successfully enrolled in course!')
    } catch (err: any) {
      alert(err.message || 'Could not enroll in course')
    }
  }

  const handlePublish = async (courseId: string) => {
    try {
      const updated = await publishCourse(courseId)
      setCourses(courses.map(c => c.id === courseId ? updated : c))
      alert('Course published!')
    } catch (err: any) {
      alert(err.message || 'Failed to publish course')
    }
  }

  const openCourseDetail = async (c: Course) => {
    setActiveCourse(c)
    try {
      const revs = await getCourseReviews(c.id)
      setReviews(revs)
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCourse) return
    try {
      const rev = await addCourseReview(activeCourse.id, { rating: newRating, comment: newComment })
      setReviews([...reviews, rev])
      setNewComment('')
    } catch (err: any) {
      alert(err.message || 'Failed to post review')
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-cyan-400" />
            Course Catalog
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Explore interactive learning modules, register for classes, and manage curricula.
          </p>
        </div>

        {user.role !== 'student' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Course
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses by title or keyword..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pl-9 text-xs text-slate-200 focus:border-cyan-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        </div>

        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:border-cyan-500"
        >
          <option value="">All Difficulty Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading courses...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.length === 0 ? (
            <div className="col-span-full bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No courses available</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create a course or check back later when new learning content is published.
              </p>
            </div>
          ) : (
            courses.map((c) => {
              const isEnrolled = enrolledCourses.includes(c.id)
              return (
                <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all group">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        c.status === 'published'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500 capitalize">{c.level || 'All Levels'}</span>
                    </div>

                    <h3 className="font-bold text-slate-100 text-lg group-hover:text-cyan-400 transition-colors">{c.title}</h3>
                    <p className="text-slate-400 text-xs line-clamp-2">{c.description || 'No description available for this course.'}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                      onClick={() => openCourseDetail(c)}
                      className="text-xs font-semibold text-slate-300 hover:text-white"
                    >
                      View Syllabus
                    </button>

                    <div className="flex items-center gap-2">
                      {user.role !== 'student' && c.status !== 'published' && (
                        <button
                          onClick={() => handlePublish(c.id)}
                          className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-500/30"
                        >
                          Publish
                        </button>
                      )}

                      <button
                        onClick={() => handleEnroll(c.id)}
                        disabled={isEnrolled}
                        className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors ${
                          isEnrolled
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                        }`}
                      >
                        {isEnrolled ? 'Enrolled' : 'Enroll Now'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create New Course</h3>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold">Organization</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full mt-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg p-2.5 text-xs focus:border-cyan-500"
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Course Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
                  }}
                  placeholder="e.g. Advanced Quantum Mechanics"
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Slug</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Course overview & learning objectives..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 h-20"
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
                  Create Draft Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Detail Modal */}
      {activeCourse && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveCourse(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Course Syllabus & Overview</span>
              <h3 className="text-xl font-bold text-white mt-1">{activeCourse.title}</h3>
              <p className="text-xs text-slate-400 mt-2">{activeCourse.description || 'Comprehensive learning module.'}</p>
            </div>

            {/* Video Player Placeholder */}
            <div className="aspect-video bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center relative overflow-hidden group">
              <Play className="w-12 h-12 text-cyan-400 opacity-80 group-hover:scale-110 transition-transform cursor-pointer" />
              <span className="absolute bottom-3 left-3 text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
                Interactive Video Module Preview
              </span>
            </div>

            {/* Reviews Section */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h4 className="text-sm font-bold text-slate-200">Student Reviews & Ratings</h4>
              
              <form onSubmit={handleAddReview} className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 font-semibold">Rating:</label>
                  <select
                    value={newRating}
                    onChange={(e) => setNewRating(Number(e.target.value))}
                    className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs"
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>{r} Stars</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  required
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a feedback review..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs"
                >
                  Submit Review
                </button>
              </form>

              <div className="space-y-2">
                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No reviews submitted yet.</p>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-cyan-400 font-bold">★ {rev.rating}/5</span>
                        <span className="text-[10px] text-slate-500">{new Date(rev.created_at).toLocaleDateString()}</span>
                      </div>
                      {rev.comment && <p className="text-xs text-slate-300">{rev.comment}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
