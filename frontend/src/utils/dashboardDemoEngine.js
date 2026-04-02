import { POWER_BI_CHARTS, chartDefinition } from './dashboardBuilder.js'

const LOCAL_DASHBOARD_KEY = 'datalytics_local_dashboard_definition'
const COLORWAY = ['#38bdf8', '#34d399', '#f97316', '#facc15', '#a855f7', '#fb7185', '#60a5fa', '#a3e635']
const COLORWAY_THEMES = {
  executive: ['#38bdf8', '#34d399', '#f97316', '#facc15', '#a855f7', '#fb7185', '#60a5fa', '#a3e635'],
  sunrise: ['#f97316', '#fb7185', '#facc15', '#38bdf8', '#22c55e', '#8b5cf6', '#f59e0b', '#0ea5e9'],
  oceanic: ['#0ea5e9', '#14b8a6', '#22c55e', '#60a5fa', '#06b6d4', '#2dd4bf', '#a3e635', '#38bdf8'],
  slate: ['#475569', '#64748b', '#94a3b8', '#cbd5e1', '#38bdf8', '#f97316', '#22c55e', '#a855f7'],
}
const GEO_ROLE_HINTS = {
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon'],
  country: ['country', 'nation'],
  state: ['state', 'province', 'region'],
  city: ['city', 'town'],
}

let activeDataset = null
let activeProfile = null
let localDashboardDefinition = null

function wait(ms = 80) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeToken(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value))
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isIdLike(column) {
  const token = normalizeToken(column)
  return ['id', 'code', 'serial', 'index', 'employeeid', 'userid'].some((hint) => token.includes(hint))
}

function parseDateValue(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function inferGeoRole(column) {
  const token = normalizeToken(column)
  return Object.entries(GEO_ROLE_HINTS).find(([, hints]) => hints.some((hint) => token.includes(hint)))?.[0] || null
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && value !== '')))
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function groupRowsBy(rows, getter) {
  const groups = new Map()
  rows.forEach((row) => {
    const key = getter(row)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  })
  return groups
}

function aggregateRows(rows, valueColumn, aggregation) {
  if (!rows.length) return 0
  if (aggregation === 'count' || !valueColumn) return rows.length
  const values = rows.map((row) => Number(row?.[valueColumn])).filter((value) => Number.isFinite(value))
  if (!values.length) return aggregation === 'count' ? rows.length : 0
  if (aggregation === 'avg') return values.reduce((sum, value) => sum + value, 0) / values.length
  if (aggregation === 'min') return Math.min(...values)
  if (aggregation === 'max') return Math.max(...values)
  return values.reduce((sum, value) => sum + value, 0)
}

function formatLabel(value, kind) {
  if (kind === 'datetime') {
    const date = parseDateValue(value)
    if (!date) return String(value ?? '')
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  return String(value ?? 'Unknown')
}

function themeLayout(theme, extra = {}) {
  const dark = theme !== 'light'
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: dark ? '#edf3ff' : '#0f172a', family: 'Inter, system-ui, sans-serif', size: 12 },
    margin: { l: 44, r: 24, t: 22, b: 42 },
    legend: {
      orientation: 'h',
      x: 0,
      y: 1.12,
      bgcolor: 'rgba(0,0,0,0)',
      font: { size: 11, color: dark ? '#d8e4ff' : '#334155' },
    },
    xaxis: {
      automargin: true,
      gridcolor: dark ? 'rgba(159,176,203,0.12)' : 'rgba(148,163,184,0.16)',
      zerolinecolor: dark ? 'rgba(159,176,203,0.18)' : 'rgba(148,163,184,0.2)',
    },
    yaxis: {
      automargin: true,
      gridcolor: dark ? 'rgba(159,176,203,0.12)' : 'rgba(148,163,184,0.16)',
      zerolinecolor: dark ? 'rgba(159,176,203,0.18)' : 'rgba(148,163,184,0.2)',
    },
    ...extra,
  }
}

function resolveWidgetSettings(settings = {}) {
  return {
    palette: settings.palette || 'executive',
    orientation: settings.orientation || 'vertical',
    showLegend: settings.showLegend !== false,
    showGrid: settings.showGrid !== false,
    sortOrder: settings.sortOrder || 'auto',
    xLabel: settings.xLabel || '',
    yLabel: settings.yLabel || '',
  }
}

function paletteColors(settings = {}) {
  const resolved = resolveWidgetSettings(settings)
  return COLORWAY_THEMES[resolved.palette] || COLORWAY
}

function applyFigureSettings(chartType, response, theme, settings = {}) {
  if (!response?.figure) return response

  const resolved = resolveWidgetSettings(settings)
  const colors = paletteColors(resolved)
  const hasCartesianAxes = !['pie_chart', 'donut_chart', 'kpi_card', 'gauge_chart', 'geo_chart', 'treemap', 'decomposition_tree', 'table'].includes(chartType)
  const figure = {
    ...response.figure,
    layout: {
      ...(response.figure.layout || {}),
      colorway: colors,
      showlegend: resolved.showLegend,
      legend: {
        ...(response.figure.layout?.legend || {}),
        orientation: 'h',
      },
      ...(hasCartesianAxes ? {
        xaxis: {
          ...(response.figure.layout?.xaxis || {}),
          title: resolved.xLabel || response.figure.layout?.xaxis?.title,
          showgrid: resolved.showGrid,
        },
        yaxis: {
          ...(response.figure.layout?.yaxis || {}),
          title: resolved.yLabel || response.figure.layout?.yaxis?.title,
          showgrid: resolved.showGrid,
        },
      } : {}),
    },
  }

  figure.data = (response.figure.data || []).map((trace, index) => {
    const nextTrace = { ...trace }
    const fallbackColor = colors[index % colors.length]

    if (
      isPlainObject(trace.marker)
      && !Array.isArray(trace.marker.color)
      && trace.marker.colors === undefined
      && trace.marker.colorscale === undefined
    ) {
      nextTrace.marker = {
        ...trace.marker,
        ...(trace.marker.color === undefined ? { color: fallbackColor } : {}),
      }

      if (isPlainObject(trace.marker.line)) {
        nextTrace.marker.line = { ...trace.marker.line }
      } else if ('line' in nextTrace.marker) {
        delete nextTrace.marker.line
      }
    }

    if (isPlainObject(trace.line)) {
      nextTrace.line = {
        ...trace.line,
        ...(trace.line.color === undefined ? { color: fallbackColor } : {}),
      }
    } else if ('line' in nextTrace) {
      delete nextTrace.line
    }

    return nextTrace
  })

  if (
    ['bar_chart', 'stacked_bar_chart'].includes(chartType)
    && resolved.sortOrder !== 'auto'
    && figure.data.every((trace) => trace.type === 'bar' && Array.isArray(trace.x) && Array.isArray(trace.y))
  ) {
    const labels = figure.data[0]?.x || []
    const totals = labels.map((label, index) => ({
      label,
      index,
      value: figure.data.reduce((sum, trace) => sum + Number(trace.y?.[index] || 0), 0),
    }))

    totals.sort((left, right) => {
      if (resolved.sortOrder === 'value-desc') return right.value - left.value
      if (resolved.sortOrder === 'value-asc') return left.value - right.value
      if (resolved.sortOrder === 'label-desc') return String(right.label).localeCompare(String(left.label))
      return String(left.label).localeCompare(String(right.label))
    })

    figure.data = figure.data.map((trace) => ({
      ...trace,
      x: totals.map((item) => trace.x[item.index]),
      y: totals.map((item) => trace.y[item.index]),
    }))
  }

  if (
    resolved.orientation === 'horizontal'
    && ['bar_chart', 'stacked_bar_chart'].includes(chartType)
  ) {
    figure.data = figure.data.map((trace) => (
      trace.type === 'bar'
        ? {
            ...trace,
            orientation: 'h',
            x: trace.y,
            y: trace.x,
          }
        : trace
    ))
    figure.layout = {
      ...figure.layout,
      xaxis: {
        ...(figure.layout.xaxis || {}),
        title: resolved.yLabel || response.figure.layout?.yaxis?.title,
      },
      yaxis: {
        ...(figure.layout.yaxis || {}),
        title: resolved.xLabel || response.figure.layout?.xaxis?.title,
      },
    }
  }

  return {
    ...response,
    figure,
  }
}

function summarizeNumeric(values) {
  const numbers = values.map((value) => Number(value)).filter((value) => Number.isFinite(value))
  if (!numbers.length) return { min: 0, max: 0, mean: 0 }
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    mean: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
  }
}

