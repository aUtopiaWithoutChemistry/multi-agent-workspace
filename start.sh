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

# Source Rust environment
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
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

# Build and run desktop app
echo "🖥️ Building & starting Desktop App..."
cd task-pool-desktop

# Build if needed
if [ ! -d "src-tauri/target/release/task-pool-desktop.app" ]; then
    echo "📦 Building desktop app (first time only)..."
    npm install
    cargo build --release
fi

# Run the app
open src-tauri/target/release/task-pool-desktop.app 2>/dev/null || \
    ./src-tauri/target/release/task-pool-desktop &

echo ""
echo "🎉 Task Pool is ready!"
echo "   Backend: http://localhost:8765"
echo ""
echo "Press Ctrl+C to stop everything"

# Wait for Ctrl+C
trap "echo '🛑 Stopping...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM

wait
