import { useMemo, useState } from 'react'
import { POWER_BI_CHARTS } from '../../utils/dashboardBuilder.js'

const PANEL_OPTIONS = [
  { id: 'charts', label: 'Charts', short: 'C' },
  { id: 'fields', label: 'Fields', short: 'F' },
  { id: 'filters', label: 'Filters', short: 'L' },
  { id: 'insights', label: 'AI Insights', short: 'AI' },
]

const INSIGHT_VISUALS = {
  trend: { chartId: 'combo_chart', label: 'Add Combo Chart' },
  correlation: { chartId: 'scatter_plot', label: 'Add Scatter Plot' },
  anomaly: { chartId: 'box_plot', label: 'Add Box Plot' },
  forecast: { chartId: 'line_chart', label: 'Add Forecast Line' },
  overview: { chartId: 'table', label: 'Add Data Table' },
}

function groupColumns(metadata) {
  const groups = {
    numeric: [],
    categorical: [],
    datetime: [],
  }

  for (const column of metadata?.column_meta || []) {
    if (!groups[column.kind]) continue
    groups[column.kind].push(column.column)
  }

  return groups
}

function ChartGlyph({ iconKey }) {
  switch (iconKey) {
    case 'bar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19V11M12 19V7M19 19V4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 19h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'stacked':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="13" width="4" height="6" rx="1.2" fill="currentColor" opacity="0.42" />
          <rect x="5" y="9" width="4" height="4" rx="1.2" fill="currentColor" />
          <rect x="10" y="11" width="4" height="8" rx="1.2" fill="currentColor" opacity="0.42" />
          <rect x="10" y="6" width="4" height="5" rx="1.2" fill="currentColor" />
          <rect x="15" y="15" width="4" height="4" rx="1.2" fill="currentColor" opacity="0.42" />
          <rect x="15" y="8" width="4" height="7" rx="1.2" fill="currentColor" />
        </svg>
      )
    case 'line':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 17l5-5 4 2 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="12" r="1.3" fill="currentColor" />
          <circle cx="13" cy="14" r="1.3" fill="currentColor" />
          <circle cx="20" cy="7" r="1.3" fill="currentColor" />
        </svg>
      )
    case 'area':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 18V16l5-5 4 2 7-7v12Z" fill="currentColor" opacity="0.28" />
          <path d="M4 16l5-5 4 2 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'combo':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="12" width="4" height="7" rx="1.2" fill="currentColor" opacity="0.42" />
          <rect x="10" y="9" width="4" height="10" rx="1.2" fill="currentColor" opacity="0.78" />
          <path d="M4 9.5 9 8l4 3 7-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'pie':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4a8 8 0 1 1-8 8h8Z" fill="currentColor" opacity="0.3" />
          <path d="M13 3a8 8 0 0 1 8 8h-8Z" fill="currentColor" />
        </svg>
      )
    case 'donut':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.28" />
          <path d="M12 5a7 7 0 0 1 6.06 3.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )
    case 'scatter':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="7" cy="15" r="2" fill="currentColor" />
          <circle cx="12" cy="9" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="18" cy="12" r="2" fill="currentColor" opacity="0.45" />
          <circle cx="16" cy="6" r="1.7" fill="currentColor" />
        </svg>
      )
    case 'bubble':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="15" r="2.3" fill="currentColor" />
          <circle cx="14" cy="8" r="3.2" fill="currentColor" opacity="0.7" />
          <circle cx="18" cy="15" r="1.7" fill="currentColor" opacity="0.42" />
        </svg>
      )
    case 'histogram':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="3" height="8" rx="1" fill="currentColor" opacity="0.5" />
          <rect x="10.5" y="8" width="3" height="11" rx="1" fill="currentColor" />
          <rect x="16" y="13" width="3" height="6" rx="1" fill="currentColor" opacity="0.7" />
        </svg>
      )
    case 'box':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v4m0 8v4M8 8h8v8H8Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'kpi':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 17a7 7 0 1 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 12l4-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      )
    case 'table':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 10h16M10 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'matrix':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="5" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.35" />
          <rect x="14" y="5" width="5" height="5" rx="1.2" fill="currentColor" />
          <rect x="5" y="14" width="5" height="5" rx="1.2" fill="currentColor" />
          <rect x="14" y="14" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.35" />
        </svg>
      )
    case 'funnel':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16l-6 6v5l-4 2v-7Z" fill="currentColor" opacity="0.82" />
        </svg>
      )
    case 'waterfall':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h4v4h4v4h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="5" y="7" width="4" height="10" rx="1.2" fill="currentColor" opacity="0.18" />
          <rect x="13" y="11" width="4" height="6" rx="1.2" fill="currentColor" />
        </svg>
      )
    case 'gauge':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 17a7 7 0 1 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 12l5 1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" />
        </svg>
      )
    case 'geo':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s5-4.7 5-9a5 5 0 1 0-10 0c0 4.3 5 9 5 9Z" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        </svg>
      )
    case 'heatmap':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="5" width="4" height="4" rx="1" fill="currentColor" opacity="0.2" />
          <rect x="10" y="5" width="4" height="4" rx="1" fill="currentColor" opacity="0.45" />
          <rect x="15" y="5" width="4" height="4" rx="1" fill="currentColor" opacity="0.8" />
          <rect x="5" y="10" width="4" height="4" rx="1" fill="currentColor" opacity="0.45" />
          <rect x="10" y="10" width="4" height="4" rx="1" fill="currentColor" opacity="0.8" />
          <rect x="15" y="10" width="4" height="4" rx="1" fill="currentColor" opacity="0.3" />
          <rect x="5" y="15" width="4" height="4" rx="1" fill="currentColor" opacity="0.8" />
          <rect x="10" y="15" width="4" height="4" rx="1" fill="currentColor" opacity="0.3" />
          <rect x="15" y="15" width="4" height="4" rx="1" fill="currentColor" opacity="0.55" />
        </svg>
      )
    case 'ribbon':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 16c2-4 4-4 6-2s4 2 6-2 4-4 4-4v10H4Z" fill="currentColor" opacity="0.34" />
          <path d="M4 15c2-4 4-4 6-2s4 2 6-2 4-4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'treemap':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="5" width="8" height="6" rx="1.2" fill="currentColor" opacity="0.42" />
          <rect x="14" y="5" width="5" height="14" rx="1.2" fill="currentColor" />
          <rect x="5" y="12" width="8" height="7" rx="1.2" fill="currentColor" opacity="0.75" />
        </svg>
      )
    case 'tree':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="6" r="2" fill="currentColor" />
          <circle cx="7" cy="13" r="2" fill="currentColor" opacity="0.72" />
          <circle cx="17" cy="13" r="2" fill="currentColor" opacity="0.72" />
          <circle cx="12" cy="19" r="2" fill="currentColor" opacity="0.5" />
          <path d="M12 8v3M12 11H7m5 0h5M12 15v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
  }
}

