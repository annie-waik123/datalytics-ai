import { useEffect, useMemo, useState } from 'react'
import { buildDatasetSummary } from '../lib/dataUtils.js'
import { useToast } from '../hooks/useToast.js'
import { DEFAULT_DATASET_INTELLIGENCE_PROMPT } from '../utils/aiIntelligence.js'
import { generateInsights } from '../utils/groq.js'

const STORAGE_KEY = 'datalytics_ai_insights'

function SectionFrame({ title, icon, children }) {
  return (
    <section className="insight-section">
      <div className="insight-section-title">
        <span className="insight-icon">{icon}</span>
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

function IntelligenceList({ items, renderItem, empty }) {
  if (!items?.length) {
    return <div className="insight-summary">{empty}</div>
  }

  return (
    <div className="insight-grid">
      {items.map((item, index) => (
        <article key={`${index}-${JSON.stringify(item)}`} className="insight-card intelligence-card">
          {renderItem(item)}
        </article>
      ))}
    </div>
  )
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'good') return 'good'
  if (normalized === 'critical') return 'critical'
  return 'warning'
}

function alertTone(level) {
  const normalized = String(level || '').toLowerCase()
  if (normalized === 'critical') return 'critical'
  if (normalized === 'info') return 'info'
  return 'warning'
}

export default function RecommendationStep({ dataset, datasetProfile, onComplete, onJumpToUpload }) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [intelligence, setIntelligence] = useState(null)
  const [error, setError] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to generate insights</h2>
        <p>Recommendations, predictions, alerts, and KPI health are produced after profiling your dataset.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const summary = useMemo(() => buildDatasetSummary(dataset, datasetProfile), [dataset, datasetProfile])
  const responseJson = useMemo(() => (
    intelligence ? JSON.stringify(intelligence, null, 2) : ''
  ), [intelligence])

  useEffect(() => {
    setIntelligence(null)
    setStatusMessage('')
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.dataset_name && parsed.dataset_name !== dataset?.name) return
      setIntelligence(parsed)
      setStatusMessage(parsed?.notice || '')
    } catch {
      // Ignore stale local storage payloads.
    }
  }, [dataset?.name])

  async function handleGenerate() {
    if (loading) return
    setLoading(true)
    setError(null)
    setStatusMessage('')

    try {
      const result = await generateInsights(summary, DEFAULT_DATASET_INTELLIGENCE_PROMPT)
      const storedResult = {
        ...result,
        dataset_name: dataset?.name || 'Dataset',
      }
      setIntelligence(storedResult)
      setStatusMessage(storedResult.notice || '')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedResult))
      onComplete('recommendations')
    } catch (err) {
      const message = 'Failed to generate structured intelligence. Please retry.'
      setError(message)
      addToast(message, () => handleGenerate(), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopyJson() {
    if (!responseJson) return
    await navigator.clipboard.writeText(responseJson)
    addToast('Structured JSON copied.', null, 'success')
  }

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(DEFAULT_DATASET_INTELLIGENCE_PROMPT)
    addToast('Dataset intelligence prompt copied.', null, 'success')
  }

  return (
    <div className="rec-container">
      <div className="rec-header">
        <div>
          <h2 className="rec-title">Recommendations &amp; Insights</h2>
          <p className="rec-subtitle">Text-first intelligence engine for trends, root causes, alerts, predictions, and executive decisions.</p>
        </div>
        <div className="intelligence-actions">
          <button className="btn btn-secondary" type="button" onClick={handleCopyPrompt}>
            Copy Prompt
          </button>
          <button className="btn btn-secondary" type="button" onClick={handleCopyJson} disabled={!intelligence}>
            Copy JSON
          </button>
          <button className="btn btn-primary" type="button" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : intelligence ? 'Regenerate Intelligence' : 'Generate Intelligence'}
          </button>
        </div>
      </div>

      <SectionFrame title="Prompt Used" icon={<IconPrompt />}>
        <div className="insight-summary intelligence-prompt-card">
          {DEFAULT_DATASET_INTELLIGENCE_PROMPT}
        </div>
      </SectionFrame>

      {loading ? (
        <div className="typing-indicator">
          <span />
          <span />
          <span />
          <span className="typing-label">AI is preparing a structured intelligence response...</span>
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-warning">{error}</div>
      ) : null}

      {statusMessage && !error ? (
        <div className="alert alert-warning">{statusMessage}</div>
      ) : null}

      {intelligence ? (
        <div className="insight-results">
          <SectionFrame title="Executive Summary" icon={<IconSummary />}>
            <div className="insight-summary intelligence-summary-card">
              {intelligence.summary || 'No summary available.'}
            </div>
          </SectionFrame>

          <SectionFrame title="AI Insights" icon={<IconBulb />}>
            <IntelligenceList
              items={intelligence.insights}
              empty="No structured insights were returned."
              renderItem={(item) => (
                <>
                  <div className="intelligence-card-head">
                    <span className="intelligence-chip">{item.type}</span>
                  </div>
                  <div className="insight-body">{item.message}</div>
                </>
              )}
            />
          </SectionFrame>

          <SectionFrame title="Actionable Recommendations" icon={<IconAction />}>
            <IntelligenceList
              items={intelligence.recommendations}
              empty="No actionable recommendations were returned."
              renderItem={(item) => (
                <>
                  <div className="intelligence-card-head">
                    <span className="intelligence-chip is-muted">{item.based_on}</span>
                  </div>
                  <div className="insight-body">{item.action}</div>
                </>
              )}
            />
          </SectionFrame>

          <SectionFrame title="Predictions" icon={<IconForecast />}>
            <IntelligenceList
              items={intelligence.predictions}
              empty="Not enough evidence was available for a reliable prediction."
              renderItem={(item) => (
                <>
                  <div className="intelligence-card-head">
                    <strong>{item.metric}</strong>
                    <span className="intelligence-chip is-info">{item.confidence}</span>
                  </div>
                  <div className="insight-body">{item.forecast}</div>
                </>
              )}
            />
          </SectionFrame>

          <SectionFrame title="Alerts" icon={<IconAlert />}>
            <IntelligenceList
              items={intelligence.alerts}
              empty="No critical or warning alerts were triggered."
              renderItem={(item) => (
                <>
                  <div className="intelligence-card-head">
                    <span className={`intelligence-chip is-${alertTone(item.level)}`}>{item.level}</span>
                  </div>
                  <div className="insight-body">{item.message}</div>
                </>
              )}
            />
          </SectionFrame>

          <SectionFrame title="KPI Health" icon={<IconShield />}>
            <IntelligenceList
              items={intelligence.kpi_status}
              empty="No KPI health statuses were generated."
              renderItem={(item) => (
                <>
                  <div className="intelligence-card-head">
                    <strong>{item.metric}</strong>
                    <span className={`intelligence-chip is-${statusTone(item.status)}`}>{item.status}</span>
                  </div>
                </>
              )}
            />
          </SectionFrame>

          <SectionFrame title="Decision Engine" icon={<IconDecision />}>
            <IntelligenceList
              items={intelligence.decisions}
              empty="No strategic decisions were generated."
              renderItem={(item) => <div className="insight-body">{item.suggestion}</div>}
            />
          </SectionFrame>

          <SectionFrame title="API JSON Response" icon={<IconJson />}>
            <div className="insight-summary intelligence-json">
              <pre>{responseJson}</pre>
            </div>
          </SectionFrame>
        </div>
      ) : null}
    </div>
  )
}

function IconBulb() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21h6m-5-3h4m-2-1a7 7 0 10-5.3-11.6 7 7 0 002.3 11.6v1h6v-1a7 7 0 003-5.7" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l7 3v6c0 5-3.5 9-7 11-3.5-2-7-6-7-11V5l7-3z" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 9v4m0 4h.01M10 3h4l6 18H4L10 3z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSummary() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function IconAction() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h7m0 0-3-3m3 3-3 3m3 0h9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconForecast() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17l5-5 4 2 7-7M18 7h2v2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconDecision() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v6m0 0 3-3m-3 3-3-3M5 21h14M7 15h10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconJson() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5c-1.7 0-3 1.3-3 3v1c0 1.1-.9 2-2 2 1.1 0 2 .9 2 2v1c0 1.7 1.3 3 3 3m8-12c1.7 0 3 1.3 3 3v1c0 1.1.9 2 2 2-1.1 0-2 .9-2 2v1c0 1.7-1.3 3-3 3m-4-10v12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPrompt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 8h10M7 12h7M7 16h5M5 4h14a2 2 0 0 1 2 2v12l-4-2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
