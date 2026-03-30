import { useMemo } from 'react'
import { BarChart, LineChart, PieChart, HistogramChart } from './ChartKit.jsx'
import {
  applyFilters,
  aggregateByKey,
  buildTimeSeries,
  computeHistogram,
  getUniqueValues,
  toNumber
} from '../lib/dataUtils.js'

const CHART_TYPES = ['Bar', 'Line', 'Pie', 'Histogram']

export default function VisualizationStep({
  dataset,
  datasetProfile,
  vizConfig,
  setVizConfig,
  onAddChart,
  onComplete,
  onJumpToUpload
}) {
  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to visualize</h2>
        <p>Choose chart types, axes, and filters to generate live visualizations.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const rows = dataset.rows
  const filteredRows = useMemo(() => (
    applyFilters(rows, { column: vizConfig.filterColumn, values: vizConfig.filterValues })
  ), [rows, vizConfig.filterColumn, vizConfig.filterValues])

  const uniqueFilterValues = useMemo(() => (
    vizConfig.filterColumn ? getUniqueValues(rows, vizConfig.filterColumn) : []
  ), [rows, vizConfig.filterColumn])

  const chartData = useMemo(() => {
    if (!vizConfig.x || !vizConfig.y) return []
    if (vizConfig.chartType === 'Histogram') {
      const values = filteredRows.map(row => toNumber(row[vizConfig.x]))
      return computeHistogram(values, 8)
    }
    if (vizConfig.chartType === 'Line') {
      return buildTimeSeries(filteredRows, vizConfig.x, vizConfig.y, 10)
    }
    return aggregateByKey(filteredRows, vizConfig.x, vizConfig.y, 'sum', 8)
  }, [filteredRows, vizConfig])

  const chartComponent = () => {
    if (!chartData.length) {
      return <div className="empty-chart">Select fields to generate a chart.</div>
    }
    switch (vizConfig.chartType) {
      case 'Pie':
        return <PieChart data={chartData} />
      case 'Line':
        return <LineChart data={chartData} />
      case 'Histogram':
        return <HistogramChart bins={chartData} />
      default:
        return <BarChart data={chartData} />
    }
  }

  const suggestions = [
    { label: 'Bar: Region vs Sales', x: datasetProfile.categoricalColumns[0], y: datasetProfile.numericColumns[0], chartType: 'Bar' },
    { label: 'Line: Date vs Sales', x: datasetProfile.columns.find(col => datasetProfile.types[col] === 'date') || datasetProfile.columns[0], y: datasetProfile.numericColumns[0], chartType: 'Line' },
    { label: 'Pie: Segment Share', x: datasetProfile.categoricalColumns[1] || datasetProfile.categoricalColumns[0], y: datasetProfile.numericColumns[0], chartType: 'Pie' }
  ].filter(s => s.x && s.y)

  return (
    <div>
      <div className="step-header">
        <div>
          <h1 className="page-title">Visualization</h1>
          <p className="page-subtitle">Auto-generate charts with live filters and axis selectors.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            onAddChart({
              title: `${vizConfig.chartType} - ${vizConfig.x} vs ${vizConfig.y}`,
              config: { ...vizConfig }
            })
            onComplete('visualization')
          }}
        >
          Add to Dashboard
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="section-title">Chart Controls</div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Chart Type</label>
              <select
                value={vizConfig.chartType}
                onChange={event => setVizConfig({ ...vizConfig, chartType: event.target.value })}
              >
                {CHART_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>X Axis</label>
              <select
                value={vizConfig.x}
                onChange={event => setVizConfig({ ...vizConfig, x: event.target.value })}
              >
                {datasetProfile.columns.map(column => <option key={column} value={column}>{column}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Y Axis</label>
              <select
                value={vizConfig.y}
                onChange={event => setVizConfig({ ...vizConfig, y: event.target.value })}
              >
                {(datasetProfile.numericColumns.length ? datasetProfile.numericColumns : datasetProfile.columns).map(column => (
                  <option key={column} value={column}>{column}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Filter Column</label>
              <select
                value={vizConfig.filterColumn}
                onChange={event => setVizConfig({ ...vizConfig, filterColumn: event.target.value, filterValues: [] })}
              >
                <option value="">None</option>
                {datasetProfile.categoricalColumns.map(column => <option key={column} value={column}>{column}</option>)}
              </select>
            </div>
          </div>

          {vizConfig.filterColumn && (
            <div className="filter-panel">
              <div className="filter-title">Filter Values</div>
              <div className="filter-chips">
                {uniqueFilterValues.map(value => (
                  <button
                    key={value}
                    type="button"
                    className={`filter-chip ${vizConfig.filterValues.includes(value) ? 'is-active' : ''}`}
                    onClick={() => {
                      const nextValues = vizConfig.filterValues.includes(value)
                        ? vizConfig.filterValues.filter(v => v !== value)
                        : [...vizConfig.filterValues, value]
                      setVizConfig({ ...vizConfig, filterValues: nextValues })
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="filter-note">Filtered rows: {filteredRows.length.toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Auto Suggestions</div>
          <div className="suggestion-list">
            {suggestions.map(suggestion => (
              <button
                key={suggestion.label}
                className="suggestion-item"
                type="button"
                onClick={() => setVizConfig({
                  ...vizConfig,
                  chartType: suggestion.chartType,
                  x: suggestion.x,
                  y: suggestion.y
                })}
              >
                <span>{suggestion.label}</span>
                <span className="badge badge-purple">Apply</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Live Chart</div>
        {chartComponent()}
      </div>
    </div>
  )
}
