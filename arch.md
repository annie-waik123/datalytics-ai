# 🏗️ Datalytics AI — Industry-Level System Architecture

> **Datalytics AI** is a full-stack, production-grade intelligent data analytics and machine learning platform. This document describes the complete system architecture, component relationships, data flows, and deployment strategy.

---

## 📐 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              👤  USER LAYER                                          │
│                     Browser / Desktop / Mobile Device                               │
└──────────────────────────────────────┬──────────────────────────────────────────────┘
                                       │  HTTPS / TLS
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         🌐  FRONTEND LAYER  (Port 5000)                             │
│                       Next.js 15  +  React 19  +  Tailwind CSS                      │
│                                                                                     │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────────────────┐   │
│  │  Landing Page    │  │  Analytics Workspace │  │       Admin Panel            │   │
│  │  · Hero Section  │  │  · Upload Module     │  │  · User Management           │   │
│  │  · Pricing Plans │  │  · EDA Explorer      │  │  · Payment Dashboard         │   │
│  │  · Auth UI       │  │  · Viz Dashboard     │  │  · Email Campaigns           │   │
│  │  · OTP / Google  │  │  · ML Studio         │  │  · Activity Logs             │   │
│  └──────────────────┘  │  · AI Chatbot        │  │  · Analytics Overview        │   │
│                         │  · Report Builder    │  └──────────────────────────────┘   │
│                         └─────────────────────┘                                     │
│                                                                                     │
│  UI Libraries: Framer Motion · Three.js · Plotly.js · Chart.js · Recharts          │
│  State & Routing: Next.js App Router · React Context · Custom Hooks                 │
│  Workers: Web Workers for heavy data parsing tasks                                  │
└──────────────────────────────────────┬──────────────────────────────────────────────┘
                                       │  REST API  (JSON over HTTPS)
                                       │  Authorization: Bearer <JWT>
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         ⚡  BACKEND API LAYER  (Port 8000)                          │
│                         FastAPI  +  Uvicorn  +  Python 3.x                          │
│                                                                                     │
│  ┌──────────────────────── Middleware Stack ─────────────────────────────────────┐  │
│  │  JWT Auth Middleware  │  CORS  │  Rate Limiting  │  Request Logging           │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐   │
│  │   Auth Routes   │  │  Upload Routes  │  │  Viz Routes     │  │ AI / Chat   │   │
│  │  /auth/*        │  │  /upload/*      │  │  /visualize/*   │  │  Routes     │   │
│  │  · Signup/Login │  │  · CSV/Excel    │  │  · Charts       │  │  /ai/*      │   │
│  │  · OTP Verify   │  │  · JSON/Sheets  │  │  · Plotly       │  │  · Groq LLM │   │
│  │  · Google OAuth │  │  · DB Connect   │  │  · Recommend    │  │  · Insights │   │
│  │  · JWT Issue    │  │  · PDF Ingest   │  └─────────────────┘  └─────────────┘   │
│  └─────────────────┘  └─────────────────┘                                          │
│                                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐   │
│  │   EDA Routes    │  │  Preprocess     │  │  ML Training    │  │  Report     │   │
│  │  /eda/*         │  │  Routes         │  │  Routes         │  │  Routes     │   │
│  │  · Profiling    │  │  /preprocess/*  │  │  /train/*       │  │  /reports/* │   │
│  │  · Distributions│  │  · Clean Data   │  │  · Supervised   │  │  · PDF/XLSX │   │
│  │  · Correlations │  │  · Transform    │  │  · Unsupervised │  │  · Summaries│   │
│  │  · Missing Vals │  │  · Validate     │  │  · Compare      │  │  · Charts   │   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │         Admin Routes  +  Payment Routes  +  Activity Tracker                │   │
│  │  /admin/*  ·  /payments/*  ·  /activity/*  ·  /credits/*  ·  /email/*      │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└──────┬───────────────────┬───────────────────┬───────────────────┬─────────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌──────────────┐  ┌────────────────┐  ┌───────────────┐  ┌──────────────────────┐
│ 🍃 MongoDB   │  │ 🔴 Redis Cache │  │ ⚙️  Celery    │  │  🤖 ML / AI Engine   │
│ (Motor Async)│  │                │  │  Workers      │  │                      │
│              │  │  Session Store │  │               │  │  scikit-learn        │
│  Collections:│  │  API Cache     │  │  Background   │  │  XGBoost             │
│  · users     │  │  Rate Limit    │  │  ML Jobs      │  │  CatBoost            │
│  · datasets  │  │  Counters      │  │  Async Tasks  │  │  Pandas / NumPy      │
│  · activities│  │                │  │  Report Gen   │  │                      │
│  · payments  │  │                │  │               │  │  Groq (LLaMA 3)      │
│  · models    │  │                │  │               │  │  OpenAI GPT          │
│  · reports   │  │                │  │               │  │  AI Insights         │
└──────────────┘  └────────────────┘  └───────────────┘  └──────────────────────┘
       │                                                           │
       └───────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         🌍  EXTERNAL SERVICES LAYER                                 │
│                                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  Razorpay       │  │  SMTP Service    │  │  Google OAuth   │  │  Firebase   │  │
│  │  Payment Gateway│  │  (Email)         │  │  (Social Login) │  │  (Auth SDK) │  │
│  │  · Subscriptions│  │  · OTP Emails    │  │  · ID Token     │  │  · Token    │  │
│  │  · Credits      │  │  · Welcome       │  │  · Profile      │  │    Verify   │  │
│  │  · Webhooks     │  │  · Notifications │  │  · Callback     │  │             │  │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         🚀  DEPLOYMENT LAYER                                        │
│                                                                                     │
│   Frontend --> Vercel         (Next.js serverless, global CDN, auto-deploy)         │
│   Backend  --> Render         (FastAPI Docker container, always-on web service)     │
│   Database --> MongoDB Atlas  (Managed cloud DB, replica set, automated backups)    │
│   Cache    --> Redis Cloud    (Managed Redis, TTL sessions, Celery broker)          │
│   CI/CD    --> GitHub Actions (Push -> test -> build -> deploy pipeline)            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Architecture Overview

Datalytics AI is built on a **decoupled, layered architecture** with clear separation between the presentation, business logic, data, AI/ML, and external service layers. Each layer communicates via well-defined interfaces.

| Layer | Technology | Role |
|-------|-----------|------|
| **Client** | Browser / Device | User interaction entry point |
| **Frontend** | Next.js 15 + React 19 | UI rendering, routing, state, API calls |
| **Backend** | FastAPI + Uvicorn | Business logic, REST API, auth, orchestration |
| **Data Store** | MongoDB + Motor | Persistent storage for all platform entities |
| **Cache / Queue** | Redis + Celery | Session caching and async background job execution |
| **ML Engine** | scikit-learn, XGBoost, CatBoost | On-demand machine learning workflows |
| **AI / LLM** | Groq (LLaMA 3), OpenAI GPT | Intelligent insights, chatbot, recommendations |
| **Payments** | Razorpay | Subscription and credit management |
| **Email** | SMTP | Transactional emails (OTP, welcome, notifications) |
| **Auth (Social)** | Google OAuth + Firebase | Social login verification |
| **Deployment** | Vercel + Render + Atlas | Cloud-native hosting and managed services |

---

## 🔄 Data Flow Diagrams

### 1. Authentication Flow

```
User --> Enter Credentials (Email/Password or Google)
     --> Frontend sends POST /auth/login or Google ID Token
     --> Backend validates credentials / verifies Firebase token
     --> Issues JWT (access + refresh token pair)
     --> JWT stored in httpOnly cookie / localStorage
     --> Subsequent requests include Authorization: Bearer <token>
     --> JWT Middleware verifies on every protected route
     --> Activity logged to MongoDB (login timestamp, IP, device)
```

### 2. Dataset Upload and EDA Flow

```
User --> Upload CSV/Excel/JSON/Google Sheets/DB Connection
     --> Frontend sends multipart/form-data to POST /upload/file
     --> Backend parses file --> Pandas DataFrame
     --> Profiling: column types, missing values, distributions
     --> EDA summary stored in MongoDB session (dataset_id)
     --> Response: dataset_id + column metadata + profile summary
     --> Frontend renders EDA Explorer with interactive charts
```

### 3. Machine Learning Training Flow

```
User --> Select dataset + target column + algorithm + hyperparams
     --> POST /train/model  {dataset_id, algorithm, config}
     --> Backend loads dataset from session / MongoDB
     --> Celery Worker queued for async training (Redis broker)
     --> Worker: train model (scikit-learn / XGBoost / CatBoost)
     --> Evaluate: accuracy, F1, ROC-AUC, RMSE, confusion matrix
     --> Model serialized --> stored in MongoDB / filesystem
     --> Training complete --> WebSocket / polling notification
     --> Frontend renders model comparison dashboard
```

### 4. AI Insights and Chatbot Flow

```
User --> Types natural language question in AI Chat
     --> POST /ai/chat  {message, dataset_id, context}
     --> Backend constructs prompt with dataset context + schema
     --> Groq API (LLaMA 3) / OpenAI GPT processes prompt
     --> LLM response parsed --> structured insight / recommendation
     --> Response cached in Redis (30-min TTL for same query)
     --> Frontend renders rich markdown answer with charts
```

### 5. Payment and Credits Flow

```
User --> Select plan (Free / Basic / Pro)
     --> POST /payments/create-order  {plan, user_id}
     --> Backend creates Razorpay Order --> returns order_id
     --> Frontend opens Razorpay Checkout modal
     --> User completes payment --> Razorpay sends payment_id
     --> Frontend calls POST /payments/verify  {payment_id, order_id}
     --> Backend verifies signature --> updates user plan + credits in MongoDB
     --> Welcome email sent via SMTP
```

### 6. Report Generation Flow

```
User --> Click "Generate Report" on analyzed dataset
     --> POST /reports/generate  {dataset_id, sections[]}
     --> Backend: Celery async task queued
     --> Worker: loads EDA + ML results + visualizations from MongoDB
     --> Compiles structured report with charts, summaries, insights
     --> PDF/Excel report rendered --> stored --> download URL returned
     --> Frontend presents downloadable report with preview
```

---

## 📦 Component Breakdown

### Frontend Components (`client/src/`)

```
src/
├── App.jsx                        # Root router + auth guards
├── pages/                         # Route-level page components
│   ├── LandingPage.jsx            # Marketing / hero page
│   ├── AuthPage.jsx               # Login / signup / OTP
│   └── WorkspacePage.jsx          # Main analytics workspace
├── components/                    # Feature modules
│   ├── Upload/                    # Dataset upload UI
│   ├── EDA/                       # Exploratory data analysis
│   ├── Preprocessing/             # Data cleaning UI
│   ├── Visualization/             # Chart builder & dashboard
│   ├── MLStudio/                  # Model training & comparison
│   ├── AIChat/                    # LLM-powered chatbot
│   ├── Reports/                   # Report viewer & builder
│   └── Credits/                   # Plan & credit management
├── admin/                         # Admin panel UI
│   ├── AdminDashboard.jsx         # Analytics overview
│   ├── UsersPanel.jsx             # User management
│   ├── PaymentsPanel.jsx          # Payment logs
│   └── EmailPanel.jsx             # Email campaign manager
├── auth/                          # Auth context & helpers
│   ├── AuthContext.jsx            # Global auth state
│   └── firebase.js                # Firebase SDK setup
├── hooks/                         # Custom React hooks
│   ├── useDataset.js              # Dataset state management
│   └── useApp.js                  # App-level state
├── utils/                         # Utilities
│   ├── dashboardUtils.js          # Dashboard helpers
│   ├── pdfExport.js               # PDF generation
│   └── parser.js                  # CSV/JSON parsing
└── workers/                       # Web workers
    └── dataWorker.js              # Off-thread data processing
```

### Backend Components (`server/app/`)

```
app/
├── main.py                        # FastAPI app init, router registration, CORS
├── api/v1/routes/                 # Route modules
│   ├── auth.py                    # Signup, login, OTP, Google, JWT
│   ├── admin.py                   # Admin-only management routes
│   ├── upload.py                  # File and connector ingestion
│   ├── eda.py                     # Exploratory data analysis
│   ├── preprocess.py              # Data cleaning & transformation
│   ├── visualize.py               # Chart generation (Plotly)
│   ├── train.py                   # ML model training
│   ├── predict.py                 # Model inference
│   ├── reports.py                 # Report generation
│   ├── payments.py                # Razorpay integration
│   ├── ai.py                      # LLM chatbot & insights
│   └── activity.py                # User activity tracking
├── core/
│   ├── database.py                # MongoDB Motor async connection
│   ├── security.py                # JWT encode/decode
│   └── config.py                  # Environment variable loader
├── middleware/
│   ├── auth_middleware.py         # JWT validation middleware
│   └── rate_limit.py              # Request rate limiting
├── models/                        # Pydantic schemas
│   ├── user.py                    # User model
│   ├── dataset.py                 # Dataset model
│   └── payment.py                 # Payment model
├── services/                      # Business logic services
│   ├── ml_service.py              # Model training orchestration
│   ├── eda_service.py             # Automated profiling
│   ├── report_service.py          # Report builder
│   ├── email_service.py           # SMTP email sender
│   └── activity_service.py        # Activity log writer
└── state/
    └── session_store.py           # In-memory/Redis session state
```

---

## 🔐 Security Architecture

| Concern | Implementation |
|---------|---------------|
| **Authentication** | JWT (HS256) with access + refresh token rotation |
| **Social Auth** | Google OAuth 2.0 via Firebase ID token verification |
| **OTP Verification** | Time-limited 6-digit OTP via SMTP, hashed in MongoDB |
| **Password Storage** | bcrypt hashed, never stored in plaintext |
| **API Security** | JWT middleware on all protected routes |
| **Rate Limiting** | Redis-backed per-IP rate limiter |
| **CORS** | Strict origin whitelist in FastAPI CORS middleware |
| **Secrets** | All keys in `.env` (never committed to git) |
| **Data Isolation** | All queries scoped by `user_id` from JWT claims |
| **Payment Security** | Razorpay HMAC signature verification on webhook |

---

## 🚀 Deployment Architecture

### Infrastructure

```
                        GitHub Repository
                              │
                    ┌─────────┴──────────┐
                    │   GitHub Actions    │
                    │   CI/CD Pipeline    │
                    └────┬────────────────┘
                         │
              ┌──────────┴───────────┐
              │                      │
              ▼                      ▼
         Vercel                  Render
    (Next.js Frontend)      (FastAPI Backend)
    · Global CDN             · Docker Container
    · Edge Functions         · Always-on Service
    · Auto HTTPS             · Auto HTTPS
    · Preview URLs           · Env Variables
              │                      │
              └──────────┬───────────┘
                         │
              ┌──────────┴────────────────┐
              │                           │
              ▼                           ▼
       MongoDB Atlas                 Redis Cloud
    (Managed Database)           (Managed Cache)
    · M0/M10+ Cluster            · Celery Broker
    · Replica Set                · Session Cache
    · Automated Backups          · API Rate Limits
    · Data Encryption
```

### Environment Variables

```env
# Database
MONGO_URI=mongodb+srv://...

# Auth
JWT_SECRET=<strong-secret>
GOOGLE_CLIENT_ID=<firebase-client-id>

# AI / LLM
GROQ_API_KEY=<groq-key>
OPENAI_API_KEY=<openai-key>

# Payments
RAZORPAY_KEY_ID=<key>
RAZORPAY_KEY_SECRET=<secret>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=<email>
SMTP_PASSWORD=<app-password>

# Admin
ADMIN_EMAIL=<admin-email>
ADMIN_PASSWORD=<hashed-password>
```

---

## 📊 Tech Stack Summary

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15 | App framework, SSR, routing |
| React | 19 | Component-based UI |
| Tailwind CSS | 3 | Utility-first styling |
| Framer Motion | 12 | Animations & transitions |
| Three.js | 0.183 | 3D landing page effects |
| Plotly.js | 3 | Interactive data charts |
| Chart.js | 4 | Statistical visualizations |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | Latest | REST API framework |
| Uvicorn | ASGI | Production ASGI server |
| Python | 3.10+ | Runtime language |
| Motor | Async | Async MongoDB driver |
| Celery | Latest | Distributed task queue |
| Redis | Latest | Cache + message broker |

### Data and ML

| Technology | Purpose |
|-----------|---------|
| Pandas | Data manipulation & analysis |
| NumPy | Numerical computing |
| scikit-learn | Classification, regression, clustering |
| XGBoost | Gradient-boosted trees |
| CatBoost | Categorical feature ML |
| Matplotlib / Seaborn | Static plot generation |

### AI and External

| Service | Purpose |
|---------|---------|
| Groq (LLaMA 3) | Primary LLM for AI insights |
| OpenAI GPT | Fallback / advanced AI |
| Razorpay | Payment gateway (India) |
| Google OAuth | Social login |
| Firebase | Token verification |
| SMTP | Transactional email |

---

## 🗺️ Full User Journey

```
1.  DISCOVER    --> User visits landing page (Vercel CDN)
2.  REGISTER    --> Signup with email + OTP / Google OAuth
3.  LOGIN       --> JWT issued --> session started
4.  UPLOAD      --> CSV / Excel / JSON / DB connection
5.  EXPLORE     --> Automated EDA profiling + summaries
6.  CLEAN       --> Data preprocessing & transformation
7.  VISUALIZE   --> Interactive charts & dashboard builder
8.  TRAIN       --> ML model selection + async training
9.  PREDICT     --> Run predictions on new data
10. ASK AI      --> Natural language insights via Groq LLM
11. REPORT      --> Export PDF/Excel analytics report
12. SUBSCRIBE   --> Upgrade plan via Razorpay
13. ADMIN       --> Platform admin monitors all activity
```

---

## 📁 Related Files

- [README.md](./README.md) — Project overview and setup guide
- [server/requirements.txt](./server/requirements.txt) — Python dependencies
- [client/package.json](./client/package.json) — Node.js dependencies
- [render.yaml](./render.yaml) — Render deployment configuration
- [server/.env](./server/.env) — Backend environment configuration

---

*Architecture document for **Datalytics AI** by Sangam Singh — Built as a production-grade full-stack AI analytics platform.*
