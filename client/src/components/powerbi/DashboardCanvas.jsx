import { memo, useEffect, useMemo, useRef, useState } from 'react'
import DashboardWidgetCard from './DashboardWidgetCard.jsx'
import { GRID_COLUMNS, GRID_ROW_HEIGHT, placeLayout } from '../../utils/dashboardBuilder.js'

function parsePixels(value) {
  const parsed = Number.parseFloat(value || '0')
  return Number.isFinite(parsed) ? parsed : 0
}

function layoutToStyle(layout) {
  return {
    gridColumn: `${layout.x + 1} / span ${layout.w}`,
    gridRow: `${layout.y + 1} / span ${layout.h}`,
  }
}

function measureCanvas(canvas) {
  const styles = window.getComputedStyle(canvas)
  const paddingLeft = parsePixels(styles.paddingLeft)
  const paddingRight = parsePixels(styles.paddingRight)
  const paddingTop = parsePixels(styles.paddingTop)
  const paddingBottom = parsePixels(styles.paddingBottom)
  const columnGap = parsePixels(styles.columnGap || styles.gap)
  const rowGap = parsePixels(styles.rowGap || styles.gap)
  const innerWidth = Math.max(0, canvas.clientWidth - paddingLeft - paddingRight)
  const cellWidth = Math.max(48, (innerWidth - columnGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS)

  return {
    paddingLeft,
    paddingTop,
    paddingBottom,
    columnGap,
    rowGap,
    cellWidth,
  }
}

function layoutToRect(layout, metrics) {
  return {
    left: metrics.paddingLeft + layout.x * (metrics.cellWidth + metrics.columnGap),
    top: metrics.paddingTop + layout.y * (GRID_ROW_HEIGHT + metrics.rowGap),
    width: layout.w * metrics.cellWidth + Math.max(0, layout.w - 1) * metrics.columnGap,
    height: layout.h * GRID_ROW_HEIGHT + Math.max(0, layout.h - 1) * metrics.rowGap,
  }
}

function visibleWindow(canvas) {
  const styles = window.getComputedStyle(canvas)
  const rowGap = parsePixels(styles.rowGap || styles.gap)
  const rowUnit = Math.max(1, GRID_ROW_HEIGHT + rowGap)
  const overscan = 6
  const start = Math.max(0, Math.floor(canvas.scrollTop / rowUnit) - overscan)
  const end = Math.ceil((canvas.scrollTop + canvas.clientHeight) / rowUnit) + overscan
  return { start, end }
}

function widgetIsWithinViewport(layout, range) {
  const top = layout.y
  const bottom = layout.y + layout.h
  return bottom >= range.start && top <= range.end
}

function DashboardCanvas({
  widgets,
  themeMode,
  selectedWidgetId,
  crossFilter,
  onSelectWidget,
  onAddChart,
  onCommitLayout,
  onRemoveWidget,
  onDuplicateWidget,
  onToggleWidgetMinimize,
  onToggleWidgetExpand,
  onRefreshWidget,
  onExportWidget,
  onClearDrill,
  onWidgetPointClick,
  onChartReady,
}) {
  const canvasRef = useRef(null)
  const widgetShellRefs = useRef({})
  const widgetsRef = useRef(widgets)
  const interactionRef = useRef(null)
  const pointerRef = useRef(null)
  const interactionFrameRef = useRef(0)
  const viewportFrameRef = useRef(0)

  const [interaction, setInteraction] = useState(null)
  const [isOverCanvas, setIsOverCanvas] = useState(false)
  const [viewportRange, setViewportRange] = useState({ start: 0, end: 18 })

  widgetsRef.current = widgets

  const maxRows = useMemo(
    () => Math.max(8, ...widgets.map((widget) => widget.layout.y + widget.layout.h)),
    [widgets]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof window === 'undefined') return undefined

    function flushViewportRange() {
      viewportFrameRef.current = 0
      const next = visibleWindow(canvas)
      setViewportRange((previous) => (
        previous.start === next.start && previous.end === next.end ? previous : next
      ))
    }

    function scheduleViewportRange() {
      if (viewportFrameRef.current) return
      viewportFrameRef.current = requestAnimationFrame(flushViewportRange)
    }

    scheduleViewportRange()
    canvas.addEventListener('scroll', scheduleViewportRange, { passive: true })
    window.addEventListener('resize', scheduleViewportRange)

    return () => {
      canvas.removeEventListener('scroll', scheduleViewportRange)
      window.removeEventListener('resize', scheduleViewportRange)
      if (viewportFrameRef.current) {
        cancelAnimationFrame(viewportFrameRef.current)
        viewportFrameRef.current = 0
      }
    }
  }, [widgets.length])

  function clearInteractionStyles() {
    const active = interactionRef.current
    if (!active) return

    const shell = widgetShellRefs.current[active.widgetId]
    if (shell) {
      shell.style.transform = ''
      shell.style.transformOrigin = ''
      shell.style.transition = ''
      shell.style.zIndex = ''
      shell.style.willChange = ''
      shell.style.pointerEvents = ''
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.minHeight = `${maxRows * GRID_ROW_HEIGHT}px`
    }
  }

  function flushInteractionFrame() {
    interactionFrameRef.current = 0
    const active = interactionRef.current
    const pointer = pointerRef.current
    const canvas = canvasRef.current

    if (!active || !pointer || !canvas) return

    const shell = widgetShellRefs.current[active.widgetId]
    if (!shell) return

    const metrics = measureCanvas(canvas)
    const dx = pointer.x - active.startPointer.x
    const dy = pointer.y - active.startPointer.y
    const deltaCols = Math.round(dx / Math.max(metrics.cellWidth + metrics.columnGap, 1))
    const deltaRows = Math.round(dy / Math.max(GRID_ROW_HEIGHT + metrics.rowGap, 1))

    const proposedLayout = active.mode === 'move'
      ? {
          ...active.startLayout,
          x: active.startLayout.x + deltaCols,
          y: active.startLayout.y + deltaRows,
        }
      : {
          ...active.startLayout,
          w: active.startLayout.w + deltaCols,
          h: active.startLayout.h + deltaRows,
        }

    const previewLayout = placeLayout(widgetsRef.current, proposedLayout, active.widgetId)
    const previewKey = `${previewLayout.x}:${previewLayout.y}:${previewLayout.w}:${previewLayout.h}`
    interactionRef.current = {
      ...active,
      previewLayout,
      previewKey,
    }

    const startRect = layoutToRect(active.startLayout, metrics)
    const previewRect = layoutToRect(previewLayout, metrics)
    const translateX = previewRect.left - startRect.left
    const translateY = previewRect.top - startRect.top
    const scaleX = previewRect.width / Math.max(startRect.width, 1)
    const scaleY = previewRect.height / Math.max(startRect.height, 1)
    const transformValue = active.mode === 'move'
      ? `translate3d(${translateX}px, ${translateY}px, 0)`
      : `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`
    const nextMinHeight = `${Math.max(maxRows, previewLayout.y + previewLayout.h) * GRID_ROW_HEIGHT}px`

    shell.style.transition = 'none'
    shell.style.transformOrigin = 'top left'
    shell.style.willChange = 'transform'
    shell.style.zIndex = '5'
    shell.style.pointerEvents = 'none'
    if (active.lastTransform !== transformValue) {
      shell.style.transform = transformValue
    }

    if (active.lastMinHeight !== nextMinHeight && canvas.style.minHeight !== nextMinHeight) {
      canvas.style.minHeight = nextMinHeight
    }

    interactionRef.current = {
      ...interactionRef.current,
      lastTransform: transformValue,
      lastMinHeight: nextMinHeight,
    }
  }

  function scheduleInteractionFrame() {
    if (interactionFrameRef.current) return
    interactionFrameRef.current = requestAnimationFrame(flushInteractionFrame)
  }

  function finishInteraction(commitLayout) {
    const active = interactionRef.current
    if (!active) return

    if (interactionFrameRef.current) {
      cancelAnimationFrame(interactionFrameRef.current)
      interactionFrameRef.current = 0
    }

    const nextLayout = active.previewLayout || active.startLayout
    clearInteractionStyles()
    interactionRef.current = null
    pointerRef.current = null
    setInteraction(null)

    if (commitLayout) {
      onCommitLayout(active.widgetId, nextLayout)
    }
  }

  useEffect(() => {
    if (!interaction) return undefined

    function handlePointerMove(event) {
      pointerRef.current = { x: event.clientX, y: event.clientY }
      scheduleInteractionFrame()
    }

    function handlePointerUp() {
      finishInteraction(true)
    }

    function handlePointerCancel() {
      finishInteraction(true)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [interaction, onCommitLayout])

  useEffect(() => () => {
    finishInteraction(false)
  }, [])

  function beginInteraction(event, widgetId, mode) {
    event.preventDefault()
    event.stopPropagation()
    const widget = widgetsRef.current.find((item) => item.id === widgetId)
    if (!widget) return

    pointerRef.current = { x: event.clientX, y: event.clientY }
    interactionRef.current = {
      mode,
      widgetId,
      startPointer: { x: event.clientX, y: event.clientY },
      startLayout: { ...widget.layout },
      previewLayout: { ...widget.layout },
    }
    setInteraction({ widgetId, mode })
    onSelectWidget(widgetId)
    scheduleInteractionFrame()
  }

  function resolveLayoutFromPointer(event, chartId) {
    const canvas = canvasRef.current
    if (!canvas) {
      onAddChart(chartId)
      return
    }

    const metrics = measureCanvas(canvas)
    const rect = canvas.getBoundingClientRect()
    const contentX = event.clientX - rect.left - metrics.paddingLeft
    const contentY = event.clientY - rect.top - metrics.paddingTop
    const x = Math.max(
      0,
      Math.min(
        GRID_COLUMNS - 3,
        Math.round(contentX / Math.max(metrics.cellWidth + metrics.columnGap, 1))
      )
    )
    const y = Math.max(0, Math.round(contentY / Math.max(GRID_ROW_HEIGHT + metrics.rowGap, 1)))
    onAddChart(chartId, { x, y })
  }

  return (
    <section className="builder-canvas-panel">
      <div className="builder-canvas-header">
        <div>
          <h2>Dashboard Canvas</h2>
          <p>Drag visuals, map fields, and click chart marks to cross-filter or drill deeper.</p>
        </div>
        <div className="builder-canvas-stats">
          <span>{widgets.length} visuals</span>
          <span>{crossFilter?.column ? `Active filter: ${crossFilter.column}` : 'No active filter'}</span>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={`builder-dashboard-canvas ${themeMode === 'light' ? 'is-light' : 'is-dark'} ${isOverCanvas ? 'is-over' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
          gridAutoRows: `${GRID_ROW_HEIGHT}px`,
          minHeight: `${maxRows * GRID_ROW_HEIGHT}px`,
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setIsOverCanvas(true)
        }}
        onDragLeave={() => setIsOverCanvas(false)}
        onDrop={(event) => {
          event.preventDefault()
          const chartId = event.dataTransfer.getData('application/x-dashboard-chart')
          setIsOverCanvas(false)
          if (chartId) resolveLayoutFromPointer(event, chartId)
        }}
      >
        {!widgets.length ? (
          <div className="builder-canvas-empty">
            <strong>Start with an AI-generated dashboard or drag a chart here.</strong>
            <span>The builder will suggest fields automatically based on your dataset.</span>
          </div>
        ) : null}

        {widgets.map((widget) => {
          const isInteracting = interaction?.widgetId === widget.id
          const renderHeavyContent = widgetIsWithinViewport(widget.layout, viewportRange) || selectedWidgetId === widget.id || isInteracting

          return (
            <div
              key={widget.id}
              ref={(node) => {
                if (node) {
                  widgetShellRefs.current[widget.id] = node
                } else {
                  delete widgetShellRefs.current[widget.id]
                }
              }}
              className={`builder-widget-shell ${selectedWidgetId === widget.id ? 'is-selected' : ''} ${isInteracting ? 'is-dragging is-interacting' : ''} ${isInteracting && interaction?.mode === 'resize' ? 'is-resizing' : ''}`}
              style={layoutToStyle(widget.layout)}
            >
              <DashboardWidgetCard
                widget={widget}
                themeMode={themeMode}
                selected={selectedWidgetId === widget.id}
                activeFilter={crossFilter}
                deferHeavyRendering={!renderHeavyContent}
                interactionMode={isInteracting ? interaction?.mode : null}
                onSelect={onSelectWidget}
                onStartMove={(event) => beginInteraction(event, widget.id, 'move')}
                onStartResize={(event) => beginInteraction(event, widget.id, 'resize')}
                onRemove={onRemoveWidget}
                onDuplicate={onDuplicateWidget}
                onToggleMinimize={onToggleWidgetMinimize}
                onToggleExpand={onToggleWidgetExpand}
                onRefresh={onRefreshWidget}
                onExportImage={onExportWidget}
                onClearDrill={onClearDrill}
                onPointClick={onWidgetPointClick}
                onChartReady={onChartReady}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function areEqual(previous, next) {
  return (
    previous.widgets === next.widgets &&
    previous.themeMode === next.themeMode &&
    previous.selectedWidgetId === next.selectedWidgetId &&
    (previous.crossFilter?.column || '') === (next.crossFilter?.column || '') &&
    String(previous.crossFilter?.value ?? '') === String(next.crossFilter?.value ?? '') &&
    (previous.crossFilter?.sourceWidgetId || '') === (next.crossFilter?.sourceWidgetId || '')
  )
}

export default memo(DashboardCanvas, areEqual)
