import { useState } from 'react'
import DataTable from './DataTable.jsx'
import { Heatmap } from './ChartKit.jsx'
import { formatNumber } from '../lib/dataUtils.js'

export default function ExploreStep({ dataset, datasetProfile, explorationReady, onComplete, onJumpToUpload }) {
  const [loading, setLoading] = useState(false)

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to start exploration</h2>
        <p>The exploration layer runs profiling, statistics, and correlation analysis automatically.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  function handleGenerate() {
    if (explorationReady) return
    setLoading(true)
    setTimeout(() => {
      onComplete('exploration')
      setLoading(false)
    }, 700)
  }

  const statsRows = datasetProfile.numericColumns.map(column => ({
    Column: column,
    Mean: formatNumber(datasetProfile.numericStats[column].mean),
    Median: formatNumber(datasetProfile.numericStats[column].median),
    Std: formatNumber(datasetProfile.numericStats[column].std),
    Min: formatNumber(datasetProfile.numericStats[column].min),
    Max: formatNumber(datasetProfile.numericStats[column].max)
  }))

  const missingRows = datasetProfile.columns.map(column => ({
    column,
    missing: datasetProfile.missingByColumn[column],
    pct: datasetProfile.rowCount ? (datasetProfile.missingByColumn[column] / datasetProfile.rowCount) * 100 : 0
  }))

  return (
    <div>
      <div className="step-header">
        <div>
          <h1 className="page-title">Data Exploration</h1>
          <p className="page-subtitle">Auto profile statistics, missing values, and correlation insights for every column.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating...' : explorationReady ? 'Exploration Ready' : 'Run Exploration'}
        </button>
      </div>

      {!explorationReady ? (
        <div className="card">
          <div className="section-title">Exploration preview</div>
          <p className="section-copy">Run exploration to compute statistics, missing value heatmaps, and correlation matrices.</p>
        </div>
      ) : (
        <>
          <div className="metrics-row metrics-4" style={{ marginBottom: '1.5rem' }}>
            <MetricCard label="Rows" value={datasetProfile.rowCount.toLocaleString()} />
            <MetricCard label="Columns" value={datasetProfile.columnCount} />
            <MetricCard label="Numeric" value={datasetProfile.numericColumns.length} />
            <MetricCard label="Categorical" value={datasetProfile.categoricalColumns.length} />
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="section-title">Column Statistics</div>
            <DataTable rows={statsRows} />
          </div>

          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <div className="section-title">Missing Values</div>
              <div className="missing-bars">
                {missingRows.map(row => (
                  <div key={row.column} className="missing-row">
                    <div className="missing-label">{row.column}</div>
                    <div className="missing-track">
                      <div className="missing-fill" style={{ width: `${row.pct.toFixed(1)}%` }} />
                    </div>
                    <div className="missing-value">{row.missing}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-title">Column Types</div>
              <div className="type-list">
                {datasetProfile.columns.map(column => (
                  <div key={column} className="type-item">
                    <span>{column}</span>
                    <span className="badge badge-blue">{datasetProfile.types[column]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Correlation Heatmap</div>
            <Heatmap matrix={datasetProfile.correlation} labels={datasetProfile.numericColumns} />
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}
