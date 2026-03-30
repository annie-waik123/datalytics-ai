import { useState } from 'react'
import client from '../api/client.js'

const MISSING_OPTS = [
  'Drop rows with missing values',
  'Fill with mean (numeric)',
  'Fill with median (numeric)',
  'Fill with mode (all)',
]
const ENCODE_OPTS  = ['LABEL ENCODING', 'ONE-HOT ENCODING']
const SCALING_OPTS = ['NONE', 'STANDARDSCALER', 'MINMAXSCALER']

export default function PreprocessStep({ uploadData, onPreprocessed, setStatus }) {
  const columns = uploadData?.all_columns || []
  const hasMissing = (uploadData?.missing_total || 0) > 0
  const isLargeDataset = (uploadData?.rows || 0) >= 150000

  const [targetCol,       setTargetCol]       = useState(columns[columns.length - 1] || '')
  const [taskType,        setTaskType]         = useState('CLASSIFICATION')
  const [missingStrategy, setMissingStrategy]  = useState(MISSING_OPTS[1])
  const [encodeMethod,    setEncodeMethod]     = useState('LABEL ENCODING')
  const [scalingMethod,   setScalingMethod]    = useState('STANDARDSCALER')
  const [testSize,        setTestSize]         = useState(20)
  const [randomState,     setRandomState]      = useState(42)
  const [loading,         setLoading]          = useState(false)
  const [error,           setError]            = useState(null)
  const [result,          setResult]           = useState(null)

  if (!uploadData) return (
    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>⚠️ Please upload a dataset first to begin preprocessing.</p>
    </div>
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res = await client.post('/preprocess', {
        target_col:       targetCol,
        task_type:        taskType.charAt(0) + taskType.slice(1).toLowerCase(),
        missing_strategy: hasMissing ? missingStrategy : null,
        encode_method:    encodeMethod.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '),
        scaling_method:   scalingMethod === 'NONE' ? 'None' : (scalingMethod === 'STANDARDSCALER' ? 'StandardScaler' : 'MinMaxScaler'),
        test_size:        testSize / 100,
        random_state:     Number(randomState),
      })
      setResult(res.data)
      onPreprocessed(res.data)
      setStatus(s => ({ ...s, preprocessing_done: true, supervised_done: false }))
    } catch (e) {
      setError(e.response?.data?.detail || 'Preprocessing failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="preprocess-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 className="page-title" style={{ marginBottom: '2rem' }}>Data Preprocessing</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Target Column Section */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', color: 'var(--primary)', fontWeight: '600' }}>
            <span>🎯</span> Target Column
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Target Column</label>
              <select 
                value={targetCol} 
                onChange={e => setTargetCol(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', width: '100%', color: 'white' }}
              >
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Task Type</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {['CLASSIFICATION', 'REGRESSION'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTaskType(type)}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: taskType === type ? 'var(--primary)' : 'var(--border)',
                      background: taskType === type ? 'rgba(255, 106, 0, 0.1)' : 'rgba(255,255,255,0.03)',
                      color: taskType === type ? 'white' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: taskType === type ? '0 0 15px rgba(255, 106, 0, 0.2)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {type === 'CLASSIFICATION' ? '🏷️' : '📈'} {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Missing Values Section */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', color: 'var(--primary)', fontWeight: '600' }}>
            <span>🖌️</span> Handle Missing Values
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Strategy</label>
            <select 
              value={missingStrategy} 
              onChange={e => setMissingStrategy(e.target.value)}
              disabled={!hasMissing}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', width: '100%', color: hasMissing ? 'white' : 'var(--text-muted)' }}
            >
              {!hasMissing ? <option>No missing values detected</option> : MISSING_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Encoding Section */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', color: 'var(--primary)', fontWeight: '600' }}>
            <span>🔠</span> Encode Categorical Variables
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {ENCODE_OPTS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setEncodeMethod(opt)}
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: encodeMethod === opt ? 'var(--primary)' : 'var(--border)',
                  background: encodeMethod === opt ? 'rgba(255, 106, 0, 0.1)' : 'rgba(255,255,255,0.03)',
                  color: encodeMethod === opt ? 'white' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: encodeMethod === opt ? '0 0 15px rgba(255, 106, 0, 0.2)' : 'none'
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Scaling Section */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', color: 'var(--primary)', fontWeight: '600' }}>
            <span>📏</span> Feature Scaling
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {SCALING_OPTS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setScalingMethod(opt)}
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: scalingMethod === opt ? 'var(--primary)' : 'var(--border)',
                  background: scalingMethod === opt ? 'rgba(255, 106, 0, 0.1)' : 'rgba(255,255,255,0.03)',
                  color: scalingMethod === opt ? 'white' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: scalingMethod === opt ? '0 0 15px rgba(255, 106, 0, 0.2)' : 'none'
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Train-Test Split Section */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', color: 'var(--primary)', fontWeight: '600' }}>
            <span>✂️</span> Train-Test Split
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'end' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Test Size: {testSize}%</label>
              </div>
              <input 
                type="range" 
                min={10} max={50} 
                value={testSize}
                onChange={e => setTestSize(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Random State</label>
              <input 
                type="number" 
                value={randomState} 
                onChange={e => setRandomState(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', width: '100%', color: 'white' }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          style={{
            marginTop: '1rem',
            padding: '1.25rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(90deg, #00d4ff, #7c3aed)',
            color: 'white',
            fontWeight: '700',
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 8px 25px rgba(0, 212, 255, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 212, 255, 0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 212, 255, 0.3)'; }}
        >
          {loading ? '⏳ Processing...' : '🚀 Apply Preprocessing'}
        </button>
      </form>

      {/* Results Section */}
      {result && !loading && (
        <div className="glass-panel" style={{ marginTop: '2.5rem', padding: '2rem' }}>
          <div style={{ color: 'var(--success)', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ✅ Preprocessing Complete!
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="metric-card" style={{ textAlign: 'center' }}>
              <div className="metric-label">Total Samples</div>
              <div className="metric-value">{result.total_size.toLocaleString()}</div>
            </div>
            <div className="metric-card" style={{ textAlign: 'center' }}>
              <div className="metric-label">Train Samples</div>
              <div className="metric-value">{result.train_size.toLocaleString()}</div>
            </div>
            <div className="metric-card" style={{ textAlign: 'center' }}>
              <div className="metric-label">Test Samples</div>
              <div className="metric-value">{result.test_size.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Feature Columns ({result.feature_columns?.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {result.feature_columns?.map(c => (
              <span key={c} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', fontSize: '0.75rem' }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
