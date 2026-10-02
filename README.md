# 🎓 Acharya-LMS Platform

A modern, full-stack **Learning Management System (LMS)** built with **FastAPI**, **React 19**, **TypeScript**, and **PostgreSQL (Neon)**. Designed for multi-tenant educational institutions, featuring live Zoom classrooms, automated quizzes, coursework grading, verifiable credentials, and an interactive coding sandbox.

---

## ✨ Features

- 🏢 **Multi-Tenant Organizations**: Manage distinct academies, workspaces, and team memberships with email invitations.
- 📹 **Live Zoom Classrooms**: Integrated synchronous timetable schedule with one-click Zoom meeting launches.
- 📚 **Course Catalog & Publishing**: Interactive catalog with real-time keyword search, difficulty filtering (`Beginner`, `Intermediate`, `Advanced`), syllabus overview, and student review ratings.
- 📝 **Assessment & Quiz Studio**: Automated grading engine supporting Multiple Choice, True/False, and Text Response questions with custom point weights.
- 📑 **Assignment Desk**: Homework and project submission portal with deadline tracking and external link/file attachment verification.
- 🏆 **Verifiable Certificates**: Digital course completion credential generator with a public certificate authenticity lookup desk.
- 💻 **Interactive Coding Sandbox**: Built-in algorithm problem solver with boilerplate starter code, solution editor, and terminal output execution feedback.
- 👥 **Role-Based Access Control**: Tailored portals for **Admin**, **Teacher**, and **Student** roles.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2.0 (Async), Pydantic v2, PostgreSQL (Neon Serverless)
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Integrations:** Zoom API Webhooks, Vimeo Video Pipeline

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL or Neon DB connection string

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql+asyncpg://<username>:<password>@<host>/<dbname>?ssl=require
APP_SECRET_KEY=your_secret_key_here
```

### 3. Running with One-Click Script (Windows)
Double-click `run.bat` or run:
```cmd
run.bat
```

### 4. Manual Setup

#### Backend:
```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

Visit the app at **`http://localhost:5173`**.

---

## 🔑 Default Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@lms-platform.com` | `OrbitAdmin!2026X7` |
| **Teacher** | `teacher@example.com` | `TeacherPass123!` |
| **Student** | `student@example.com` | `StudentPass123!` |

---

## 📄 License
This project is open-source under the MIT License.