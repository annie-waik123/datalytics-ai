import { FIELD_SLOT_DEFINITIONS, POWER_BI_CHARTS, chartDefinition, fieldOptionsForSlot } from '../../utils/dashboardBuilder.js'

function FieldChip({ label, onRemove }) {
  return (
    <span className="builder-field-chip">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>
        x
      </button>
    </span>
  )
}

function SlotCard({
  slotKey,
  widget,
  metadata,
  onDropField,
  onChangeValue,
  onAppendValue,
  onRemoveValue,
}) {
  const definition = FIELD_SLOT_DEFINITIONS[slotKey]
  const options = fieldOptionsForSlot(slotKey, metadata)
  const currentValue = definition.multi ? (widget.mapping?.[slotKey] || []) : (widget.mapping?.[slotKey] || '')

  return (
    <div
      className="builder-slot-card"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const column = event.dataTransfer.getData('application/x-dashboard-field')
        if (!column) return
        if (definition.multi) {
          onAppendValue(slotKey, column)
          return
        }
        onDropField(slotKey, column)
      }}
    >
      <div className="builder-slot-header">
        <strong>{definition.label}</strong>
        <span>{definition.multi ? 'Multi field' : 'Single field'}</span>
      </div>

      {definition.multi ? (
        <>
          <div className="builder-slot-chip-row">
            {currentValue.length ? currentValue.map((value) => (
              <FieldChip
                key={`${slotKey}-${value}`}
                label={value}
                onRemove={() => onRemoveValue(slotKey, value)}
              />
            )) : <span className="builder-slot-placeholder">Drop fields here or add one below.</span>}
          </div>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) onAppendValue(slotKey, event.target.value)
            }}
          >
            <option value="">Add field</option>
            {options
              .filter((option) => !currentValue.includes(option))
              .map((option) => <option key={`${slotKey}-${option}`} value={option}>{option}</option>)}
          </select>
        </>
      ) : (
        <select
          value={currentValue}
          onChange={(event) => onChangeValue(slotKey, event.target.value)}
        >
          <option value="">None</option>
          {options.map((option) => <option key={`${slotKey}-${option}`} value={option}>{option}</option>)}
        </select>
      )}
    </div>
  )
}

function ToggleButton({ active, label, onClick }) {
  return (
    <button type="button" className={active ? 'is-active' : ''} onClick={onClick}>
      {label}
    </button>
  )
}

function ActiveFilters({ globalFilters, onRemoveFilter, onClearAllFilters }) {
  if (!globalFilters?.length) {
    return <p className="builder-helper">No dashboard-level filters are active.</p>
  }

  return (
    <div className="builder-active-filter-panel">
      <div className="builder-filter-chip-row">
        {globalFilters.map((filter) => (
          <button
            key={`${filter.column}-${String(filter.value)}`}
            type="button"
            className="builder-filter-chip is-active"
            onClick={() => onRemoveFilter(filter.column)}
          >
            {filter.column}: {String(filter.value)} x
          </button>
        ))}
      </div>
      <button type="button" className="builder-inline-button" onClick={onClearAllFilters}>
        Clear all filters
      </button>
    </div>
  )
}

