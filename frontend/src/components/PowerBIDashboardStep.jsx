import { useEffect, useMemo, useRef, useState } from 'react'
import Plotly from 'plotly.js-dist-min'
import { jsPDF } from 'jspdf'
import DashboardChartLibrary from './powerbi/DashboardChartLibrary.jsx'
import DashboardCanvas from './powerbi/DashboardCanvas.jsx'
import DashboardFieldPanel from './powerbi/DashboardFieldPanel.jsx'
import { useToast } from '../hooks/useToast.js'
import {
  fetchDashboardMetadata,
  loadDashboardDefinition,
  renderDashboardWidget,
  saveDashboardDefinition,
  suggestDashboardWidget,
  syncDashboardDataset,
} from '../api/dashboard.js'
import {
  BUILDER_STORAGE_KEY,
  buildPersistedDashboard,
  captureSnapshot,
  chartDefinition,
  createWidget,
  hydrateWidgets,
  nextOpenLayout,
  placeLayout,
  selectedColumnsFromMapping,
  stringifyCsv,
} from '../utils/dashboardBuilder.js'
import {
  buildAutomaticStarterWidgets,
  createDemoDashboardDataset,
  profileDashboardDataset,
} from '../utils/dashboardDemoEngine.js'
import { buildDashboardIntelligence } from '../utils/dashboardIntelligence.js'

const DEFAULT_BUILDER_STATE = {
  themeMode: 'dark',
  interactionMode: 'cross-filter',
  selectedWidgetId: null,
  crossFilter: null,
  globalFilters: [],
  widgets: [],
}

function normalizeBuilderState(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_BUILDER_STATE }
  }

  const widgets = hydrateWidgets(raw.widgets || [])
  return {
    themeMode: raw.themeMode || raw.theme || 'dark',
    interactionMode: raw.interactionMode || raw.interaction_mode || 'cross-filter',
    selectedWidgetId: raw.selectedWidgetId || raw.selected_widget_id || widgets[0]?.id || null,
    crossFilter: raw.crossFilter || raw.cross_filter || null,
    globalFilters: Array.isArray(raw.globalFilters || raw.global_filters) ? (raw.globalFilters || raw.global_filters) : [],
    widgets,
  }
}

