import { useEffect, useMemo, useRef, useState } from 'react'
import PlotFigure from './PlotFigure.jsx'
import {
  fetchVisualizationMetadata,
  renderVisualizationBatch,
  renderVisualizationChart,
  syncVisualizationDataset,
} from '../api/visualization.js'
import { useToast } from '../hooks/useToast.js'

const THEME_KEY = 'datalytics_visualization_theme'

const CHARTS = [
  { id: 'histogram', label: 'Histogram', description: 'Distribution of a numeric feature.', mode: 'single' },
  { id: 'bar_chart', label: 'Bar Chart', description: 'Aggregate a metric by category.', mode: 'double' },
  { id: 'line_chart', label: 'Line Chart', description: 'Track a metric across ordered values.', mode: 'double' },
  { id: 'scatter_plot', label: 'Scatter Plot', description: 'Compare two numeric features.', mode: 'double' },
  { id: 'box_plot', label: 'Box Plot', description: 'Inspect spread and outliers.', mode: 'single' },
  { id: 'count_plot', label: 'Count Plot', description: 'Count rows per category.', mode: 'single' },
  { id: 'area_chart', label: 'Area Chart', description: 'Show cumulative magnitude over the X axis.', mode: 'double' },
  { id: 'kde_plot', label: 'KDE Plot', description: 'Smooth density estimate for a numeric feature.', mode: 'single' },
  { id: 'violin_plot', label: 'Violin Plot', description: 'Combine density and quartile spread.', mode: 'single' },
  { id: 'pie_chart', label: 'Pie Chart', description: 'Share of categories or binned values.', mode: 'single' },
  { id: 'regression_plot', label: 'Regression Plot', description: 'Scatter plot with a fitted trend line.', mode: 'double' },
  { id: 'joint_plot', label: 'Joint Plot', description: 'Scatter plot with marginal distributions.', mode: 'multi' },
  { id: 'pair_plot', label: 'Pair Plot', description: 'Matrix view for multiple numeric features.', mode: 'multi' },
  { id: 'heatmap', label: 'Heatmap', description: 'Sampled row-by-column intensity map.', mode: 'multi' },
  { id: 'correlation_matrix', label: 'Correlation Matrix', description: 'Correlation strength across numeric features.', mode: 'multi' },
  { id: 'time_series_line', label: 'Time Series Line Chart', description: 'Time-based trend of a numeric metric.', mode: 'time' },
  { id: 'rolling_mean_chart', label: 'Rolling Mean Chart', description: 'Observed values with a rolling average.', mode: 'time' },
  { id: 'bubble_chart', label: 'Bubble Chart', description: 'Scatter plot with bubble size encoding.', mode: 'double' },
  { id: 'treemap', label: 'Treemap', description: 'Hierarchical share of grouped segments.', mode: 'multi' },
  { id: 'stacked_bar_chart', label: 'Stacked Bar Chart', description: 'Break down a metric into stack segments.', mode: 'double' },
]

const STANDARD_CHART_FRAME_STYLE = {
  width: '100%',
  maxWidth: '850px',
  height: '500px',
  minHeight: '500px',
  margin: '0 auto',
}

