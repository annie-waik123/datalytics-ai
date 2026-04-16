import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import { createEdaChart, downloadEdaCsv, fetchEdaReportHtml, runEdaAction, syncDatasetToBackend } from '../api/eda.js'
import { useToast } from '../hooks/useToast.js'
import {
  buildScopedOptions,
  downloadBlob,
  resolveScopedColumns,
  SECTION_ITEMS,
} from './eda/edaHelpers.js'
import {
  EdaShapeSection,
  EdaInfoSection,
  EdaPreviewSection,
  EdaStatsSection,
  EdaMissingSection,
  EdaDistributionSection,
  EdaOutliersSection,
  EdaRelationshipSection,
  EdaCategoricalSection,
  EdaVisualizationSection,
  EdaFeatureSection,
} from './eda/EdaSections.jsx'

const THEME_KEY = 'datalytics_eda_theme'

function firstOption(options, fallback = '') {
  return options[0]?.value || fallback
}

function defaultChartState(summary) {
  const numericOptions = summary?.available_columns?.numeric || []
  const categoricalOptions = summary?.available_columns?.categorical || []
  const datetimeOptions = summary?.available_columns?.datetime || []
  return {
    chartType: summary?.available_columns?.numeric?.length > 1 ? 'heatmap' : 'histogram',
    xColumn: numericOptions[0] || categoricalOptions[0] || datetimeOptions[0] || '',
    yColumn: numericOptions[1] || numericOptions[0] || '',
    colorColumn: categoricalOptions[0] || '',
    zColumn: numericOptions[2] || '',
    aggregation: 'mean',
    bins: 24,
    rollingWindow: 7,
  }
}

