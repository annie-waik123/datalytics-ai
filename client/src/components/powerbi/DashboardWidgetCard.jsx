import { memo, useState, useRef, useEffect } from 'react'
import PlotFigure from '../PlotFigure.jsx'
import { chartDefinition } from '../../utils/dashboardBuilder.js'

function activeFilterKey(activeFilter) {
  if (!activeFilter) return ''
  return `${activeFilter.sourceWidgetId || ''}:${activeFilter.column || ''}:${String(activeFilter.value ?? '')}`
}

function WindowControlIcon({ type }) {
  if (type === 'close') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
        <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'refresh') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
        <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  const [showOptions, setShowOptions] = useState(false)
  const optionsRef = useRef(null)
  const definition = chartDefinition(widget.chartType)
  const isResizePreview = interactionMode === 'resize'
  const isMinimized = widget.viewMode === 'minimized'
  const isExpanded = widget.viewMode === 'expanded'
  const isLocked = widget.settings?.locked === true

  useEffect(() => {
    function handleClickOutside(event) {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) {
        setShowOptions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <article
      className={`builder-widget-card ${selected ? 'is-selected' : ''} ${themeMode === 'light' ? 'is-light' : 'is-dark'} ${isMinimized ? 'is-minimized' : ''} ${isExpanded ? 'is-expanded' : ''} ${isLocked ? 'is-locked' : ''}`}
      onClick={() => onSelect(widget.id)}
    >
      <header className="builder-widget-header">
        <div className="builder-widget-header-main">
          {!isLocked && (
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
          )}

          <div className="builder-widget-heading">
            <div className="builder-widget-title-row">
              <h4 title={widget.title || definition.label}>{widget.title || definition.label}</h4>
              <span className="builder-widget-type">{definition.label}</span>
            </div>
          </div>
        </div>

        <div className="builder-widget-window-controls">
          <div className="builder-widget-more-options" ref={optionsRef}>
            <button
              type="button"
              className="builder-widget-more-trigger"
              onClick={(e) => {
                e.stopPropagation()
                setShowOptions(!showOptions)
              }}
              title="More options"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {showOptions && (
              <div className="builder-widget-more-menu" onClick={(e) => e.stopPropagation()}>
                <button className="builder-widget-more-item" onClick={() => { onDuplicate(widget.id); setShowOptions(false); }}>
                  Duplicate Visual
                </button>
                <button className="builder-widget-more-item" onClick={() => { onRefresh(widget.id); setShowOptions(false); }}>
                  Refresh Data
                </button>
                <button className="builder-widget-more-item" onClick={() => { onExportImage(widget.id); setShowOptions(false); }}>
                  Export as PNG
                </button>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                <button className="builder-widget-more-item is-danger" onClick={() => { onRemove(widget.id); setShowOptions(false); }}>
                  Delete Visual
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="builder-widget-window-button is-expand"
            onClick={(event) => {
              event.stopPropagation()
              onRefresh(widget.id)
            }}
            title="Refresh Data"
          >
            <WindowControlIcon type="refresh" />
          </button>
          <button
            type="button"
            className="builder-widget-window-button is-close"
            onClick={(event) => {
              event.stopPropagation()
              onRemove(widget.id)
            }}
            title="Delete Visual"
          >
            <WindowControlIcon type="close" />
          </button>
        </div>
      </header>

      <div className={`builder-widget-body ${isResizePreview ? 'is-resize-preview' : ''}`}>
        {isMinimized ? (
          <div className="builder-widget-minimized">
            <strong>{definition.label}</strong>
            <span>Visual is minimized. Restore to view insights.</span>
          </div>
        ) : isResizePreview ? (
          <div className="builder-widget-resize-preview">
            <div className="builder-widget-resize-preview-grid" aria-hidden="true" />
          </div>
        ) : widget.chartType === 'text_box' ? (
          <div className="builder-widget-text-box" style={{ padding: '1rem', overflowY: 'auto', height: '100%', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary, #f8fafc)' }}>
            {widget.insight?.split('\n').map((line, idx) => {
              if (!line.trim()) return <br key={idx} />
              // Basic bold markdown support just in case
              const parts = line.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={i} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>;
                }
                return part;
              });
              return <div key={idx} style={{ marginBottom: '0.5rem' }}>{parts}</div>
            }) || 'Empty Text Box'}
          </div>
        ) : widget.figure && !deferHeavyRendering ? (
          (() => {
            // Patch the figure layout dynamically based on client-side settings
            const settings = widget.settings || {}
            const patchedFigure = {
              ...widget.figure,
              layout: {
                ...(widget.figure.layout || {}),
              }
            }
            
            // Apply Legend Toggle
            if (settings.showLegend === false) {
              patchedFigure.layout.showlegend = false
            } else if (settings.showLegend === true) {
              patchedFigure.layout.showlegend = true
            }

            // Apply Tooltip Toggle
            if (settings.showTooltip === false) {
              patchedFigure.layout.hovermode = false
            } else if (settings.showTooltip === true) {
              patchedFigure.layout.hovermode = 'closest'
            }

            // Apply Labels Toggle
            if (patchedFigure.data) {
              patchedFigure.data = patchedFigure.data.map(trace => {
                const updatedTrace = { ...trace }
                if (settings.showLabels === true) {
                  updatedTrace.textposition = updatedTrace.textposition && updatedTrace.textposition !== 'none' ? updatedTrace.textposition : 'auto'
                  if (updatedTrace.type === 'pie' || updatedTrace.type === 'funnel') {
                    updatedTrace.textinfo = 'label+value+percent'
                  } else if (updatedTrace.mode && updatedTrace.mode.includes('markers') && !updatedTrace.mode.includes('text')) {
                    updatedTrace.mode = updatedTrace.mode + '+text'
                  }
                } else if (settings.showLabels === false) {
                  updatedTrace.textposition = 'none'
                  updatedTrace.textinfo = 'none'
                  if (updatedTrace.mode && updatedTrace.mode.includes('text')) {
                    updatedTrace.mode = updatedTrace.mode.replace('+text', '').replace('text+', '')
                  }
                }
                return updatedTrace
              })
            }

            return (
              <PlotFigure
                figure={patchedFigure}
                className="builder-widget-plot"
                themeMode={themeMode}
                onPointClick={(event) => onPointClick(widget, event)}
                onReady={(target) => onChartReady(widget.id, target)}
              />
            )
          })()
        ) : (
          <div className="builder-widget-skeleton">
             <div className="builder-widget-skeleton-bar" />
             <div className="builder-widget-skeleton-bar is-short" />
          </div>
        )}

        {widget.loading ? (
          <div className="builder-widget-loading">
            <span className="builder-spinner" />
          </div>
        ) : null}
      </div>

      <footer className="builder-widget-footer" style={{ display: widget.chartType === 'text_box' ? 'none' : 'block' }}>
        <p>{widget.insight || 'AI insights will appear here...'}</p>
      </footer>

      {!isMinimized && !isLocked && (
        <button
          type="button"
          className="builder-widget-resizer"
          onPointerDown={(event) => onStartResize(event, widget.id)}
          title="Drag to resize"
        >
          <span />
          <span />
        </button>
      )}
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
