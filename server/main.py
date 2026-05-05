"""
Backward-compatible entry point.
Delegates to app.main — run from the server/ directory:
  uvicorn main:app --reload --port 8000
  OR
  uvicorn app.main:app --reload --port 8000
"""
from app.main import app  # noqa: F401 — re-export for uvicorn