function readThemePreference() {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

function buildSupportMap(metadata) {
  return new Map((metadata?.supported_charts || []).map((item) => [item.id, item]))
}

function defaultFeaturedChart(metadata) {
  const supported = CHARTS.find((chart) => buildSupportMap(metadata).get(chart.id)?.enabled)
  return supported?.id || CHARTS[0].id
}

function selectionBounds(chartId) {
  switch (chartId) {
    case 'joint_plot':
      return { min: 2, max: 2 }
    case 'pair_plot':
      return { min: 2, max: 5 }
    case 'heatmap':
    case 'correlation_matrix':
      return { min: 2, max: 8 }
    case 'treemap':
      return { min: 1, max: 4 }
    default:
      return { min: 1, max: 8 }
  }
}

function chartOptions(chartId, metadata) {
  const columns = metadata?.columns || {}
  const all = columns.all || []
  const numeric = columns.numeric || []
  const categorical = columns.categorical || []
  const datetime = columns.datetime || []

  if (['histogram', 'box_plot', 'kde_plot', 'violin_plot'].includes(chartId)) {
    return { single: numeric }
  }
  if (['count_plot', 'pie_chart'].includes(chartId)) {
    return { single: categorical.length ? categorical : all }
  }
  if (['scatter_plot', 'regression_plot', 'bubble_chart'].includes(chartId)) {
    return { x: numeric, y: numeric, size: numeric }
  }
  if (['bar_chart', 'line_chart', 'area_chart', 'stacked_bar_chart'].includes(chartId)) {
    return { x: all, y: numeric, group: categorical }
  }
  if (['joint_plot', 'pair_plot', 'heatmap', 'correlation_matrix'].includes(chartId)) {
    return { multi: numeric }
  }
  if (chartId === 'treemap') {
    return { multi: all }
  }
  if (['time_series_line', 'rolling_mean_chart'].includes(chartId)) {
    return { date: datetime, value: numeric }
  }
  return { single: all }
}

function firstValidOption(options = [], exclude = []) {
  const excluded = new Set(exclude.filter(Boolean))
  return options.find((option) => option && !excluded.has(option)) || options[0] || ''
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeChartConfig(chartId, config = {}, metadata) {
  const options = chartOptions(chartId, metadata)
  const bounds = selectionBounds(chartId)
  const next = {
    chart_key: chartId,
    chart_type: chartId,
    bins: Number(config.bins) || 24,
    rolling_window: Math.max(2, Number(config.rolling_window) || 7),
    columns: [],
    column: '',
    x_column: '',
    y_column: '',
    date_column: '',
    value_column: '',
    group_column: '',
    size_column: '',
    ...config,
  }

  if (['histogram', 'box_plot', 'kde_plot', 'violin_plot', 'count_plot', 'pie_chart'].includes(chartId)) {
    next.column = options.single?.includes(config.column) ? config.column : firstValidOption(options.single)
    return next
  }

  if (['scatter_plot', 'regression_plot', 'bubble_chart'].includes(chartId)) {
    next.x_column = options.x?.includes(config.x_column) ? config.x_column : firstValidOption(options.x)
    next.y_column = (options.y?.includes(config.y_column) && (config.y_column !== next.x_column || (options.y || []).length === 1))
      ? config.y_column
      : firstValidOption(options.y, [next.x_column])
    const distinctSize = (options.size || []).find((option) => option && ![next.x_column, next.y_column].includes(option)) || ''
    next.size_column = (options.size?.includes(config.size_column) && ![next.x_column, next.y_column].includes(config.size_column))
      ? config.size_column
      : distinctSize
    return next
  }

  if (['bar_chart', 'line_chart', 'area_chart', 'stacked_bar_chart'].includes(chartId)) {
    next.x_column = options.x?.includes(config.x_column) ? config.x_column : firstValidOption(options.x)
    next.y_column = options.y?.includes(config.y_column) ? config.y_column : firstValidOption(options.y)
    next.group_column = options.group?.includes(config.group_column)
      ? config.group_column
      : firstValidOption(options.group, [next.x_column])
    return next
  }

  if (['joint_plot', 'pair_plot', 'heatmap', 'correlation_matrix', 'treemap'].includes(chartId)) {
    const allowed = options.multi || []
    const current = uniqueValues((config.columns || []).filter((column) => allowed.includes(column)))
    const nextColumns = [...current]

    for (const option of allowed) {
      if (nextColumns.length >= bounds.min) break
      if (!nextColumns.includes(option)) nextColumns.push(option)
    }

    next.columns = nextColumns.slice(0, bounds.max)
    return next
  }

  next.date_column = options.date?.includes(config.date_column) ? config.date_column : firstValidOption(options.date)
  next.value_column = options.value?.includes(config.value_column) ? config.value_column : firstValidOption(options.value)
  return next
}

function canRenderChart(chart, config, metadata) {
  const support = buildSupportMap(metadata).get(chart.id)
  if (!support?.enabled) return false

  if (chart.mode === 'single') return Boolean(config.column)
  if (chart.mode === 'double') return Boolean(config.x_column && config.y_column)
  if (chart.mode === 'multi') return (config.columns || []).length >= selectionBounds(chart.id).min
  return Boolean(config.date_column && config.value_column)
}

function buildInitialConfigs(metadata) {
  const defaults = metadata?.defaults || {}
  return Object.fromEntries(
    CHARTS.map((chart) => {
      const rawConfig = {
        chart_key: chart.id,
        chart_type: chart.id,
        bins: 24,
        rolling_window: 7,
        columns: [...(defaults[chart.id]?.columns || [])],
        column: defaults[chart.id]?.column || '',
        x_column: defaults[chart.id]?.x_column || '',
        y_column: defaults[chart.id]?.y_column || '',
        date_column: defaults[chart.id]?.date_column || '',
        value_column: defaults[chart.id]?.value_column || '',
        group_column: defaults[chart.id]?.group_column || '',
        size_column: defaults[chart.id]?.size_column || '',
      }
      return [chart.id, normalizeChartConfig(chart.id, rawConfig, metadata)]
    })
  )
}

function buildPayload(chartId, config, themeMode) {
  return {
    ...config,
    chart_key: chartId,
    chart_type: chartId,
    theme: themeMode,
  }
}

function buildSummary(chart, config) {
  return {
    chartType: chart.label,
    x: config.x_column || config.date_column || config.column || config.columns?.[0] || '',
    y: config.y_column || config.value_column || config.columns?.[1] || '',
  }
}

function createUnavailableResult(chartId, message) {
  return {
    chart_key: chartId,
    chart_type: chartId,
    error: message,
  }
}

function pickFeaturedChart(metadata, results, preferredChartId = '') {
  if (preferredChartId && results?.[preferredChartId]?.figure) return preferredChartId
  const successful = CHARTS.find((chart) => results?.[chart.id]?.figure)
  if (successful) return successful.id
  return defaultFeaturedChart(metadata)
}

function ChartPill({ children, tone = 'default' }) {
  return <span className={`viz-pill viz-pill-${tone}`}>{children}</span>
}

function MultiSelect({ options, values, onToggle, disabled, label, maxSelections }) {
  const summary = values.length ? `${values.length} selected` : label
  return (
    <details className={`viz-multi-select ${disabled ? 'is-disabled' : ''}`}>
      <summary>{summary}</summary>
      <div className="viz-multi-menu">
        <div className="viz-multi-meta">Pick up to {maxSelections} columns</div>
        {options.map((option) => {
          const checked = values.includes(option)
          return (
            <label key={option} className={`viz-multi-option ${checked ? 'is-checked' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(option)}
              />
              <span>{option}</span>
            </label>
          )
        })}
      </div>
    </details>
  )
}

function VisualizationCard({
  chart,
  support,
  metadata,
  config,
  result,
  loading,
  themeMode,
  onFieldChange,
  onToggleColumn,
  onPin,
}) {
  const options = chartOptions(chart.id, metadata)
  const bounds = selectionBounds(chart.id)
  const disabled = !support?.enabled

  function renderSelect(field, label, values, value) {
    return (
      <label className="viz-field">
        <span>{label}</span>
        <select
          value={value || ''}
          onChange={(event) => onFieldChange(field, event.target.value)}
          disabled={disabled || !values?.length}
        >
          {!values?.length ? <option value="">No compatible columns</option> : null}
          {values?.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    )
  }

  function renderControls() {
    if (chart.mode === 'single') {
      return renderSelect('column', 'Select Column', options.single || [], config.column)
    }

    if (chart.mode === 'double') {
      return (
        <>
          {renderSelect('x_column', 'X Axis', options.x || [], config.x_column)}
          {renderSelect('y_column', 'Y Axis', options.y || [], config.y_column)}
        </>
      )
    }

    if (chart.mode === 'multi') {
      return (
        <div className="viz-field viz-field-span">
          <span>Columns</span>
          <MultiSelect
            options={options.multi || []}
            values={config.columns || []}
            onToggle={onToggleColumn}
            disabled={disabled || !options.multi?.length}
            label="Select Columns"
            maxSelections={bounds.max}
          />
        </div>
      )
    }

    return (
      <>
        {renderSelect('date_column', 'Date Column', options.date || [], config.date_column)}
        {renderSelect('value_column', 'Value Column', options.value || [], config.value_column)}
      </>
    )
  }

  return (
    <section className={`viz-card ${disabled ? 'is-disabled' : ''}`}>
      <div className="viz-card-head">
        <div>
          <div className="viz-card-title-row">
            <h3>{chart.label}</h3>
            {support?.enabled ? <ChartPill>{chart.mode}</ChartPill> : <ChartPill tone="muted">Unavailable</ChartPill>}
          </div>
          <p>{chart.description}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onPin} disabled={disabled || !result?.figure}>
          Pin Chart
        </button>
      </div>

      <div className="viz-card-controls">
        {renderControls()}
      </div>

      {chart.mode === 'multi' && (config.columns || []).length < bounds.min ? (
        <div className="viz-inline-note is-warning">Select at least {bounds.min} column{bounds.min > 1 ? 's' : ''}.</div>
      ) : null}
      {support?.reason ? <div className="viz-inline-note is-warning">{support.reason}</div> : null}
      {result?.warning ? <div className="viz-inline-note is-warning">{result.warning}</div> : null}
      {result?.note ? <div className="viz-inline-note">{result.note}</div> : null}
      {result?.error ? <div className="viz-inline-note is-warning">{result.error}</div> : null}

      <div className="viz-chart-shell">
        {loading ? (
          <div className="viz-chart-loading">
            <div className="viz-spinner" />
            <span>Rendering {chart.label}...</span>
          </div>
        ) : result?.figure ? (
          <PlotFigure figure={result.figure} themeMode={themeMode} style={STANDARD_CHART_FRAME_STYLE} lazy />
        ) : (
          <div className="viz-chart-loading">
            <span>{support?.enabled ? 'This chart could not be auto-rendered for the current dataset.' : 'This chart is unavailable for the current dataset.'}</span>
          </div>
        )}
      </div>
    </section>
  )
}

export default function VisualizationStep({
  dataset,
  datasetProfile,
  vizConfig,
  setVizConfig,
  onAddChart,
  onComplete,
  onJumpToUpload,
}) {
  const { addToast } = useToast()
  const [themeMode, setThemeMode] = useState('dark')
  const [metadata, setMetadata] = useState(null)
  const [chartConfigs, setChartConfigs] = useState({})
  const [chartResults, setChartResults] = useState({})
  const [chartLoading, setChartLoading] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [featuredChartId, setFeaturedChartId] = useState(CHARTS[0].id)
  const renderTimers = useRef({})

  const supportMap = useMemo(() => buildSupportMap(metadata), [metadata])
  const featuredChoices = useMemo(() => {
    const withFigures = CHARTS.filter((chart) => chartResults[chart.id]?.figure)
    if (withFigures.length) return withFigures
    return CHARTS.filter((chart) => supportMap.get(chart.id)?.enabled)
  }, [chartResults, supportMap])

  useEffect(() => {
    setThemeMode(readThemePreference())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(THEME_KEY, themeMode)
  }, [themeMode])

  useEffect(() => () => {
    Object.values(renderTimers.current).forEach((timer) => window.clearTimeout(timer))
  }, [])

  useEffect(() => {
    if (!setVizConfig || !featuredChartId || !chartConfigs[featuredChartId]) return
    const chart = CHARTS.find((item) => item.id === featuredChartId)
    if (!chart) return
    const summary = buildSummary(chart, chartConfigs[featuredChartId])
    setVizConfig((prev) => ({ ...prev, ...summary }))
  }, [chartConfigs, featuredChartId, setVizConfig])

  useEffect(() => {
    if (!metadata) return
    const nextFeatured = pickFeaturedChart(metadata, chartResults, featuredChartId)
    if (nextFeatured !== featuredChartId) setFeaturedChartId(nextFeatured)
  }, [chartResults, featuredChartId, metadata])

  async function renderChartsIndividually(renderableCharts, configMap, nextTheme, nextMetadata) {
    const settled = await Promise.allSettled(
      renderableCharts.map((chart) => renderVisualizationChart(buildPayload(chart.id, configMap[chart.id], nextTheme)))
    )

    return Object.fromEntries(
      settled.map((entry, index) => {
        const chart = renderableCharts[index]
        if (entry.status === 'fulfilled') return [chart.id, entry.value]
        const message = entry.reason?.response?.data?.detail || entry.reason?.message || 'Could not render this chart.'
        return [chart.id, createUnavailableResult(chart.id, message)]
      })
    )
  }

  async function renderAllCharts(configMap, nextTheme = themeMode, nextMetadata = metadata) {
    const loadingState = Object.fromEntries(CHARTS.map((chart) => [chart.id, true]))
    const supportLookup = buildSupportMap(nextMetadata)
    const normalizedConfigs = Object.fromEntries(
      CHARTS.map((chart) => [chart.id, normalizeChartConfig(chart.id, configMap[chart.id] || {}, nextMetadata)])
    )
    const initialResults = {}
    const renderableCharts = []

    CHARTS.forEach((chart) => {
      const support = supportLookup.get(chart.id)
      if (!support?.enabled) {
        initialResults[chart.id] = createUnavailableResult(chart.id, support?.reason || 'This chart is not available for the current dataset.')
        return
      }
      if (!canRenderChart(chart, normalizedConfigs[chart.id], nextMetadata)) {
        initialResults[chart.id] = createUnavailableResult(chart.id, 'This chart could not be auto-configured for the current dataset.')
        return
      }
      renderableCharts.push(chart)
    })

    setChartConfigs(normalizedConfigs)
    setChartLoading(loadingState)
    setChartResults(initialResults)

    if (!renderableCharts.length) {
      setSyncError('No compatible charts could be generated automatically for this dataset.')
      setChartLoading(Object.fromEntries(CHARTS.map((chart) => [chart.id, false])))
      return
    }

    try {
      const payload = renderableCharts.map((chart) => buildPayload(chart.id, normalizedConfigs[chart.id], nextTheme))
      const response = await renderVisualizationBatch(payload)
      const mappedResults = {
        ...initialResults,
        ...Object.fromEntries((response.results || []).map((item) => [item.chart_key, item])),
      }
      setChartResults(mappedResults)
      setSyncError('')
      setFeaturedChartId((current) => pickFeaturedChart(nextMetadata, mappedResults, current))
      onComplete('visualization')
    } catch (err) {
      const fallbackResults = await renderChartsIndividually(renderableCharts, normalizedConfigs, nextTheme, nextMetadata)
      const mergedResults = { ...initialResults, ...fallbackResults }
      const successfulCharts = Object.values(mergedResults).filter((item) => item?.figure).length
      setChartResults(mergedResults)
      setFeaturedChartId((current) => pickFeaturedChart(nextMetadata, mergedResults, current))
      setSyncError(successfulCharts ? '' : (err?.response?.data?.detail || err?.message || 'Could not render visualization workspace.'))
      if (!successfulCharts) addToast('Visualization workspace could not be generated automatically.', null, 'warning')
      if (successfulCharts) onComplete('visualization')
    } finally {
      setChartLoading(Object.fromEntries(CHARTS.map((chart) => [chart.id, false])))
    }
  }

  async function renderSingleChart(chartId, nextConfig, nextTheme = themeMode, nextMetadata = metadata) {
    const chart = CHARTS.find((item) => item.id === chartId)
    const support = buildSupportMap(nextMetadata).get(chartId)
    const normalizedConfig = normalizeChartConfig(chartId, nextConfig, nextMetadata)

    if (!chart || !support?.enabled || !canRenderChart(chart, normalizedConfig, nextMetadata)) {
      setChartResults((prev) => ({
        ...prev,
        [chartId]: createUnavailableResult(chartId, support?.reason || 'This chart could not be auto-configured for the current dataset.'),
      }))
      setChartLoading((prev) => ({ ...prev, [chartId]: false }))
      return
    }

    setChartLoading((prev) => ({ ...prev, [chartId]: true }))
    try {
      const response = await renderVisualizationChart(buildPayload(chartId, normalizedConfig, nextTheme))
      setChartResults((prev) => ({ ...prev, [chartId]: response }))
      setSyncError('')
      onComplete('visualization')
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || 'Could not render this chart.'
      setChartResults((prev) => ({ ...prev, [chartId]: createUnavailableResult(chartId, message) }))
    } finally {
      setChartLoading((prev) => ({ ...prev, [chartId]: false }))
    }
  }

  useEffect(() => {
    if (!dataset) return
    let ignore = false

    async function bootstrapWorkspace() {
      setSyncing(true)
      setSyncError('')
      try {
        const payload = await syncVisualizationDataset(dataset)
        if (ignore) return
        const nextMetadata = payload.metadata || (await fetchVisualizationMetadata())
        const nextConfigs = buildInitialConfigs(nextMetadata)
        const nextFeatured = defaultFeaturedChart(nextMetadata)
        setMetadata(nextMetadata)
        setFeaturedChartId(nextFeatured)
        await renderAllCharts(nextConfigs, themeMode, nextMetadata)
      } catch (err) {
        if (ignore) return
        setSyncError(err?.response?.data?.detail || err?.message || 'Visualization workspace could not be initialized.')
      } finally {
        if (!ignore) setSyncing(false)
      }
    }

    bootstrapWorkspace()
    return () => {
      ignore = true
    }
  }, [dataset])

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to unlock visual analytics</h2>
        <p>Generate interactive charts, compare fields, and export rich visuals once your dataset is loaded.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const activeFeaturedChartId = featuredChoices.some((chart) => chart.id === featuredChartId)
    ? featuredChartId
    : (featuredChoices[0]?.id || featuredChartId)
  const featuredChart = CHARTS.find((chart) => chart.id === activeFeaturedChartId) || CHARTS[0]
  const featuredResult = chartResults[featuredChart.id]

  function handleFieldChange(chartId, field, value) {
    if (!metadata) return
    const nextConfig = normalizeChartConfig(
      chartId,
      {
        ...(chartConfigs[chartId] || {}),
        [field]: value,
      },
      metadata
    )
    setChartConfigs((prev) => ({ ...prev, [chartId]: nextConfig }))
    window.clearTimeout(renderTimers.current[chartId])
    renderTimers.current[chartId] = window.setTimeout(() => renderSingleChart(chartId, nextConfig), 220)
  }

  function handleToggleColumn(chartId, column) {
    if (!metadata) return
    const bounds = selectionBounds(chartId)
    const currentValues = chartConfigs[chartId]?.columns || []
    const exists = currentValues.includes(column)
    let nextValues = exists ? currentValues.filter((item) => item !== column) : [...currentValues, column]
    if (!exists && nextValues.length > bounds.max) {
      nextValues = nextValues.slice(nextValues.length - bounds.max)
      addToast(`You can select up to ${bounds.max} columns for this chart.`, null, 'warning')
    }

    const nextConfig = normalizeChartConfig(
      chartId,
      {
        ...(chartConfigs[chartId] || {}),
        columns: nextValues,
      },
      metadata
    )

    setChartConfigs((prev) => ({ ...prev, [chartId]: nextConfig }))
    window.clearTimeout(renderTimers.current[chartId])
    renderTimers.current[chartId] = window.setTimeout(() => renderSingleChart(chartId, nextConfig), 220)
  }

  function handlePinChart(chart) {
    const result = chartResults[chart.id]
    if (!result?.figure) {
      addToast('Render the chart successfully before pinning it.', null, 'warning')
      return
    }
    onAddChart({
      title: chart.label,
      type: chart.id,
      figure: result.figure,
      config: chartConfigs[chart.id],
      note: result.note || result.warning || '',
    })
    onComplete('visualization')
    addToast(`${chart.label} pinned to the dashboard.`, null, 'success')
  }

  async function handleRefresh() {
    if (!metadata || !Object.keys(chartConfigs).length) return
    setSyncError('')
    await renderAllCharts(chartConfigs, themeMode, metadata)
    addToast('Visualization workspace refreshed.', null, 'success')
  }

  function handleToggleTheme() {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark'
    setThemeMode(nextTheme)
    if (metadata && Object.keys(chartConfigs).length) {
      renderAllCharts(chartConfigs, nextTheme, metadata)
    }
  }

  return (
    <div className={`viz-workspace ${themeMode === 'light' ? 'is-light' : ''}`}>
      <div className="step-header">
        <div>
          <h1 className="page-title">Visualization</h1>
          <p className="page-subtitle">A modern visualization studio with 20 chart types, dynamic selectors, and Plotly-powered interactivity.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={handleToggleTheme}>
            {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleRefresh} disabled={syncing || !metadata}>
            Refresh Charts
          </button>
        </div>
      </div>

      <div className="viz-toolbar-card">
        <div className="viz-toolbar-stat">
          <span>Rows</span>
          <strong>{(datasetProfile.totalRowCount || datasetProfile.rowCount).toLocaleString()}</strong>
        </div>
        <div className="viz-toolbar-stat">
          <span>Columns</span>
          <strong>{datasetProfile.totalColumnCount || datasetProfile.columnCount}</strong>
        </div>
        <div className="viz-toolbar-stat">
          <span>Numeric</span>
          <strong>{metadata?.columns?.numeric?.length || datasetProfile.numericColumns.length}</strong>
        </div>
        <div className="viz-toolbar-stat">
          <span>Datetime</span>
          <strong>{metadata?.columns?.datetime?.length || 0}</strong>
        </div>
        <div className="viz-toolbar-select">
          <label>
            <span>Featured Preview</span>
            <select value={activeFeaturedChartId} onChange={(event) => setFeaturedChartId(event.target.value)}>
              {(featuredChoices.length ? featuredChoices : CHARTS).map((chart) => (
                <option key={chart.id} value={chart.id}>{chart.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {syncing ? <div className="viz-inline-note">Preparing visualization workspace...</div> : null}
      {syncError ? <div className="viz-inline-note is-warning">{syncError}</div> : null}

      <section className="viz-featured-card">
        <div className="viz-card-head">
          <div>
            <div className="viz-card-title-row">
              <h3>{featuredChart.label}</h3>
              <ChartPill tone="accent">Featured Preview</ChartPill>
            </div>
            <p>{featuredChart.description}</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handlePinChart(featuredChart)} disabled={!featuredResult?.figure}>
            Pin Featured
          </button>
        </div>
        <div className="viz-chart-shell is-featured">
          {chartLoading[featuredChart.id] ? (
            <div className="viz-chart-loading">
              <div className="viz-spinner" />
              <span>Rendering featured preview...</span>
            </div>
          ) : featuredResult?.figure ? (
            <PlotFigure figure={featuredResult.figure} themeMode={themeMode} style={STANDARD_CHART_FRAME_STYLE} />
          ) : (
            <div className="viz-chart-loading">
              <span>No compatible preview could be generated automatically for the current dataset.</span>
            </div>
          )}
        </div>
      </section>

      <div className="viz-grid">
        {CHARTS.map((chart) => (
          <VisualizationCard
            key={chart.id}
            chart={chart}
            support={supportMap.get(chart.id)}
            metadata={metadata}
            config={chartConfigs[chart.id] || {}}
            result={chartResults[chart.id]}
            loading={Boolean(chartLoading[chart.id])}
            themeMode={themeMode}
            onFieldChange={(field, value) => handleFieldChange(chart.id, field, value)}
            onToggleColumn={(column) => handleToggleColumn(chart.id, column)}
            onPin={() => handlePinChart(chart)}
          />
        ))}
      </div>
    </div>
  )
}
