'use client'

import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
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
// import { useAuth } from './auth/AuthContext.jsx'
import { useDataset } from './hooks/useDataset.js'
import { ToastProvider } from './hooks/useToast.js'

const ExploreStep = lazy(() => import('./components/ExploreStep.jsx'))
const VisualizationStep = lazy(() => import('./components/VisualizationStep.jsx'))
const PowerBIDashboardStep = lazy(() => import('./components/PowerBIDashboardStep.jsx'))
const RecommendationStep = lazy(() => import('./components/RecommendationStep.jsx'))
const ReportStep = lazy(() => import('./components/ReportStep.jsx'))
const AIInsightsStep = lazy(() => import('./components/AIInsightsStep.jsx'))
const UserProfileStep = lazy(() => import('./components/profile/UserProfileStep.jsx'))
const ChatBot = lazy(() => import('./components/ChatBot.jsx'))

const DEFAULT_COMPLETED = {
  upload: false,
  preparation: false,
  exploration: false,
  visualization: false,
  prediction: false,
  powerbi: false,
  recommendations: false,
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
    reports: 'Reports',
    aiInsights: 'AI Insights',
    profile: 'Profile',
  }
  return labels[step] || 'Dashboard'
}

function AppShell() {
  const { dataset, profile: datasetProfile, setDataset, clearDataset } = useDataset()
  // const { profile: authProfile } = useAuth()
  const authProfile = null
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
      setStep('powerbi')
      setCompletedSteps((prev) => ({ ...prev, powerbi: true }))
      if (isMobile) setSidebarOpen(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

  function handleStepChange(nextStep) {
    setStep(nextStep)
    if (isMobile) setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function markComplete(stepKey) {
    setCompletedSteps((prev) => ({ ...prev, [stepKey]: true }))
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
    setCompletedSteps({ ...DEFAULT_COMPLETED, upload: Boolean(normalized) })
  }

  function handlePreparationContinue(nextDataset, hasChanges) {
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
        preparation: Boolean(normalized),
      })
    } else {
      setCompletedSteps((prev) => ({ ...prev, preparation: Boolean(nextDataset) }))
    }

    setStep('exploration')
    if (isMobile) setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
                  onClick={() => {
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
              onAddChart={(chart) => setSavedCharts((prev) => [chart, ...prev].slice(0, 8))}
              onComplete={markComplete}
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
              dataset={dataset}
              datasetProfile={datasetProfile}
              savedCharts={savedCharts}
              dashboardState={dashboardState}
              predictionStatus={predictionStatus}
              completedSteps={completedSteps}
              authProfile={authProfile}
              onNavigate={handleStepChange}
            />
          </Suspense>
        )
      default:
        return null
    }
  }

  const completedCount = Object.values(completedSteps).filter(Boolean).length
  const totalSteps = Object.keys(completedSteps).length
  const profileName = authProfile?.fullName || 'Datalytics User'
  const profileRole = authProfile?.role || 'Analytics Workspace'
  const profileInitials = authProfile?.initials || 'DL'

  return (
    <div className={`app-layout${immersiveSidebarAutoHide ? ' has-immersive-sidebar' : ''}`}>
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

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-menu-button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle sidebar"
            >
              <span />
              <span />
              <span />
            </button>
            <div className="topbar-breadcrumb">
              <span className="topbar-breadcrumb-root">Analytics Pipeline</span>
              <span className="topbar-breadcrumb-sep">{'>'}</span>
              <span className="topbar-breadcrumb-current">{getStepLabel(step)}</span>
            </div>
          </div>

          <div className="topbar-center">
            <div className="topbar-search">
              <svg className="topbar-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="topbar-search-input"
                placeholder="Search pipeline, metrics, or models..."
              />
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-actions">
              <button className="topbar-action-btn" title="Notifications">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="topbar-notification-badge" />
              </button>

              <div className="topbar-divider" />

              <div
                className="topbar-profile"
                role="button"
                tabIndex={0}
                onClick={() => handleStepChange('profile')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleStepChange('profile')
                  }
                }}
                style={{ cursor: 'pointer' }}
                title="Open profile"
              >
                <div className="topbar-profile-avatar">{profileInitials}</div>
                <div className="topbar-profile-info">
                  <span className="topbar-profile-name">{profileName}</span>
                  <span className="topbar-profile-role">{profileRole}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="app-content">
          <div className="content-fade" key={step}>
            {renderStep()}
          </div>
        </main>

        <footer className="app-footer">
          Datalytics v4.0 | End-to-end analytics pipeline
        </footer>
      </div>

      <Suspense fallback={null}>
        <ChatBot dataset={dataset} datasetProfile={datasetProfile} />
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
