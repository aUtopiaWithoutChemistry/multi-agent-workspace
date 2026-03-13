@echo off
REM Start Task Pool - One command to launch everything

cd /d "%~dp0"

echo Starting Task Pool...

REM Install dependencies if needed
python3 -c "import fastapi" 2>nul
if errorlevel 1 (
    echo Installing Python dependencies...
    pip3 install -r requirements.txt
)

REM Install Rust if needed
if not exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    echo Installing Rust...
    curl --proto ^=https^^ --tlsv1.2 -sSf https://sh.rustup.rs -o rustup-init.exe
    rustup-init.exe -y
    del rustup-init.exe
)

REM Set Rust path
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

REM Start backend
echo Starting backend API...
start "Task Pool Backend" python3 backend\main.py
timeout /t 3 /nobreak >nul

REM Build and run desktop app
echo Building Desktop App...
cd task-pool-desktop
if not exist "src-tauri\target\release\task-pool-desktop.exe" (
    call npm install
    call cargo build --release
)

echo Starting Desktop App...
start "" "src-tatauri\target\release\task-pool-desktop.exe"

cd ..

echo.
echo Task Pool is ready!
echo   Backend: http://localhost:8765
echo.
pause
