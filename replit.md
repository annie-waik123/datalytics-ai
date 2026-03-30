# Datalytics — AI-Powered ML & Insights Platform

## Architecture

Full-stack application with two services:

- **Frontend**: Next.js 15 (React 19) — runs on port 5000
- **Backend**: FastAPI (Python 3.12) — runs on port 8000

The frontend proxies all `/api/*` requests to the backend via Next.js rewrites, so the browser only ever talks to port 5000. This ensures compatibility in Replit's proxied environment.

## Directory Structure

```
/
├── frontend/           # Next.js app
│   ├── app/            # App router pages & layouts
│   ├── src/            # Components, API client, pages
│   │   ├── api/client.js   # Axios client (uses relative /api paths)
│   │   ├── components/     # React components
│   │   └── pages/          # Additional pages
│   ├── next.config.mjs     # Rewrites /api/* → backend:8000
│   └── package.json        # Port 5000, host 0.0.0.0
├── backend/            # FastAPI app
│   ├── main.py             # Entry point, CORS, middleware
│   ├── database.py         # MongoDB connection (motor)
│   ├── routers/            # API route handlers
│   ├── services/           # ML service, recommendations
│   ├── models/             # Pydantic schemas
│   └── state/              # Session store
└── start.sh            # Manual startup script (both services)
```

## Workflows

- **Start application** — `cd frontend && npm run dev` (port 5000, webview)
- **Backend API** — `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload` (port 8000, console)

## Required Environment Variables / Secrets

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (e.g. MongoDB Atlas) |
| `MONGODB_DB` | Database name (default: `datalytics`) |
| `GROQ_API_KEY` | Groq API key for the AI chatbot feature |

## Key Design Decisions

- **Relative API URLs**: The frontend uses `/api` (not `localhost:8000`) so requests work through Replit's proxy.
- **Next.js rewrites**: `next.config.mjs` forwards `/api/*` to the FastAPI backend running locally.
- **CORS**: Backend accepts requests from localhost variants and `*.replit.dev` / `*.repl.co` domains.
- **Port 5000**: Required by Replit's webview. Both `dev` and `start` scripts use `-p 5000 -H 0.0.0.0`.
