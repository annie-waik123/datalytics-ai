import { useEffect, useMemo, useState } from 'react'
import { generateRecommendationInsights, syncInsightsDataset } from '../api/insights.js'
import { useToast } from '../hooks/useToast.js'
import { normalizeRecommendationPayload } from '../utils/chatbotModeParser.js'

const STORAGE_KEY = 'datalytics_ai_insights'
const RECOMMENDATION_PROMPT = `You are a Senior Data Scientist, Chief Data Officer (CDO), Chief Analytics Officer, and an AI Decision Engine combined into one high-performance intelligence system.
Your mission is to transform raw data into high-stakes, executive-level business intelligence. You don't just describe data; you decide what to do with it.

======================== 
STEP 1: MULTI-DOMAIN CONTEXT AWARENESS
============================== 
* Analyze the provided dataset's columns and values to automatically detect the domain (e.g., Finance, Retail, Healthcare, Logistics, Sports, etc.).
* Identify the primary entities (e.g., "SKU-452", "Patient-ID", "User-78"), core metrics (e.g., "LTV", "Conversion", "Yield"), and temporal patterns.
* Determine the "North Star" metric for this specific dataset context.

======================== 
STEP 2: DEEP ANALYTICS & PATTERN RECOGNITION
===================== 
* Detect: High/Low performers, seasonal trends, cyclical behaviors, and data anomalies.
* Identify correlations: "When X goes up, Y usually drops."
* Spot outliers: "Entity Z is performing 300% better than the average; why?"
* Imbalance detection: "80% of revenue comes from 20% of products."

======================== 
STEP 3: EXECUTIVE DECISION ENGINE
========================= 
Convert all analytical findings into a DECISION FRAMEWORK using these high-impact labels:
* SCALE/INVEST: For high-performing assets with room for growth.
* PIVOT/FIX: For assets with potential but showing poor current performance.
* DIVEST/STOP: For consistently underperforming assets draining resources.
* AUTOMATE: For repetitive patterns that can be handled by software.
* INVESTIGATE: For anomalies that suggest hidden risks or opportunities.

👉 Your goal is: Data -> Insight -> Decision -> Action -> ROI.

======================== 
OUTPUT FORMAT (STRICT JSON ONLY)
============================== 
You MUST return ONLY a valid JSON object. Do not include any text before or after the JSON.
{
  "summary": "EXECUTIVE SUMMARY: A concise 2-3 sentence overview of the dataset's 'health' and the primary strategic direction recommended.",
  "insights": [
    {
      "type": "Trend | Anomaly | Correlation | Distribution",
      "message": "Specific finding with actual values and percentage changes. (e.g., 'Revenue dropped 12% in Q3 despite increased traffic.')"
    }
  ],
  "recommendations": [
    {
      "based_on": "The specific data point or insight justifying this.",
      "action": "ACTION | BASED ON | EXPECTED RESULT | PRIORITY (High/Medium/Low)"
    }
  ],
  "predictions": [
    {
      "metric": "Key Entity or KPI Name",
      "forecast": "FUTURE OUTLOOK: Based on current trends, what happens in 3-6 months? How should we prepare today?",
      "confidence": "High/Medium/Low (based on data volatility)"
    }
  ],
  "alerts": [
    {
      "level": "critical | warning | info",
      "message": "Immediate risk or outlier that requires attention (e.g., 'Inventory for Product X will hit zero in 4 days at current rate.')"
    }
  ],
  "kpi_status": [
    {
      "metric": "ENTITY-WISE ANALYSIS",
      "status": "Name: [Entity] | Observation: [Pattern] | Decision: [Invest/Scale/Fix] | Expected Impact: [Value]"
    }
  ],
  "decisions": [
    {
      "suggestion": "SMART IMPROVEMENT: A high-level organizational change or automation strategy (e.g., 'Shift marketing budget from Facebook to LinkedIn based on 4x higher LTV.')"
    }
  ]
}

======================== 
COMMANDMENTS FOR THE AI
============= 
* NO FLUFF: Don't use words like "interesting", "notable", or "it seems". Use "confirmed", "significant", "critical".
* NO REPETITION: Every insight and recommendation must be unique.
* DOMAIN AGNOSTIC: Use the same logic for sports stats as for corporate finance.
* ACTION-FIRST: If you can't recommend an action, don't mention the insight.
* ACT AS A CDO: Think about long-term data health, governance, and business value.
* REAL-WORLD IMPACT: Ensure recommendations lead to direct ROI or efficiency gains.`

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

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to generate insights</h2>
        <p>Recommendations, predictions, alerts, and KPI health are produced after profiling your dataset.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  async function handleGenerate() {
    if (loading) return
    setLoading(true)
    setError(null)
    setStatusMessage('')

    try {
      await syncInsightsDataset(dataset)
      const response = await generateRecommendationInsights(RECOMMENDATION_PROMPT, 'recommendation_insights')
      const storedResult = normalizeRecommendationPayload(response, dataset?.name || 'Dataset')
      setIntelligence(storedResult)
      setStatusMessage(storedResult.notice || '')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedResult))
      onComplete('recommendations')
    } catch (err) {
      console.error("[generate error test]", err?.response?.data || err?.message || err);
      const errDetail = err?.response?.data?.detail || err?.message || String(err)
      const message = `Failed to generate structured intelligence: ${errDetail}`
      setError(message)
      addToast(message, () => handleGenerate(), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rec-container">
      <div className="rec-header">
        <div>
          <h2 className="rec-title">Recommendations &amp; Insights</h2>
          <p className="rec-subtitle">Text-first intelligence engine for trends, root causes, alerts, predictions, and executive decisions.</p>
        </div>
        <div className="intelligence-actions">
          <button className="btn btn-primary" type="button" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : intelligence ? 'Regenerate Recommendations' : 'Generate Recommendations'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="typing-indicator">
          <span />
          <span />
          <span />
          <span className="typing-label">The backend chatbot is preparing recommendation insights...</span>
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


