import { useEffect, useState } from 'react'
import { useToast } from '../hooks/useToast.js'
import { generateRecommendationInsights, syncInsightsDataset } from '../api/insights.js'

const STORAGE_KEY = 'datalytics_decision_making_json'

const DECISION_PROMPT = `You are an AI Decision Engine.

When the user clicks "Evaluate Scenarios", generate REAL-WORLD DECISIONS based on the dataset.

Your goal is to tell:
👉 What should be DONE next (not just analysis)

Convert patterns into actions:
* High-performing → KEEP / SCALE / INVEST MORE
* Low-performing → IMPROVE / DISCOUNT / REMOVE
* Increasing trend → PREPARE / STOCK / EXPAND
* Decreasing trend → REDUCE / STOP / FIX
* Outliers → INVESTIGATE / CLEAN

========================
OUTPUT FORMAT (STRICT JSON ONLY)
================================
Return EXACTLY a valid JSON object. DO NOT include markdown wrappers like triple-backticks or json blocks.
{
  "top_decisions": [
    {
      "decision": "Concrete action to take",
      "reason": "Why this action?",
      "expected_outcome": "What will happen?",
      "priority": "High | Medium | Low"
    }
  ],
  "inventory_decisions": [
    {
      "category": "Increase | Maintain | Reduce | Remove",
      "entities": "Which products or segments?",
      "action": "Specific step to execute"
    }
  ],
  "growth_opportunities": [
    { "opportunity": "Where to invest or scale" }
  ],
  "losses_problems": [
    { "problem": "What is causing loss", "fix": "How to fix it" }
  ],
  "future_strategy": [
    { "strategy": "What will happen next", "preparation": "What to prepare" }
  ],
  "smart_actions": [
    { "automation": "Automation or optimization step" }
  ]
}

STRICT RULES:
* Give DIRECT decisions (BUY / SELL / REMOVE / IMPROVE / SCALE)
* Avoid generic lines
* Use real-world language
* Mention specific entities (if available)
`

function normalizePayload(response) {
  let content = response?.generated_response?.content || response?.content || ''
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.warn("Decision engine JSON parsing failed", e)
  }
  
  return null
}

