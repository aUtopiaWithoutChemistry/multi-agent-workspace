#!/bin/bash
# Start Task Pool - One command to launch everything

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Task Pool..."

# Install Python dependencies if needed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing Python dependencies..."
    pip3 install -r requirements.txt
fi

# Add Rust to PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Start backend in background
echo "🔧 Starting backend API..."
python3 backend/main.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if ! curl -s http://localhost:8765/ > /dev/null 2>&1; then
    echo "❌ Failed to start backend"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend running at http://localhost:8765"

# Build and run desktop app
cd task-pool-desktop

# Check for existing build
APP_PATH=""
if [ -f "src-tauri/target/release/task-pool-desktop" ]; then
    APP_PATH="src-tauri/target/release/task-pool-desktop"
elif [ -f "src-tauri/target/debug/task-pool-desktop" ]; then
    APP_PATH="src-tauri/target/debug/task-pool-desktop"
fi

# Build if needed
if [ -z "$APP_PATH" ]; then
    echo "📦 Building desktop app..."
    npm install
    cd src-tauri
    cargo build --release
    cd ..
    APP_PATH="src-tauri/target/release/task-pool-desktop"
fi

# Run the app
echo "🖥️ Starting Desktop App..."
open "$APP_PATH.app" 2>/dev/null || "$APP_PATH" &

cd "$SCRIPT_DIR"

echo ""
echo "🎉 Task Pool is ready!"
echo "   Backend: http://localhost:8765"
echo ""
echo "Press Ctrl+C to stop everything"

# Wait for Ctrl+C
trap "echo '🛑 Stopping...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM

wait
