import React, { useState } from 'react';

export default function ModernPreprocess({ dataset, onApply }) {
  const columns = dataset?.columns || ['price', 'sqft', 'bedrooms', 'bathrooms'];
  const [targetCol, setTargetCol] = useState('price');
  const [taskType, setTaskType] = useState('CLASSIFICATION');
  const [missingStrategy, setMissingStrategy] = useState('Fill with mean (numeric)');
  const [encoding, setEncoding] = useState('LABEL ENCODING');
  const [scaling, setScaling] = useState('STANDARDSCALER');
  const [testSize, setTestSize] = useState(20);
  const [randomState, setRandomState] = useState(42);

  return (
    <div className="modern-preprocess-wrap" style={{ color: '#fff', padding: '20px' }}>
      <h1 className="page-title" style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '2rem' }}>Data Preprocessing</h1>

      <div className="preprocess-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Target Column Section */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>🎯</span>
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'rgba(255,255,255,0.9)' }}>Target Column</span>
          </div>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Target Column</label>
              <select 
                value={targetCol} 
                onChange={(e) => setTargetCol(e.target.value)}
                style={{ width: '100%', background: '#0d1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', color: '#fff' }}
              >
                {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Task Type</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['CLASSIFICATION', 'REGRESSION'].map(type => (
                  <button
                    key={type}
                    onClick={() => setTaskType(type)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: taskType === type ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                      background: taskType === type ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                      color: taskType === type ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: taskType === type ? '0 0 15px rgba(0,212,255,0.2)' : 'none'
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
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>🖌️</span>
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'rgba(255,255,255,0.9)' }}>Handle Missing Values</span>
          </div>
          <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Strategy</label>
          <select 
            value={missingStrategy} 
            onChange={(e) => setMissingStrategy(e.target.value)}
            style={{ width: '100%', background: '#0d1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', color: '#fff' }}
          >
            <option>Fill with mean (numeric)</option>
            <option>Fill with median (numeric)</option>
            <option>Fill with mode (categorical)</option>
            <option>Drop missing values</option>
          </select>
        </div>

        {/* Encoding Section */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>📋</span>
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'rgba(255,255,255,0.9)' }}>Encode Categorical Variables</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['LABEL ENCODING', 'ONE-HOT ENCODING'].map(type => (
              <button
                key={type}
                onClick={() => setEncoding(type)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: encoding === type ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                  background: encoding === type ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                  color: encoding === type ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: encoding === type ? '0 0 15px rgba(0,212,255,0.2)' : 'none'
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Scaling Section */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚖️</span>
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'rgba(255,255,255,0.9)' }}>Feature Scaling</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['NONE', 'STANDARDSCALER', 'MINMAXSCALER'].map(type => (
              <button
                key={type}
                onClick={() => setScaling(type)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: scaling === type ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                  background: scaling === type ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                  color: scaling === type ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: scaling === type ? '0 0 15px rgba(0,212,255,0.2)' : 'none'
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Train-Test Split Section */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>✂️</span>
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'rgba(255,255,255,0.9)' }}>Train-Test Split</span>
          </div>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: '250px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Test Size: {testSize}%</label>
              </div>
              <input 
                type="range" 
                min="10" 
                max="50" 
                value={testSize} 
                onChange={(e) => setTestSize(e.target.value)}
                style={{ width: '100%', accentColor: '#ff6a00' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Random State</label>
              <input 
                type="number" 
                value={randomState} 
                onChange={(e) => setRandomState(e.target.value)}
                style={{ width: '100%', background: '#0d1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', color: '#fff' }}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={() => onApply && onApply()}
          style={{
            marginTop: '10px',
            padding: '16px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(90deg, #00d4ff, #7c3aed)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,212,255,0.3)',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          🚀 Apply Preprocessing
        </button>

      </div>
    </div>
  );
}
