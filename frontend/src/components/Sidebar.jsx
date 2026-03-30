import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { key: 'upload', label: 'Dataset Upload', icon: '01', meta: 'Upload CSV / Excel' },
  { key: 'exploration', label: 'Data Exploration', icon: '02', meta: 'Statistics and profiling' },
  { key: 'visualization', label: 'Visualization', icon: '03', meta: 'Charts and filters' },
  {
    key: 'prediction',
    label: 'Prediction',
    icon: '04',
    meta: 'Model training and forecasts',
    children: [
      { key: 'preprocessing', label: 'Data Preprocessing' },
      { key: 'supervised', label: 'Supervised Models' },
      { key: 'unsupervised', label: 'Unsupervised Models' },
      { key: 'best', label: 'Best Model Selection' },
      { key: 'predict', label: 'Prediction' },
      { key: 'download', label: 'Download Results' }
    ]
  },
  { key: 'powerbi', label: 'Auto Power BI Dashboard', icon: '05', meta: 'Interactive dashboard' },
  { key: 'recommendations', label: 'Recommendations & Insights', icon: '06', meta: 'AI insights' },
  { key: 'reports', label: 'Reports', icon: '07', meta: 'Export PDF' },
  { key: 'aiInsights', label: 'AI Insights', icon: '08', meta: 'Q&A and summaries' }
]

const DEFAULT_COMPLETED_FALLBACK = {}
const DEFAULT_PREDICTION_FALLBACK = { completed: {} }

function getStepStatus(active, completed) {
  if (active) return 'ACTIVE'
  if (completed) return 'COMPLETED'
  return 'NOT VISITED'
}

