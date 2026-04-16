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
  { id: 'bar_chart',         label: 'Bar Chart',         description: 'Aggregate a metric by category.',             mode: 'double' },
  { id: 'line_chart',        label: 'Line Chart',        description: 'Track a metric across ordered values.',       mode: 'double' },
  { id: 'pie_chart',         label: 'Pie Chart',         description: 'Share of categories or binned values.',       mode: 'single' },
  { id: 'donut_chart',       label: 'Donut Chart',       description: 'Pie chart with a hollow center.',             mode: 'single' },
  { id: 'histogram',         label: 'Histogram',         description: 'Distribution of a numeric feature.',         mode: 'single' },
  { id: 'area_chart',        label: 'Area Chart',        description: 'Show cumulative magnitude over the X axis.', mode: 'double' },
  { id: 'scatter_plot',      label: 'Scatter Plot',      description: 'Compare two numeric features.',               mode: 'double' },
  { id: 'bubble_chart',      label: 'Bubble Chart',      description: 'Scatter plot with bubble size encoding.',     mode: 'double' },
  { id: 'heatmap',           label: 'Heatmap',           description: 'Sampled row-by-column intensity map.',        mode: 'multi'  },
  { id: 'box_plot',          label: 'Box Plot',          description: 'Inspect spread and outliers.',                mode: 'single' },
  { id: 'violin_plot',       label: 'Violin Plot',       description: 'Combine density and quartile spread.',        mode: 'single' },
  { id: 'stacked_bar_chart', label: 'Stacked Bar Chart', description: 'Break down a metric into stack segments.',    mode: 'double' },
  { id: 'grouped_bar_chart', label: 'Grouped Bar Chart', description: 'Compare categories side by side.',             mode: 'double' },
  { id: 'waterfall_chart',   label: 'Waterfall Chart',   description: 'Cumulative effect of sequential values.',     mode: 'double' },
  { id: 'funnel_chart',      label: 'Funnel Chart',      description: 'Process stages and conversion rates.',        mode: 'double' },
  { id: 'treemap',           label: 'Treemap',           description: 'Hierarchical share of grouped segments.',     mode: 'multi'  },
  { id: 'radar_chart',       label: 'Radar Chart',       description: 'Multivariate data in a circular web.',        mode: 'multi'  },
  { id: 'gauge_chart',       label: 'Gauge Chart',       description: 'Radial indicator for a single metric.',       mode: 'single' },
  { id: 'candlestick_chart', label: 'Candlestick Chart', description: 'OHLC price chart for financial data.',        mode: 'time'   },
  { id: 'gantt_chart',       label: 'Gantt Chart',       description: 'Timeline of tasks and project schedules.',    mode: 'double' },
]

