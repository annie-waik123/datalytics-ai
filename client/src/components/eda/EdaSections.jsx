import DataTable from '../DataTable.jsx'
import PlotFigure from '../PlotFigure.jsx'
import CustomDropdown from '../ui/CustomDropdown.jsx';
import {
  buildScopedOptions,
  CHART_OPTIONS,
  formatMetric,
  summariseTopValues,
} from './edaHelpers.js'

function MetricTile({ label, value, caption }) {
  return (
    <div className="eda-metric-tile">
      <span className="eda-metric-label">{label}</span>
      <strong className="eda-metric-value">{value}</strong>
      {caption && <span className="eda-metric-caption">{caption}</span>}
    </div>
  )
}

function SectionCard({ title, copy, actions, children }) {
  return (
    <section className="eda-card">
      <div className="eda-card-header">
        <div>
          <h3 className="eda-card-title">{title}</h3>
          {copy && <p className="eda-card-copy">{copy}</p>}
        </div>
        {actions && <div className="eda-card-actions">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

function SeverityBadge({ value }) {
  return <span className={`eda-severity-badge is-${value}`}>{value}</span>
}

export function EdaShapeSection({ summary }) {
  const shape = summary?.overview?.shape || {}
  const insights = summary?.insights?.cards || []

  return (
    <div className="eda-section-stack">
      <div className="eda-metric-grid">
        <MetricTile label="Total Rows" value={formatMetric(shape.rows)} caption="Current working dataset" />
        <MetricTile label="Total Columns" value={formatMetric(shape.columns)} caption="All visible features" />
        <MetricTile label="Numeric Fields" value={formatMetric(shape.numeric_columns)} caption="Continuous / Discrete" />
        <MetricTile label="Categorical Fields" value={formatMetric(shape.categorical_columns)} caption="Text / Categories" />
      </div>

      <div className="eda-insight-grid">
        {insights.map((card) => (
          <article key={card.title} className="eda-insight-card">
            <div className="eda-insight-head">
              <h4>{card.title}</h4>
              <SeverityBadge value={card.severity} />
            </div>
            <p>{card.summary}</p>
            <span>{card.action}</span>
          </article>
        ))}
      </div>
    </div>
  )
}

export function EdaInfoSection({ summary }) {
  return (
    <div className="eda-section-stack">
      <SectionCard title="Dataset Info (Schema)" copy="Column names, detected data types, uniqueness, and missing-value counts.">
        <DataTable
          rows={summary?.overview?.columns || []}
          columns={['column', 'dtype', 'non_null', 'missing', 'missing_pct', 'unique']}
          pageSize={12}
          sortable
        />
      </SectionCard>
    </div>
  )
}

export function EdaPreviewSection({ summary, previewMode, setPreviewMode }) {
  const previewRows = previewMode === 'tail' ? summary?.overview?.tail : summary?.overview?.head
  const previewLabel = previewMode === 'tail' ? 'Tail (Bottom Rows)' : 'Head (Top Rows)'

  return (
    <div className="eda-section-stack">
      <SectionCard
        title={previewLabel}
        copy="Inspect the raw rows before building charts or transforming features."
        actions={
          <div className="eda-inline-tabs">
            <button type="button" className={`eda-tab-btn${previewMode === 'head' ? ' is-active' : ''}`} onClick={() => setPreviewMode('head')}>Head</button>
            <button type="button" className={`eda-tab-btn${previewMode === 'tail' ? ' is-active' : ''}`} onClick={() => setPreviewMode('tail')}>Tail</button>
          </div>
        }
      >
        <DataTable rows={previewRows || []} pageSize={8} sortable highlightNulls />
      </SectionCard>
    </div>
  )
}

export function EdaStatsSection({ summary }) {
  const statistics = summary?.statistics || {}
  const numericRows = (statistics.numeric || []).map((item) => ({
    column: item.column,
    mean: formatMetric(item.mean),
    median: formatMetric(item.median),
    min: formatMetric(item.min),
    max: formatMetric(item.max),
    std: formatMetric(item.std),
    q25: formatMetric(item.q25),
    q75: formatMetric(item.q75),
  }))

  return (
    <div className="eda-section-stack">
      <SectionCard title="Statistical Summary" copy="Descriptive statistics for all numeric features (df.describe equivalent).">
        <DataTable rows={numericRows} pageSize={10} sortable />
      </SectionCard>
    </div>
  )
}

export function EdaMissingSection({ summary }) {
  const quality = summary?.quality || {}

  return (
    <div className="eda-section-stack">
      <div className="eda-metric-grid">
        <MetricTile label="Missing Cells" value={formatMetric(quality.missing_total)} caption="Across all columns" />
        <MetricTile label="Duplicate Rows" value={formatMetric(quality.duplicate_rows)} caption={`${quality.duplicate_pct || 0}% of dataset`} />
      </div>

      <SectionCard title="Missing Values Analysis" copy="Counts and percentages indicating nulls for every column.">
        <DataTable rows={quality.missing_by_column || []} columns={['column', 'missing', 'missing_pct']} pageSize={10} sortable />
      </SectionCard>
    </div>
  )
}

export function EdaDistributionSection({ summary }) {
  const distributionRows = (summary?.distribution || []).map((item) => ({
    column: item.column,
    skewness: formatMetric(item.skewness),
    kurtosis: formatMetric(item.kurtosis),
    skew_label: item.skew_label,
    kurtosis_label: item.kurtosis_label,
  }))

  return (
    <div className="eda-section-stack">
      <div className="eda-banner-label">Data Distribution (Normality & Spread)</div>
      <SectionCard title="Skewness & Kurtosis" copy="Identify if a measure is normally distributed, skewed, or has heavy tails.">
        <DataTable rows={distributionRows} pageSize={10} sortable />
      </SectionCard>
    </div>
  )
}

export function EdaOutliersSection({ summary }) {
  return (
    <div className="eda-section-stack">
      <SectionCard title="Outlier Detection (IQR)" copy="Rows falling outside the 1.5 IQR bounds for each column.">
        <DataTable rows={summary?.outliers?.iqr || []} columns={['column', 'count', 'lower_bound', 'upper_bound']} pageSize={8} sortable />
      </SectionCard>
      
      <SectionCard title="Outlier Detection (Z-Score)" copy="Rows falling beyond an extreme Z-Score threshold.">
        <DataTable rows={summary?.outliers?.zscore || []} columns={['column', 'count', 'threshold']} pageSize={8} sortable />
      </SectionCard>
    </div>
  )
}

export function EdaRelationshipSection({ summary, heatmapResult, heatmapLoading, heatmapError, onGenerateHeatmap, themeMode }) {
  return (
    <div className="eda-section-stack">
      <SectionCard
        title="Correlation Heatmap"
        copy="Visual map of correlations between all numeric columns. Darker cells = stronger relationship."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={onGenerateHeatmap}
            disabled={heatmapLoading}
          >
            {heatmapLoading ? 'Generating...' : 'Generate Heatmap'}
          </button>
        }
      >
        {heatmapError && <div className="eda-inline-error">{heatmapError}</div>}
        {heatmapResult?.figure
          ? <PlotFigure figure={heatmapResult.figure} themeMode={themeMode} style={{ minHeight: 480 }} />
          : !heatmapLoading && <div className="eda-empty-note">Click <strong>Generate Heatmap</strong> to render the interactive correlation matrix.</div>}
        {heatmapLoading && <div className="eda-loading-note">Rendering correlation heatmap from backend...</div>}
      </SectionCard>

      <SectionCard title="High-Correlation Pairs" copy="Column pairs with strong linear correlation — potential multicollinearity risks.">
        <DataTable rows={summary?.correlation?.high_pairs || []} columns={['left', 'right', 'correlation']} pageSize={10} sortable />
      </SectionCard>
    </div>
  )
}

export function EdaCategoricalSection({ summary }) {
  const statistics = summary?.statistics || {}
  const categoricalRows = (statistics.categorical || []).map((item) => ({
    column: item.column,
    unique: item.unique,
    mode: item.mode == null ? 'N/A' : String(item.mode),
    top_values: summariseTopValues(item.top_values),
  }))

  return (
    <div className="eda-section-stack">
      <SectionCard title="Categorical Analysis" copy="Frequency counts and most common categories in text/discrete data.">
        <DataTable rows={categoricalRows} pageSize={10} sortable />
      </SectionCard>
    </div>
  )
}

export function EdaVisualizationSection({
  summary,
  themeMode,
  chartConfig,
  setChartConfig,
  chartResult,
  chartLoading,
  chartError,
  onGenerateChart,
}) {
  const numericCols = summary?.available_columns?.numeric || []
  const categoricalCols = summary?.available_columns?.categorical || []
  const allCols = summary?.available_columns?.all || []

  const colOptions = allCols.map((c) => ({ value: c, label: c }))
  const numericOptions = numericCols.map((c) => ({ value: c, label: c }))
  const categoricalOptions = categoricalCols.map((c) => ({ value: c, label: c }))

  function field(label, children) {
    return (
      <div className="eda-field">
        <label className="eda-field-label">{label}</label>
        {children}
      </div>
    )
  }

  return (
    <div className="eda-section-stack">
      <SectionCard
        title="Interactive Chart Builder"
        copy="Select a chart type and columns to render backend-powered Plotly visualisations."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={onGenerateChart}
            disabled={chartLoading}
          >
            {chartLoading ? 'Rendering…' : 'Generate Chart'}
          </button>
        }
      >
        <div className="eda-form-grid">
          {field('Chart Type',
            <CustomDropdown
              className="eda-select"
              value={chartConfig.chartType}
              onChange={(e) => setChartConfig((p) => ({ ...p, chartType: e.target.value }))}
            >
              {CHART_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </CustomDropdown>
          )}
          {field('X Column',
            <CustomDropdown
              className="eda-select"
              value={chartConfig.xColumn}
              onChange={(e) => setChartConfig((p) => ({ ...p, xColumn: e.target.value }))}
            >
              <option value="">— None —</option>
              {colOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </CustomDropdown>
          )}
          {field('Y Column',
            <CustomDropdown
              className="eda-select"
              value={chartConfig.yColumn}
              onChange={(e) => setChartConfig((p) => ({ ...p, yColumn: e.target.value }))}
            >
              <option value="">— None —</option>
              {numericOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </CustomDropdown>
          )}
          {field('Color Column',
            <CustomDropdown
              className="eda-select"
              value={chartConfig.colorColumn}
              onChange={(e) => setChartConfig((p) => ({ ...p, colorColumn: e.target.value }))}
            >
              <option value="">— None —</option>
              {categoricalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </CustomDropdown>
          )}
        </div>

        {chartError && <div className="eda-inline-error">{chartError}</div>}
        {chartLoading && <div className="eda-loading-note">Rendering chart from backend…</div>}
        {chartResult?.figure && !chartLoading && (
          <PlotFigure figure={chartResult.figure} themeMode={themeMode} style={{ minHeight: 420 }} />
        )}
        {!chartResult && !chartLoading && !chartError && (
          <div className="eda-empty-note">Configure your chart options above and click <strong>Generate Chart</strong>.</div>
        )}
      </SectionCard>
    </div>
  )
}

export function EdaFeatureSection({
  summary,
  encodeForm,
  setEncodeForm,
  featureForm,
  setFeatureForm,
  transformForm,
  setTransformForm,
  scaleForm,
  setScaleForm,
  selectionForm,
  setSelectionForm,
  onApplyEncoding,
  onCreateFeature,
  onApplyTransformation,
  onApplyScaling,
  onApplySelection,
}) {
  const numericCols = summary?.available_columns?.numeric || []
  const categoricalCols = summary?.available_columns?.categorical || []
  const datetimeCols = summary?.available_columns?.datetime || []
  const allCols = summary?.available_columns?.all || []

  function field(label, children) {
    return (
      <div className="eda-field">
        <label className="eda-field-label">{label}</label>
        {children}
      </div>
    )
  }

  function colSelect(value, onChange, cols, allowNone = false) {
    return (
      <CustomDropdown className="eda-select" value={value} onChange={(val) => onChange(val)}>
        {allowNone && <option value="">— None —</option>}
        {cols.map((c) => <option key={c} value={c}>{c}</option>)}
      </CustomDropdown>
    )
  }

  return (
    <div className="eda-section-stack">
      {/* ── Encoding ──────────────────────────────────────────── */}
      <SectionCard
        title="Encoding"
        copy="Convert categorical columns into numeric representations."
        actions={
          <button type="button" className="btn btn-primary" onClick={onApplyEncoding}>
            Apply Encoding
          </button>
        }
      >
        <div className="eda-form-grid">
          {field('Method',
            <CustomDropdown className="eda-select" value={encodeForm.method} onChange={(val) => setEncodeForm((p) => ({ ...p, method: val }))}>
              <option value="label_encode">Label Encode</option>
              <option value="one_hot_encode">One-Hot Encode</option>
              <option value="ordinal_encode">Ordinal Encode</option>
            </CustomDropdown>
          )}
          {field('Columns',
            <CustomDropdown className="eda-select" value={encodeForm.scope} onChange={(val) => setEncodeForm((p) => ({ ...p, scope: val }))}>
              <option value="__categorical__">All Categorical</option>
              {categoricalCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </CustomDropdown>
          )}
          {field('Output Mode',
            <CustomDropdown className="eda-select" value={encodeForm.outputMode} onChange={(val) => setEncodeForm((p) => ({ ...p, outputMode: val }))}>
              <option value="append">Append</option>
              <option value="replace">Replace</option>
            </CustomDropdown>
          )}
        </div>
      </SectionCard>

      {/* ── Feature Creation ──────────────────────────────────── */}
      <SectionCard
        title="Feature Creation"
        copy="Create new columns from arithmetic operations or datetime components."
        actions={
          <button type="button" className="btn btn-primary" onClick={onCreateFeature}>
            Create Feature
          </button>
        }
      >
        <div className="eda-form-grid">
          {field('Mode',
            <CustomDropdown className="eda-select" value={featureForm.mode} onChange={(val) => setFeatureForm((p) => ({ ...p, mode: val }))}>
              <option value="arithmetic">Arithmetic</option>
              <option value="datetime_part">Datetime Part</option>
            </CustomDropdown>
          )}
          {featureForm.mode === 'arithmetic' ? (
            <>
              {field('Left Column', colSelect(featureForm.leftColumn, (v) => setFeatureForm((p) => ({ ...p, leftColumn: v })), numericCols))}
              {field('Operation',
                <CustomDropdown className="eda-select" value={featureForm.operation} onChange={(val) => setFeatureForm((p) => ({ ...p, operation: val }))}>
                  <option value="add">Add (+)</option>
                  <option value="subtract">Subtract (-)</option>
                  <option value="multiply">Multiply (×)</option>
                  <option value="divide">Divide (÷)</option>
                </CustomDropdown>
              )}
              {field('Right Column', colSelect(featureForm.rightColumn, (v) => setFeatureForm((p) => ({ ...p, rightColumn: v })), numericCols))}
            </>
          ) : (
            <>
              {field('Datetime Column', colSelect(featureForm.datetimeColumn, (v) => setFeatureForm((p) => ({ ...p, datetimeColumn: v })), datetimeCols))}
              {field('Component',
                <CustomDropdown className="eda-select" value={featureForm.component} onChange={(val) => setFeatureForm((p) => ({ ...p, component: val }))}>
                  <option value="year">Year</option>
                  <option value="month">Month</option>
                  <option value="day">Day</option>
                  <option value="weekday">Weekday</option>
                  <option value="hour">Hour</option>
                </CustomDropdown>
              )}
            </>
          )}
          {field('New Column Name',
            <input
              className="eda-input"
              type="text"
              value={featureForm.newColumn}
              onChange={(e) => setFeatureForm((p) => ({ ...p, newColumn: e.target.value }))}
              placeholder="e.g. revenue_per_unit"
            />
          )}
        </div>
      </SectionCard>

      {/* ── Transformation ───────────────────────────────────── */}
      <SectionCard
        title="Transformation"
        copy="Apply mathematical transformations to handle skewed distributions."
        actions={
          <button type="button" className="btn btn-primary" onClick={onApplyTransformation}>
            Apply Transformation
          </button>
        }
      >
        <div className="eda-form-grid">
          {field('Transformation',
            <CustomDropdown className="eda-select" value={transformForm.transformation} onChange={(val) => setTransformForm((p) => ({ ...p, transformation: val }))}>
              <option value="log1p">Log1p</option>
              <option value="sqrt">Square Root</option>
              <option value="square">Square</option>
              <option value="reciprocal">Reciprocal</option>
              <option value="cbrt">Cube Root</option>
            </CustomDropdown>
          )}
          {field('Columns',
            <CustomDropdown className="eda-select" value={transformForm.scope} onChange={(val) => setTransformForm((p) => ({ ...p, scope: val }))}>
              <option value="__numeric__">All Numeric</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </CustomDropdown>
          )}
          {field('Output Mode',
            <CustomDropdown className="eda-select" value={transformForm.outputMode} onChange={(val) => setTransformForm((p) => ({ ...p, outputMode: val }))}>
              <option value="append">Append</option>
              <option value="replace">Replace</option>
            </CustomDropdown>
          )}
        </div>
      </SectionCard>

      {/* ── Scaling ──────────────────────────────────────────── */}
      <SectionCard
        title="Scaling"
        copy="Normalise or standardise numeric columns to a common scale."
        actions={
          <button type="button" className="btn btn-primary" onClick={onApplyScaling}>
            Apply Scaling
          </button>
        }
      >
        <div className="eda-form-grid">
          {field('Scaler',
            <CustomDropdown className="eda-select" value={scaleForm.scaler} onChange={(val) => setScaleForm((p) => ({ ...p, scaler: val }))}>
              <option value="minmax">Min-Max (0–1)</option>
              <option value="standard">Standard (Z-score)</option>
              <option value="robust">Robust (IQR)</option>
            </CustomDropdown>
          )}
          {field('Columns',
            <CustomDropdown className="eda-select" value={scaleForm.scope} onChange={(val) => setScaleForm((p) => ({ ...p, scope: val }))}>
              <option value="__numeric__">All Numeric</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </CustomDropdown>
          )}
        </div>
      </SectionCard>

      {/* ── Feature Selection ─────────────────────────────────── */}
      <SectionCard
        title="Feature Selection"
        copy="Keep or drop specific columns to refine the working dataset."
        actions={
          <button type="button" className="btn btn-primary" onClick={onApplySelection}>
            Apply Selection
          </button>
        }
      >
        <div className="eda-form-grid">
          {field('Mode',
            <CustomDropdown className="eda-select" value={selectionForm.mode} onChange={(val) => setSelectionForm((p) => ({ ...p, mode: val }))}>
              <option value="keep">Keep Selected</option>
              <option value="drop">Drop Selected</option>
            </CustomDropdown>
          )}
          {field('Columns (multi-select)',
            <CustomDropdown
              className="eda-select"
              multiple
              size={Math.min(6, allCols.length || 3)}
              value={selectionForm.columns}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (o) => o.value)
                setSelectionForm((p) => ({ ...p, columns: selected }))
              }}
            >
              {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </CustomDropdown>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
