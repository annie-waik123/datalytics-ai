import { useEffect, useState } from 'react'
import client from '../api/client.js'
import PlotFigure from './PlotFigure.jsx'

export default function BestModelStep({ status }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      if (!status.supervised_done) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const res = await client.get('/best-model-summary')
        if (!cancelled) {
          setData(res.data)
        }
      } catch (e) {
        try {
          const fallback = await client.get('/train-results')
          if (!cancelled) {
            setData({
              best_model_name: fallback.data.best_model_name,
              best_metrics: fallback.data.best_metrics,
              results: fallback.data.results || [],
              task_type: fallback.data.task_type,
              learning_curve: null,
            })
          }
        } catch (fallbackError) {
          if (!cancelled) {
            setError(
              fallbackError.response?.data?.detail ||
              e.response?.data?.detail ||
              'Failed to load best model summary.'
            )
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSummary()
    return () => {
      cancelled = true
    }
  }, [status.supervised_done])

  if (!status.supervised_done) {
    return <div className="alert alert-warning">Train supervised models first.</div>
  }

  if (loading) {
    return <div className="spinner-wrap"><div className="spinner" /><span>Loading best model summary...</span></div>
  }

  if (error) {
    return <div className="alert alert-warning">{error}</div>
  }

  const taskType = data.task_type || status.task_type
  const metricEntries = getPriorityMetrics(data.best_metrics || {}, taskType)
  const resultRows = data.results || []

  return (
    <div>
      <h1 className="page-title">Best Model</h1>
      <p className="page-subtitle">Inspect the winning supervised model, review its metrics, and compare it against the rest of the field.</p>

      <div className="best-banner">
        <div className="best-banner-label">Best Model</div>
        <div className="best-banner-name">{data.best_model_name}</div>
      </div>

      <div className="metrics-row metrics-4" style={{ marginBottom: '1rem' }}>
        {metricEntries.map(([label, value]) => (
          <div key={label} className="metric-card">
            <div className="metric-label">{label}</div>
            <div className="metric-value">{formatDisplayValue(value, label)}</div>
          </div>
        ))}
      </div>

      {data.learning_curve && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-title">Learning Curve</div>
          <PlotFigure figure={data.learning_curve} style={{ height: 420 }} />
        </div>
      )}

      <div className="card">
        <div className="section-title">All Model Results</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{Object.keys(resultRows[0] || {}).map(column => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {resultRows.map((row, index) => (
                <tr key={index} style={row.Model === data.best_model_name ? { background: 'rgba(0,210,106,0.05)' } : {}}>
                  {Object.keys(row).map(column => (
                    <td key={column} className={column === 'Model' && row[column] === data.best_model_name ? 'best' : ''}>
                      {formatTableValue(row[column], column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function getPriorityMetrics(metrics, taskType) {
  if (taskType === 'Classification') {
    return [
      ['Accuracy', metrics.Accuracy],
      ['F1 Score', metrics['F1 Score']],
      ['ROC-AUC', metrics['ROC-AUC']],
      ['CV Mean', metrics['CV Mean']],
    ]
  }

  return [
    ['R² Score', metrics['R2 Score']],
    ['CV Mean R²', metrics['CV Mean R2']],
    ['RMSE', metrics.RMSE],
    ['MAE', metrics.MAE],
  ]
}

function formatTableValue(value, column) {
  if (value == null) {
    return '-'
  }

  if (typeof value === 'number') {
    return formatDisplayValue(value, column)
  }

  if (column === 'Best Params') {
    return (
      <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem' }}>
        {String(value)}
      </code>
    )
  }

  return String(value)
}

function formatDisplayValue(value, metricLabel) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  if (shouldUsePercentage(metricLabel, value)) {
    return `${(value * 100).toFixed(2)}%`
  }

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  return value.toFixed(4)
}

function shouldUsePercentage(metricLabel, value) {
  const label = String(metricLabel || '').toLowerCase()

  if (!Number.isFinite(value)) {
    return false
  }

  if (label.includes('mae') || label.includes('mse') || label.includes('rmse')) {
    return false
  }

  return Math.abs(value) <= 1.2
}