const STANDARD_CHART_FRAME_STYLE = {
  width: '800px',
  height: '600px',
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
    case 'heatmap':
    case 'radar_chart':
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

  if (['histogram', 'box_plot', 'violin_plot', 'gauge_chart'].includes(chartId)) {
    return { single: numeric }
  }
  if (['pie_chart', 'donut_chart'].includes(chartId)) {
    return { single: categorical.length ? categorical : all }
  }
  if (['scatter_plot', 'bubble_chart'].includes(chartId)) {
    return { x: numeric, y: numeric, size: numeric }
  }
  if (['bar_chart', 'line_chart', 'area_chart', 'stacked_bar_chart', 'grouped_bar_chart',
       'funnel_chart', 'waterfall_chart', 'gantt_chart'].includes(chartId)) {
    return { x: all, y: numeric, group: categorical }
  }
  if (['heatmap', 'radar_chart'].includes(chartId)) {
    return { multi: numeric }
  }
  if (['treemap'].includes(chartId)) {
    return { multi: all }
  }
  if (['candlestick_chart'].includes(chartId)) {
    return { date: datetime.length ? datetime : all, value: numeric }
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

  // Single-column charts
  if ([
    'histogram', 'box_plot', 'violin_plot', 'pie_chart', 'donut_chart', 'gauge_chart',
  ].includes(chartId)) {
    next.column = options.single?.includes(config.column) ? config.column : firstValidOption(options.single)
    return next
  }

  // Double-column numeric XY charts
  if (['scatter_plot', 'bubble_chart'].includes(chartId)) {
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

  // Double-column XY charts (all/numeric)
  if ([
    'bar_chart', 'line_chart', 'area_chart', 'stacked_bar_chart', 'grouped_bar_chart',
    'funnel_chart', 'waterfall_chart', 'gantt_chart',
  ].includes(chartId)) {
    next.x_column = options.x?.includes(config.x_column) ? config.x_column : firstValidOption(options.x)
    next.y_column = options.y?.includes(config.y_column) ? config.y_column : firstValidOption(options.y)
    next.group_column = options.group?.includes(config.group_column)
      ? config.group_column
      : firstValidOption(options.group, [next.x_column])
    return next
  }

  // Multi-column charts
  if ([
    'heatmap', 'treemap', 'radar_chart',
  ].includes(chartId)) {
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
  // Priority: keep current selection if it is still supported by the dataset metadata,
  // even if it currently has no figure (e.g. while loading or after a config error).
  const supportMap = buildSupportMap(metadata)
  if (preferredChartId && supportMap.get(preferredChartId)?.enabled) return preferredChartId

  // Fallback to first successful chart
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
  const themeMode = 'dark'
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
    // Keep list stable: include all enabled charts, regardless of current figure existence
    return CHARTS.filter((chart) => supportMap.get(chart.id)?.enabled)
  }, [supportMap])


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

  async function renderSingleChart(chartId, nextConfig, nextTheme = themeMode, nextMetadata = metadata, attempt = 0) {
    const chart = CHARTS.find((item) => item.id === chartId)
    const support = buildSupportMap(nextMetadata).get(chartId)
    const normalizedConfig = normalizeChartConfig(chartId, nextConfig, nextMetadata)

    if (!chart || !support?.enabled || !canRenderChart(chart, normalizedConfig, nextMetadata)) {
      setChartResults((prev) => ({
        ...prev,
        [chartId]: createUnavailableResult(chartId, support?.reason || 'Select valid columns for this chart type.'),
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
      // Auto-recover: if backend lost the session (404), re-sync dataset then retry once
      const status = err?.response?.status
      if (status === 404 && attempt === 0 && dataset) {
        try {
          const payload = await syncVisualizationDataset(dataset, { forceSync: true })
          const recoveredMeta = payload.metadata || nextMetadata
          setMetadata(recoveredMeta)
          await renderSingleChart(chartId, nextConfig, nextTheme, recoveredMeta, 1)
          return
        } catch {
          // fall through to error state
        }
      }
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
        
        // Fast-track visual loading
        setSyncing(false)
        if (!ignore) {
          renderAllCharts(nextConfigs, themeMode, nextMetadata).catch((err) => {
            if (!ignore) setSyncError(err?.message || 'Background sync failed.')
          })
        }
      } catch (err) {
        if (ignore) return
        setSyncError(err?.response?.data?.detail || err?.message || 'Visualization workspace could not be initialized.')
        setSyncing(false)
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
    // Snapshot metadata + themeMode to avoid stale closure when timer fires after re-render
    const snapMeta = metadata
    const snapTheme = themeMode
    renderTimers.current[chartId] = window.setTimeout(
      () => renderSingleChart(chartId, nextConfig, snapTheme, snapMeta),
      120
    )
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
    const snapMeta2 = metadata
    const snapTheme2 = themeMode
    renderTimers.current[chartId] = window.setTimeout(
      () => renderSingleChart(chartId, nextConfig, snapTheme2, snapMeta2),
      120
    )
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

  async function handleSync() {
    if (!dataset) return
    setSyncing(true)
    setSyncError('')
    try {
      const payload = await syncVisualizationDataset(dataset)
      const nextMetadata = payload.metadata || (await fetchVisualizationMetadata())
      const nextConfigs = buildInitialConfigs(nextMetadata)
      const nextFeatured = defaultFeaturedChart(nextMetadata)
      setMetadata(nextMetadata)
      setFeaturedChartId(nextFeatured)
      
      setSyncing(false)
      setTimeout(() => {
        renderAllCharts(nextConfigs, themeMode, nextMetadata).catch((err) => {
          setSyncError(err?.message || 'Background sync failed.')
        })
      }, 10)
    } catch (err) {
      setSyncError(err?.response?.data?.detail || err?.message || 'Visualization workspace could not be initialized.')
      setSyncing(false)
    }
  }


  return (
    <div className="viz-container">
      <div className="step-header">
        <div>
          <h1 className="page-title">Data Visualization</h1>
          <p className="page-subtitle">Auto-generate a rich suite of statistical and distribution charts from your dataset.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-primary" onClick={onComplete} disabled={syncing}>
            Continue to Prediction
          </button>
        </div>
      </div>

      {syncing ? (
        <div className="viz-sync-overlay">
          <div className="viz-sync-content">
            <div className="viz-sync-loader" />
            <h2 className="viz-sync-title">Synchronizing Engine</h2>
            <p className="viz-sync-subtitle">Preparing 20 industry-grade charts for your dataset analysis...</p>
          </div>
        </div>
      ) : syncError ? (
        <div className="alert alert-warning">
          <p>{syncError}</p>
          <button type="button" className="btn btn-secondary" onClick={handleSync}>Retry Synchronization</button>
        </div>
      ) : metadata ? (
        <div className="viz-grid">
          <main className="viz-main">
            <div className="viz-batch-head">
              <div className="section-title">Analysis Results</div>
              <p className="section-subtitle">All compatible visualizations generated for your dataset in a 3-column view (700x500).</p>
            </div>

            <div className="viz-batch-grid">
              {featuredChoices.map((chart) => {
                const result = chartResults[chart.id]
                const support = supportMap.get(chart.id)
                const config = chartConfigs[chart.id] || {}
                const options = chartOptions(chart.id, metadata)
                const hasError = !result?.figure && support?.enabled
                const errorMsg = result?.error || ''
                
                return (
                  <div key={chart.id} className="viz-batch-card">
                    <div className="viz-card-head">
                      <div>
                        <h3>{chart.label}</h3>
                        <p style={{ fontSize: '0.8rem' }}>{chart.description}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {hasError && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Retry rendering this chart"
                            onClick={() => renderSingleChart(chart.id, config)}
                            style={{ opacity: 0.85 }}
                          >
                            ↺
                          </button>
                        )}
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handlePinChart(chart)}
                          disabled={!result?.figure}
                        >
                          Pin
                        </button>
                      </div>
                    </div>

                    <div className={`viz-card-controls-inline ${chart.mode === 'single' ? 'is-single' : ''}`}>
                      {chart.mode === 'single' && (
                        <div className="viz-field-inline">
                          <span>Select Column</span>
                          <select 
                            value={config.column || ''} 
                            onChange={(e) => handleFieldChange(chart.id, 'column', e.target.value)}
                          >
                            {(options.single || []).map(c => <option key={c} value={c} style={{ background: '#121a2a', color: '#fff' }}>{c}</option>)}
                          </select>
                        </div>
                      )}
                      {(chart.mode === 'double' || chart.mode === 'time') && (
                        <>
                          <div className="viz-field-inline">
                            <span>{chart.mode === 'time' ? 'Date' : 'X Axis'}</span>
                            <select 
                              value={chart.mode === 'time' ? (config.date_column || '') : (config.x_column || '')} 
                              onChange={(e) => handleFieldChange(chart.id, chart.mode === 'time' ? 'date_column' : 'x_column', e.target.value)}
                            >
                              {((chart.mode === 'time' ? options.date : options.x) || []).map(c => <option key={c} value={c} style={{ background: '#121a2a', color: '#fff' }}>{c}</option>)}
                            </select>
                          </div>
                          <div className="viz-field-inline">
                            <span>{chart.mode === 'time' ? 'Value' : 'Y Axis'}</span>
                            <select 
                              value={chart.mode === 'time' ? (config.value_column || '') : (config.y_column || '')} 
                              onChange={(e) => handleFieldChange(chart.id, chart.mode === 'time' ? 'value_column' : 'y_column', e.target.value)}
                            >
                              {((chart.mode === 'time' ? options.value : options.y) || []).map(c => <option key={c} value={c} style={{ background: '#121a2a', color: '#fff' }}>{c}</option>)}
                            </select>
                          </div>
                        </>
                      )}
                      {chart.mode === 'multi' && (
                        <div className="viz-field-inline" style={{ gridColumn: '1 / -1' }}>
                          <span>Multiple Columns (First 2 shown)</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--viz-text-soft)' }}>
                            {config.columns?.join(', ') || 'None selected'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="viz-batch-preview">
                      {chartLoading[chart.id] ? (
                        <div className="viz-chart-loading">
                          <div className="viz-spinner" />
                          <span>Rendering...</span>
                        </div>
                      ) : result?.figure ? (
                        <PlotFigure 
                          figure={result.figure} 
                          themeMode={themeMode} 
                          style={{ width: '100%', height: '100%' }} 
                          lazy 
                        />
                      ) : (
                        <div className="viz-chart-loading">
                          {support?.enabled ? (
                            <>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                              </svg>
                              <span style={{ color: '#f59e0b', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center', maxWidth: '220px' }}>
                                {errorMsg || 'Could not render this chart.'}
                              </span>
                              <button
                                type="button"
                                onClick={() => renderSingleChart(chart.id, config)}
                                style={{
                                  marginTop: '0.4rem', padding: '0.35rem 0.9rem',
                                  background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                                  borderRadius: '8px', color: '#f59e0b', fontSize: '0.72rem',
                                  fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
                                }}
                              >
                                ↺ Retry
                              </button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--viz-text-muted)', fontSize: '0.8rem' }}>Unavailable for this dataset.</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {result?.warning && <div className="viz-inline-note is-warning" style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{result.warning}</div>}
                    {result?.note && <div className="viz-inline-note" style={{ fontSize: '0.72rem', padding: '0.4rem 0.5rem' }}>{result.note}</div>}
                  </div>
                )
              })}
            </div>
          </main>
        </div>
      ) : null}
    </div>
  )
}
