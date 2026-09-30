# Learning Intelligence Architecture

The LMS remains fully usable when AI providers are unavailable. Intelligence is an evidence layer above the core platform.

```text
LMS events
  -> learning_events
  -> profile and skill evidence computation
  -> controlled agent tools
  -> recommendations and drafts
  -> human approval for high-stakes actions
```

## Current Foundation

- `POST /api/v1/intelligence/events` stores an allowlisted learning event for the authenticated user.
- `GET /api/v1/intelligence/profile` computes a profile from persisted enrollments, progress, assessments, coding submissions, and event evidence.
- `GET /api/v1/intelligence/recommendations` reads persisted recommendation records only.
- No LLM provider is required for core LMS startup.
- No agent receives unrestricted database access.

## Required Agent Boundaries

Agents must use explicit read tools and write only through validated application services:

- `get_student_profile`
- `get_course_progress`
- `get_assessment_history`
- `get_assignment_results`
- `get_coding_history`
- `get_course_content`
- `search_learning_resources`
- `recommend_resources`
- `create_learning_plan`

Every recommendation stores its reason, evidence, status, and timestamp. High-stakes exams, official grades, certificates, published course content, and mass announcements require human approval.

## Coding Safety

Coding submissions are queued and never executed inside FastAPI. Isolated workers must enforce CPU, memory, time, output, filesystem, and network limits before execution is enabled.

## Privacy

Only learning-related attributes are derived. The platform must not infer medical, psychological, or other sensitive personal characteristics. Tenant and role authorization applies to every agent tool.
