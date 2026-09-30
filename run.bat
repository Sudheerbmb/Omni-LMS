@echo off
echo ========================================================
echo Starting LMS Platform (Backend + Frontend)...
echo ========================================================

REM Navigate to project root
cd /d "%~dp0"
if exist "zoom-lms-integration" cd zoom-lms-integration

REM 1. Start FastAPI Backend in a separate window
echo Starting Backend API at http://127.0.0.1:8000 ...
start "LMS Backend (FastAPI)" cmd /k ".\.venv\Scripts\activate && python -m uvicorn app.main:app --reload --port 8000"

REM 2. Start Vite Frontend in a separate window
echo Starting Frontend UI at http://localhost:5173 ...
start "LMS Frontend (Vite)" cmd /k "cd frontend && npm run dev"

REM 3. Wait 3 seconds and launch browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo LMS is starting!
echo Frontend: http://localhost:5173
echo Backend API Docs: http://127.0.0.1:8000/docs
echo.
echo Login Credentials:
echo   Email: admin@lms-platform.com
echo   Password: OrbitAdmin!2026X7
echo ========================================================
