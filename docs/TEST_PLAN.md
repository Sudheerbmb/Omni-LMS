# LMS Test Plan

## A. Authentication and Identity

- Register with valid data
- Reject malformed email
- Reject passwords shorter than 8 characters
- Login with valid and invalid credentials
- Token expiry and malformed token handling
- Inactive user rejection
- Password reset and email verification when enabled
- Role returned from login

## B. Authorization and Tenancy

- Student cannot create or publish courses
- Student cannot grade assignments
- Teacher can author only in member organizations
- Admin can manage all organization resources
- Cross-tenant resource access is denied
- Removed membership loses access
- Tenant IDs from clients are never trusted

## C. Courses and Content

- Course slug uniqueness per organization
- Course lifecycle transitions
- Published version immutability
- Resource type validation
- Resource ordering and visibility
- Draft, review, published, suspended, archived states

## D. Enrollment and Learning

- Published-course enrollment
- Duplicate enrollment rejection
- Resource progress create and update
- Resume position persistence
- Completion percentage calculation
- Unauthorized progress updates denied

## E. Assessments

- Question creation and validation
- Question pool and ordering
- Attempt authorization
- Correct and incorrect grading
- Passing score boundary
- Attempt limits and retry policy
- Manual grading path
- Result publication

## F. Assignments

- Assignment creation
- Submission authorization
- Duplicate submission policy
- Attachment limits and scanning
- Late submission rules
- Rubric grading
- Feedback and resubmission
- Grade audit trail

## G. Coding Workspace

- Supported-language allowlist
- Source size limits
- Submission persistence
- Queue and retry states
- Worker isolation from API process
- Execution timeout and memory limit
- Network-disabled sandbox
- Secret and filesystem isolation
- Result and compiler-output redaction

## H. Certificates

- Completion eligibility
- Idempotent issuance
- Unique verification number
- Public verification
- Revocation and reissue policy
- PDF and QR generation

## I. Zoom and Vimeo

- Zoom endpoint validation
- Signature verification
- Duplicate webhook delivery
- Recording download failure and retry
- Vimeo token scope failure
- TUS upload resume
- Processing timeout
- Dead-letter handling
- Credential rotation

## J. Security and Resilience

- Rate limiting
- CORS allowlist
- Secure headers
- SQL injection and payload validation
- Audit events for privileged actions
- Database outage behavior
- Redis outage behavior
- Worker restart and idempotency
- Backup restore
- Load and soak testing

## K. Frontend Quality

- Role-specific navigation
- Keyboard navigation and focus states
- Screen-reader labels
- Mobile and desktop layouts
- Loading, empty, success, and error states
- Token expiry recovery
- API error rendering
- Unsaved-form protection
- Browser refresh and deep-link routing
