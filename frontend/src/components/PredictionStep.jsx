import { useEffect, useRef } from 'react'
import { formatNumber, toNumber } from '../lib/dataUtils.js'

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
      <div className="empty-state">
        <h2>Upload data before training models</h2>
        <p>The prediction stage trains models, compares accuracy, and generates forecasts.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
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

      {/* Sequential Linear Layout - All sections visible */}
      <div className="prediction-linear-layout">
        
        {/* 1. Supervised Models Section */}
        <div className="prediction-section" data-section="1">
          <div className="prediction-section-header">
            <h2 className="section-title">Supervised Models</h2>
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
                        className="btn btn-secondary btn-sm"
                        onClick={() => startTraining(model.key)}
                      >
                        {modelState?.status === 'training' ? 'Training...' : 'Train'}
                      </button>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="model-metrics">
                      <span className="metric-pill">Accuracy: {modelState?.metrics ? (modelState.metrics.accuracy * 100).toFixed(1) + '%' : '--'}</span>
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
            <h2 className="section-title">Unsupervised Models</h2>
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
                        className="btn btn-secondary btn-sm"
                        onClick={() => runUnsupervised(model.key)}
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
                          <span className="metric-pill">Silhouette: {modelState?.metrics?.silhouette ?? '--'}</span>
                        </>
                      ) : (
                        <>
                          <span className="metric-pill">Variance: {modelState?.metrics?.variance ?? '--'}</span>
                          <span className="metric-pill">Components: {modelState?.metrics?.components ?? '--'}</span>
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
            <div className="card">
              <div className="table-wrap table-wrap-compact">
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
                        <tr key={model.key} className={isBest ? 'row-highlight' : ''}>
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
              <div className="best-model-actions">
                <button type="button" className="btn btn-primary" onClick={autoSelectBest}>
                  Auto-select Best Model
                </button>
                {predictionState.bestModel && (
                  <div className="best-model-pill">
                    Selected: {predictionState.bestModel.name} ({(predictionState.bestModel.metrics.accuracy * 100).toFixed(1)}%)
                  </div>
                )}
              </div>
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
            <div className="grid-2">
              <div className="card">
                <div className="section-title">Single Prediction</div>
                <div className="form-row form-row-2">
                  {numericColumns.map(column => (
                    <div key={column} className="form-group">
                      <label>{column}</label>
                      <input
                        type="number"
                        value={predictionState.inputs?.[column] || ''}
                        onChange={event => updateInput(column, event.target.value)}
                        placeholder={`Enter ${column}`}
                      />
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-primary" onClick={runPrediction}>Run Prediction</button>
              </div>

              <div className="card">
                <div className="section-title">Batch Prediction</div>
                <p className="section-copy">Runs predictions for the first 6 rows in the dataset.</p>
                <button type="button" className="btn btn-secondary" onClick={runBatchPrediction}>Run Batch</button>
                <div className="batch-preview">
                  {predictionState.batchPredictions.length ? (
                    <ul>
                      {predictionState.batchPredictions.map(row => (
                        <li key={row.id}>Row {row.id}: {formatNumber(row.prediction)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-text">No batch predictions yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div className="section-title">Prediction Results</div>
              {predictionState.predictions.length ? (
                <div className="prediction-results">
                  {predictionState.predictions.map(item => (
                    <div key={item.id} className="prediction-result">
                      <div>
                        <div className="prediction-value">{formatNumber(item.output)}</div>
                        <div className="prediction-meta">{item.model}</div>
                      </div>
                      <div className="prediction-time">{item.time}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">Run a prediction to view results.</p>
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
            <div className="card">
              <div className="section-title">Download Results</div>
              <p className="section-copy">Download the prediction output as a CSV file for reporting or sharing.</p>
              <div className="download-actions">
                <button type="button" className="btn btn-primary" onClick={downloadCsv}>Download CSV</button>
                <span className="download-meta">{predictionState.predictions.length} predictions ready</span>
              </div>
              {predictionState.downloadReady && (
                <div className="alert alert-success">Predictions downloaded successfully.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