function loadStoredDashboard(datasetName) {
  if (typeof window === 'undefined' || !datasetName) return null
  try {
    const raw = localStorage.getItem(`${BUILDER_STORAGE_KEY}:${datasetName}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistStoredDashboard(datasetName, dashboard) {
  if (typeof window === 'undefined' || !datasetName) return
  try {
    localStorage.setItem(`${BUILDER_STORAGE_KEY}:${datasetName}`, JSON.stringify(dashboard))
  } catch {
    // Ignore storage quota/browser storage failures and keep the in-memory state alive.
  }
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })
}

function extractPointValue(point) {
  if (!point) return null
  if (point.label !== undefined && point.label !== null) return point.label
  if (point.x !== undefined && point.x !== null && typeof point.x !== 'object') return point.x
  if (point.y !== undefined && point.y !== null && typeof point.y !== 'object') return point.y
  if (Array.isArray(point.customdata) && point.customdata.length) return point.customdata[0]
  return null
}

function timestampLabel(date) {
  if (!date) return 'Not saved yet'
  return `Saved ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function buildDatasetRenderSignature(dataset) {
  if (!dataset) return 'no-dataset'

  const rows = Array.isArray(dataset.rows) ? dataset.rows : []
  const columns = Array.isArray(dataset.columns) ? dataset.columns : []
  const sampleIndexes = Array.from(new Set([
    0,
    rows.length > 2 ? Math.floor(rows.length / 2) : -1,
    rows.length - 1,
  ].filter((index) => index >= 0 && index < rows.length)))

  return JSON.stringify({
    name: dataset.name || 'Dataset',
    rowCount: rows.length,
    columns,
    sample: sampleIndexes.map((index) => rows[index]),
  })
}

function resolveStarterBlueprints(metadata, profile) {
  const localStarters = buildAutomaticStarterWidgets(profile)
  if (!metadata?.starter_widgets?.length) {
    return localStarters
  }
  return metadata.starter_widgets.length >= Math.min(6, localStarters.length)
    ? metadata.starter_widgets
    : localStarters
}

export default function PowerBIDashboardStep({
  dataset,
  datasetProfile,
  savedCharts,
  dashboardState,
  incomingWidgetRequest,
  setDashboardState,
  onComplete,
  onJumpToUpload,
}) {
  const { addToast } = useToast()
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)
  const [settingsCollapsed, setSettingsCollapsed] = useState(false)
  const [builderState, setBuilderState] = useState(() => normalizeBuilderState(dashboardState))
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [initializing, setInitializing] = useState(true)
  const builderStateRef = useRef(builderState)
  const onCompleteRef = useRef(onComplete)
  const renderTimersRef = useRef({})
  const renderTokensRef = useRef({})
  const chartRefs = useRef({})
  const renderCacheRef = useRef(new Map())
  const handledRequestIdsRef = useRef(new Set())
  const demoSession = useMemo(() => {
    const demoDataset = createDemoDashboardDataset()
    return {
      dataset: demoDataset,
      profile: profileDashboardDataset(demoDataset),
    }
  }, [])
  const usingDemoDataset = !dataset?.rows?.length || !datasetProfile
  const activeDataset = usingDemoDataset ? demoSession.dataset : dataset
  const activeDatasetProfile = usingDemoDataset ? demoSession.profile : datasetProfile
  const builderDatasetProfile = useMemo(() => profileDashboardDataset(activeDataset), [activeDataset])
  const datasetRenderSignature = useMemo(() => buildDatasetRenderSignature(activeDataset), [activeDataset])
  const dashboardIntelligence = useMemo(
    () => buildDashboardIntelligence(activeDataset, activeDatasetProfile),
    [activeDataset, activeDatasetProfile]
  )

  useEffect(() => {
    builderStateRef.current = builderState
  }, [builderState])

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const persistedDashboard = useMemo(() => buildPersistedDashboard(builderState), [builderState])
  const persistedKey = useMemo(() => JSON.stringify(persistedDashboard), [persistedDashboard])
  const selectedWidget = useMemo(
    () => builderState.widgets.find((widget) => widget.id === builderState.selectedWidgetId) || null,
    [builderState.selectedWidgetId, builderState.widgets]
  )
  const leadingCorrelation = dashboardIntelligence.correlations?.[0] || null

  useEffect(() => {
    let cancelled = false

    async function initializeBuilder() {
      setLoading(true)
      setInitializing(true)
      setError('')

      try {
        const syncResponse = await syncDashboardDataset(activeDataset, builderDatasetProfile)
        const [dashboardMetadata, savedDashboardResponse] = await Promise.all([
          syncResponse?.metadata ? Promise.resolve(syncResponse.metadata) : fetchDashboardMetadata(),
          loadDashboardDefinition().catch(() => ({ dashboard: {} })),
        ])
        if (cancelled) return

        setMetadata(dashboardMetadata)

        const backendDashboard = savedDashboardResponse?.dashboard || {}
        const backendMatchesDataset = !backendDashboard.dataset_name || backendDashboard.dataset_name === activeDataset.name
        const storedDashboard = loadStoredDashboard(activeDataset.name)
        let nextState = { ...DEFAULT_BUILDER_STATE }

        const starterBlueprints = resolveStarterBlueprints(dashboardMetadata, builderDatasetProfile)

        if (backendMatchesDataset && Array.isArray(backendDashboard.widgets) && backendDashboard.widgets.length) {
          nextState = normalizeBuilderState(backendDashboard)
        } else if (storedDashboard?.widgets?.length) {
          nextState = normalizeBuilderState(storedDashboard)
        } else {
          const starterWidgets = []
          for (const starter of starterBlueprints) {
            const definition = chartDefinition(starter.chart_type)
            starterWidgets.push(
              createWidget(starter.chart_type, {
                title: starter.title,
                mapping: starter.mapping,
                layout: nextOpenLayout(starterWidgets, definition.defaultSize),
              })
            )
          }
          nextState = {
            ...DEFAULT_BUILDER_STATE,
            widgets: starterWidgets,
            selectedWidgetId: starterWidgets[0]?.id || null,
          }
        }

        builderStateRef.current = nextState
        setBuilderState(nextState)
        setUndoStack([])
        setRedoStack([])
        setLoading(false)
        setInitializing(false)
        onCompleteRef.current?.('powerbi')

        if (nextState.widgets.length) {
          await Promise.allSettled(nextState.widgets.map((widget) => renderWidget(widget.id, nextState)))
        }
      } catch (initError) {
        if (cancelled) return
        setLoading(false)
        setInitializing(false)
        setError(initError?.response?.data?.detail || initError?.message || 'Dashboard builder could not initialize.')
      }
    }

    initializeBuilder()

    return () => {
      cancelled = true
      Object.values(renderTimersRef.current).forEach((timer) => clearTimeout(timer))
    }
  }, [activeDataset, builderDatasetProfile, datasetRenderSignature])

  useEffect(() => {
    if (!activeDataset?.name) return
    persistStoredDashboard(activeDataset.name, persistedDashboard)
    setDashboardState(persistedDashboard)
  }, [activeDataset?.name, persistedDashboard, persistedKey, setDashboardState])

  useEffect(() => {
    renderCacheRef.current.clear()
    handledRequestIdsRef.current.clear()
  }, [datasetRenderSignature])

  useEffect(() => {
    if (initializing || !activeDataset?.name) return undefined

    const timer = setTimeout(async () => {
      try {
        setSaving(true)
        await saveDashboardDefinition({
          name: 'Auto Power BI Dashboard',
          dataset_name: activeDataset.name,
          theme: builderState.themeMode,
          interaction_mode: builderState.interactionMode,
          widgets: persistedDashboard.widgets,
          selected_widget_id: builderState.selectedWidgetId,
          cross_filter: builderState.crossFilter || {},
          global_filters: builderState.globalFilters || [],
        })
        setLastSavedAt(new Date())
      } catch (saveError) {
        addToast(saveError?.response?.data?.detail || 'Dashboard auto-save failed.', null, 'warning')
      } finally {
        setSaving(false)
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [
    addToast,
    builderState.crossFilter,
    builderState.globalFilters,
    builderState.interactionMode,
    builderState.selectedWidgetId,
    builderState.themeMode,
    activeDataset?.name,
    initializing,
    persistedDashboard.widgets,
    persistedKey,
  ])

  function commitState(update, options = {}) {
    const previous = builderStateRef.current
    const nextState = typeof update === 'function' ? update(previous) : update
    const previousSnapshot = JSON.stringify(buildPersistedDashboard(previous))
    const nextSnapshot = JSON.stringify(buildPersistedDashboard(nextState))

    if (previousSnapshot === nextSnapshot) return previous

    if (options.history !== false) {
      setUndoStack((stack) => [...stack.slice(-24), captureSnapshot(previous)])
      setRedoStack([])
    }

    builderStateRef.current = nextState
    setBuilderState(nextState)
    return nextState
  }

  function patchState(update) {
    setBuilderState((previous) => {
      const nextState = typeof update === 'function' ? update(previous) : update
      builderStateRef.current = nextState
      return nextState
    })
  }

  function widgetFilters(stateSnapshot, widgetId) {
    const filters = [...(stateSnapshot.globalFilters || []).map((filter) => ({
      column: filter.column,
      value: filter.value,
    }))]
    if (
      stateSnapshot.crossFilter?.column &&
      stateSnapshot.crossFilter?.value !== undefined &&
      stateSnapshot.crossFilter?.sourceWidgetId !== widgetId
    ) {
      const withoutMatchingColumn = filters.filter((filter) => filter.column !== stateSnapshot.crossFilter.column)
      withoutMatchingColumn.push({
        column: stateSnapshot.crossFilter.column,
        value: stateSnapshot.crossFilter.value,
      })
      return withoutMatchingColumn
    }
    return filters
  }

  function widgetRenderKey(widget, stateSnapshot) {
    return JSON.stringify({
      dataset: datasetRenderSignature,
      chartType: widget.chartType,
      mapping: widget.mapping,
      settings: widget.settings,
      filters: widgetFilters(stateSnapshot, widget.id),
      drillColumn: widget.drill?.column || null,
      drillValue: widget.drill?.value ?? null,
      theme: stateSnapshot.themeMode,
    })
  }

  async function renderWidget(widgetId, stateSnapshot = builderStateRef.current) {
    const widget = stateSnapshot.widgets.find((item) => item.id === widgetId)
    if (!widget) return

    const cacheKey = widgetRenderKey(widget, stateSnapshot)
    const cachedResponse = renderCacheRef.current.get(cacheKey)
    if (cachedResponse) {
      patchState((previous) => ({
        ...previous,
        widgets: previous.widgets.map((item) => (
          item.id === widgetId
            ? {
                ...item,
                chartType: cachedResponse.chart_type,
                title: cachedResponse.title,
                mapping: { ...item.mapping, ...(cachedResponse.resolved_mapping || {}) },
                figure: cachedResponse.figure,
                warning: cachedResponse.warning || '',
                note: cachedResponse.note || '',
                insight: cachedResponse.insight || '',
                interaction: cachedResponse.interaction || {},
                loading: false,
              }
            : item
        )),
      }))
      return
    }

    const token = `${Date.now()}-${Math.random()}`
    renderTokensRef.current[widgetId] = token

    patchState((previous) => ({
      ...previous,
      widgets: previous.widgets.map((item) => (
        item.id === widgetId
          ? { ...item, loading: true }
          : item
      )),
    }))

    try {
      const response = await renderDashboardWidget({
        widget_id: widget.id,
        chart_type: widget.chartType,
        mapping: widget.mapping,
        settings: widget.settings,
        filters: widgetFilters(stateSnapshot, widgetId),
        drill_column: widget.drill?.column || null,
        drill_value: widget.drill?.value ?? null,
        theme: stateSnapshot.themeMode,
      })

      if (renderTokensRef.current[widgetId] !== token) return
      renderCacheRef.current.set(cacheKey, response)
      if (renderCacheRef.current.size > 48) {
        const oldestKey = renderCacheRef.current.keys().next().value
        renderCacheRef.current.delete(oldestKey)
      }

      patchState((previous) => ({
        ...previous,
        widgets: previous.widgets.map((item) => (
          item.id === widgetId
            ? {
                ...item,
                chartType: response.chart_type,
                title: response.title,
                mapping: { ...item.mapping, ...(response.resolved_mapping || {}) },
                figure: response.figure,
                warning: response.warning || '',
                note: response.note || '',
                insight: response.insight || '',
                interaction: response.interaction || {},
                loading: false,
              }
            : item
        )),
      }))
    } catch (renderError) {
      if (renderTokensRef.current[widgetId] !== token) return
      patchState((previous) => ({
        ...previous,
        widgets: previous.widgets.map((item) => (
          item.id === widgetId
            ? {
                ...item,
                figure: null,
                warning: renderError?.response?.data?.detail || 'This visual could not render with the current mapping.',
                loading: false,
              }
            : item
        )),
      }))
    }
  }

  function scheduleRender(widgetId, delay = 220) {
    clearTimeout(renderTimersRef.current[widgetId])
    renderTimersRef.current[widgetId] = setTimeout(() => {
      renderWidget(widgetId)
    }, delay)
  }

  async function handleAddChart(chartType, preferredPlacement = null) {
    const previous = builderStateRef.current

    let suggestion
    try {
      suggestion = await suggestDashboardWidget({
        chart_type: chartType,
        theme: previous.themeMode,
      })
    } catch {
      suggestion = {
        chart_type: chartType,
        title: chartDefinition(chartType).label,
        mapping: {},
      }
    }

    const definition = chartDefinition(suggestion.chart_type || chartType)
    const layout = placeLayout(
      previous.widgets,
      preferredPlacement
        ? { ...preferredPlacement, ...definition.defaultSize }
        : nextOpenLayout(previous.widgets, definition.defaultSize)
    )

    const widget = createWidget(suggestion.chart_type || chartType, {
      title: suggestion.title,
      mapping: suggestion.mapping,
      layout,
      loading: true,
    })

    const nextState = commitState({
      ...previous,
      selectedWidgetId: widget.id,
      widgets: [...previous.widgets, widget],
    })

    onComplete('powerbi')
    await renderWidget(widget.id, nextState)
  }

  async function handleAddChartFromRequest(request) {
    if (!request) return
    const previous = builderStateRef.current
    const chartType = request.chart_type || 'auto'
    const suggestion = {
      chart_type: chartType,
      title: request.title || chartDefinition(chartType).label,
      mapping: request.mapping || {},
    }
    const definition = chartDefinition(suggestion.chart_type || chartType)
    const widget = createWidget(suggestion.chart_type || chartType, {
      title: suggestion.title,
      mapping: suggestion.mapping,
      layout: nextOpenLayout(previous.widgets, definition.defaultSize),
      loading: true,
    })

    const nextState = commitState({
      ...previous,
      selectedWidgetId: widget.id,
      widgets: [...previous.widgets, widget],
    })

    addToast(`${widget.title} added from the chatbot.`, null, 'success')
    onComplete('powerbi')
    await renderWidget(widget.id, nextState)
  }

  useEffect(() => {
    if (!incomingWidgetRequest?.requestId || initializing || loading || !activeDataset?.name) return
    if (handledRequestIdsRef.current.has(incomingWidgetRequest.requestId)) return

    handledRequestIdsRef.current.add(incomingWidgetRequest.requestId)
    handleAddChartFromRequest(incomingWidgetRequest)
  }, [activeDataset?.name, incomingWidgetRequest, initializing, loading])

  async function generateAutomaticDashboard() {
    if (!metadata) return

    const starterBlueprints = resolveStarterBlueprints(metadata, builderDatasetProfile)
    const widgets = []
    for (const starter of starterBlueprints) {
      const definition = chartDefinition(starter.chart_type)
      widgets.push(
        createWidget(starter.chart_type, {
          title: starter.title,
          mapping: starter.mapping,
          layout: nextOpenLayout(widgets, definition.defaultSize),
          loading: true,
        })
      )
    }

    const nextState = commitState({
      ...builderStateRef.current,
      crossFilter: null,
      widgets,
      selectedWidgetId: widgets[0]?.id || null,
    })

    await Promise.allSettled(widgets.map((widget) => renderWidget(widget.id, nextState)))
  }

  function widgetViewTransition(widget, targetMode, allWidgets) {
    const originalLayout = widget.storedLayout || widget.layout

    if (widget.viewMode === targetMode) {
      return {
        ...widget,
        viewMode: 'default',
        storedLayout: null,
        layout: placeLayout(allWidgets, originalLayout, widget.id),
      }
    }

    if (targetMode === 'minimized') {
      return {
        ...widget,
        viewMode: 'minimized',
        storedLayout: widget.viewMode === 'default' ? widget.layout : originalLayout,
        layout: placeLayout(allWidgets, {
          ...widget.layout,
          w: Math.max(4, Math.min(widget.layout.w, 5)),
          h: 3,
        }, widget.id),
      }
    }

    return {
      ...widget,
      viewMode: 'expanded',
      storedLayout: widget.viewMode === 'default' ? widget.layout : originalLayout,
      layout: placeLayout(allWidgets, {
        x: 0,
        y: widget.layout.y,
        w: 12,
        h: Math.max(widget.layout.h, 6),
      }, widget.id),
    }
  }

  function handleToggleWidgetMinimize(widgetId) {
    commitState((previous) => ({
      ...previous,
      selectedWidgetId: widgetId,
      widgets: previous.widgets.map((widget) => (
        widget.id === widgetId
          ? widgetViewTransition(widget, 'minimized', previous.widgets)
          : widget
      )),
    }))
  }

  function handleToggleWidgetExpand(widgetId) {
    commitState((previous) => ({
      ...previous,
      selectedWidgetId: widgetId,
      widgets: previous.widgets.map((widget) => (
        widget.id === widgetId
          ? widgetViewTransition(widget, 'expanded', previous.widgets)
          : widget
      )),
    }))
  }

  function handleLayoutCommit(widgetId, layout) {
    commitState((previous) => ({
      ...previous,
      widgets: previous.widgets.map((widget) => (
        widget.id === widgetId
          ? { ...widget, layout }
          : widget
      )),
    }))
  }

  function handleSelectWidget(widgetId) {
    patchState((previous) => ({
      ...previous,
      selectedWidgetId: widgetId,
    }))
  }

  function handleRemoveWidget(widgetId) {
    const remaining = builderStateRef.current.widgets.filter((widget) => widget.id !== widgetId)
    commitState({
      ...builderStateRef.current,
      widgets: remaining,
      selectedWidgetId: remaining[0]?.id || null,
      crossFilter: builderStateRef.current.crossFilter?.sourceWidgetId === widgetId
        ? null
        : builderStateRef.current.crossFilter,
    })
  }

  async function handleDuplicateWidget(widgetId) {
    const widget = builderStateRef.current.widgets.find((item) => item.id === widgetId)
    if (!widget) return

    const definition = chartDefinition(widget.chartType)
    const duplicate = createWidget(widget.chartType, {
      title: `${widget.title} Copy`,
      mapping: widget.mapping,
      layout: placeLayout(
        builderStateRef.current.widgets,
        {
          x: widget.layout.x + 1,
          y: widget.layout.y + 1,
          w: definition.defaultSize.w,
          h: definition.defaultSize.h,
        }
      ),
      drill: widget.drill,
      loading: true,
    })

    const nextState = commitState({
      ...builderStateRef.current,
      selectedWidgetId: duplicate.id,
      widgets: [...builderStateRef.current.widgets, duplicate],
    })

    await renderWidget(duplicate.id, nextState)
  }

  function updateSelectedWidget(transform, options = {}) {
    const selectedId = builderStateRef.current.selectedWidgetId
    if (!selectedId) return null
    return commitState((previous) => ({
      ...previous,
      widgets: previous.widgets.map((widget) => (
        widget.id === selectedId ? transform(widget) : widget
      )),
    }), options)
  }

  async function handleChangeChartType(chartType) {
    if (!selectedWidget) return

    let suggestion
    try {
      suggestion = await suggestDashboardWidget({
        chart_type: chartType,
        selected_columns: selectedColumnsFromMapping(selectedWidget.mapping),
        theme: builderStateRef.current.themeMode,
      })
    } catch {
      suggestion = {
        chart_type: chartType,
        title: chartDefinition(chartType).label,
        mapping: selectedWidget.mapping,
      }
    }

    const nextState = updateSelectedWidget((widget) => ({
      ...widget,
      chartType: suggestion.chart_type || chartType,
      title: suggestion.title || widget.title,
      mapping: { ...widget.mapping, ...(suggestion.mapping || {}) },
      drill: null,
    }))

    if (nextState) {
      await renderWidget(selectedWidget.id, nextState)
    }
  }

  function handleAssignField(slotKey, value) {
    if (!selectedWidget) return
    updateSelectedWidget((widget) => ({
      ...widget,
      drill: slotKey === 'details' ? null : widget.drill,
      mapping: {
        ...widget.mapping,
        [slotKey]: value,
        ...(slotKey === 'y_axis' && chartDefinition(widget.chartType).slots.includes('values')
          ? { values: value ? [value] : [] }
          : {}),
      },
    }))
    scheduleRender(selectedWidget.id)
  }

  function handleAppendField(slotKey, value) {
    if (!selectedWidget || !value) return
    updateSelectedWidget((widget) => ({
      ...widget,
      mapping: {
        ...widget.mapping,
        [slotKey]: Array.from(new Set([...(widget.mapping?.[slotKey] || []), value])),
      },
    }))
    scheduleRender(selectedWidget.id)
  }

  function handleRemoveField(slotKey, value) {
    if (!selectedWidget) return
    updateSelectedWidget((widget) => ({
      ...widget,
      mapping: {
        ...widget.mapping,
        [slotKey]: (widget.mapping?.[slotKey] || []).filter((item) => item !== value),
      },
    }))
    scheduleRender(selectedWidget.id)
  }

  function handleChangeAggregation(value) {
    if (!selectedWidget) return
    updateSelectedWidget((widget) => ({
      ...widget,
      mapping: {
        ...widget.mapping,
        aggregation: value,
      },
    }))
    scheduleRender(selectedWidget.id)
  }

  function handleChangeTitle(value) {
    if (!selectedWidget) return
    updateSelectedWidget((widget) => ({
      ...widget,
      title: value,
      mapping: {
        ...widget.mapping,
        title: value,
      },
    }), { history: false })
  }

  function handleUpdateWidgetSettings(patch) {
    if (!selectedWidget) return
    updateSelectedWidget((widget) => ({
      ...widget,
      settings: {
        ...(widget.settings || {}),
        ...patch,
      },
    }))
    scheduleRender(selectedWidget.id, 120)
  }

  async function handleSuggestFields() {
    if (!selectedWidget) return
    try {
      const suggestion = await suggestDashboardWidget({
        chart_type: selectedWidget.chartType,
        selected_columns: selectedColumnsFromMapping(selectedWidget.mapping),
        theme: builderStateRef.current.themeMode,
      })

      const nextState = updateSelectedWidget((widget) => ({
        ...widget,
        title: suggestion.title || widget.title,
        mapping: { ...widget.mapping, ...(suggestion.mapping || {}) },
      }))

      if (nextState) {
        await renderWidget(selectedWidget.id, nextState)
      }
    } catch (suggestError) {
      addToast(suggestError?.response?.data?.detail || 'AI suggestion failed for this visual.', null, 'warning')
    }
  }

  async function rerenderAll(stateSnapshot = builderStateRef.current) {
    await Promise.allSettled(stateSnapshot.widgets.map((widget) => renderWidget(widget.id, stateSnapshot)))
  }

  async function handleSetGlobalFilter(column, value) {
    const nextState = {
      ...builderStateRef.current,
      globalFilters: [
        ...(builderStateRef.current.globalFilters || []).filter((filter) => filter.column !== column),
        { column, value },
      ],
    }
    builderStateRef.current = nextState
    setBuilderState(nextState)
    await rerenderAll(nextState)
  }

  async function handleRemoveGlobalFilter(column) {
    const nextState = {
      ...builderStateRef.current,
      globalFilters: (builderStateRef.current.globalFilters || []).filter((filter) => filter.column !== column),
    }
    builderStateRef.current = nextState
    setBuilderState(nextState)
    await rerenderAll(nextState)
  }

  async function handleClearGlobalFilters() {
    if (!builderStateRef.current.globalFilters?.length) return
    const nextState = {
      ...builderStateRef.current,
      globalFilters: [],
    }
    builderStateRef.current = nextState
    setBuilderState(nextState)
    await rerenderAll(nextState)
  }

  async function handleWidgetPointClick(widget, event) {
    const point = event?.points?.[0]
    const clickedValue = extractPointValue(point)
    const filterColumn = widget.interaction?.filter_column

    if (clickedValue === null || clickedValue === undefined) {
      addToast('This chart mark does not expose a filterable value yet.', null, 'warning')
      return
    }

    if (builderStateRef.current.interactionMode === 'drill-down') {
      if (!filterColumn || !widget.interaction?.drill_column) {
        addToast('Add a Details field to unlock drill-down for this visual.', null, 'warning')
        return
      }

      const nextState = {
        ...builderStateRef.current,
        selectedWidgetId: widget.id,
        widgets: builderStateRef.current.widgets.map((item) => (
          item.id === widget.id
            ? { ...item, drill: { column: filterColumn, value: clickedValue } }
            : item
        )),
      }
      builderStateRef.current = nextState
      setBuilderState(nextState)
      await renderWidget(widget.id, nextState)
      return
    }

    if (!filterColumn) {
      addToast('This visual cannot drive cross-filters right now.', null, 'warning')
      return
    }

    const nextState = {
      ...builderStateRef.current,
      crossFilter: {
        sourceWidgetId: widget.id,
        column: filterColumn,
        value: clickedValue,
      },
    }
    builderStateRef.current = nextState
    setBuilderState(nextState)
    await rerenderAll(nextState)
  }

  async function handleClearFilter() {
    const nextState = {
      ...builderStateRef.current,
      crossFilter: null,
    }
    builderStateRef.current = nextState
    setBuilderState(nextState)
    await rerenderAll(nextState)
  }

  async function handleClearDrill(widgetId) {
    const nextState = {
      ...builderStateRef.current,
      widgets: builderStateRef.current.widgets.map((widget) => (
        widget.id === widgetId ? { ...widget, drill: null } : widget
      )),
    }
    builderStateRef.current = nextState
    setBuilderState(nextState)
    await renderWidget(widgetId, nextState)
  }

  async function handleRefreshWidget(widgetId) {
    await renderWidget(widgetId)
  }

  async function handleThemeToggle() {
    const nextState = {
      ...builderStateRef.current,
      themeMode: builderStateRef.current.themeMode === 'light' ? 'dark' : 'light',
    }
    builderStateRef.current = nextState
    setBuilderState(nextState)
    await rerenderAll(nextState)
  }

  function handleUndo() {
    if (!undoStack.length) return
    const previousSnapshot = undoStack[undoStack.length - 1]
    const nextState = normalizeBuilderState(previousSnapshot)
    setUndoStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) => [...stack.slice(-24), captureSnapshot(builderStateRef.current)])
    builderStateRef.current = nextState
    setBuilderState(nextState)
    rerenderAll(nextState)
  }

  function handleRedo() {
    if (!redoStack.length) return
    const nextSnapshot = redoStack[redoStack.length - 1]
    const nextState = normalizeBuilderState(nextSnapshot)
    setRedoStack((stack) => stack.slice(0, -1))
    setUndoStack((stack) => [...stack.slice(-24), captureSnapshot(builderStateRef.current)])
    builderStateRef.current = nextState
    setBuilderState(nextState)
    rerenderAll(nextState)
  }

  async function handleSaveNow() {
    if (!activeDataset?.name) return
    try {
      setSaving(true)
      await saveDashboardDefinition({
        name: 'Auto Power BI Dashboard',
        dataset_name: activeDataset.name,
        theme: builderState.themeMode,
        interaction_mode: builderState.interactionMode,
        widgets: persistedDashboard.widgets,
        selected_widget_id: builderState.selectedWidgetId,
        cross_filter: builderState.crossFilter || {},
        global_filters: builderState.globalFilters || [],
      })
      setLastSavedAt(new Date())
      addToast('Dashboard saved successfully.', null, 'success')
    } catch (saveError) {
      addToast(saveError?.response?.data?.detail || 'Dashboard could not be saved.', null, 'warning')
    } finally {
      setSaving(false)
    }
  }

  function handleDownloadDataset() {
    const csv = stringifyCsv(activeDataset)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    downloadDataUrl(url, `${activeDataset?.name || 'dataset'}.csv`)
    URL.revokeObjectURL(url)
  }

  function handleChartReady(widgetId, target) {
    chartRefs.current[widgetId] = target
  }

  async function exportWidgetImage(widgetId) {
    const widget = builderStateRef.current.widgets.find((item) => item.id === widgetId)
    const target = chartRefs.current[widgetId]
    if (!widget || !target) {
      addToast('Wait for the chart to finish rendering before exporting.', null, 'warning')
      return
    }

    const image = await Plotly.toImage(target, {
      format: 'png',
      width: 1400,
      height: widget.chartType === 'kpi_card' ? 700 : 900,
    })
    downloadDataUrl(image, `${widget.title.replace(/\s+/g, '-').toLowerCase()}.png`)
  }

  async function buildDashboardImage() {
    const stateSnapshot = builderStateRef.current
    const cellWidth = 128
    const cellHeight = 96
    const gap = 16
    const padding = 28
    const headerHeight = 86
    const maxRows = Math.max(6, ...stateSnapshot.widgets.map((widget) => widget.layout.y + widget.layout.h))
    const width = padding * 2 + (cellWidth * 12) + (gap * 11)
    const height = headerHeight + padding + (maxRows * cellHeight) + (Math.max(maxRows - 1, 0) * gap) + padding

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')

    const isLight = stateSnapshot.themeMode === 'light'
    context.fillStyle = isLight ? '#f6f7fb' : '#081121'
    context.fillRect(0, 0, width, height)

    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, isLight ? '#fff5ec' : '#131c35')
    gradient.addColorStop(1, isLight ? '#eef2ff' : '#09101f')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, headerHeight)

    context.fillStyle = isLight ? '#111827' : '#f8fafc'
    context.font = '700 28px Inter, sans-serif'
    context.fillText('Auto Power BI Dashboard', padding, 42)
    context.font = '500 14px Inter, sans-serif'
    context.fillStyle = isLight ? '#4b5563' : '#cbd5e1'
    context.fillText(`Dataset: ${activeDataset?.name || 'Dataset'} | ${new Date().toLocaleString()}`, padding, 66)
    context.textAlign = 'right'
    context.fillStyle = isLight ? '#ea580c' : '#ffb37d'
    context.font = '700 14px Inter, sans-serif'
    context.fillText('Datalytics', width - padding, 42)
    context.fillStyle = isLight ? '#6b7280' : '#94a3b8'
    context.font = '500 12px Inter, sans-serif'
    context.fillText('Branded analytics export', width - padding, 62)
    context.textAlign = 'left'

    for (const widget of stateSnapshot.widgets) {
      const x = padding + widget.layout.x * (cellWidth + gap)
      const y = headerHeight + widget.layout.y * (cellHeight + gap)
      const widgetWidth = (widget.layout.w * cellWidth) + ((widget.layout.w - 1) * gap)
      const widgetHeight = (widget.layout.h * cellHeight) + ((widget.layout.h - 1) * gap)

      context.fillStyle = isLight ? '#ffffff' : '#0f172a'
      context.strokeStyle = isLight ? '#d9dee8' : '#26334f'
      context.lineWidth = 1
      context.beginPath()
      context.roundRect(x, y, widgetWidth, widgetHeight, 18)
      context.fill()
      context.stroke()

      context.fillStyle = isLight ? '#111827' : '#f8fafc'
      context.font = '700 16px Inter, sans-serif'
      context.fillText(widget.title || chartDefinition(widget.chartType).label, x + 18, y + 28)

      const target = chartRefs.current[widget.id]
      if (target) {
        try {
          const dataUrl = await Plotly.toImage(target, {
            format: 'png',
            width: Math.max(800, widgetWidth * 2),
            height: Math.max(500, widgetHeight * 2),
          })
          const image = await loadImage(dataUrl)
          context.drawImage(image, x + 16, y + 44, widgetWidth - 32, widgetHeight - 78)
        } catch {
          context.fillStyle = isLight ? '#6b7280' : '#94a3b8'
          context.font = '500 13px Inter, sans-serif'
          context.fillText('Chart preview unavailable during export.', x + 18, y + 72)
        }
      }

      context.fillStyle = isLight ? '#6b7280' : '#94a3b8'
      context.font = '500 12px Inter, sans-serif'
      context.fillText((widget.insight || '').slice(0, 96), x + 18, y + widgetHeight - 18)
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width,
      height,
    }
  }

  async function handleExportDashboardImage() {
    const image = await buildDashboardImage()
    downloadDataUrl(image.dataUrl, 'datalytics-auto-powerbi-dashboard.png')
  }

  async function handleExportDashboardPdf() {
    const image = await buildDashboardImage()
    const pdf = new jsPDF({
      orientation: image.width > image.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [image.width, image.height],
    })
    pdf.addImage(image.dataUrl, 'PNG', 0, 0, image.width, image.height)
    pdf.save('datalytics-auto-powerbi-dashboard.pdf')
  }

  function handleExportDashboardBundle() {
    const exportBundle = {
      format: 'Datalytics.PBIX.Lite',
      version: 1,
      exported_at: new Date().toISOString(),
      brand: 'Datalytics',
      dataset: {
        name: activeDataset?.name || 'Dataset',
        columns: activeDataset?.columns || [],
        row_count: activeDataset?.rows?.length || 0,
        sample_rows: (activeDataset?.rows || []).slice(0, 400),
      },
      intelligence: dashboardIntelligence,
      dashboard: buildPersistedDashboard(builderStateRef.current),
    }

    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    downloadDataUrl(url, 'datalytics-auto-powerbi-dashboard.pbixlite.json')
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`powerbi-builder-page ${builderState.themeMode === 'light' ? 'is-light' : 'is-dark'}`}>
      <div className="powerbi-hero">
        <div className="powerbi-hero-copy">
          <span className="powerbi-eyebrow">AUTO POWER BI DASHBOARD</span>
          <h1 className="page-title">AI Dashboard Studio</h1>
          <p className="page-subtitle">
            Automatically profile the dataset, build executive-ready visuals, surface trends and anomalies, and keep every chart editable in a Power BI-style studio.
          </p>
          <div className="powerbi-hero-badges">
            <span className="powerbi-hero-badge">Snap to grid</span>
            <span className="powerbi-hero-badge">Auto insights</span>
            <span className="powerbi-hero-badge">Decomposition tree</span>
            <span className="powerbi-hero-badge">Combo + ribbon charts</span>
            {usingDemoDataset ? <span className="powerbi-hero-badge is-live">Demo dataset active</span> : null}
          </div>
        </div>

        <div className="powerbi-toolbar">
          {usingDemoDataset ? (
            <button type="button" className="btn btn-primary" onClick={onJumpToUpload}>
              Upload Real Data
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={handleThemeToggle}>
            {builderState.themeMode === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={generateAutomaticDashboard}>
            Auto Build
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleUndo} disabled={!undoStack.length}>
            Undo
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleRedo} disabled={!redoStack.length}>
            Redo
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleSaveNow} disabled={saving}>
            {saving ? 'Saving...' : 'Save Dashboard'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportDashboardBundle}>
            Export PBIX-like
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExportDashboardImage}>
            Export PNG
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExportDashboardPdf}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="powerbi-stats-grid">
        <div className="powerbi-stat-card">
          <span>Rows</span>
          <strong>{(activeDatasetProfile.totalRowCount || activeDatasetProfile.rowCount).toLocaleString()}</strong>
        </div>
        <div className="powerbi-stat-card">
          <span>Columns</span>
          <strong>{activeDatasetProfile.totalColumnCount || activeDatasetProfile.columnCount}</strong>
        </div>
        <div className="powerbi-stat-card">
          <span>{dashboardIntelligence.kpis?.[1]?.label || 'Data Quality'}</span>
          <strong>{dashboardIntelligence.kpis?.[1]?.value || '0%'}</strong>
        </div>
        <div className="powerbi-stat-card">
          <span>Widgets</span>
          <strong>{builderState.widgets.length}</strong>
        </div>
        <div className="powerbi-stat-card">
          <span>{leadingCorrelation ? 'Top Correlation' : (usingDemoDataset ? 'Mode' : 'Session')}</span>
          <strong>{leadingCorrelation ? `${leadingCorrelation.left} x ${leadingCorrelation.right}` : (usingDemoDataset ? 'AI Demo Live' : timestampLabel(lastSavedAt))}</strong>
        </div>
        <div className="powerbi-stat-actions">
          <button type="button" className="btn btn-secondary" onClick={handleDownloadDataset}>
            Download Dataset
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setLibraryCollapsed((previous) => !previous)}
          >
            {libraryCollapsed ? 'Show Visuals' : 'Hide Visuals'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSettingsCollapsed((previous) => !previous)}
          >
            {settingsCollapsed ? 'Show Settings' : 'Hide Settings'}
          </button>
          {builderState.crossFilter?.column ? (
            <button type="button" className="btn btn-secondary" onClick={handleClearFilter}>
              Clear Cross Filter
            </button>
          ) : null}
          {builderState.globalFilters?.length ? (
            <button type="button" className="btn btn-secondary" onClick={handleClearGlobalFilters}>
              Clear Global Filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="powerbi-insight-grid">
        {dashboardIntelligence.insights.map((insight) => (
          <article key={insight.id} className={`powerbi-insight-card is-${insight.tone || 'neutral'}`}>
            <span>{insight.type}</span>
            <strong>{insight.title}</strong>
            <p>{insight.body}</p>
          </article>
        ))}
      </div>

      {error ? <div className="builder-banner is-error">{error}</div> : null}
      {loading ? <div className="builder-banner is-loading">Preparing dashboard workspace and intelligent starter visuals...</div> : null}
      {usingDemoDataset ? (
        <div className="builder-banner is-demo">
          Demo dashboard is loaded with simulated business data so new users can explore visuals instantly.
        </div>
      ) : null}

      <div className={`powerbi-builder-shell ${libraryCollapsed ? 'is-left-collapsed' : ''} ${settingsCollapsed ? 'is-right-collapsed' : ''}`}>
        <DashboardChartLibrary
          metadata={metadata}
          intelligence={dashboardIntelligence}
          selectedWidget={selectedWidget}
          globalFilters={builderState.globalFilters || []}
          collapsed={libraryCollapsed}
          onAddChart={handleAddChart}
          onApplyFilter={handleSetGlobalFilter}
          onClearFilter={handleRemoveGlobalFilter}
          onClearAllFilters={handleClearGlobalFilters}
          onToggleCollapsed={() => setLibraryCollapsed((previous) => !previous)}
        />

        <DashboardCanvas
          widgets={builderState.widgets}
          themeMode={builderState.themeMode}
          selectedWidgetId={builderState.selectedWidgetId}
          crossFilter={builderState.crossFilter}
          onSelectWidget={handleSelectWidget}
          onAddChart={handleAddChart}
          onCommitLayout={handleLayoutCommit}
          onRemoveWidget={handleRemoveWidget}
          onDuplicateWidget={handleDuplicateWidget}
          onToggleWidgetMinimize={handleToggleWidgetMinimize}
          onToggleWidgetExpand={handleToggleWidgetExpand}
          onRefreshWidget={handleRefreshWidget}
          onExportWidget={exportWidgetImage}
          onClearDrill={handleClearDrill}
          onWidgetPointClick={handleWidgetPointClick}
          onChartReady={handleChartReady}
        />

        <DashboardFieldPanel
          widget={selectedWidget}
          metadata={metadata}
          themeMode={builderState.themeMode}
          interactionMode={builderState.interactionMode}
          crossFilter={builderState.crossFilter}
          globalFilters={builderState.globalFilters || []}
          collapsed={settingsCollapsed}
          onChangeChartType={handleChangeChartType}
          onChangeTitle={handleChangeTitle}
          onChangeAggregation={handleChangeAggregation}
          onAssignField={handleAssignField}
          onAppendField={handleAppendField}
          onRemoveField={handleRemoveField}
          onSuggestFields={handleSuggestFields}
          onSetInteractionMode={(mode) => patchState((previous) => ({ ...previous, interactionMode: mode }))}
          onUpdateWidgetSettings={handleUpdateWidgetSettings}
          onRemoveGlobalFilter={handleRemoveGlobalFilter}
          onClearGlobalFilters={handleClearGlobalFilters}
          onClearFilter={handleClearFilter}
          onClearDrill={handleClearDrill}
          onToggleCollapsed={() => setSettingsCollapsed((previous) => !previous)}
        />
      </div>
    </div>
  )
}
