'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import UploadStep from './components/UploadStep.jsx'
import ExploreStep from './components/ExploreStep.jsx'
import VisualizationStep from './components/VisualizationStep.jsx'
import PredictionStep from './components/PredictionStep.jsx'
import PreprocessStep from './components/PreprocessStep.jsx'
import ModernPreprocess from './components/ModernPreprocess.jsx'
import TrainStep from './components/TrainStep.jsx'
import UnsupervisedStep from './components/UnsupervisedStep.jsx'
import BestModelStep from './components/BestModelStep.jsx'
import PredictStep from './components/PredictStep.jsx'
import DownloadStep from './components/DownloadStep.jsx'
import OnClickPred from './components/onclickpred.jsx'
import PowerBIDashboardStep from './components/PowerBIDashboardStep.jsx'
import RecommendationStep from './components/RecommendationStep.jsx'
import ReportStep from './components/ReportStep.jsx'
import AIInsightsStep from './components/AIInsightsStep.jsx'
import ChatBot from './components/ChatBot.jsx'
import { buildDatasetProfile } from './lib/dataUtils.js'

const DEFAULT_COMPLETED = {
  upload: false,
  exploration: false,
  visualization: false,
  prediction: false,
  powerbi: false,
  recommendations: false,
  reports: false,
  aiInsights: false
}

const DEFAULT_PREDICTION_STATE = {
  supervised: {
    linear: { status: 'idle', progress: 0, metrics: null },
    logistic: { status: 'idle', progress: 0, metrics: null },
    tree: { status: 'idle', progress: 0, metrics: null },
    forest: { status: 'idle', progress: 0, metrics: null }
  },
  unsupervised: {
    kmeans: { status: 'idle', progress: 0, metrics: null },
    pca: { status: 'idle', progress: 0, metrics: null }
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
    download: false
  }
}

function normalizeDataset(dataset) {
  if (!dataset) return null
  const rows = dataset.rows || []
  const columns = dataset.columns || (rows[0] ? Object.keys(rows[0]) : [])
  return { name: dataset.name || 'Dataset', rows, columns }
}

function getStepLabel(step) {
  const labels = {
    upload: 'Dataset Upload',
    exploration: 'Data Exploration',
    visualization: 'Visualization',
    prediction: 'Prediction',
    powerbi: 'Auto Power BI Dashboard',
    recommendations: 'Recommendations & Insights',
    reports: 'Reports',
    aiInsights: 'AI Insights'
  }
  return labels[step] || 'Dashboard'
}

