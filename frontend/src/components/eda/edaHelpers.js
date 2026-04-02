export const SCOPE_ALL = '__all__'
export const SCOPE_NUMERIC = '__numeric__'
export const SCOPE_CATEGORICAL = '__categorical__'
export const SCOPE_DATETIME = '__datetime__'

export const SECTION_ITEMS = [
  { key: 'overview', label: 'Overview', description: 'Shape, schema, and preview' },
  { key: 'quality', label: 'Data Quality', description: 'Missing, stats, outliers' },
  { key: 'visualization', label: 'Visualization', description: 'Interactive and static charts' },
  { key: 'cleaning', label: 'Cleaning', description: 'Missing values and fixes' },
  { key: 'features', label: 'Feature Engineering', description: 'Encoding, transforms, scaling' },
]

export const CHART_OPTIONS = [
  { value: 'histogram', label: 'Histogram', family: 'Univariate' },
  { value: 'boxplot', label: 'Boxplot', family: 'Univariate' },
  { value: 'countplot', label: 'Countplot', family: 'Univariate' },
  { value: 'bar', label: 'Bar Comparison', family: 'Univariate' },
  { value: 'scatter', label: 'Scatter Plot', family: 'Bivariate' },
  { value: 'line', label: 'Line Plot', family: 'Bivariate' },
  { value: 'grouped_box', label: 'Grouped Boxplot', family: 'Bivariate' },
  { value: 'pairplot', label: 'Pairplot', family: 'Multivariate' },
  { value: 'heatmap', label: 'Correlation Heatmap', family: 'Multivariate' },
  { value: 'scatter3d', label: '3D Scatter', family: 'Multivariate' },
  { value: 'normal_curve', label: 'Normal Distribution', family: 'Distribution' },
  { value: 'rolling_mean', label: 'Rolling Mean', family: 'Time Series' },
  { value: 'groupby_bar', label: 'GroupBy Bar', family: 'Aggregation' },
  { value: 'pivot_heatmap', label: 'Pivot Heatmap', family: 'Aggregation' },
]

export function resolveScopedColumns(scope, summary, fallbackKind = 'all') {
  const columns = summary?.available_columns || {}
  if (scope === SCOPE_ALL) return columns.all || []
  if (scope === SCOPE_NUMERIC) return columns.numeric || []
  if (scope === SCOPE_CATEGORICAL) return columns.categorical || []
  if (scope === SCOPE_DATETIME) return columns.datetime || []
  if (scope) return [scope]
  return columns[fallbackKind] || columns.all || []
}

export function buildScopedOptions(summary, kind = 'all') {
  const columns = summary?.available_columns || {}
  const options = []

  if (kind === 'all') {
    options.push({ value: SCOPE_ALL, label: 'All Columns' })
    if (columns.numeric?.length) options.push({ value: SCOPE_NUMERIC, label: 'All Numeric Columns' })
    if (columns.categorical?.length) options.push({ value: SCOPE_CATEGORICAL, label: 'All Text / Categorical Columns' })
    if (columns.datetime?.length) options.push({ value: SCOPE_DATETIME, label: 'All Datetime Columns' })
    ;(columns.all || []).forEach((column) => options.push({ value: column, label: column }))
    return options
  }

  const selected = columns[kind] || []
  const scopedValue =
    kind === 'numeric' ? SCOPE_NUMERIC :
      kind === 'categorical' ? SCOPE_CATEGORICAL :
        kind === 'datetime' ? SCOPE_DATETIME : SCOPE_ALL

  if (selected.length > 1) {
    const label =
      kind === 'numeric' ? 'All Numeric Columns' :
        kind === 'categorical' ? 'All Text / Categorical Columns' :
          kind === 'datetime' ? 'All Datetime Columns' : 'All Columns'
    options.push({ value: scopedValue, label })
  }

  selected.forEach((column) => options.push({ value: column, label: column }))
  return options
}

export function formatMetric(value) {
  if (value == null || Number.isNaN(value)) return '0'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  if (Math.abs(numeric) >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`
  if (Math.abs(numeric) >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`
  if (Number.isInteger(numeric)) return numeric.toLocaleString()
  return numeric.toFixed(3)
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function summariseTopValues(values = []) {
  if (!values.length) return 'No top values'
  return values.map((item) => `${item.value} (${item.count})`).join(', ')
}
