# 🎓 Omni-LMS (Acharya Enterprise LMS Platform)

[![Python 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.2%2B-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%2F%206.x-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.x-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2%2B-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-2024--11--05-8A2BE2.svg)](https://modelcontextprotocol.io/)
[![Groq LPU](https://img.shields.io/badge/Groq_LPU-Accelerated-F55036.svg)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, multi-tenant **Learning Management System (LMS)** engineered with **FastAPI**, **React 19**, **SQLAlchemy 2.0 Async**, **PostgreSQL (Neon)**, **LangGraph**, and **Groq Cloud LPU**. Omni-LMS merges synchronous real-time WebRTC live classrooms, CBSE/NCERT curriculum-aligned autonomous timetable scheduling, mathematical Bayesian knowledge tracing (**LENS-Ω**), multi-agent educational orchestration (**CrewAI**, **AutoGen**, **Omni-Copilot**), and the **Model Context Protocol (MCP)** into a cohesive, high-performance ecosystem.

---

## 📑 Table of Contents

1. [Architectural Overview](#-architectural-overview)
2. [Key System Capabilities](#-key-system-capabilities)
3. [Deep Dive: Multi-Agent AI Orchestration](#-deep-dive-multi-agent-ai-orchestration)
4. [Deep Dive: LENS-Ω & SN1 Adaptive Intelligence Layer](#-deep-dive-lens-ω--sn1-adaptive-intelligence-layer)
5. [Deep Dive: Real-Time Classroom & Video Pipeline](#-deep-dive-real-time-classroom--video-pipeline)
6. [Deep Dive: Autonomous Bell Schedule & Timetable Engine](#-deep-dive-autonomous-bell-schedule--timetable-engine)
7. [Deep Dive: Model Context Protocol (MCP) Server](#-deep-dive-model-context-protocol-mcp-server)
8. [Codebase Directory Structure](#-codebase-directory-structure)
9. [API Route Reference](#-api-route-reference)
10. [Configuration & Environment Variables](#-configuration--environment-variables)
11. [Default Accounts & Role-Based Access Control](#-default-accounts--role-based-access-control)
12. [Installation & Quick Start](#-installation--quick-start)
13. [Docker & Containerized Deployment](#-docker--containerized-deployment)
14. [Testing Suite & Verification](#-testing-suite--verification)
15. [License](#-license)

---

## 🏛️ Architectural Overview

```
                                  +--------------------------------------------------------+
                                  |                 React 19 + Vite Frontend               |
                                  |   (Tailwind CSS v4, Lucide Icons, WebSockets, WebRTC)  |
                                  +---------------------------+----------------------------+
                                                              |
                                           HTTPS / WSS / REST / JSON-RPC 2.0
                                                              |
                                                              v
+-------------------------------------------------------------------------------------------------------------------------+
|                                              FastAPI Enterprise Core Service                                            |
|                                                                                                                         |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  +--------------------+ |
|  |  Identity & RBAC   |  |  Tenancy & Orgs    |  |  Courses & Catalog |  | Content & Syllabus |  |  Classroom Signaling| |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  +--------------------+ |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  +--------------------+ |
|  | Assessments & Quiz |  | Assignments & Desk |  | Certifications     |  | Coding Sandbox Lab |  | Notifications & Com| |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  +--------------------+ |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  +--------------------+ |
|  | Timetable Engine   |  | LENS-Ω State Vector|  | Multi-Agent Studio |  | MCP Protocol Server|  | Zoom / Vimeo Hooks | |
|  |  (LangGraph Agent) |  |   (Bayesian BKT)   |  | (CrewAI + AutoGen) |  |  (JSON-RPC 2.0)    |  | (TUS Resumable)    | |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  +--------------------+ |
+-------------------------------------------------------------------------------------------------------------------------+
       |                         |                           |                             |                   |
       v                         v                           v                             v                   v
+--------------+         +---------------+           +---------------+             +---------------+   +---------------+
| PostgreSQL / |         | Redis 7 Cache |           | Groq Cloud    |             | Cloudinary &  |   | Celery Worker |
| Neon Serverless        | & Pub/Sub     |           | LPU Inference |             | Vimeo Video   |   | Background    |
+--------------+         +---------------+           +---------------+             +---------------+   +---------------+
```

---

## ✨ Key System Capabilities

- 🏢 **Multi-Tenant Hierarchy**: Isolate and manage schools, academies, departments, campuses, and teams with role-scoped memberships and token-based email invitations.
- 📹 **Live WebRTC Classroom Studio**:
  - Full P2P mesh audio, video, and high-framerate screen sharing.
  - Interactive multi-user collaborative vector whiteboard with real-time stroke synchronization.
  - Sub-second in-call chat, floating reactions, hand-raising queue, and live polls.
  - **Live AI Teacher Copilot**: Continuous speech-to-text analysis that audits spoken content against the syllabus, spots missed derivations/theorems, and suggests verbal transitions.
  - **Live AI Student Tutor**: Contextual, in-lecture doubt resolution.
  - Cloudinary and Vimeo video recording pipeline with post-class automated transcription and structured Groq JSON lecture summaries/quizzes.
- 📅 **Autonomous Bell Schedule & Timetable Engine**:
  - 12-period daily school bell schedule (8:00 AM to 5:00 PM) spanning 40 teaching periods per week.
  - Built-in CBSE and NCERT Class 1–10 complete syllabus database.
  - LangGraph state machine solver enforcing ground capacity caps, teacher workload limits, post-lunch physical education bans, and zero-clash period allocations.
  - Real-time teacher leave logging and intelligent substitution matching.
- 🧠 **LENS-Ω & SN1 Adaptive Intelligence Layer**:
  - 8-dimensional Bayesian Cognitive State Vector $S_t = [M, R, T, MS, C, U, I, V]$.
  - Calibrated Bayesian Knowledge Tracing with Ebbinghaus forgetting retention decay and misconception spike detection.
  - Automatic bottleneck classification and transparent pedagogical policy actions.
  - Dynamic AI-generated diagnostic evaluations and conceptual practice drills.
  - Conversational SN1 Student Tutor with explicit pedagogical reasoning traces.
- 🤖 **Multi-Agent Orchestration Studio**:
  - **CrewAI Curriculum Studio**: Hierarchical team of 3 specialized agents (Dr. Alistair Finch, Dr. Evelyn Vance, Marcus Chen) co-designing multi-module curricula.
  - **AutoGen Viva / Oral Defense**: Multi-agent adversarial examination chamber featuring Prof. Eleanor Wright and Dr. Soren Kierkegaard cross-examining student answers.
  - **Universal Omni-Copilot**: Autonomous context-aware floating assistant with page awareness, role validation, and direct app tool execution.
- 🔌 **Model Context Protocol (MCP) Server**: Full JSON-RPC 2.0 protocol endpoint allowing external and internal agents to introspect resources and invoke platform tools.
- 📝 **Assessments & Quiz Studio**: Automated grading for Multiple Choice, True/False, and Free Text questions with custom point weighting and timed attempts.
- 📑 **Assignment Desk**: Coursework lifecycle with rubric definitions, student file/link attachments, and instructor grading workflows.
- 🏆 **Cryptographic Verifiable Certificates**: Digital certificate generation with unique verification hashes and a public credential verification lookup desk.
- 💻 **Interactive Coding Sandbox**: In-browser algorithm workbench with language-aware starter code, test case runners, and queue-isolated execution feedback.
- 💬 **Campus Communication Desk**: Platform-wide and organization-scoped broadcast announcements and direct user-to-user messaging.

---

## 🤖 Deep Dive: Multi-Agent AI Orchestration

Omni-LMS features three specialized multi-agent sub-systems powered by Groq Cloud LPUs (`qwen/qwen3.8-27b` and `openai/gpt-oss-120b`):

### 1. CrewAI Multi-Agent Curriculum Generation Studio
Located in [`app/agents/crew_curriculum.py`](file:///c:/Users/sudhe/Desktop/Omni-LMS/app/agents/crew_curriculum.py):
- **Agent 1: Dr. Alistair Finch** *(Senior Subject Matter Specialist)*: Formulates deep academic content, core definitions, and prerequisite hierarchies.
- **Agent 2: Dr. Evelyn Vance** *(Cognitive Psychometrician)*: Establishes cognitive load constraints, spaced retrieval timings, and misconception tripwires.
- **Agent 3: Marcus Chen** *(Instructional Designer & Rubric Architect)*: Synthesizes modular lesson units, hands-on projects, and multi-tier assessment rubrics.
- **API Endpoint**: `POST /api/v1/agents/curriculum/crew`

### 2. AutoGen Multi-Agent Interactive Viva & Oral Defense Simulation
Located in [`app/agents/autogen_viva.py`](file:///c:/Users/sudhe/Desktop/Omni-LMS/app/agents/autogen_viva.py):
- **Examiner 1: Prof. Eleanor Wright** *(Academic Committee Chair)*: Maintains scholarly pacing, probes theoretical foundations, and guides the student.
- **Examiner 2: Dr. Soren Kierkegaard** *(Adversarial Logic Auditor)*: Probes edge cases, tests boundary conditions, and stress-tests student justifications.
- **API Endpoint**: `POST /api/v1/agents/viva/round`

### 3. Universal Omni-Copilot Agent
Located in [`app/agents/copilot.py`](file:///c:/Users/sudhe/Desktop/Omni-LMS/app/agents/copilot.py) and [`frontend/src/components/OmniCopilot.tsx`](file:///c:/Users/sudhe/Desktop/Omni-LMS/frontend/src/components/OmniCopilot.tsx):
- Inspects real-time browser tab context, authenticated user role, grade level, and active page metadata.
- Employs chain-of-thought intent reasoning to decide whether to answer queries, navigate tabs, launch classrooms, open agent studios, or reject unauthorized actions.
- **API Endpoint**: `POST /api/v1/agents/copilot/reason`

---

## 🧠 Deep Dive: LENS-Ω & SN1 Adaptive Intelligence Layer

Omni-LMS implements the **Learner Evidence & Neural State Engine (LENS-Ω)** and the **Student Neural Intelligence Agent (SN1)** (`app/learning/`, `app/learning_agent/`, and standalone `services/lens-platform/`):

### The 8-Dimensional Cognitive State Vector ($S_t$)

$$\mathbf{S}_t = \begin{bmatrix} M_t & R_t & T_t & MS_t & C_t & U_t & I_t & V_t \end{bmatrix}$$

| Dimension | Notation | Formula / Mathematical Definition | Pedagogical Meaning |
| :--- | :---: | :--- | :--- |
| **Mastery** | $M_t$ | $M_{t+1} = M_t + \alpha_t (y_t - M_t)$ where $\alpha_t = 0.20 + 0.25 \cdot \text{diff}$ | Calibrated Bayesian skill estimation |
| **Retention** | $R_t$ | $R(\Delta t) = R_0 \cdot \exp(-\lambda \Delta t)$ | Ebbinghaus forgetting curve decay |
| **Transfer** | $T_t$ | $T_{t+1} = \alpha T_{\text{obs}} + (1 - \alpha) T_t$ | Generalization across novel contexts |
| **Misconception** | $MS_t$ | $MS_{t+1} = MS_t \cdot \gamma + \mathbb{I}_{[\text{error on low difficulty}]}$ | Epistemic error signal persistence |
| **Competency** | $C_t$ | $C_t = \left[ M_t \cdot R_t \cdot T_t \cdot (1 - MS_t) \right]^{1/4}$ | Holistic geometric proficiency index |
| **Uncertainty** | $U_t$ | $U_t = \max\left(0.05, \exp(-0.35 \cdot N) \cdot (1 - 0.4 \cdot I_t)\right)$ | Posterior epistemic variance |
| **Identifiability** | $I_t$ | $I_t = \frac{\lvert\text{Observed Evidence Types}\rvert}{\lvert\text{Required Types}\rvert}$ | Diagnostic evidence density & coverage |
| **Velocity** | $V_t$ | $V_t = \frac{\Delta(M_t, C_t, T_t)}{\Delta t}$ | Longitudinal rate of learning progress |

### Bottleneck Classifier & Intervention Modes

| Detected Bottleneck | Trigger Condition | Activated Policy Mode | Primary Intervention |
| :--- | :--- | :--- | :--- |
| `INSUFFICIENT_EVIDENCE` | $I_t < 0.50 \lor U_t > 0.60$ | `DIAGNOSTIC` | AI-generated baseline diagnostic test |
| `MASTERY` | $\max(1 - M_t)$ | `ACQUISITION` | Micro-lessons & worked examples |
| `RETENTION` | $\max(1 - R_t)$ | `RETRIEVAL` | Spaced recall & quick flash drills |
| `TRANSFER` | $\max(1 - T_t)$ | `TRANSFER` | Cross-disciplinary problem sets |
| `MISCONCEPTION` | $MS_t \ge 0.25$ | `REMEDIATION` | Targeted cognitive unlearning drills |

---

## 📹 Deep Dive: Real-Time Classroom & Video Pipeline

Located in [`app/classroom/`](file:///c:/Users/sudhe/Desktop/Omni-LMS/app/classroom/) and [`frontend/src/pages/ClassroomPage.tsx`](file:///c:/Users/sudhe/Desktop/Omni-LMS/frontend/src/pages/ClassroomPage.tsx):

### 1. WebSocket Signaling & Mesh Coordination
- Managed via `RoomConnectionManager` (`app/classroom/router.py`).
- Handles WebSockets at `/api/v1/classroom/ws/{room_id}` for:
  - WebRTC signaling (SDP offers, answers, ICE candidate routing).
  - Synchronized vector whiteboard canvas commands.
  - Screen share high-framerate stream notifications.
  - Heartbeat peer presence rosters (`mic`, `camera`, `hand_raised`, `role`).
  - Instructor moderation actions (`kick_peer`, `meeting_ended`).

### 2. In-Call Real-Time AI Copilot & Student Tutor
- **AI Teacher Copilot** (`POST /api/v1/classroom/classes/{class_id}/teacher-copilot`):
  - Streams live lecture audio transcript.
  - Matches spoken concepts against official syllabus topics.
  - Identifies missed theorems, boundary conditions, or unmentioned formulas.
  - Generates pacing advice and verbal transition cues.
- **AI Student Tutor** (`POST /api/v1/classroom/classes/{class_id}/student-tutor`):
  - In-lecture doubt solver answering student questions strictly grounded in what the teacher has covered up to that minute.

### 3. Post-Class Synthesis & Video Transcoding
- Lecture recordings stream to **Cloudinary** or **Vimeo** (via TUS resumable uploads).
- Full lecture audio is transcribed into timestamped transcript segments.
- Groq Cloud LPU generates structured JSON containing:
  - 2–3 sentence executive overview.
  - 3–5 key topic breakdowns.
  - Board takeaways & formulas.
  - Exam study tips and real-world case studies.
  - 2-question lecture comprehension quiz.

---

## 📅 Deep Dive: Autonomous Bell Schedule & Timetable Engine

Located in [`app/timetable/`](file:///c:/Users/sudhe/Desktop/Omni-LMS/app/timetable/) and [`frontend/src/pages/TimetablePage.tsx`](file:///c:/Users/sudhe/Desktop/Omni-LMS/frontend/src/pages/TimetablePage.tsx):

### Daily School Bell Schedule (8:00 AM – 5:00 PM)

| Period | Time Window | Type | Description |
| :---: | :---: | :---: | :--- |
| **0** | 08:00 – 08:30 | Assembly | Morning Assembly & Prayer |
| **1** | 08:30 – 09:20 | Lecture | Period 1 |
| **2** | 09:20 – 10:10 | Lecture | Period 2 |
| **3** | 10:10 – 10:30 | Recess | Morning Recess Break |
| **4** | 10:30 – 11:20 | Lecture | Period 3 |
| **5** | 11:20 – 12:10 | Lecture | Period 4 |
| **6** | 12:10 – 13:00 | Lecture | Period 5 |
| **7** | 13:00 – 14:00 | Lunch | Lunch & Recreation Hour |
| **8** | 14:00 – 14:50 | Lecture | Period 6 |
| **9** | 14:50 – 15:40 | Lecture | Period 7 |
| **10** | 15:40 – 15:55 | Recess | Afternoon Hydration Break |
| **11** | 15:55 – 16:45 | Lecture | Period 8 |
| **12** | 16:45 – 17:00 | Dispersal | Homeroom & Dispersal |

### Autonomous LangGraph Constraint Solver
The timetable state machine (`agent.py`) coordinates multi-node constraint optimization:
1. **Curriculum Requirements**: Enforces weekly period quotas per subject from the 81 KB CBSE/NCERT curriculum dataset (`curriculum_data.py`).
2. **Ground Capacity Caps**: Prevents physical education slots from exceeding sports ground capacities (e.g., maximum 2 simultaneous sections).
3. **Teacher Workload & Post-Lunch Rules**: Caps daily teacher lectures, bans heavy sports slots directly after lunch, and honors teacher leaves.
4. **Autonomous Substitution Engine**: When a teacher logs leave (`POST /leaves`), the system identifies free, qualified teachers for that subject and grade with zero timetable clashes.

---

## 🔌 Deep Dive: Model Context Protocol (MCP) Server

Omni-LMS includes an implementation of the **Anthropic Model Context Protocol (MCP)** specification (spec version `2024-11-05`), located in [`app/mcp/`](file:///c:/Users/sudhe/Desktop/Omni-LMS/app/mcp/):

- **Protocol Endpoint**: `POST /api/v1/mcp` (Standard JSON-RPC 2.0)
- **Supported Methods**:
  - `initialize`: Performs capabilities handshake and protocol version negotiation.
  - `tools/list`: Returns manifest of registered enterprise tools and JSON schemas.
  - `tools/call`: Dispatches tool execution with parameter validation.
  - `resources/list`: Exposes accessible platform resources.
  - `ping`: Liveness check (`pong`).
- **REST Gateways**:
  - `GET /api/v1/mcp/tools`: Tool inspection for web UI clients.
  - `POST /api/v1/mcp/execute`: Direct tool execution gateway.

### Registered MCP Tools Manifest
1. `lms_start_live_class`: Spawns and launches an active WebRTC classroom session for a specific grade and subject.
2. `lms_get_student_risk_profile`: Queries Bayesian cognitive risk, active misconceptions, and mastery scores for a student.
3. `lms_reschedule_timetable_slot`: Swaps timetable slots using the constraint solver.
4. `lms_create_assignment`: Publishes coursework with rubric criteria and deadline constraints.
5. `lms_query_course_catalog`: Searches courses by difficulty level, category, and keyword.
6. `lms_trigger_lens_calibration`: Triggers baseline diagnostic calibration for a learner.

---

## 📂 Codebase Directory Structure

```
Omni-LMS/
├── .env.example                     # Environment template with default keys
├── Dockerfile                       # Multi-stage production container build
├── docker-compose.yml               # Compose stack (FastAPI, Worker, Postgres, Redis, Vite)
├── requirements.txt                 # Backend Python dependencies
├── run.bat                          # One-click Windows development bootstrapper
├── lms.db                           # Local SQLite database (for dev fallback)
│
├── app/                             # Core FastAPI Backend Application
│   ├── main.py                      # Application factory, lifespan, CORS, Zoom webhook
│   ├── admin.py                     # User management & administration router
│   ├── dashboard.py                 # Aggregated metrics for Admin/Teacher/Student
│   ├── sync_users.py                # Database user seed script (credentials & grades)
│   ├── vimeo.py                     # Vimeo TUS resumable upload integration
│   ├── worker.py                    # Background task processor
│   │
│   ├── agents/                      # Multi-Agent Orchestration Subsystems
│   │   ├── crew_curriculum.py       # CrewAI 3-agent curriculum design studio
│   │   ├── autogen_viva.py          # AutoGen multi-agent oral defense simulation
│   │   ├── copilot.py               # Universal Omni-Copilot intent reasoning engine
│   │   └── router.py                # Agent studio endpoints (/api/v1/agents)
│   │
│   ├── ai/                          # AI Event Tracking & Recommendation Models
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── assessment/                  # Assessment Studio (Quizzes, Auto-Grading)
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── assignments/                 # Homework & Project Submission Desk
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── certification/               # Cryptographic Certificate Generator
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── classroom/                   # Real-Time Live WebRTC Classroom
│   │   ├── models.py                # LiveClass database models
│   │   ├── router.py                # WebSocket room manager, in-call AI copilot
│   │   ├── schemas.py, service.py   # Scheduling, conflict checks, Cloudinary uploads
│   │
│   ├── coding/                      # Isolated Algorithmic Coding Sandbox
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── communication/               # Campus Announcements & Direct Messages
│   │   ├── models.py, router.py, schemas.py
│   │
│   ├── content/                     # Course Syllabus, Modules, and Resources
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── courses/                     # Course Catalog, Reviews, Publishing Lifecycle
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── enrollment/                  # Enrollments & Resource Progress Tracking
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── identity/                    # Authentication, RBAC, Users, Tokens
│   │   ├── auth.py                  # JWT dependencies (get_current_user)
│   │   ├── models.py                # User, Role, Membership, Session models
│   │   ├── permissions.py           # Permission decorator (require_permission)
│   │   ├── router.py                # Login, register, profile endpoints
│   │   ├── security.py              # Bcrypt password hashing
│   │   ├── service.py, tokens.py    # Token generation & validation
│   │
│   ├── learning/                    # LENS-Ω Adaptive Learning Core
│   │   ├── adaptive.py              # Bayesian knowledge update & evidence engine
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   ├── learning_agent/              # SN1 Student Agent & LangGraph Engine
│   │   ├── ai_generator.py          # Groq dynamic diagnostic & drill generation
│   │   ├── engine.py                # Mathematical Bayesian state estimators
│   │   ├── langgraph_engine.py      # SN1 multi-node LangGraph tutor state machine
│   │   └── router.py                # /api/v1/lens endpoints
│   │
│   ├── mcp/                         # Model Context Protocol (MCP) Server
│   │   ├── router.py                # JSON-RPC 2.0 & REST tool execution endpoints
│   │   └── service.py               # Protocol definitions & registered tool handlers
│   │
│   ├── notifications/               # In-App Notification System
│   │   ├── models.py, router.py, schemas.py
│   │
│   ├── platform/                    # Shared Platform Infrastructure
│   │   ├── config.py                # Pydantic Settings & environment variables
│   │   ├── database.py              # Async engine, SessionFactory, schema init
│   │   ├── errors.py                # Global exception handlers
│   │   ├── logging.py               # Structured logging configuration
│   │   ├── models.py                # Base SQLAlchemy declarative model
│   │   ├── pagination.py            # Reusable pagination helpers
│   │   └── storage.py               # Local / AWS S3 file storage backend
│   │
│   ├── tenancy/                     # Multi-Tenant Organizations & Invitations
│   │   ├── models.py, router.py, schemas.py, service.py
│   │
│   └── timetable/                   # LangGraph Timetable Engine & CBSE Syllabus
│       ├── agent.py                 # Autonomous constraint solver & scheduler
│       ├── curriculum_data.py       # CBSE & NCERT Class 1-10 complete curriculum
│       ├── models.py, router.py, schemas.py, service.py
│
├── frontend/                        # React 19 + TypeScript + Vite Client
│   ├── src/
│   │   ├── App.tsx                  # Main router, authentication, global state
│   │   ├── main.tsx                 # DOM entry point
│   │   ├── index.css                # Tailwind CSS v4 styling & animations
│   │   │
│   │   ├── components/
│   │   │   ├── Header.tsx           # Global navigation header & notifications
│   │   │   ├── Sidebar.tsx          # Dynamic role-based navigation sidebar
│   │   │   ├── OmniCopilot.tsx      # Floating Groq-powered Copilot assistant
│   │   │   ├── CrewCurriculumModal.tsx # CrewAI 3-agent curriculum generator modal
│   │   │   ├── AutoGenVivaModal.tsx # AutoGen multi-agent oral defense modal
│   │   │   └── AiRecordingPlayerModal.tsx # Recording player with AI transcript sync
│   │   │
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx    # Role-tailored executive dashboards
│   │   │   ├── ClassroomPage.tsx    # WebRTC live classroom with whiteboard & AI
│   │   │   ├── TimetablePage.tsx    # School bell matrix & substitution scheduler
│   │   │   ├── LearningIntelligencePage.tsx # LENS-Ω cognitive radar & SN1 chat
│   │   │   ├── CoursesPage.tsx      # Course catalog, syllabus, and reviews
│   │   │   ├── AssessmentsPage.tsx  # Timed quiz runner & automated grading
│   │   │   ├── AssignmentsPage.tsx  # Coursework submission desk & rubrics
│   │   │   ├── CodingPage.tsx       # Algorithm sandbox & code editor
│   │   │   ├── CertificatesPage.tsx # Digital certificate generator & verifier
│   │   │   ├── OrganizationsPage.tsx# Multi-tenant organization manager
│   │   │   └── AdminPage.tsx        # User approval and role management desk
│   │   │
│   │   └── lib/
│   │       ├── api.ts               # Typed REST API client
│   │       ├── mcpClient.ts         # Browser-side MCP tool execution client
│   │       ├── evidenceEngine.ts    # Client-side learning evidence normalizer
│   │       ├── groqAgent.ts         # Direct Groq LPU browser client
│   │       ├── langgraphAgent.ts    # Client-side LangGraph state handlers
│   │       ├── assessmentStore.ts   # Persistent assessment state store
│   │       └── subjectQuestions.ts  # Fallback question bank database
│   │
│   ├── package.json                 # Frontend dependencies
│   ├── vite.config.ts               # Vite bundler configuration
│   └── nginx.conf                   # Container production web server configuration
│
├── services/                        # Standalone Microservices
│   └── lens-platform/               # Standalone LENS-Ω Adaptive Intelligence Layer
│       ├── Dockerfile.lens, docker-compose.lens.yml
│       ├── lens/ (engine, api, events, sn1, replay)
│       └── tests/                   # Microservice test suite
│
├── tests/                           # Backend Test Suite (pytest)
│   ├── test_adaptive_learning.py    # Tests for Bayesian LENS-Ω state vector updates
│   ├── test_admin_users.py          # Tests for user approval & administration
│   ├── test_assessment.py           # Tests for automated quiz grading
│   ├── test_assignments.py          # Tests for coursework & rubric scoring
│   ├── test_certification.py        # Tests for certificate generation & verification
│   ├── test_classroom.py            # Tests for classroom scheduling & conflicts
│   ├── test_coding.py               # Tests for coding exercises & submissions
│   ├── test_communication.py        # Tests for announcements & direct messages
│   ├── test_courses.py              # Tests for course catalog, publish, reviews
│   ├── test_enterprise_standards_e2e.py # E2E tests for MCP, CrewAI, AutoGen, LENS
│   ├── test_health.py               # Tests for /health and Zoom webhook HMAC
│   ├── test_identity.py             # Tests for login, register, JWT tokens
│   ├── test_intelligence.py         # Tests for learning events & profiles
│   ├── test_learning_flow.py        # Tests for course completion lifecycle
│   ├── test_tenancy.py              # Tests for organizations & invitations
│   ├── test_tokens.py               # Tests for token expiration & refresh
│   └── helpers.py                   # Test utility fixtures
│
└── docs/                            # Architectural Documentation
    ├── AI_ARCHITECTURE.md           # Safety & boundary model for AI agents
    ├── CODING_WORKSPACE_SECURITY.md # Container isolation rules for code evaluation
    ├── LENS_OMEGA_IMPLEMENTATION.md # LENS-Ω mathematical derivation notes
    ├── PLATFORM_FEATURE_MATRIX.md   # Feature availability by role
    └── TEST_PLAN.md                 # Test strategy & coverage criteria
```

---

## 📡 API Route Reference

Omni-LMS mounts versioned REST routes under `/api/v1` alongside root health checks and webhook receivers:

### System & Health Endpoints
- `GET /` &mdash; System root status (`{"status": "ok", "service": "zoom-lms-integration"}`)
- `GET /health` &mdash; Healthcheck endpoint (`{"status": "healthy"}`)
- `GET /ready` &mdash; Readiness check (`{"status": "ready", "environment": "development"}`)
- `POST /api/zoom/webhook` &mdash; Zoom webhook receiver (handles `endpoint.url_validation` HMAC-SHA256 handshake & `recording.completed` Vimeo pipeline)

### Authentication & Identity (`/api/v1/identity`)
- `POST /register` &mdash; Register new user account (student / teacher)
- `POST /login` &mdash; Authenticate and obtain JWT access + refresh tokens
- `POST /refresh` &mdash; Exchange refresh token for fresh access token
- `POST /logout` &mdash; Invalidate active session token
- `POST /logout-all` &mdash; Revoke all active sessions for authenticated user
- `GET /me` &mdash; Fetch current user profile
- `PATCH /me` &mdash; Update profile details
- `POST /me/avatar` &mdash; Upload user avatar image
- `POST /me/change-password` &mdash; Change password
- `POST /password-reset/request` &mdash; Dispatch password reset email
- `POST /password-reset/confirm` &mdash; Finalize password reset with token
- `GET /verify-email/{token}` &mdash; Confirm email address verification
- `GET /users/{user_id}/profile` &mdash; View public user profile

### Multi-Tenancy & Organizations (`/api/v1/tenants`)
- `POST /` &mdash; Create a new organization
- `GET /` &mdash; List accessible organizations
- `GET /{org_id}` &mdash; Get organization profile
- `PATCH /{org_id}` &mdash; Update organization settings
- `POST /{org_id}/logo` &mdash; Upload organization branding logo
- `GET /{org_id}/members` &mdash; List organization members
- `DELETE /{org_id}/members/{user_id}` &mdash; Remove member from organization
- `PATCH /{org_id}/members/{user_id}/role` &mdash; Modify member role
- `POST /{org_id}/invitations` &mdash; Create token-based email invitation
- `POST /invitations/{token}/accept` &mdash; Accept organization invitation

### Courses & Syllabus (`/api/v1/courses`)
- `GET /` &mdash; Search course catalog with multi-criteria filters
- `POST /` &mdash; Create new course draft
- `GET /{course_id}` &mdash; Retrieve course details and syllabus outline
- `PATCH /{course_id}` &mdash; Update course metadata
- `POST /{course_id}/publish` &mdash; Publish course to catalog
- `POST /{course_id}/archive` &mdash; Archive course
- `POST /{course_id}/thumbnail` &mdash; Upload course thumbnail image
- `GET /categories` & `POST /categories` &mdash; Category management
- `POST /{course_id}/reviews` &mdash; Submit student course rating and review
- `GET /{course_id}/reviews` &mdash; List reviews for course
- `POST /{course_id}/resources` &mdash; Add module resource (video, doc, quiz, etc.)

### Live Classroom & WebSockets (`/api/v1/classroom`)
- `GET /classes` &mdash; List scheduled/live classes (filterable by grade and status)
- `POST /classes` &mdash; Schedule new live classroom session
- `PUT /classes/{class_id}/status` &mdash; Update class status (`scheduled`, `live`, `ended`)
- `POST /classes/{class_id}/end-session` &mdash; End live session and trigger post-lecture AI summary
- `WSS /ws/{room_id}` &mdash; Real-time WebSocket signaling channel (WebRTC, Whiteboard, Chat, Polls)
- `POST /classes/{class_id}/teacher-copilot` &mdash; Live in-lecture AI Teacher Copilot
- `POST /classes/{class_id}/student-tutor` &mdash; Live in-lecture AI Student Doubt Tutor
- `POST /classes/{class_id}/recording` &mdash; Upload and stream lecture recording to Cloudinary
- `GET /classes/{class_id}/transcript` &mdash; Retrieve timestamped lecture transcript
- `GET /classes/{class_id}/ai-summary` &mdash; Get post-lecture structured AI summary and quiz
- `GET /cloudinary-config` &mdash; Fetch public Cloudinary credentials

### Timetable & Bell Schedule (`/api/v1/timetable`)
- `POST /generate` &mdash; Run LangGraph autonomous scheduler to generate zero-clash slots
- `GET /grid` &mdash; Query timetable grid (filtered by grade, section, teacher, or day)
- `POST /seed-defaults` &mdash; Seed standard CBSE/NCERT curriculum and initial faculty
- `GET /rules` & `POST /rules` &mdash; Manage timetable policy constraints
- `PUT /rules/{rule_id}` & `DELETE /rules/{rule_id}` &mdash; Update/delete policy rule
- `POST /rules/{rule_id}/toggle` &mdash; Toggle rule active state
- `GET /substitutes` &mdash; Query intelligent substitute teacher recommendations
- `POST /slots/swap` &mdash; Swap two schedule slots
- `POST /leaves` & `GET /leaves` &mdash; Submit and audit teacher leave applications
- `GET /courses` &mdash; Fetch CBSE/NCERT chapter breakdowns and curriculum data

### LENS-Ω Adaptive Engine (`/api/v1/lens` & `/api/v1/learning`)
- `POST /api/v1/lens/diagnostic/generate` &mdash; Dynamically generate AI diagnostic assessment
- `POST /api/v1/lens/diagnostic/submit` &mdash; Evaluate diagnostic test and calibrate initial $S_t$ state
- `POST /api/v1/lens/drill/generate` &mdash; Generate 2–3 targeted conceptual drills for a knowledge node
- `POST /api/v1/lens/drill/submit` &mdash; Update Bayesian mastery for a specific concept
- `POST /api/v1/lens/chat` &mdash; SN1 Student Tutor Chat powered by LangGraph
- `POST /api/v1/learning/adaptive/evidence` &mdash; Record immutable learning evidence event
- `GET /api/v1/learning/adaptive/me` &mdash; Fetch authenticated student's cognitive state vector
- `GET /api/v1/learning/adaptive/students/{student_id}` &mdash; Fetch specific student's state vector (Teacher)
- `GET /api/v1/learning/adaptive/cohort` &mdash; Retrieve aggregated cohort cognitive analytics (Admin)

### Multi-Agent Orchestration Studio (`/api/v1/agents`)
- `POST /curriculum/crew` &mdash; Execute CrewAI 3-agent collaborative curriculum generation
- `POST /viva/round` &mdash; Execute AutoGen adversarial oral defense viva round
- `POST /copilot/reason` &mdash; Universal Omni-Copilot autonomous intent reasoning engine

### Model Context Protocol (`/api/v1/mcp`)
- `POST /` &mdash; MCP standard JSON-RPC 2.0 handler (`initialize`, `tools/list`, `tools/call`, `resources/list`, `ping`)
- `GET /tools` &mdash; REST tool inspection endpoint
- `POST /execute` &mdash; REST tool execution gateway

### Assessments & Quizzes (`/api/v1/assessment`)
- `POST /courses/{course_id}` &mdash; Create course quiz assessment
- `POST /{assessment_id}/questions` &mdash; Add question with options and point weight
- `POST /{assessment_id}/attempts` &mdash; Submit answers for automated evaluation

### Assignments Desk (`/api/v1/assignments`)
- `GET /courses/{course_id}` &mdash; List course assignments
- `POST /courses/{course_id}` &mdash; Publish assignment with rubric
- `POST /{assignment_id}/submissions` &mdash; Submit coursework file or link
- `GET /{assignment_id}/submissions` &mdash; List submissions
- `POST /submissions/{submission_id}/grade` &mdash; Grade submission with score and feedback

### Algorithmic Coding Sandbox (`/api/v1/coding`)
- `POST /courses/{course_id}/exercises` &mdash; Create coding challenge
- `GET /courses/{course_id}/exercises` &mdash; List exercises for course
- `GET /exercises/{exercise_id}` &mdash; View exercise prompt, test cases, and starter code
- `POST /exercises/{exercise_id}/submissions` &mdash; Submit code for evaluation
- `GET /submissions/{submission_id}` &mdash; View execution result and test pass rates

### Verifiable Certificates (`/api/v1/certification`)
- `POST /courses/{course_id}` &mdash; Issue verifiable course completion certificate
- `GET /verify/{certificate_number}` &mdash; Public verification lookup for certificate

### Campus Communications (`/api/v1/communication`)
- `GET /announcements` &mdash; View published announcements
- `POST /announcements` &mdash; Broadcast system announcement
- `POST /organizations/{organization_id}/announcements` &mdash; Broadcast organization announcement
- `GET /users/{user_id}/messages` &mdash; List direct messages with user
- `POST /messages` &mdash; Send direct message

### Admin Desk & Dashboard (`/api/v1/admin` & `/api/v1/dashboard`)
- `GET /api/v1/admin/users` &mdash; List all users with status, role, and grade filters
- `POST /api/v1/admin/users` &mdash; Directly provision new user
- `POST /api/v1/admin/users/{user_id}/approve` &mdash; Approve pending user registration
- `POST /api/v1/admin/users/{user_id}/reject` &mdash; Reject pending user registration
- `POST /api/v1/admin/users/{user_id}/status` &mdash; Set account status (`active`, `suspended`)
- `POST /api/v1/admin/users/{user_id}/role` &mdash; Modify user role (`student`, `teacher`, `admin`)
- `DELETE /api/v1/admin/users/{user_id}` &mdash; Delete user account
- `GET /api/v1/dashboard/summary` &mdash; Retrieve role-tailored dashboard metrics and activity feed

---

## ⚙️ Configuration & Environment Variables

All settings are managed via Pydantic Settings in [`app/platform/config.py`](file:///c:/Users/sudhe/Desktop/Omni-LMS/app/platform/config.py). You can configure them through your `.env` file:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| **`APP_NAME`** | `Acharya-LMS` | Display name of the platform |
| **`APP_VERSION`** | `2.0.0` | API application version |
| **`ENVIRONMENT`** | `development` | Deployment environment (`development`, `staging`, `production`) |
| **`DEBUG`** | `false` | Enable verbose debugging and error traces |
| **`DATABASE_URL`** | `sqlite+aiosqlite:///./lms.db` | Async database URI (SQLite or PostgreSQL `postgresql+asyncpg://...`) |
| **`DATABASE_POOL_SIZE`**| `20` | SQLAlchemy connection pool size (Postgres) |
| **`DATABASE_MAX_OVERFLOW`**| `40` | Maximum overflow connections |
| **`REDIS_URL`** | `redis://localhost:6379/0` | Redis caching & event stream URI |
| **`JWT_SECRET`** | `CHANGE-ME-...` | Cryptographic secret for signing JWT tokens |
| **`JWT_ALGORITHM`** | `HS256` | JWT signing algorithm |
| **`ACCESS_TOKEN_MINUTES`** | `30` | Access token lifespan in minutes |
| **`REFRESH_TOKEN_DAYS`** | `30` | Refresh token lifespan in days |
| **`CORS_ORIGINS`** | `http://localhost:5173,...`| Comma-separated list of allowed origins |
| **`BOOTSTRAP_ADMIN_EMAIL`** | *None* | Email for initial admin auto-provisioning |
| **`BOOTSTRAP_ADMIN_PASSWORD`**| *None* | Password for initial admin auto-provisioning |
| **`GROQ_API_KEY`** | *None* | Groq Cloud LPU API key for ultra-fast agent inference |
| **`GROQ_MODEL`** | `qwen/qwen3.8-27b` | Primary Groq model (fallback: `openai/gpt-oss-120b`) |
| **`OPENAI_API_KEY`** | *None* | Optional OpenAI API key |
| **`CLOUDINARY_CLOUD_NAME`**| `zy4qhemm` | Cloudinary account name for lecture video streaming |
| **`CLOUDINARY_API_KEY`** | `348774342517364` | Cloudinary API key |
| **`CLOUDINARY_API_SECRET`**| `iUM25wdg_Mzbi8...` | Cloudinary API secret |
| **`ZOOM_SECRET_TOKEN`** | *None* | Zoom webhook secret for HMAC endpoint verification |
| **`VIMEO_ACCESS_TOKEN`** | *None* | Vimeo API access token for TUS video uploads |
| **`STORAGE_BACKEND`** | `local` | File storage backend (`local` or `s3`) |
| **`LOCAL_UPLOAD_DIR`** | `./uploads` | Directory for local file uploads |
| **`AWS_ACCESS_KEY_ID`** | *None* | AWS S3 access key (when storage is `s3`) |
| **`AWS_SECRET_ACCESS_KEY`**| *None* | AWS S3 secret key |
| **`S3_BUCKET`** | *None* | AWS S3 bucket name |
| **`SENTRY_DSN`** | *None* | Sentry observability tracking DSN |

---

## 🔑 Default Accounts & Role-Based Access Control

The database seed utility [`app/sync_users.py`](file:///c:/Users/sudhe/Desktop/Omni-LMS/app/sync_users.py) automatically provisions and synchronizes the following accounts:

### Platform Administrators
| Role | Email | Password | Display Name |
| :---: | :--- | :--- | :--- |
| **Admin** | `admin@lms-platform.com` | `OrbitAdmin!2026X7` | Platform Administrator |
| **Admin** | `admin@example.com` | `ChangeMe123!` | System Admin |

### Faculty & Teachers
| Role | Email | Password | Display Name |
| :---: | :--- | :--- | :--- |
| **Teacher** | `teacher@example.com` | `Teacher123!` | Dr. Sarah Connor |
| **Teacher** | `teacher.math@school.edu` | `Teacher123!` | Dr. Alistair Finch |
| **Teacher** | `teacher.science@school.edu` | `Teacher123!` | Dr. Evelyn Vance |

### Students by Grade Level (Classes 1 to 10)
| Grade & Section | Email | Password | Student Name |
| :---: | :--- | :--- | :--- |
| **Class 1-A** | `student.class1@school.edu` | `Student123!` | Aarav Patel |
| **Class 2-A** | `student.class2@school.edu` | `Student123!` | Diya Sharma |
| **Class 3-A** | `student.class3@school.edu` | `Student123!` | Ishaan Verma |
| **Class 4-A** | `student.class4@school.edu` | `Student123!` | Ananya Iyer |
| **Class 5-A** | `student.class5@school.edu` | `Student123!` | Rohan Gupta |
| **Class 6-A** | `student.class6@school.edu` | `Student123!` | Sanya Reddy |
| **Class 7-A** | `student.class7@school.edu` | `Student123!` | Kabir Mehta |
| **Class 8-A** | `student.class8@school.edu` | `Student123!` | Pooja Nair |
| **Class 9-A** | `student.class9@school.edu` | `Student123!` | Arjun Rao |
| **Class 10-A** | `student.class10@school.edu` | `Student123!` | Meera Joshi |
| **General** | `student@example.com` | `Student123!` | Alex Rivera |

---

## 🚀 Installation & Quick Start

### Prerequisites
- **Python 3.12+**
- **Node.js 18+** & **npm**
- **Git**
- *(Optional)* Docker Desktop & PostgreSQL

---

### Method A: One-Click Windows Script (Recommended)
Simply double-click [`run.bat`](file:///c:/Users/sudhe/Desktop/Omni-LMS/run.bat) or run from PowerShell / Command Prompt:
```cmd
.\run.bat
```
This script automatically:
1. Activates `.venv` and launches the FastAPI backend on `http://127.0.0.1:8000` with hot reloading.
2. Starts the React 19 Vite dev server on `http://localhost:5173`.
3. Opens your default browser directly to the web portal.

---

### Method B: Manual Local Setup

#### 1. Clone & Setup Environment
```bash
git clone https://github.com/Sudheerbmb/Omni-LMS.git
cd Omni-LMS
cp .env.example .env
```

#### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed default admin, teachers, and students
python -m app.sync_users

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
API Documentation will be live at **`http://127.0.0.1:8000/docs`**.

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Access the application at **`http://localhost:5173`**.

---

## 🐳 Docker & Containerized Deployment

Omni-LMS includes a production-ready `docker-compose.yml` orchestrating the full stack:
- **`frontend`**: React 19 build served through Nginx on port `5173`.
- **`api`**: FastAPI application service running on port `8000`.
- **`worker`**: Celery / background Python task worker.
- **`postgres`**: PostgreSQL 16 Alpine with automatic health checks on port `5432`.
- **`redis`**: Redis 7 Alpine cache and stream broker on port `6379`.

### Launching the Stack:
```bash
docker compose up --build -d
```

### Inspecting Service Logs:
```bash
docker compose logs -f api
```

### Shutting Down:
```bash
docker compose down -v
```

---

## 🧪 Testing Suite & Verification

Omni-LMS contains a comprehensive automated test suite in [`tests/`](file:///c:/Users/sudhe/Desktop/Omni-LMS/tests/) covering end-to-end user workflows, Model Context Protocol handshakes, multi-agent pipelines, live classroom conflicts, and Bayesian state estimations:

```bash
# Run the complete test suite
pytest -v

# Run enterprise standards & multi-agent verification tests
pytest tests/test_enterprise_standards_e2e.py -v

# Run adaptive learning & Bayesian update tests
pytest tests/test_adaptive_learning.py -v

# Run live classroom scheduling & WebSockets tests
pytest tests/test_classroom.py -v
```

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute it in accordance with the license conditions.