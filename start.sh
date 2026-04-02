#!/bin/bash
set -e

# Install Python backend dependencies
echo "[startup] Installing Python backend dependencies..."
cd backend && pip install -r requirements.txt -q && cd ..

# Install Node frontend dependencies
echo "[startup] Installing Node frontend dependencies..."
cd frontend && npm install --legacy-peer-deps -q && cd ..

# Start the FastAPI backend in the background with reload so new routers
# and backend changes are picked up during development.
echo "[startup] Starting FastAPI backend on port 8000 (reload enabled)..."
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Give backend a moment to start
sleep 3

# Start Next.js frontend on port 5000
echo "[startup] Starting Next.js frontend on port 5000..."
cd frontend && npm run dev