function inferColumnKind(column, values) {
  const nonEmpty = values.filter((value) => value !== null && value !== undefined && value !== '')
  if (!nonEmpty.length) return 'categorical'
  const numericRatio = nonEmpty.filter((value) => isFiniteNumber(value)).length / nonEmpty.length
  const dateRatio = nonEmpty.filter((value) => parseDateValue(value)).length / nonEmpty.length
  const geoRole = inferGeoRole(column)
  if (geoRole === 'latitude' || geoRole === 'longitude') return 'numeric'
  if (numericRatio >= 0.82) return 'numeric'
  if (dateRatio >= 0.8) return 'datetime'
  return 'categorical'
}

function profileFromDataset(dataset) {
  const rows = dataset?.rows || []
  const columns = dataset?.columns?.length ? dataset.columns : Object.keys(rows[0] || {})
  const column_meta = columns.map((column) => {
    const values = rows.map((row) => row?.[column])
    const kind = inferColumnKind(column, values)
    return {
      column,
      kind,
      unique_count: uniqueValues(values).length,
      sample: uniqueValues(values).slice(0, 6),
      geo_role: inferGeoRole(column),
      stats: kind === 'numeric' ? summarizeNumeric(values) : null,
    }
  })

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: {
      all: columns,
      numeric: column_meta.filter((column) => column.kind === 'numeric').map((column) => column.column),
      categorical: column_meta.filter((column) => column.kind === 'categorical').map((column) => column.column),
      datetime: column_meta.filter((column) => column.kind === 'datetime').map((column) => column.column),
    },
    aggregations: ['sum', 'avg', 'count', 'min', 'max'],
    column_meta,
  }
}

function preferredNumeric(profile, includeIds = false) {
  const numericMeta = (profile?.column_meta || []).filter((column) => column.kind === 'numeric')
  const filtered = includeIds ? numericMeta : numericMeta.filter((column) => !isIdLike(column.column))
  return (filtered[0] || numericMeta[0])?.column || ''
}

function preferredCategorical(profile, secondary = false) {
  const categoricalMeta = (profile?.column_meta || [])
    .filter((column) => column.kind === 'categorical')
    .sort((left, right) => {
      const leftScore = left.unique_count > 1 && left.unique_count <= 12 ? 0 : 1
      const rightScore = right.unique_count > 1 && right.unique_count <= 12 ? 0 : 1
      return leftScore - rightScore
    })
  return secondary ? (categoricalMeta[1]?.column || categoricalMeta[0]?.column || '') : (categoricalMeta[0]?.column || '')
}

function preferredDatetime(profile) {
  return (profile?.column_meta || []).find((column) => column.kind === 'datetime')?.column || ''
}

function preferredNumericPair(profile) {
  const numericMeta = (profile?.column_meta || []).filter((column) => column.kind === 'numeric')
  const filtered = numericMeta.filter((column) => !isIdLike(column.column))
  const pool = filtered.length >= 2 ? filtered : numericMeta
  return [pool[0]?.column || '', pool[1]?.column || pool[0]?.column || '']
}

function preferredGeoColumns(profile) {
  const meta = profile?.column_meta || []
  return {
    location: meta.find((column) => ['country', 'state', 'city'].includes(column.geo_role))?.column || '',
    latitude: meta.find((column) => column.geo_role === 'latitude')?.column || '',
    longitude: meta.find((column) => column.geo_role === 'longitude')?.column || '',
  }
}