function buildPdfSummary(summary) {
  const shape = summary?.overview?.shape || {}
  const quality = summary?.quality || {}
  const insights = summary?.insights?.cards || []
  const correlations = summary?.correlation?.high_pairs || []
  const statistics = summary?.statistics || {}
  const distribution = summary?.distribution || []
  const iqrOutliers = summary?.outliers?.iqr || []
  const zscoreOutliers = summary?.outliers?.zscore || []
  const categoricalStats = statistics.categorical || []
  const numericStats = statistics.numeric || []
  const missingByCol = quality.missing_by_column || []
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  const lines = []

  // ── Header ──────────────────────────────────────────────
  lines.push('============================================================')
  lines.push('           DATALYTICS — DATA EXPLORATION REPORT')
  lines.push('           Powered by Datalytics Analytics Platform')
  lines.push('============================================================')
  lines.push(`Generated: ${now}`)
  lines.push('')

  // ── Executive Summary ────────────────────────────────────
  if (summary?.insights?.executive_summary) {
    lines.push('━━ AI EXECUTIVE SUMMARY ━━')
    lines.push(summary.insights.executive_summary)
    lines.push('')
  }

  // ── 1. Dataset Shape ─────────────────────────────────────
  lines.push('━━ 1. DATASET SHAPE (df.shape) ━━')
  lines.push(`  Total Rows      : ${shape.rows ?? 0}`)
  lines.push(`  Total Columns   : ${shape.columns ?? 0}`)
  lines.push(`  Numeric Fields  : ${shape.numeric_columns ?? 0}`)
  lines.push(`  Categorical     : ${shape.categorical_columns ?? 0}`)
  lines.push(`  Datetime Fields : ${shape.datetime_columns ?? 0}`)
  lines.push('')

  // ── 2. Dataset Info ──────────────────────────────────────
  lines.push('━━ 2. DATASET INFO (df.info) ━━')
  const columns = summary?.overview?.columns || []
  if (columns.length) {
    lines.push('  Column               | DType      | Non-Null | Missing | Unique')
    lines.push('  ' + '-'.repeat(62))
    columns.forEach((col) => {
      const name = String(col.column || '').padEnd(20)
      const dtype = String(col.dtype || '').padEnd(10)
      const nonNull = String(col.non_null ?? '').padEnd(8)
      const missing = String(col.missing ?? '').padEnd(7)
      const unique = String(col.unique ?? '')
      lines.push(`  ${name} | ${dtype} | ${nonNull} | ${missing} | ${unique}`)
    })
  } else {
    lines.push('  No schema available.')
  }
  lines.push('')

  // ── 3. Dataset Preview (Head) ────────────────────────────
  lines.push('━━ 3. DATASET PREVIEW (df.head) ━━')
  const headRows = summary?.overview?.head || []
  if (headRows.length) {
    const keys = Object.keys(headRows[0] || {})
    lines.push('  ' + keys.slice(0, 6).join(' | '))
    headRows.slice(0, 5).forEach((row) => {
      lines.push('  ' + keys.slice(0, 6).map((k) => String(row[k] ?? '')).join(' | '))
    })
  } else {
    lines.push('  No preview data available.')
  }
  lines.push('')

  // ── 4. Statistical Summary ───────────────────────────────
  lines.push('━━ 4. STATISTICAL SUMMARY (df.describe) ━━')
  if (numericStats.length) {
    numericStats.forEach((col) => {
      lines.push(`  [${col.column}]  mean=${col.mean?.toFixed(3) ?? 'N/A'}  median=${col.median?.toFixed(3) ?? 'N/A'}  std=${col.std?.toFixed(3) ?? 'N/A'}  min=${col.min ?? 'N/A'}  max=${col.max ?? 'N/A'}  Q1=${col.q25 ?? 'N/A'}  Q3=${col.q75 ?? 'N/A'}`)
    })
  } else {
    lines.push('  No numeric columns.')
  }
  lines.push('')

  // ── 5. Missing Values ────────────────────────────────────
  lines.push('━━ 5. MISSING VALUES (df.isnull().sum) ━━')
  lines.push(`  Total Missing Cells : ${quality.missing_total ?? 0}`)
  lines.push(`  Duplicate Rows      : ${quality.duplicate_rows ?? 0} (${quality.duplicate_pct ?? 0}%)`)
  if (missingByCol.length) {
    missingByCol.filter((r) => r.missing > 0).forEach((r) => {
      lines.push(`  ${r.column}: ${r.missing} missing (${r.missing_pct}%)`)
    })
  } else {
    lines.push('  No missing values detected.')
  }
  lines.push('')

  // ── 6. Data Distribution ─────────────────────────────────
  lines.push('━━ 6. DATA DISTRIBUTION ━━')
  if (distribution.length) {
    distribution.forEach((col) => {
      lines.push(`  [${col.column}]  Skewness=${col.skewness?.toFixed(3) ?? 'N/A'} (${col.skew_label ?? ''})  Kurtosis=${col.kurtosis?.toFixed(3) ?? 'N/A'} (${col.kurtosis_label ?? ''})`)
    })
  } else {
    lines.push('  No distribution data.')
  }
  lines.push('')

  // ── 7. Outlier Detection ─────────────────────────────────
  lines.push('━━ 7. OUTLIER DETECTION ━━')
  lines.push('  IQR Method:')
  if (iqrOutliers.length) {
    iqrOutliers.forEach((r) => lines.push(`    ${r.column}: ${r.count} outliers  [${r.lower_bound} — ${r.upper_bound}]`))
  } else {
    lines.push('    No IQR outliers detected.')
  }
  lines.push('  Z-Score Method:')
  if (zscoreOutliers.length) {
    zscoreOutliers.forEach((r) => lines.push(`    ${r.column}: ${r.count} outliers  (threshold: ${r.threshold})`))
  } else {
    lines.push('    No Z-Score outliers detected.')
  }
  lines.push('')

  // ── 8. Relationship Analysis ─────────────────────────────
  lines.push('━━ 8. RELATIONSHIP ANALYSIS (Correlation) ━━')
  if (correlations.length) {
    correlations.slice(0, 10).forEach((pair) => {
      lines.push(`  ${pair.left}  x  ${pair.right}  →  r=${pair.correlation}`)
    })
  } else {
    lines.push('  No high-correlation pairs detected.')
  }
  lines.push('')

  // ── 9. Categorical Analysis ──────────────────────────────
  lines.push('━━ 9. CATEGORICAL ANALYSIS ━━')
  if (categoricalStats.length) {
    categoricalStats.forEach((col) => {
      lines.push(`  [${col.column}]  Unique=${col.unique}  Mode=${col.mode ?? 'N/A'}  Top: ${(col.top_values || []).slice(0, 3).map((v) => `${v.value}(${v.count})`).join(', ')}`)
    })
  } else {
    lines.push('  No categorical columns.')
  }
  lines.push('')

  // ── Top Insights ─────────────────────────────────────────
  if (insights.length) {
    lines.push('━━ AI INSIGHTS ━━')
    insights.forEach((card, i) => lines.push(`  ${i + 1}. [${card.severity?.toUpperCase()}] ${card.title}: ${card.summary}`))
    lines.push('')
  }

  lines.push('============================================================')
  lines.push('           END OF REPORT — DATALYTICS PLATFORM')
  lines.push('============================================================')

  return lines.join('\n')
}

