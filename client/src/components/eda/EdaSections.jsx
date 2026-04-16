import DataTable from '../DataTable.jsx'
import PlotFigure from '../PlotFigure.jsx'
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
