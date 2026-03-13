@echo off
REM Start Task Pool - Windows launcher

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

REM Open frontend
echo Opening frontend...
start frontend\index.html

echo.
echo Task Pool is ready!
echo   Backend: http://localhost:8765
echo   Frontend: http://localhost:3001
echo.
pause
