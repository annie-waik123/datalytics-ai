import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { buildDatasetSyncPayload, isBackendDatasetReady } from '../api/datasetSession.js'
import { useToast } from '../hooks/useToast.js'

const IDENTIFIER_HINTS = ['id', 'uuid', 'guid', 'index', 'serial', 'code', 'employeeid', 'empid']
const TARGET_HINTS = ['target', 'label', 'class', 'status', 'attrition', 'churn', 'outcome', 'result', 'response', 'category', 'segment', 'rating', 'score', 'sales', 'revenue', 'price', 'amount']

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function columnValues(dataset, column) {
  return (dataset?.rows || [])
    .map((row) => row?.[column])
    .filter((value) => value !== null && value !== undefined && value !== '')
}

function isNumericLike(value) {
  return Number.isFinite(Number(value))
}

function isIdentifierLike(column, values) {
  const normalized = normalizeName(column)
  if (IDENTIFIER_HINTS.some((hint) => normalized.includes(hint)) || normalized.endsWith('id')) {
    return true
  }
  if (values.length < 12) return false
  const uniqueRatio = new Set(values.map((value) => String(value))).size / values.length
  const numericRatio = values.filter(isNumericLike).length / values.length
  return uniqueRatio >= 0.98 && numericRatio >= 0.8
}

function inferTaskType(dataset, column) {
  const values = columnValues(dataset, column)
  if (!values.length) return 'Classification'
  const uniqueCount = new Set(values.map((value) => String(value))).size
  const numericRatio = values.filter(isNumericLike).length / values.length
  return numericRatio >= 0.8 && uniqueCount > Math.min(20, Math.max(6, Math.floor(values.length * 0.1)))
    ? 'Regression'
    : 'Classification'
}

function targetScore(dataset, column) {
  const values = columnValues(dataset, column)
  if (!values.length) return -1000

  const normalized = normalizeName(column)
  const uniqueCount = new Set(values.map((value) => String(value))).size
  const uniqueRatio = uniqueCount / values.length
  const numericRatio = values.filter(isNumericLike).length / values.length
  const identifierLike = isIdentifierLike(column, values)

  let score = 0
  if (TARGET_HINTS.some((hint) => normalized.includes(hint))) score += 40
  if (identifierLike) score -= 80
  if (uniqueCount >= 2 && uniqueCount <= Math.max(12, Math.floor(values.length * 0.2))) score += 25
  if (numericRatio >= 0.8 && uniqueCount > Math.min(20, Math.max(8, Math.floor(values.length * 0.1)))) score += 12
  if (uniqueRatio >= 0.98) score -= 20
  return score
}

function recommendTargetColumn(dataset) {
  const columns = dataset?.columns || []
  if (!columns.length) return ''
  const ranked = [...columns].sort((left, right) => targetScore(dataset, right) - targetScore(dataset, left))
  const best = ranked[0]
  if (best && targetScore(dataset, best) > -50) return best
  const nonIdentifier = columns.find((column) => !isIdentifierLike(column, columnValues(dataset, column)))
  return nonIdentifier || columns[0]
}

function buildAutomaticPayload(dataset, overrides = {}) {
  const target_col = overrides.target_col || recommendTargetColumn(dataset)
  return {
    target_col,
    task_type: overrides.task_type || inferTaskType(dataset, target_col),
    missing_strategy: overrides.missing_strategy || 'Fill with mode (all)',
    encode_method: overrides.encode_method || 'Label Encoding',
    scaling_method: overrides.scaling_method || 'StandardScaler',
    test_size: overrides.test_size || 0.2,
    random_state: Number(overrides.random_state) || 42,
  }
}

async function syncDatasetForPrediction(dataset) {
  if (isBackendDatasetReady(dataset)) {
    return
  }

  const payload = buildDatasetSyncPayload(dataset, { replaceOriginal: true })

  try {
    await client.post('/data/sync', payload)
  } catch (error) {
    if (error?.response?.status !== 404) throw error
    await client.post('/visualization/sync', payload)
  }
}

function payloadChanged(left, right) {
  const keys = ['target_col', 'task_type', 'missing_strategy', 'encode_method', 'scaling_method', 'test_size', 'random_state']
  return keys.some((key) => left?.[key] !== right?.[key])
}

