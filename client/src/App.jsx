'use client'

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './components/Sidebar.jsx'
import Navbar from './components/Navbar.jsx'
import DashboardCard from './components/DashboardCard.jsx'
import GlowButton from './components/ui/GlowButton.jsx'
import GlowTable from './components/ui/GlowTable.jsx'
import GlassModal from './components/ui/GlassModal.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import GlobalRuntimeGuard from './components/GlobalRuntimeGuard.jsx'
import UploadStep from './components/UploadStep.jsx'
import DataPreparationStep from './components/DataPreparationStep.jsx'
import OnClickPred from './components/onclickpred.jsx'
import TrainStep from './components/TrainStep.jsx'
import UnsupervisedStep from './components/UnsupervisedStep.jsx'
import BestModelStep from './components/BestModelStep.jsx'
import PredictStep from './components/PredictStep.jsx'
import DownloadStep from './components/DownloadStep.jsx'
import AuthSystem from './auth/AuthSystem.jsx'
import { useDataset } from './hooks/useDataset.js'
import { ToastProvider } from './hooks/useToast.js'
import { useDiamonds } from './hooks/useDiamonds.js'
import client from './api/client.js'
import {
  HiOutlineArrowTrendingUp,
  HiOutlineBolt,
  HiOutlineChartBarSquare,
  HiOutlineChartPie,
  HiOutlineCheckBadge,
  HiOutlineClipboardDocumentList,
  HiOutlineCircleStack,
  HiOutlineClock,
  HiOutlineFire,
  HiOutlineSquares2X2,
  HiOutlineTableCells,
  HiOutlineUsers,
} from 'react-icons/hi2'
import CoinAnimation from './components/ui/CoinAnimation';

const ExploreStep = lazy(() => import('./components/ExploreStep.jsx'))
const VisualizationStep = lazy(() => import('./components/VisualizationStep.jsx'))
const PowerBIDashboardStep = lazy(() => import('./components/PowerBIDashboardStep.jsx'))
const RecommendationStep = lazy(() => import('./components/RecommendationStep.jsx'))
const ReportStep = lazy(() => import('./components/ReportStep.jsx'))
const AIInsightsStep = lazy(() => import('./components/AIInsightsStep.jsx'))
const DecisionMakingStep = lazy(() => import('./components/DecisionMakingStep.jsx'))
const UserProfileStep = lazy(() => import('./components/profile/UserProfileStep.jsx'))
const ChatBot = lazy(() => import('./components/ChatBot.jsx'))
const AdminPanel = lazy(() => import('./admin/AdminPanel.jsx'))

const DEFAULT_COMPLETED = {
  upload: false,
  preparation: false,
  exploration: false,
  visualization: false,
  prediction: false,
  powerbi: false,
  recommendations: false,
  decisionMaking: false,
  reports: false,
  aiInsights: false,
}

const DEFAULT_PREDICTION_STATE = {
  supervised: {
    linear: { status: 'idle', progress: 0, metrics: null },
    logistic: { status: 'idle', progress: 0, metrics: null },
    tree: { status: 'idle', progress: 0, metrics: null },
    forest: { status: 'idle', progress: 0, metrics: null },
  },
  unsupervised: {
    kmeans: { status: 'idle', progress: 0, metrics: null },
    pca: { status: 'idle', progress: 0, metrics: null },
  },
  bestModel: null,
  selectedModel: 'Random Forest',
  predictions: [],
  batchPredictions: [],
  inputs: {},
  downloadReady: false,
  completed: {
    supervised: false,
    unsupervised: false,
    best: false,
    predict: false,
    download: false,
  },
}

const DEFAULT_PREDICTION_STATUS = {
  preprocessing_done: false,
  supervised_done: false,
  unsupervised_done: false,
  best_done: false,
  predict_done: false,
  download_done: false,
  preprocess_data: null,
  has_predictions: false,
}

const DEFAULT_DASHBOARD_STATE = {
  themeMode: 'dark',
  interactionMode: 'cross-filter',
  selectedWidgetId: null,
  crossFilter: null,
  widgets: [],
}

function normalizeDataset(dataset) {
  if (!dataset) return null
  const rows = dataset.rows || dataset.sample_rows || dataset.preview || []
  const columns = dataset.columns || dataset.all_columns || (rows[0] ? Object.keys(rows[0]) : [])
  return {
    name: dataset.name || 'Dataset',
    rows,
    columns,
    meta: dataset.meta || dataset,
  }
}

function setDatasetSyncState(dataset, { backendManaged, needsBackendSync }) {
  if (!dataset) return dataset
  return {
    ...dataset,
    meta: {
      ...(dataset.meta || {}),
      backend_managed: backendManaged,
      needs_backend_sync: needsBackendSync,
    },
  }
}

function StepLoader({ label }) {
  return (
    <div className="card">
      <div className="section-title">Loading {label}</div>
      <p style={{ marginTop: '0.6rem', color: 'var(--text-secondary, #94a3b8)' }}>
        Preparing this workspace without changing your current layout.
      </p>
    </div>
  )
}

