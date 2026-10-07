@echo off
REM Starts the Eveready planner UI. Run "demand forecasting api" first (uvicorn app:app --reload) for live forecasts.
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing packages for the first time, this takes a minute...
  call npm install
)
echo Opening http://localhost:5173 ...
start "" http://localhost:5173
call npm run dev
pause
