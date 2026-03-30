import { BarChart, LineChart, PieChart } from './ChartKit.jsx'
import {
  aggregateByKey,
  buildTimeSeries,
  getUniqueValues,
  toNumber
} from '../lib/dataUtils.js'

export default function PowerBIDashboardStep({
  dataset,
  datasetProfile,
  savedCharts,
  dashboardState,
  setDashboardState,
  onComplete,
  onJumpToUpload
}) {
  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to build a dashboard</h2>
        <p>Auto Power BI dashboards are generated after profiling your dataset.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const regionKey = datasetProfile.columns.find(col => /region/i.test(col)) || datasetProfile.categoricalColumns[0]
  const segmentKey = datasetProfile.columns.find(col => /segment/i.test(col)) || datasetProfile.categoricalColumns[1] || datasetProfile.categoricalColumns[0]
  const categoryKey = datasetProfile.columns.find(col => /category/i.test(col)) || datasetProfile.categoricalColumns[2] || datasetProfile.categoricalColumns[0]
  const productKey = datasetProfile.columns.find(col => /product/i.test(col)) || datasetProfile.categoricalColumns[3] || datasetProfile.categoricalColumns[0]
  const dateKey = datasetProfile.columns.find(col => datasetProfile.types[col] === 'date') || datasetProfile.columns[0]
  const salesKey = datasetProfile.columns.find(col => /sales/i.test(col)) || datasetProfile.numericColumns[0]
  const profitKey = datasetProfile.columns.find(col => /profit/i.test(col)) || datasetProfile.numericColumns[1] || datasetProfile.numericColumns[0]
  const discountKey = datasetProfile.columns.find(col => /discount/i.test(col)) || datasetProfile.numericColumns[2] || datasetProfile.numericColumns[0]

  const regions = regionKey ? getUniqueValues(dataset.rows, regionKey) : []
  const segments = segmentKey ? getUniqueValues(dataset.rows, segmentKey) : []
  const years = Array.from(new Set(dataset.rows.map(row => {
    const date = new Date(row[dateKey])
    return Number.isNaN(date.getTime()) ? null : date.getFullYear()
  }).filter(Boolean))).sort()

  const filteredRows = dataset.rows.filter(row => {
    const matchesRegion = !regionKey || dashboardState.region === 'All' || row[regionKey] === dashboardState.region
    const matchesSegment = !segmentKey || dashboardState.segment === 'All' || row[segmentKey] === dashboardState.segment
    const matchesYear = dashboardState.year === 'All' || new Date(row[dateKey]).getFullYear().toString() === dashboardState.year
    return matchesRegion && matchesSegment && matchesYear
  })

  const totalSales = filteredRows.reduce((sum, row) => sum + (toNumber(row[salesKey]) || 0), 0)
  const totalProfit = filteredRows.reduce((sum, row) => sum + (toNumber(row[profitKey]) || 0), 0)
  const avgDiscount = filteredRows.length
    ? filteredRows.reduce((sum, row) => sum + (toNumber(row[discountKey]) || 0), 0) / filteredRows.length
    : 0

  const drillKey = dashboardState.drill || categoryKey || datasetProfile.categoricalColumns[0] || datasetProfile.columns[0]
  const barData = aggregateByKey(filteredRows, drillKey, salesKey, 'sum', 8)
  const lineData = buildTimeSeries(filteredRows, dateKey, salesKey, 8)
  const pieData = aggregateByKey(filteredRows, segmentKey, salesKey, 'sum', 5)

  return (
    <div>
      <div className="step-header">
        <div>
          <h1 className="page-title">Auto Power BI Dashboard</h1>
          <p className="page-subtitle">Live KPI cards, filters, and drill-down visuals generated from your dataset.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onComplete('powerbi')}>
          Publish Dashboard
        </button>
      </div>

      <div className="dashboard-filters">
        <div className="form-group">
          <label>Region</label>
          <select
            value={dashboardState.region}
            onChange={event => setDashboardState({ ...dashboardState, region: event.target.value })}
          >
            <option value="All">All</option>
            {regions.map(region => <option key={region} value={region}>{region}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Segment</label>
          <select
            value={dashboardState.segment}
            onChange={event => setDashboardState({ ...dashboardState, segment: event.target.value })}
          >
            <option value="All">All</option>
            {segments.map(segment => <option key={segment} value={segment}>{segment}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Year</label>
          <select
            value={dashboardState.year}
            onChange={event => setDashboardState({ ...dashboardState, year: event.target.value })}
          >
            <option value="All">All</option>
            {years.map(year => <option key={year} value={String(year)}>{year}</option>)}
          </select>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Sales</div>
          <div className="kpi-value">{totalSales.toLocaleString()}</div>
          <div className="kpi-sub">Filtered by {dashboardState.region}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Profit</div>
          <div className="kpi-value">{totalProfit.toLocaleString()}</div>
          <div className="kpi-sub">Profit margin focus</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Discount</div>
          <div className="kpi-value">{(avgDiscount * 100).toFixed(1)}%</div>
          <div className="kpi-sub">Price sensitivity</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Orders</div>
          <div className="kpi-value">{filteredRows.length.toLocaleString()}</div>
          <div className="kpi-sub">Current filter scope</div>
        </div>
      </div>

      <div className="drill-row">
        <span className="drill-title">Drill-down path</span>
        {[regionKey, categoryKey, productKey].filter(Boolean).map(key => (
          <button
            key={key}
            type="button"
            className={`drill-pill ${dashboardState.drill === key ? 'is-active' : ''}`}
            onClick={() => setDashboardState({ ...dashboardState, drill: key })}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="section-title">Sales by {drillKey}</div>
          <BarChart data={barData} />
        </div>
        <div className="card">
          <div className="section-title">Sales Trend</div>
          <LineChart data={lineData} />
        </div>
        <div className="card">
          <div className="section-title">Segment Contribution</div>
          <PieChart data={pieData} />
        </div>
        <div className="card">
          <div className="section-title">Saved Visualizations</div>
          {savedCharts.length ? (
            <div className="saved-charts">
              {savedCharts.map((chart, index) => (
                <div key={`${chart.title}-${index}`} className="saved-chart-item">
                  <span>{chart.title}</span>
                  <span className="badge badge-blue">Pinned</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-text">Add charts from the Visualization step.</p>
          )}
        </div>
      </div>
    </div>
  )
}
