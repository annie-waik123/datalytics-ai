import React, { useState } from 'react';
import client from '../api/client.js';

const EyeIcon = ({ open }) => open ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const HelpIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{cursor:'help', opacity:0.5}}>
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const inputStyle = {
  width: '100%', padding: '0.8rem 1rem', borderRadius: '8px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s ease'
};
const labelStyle = {
  fontSize: '13px', color: 'rgba(255,255,255,0.65)', fontWeight: '500',
  display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px'
};

export default function ConnectionModal({ isOpen, onClose, source, onConnect }) {
  const [showUrlComingSoon, setShowUrlComingSoon] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sslEnabled, setSslEnabled] = useState(true);
  const [sslMode, setSslMode] = useState('prefer');
  const [formData, setFormData] = useState({
    host: '', port: '', database: '', username: '', password: '', url: '', table: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen || !source) return null;

  const isDatabase = ['mysql', 'postgresql', 'mssql'].includes(source.id);
  const isSheet = source.id === 'googlesheets';
  const isJson = source.id === 'json';
  const isPdf = source.id === 'pdf';

  const defaultPort = source.id === 'mysql' ? '3306' : source.id === 'postgresql' ? '5432' : '1433';
  const dbLabel = source.id === 'mysql' ? 'MySQL' : source.id === 'postgresql' ? 'PostgreSQL' : 'SQL Server';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onConnect({ ...formData, ssl: sslEnabled, sslMode }, source);
    }, 2000);
  };

  return (
    <div className="data-sources-overlay">
      <div className="connection-modal card" style={{ width: '520px', background: '#1a1d26', border: '1px solid rgba(255,255,255,0.1)', zIndex: 10000, padding: '28px', borderRadius: '14px', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '18px' }}>
          <div style={{ color: source.color }}><source.icon size={30} /></div>
          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: '600', color: '#fff' }}>Connect to {source.name}</h2>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

          {/* DATABASE FORM */}
          {isDatabase && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '600', color: '#e2e8f0' }}>
                Enter your {dbLabel} credentials
              </p>

              {/* Hostname + Port */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Hostname <HelpIcon /></label>
                  <input name="host" type="text" placeholder="Hostname" value={formData.host} onChange={handleChange} required style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
                </div>
                <div>
                  <label style={labelStyle}>Port <HelpIcon /></label>
                  <input name="port" type="number" placeholder={defaultPort} value={formData.port} onChange={handleChange} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
                </div>
              </div>

              {/* Username */}
              <div>
                <label style={labelStyle}>Username <HelpIcon /></label>
                <input name="username" type="text" autoComplete="new-password" placeholder="Username" value={formData.username} onChange={handleChange} required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
              </div>

              {/* Password with eye toggle */}
              <div>
                <label style={labelStyle}>Password <HelpIcon /></label>
                <div style={{ position: 'relative' }}>
                  <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Password" value={formData.password} onChange={handleChange} required
                    style={{ ...inputStyle, paddingRight: '2.8rem' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {/* Database */}
              <div>
                <label style={labelStyle}>Database <HelpIcon /></label>
                <input name="database" type="text" placeholder="Database" value={formData.database} onChange={handleChange} required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
              </div>

              {/* SSL Toggle */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>SSL Connection <HelpIcon /></label>
                  <div onClick={() => setSslEnabled(p => !p)} style={{
                    width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                    background: sslEnabled ? '#f97316' : 'rgba(255,255,255,0.15)',
                    position: 'relative', transition: 'background 0.2s ease', flexShrink: 0
                  }}>
                    <div style={{
                      position: 'absolute', top: '3px', left: sslEnabled ? '23px' : '3px',
                      width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }} />
                  </div>
                </div>
                {sslEnabled && (
                  <select value={sslMode} onChange={e => setSslMode(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer', color: '#ccc' }}>
                    <option value="prefer">Prefer (use SSL if available)</option>
                    <option value="require">Require (always use SSL)</option>
                    <option value="disable">Disable (no SSL)</option>
                    <option value="verify-ca">Verify CA</option>
                    <option value="verify-full">Verify Full</option>
                  </select>
                )}
              </div>

              {/* Security notice */}
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '12px' }}>
                All SQL queries are read-only and begin with a securely enforced{' '}
                <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', color: '#94a3b8' }}>SELECT</code>{' '}
                statement. Only safe, non-destructive queries are run against your database, and all credentials are fully encrypted to ensure your data remains protected.
              </p>

              {/* Tip box */}
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>&#128161;</span>
                <span>
                  <strong style={{ color: '#fbbf24' }}>Tip:</strong> After your database is connected, you can enforce{' '}
                  <strong style={{ color: '#fff' }}>row-level security</strong> to control exactly which records the AI can access — then fine-tune access further by selecting approved tables and columns, and upload documents to a Knowledge Base (business logic, schema definitions, etc.) to help the AI generate more accurate SQL.
                </span>
              </div>
            </div>
          )}

          {/* GOOGLE SHEETS */}
          {isSheet && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', fontSize: '13px', color: '#e2e8f0' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#38bdf8' }}>&#9888;&#65039; Sheet must be set to public before connecting:</p>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Open your Google Sheet</li>
                  <li>Click <strong>Share</strong> (top right)</li>
                  <li>Click <strong>"Change to anyone with the link"</strong></li>
                  <li>Set role to <strong>"Viewer"</strong></li>
                  <li>Click <strong>Copy link</strong> and paste below</li>
                </ol>
              </div>
              <div>
                <label style={labelStyle}>Google Sheet URL</label>
                <input type="url" name="url" placeholder="https://docs.google.com/spreadsheets/d/..." value={formData.url} onChange={handleChange} required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'} />
              </div>
            </div>
          )}

          {/* JSON */}
          {isJson && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Upload Local JSON File</label>
                <label style={{ width: '100%', padding: '1.2rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', color: formData.file ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease', boxSizing: 'border-box' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}>
                  <input type="file" name="file" accept=".json" onChange={e => setFormData({...formData, file: e.target.files[0]})} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    <span>{formData.file ? formData.file.name : 'Click to browse or drag JSON file here'}</span>
                  </div>
                </label>
              </div>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>OR</div>
              <div style={{ position: 'relative' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  API Endpoint URL (JSON)
                  <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', padding: '2px 7px', borderRadius: '20px', fontWeight: '700' }}>We're working on this</span>
                </label>
                <div onClick={() => setShowUrlComingSoon(true)} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(245,158,11,0.35)', color: 'rgba(255,255,255,0.2)', fontSize: '14px', cursor: 'not-allowed', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxSizing: 'border-box' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(245,158,11,0.5)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  https://api.example.com/data.json
                </div>
                {showUrlComingSoon && (
                  <div onClick={() => setShowUrlComingSoon(false)} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.08))', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px', zIndex: 100, backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>&#128679;</span>
                    <div>
                      <div style={{ color: '#fbbf24', fontWeight: '700', fontSize: '13px', marginBottom: '3px' }}>We're working on this!</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', lineHeight: 1.5 }}>
                        API Endpoint support is under development.<br />For now, please use <strong style={{ color: '#fff' }}>Local JSON File</strong> upload above.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PDF */}
          {isPdf && (
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Upload Local PDF File
                <span style={{ fontSize: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', padding: '2px 7px', borderRadius: '20px', fontWeight: '700' }}>We're working on this</span>
              </label>
              <div style={{ position: 'relative' }}>
                <label style={{ width: '100%', padding: '1.2rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(245,158,11,0.35)', color: 'rgba(255,255,255,0.2)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed', userSelect: 'none', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(245,158,11,0.5)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Click to browse or drag PDF file here</span>
                  </div>
                </label>
                <div style={{ marginTop: '10px', background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.08))', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>&#128679;</span>
                  <div>
                    <div style={{ color: '#fbbf24', fontWeight: '700', fontSize: '13px', marginBottom: '3px' }}>We're working on this!</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', lineHeight: 1.5 }}>
                      PDF data extraction is currently under development.<br />This feature will be available soon — stay tuned!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} disabled={loading}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ padding: '0.75rem 1.6rem', borderRadius: '8px', background: loading ? 'rgba(0,153,115,0.5)' : 'linear-gradient(135deg, #009973, #007a5e)', border: 'none', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', minWidth: '160px', transition: 'opacity 0.2s' }}>
              {loading ? 'Connecting...' : isDatabase ? `Connect ${dbLabel}` : 'Connect & Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
