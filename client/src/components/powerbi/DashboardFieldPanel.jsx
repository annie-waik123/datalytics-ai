import React, { useRef, useState } from 'react'
import { POWER_BI_CHARTS, chartDefinition, fieldOptionsForSlot, FIELD_SLOT_DEFINITIONS } from '../../utils/dashboardBuilder.js'

/* ─── tiny helpers ─────────────────────────────────────── */
const S = {
  aside: {
    width: 260,
    minWidth: 260,
    maxWidth: 260,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(10,18,36,0.95)',
    border: '1px solid rgba(148,190,255,0.16)',
    borderRadius: 20,
    overflow: 'hidden',
    height: 'var(--builder-workspace-height, 75vh)',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    padding: '12px 14px',
    borderBottom: '1px solid rgba(148,190,255,0.14)',
    background: 'rgba(10,18,36,0.98)',
    flexShrink: 0,
  },
  headerText: { flex: 1, minWidth: 0, overflow: 'hidden' },
  h3: { margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#eef4ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  desc: { margin: 0, fontSize: 10.5, color: '#7f96b8', lineHeight: 1.4 },
  toggleBtn: {
    flexShrink: 0,
    width: 26, height: 26,
    borderRadius: 7,
    border: '1px solid rgba(148,190,255,0.25)',
    background: 'rgba(255,255,255,0.06)',
    color: '#eef4ff',
    fontSize: 13, fontWeight: 800,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '10px 12px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(148,190,255,0.18) transparent',
    boxSizing: 'border-box',
  },
  sectionTitle: {
    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#7f96b8',
    marginTop: 8, marginBottom: 2, padding: '0 2px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(148,190,255,0.1)',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxSizing: 'border-box',
    width: '100%',
  },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#93a8ca' },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '6px 9px', borderRadius: 8,
    border: '1px solid rgba(148,190,255,0.18)',
    background: 'rgba(0,0,0,0.25)',
    color: '#eef4ff', fontSize: 12, outline: 'none',
  },
  slotCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(148,190,255,0.09)',
    borderRadius: 10, padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: 6,
    boxSizing: 'border-box', width: '100%',
  },
  slotHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 8px', borderRadius: 20,
    background: 'rgba(255,123,28,0.18)', border: '1px solid rgba(255,123,28,0.35)',
    color: '#ffb37d', fontSize: 11, fontWeight: 600,
  },
  chipX: {
    background: 'none', border: 'none', color: '#ffb37d',
    cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1,
    display: 'flex', alignItems: 'center',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  select: {
    width: '100%', boxSizing: 'border-box',
    padding: '6px 9px', borderRadius: 8,
    border: '1px solid rgba(148,190,255,0.18)',
    background: 'rgba(0,0,0,0.25)',
    color: '#eef4ff', fontSize: 12, cursor: 'pointer', outline: 'none',
  },
  emptyState: {
    textAlign: 'center', padding: '28px 20px',
    color: '#7f96b8', fontSize: 12,
    display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
  },
}

function FieldChip({ label, onRemove }) {
  return (
    <span style={S.chip}>
      {label}
      <button type="button" style={S.chipX} onClick={onRemove} aria-label={`Remove ${label}`}>×</button>
    </span>
  )
}

