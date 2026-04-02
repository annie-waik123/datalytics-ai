import { memo } from 'react'
import PlotFigure from '../PlotFigure.jsx'
import { chartDefinition } from '../../utils/dashboardBuilder.js'

function activeFilterKey(activeFilter) {
  if (!activeFilter) return ''
  return `${activeFilter.sourceWidgetId || ''}:${activeFilter.column || ''}:${String(activeFilter.value ?? '')}`
}

function WindowControlIcon({ type }) {
  if (type === 'close') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'minimize') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 12h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 16h8V8M16 8l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DashboardWidgetCard({
  widget,
  themeMode,
  selected,
  activeFilter,
  deferHeavyRendering,
  interactionMode,
  onSelect,
  onStartMove,
  onStartResize,
  onRemove,
  onToggleMinimize,
  onToggleExpand,
  onClearDrill,
  onPointClick,
  onChartReady,
  onDuplicate,
  onRefresh,
  onExportImage,
}) {
  const definition = chartDefinition(widget.chartType)
  const isResizePreview = interactionMode === 'resize'
  const isMinimized = widget.viewMode === 'minimized'
  const isExpanded = widget.viewMode === 'expanded'

  return (
    <article
      className={`builder-widget-card ${selected ? 'is-selected' : ''} ${themeMode === 'light' ? 'is-light' : 'is-dark'} ${isMinimized ? 'is-minimized' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      onClick={() => onSelect(widget.id)}
    >
      <header className="builder-widget-header">
        <div className="builder-widget-header-main">
          <button
            type="button"
            className="builder-widget-handle"
            onPointerDown={(event) => onStartMove(event, widget.id)}
            title="Drag to move"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="builder-widget-heading">
            <div className="builder-widget-title-row">
              <h4 title={widget.title || definition.label}>{widget.title || definition.label}</h4>
              <span className="builder-widget-type">{definition.label}</span>
            </div>
            <div className="builder-widget-meta">
              {widget.warning ? <span className="builder-widget-pill is-warning">{widget.warning}</span> : null}
              {widget.note ? <span className="builder-widget-pill is-neutral">{widget.note}</span> : null}
              {activeFilter?.sourceWidgetId === widget.id ? (
                <span className="builder-widget-pill is-accent">
                  Filtering by {activeFilter.column}: {String(activeFilter.value)}
                </span>
              ) : null}
              {widget.drill?.value ? (
                <button
                  type="button"
                  className="builder-widget-pill is-drill"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClearDrill(widget.id)
                  }}
                >
                  Drill: {widget.drill.column} = {String(widget.drill.value)} x
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="builder-widget-window-controls">
          <button
            type="button"
            className="builder-widget-window-button is-close"
            onClick={(event) => {
              event.stopPropagation()
              onRemove(widget.id)
            }}
            title="Close widget"
            aria-label="Close widget"
          >
            <WindowControlIcon type="close" />
          </button>
          <button
            type="button"
            className={`builder-widget-window-button is-minimize ${isMinimized ? 'is-active' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggleMinimize(widget.id)
            }}
            title={isMinimized ? 'Restore widget' : 'Minimize widget'}
            aria-label={isMinimized ? 'Restore widget' : 'Minimize widget'}
          >
            <WindowControlIcon type="minimize" />
          </button>
          <button
            type="button"
            className={`builder-widget-window-button is-expand ${isExpanded ? 'is-active' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggleExpand(widget.id)
            }}
            title={isExpanded ? 'Restore size' : 'Expand widget'}
            aria-label={isExpanded ? 'Restore size' : 'Expand widget'}
          >
            <WindowControlIcon type="expand" />
          </button>
        </div>
      </header>

      <div className={`builder-widget-body ${isResizePreview ? 'is-resize-preview' : ''}`}>
        {isMinimized ? (
          <div className="builder-widget-minimized">
            <strong>{definition.label}</strong>
            <span>{widget.insight || 'Click the green button to reopen this visual.'}</span>
          </div>
        ) : isResizePreview ? (
          <div className="builder-widget-resize-preview">
            <div className="builder-widget-resize-preview-grid" aria-hidden="true" />
            <div className="builder-widget-resize-preview-copy">
              <strong>Resizing visual</strong>
              <span>Release to apply the new chart size.</span>
            </div>
          </div>
        ) : widget.figure && !deferHeavyRendering ? (
          <PlotFigure
            figure={widget.figure}
            className="builder-widget-plot"
            themeMode={themeMode}
            onPointClick={(event) => onPointClick(widget, event)}
            onReady={(target) => onChartReady(widget.id, target)}
          />
        ) : widget.figure ? (
          <div className="builder-widget-skeleton">
            <div className="builder-widget-skeleton-copy">
              <span className="builder-widget-skeleton-bar" />
              <span className="builder-widget-skeleton-bar is-short" />
              <small>Chart rendering resumes when this widget scrolls into view.</small>
            </div>
          </div>
        ) : (
          <div className="builder-widget-empty">
            <strong>No data available</strong>
            <span>The widget will render automatically once fields are resolved.</span>
          </div>
        )}

        {widget.loading ? (
          <div className="builder-widget-loading">
            <span className="builder-spinner" />
            <span>Updating visual...</span>
          </div>
        ) : null}
      </div>

      <footer className="builder-widget-footer">
        <p>{widget.insight || 'AI insight will appear here after the chart renders.'}</p>
        <div className="builder-widget-footer-actions">
          <button
            type="button"
            className="builder-inline-button"
            onClick={(event) => {
              event.stopPropagation()
              onDuplicate(widget.id)
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="builder-inline-button"
            onClick={(event) => {
              event.stopPropagation()
              onRefresh(widget.id)
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            className="builder-inline-button"
            onClick={(event) => {
              event.stopPropagation()
              onExportImage(widget.id)
            }}
          >
            Export PNG
          </button>
        </div>
      </footer>

      {!isMinimized ? (
        <button
          type="button"
          className="builder-widget-resizer"
          onPointerDown={(event) => onStartResize(event, widget.id)}
          title="Drag to resize"
        >
          <span />
          <span />
        </button>
      ) : null}
    </article>
  )
}

function areEqual(previous, next) {
  return (
    previous.widget === next.widget &&
    previous.themeMode === next.themeMode &&
    previous.selected === next.selected &&
    previous.deferHeavyRendering === next.deferHeavyRendering &&
    previous.interactionMode === next.interactionMode &&
    activeFilterKey(previous.activeFilter) === activeFilterKey(next.activeFilter)
  )
}

export default memo(DashboardWidgetCard, areEqual)
