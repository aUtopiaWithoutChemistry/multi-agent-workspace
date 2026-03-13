#!/bin/bash
# Start Task Pool Backend + Desktop App

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Task Pool..."

# Install Python dependencies if needed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing Python dependencies..."
    pip3 install -r requirements.txt
fi

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

# Check if desktop app is already built
if [ -d "task-pool-desktop/src-tauri/target/release/task-pool-desktop" ]; then
    echo "🚀 Starting Desktop App..."
    open task-pool-desktop/src-tauri/target/release/task-pool-desktop.app 2>/dev/null || \
    task-pool-desktop/src-tauri/target/release/task-pool-desktop &
    DESKTOP_PID=$!
fi

echo ""
echo "🎉 Task Pool is ready!"
echo "   Backend API: http://localhost:8765"
echo ""
echo "To run the Desktop App:"
echo "   cd task-pool-desktop"
echo "   source ~/.cargo/env && cargo run"
echo ""
echo "Press Ctrl+C to stop"
echo "Backend PID: $BACKEND_PID"

# Wait for Ctrl+C
trap "echo '🛑 Stopping...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM

wait
