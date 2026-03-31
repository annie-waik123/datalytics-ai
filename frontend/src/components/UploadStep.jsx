import { useRef, useState } from 'react'
import DataTable from './DataTable.jsx'
import client from '../api/client.js'
import { getDemoDataset } from '../lib/demoDataset.js'

function normalizeDataset(payload) {
  const rows = payload?.preview || payload?.rows || []
  const columns = payload?.all_columns || payload?.columns || (rows[0] ? Object.keys(rows[0]) : [])
  return {
    name: payload?.name || 'Dataset',
    rows,
    columns,
    meta: payload
  }
}

function DatasetPreview({ dataset }) {
  const meta = dataset.meta || {}
  const rows = meta.preview || dataset.rows || []
  const columns = meta.all_columns || dataset.columns || []
  const columnsInfo = meta.columns_info || []
  const totalRows = meta.rows || rows.length
  const totalCols = meta.cols || columns.length
  const numericCols = meta.numeric_cols ?? '—'
  const categoricalCols = meta.categorical_cols ?? '—'
  const missingTotal = meta.missing_total ?? '—'

  const dtypeColor = dtype => {
    if (!dtype) return { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8' }
    if (dtype.includes('int') || dtype.includes('float')) return { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' }
    if (dtype.includes('object') || dtype.includes('str')) return { bg: 'rgba(34,197,94,0.12)', text: '#4ade80' }
    if (dtype.includes('bool')) return { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' }
    if (dtype.includes('date') || dtype.includes('time')) return { bg: 'rgba(0,212,255,0.12)', text: '#22d3ee' }
    return { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8' }
  }

  const statCard = (label, value, color) => (
    <div key={label} style={{
      flex: 1, minWidth: 0, padding: '14px 16px', borderRadius: 10,
      background: 'var(--bg-glass)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <span style={{ fontSize: '1.3rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
        padding: '12px 18px', borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(255,106,0,0.12), rgba(255,77,46,0.08))',
        border: '1px solid rgba(255,106,0,0.2)'
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #ff6a00, #ff4d2e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {dataset.name}
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Dataset loaded successfully
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
            background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)'
          }}>✓ Ready</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {statCard('Total Rows', totalRows, '#ff6a00')}
        {statCard('Columns', totalCols, '#818cf8')}
        {statCard('Numeric', numericCols, '#22d3ee')}
        {statCard('Categorical', categoricalCols, '#4ade80')}
        {statCard('Missing Values', missingTotal, missingTotal > 0 ? '#f87171' : '#4ade80')}
      </div>

      {/* Column overview */}
      {columnsInfo.length > 0 && (
        <div style={{
          marginBottom: 20, background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Column Overview
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              {columnsInfo.length} columns
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-glass)' }}>
                  {['Column', 'Type', 'Non-Null', 'Null %', 'Unique'].map(h => (
                    <th key={h} style={{
                      padding: '8px 14px', textAlign: 'left', fontWeight: 600,
                      color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.04em',
                      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columnsInfo.map((col, i) => {
                  const { bg, text } = dtypeColor(col.dtype)
                  return (
                    <tr key={col.column} style={{
                      borderBottom: i < columnsInfo.length - 1 ? '1px solid var(--border-light)' : 'none',
                      transition: 'background 0.15s'
                    }}>
                      <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {col.column}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
                          background: bg, color: text
                        }}>{col.dtype}</span>
                      </td>
                      <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                        {col.non_null?.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1, maxWidth: 60, height: 4, borderRadius: 2,
                            background: 'var(--border)'
                          }}>
                            <div style={{
                              width: `${Math.min(col.null_pct || 0, 100)}%`, height: '100%',
                              borderRadius: 2,
                              background: (col.null_pct || 0) > 10 ? '#f87171' : '#4ade80'
                            }} />
                          </div>
                          <span style={{ color: (col.null_pct || 0) > 10 ? '#f87171' : 'var(--text-muted)', fontSize: '0.72rem' }}>
                            {col.null_pct ?? 0}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                        {col.unique?.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data preview table */}
      {rows.length > 0 && (
        <div style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Data Preview
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                Showing first {rows.length} rows
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {columns.length} columns
            </span>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 340 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <th style={{
                    padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)',
                    fontSize: '0.7rem', borderBottom: '1px solid var(--border)', width: 40
                  }}>#</th>
                  {columns.map(col => (
                    <th key={col} style={{
                      padding: '8px 14px', textAlign: 'left', fontWeight: 600,
                      color: 'var(--text-secondary)', fontSize: '0.73rem',
                      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap'
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{
                    borderBottom: i < rows.length - 1 ? '1px solid var(--border-light)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                  }}>
                    <td style={{
                      padding: '7px 12px', textAlign: 'center', color: 'var(--text-muted)',
                      fontSize: '0.7rem', fontWeight: 500
                    }}>{i + 1}</td>
                    {columns.map(col => (
                      <td key={col} style={{
                        padding: '7px 14px', color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {row[col] == null || row[col] === '' ? (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.7rem' }}>null</span>
                        ) : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UploadStep({ dataset, datasetProfile, onDatasetChange, onComplete }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const fileRef = useRef(null)

  async function handleFile(file) {
    if (!file) return
    setError(null)
    setLoading(true)

    try {
      const name = file.name || 'Dataset'
      const extension = name.split('.').pop().toLowerCase()

      if (extension === 'csv') {
        const formData = new FormData()
        formData.append('file', file)
        const res = await client.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        const nextDataset = normalizeDataset({ ...res.data, name })
        setUploadedFiles(prev => [...prev, { name, status: 'ready' }])
        onDatasetChange(nextDataset)
        onComplete('upload')
      } else if (extension === 'xlsx' || extension === 'xls') {
        const demo = getDemoDataset()
        setUploadedFiles(prev => [...prev, { name, status: 'ready' }])
        onDatasetChange(normalizeDataset({ ...demo, name }))
        onComplete('upload')
        setError('Excel parsing is not enabled in this demo. Loaded sample dataset instead.')
      } else {
        throw new Error('Please upload a CSV or Excel file.')
      }
    } catch (err) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Upload failed. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function handleDemo() {
    const demo = getDemoDataset()
    const name = 'demo_dataset.csv'
    setUploadedFiles(prev => [...prev, { name, status: 'ready' }])
    onDatasetChange(normalizeDataset(demo))
    onComplete('upload')
  }

  function handleClearAll() {
    setUploadedFiles([])
    setError(null)
  }

  const onDrop = event => {
    event.preventDefault()
    setDragging(false)
    const files = event.dataTransfer.files
    if (files.length === 0) {
      setError('No file dropped. Please select a file.')
      return
    }
    handleFile(files[0])
  }

  const totalFiles = uploadedFiles.length
  const readyFiles = uploadedFiles.filter(f => f.status === 'ready').length
  const processingFiles = loading ? 1 : 0

  const card = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
  }

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        <span>Home</span>
        <span style={{ opacity: 0.4 }}>/</span>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Upload-Data</span>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Upload CSV &amp; Excel Files
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '5px 0 0' }}>
            Import your data files to start analyzing
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleClearAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 500,
              border: '1px solid var(--border)', background: 'var(--bg-soft)',
              color: 'var(--text-secondary)', cursor: 'pointer'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
            Clear All
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
              border: 'none',
              background: loading ? 'rgba(255,106,0,0.5)' : 'linear-gradient(135deg, #ff6a00, #ff4d2e)',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(255,106,0,0.35)'
            }}
          >
            {loading ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Processing…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M7 10L12 5L17 10"/><path d="M12 5V15"/>
                  <path d="M20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13"/>
                </svg>
                Process All Files
              </>
            )}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Upload zone ── */}
        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Upload Files</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>Drag &amp; drop or browse files</p>
          </div>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '44px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'rgba(255,106,0,0.05)' : 'var(--bg-glass)',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: 'rgba(255,106,0,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M7 10L12 5L17 10"/><path d="M12 5V15"/>
                <path d="M20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13"/>
              </svg>
            </div>

            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 5px' }}>
              Drag &amp; drop files here
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 18px' }}>
              or{' '}
              <span style={{ color: 'var(--primary)', fontWeight: 500 }}>browse</span>
              {' '}to select files
            </p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 13px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 500,
                background: 'rgba(34,197,94,0.12)', color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.2)'
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                CSV Files
              </span>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 13px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 500,
                background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.2)'
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Excel Files
              </span>
            </div>

            <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: 0 }}>
              Maximum file size: 250MB &bull; Supported formats: .csv, .xlsx, .xls
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={e => {
                const files = e.target.files
                if (files && files.length > 0) handleFile(files[0])
              }}
              style={{ display: 'none' }}
            />
          </div>

          {/* Demo button */}
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            style={{
              width: '100%', marginTop: 12, padding: '10px',
              borderRadius: 8, fontSize: '0.82rem', fontWeight: 500,
              border: '1px solid var(--border)', background: 'var(--bg-soft)',
              color: 'var(--text-secondary)', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            🎯 Try Demo Dataset
          </button>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', display: 'flex', alignItems: 'center', gap: 8
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* ── Right: Info panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Upload Summary */}
          <div style={{
            borderRadius: 12, padding: 20,
            background: 'linear-gradient(135deg, #ff6a00 0%, #ff4d2e 100%)',
            color: '#fff'
          }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, margin: '0 0 14px', opacity: 0.9, letterSpacing: '0.02em' }}>
              Upload Summary
            </h3>
            {[
              { label: 'Total Files', icon: '📄', value: totalFiles },
              { label: 'Ready',       icon: '✅', value: readyFiles },
              { label: 'Processing',  icon: '⏳', value: processingFiles },
            ].map((item, i, arr) => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 0',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', opacity: 0.9 }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Supported Formats */}
          <div style={card}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }}>
              Supported Formats
            </h3>
            {[
              { icon: '📊', label: 'CSV Files',     sub: 'Comma-separated values',  bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)',   text: '#4ade80' },
              { icon: '📗', label: 'Excel (.xlsx)', sub: 'Microsoft Excel format',   bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)', text: '#818cf8' },
            ].map(fmt => (
              <div key={fmt.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8, marginBottom: 8,
                background: fmt.bg, border: `1px solid ${fmt.border}`
              }}>
                <span style={{ fontSize: '1.15rem' }}>{fmt.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: fmt.text }}>{fmt.label}</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmt.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={card}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }}>
              Quick Actions
            </h3>
            <button
              type="button"
              onClick={handleDemo}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                fontSize: '0.8rem', fontWeight: 500,
                border: '1px solid var(--border)', background: 'var(--bg-soft)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Sample CSV
            </button>
          </div>
        </div>
      </div>

      {/* Dataset preview after upload */}
      {dataset && <DatasetPreview dataset={dataset} />}
    </div>
  )
}
