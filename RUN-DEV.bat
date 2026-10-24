@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install a current Node.js LTS release from https://nodejs.org/ and reopen this file.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies. The first run needs internet access for npm packages...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Check the npm output above and try: npm install
    pause
    exit /b 1
  )
)
call npm run dev
pause