function buildDemoRows() {
  const regions = ['North', 'South', 'East', 'West']
  const categories = ['Electronics', 'Retail', 'Logistics']
  const segments = ['Enterprise', 'SMB', 'Consumer']
  const cities = [
    { city: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
    { city: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777 },
    { city: 'Bengaluru', country: 'India', lat: 12.9716, lon: 77.5946 },
    { city: 'Pune', country: 'India', lat: 18.5204, lon: 73.8567 },
  ]
  const rows = []

  for (let month = 0; month < 18; month += 1) {
    regions.forEach((region, regionIndex) => {
      categories.forEach((category, categoryIndex) => {
        const place = cities[(month + regionIndex + categoryIndex) % cities.length]
        const segment = segments[(month + categoryIndex) % segments.length]
        const joinDate = new Date(2024, month, 1)
        const base = 82000 + month * 6200 + regionIndex * 7000 + categoryIndex * 4200
        const revenue = Math.round(base * (month >= 9 ? 1.16 : 1))
        const customers = 320 + month * 14 + regionIndex * 18 + categoryIndex * 8
        rows.push({
          EmployeeID: 1000 + month * 10 + regionIndex * 3 + categoryIndex,
          JoinDate: joinDate.toISOString().slice(0, 10),
          Region: region,
          Category: category,
          Segment: segment,
          City: place.city,
          Country: place.country,
          Latitude: place.lat,
          Longitude: place.lon,
          Revenue: revenue,
          Profit: Math.round(revenue * (0.14 + categoryIndex * 0.03)),
          Customers: customers,
          Pipeline: Math.round(revenue * 1.22),
          Satisfaction: Number((4 + ((month + categoryIndex) % 8) * 0.08).toFixed(2)),
          AvgSpend: Math.round(revenue / Math.max(customers, 1)),
          Stage: ['Lead', 'Qualified', 'Proposal', 'Won'][(month + regionIndex + categoryIndex) % 4],
        })
      })
    })
  }

  return rows
}

export function createDemoDashboardDataset() {
  const rows = buildDemoRows()
  return {
    name: 'AI Demo Dashboard Dataset',
    columns: Object.keys(rows[0] || {}),
    rows,
  }
}

export function profileDashboardDataset(dataset) {
  return profileFromDataset(dataset)
}

function isDashboardProfile(profile) {
  return Boolean(
    profile
    && Array.isArray(profile.column_meta)
    && Array.isArray(profile?.columns?.all)
  )
}

export function setDashboardSessionDataset(dataset, profile) {
  const safeDataset = dataset?.rows?.length ? dataset : createDemoDashboardDataset()
  activeDataset = safeDataset
  activeProfile = isDashboardProfile(profile) ? profile : profileFromDataset(safeDataset)
  return { dataset: activeDataset, profile: activeProfile }
}

function ensureSession() {
  if (!activeDataset) {
    setDashboardSessionDataset(createDemoDashboardDataset())
  }
  return { dataset: activeDataset, profile: activeProfile }
}

function getColumnKind(profile, column) {
  return profile?.column_meta?.find((item) => item.column === column)?.kind || 'categorical'
}

function buildAutoMapping(chartType, profile, selectedColumns = []) {
  const selected = Array.isArray(selectedColumns) ? selectedColumns : []
  const selectedNumeric = selected.find((column) => getColumnKind(profile, column) === 'numeric')
  const selectedCategory = selected.find((column) => getColumnKind(profile, column) === 'categorical')
  const selectedDate = selected.find((column) => getColumnKind(profile, column) === 'datetime')
  const primaryNumeric = firstDefined(selectedNumeric, preferredNumeric(profile))
  const [scatterX, scatterY] = preferredNumericPair(profile)
  const primaryCategory = firstDefined(selectedCategory, preferredCategorical(profile), preferredDatetime(profile))
  const secondaryCategory = preferredCategorical(profile, true)
  const dateColumn = firstDefined(selectedDate, preferredDatetime(profile), primaryCategory)
  const geo = preferredGeoColumns(profile)

  const base = {
    values: primaryNumeric ? [primaryNumeric] : [],
    secondary_values: [],
    legend: '',
    tooltip: uniqueValues(selected).slice(0, 4),
    x_axis: primaryCategory || '',
    y_axis: primaryNumeric || '',
    size: '',
    color: '',
    details: firstDefined(selected.find((column) => isIdLike(column)), secondaryCategory, primaryCategory) || '',
    rows: [],
    columns: [],
    location: geo.location || '',
    latitude: geo.latitude || '',
    longitude: geo.longitude || '',
    target: '',
    aggregation: 'sum',
    title: '',
  }

  if (chartType === 'stacked_bar_chart') return { ...base, legend: secondaryCategory || primaryCategory }
  if (chartType === 'line_chart' || chartType === 'area_chart') return { ...base, x_axis: dateColumn || primaryCategory, legend: secondaryCategory || '' }
  if (chartType === 'combo_chart') return {
    ...base,
    x_axis: dateColumn || primaryCategory,
    legend: secondaryCategory || '',
    secondary_values: [firstDefined(selected[1], preferredNumeric(profile, true), primaryNumeric)].filter(Boolean),
  }
  if (chartType === 'pie_chart' || chartType === 'donut_chart') return { ...base, legend: primaryCategory || secondaryCategory }
  if (chartType === 'scatter_plot') return { ...base, x_axis: firstDefined(selected[0], scatterX), y_axis: firstDefined(selected[1], scatterY, scatterX), values: [firstDefined(selected[1], scatterY, scatterX)].filter(Boolean), color: primaryCategory || '', details: firstDefined(selectedCategory, secondaryCategory, primaryCategory) || '' }
  if (chartType === 'bubble_chart') return { ...base, x_axis: firstDefined(selected[0], scatterX), y_axis: firstDefined(selected[1], scatterY, scatterX), values: [firstDefined(selected[1], scatterY, scatterX)].filter(Boolean), size: firstDefined(selected[2], primaryNumeric, scatterY) || '', color: primaryCategory || '', details: firstDefined(selectedCategory, secondaryCategory, primaryCategory) || '' }
  if (chartType === 'histogram') return { ...base, x_axis: '', y_axis: primaryNumeric || '', values: [primaryNumeric].filter(Boolean), tooltip: uniqueValues([primaryCategory, secondaryCategory, dateColumn].filter(Boolean)).slice(0, 3) }
  if (chartType === 'box_plot') return { ...base, x_axis: primaryCategory || '', y_axis: primaryNumeric || '', values: [primaryNumeric].filter(Boolean) }
  if (chartType === 'kpi_card') return { ...base, values: [primaryNumeric].filter(Boolean), tooltip: uniqueValues([dateColumn, primaryCategory, secondaryCategory].filter(Boolean)).slice(0, 3) }
  if (chartType === 'table') return { ...base, values: uniqueValues(selected.length ? selected : [primaryCategory, dateColumn, primaryNumeric, secondaryCategory].filter(Boolean)).slice(0, 6) }
  if (chartType === 'matrix') return { ...base, rows: [primaryCategory].filter(Boolean), columns: [secondaryCategory || dateColumn || primaryCategory].filter(Boolean), values: [primaryNumeric].filter(Boolean) }
  if (chartType === 'funnel_chart') return { ...base, x_axis: firstDefined(primaryCategory, secondaryCategory), values: [primaryNumeric].filter(Boolean) }
  if (chartType === 'waterfall_chart') return { ...base, x_axis: dateColumn || primaryCategory }
  if (chartType === 'gauge_chart') return { ...base, values: [primaryNumeric].filter(Boolean), target: firstDefined(selectedNumeric !== primaryNumeric ? selectedNumeric : '', preferredNumeric(profile, true)) || '' }
  if (chartType === 'geo_chart') return { ...base, location: geo.location || primaryCategory || '', latitude: geo.latitude || '', longitude: geo.longitude || '', values: [primaryNumeric].filter(Boolean), tooltip: uniqueValues([primaryCategory, secondaryCategory, dateColumn].filter(Boolean)).slice(0, 4) }
  if (chartType === 'heatmap') return { ...base, x_axis: dateColumn || primaryCategory, y_axis: secondaryCategory || primaryCategory, values: [primaryNumeric].filter(Boolean), color: primaryNumeric || '' }
  if (chartType === 'ribbon_chart') return { ...base, x_axis: dateColumn || primaryCategory, legend: primaryCategory || secondaryCategory, details: secondaryCategory || primaryCategory }
  if (chartType === 'treemap') return { ...base, legend: primaryCategory || '', details: secondaryCategory || '', values: [primaryNumeric].filter(Boolean), color: primaryNumeric || '' }
  if (chartType === 'decomposition_tree') return { ...base, rows: [primaryCategory, secondaryCategory || dateColumn].filter(Boolean), legend: primaryCategory || '', details: secondaryCategory || dateColumn || '' }
  return base
}

function buildWidgetTitle(definition, mapping) {
  const metric = firstDefined(mapping?.y_axis, mapping?.values?.[0], definition.label)
  const dimension = firstDefined(mapping?.x_axis, mapping?.legend, mapping?.location, mapping?.rows?.[0], mapping?.columns?.[0])
  return !dimension || dimension === metric ? `${definition.label}: ${metric}` : `${definition.label}: ${metric} by ${dimension}`
}

export function buildAutomaticStarterWidgets(profile = ensureSession().profile) {
  const primaryNumeric = preferredNumeric(profile)
  const secondaryNumeric = preferredNumeric(profile, true)
  const primaryCategory = preferredCategorical(profile)
  const secondaryCategory = preferredCategorical(profile, true)
  const dateColumn = preferredDatetime(profile)
  const geo = preferredGeoColumns(profile)

  const candidates = [
    { chartType: 'kpi_card', enabled: Boolean(primaryNumeric) },
    { chartType: 'gauge_chart', enabled: Boolean(primaryNumeric) },
    { chartType: 'bar_chart', enabled: Boolean(primaryNumeric && (primaryCategory || dateColumn)) },
    { chartType: 'stacked_bar_chart', enabled: Boolean(primaryNumeric && primaryCategory && secondaryCategory) },
    { chartType: 'line_chart', enabled: Boolean(primaryNumeric && dateColumn) },
    { chartType: 'area_chart', enabled: Boolean(primaryNumeric && dateColumn) },
    { chartType: 'combo_chart', enabled: Boolean(primaryNumeric && secondaryNumeric && (dateColumn || primaryCategory)) },
    { chartType: 'donut_chart', enabled: Boolean(primaryNumeric && primaryCategory) },
    { chartType: 'pie_chart', enabled: Boolean(primaryNumeric && primaryCategory) },
    { chartType: 'scatter_plot', enabled: Boolean(primaryNumeric && secondaryNumeric && primaryNumeric !== secondaryNumeric) },
    { chartType: 'bubble_chart', enabled: Boolean(primaryNumeric && secondaryNumeric && primaryNumeric !== secondaryNumeric) },
    { chartType: 'histogram', enabled: Boolean(primaryNumeric) },
    { chartType: 'box_plot', enabled: Boolean(primaryNumeric) },
    { chartType: 'heatmap', enabled: Boolean(primaryNumeric && (secondaryCategory || primaryCategory) && (dateColumn || primaryCategory)) },
    { chartType: 'treemap', enabled: Boolean(primaryNumeric && primaryCategory) },
    { chartType: 'matrix', enabled: Boolean(primaryNumeric && primaryCategory && (secondaryCategory || dateColumn)) },
    { chartType: 'funnel_chart', enabled: Boolean(primaryNumeric && primaryCategory) },
    { chartType: 'waterfall_chart', enabled: Boolean(primaryNumeric && (dateColumn || primaryCategory)) },
    { chartType: 'geo_chart', enabled: Boolean(primaryNumeric && (geo.location || (geo.latitude && geo.longitude))) },
    { chartType: 'table', enabled: true },
  ]

  return candidates
    .filter((candidate) => candidate.enabled)
    .slice(0, 8)
    .map(({ chartType }) => {
      const mapping = buildAutoMapping(chartType, profile)
      return {
        chart_type: chartType,
        title: buildWidgetTitle(chartDefinition(chartType), mapping),
        mapping,
      }
    })
}

function buildDashboardMetadata(dataset = ensureSession().dataset, profile = ensureSession().profile) {
  return {
    dataset_name: dataset?.name || 'Dataset',
    chart_catalog: POWER_BI_CHARTS.map((chart) => ({ id: chart.id, label: chart.label, enabled: true, reason: '' })),
    starter_widgets: buildAutomaticStarterWidgets(profile),
    aggregations: profile.aggregations,
    columns: profile.columns,
    column_meta: profile.column_meta,
  }
}

function applyFilters(rows, filters = [], drillColumn, drillValue) {
  return rows.filter((row) => {
    const passesFilters = filters.every((filter) => String(row?.[filter.column] ?? '') === String(filter.value ?? ''))
    if (!passesFilters) return false
    if (!drillColumn) return true
    return String(row?.[drillColumn] ?? '') === String(drillValue ?? '')
  })
}

function buildInsightText(chartType, rows, mapping, aggregation) {
  const metricLabel = firstDefined(mapping?.y_axis, mapping?.values?.[0], 'metric')
  const dimensionLabel = firstDefined(mapping?.x_axis, mapping?.legend, mapping?.location, mapping?.rows?.[0], 'dimension')
  if (!rows.length) return 'No data available for the current mapping.'
  const strongest = [...rows].sort((left, right) => Number(right?.metric || 0) - Number(left?.metric || 0))[0]
  if (chartType === 'kpi_card') return `${metricLabel} is shown as the lead KPI and updates automatically as your data changes.`
  if (chartType === 'scatter_plot') return `${mapping?.x_axis || 'X'} and ${mapping?.y_axis || 'Y'} show a correlation-ready spread across the visible sample.`
  return `${strongest?.label || 'This segment'} is currently the strongest ${dimensionLabel} by ${aggregation}.`
}

function buildEmptyRender(chartType, mapping) {
  return {
    chart_type: chartType,
    title: buildWidgetTitle(chartDefinition(chartType), mapping),
    resolved_mapping: mapping,
    figure: null,
    warning: 'No data available',
    note: '',
    insight: 'No data available for the current filters or mapping.',
    interaction: {},
  }
}

function groupedMetricRows(rows, profile, dimensionColumn, valueColumn, aggregation) {
  const dimensionKind = getColumnKind(profile, dimensionColumn)
  return Array.from(groupRowsBy(rows, (row) => formatLabel(row?.[dimensionColumn], dimensionKind)).entries())
    .map(([label, groupRows]) => ({ label, metric: aggregateRows(groupRows, valueColumn, aggregation), rawRows: groupRows }))
    .sort((left, right) => Number(right.metric) - Number(left.metric))
}

function buildBarLikeFigure(chartType, rows, profile, mapping, theme) {
  const valueColumn = firstDefined(mapping.y_axis, mapping.values?.[0])
  const dimensionColumn = firstDefined(mapping.x_axis, mapping.legend)
  const seriesColumn = chartType === 'stacked_bar_chart' ? mapping.legend : ''
  const aggregation = mapping.aggregation || 'sum'
  const baseRows = groupedMetricRows(rows, profile, dimensionColumn, valueColumn, aggregation).slice(0, 10)
  if (!baseRows.length) return buildEmptyRender(chartType, mapping)

  const traces = !seriesColumn ? [{
    type: 'bar',
    x: baseRows.map((item) => item.label),
    y: baseRows.map((item) => item.metric),
    marker: { color: COLORWAY[0] },
    hovertemplate: `%{x}<br>${valueColumn || aggregation}: %{y}<extra></extra>`,
  }] : uniqueValues(baseRows.flatMap((item) => item.rawRows.map((row) => row?.[seriesColumn]))).slice(0, 8).map((series, index) => ({
    type: 'bar',
    name: String(series ?? 'Unknown'),
    x: baseRows.map((item) => item.label),
    y: baseRows.map((item) => aggregateRows(item.rawRows.filter((row) => String(row?.[seriesColumn] ?? 'Unknown') === String(series ?? 'Unknown')), valueColumn, aggregation)),
    marker: { color: COLORWAY[index % COLORWAY.length] },
  }))

  return {
    chart_type: chartType,
    title: buildWidgetTitle(chartDefinition(chartType), mapping),
    resolved_mapping: mapping,
    figure: { data: traces, layout: themeLayout(theme, { barmode: chartType === 'stacked_bar_chart' ? 'stack' : 'group' }), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: buildInsightText(chartType, baseRows, mapping, aggregation),
    interaction: { filter_column: dimensionColumn, drill_column: mapping.details || dimensionColumn },
  }
}

function buildLineFigure(chartType, rows, profile, mapping, theme) {
  const valueColumn = firstDefined(mapping.y_axis, mapping.values?.[0])
  const dimensionColumn = firstDefined(mapping.x_axis, preferredDatetime(profile), preferredCategorical(profile))
  const legendColumn = mapping.legend
  const aggregation = mapping.aggregation || 'sum'
  const kind = getColumnKind(profile, dimensionColumn)
  const labels = uniqueValues(rows.map((row) => formatLabel(row?.[dimensionColumn], kind))).sort()
  if (!labels.length) return buildEmptyRender(chartType, mapping)

  const traces = legendColumn
    ? uniqueValues(rows.map((row) => row?.[legendColumn])).slice(0, 8).map((series, index) => ({
        type: 'scatter',
        mode: 'lines+markers',
        name: String(series ?? 'Unknown'),
        x: labels,
        y: labels.map((label) => aggregateRows(rows.filter((row) => formatLabel(row?.[dimensionColumn], kind) === label && String(row?.[legendColumn] ?? 'Unknown') === String(series ?? 'Unknown')), valueColumn, aggregation)),
        line: { color: COLORWAY[index % COLORWAY.length], width: 2.5 },
        marker: { size: 6 },
        fill: chartType === 'area_chart' ? 'tozeroy' : 'none',
        fillcolor: chartType === 'area_chart' ? `${COLORWAY[index % COLORWAY.length]}33` : undefined,
      }))
    : [{
        type: 'scatter',
        mode: 'lines+markers',
        x: labels,
        y: labels.map((label) => aggregateRows(rows.filter((row) => formatLabel(row?.[dimensionColumn], kind) === label), valueColumn, aggregation)),
        line: { color: COLORWAY[0], width: 3 },
        marker: { size: 7 },
        fill: chartType === 'area_chart' ? 'tozeroy' : 'none',
        fillcolor: chartType === 'area_chart' ? '#38bdf833' : undefined,
      }]

  return {
    chart_type: chartType,
    title: buildWidgetTitle(chartDefinition(chartType), mapping),
    resolved_mapping: mapping,
    figure: { data: traces, layout: themeLayout(theme), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: `${valueColumn || 'Metric'} ${Number(traces[0]?.y?.at(-1) || 0) >= Number(traces[0]?.y?.[0] || 0) ? 'is trending upward' : 'is trending downward'} across the selected dimension.`,
    interaction: { filter_column: dimensionColumn, drill_column: mapping.details || legendColumn || dimensionColumn },
  }
}

function buildComboFigure(rows, profile, mapping, theme) {
  const primaryMetric = firstDefined(mapping.values?.[0], mapping.y_axis, preferredNumeric(profile))
  const secondaryMetric = firstDefined(mapping.secondary_values?.[0], preferredNumeric(profile, true), primaryMetric)
  const dimensionColumn = firstDefined(mapping.x_axis, preferredDatetime(profile), preferredCategorical(profile))
  const dimensionKind = getColumnKind(profile, dimensionColumn)
  const aggregation = mapping.aggregation || 'sum'
  const labels = uniqueValues(rows.map((row) => formatLabel(row?.[dimensionColumn], dimensionKind))).sort()

  if (!labels.length || !primaryMetric) return buildEmptyRender('combo_chart', mapping)

  const barTrace = {
    type: 'bar',
    name: primaryMetric,
    x: labels,
    y: labels.map((label) => aggregateRows(rows.filter((row) => formatLabel(row?.[dimensionColumn], dimensionKind) === label), primaryMetric, aggregation)),
    marker: { color: COLORWAY[0], opacity: 0.88 },
  }

  const lineTrace = {
    type: 'scatter',
    mode: 'lines+markers',
    name: secondaryMetric,
    x: labels,
    y: labels.map((label) => aggregateRows(rows.filter((row) => formatLabel(row?.[dimensionColumn], dimensionKind) === label), secondaryMetric, aggregation)),
    yaxis: 'y2',
    line: { color: COLORWAY[2], width: 3 },
    marker: { size: 7 },
  }

  return {
    chart_type: 'combo_chart',
    title: buildWidgetTitle(chartDefinition('combo_chart'), mapping),
    resolved_mapping: mapping,
    figure: {
      data: secondaryMetric && secondaryMetric !== primaryMetric ? [barTrace, lineTrace] : [barTrace],
      layout: themeLayout(theme, {
        yaxis2: {
          overlaying: 'y',
          side: 'right',
          automargin: true,
          gridcolor: 'rgba(0,0,0,0)',
        },
      }),
      config: { displayModeBar: false },
    },
    warning: '',
    note: secondaryMetric && secondaryMetric !== primaryMetric ? `${primaryMetric} is shown as bars while ${secondaryMetric} overlays as a line.` : 'Add a secondary metric to turn this into a full combo visual.',
    insight: `${primaryMetric} and ${secondaryMetric || primaryMetric} are combined to compare scale and momentum in one place.`,
    interaction: { filter_column: dimensionColumn, drill_column: mapping.details || dimensionColumn },
  }
}

function buildPieFigure(chartType, rows, profile, mapping, theme) {
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const categoryColumn = firstDefined(mapping.legend, mapping.x_axis, preferredCategorical(profile))
  const aggregation = mapping.aggregation || 'sum'
  const metrics = groupedMetricRows(rows, profile, categoryColumn, valueColumn, aggregation).slice(0, 8)
  if (!metrics.length) return buildEmptyRender(chartType, mapping)

  return {
    chart_type: chartType,
    title: buildWidgetTitle(chartDefinition(chartType), mapping),
    resolved_mapping: mapping,
    figure: {
      data: [{ type: 'pie', labels: metrics.map((item) => item.label), values: metrics.map((item) => item.metric), hole: chartType === 'donut_chart' ? 0.6 : 0, marker: { colors: COLORWAY }, textinfo: 'percent' }],
      layout: themeLayout(theme, { margin: { l: 20, r: 20, t: 22, b: 22 } }),
      config: { displayModeBar: false },
    },
    warning: '',
    note: '',
    insight: buildInsightText(chartType, metrics, mapping, aggregation),
    interaction: { filter_column: categoryColumn, drill_column: mapping.details || categoryColumn },
  }
}

function buildScatterFigure(rows, profile, mapping, theme, chartType = 'scatter_plot') {
  const xColumn = firstDefined(mapping.x_axis, preferredNumericPair(profile)[0])
  const yColumn = firstDefined(mapping.y_axis, preferredNumericPair(profile)[1])
  const colorColumn = firstDefined(mapping.color, mapping.legend)
  const sizeColumn = chartType === 'bubble_chart' ? firstDefined(mapping.size, mapping.values?.[0], preferredNumeric(profile)) : ''
  const detailColumn = firstDefined(mapping.details, preferredCategorical(profile))
  const sample = rows.filter((row) => isFiniteNumber(row?.[xColumn]) && isFiniteNumber(row?.[yColumn])).slice(0, 220)
  if (!sample.length) return buildEmptyRender(chartType, mapping)

  const traces = colorColumn
    ? uniqueValues(sample.map((row) => row?.[colorColumn])).slice(0, 8).map((series, index) => {
        const points = sample.filter((row) => String(row?.[colorColumn] ?? 'Unknown') === String(series ?? 'Unknown'))
        return {
          type: 'scatter',
          mode: 'markers',
          name: String(series ?? 'Unknown'),
          x: points.map((row) => Number(row?.[xColumn])),
          y: points.map((row) => Number(row?.[yColumn])),
          customdata: points.map((row) => [detailColumn ? row?.[detailColumn] : row?.[xColumn]]),
          marker: {
            size: chartType === 'bubble_chart'
              ? points.map((row) => Math.max(9, Math.min(30, Number(row?.[sizeColumn] || row?.[yColumn] || 0) / 8)))
              : 8,
            sizemode: chartType === 'bubble_chart' ? 'diameter' : undefined,
            opacity: 0.86,
            color: COLORWAY[index % COLORWAY.length],
          },
        }
      })
    : [{
        type: 'scatter',
        mode: 'markers',
        x: sample.map((row) => Number(row?.[xColumn])),
        y: sample.map((row) => Number(row?.[yColumn])),
        customdata: sample.map((row) => [detailColumn ? row?.[detailColumn] : row?.[xColumn]]),
        marker: {
          size: chartType === 'bubble_chart'
            ? sample.map((row) => Math.max(9, Math.min(30, Number(row?.[sizeColumn] || row?.[yColumn] || 0) / 8)))
            : 9,
          sizemode: chartType === 'bubble_chart' ? 'diameter' : undefined,
          opacity: 0.82,
          color: COLORWAY[0],
        },
      }]

  return {
    chart_type: chartType,
    title: buildWidgetTitle(chartDefinition(chartType), mapping),
    resolved_mapping: mapping,
    figure: { data: traces, layout: themeLayout(theme), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: chartType === 'bubble_chart'
      ? `${xColumn}, ${yColumn}, and ${sizeColumn || yColumn} are combined to show relationship and magnitude together.`
      : `${xColumn} and ${yColumn} remain spread across multiple clusters, which makes this visual useful for pattern spotting.`,
    interaction: { filter_column: detailColumn || xColumn, drill_column: detailColumn || colorColumn || xColumn },
  }
}

function buildHistogramFigure(rows, profile, mapping, theme) {
  const valueColumn = firstDefined(mapping.y_axis, mapping.values?.[0], preferredNumeric(profile))
  const values = rows.map((row) => Number(row?.[valueColumn])).filter((value) => Number.isFinite(value))
  if (!values.length) return buildEmptyRender('histogram', mapping)

  return {
    chart_type: 'histogram',
    title: buildWidgetTitle(chartDefinition('histogram'), mapping),
    resolved_mapping: mapping,
    figure: {
      data: [{ type: 'histogram', x: values, marker: { color: COLORWAY[2] }, opacity: 0.92 }],
      layout: themeLayout(theme),
      config: { displayModeBar: false },
    },
    warning: '',
    note: '',
    insight: `${valueColumn} distribution is shown to help spot spread and skewness quickly.`,
    interaction: { filter_column: '', drill_column: '' },
  }
}

function buildBoxFigure(rows, profile, mapping, theme) {
  const valueColumn = firstDefined(mapping.y_axis, mapping.values?.[0], preferredNumeric(profile))
  const categoryColumn = firstDefined(mapping.x_axis, preferredCategorical(profile))
  const filteredRows = rows.filter((row) => isFiniteNumber(row?.[valueColumn]))
  if (!filteredRows.length) return buildEmptyRender('box_plot', mapping)

  const traces = categoryColumn
    ? uniqueValues(filteredRows.map((row) => row?.[categoryColumn])).slice(0, 8).map((series, index) => {
        const points = filteredRows.filter((row) => String(row?.[categoryColumn] ?? 'Unknown') === String(series ?? 'Unknown'))
        return {
          type: 'box',
          name: String(series ?? 'Unknown'),
          y: points.map((row) => Number(row?.[valueColumn])),
          marker: { color: COLORWAY[index % COLORWAY.length] },
          boxpoints: 'suspectedoutliers',
        }
      })
    : [{
        type: 'box',
        name: valueColumn || 'Metric',
        y: filteredRows.map((row) => Number(row?.[valueColumn])),
        marker: { color: COLORWAY[0] },
        boxpoints: 'suspectedoutliers',
      }]

  return {
    chart_type: 'box_plot',
    title: buildWidgetTitle(chartDefinition('box_plot'), mapping),
    resolved_mapping: mapping,
    figure: { data: traces, layout: themeLayout(theme), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: `${valueColumn} box plot highlights spread, quartiles, and potential outliers.`,
    interaction: { filter_column: categoryColumn || '', drill_column: categoryColumn || '' },
  }
}

function buildTreemapFigure(rows, profile, mapping, theme) {
  const legendColumn = firstDefined(mapping.legend, preferredCategorical(profile))
  const detailColumn = firstDefined(mapping.details, preferredCategorical(profile, true))
  const valueColumn = firstDefined(mapping.values?.[0], mapping.color, preferredNumeric(profile))
  const aggregation = mapping.aggregation || 'sum'
  if (!legendColumn) return buildEmptyRender('treemap', mapping)

  const groupColumns = [legendColumn, detailColumn].filter(Boolean)
  const grouped = Array.from(groupRowsBy(rows, (row) => groupColumns.map((column) => String(row?.[column] ?? 'Unknown')).join(' | ')).entries())
    .map(([key, groupRows]) => {
      const parts = key.split(' | ')
      return {
        parent: parts[0] || 'Unknown',
        label: parts.at(-1) || parts[0] || 'Unknown',
        metric: aggregateRows(groupRows, valueColumn, aggregation),
      }
    })
    .slice(0, 20)

  if (!grouped.length) return buildEmptyRender('treemap', mapping)

  return {
    chart_type: 'treemap',
    title: buildWidgetTitle(chartDefinition('treemap'), mapping),
    resolved_mapping: mapping,
    figure: {
      data: [{
        type: 'treemap',
        labels: grouped.map((item) => item.label),
        parents: grouped.map((item) => item.parent === item.label ? '' : item.parent),
        values: grouped.map((item) => item.metric),
        marker: { colors: grouped.map((_, index) => COLORWAY[index % COLORWAY.length]) },
      }],
      layout: themeLayout(theme, { margin: { l: 8, r: 8, t: 18, b: 8 } }),
      config: { displayModeBar: false },
    },
    warning: '',
    note: '',
    insight: `${legendColumn} is broken into nested contribution blocks for quick share analysis.`,
    interaction: { filter_column: legendColumn, drill_column: detailColumn || legendColumn },
  }
}

function buildRibbonFigure(rows, profile, mapping, theme) {
  const timeColumn = firstDefined(mapping.x_axis, preferredDatetime(profile), preferredCategorical(profile))
  const categoryColumn = firstDefined(mapping.legend, preferredCategorical(profile), preferredCategorical(profile, true))
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const aggregation = mapping.aggregation || 'sum'
  const timeKind = getColumnKind(profile, timeColumn)
  const labels = uniqueValues(rows.map((row) => formatLabel(row?.[timeColumn], timeKind))).sort().slice(-10)
  const categories = uniqueValues(rows.map((row) => row?.[categoryColumn])).slice(0, 6)

  if (!labels.length || !categoryColumn || !valueColumn) return buildEmptyRender('ribbon_chart', mapping)

  return {
    chart_type: 'ribbon_chart',
    title: buildWidgetTitle(chartDefinition('ribbon_chart'), mapping),
    resolved_mapping: mapping,
    figure: {
      data: categories.map((category, index) => ({
        type: 'scatter',
        mode: 'lines',
        stackgroup: 'ribbon',
        name: String(category ?? 'Unknown'),
        x: labels,
        y: labels.map((label) => aggregateRows(
          rows.filter((row) => (
            formatLabel(row?.[timeColumn], timeKind) === label
            && String(row?.[categoryColumn] ?? 'Unknown') === String(category ?? 'Unknown')
          )),
          valueColumn,
          aggregation
        )),
        line: { width: 2, color: COLORWAY[index % COLORWAY.length] },
        fillcolor: `${COLORWAY[index % COLORWAY.length]}44`,
      })),
      layout: themeLayout(theme),
      config: { displayModeBar: false },
    },
    warning: '',
    note: 'Ribbon visuals are best when one category can overtake another over time.',
    insight: `${categoryColumn} leadership shifts are shown across ${timeColumn}.`,
    interaction: { filter_column: categoryColumn, drill_column: mapping.details || categoryColumn },
  }
}

function buildDecompositionTreeFigure(rows, profile, mapping, theme) {
  const hierarchyColumns = mapping.rows?.length
    ? mapping.rows
    : [mapping.legend, mapping.details, mapping.x_axis].filter(Boolean)
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const aggregation = mapping.aggregation || 'sum'

  if (!hierarchyColumns.length || !valueColumn) return buildEmptyRender('decomposition_tree', mapping)

  const grouped = Array.from(groupRowsBy(rows, (row) => hierarchyColumns.map((column) => String(row?.[column] ?? 'Unknown')).join(' | ')).entries())
    .map(([key, groupRows]) => ({
      parts: key.split(' | '),
      metric: aggregateRows(groupRows, valueColumn, aggregation),
    }))
    .slice(0, 18)

  if (!grouped.length) return buildEmptyRender('decomposition_tree', mapping)

  const nodeMap = new Map()

  grouped.forEach((item) => {
    item.parts.forEach((part, index) => {
      const label = String(part || 'Unknown')
      const parent = index === 0 ? '' : String(item.parts[index - 1] || 'Unknown')
      const key = `${parent}>${label}`
      const current = nodeMap.get(key) || { label, parent, value: 0 }
      current.value += item.metric
      nodeMap.set(key, current)
    })
  })

  const nodes = Array.from(nodeMap.values())

  return {
    chart_type: 'decomposition_tree',
    title: buildWidgetTitle(chartDefinition('decomposition_tree'), mapping),
    resolved_mapping: mapping,
    figure: {
      data: [{
        type: 'icicle',
        labels: nodes.map((node) => node.label),
        parents: nodes.map((node) => node.parent),
        values: nodes.map((node) => node.value),
        branchvalues: 'total',
        marker: { colors: nodes.map((_, index) => COLORWAY[index % COLORWAY.length]) },
      }],
      layout: themeLayout(theme, { margin: { l: 6, r: 6, t: 12, b: 6 } }),
      config: { displayModeBar: false },
    },
    warning: '',
    note: `Hierarchy derived from ${hierarchyColumns.join(' > ')}.`,
    insight: `${valueColumn} is decomposed across the strongest hierarchy drivers.`,
    interaction: { filter_column: hierarchyColumns[0], drill_column: hierarchyColumns[1] || hierarchyColumns[0] },
  }
}

function buildKpiFigure(rows, profile, mapping, theme) {
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const aggregation = mapping.aggregation || 'sum'
  const current = aggregateRows(rows, valueColumn, aggregation)
  const reference = aggregateRows(rows.slice(0, Math.max(1, Math.floor(rows.length / 2))), valueColumn, aggregation)
  const suffix = Math.abs(current) >= 1000 ? 'k' : ''
  const shown = suffix ? Number((current / 1000).toFixed(1)) : current
  const ref = reference && suffix ? Number((reference / 1000).toFixed(1)) : reference

  return {
    chart_type: 'kpi_card',
    title: buildWidgetTitle(chartDefinition('kpi_card'), mapping),
    resolved_mapping: mapping,
    figure: { data: [{ type: 'indicator', mode: 'number+delta', value: shown, number: { suffix, font: { size: 46, color: theme === 'light' ? '#0f172a' : '#f8fafc' } }, delta: { reference: ref || 0, relative: true, increasing: { color: '#34d399' }, decreasing: { color: '#fb7185' } }, title: { text: valueColumn || 'KPI' } }], layout: themeLayout(theme, { margin: { l: 18, r: 18, t: 10, b: 10 } }), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: buildInsightText('kpi_card', [{ label: valueColumn || 'KPI', metric: current }], mapping, aggregation),
    interaction: { filter_column: firstDefined(mapping.tooltip?.[0], preferredCategorical(profile)), drill_column: firstDefined(mapping.tooltip?.[0], preferredCategorical(profile)) },
  }
}

function buildTableFigure(rows, profile, mapping, theme) {
  const columns = mapping.values?.length ? mapping.values : profile.columns.all.slice(0, 6)
  const sample = rows.slice(0, 12)
  if (!columns.length || !sample.length) return buildEmptyRender('table', mapping)

  return {
    chart_type: 'table',
    title: buildWidgetTitle(chartDefinition('table'), { ...mapping, values: columns }),
    resolved_mapping: { ...mapping, values: columns },
    figure: { data: [{ type: 'table', header: { values: columns, align: 'left', fill: { color: theme === 'light' ? '#e2e8f0' : '#16233c' }, font: { color: theme === 'light' ? '#0f172a' : '#f8fafc', size: 12 } }, cells: { values: columns.map((column) => sample.map((row) => row?.[column] ?? '')), align: 'left', fill: { color: theme === 'light' ? '#ffffff' : '#0f172a' }, font: { color: theme === 'light' ? '#0f172a' : '#dbe7ff', size: 11 }, height: 28 } }], layout: themeLayout(theme, { margin: { l: 10, r: 10, t: 10, b: 10 } }), config: { displayModeBar: false } },
    warning: '',
    note: `Showing ${sample.length} preview rows.`,
    insight: 'The table stays in sync with filters and is useful for raw data validation.',
    interaction: { filter_column: columns[0], drill_column: columns[0] },
  }
}

function buildMatrixFigure(rows, mapping, theme) {
  const rowColumn = mapping.rows?.[0]
  const columnColumn = mapping.columns?.[0]
  const valueColumn = mapping.values?.[0]
  const aggregation = mapping.aggregation || 'sum'
  if (!rowColumn || !columnColumn) return buildEmptyRender('matrix', mapping)

  const rowLabels = uniqueValues(rows.map((row) => row?.[rowColumn])).slice(0, 8)
  const columnLabels = uniqueValues(rows.map((row) => row?.[columnColumn])).slice(0, 8)
  const z = columnLabels.map((columnLabel) => rowLabels.map((rowLabel) => aggregateRows(rows.filter((row) => String(row?.[rowColumn]) === String(rowLabel) && String(row?.[columnColumn]) === String(columnLabel)), valueColumn, aggregation)))

  return {
    chart_type: 'matrix',
    title: buildWidgetTitle(chartDefinition('matrix'), mapping),
    resolved_mapping: mapping,
    figure: { data: [{ type: 'heatmap', x: rowLabels, y: columnLabels, z, colorscale: 'Turbo', showscale: true }], layout: themeLayout(theme, { xaxis: { automargin: true, side: 'top' } }), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: `${rowColumn} by ${columnColumn} highlights where the heaviest combinations sit.`,
    interaction: { filter_column: rowColumn, drill_column: rowColumn },
  }
}

function buildFunnelFigure(rows, profile, mapping, theme) {
  const stageColumn = firstDefined(mapping.x_axis, mapping.legend, preferredCategorical(profile))
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const aggregation = mapping.aggregation || 'sum'
  const metrics = groupedMetricRows(rows, profile, stageColumn, valueColumn, aggregation).slice(0, 8)
  if (!metrics.length) return buildEmptyRender('funnel_chart', mapping)

  return {
    chart_type: 'funnel_chart',
    title: buildWidgetTitle(chartDefinition('funnel_chart'), mapping),
    resolved_mapping: mapping,
    figure: { data: [{ type: 'funnel', y: metrics.map((item) => item.label), x: metrics.map((item) => item.metric), marker: { color: COLORWAY.slice(0, metrics.length) } }], layout: themeLayout(theme, { margin: { l: 90, r: 30, t: 20, b: 20 } }), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: buildInsightText('funnel_chart', metrics, mapping, aggregation),
    interaction: { filter_column: stageColumn, drill_column: mapping.details || stageColumn },
  }
}

function buildWaterfallFigure(rows, profile, mapping, theme) {
  const categoryColumn = firstDefined(mapping.x_axis, preferredCategorical(profile), preferredDatetime(profile))
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const aggregation = mapping.aggregation || 'sum'
  const metrics = groupedMetricRows(rows, profile, categoryColumn, valueColumn, aggregation).sort((left, right) => String(left.label).localeCompare(String(right.label))).slice(0, 10)
  if (!metrics.length) return buildEmptyRender('waterfall_chart', mapping)

  return {
    chart_type: 'waterfall_chart',
    title: buildWidgetTitle(chartDefinition('waterfall_chart'), mapping),
    resolved_mapping: mapping,
    figure: { data: [{ type: 'waterfall', x: metrics.map((item) => item.label), y: metrics.map((item) => item.metric), measure: metrics.map(() => 'relative'), connector: { line: { color: theme === 'light' ? '#94a3b8' : '#475569' } } }], layout: themeLayout(theme), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: `${valueColumn || 'Metric'} is changing incrementally across ${categoryColumn}.`,
    interaction: { filter_column: categoryColumn, drill_column: mapping.details || categoryColumn },
  }
}

function buildGaugeFigure(rows, profile, mapping, theme) {
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const targetColumn = firstDefined(mapping.target, preferredNumeric(profile, true))
  const current = aggregateRows(rows, valueColumn, mapping.aggregation || 'sum')
  const target = targetColumn ? aggregateRows(rows, targetColumn, 'avg') : current * 1.1
  const ceiling = Math.max(current, target, 1) * 1.2

  return {
    chart_type: 'gauge_chart',
    title: buildWidgetTitle(chartDefinition('gauge_chart'), mapping),
    resolved_mapping: mapping,
    figure: { data: [{ type: 'indicator', mode: 'gauge+number+delta', value: current, delta: { reference: target, relative: true, increasing: { color: '#34d399' }, decreasing: { color: '#fb7185' } }, gauge: { axis: { range: [0, ceiling] }, bar: { color: '#38bdf8' }, steps: [{ range: [0, ceiling * 0.5], color: 'rgba(248,113,113,0.18)' }, { range: [ceiling * 0.5, ceiling * 0.8], color: 'rgba(250,204,21,0.18)' }, { range: [ceiling * 0.8, ceiling], color: 'rgba(52,211,153,0.18)' }], threshold: { value: target, line: { color: '#f97316', width: 4 } } } }], layout: themeLayout(theme, { margin: { l: 30, r: 30, t: 24, b: 18 } }), config: { displayModeBar: false } },
    warning: '',
    note: targetColumn ? `Target derived from ${targetColumn}.` : 'Target estimated from the current metric trend.',
    insight: `${valueColumn || 'KPI'} is ${current >= target ? 'ahead of' : 'below'} the current target band.`,
    interaction: { filter_column: firstDefined(mapping.tooltip?.[0], preferredCategorical(profile)), drill_column: firstDefined(mapping.tooltip?.[0], preferredCategorical(profile)) },
  }
}

function buildGeoFigure(rows, profile, mapping, theme) {
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const locationColumn = firstDefined(mapping.location, preferredGeoColumns(profile).location, preferredCategorical(profile))
  const latitudeColumn = mapping.latitude
  const longitudeColumn = mapping.longitude
  const aggregation = mapping.aggregation || 'sum'

  const trace = latitudeColumn && longitudeColumn
    ? (() => {
        const points = rows.filter((row) => isFiniteNumber(row?.[latitudeColumn]) && isFiniteNumber(row?.[longitudeColumn])).slice(0, 40)
        if (!points.length) return null
        return { type: 'scattergeo', lat: points.map((row) => Number(row?.[latitudeColumn])), lon: points.map((row) => Number(row?.[longitudeColumn])), text: points.map((row) => `${row?.[locationColumn] ?? 'Location'}<br>${valueColumn}: ${row?.[valueColumn] ?? 0}`), customdata: points.map((row) => [row?.[locationColumn] ?? row?.[latitudeColumn]]), mode: 'markers', marker: { size: points.map((row) => Math.max(10, Math.min(24, Number(row?.[valueColumn] || 0) / 6000))), color: points.map((row) => Number(row?.[valueColumn] || 0)), colorscale: 'Turbo', showscale: true, line: { color: '#0f172a', width: 1 } } }
      })()
    : (() => {
        const metrics = groupedMetricRows(rows, profile, locationColumn, valueColumn, aggregation).slice(0, 12)
        if (!metrics.length) return null
        return { type: 'scattergeo', locationmode: 'country names', locations: metrics.map((item) => item.label), text: metrics.map((item) => `${item.label}<br>${valueColumn}: ${item.metric}`), customdata: metrics.map((item) => [item.label]), marker: { size: metrics.map((item) => Math.max(12, Math.min(26, item.metric / 6000))), color: metrics.map((item) => item.metric), colorscale: 'Turbo', showscale: true, line: { color: '#0f172a', width: 0.8 } } }
      })()

  if (!trace) return buildEmptyRender('geo_chart', mapping)

  return {
    chart_type: 'geo_chart',
    title: buildWidgetTitle(chartDefinition('geo_chart'), mapping),
    resolved_mapping: mapping,
    figure: { data: [trace], layout: themeLayout(theme, { margin: { l: 0, r: 0, t: 10, b: 0 }, geo: { bgcolor: 'rgba(0,0,0,0)', showland: true, landcolor: theme === 'light' ? '#e5eef9' : '#11213a', showcountries: true, countrycolor: theme === 'light' ? '#cbd5e1' : '#23324c', showocean: true, oceancolor: theme === 'light' ? '#dbeafe' : '#0b1526' } }), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: `${locationColumn || 'Location'} is driving the geographic spread in this visual.`,
    interaction: { filter_column: locationColumn, drill_column: locationColumn },
  }
}

function buildHeatmapFigure(rows, profile, mapping, theme) {
  const xColumn = firstDefined(mapping.x_axis, preferredDatetime(profile), preferredCategorical(profile))
  const yColumn = firstDefined(mapping.y_axis, preferredCategorical(profile, true), preferredCategorical(profile))
  const valueColumn = firstDefined(mapping.values?.[0], preferredNumeric(profile))
  const aggregation = mapping.aggregation || 'sum'
  const xLabels = uniqueValues(rows.map((row) => formatLabel(row?.[xColumn], getColumnKind(profile, xColumn)))).slice(0, 8)
  const yLabels = uniqueValues(rows.map((row) => String(row?.[yColumn] ?? 'Unknown'))).slice(0, 8)
  if (!xLabels.length || !yLabels.length) return buildEmptyRender('heatmap', mapping)

  return {
    chart_type: 'heatmap',
    title: buildWidgetTitle(chartDefinition('heatmap'), mapping),
    resolved_mapping: mapping,
    figure: { data: [{ type: 'heatmap', x: xLabels, y: yLabels, z: yLabels.map((yLabel) => xLabels.map((xLabel) => aggregateRows(rows.filter((row) => formatLabel(row?.[xColumn], getColumnKind(profile, xColumn)) === xLabel && String(row?.[yColumn] ?? 'Unknown') === yLabel), valueColumn, aggregation))), colorscale: 'Turbo', hoverongaps: false }], layout: themeLayout(theme), config: { displayModeBar: false } },
    warning: '',
    note: '',
    insight: `${yColumn} intensity changes noticeably across ${xColumn}.`,
    interaction: { filter_column: xColumn, drill_column: yColumn },
  }
}

function autoSuggestChartType(selectedColumns = [], profile) {
  const selected = Array.isArray(selectedColumns) ? selectedColumns.filter(Boolean) : []
  const kinds = selected.map((column) => getColumnKind(profile, column))
  const hasNumeric = kinds.includes('numeric')
  const numericCount = kinds.filter((kind) => kind === 'numeric').length
  const categoricalCount = kinds.filter((kind) => kind === 'categorical').length
  const hasDatetime = kinds.includes('datetime')
  const hasGeo = selected.some((column) => inferGeoRole(column))
    || Boolean(preferredGeoColumns(profile).location || (preferredGeoColumns(profile).latitude && preferredGeoColumns(profile).longitude))

  if (hasGeo && hasNumeric) return 'geo_chart'
  if (hasDatetime && numericCount >= 2) return 'combo_chart'
  if (hasDatetime && hasNumeric && categoricalCount >= 1) return 'ribbon_chart'
  if (numericCount >= 2) return 'scatter_plot'
  if (hasNumeric && hasDatetime) return 'line_chart'
  if (hasNumeric && categoricalCount >= 2) return 'heatmap'
  if (hasNumeric && categoricalCount >= 1) return 'bar_chart'
  if (numericCount === 1) return 'kpi_card'
  return profile?.columns?.categorical?.length ? 'donut_chart' : 'table'
}

function normalizeChartType(chartType, profile, selectedColumns) {
  if (!chartType || chartType === 'auto') {
    return autoSuggestChartType(selectedColumns, profile)
  }
  return chartDefinition(chartType).id
}

function resolveWidgetMapping(chartType, profile, selectedColumns = [], mapping = {}) {
  const autoMapping = buildAutoMapping(chartType, profile, selectedColumns)
  return {
    ...autoMapping,
    ...mapping,
    values: mapping?.values?.length ? mapping.values : autoMapping.values,
    secondary_values: mapping?.secondary_values?.length ? mapping.secondary_values : autoMapping.secondary_values,
    tooltip: mapping?.tooltip?.length ? mapping.tooltip : autoMapping.tooltip,
    rows: mapping?.rows?.length ? mapping.rows : autoMapping.rows,
    columns: mapping?.columns?.length ? mapping.columns : autoMapping.columns,
    aggregation: mapping?.aggregation || autoMapping.aggregation || 'sum',
    title: mapping?.title || '',
  }
}

function renderFigureForType(chartType, rows, profile, mapping, theme, settings) {
  let response
  switch (chartType) {
    case 'bar_chart':
    case 'stacked_bar_chart':
      response = buildBarLikeFigure(chartType, rows, profile, mapping, theme)
      break
    case 'line_chart':
    case 'area_chart':
      response = buildLineFigure(chartType, rows, profile, mapping, theme)
      break
    case 'combo_chart':
      response = buildComboFigure(rows, profile, mapping, theme)
      break
    case 'pie_chart':
    case 'donut_chart':
      response = buildPieFigure(chartType, rows, profile, mapping, theme)
      break
    case 'scatter_plot':
      response = buildScatterFigure(rows, profile, mapping, theme, 'scatter_plot')
      break
    case 'bubble_chart':
      response = buildScatterFigure(rows, profile, mapping, theme, 'bubble_chart')
      break
    case 'histogram':
      response = buildHistogramFigure(rows, profile, mapping, theme)
      break
    case 'box_plot':
      response = buildBoxFigure(rows, profile, mapping, theme)
      break
    case 'kpi_card':
      response = buildKpiFigure(rows, profile, mapping, theme)
      break
    case 'table':
      response = buildTableFigure(rows, profile, mapping, theme)
      break
    case 'matrix':
      response = buildMatrixFigure(rows, mapping, theme)
      break
    case 'funnel_chart':
      response = buildFunnelFigure(rows, profile, mapping, theme)
      break
    case 'waterfall_chart':
      response = buildWaterfallFigure(rows, profile, mapping, theme)
      break
    case 'gauge_chart':
      response = buildGaugeFigure(rows, profile, mapping, theme)
      break
    case 'geo_chart':
      response = buildGeoFigure(rows, profile, mapping, theme)
      break
    case 'heatmap':
      response = buildHeatmapFigure(rows, profile, mapping, theme)
      break
    case 'ribbon_chart':
      response = buildRibbonFigure(rows, profile, mapping, theme)
      break
    case 'treemap':
      response = buildTreemapFigure(rows, profile, mapping, theme)
      break
    case 'decomposition_tree':
      response = buildDecompositionTreeFigure(rows, profile, mapping, theme)
      break
    default:
      response = buildBarLikeFigure('bar_chart', rows, profile, mapping, theme)
      break
  }

  return applyFigureSettings(chartType, response, theme, settings)
}

function dashboardStorageKey(datasetName) {
  return `${LOCAL_DASHBOARD_KEY}:${normalizeToken(datasetName || 'demo-dashboard')}`
}

function readStoredDashboard(datasetName) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(dashboardStorageKey(datasetName))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStoredDashboard(datasetName, dashboard) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(dashboardStorageKey(datasetName), JSON.stringify(dashboard))
  } catch {
    // Ignore local persistence errors and keep the in-memory fallback active.
  }
}

export async function getLocalDashboardMetadata() {
  const { dataset, profile } = ensureSession()
  await wait(90)
  return buildDashboardMetadata(dataset, profile)
}

export async function getLocalDashboardSuggestion(payload = {}) {
  const { profile } = ensureSession()
  const chartType = normalizeChartType(payload.chart_type, profile, payload.selected_columns)
  const mapping = resolveWidgetMapping(chartType, profile, payload.selected_columns, payload.mapping)
  await wait(70)
  return {
    chart_type: chartType,
    title: payload.title || buildWidgetTitle(chartDefinition(chartType), mapping),
    mapping,
  }
}

export async function getLocalDashboardRender(payload = {}) {
  const { dataset, profile } = ensureSession()
  const chartType = normalizeChartType(payload.chart_type, profile, payload.selected_columns)
  const mapping = resolveWidgetMapping(chartType, profile, payload.selected_columns, payload.mapping)
  const filteredRows = applyFilters(dataset?.rows || [], payload.filters, payload.drill_column, payload.drill_value)
  await wait(110)

  const response = renderFigureForType(chartType, filteredRows, profile, mapping, payload.theme || 'dark', payload.settings || {})
  const detailNotes = []

  if (payload.filters?.length) {
    detailNotes.push(`Synced with ${payload.filters.length} active filter${payload.filters.length > 1 ? 's' : ''}.`)
  }
  if (payload.drill_column && payload.drill_value !== undefined && payload.drill_value !== null) {
    detailNotes.push(`Drilled into ${payload.drill_column}: ${String(payload.drill_value)}.`)
  }

  return {
    ...response,
    title: mapping.title || response.title,
    resolved_mapping: mapping,
    note: [response.note, ...detailNotes].filter(Boolean).join(' '),
  }
}

export async function saveLocalDashboardDefinition(payload = {}) {
  const { dataset } = ensureSession()
  const dashboard = {
    name: payload.name || 'Auto Power BI Dashboard',
    dataset_name: payload.dataset_name || dataset?.name || 'Dataset',
    theme: payload.theme || payload.themeMode || 'dark',
    interaction_mode: payload.interaction_mode || payload.interactionMode || 'cross-filter',
    selected_widget_id: payload.selected_widget_id || payload.selectedWidgetId || null,
    cross_filter: payload.cross_filter || payload.crossFilter || null,
    widgets: payload.widgets || [],
  }

  localDashboardDefinition = dashboard
  writeStoredDashboard(dashboard.dataset_name, dashboard)
  await wait(60)
  return { ok: true, dashboard }
}

export async function loadLocalDashboardDefinition() {
  const { dataset } = ensureSession()
  const stored = readStoredDashboard(dataset?.name)
  const dashboard = stored || localDashboardDefinition || {}
  await wait(50)
  return { dashboard }
}