export default function OnClickPred({ dataset, onPreprocessed, setStatus }) {
  const { addToast } = useToast()
  const columns = dataset?.columns || []

  const [targetCol, setTargetCol] = useState('')
  const [targetAuto, setTargetAuto] = useState(true)
  const [taskType, setTaskType] = useState('Classification')
  const [taskAuto, setTaskAuto] = useState(true)
  const [missingStrategy, setMissingStrategy] = useState('Fill with mode (all)')
  const [encoding, setEncoding] = useState('Label Encoding')
  const [scaling, setScaling] = useState('StandardScaler')
  const [testSize, setTestSize] = useState(20)
  const [randomState, setRandomState] = useState(42)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setTargetAuto(true)
  }, [dataset?.name, columns.join('|')])

  useEffect(() => {
    if (!columns.length) {
      setTargetCol('')
      return
    }
    if (!targetAuto && columns.includes(targetCol)) return
    const recommended = recommendTargetColumn(dataset)
    setTargetCol(recommended || columns[0])
  }, [columns, dataset, targetAuto, targetCol])

  useEffect(() => {
    if (!targetCol) return
    setTaskAuto(true)
  }, [targetCol])

  useEffect(() => {
    if (!taskAuto || !targetCol) return
    setTaskType(inferTaskType(dataset, targetCol))
  }, [dataset, targetCol, taskAuto])

  async function submitPreprocess(payload) {
    await syncDatasetForPrediction(dataset)
    return client.post('/preprocess', payload)
  }

  function applyResolvedState(responseData, payload) {
    const resolvedTarget = responseData?.target_col || payload.target_col
    const resolvedTask = responseData?.task_type || payload.task_type
    setTargetCol(resolvedTarget)
    setTaskType(resolvedTask)
    setTargetAuto(false)
    setTaskAuto(false)
    setWarnings(responseData?.encoding_warnings || [])
  }

  async function handleApply() {
    setLoading(true)
    setError(null)
    setWarnings([])
    setSuccess(false)

    const initialPayload = buildAutomaticPayload(dataset, {
      target_col: targetCol,
      task_type: taskType,
      missing_strategy: missingStrategy,
      encode_method: encoding,
      scaling_method: scaling,
      test_size: Number(testSize) / 100,
      random_state: Number(randomState),
    })

    try {
      let response
      let usedPayload = initialPayload
      try {
        response = await submitPreprocess(initialPayload)
      } catch (firstError) {
        const fallbackPayload = buildAutomaticPayload(dataset, {
          missing_strategy: 'Fill with mode (all)',
          encode_method: 'Label Encoding',
          scaling_method: scaling === 'None' ? 'None' : 'StandardScaler',
          test_size: 0.2,
          random_state: Number(randomState) || 42,
        })

        if (!payloadChanged(initialPayload, fallbackPayload)) {
          throw firstError
        }

        response = await submitPreprocess(fallbackPayload)
        usedPayload = fallbackPayload
        addToast('Preprocessing settings were adjusted automatically to keep the pipeline running.', null, 'success')
      }

      if (!response) return

      applyResolvedState(response.data, usedPayload)

      if (setStatus) {
        setStatus((s) => ({
          ...s,
          preprocessing_done: true,
          preprocess_data: response.data,
          supervised_done: false,
          unsupervised_done: false,
        }))
      }

      if (onPreprocessed) onPreprocessed(response.data)

      setSuccess(true)
      setTimeout(() => {
        if (setStatus) {
          setStatus((s) => ({ ...s, current_module: 'supervised' }))
        }
      }, 1200)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Preprocessing failed. Please check your data and parameters.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="step-header">
        <div>
          <h1 className="page-title">Data Preprocessing</h1>
          <p className="page-subtitle">Configure cleaning, encoding, and scaling before training models.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-title">Target Column & Task</div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label>Target Column</label>
            <select
              value={targetCol}
              onChange={(e) => {
                setTargetAuto(false)
                setTargetCol(e.target.value)
              }}
            >
              {columns.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Task Type</label>
            <div className="chip-group">
              {['Classification', 'Regression'].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`chip ${taskType === type ? 'is-active' : ''}`}
                  onClick={() => {
                    setTaskAuto(false)
                    setTaskType(type)
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-title">Missing Values</div>
        <div className="form-group">
          <label>Strategy</label>
          <select value={missingStrategy} onChange={(e) => setMissingStrategy(e.target.value)}>
            <option value="Drop rows with missing values">Drop rows with missing values</option>
            <option value="Fill with mean (numeric)">Fill with mean (numeric)</option>
            <option value="Fill with median (numeric)">Fill with median (numeric)</option>
            <option value="Fill with mode (all)">Fill with mode (all)</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-title">Encoding</div>
        <div className="chip-group">
          {['Label Encoding', 'One-Hot Encoding'].map((type) => (
            <button
              key={type}
              type="button"
              className={`chip ${encoding === type ? 'is-active' : ''}`}
              onClick={() => setEncoding(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-title">Feature Scaling</div>
        <div className="chip-group">
          {['None', 'StandardScaler', 'MinMaxScaler'].map((type) => (
            <button
              key={type}
              type="button"
              className={`chip ${scaling === type ? 'is-active' : ''}`}
              onClick={() => setScaling(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-title">Train-Test Split</div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label>Test Size: {testSize}%</label>
            <input
              type="range"
              min="10"
              max="50"
              value={testSize}
              onChange={(e) => setTestSize(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Random State</label>
            <input
              type="number"
              value={randomState}
              onChange={(e) => setRandomState(e.target.value)}
            />
          </div>
        </div>
      </div>

      {warnings.length ? (
        <div className="alert alert-warning">
          {warnings.join(' ')}
        </div>
      ) : null}
      {error && <div className="alert alert-warning">{error}</div>}
      {success && <div className="alert alert-success">Preprocessing complete. Supervised models are now unlocked.</div>}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={handleApply}
        disabled={loading || columns.length === 0}
      >
        {loading ? 'Processing...' : 'Apply Preprocessing'}
      </button>
    </div>
  )
}