export default function DashboardFieldPanel({
  widget,
  metadata,
  themeMode,
  interactionMode,
  crossFilter,
  globalFilters,
  collapsed,
  onChangeChartType,
  onChangeTitle,
  onChangeAggregation,
  onAssignField,
  onAppendField,
  onRemoveField,
  onSuggestFields,
  onSetInteractionMode,
  onUpdateWidgetSettings,
  onRemoveGlobalFilter,
  onClearGlobalFilters,
  onClearFilter,
  onClearDrill,
  onToggleCollapsed,
}) {
  const definition = widget ? chartDefinition(widget.chartType) : null
  const quickSlots = definition?.slots?.filter((slotKey) => ['x_axis', 'y_axis', 'legend', 'location'].includes(slotKey)) || []
  const settings = widget?.settings || {}

  if (collapsed) {
    return (
      <aside className={`builder-sidebar builder-sidebar-right is-collapsed ${themeMode === 'light' ? 'is-light' : 'is-dark'}`}>
        <div className="builder-panel-header">
          <div>
            <h3>Settings</h3>
          </div>
          <button type="button" className="builder-panel-toggle" onClick={onToggleCollapsed} aria-label="Expand settings panel">
            {'<'}
          </button>
        </div>
        <div className="builder-sidebar-collapsed-copy">
          <strong>{widget ? 'Visual selected' : 'Canvas ready'}</strong>
          <span>{widget ? widget.title : 'Pick a visual to open settings.'}</span>
        </div>
      </aside>
    )
  }

  return (
    <aside className={`builder-sidebar builder-sidebar-right ${themeMode === 'light' ? 'is-light' : 'is-dark'}`}>
      <div className="builder-panel-header">
        <div>
          <h3>Settings</h3>
          <p>{widget ? 'Tune fields, styling, axes, filters, and interactions for the selected visual.' : 'Select a visual to open the full settings workspace.'}</p>
        </div>
        <button type="button" className="builder-panel-toggle" onClick={onToggleCollapsed} aria-label="Collapse settings panel">
          {'>'}
        </button>
      </div>

      {widget ? (
        <>
          <div className="builder-config-card">
            <div className="builder-columns-header">
              <h4>Visual Setup</h4>
              <span>{definition?.label}</span>
            </div>

            <label className="builder-label">
              Widget Title
              <input
                type="text"
                value={widget.title || ''}
                onChange={(event) => onChangeTitle(event.target.value)}
                placeholder="Give this visual a business-friendly title"
              />
            </label>

            <label className="builder-label">
              Chart Type
              <select value={widget.chartType} onChange={(event) => onChangeChartType(event.target.value)}>
                {POWER_BI_CHARTS.map((chart) => (
                  <option key={chart.id} value={chart.id}>
                    {chart.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="builder-label">
              Aggregation
              <select value={widget.mapping?.aggregation || 'sum'} onChange={(event) => onChangeAggregation(event.target.value)}>
                {(metadata?.aggregations || ['sum', 'avg', 'count', 'min', 'max']).map((value) => (
                  <option key={value} value={value}>
                    {value.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            {quickSlots.length ? (
              <div className="builder-quick-mapping-grid">
                {quickSlots.map((slotKey) => (
                  <label key={slotKey} className="builder-label">
                    {FIELD_SLOT_DEFINITIONS[slotKey].label}
                    <select
                      value={widget.mapping?.[slotKey] || ''}
                      onChange={(event) => onAssignField(slotKey, event.target.value)}
                    >
                      <option value="">None</option>
                      {fieldOptionsForSlot(slotKey, metadata).map((option) => (
                        <option key={`${slotKey}-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : null}

            <div className="builder-inline-actions">
              <button type="button" className="builder-primary-button" onClick={onSuggestFields}>
                AI Suggest Mapping
              </button>
              {widget.drill?.value ? (
                <button type="button" className="builder-inline-button" onClick={() => onClearDrill(widget.id)}>
                  Reset Drill
                </button>
              ) : null}
            </div>

            {widget.warning ? <p className="builder-helper is-warning">{widget.warning}</p> : null}
            {widget.note ? <p className="builder-helper">{widget.note}</p> : null}
            <p className="builder-helper">{widget.insight || definition?.description}</p>
          </div>

          <div className="builder-config-card">
            <div className="builder-columns-header">
              <h4>Visual Style</h4>
              <span>Theme + layout</span>
            </div>

            <div className="builder-quick-mapping-grid">
              <label className="builder-label">
                Color Theme
                <select
                  value={settings.palette || 'executive'}
                  onChange={(event) => onUpdateWidgetSettings({ palette: event.target.value })}
                >
                  <option value="executive">Executive</option>
                  <option value="sunrise">Sunrise</option>
                  <option value="oceanic">Oceanic</option>
                  <option value="slate">Slate</option>
                </select>
              </label>

              <label className="builder-label">
                Orientation
                <select
                  value={settings.orientation || 'vertical'}
                  onChange={(event) => onUpdateWidgetSettings({ orientation: event.target.value })}
                >
                  <option value="vertical">Vertical</option>
                  <option value="horizontal">Horizontal</option>
                </select>
              </label>

              <label className="builder-label">
                Sort
                <select
                  value={settings.sortOrder || 'auto'}
                  onChange={(event) => onUpdateWidgetSettings({ sortOrder: event.target.value })}
                >
                  <option value="auto">Auto</option>
                  <option value="value-desc">Value desc</option>
                  <option value="value-asc">Value asc</option>
                  <option value="label-asc">Label asc</option>
                  <option value="label-desc">Label desc</option>
                </select>
              </label>
            </div>

            <div className="builder-toggle-group">
              <ToggleButton
                active={settings.showLegend !== false}
                label={settings.showLegend !== false ? 'Legend On' : 'Legend Off'}
                onClick={() => onUpdateWidgetSettings({ showLegend: settings.showLegend === false })}
              />
              <ToggleButton
                active={settings.showGrid !== false}
                label={settings.showGrid !== false ? 'Grid On' : 'Grid Off'}
                onClick={() => onUpdateWidgetSettings({ showGrid: settings.showGrid === false })}
              />
            </div>
          </div>

          <div className="builder-config-card">
            <div className="builder-columns-header">
              <h4>Axis Configuration</h4>
              <span>Labels + readability</span>
            </div>

            <div className="builder-quick-mapping-grid">
              <label className="builder-label">
                X Axis Label
                <input
                  type="text"
                  value={settings.xLabel || ''}
                  onChange={(event) => onUpdateWidgetSettings({ xLabel: event.target.value })}
                  placeholder="Optional X axis label"
                />
              </label>

              <label className="builder-label">
                Y Axis Label
                <input
                  type="text"
                  value={settings.yLabel || ''}
                  onChange={(event) => onUpdateWidgetSettings({ yLabel: event.target.value })}
                  placeholder="Optional Y axis label"
                />
              </label>
            </div>
          </div>

          <div className="builder-config-card">
            <div className="builder-columns-header">
              <h4>Interactions</h4>
              <span>Cross-filtering + drill</span>
            </div>

            <div className="builder-toggle-group">
              <ToggleButton active={interactionMode === 'cross-filter'} label="Cross Filter" onClick={() => onSetInteractionMode('cross-filter')} />
              <ToggleButton active={interactionMode === 'drill-down'} label="Drill Down" onClick={() => onSetInteractionMode('drill-down')} />
            </div>

            {crossFilter?.column ? (
              <button type="button" className="builder-inline-button" onClick={onClearFilter}>
                Clear cross-filter from {crossFilter.column}
              </button>
            ) : <p className="builder-helper">Cross-filtering is ready. Click marks on any chart to filter the rest of the canvas.</p>}

            <ActiveFilters
              globalFilters={globalFilters}
              onRemoveFilter={onRemoveGlobalFilter}
              onClearAllFilters={onClearGlobalFilters}
            />
          </div>

          <div className="builder-slot-grid">
            {definition?.slots.map((slotKey) => (
              <SlotCard
                key={slotKey}
                slotKey={slotKey}
                widget={widget}
                metadata={metadata}
                onDropField={onAssignField}
                onChangeValue={onAssignField}
                onAppendValue={onAppendField}
                onRemoveValue={onRemoveField}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="builder-config-card builder-empty-config">
          <strong>No visual selected</strong>
          <p>Pick or drop a chart on the canvas to begin mapping fields and styling the visual.</p>
        </div>
      )}
    </aside>
  )
}