export default function Sidebar({
  currentStep,
  setStep,
  predictionModule,
  setPredictionModule,
  predictionStatus = {},
  completedSteps = DEFAULT_COMPLETED_FALLBACK,
  predictionState = DEFAULT_PREDICTION_FALLBACK,
  dataset,
  datasetProfile,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile
}) {
  const [predictionOpen, setPredictionOpen] = useState(true)

  useEffect(() => {
    if (currentStep === 'prediction') {
      setPredictionOpen(true)
    }
  }, [currentStep])

  const compact = collapsed && !mobileOpen
  const safeCompletedSteps = completedSteps || {}
  const totalSteps = Object.keys(safeCompletedSteps).length || 8
  const completedCount = Object.values(safeCompletedSteps).filter(Boolean).length
  const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0

  return (
    <>
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'is-visible' : ''}`}
        onClick={onCloseMobile}
      />
      <aside
        className={[
          'sidebar-shell',
          compact ? 'is-collapsed' : '',
          mobileOpen ? 'is-mobile-open' : ''
        ].join(' ').trim()}
      >
        <div className="sidebar-aurora" />

        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            x
          </button>

          <div className="sidebar-brand-card">
            <div className="sidebar-brand-mark" aria-hidden="true" onClick={() => { if (typeof window !== 'undefined') window.location.href='/' }} style={{ cursor: 'pointer' }}>
              <span className="sidebar-brand-ring" />
              <div className="logo-icon" style={{ display: 'flex', gap: 2, alignItems: 'flex-end', position: 'relative', zIndex: 2 }}>
                {[10, 16, 12].map(h => (
                  <span key={h} style={{ display: 'block', width: 4, height: h, borderRadius: 2, background: 'linear-gradient(180deg, #ff6a00, #ff4d2e)' }} />
                ))}
              </div>
            </div>

            {!compact && (
              <>
                <div className="sidebar-title-wrap">
                  <p className="sidebar-kicker" style={{ color: '#ff6a00' }}>Datalytics</p>
                  <h1 className="sidebar-title" style={{ background: 'linear-gradient(90deg, #fff, #ffb987)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Data Pipeline</h1>
                </div>

                <div className="sidebar-progress-card">
                  <div className="sidebar-progress-head">
                    <div>
                      <span className="sidebar-progress-label">Progress</span>
                      <p className="sidebar-progress-copy">{completedCount}/{totalSteps} steps done</p>
                    </div>
                    <span className="sidebar-progress-pill" style={{ color: '#ff6a00', background: 'rgba(255, 106, 0, 0.1)', borderColor: 'rgba(255, 106, 0, 0.22)' }}>{pct}%</span>
                  </div>
                  <div className="sidebar-progress-track" aria-hidden="true">
                    <div className="sidebar-progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ff6a00, #ff4d2e)' }} />
                  </div>
                </div>
              </>
            )}
          </div>

          {!compact && dataset && datasetProfile && (
            <div className="sidebar-dataset-card">
              <div className="sidebar-dataset-badge">Dataset loaded</div>
              <p className="sidebar-dataset-meta">{datasetProfile.rowCount.toLocaleString()} rows</p>
              <p className="sidebar-dataset-submeta">{datasetProfile.columnCount} columns profiled</p>
            </div>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Data pipeline navigation">
          <div
            className="sidebar-step-line"
            style={{ '--progress-stop': `${((NAV_ITEMS.findIndex(item => item.key === currentStep) + 1) / NAV_ITEMS.length) * 100}%` }}
          />

          {NAV_ITEMS.map((item, index) => {
            const isActive = currentStep === item.key
            const isCompleted = Boolean(completedSteps[item.key])
            const status = getStepStatus(isActive, isCompleted)
            const className = [
              'sidebar-step',
              isActive ? 'is-active' : '',
              isCompleted ? 'is-done' : '',
              compact ? 'is-icon-only' : ''
            ].join(' ').trim()

            return (
              <div key={item.key} className="sidebar-step-group">
                <button
                  type="button"
                  className={className}
                  onClick={() => {
                    setStep(item.key)
                    if (item.key === 'prediction') {
                      setPredictionModule('preprocessing')
                    }
                    onCloseMobile()
                  }}
                  title={item.label}
                >
                  <span className="sidebar-step-rail-node" aria-hidden="true">
                    <span className="sidebar-step-rail-core" />
                  </span>
                  <span className="sidebar-step-icon-wrap" aria-hidden="true">
                    <span className="sidebar-step-icon">{item.icon}</span>
                  </span>
                  {!compact && (
                    <>
                      <span className="sidebar-step-copy">
                        <span className="sidebar-step-label">{item.label}</span>
                        <span className="sidebar-step-meta">{item.meta}</span>
                      </span>
                      <span className="sidebar-step-state">{status}</span>
                    </>
                  )}
                  {item.children && !compact && (
                    <span
                      className="sidebar-step-toggle"
                      onClick={event => {
                        event.stopPropagation()
                        setPredictionOpen(open => !open)
                      }}
                      role="button"
                    >
                      {predictionOpen ? '-' : '+'}
                    </span>
                  )}
                </button>

                {item.children && predictionOpen && !compact && (
                  <div className="sidebar-substeps">
                    {item.children.map(child => {
                      const activeSub = currentStep === 'prediction' && predictionModule === child.key
                      
                      // Map child keys to predictionStatus keys
                      const statusKeyMap = {
                        preprocessing: 'preprocessing_done',
                        supervised: 'supervised_done',
                        unsupervised: 'unsupervised_done',
                        best: 'best_done',
                        predict: 'predict_done',
                        download: 'download_done'
                      }
                      
                      const isDone = predictionStatus[statusKeyMap[child.key]]
                      const subStatus = activeSub ? 'ACTIVE' : (isDone ? 'COMPLETED' : 'READY')
                      
                      return (
                        <button
                          key={child.key}
                          type="button"
                          className={`sidebar-substep ${activeSub ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                          onClick={() => {
                            setStep('prediction')
                            setPredictionModule(child.key)
                            if (predictionStatus.setStatus) {
                              predictionStatus.setStatus(s => ({ ...s, current_module: child.key }));
                            }
                            onCloseMobile()
                          }}
                        >
                          <span className="sidebar-substep-dot" />
                          <span className="sidebar-substep-label">{child.label}</span>
                          <span className="sidebar-substep-status" style={{ 
                            fontSize: '0.6rem', 
                            color: activeSub ? '#ff6a00' : (isDone ? '#4ade80' : 'rgba(255,255,255,0.3)') 
                          }}>
                            {subStatus}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {!compact && (
            <div className="sidebar-profile">
              <div className="sidebar-profile-avatar">DS</div>
              <div>
                <p className="sidebar-profile-name">Data Studio</p>
                <p className="sidebar-profile-role">Analytics Team</p>
              </div>
            </div>
          )}

          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={onToggleCollapse}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {compact ? '>' : '<'}
          </button>
        </div>
      </aside>
    </>
  )
}
