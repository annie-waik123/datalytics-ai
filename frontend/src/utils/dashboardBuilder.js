export const GRID_COLUMNS = 12
export const GRID_ROW_HEIGHT = 92
export const BUILDER_STORAGE_KEY = 'datalytics_powerbi_builder'

export const FIELD_SLOT_DEFINITIONS = {
  values: { label: 'Values', multi: true, accepts: ['numeric', 'categorical', 'datetime'] },
  secondary_values: { label: 'Secondary Values', multi: true, accepts: ['numeric'] },
  legend: { label: 'Legend', multi: false, accepts: ['categorical', 'datetime', 'numeric'] },
  tooltip: { label: 'Tooltip', multi: true, accepts: ['categorical', 'datetime', 'numeric'] },
  x_axis: { label: 'X Axis', multi: false, accepts: ['categorical', 'datetime', 'numeric'] },
  y_axis: { label: 'Y Axis', multi: false, accepts: ['numeric', 'categorical', 'datetime'] },
  size: { label: 'Size', multi: false, accepts: ['numeric'] },
  color: { label: 'Color', multi: false, accepts: ['categorical', 'numeric', 'datetime'] },
  details: { label: 'Details', multi: false, accepts: ['categorical', 'datetime'] },
  rows: { label: 'Rows', multi: true, accepts: ['categorical', 'datetime'] },
  columns: { label: 'Columns', multi: true, accepts: ['categorical', 'datetime'] },
  location: { label: 'Location', multi: false, accepts: ['categorical', 'datetime'] },
  latitude: { label: 'Latitude', multi: false, accepts: ['numeric'] },
  longitude: { label: 'Longitude', multi: false, accepts: ['numeric'] },
  target: { label: 'Target', multi: false, accepts: ['numeric'] },
}