function SlotCard({ slotKey, widget, metadata, onChangeValue, onAppendValue, onRemoveValue }) {
  const def = FIELD_SLOT_DEFINITIONS[slotKey]
  if (!def) return null
  const isMulti = def.multi === true      // ← FIELD_SLOT_DEFINITIONS uses 'multi', not 'multiple'
  const values = widget.mapping?.[slotKey] ?? (isMulti ? [] : '')
  const options = fieldOptionsForSlot(slotKey, metadata)

  return (
    <div style={S.slotCard}>
      <div style={S.slotHeader}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#93a8ca' }}>{def.label}</span>
        <span style={{ fontSize: 9.5, color: '#7f96b8' }}>{isMulti ? 'Multi' : 'Single'}</span>
      </div>
      <div style={S.chipRow}>
        {Array.isArray(values)
          ? values.filter(Boolean).map((v, i) => (
              <FieldChip key={`${v}-${i}`} label={v} onRemove={() => onRemoveValue(slotKey, v)} />
            ))
          : values
          ? <FieldChip label={String(values)} onRemove={() => onRemoveValue(slotKey, values)} />
          : <span style={{ fontSize: 10.5, color: '#7f96b8', fontStyle: 'italic' }}>No field set</span>}
      </div>
      <select
        style={S.select}
        value=""
        onChange={(e) => {
          if (!e.target.value) return
          if (isMulti) {
            onAppendValue(slotKey, e.target.value)   // append to array
          } else {
            onChangeValue(slotKey, e.target.value)    // replace single value
          }
        }}
      >
        <option value="">Add field</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function CtrlBtn({ active, color, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
        cursor: 'pointer', boxSizing: 'border-box', textAlign: 'center',
        background: active ? `rgba(${color},0.16)` : 'rgba(255,255,255,0.04)',
        border: active ? `1px solid rgba(${color},0.4)` : '1px solid rgba(148,190,255,0.1)',
        color: active ? `rgb(${color})` : '#93a8ca',
      }}
    >
      {label}
    </button>
  )
}

/* ─── Collapsed state ──────────────────────────────────── */
function CollapsedPanel({ themeMode, widget, onToggleCollapsed }) {
  return (
    <aside style={{ ...S.aside, width: 52, minWidth: 52, alignItems: 'center', padding: '12px 0', gap: 12 }}>
      <button
        type="button"
        onClick={onToggleCollapsed}
        style={{ ...S.toggleBtn, width: 32, height: 32 }}
        aria-label="Expand settings panel"
      >‹</button>
      <span style={{
        writingMode: 'vertical-rl', textOrientation: 'mixed',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        color: '#7f96b8', textTransform: 'uppercase',
        userSelect: 'none',
      }}>
        {widget ? widget.title : 'Settings'}
      </span>
    </aside>
  )
}

