const STEPS = [
  { key: 'upload',     icon: '☁️',  label: 'Upload',     requires: null },
  { key: 'preprocess', icon: '⚙️',  label: 'Preprocess', requires: 'has_data' },
  { key: 'train',      icon: '🧠',  label: 'Train',      requires: 'preprocessing_done' },
  { key: 'predict',    icon: '🎯',  label: 'Predict',    requires: 'supervised_done' },
  { key: 'download',   icon: '📥',  label: 'Download',   requires: 'supervised_done' },
]

export default function Navbar({ currentStep, setStep, status }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">🤖 ML Dashboard</div>
      <div className="nav-steps">
        {STEPS.map((s, i) => {
          const locked = s.requires && !status[s.requires]
          const done   = stepDone(s.key, status)
          const active = currentStep === s.key

          return (
            <button
              key={s.key}
              className={`nav-step ${active ? 'active' : ''} ${locked ? 'locked' : ''} ${done && !active ? 'done' : ''}`}
              onClick={() => !locked && setStep(s.key)}
              title={locked ? 'Complete previous steps first' : ''}
            >
              <span className={`step-badge ${active ? 'active' : done ? 'done' : ''}`}>
                {done ? '✓' : i + 1}
              </span>
              <span>{s.icon} {s.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function stepDone(key, status) {
  switch (key) {
    case 'upload':     return status.has_data
    case 'preprocess': return status.preprocessing_done
    case 'train':      return status.supervised_done
    case 'predict':    return status.has_predictions
    case 'download':   return false
    default:           return false
  }
}
