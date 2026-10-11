#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "Starting Smart Contact Manager (SCM)"
echo "=========================================================="

# Free ports 8080, 8081, and 3000 if already in use
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 1. Start API Gateway on Port 8080 in the background
echo "-> Starting API Gateway on http://localhost:8080 ..."
node api-gateway/src/server.js &
GATEWAY_PID=$!

cleanup() {
  echo ""
  echo "Stopping API Gateway (PID $GATEWAY_PID)..."
  kill $GATEWAY_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 2. Install frontend dependencies if not already installed
if [ ! -d "frontend-react/node_modules" ]; then
  echo "-> Installing React frontend dependencies..."
  (cd frontend-react && npm install)
fi

echo "-> API Gateway & Swagger Docs: http://localhost:8080/docs"
echo "-> React Web App:              http://localhost:3000"
echo "=========================================================="

# 3. Start React Frontend on Port 3000
cd frontend-react
npm run dev
