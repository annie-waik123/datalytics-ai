import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HiOutlineArrowTrendingUp,
  HiOutlineBolt,
  HiOutlineChartBarSquare,
  HiOutlineCheckBadge,
  HiOutlineClock,
  HiOutlineCommandLine,
  HiOutlineLightBulb,
  HiOutlineMagnifyingGlassCircle,
  HiOutlineSparkles,
  HiOutlineTableCells,
  HiOutlineXMark,
} from 'react-icons/hi2'
import { useToast } from '../../hooks/useToast.js'
import PlotFigure from '../PlotFigure.jsx'
import {
  fetchAnalyticsCapabilities,
  queryAnalytics,
  runAnalyst,
  streamAnalyst,
  syncAnalystDataset,
} from '../../api/analyst.js'
import '../../analyst.css'

const EXAMPLE_PROMPTS = [
  { label: 'Biggest opportunity', prompt: 'Find the biggest business opportunities in this dataset.' },
  { label: 'Why churn', prompt: 'Why are customers churning?' },
  { label: 'Unusual patterns', prompt: 'Find unusual patterns and tell me what I should investigate.' },
  { label: 'Sales by region', prompt: 'Compare revenue by region.' },
  { label: 'Monthly trend', prompt: 'Show monthly sales over time.' },
  { label: 'Top categories', prompt: 'Show me the top 10 categories by revenue.' },
]

const OPERATION_LABELS = {
  groupby: 'Breakdown',
  top: 'Top ranking',
  compare: 'Compare groups',
  time_series: 'Time series',
  trend_break: 'Trend change',
  scatter: 'Relationship',
  correlation: 'Correlation',
  distribution: 'Distribution',
  missing: 'Missing values',
  filter: 'Filter',
}

let entryCounter = 0

function nextId() {
  entryCounter += 1
  return `analyst-${Date.now()}-${entryCounter}`
}