export default function ExploreStep({
  dataset,
  explorationReady,
  onComplete,
  onDatasetUpdate,
  onJumpToUpload,
}) {
  const { addToast } = useToast()
  const [activeSection, setActiveSection] = useState('shape')
  const [themeMode, setThemeMode] = useState('dark')
  const [previewMode, setPreviewMode] = useState('head')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [chartResult, setChartResult] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [chartConfig, setChartConfig] = useState(defaultChartState())
  const [heatmapResult, setHeatmapResult] = useState(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmapError, setHeatmapError] = useState('')
  const [missingForm, setMissingForm] = useState({ scope: '', strategy: 'mean', fillValue: '' })
  const [outlierForm, setOutlierForm] = useState({ scope: '', method: 'iqr', mode: 'remove' })
  const [replaceForm, setReplaceForm] = useState({ scope: '', matchMode: 'contains', findValue: '', replaceValue: '' })
  const [dtypeForm, setDtypeForm] = useState({ column: '', targetType: 'float' })
  const [encodeForm, setEncodeForm] = useState({ scope: '', method: 'label_encode', outputMode: 'append' })
  const [featureForm, setFeatureForm] = useState({
    mode: 'arithmetic',
    leftColumn: '',
    rightColumn: '',
    operation: 'add',
    datetimeColumn: '',
    component: 'month',
    newColumn: '',
  })
  const [transformForm, setTransformForm] = useState({ scope: '', transformation: 'log1p', outputMode: 'append' })
  const [scaleForm, setScaleForm] = useState({ scope: '', scaler: 'minmax' })
  const [selectionForm, setSelectionForm] = useState({ mode: 'keep', columns: [] })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedTheme = localStorage.getItem(THEME_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setThemeMode(storedTheme)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(THEME_KEY, themeMode)
  }, [themeMode])

  useEffect(() => {
    if (!dataset) return
    let ignore = false

    async function loadSummary() {
      setLoading(true)
      setError('')
      try {
        const payload = await syncDatasetToBackend(dataset)
        if (ignore) return
        setSummary(payload.summary)
        onComplete('exploration')
      } catch (err) {
        if (ignore) return
        setError(err?.response?.data?.detail || err?.message || 'Unable to load EDA summary.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadSummary()
    return () => {
      ignore = true
    }
  }, [dataset])

  useEffect(() => {
    if (!summary) return
    const nextChart = defaultChartState(summary)
    setChartConfig((prev) => ({
      ...nextChart,
      ...prev,
      xColumn: prev.xColumn || nextChart.xColumn,
      yColumn: prev.yColumn || nextChart.yColumn,
      colorColumn: prev.colorColumn || nextChart.colorColumn,
      zColumn: prev.zColumn || nextChart.zColumn,
    }))

    setMissingForm((prev) => ({ ...prev, scope: prev.scope || firstOption(buildScopedOptions(summary, 'all')) }))
    setOutlierForm((prev) => ({ ...prev, scope: prev.scope || firstOption(buildScopedOptions(summary, 'numeric')) }))
    setReplaceForm((prev) => ({ ...prev, scope: prev.scope || firstOption(buildScopedOptions(summary, 'categorical')) }))
    setDtypeForm((prev) => ({ ...prev, column: prev.column || summary?.available_columns?.all?.[0] || '' }))
    setEncodeForm((prev) => ({ ...prev, scope: prev.scope || firstOption(buildScopedOptions(summary, 'categorical')) }))
    setFeatureForm((prev) => ({
      ...prev,
      leftColumn: prev.leftColumn || summary?.available_columns?.numeric?.[0] || '',
      rightColumn: prev.rightColumn || summary?.available_columns?.numeric?.[1] || summary?.available_columns?.numeric?.[0] || '',
      datetimeColumn: prev.datetimeColumn || summary?.available_columns?.datetime?.[0] || '',
    }))
    setTransformForm((prev) => ({ ...prev, scope: prev.scope || firstOption(buildScopedOptions(summary, 'numeric')) }))
    setScaleForm((prev) => ({ ...prev, scope: prev.scope || firstOption(buildScopedOptions(summary, 'numeric')) }))
  }, [summary])

  const isBusy = loading || chartLoading || Boolean(actionLoading)

  async function handleGenerateChart() {
    setChartLoading(true)
    setChartError('')
    try {
      const payload = await createEdaChart({
        chart_type: chartConfig.chartType,
        x_column: chartConfig.xColumn || null,
        y_column: chartConfig.yColumn || null,
        color_column: chartConfig.colorColumn || null,
        z_column: chartConfig.zColumn || null,
        aggregation: chartConfig.aggregation,
        bins: chartConfig.bins,
        rolling_window: chartConfig.rollingWindow,
        theme: themeMode,
      })
      setChartResult(payload)
    } catch (err) {
      setChartError(err?.response?.data?.detail || err?.message || 'Unable to generate chart.')
    } finally {
      setChartLoading(false)
    }
  }

  async function handleRefreshAnalysis() {
    setLoading(true)
    setError('')
    try {
      const payload = await syncDatasetToBackend(dataset)
      setSummary(payload.summary)
      onComplete('exploration')
      addToast('EDA analysis refreshed.', null, 'success')
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to refresh EDA summary.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateHeatmap() {
    setHeatmapLoading(true)
    setHeatmapError('')
    try {
      const payload = await createEdaChart({
        chart_type: 'heatmap',
        x_column: null,
        y_column: null,
        color_column: null,
        z_column: null,
        aggregation: 'mean',
        bins: 24,
        rolling_window: 7,
        theme: themeMode,
      })
      setHeatmapResult(payload)
    } catch (err) {
      setHeatmapError(err?.response?.data?.detail || err?.message || 'Unable to generate correlation heatmap.')
    } finally {
      setHeatmapLoading(false)
    }
  }

  async function handleAction(action, options = {}) {
    setActionLoading(action)
    try {
      const result = await runEdaAction(action, options)
      setSummary(result.summary)
      onDatasetUpdate(result.dataset)
      onComplete('exploration')
      addToast(result.message, null, 'success')
    } catch (err) {
      addToast(err?.response?.data?.detail || err?.message || 'EDA action failed.', null, 'error')
    } finally {
      setActionLoading('')
    }
  }

  async function handleDownloadHtml() {
    try {
      const html = await fetchEdaReportHtml()
      downloadBlob('datalytics-eda-report.html', new Blob([html], { type: 'text/html;charset=utf-8' }))
      addToast('EDA HTML report downloaded.', null, 'success')
    } catch (err) {
      addToast(err?.response?.data?.detail || err?.message || 'Could not download HTML report.', null, 'error')
    }
  }

  async function handleDownloadCsv() {
    try {
      const response = await downloadEdaCsv()
      downloadBlob('datalytics-cleaned-dataset.csv', response.data)
      addToast('Cleaned dataset downloaded.', null, 'success')
    } catch (err) {
      addToast(err?.response?.data?.detail || err?.message || 'Could not download cleaned dataset.', null, 'error')
    }
  }

  function handleDownloadPdf() {
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 14
    const lineHeight = 6
    let y = margin

    function addLine(text, size = 9, bold = false, color = [220, 220, 220]) {
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(text, pageW - margin * 2)
      lines.forEach((line) => {
        if (y + lineHeight > pageH - 10) {
          doc.addPage()
          // dark background for new page
          doc.setFillColor(13, 15, 25)
          doc.rect(0, 0, pageW, pageH, 'F')
          y = margin
        }
        doc.text(line, margin, y)
        y += lineHeight
      })
    }

    // Dark background on first page
    doc.setFillColor(13, 15, 25)
    doc.rect(0, 0, pageW, pageH, 'F')

    // Neon header bar
    doc.setFillColor(16, 185, 129)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(13, 15, 25)
    doc.text('DATALYTICS', margin, 14)
    doc.setFontSize(9)
    doc.text('Data Exploration Report', pageW - margin - 58, 14)
    y = 30

    const content = buildPdfSummary(summary)
    const contentLines = content.split('\n')

    contentLines.forEach((line) => {
      if (line.startsWith('━━')) {
        y += 3
        addLine(line, 10, true, [16, 185, 129])
        y += 1
      } else if (line.startsWith('===')) {
        addLine(line, 8, false, [80, 80, 100])
      } else if (line.trim() === '') {
        y += 2
      } else {
        addLine(line, 8.5, false, [200, 200, 210])
      }
    })

    doc.save('datalytics-eda-report.pdf')
    addToast('Full EDA report downloaded as PDF.', null, 'success')
  }

  function renderSection() {
    switch (activeSection) {
      case 'info':
        return <EdaInfoSection summary={summary} />
      case 'preview':
        return <EdaPreviewSection summary={summary} previewMode={previewMode} setPreviewMode={setPreviewMode} />
      case 'stats':
        return <EdaStatsSection summary={summary} />
      case 'missing':
        return <EdaMissingSection summary={summary} />
      case 'distribution':
        return <EdaDistributionSection summary={summary} />
      case 'outliers':
        return <EdaOutliersSection summary={summary} />
      case 'relationships':
        return (
          <EdaRelationshipSection
            summary={summary}
            heatmapResult={heatmapResult}
            heatmapLoading={heatmapLoading}
            heatmapError={heatmapError}
            onGenerateHeatmap={handleGenerateHeatmap}
            themeMode={themeMode}
          />
        )
      case 'categorical':
        return <EdaCategoricalSection summary={summary} />
      case 'visualization':
        return (
          <EdaVisualizationSection
            summary={summary}
            themeMode={themeMode}
            chartConfig={chartConfig}
            setChartConfig={setChartConfig}
            chartResult={chartResult}
            chartLoading={chartLoading}
            chartError={chartError}
            onGenerateChart={handleGenerateChart}
          />
        )
      case 'features':
        return (
          <EdaFeatureSection
            summary={summary}
            encodeForm={encodeForm}
            setEncodeForm={setEncodeForm}
            featureForm={featureForm}
            setFeatureForm={setFeatureForm}
            transformForm={transformForm}
            setTransformForm={setTransformForm}
            scaleForm={scaleForm}
            setScaleForm={setScaleForm}
            selectionForm={selectionForm}
            setSelectionForm={setSelectionForm}
            onApplyEncoding={() => handleAction(encodeForm.method, {
              columns: resolveScopedColumns(encodeForm.scope, summary, 'categorical'),
              output_mode: encodeForm.outputMode,
              drop_first: false,
            })}
            onCreateFeature={() => handleAction('create_feature', featureForm.mode === 'datetime_part' ? {
              mode: 'datetime_part',
              column: featureForm.datetimeColumn,
              component: featureForm.component,
              new_column: featureForm.newColumn,
            } : {
              mode: 'arithmetic',
              left_column: featureForm.leftColumn,
              right_column: featureForm.rightColumn,
              operation: featureForm.operation,
              new_column: featureForm.newColumn,
            })}
            onApplyTransformation={() => handleAction('transform_feature', {
              columns: resolveScopedColumns(transformForm.scope, summary, 'numeric'),
              transformation: transformForm.transformation,
              output_mode: transformForm.outputMode,
            })}
            onApplyScaling={() => handleAction('scale_features', {
              columns: resolveScopedColumns(scaleForm.scope, summary, 'numeric'),
              scaler: scaleForm.scaler,
            })}
            onApplySelection={() => handleAction('select_features', {
              mode: selectionForm.mode,
              columns: selectionForm.columns,
            })}
          />
        )
      case 'shape':
      default:
        return <EdaShapeSection summary={summary} />
    }
  }

  if (!dataset) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to start exploration</h2>
        <p>The EDA workspace profiles quality, statistics, visual patterns, cleaning actions, and feature engineering automatically.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  return (
    <div className={`eda-workspace ${themeMode === 'light' ? 'is-light' : 'is-dark'}`}>
      <div className="eda-shell">
        <aside className="eda-sidebar">
          <div className="eda-sidebar-head">
            <span className="eda-kicker">Advanced EDA</span>
            <h2>Data Exploration Lab</h2>
            <p>{explorationReady ? 'Exploration synced and ready.' : 'Preparing backend analysis session.'}</p>
          </div>

          <nav className="eda-sidebar-nav">
            {SECTION_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`eda-sidebar-link${activeSection === item.key ? ' is-active' : ''}`}
                onClick={() => setActiveSection(item.key)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="eda-main">
          <div className="eda-toolbar">
            <div>
              <h1 className="eda-title">Data Exploration</h1>
              <p className="eda-subtitle">Modern EDA workspace with backend profiling, interactive visuals, cleaning actions, and feature engineering.</p>
            </div>
            <div className="eda-toolbar-actions">
              <button type="button" className="btn btn-primary" onClick={handleDownloadPdf} disabled={!summary}>Download PDF</button>
            </div>
          </div>

          {summary?.insights?.executive_summary && (
            <div className="eda-executive-banner">
              <span className="eda-banner-label">AI Summary</span>
              <p>{summary.insights.executive_summary}</p>
            </div>
          )}

          {loading && <div className="eda-loading-panel">Analyzing dataset with backend EDA services...</div>}
          {error && <div className="eda-inline-error">{error}</div>}
          {!loading && !error && summary && renderSection()}
        </div>
      </div>
    </div>
  )
}
