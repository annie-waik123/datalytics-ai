import { useState } from 'react'
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowUpTray,
  HiOutlineChartBarSquare,
  HiOutlineChatBubbleLeftRight,
  HiOutlineChevronDoubleLeft,
  HiOutlineChevronDoubleRight,
  HiOutlineCommandLine,
  HiOutlineCpuChip,
  HiOutlineDocumentText,
  HiOutlineLightBulb,
  HiOutlineMagnifyingGlassCircle,
  HiOutlinePresentationChartBar,
  HiOutlineSparkles,
  HiOutlineXMark,
} from 'react-icons/hi2'



const NAV_ITEMS = [
  { key: 'upload', label: 'Dataset Upload', icon: HiOutlineArrowUpTray },
  { key: 'exploration', label: 'Data Exploration', icon: HiOutlineMagnifyingGlassCircle },
  { key: 'preparation', label: 'Data Preparation', icon: HiOutlineAdjustmentsHorizontal },
  { key: 'visualization', label: 'Visualization', icon: HiOutlinePresentationChartBar },
  { key: 'prediction', label: 'Prediction', icon: HiOutlineCpuChip },
  { key: 'powerbi', label: 'Power BI Dashboard', icon: HiOutlineChartBarSquare },
  { key: 'recommendations', label: 'Recommendations', icon: HiOutlineSparkles },
  { key: 'decisionMaking', label: 'Decision Making', icon: HiOutlineLightBulb },
  { key: 'aiInsights', label: 'AI Insights', icon: HiOutlineChatBubbleLeftRight },
  { key: 'analyst', label: 'AI Analyst', icon: HiOutlineCommandLine },
  { key: 'reports', label: 'Reports', icon: HiOutlineDocumentText },
]