function getCell(row, column) {
  if (row == null) return ''
  if (column in row) return row[column]
  const lower = String(column).toLowerCase()
  const key = Object.keys(row).find((item) => String(item).toLowerCase() === lower)
  return key ? row[key] : ''
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

// ── Small presentational pieces ─────────────────────────────────────────────

function ChartCard({ chart, index }) {
  if (!chart?.figure) return null
  return (
    <div className="ana-card ana-chart-card">
      <div className="ana-card-head">
        <span className="ana-chart-index">{index + 1}</span>
        <strong>{chart.title || chart.chart_type || 'Chart'}</strong>
        <span className="ana-chart-type">{String(chart.chart_type || '').replace(/_/g, ' ')}</span>
      </div>
      <div className="ana-chart-body">
        <PlotFigure figure={chart.figure} themeMode="dark" />
      </div>
      {chart.insight ? <p className="ana-chart-insight">{chart.insight}</p> : null}
    </div>
  )
}

function TableCard({ table }) {
  if (!table?.columns?.length) return null
  return (
    <div className="ana-card">
      <div className="ana-card-head">
        <HiOutlineTableCells />
        <strong>{table.title || 'Result table'}</strong>
      </div>
      <div className="ana-table-wrap">
        <table className="ana-table">
          <thead>
            <tr>
              {table.columns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {(table.rows || []).slice(0, 30).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {table.columns.map((column) => (
                  <td key={column}>{formatCell(getCell(row, column))}</td>
                ))}
              </tr>
            ))}
            {!(table.rows || []).length && (
              <tr><td colSpan={table.columns.length} className="ana-empty-cell">No rows</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricStrip({ metrics }) {
  const items = (metrics || []).slice(0, 8)
  if (!items.length) return null
  return (
    <div className="ana-metric-strip">
      {items.map((metric, index) => (
        <div className="ana-metric-card" key={`${metric.label}-${index}`}>
          <span className="ana-metric-label">{metric.label}</span>
          <strong className="ana-metric-value">{formatCell(metric.formatted ?? metric.value)}</strong>
          {metric.hint ? <small className="ana-metric-hint">{metric.hint}</small> : null}
        </div>
      ))}
    </div>
  )
}

const SEVERITY_META = {
  success: { dot: '#22c55e', emoji: '✅' },
  warning: { dot: '#f59e0b', emoji: '⚠️' },
  critical: { dot: '#f43f5e', emoji: '🚨' },
  error: { dot: '#f43f5e', emoji: '🚨' },
  info: { dot: '#22d3ee', emoji: '💡' },
}

function FindingsPanel({ findings }) {
  const items = (findings || []).slice(0, 10)
  if (!items.length) return null
  return (
    <div className="ana-section">
      <div className="ana-section-title">
        <HiOutlineLightBulb /> Key findings
      </div>
      <div className="ana-findings-grid">
        {items.map((finding, index) => {
          const meta = SEVERITY_META[finding.severity] || SEVERITY_META.info
          return (
            <div className="ana-finding-card" key={`${finding.title}-${index}`}>
              <div className="ana-finding-head">
                <span className="ana-severity-dot" style={{ background: meta.dot }} />
                <strong>{meta.emoji} {finding.title}</strong>
              </div>
              {finding.category ? <span className="ana-finding-cat">{finding.category}</span> : null}
              {finding.summary ? <p>{finding.summary}</p> : null}
              {(finding.evidence || []).length ? (
                <div className="ana-evidence">
                  {(finding.evidence).slice(0, 4).map((item) => <code key={item}>{item}</code>)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecommendationsPanel({ recommendations }) {
  const items = (recommendations || []).slice(0, 8)
  if (!items.length) return null
  const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' }
  return (
    <div className="ana-section">
      <div className="ana-section-title">
        <HiOutlineBolt /> Recommended actions
      </div>
      <div className="ana-rec-list">
        {items.map((rec, index) => (
          <div className="ana-rec-card" key={`${rec.action}-${index}`}>
            <span className={`ana-rec-priority is-${rec.priority || 'medium'}`}>
              {priorityLabel[rec.priority] || 'Medium'}
            </span>
            <div className="ana-rec-copy">
              <strong>{rec.action}</strong>
              {rec.why ? <p>{rec.why}</p> : null}
              {(rec.evidence || []).length ? (
                <div className="ana-evidence">
                  {(rec.evidence).slice(0, 3).map((item) => <code key={item}>{item}</code>)}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LimitationsNote({ limitations, warnings, confidence, llmUsed }) {
  const notes = [
    ...(limitations || []),
    ...(warnings || []).map((item) => `Note: ${item}`),
  ].slice(0, 8)
  if (!notes.length && !confidence && !llmUsed) return null
  return (
    <div className="ana-limitations">
      {notes.map((item) => <span key={item}>· {item}</span>)}
      {confidence ? <span>· Confidence: {confidence}</span> : null}
      {llmUsed ? <span>· ✨ Explanation written by the LLM from computed facts</span> : null}
    </div>
  )
}

// ── Intent chips for natural-language results ───────────────────────────────

function IntentChips({ intent }) {
  if (!intent?.operation) return null
  const chips = [
    intent.operation && OPERATION_LABELS[intent.operation],
    intent.dimension && `by ${intent.dimension}`,
    intent.metric && `metric: ${intent.metric}`,
    intent.aggregation && intent.aggregation !== 'sum' ? intent.aggregation : null,
    intent.visualization && intent.visualization !== 'auto' ? `chart: ${intent.visualization}` : null,
    intent.date_column && `date: ${intent.date_column}`,
  ].filter(Boolean)
  if (!chips.length) return null
  return (
    <div className="ana-intent-chips">
      {chips.map((chip) => <span key={chip}>{chip}</span>)}
    </div>
  )
}

// ── Natural-language result view ────────────────────────────────────────────

function NLResult({ result }) {
  if (!result) return null
  const statusMessage = result.message
  return (
    <div className="ana-result-body">
      {statusMessage ? (
        <div className="ana-inline-alert">
          {result.status === 'needs_clarification' || result.status === 'error'
            ? '⚠️'
            : 'ℹ️'} {statusMessage}
          {(result.intent?.corrections || []).length ? (
            <small>Adjusted: {(result.intent.corrections).join(' · ')}</small>
          ) : null}
        </div>
      ) : null}
      <IntentChips intent={result.intent} />
      <MetricStrip metrics={result.metrics} />
      {result.explanation?.narrative ? (
        <div className="ana-card ana-narrative-card">
          <HiOutlineSparkles /> <p>{result.explanation.narrative}</p>
        </div>
      ) : null}
      {result.explanation?.computed && !result.explanation?.narrative ? (
        <div className="ana-card ana-narrative-card"><p>{result.explanation.computed}</p></div>
      ) : null}
      {(result.charts || []).length ? (
        <div className="ana-section">
          <div className="ana-section-title"><HiOutlineChartBarSquare /> Charts</div>
          <div className="ana-charts-grid">
            {(result.charts).map((chart, index) => <ChartCard key={chart.id || index} chart={chart} index={index} />)}
          </div>
        </div>
      ) : null}
      {(result.tables || []).length ? (
        <div className="ana-section">
          <div className="ana-section-title"><HiOutlineTableCells /> Data</div>
          <div className="ana-tables-grid">
            {(result.tables).map((table, index) => <TableCard key={`${table.title}-${index}`} table={table} />)}
          </div>
        </div>
      ) : null}
      <LimitationsNote limitations={result.limitations} warnings={result.warnings} />
    </div>
  )
}

// ── Agent activity timeline ─────────────────────────────────────────────────

function AgentActivity({ steps, stepStates, running }) {
  const entries = [...(steps || [])]
  if (!entries.length) return null
  return (
    <div className="ana-activity">
      <div className="ana-section-title"><HiOutlineCommandLine /> Agent activity</div>
      <ul className="ana-activity-list">
        {entries.map((step) => {
          const state = stepStates?.[step.key] || { status: 'queued' }
          const isRunning = running && state.status === 'running'
          const isDone = state.status === 'done'
          const isError = state.status === 'error'
          const isSkipped = state.status === 'skipped'
          return (
            <li key={step.key} className={`ana-activity-item is-${state.status || 'queued'}`}>
              <span className="ana-activity-icon">
                {isRunning ? <span className="ana-spinner" /> : null}
                {isDone ? <HiOutlineCheckBadge /> : null}
                {isError ? <HiOutlineXMark /> : null}
                {isSkipped ? <span className="ana-skip">↷</span> : null}
                {!isRunning && !isDone && !isError && !isSkipped ? <span className="ana-dot" /> : null}
              </span>
              <div className="ana-activity-copy">
                <strong>{step.label}</strong>
                {state.detail ? <small>{state.detail}</small> : null}
                {state.error ? <small className="ana-err">{state.error}</small> : null}
                {isSkipped ? <small className="ana-muted-text">Skipped</small> : null}
              </div>
              {isDone && state.duration_ms != null ? (
                <span className="ana-activity-time">{Math.round(state.duration_ms)}ms</span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AgentActivitySummary({ actions }) {
  const statuses = (actions || []).map((action) => action.status)
  const done = statuses.filter((item) => item === 'done').length
  const skipped = statuses.filter((item) => item === 'skipped').length
  const errored = statuses.filter((item) => item === 'error').length
  if (!actions?.length) return null
  return (
    <details className="ana-activity-summary">
      <summary>
        {done} step(s) completed · {skipped} skipped · {errored} errored
      </summary>
      <ul>
        {(actions || []).map((action) => (
          <li key={action.key}>
            <span className={`ana-status-tag is-${action.status}`}>{action.status}</span>
            <strong>{action.label}</strong>
            <small>{action.detail || ''}</small>
            <span className="ana-activity-time">{Math.round(action.duration_ms || 0)}ms</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function AgentReport({ report, running }) {
  if (!report) return null
  return (
    <div className="ana-result-body">
      {report.narrative ? (
        <div className="ana-card ana-narrative-card">
          <HiOutlineSparkles />
          <p>{report.narrative}</p>
          {report.llm_used ? <small className="ana-llm-badge">LLM summary over computed facts</small> : null}
        </div>
      ) : null}
      <MetricStrip metrics={report.metrics} />
      <FindingsPanel findings={report.findings} />
      {(report.visualizations || []).length ? (
        <div className="ana-section">
          <div className="ana-section-title"><HiOutlineChartBarSquare /> Visualizations</div>
          <div className="ana-charts-grid">
            {(report.visualizations).map((chart, index) => <ChartCard key={chart.id || index} chart={chart} index={index} />)}
          </div>
        </div>
      ) : null}
      {(report.tables || []).length ? (
        <div className="ana-section">
          <div className="ana-section-title"><HiOutlineTableCells /> Supporting data</div>
          <div className="ana-tables-grid">
            {(report.tables).map((table, index) => <TableCard key={`${table.title}-${index}`} table={table} />)}
          </div>
        </div>
      ) : null}
      <RecommendationsPanel recommendations={report.recommendations} />
      <AgentActivitySummary actions={report.actions} />
      <LimitationsNote
        limitations={report.limitations}
        warnings={null}
        confidence={report.confidence}
        llmUsed={report.llm_used}
      />
      {report.duration_ms ? (
        <div className="ana-run-time"><HiOutlineClock /> Finished in {(report.duration_ms / 1000).toFixed(1)}s</div>
      ) : null}
    </div>
  )
}

// ── Conversation entry rendering ────────────────────────────────────────────

function EntryCard({ entry, onRetry, busy }) {
  return (
    <div className={`ana-entry ana-entry--${entry.kind}`}>
      <div className="ana-entry-user">
        <div className="ana-entry-user-bubble">
          <HiOutlineMagnifyingGlassCircle /> <span>{entry.userText}</span>
        </div>
      </div>

      {entry.running ? (
        <div className="ana-entry-running">
          {entry.kind === 'agent' ? (
            <AgentActivity steps={entry.agent?.steps} stepStates={entry.agent?.stepStates} running />
          ) : (
            <div className="ana-thinking">
              <span className="ana-spinner" /> Understanding your request…
            </div>
          )}
        </div>
      ) : null}

      {!entry.running && entry.error ? (
        <div className="ana-entry-error">
          <strong>Something went wrong</strong>
          <p>{entry.error}</p>
          {!busy ? (
            <button type="button" className="ana-retry-btn" onClick={() => onRetry(entry)}>Retry</button>
          ) : null}
        </div>
      ) : null}

      {!entry.running && !entry.error && entry.kind === 'agent' && entry.agent?.report ? (
        <AgentReport report={entry.agent.report} running={false} />
      ) : null}
      {!entry.running && !entry.error && entry.kind === 'query' && entry.result ? (
        <NLResult result={entry.result} />
      ) : null}
    </div>
  )
}

// ── Main step ───────────────────────────────────────────────────────────────

export default function AIAnalystStep({
  dataset,
  datasetProfile,
  onComplete,
  onJumpToUpload,
}) {
  const { addToast } = useToast()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('agent') // 'agent' | 'quick'
  const [entries, setEntries] = useState([])
  const [busy, setBusy] = useState(false)
  const entriesEndRef = useRef(null)
  const datasetRef = useRef(dataset)
  const datasetProfileRef = useRef(datasetProfile)
  const completedRef = useRef(false)

  useEffect(() => {
    datasetRef.current = dataset
    datasetProfileRef.current = datasetProfile
  }, [dataset, datasetProfile])

  useEffect(() => {
    fetchAnalyticsCapabilities().catch(() => { /* capabilities are only hints */ })
  }, [])

  const hasData = Boolean(dataset?.rows?.length || datasetProfile?.totalRowCount)

  function patchEntry(id, patch) {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }

  function patchAgent(id, patch) {
    setEntries((current) => current.map((entry) => {
      if (entry.id !== id || entry.kind !== 'agent') return entry
      return { ...entry, agent: { steps: [], stepStates: {}, ...entry.agent, ...patch } }
    }))
  }

  function scrollToEnd() {
    requestAnimationFrame(() => entriesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
  }

  const markCompletedOnce = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    onComplete?.('analyst')
  }, [onComplete])

  const retryEntry = useCallback((entry) => {
    if (entry.kind === 'agent') runAgentEntry(entry.userText, entry.id)
    else runQueryEntry(entry.userText, entry.id)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function ensureBackendData() {
    if (!datasetRef.current) return { ok: false, reason: 'no_dataset' }
    const result = await syncAnalystDataset(datasetRef.current)
    if (result?.reason === 'no_dataset') return { ok: false, reason: 'no_dataset' }
    return { ok: true }
  }

  async function runQueryEntry(text, forcedId) {
    const id = forcedId || nextId()
    if (!forcedId) {
      setEntries((current) => [{ id, kind: 'query', userText: text, running: true, result: null, error: '' }, ...current])
    } else {
      patchEntry(id, { running: true, error: '' })
    }
    scrollToEnd()
    try {
      const sync = await ensureBackendData()
      if (!sync.ok) throw new Error('No dataset is loaded. Upload a dataset first.')
      const result = await queryAnalytics(text)
      patchEntry(id, { running: false, result })
      markCompletedOnce()
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'The query could not be completed.'
      patchEntry(id, { running: false, error: message })
    } finally {
      setBusy(false)
    }
  }

  async function runAgentEntry(text, forcedId) {
    const id = forcedId || nextId()
    if (!forcedId) {
      setEntries((current) => [{
        id, kind: 'agent', userText: text, running: true, error: '',
        agent: { steps: [], stepStates: {}, report: null },
      }, ...current])
    } else {
      patchEntry(id, { running: true, error: '' })
    }
    scrollToEnd()
    try {
      const sync = await ensureBackendData()
      if (!sync.ok) throw new Error('No dataset is loaded. Upload a dataset first.')
      await streamAnalyst(text, {
        mode: 'auto',
        max_charts: 3,
        onEvent: (event) => {
          if (event.type === 'plan') {
            patchAgent(id, { steps: event.steps || [] })
          } else if (event.type === 'step') {
            setEntries((current) => current.map((entry) => {
              if (entry.id !== id || entry.kind !== 'agent') return entry
              const stepStates = { ...(entry.agent?.stepStates || {}) }
              stepStates[event.key] = {
                status: event.status,
                detail: event.detail,
                error: event.error,
                duration_ms: event.duration_ms,
              }
              return { ...entry, agent: { ...entry.agent, stepStates } }
            }))
          } else if (event.type === 'result') {
            patchAgent(id, { report: event.report, stepStates: {} })
            setEntries((current) => current.map((entry) => {
              if (entry.id !== id || entry.kind !== 'agent') return entry
              const steps = entry.agent?.steps || []
              const stepStates = {}
              ;(event.report?.actions || []).forEach((action) => {
                if (action.key && !stepStates[action.key]) {
                  stepStates[action.key] = {
                    status: action.status,
                    detail: action.detail,
                    error: action.error,
                    duration_ms: action.duration_ms,
                  }
                }
              })
              const plan = steps.length ? steps : (event.report?.plan || [])
              return { ...entry, agent: { steps: plan, stepStates, report: event.report } }
            }))
          } else if (event.type === 'error') {
            patchEntry(id, { running: false, error: event.message || 'The agent run failed.' })
          }
        },
      })
      patchEntry(id, { running: false })
      markCompletedOnce()
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'The AI Analyst could not complete the run.'
      patchEntry(id, { running: false, error: message })
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit() {
    const text = String(input || '').trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)
    if (mode === 'quick') runQueryEntry(text)
    else runAgentEntry(text)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSubmit()
    }
  }

  const quickExamples = EXAMPLE_PROMPTS.slice(0, 4)
  const agentExamples = EXAMPLE_PROMPTS

  return (
    <div className="ana-root">
      {/* Header */}
      <div className="ana-header">
        <div className="ana-title-block">
          <div className="ana-logo-ring">
            <HiOutlineSparkles />
          </div>
          <div>
            <h2 className="ana-title">
              AI Analyst
              <span className="ana-badge">Datalytics AI</span>
            </h2>
            <p className="ana-subtitle">
              Ask Datalytics anything about your data — it plans, runs real analyses and explains what it found.
            </p>
          </div>
        </div>

        {hasData ? (
          <div className="ana-dataset-pill">
            <span className="ana-dataset-dot" />
            {datasetProfile?.totalRowCount || dataset?.rows?.length || 0} rows ·{' '}
            {datasetProfile?.totalColumnCount || dataset?.columns?.length || 0} columns
          </div>
        ) : null}
      </div>

      {/* Mode toggle */}
      <div className="ana-mode-toggle">
        <button
          type="button"
          className={`ana-mode-btn${mode === 'agent' ? ' is-active' : ''}`}
          onClick={() => setMode('agent')}
        >
          <HiOutlineCommandLine /> AI Data Analyst
        </button>
        <button
          type="button"
          className={`ana-mode-btn${mode === 'quick' ? ' is-active' : ''}`}
          onClick={() => setMode('quick')}
        >
          <HiOutlineArrowTrendingUp /> Natural-language analytics
        </button>
      </div>

      {/* Prompt composer */}
      <div className="ana-composer card">
        <div className="ana-composer-field">
          <HiOutlineMagnifyingGlassCircle className="ana-composer-icon" />
          <input
            type="text"
            placeholder={mode === 'quick'
              ? 'Ask in plain English — e.g. “Compare revenue by region” or “Show monthly sales”…'
              : 'Tell the analyst what to investigate — e.g. “Find the biggest business opportunities”…'}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            maxLength={2000}
          />
          <button
            type="button"
            className="ana-send-btn"
            onClick={handleSubmit}
            disabled={busy || !String(input).trim()}
            aria-label="Run analysis"
          >
            {busy ? <span className="ana-spinner" /> : <HiOutlineArrowTrendingUp />}
          </button>
        </div>

        <div className="ana-examples">
          {(mode === 'quick' ? quickExamples : agentExamples).map((example) => (
            <button
              key={example.prompt}
              type="button"
              disabled={busy}
              onClick={() => {
                setInput(example.prompt)
              }}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="ana-empty-state">
          <div className="ana-empty-icon"><HiOutlineCommandLine /></div>
          <h3>No dataset loaded yet</h3>
          <p>Upload a dataset first, then come back and ask Datalytics anything about it.</p>
          <button type="button" className="ana-primary-btn" onClick={onJumpToUpload}>
            Upload a dataset
          </button>
        </div>
      ) : null}

      {/* Entry stack */}
      <div className="ana-entries">
        {!entries.length ? (
          <div className="ana-welcome">
            <div className="ana-welcome-icon"><HiOutlineSparkles /></div>
            <h3>{mode === 'agent' ? 'What should the analyst investigate?' : 'What do you want to see?'}</h3>
            <p>
              {mode === 'agent'
                ? 'The analyst runs real profiling, EDA, correlations, charts and model comparisons against your dataset — then explains the results.'
                : 'Type a question or click an example. The system detects the right columns, runs the analysis and shows charts, tables and metrics.'}
            </p>
          </div>
        ) : null}

        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} onRetry={retryEntry} busy={busy} />
        ))}
        <div ref={entriesEndRef} />
      </div>
    </div>
  )
}