function getStepLabel(step) {
  const labels = {
    upload: 'Dataset Upload',
    preparation: 'Data Preparation',
    exploration: 'Data Exploration',
    visualization: 'Visualization',
    prediction: 'Prediction',
    powerbi: 'Auto Power BI Dashboard',
    recommendations: 'Recommendations & Insights',
    decisionMaking: 'Decision Making',
    reports: 'Reports',
    aiInsights: 'AI Insights',
    profile: 'Profile',
  }
  return labels[step] || 'Dashboard'
}

function AppShell() {
  const router = useRouter()
  const { dataset, profile: datasetProfile, setDataset, clearDataset } = useDataset()
  const [authProfile, setAuthProfile] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [profileAvatar, setProfileAvatar] = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeType, setWelcomeType] = useState('back')
  const welcomeShownRef = useRef(false)
  const { deductDiamonds, InsufficientDiamondsAlert } = useDiamonds()
  const profileVisitKeyRef = useRef(0)
  const [profileVisitKey, setProfileVisitKey] = useState(0)

  // Fire-and-forget activity logger — calls MongoDB via backend
  const logActivity = useCallback(async (action, category, details = '', metadata = {}) => {
    try {
      await client.post('/user-activities/log', { action, category, details, metadata })
    } catch (err) {
      // Silently ignore if user is not authenticated or backend is down
    }
  }, [])

  // Ref to deduplicate per-session activity logs (prevents double-counting on re-renders)
  const loggedActivitiesRef = useRef(new Set())
  const prevDatasetNameRef = useRef(null)
  const chargedStepsRef = useRef(new Set())
  
  const [step, setStep] = useState('upload')
  const [completedSteps, setCompletedSteps] = useState(DEFAULT_COMPLETED)
  const [predictionModule, setPredictionModule] = useState('preprocessing')
  const [predictionState, setPredictionState] = useState(DEFAULT_PREDICTION_STATE)
  const [predictionStatus, setPredictionStatus] = useState(DEFAULT_PREDICTION_STATUS)
  const [vizConfig, setVizConfig] = useState({
    chartType: 'Bar',
    x: '',
    y: '',
    filterColumn: '',
    filterValues: [],
  })
  const [savedCharts, setSavedCharts] = useState([])
  const [dashboardState, setDashboardState] = useState(DEFAULT_DASHBOARD_STATE)
  const [incomingWidgetRequest, setIncomingWidgetRequest] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHoverPeek, setSidebarHoverPeek] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [quickPanelOpen, setQuickPanelOpen] = useState(false)
  const sidebarCloseTimerRef = useRef(null)
  const sidebarHoverPeekRef = useRef(false)
  const sidebarPointerFrameRef = useRef(null)
  const immersiveSidebarAutoHide = (step === 'powerbi' || step === 'visualization') && !isMobile

  function clearSidebarCloseTimer() {
    if (sidebarCloseTimerRef.current) {
      window.clearTimeout(sidebarCloseTimerRef.current)
      sidebarCloseTimerRef.current = null
    }
  }

  function openSidebarHoverPeek() {
    clearSidebarCloseTimer()
    setSidebarHoverPeek((current) => {
      if (current) return current
      return true
    })
  }

  function scheduleSidebarHoverClose() {
    clearSidebarCloseTimer()
    sidebarCloseTimerRef.current = window.setTimeout(() => {
      setSidebarHoverPeek(false)
      sidebarCloseTimerRef.current = null
    }, 180)
  }

  useEffect(() => {
    function syncViewport() {
      const mobile = window.innerWidth <= 900
      setIsMobile(mobile)
      setSidebarCollapsed(mobile)
      setSidebarOpen(false)
    }
    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  const handleLoginSuccess = useCallback(() => {
    // FORCE reset and show
    const type = localStorage.getItem('datalytics_welcome_type') || 'back'
    setWelcomeType(type)
    
    // Immediate state change to ensure visibility
    setShowWelcome(true)
    localStorage.setItem('datalytics_welcome_shown', 'true')
    
    // Auto hide after delay
    setTimeout(() => {
      setShowWelcome(false)
    }, 5000)
  }, []);

  useEffect(() => {
    // Check on mount (for page refreshes/initial login redirect)
    if (localStorage.getItem('datalytics_welcome_shown') === 'false') {
      handleLoginSuccess()
    }

    const triggerPopup = () => handleLoginSuccess()
    window.addEventListener('datalytics:login-success', triggerPopup)
    return () => window.removeEventListener('datalytics:login-success', triggerPopup)
  }, [handleLoginSuccess])

  async function chargeStepIfNeeded(stepKey, { force = false } = {}) {
    if (!stepKey) return true
    if (!force && (completedSteps[stepKey] || chargedStepsRef.current.has(stepKey))) return true

    const ok = await deductDiamonds(20)
    if (ok) chargedStepsRef.current.add(stepKey)
    return ok
  }

  async function handleStepChange(nextStep) {
    setQuickPanelOpen(false)
    if (dataset && (nextStep === 'prediction' || nextStep === 'powerbi')) {
      const ok = await chargeStepIfNeeded(nextStep)
      if (!ok) return
    }

    if (isMobile) {
      // Close sidebar first, then change step after a short delay
      setSidebarOpen(false)
      setTimeout(() => {
        setStep(nextStep)
        // Scroll the ds-content area (not window) to top instantly
        document.querySelector('.ds-content')?.scrollTo({ top: 0, behavior: 'instant' })
        if (nextStep === 'profile') {
          profileVisitKeyRef.current += 1
          setProfileVisitKey(profileVisitKeyRef.current)
        }
      }, 120)
    } else {
      setStep(nextStep)
      // Reset content scroll instantly — no jarring smooth scroll animation
      document.querySelector('.ds-content')?.scrollTo({ top: 0, behavior: 'instant' })
      if (nextStep === 'profile') {
        profileVisitKeyRef.current += 1
        setProfileVisitKey(profileVisitKeyRef.current)
      }
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
        const payload = JSON.parse(jsonPayload)
        const email = payload.sub
        setAuthProfile({ 
          fullName: payload.name || 'Datalytics User', 
          email, 
          role: 'Workspace Member',
          joinedAt: payload.joined_at,
          provider: payload.provider || 'email',
          plan: payload.plan || 'None',
          diamonds: payload.diamonds,
        })

        // Check if we should show a welcome toast (for page refreshes)
        if (localStorage.getItem('datalytics_welcome_shown') === 'false') {
          handleLoginSuccess()
        }

        // Load avatar keyed by email so it persists after logout
        const avatarKey = `datalytics-profile-avatar-${email}`
        const savedAvatar = localStorage.getItem(avatarKey) || localStorage.getItem('datalytics-profile-avatar')
        if (savedAvatar) {
          setProfileAvatar(savedAvatar)
          // Migrate old generic key to email-keyed key
          if (!localStorage.getItem(avatarKey) && savedAvatar) {
            localStorage.setItem(avatarKey, savedAvatar)
          }
        }
      } catch (err) {
        console.error('Invalid token', err)
        const savedAvatar = localStorage.getItem('datalytics-profile-avatar')
        if (savedAvatar) setProfileAvatar(savedAvatar)
      }
    }
    setAuthChecking(false)
  }, [handleLoginSuccess])

  useEffect(() => {
    sidebarHoverPeekRef.current = sidebarHoverPeek
  }, [sidebarHoverPeek])

  useEffect(() => {
    if (!immersiveSidebarAutoHide) {
      clearSidebarCloseTimer()
      setSidebarHoverPeek(false)
    }
  }, [immersiveSidebarAutoHide])

  useEffect(() => {
    return () => {
      clearSidebarCloseTimer()
      if (sidebarPointerFrameRef.current) {
        cancelAnimationFrame(sidebarPointerFrameRef.current)
        sidebarPointerFrameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!immersiveSidebarAutoHide) return undefined

    function handlePointerMove(event) {
      const pointerX = event.clientX
      if (sidebarPointerFrameRef.current) {
        cancelAnimationFrame(sidebarPointerFrameRef.current)
      }

      sidebarPointerFrameRef.current = requestAnimationFrame(() => {
        sidebarPointerFrameRef.current = null

        const nearEdge = pointerX <= 18
        const withinSidebarZone = pointerX <= 308

        if (nearEdge || (sidebarHoverPeekRef.current && withinSidebarZone)) {
          openSidebarHoverPeek()
          return
        }

        scheduleSidebarHoverClose()
      })
    }

    function handlePointerLeaveWindow(event) {
      if (event.relatedTarget) return
      scheduleSidebarHoverClose()
    }

    window.addEventListener('mousemove', handlePointerMove, { passive: true })
    window.addEventListener('mouseout', handlePointerLeaveWindow)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseout', handlePointerLeaveWindow)
      if (sidebarPointerFrameRef.current) {
        cancelAnimationFrame(sidebarPointerFrameRef.current)
        sidebarPointerFrameRef.current = null
      }
    }
  }, [immersiveSidebarAutoHide])

  useEffect(() => {
    function handleChatWidgetRequest(event) {
      const detail = event?.detail
      if (!detail) return
      setIncomingWidgetRequest({
        ...detail,
        requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      setCompletedSteps((prev) => ({ ...prev, powerbi: true }))
      if (isMobile) setSidebarOpen(false)
    }

    window.addEventListener('datalytics:create-dashboard-widget', handleChatWidgetRequest)
    return () => window.removeEventListener('datalytics:create-dashboard-widget', handleChatWidgetRequest)
  }, [isMobile])

  useEffect(() => {
    if (dataset && !completedSteps.upload) {
      setCompletedSteps((prev) => ({ ...prev, upload: true }))
    }
  }, [dataset, completedSteps.upload])

  useEffect(() => {
    if (!datasetProfile) return
    const defaultX = datasetProfile.categoricalColumns[0] || datasetProfile.columns[0] || ''
    const defaultY = datasetProfile.numericColumns[0] || datasetProfile.columns[1] || datasetProfile.columns[0] || ''
    setVizConfig((prev) => ({
      ...prev,
      x: prev.x || defaultX,
      y: prev.y || defaultY,
      filterColumn: prev.filterColumn || defaultX,
    }))

  }, [datasetProfile])

  useEffect(() => {
    const predictionDone = Boolean(
      predictionStatus.supervised_done ||
        predictionStatus.unsupervised_done ||
        predictionStatus.best_done ||
        predictionStatus.predict_done ||
        predictionStatus.download_done
    )
    if (predictionDone && !completedSteps.prediction) {
      setCompletedSteps((prev) => ({ ...prev, prediction: true }))
    }
  }, [predictionStatus, completedSteps.prediction])

  // Log model training activities to MongoDB
  const prevPredStatusRef = useRef({})
  useEffect(() => {
    if (predictionStatus.supervised_done && !prevPredStatusRef.current.supervised_done) {
      logActivity('Train', 'models', 'Supervised model trained', { type: 'Supervised' })
    }
    if (predictionStatus.unsupervised_done && !prevPredStatusRef.current.unsupervised_done) {
      logActivity('Train', 'models', 'Unsupervised model trained', { type: 'Unsupervised' })
    }
    prevPredStatusRef.current = predictionStatus
  }, [predictionStatus, logActivity])

  // Handle open-pricing event dispatched from the insufficient diamonds alert
  useEffect(() => {
    function handleOpenPricing() {
      handleStepChange('profile')
      // Small delay to allow navigation before profile opens pricing modal
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('datalytics:profile-open-pricing'))
      }, 400)
    }
    window.addEventListener('datalytics:open-pricing', handleOpenPricing)
    return () => window.removeEventListener('datalytics:open-pricing', handleOpenPricing)
  }, [])
  // ── Reset scroll position to top on every step change ──────────
  useEffect(() => {
    // We use a small timeout to ensure the DOM has updated before scrolling
    const timer = setTimeout(() => {
      const el = document.querySelector('.ds-content')
      if (el) {
        el.scrollTo({ top: 0, behavior: 'instant' })
      }
      window.scrollTo({ top: 0, behavior: 'instant' })
    }, 10)
    return () => clearTimeout(timer)
  }, [step])

  useEffect(() => {
    const el = document.querySelector('.ds-content')
    if (!el) return undefined

    const interactiveSelector = 'button, a, input, textarea, select, option, label, summary, details, [role="button"], [contenteditable="true"]'
    let isDragging = false
    let startX = 0
    let startY = 0
    let startLeft = 0
    let startTop = 0

    function canScrollHorizontally() {
      return el.scrollWidth > el.clientWidth + 2
    }

    function handleWheel(event) {
      if (!canScrollHorizontally()) return
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      const shiftWheel = event.shiftKey && Math.abs(event.deltaY) > 0
      if (!horizontalIntent && !shiftWheel) return

      event.preventDefault()
      el.scrollLeft += horizontalIntent ? event.deltaX : event.deltaY
    }

    function handleMouseDown(event) {
      if (event.button !== 0) return
      if (event.target?.closest?.(interactiveSelector)) return
      if (!canScrollHorizontally() && el.scrollHeight <= el.clientHeight + 2) return

      isDragging = true
      startX = event.clientX
      startY = event.clientY
      startLeft = el.scrollLeft
      startTop = el.scrollTop
      el.classList.add('is-panning')
    }

    function handleMouseMove(event) {
      if (!isDragging) return
      event.preventDefault()
      el.scrollLeft = startLeft - (event.clientX - startX)
      el.scrollTop = startTop - (event.clientY - startY)
    }

    function stopDragging() {
      if (!isDragging) return
      isDragging = false
      el.classList.remove('is-panning')
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopDragging)
    window.addEventListener('mouseleave', stopDragging)

    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopDragging)
      window.removeEventListener('mouseleave', stopDragging)
      el.classList.remove('is-panning')
    }
  }, [step])

  function markComplete(stepKey) {
    chargedStepsRef.current.add(stepKey)
    setCompletedSteps((prev) => ({ ...prev, [stepKey]: true }))
    // Map every pipeline step to its activity category for heatmap + KPI tracking
    // Each step only logs ONCE per session (dedup via loggedActivitiesRef)
    // ⚠️ IMPORTANT: Only log activities that are genuinely separate pipeline events.
    // - 'upload' is NOT listed here — it is exclusively logged once in handleDatasetChange
    // - 'exploration' and 'preparation' are NOT listed — they inflate the datasets count
    // - 'visualization' is NOT listed — each chart save is logged via onAddChart callback above
    const categoryMap = {
      prediction:      ['Train',    'models',     'Model training pipeline completed'],
      powerbi:         ['Dashboard','dashboards', 'Power BI Dashboard created'],
      reports:         ['Report',   'reports',    'Pipeline report generated'],
      aiInsights:      ['Query',    'queries',    'AI insight query run'],
      recommendations: ['Query',    'queries',    'Recommendations generated'],
      decisionMaking:  ['Decision', 'queries',    'Decision making completed'],
    }
    const entry = categoryMap[stepKey]
    if (entry && !loggedActivitiesRef.current.has(stepKey)) {
      loggedActivitiesRef.current.add(stepKey)
      logActivity(entry[0], entry[1], entry[2])
    }
  }

  function handleDatasetChange(nextDataset) {
    const normalized = normalizeDataset(nextDataset)
    setDataset(normalized)
    setPredictionState(DEFAULT_PREDICTION_STATE)
    setPredictionModule('preprocessing')
    setPredictionStatus(DEFAULT_PREDICTION_STATUS)
    setSavedCharts([])
    setVizConfig({ chartType: 'Bar', x: '', y: '', filterColumn: '', filterValues: [] })
    setDashboardState(DEFAULT_DASHBOARD_STATE)
    setIncomingWidgetRequest(null)
    chargedStepsRef.current = normalized ? new Set(['upload']) : new Set()
    setCompletedSteps({ ...DEFAULT_COMPLETED, upload: Boolean(normalized) })
    // Log to MongoDB — once per unique dataset name per session
    if (normalized && normalized.name !== prevDatasetNameRef.current) {
      prevDatasetNameRef.current = normalized.name
      // Reset session activity dedup for new dataset
      loggedActivitiesRef.current.clear()
      logActivity('Upload', 'datasets', normalized.name || 'Dataset', {
        rows: normalized.rows?.length || 0,
        columns: normalized.columns?.length || 0,
      })
    }
  }

  async function handlePreparationContinue(nextDataset, hasChanges) {
    const ok = await chargeStepIfNeeded('preparation')
    if (!ok) return

    if (hasChanges) {
      const normalized = setDatasetSyncState(normalizeDataset(nextDataset), {
        backendManaged: false,
        needsBackendSync: true,
      })
      setDataset(normalized)
      setPredictionState(DEFAULT_PREDICTION_STATE)
      setPredictionModule('preprocessing')
      setPredictionStatus(DEFAULT_PREDICTION_STATUS)
      setSavedCharts([])
      setVizConfig({ chartType: 'Bar', x: '', y: '', filterColumn: '', filterValues: [] })
      setDashboardState(DEFAULT_DASHBOARD_STATE)
      setIncomingWidgetRequest(null)
      setCompletedSteps({
        ...DEFAULT_COMPLETED,
        upload: Boolean(normalized),
        exploration: Boolean(normalized),
        preparation: Boolean(normalized),
      })
    } else {
      setCompletedSteps((prev) => ({ ...prev, preparation: Boolean(nextDataset) }))
    }

    setStep('visualization')
    if (isMobile) setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // Log data preparation action to heatmap
    if (!loggedActivitiesRef.current.has('preparation')) {
      loggedActivitiesRef.current.add('preparation')
      logActivity('Prepare', 'pipeline', 'Data preparation completed')
    }
  }

  function handleExplorationDatasetUpdate(nextDataset) {
    const normalized = setDatasetSyncState(normalizeDataset(nextDataset), {
      backendManaged: true,
      needsBackendSync: false,
    })
    setDataset(normalized)
    setPredictionState(DEFAULT_PREDICTION_STATE)
    setPredictionModule('preprocessing')
    setPredictionStatus(DEFAULT_PREDICTION_STATUS)
    setSavedCharts([])
    setVizConfig({ chartType: 'Bar', x: '', y: '', filterColumn: '', filterValues: [] })
    setDashboardState(DEFAULT_DASHBOARD_STATE)
    setIncomingWidgetRequest(null)
    setCompletedSteps({
      ...DEFAULT_COMPLETED,
      upload: Boolean(normalized),
      preparation: Boolean(normalized),
      exploration: Boolean(normalized),
    })
  }

  function handleResetWorkflow() {
    clearDataset()
    setPredictionState(DEFAULT_PREDICTION_STATE)
    setPredictionModule('preprocessing')
    setPredictionStatus(DEFAULT_PREDICTION_STATUS)
    setSavedCharts([])
    setVizConfig({ chartType: 'Bar', x: '', y: '', filterColumn: '', filterValues: [] })
    setDashboardState(DEFAULT_DASHBOARD_STATE)
    setIncomingWidgetRequest(null)
    chargedStepsRef.current.clear()
    setCompletedSteps(DEFAULT_COMPLETED)
    setStep('upload')
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const predictionModules = [
    { key: 'preprocessing', label: 'Data Preprocessing', icon: '01' },
    { key: 'supervised', label: 'Supervised Models', icon: '02' },
    { key: 'unsupervised', label: 'Unsupervised Models', icon: '03' },
    { key: 'best', label: 'Best Model Selection', icon: '04' },
    { key: 'predict', label: 'Prediction', icon: '05' },
    { key: 'download', label: 'Download Results', icon: '06' },
  ]

  const predictionStatusMap = {
    preprocessing: 'preprocessing_done',
    supervised: 'supervised_done',
    unsupervised: 'unsupervised_done',
    best: 'best_done',
    predict: 'predict_done',
    download: 'download_done',
  }

  function renderPredictionContent() {
    switch (predictionModule) {
      case 'preprocessing':
        return (
          <OnClickPred
            dataset={dataset}
            setStatus={setPredictionStatus}
          />
        )
      case 'supervised':
        return (
          <TrainStep
            preprocessData={predictionStatus.preprocess_data}
            status={predictionStatus}
            onTrained={() => setPredictionStatus((s) => ({ ...s, supervised_done: true }))}
            setStatus={setPredictionStatus}
          />
        )
      case 'unsupervised':
        return (
          <UnsupervisedStep
            status={predictionStatus}
            setStatus={setPredictionStatus}
          />
        )
      case 'best':
        return (
          <BestModelStep
            status={predictionStatus}
            setStatus={setPredictionStatus}
          />
        )
      case 'predict':
        return (
          <PredictStep
            trainData={predictionStatus.preprocess_data}
            status={predictionStatus}
            setStatus={setPredictionStatus}
          />
        )
      case 'download':
        return (
          <DownloadStep
            trainData={predictionStatus.preprocess_data}
            preprocessData={predictionStatus.preprocess_data}
            status={predictionStatus}
            setStatus={setPredictionStatus}
          />
        )
      default:
        return null
    }
  }

  function renderPrediction() {
    return (
      <div className="prediction-layout">
        <div className="prediction-subnav">
          <div className="prediction-subnav-header">
            <span className="prediction-subnav-title">Prediction</span>
            <span className="prediction-subnav-sub">ML Pipeline</span>
          </div>
          <nav className="prediction-subnav-list">
            {predictionModules.map((mod) => {
              const isActive = predictionModule === mod.key
              const isDone = predictionStatus[predictionStatusMap[mod.key]]
              return (
                <button
                  key={mod.key}
                  type="button"
                  className={`pred-subnav-item${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
                  onClick={async () => {
                    setPredictionModule(mod.key)
                    setPredictionStatus((s) => ({ ...s, current_module: mod.key }))
                  }}
                >
                  <span className="pred-subnav-step">{mod.icon}</span>
                  <span className="pred-subnav-label">{mod.label}</span>
                  {isDone && <span className="pred-subnav-done-dot" />}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="prediction-content">
          {renderPredictionContent()}
        </div>
      </div>
    )
  }

  function renderStep() {
    switch (step) {
      case 'upload':
        return (
          <UploadStep
            dataset={dataset}
            datasetProfile={datasetProfile}
            onDatasetChange={handleDatasetChange}
            onComplete={markComplete}
            onBeforeUpload={() => chargeStepIfNeeded('upload', { force: true })}
            onReset={handleResetWorkflow}
          />
        )
      case 'preparation':
        return (
          <DataPreparationStep
            dataset={dataset}
            datasetProfile={datasetProfile}
            onContinue={handlePreparationContinue}
            onJumpToUpload={() => handleStepChange('upload')}
          />
        )
      case 'exploration':
        return (
          <Suspense fallback={<StepLoader label="exploration" />}>
            <ExploreStep
              dataset={dataset}
              datasetProfile={datasetProfile}
              explorationReady={completedSteps.exploration}
              onComplete={markComplete}
              onDatasetUpdate={handleExplorationDatasetUpdate}
              onJumpToUpload={() => handleStepChange('upload')}
            />
          </Suspense>
        )
      case 'visualization':
        return (
          <Suspense fallback={<StepLoader label="visualization" />}>
            <VisualizationStep
              dataset={dataset}
              datasetProfile={datasetProfile}
              vizConfig={vizConfig}
              setVizConfig={setVizConfig}
              onAddChart={(chart) => {
                setSavedCharts((prev) => [chart, ...prev].slice(0, 8))
                // Log every chart save — this IS a different action each time (no dedup)
                logActivity('Visualize', 'dashboards', chart?.title || 'Chart saved')
              }}
              onComplete={markComplete}
              onBeforeVisualize={() => chargeStepIfNeeded('visualization')}
              onContinueToPrediction={() => {
                markComplete('visualization')
                setPredictionModule('preprocessing')
                setPredictionStatus((current) => ({ ...current, current_module: 'preprocessing' }))
                handleStepChange('prediction')
              }}
              onJumpToUpload={() => handleStepChange('upload')}
            />
          </Suspense>
        )
      case 'prediction':
        return renderPrediction()
      case 'powerbi':
        return (
          <Suspense fallback={<StepLoader label="dashboard builder" />}>
            <PowerBIDashboardStep
              dataset={dataset}
              datasetProfile={datasetProfile}
              savedCharts={savedCharts}
              dashboardState={dashboardState}
              incomingWidgetRequest={incomingWidgetRequest}
              setDashboardState={setDashboardState}
              onComplete={markComplete}
              onJumpToUpload={() => handleStepChange('upload')}
            />
          </Suspense>
        )
      case 'recommendations':
        return (
          <Suspense fallback={<StepLoader label="recommendations" />}>
            <RecommendationStep
              dataset={dataset}
              datasetProfile={datasetProfile}
              onComplete={markComplete}
              onBeforeGenerate={() => chargeStepIfNeeded('recommendations')}
              onJumpToUpload={() => handleStepChange('upload')}
            />
          </Suspense>
        )
      case 'decisionMaking':
        return (
          <Suspense fallback={<StepLoader label="decision making" />}>
            <DecisionMakingStep
              dataset={dataset}
              datasetProfile={datasetProfile}
              onComplete={markComplete}
              onBeforeEvaluate={() => chargeStepIfNeeded('decisionMaking')}
              onJumpToUpload={() => handleStepChange('upload')}
            />
          </Suspense>
        )
      case 'reports':
        return (
          <Suspense fallback={<StepLoader label="reports" />}>
            <ReportStep
              dataset={dataset}
              datasetProfile={datasetProfile}
              predictionStatus={predictionStatus}
              vizConfig={vizConfig}
              savedCharts={savedCharts}
              onComplete={markComplete}
              onBeforeGenerate={() => chargeStepIfNeeded('reports')}
              onJumpToUpload={() => handleStepChange('upload')}
            />
          </Suspense>
        )
      case 'aiInsights':
        return (
          <Suspense fallback={<StepLoader label="AI insights" />}>
            <AIInsightsStep
              dataset={dataset}
              datasetProfile={datasetProfile}
              onComplete={markComplete}
              onJumpToUpload={() => handleStepChange('upload')}
            />
          </Suspense>
        )
      case 'profile':
        return (
          <Suspense fallback={<StepLoader label="profile" />}>
            <UserProfileStep
              key={profileVisitKey}
              dataset={dataset}
              datasetProfile={datasetProfile}
              savedCharts={savedCharts}
              dashboardState={dashboardState}
              predictionStatus={predictionStatus}
              completedSteps={completedSteps}
              authProfile={authProfile}
              onNavigate={handleStepChange}
              profileAvatar={profileAvatar}
              setProfileAvatar={setProfileAvatar}
            />
          </Suspense>
        )
      default:
        return null
    }
  }

  const completedCount = Object.values(completedSteps).filter(Boolean).length
  const totalSteps = Object.keys(completedSteps).length
  const completionRate = totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0
  const datasetRows = datasetProfile?.totalRowCount || datasetProfile?.rowCount || dataset?.rows?.length || 0
  const datasetColumns = datasetProfile?.totalColumnCount || datasetProfile?.columnCount || dataset?.columns?.length || 0
  const predictionModulesDone = [
    'preprocessing_done',
    'supervised_done',
    'unsupervised_done',
    'best_done',
    'predict_done',
    'download_done',
  ].filter((key) => Boolean(predictionStatus[key])).length
  const pipelineStatusRows = Object.keys(completedSteps).map((stepKey) => ({
    key: stepKey,
    label: getStepLabel(stepKey),
    done: Boolean(completedSteps[stepKey]),
    active: stepKey === step,
  }))
  const analyticsPulseSeries = [32, 48, 44, 61, 54, 66, 58, 74, 70, 82]
  const recentActivityRows = pipelineStatusRows.slice(0, 6).map((item, index) => {
    const state = item.done ? 'completed' : item.active ? 'active' : 'queued'
    const stateLabel = item.done ? 'Completed' : item.active ? 'Live' : 'Queued'
    const updated = item.active ? 'Just now' : `${index + 1}h ago`
    return {
      id: item.key,
      module: item.label,
      status: <span className={`ds-ui-status is-${state}`}>{stateLabel}</span>,
      updated,
    }
  })
  if (authChecking) {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#050811]"><div className="w-8 h-8 rounded-full border-4 border-t-[#00ffcc] border-[#00ffcc]/20 animate-spin" /></div>
  }

  if (!authProfile) {
    return (
      <AuthSystem 
        onClose={() => {}} // Cannot close until logged in
        onSuccess={(user) => {
          setAuthProfile({
            fullName: user.fullName || 'Datalytics User',
            email: user.email,
            role: 'Workspace Member',
            provider: user.provider || 'email',
            plan: user.plan || 'None',
            diamonds: user.diamonds,
          })
          if (!welcomeShownRef.current) {
            welcomeShownRef.current = true
            setShowWelcome(true)
            setTimeout(() => setShowWelcome(false), 4000)
          }
        }} 
      />
    )
  }

  if (authProfile?.email === 'singhsangam5400@gmail.com') {
    return (
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-[#050811]"><div className="w-8 h-8 rounded-full border-4 border-t-[#00ffcc] border-[#00ffcc]/20 animate-spin" /></div>}>
        <AdminPanel 
          integratedToken={localStorage.getItem('auth_token')} 
          onIntegratedLogout={() => {
            localStorage.removeItem('auth_token')
            localStorage.removeItem('datalytics-notifications')
            welcomeShownRef.current = false
            setAuthProfile(null)
            router.replace('/')
          }} 
        />
      </Suspense>
    )
  }

  const profileName = authProfile?.fullName || 'Datalytics User'
  const profileRole = authProfile?.role || 'Analytics Workspace'
  const initialsMatch = profileName.match(/\b\w/g) || []
  const profileInitials = ((initialsMatch[0] || '') + (initialsMatch[1] || '')).toUpperCase() || 'DL'

  return (
    <div className={`ds-shell${immersiveSidebarAutoHide ? ' has-immersive-sidebar' : ''}`}>
      <InsufficientDiamondsAlert />
      <Sidebar
        currentStep={step}
        setStep={handleStepChange}
        predictionModule={predictionModule}
        setPredictionModule={setPredictionModule}
        predictionStatus={{ ...predictionStatus, setStatus: setPredictionStatus }}
        completedSteps={completedSteps}
        predictionState={predictionState}
        dataset={dataset}
        datasetProfile={datasetProfile}
        authProfile={authProfile}
        collapsed={immersiveSidebarAutoHide ? false : sidebarCollapsed}
        mobileOpen={sidebarOpen}
        autoHide={immersiveSidebarAutoHide}
        hoverPeek={sidebarHoverPeek}
        onToggleCollapse={() => {
          if (isMobile) {
            setSidebarOpen((v) => !v)
            return
          }
          if (immersiveSidebarAutoHide) {
            scheduleSidebarHoverClose()
            return
          }
          setSidebarCollapsed((v) => !v)
        }}
        onCloseMobile={() => setSidebarOpen(false)}
        progress={{ completedCount, totalSteps }}
      />

      <div className="ds-main">
        <Navbar
          stepLabel={getStepLabel(step)}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          onProfileOpen={() => handleStepChange('profile')}
          onOpenSettings={() => handleStepChange('reports')}
          onLogout={async () => {
            const token = localStorage.getItem('auth_token')
            try {
              if (token) {
                await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
              }
            } catch {}
            localStorage.removeItem('auth_token')
            localStorage.removeItem('datalytics-notifications')
            // NOTE: do NOT remove profile avatar — it is keyed by email and must persist
            welcomeShownRef.current = false
            setAuthProfile(null)
            router.replace('/')
          }}
          profileName={profileName}
          profileRole={profileRole}
          profileInitials={profileInitials}
          profileAvatar={profileAvatar}
          showWelcome={showWelcome}
          welcomeType={welcomeType}
        />

        <main className={`ds-content${step === 'prediction' ? ' is-prediction' : ''}`}>


          <section className="ds-workspace-panel">
            <div className="content-fade" key={step}>
              {renderStep()}
            </div>
          </section>
        </main>

        <footer className="ds-footer">
          Datalytics v1.18 | End-to-end analytics pipeline
        </footer>
      </div>

      <GlassModal
        open={quickPanelOpen}
        title="Quick Actions"
        onClose={() => setQuickPanelOpen(false)}
        footer={(
          <GlowButton variant="ghost" size="sm" onClick={() => setQuickPanelOpen(false)}>
            Close
          </GlowButton>
        )}
      >
        <div className="ds-modal-grid">
          <button
            type="button"
            className="ds-modal-action"
            onClick={() => handleStepChange('preparation')}
          >
            <HiOutlineBolt />
            <span>
              <strong>Continue Pipeline</strong>
              <small>Jump back into data preparation</small>
            </span>
          </button>

          <button
            type="button"
            className="ds-modal-action"
            onClick={() => handleStepChange('powerbi')}
          >
            <HiOutlineChartBarSquare />
            <span>
              <strong>Open Analytics</strong>
              <small>Go to interactive dashboard builder</small>
            </span>
          </button>

          <button
            type="button"
            className="ds-modal-action"
            onClick={() => handleStepChange('profile')}
          >
            <HiOutlineUsers />
            <span>
              <strong>View Profile</strong>
              <small>Open user profile and activity summary</small>
            </span>
          </button>
        </div>
      </GlassModal>

      <Suspense fallback={null}>
        <ChatBot dataset={dataset} datasetProfile={datasetProfile} profileAvatar={profileAvatar} profileInitials={profileInitials} />
      </Suspense>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <GlobalRuntimeGuard>
        <AppErrorBoundary>
          <AppShell />
        </AppErrorBoundary>
      </GlobalRuntimeGuard>
    </ToastProvider>
  )
}
