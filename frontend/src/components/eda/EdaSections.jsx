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

export function EdaOverviewSection({ summary, previewMode, setPreviewMode }) {
  const shape = summary?.overview?.shape || {}
  const previewRows = previewMode === 'tail' ? summary?.overview?.tail : summary?.overview?.head
  const previewLabel = previewMode === 'tail' ? 'Tail Preview' : 'Head Preview'
  const insights = summary?.insights?.cards || []
  const highlights = summary?.highlights || {}

  return (
    <div className="eda-section-stack">
      <div className="eda-metric-grid">
        <MetricTile label="Rows" value={formatMetric(shape.rows)} caption="Current working dataset" />
        <MetricTile label="Columns" value={formatMetric(shape.columns)} caption="All visible features" />
        <MetricTile label="Numeric" value={formatMetric(shape.numeric_columns)} caption="Ready for stats and charts" />
        <MetricTile label="Datetime" value={formatMetric(shape.datetime_columns)} caption="Time-series capable" />
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

      <div className="eda-highlight-grid">
        <SectionCard title="Important Features" copy="High-variance, high-skew, and high-correlation features worth inspecting first.">
          <div className="eda-chip-cloud">
            {highlights.high_variance?.map((item) => (
              <span key={`variance-${item.column}`} className="eda-chip">Variance: {item.column}</span>
            ))}
            {highlights.high_skew?.map((item) => (
              <span key={`skew-${item.column}`} className="eda-chip">Skew: {item.column}</span>
            ))}
            {highlights.high_correlation_pairs?.map((item) => (
              <span key={`corr-${item.left}-${item.right}`} className="eda-chip">Corr: {item.left} x {item.right}</span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Schema" copy="Column names, detected data types, uniqueness, and missing-value percentages.">
          <DataTable
            rows={summary?.overview?.columns || []}
            columns={['column', 'dtype', 'non_null', 'missing', 'missing_pct', 'unique']}
            pageSize={8}
            sortable
          />
        </SectionCard>
      </div>

      <SectionCard
        title={previewLabel}
        copy="Inspect the first or last 20 rows before building charts or transforming features."
        actions={
          <div className="eda-inline-tabs">
            <button type="button" className={`eda-tab-btn${previewMode === 'head' ? ' is-active' : ''}`} onClick={() => setPreviewMode('head')}>Head</button>
            <button type="button" className={`eda-tab-btn${previewMode === 'tail' ? ' is-active' : ''}`} onClick={() => setPreviewMode('tail')}>Tail</button>
          </div>
        }
      >
        <DataTable rows={previewRows || []} pageSize={5} sortable highlightNulls />
      </SectionCard>
    </div>
  )
}

export function EdaQualitySection({ summary }) {
  const quality = summary?.quality || {}
  const statistics = summary?.statistics || {}
  const grouping = summary?.grouping || {}
  const timeSeries = summary?.time_series || {}

  const numericRows = (statistics.numeric || []).map((item) => ({
    column: item.column,
    mean: formatMetric(item.mean),
    median: formatMetric(item.median),
    mode: item.mode == null ? 'N/A' : String(item.mode),
    min: formatMetric(item.min),
    max: formatMetric(item.max),
    std: formatMetric(item.std),
    q25: formatMetric(item.q25),
    q75: formatMetric(item.q75),
  }))

  const categoricalRows = (statistics.categorical || []).map((item) => ({
    column: item.column,
    unique: item.unique,
    mode: item.mode == null ? 'N/A' : String(item.mode),
    top_values: summariseTopValues(item.top_values),
  }))

  const distributionRows = (summary?.distribution || []).map((item) => ({
    column: item.column,
    skewness: formatMetric(item.skewness),
    kurtosis: formatMetric(item.kurtosis),
    skew_label: item.skew_label,
    kurtosis_label: item.kurtosis_label,
  }))

  return (
    <div className="eda-section-stack">
      <div className="eda-metric-grid">
        <MetricTile label="Missing Cells" value={formatMetric(quality.missing_total)} caption="Across all columns" />
        <MetricTile label="Duplicate Rows" value={formatMetric(quality.duplicate_rows)} caption={`${quality.duplicate_pct || 0}% of dataset`} />
        <MetricTile label="Invalid Patterns" value={formatMetric(quality.invalid_entries?.length || 0)} caption="Whitespace, variants, or bad dates" />
        <MetricTile label="Constant Columns" value={formatMetric(quality.constant_columns?.length || 0)} caption="Usually weak predictors" />
      </div>

      <div className="eda-highlight-grid">
        <SectionCard title="Missing Values" copy="Counts and percentages for every column, sorted by impact.">
          <DataTable rows={quality.missing_by_column || []} columns={['column', 'missing', 'missing_pct']} pageSize={8} sortable />
        </SectionCard>

        <SectionCard title="Invalid or Inconsistent Data" copy="Potential whitespace problems, category variants, and invalid datetime values.">
          <DataTable rows={quality.invalid_entries || []} columns={['column', 'issue', 'count']} pageSize={8} sortable />
        </SectionCard>
      </div>

      <SectionCard title="Numeric Statistics" copy="Mean, median, mode, spread, and quartiles for numeric features.">
        <DataTable rows={numericRows} pageSize={6} sortable />
      </SectionCard>

      <div className="eda-highlight-grid">
        <SectionCard title="Categorical Summary" copy="Top category distribution and mode values.">
          <DataTable rows={categoricalRows} pageSize={6} sortable />
        </SectionCard>

        <SectionCard title="Distribution Analysis" copy="Skewness and kurtosis flags for normality checks.">
          <DataTable rows={distributionRows} pageSize={6} sortable />
        </SectionCard>
      </div>

      <div className="eda-highlight-grid">
        <SectionCard title="Correlation & Multicollinearity" copy="High-correlation pairs are highlighted as potential multicollinearity risks.">
          <DataTable rows={summary?.correlation?.high_pairs || []} columns={['left', 'right', 'correlation']} pageSize={6} sortable />
        </SectionCard>

        <SectionCard title="Outlier Detection" copy="IQR and Z-score counts for each numeric feature.">
          <div className="eda-subtable-stack">
            <DataTable rows={summary?.outliers?.iqr || []} columns={['column', 'count', 'lower_bound', 'upper_bound']} pageSize={5} sortable />
            <DataTable rows={summary?.outliers?.zscore || []} columns={['column', 'count', 'threshold']} pageSize={5} sortable />
          </div>
        </SectionCard>
      </div>

      <div className="eda-highlight-grid">
        <SectionCard title="Aggregation & Grouping" copy="Backend-generated GroupBy preview for the default categorical and numeric columns.">
          <DataTable rows={grouping.groupby_preview || []} pageSize={6} sortable />
        </SectionCard>

        <SectionCard title="Pivot Table Preview" copy="Pivot-style cross-tab summary when multiple categorical columns are available.">
          <DataTable rows={grouping.pivot_preview || []} pageSize={6} sortable />
        </SectionCard>
      </div>

      <SectionCard title="Time-Series Preview" copy="Automatically enabled when the dataset contains a valid datetime column.">
        {timeSeries.detected ? (
          <DataTable rows={timeSeries.preview || []} pageSize={6} sortable />
        ) : (
          <div className="eda-empty-note">No datetime column was confidently detected in the current dataset.</div>
        )}
      </SectionCard>
    </div>
  )
}

function MultiColumnSelect({ value, onChange, options }) {
  return (
    <select
      multiple
      value={value}
      onChange={(event) => {
        const next = Array.from(event.target.selectedOptions).map((option) => option.value)
        onChange(next)
      }}
      className="eda-multiselect"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
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
  const numericOptions = (summary?.available_columns?.numeric || []).map((column) => ({ value: column, label: column }))
  const categoricalOptions = (summary?.available_columns?.categorical || []).map((column) => ({ value: column, label: column }))
  const datetimeOptions = (summary?.available_columns?.datetime || []).map((column) => ({ value: column, label: column }))
  const allOptions = (summary?.available_columns?.all || []).map((column) => ({ value: column, label: column }))

  return (
    <div className="eda-section-stack">
      <SectionCard
        title="Chart Builder"
        copy="Choose an analysis pattern, map its columns, and generate both an interactive Plotly chart and a static Matplotlib / Seaborn preview."
        actions={<button type="button" className="btn btn-primary" onClick={onGenerateChart} disabled={chartLoading}>{chartLoading ? 'Building...' : 'Generate Chart'}</button>}
      >
        <div className="eda-form-grid">
          <label className="eda-field">
            <span>Chart Type</span>
            <select value={chartConfig.chartType} onChange={(event) => setChartConfig((prev) => ({ ...prev, chartType: event.target.value }))}>
              {CHART_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.family} - {option.label}</option>
              ))}
            </select>
          </label>

          <label className="eda-field">
            <span>X Column</span>
            <select value={chartConfig.xColumn} onChange={(event) => setChartConfig((prev) => ({ ...prev, xColumn: event.target.value }))}>
              {[...numericOptions, ...categoricalOptions, ...datetimeOptions].map((option) => (
                <option key={`x-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="eda-field">
            <span>Y Column</span>
            <select value={chartConfig.yColumn} onChange={(event) => setChartConfig((prev) => ({ ...prev, yColumn: event.target.value }))}>
              {numericOptions.map((option) => (
                <option key={`y-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="eda-field">
            <span>Color / Group</span>
            <select value={chartConfig.colorColumn} onChange={(event) => setChartConfig((prev) => ({ ...prev, colorColumn: event.target.value }))}>
              <option value="">None</option>
              {allOptions.map((option) => (
                <option key={`color-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="eda-field">
            <span>3D / Pivot Value</span>
            <select value={chartConfig.zColumn} onChange={(event) => setChartConfig((prev) => ({ ...prev, zColumn: event.target.value }))}>
              <option value="">None</option>
              {numericOptions.map((option) => (
                <option key={`z-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="eda-field">
            <span>Aggregation</span>
            <select value={chartConfig.aggregation} onChange={(event) => setChartConfig((prev) => ({ ...prev, aggregation: event.target.value }))}>
              <option value="mean">Mean</option>
              <option value="median">Median</option>
              <option value="sum">Sum</option>
              <option value="count">Count</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
          </label>

          <label className="eda-field">
            <span>Bins</span>
            <input type="number" min="5" max="80" value={chartConfig.bins} onChange={(event) => setChartConfig((prev) => ({ ...prev, bins: Number(event.target.value) || 24 }))} />
          </label>

          <label className="eda-field">
            <span>Rolling Window</span>
            <input type="number" min="2" max="60" value={chartConfig.rollingWindow} onChange={(event) => setChartConfig((prev) => ({ ...prev, rollingWindow: Number(event.target.value) || 7 }))} />
          </label>
        </div>
      </SectionCard>

      {chartError && <div className="eda-inline-error">{chartError}</div>}

      <div className="eda-chart-grid">
        <SectionCard title="Interactive Plotly Chart" copy="Zoom, pan, hover, and inspect patterns interactively.">
          {chartResult?.figure ? <PlotFigure figure={chartResult.figure} themeMode={themeMode} style={{ minHeight: 460 }} /> : <div className="eda-empty-note">Generate a chart to see the interactive view.</div>}
          {chartResult?.note && <div className="eda-note">{chartResult.note}</div>}
        </SectionCard>

        <SectionCard title="Static Matplotlib / Seaborn View" copy="Useful for reports and quick reference snapshots.">
          {chartResult?.static_image ? (
            <img className="eda-static-image" src={chartResult.static_image} alt="Static chart preview" />
          ) : (
            <div className="eda-empty-note">A static preview will appear here for supported chart types.</div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

export function EdaCleaningSection({
  summary,
  missingForm,
  setMissingForm,
  outlierForm,
  setOutlierForm,
  replaceForm,
  setReplaceForm,
  dtypeForm,
  setDtypeForm,
  onApplyMissing,
  onApplyOutliers,
  onApplyReplace,
  onConvertType,
  onRemoveDuplicates,
  onTrimWhitespace,
  onResetDataset,
}) {
  const allOptions = buildScopedOptions(summary, 'all')
  const numericOptions = buildScopedOptions(summary, 'numeric')
  const categoricalOptions = buildScopedOptions(summary, 'categorical')

  return (
    <div className="eda-section-stack">
      <div className="eda-highlight-grid">
        <SectionCard title="Missing Values" copy="Fill missing values using mean, median, mode, constants, or remove incomplete rows.">
          <div className="eda-form-grid">
            <label className="eda-field">
              <span>Target</span>
              <select value={missingForm.scope} onChange={(event) => setMissingForm((prev) => ({ ...prev, scope: event.target.value }))}>
                {allOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Strategy</span>
              <select value={missingForm.strategy} onChange={(event) => setMissingForm((prev) => ({ ...prev, strategy: event.target.value }))}>
                <option value="mean">Fill with Mean</option>
                <option value="median">Fill with Median</option>
                <option value="mode">Fill with Mode</option>
                <option value="constant">Fill with Custom Value</option>
                <option value="drop">Drop Missing Rows</option>
              </select>
            </label>
            <label className="eda-field eda-field-span">
              <span>Custom Value</span>
              <input type="text" value={missingForm.fillValue} onChange={(event) => setMissingForm((prev) => ({ ...prev, fillValue: event.target.value }))} placeholder="Used when strategy is Custom Value" />
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onApplyMissing}>Apply Missing-Value Handling</button>
        </SectionCard>

        <SectionCard title="Outlier Handling" copy="Remove or cap outliers using IQR or Z-score methods.">
          <div className="eda-form-grid">
            <label className="eda-field">
              <span>Numeric Target</span>
              <select value={outlierForm.scope} onChange={(event) => setOutlierForm((prev) => ({ ...prev, scope: event.target.value }))}>
                {numericOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Method</span>
              <select value={outlierForm.method} onChange={(event) => setOutlierForm((prev) => ({ ...prev, method: event.target.value }))}>
                <option value="iqr">IQR</option>
                <option value="zscore">Z-Score</option>
              </select>
            </label>
            <label className="eda-field">
              <span>Action</span>
              <select value={outlierForm.mode} onChange={(event) => setOutlierForm((prev) => ({ ...prev, mode: event.target.value }))}>
                <option value="remove">Remove</option>
                <option value="cap">Cap</option>
              </select>
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onApplyOutliers}>Apply Outlier Rule</button>
        </SectionCard>
      </div>

      <div className="eda-highlight-grid">
        <SectionCard title="Find & Replace" copy="Replace exact matches or partial text within selected categorical columns.">
          <div className="eda-form-grid">
            <label className="eda-field">
              <span>Column Scope</span>
              <select value={replaceForm.scope} onChange={(event) => setReplaceForm((prev) => ({ ...prev, scope: event.target.value }))}>
                {categoricalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Match Mode</span>
              <select value={replaceForm.matchMode} onChange={(event) => setReplaceForm((prev) => ({ ...prev, matchMode: event.target.value }))}>
                <option value="contains">Contains</option>
                <option value="exact">Exact Match</option>
              </select>
            </label>
            <label className="eda-field">
              <span>Find</span>
              <input type="text" value={replaceForm.findValue} onChange={(event) => setReplaceForm((prev) => ({ ...prev, findValue: event.target.value }))} />
            </label>
            <label className="eda-field">
              <span>Replace With</span>
              <input type="text" value={replaceForm.replaceValue} onChange={(event) => setReplaceForm((prev) => ({ ...prev, replaceValue: event.target.value }))} />
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onApplyReplace}>Run Find & Replace</button>
        </SectionCard>

        <SectionCard title="Fix Data Types" copy="Convert columns to numeric, datetime, category, text, or boolean types.">
          <div className="eda-form-grid">
            <label className="eda-field">
              <span>Column</span>
              <select value={dtypeForm.column} onChange={(event) => setDtypeForm((prev) => ({ ...prev, column: event.target.value }))}>
                {(summary?.available_columns?.all || []).map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Target Type</span>
              <select value={dtypeForm.targetType} onChange={(event) => setDtypeForm((prev) => ({ ...prev, targetType: event.target.value }))}>
                <option value="float">Float</option>
                <option value="integer">Integer</option>
                <option value="datetime">Datetime</option>
                <option value="category">Category</option>
                <option value="string">String</option>
                <option value="boolean">Boolean</option>
              </select>
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onConvertType}>Convert Data Type</button>
        </SectionCard>
      </div>

      <SectionCard title="Quick Cleaning Actions" copy="Run the most common cleaning operations in one click.">
        <div className="eda-quick-actions">
          <button type="button" className="eda-quick-btn" onClick={onRemoveDuplicates}>Remove Duplicates</button>
          <button type="button" className="eda-quick-btn" onClick={onTrimWhitespace}>Trim Whitespace</button>
          <button type="button" className="eda-quick-btn" onClick={onResetDataset}>Reset to Original Upload</button>
        </div>
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
  const numericColumnOptions = (summary?.available_columns?.numeric || []).map((column) => ({ value: column, label: column }))
  const datetimeColumnOptions = (summary?.available_columns?.datetime || []).map((column) => ({ value: column, label: column }))
  const categoricalOptions = buildScopedOptions(summary, 'categorical')
  const numericOptions = buildScopedOptions(summary, 'numeric')

  return (
    <div className="eda-section-stack">
      <div className="eda-highlight-grid">
        <SectionCard title="Encoding" copy="Use label encoding or one-hot encoding for selected categorical features.">
          <div className="eda-form-grid">
            <label className="eda-field">
              <span>Target</span>
              <select value={encodeForm.scope} onChange={(event) => setEncodeForm((prev) => ({ ...prev, scope: event.target.value }))}>
                {categoricalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Method</span>
              <select value={encodeForm.method} onChange={(event) => setEncodeForm((prev) => ({ ...prev, method: event.target.value }))}>
                <option value="label_encode">Label Encoding</option>
                <option value="one_hot_encode">One-Hot Encoding</option>
              </select>
            </label>
            <label className="eda-field">
              <span>Output Mode</span>
              <select value={encodeForm.outputMode} onChange={(event) => setEncodeForm((prev) => ({ ...prev, outputMode: event.target.value }))}>
                <option value="append">Append New Feature</option>
                <option value="replace">Replace Existing Column</option>
              </select>
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onApplyEncoding}>Apply Encoding</button>
        </SectionCard>

        <SectionCard title="Create New Features" copy="Create arithmetic features or extract year, month, and other datetime parts.">
          <div className="eda-form-grid">
            <label className="eda-field">
              <span>Mode</span>
              <select value={featureForm.mode} onChange={(event) => setFeatureForm((prev) => ({ ...prev, mode: event.target.value }))}>
                <option value="arithmetic">Arithmetic Feature</option>
                <option value="datetime_part">Datetime Part</option>
              </select>
            </label>
            <label className="eda-field">
              <span>Left Column</span>
              <select value={featureForm.leftColumn} onChange={(event) => setFeatureForm((prev) => ({ ...prev, leftColumn: event.target.value }))}>
                {numericColumnOptions.map((option) => <option key={`left-${option.value}`} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Right Column</span>
              <select value={featureForm.rightColumn} onChange={(event) => setFeatureForm((prev) => ({ ...prev, rightColumn: event.target.value }))}>
                {numericColumnOptions.map((option) => <option key={`right-${option.value}`} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Operation</span>
              <select value={featureForm.operation} onChange={(event) => setFeatureForm((prev) => ({ ...prev, operation: event.target.value }))}>
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
                <option value="multiply">Multiply</option>
                <option value="divide">Divide</option>
              </select>
            </label>
            <label className="eda-field">
              <span>Datetime Column</span>
              <select value={featureForm.datetimeColumn} onChange={(event) => setFeatureForm((prev) => ({ ...prev, datetimeColumn: event.target.value }))}>
                {datetimeColumnOptions.map((option) => <option key={`dt-${option.value}`} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Datetime Part</span>
              <select value={featureForm.component} onChange={(event) => setFeatureForm((prev) => ({ ...prev, component: event.target.value }))}>
                <option value="year">Year</option>
                <option value="month">Month</option>
                <option value="day">Day</option>
                <option value="dayofweek">Day Of Week</option>
                <option value="quarter">Quarter</option>
              </select>
            </label>
            <label className="eda-field eda-field-span">
              <span>New Feature Name</span>
              <input type="text" value={featureForm.newColumn} onChange={(event) => setFeatureForm((prev) => ({ ...prev, newColumn: event.target.value }))} placeholder="Optional custom name" />
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onCreateFeature}>Create Feature</button>
        </SectionCard>
      </div>

      <div className="eda-highlight-grid">
        <SectionCard title="Feature Transformation" copy="Apply log, sqrt, square, absolute, or reciprocal transforms.">
          <div className="eda-form-grid">
            <label className="eda-field">
              <span>Target</span>
              <select value={transformForm.scope} onChange={(event) => setTransformForm((prev) => ({ ...prev, scope: event.target.value }))}>
                {numericOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Transformation</span>
              <select value={transformForm.transformation} onChange={(event) => setTransformForm((prev) => ({ ...prev, transformation: event.target.value }))}>
                <option value="log1p">Log1p</option>
                <option value="sqrt">Square Root</option>
                <option value="square">Square</option>
                <option value="abs">Absolute</option>
                <option value="reciprocal">Reciprocal</option>
              </select>
            </label>
            <label className="eda-field">
              <span>Output Mode</span>
              <select value={transformForm.outputMode} onChange={(event) => setTransformForm((prev) => ({ ...prev, outputMode: event.target.value }))}>
                <option value="append">Append New Feature</option>
                <option value="replace">Replace Existing Column</option>
              </select>
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onApplyTransformation}>Apply Transformation</button>
        </SectionCard>

        <SectionCard title="Scaling" copy="Normalize or standardize numeric columns before modeling.">
          <div className="eda-form-grid">
            <label className="eda-field">
              <span>Target</span>
              <select value={scaleForm.scope} onChange={(event) => setScaleForm((prev) => ({ ...prev, scope: event.target.value }))}>
                {numericOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="eda-field">
              <span>Scaler</span>
              <select value={scaleForm.scaler} onChange={(event) => setScaleForm((prev) => ({ ...prev, scaler: event.target.value }))}>
                <option value="minmax">MinMaxScaler</option>
                <option value="standard">StandardScaler</option>
              </select>
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={onApplyScaling}>Apply Scaling</button>
        </SectionCard>
      </div>

      <SectionCard title="Feature Selection" copy="Keep or drop selected columns from the working dataset. Hold Ctrl to select multiple features.">
        <div className="eda-form-grid">
          <label className="eda-field">
            <span>Selection Mode</span>
            <select value={selectionForm.mode} onChange={(event) => setSelectionForm((prev) => ({ ...prev, mode: event.target.value }))}>
              <option value="keep">Keep Selected Columns</option>
              <option value="drop">Drop Selected Columns</option>
            </select>
          </label>
          <label className="eda-field eda-field-span">
            <span>Columns</span>
            <MultiColumnSelect
              value={selectionForm.columns}
              onChange={(next) => setSelectionForm((prev) => ({ ...prev, columns: next }))}
              options={(summary?.available_columns?.all || []).map((column) => ({ value: column, label: column }))}
            />
          </label>
        </div>
        <button type="button" className="btn btn-primary" onClick={onApplySelection}>Apply Feature Selection</button>
      </SectionCard>
    </div>
  )
}
