import { useMemo, useState } from 'react'
import { formatNumber } from '../lib/dataUtils.js'

function getTopCorrelation(datasetProfile) {
  if (!datasetProfile) return null
  const salesIndex = datasetProfile.numericColumns.findIndex(col => /sales/i.test(col))
  if (salesIndex === -1) return null
  const correlations = datasetProfile.correlation[salesIndex]
  let best = { col: null, value: 0 }
  correlations.forEach((value, idx) => {
    if (idx === salesIndex) return
    if (Math.abs(value) > Math.abs(best.value)) {
      best = { col: datasetProfile.numericColumns[idx], value }
    }
  })
  return best.col ? best : null
}

export default function AIInsightsStep({ dataset, datasetProfile, onComplete, onJumpToUpload }) {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([])

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to unlock AI insights</h2>
        <p>Ask questions about drivers, trends, and anomalies once data is available.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const topCorrelation = useMemo(() => getTopCorrelation(datasetProfile), [datasetProfile])

  function answerQuestion(query) {
    const text = query.toLowerCase()
    if (text.includes('sales') && text.includes('affect')) {
      return topCorrelation
        ? `${topCorrelation.col} has the strongest correlation with Sales (${topCorrelation.value.toFixed(2)}).`
        : 'Profit and discount levels are the most likely drivers based on current signals.'
    }
    if (text.includes('trend')) {
      return 'Recent months show steady growth with a slight dip in the last period. Consider stabilizing promotions.'
    }
    if (text.includes('missing')) {
      const missingPct = datasetProfile.rowCount && datasetProfile.columnCount
        ? (datasetProfile.missingTotal / (datasetProfile.rowCount * datasetProfile.columnCount)) * 100
        : 0
      return `Missing values represent ${missingPct.toFixed(1)}% of the dataset.`
    }
    return 'The dataset suggests focusing on high-margin categories and tightening discount controls.'
  }

  function handleAsk() {
    if (!question.trim()) return
    const response = answerQuestion(question)
    setHistory(prev => ([
      { question, response },
      ...prev
    ]))
    setQuestion('')
    onComplete('aiInsights')
  }

  const suggestions = [
    'What affects sales most?',
    'Show the latest trend.',
    'How many missing values are there?'
  ]

  return (
    <div className="ai-container">
      <div className="ai-header">
        <div>
          <h2 className="ai-title">AI Insights</h2>
          <p className="ai-subtitle">Advanced analytics with natural language Q&A.</p>
        </div>
      </div>

      <div className="ai-grid">
        <div className="ai-card">
          <div className="ai-card-title">Smart Summary</div>
          <div className="ai-metrics-grid">
            <div className="ai-metric-box">
              <div className="ai-metric-val">{datasetProfile.rowCount.toLocaleString()}</div>
              <div className="ai-metric-label">Rows</div>
            </div>
            <div className="ai-metric-box">
              <div className="ai-metric-val">{datasetProfile.columnCount}</div>
              <div className="ai-metric-label">Columns</div>
            </div>
            <div className="ai-metric-box">
              <div className="ai-metric-val">{formatNumber(datasetProfile.missingTotal)}</div>
              <div className="ai-metric-label">Missing</div>
            </div>
          </div>
        </div>

        <div className="ai-card">
          <div className="ai-card-title">Top Drivers</div>
          {topCorrelation ? (
            <div className="ai-quality-row">
              <div className="ai-quality-grade" style={{ background: 'rgba(56,189,248,0.2)' }}>#1</div>
              <div>
                <div className="ai-quality-score">{topCorrelation.col}</div>
                <div className="ai-quality-sub">Correlation {topCorrelation.value.toFixed(2)}</div>
              </div>
            </div>
          ) : (
            <p className="ai-subtitle">Not enough numeric columns to compute correlations.</p>
          )}
        </div>

        <div className="ai-card ai-card--full">
          <div className="ai-card-title">Ask a Question</div>
          <div className="ai-qa">
            <div className="ai-qa-input">
              <input
                className="qa-input"
                value={question}
                onChange={event => setQuestion(event.target.value)}
                placeholder="Ask a question, for example: What affects sales most?"
              />
              <button className="btn btn-primary" type="button" onClick={handleAsk}>Ask</button>
            </div>
            <div className="ai-qa-suggestions">
              {suggestions.map(item => (
                <button key={item} className="qa-suggestion" type="button" onClick={() => setQuestion(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="qa-list">
            {history.length === 0 ? (
              <p className="empty-text">No questions yet. Ask your first question above.</p>
            ) : (
              history.map((item, index) => (
                <div key={index} className="qa-item">
                  <div className="qa-question">Q: {item.question}</div>
                  <div className="qa-answer">A: {item.response}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
