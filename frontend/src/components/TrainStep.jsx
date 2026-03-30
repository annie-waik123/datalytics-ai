import { useEffect, useState } from 'react'
import client from '../api/client.js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

const COLORS = ['#6c63ff', '#3f8efc', '#00d2ff', '#00d26a', '#ffb020', '#f472b6', '#a78bfa']

export default function TrainStep({ preprocessData, status, onTrained, setStatus }) {
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const expectsLargeDatasetMode = Boolean(
    preprocessData?.large_dataset_mode || (preprocessData?.train_size || 0) >= 35000
  )

  useEffect(() => {
    let cancelled = false

    async function loadExisting() {
      if (!status.supervised_done) {
        setHydrating(false)
        return
      }

      try {
        const res = await client.get('/train-results')
        if (!cancelled) {
          setResult(res.data)
        }
      } catch (e) {
        if (!cancelled && e.response?.status !== 404) {
          setError(e.response?.data?.detail || 'Failed to load trained model results.')
        }
      } finally {
        if (!cancelled) {
          setHydrating(false)
        }
      }
    }

    loadExisting()
    return () => {
      cancelled = true
    }
  }, [status.supervised_done])

  if (!preprocessData && !status.preprocessing_done) {
    return <div className="alert alert-warning">Please complete preprocessing first.</div>
  }

  async function handleTrain() {
    setLoading(true)
    setError(null)
    try {
      const res = await client.post('/train-model')
      setResult(res.data)
      onTrained(res.data)
      setStatus(s => ({ ...s, supervised_done: true, best_model_name: res.data.best_model_name }))
    } catch (e) {
      setError(e.response?.data?.detail || 'Training failed.')
    } finally {
      setLoading(false)
    }
  }

  const primaryMetric = result?.primary_metric || 'Accuracy'
  const chartData = result?.results?.map(row => ({
    name: row.Model,
    value: parseFloat((row[primaryMetric] ?? 0).toFixed(4)),
  })) || []

  return (
    <div>
      <h1 className="page-title">Supervised Models</h1>
      <p className="page-subtitle">Train and compare the supervised models from the original Streamlit workflow using the shared backend dataset session.</p>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-title">Model Training</div>
        <div className="alert alert-info">
          Task type: <strong>{preprocessData?.task_type || status.task_type || '-'}</strong>
        </div>
        {expectsLargeDatasetMode && !result && (
          <div className="alert alert-info">
            Large dataset mode will use scalable models, reduced memory pressure, and skip expensive
            cross-validation so training remains stable on big CSVs.
          </div>
        )}
        {error && <div className="alert alert-warning">{error}</div>}
        <button className="btn btn-primary btn-block" onClick={handleTrain} disabled={loading}>
          {loading ? 'Training all models...' : 'Train all supervised models'}
        </button>
      </div>

      {(loading || hydrating) && (
        <div className="spinner-wrap">
          <div className="spinner" />
          <span>{loading ? 'Training models...' : 'Loading saved training results...'}</span>
        </div>
      )}

      {result && !loading && (
        <>
          {result.large_dataset_mode && (
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              Large dataset mode trained on <strong>{(result.train_rows_used || 0).toLocaleString()}</strong> sampled
              training rows and evaluated on <strong>{(result.test_rows_used || 0).toLocaleString()}</strong> test rows.
              {!result.cv_enabled && ' Cross-validation was skipped to keep runtime predictable.'}
            </div>
          )}
          <div className="best-banner">
            <div className="best-banner-label">Best Model</div>
            <div className="best-banner-name">{result.best_model_name}</div>
          </div>

          <BestMetrics metrics={result.best_metrics} taskType={result.task_type} />
          <TuningSummary metrics={result.best_metrics} taskType={result.task_type} />

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="section-title">Performance Comparison - {primaryMetric}</div>
            <div className="chart-wrap" style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 28, right: 16, left: 4, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3551" />
                  <XAxis dataKey="name" tick={{ fill: '#aebad3', fontSize: 12 }} angle={-20} textAnchor="end" />
                  <YAxis
                    tick={{ fill: '#c5d2eb', fontSize: 12 }}
                    tickFormatter={(value) => formatAxisTick(value, primaryMetric)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={<ChartTooltip metricLabel={primaryMetric} />}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      content={(props) => <ValueLabel {...props} metricLabel={primaryMetric} />}
                    />
                    {chartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Model Comparison Table</div>
            <ResultsTable results={result.results} primaryMetric={primaryMetric} bestModel={result.best_model_name} />
          </div>
        </>
      )}
    </div>
  )
}

function BestMetrics({ metrics, taskType }) {
  if (!metrics) {
    return null
  }

  const isClassification = taskType === 'Classification'
  const pairs = isClassification
    ? [
        ['Accuracy', metrics.Accuracy],
        ['F1 Score', metrics['F1 Score']],
        ['ROC-AUC', metrics['ROC-AUC']],
        ['CV Mean', metrics['CV Mean']],
      ]
    : [
        ['R² Score', metrics['R2 Score']],
        ['CV Mean R²', metrics['CV Mean R2']],
        ['RMSE', metrics.RMSE],
        ['MAE', metrics.MAE],
      ]

  return (
    <div className="metrics-row metrics-4" style={{ marginBottom: '1rem' }}>
      {pairs.map(([label, value]) => (
        <div key={label} className="metric-card">
          <div className="metric-label">{label}</div>
          <div className="metric-value">{formatDisplayValue(value, label)}</div>
        </div>
      ))}
    </div>
  )
}

function TuningSummary({ metrics, taskType }) {
  if (!metrics?.['Best Params']) {
    return null
  }

  const tuningLabel = taskType === 'Classification' ? 'Best CV Accuracy' : 'Best CV R²'
  const tuningScore = metrics['Tuning Score']

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="section-title">Tuned Parameters</div>
      <div className="metrics-row metrics-2" style={{ marginBottom: '1rem' }}>
        <div className="metric-card">
          <div className="metric-label">{tuningLabel}</div>
          <div className="metric-value">{formatDisplayValue(tuningScore, tuningLabel)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Search Status</div>
          <div className="metric-value">{metrics.Tuned || 'No'}</div>
        </div>
      </div>
      <div className="alert alert-info" style={{ alignItems: 'flex-start' }}>
        <div>
          <strong>Best Params</strong>
          <div style={{ marginTop: '0.5rem', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {metrics['Best Params']}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultsTable({ results, primaryMetric, bestModel }) {
  if (!results?.length) {
    return null
  }

  const columns = Object.keys(results[0])
  const primaryMetricDisplay = displayMetricLabel(primaryMetric)
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map(column => <th key={column}>{displayMetricLabel(column)}</th>)}</tr>
        </thead>
        <tbody>
          {results.map((row, index) => (
            <tr key={index} style={row.Model === bestModel ? { background: 'rgba(0,210,106,0.05)' } : {}}>
              {columns.map(column => (
                <td key={column} className={column === primaryMetric && row.Model === bestModel ? 'best' : ''}>
                  {formatTableValue(row[column], displayMetricLabel(column))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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

function ChartTooltip({ active, payload, label, metricLabel }) {
  if (!active || !payload?.length) {
    return null
  }

  const value = payload[0]?.value

  return (
    <div
      style={{
        background: 'rgba(10, 18, 34, 0.96)',
        border: '1px solid rgba(108, 99, 255, 0.35)',
        borderRadius: 14,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
        padding: '0.85rem 1rem',
        minWidth: 220,
      }}
    >
      <div style={{ color: '#f5fbff', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.45rem' }}>
        {label}
      </div>
      <div style={{ color: '#92a4c9', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {metricLabel}
      </div>
      <div style={{ color: '#7cecff', fontSize: '1.35rem', fontWeight: 800, marginTop: '0.15rem' }}>
        {formatDisplayValue(value, metricLabel)}
      </div>
    </div>
  )
}

function ValueLabel({ x, y, width, value, metricLabel }) {
  if (value == null || x == null || y == null || width == null) {
    return null
  }

  return (
    <text
      x={x + width / 2}
      y={Math.max(y - 12, 14)}
      textAnchor="middle"
      fill="#f7fbff"
      fontSize={13}
      fontWeight={700}
      stroke="rgba(8, 14, 24, 0.95)"
      strokeWidth={4}
      paintOrder="stroke"
    >
      {formatDisplayValue(value, metricLabel, { compact: true })}
    </text>
  )
}

function formatAxisTick(value, metricLabel) {
  if (shouldUsePercentage(metricLabel, value)) {
    return `${Math.round(value * 100)}%`
  }
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }
  return Number(value).toFixed(2)
}

function formatDisplayValue(value, metricLabel, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  const digits = options.compact ? 1 : 2

  if (shouldUsePercentage(metricLabel, value)) {
    return `${(value * 100).toFixed(digits)}%`
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

function displayMetricLabel(label) {
  if (!label) return label
  const map = {
    'R2 Score': 'R² Score',
    'CV Mean R2': 'CV Mean R²',
    'Best CV R2': 'Best CV R²',
  }
  return map[label] || label
}

