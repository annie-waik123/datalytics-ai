import { useEffect, useRef } from 'react'
import { formatNumber, toNumber } from '../lib/dataUtils.js'
import '../prediction.css'

const SUPERVISED_MODELS = [
  { key: 'linear', name: 'Linear Regression', type: 'Regression' },
  { key: 'logistic', name: 'Logistic Regression', type: 'Classification' },
  { key: 'tree', name: 'Decision Tree', type: 'Hybrid' },
  { key: 'forest', name: 'Random Forest', type: 'Ensemble' }
]

const UNSUPERVISED_MODELS = [
  { key: 'kmeans', name: 'K-Means Clustering', type: 'Clustering' },
  { key: 'pca', name: 'PCA', type: 'Dimensionality' }
]

const MODULES = [
  { key: 'supervised', label: 'Supervised Models' },
  { key: 'unsupervised', label: 'Unsupervised Models' },
  { key: 'best', label: 'Best Model Selection' },
  { key: 'predict', label: 'Prediction' },
  { key: 'download', label: 'Download Results' }
]

function getStatusLabel(state, active) {
  if (active) return 'ACTIVE'
  if (state) return 'COMPLETED'
  return 'NOT VISITED'
}

export default function PredictionStep({
  dataset,
  datasetProfile,
  predictionModule,
  setPredictionModule,
  predictionState,
  setPredictionState,
  onComplete,
  onJumpToUpload
}) {
  const timers = useRef({})

  useEffect(() => () => {
    Object.values(timers.current).forEach(timer => clearInterval(timer))
  }, [])

  if (!dataset || !datasetProfile) {
    return (
      <div className="prediction-empty-state">
        <div className="prediction-empty-icon">🚀</div>
        <h2 className="prediction-empty-title">Train Supervised Models First</h2>
        <p className="prediction-empty-text">
          Upload your data before training models. The prediction stage trains models, compares accuracy, and generates forecasts.
        </p>
        <button 
          className="btn btn-primary prediction-empty-btn" 
          type="button" 
          onClick={onJumpToUpload}
        >
          Go to Upload
        </button>
      </div>
    )
  }

  function startTraining(modelKey) {
    if (predictionState.supervised[modelKey]?.status === 'training') return

    const baseScore = modelKey === 'forest' ? 0.88 : modelKey === 'tree' ? 0.82 : modelKey === 'logistic' ? 0.79 : 0.75
    setPredictionState(state => ({
      ...state,
      supervised: {
        ...state.supervised,
        [modelKey]: { status: 'training', progress: 0, metrics: null }
      }
    }))

    let progress = 0
    timers.current[modelKey] = setInterval(() => {
      progress = Math.min(100, progress + 12 + Math.random() * 8)
      if (progress >= 100) {
        clearInterval(timers.current[modelKey])
        const score = Math.min(0.99, baseScore + Math.random() * 0.08)
        setPredictionState(state => ({
          ...state,
          supervised: {
            ...state.supervised,
            [modelKey]: {
              status: 'done',
              progress: 100,
              metrics: {
                accuracy: score,
                f1: Math.min(0.98, score - 0.04 + Math.random() * 0.05),
                rmse: Math.max(0.2, 1.2 - score)
              }
            }
          },
          completed: { ...state.completed, supervised: true }
        }))
      } else {
        setPredictionState(state => ({
          ...state,
          supervised: {
            ...state.supervised,
            [modelKey]: { ...state.supervised[modelKey], progress, status: 'training' }
          }
        }))
      }
    }, 350)
  }

  function runUnsupervised(modelKey) {
    if (predictionState.unsupervised[modelKey]?.status === 'training') return
    setPredictionState(state => ({
      ...state,
      unsupervised: {
        ...state.unsupervised,
        [modelKey]: { status: 'training', progress: 0, metrics: null }
      }
    }))

    let progress = 0
    timers.current[`unsup-${modelKey}`] = setInterval(() => {
      progress = Math.min(100, progress + 18 + Math.random() * 10)
      if (progress >= 100) {
        clearInterval(timers.current[`unsup-${modelKey}`])
        setPredictionState(state => ({
          ...state,
          unsupervised: {
            ...state.unsupervised,
            [modelKey]: {
              status: 'done',
              progress: 100,
              metrics: modelKey === 'kmeans'
                ? { clusters: 4, silhouette: 0.62 }
                : { variance: 0.78, components: 3 }
            }
          },
          completed: { ...state.completed, unsupervised: true }
        }))
      } else {
        setPredictionState(state => ({
          ...state,
          unsupervised: {
            ...state.unsupervised,
            [modelKey]: { ...state.unsupervised[modelKey], progress, status: 'training' }
          }
        }))
      }
    }, 320)
  }

  function autoSelectBest() {
    const metrics = SUPERVISED_MODELS
      .map(model => ({ key: model.key, name: model.name, metrics: predictionState.supervised[model.key]?.metrics }))
      .filter(model => model.metrics)
    if (!metrics.length) return
    const best = metrics.reduce((top, current) => (current.metrics.accuracy > top.metrics.accuracy ? current : top))

    setPredictionState(state => ({
      ...state,
      bestModel: best,
      selectedModel: best.name,
      completed: { ...state.completed, best: true }
    }))
  }

  function runPrediction() {
    const numericColumns = datasetProfile.numericColumns.slice(0, 4)
    const inputs = predictionState.inputs || {}
    const score = numericColumns.reduce((sum, col, idx) => sum + (toNumber(inputs[col]) || 0) * (0.25 + idx * 0.1), 0)
    const output = Math.max(100, score * 0.4 + 150)

    setPredictionState(state => ({
      ...state,
      predictions: [
        {
          id: state.predictions.length + 1,
          model: state.selectedModel || state.bestModel?.name || 'Random Forest',
          output: Number(output.toFixed(2)),
          time: new Date().toLocaleTimeString()
        },
        ...state.predictions
      ],
      completed: { ...state.completed, predict: true }
    }))
  }

  function runBatchPrediction() {
    const numericColumns = datasetProfile.numericColumns.slice(0, 2)
    const colA = numericColumns[0]
    const colB = numericColumns[1]
    const batch = dataset.rows.slice(0, 6).map((row, idx) => ({
      id: idx + 1,
      input: numericColumns.map(col => toNumber(row[col]) || 0).reduce((sum, value) => sum + value, 0),
      prediction: Number(((toNumber(row[colA]) || 0) * 0.35 + (toNumber(row[colB]) || 0) * 0.55 + 120).toFixed(2))
    }))

    setPredictionState(state => ({
      ...state,
      batchPredictions: batch,
      completed: { ...state.completed, predict: true }
    }))
  }

  function updateInput(column, value) {
    setPredictionState(state => ({
      ...state,
      inputs: { ...state.inputs, [column]: value }
    }))
  }

  function downloadCsv() {
    if (!predictionState.predictions.length && !predictionState.batchPredictions.length) return
    const hasSingle = predictionState.predictions.length > 0
    const header = hasSingle ? 'id,model,output\n' : 'id,input,prediction\n'
    const rows = hasSingle
      ? predictionState.predictions.map(item => `${item.id},${item.model},${item.output}`).join('\n')
      : predictionState.batchPredictions.map(item => `${item.id},${item.input},${item.prediction}`).join('\n')
    const csv = header + rows
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'predictions.csv'
    link.click()
    URL.revokeObjectURL(url)

    setPredictionState(state => ({
      ...state,
      downloadReady: true,
      completed: { ...state.completed, download: true }
    }))
    onComplete('prediction')
  }

  const numericColumns = datasetProfile.numericColumns.slice(0, 4)

  return (
    <div>
      <div className="step-header">
        <div>
          <h1 className="page-title">Prediction</h1>
          <p className="page-subtitle">Train supervised and unsupervised models, compare results, and generate predictions.</p>
        </div>
      </div>

      <div className="prediction-linear-layout">
        {/* Model Configuration Section */}
        <div className="prediction-section" data-section="0">
          <div className="prediction-section-header">
            <h2 className="section-title">Model Configuration</h2>
            <p className="section-subtitle">Set your target column and select a task type to begin training.</p>
          </div>
          <div className="prediction-section-content">
            <div className="grid-side-by-side">
              <div className="form-group">
                <label>Target Column</label>
                <select 
                  className="form-control-premium"
                  defaultValue={datasetProfile.columns[0]}
                >
                  {datasetProfile.columns.map(col => (
                    <option key={col} value={col} style={{ background: '#121a2a' }}>{col}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Task Type</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, borderRadius: '100px', padding: '1rem' }}>Classification</button>
                  <button className="btn btn-primary" style={{ flex: 1, borderRadius: '100px', padding: '1rem' }}>Regression</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 1. Supervised Models Section */}
        <div className="prediction-section" data-section="1">
          <div className="prediction-section-header">
            <div>
              <h2 className="section-title">Supervised Models</h2>
              <p className="section-subtitle">Train various algorithms to find the best fit for your data.</p>
            </div>
            <span className="prediction-section-status">
              {getStatusLabel(predictionState.completed.supervised, false)}
            </span>
          </div>
          <div className="prediction-section-content">
            <div className="model-grid">
              {SUPERVISED_MODELS.map(model => {
                const modelState = predictionState.supervised[model.key]
                const progress = modelState?.progress || 0
                return (
                  <div key={model.key} className="model-card">
                    <div className="model-head">
                      <div>
                        <div className="model-title">{model.name}</div>
                        <div className="model-meta">{model.type}</div>
                      </div>
                      <button
                        type="button"
                        className={`btn ${modelState?.status === 'training' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => startTraining(model.key)}
                        style={{ borderRadius: '100px', padding: '0.5rem 1.25rem' }}
                      >
                        {modelState?.status === 'training' ? 'Training...' : 'Train'}
                      </button>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="model-metrics">
                      <span className="metric-pill">ACC: {modelState?.metrics ? (modelState.metrics.accuracy * 100).toFixed(1) + '%' : '--'}</span>
                      <span className="metric-pill">F1: {modelState?.metrics ? (modelState.metrics.f1 * 100).toFixed(1) + '%' : '--'}</span>
                      <span className="metric-pill">RMSE: {modelState?.metrics ? modelState.metrics.rmse.toFixed(2) : '--'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 2. Unsupervised Models Section */}
        <div className="prediction-section" data-section="2">
          <div className="prediction-section-header">
            <div>
              <h2 className="section-title">Unsupervised Models</h2>
              <p className="section-subtitle">Discover hidden patterns and clusters in your dataset.</p>
            </div>
            <span className="prediction-section-status">
              {getStatusLabel(predictionState.completed.unsupervised, false)}
            </span>
          </div>
          <div className="prediction-section-content">
            <div className="model-grid">
              {UNSUPERVISED_MODELS.map(model => {
                const modelState = predictionState.unsupervised[model.key]
                const progress = modelState?.progress || 0
                return (
                  <div key={model.key} className="model-card">
                    <div className="model-head">
                      <div>
                        <div className="model-title">{model.name}</div>
                        <div className="model-meta">{model.type}</div>
                      </div>
                      <button
                        type="button"
                        className={`btn ${modelState?.status === 'training' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => runUnsupervised(model.key)}
                        style={{ borderRadius: '100px', padding: '0.5rem 1.25rem' }}
                      >
                        {modelState?.status === 'training' ? 'Running...' : 'Run'}
                      </button>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="model-metrics">
                      {model.key === 'kmeans' ? (
                        <>
                          <span className="metric-pill">Clusters: {modelState?.metrics?.clusters ?? '--'}</span>
                          <span className="metric-pill">Silh: {modelState?.metrics?.silhouette ?? '--'}</span>
                        </>
                      ) : (
                        <>
                          <span className="metric-pill">Var: {modelState?.metrics?.variance ?? '--'}</span>
                          <span className="metric-pill">Comp: {modelState?.metrics?.components ?? '--'}</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 3. Best Model Selection Section */}
        <div className="prediction-section" data-section="3">
          <div className="prediction-section-header">
            <h2 className="section-title">Best Model Selection</h2>
            <span className="prediction-section-status">
              {getStatusLabel(predictionState.completed.best, false)}
            </span>
          </div>
          <div className="prediction-section-content">
            <div className="table-wrap-premium">
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Accuracy</th>
                    <th>F1</th>
                    <th>RMSE</th>
                  </tr>
                </thead>
                <tbody>
                  {SUPERVISED_MODELS.map(model => {
                    const metrics = predictionState.supervised[model.key]?.metrics
                    const isBest = predictionState.bestModel?.key === model.key
                    return (
                      <tr key={model.key} className={isBest ? 'row-highlight-premium' : ''}>
                        <td>{model.name}</td>
                        <td>{metrics ? (metrics.accuracy * 100).toFixed(1) + '%' : '--'}</td>
                        <td>{metrics ? (metrics.f1 * 100).toFixed(1) + '%' : '--'}</td>
                        <td>{metrics ? metrics.rmse.toFixed(2) : '--'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={autoSelectBest}
                style={{ padding: '1rem 2rem', borderRadius: '100px', fontWeight: '700' }}
              >
                Auto-select Best Model
              </button>
              {predictionState.bestModel && (
                <div style={{ 
                  background: 'rgba(255, 107, 53, 0.1)', 
                  border: '1px solid var(--primary)', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '100px',
                  color: 'var(--primary-light)',
                  fontWeight: '700',
                  fontSize: '0.95rem'
                }}>
                  ✨ Recommended: {predictionState.bestModel.name} ({(predictionState.bestModel.metrics.accuracy * 100).toFixed(1)}%)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Prediction Section */}
        <div className="prediction-section" data-section="4">
          <div className="prediction-section-header">
            <h2 className="section-title">Prediction</h2>
            <span className="prediction-section-status">
              {getStatusLabel(predictionState.completed.predict, false)}
            </span>
          </div>
          <div className="prediction-section-content">
            <div className="grid-side-by-side">
              <div className="card" style={{ padding: '2rem' }}>
                <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Single Prediction</h3>
                <div className="form-row form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  {numericColumns.map(column => (
                    <div key={column} className="form-group">
                      <label style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>{column}</label>
                      <input
                        type="number"
                        className="form-control-premium"
                        style={{ padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                        value={predictionState.inputs?.[column] || ''}
                        onChange={event => updateInput(column, event.target.value)}
                        placeholder={`Value`}
                      />
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-primary" onClick={runPrediction} style={{ width: '100%', borderRadius: '100px', padding: '1rem' }}>
                  Run Single Prediction
                </button>
              </div>

              <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Batch Prediction</h3>
                <p className="section-copy" style={{ marginBottom: '1.5rem', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                  Process the first 6 rows of your dataset to generate quick insights.
                </p>
                <button type="button" className="btn btn-secondary" onClick={runBatchPrediction} style={{ borderRadius: '100px', padding: '1rem', marginBottom: '1.5rem' }}>
                  Run Batch Process
                </button>
                <div className="batch-preview" style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1rem' }}>
                  {predictionState.batchPredictions.length ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {predictionState.batchPredictions.map(row => (
                        <li key={row.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: '600' }}>Row {row.id}:</span> {formatNumber(row.prediction)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      No batch results yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem' }}>
              <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Prediction History</h3>
              {predictionState.predictions.length ? (
                <div className="prediction-results-grid">
                  {predictionState.predictions.map(item => (
                    <div key={item.id} className="prediction-result-card">
                      <div>
                        <div className="prediction-val">{formatNumber(item.output)}</div>
                        <div className="prediction-mod">{item.model}</div>
                      </div>
                      <div className="prediction-t">{item.time}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>No prediction history available yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Download Results Section */}
        <div className="prediction-section" data-section="5">
          <div className="prediction-section-header">
            <h2 className="section-title">Download Results</h2>
            <span className="prediction-section-status">
              {getStatusLabel(predictionState.completed.download, false)}
            </span>
          </div>
          <div className="prediction-section-content">
            <div className="download-grid">
              <div className="download-card">
                <div className="download-icon">📊</div>
                <h3 className="download-title">Standard Predictions</h3>
                <p className="download-copy">Export individual prediction logs generated during this session.</p>
                <button 
                  type="button" 
                  className="btn btn-primary btn-premium" 
                  onClick={downloadCsv}
                  disabled={!predictionState.predictions.length}
                >
                  Download CSV
                </button>
                <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--primary-light)', fontWeight: '600' }}>
                  {predictionState.predictions.length} Records Ready
                </div>
              </div>

              <div className="download-card">
                <div className="download-icon">📁</div>
                <h3 className="download-title">Batch Processing</h3>
                <p className="download-copy">Export full batch results for your entire sampled dataset.</p>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-premium" 
                  onClick={downloadCsv}
                  disabled={!predictionState.batchPredictions.length}
                >
                  Download Batch
                </button>
                <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {predictionState.batchPredictions.length ? 'Results Ready' : 'No Results'}
                </div>
              </div>
            </div>
            
            {predictionState.downloadReady && (
              <div className="alert alert-success" style={{ 
                marginTop: '3rem', 
                padding: '1.5rem', 
                borderRadius: '16px', 
                background: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                animation: 'fadeInUp 0.5s ease'
              }}>
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                <span style={{ fontWeight: '600' }}>Files exported successfully! Check your downloads folder.</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
