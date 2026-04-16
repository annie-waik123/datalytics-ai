@echo off
cd /d "C:\Users\singh\OneDrive\Desktop\ds - Copy\datalytics-auth-system\backend"
start "" /B ".venv\Scripts\python.exe" -u -m uvicorn app.main:app --host 127.0.0.1 --port 5000 1>backend.log 2>backend.err.log
