export default function ReportStep({ dataset, datasetProfile, predictionState, onComplete, onJumpToUpload }) {
  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to generate reports</h2>
        <p>Reports include charts, insights, and model performance.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const bestModel = predictionState.bestModel
  const metrics = bestModel?.metrics

  function downloadReport() {
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) return

    reportWindow.document.write(`
      <html>
        <head>
          <title>Analytics Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 8px; }
            .section { margin-top: 24px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Data Analytics Report</h1>
          <p>Dataset: ${dataset.name}</p>
          <div class="section">
            <h2>Summary</h2>
            <ul>
              <li>Rows: ${datasetProfile.rowCount}</li>
              <li>Columns: ${datasetProfile.columnCount}</li>
              <li>Missing values: ${datasetProfile.missingTotal}</li>
            </ul>
          </div>
          <div class="section">
            <h2>Best Model</h2>
            <p>${bestModel ? bestModel.name : 'Not selected yet'}</p>
          </div>
          <div class="section">
            <h2>Performance Metrics</h2>
            <table>
              <thead><tr><th>Metric</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Accuracy</td><td>${metrics ? (metrics.accuracy * 100).toFixed(1) + '%' : '--'}</td></tr>
                <tr><td>F1 Score</td><td>${metrics ? (metrics.f1 * 100).toFixed(1) + '%' : '--'}</td></tr>
                <tr><td>RMSE</td><td>${metrics ? metrics.rmse.toFixed(2) : '--'}</td></tr>
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `)
    reportWindow.document.close()
    reportWindow.focus()
    reportWindow.print()

    onComplete('reports')
  }

  return (
    <div className="report-container">
      <div className="report-header">
        <div>
          <h2 className="report-title">Reports</h2>
          <p className="report-subtitle">Generate a polished PDF report with charts, insights, and model performance.</p>
        </div>
        <div className="report-download-group">
          <button type="button" className="btn btn-primary" onClick={downloadReport}>Download PDF</button>
        </div>
      </div>

      <div className="report-stats-grid">
        <div className="report-stat-card">
          <div className="report-stat-icon">Rows</div>
          <div className="report-stat-val">{datasetProfile.rowCount.toLocaleString()}</div>
          <div className="report-stat-label">Total Rows</div>
        </div>
        <div className="report-stat-card">
          <div className="report-stat-icon">Columns</div>
          <div className="report-stat-val">{datasetProfile.columnCount}</div>
          <div className="report-stat-label">Total Columns</div>
        </div>
        <div className="report-stat-card">
          <div className="report-stat-icon">Missing</div>
          <div className="report-stat-val">{datasetProfile.missingTotal}</div>
          <div className="report-stat-label">Missing Values</div>
        </div>
        <div className="report-stat-card">
          <div className="report-stat-icon">Best Model</div>
          <div className="report-stat-val">{bestModel ? bestModel.name : 'Pending'}</div>
          <div className="report-stat-label">Auto Selected</div>
        </div>
      </div>

      <div className="report-section">
        <div className="report-section-title">Model Performance</div>
        <div className="report-quality-row">
          <div className="report-grade" style={{ background: 'rgba(16,185,129,0.2)' }}>
            {metrics ? 'A' : 'N/A'}
          </div>
          <div>
            <div className="report-quality-score">{metrics ? (metrics.accuracy * 100).toFixed(1) + '%' : '--'}</div>
            <div className="report-quality-label">Best model accuracy</div>
          </div>
        </div>
        <div className="report-quality-bars">
          <div className="report-q-bar-row">
            <span className="report-q-bar-label">Accuracy</span>
            <div className="report-q-bar-track">
              <div className="report-q-bar-fill" style={{ width: metrics ? `${metrics.accuracy * 100}%` : '0%', background: '#34d399' }} />
            </div>
            <span className="report-q-bar-val">{metrics ? (metrics.accuracy * 100).toFixed(0) : 0}</span>
          </div>
          <div className="report-q-bar-row">
            <span className="report-q-bar-label">F1</span>
            <div className="report-q-bar-track">
              <div className="report-q-bar-fill" style={{ width: metrics ? `${metrics.f1 * 100}%` : '0%', background: '#60a5fa' }} />
            </div>
            <span className="report-q-bar-val">{metrics ? (metrics.f1 * 100).toFixed(0) : 0}</span>
          </div>
          <div className="report-q-bar-row">
            <span className="report-q-bar-label">RMSE</span>
            <div className="report-q-bar-track">
              <div className="report-q-bar-fill" style={{ width: metrics ? `${Math.max(0, 100 - metrics.rmse * 60)}%` : '0%', background: '#fbbf24' }} />
            </div>
            <span className="report-q-bar-val">{metrics ? metrics.rmse.toFixed(2) : 0}</span>
          </div>
        </div>
      </div>

      <div className="report-section">
        <div className="report-section-title">Key Highlights</div>
        <div className="report-insights-list">
          <div className="report-insight-row" style={{ borderColor: '#60a5fa' }}>
            <div>
              <div className="report-insight-title">Top performing region identified</div>
              <div className="report-insight-desc">Focus inventory and sales enablement on the leading region to sustain momentum.</div>
            </div>
            <div className="report-insight-sev">INFO</div>
          </div>
          <div className="report-insight-row" style={{ borderColor: '#fbbf24' }}>
            <div>
              <div className="report-insight-title">Discount sensitivity detected</div>
              <div className="report-insight-desc">Higher discounts reduce profit margin. Consider tighter discount controls.</div>
            </div>
            <div className="report-insight-sev">WARN</div>
          </div>
          <div className="report-insight-row" style={{ borderColor: '#34d399' }}>
            <div>
              <div className="report-insight-title">Model performance is strong</div>
              <div className="report-insight-desc">Accuracy above target indicates reliable predictions for this dataset.</div>
            </div>
            <div className="report-insight-sev">GOOD</div>
          </div>
        </div>
      </div>
    </div>
  )
}