export const POWER_BI_CHARTS = [
  {
    id: 'bar_chart',
    label: 'Bar Chart',
    iconKey: 'bar',
    accent: 'cyan',
    description: 'Compare aggregated values across categories.',
    slots: ['values', 'legend', 'tooltip', 'x_axis', 'y_axis', 'details'],
    defaultSize: { w: 5, h: 4 },
  },
  {
    id: 'stacked_bar_chart',
    label: 'Stacked Bar Chart',
    iconKey: 'stacked',
    accent: 'orange',
    description: 'Break totals into stacked groups.',
    slots: ['values', 'legend', 'tooltip', 'x_axis', 'y_axis', 'color', 'details'],
    defaultSize: { w: 5, h: 4 },
  },
  {
    id: 'line_chart',
    label: 'Line Chart',
    iconKey: 'line',
    accent: 'blue',
    description: 'Track trends across time or ordered dimensions.',
    slots: ['values', 'legend', 'tooltip', 'x_axis', 'y_axis', 'details'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'area_chart',
    label: 'Area Chart',
    iconKey: 'area',
    accent: 'teal',
    description: 'Show cumulative magnitude across a trend.',
    slots: ['values', 'legend', 'tooltip', 'x_axis', 'y_axis', 'details'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'combo_chart',
    label: 'Combo Chart',
    iconKey: 'combo',
    accent: 'sky',
    description: 'Blend bars and lines to compare two metrics together.',
    slots: ['values', 'secondary_values', 'legend', 'tooltip', 'x_axis', 'y_axis', 'details'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'pie_chart',
    label: 'Pie Chart',
    iconKey: 'pie',
    accent: 'amber',
    description: 'Show composition by category.',
    slots: ['values', 'legend', 'tooltip'],
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: 'donut_chart',
    label: 'Donut Chart',
    iconKey: 'donut',
    accent: 'pink',
    description: 'Show composition with a central metric feel.',
    slots: ['values', 'legend', 'tooltip'],
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: 'scatter_plot',
    label: 'Scatter Plot',
    iconKey: 'scatter',
    accent: 'violet',
    description: 'Reveal relationships between numeric fields.',
    slots: ['values', 'legend', 'tooltip', 'x_axis', 'y_axis', 'color', 'details'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'bubble_chart',
    label: 'Bubble Chart',
    iconKey: 'bubble',
    accent: 'violet',
    description: 'Compare numeric relationships with bubble size.',
    slots: ['values', 'legend', 'tooltip', 'x_axis', 'y_axis', 'size', 'color', 'details'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'histogram',
    label: 'Histogram',
    iconKey: 'histogram',
    accent: 'amber',
    description: 'Understand the distribution of a numeric field.',
    slots: ['values', 'tooltip'],
    defaultSize: { w: 5, h: 4 },
  },
  {
    id: 'box_plot',
    label: 'Box Plot',
    iconKey: 'box',
    accent: 'blue',
    description: 'Inspect spread, quartiles, and outliers.',
    slots: ['values', 'tooltip', 'x_axis'],
    defaultSize: { w: 5, h: 4 },
  },
  {
    id: 'kpi_card',
    label: 'KPI Card',
    iconKey: 'kpi',
    accent: 'emerald',
    description: 'Highlight a headline metric with smart delta.',
    slots: ['values', 'tooltip'],
    defaultSize: { w: 4, h: 3 },
  },
  {
    id: 'table',
    label: 'Table',
    iconKey: 'table',
    accent: 'slate',
    description: 'Show raw rows with dashboard filters.',
    slots: ['values', 'tooltip'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'matrix',
    label: 'Matrix',
    iconKey: 'matrix',
    accent: 'indigo',
    description: 'Pivot values across rows and columns.',
    slots: ['values', 'tooltip', 'rows', 'columns'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'funnel_chart',
    label: 'Funnel Chart',
    iconKey: 'funnel',
    accent: 'rose',
    description: 'Track drop-off through funnel stages.',
    slots: ['values', 'legend', 'tooltip', 'x_axis', 'details'],
    defaultSize: { w: 5, h: 4 },
  },
  {
    id: 'waterfall_chart',
    label: 'Waterfall Chart',
    iconKey: 'waterfall',
    accent: 'sky',
    description: 'Visualize incremental contributions.',
    slots: ['values', 'tooltip', 'x_axis', 'details'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'gauge_chart',
    label: 'Gauge Chart',
    iconKey: 'gauge',
    accent: 'lime',
    description: 'Compare a KPI against a target band.',
    slots: ['values', 'target', 'tooltip'],
    defaultSize: { w: 4, h: 4 },
  },
  {
    id: 'geo_chart',
    label: 'Geo Chart',
    iconKey: 'geo',
    accent: 'cyan',
    description: 'Plot measures across locations or coordinates.',
    slots: ['values', 'location', 'latitude', 'longitude', 'tooltip'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    iconKey: 'heatmap',
    accent: 'orange',
    description: 'Compare intensity across two dimensions.',
    slots: ['values', 'tooltip', 'x_axis', 'y_axis', 'color'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'ribbon_chart',
    label: 'Ribbon Chart',
    iconKey: 'ribbon',
    accent: 'indigo',
    description: 'Track category leadership changes across a sequence.',
    slots: ['values', 'legend', 'tooltip', 'x_axis', 'y_axis', 'details'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'treemap',
    label: 'Treemap',
    iconKey: 'treemap',
    accent: 'emerald',
    description: 'Show grouped contribution in a space-filling view.',
    slots: ['values', 'legend', 'tooltip', 'details', 'color'],
    defaultSize: { w: 6, h: 4 },
  },
  {
    id: 'decomposition_tree',
    label: 'Decomposition Tree',
    iconKey: 'tree',
    accent: 'lime',
    description: 'Break a metric into hierarchical drivers.',
    slots: ['values', 'rows', 'legend', 'details', 'tooltip'],
    defaultSize: { w: 6, h: 4 },
  },
]

export function chartDefinition(chartType) {
  return POWER_BI_CHARTS.find((item) => item.id === chartType) || POWER_BI_CHARTS[0]
}

export function createWidgetId() {
  return `widget-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyWidgetMapping() {
  return {
    x_axis: '',
    y_axis: '',
    values: [],
    secondary_values: [],
    legend: '',
    tooltip: [],
    size: '',
    color: '',
    details: '',
    rows: [],
    columns: [],
    location: '',
    latitude: '',
    longitude: '',
    target: '',
    aggregation: 'sum',
    title: '',
  }
}

export function defaultWidgetSettings() {
  return {
    palette: 'executive',
    orientation: 'vertical',
    showLegend: true,
    showGrid: true,
    sortOrder: 'auto',
    xLabel: '',
    yLabel: '',
    interactions: 'cross-filter',
  }
}

export function createWidget(chartType, overrides = {}) {
  const definition = chartDefinition(chartType)
  return {
    id: overrides.id || createWidgetId(),
    chartType,
    title: overrides.title || definition.label,
    mapping: { ...emptyWidgetMapping(), ...(overrides.mapping || {}) },
    layout: {
      x: overrides.layout?.x ?? 0,
      y: overrides.layout?.y ?? 0,
      w: overrides.layout?.w ?? definition.defaultSize.w,
      h: overrides.layout?.h ?? definition.defaultSize.h,
    },
    figure: overrides.figure || null,
    warning: overrides.warning || '',
    note: overrides.note || '',
    insight: overrides.insight || '',
    interaction: overrides.interaction || {},
    settings: { ...defaultWidgetSettings(), ...(overrides.settings || {}) },
    viewMode: overrides.viewMode || 'default',
    storedLayout: overrides.storedLayout || null,
    loading: Boolean(overrides.loading),
    drill: overrides.drill || null,
  }
}

export function stripRuntime(widget) {
  return {
    id: widget.id,
    chartType: widget.chartType,
    title: widget.title,
    mapping: widget.mapping,
    layout: widget.layout,
    settings: widget.settings || defaultWidgetSettings(),
    viewMode: widget.viewMode || 'default',
    storedLayout: widget.storedLayout || null,
    drill: widget.drill || null,
  }
}

export function buildPersistedDashboard(state) {
  return {
    themeMode: state.themeMode || 'dark',
    interactionMode: state.interactionMode || 'cross-filter',
    selectedWidgetId: state.selectedWidgetId || null,
    crossFilter: state.crossFilter || null,
    globalFilters: state.globalFilters || [],
    widgets: (state.widgets || []).map(stripRuntime),
  }
}

export function hydrateWidgets(rawWidgets = []) {
  return rawWidgets.map((widget) => createWidget(widget.chartType || widget.chart_type || 'bar_chart', {
    id: widget.id || widget.widget_id,
    title: widget.title,
    mapping: widget.mapping || widget.resolved_mapping,
    layout: widget.layout,
    settings: widget.settings,
    viewMode: widget.viewMode || widget.view_mode || 'default',
    storedLayout: widget.storedLayout || widget.stored_layout || null,
    drill: widget.drill,
  }))
}

export function captureSnapshot(state) {
  return JSON.parse(JSON.stringify(buildPersistedDashboard(state)))
}

export function collides(left, right) {
  return !(
    left.x + left.w <= right.x ||
    right.x + right.w <= left.x ||
    left.y + left.h <= right.y ||
    right.y + right.h <= left.y
  )
}

export function placeLayout(widgets, proposedLayout, ignoreWidgetId = null) {
  const layout = { ...proposedLayout }
  layout.w = Math.max(3, Math.min(GRID_COLUMNS, layout.w || 4))
  layout.h = Math.max(3, Math.min(10, layout.h || 4))
  layout.x = Math.max(0, Math.min(GRID_COLUMNS - layout.w, layout.x || 0))
  layout.y = Math.max(0, layout.y || 0)

  while (
    widgets.some((widget) => widget.id !== ignoreWidgetId && collides(layout, widget.layout))
  ) {
    layout.y += 1
  }

  return layout
}

export function nextOpenLayout(widgets, defaultSize = { w: 6, h: 4 }) {
  for (let row = 0; row < 50; row += 1) {
    for (let column = 0; column <= GRID_COLUMNS - defaultSize.w; column += 1) {
      const candidate = { x: column, y: row, w: defaultSize.w, h: defaultSize.h }
      if (!widgets.some((widget) => collides(candidate, widget.layout))) {
        return candidate
      }
    }
  }

  return {
    x: 0,
    y: widgets.reduce((max, widget) => Math.max(max, widget.layout.y + widget.layout.h), 0),
    ...defaultSize,
  }
}

export function fieldOptionsForSlot(slotKey, metadata) {
  const slot = FIELD_SLOT_DEFINITIONS[slotKey]
  if (!slot) return []
  const columnMeta = metadata?.column_meta || []
  return columnMeta
    .filter((column) => slot.accepts.includes(column.kind))
    .map((column) => column.column)
}

export function selectedColumnsFromMapping(mapping = {}) {
  const values = [
    mapping.x_axis,
    mapping.y_axis,
    mapping.legend,
    mapping.size,
    mapping.color,
    mapping.details,
    ...(mapping.secondary_values || []),
    mapping.location,
    mapping.latitude,
    mapping.longitude,
    mapping.target,
    ...(mapping.values || []),
    ...(mapping.tooltip || []),
    ...(mapping.rows || []),
    ...(mapping.columns || []),
  ].filter(Boolean)
  return Array.from(new Set(values.map((value) => String(value))))
}

export function stringifyCsv(dataset) {
  const columns = dataset?.columns || []
  const rows = dataset?.rows || []
  const escape = (value) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\n')
}