function ColumnGroup({ kind, columns }) {
  function handleDragStart(event, column) {
    event.dataTransfer.setData('application/x-dashboard-field', column)
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="builder-column-group">
      <div className="builder-column-group-header">
        <strong>{kind}</strong>
        <span>{columns.length}</span>
      </div>
      <div className="builder-column-chip-grid">
        {columns.map((column) => (
          <button
            key={`${kind}-${column}`}
            type="button"
            className="builder-column-pill"
            draggable
            onDragStart={(event) => handleDragStart(event, column)}
            title="Drag into a field slot"
          >
            {column}
          </button>
        ))}
        {!columns.length ? <span className="builder-slot-placeholder">No {kind} fields detected.</span> : null}
      </div>
    </div>
  )
}

function ChartsPanel({ metadata, intelligence, collapsed, onAddChart }) {
  const supportMap = new Map((metadata?.chart_catalog || []).map((chart) => [chart.id, chart]))
  const starters = (metadata?.starter_widgets || []).slice(0, 4)

  function handleDragStart(event, chartId) {
    event.dataTransfer.setData('application/x-dashboard-chart', chartId)
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="builder-sidepanel-content">
      {!collapsed && starters.length ? (
        <div className="builder-sidepanel-block">
          <div className="builder-sidepanel-section-header">
            <strong>Quick Start</strong>
            <span>AI-picked visuals</span>
          </div>
          <div className="builder-quick-actions">
            {starters.map((starter) => (
              <button
                key={`${starter.chart_type}-${starter.title}`}
                type="button"
                className="builder-quick-action"
                onClick={() => onAddChart(starter.chart_type)}
              >
                <strong>{starter.title}</strong>
                <span>{POWER_BI_CHARTS.find((chart) => chart.id === starter.chart_type)?.label || starter.chart_type}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!collapsed && intelligence?.narrative ? (
        <div className="builder-sidepanel-block builder-ai-summary">
          <div className="builder-sidepanel-section-header">
            <strong>Dataset Brief</strong>
            <span>{intelligence.rowsProfiled.toLocaleString()} profiled rows</span>
          </div>
          <p>{intelligence.narrative}</p>
        </div>
      ) : null}

      <div className="builder-chart-library">
        {POWER_BI_CHARTS.map((chart) => {
          const support = supportMap.get(chart.id)
          const disabled = support && support.enabled === false
          return (
            <button
              key={chart.id}
              type="button"
              className={`builder-chart-tile ${disabled ? 'is-disabled' : ''} is-${chart.accent}`}
              draggable={!disabled}
              onDragStart={(event) => handleDragStart(event, chart.id)}
              onClick={() => !disabled && onAddChart(chart.id)}
              disabled={disabled}
              title={disabled ? support?.reason : `${chart.label}: ${chart.description}`}
            >
              <span className={`builder-chart-icon is-${chart.accent}`}>
                <ChartGlyph iconKey={chart.iconKey} />
              </span>
              {!collapsed ? (
                <span className="builder-chart-copy">
                  <strong>{chart.label}</strong>
                  <small>{chart.description}</small>
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FieldsPanel({ metadata, selectedWidget, collapsed }) {
  const columnGroups = useMemo(() => groupColumns(metadata), [metadata])

  return (
    <div className="builder-sidepanel-content">
      {!collapsed ? (
        <div className="builder-sidepanel-block">
          <div className="builder-sidepanel-section-header">
            <strong>Field Inventory</strong>
            <span>{selectedWidget ? `Mapping ${selectedWidget.title}` : 'Drag into any field slot'}</span>
          </div>
        </div>
      ) : null}

      <div className="builder-column-groups">
        {Object.entries(columnGroups).map(([kind, columns]) => (
          <ColumnGroup key={kind} kind={kind} columns={columns} />
        ))}
      </div>
    </div>
  )
}

function FiltersPanel({ intelligence, globalFilters, collapsed, onApplyFilter, onClearFilter, onClearAllFilters }) {
  return (
    <div className="builder-sidepanel-content">
      {!collapsed && globalFilters?.length ? (
        <div className="builder-sidepanel-block">
          <div className="builder-sidepanel-section-header">
            <strong>Active Filters</strong>
            <button type="button" className="builder-inline-button" onClick={onClearAllFilters}>
              Clear all
            </button>
          </div>
          <div className="builder-filter-chip-row">
            {globalFilters.map((filter) => (
              <button
                key={`${filter.column}-${String(filter.value)}`}
                type="button"
                className="builder-filter-chip is-active"
                onClick={() => onClearFilter(filter.column)}
              >
                {filter.column}: {String(filter.value)} x
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {(intelligence?.filters || []).map((filter) => {
        const activeValue = globalFilters?.find((item) => item.column === filter.column)?.value
        return (
          <div key={filter.column} className="builder-sidepanel-block">
            <div className="builder-sidepanel-section-header">
              <strong>{filter.column}</strong>
              <span>{filter.uniqueCount} values</span>
            </div>
            <div className="builder-filter-chip-row">
              {filter.values.map((value) => {
                const active = String(activeValue ?? '') === String(value)
                return (
                  <button
                    key={`${filter.column}-${String(value)}`}
                    type="button"
                    className={`builder-filter-chip ${active ? 'is-active' : ''}`}
                    onClick={() => (active ? onClearFilter(filter.column) : onApplyFilter(filter.column, value))}
                  >
                    {String(value)}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {!intelligence?.filters?.length ? (
        <div className="builder-sidepanel-block">
          <p className="builder-sidepanel-empty">No compact categorical fields were detected for filter chips yet.</p>
        </div>
      ) : null}
    </div>
  )
}

function InsightsPanel({ intelligence, collapsed, onAddChart }) {
  const cards = intelligence?.insights || []

  return (
    <div className="builder-sidepanel-content">
      {cards.map((insight) => {
        const visual = INSIGHT_VISUALS[insight.type] || INSIGHT_VISUALS.overview
        return (
          <div key={insight.id} className={`builder-sidepanel-block builder-insight-card is-${insight.tone || 'neutral'}`}>
            <div className="builder-sidepanel-section-header">
              <strong>{insight.title}</strong>
              {!collapsed ? <span>{insight.type}</span> : null}
            </div>
            {!collapsed ? <p>{insight.body}</p> : null}
            <button type="button" className="builder-primary-button" onClick={() => onAddChart(visual.chartId)}>
              {visual.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardChartLibrary({
  metadata,
  intelligence,
  selectedWidget,
  globalFilters,
  collapsed,
  onAddChart,
  onApplyFilter,
  onClearFilter,
  onClearAllFilters,
  onToggleCollapsed,
}) {
  const [activePanel, setActivePanel] = useState('charts')

  return (
    <aside className={`builder-sidebar builder-sidebar-left ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="builder-panel-header">
        <div>
          <h3>{collapsed ? 'Builder' : 'Builder Panel'}</h3>
          {!collapsed ? <p>Switch between visuals, fields, filters, and AI-guided insight actions.</p> : null}
        </div>
        <button type="button" className="builder-panel-toggle" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand visuals panel' : 'Collapse visuals panel'}>
          {collapsed ? '>' : '<'}
        </button>
      </div>

      <div className="builder-panel-tabs" role="tablist" aria-label="Builder panel categories">
        {PANEL_OPTIONS.map((panel) => (
          <button
            key={panel.id}
            type="button"
            className={`builder-panel-tab ${activePanel === panel.id ? 'is-active' : ''}`}
            onClick={() => setActivePanel(panel.id)}
            title={panel.label}
          >
            <span>{collapsed ? panel.short : panel.label}</span>
          </button>
        ))}
      </div>

      {activePanel === 'charts' ? (
        <ChartsPanel metadata={metadata} intelligence={intelligence} collapsed={collapsed} onAddChart={onAddChart} />
      ) : null}

      {activePanel === 'fields' ? (
        <FieldsPanel metadata={metadata} selectedWidget={selectedWidget} collapsed={collapsed} />
      ) : null}

      {activePanel === 'filters' ? (
        <FiltersPanel
          intelligence={intelligence}
          globalFilters={globalFilters}
          collapsed={collapsed}
          onApplyFilter={onApplyFilter}
          onClearFilter={onClearFilter}
          onClearAllFilters={onClearAllFilters}
        />
      ) : null}

      {activePanel === 'insights' ? (
        <InsightsPanel intelligence={intelligence} collapsed={collapsed} onAddChart={onAddChart} />
      ) : null}
    </aside>
  )
}
