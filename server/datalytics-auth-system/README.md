# DATALYTICS Auth System

Premium full-stack authentication system with:

- FastAPI backend (strict)
- Next.js (React) frontend + Tailwind CSS
- Email/password + OTP verification flow
- 2-step OTP login
- Google OAuth login
- JWT-protected user route
- Premium branded OTP + Welcome HTML emails

## 1) Project Structure

```text
datalytics-auth-system/
  backend/
    app/
      api/
      core/
      models/
      services/
      main.py
    requirements.txt
    .env.example
  frontend/
    app/
    components/
    lib/
    package.json
    .env.example
```

## 2) Backend Setup (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
```

### Required backend env values

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `JWT_SECRET`
- `SESSION_SECRET`
- `EMAIL_USER`
- `EMAIL_PASS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (must match Google Console)
- `FRONTEND_URL` (`http://localhost:3000` in local setup)

## 3) Frontend Setup (Next.js + React)

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Frontend runs at `http://localhost:3000` and backend at `http://localhost:5000`.

## 4) API Endpoints

- `POST /signup`
- `POST /login`
- `POST /verify-otp`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /users/me` (JWT protected)
- `GET /health`

## 5) Auth Flow

### Local signup
1. User sends email + password + confirm password to `/signup`
2. OTP is emailed
3. User verifies OTP via `/verify-otp` with `purpose="signup"`
4. Account becomes active

### Local login (2-step)
1. User sends email + password to `/login`
2. OTP is emailed
3. User verifies OTP via `/verify-otp` with `purpose="login"`
4. Backend returns JWT token

### Google login
1. User opens `/auth/google`
2. On callback, backend creates account if needed
3. Welcome email is sent for new Google users
4. JWT token is redirected to frontend success page

## 6) Notes

- In `ENV=development`, OTP API responses include `dev_otp` for quick testing.
- If `EMAIL_USER` or `EMAIL_PASS` is empty, email sending is mocked to console logs.
- Passwords and OTPs are hashed before storage.
