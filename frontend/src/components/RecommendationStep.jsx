import { useMemo, useState } from 'react'
import { formatNumber, toNumber } from '../lib/dataUtils.js'

const SEV_CONFIG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: '#ef4444', label: 'CRITICAL' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', label: 'WARNING' },
  info: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: '#3b82f6', label: 'INFO' },
  success: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: '#10b981', label: 'GOOD' }
}

function InsightCard({ insight }) {
  const cfg = SEV_CONFIG[insight.severity] || SEV_CONFIG.info
  return (
    <div className="rec-insight-card" style={{ '--sev-color': cfg.color, '--sev-bg': cfg.bg, borderColor: cfg.border }}>
      <div className="rec-insight-top">
        <span className="rec-insight-icon">{insight.icon}</span>
        <div className="rec-insight-meta">
          <span className="rec-insight-category">{insight.category}</span>
          <span className="rec-insight-badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
        </div>
      </div>
      <div className="rec-insight-title">{insight.title}</div>
      <div className="rec-insight-desc">{insight.description}</div>
      {insight.action && (
        <div className="rec-insight-action">
          <span className="rec-insight-arrow">-&gt;</span> {insight.action}
        </div>
      )}
    </div>
  )
}

export default function RecommendationStep({ dataset, datasetProfile, onComplete, onJumpToUpload }) {
  const [filter, setFilter] = useState('all')
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to generate insights</h2>
        <p>AI recommendations are produced after profiling your dataset.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const insights = useMemo(() => {
    if (!generated) return []
    const salesKey = datasetProfile.columns.find(col => /sales/i.test(col)) || datasetProfile.numericColumns[0]
    const profitKey = datasetProfile.columns.find(col => /profit/i.test(col)) || datasetProfile.numericColumns[1]
    const regionKey = datasetProfile.columns.find(col => /region/i.test(col)) || datasetProfile.categoricalColumns[0]
    const categoryKey = datasetProfile.columns.find(col => /category/i.test(col)) || datasetProfile.categoricalColumns[1]

    const totalMissingPct = datasetProfile.rowCount && datasetProfile.columnCount
      ? (datasetProfile.missingTotal / (datasetProfile.rowCount * datasetProfile.columnCount)) * 100
      : 0

    const regionTotals = regionKey
      ? dataset.rows.reduce((acc, row) => {
        const region = row[regionKey] || 'Unknown'
        acc[region] = (acc[region] || 0) + (toNumber(row[salesKey]) || 0)
        return acc
      }, {})
      : {}

    const topRegion = Object.entries(regionTotals).sort((a, b) => b[1] - a[1])[0]

    const categoryTotals = categoryKey
      ? dataset.rows.reduce((acc, row) => {
        const category = row[categoryKey] || 'Unknown'
        acc[category] = (acc[category] || 0) + (toNumber(row[profitKey]) || 0)
        return acc
      }, {})
      : {}

    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]

    return [
      {
        icon: 'Trend',
        category: 'Trends',
        severity: 'info',
        title: topRegion ? `${topRegion[0]} leads revenue` : 'Regional performance is balanced',
        description: topRegion ? `The ${topRegion[0]} region contributes ${formatNumber(topRegion[1])} in sales.` : 'No dominant region detected yet.',
        action: 'Double down on inventory in the leading region.'
      },
      {
        icon: 'Alert',
        category: 'Anomalies',
        severity: totalMissingPct > 5 ? 'warning' : 'success',
        title: totalMissingPct > 5 ? 'Missing values require attention' : 'Data quality looks healthy',
        description: `Missing values account for ${totalMissingPct.toFixed(1)}% of the dataset.`,
        action: 'Automate imputation for high-missing columns.'
      },
      {
        icon: 'Opportunity',
        category: 'Suggestions',
        severity: 'info',
        title: topCategory ? `${topCategory[0]} is the most profitable category` : 'Profitability insight ready',
        description: topCategory ? `Profit from ${topCategory[0]} totals ${formatNumber(topCategory[1])}.` : 'Identify the highest-margin segment next.',
        action: 'Increase marketing around the top category.'
      }
    ]
  }, [generated, dataset, datasetProfile])

  const categories = ['all', ...new Set(insights.map(item => item.category))]
  const filtered = filter === 'all' ? insights : insights.filter(item => item.category === filter)

  const counts = {
    critical: insights.filter(item => item.severity === 'critical').length,
    warning: insights.filter(item => item.severity === 'warning').length,
    info: insights.filter(item => item.severity === 'info').length
  }

  function handleGenerate() {
    if (generated) return
    setLoading(true)
    setTimeout(() => {
      setGenerated(true)
      setLoading(false)
      onComplete('recommendations')
    }, 600)
  }

  return (
    <div className="rec-container">
      <div className="rec-header">
        <div>
          <h2 className="rec-title">Recommendations &amp; Insights</h2>
          <p className="rec-subtitle">AI generated trends, anomalies, and business recommendations.</p>
        </div>
        <div className="rec-summary-pills">
          <div className="rec-summary-pill rec-summary-pill--critical">Critical {counts.critical}</div>
          <div className="rec-summary-pill rec-summary-pill--warning">Warning {counts.warning}</div>
          <div className="rec-summary-pill rec-summary-pill--info">Info {counts.info}</div>
        </div>
      </div>

      <div className="rec-quality-card">
        <div className="rec-quality-card-title">Insight Engine</div>
        <div className="rec-quality-body">
          <div>
            <div className="rec-quality-score">{generated ? 'Ready' : 'Standby'}</div>
            <div className="rec-quality-label">AI Insight Status</div>
          </div>
          <button className="btn btn-primary" type="button" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : generated ? 'Insights Ready' : 'Generate Insights'}
          </button>
        </div>
      </div>

      {generated && (
        <>
          <div className="rec-filter-tabs">
            {categories.map(category => (
              <button
                key={category}
                className={`rec-filter-tab ${filter === category ? 'is-active' : ''}`}
                onClick={() => setFilter(category)}
              >
                {category === 'all' ? `All (${insights.length})` : category}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rec-empty">
              <h3>No insights yet</h3>
              <p>Run the generator to see recommendations.</p>
            </div>
          ) : (
            <div className="rec-insights-grid">
              {filtered.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