export default function App() {
  const [step, setStep] = useState('upload')
  const [completedSteps, setCompletedSteps] = useState(DEFAULT_COMPLETED)
  const [dataset, setDataset] = useState(null)
  const [predictionModule, setPredictionModule] = useState('preprocessing')
  const [predictionState, setPredictionState] = useState(DEFAULT_PREDICTION_STATE)
  const [predictionStatus, setPredictionStatus] = useState({
    preprocessing_done: false,
    supervised_done: false,
    unsupervised_done: false,
    best_done: false,
    predict_done: false,
    download_done: false,
    preprocess_data: null
  })
  const [vizConfig, setVizConfig] = useState({
    chartType: 'Bar',
    x: '',
    y: '',
    filterColumn: '',
    filterValues: []
  })
  const [savedCharts, setSavedCharts] = useState([])
  const [dashboardState, setDashboardState] = useState({
    region: 'All',
    segment: 'All',
    year: 'All',
    drill: ''
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const datasetProfile = useMemo(() => (
    dataset ? buildDatasetProfile(dataset) : null
  ), [dataset])

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
    if (!datasetProfile) return
    const defaultX = datasetProfile.categoricalColumns[0] || datasetProfile.columns[0] || ''
    const defaultY = datasetProfile.numericColumns[0] || datasetProfile.columns[1] || datasetProfile.columns[0] || ''
    setVizConfig(prev => ({
      ...prev,
      x: prev.x || defaultX,
      y: prev.y || defaultY,
      filterColumn: prev.filterColumn || defaultX
    }))

    setDashboardState(prev => ({
      ...prev,
      drill: prev.drill || (datasetProfile.categoricalColumns[0] || defaultX)
    }))
  }, [datasetProfile])

  function handleStepChange(nextStep) {
    setStep(nextStep)
    if (isMobile) setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function markComplete(stepKey) {
    setCompletedSteps(prev => ({ ...prev, [stepKey]: true }))
  }

  function handleDatasetChange(nextDataset) {
    const normalized = normalizeDataset(nextDataset)
    setDataset(normalized)
    setPredictionState(DEFAULT_PREDICTION_STATE)
    setPredictionModule('supervised')
    setSavedCharts([])
    setVizConfig({ chartType: 'Bar', x: '', y: '', filterColumn: '', filterValues: [] })
    setDashboardState({ region: 'All', segment: 'All', year: 'All', drill: '' })
    setCompletedSteps({ ...DEFAULT_COMPLETED, upload: Boolean(normalized) })
  }

  function handleResetWorkflow() {
    setDataset(null)
    setPredictionState(DEFAULT_PREDICTION_STATE)
    setPredictionModule('supervised')
    setSavedCharts([])
    setVizConfig({ chartType: 'Bar', x: '', y: '', filterColumn: '', filterValues: [] })
    setDashboardState({ region: 'All', segment: 'All', year: 'All', drill: '' })
    setCompletedSteps(DEFAULT_COMPLETED)
    setStep('upload')
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const PREDICTION_MODULES = [
    { key: 'preprocessing', label: 'Data Preprocessing', icon: '01' },
    { key: 'supervised', label: 'Supervised Models', icon: '02' },
    { key: 'unsupervised', label: 'Unsupervised Models', icon: '03' },
    { key: 'best', label: 'Best Model Selection', icon: '04' },
    { key: 'predict', label: 'Prediction', icon: '05' },
    { key: 'download', label: 'Download Results', icon: '06' }
  ]

  const PRED_STATUS_MAP = {
    preprocessing: 'preprocessing_done',
    supervised: 'supervised_done',
    unsupervised: 'unsupervised_done',
    best: 'best_done',
    predict: 'predict_done',
    download: 'download_done'
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
            onTrained={() => setPredictionStatus(s => ({ ...s, supervised_done: true }))}
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
            {PREDICTION_MODULES.map((mod, idx) => {
              const isActive = predictionModule === mod.key
              const isDone = predictionStatus[PRED_STATUS_MAP[mod.key]]
              return (
                <button
                  key={mod.key}
                  type="button"
                  className={`pred-subnav-item${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
                  onClick={() => {
                    setPredictionModule(mod.key)
                    setPredictionStatus(s => ({ ...s, current_module: mod.key }))
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
          />
        )
      case 'exploration':
        return (
          <ExploreStep
            dataset={dataset}
            datasetProfile={datasetProfile}
            explorationReady={completedSteps.exploration}
            onComplete={markComplete}
            onJumpToUpload={() => handleStepChange('upload')}
          />
        )
      case 'visualization':
        return (
          <VisualizationStep
            dataset={dataset}
            datasetProfile={datasetProfile}
            vizConfig={vizConfig}
            setVizConfig={setVizConfig}
            onAddChart={chart => setSavedCharts(prev => [chart, ...prev].slice(0, 6))}
            onComplete={markComplete}
            onJumpToUpload={() => handleStepChange('upload')}
          />
        )
      case 'prediction':
        return renderPrediction()
      case 'powerbi':
        return (
          <PowerBIDashboardStep
            dataset={dataset}
            datasetProfile={datasetProfile}
            savedCharts={savedCharts}
            dashboardState={dashboardState}
            setDashboardState={setDashboardState}
            onComplete={markComplete}
            onJumpToUpload={() => handleStepChange('upload')}
          />
        )
      case 'recommendations':
        return (
          <RecommendationStep
            dataset={dataset}
            datasetProfile={datasetProfile}
            onComplete={markComplete}
            onJumpToUpload={() => handleStepChange('upload')}
          />
        )
      case 'reports':
        return (
          <ReportStep
            dataset={dataset}
            datasetProfile={datasetProfile}
            predictionState={predictionState}
            onComplete={markComplete}
            onJumpToUpload={() => handleStepChange('upload')}
          />
        )
      case 'aiInsights':
        return (
          <AIInsightsStep
            dataset={dataset}
            datasetProfile={datasetProfile}
            onComplete={markComplete}
            onJumpToUpload={() => handleStepChange('upload')}
          />
        )
      default:
        return null
    }
  }

  const completedCount = Object.values(completedSteps).filter(Boolean).length
  const totalSteps = Object.keys(completedSteps).length

  return (
    <div className="app-layout">
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
        collapsed={sidebarCollapsed}
        mobileOpen={sidebarOpen}
        onToggleCollapse={() => {
          if (isMobile) { setSidebarOpen(v => !v); return }
          setSidebarCollapsed(v => !v)
        }}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-menu-button"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Toggle sidebar"
            >
              <span /><span /><span />
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
                placeholder="Search anything..."
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
              
              <button className="topbar-action-btn" title="Settings">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <div className="topbar-divider" />
              
              <div className="topbar-profile">
                <div className="topbar-profile-avatar">SS</div>
                <div className="topbar-profile-info">
                  <span className="topbar-profile-name">Sangam Singh</span>
                  <span className="topbar-profile-role">Data Analyst</span>
                </div>
              </div>
              
              <button className="topbar-action-btn" title="Logout">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
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

      <ChatBot />
    </div>
  )
}
