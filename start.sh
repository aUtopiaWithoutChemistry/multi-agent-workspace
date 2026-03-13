#!/bin/bash
# Start Task Pool - One-click launcher

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Task Pool..."

# Install Python dependencies if needed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing Python dependencies..."
    pip3 install -r requirements.txt
fi

# Install React dependencies if needed
if [ ! -d "frontend-react/node_modules" ]; then
    echo "📦 Installing React dependencies..."
    cd frontend-react && npm install && cd ..
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

# Start React frontend
echo "🌐 Starting React frontend..."
cd frontend-react && npm run dev -- --host &
REACT_PID=$!

sleep 3

echo ""
echo "🎉 Task Pool is ready!"
echo "   Backend: http://localhost:8765"
echo "   Frontend: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"
echo "Backend PID: $BACKEND_PID"
echo "React PID: $REACT_PID"

# Wait for Ctrl+C
trap "echo '🛑 Stopping...'; kill $BACKEND_PID $REACT_PID 2>/dev/null; exit 0" INT TERM

wait
