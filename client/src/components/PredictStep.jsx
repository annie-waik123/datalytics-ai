import { useEffect, useState } from 'react'
import client from '../api/client.js'

export default function PredictStep({ trainData, status, setStatus }) {
  const [featureInfo, setFeatureInfo] = useState(null)
  const [inputs, setInputs] = useState({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!trainData && !status.supervised_done) {
      return
    }

    client.get('/feature-info')
      .then(res => {
        setFeatureInfo(res.data)
        const defaults = {}
        const labelDefaults = res.data.le_defaults || {}
        Object.entries(labelDefaults).forEach(([feature, value]) => {
          defaults[feature] = value
        })
        Object.entries(res.data.ohe_groups || {}).forEach(([originalColumn, info]) => {
          defaults[`__ohe__${originalColumn}`] = info.options?.[0] || ''
          info.feat_val_pairs?.forEach(([feature]) => {
            defaults[feature] = 0
          })
        })
        Object.entries(res.data.feature_stats || {}).forEach(([feature, stats]) => {
          defaults[feature] = stats.median ?? 0
        })
        setInputs(defaults)
      })
      .catch(() => setError('Failed to load feature info.'))
  }, [trainData, status.supervised_done])

  if (!trainData && !status.supervised_done) {
    return <div className="alert alert-warning">Please train models first.</div>
  }

  if (!featureInfo) {
    return <div className="spinner-wrap"><div className="spinner" /><span>Loading feature info...</span></div>
  }

  function handleOheChange(originalColumn, info, chosenValue) {
    const update = { [`__ohe__${originalColumn}`]: chosenValue }
    info.feat_val_pairs?.forEach(([feature, value]) => {
      update[feature] = chosenValue === value ? 1 : 0
    })
    setInputs(current => ({ ...current, ...update }))
  }

  async function handlePredict(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const featureValues = {}
    featureInfo.feature_columns.forEach(feature => {
      if (label_encoded_feats[feature]) {
        const classes = label_encoded_feats[feature]
        const selected = inputs[feature] ?? classes[0]
        const encoded = classes.indexOf(selected)
        featureValues[feature] = encoded >= 0 ? encoded : 0
        return
      }

      const rawValue = inputs[feature]
      const numericValue = Number(rawValue ?? 0)
      featureValues[feature] = Number.isFinite(numericValue) ? numericValue : 0
    })

    try {
      const res = await client.post('/predict', { feature_values: featureValues })
      setResult(res.data)
      setHistory(current => [...current, { ...featureValues, Prediction: res.data.prediction }])
      setStatus(current => ({ ...current, has_predictions: true, download_ready: true }))
    } catch (e) {
      setError(e.response?.data?.detail || 'Prediction failed.')
    } finally {
      setLoading(false)
    }
  }

  const { label_encoded_feats, ohe_groups, numeric_feats, feature_stats } = featureInfo

  return (
    <div>
      <h1 className="page-title">Make Predictions</h1>
      <hr className="divider" />

      <div className="alert alert-info">
        Using <strong>{trainData?.best_model_name || status.best_model_name}</strong> for {(trainData?.task_type || status.task_type || '').toLowerCase()} predictions.
      </div>

      <form onSubmit={handlePredict}>
        {Object.keys(label_encoded_feats).length > 0 && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="section-title">Categorical Features</div>
            <div className="form-row form-row-3">
              {Object.entries(label_encoded_feats).map(([feature, classes]) => (
                <div className="form-group" key={feature}>
                  <label>{feature}</label>
                  <select
                    value={inputs[feature] || classes[0]}
                    onChange={e => setInputs(current => ({ ...current, [feature]: e.target.value }))}
                  >
                    {classes.map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(ohe_groups).length > 0 && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="section-title">Category Features (One-Hot Encoded)</div>
            <div className="form-row form-row-3">
              {Object.entries(ohe_groups).map(([originalColumn, info]) => (
                <div className="form-group" key={originalColumn}>
                  <label>{originalColumn}</label>
                  <select
                    value={inputs[`__ohe__${originalColumn}`] || info.options?.[0]}
                    onChange={e => handleOheChange(originalColumn, info, e.target.value)}
                  >
                    {info.options?.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {numeric_feats?.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="section-title">Numeric Features</div>
            <div className="form-row form-row-3">
              {numeric_feats.map(feature => {
                const stats = feature_stats[feature] || {}
                return (
                  <div className="form-group" key={feature}>
                    <label>{feature}</label>
                    <input
                      type="number"
                      step="any"
                      value={inputs[feature] ?? stats.median ?? 0}
                      onChange={e => setInputs(current => ({ ...current, [feature]: e.target.value }))}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {error && <div className="alert alert-warning">{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Predicting...' : 'Predict'}
        </button>
      </form>

      {result && !loading && (
        <div className="pred-result">
          <div className="pred-result-label">Prediction Result</div>
          <div className="pred-result-value">{result.prediction}</div>
          <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            via {result.model_used} | {result.task_type}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <>
          <div className="section-title">Prediction History ({history.length})</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{Object.keys(history[0]).map(key => <th key={key}>{key}</th>)}</tr>
              </thead>
              <tbody>
                {history.map((row, index) => (
                  <tr key={index}>
                    {Object.entries(row).map(([key, value]) => (
                      <td key={key} className={key === 'Prediction' ? 'best' : ''}>
                        {typeof value === 'number' ? value.toFixed(4) : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