/* ─── Main component ───────────────────────────────────── */
export default function DashboardFieldPanel({
  themeMode, widget, metadata, interactionMode, crossFilter,
  globalFilters, collapsed,
  onChangeTitle, onChangeChartType, onChangeAggregation,
  onAssignField, onAppendField, onRemoveField,
  onSuggestFields, onSetInteractionMode, onUpdateWidgetSettings,
  onRemoveGlobalFilter, onClearGlobalFilters, onClearFilter, onClearDrill,
  onToggleCollapsed,
}) {
  const scrollRef = useRef(null)
  const [openSection, setOpenSection] = useState('mapping')
  const settings = widget?.settings || {}
  const definition = widget ? chartDefinition(widget.chartType) : null

  const AccordionHeader = ({ title, sectionKey }) => (
    <div 
      style={{
        ...S.sectionTitle, 
        cursor: 'pointer', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        background: openSection === sectionKey ? 'rgba(78, 144, 255, 0.1)' : 'transparent',
        borderRadius: 8,
        userSelect: 'none'
      }}
      onClick={() => setOpenSection(openSection === sectionKey ? null : sectionKey)}
    >
      <span>{title}</span>
      <span style={{ 
        transform: openSection === sectionKey ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
        fontSize: 14,
        color: '#6584ab'
      }}>›</span>
    </div>
  )

  if (collapsed) return <CollapsedPanel themeMode={themeMode} widget={widget} onToggleCollapsed={onToggleCollapsed} />

  return (
    <aside style={S.aside}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.headerText}>
          <h3 style={S.h3}>⚙ Settings</h3>
          <p style={S.desc}>
            {widget ? 'Fields, style, axes & interactions.' : 'Select a visual to configure.'}
          </p>
        </div>
        <button type="button" style={S.toggleBtn} onClick={onToggleCollapsed} aria-label="Collapse">›</button>
      </div>

      {/* ── Scroll body ── */}
      <div ref={scrollRef} style={S.scroll}>
        {widget ? (
          <>
            {/* ── Visual Setup ── */}
            <AccordionHeader title="Visual Setup" sectionKey="setup" />
            {openSection === 'setup' && (
              <div style={S.card}>
                <label style={S.label}>
                  Widget Title
                  <input
                    style={S.input}
                    type="text"
                    value={widget.title || ''}
                    onChange={(e) => onChangeTitle(e.target.value)}
                    placeholder="Widget Title"
                  />
                </label>
                <label style={S.label}>
                  Chart Type
                  <select style={S.select} value={widget.chartType} onChange={(e) => onChangeChartType(e.target.value)}>
                    {POWER_BI_CHARTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label style={S.label}>
                  Aggregation
                  <select style={S.select} value={widget.mapping?.aggregation || 'sum'} onChange={(e) => onChangeAggregation(e.target.value)}>
                    {(metadata?.aggregations || ['sum', 'avg', 'count', 'min', 'max']).map((v) =>
                      <option key={v} value={v}>{v.toUpperCase()}</option>
                    )}
                  </select>
                </label>
              </div>
            )}

            {/* ── Data Mapping ── */}
            <AccordionHeader title="Data Mapping" sectionKey="mapping" />
            {openSection === 'mapping' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {definition?.slots.map((slotKey) => (
                  <SlotCard
                    key={slotKey}
                    slotKey={slotKey}
                    widget={widget}
                    metadata={metadata}
                    onChangeValue={onAssignField}
                    onAppendValue={onAppendField}
                    onRemoveValue={onRemoveField}
                  />
                ))}
              </div>
            )}

            {/* ── Chart Controls ── */}
            <AccordionHeader title="Chart Controls" sectionKey="controls" />
            {openSection === 'controls' && (
              <div style={S.card}>
                {/* Legend toggle — prominent */}
                <button
                  type="button"
                  onClick={() => onUpdateWidgetSettings({ showLegend: settings.showLegend === false })}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box',
                    background: settings.showLegend !== false ? 'rgba(255,123,28,0.18)' : 'rgba(255,255,255,0.05)',
                    border: settings.showLegend !== false ? '1px solid rgba(255,123,28,0.45)' : '1px solid rgba(148,190,255,0.12)',
                    color: settings.showLegend !== false ? '#ffb37d' : '#7f96b8',
                    fontSize: 12, fontWeight: 700, textAlign: 'left',
                  }}
                >
                  <span>{settings.showLegend !== false ? '👁 Legend ON' : '🚫 Legend OFF'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 9.5, opacity: 0.65 }}>tap to toggle</span>
                </button>

                {/* 2-col grid for other toggles */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <CtrlBtn
                    active={settings.showTooltip !== false}
                    color="79,209,255"
                    label={settings.showTooltip !== false ? '💬 Tooltip ON' : '💬 Tooltip OFF'}
                    onClick={() => onUpdateWidgetSettings({ showTooltip: settings.showTooltip === false ? true : false })}
                  />
                  <CtrlBtn
                    active={!!settings.showLabels}
                    color="53,211,154"
                    label={settings.showLabels ? '🏷 Labels ON' : '🏷 Labels OFF'}
                    onClick={() => onUpdateWidgetSettings({ showLabels: !settings.showLabels })}
                  />
                </div>

                <label style={S.label}>
                  Chart Size
                  <select style={S.select} value={settings.size || 'medium'} onChange={(e) => onUpdateWidgetSettings({ size: e.target.value })}>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => onUpdateWidgetSettings({ showLegend: true, showTooltip: true, showLabels: false, locked: false, size: 'medium', palette: 'executive' })}
                  style={{ ...S.input, cursor: 'pointer', textAlign: 'center', fontWeight: 600, fontSize: 11, color: '#7f96b8' }}
                >
                  ↺ Reset Chart Settings
                </button>
              </div>
            )}


          </>
        ) : (
          <div style={S.emptyState}>
            <span style={{ fontSize: 32 }}>🖼</span>
            <strong style={{ color: '#eef4ff', fontSize: 13 }}>No visual selected</strong>
            <span style={{ fontSize: 11 }}>Pick or drop a chart on the canvas to start mapping fields.</span>
          </div>
        )}
      </div>
    </aside>
  )
}