const DEFAULT_COMPLETED_FALLBACK = {}
const DEFAULT_PREDICTION_FALLBACK = { completed: {} }

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
  progress,
}) {
  const [showAbout, setShowAbout] = useState(false)
  const compact = collapsed && !mobileOpen
  const safeCompletedSteps = completedSteps || {}
  const totalSteps = progress?.totalSteps || Object.keys(safeCompletedSteps).length || NAV_ITEMS.length
  const completedCount = progress?.completedCount || Object.values(safeCompletedSteps).filter(Boolean).length
  const completionRate = totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0
  const profileName = authProfile?.fullName || 'Datalytics User'
  const profileRole = authProfile?.role || 'Analytics Workspace'
  const profileInitials = authProfile?.initials || 'DL'
  const predictionCompletedCount = Object.values(predictionState?.completed || {}).filter(Boolean).length
  const predictionStatusDone = [
    'preprocessing_done',
    'supervised_done',
    'unsupervised_done',
    'best_done',
    'predict_done',
    'download_done',
  ].filter((key) => Boolean(predictionStatus?.[key])).length
  const datasetRows = datasetProfile?.totalRowCount || datasetProfile?.rowCount || dataset?.rows?.length || 0
  const datasetCols = datasetProfile?.totalColumnCount || datasetProfile?.columnCount || dataset?.columns?.length || 0

  function closeIfMobile() {
    if (typeof onCloseMobile === 'function') onCloseMobile()
  }

  function handleNavigate(stepKey) {
    setStep(stepKey)
    if (stepKey === 'prediction') setPredictionModule('preprocessing')
    closeIfMobile()
  }

  return (
    <>
      <div
        className={`ds-sidebar-backdrop ${mobileOpen ? 'is-visible' : ''}`}
        onClick={closeIfMobile}
      />

      <aside
        className={[
          'ds-sidebar',
          compact ? 'is-collapsed' : '',
          autoHide ? 'is-auto-hidden' : '',
          autoHide && hoverPeek ? 'is-hover-peek' : '',
          mobileOpen ? 'is-mobile-open' : '',
        ]
          .join(' ')
          .trim()}
      >
        <div className="ds-sidebar-glow" />

        <div className="ds-sidebar-head" style={{ paddingTop: '12px' }}>

          <a href="/" className={`flex items-center ${compact ? 'justify-center p-2 mx-1 rounded-[16px]' : 'gap-3 px-4 py-3 mx-2 rounded-[20px]'} bg-slate-900/60 border border-white/5 shadow-lg relative overflow-hidden group cursor-pointer hover:bg-slate-800/60 transition-colors`} style={{ marginTop: '-12px', textDecoration: 'none' }}>
            {/* 3D Logo */}
            <div style={{
              position: 'relative',
              width: '28px',
              height: '22px',
              flexShrink: 0,
              perspective: '120px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '3px',
              zIndex: 10,
            }}>
              {/* Ambient glow */}
              <div style={{
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '26px',
                height: '6px',
                background: 'radial-gradient(ellipse, rgba(255,120,30,0.55) 0%, transparent 70%)',
                filter: 'blur(4px)',
                borderRadius: '50%',
                animation: 'logo3dPulse 2.5s ease-in-out infinite',
              }} />
              {[{ h: '65%', delay: '0s' }, { h: '100%', delay: '0.15s' }, { h: '80%', delay: '0.3s' }].map((bar, i) => (
                <div key={i} style={{
                  position: 'relative',
                  width: '6px',
                  height: bar.h,
                  borderRadius: '2px',
                  background: 'linear-gradient(180deg, #ffb347 0%, #ff6d00 40%, #cc2800 100%)',
                  boxShadow: '0 2px 8px rgba(255,100,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)',
                  transform: 'rotateX(18deg) rotateY(-6deg) scaleY(1)',
                  transformStyle: 'preserve-3d',
                  transformOrigin: 'bottom',
                  animation: `logo3dWave 1.2s ease-in-out ${i * 0.3}s infinite alternate`,
                }}>
                  {/* Top highlight */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '40%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)',
                    borderRadius: '3px 3px 0 0',
                  }} />
                  {/* Right-edge shadow */}
                  <div style={{
                    position: 'absolute',
                    top: 0, right: 0,
                    width: '30%',
                    height: '100%',
                    background: 'linear-gradient(270deg, rgba(0,0,0,0.35) 0%, transparent 100%)',
                    borderRadius: '0 3px 3px 0',
                  }} />
                </div>
              ))}
              <style>{`
                @keyframes logo3dWave {
                  0% { transform: rotateX(18deg) rotateY(-6deg) scaleY(1); }
                  100% { transform: rotateX(18deg) rotateY(-6deg) scaleY(0.3); }
                }
                @keyframes logo3dPulse {
                  0%, 100% { opacity: 0.5; transform: translateX(-50%) scaleX(1); }
                  50% { opacity: 0.9; transform: translateX(-50%) scaleX(1.2); }
                }
              `}</style>
            </div>
            {!compact ? (
              <span className="text-[20px] font-black tracking-[-0.03em] text-white drop-shadow-sm ml-1 relative z-10">
                Datalytics
              </span>
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
          </a>

        </div>

        {dataset && datasetProfile && !compact ? (
          <div className="ds-sidebar-dataset-card" style={{
            padding: '8px 14px',
            margin: '2px 14px 8px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '8px', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rows</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '1px', lineHeight: '1' }}>{datasetRows.toLocaleString()}</div>
            </div>
            
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 6px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '4px' }}>
              Loaded
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '8px', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Columns</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '1px', lineHeight: '1' }}>{datasetCols.toLocaleString()}</div>
            </div>
          </div>
        ) : null}

        {!compact ? (
          <div className="ds-sidebar-progress" style={{ marginTop: '0px' }}>
            <div className="ds-sidebar-progress-head">
              <span>Workflow Progress</span>
              <strong>{completionRate}%</strong>
            </div>
            <div className="ds-sidebar-progress-track">
              <span style={{ width: `${completionRate}%` }} />
            </div>
            <p>{completedCount} of {totalSteps} pipeline steps completed</p>
          </div>
        ) : null}

        <div className="ds-sidebar-section ds-sidebar-workflow">
          {!compact ? <p className="ds-sidebar-section-title">Pipeline Modules</p> : null}
          <nav className="ds-sidebar-nav" aria-label="Data pipeline navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = currentStep === item.key
              const isCompleted = Boolean(completedSteps[item.key])
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`ds-sidebar-step${isActive ? ' is-active' : ''}${isCompleted ? ' is-done' : ''}`}
                  onClick={() => handleNavigate(item.key)}
                  title={item.label}
                >
                  <span className="ds-sidebar-step-icon">
                    <Icon />
                  </span>
                  {!compact ? (
                    <span className="ds-sidebar-step-copy">
                      <strong>{item.label}</strong>
                      <small>{isCompleted ? 'Completed' : 'In progress'}</small>
                    </span>
                  ) : null}
                  {!compact && isCompleted ? <span className="ds-sidebar-step-state">Done</span> : null}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="ds-sidebar-foot">
          {!compact ? (
            <button
              type="button"
              className="ds-sidebar-profile hover:bg-white/5 transition"
              onClick={() => setShowAbout(true)}
              title="About Datalytics"
            >
              <span className="ds-sidebar-profile-avatar" style={{ background: 'var(--cyan-400)', color: 'var(--slate-950)' }}>
                <HiOutlineSparkles className="w-5 h-5 mx-auto" style={{marginTop: '2px'}} />
              </span>
              <span className="ds-sidebar-profile-copy">
                <strong>About App</strong>
                <small>v1.18</small>
              </span>
            </button>
          ) : null}

          <button
            type="button"
            className="ds-sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {compact ? <HiOutlineChevronDoubleRight /> : <HiOutlineChevronDoubleLeft />}
          </button>
        </div>
      </aside>

      {showAbout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[20px] border border-cyan-400/20 bg-[#0f172a] shadow-[0_0_50px_rgba(0,198,255,0.15)] overflow-hidden">
            {/* MacOS Window Controls Header */}
            <div className="flex z-50 items-center justify-end px-5 py-3.5 bg-white/[0.02] border-b border-white/5 relative">
              <div className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold text-slate-400 tracking-wide">About Eighteen AI</div>
              <button 
                type="button" 
                onClick={() => setShowAbout(false)} 
                className="w-4 h-4 rounded-full bg-[#ff5f56] border border-[#e0443e] hover:bg-rose-400 transition shadow-[0_0_10px_rgba(255,95,86,0.3)] shadow-[#ff5f56] hover:scale-110" 
                title="Close" 
              />
            </div>

            {/* Scrollable Content */}
            <div className="p-8 overflow-hidden relative">
              <div className="flex items-center gap-5 mb-8 relative z-10">
                {/* 3D Logo — About Modal (large) */}
                <div style={{
                  position: 'relative',
                  width: '60px',
                  height: '60px',
                  flexShrink: 0,
                  perspective: '200px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  boxShadow: '0 0 30px rgba(255,100,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: '6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '44px',
                    height: '10px',
                    background: 'radial-gradient(ellipse, rgba(255,120,30,0.6) 0%, transparent 70%)',
                    filter: 'blur(5px)',
                    borderRadius: '50%',
                    animation: 'logo3dPulse 2.5s ease-in-out infinite',
                  }} />
                  {[{ h: '65%', delay: '0s' }, { h: '100%', delay: '0.15s' }, { h: '80%', delay: '0.3s' }].map((bar, i) => (
                    <div key={i} style={{
                      position: 'relative',
                      width: '10px',
                      height: bar.h,
                      borderRadius: '4px',
                      background: 'linear-gradient(180deg, #ffb347 0%, #ff6d00 40%, #cc2800 100%)',
                      boxShadow: '0 3px 12px rgba(255,100,0,0.6), inset 0 1px 0 rgba(255,255,255,0.35)',
                      transform: 'rotateX(18deg) rotateY(-6deg) scaleY(1)',
                      transformStyle: 'preserve-3d',
                      transformOrigin: 'bottom',
                      animation: `logo3dWave 1.2s ease-in-out ${i * 0.3}s infinite alternate`,
                    }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0,
                        height: '40%',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)',
                        borderRadius: '4px 4px 0 0',
                      }} />
                      <div style={{
                        position: 'absolute', top: 0, right: 0,
                        width: '30%', height: '100%',
                        background: 'linear-gradient(270deg, rgba(0,0,0,0.35) 0%, transparent 100%)',
                        borderRadius: '0 4px 4px 0',
                      }} />
                    </div>
                  ))}
                </div>
                <div>
                  <h2 className="text-4xl font-bold text-white tracking-tight">Datalytics <span className="text-cyan-400 font-normal">AI</span></h2>
                  <p className="text-slate-400 font-mono text-sm mt-1">v1.18 • Enterprise Autonomous Edition</p>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <p className="text-slate-300 leading-relaxed text-lg">
                  Welcome to Eighteen AI, the next-generation autonomous analytics operating system. 
                  Designed for data scientists, product managers, and founders to rapidly ingest, profile, query, and visualize big data interactively without context-switching.
                </p>

                <div className="mt-8">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><HiOutlineCpuChip className="text-cyan-400"/> End-to-End Analytics Pipeline</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-[16px] border border-white/5 bg-white/5 hover:bg-white/10 transition">
                      <h4 className="text-cyan-300 font-semibold mb-1 text-sm uppercase tracking-wide">1. Data Ingestion & Profile</h4>
                      <p className="text-sm text-slate-400">Intelligent CSV parsing with automatic schema inference. Detects anomalies, outliers, and generates instant column data profiles.</p>
                    </div>
                    <div className="p-4 rounded-[16px] border border-white/5 bg-white/5 hover:bg-white/10 transition">
                      <h4 className="text-cyan-300 font-semibold mb-1 text-sm uppercase tracking-wide">2. Automated Data Cleaning</h4>
                      <p className="text-sm text-slate-400">Fixes unhandled missing values, deduplicates rows, drops extreme outliers, and encodes categorical attributes without writing code.</p>
                    </div>
                    <div className="p-4 rounded-[16px] border border-white/5 bg-white/5 hover:bg-white/10 transition">
                      <h4 className="text-cyan-300 font-semibold mb-1 text-sm uppercase tracking-wide">3. Visual Workspaces</h4>
                      <p className="text-sm text-slate-400">Interactive ad-hoc charting built on Recharts, enabling cross-filtering, pivoting, and 12+ statistical chart aggregations.</p>
                    </div>
                    <div className="p-4 rounded-[16px] border border-white/5 bg-white/5 hover:bg-white/10 transition">
                      <h4 className="text-cyan-300 font-semibold mb-1 text-sm uppercase tracking-wide">4. Dynamic Dashboards</h4>
                      <p className="text-sm text-slate-400">Save visual views into a fully modular drag-and-drop dashboard canvas that resembles executive-level reporting UI.</p>
                    </div>
                    <div className="p-4 rounded-[16px] border border-white/5 bg-white/5 hover:bg-white/10 transition">
                      <h4 className="text-cyan-300 font-semibold mb-1 text-sm uppercase tracking-wide">5. Predictive Machine Learning</h4>
                      <p className="text-sm text-slate-400">Train Random Forests, Logistic Regressions, and KMeans Clustering visually. Generate matrix evaluations and download predictions instantly.</p>
                    </div>
                    <div className="p-4 rounded-[16px] border border-white/5 bg-white/5 hover:bg-white/10 transition">
                      <h4 className="text-cyan-300 font-semibold mb-1 text-sm uppercase tracking-wide">6. AI Assistant & Full PDF Reports</h4>
                      <p className="text-sm text-slate-400">Talk to your data leveraging Groq Llama 3 agents. Export entire datasets and pipeline artifacts directly to deeply-styled branded PDF reports.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-white/10">
                   <span className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-[8px] font-mono border border-white/10 shadow cursor-default">React 18 + Vite</span>
                   <span className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-[8px] font-mono border border-white/10 shadow cursor-default">Groq LLaMA 3.3 API</span>
                   <span className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-[8px] font-mono border border-white/10 shadow cursor-default">Python FastAPI Backend</span>
                   <span className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-[8px] font-mono border border-white/10 shadow cursor-default">Pandas / Scikit-Learn</span>
                </div>
              </div>
              
              {/* Background Glow */}
              <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute top-10 -left-10 w-64 h-64 bg-rose-500/5 rounded-full blur-[80px] pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
