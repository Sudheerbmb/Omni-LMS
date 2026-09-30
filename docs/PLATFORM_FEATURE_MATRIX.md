# Enterprise LMS Feature Matrix

## Shared Platform

- Multi-tenant organizations, departments, campuses, teams
- Tenant isolation and membership-scoped resources
- Role-based permissions with backend enforcement
- Password authentication, access tokens, session expiry
- OAuth/OIDC/SAML/SCIM integration boundaries
- MFA and passkey readiness
- Audit log boundary and request correlation IDs
- Health, readiness, structured logging, metrics, tracing
- PostgreSQL, Redis, workers, outbox, retries, dead-letter queues
- Versioned APIs and OpenAPI contracts
- Localization, timezone, accessibility, responsive UI

## Administrator

- Organization and tenant lifecycle
- User invitations, activation, suspension, deletion
- Role and permission assignment
- Department, campus, team management
- Course approval and publishing workflows
- Catalog visibility and enrollment policy
- Instructor assignment and workload controls
- Assessment policy and grading oversight
- Assignment moderation and appeals
- Certificate policy and verification
- Zoom/Vimeo/integration credentials and webhook status
- Notification templates and delivery policies
- Audit logs, retention, export, compliance reports
- Usage analytics, adoption, completion, attendance, risk views
- Billing, plan limits, quotas, and feature flags
- System settings, maintenance mode, support impersonation audit

## Teacher

- Course authoring, versioning, draft/review/publish lifecycle
- Curriculum sections, modules, learning resources
- Video, document, article, link, quiz, assignment, live class resources
- Student roster and enrollment management
- Attendance and live-class scheduling
- Question banks, randomized quizzes, timed attempts
- Assignment rubrics, grading, feedback, resubmissions
- Coding exercises and isolated submission queues
- Recording status and Vimeo playback metadata
- Announcements and learner notifications
- Course analytics, drop-off, watch time, assessment performance
- Certificate eligibility and completion review

## Student

- Profile, sessions, notification preferences
- Course catalog and enrollment
- My learning dashboard and resume learning
- Resource viewer and video position tracking
- Notes, bookmarks, learning history
- Quiz attempts, results, retry policy
- Assignment submission, attachments, feedback, resubmission
- Coding workspace with language-aware editor and queued evaluation
- Live class calendar, joining, attendance history
- Notifications, announcements, discussions
- Completion status and certificate verification

## Integrations

- Zoom endpoint validation, signature validation, event persistence
- Idempotent Zoom recording processing
- Background Zoom download jobs
- Vimeo resumable/TUS uploads and processing status
- Email, push, and in-app notification providers
- Object storage and signed media URLs
- Payment provider boundary
- Search provider boundary
- AI provider gateway and usage audit

## Production Requirements

- Alembic migrations; no production `create_all`
- Secrets from environment or a secret manager
- Rate limiting and request size limits
- Secure headers, CORS allowlist, CSRF strategy
- File scanning and media validation
- Idempotency keys for external jobs
- Queue retries with exponential backoff
- Outbox publishing and consumer deduplication
- Backups, restore drills, retention policies
- Load, failure, accessibility, and security testing