export default function DecisionMakingStep({ dataset, datasetProfile, onComplete, onJumpToUpload }) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setData(JSON.parse(raw))
      }
    } catch {}
  }, [])

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to enable decision making</h2>
        <p>Strategic scenarios and decision optimization are available after profiling your dataset.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const handleEvaluate = async () => {
    setLoading(true)
    setError(null)
    try {
      await syncInsightsDataset(dataset)
      const res = await generateRecommendationInsights(DECISION_PROMPT, 'recommendation_insights')
      const parsed = normalizePayload(res)
      
      if (!parsed) {
         throw new Error("API returned invalid format")
      }

      setData(parsed)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      addToast('Executive decisions successfully generated.', null, 'success')
      onComplete('decisionMaking')

    } catch (err) {
      console.error("ERROR:", err)
      const msg = err?.response?.data?.detail || err.message || 'Decision generation failed'
      setError(msg)
      
      setData({
        top_decisions: [
          {
            decision: "No structured data available",
            reason: msg,
            expected_outcome: "No automated output",
            priority: "Low"
          }
        ],
        inventory_decisions: [],
        growth_opportunities: [],
        losses_problems: [],
        future_strategy: [],
        smart_actions: []
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rec-container">
      <div className="rec-header">
        <div>
          <h2 className="rec-title">Decision Engine</h2>
          <p className="rec-subtitle">Receive instant, action-oriented executive business decisions based on data patterns.</p>
        </div>
        <div className="intelligence-actions">
          <button className="btn btn-primary" type="button" onClick={handleEvaluate} disabled={loading}>
            {loading ? 'Evaluating...' : data ? 'Re-evaluate Scenarios' : 'Evaluate Scenarios'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="typing-indicator" style={{ marginTop: '20px', marginBottom: '20px' }}>
          <span />
          <span />
          <span />
          <span className="typing-label">The AI Decision Engine is assessing patterns and formatting outcomes...</span>
        </div>
      )}

      {error && !loading && (
        <div className="alert alert-warning" style={{ marginTop: '20px' }}>{error} - using fallback standard view.</div>
      )}

      {data && !loading && (
        <div className="insight-results" style={{ marginTop: '2rem' }}>
          
          {data.top_decisions?.length > 0 && (
            <div className="insight-section">
              <div className="insight-section-title">🚀 Top Decisions</div>
              <div className="insight-grid">
                {data.top_decisions.map((top, idx) => (
                  <div key={`top-${idx}`} className="insight-card intelligence-card border-success">
                    <div className="intelligence-card-head">
                      <span className="intelligence-chip is-good">Priority: {top.priority || 'High'}</span>
                    </div>
                    <div className="insight-body">
                      <p><strong>🎯 Decision:</strong> {top.decision}</p>
                      <p style={{ marginTop: '0.4rem' }}><strong>📊 Reason:</strong> {top.reason}</p>
                      <p style={{ marginTop: '0.4rem' }}><strong>📈 Impact:</strong> {top.expected_outcome || top.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.inventory_decisions?.length > 0 && (
            <div className="insight-section" style={{ marginTop: '2.5rem' }}>
              <div className="insight-section-title">📦 Inventory & Resource Actions</div>
              <div className="insight-grid">
                {data.inventory_decisions.map((inv, idx) => (
                  <div key={`inv-${idx}`} className="insight-card intelligence-card">
                    <div className="intelligence-card-head">
                      <span className="intelligence-chip is-info">{inv.category}</span>
                    </div>
                    <div className="insight-body">
                      <p><strong>Target:</strong> {inv.entities}</p>
                      <p style={{ marginTop: '0.4rem' }}><strong>Action:</strong> {inv.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.losses_problems?.length > 0 && (
            <div className="insight-section" style={{ marginTop: '2.5rem' }}>
              <div className="insight-section-title">⚠️ Losses & Problems</div>
              <div className="insight-grid">
                {data.losses_problems.map((ls, idx) => (
                  <div key={`ls-${idx}`} className="insight-card intelligence-card border-warning">
                    <div className="intelligence-card-head">
                      <span className="intelligence-chip is-warning">Issue Detected</span>
                    </div>
                    <div className="insight-body">
                      <p><strong>Cause:</strong> {ls.problem}</p>
                      <p style={{ marginTop: '0.4rem' }}><strong>Fix:</strong> {ls.fix}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.growth_opportunities?.length > 0 && (
            <div className="insight-section" style={{ marginTop: '2.5rem' }}>
              <div className="insight-section-title">💰 Growth Opportunities</div>
              <div className="insight-grid">
                {data.growth_opportunities.map((gro, idx) => (
                  <div key={`gro-${idx}`} className="insight-card intelligence-card">
                    <div className="insight-body" style={{ padding: '1rem' }}>
                      {gro.opportunity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.future_strategy?.length > 0 && (
            <div className="insight-section" style={{ marginTop: '2.5rem' }}>
              <div className="insight-section-title">📈 Future Strategy</div>
              <div className="insight-grid">
                {data.future_strategy.map((fs, idx) => (
                  <div key={`fs-${idx}`} className="insight-card intelligence-card">
                    <div className="intelligence-card-head">
                       <span className="intelligence-chip is-info">Preparation</span>
                    </div>
                    <div className="insight-body">
                      <p><strong>Outlook:</strong> {fs.strategy}</p>
                      <p style={{ marginTop: '0.4rem' }}><strong>Prepare:</strong> {fs.preparation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.smart_actions?.length > 0 && (
            <div className="insight-section" style={{ marginTop: '2.5rem' }}>
              <div className="insight-section-title">🤖 Smart Actions</div>
              <div className="insight-grid">
                {data.smart_actions.map((sa, idx) => (
                  <div key={`sa-${idx}`} className="insight-card intelligence-card">
                    <div className="insight-body" style={{ padding: '1rem' }}>
                      {sa.automation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
        </div>
      )}
      
      {!data && !loading && !error && (
         <div className="insight-card" style={{ marginTop: '2rem', textAlign: 'center', padding: '3rem' }}>
           <p className="text-muted">Click Evaluate Scenarios to generate executive decisions.</p>
         </div>
      )}
    </div>
  )
}
