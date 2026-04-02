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
  EdaCleaningSection,
  EdaFeatureSection,
  EdaOverviewSection,
  EdaQualitySection,
  EdaVisualizationSection,
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

  return [
    'DATALYTICS EDA REPORT',
    '',
    summary?.insights?.executive_summary || '',
    '',
    `Rows: ${shape.rows || 0}`,
    `Columns: ${shape.columns || 0}`,
    `Numeric columns: ${shape.numeric_columns || 0}`,
    `Categorical columns: ${shape.categorical_columns || 0}`,
    `Datetime columns: ${shape.datetime_columns || 0}`,
    `Missing cells: ${quality.missing_total || 0}`,
    `Duplicate rows: ${quality.duplicate_rows || 0}`,
    '',
    'Top Insights',
    ...insights.map((item, index) => `${index + 1}. ${item.title}: ${item.summary}`),
    '',
    'High Correlation Pairs',
    ...(correlations.length ? correlations.slice(0, 8).map((item) => `${item.left} x ${item.right}: ${item.correlation}`) : ['No major multicollinearity pairs detected.']),
  ].join('\n')
}

export default function ExploreStep({
  dataset,
  explorationReady,
  onComplete,
  onDatasetUpdate,
  onJumpToUpload,
}) {
  const { addToast } = useToast()
  const [activeSection, setActiveSection] = useState('overview')
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
    const content = doc.splitTextToSize(buildPdfSummary(summary), 180)
    doc.text(content, 12, 18)
    doc.save('datalytics-eda-report.pdf')
    addToast('EDA PDF report downloaded.', null, 'success')
  }

  function renderSection() {
    switch (activeSection) {
      case 'quality':
        return <EdaQualitySection summary={summary} />
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
      case 'cleaning':
        return (
          <EdaCleaningSection
            summary={summary}
            missingForm={missingForm}
            setMissingForm={setMissingForm}
            outlierForm={outlierForm}
            setOutlierForm={setOutlierForm}
            replaceForm={replaceForm}
            setReplaceForm={setReplaceForm}
            dtypeForm={dtypeForm}
            setDtypeForm={setDtypeForm}
            onApplyMissing={() => handleAction('fill_missing', {
              columns: resolveScopedColumns(missingForm.scope, summary),
              strategy: missingForm.strategy,
              fill_value: missingForm.fillValue,
            })}
            onApplyOutliers={() => handleAction('handle_outliers', {
              columns: resolveScopedColumns(outlierForm.scope, summary, 'numeric'),
              method: outlierForm.method,
              mode: outlierForm.mode,
            })}
            onApplyReplace={() => handleAction('find_replace', {
              columns: resolveScopedColumns(replaceForm.scope, summary, 'categorical'),
              match_mode: replaceForm.matchMode,
              find_value: replaceForm.findValue,
              replace_value: replaceForm.replaceValue,
            })}
            onConvertType={() => handleAction('convert_dtype', {
              column: dtypeForm.column,
              target_dtype: dtypeForm.targetType,
            })}
            onRemoveDuplicates={() => handleAction('remove_duplicates')}
            onTrimWhitespace={() => handleAction('trim_whitespace', {
              columns: summary?.available_columns?.categorical || [],
            })}
            onResetDataset={() => handleAction('reset_dataset')}
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
      case 'overview':
      default:
        return <EdaOverviewSection summary={summary} previewMode={previewMode} setPreviewMode={setPreviewMode} />
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
              <button type="button" className="btn btn-secondary" onClick={() => setThemeMode((value) => value === 'dark' ? 'light' : 'dark')} disabled={isBusy}>
                {themeMode === 'dark' ? 'Light Theme' : 'Dark Theme'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleRefreshAnalysis} disabled={isBusy}>
                Refresh Analysis
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleDownloadCsv} disabled={isBusy}>Download CSV</button>
              <button type="button" className="btn btn-secondary" onClick={handleDownloadHtml} disabled={isBusy}>Download HTML</button>
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
