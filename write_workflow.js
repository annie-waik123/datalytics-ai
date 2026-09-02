const fs = require('fs');
const p = 'c:/Users/singh/OneDrive/Desktop/Datalytics/workflow.md';

let doc = `# Datalytics — Complete End-to-End Workflow Documentation

> **Onboarding-level documentation** — Real file names, exact call sequences, complete execution flows.
> Every step verified directly from the codebase. No guessing.

---

## 📦 Tech Stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| **Next.js** | v15 | React framework, App Router, SSR, API proxy rewrites |
| **React** | v19 | UI component library |
| **Axios** | v1.15 | HTTP API client with interceptors |
| **Firebase** | v12 | Google Auth + Firestore user profiles |
| **Framer Motion** | v12 | Animations and transitions |
| **Plotly.js** | v3 | Interactive data visualizations |
| **Chart.js / Recharts** | v4/v2 | Supplementary chart components |
| **TailwindCSS** | v3 | Utility-first CSS framework |
| **PapaParse** | v5 | Client-side CSV parsing |
| **jsPDF** | v2 | Client-side PDF report generation |
| **@react-oauth/google** | v0.13 | Google OAuth button |

### Backend
| Technology | Version | Role |
|---|---|---|
| **FastAPI** | latest | Python async web framework |
| **Uvicorn** | latest | ASGI server (runs FastAPI) |
| **Motor** | latest | Async MongoDB driver (non-blocking) |
| **MongoDB Atlas** | cloud | Primary persistent database |
| **Pandas / NumPy** | — | Data manipulation and numerics |
| **Scikit-learn** | — | ML models (RF, LR, DT, SVM, KNN, etc.) |
| **XGBoost / CatBoost** | — | Gradient boosting models |
| **OpenAI (gpt-5.4)** | latest | LLM for AI insights and recommendations |
| **Groq** | latest | Alternative fast LLM for chatbot |
| **PyJWT + bcrypt** | — | JWT auth and password hashing |
| **Razorpay** | latest | Payment gateway |
| **Celery + Redis** | — | Async background task queue (optional) |
| **SMTP / Gmail** | — | Email delivery (OTP, welcome emails) |

### Deployment
| Component | Platform | Details |
|---|---|---|
| Frontend | Render (Node) | Port 5000, npm start |
| Backend | Render (Python) | Uvicorn, port from $PORT |
| Database | MongoDB Atlas | Cloud-hosted, async Motor driver |

---

## 🗂️ Folder and File Structure

\`\`\`
Datalytics/
├── render.yaml                      ← Deployment config (2 services)
├── README.md
│
├── client/                          ← Next.js Frontend — port 5000
│   ├── next.config.mjs              ← Proxy: /api/* → http://127.0.0.1:8000/api/*
│   ├── package.json                 ← Node dependencies
│   ├── .env                         ← Firebase + Razorpay public keys
│   │
│   ├── app/                         ← Next.js App Router (file-based routing)
│   │   ├── layout.jsx               ← Root HTML shell (fonts, SEO metadata, Providers)
│   │   ├── page.jsx                 ← Route "/" — Marketing landing page (150KB)
│   │   ├── providers.jsx            ← React context providers wrapper
│   │   ├── globals.css              ← Base CSS reset + global design tokens
│   │   ├── app/                     ← Route "/app" — SPA shell entry
│   │   └── admin/                   ← Route "/admin" — Admin panel entry
│   │
│   └── src/                         ← Core SPA source code
│       ├── main.jsx                 ← SPA entry (ReactDOM.createRoot for /app route)
│       ├── App.jsx                  ← AppShell — master state machine + step router
│       │
│       ├── api/                     ← Axios API service layer (one file per domain)
│       │   ├── client.js            ← Axios instance + session-ID + auth interceptors
│       │   ├── upload.js            ← uploadDataset, uploadInChunks, connectDatabase
│       │   ├── chat.js              ← sendChatMessage, sendAIInsightsMessage
│       │   ├── dashboard.js         ← Dashboard API calls
│       │   ├── eda.js               ← EDA summary, chart, action calls
│       │   ├── insights.js          ← AI insights calls
│       │   └── visualization.js     ← Visualization calls
│       │
│       ├── auth/                    ← Complete authentication system
│       │   ├── firebase.js          ← Firebase init (getAuth, getFirestore)
│       │   ├── AuthContext.jsx      ← React Context + all auth functions
│       │   ├── AuthSystem.jsx       ← Auth UI: login / signup / OTP / forgot-password
│       │   ├── Login.jsx            ← Standalone login form
│       │   ├── Signup.jsx           ← Standalone signup form
│       │   ├── OTPVerification.jsx  ← 6-digit OTP input
│       │   ├── ForgotPassword.jsx   ← Password reset component
│       │   ├── GoogleAuthButton.jsx ← Google OAuth button wrapper
│       │   ├── profileStore.js      ← Firestore user profile CRUD
│       │   └── authErrors.js        ← Firebase error code to human message map
│       │
│       ├── components/              ← All major UI step components
│       │   ├── Sidebar.jsx          ← Left navigation (step links, collapse/expand)
│       │   ├── Navbar.jsx           ← Top bar (diamonds, profile, notifications)
│       │   ├── AppErrorBoundary.jsx ← React Error Boundary (catches render crashes)
│       │   ├── UploadStep.jsx       ← Step 1 — Dataset upload + DB connection
│       │   ├── DataPreparationStep.jsx ← Step 2 — EDA + data cleaning
│       │   ├── ExploreStep.jsx      ← Step 3 — Data exploration + profiling
│       │   ├── VisualizationStep.jsx   ← Step 4 — Chart builder
│       │   ├── PowerBIDashboardStep.jsx ← Step 5 — BI dashboard builder
│       │   ├── TrainStep.jsx        ← Step 6a — Supervised ML training
│       │   ├── UnsupervisedStep.jsx ← Step 6b — Clustering (K-Means, DBSCAN)
│       │   ├── BestModelStep.jsx    ← Step 7 — Best model summary + feature importance
│       │   ├── PredictStep.jsx      ← Step 8 — Single prediction form
│       │   ├── RecommendationStep.jsx  ← Step 9 — AI business recommendations
│       │   ├── AIInsightsStep.jsx   ← Step 10 — Deep AI pattern analysis
│       │   ├── DecisionMakingStep.jsx  ← Step 11 — Decision support UI
│       │   ├── ReportStep.jsx       ← Step 12 — Full analytics report
│       │   ├── ChatBot.jsx          ← Floating chatbot (4 modes)
│       │   ├── DownloadStep.jsx     ← Download model / predictions / report
│       │   ├── PlotFigure.jsx       ← Plotly chart renderer
│       │   └── ConnectionModal.jsx  ← DB connection credentials modal
│       │
│       ├── hooks/                   ← Custom React hooks
│       │   ├── useDataset.js        ← Dataset state + localStorage persistence
│       │   ├── useDiamonds.js       ← Gem/credit system (balance, deduct, recharge)
│       │   └── useToast.js          ← Toast notification system
│       │
│       └── utils/
│           ├── dataset.js           ← buildDatasetProfile — column stats
│           ├── dashboardBuilder.js  ← BI widget layout builder
│           └── dataPreparation.js   ← Client-side data prep helpers
│
└── server/                          ← FastAPI Backend — port 8000
    ├── main.py                      ← Entry alias: from app.main import app
    ├── celery_app.py                ← Celery task queue factory (optional Redis)
    ├── requirements.txt             ← All Python dependencies
    ├── .env                         ← Secrets: MONGODB_URI, OPENAI_KEY, SMTP, Razorpay
    │
    └── app/
        ├── main.py                  ← FastAPI factory — CORS + middleware + 13 routers
        │
        ├── api/v1/routes/           ← Route handlers (thin controllers)
        │   ├── upload.py            ← POST /api/upload + chunked upload
        │   ├── auth.py              ← POST /api/auth/signup|login|verify-otp|google-login
        │   ├── eda.py               ← GET/POST /api/eda/summary|action|chart|report
        │   ├── preprocess.py        ← POST /api/preprocess
        │   ├── train.py             ← POST /api/train|cluster; GET /api/train-results
        │   ├── predict.py           ← POST /api/predict; GET /api/download-model
        │   ├── chatbot.py           ← POST /api/chat, /chat/ai-insights
        │   ├── reports.py           ← GET /api/report/generate|download
        │   ├── recommendations.py   ← POST /api/recommendations
        │   ├── payment.py           ← POST /api/payment/create-order|verify
        │   ├── activity.py          ← POST /api/user-activities/log
        │   ├── data.py              ← GET /api/dataset/json|preview
        │   └── admin.py             ← Admin-protected user management
        │
        ├── services/                ← Business logic layer — heavy computation here
        │   ├── ml_service.py        ← preprocess, train_supervised, predict (77KB)
        │   ├── dataset_service.py   ← File streaming, chunked upload, DataFrame parsing
        │   ├── eda_service.py       ← EDA summary, charts, actions, HTML report (63KB)
        │   ├── llm_service.py       ← OpenAI chat completions wrapper
        │   ├── insight_generation_service.py ← AI insights logic
        │   ├── recommendation_service.py ← Business recommendations + quality scores
        │   ├── visualization_service.py  ← Plotly chart generation (70KB)
        │   ├── dashboard_service.py ← BI dashboard widget generation
        │   ├── data_engine_service.py ← In-memory data query engine
        │   ├── cache_service.py     ← Simple in-process cache
        │   └── activity_service.py  ← User activity helpers
        │
        ├── models/
        │   └── schemas.py           ← Pydantic request/response models
        │
        ├── core/
        │   ├── database.py          ← Motor async MongoDB client + CRUD helpers
        │   └── auth_utils.py        ← JWT decode utility
        │
        └── state/
            └── session_store.py     ← In-memory SessionData store (thread-safe dict)
\`\`\`

---

## 🔗 Individual Feature Flows

### 1. Backend Startup
\`\`\`
uvicorn main:app --reload --port 8000
  └── server/main.py → from app.main import app
        └── server/app/main.py:
              load_dotenv()                ← Load .env secrets
              lifespan(): await ping_db()  ← Test MongoDB connection on startup
              FastAPI app created
              CORSMiddleware(allow_origins=["*"])
              session_middleware registered  ← UUID per request
              13 routers mounted at /api/*
\`\`\`

### 2. Frontend Startup
\`\`\`
npm run dev  (port 5000)
  └── next.config.mjs: /api/* → http://127.0.0.1:8000/api/*
        └── app/layout.jsx   ← Root HTML + SEO metadata
              URL "/"    → app/page.jsx  (Landing page)
              URL "/app" → src/main.jsx → ReactDOM.createRoot → App.jsx
              App.jsx: step="upload", loads dataset from localStorage
\`\`\`

### 3. Auth — Email/Password Login
\`\`\`
AuthSystem.jsx → onLogin(e) → fetch("/api/auth/login", { POST, JSON })
  └── auth.py:
        db["users"].find_one({ email })   ← MongoDB async lookup
        bcrypt.checkpw(plain, hashed)     ← Verify password (~100ms intentionally slow)
        jwt.encode({ sub: email, exp: +24h }, SECRET_KEY, "HS256")
        return { token: "eyJ...", user: { email, fullName, role } }
  └── AuthSystem.jsx:
        localStorage.setItem("auth_token", token)
        All future Axios requests: Authorization: Bearer jwt
\`\`\`

### 4. Auth — Google OAuth
\`\`\`
AuthSystem.jsx → <GoogleLogin onSuccess={handleGoogleSuccess} />
  └── Google popup returns id_token string
        handleAction("google-login", { token: credential })
          → POST /api/auth/google-login
  └── auth.py:
        id_token.verify_oauth2_token(token, GOOGLE_CLIENT_ID)
        db["users"].update_one({ email }, upsert=True)
        create_access_token({ sub: email }) → return { token, user }
\`\`\`

### 5. Auth — OTP Verification
\`\`\`
POST /api/auth/request-otp:
  otp = str(random.randint(100000, 999999))
  db["otps"].replace_one({ email }, { otp, expires_at: now+10min }, upsert=True)
  send_email(to, subject, body) → smtplib.SMTP("smtp.gmail.com", 587) + TLS
  └── User types OTP → AuthSystem.jsx auto-submits at 6 digits
        POST /api/auth/verify-otp:
          db["otps"].find_one({ email }) → check otp + not expired
          db["users"].update_one({ $set: { verified: true } })
          create_access_token(...) → return JWT
\`\`\`

### 6. File Upload — Direct (less than 12 MB)
\`\`\`
UploadStep.jsx → handleFileSelect(file)
  └── api/upload.js → uploadDirect(file):
        new FormData() → formData.append("file", file)
        client.post("/upload", formData)
        ← Axios auto-adds X-Session-ID + Authorization headers
  └── upload.py → upload_dataset():
        Validate extension (.csv / .xlsx / .xls / .json)
        stream_upload_to_path(file, .cache/datasets/session_id/filename)
        prepare_uploaded_dataset():
          pd.read_csv / pd.read_excel / pd.read_json
          optimize_memory(df)          ← Downcast dtypes, saves ~40% RAM
          build_dataset_snapshot(df)   ← rows, cols, sample rows, column info
          session.df = df              ← Full DataFrame stored in server RAM
        db["datasets"].replace_one({ session_id }, upsert=True)
        return JSONResponse(snapshot)
  └── App.jsx: setDataset(snapshot) → localStorage + React state update
\`\`\`

### 7. File Upload — Chunked (12 MB and above)
\`\`\`
api/upload.js → uploadInChunks(file):
  POST /api/upload/init → { upload_id, chunk_size: 5MB }
  Loop: file.slice(offset, offset+5MB) as FormData
    → POST /api/upload/chunk/upload_id   (server writes .part-N to disk)
  POST /api/upload/complete/upload_id
    → Concatenate all .part-N files → prepare_uploaded_dataset(...)
\`\`\`

### 8. Database Source Connection
\`\`\`
ConnectionModal.jsx → connectDatabase(credentials)
  → POST /upload/connect { source, host, user, password, query }
  └── upload.py → upload_connect():
        MySQL/PostgreSQL: SQLAlchemy engine → pd.read_sql(query, engine)
        JSON API: requests.get(url) → smart_json_to_df(nested JSON)
        Google Sheets: fetch /export?format=csv → fallback strategies
\`\`\`

### 9. EDA — Data Preparation
\`\`\`
DataPreparationStep.jsx mounts → GET /api/eda/summary
  └── eda.py → build_eda_summary(session.df):
        df.describe(), df.isnull().sum(), df.dtypes, df.corr()
        → Returns JSON stats (not raw data rows)
User clicks "Drop Missing Rows":
  POST /api/eda/action { action: "drop_na" }
  └── eda_service.apply_eda_action(session.df, "drop_na", {})
        session.df = cleaned_df
        _reset_downstream_state(session)  ← Clears ML state (data changed)
\`\`\`

### 10. Preprocessing
\`\`\`
POST /api/preprocess { target_col, task_type, missing_strategy, scaling_method, test_size }
  └── ml_service.preprocess():
        Fill missing:  df[col].fillna(df[col].mean())
        Encode cats:   LabelEncoder().fit_transform(df[col])
        Scale:         StandardScaler().fit_transform(X_train) — fit ONLY on train
        train_test_split(test_size=0.2, random_state=42)
        → session.X_train, X_test, scaler, label_encoders, preprocessing_done = True
\`\`\`

### 11. Model Training
\`\`\`
POST /api/train
  └── ml_service.train_supervised():
        Classification: LogisticRegression, DecisionTree, RandomForest,
                        GradientBoosting, XGBoost, CatBoost, SVC, KNN
        Regression:     LinearRegression, Ridge, Lasso, RandomForest,
                        GradientBoosting, XGBoost, CatBoost, SVR
        Cross-validate each (cv=5)
        Evaluate: Accuracy or R2, Precision, Recall, F1 or MAE, MSE, RMSE
        → session.best_model = highest-scoring sklearn object in RAM
\`\`\`

### 12. Prediction
\`\`\`
POST /api/predict { feature_values: { col1: val1, col2: val2, ... } }
  └── ml_service.predict():
        label_encoders["Neighborhood"].transform(["CollgCr"]) → [3]
        X_scaled = scaler.transform([[8000, 3, 1500, ...]])   ← Same fitted scaler
        model.predict(X_scaled)[0] → 225000.0
        session.prediction_history.append(record)
\`\`\`

### 13. Chatbot (AI)
\`\`\`
ChatBot.jsx → POST /api/chat { message, mode: "chat" }
  └── chatbot.py:
        df_rows = session.df.head(48).to_dict("records")  ← Real CSV rows
        chat_history = db["chats"].find({ session_id }, limit=20)
        Prompt: system_prompt + dataset_context + history + user_message
        openai.chat.completions.create(model="gpt-5.4", max_tokens=2500)
        db["chats"].insert_one({ role: "user",      content: message })
        db["chats"].insert_one({ role: "assistant", content: reply })
        return { reply, mode, model }
\`\`\`

### 14. Payment (Razorpay)
\`\`\`
useDiamonds.js → POST /api/payment/create-order { plan: "Pro Pack" }
  └── payment.py (JWT required):
        razorpay.Client.order.create({ amount: 50000, currency: "INR" })
        return { order_id, amount, key_id }
  └── Razorpay JS modal → user pays → { payment_id, signature }
        POST /api/payment/verify:
          HMAC-SHA256(secret, order_id+"|"+payment_id) verify
          db["users"].update_one({ $inc: { diamonds: 800 } })
          db["payments"].insert_one(payment_record)
\`\`\`

### 15. Report Generation
\`\`\`
ReportStep.jsx → GET /api/report/generate
  └── reports.py:
        get_data_quality_score(df)      ← Completeness, uniqueness, validity scores
        get_statistical_insights(df)    ← Correlations, outliers, distribution
        _generate_executive_summary(...)← Template text with real values interpolated
        return full JSON report
  └── User clicks "Download PDF":
        jsPDF.html(reportElement) → client-side PDF → browser save dialog
\`\`\`

---

---

# 🏗️ MASTER WORKFLOW — Complete Application Execution

> This section traces the **complete execution** of Datalytics from browser open to user seeing results.
>
> Every step includes:
> - **What** — the exact file and function that runs
> - **Why** — the theory and design rationale behind that decision

---

## PHASE 1 — Application Bootstraps

\`\`\`
Browser opens: http://localhost:5000
\`\`\`

**[THEORY]** When the browser hits localhost:5000, the OS establishes a TCP connection to the Node.js process (Next.js server). The browser sends an HTTP GET request. Next.js handles routing based on the URL path. This is standard HTTP/1.1 or HTTP/2 client-server communication — the same protocol that powers every website on the internet.

\`\`\`
  ↓
client/app/layout.jsx   ← Root HTML shell — executes first for every page
  ├── Sets html lang=en with CSS font variables (Poppins, Inter, JetBrains Mono)
  ├── Injects SEO metadata: title, description, og:tags, twitter:card
  └── Wraps all content in Providers   ← client/app/providers.jsx
\`\`\`

**[THEORY]** In Next.js App Router, layout.jsx is a **persistent shell** — it renders once and stays mounted as the user navigates between pages. Child pages render inside it. This avoids re-creating html and body tags on every navigation, making transitions feel instant. SEO metadata defined here is injected into head automatically by Next.js at build/request time — no manual Head tag management needed.

\`\`\`
  ↓
client/app/page.jsx  ← Marketing landing page renders at URL "/"
  ← 150KB client component with animated blobs, hero section, pricing, feature demos
\`\`\`

**[THEORY]** The landing page is a **client component** (use client) because it uses browser-only APIs: IntersectionObserver for scroll-triggered animations, window.scrollY for parallax effects, and useRouter for navigation. Client components are **hydrated** — the server sends static HTML for fast first paint, then React attaches event listeners in the browser to make it fully interactive. This is Next.js's hybrid SSR + client rendering model.

---

## PHASE 2 — User Authenticates

\`\`\`
User clicks "Get Started" button on landing page
  ↓
client/src/auth/AuthSystem.jsx mounts as overlay modal
  └── const [view, setView] = useState("login")
      const [form, setForm] = useState({ email: "", password: "", otp: "" })
\`\`\`

**[THEORY]** Instead of navigating to a /login page, the app shows an overlay modal. This is a deliberate UX pattern — the user stays on the landing page (they can see the product behind the modal), reducing cognitive context-switch. The view state acts as a **local state machine**: login, signup, otp, forgot, reset. Each view renders a different form, but all share one form state object. This is far simpler than separate routes for each auth step.

\`\`\`
  ↓
User types email/password → clicks "Login"
  └── onLogin(e) → handleAction("login", { email, password })
        └── fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password })
            })
\`\`\`

**[THEORY]** handleAction is a **generic error-handling wrapper** around all auth API calls. It handles setLoading(true), clears errors, calls fetch, parses JSON, throws on non-OK status, and runs setLoading(false) in finally. This single wrapper prevents code duplication across login, signup, OTP, and forgot-password handlers. Note: AuthSystem.jsx uses native fetch() (not Axios) — intentionally, to avoid circular dependency with client.js before the session ID is initialized at startup.

\`\`\`
  ↓
Next.js proxy fires (next.config.mjs rewrites):
  /api/auth/login  →  http://127.0.0.1:8000/api/auth/login
\`\`\`

**[THEORY]** The rewrite rule is the **key architectural decision** of the whole system. The browser always talks to localhost:5000 (same origin). Next.js silently forwards the request to FastAPI at port 8000. This completely solves **CORS** — browsers block JavaScript from requesting different ports/domains without special headers. By proxying, the browser never sees a different origin. Backend URL is also configurable via NEXT_PUBLIC_API_URL env var without any frontend code changes.

\`\`\`
  ↓
FastAPI receives POST /api/auth/login
  ↓
app/main.py → session_middleware() runs FIRST (before any route handler)
  ├── Reads X-Session-ID from request headers
  ├── If absent: session_id = str(uuid.uuid4())   ← generates new UUID
  └── Injects session_id into request.scope → passes to route handler
\`\`\`

**[THEORY]** **Middleware** in ASGI (the async interface FastAPI uses) wraps every request/response cycle. It runs before the route handler. The session middleware ensures every HTTP request — including auth requests — has a session ID. This UUID is the **identity of the browser session** — it links the uploaded dataset, trained models, and chat history together on the server. Without it, the server cannot know which pandas DataFrame belongs to which browser tab.

\`\`\`
  ↓
server/app/api/v1/routes/auth.py → @router.post("/auth/login")
  ├── db = get_db()   ← AsyncIOMotorClient singleton (app/core/database.py)
  ├── user = await db["users"].find_one({ "email": email.lower() })
\`\`\`

**[THEORY]** get_db() uses a **singleton pattern** — first call creates the MongoDB connection, subsequent calls reuse it. Motor (async MongoDB driver) uses Python asyncio. When await db["users"].find_one(...) is called, the Python event loop **suspends this coroutine** and handles other incoming requests while waiting for MongoDB over the network. This is **I/O concurrency** — not threads, but cooperative multitasking via coroutines. FastAPI handles thousands of concurrent requests without thousands of threads, because most waiting time is I/O, not CPU.

\`\`\`
  ├── bcrypt.checkpw(password.encode("utf-8"), user["hashed_password"].encode("utf-8"))
\`\`\`

**[THEORY]** **bcrypt** is intentionally slow (~100ms per verification). This is security by design: an attacker who steals the database and brute-forces 1 million passwords needs 100,000 seconds (27+ hours). With MD5 or SHA256 (microseconds per hash), an attacker could try billions per second. bcrypt's slowness IS the security feature — it makes offline dictionary attacks computationally infeasible.

\`\`\`
  ├── jwt.encode({ "sub": email, "exp": utcnow + timedelta(hours=24) }, SECRET_KEY, "HS256")
\`\`\`

**[THEORY]** A **JWT (JSON Web Token)** is a self-contained credential with three base64 parts: header.payload.signature. The payload holds sub (subject = user email) and exp (expiry timestamp). The signature is HMAC-SHA256 of header+payload using the server secret key. Any server knowing the secret can **verify authenticity without a database lookup**. This is **stateless authentication** — no server-side session table needed. Downside: tokens cannot be revoked before expiry without implementing a separate blacklist.

\`\`\`
  └── return { "token": jwt_string, "user": { email, fullName, role, diamonds } }
  ↓
AuthSystem.jsx:
  ├── localStorage.setItem("auth_token", data.token)   ← JWT stored for all future calls
  └── onSuccess(data.user) → App.jsx updates auth profile
  ↓
window.dispatchEvent(new CustomEvent("datalytics:login-success"))
App.jsx → handleLoginSuccess() → setShowWelcome(true) → auto-hides after 5s
\`\`\`

**[THEORY]** The custom DOM event (datalytics:login-success) enables **cross-component communication without prop drilling**. AuthSystem.jsx is deeply nested inside App.jsx. Instead of threading callbacks through multiple prop layers, a custom event on window acts as a **message bus** — any component can listen for it. This is the classic Observer/Pub-Sub pattern adapted for React's component model.

---

## PHASE 3 — App Shell Loads

\`\`\`
Browser navigates to /app
  ↓
client/src/main.jsx
  └── ReactDOM.createRoot(document.getElementById("root")).render(
        <BrowserRouter>
          <Routes>
            <Route path="/app/*" element={<App />} />
          </Routes>
        </BrowserRouter>
      )
\`\`\`

**[THEORY]** ReactDOM.createRoot is React 18's **concurrent rendering API**. Unlike the older ReactDOM.render, concurrent mode allows React to pause and resume rendering work. This enables Suspense (for lazy-loaded components) and useTransition (for non-urgent state updates). createRoot tells React: "this DOM node is the root of a React tree — take full control of it." BrowserRouter enables client-side routing via the HTML5 History API — navigation happens without full page reloads.

\`\`\`
  ↓
client/src/App.jsx   ← AppShell — The Master State Machine
  ├── const [step, setStep] = useState("upload")          ← default starting view
  ├── const [completedSteps, setCompletedSteps] = useState({ upload: false, ... })
  ├── const [predictionState, setPredictionState] = useState(DEFAULT_PREDICTION_STATE)
  ├── const { dataset, setDataset } = useDataset()
  └── const { deductDiamonds } = useDiamonds()
\`\`\`

**[THEORY]** App.jsx is the **central state machine** of the SPA. All critical application state lives here: which step is active, which are complete, dataset loaded, prediction progress, dashboard config. Child components are "dumb" — they receive data and callbacks as props and render accordingly. This is React's **"lifting state up"** pattern. The advantage: entire application state is in one place, making debugging and reasoning much easier. No global state library (Redux, Zustand) is needed because the state tree is manageable at the App level.

\`\`\`
  ↓
useDataset() hook initializes:
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("datalytics_dataset"))
    if (stored?.rows?.length) setDataset(stored)   ← Restores previous session
  }, [])   ← empty array means run exactly once after first render
\`\`\`

**[THEORY]** useEffect with empty dependency array [] is React's way to run **initialization side effects** after the component mounts — equivalent to componentDidMount in class components. Reading localStorage in useEffect (not during render) is important — localStorage is synchronous and blocking, which would slow first paint if called inline. Deferring to useEffect lets React render the initial UI immediately, then update it with persisted data. Keeps first paint fast.

\`\`\`
  ↓
App.jsx renders the shell layout:
  ├── Sidebar onStepChange={handleStepChange}     ← Left navigation
  ├── Navbar diamonds={balance} profile={profile} ← Top bar
  └── div.ds-content:
        step === "upload"        → UploadStep
        step === "preparation"   → DataPreparationStep
        step === "prediction"    → Suspense > TrainStep      (code-split, lazy)
        step === "visualization" → Suspense > VisualizationStep
        ... etc.
\`\`\`

**[THEORY]** Heavy components (VisualizationStep, PowerBIDashboardStep, ChatBot) are wrapped in React.lazy() + Suspense. Their JavaScript bundles are **code-split** — downloaded only when the user navigates to that step. The initial bundle is smaller, making first load faster. Suspense fallback shows a spinner while the chunk downloads. This is Next.js/React's **dynamic import** pattern for performance optimization.

---

## PHASE 4 — Dataset Upload

\`\`\`
User drags "sales_data.csv" onto the upload dropzone in UploadStep
  ↓
client/src/components/UploadStep.jsx → onDrop event handler fires
  └── handleFileSelect(file)   ← File object from browser Drag and Drop API
\`\`\`

**[THEORY]** The browser's Drag and Drop API gives JavaScript access to files dragged from the OS file manager. The File object holds name, size, type, and a reference to data in memory — but the data has NOT been read yet. Reading happens lazily when you call file.slice() or file.arrayBuffer(). For a 500MB file, JavaScript does not load 500MB into memory just by receiving the drop event. This is the browser's efficient lazy file model.

\`\`\`
  ↓
client/src/api/upload.js → uploadDataset(file, { onProgress })
  ├── CHUNK_UPLOAD_THRESHOLD = 12 * 1024 * 1024   ← 12MB threshold
  ├── file.size >= 12MB  →  uploadInChunks(file)
  └── file.size < 12MB   →  uploadDirect(file):
        const formData = new FormData()
        formData.append("file", file)
        client.post("/upload", formData, {
          onUploadProgress: (event) => {
            onProgress(Math.round((event.loaded / event.total) * 100))
          }
        })
\`\`\`

**[THEORY]** The 12MB threshold is a practical engineering decision. HTTP servers have a default max body size limit. For files under 12MB, a single POST is simpler and faster. For larger files, **chunking** gives three advantages: (1) Granular progress per chunk, (2) Failed chunks can be retried without re-uploading everything, (3) Server memory usage stays low — each 5MB chunk is written to disk before the next arrives. FormData is the browser's MIME multipart encoder, wrapping file bytes with metadata (filename, type) in the format HTTP servers expect for file uploads.

\`\`\`
  ↓
client/src/api/client.js   ← Axios REQUEST interceptor fires before send
  ├── config.headers["X-Session-ID"] = getSessionId()
  │     ← reads from localStorage("ml_dashboard_session_id")
  │     ← if absent: crypto.randomUUID() → save → use
  └── config.headers["Authorization"] = "Bearer " + localStorage.getItem("auth_token")
\`\`\`

**[THEORY]** Axios **interceptors** are middleware for HTTP calls. Defined once in client.js, they run on EVERY request across the entire application — upload, chat, train, predict — automatically adding the session ID and auth token. Without interceptors, every API call would manually build headers: error-prone and violates DRY (Don't Repeat Yourself). The session ID (X-Session-ID) is the server's key to find this user's DataFrame in RAM.

\`\`\`
  ↓
HTTP POST /api/upload → FastAPI server
  ↓
app/main.py → session_middleware
  └── X-Session-ID: "abc123-uuid" read and stored in request.scope
  ↓
server/app/api/v1/routes/upload.py → upload_dataset()
  ├── ext = os.path.splitext(filename)[1].lower()
  ├── if ext not in {".csv", ".xlsx", ".xls", ".json"}:
  │     raise HTTPException(400, "Only CSV, Excel, or JSON files supported.")
  ├── target_path = .cache/datasets/session_id/sales_data.csv
  └── await stream_upload_to_path(file, target_path)
        ← Reads UploadFile in 5MB chunks, writes each chunk to disk immediately
\`\`\`

**[THEORY]** Files are **streamed to disk** rather than fully buffered in memory. For a 500MB file, peak memory usage is ~5MB (one chunk in flight), not 500MB. This is the same pattern used by all production file upload systems. Without streaming, a 500MB upload would crash the server process with an out-of-memory error.

\`\`\`
  ↓
_handle_uploaded_file(session_id, filename, target_path, file_size)
  ├── session = store.get(x_session_id)   ← O(1) Python dict lookup, microseconds
  ├── _reset_session_state(session)
  │     ← Clears: df_processed, X_train, X_test, trained_models, best_model, etc.
  └── prepare_uploaded_dataset(session, ...) → app/services/dataset_service.py
        ├── pd.read_csv(path) or pd.read_excel() or pd.read_json()
        ├── optimize_memory(df)           ← int64→int32, float64→float32 (~40% RAM saving)
        ├── build_dataset_snapshot(df)    ← rows, cols, sample_rows, column_info
        ├── session.df = df               ← Full DataFrame stored in server RAM
        └── session.df_original = df.copy()  ← Backup for "reset to original" feature
\`\`\`

**[THEORY]** _reset_session_state is called before every new upload — a **data integrity invariant**. If a user uploads a new dataset while an old model is in memory, that model was trained on DIFFERENT data and would give meaningless predictions. Resetting forces a clean pipeline. df_original is a safety-net copy: if the user applies EDA transformations and wants to undo all changes, the original is still in session memory. optimize_memory uses Pandas dtype downcasting: an int64 column holding values 0-255 only needs int8 (8 bits instead of 64). This can reduce a 1GB dataset to ~600MB.

\`\`\`
  ↓
await _persist_snapshot_to_db(session_id, filename, snapshot)
  └── db["datasets"].replace_one({ session_id }, doc, upsert=True)   ← MongoDB upsert
  ↓
JSONResponse(snapshot)  ← { name, rows, cols, all_columns, sample_rows, storage_mode }
  ↓
Axios RESPONSE interceptor:
  └── localStorage.setItem("ml_dashboard_session_id", response.headers["x-session-id"])
  ↓
App.jsx → setDataset(normalizeDataset(snapshot))
  └── useDataset.updateDataset():
        setDataset(nextDataset)     ← React state → schedules re-render
        localStorage.setItem(...)  ← Persists for page-refresh survival
  setCompletedSteps({ ...prev, upload: true })
  ↓
React reconciles: sidebar shows upload done checkmark, data preview table renders
\`\`\`

**[THEORY]** MongoDB replace_one with upsert=True means "replace if exists, insert if new." For datasets, always exactly one record per session — uploading a second file replaces the first cleanly. The snapshot saved to MongoDB is NOT the full DataFrame (stays in RAM) — only metadata + 2000 sample rows for display. This is **read-write separation**: display uses MongoDB, ML computation uses the in-RAM DataFrame. React setState is **asynchronous and batched** — multiple setState calls close together become ONE re-render pass. The Virtual DOM diff then computes the minimal set of DOM changes needed.

---

## PHASE 5 — Data Preparation and EDA

\`\`\`
User clicks "Data Preparation" in Sidebar
  ↓
Sidebar.jsx → onStepChange("preparation") prop
  ↓
App.jsx → handleStepChange("preparation") → setStep("preparation")
  ↓
DataPreparationStep.jsx mounts
  └── useEffect([], fetchEDA):
        client.get("/api/eda/summary")   ← Fetch statistics from backend
        client.get("/api/dataset/json")  ← Fetch data for table display
\`\`\`

**[THEORY]** Data is fetched in useEffect (not during render) because React's render phase must be **pure** — no side effects. The render function computes what to display based on current state only. Side effects (API calls, DOM mutations) belong in useEffect. With [] dependency array, the fetch happens exactly once on mount — preventing the "fetch on every render" antipattern that would hammer the server.

\`\`\`
  ↓
server/app/api/v1/routes/eda.py → @router.get("/eda/summary")
  ├── session = store.get(x_session_id)
  ├── if session.df is None: raise HTTPException(404, "No dataset uploaded")
  └── return build_eda_summary(session.df)
        → eda_service.py:
            df.describe()         ← count, mean, std, min, max, quartiles per column
            df.isnull().sum()     ← missing value count per column
            df.dtypes             ← column data types
            df.corr()             ← Pearson correlation matrix (numeric columns)
            → Returns JSON-serializable dict
\`\`\`

**[THEORY]** All heavy statistical computation happens on the **backend**. Pandas df.corr() for a 50-column DataFrame computes 2500 correlation values — linear algebra that Python + NumPy handle in milliseconds using optimized BLAS routines. Doing this in JavaScript would require a full numerical library and be 10-100x slower. The frontend receives pre-computed numbers and just renders them. This is the right architecture: **backend for computation, frontend for display.**

\`\`\`
  ↓
User clicks "Drop Missing Rows"
  └── POST /api/eda/action { action: "drop_na", options: {} }
        → eda.py → apply_eda_action(session.df, "drop_na", {})
              session.df = df.dropna()   ← DataFrame updated in session
              _reset_downstream_state(session)  ← CRITICAL: clears ML state
        Returns { dataset: updated_snapshot, summary: new_stats }
\`\`\`

**[THEORY]** _reset_downstream_state is called after EVERY data modification. Imagine: user trains a model on 1500-row data, then drops 200 rows with missing values. The trained model's decision boundaries were computed from the OLD 1500-row dataset. Predictions on the new 1300-row data would be incorrect — the model's internal statistics do not match the current data. Resetting downstream state is a **correctness invariant** enforced at the architectural level, not left to the user to remember.

---

## PHASE 6 — Preprocessing

\`\`\`
User selects:
  target_col = "SalePrice"  |  task_type = "Regression"
  missing_strategy = "mean"  |  scaling_method = "standard"  |  test_size = 0.2
clicks "Run Preprocessing"
  ↓
POST /api/preprocess { target_col, task_type, missing_strategy, scaling_method, test_size }
  ↓
preprocess.py → ml_service.preprocess()
  ├── Fill missing numeric values: df[col].fillna(df[col].mean())
  ├── Encode categoricals: LabelEncoder().fit_transform(df[col])
  │     "CollgCr"→0, "Somerst"→1, "Veenker"→2, etc.
  ├── X = df[feature_columns], y = df["SalePrice"]
  ├── X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
  ├── scaler = StandardScaler()
  │   X_train_scaled = scaler.fit_transform(X_train)  ← fit on TRAIN ONLY
  │   X_test_scaled  = scaler.transform(X_test)        ← transform (no re-fit)
  └── Returns: X_train_scaled, X_test_scaled, y_train, y_test, scaler, label_encoders
\`\`\`

**[THEORY — THE MOST CRITICAL ML CONCEPT: DATA LEAKAGE]**

The scaler is **fit on training data only**, then applied to both train and test sets. If you fit the scaler on ALL data (train + test), the scaler's mean and standard deviation are computed from test data too. This means the model indirectly "sees" test data statistics before being evaluated — called **data leakage**. It artificially inflates performance metrics because the model is tuned to data it will be tested on. Real-world performance will be much worse than the optimistic evaluation scores suggest.

In production, the SAME scaler object is applied to any new incoming prediction data. This is exactly why the scaler is stored in the session — so prediction time applies the IDENTICAL transformation as training time.

\`\`\`
  ↓
session.X_train = X_train_scaled    ← NumPy arrays in server RAM
session.X_test  = X_test_scaled
session.scaler  = scaler            ← StandardScaler (stores fitted mean + std)
session.label_encoders = { "Neighborhood": LabelEncoder(...), ... }
session.preprocessing_done = True
  ↓
Returns { train_size: 1200, test_size: 300, feature_columns: [...] }
setPredictionStatus({ ...prev, preprocessing_done: true })
\`\`\`

---

## PHASE 7 — Model Training

\`\`\`
User clicks "Train All Models"
  ↓
TrainStep.jsx → client.post("/api/train")
  ↓
train.py → @router.post("/train") → _train_models()
  ├── if not session.preprocessing_done:
  │     raise HTTPException(400, "Please run preprocessing first")
  └── ml_service.train_supervised(X_train, y_train, X_test, y_test, "Regression")
\`\`\`

**[THEORY]** The guard checks enforce the **workflow dependency graph**. You cannot train without preprocessing; you cannot predict without training. The boolean flags in session store enforce these as architectural invariants. Without guards, calling /predict directly via the API would produce a confusing NoneType Python traceback. Guards give clear, actionable 400 error messages instead.

\`\`\`
  ↓
ml_service.train_supervised():
  For each algorithm in model_list (8 total for regression):

  RandomForestRegressor(n_estimators=100, n_jobs=-1)
    ├── estimator.fit(X_train, y_train)
    │     ← Builds 100 decision trees in PARALLEL across all CPU cores
    ├── cv_scores = cross_val_score(estimator, X_train, cv=5, scoring="r2")
    │     ← 5 different train/validate splits → 5 scores → averaged
    ├── y_pred = estimator.predict(X_test)
    └── metrics = { r2: 0.94, mae: 1200.5, rmse: 2100.0 }

  Sort all 8 models by R2 score (regression) or Accuracy (classification)
  best_model = model with highest score
\`\`\`

**[THEORY]** **Random Forest** builds many decision trees on RANDOM SUBSETS of data (bagging) and random subsets of features. Each tree is an independent learner. Final prediction = AVERAGE of all trees (regression) or VOTE (classification). This reduces overfitting dramatically: one tree can memorize training data, but 100 trees on different random subsets collectively generalize better. This is the wisdom of crowds applied to machine learning.

**Cross-validation (cv=5)** provides a more reliable performance estimate than a single train/test split. CV does 5 different splits and averages the scores. This answers: "How well would this model perform on completely unseen data?" A single split can be lucky or unlucky depending on which samples ended up in test — CV removes that randomness.

**n_jobs=-1** uses all available CPU cores. Python GIL prevents multi-threading for CPU-bound tasks, but scikit-learn uses multiprocessing (separate processes, no GIL), enabling true parallel tree building. Training 8 models with 8 cores takes nearly the same time as training 1.

\`\`\`
  ↓
session.best_model = RandomForestRegressor(...)  ← sklearn object in server RAM
session.trained_models = { "Random Forest": obj, "XGBoost": obj, ... }
session.supervised_done = True
  ↓
Returns {
  results: [model leaderboard table],
  best_model_name: "Random Forest",
  best_metrics: { R2: 0.94, MAE: 1200, RMSE: 2100 },
  models_considered: 8
}
TrainStep.jsx renders model comparison table with metric columns
\`\`\`

**[THEORY]** The trained model object lives in **server RAM** attached to the session. This is fast (no deserialization overhead for prediction) but volatile (lost on server restart). Production ML systems serialize models to disk (pickle) or a model registry (MLflow) for persistence and versioning. This app uses RAM for speed and simplicity — acceptable for an analytics platform where datasets are re-uploaded per session anyway.

---

## PHASE 8 — Prediction

\`\`\`
User fills feature form:
  LotArea: "8000"  |  Neighborhood: "CollgCr"  |  GrLivArea: "1500"  |  ...
clicks "Predict Sale Price"
  ↓
PredictStep.jsx → client.post("/api/predict", {
  feature_values: { LotArea: 8000, Neighborhood: "CollgCr", GrLivArea: 1500, ... }
})
  ↓
predict.py → make_prediction()
  ├── model = session.best_model    ← Retrieved from RAM in microseconds
  └── ml_service.predict(model, feature_values, feature_columns, scaler, label_encoders)
        ├── label_encoders["Neighborhood"].transform(["CollgCr"]) → [3]
        │     ← SAME encoder that was fitted during preprocessing
        ├── Build X_input = [[8000, 3, 1500, ...]]  ← column ORDER must match training
        ├── X_scaled = scaler.transform(X_input)
        │     ← SAME StandardScaler, SAME fitted mean/std from training time
        └── prediction = model.predict(X_scaled)[0] → 225000.0
\`\`\`

**[THEORY]** The prediction pipeline must **mirror preprocessing exactly**. When training, "CollgCr" was encoded as integer 3 by the LabelEncoder. At prediction time, the SAME LabelEncoder must convert "CollgCr" → 3. If a fresh encoder were fitted on just the input, "CollgCr" might get encoded as 0 (it is the only value seen), giving the model a completely different feature value. The predictions would be mathematically meaningless.

**Column order** also matters critically: Random Forest and tree-based models learn feature splits based on column INDEX, not column name. Wrong column order = wrong features in wrong positions = garbage predictions. The feature_columns list stored in the session ensures the exact same ordering is used at prediction time as at training time.

\`\`\`
  ↓
session.prediction_history.append({ LotArea: 8000, Prediction: 225000.0, timestamp })
return { prediction: "225000.0", model_used: "Random Forest", task_type: "Regression" }
  ↓
PredictStep.jsx:
  "Predicted Sale Price: $225,000"
  "Model: Random Forest  |  Task: Regression"
setCompletedSteps({ ...prev, prediction: true })
\`\`\`

---

## PHASE 9 — AI Chatbot

\`\`\`
User opens ChatBot → types: "Which neighborhood has the highest average sale price?"
  ↓
ChatBot.jsx → handleSend()
  ├── setMessages([...messages, { role: "user", content: message }])
  │     ← OPTIMISTIC UPDATE: user message appears IMMEDIATELY in UI
  └── sendChatMessage(message, "chat")
        → chat.js → client.post("/api/chat", { message, mode: "chat" }, { timeout: 60000 })
\`\`\`

**[THEORY]** **Optimistic update**: The user message appears in the UI immediately, before the API call completes. This makes the app feel instantly responsive. The typing indicator shows while waiting for the LLM. Without this, the user sees nothing for 2-5 seconds (LLM latency), making them think their message was not sent. Optimistic UI is standard in all modern chat applications.

\`\`\`
  ↓
server/app/api/v1/routes/chatbot.py → @router.post("/chat")
  ├── session = store.get(session_id)
  ├── df_rows = session.df.head(48).to_dict("records")
  │     ← ACTUAL data rows — real sale prices, real neighborhoods, real values
  ├── chat_history = await get_chat_history(session_id, limit=20)
  │     → db["chats"].find({ session_id }, sort=[("_id", -1)], limit=20)
  ├── Build prompt messages:
  │     [
  │       { role: "system", content: "You are a data analyst for Datalytics..." },
  │       { role: "user",   content: "Dataset: 1500 rows, 15 cols. Data: [...48 rows...]" },
  │       ...last 20 chat history messages...,
  │       { role: "user",   content: "Which neighborhood has highest avg sale price?" }
  │     ]
  └── openai.chat.completions.create(
          model = "gpt-5.4",
          messages = prompt_messages,
          max_tokens = 2500,
          temperature = 0.3    ← Low = factual, consistent answers
      )
\`\`\`

**[THEORY]** **Sending actual CSV rows to the LLM** is the most important chatbot design decision. If you only send column metadata ("this dataset has SalePrice, Neighborhood, LotArea"), the LLM can only give generic answers. When you send 48 actual rows like [{SalePrice: 208500, Neighborhood: "CollgCr"}, {SalePrice: 181500, Neighborhood: "Veenker"}...], the LLM can reason: "Let me look at all CollgCr rows and average their SalePrice." This produces specific, accurate, data-grounded answers — the core value of the chatbot.

**Conversation history from MongoDB**: The last 20 messages are included in the prompt, giving the LLM **conversation memory**. Without history, every message is answered in isolation. With history, the model answers follow-up questions ("What about that neighborhood you mentioned?") because the previous exchange is in its context window. Messages are stored in MongoDB (not RAM) so history survives server restarts.

**Temperature 0.3** controls randomness. Temperature=0 = deterministic. Temperature=1 = creative/random. Temperature=0.3 gives factual, consistent answers — appropriate for a data analyst chatbot where accuracy matters more than creativity.

\`\`\`
  ↓
LLM returns: "Based on the data, Stone Brook has the highest avg sale price at $320,000..."
  ↓
await save_chat_message(session_id, "user", message)
await save_chat_message(session_id, "assistant", reply)
  → db["chats"].insert_one(...)   ← Persisted for future conversation memory
return { reply, mode: "chat", model: "gpt-5.4" }
  ↓
ChatBot.jsx → setMessages([...messages, { role: "assistant", content: reply }])
New chat bubble animates in (Framer Motion), markdown renders (bold, code, lists)
\`\`\`

---

## PHASE 10 — Report and Download

\`\`\`
User navigates to "Reports" step → ReportStep.jsx mounts
  ↓
client.get("/api/report/generate")
  ↓
server/app/api/v1/routes/reports.py → generate_report()
  ├── get_data_quality_score(df)
  │     → recommendation_service.py
  │     Scores: completeness (% non-null), uniqueness (% distinct values),
  │             validity (% values in expected range), consistency
  │     Grade: A (90+), B (75+), C (60+), D (45+), F (below 45)
  ├── get_statistical_insights(df)
  │     → Correlation matrix, outlier detection (IQR method), distribution skewness
  ├── _generate_executive_summary(df, quality_score, task_type, best_model_name)
  │     "This dataset contains 1,500 records across 15 features.
  │      Best model: Random Forest with R2 = 0.94..."
  └── return full JSON report object
\`\`\`

**[THEORY]** The report uses **template-based text generation** (string formatting with real values), not LLM generation. This is deliberate: templates are deterministic, fast, and free (no API cost). LLM generation is used for open-ended analysis (chatbot, AI insights) but NOT for structured reports where consistent format is required. The data quality score gives users a quantified measure of their data's reliability before trusting model outputs.

\`\`\`
  ↓
ReportStep.jsx renders all sections with charts and tables
  ↓
User clicks "Download PDF"
  └── jsPDF.html(reportElement, { callback: (doc) => doc.save("report.pdf") })
        ← Client-side PDF generation from the rendered HTML element
        ← Browser shows native Save As dialog
\`\`\`

**[THEORY]** PDF generation is **entirely client-side** (jsPDF). It renders the HTML/CSS of the report element into a PDF canvas, embedding fonts and images. This avoids a server round-trip and reduces backend load. Server-side PDF (WeasyPrint, Puppeteer) would require a headless browser on the server — significant infrastructure complexity. For reports already rendered in the browser, client-side PDF is the pragmatic choice.

---

## PHASE 11 — Complete Request to Response Lifecycle

\`\`\`
STEP 1 — USER INTERACTION
  User clicks button / drops file / submits form / types message
  [WHY] Browser DOM events trigger JavaScript callbacks synchronously.
        Every data flow in the application starts from a user action.

  ↓

STEP 2 — EVENT HANDLER IN COMPONENT
  handleClick() / handleDrop() / handleSubmit() / handleSend()
  (in UploadStep.jsx, TrainStep.jsx, ChatBot.jsx, PredictStep.jsx, etc.)
  [WHY] Components react to events and orchestrate the next action.
        Components do NOT make HTTP calls directly — they delegate to API services.
        This separation keeps components testable and reusable in isolation.

  ↓

STEP 3 — API SERVICE FUNCTION
  api/upload.js → uploadDataset(file)
  api/chat.js   → sendChatMessage(message, mode)
  api/client.js → client.post("/api/train")
  [WHY] HTTP logic is isolated from UI logic (separation of concerns).
        If an endpoint URL changes, only the service file needs updating.

  ↓

STEP 4 — AXIOS REQUEST INTERCEPTOR (api/client.js)
  config.headers["X-Session-ID"] = getSessionId()   ← UUID from localStorage
  config.headers["Authorization"] = "Bearer " + jwt  ← JWT from localStorage
  [WHY] Interceptors run on EVERY request automatically.
        No component needs to manually add auth headers.
        Session ID links this request to the correct pandas DataFrame in RAM.

  ↓

STEP 5 — HTTP REQUEST SENT
  Method: POST / GET / DELETE
  URL:    /api/endpoint
  Body:   JSON or FormData (file upload)
  [WHY] HTTP is the universal protocol. JSON is the universal data format.
        REST APIs are language-agnostic — JavaScript frontend and Python backend
        are completely independent, each implemented in their best-suited language.

  ↓

STEP 6 — NEXT.JS PROXY (next.config.mjs rewrites)
  /api/* → http://127.0.0.1:8000/api/*
  [WHY] Solves CORS completely — the browser sees only one origin (port 5000).
        Backend URL configurable via NEXT_PUBLIC_API_URL env var without code changes.
        Standard production architecture: Next.js handles routing + proxying to API.

  ↓

STEP 7 — FASTAPI RECEIVES THE REQUEST (server/app/main.py)
  ASGI layer hands request to session_middleware FIRST
  [WHY] Middleware wraps the entire request/response cycle.
        It runs BEFORE the route handler and can inspect or modify anything.
        This is where cross-cutting concerns (session, logging, auth) belong.

  ↓

STEP 8 — SESSION MIDDLEWARE (app/main.py)
  Reads X-Session-ID from headers or generates new UUID
  Injects into request.scope for downstream access
  [WHY] Every browser tab gets a unique UUID identity.
        This UUID is the key to the in-memory SessionData store (Python dict).
        Without it, the server cannot know which DataFrame belongs to this user.

  ↓

STEP 9 — ROUTE HANDLER (app/api/v1/routes/*.py)
  x_session_id: str = Header(..., alias="X-Session-ID")
  Pydantic validates request body shape and types automatically
  [WHY] Route handlers are THIN CONTROLLERS — validate input, get session,
        call service, return response. All heavy computation is in services/.

  ↓

STEP 10 — SESSION STORE LOOKUP (app/state/session_store.py)
  session = store.get(x_session_id)  → SessionData object
  [WHY] O(1) Python dict lookup — microsecond access to:
          Full pandas DataFrame (all training rows in memory)
          Fitted sklearn model object (ready for predict() call)
          Label encoders + scaler (identical to training-time transforms)
        No database round-trip needed for ML operations — instant access.

  ↓

STEP 11 — SERVICE LAYER (app/services/*.py)
  ml_service.preprocess() / train_supervised() / predict()
  eda_service.build_eda_summary() / create_eda_chart()
  llm_service.openai_chat() / groq_chat()
  [WHY] Services contain the real business logic, independent of HTTP.
        No Request or Response objects here — pure Python functions.
        Testable in isolation — callable directly with a DataFrame.
        Heavy computation happens here: Pandas, NumPy, sklearn, Plotly, LLM calls.

  ↓

STEP 12 — DATABASE OPERATIONS if needed (app/core/database.py)
  await db["users"].find_one({ "email": email })
  await db["chats"].insert_one({ session_id, role, content, timestamp })
  [WHY] MongoDB stores PERSISTENT data: user accounts, chat history, payments.
        Motor uses asyncio — while waiting for MongoDB over the network, the
        event loop handles OTHER requests concurrently.
        The server does NOT block or waste CPU while waiting for I/O.
        This is the fundamental advantage of async programming for I/O-bound workloads.

  ↓

STEP 13 — RESULT RETURNED TO ROUTE HANDLER
  { model_results, best_model_name, metrics, chart: plotly_json, ... }
  [WHY] Service returns a plain Python dict. Route handler wraps it in JSONResponse.
        sanitize_for_json() converts NumPy types to native Python types —
        json.dumps() cannot serialize NumPy scalars directly.

  ↓

STEP 14 — JSON RESPONSE FROM FASTAPI
  HTTP 200 OK
  Content-Type: application/json
  X-Session-ID: uuid   ← session middleware adds this to EVERY response
  Body: { ...result_dict... }
  [WHY] FastAPI + Pydantic serialize to JSON automatically.
        JSON is the universal wire format between frontend and backend.
        X-Session-ID in response header lets client persist the UUID to localStorage.

  ↓

STEP 15 — AXIOS RESPONSE INTERCEPTOR (api/client.js)
  const sid = response.headers["x-session-id"]
  localStorage.setItem("ml_dashboard_session_id", sid)
  [WHY] Server may assign a new session ID if client did not send one.
        Persisting it ensures the SAME session is used for ALL subsequent requests
        — so the DataFrame and trained model stay linked to this browser session.

  ↓

STEP 16 — API SERVICE RETURNS PARSED DATA
  return response.data   ← Already a JS object (Axios auto-parses JSON)
  [WHY] Axios automatically parses JSON responses into JavaScript objects.
        No manual JSON.parse() needed anywhere. response.data IS the result.

  ↓

STEP 17 — REACT STATE UPDATE IN COMPONENT
  setPredictionState({ ...prev, bestModel: result.best_model_name })
  setCompletedSteps({ ...prev, prediction: true })
  [WHY] setState calls are BATCHED by React 18 automatic batching.
        Multiple setState calls in one event handler = ONE re-render pass.
        React schedules the re-render asynchronously for performance.

  ↓

STEP 18 — REACT RECONCILIATION (Virtual DOM Diff Algorithm)
  React computes: what changed between previous VDOM and new VDOM?
  [WHY] React NEVER re-renders the entire page.
        The diff algorithm compares old and new virtual DOM trees and generates
        the MINIMAL set of actual DOM mutations needed.
        A leaderboard table with 8 rows might only need 3 cell text updates.
        This makes React apps feel fast even with large, complex UIs.

  ↓

STEP 19 — BROWSER PAINTS UPDATED PIXELS
  New model metrics appear / prediction result shows / chart renders
  [WHY] Browser rendering pipeline: Style → Layout → Paint → Composite.
        React batches DOM mutations to minimize layout thrashing.
        React schedules all writes together to keep UI smooth at 60fps.

  ↓

STEP 20 — USER SEES THE FINAL RESULT
  "Best Model: Random Forest  |  R2 = 0.94  |  MAE = 1,200"
  "Stone Brook has the highest average sale price at $320,000"
  "Data Quality Score: B (78 out of 100) — 2 columns need attention"
\`\`\`

---

## Quick Reference — Feature to File Mapping

| Feature | Frontend File | API Call | Backend Route | Service |
|---|---|---|---|---|
| Landing page | \`app/page.jsx\` | — | — | — |
| App shell routing | \`src/App.jsx\` | — | — | — |
| Login / Signup / OTP | \`src/auth/AuthSystem.jsx\` | native fetch | \`routes/auth.py\` | bcrypt + JWT |
| Google OAuth | \`src/auth/AuthContext.jsx\` + \`firebase.js\` | — | \`routes/auth.py\` | google-auth |
| File upload | \`src/components/UploadStep.jsx\` | \`api/upload.js\` | \`routes/upload.py\` | \`dataset_service.py\` |
| DB connection | \`src/components/ConnectionModal.jsx\` | \`api/upload.js\` | \`routes/upload.py\` | SQLAlchemy |
| EDA summary | \`src/components/DataPreparationStep.jsx\` | \`api/eda.js\` | \`routes/eda.py\` | \`eda_service.py\` |
| EDA charts | \`src/components/ExploreStep.jsx\` | \`api/eda.js\` | \`routes/eda.py\` | \`eda_service.py\` |
| Preprocessing | \`src/components/DataPreparationStep.jsx\` | \`api/client.js\` | \`routes/preprocess.py\` | \`ml_service.py\` |
| Train ML | \`src/components/TrainStep.jsx\` | \`api/client.js\` | \`routes/train.py\` | \`ml_service.py\` |
| Clustering | \`src/components/UnsupervisedStep.jsx\` | \`api/client.js\` | \`routes/train.py\` | \`ml_service.py\` |
| Predict | \`src/components/PredictStep.jsx\` | \`api/client.js\` | \`routes/predict.py\` | \`ml_service.py\` |
| Chatbot | \`src/components/ChatBot.jsx\` | \`api/chat.js\` | \`routes/chatbot.py\` | \`llm_service.py\` |
| AI Insights | \`src/components/AIInsightsStep.jsx\` | \`api/insights.js\` | \`routes/chatbot.py\` | \`insight_generation_service.py\` |
| Recommendations | \`src/components/RecommendationStep.jsx\` | \`api/client.js\` | \`routes/recommendations.py\` | \`recommendation_service.py\` |
| BI Dashboard | \`src/components/PowerBIDashboardStep.jsx\` | \`api/dashboard.js\` | \`routes/data.py\` | \`dashboard_service.py\` |
| Reports | \`src/components/ReportStep.jsx\` | \`api/client.js\` | \`routes/reports.py\` | \`recommendation_service.py\` |
| Payment | \`src/hooks/useDiamonds.js\` | \`api/client.js\` | \`routes/payment.py\` | Razorpay SDK |
| Activity log | \`src/App.jsx logActivity()\` | \`api/client.js\` | \`routes/activity.py\` | \`activity_service.py\` |
| Admin panel | \`src/admin/AdminPanel.jsx\` | \`api/client.js\` | \`routes/admin.py\` | MongoDB queries |
| Download model | \`src/components/DownloadStep.jsx\` | \`api/client.js\` | \`routes/predict.py\` | pickle.dumps() |
| Session tracking | — | \`api/client.js\` X-Session-ID | \`app/main.py\` middleware | \`state/session_store.py\` |
| Database | — | — | all routes | \`core/database.py\` Motor + MongoDB |
`;

fs.writeFileSync(p, doc, 'utf8');
const stat = fs.statSync(p);
console.log('SUCCESS: workflow.md written!');
console.log('Lines:', doc.split('\n').length);
console.log('Size:', stat.size, 'bytes =', (stat.size/1024).toFixed(1), 'KB');
