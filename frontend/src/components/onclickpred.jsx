import React, { useState, useEffect } from 'react';
import client from '../api/client.js';

export default function OnClickPred({ dataset, onPreprocessed, setStatus }) {
  const columns = dataset?.columns || [];
  
  // State for preprocessing options
  const [targetCol, setTargetCol] = useState(columns[0] || '');
  const [taskType, setTaskType] = useState('Classification');
  const [missingStrategy, setMissingStrategy] = useState('Fill with mean (numeric)');
  const [encoding, setEncoding] = useState('Label Encoding');
  const [scaling, setScaling] = useState('StandardScaler');
  const [testSize, setTestSize] = useState(20);
  const [randomState, setRandomState] = useState(42);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Sync targetCol when columns change
  useEffect(() => {
    if (columns.length > 0 && !columns.includes(targetCol)) {
      setTargetCol(columns[0]);
    }
  }, [columns, targetCol]);

  async function handleApply() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const payload = {
        target_col: targetCol,
        task_type: taskType,
        missing_strategy: missingStrategy,
        encode_method: encoding,
        scaling_method: scaling,
        test_size: testSize / 100,
        random_state: Number(randomState),
      };

      const res = await client.post('/preprocess', payload);
      
      if (setStatus) {
        setStatus(s => ({ 
          ...s, 
          preprocessing_done: true,
          preprocess_data: res.data,
          supervised_done: false,
          unsupervised_done: false
        }));
      }
      
      setSuccess(true);
      // Auto-switch to next step after success
      setTimeout(() => {
        if (setStatus) {
          setStatus(s => ({ ...s, current_module: 'supervised' }));
        }
      }, 1500);
    } catch (err) {
      console.error('Preprocessing failed:', err);
      setError(err.response?.data?.detail || 'Preprocessing failed. Please check your data and parameters.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modern-preprocess-container" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 className="page-title" style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: '2rem', color: '#fff' }}>
        Data Preprocessing
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Section 1: Target Column */}
        <div className="glass-card" style={{ padding: '28px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '1.2rem' }}>🎯</span>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Target Column</span>
          </div>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>
                Target Column
              </label>
              <select 
                value={targetCol}
                onChange={(e) => setTargetCol(e.target.value)}
                style={{ width: '100%', background: '#0d1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px', color: '#fff', outline: 'none' }}
              >
                {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>
                Task Type
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['Classification', 'Regression'].map(type => (
                  <button
                    key={type}
                    onClick={() => setTaskType(type)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: taskType === type ? '1px solid #ff6a00' : '1px solid rgba(255,255,255,0.1)',
                      background: taskType === type ? 'rgba(255,106,0,0.1)' : 'rgba(255,255,255,0.02)',
                      color: taskType === type ? '#ff6a00' : 'rgba(255,255,255,0.5)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: taskType === type ? '0 0 15px rgba(255,106,0,0.15)' : 'none'
                    }}
                  >
                    {type === 'Classification' ? '🏷️ ' : '📈 '} {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Missing Values */}
        <div className="glass-card" style={{ padding: '28px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '1.2rem' }}>🖌️</span>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Handle Missing Values</span>
          </div>
          <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>
            Strategy
          </label>
          <select 
            value={missingStrategy}
            onChange={(e) => setMissingStrategy(e.target.value)}
            style={{ width: '100%', background: '#0d1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px', color: '#fff', outline: 'none' }}
          >
            <option value="Drop rows with missing values">Drop rows with missing values</option>
            <option value="Fill with mean (numeric)">Fill with mean (numeric)</option>
            <option value="Fill with median (numeric)">Fill with median (numeric)</option>
            <option value="Fill with mode (all)">Fill with mode (all)</option>
          </select>
        </div>

        {/* Section 3: Encoding */}
        <div className="glass-card" style={{ padding: '28px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '1.2rem' }}>📋</span>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Encode Categorical Variables</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['Label Encoding', 'One-Hot Encoding'].map(type => (
              <button
                key={type}
                onClick={() => setEncoding(type)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: encoding === type ? '1px solid #ff6a00' : '1px solid rgba(255,255,255,0.1)',
                  background: encoding === type ? 'rgba(255,106,0,0.1)' : 'rgba(255,255,255,0.02)',
                  color: encoding === type ? '#ff6a00' : 'rgba(255,255,255,0.5)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Scaling */}
        <div className="glass-card" style={{ padding: '28px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚖️</span>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Feature Scaling</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['None', 'StandardScaler', 'MinMaxScaler'].map(type => (
              <button
                key={type}
                onClick={() => setScaling(type)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: scaling === type ? '1px solid #ff6a00' : '1px solid rgba(255,255,255,0.1)',
                  background: scaling === type ? 'rgba(255,106,0,0.1)' : 'rgba(255,255,255,0.02)',
                  color: scaling === type ? '#ff6a00' : 'rgba(255,255,255,0.5)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Section 5: Train-Test Split */}
        <div className="glass-card" style={{ padding: '28px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '1.2rem' }}>✂️</span>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Train-Test Split</span>
          </div>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>
                  Test Size: {testSize}%
                </label>
              </div>
              <input 
                type="range" 
                min="10" 
                max="50" 
                value={testSize} 
                onChange={(e) => setTestSize(e.target.value)}
                style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', accentColor: '#ff6a00', cursor: 'pointer' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>
                Random State
              </label>
              <input 
                type="number" 
                value={randomState}
                onChange={(e) => setRandomState(e.target.value)}
                style={{ width: '100%', background: '#0d1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px', color: '#fff', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '16px', borderRadius: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#22c55e', padding: '16px', borderRadius: '12px' }}>
            ✅ Preprocessing successful! Next steps are now unlocked.
          </div>
        )}

        {/* Section 6: Submit Button */}
        <button
          onClick={handleApply}
          disabled={loading || !dataset || columns.length === 0}
          style={{
            marginTop: '10px',
            padding: '18px',
            borderRadius: '14px',
            border: 'none',
            background: (loading || !dataset || columns.length === 0) ? 'rgba(255,255,255,0.1)' : 'linear-gradient(90deg, #ff6a00, #ff8c00)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: (loading || !dataset || columns.length === 0) ? 'not-allowed' : 'pointer',
            boxShadow: (loading || !dataset || columns.length === 0) ? 'none' : '0 8px 25px rgba(255,106,0,0.25)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
          onMouseEnter={(e) => { if(!loading && dataset && columns.length > 0) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 35px rgba(255,106,0,0.4)'; } }}
          onMouseLeave={(e) => { if(!loading && dataset && columns.length > 0) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(255,106,0,0.25)'; } }}
        >
          {loading ? '⏳ Processing...' : (dataset ? '🚀 Apply Preprocessing' : '⚠️ Please Upload CSV First')}
        </button>

      </div>
    </div>
  );
}
