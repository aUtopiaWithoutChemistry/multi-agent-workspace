@echo off
REM Start Task Pool Backend + Desktop App

cd /d "%~dp0"

echo Starting Task Pool...

REM Install dependencies if needed
python3 -c "import fastapi" 2>nul
if errorlevel 1 (
    echo Installing dependencies...
    pip3 install -r requirements.txt
)

REM Start backend
echo Starting backend API...
start "Task Pool Backend" python3 backend\main.py

REM Wait for backend
timeout /t 3 /nobreak >nul

REM Open desktop app if built
if exist "task-pool-desktop\src-tauri\target\release\task-pool-desktop.exe" (
    echo Starting Desktop App...
    start "" "task-pool-desktop\src-tauri\target\release\task-pool-desktop.exe"
)

echo.
echo Task Pool is ready!
echo   Backend API: http://localhost:8765
echo.
echo To run the Desktop App:
echo   cd task-pool-desktop
echo   cargo run
echo.
pause
