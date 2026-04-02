const NAV_ITEMS = [
  { key: 'upload', label: 'Dataset Upload', iconKey: 'upload', meta: 'Upload CSV / Excel' },
  { key: 'preparation', label: 'Data Preparation', iconKey: 'preparation', meta: 'Clean and standardize data' },
  { key: 'exploration', label: 'Data Exploration', iconKey: 'exploration', meta: 'Statistics and profiling' },
  { key: 'visualization', label: 'Visualization', iconKey: 'visualization', meta: 'Charts and filters' },
  { key: 'prediction', label: 'Prediction', iconKey: 'prediction', meta: 'Model training and forecasts' },
  { key: 'powerbi', label: 'Auto Power BI Dashboard', iconKey: 'powerbi', meta: 'Interactive dashboard' },
  { key: 'recommendations', label: 'Recommendations & Insights', iconKey: 'recommendations', meta: 'AI insights' },
  { key: 'reports', label: 'Reports', iconKey: 'reports', meta: 'Export PDF' },
  { key: 'aiInsights', label: 'AI Insights', iconKey: 'aiInsights', meta: 'Q&A and summaries' }
]

const DEFAULT_COMPLETED_FALLBACK = {}
const DEFAULT_PREDICTION_FALLBACK = { completed: {} }

function StepIcon({ iconKey }) {
  switch (iconKey) {
    case 'upload':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v10m0-10 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'preparation':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3h6m-5 0v5l-4.5 7.5A3 3 0 0 0 8 20h8a3 3 0 0 0 2.5-4.5L14 8V3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 14h8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      )
    case 'exploration':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      )
    case 'visualization':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19h16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <rect x="5" y="11" width="3" height="6" rx="1" fill="currentColor" />
          <rect x="10.5" y="7" width="3" height="10" rx="1" fill="currentColor" />
          <rect x="16" y="4" width="3" height="13" rx="1" fill="currentColor" />
        </svg>
      )
    case 'prediction':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 16 4-4 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 8h3v3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'powerbi':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="12" width="3" height="6" rx="1" fill="currentColor" />
          <rect x="9" y="8" width="3" height="10" rx="1" fill="currentColor" />
          <rect x="14" y="5" width="3" height="13" rx="1" fill="currentColor" />
          <rect x="19" y="9" width="1.5" height="9" rx=".75" fill="currentColor" />
        </svg>
      )
    case 'recommendations':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a7 7 0 0 0-4.7 12.2c.8.7 1.4 1.5 1.6 2.5h6.2c.2-1 .8-1.8 1.6-2.5A7 7 0 0 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 21h5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      )
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M14 3v5h5M9 12h6M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'aiInsights':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3c4.4 0 8 3 8 6.8 0 2.3-1.3 4.4-3.4 5.7V20l-3.4-2.1c-.4.1-.8.1-1.2.1-4.4 0-8-3-8-6.8S7.6 3 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <circle cx="9" cy="11" r="1" fill="currentColor" />
          <circle cx="12" cy="11" r="1" fill="currentColor" />
          <circle cx="15" cy="11" r="1" fill="currentColor" />
        </svg>
      )
    default:
      return null
  }
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
  authProfile,
  collapsed,
  mobileOpen,
  autoHide,
  hoverPeek,
  onToggleCollapse,
  onCloseMobile,
  progress
}) {
  const compact = collapsed && !mobileOpen
  const safeCompletedSteps = completedSteps || {}
  const totalSteps = progress?.totalSteps || Object.keys(safeCompletedSteps).length || NAV_ITEMS.length
  const completedCount = progress?.completedCount || Object.values(safeCompletedSteps).filter(Boolean).length
  const profileName = authProfile?.fullName || 'Datalytics User'
  const profileRole = authProfile?.role || 'Open profile'
  const profileInitials = authProfile?.initials || 'DL'

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
          autoHide ? 'is-auto-hidden' : '',
          autoHide && hoverPeek ? 'is-hover-peek' : '',
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

          {!compact && dataset && datasetProfile && (
            <div className="sidebar-dataset-card">
              <div className="sidebar-dataset-badge">Dataset loaded</div>
              <p className="sidebar-dataset-meta">{(datasetProfile.totalRowCount || datasetProfile.rowCount).toLocaleString()} rows</p>
              <p className="sidebar-dataset-submeta">{datasetProfile.totalColumnCount || datasetProfile.columnCount} columns profiled</p>
            </div>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Data pipeline navigation">
          <div
            className="sidebar-step-line"
            style={{ '--progress-stop': `${((NAV_ITEMS.findIndex(item => item.key === currentStep) + 1) / NAV_ITEMS.length) * 100}%` }}
          />

          {NAV_ITEMS.map((item) => {
            const isActive = currentStep === item.key
            const isCompleted = Boolean(completedSteps[item.key])
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
                    <span className="sidebar-step-icon">
                      <StepIcon iconKey={item.iconKey} />
                    </span>
                  </span>
                  {!compact && (
                    <span className="sidebar-step-copy">
                      <span className="sidebar-step-label">{item.label}</span>
                      <span className="sidebar-step-meta">{item.meta}</span>
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {!compact && (
            <button
              type="button"
              className="sidebar-profile"
              onClick={() => {
                setStep('profile')
                onCloseMobile()
              }}
              title="Open profile"
              style={{
                width: '100%',
                textAlign: 'left',
                background: currentStep === 'profile' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                border: currentStep === 'profile' ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid transparent',
                borderRadius: '16px',
                padding: '0.65rem 0.75rem',
                transition: 'all 0.25s ease',
              }}
            >
              <div className="sidebar-profile-avatar">{profileInitials}</div>
              <div>
                <p className="sidebar-profile-name">{profileName}</p>
                <p className="sidebar-profile-role">{profileRole}</p>
              </div>
            </button>
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
