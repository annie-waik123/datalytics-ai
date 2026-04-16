import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { fetchDatasetJson, uploadDataset } from '../api/upload.js'
import { getDemoDataset } from '../lib/demoDataset.js'
import { computeMissingByColumn, inferColumnTypes } from '../utils/dataset.js'
import DatasetPreviewTable from './DatasetPreviewTable.jsx'
import { useToast } from '../hooks/useToast.js'

const MAX_SIZE = 2 * 1024 * 1024 * 1024

function normalizeDataset(payload, fallbackRows = [], fallbackColumns = []) {
  const rows = fallbackRows?.length
    ? fallbackRows
    : (payload?.sample_rows || payload?.rows || payload?.preview || [])
  const columns = fallbackColumns?.length
    ? fallbackColumns
    : (payload?.all_columns || payload?.columns || (rows[0] ? Object.keys(rows[0]) : []))

  return {
    name: payload?.name || 'Dataset',
    rows,
    columns,
    meta: {
      ...payload,
      rows: typeof payload?.rows === 'number' ? payload.rows : rows.length,
      cols: typeof payload?.cols === 'number' ? payload.cols : columns.length,
      all_columns: payload?.all_columns || columns,
      backend_managed: Boolean(payload?.backend_managed),
      needs_backend_sync: false,
      storage_mode: payload?.storage_mode || (payload?.backend_managed ? 'memory' : 'local'),
    },
  }
}

function profileDatasetRows(rows, columns) {
  const sample = rows.slice(0, 500)
  return {
    types: inferColumnTypes(sample, columns),
    nullCounts: computeMissingByColumn(sample, columns),
  }
}

export default function UploadStep({ dataset, onDatasetChange, onComplete, onReset }) {
  const { addToast } = useToast()
  const [previewMode, setPreviewMode] = useState('head')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [previewMeta, setPreviewMeta] = useState({ types: {}, nullCounts: {} })
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileRef = useRef(null)
  const workerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return undefined
    }

    try {
      workerRef.current = new Worker(new URL('../workers/datasetProfile.worker.js', import.meta.url), { type: 'module' })
      workerRef.current.onmessage = (event) => {
        setPreviewMeta({
          types: event.data?.types || {},
          nullCounts: event.data?.nullCounts || {},
        })
      }
    } catch {
      workerRef.current = null
    }

    return () => {
      workerRef.current?.terminate?.()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!dataset?.rows?.length) return
    const rows = dataset.rows || []
    const columns = dataset.columns || Object.keys(rows[0] || {})

    if (workerRef.current) {
      workerRef.current.postMessage({ rows: rows.slice(0, 500), columns })
      return
    }

    setPreviewMeta(profileDatasetRows(rows, columns))
  }, [dataset])

  async function handleFile(file) {
    if (!file) return
    const name = file.name || 'Dataset'
    const extension = name.split('.').pop().toLowerCase()
    
    try {
      if (file.size > MAX_SIZE) {
        throw new Error('File exceeds 2GB limit.')
      }

      if (!['csv', 'xlsx', 'xls', 'json'].includes(extension)) {
        throw new Error('Please upload a CSV, Excel, or JSON file.')
      }
      
      setLoading(true)
      setError(null)
      setUploadProgress(0)

      console.log('Starting upload for:', name)
      const response = await uploadDataset(file, {
        onProgress: (value) => {
          console.log('Upload progress:', value)
          setUploadProgress(value)
        },
      })
      console.log('Upload successful:', response)

      const nextDataset = normalizeDataset({ ...response, name })
      const previewRows = nextDataset.rows || []
      const previewColumns = nextDataset.columns || []

      if (workerRef.current) {
        workerRef.current.postMessage({ rows: previewRows.slice(0, 500), columns: previewColumns })
      } else {
        setPreviewMeta(profileDatasetRows(previewRows, previewColumns))
      }

      setUploadedFiles((prev) => [
        ...prev,
        {
          name,
          size: file.size,
          status: 'ready',
          storageMode: nextDataset.meta?.storage_mode || 'memory',
        },
      ])
      onDatasetChange(nextDataset)
      onComplete('upload')
      addToast('Dataset uploaded and processed successfully.', null, 'success')
    } catch (err) {
      console.error('Upload error details:', err)
      const message = err.response?.data?.detail || err.message || 'Something went wrong while uploading.'
      setError(message)
      addToast(message, null, 'error')
    } finally {
      setLoading(false)
    }
  }


  function handleClearAll() {
    setUploadedFiles([])
    setError(null)
    setUploadProgress(0)
    if (onReset) onReset()
  }

  const onDrop = (event) => {
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
  const readyFiles = uploadedFiles.filter((f) => f.status === 'ready').length
  const processingFiles = loading ? 1 : 0

  const numColumnsCount = Object.values(previewMeta.types || {}).filter(t => t === 'number').length;
  const dateColumnsCount = Object.values(previewMeta.types || {}).filter(t => t === 'date').length;
  const catColumnsCount = Object.values(previewMeta.types || {}).filter(t => t === 'string' || t === 'boolean').length;
  const totalRows = dataset?.meta?.rows || dataset?.rows?.length || 0;
  const totalCols = dataset?.meta?.cols || dataset?.columns?.length || 0;

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      <div className="step-header">
        <div>
          <h1 className="page-title">Dataset Upload</h1>
          <p className="page-subtitle">Drag and drop CSV, Excel, or JSON files to begin the pipeline.</p>
        </div>
        <div className="header-actions" style={{ marginTop: '-12px' }}>
          <button type="button" className="btn btn-secondary" onClick={handleClearAll}>
            Clear All
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            {loading ? 'Uploading...' : 'Upload Dataset'}
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="section-title">Upload Files</div>
          <div 
            onDrop={onDrop}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            className={`dropzone ${dragging ? 'is-active' : ''}`}
            style={{ 
              background: 'rgba(15, 23, 42, 0.4)', 
              border: dragging ? '2px dashed #38bdf8' : '2px dashed rgba(255,255,255,0.1)',
              borderRadius: '24px',
              padding: '3rem 2rem',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
          >
            <div className="dropzone-icon" style={{ 
              background: 'linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(56,189,248,0.1) 100%)', 
              color: '#22d3ee', 
              width: '80px', 
              height: '80px', 
              borderRadius: '24px',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(34,211,238,0.2)',
              boxShadow: '0 0 30px rgba(34,211,238,0.1)'
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 10L12 5L17 10" />
                <path d="M12 5V15" />
                <path d="M20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem', color: '#fff' }}>Drop your dataset here</h2>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Drag and drop your .csv, .xlsx or .json files. We'll handle the curation process.</p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                onClick={(e) => {
                  e.stopPropagation()
                  fileRef.current?.click()
                }}
                disabled={loading}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'linear-gradient(to right, #0ea5e9, #38bdf8)',
                  border: 'none',
                  color: '#fff',
                  boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  fontWeight: '600'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📁</span> {loading ? 'Uploading...' : 'Browse Files'}
              </button>
            </div>
            

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json,application/json"
              onChange={(event) => {
                const files = event.target.files
                if (files && files.length > 0) handleFile(files[0])
              }}
              style={{ display: 'none' }}
            />
          </div>


          {loading ? (
            <div className="upload-progress-card">
              <div className="upload-progress-head">
                <span>Upload Progress</span>
                <strong>{uploadProgress}%</strong>
              </div>
              <div className="upload-progress-track">
                <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="upload-progress-note">Streaming the dataset to the backend and building a fast preview sample.</div>
            </div>
          ) : null}

          {error && (
            <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Upload Summary</div>
          <div className="summary-list">
            <div className="summary-row">
              <span>Total Rows</span>
              <strong>{totalRows > 0 ? totalRows.toLocaleString() : '--'}</strong>
            </div>
            <div className="summary-row">
              <span>Total Columns</span>
              <strong>{totalCols > 0 ? totalCols : '--'}</strong>
            </div>
            <div className="summary-row">
              <span>Numeric Columns</span>
              <strong>{totalCols > 0 ? numColumnsCount : '--'}</strong>
            </div>
            <div className="summary-row">
              <span>Categorical Columns</span>
              <strong>{totalCols > 0 ? catColumnsCount : '--'}</strong>
            </div>
            <div className="summary-row">
              <span>Date Columns</span>
              <strong>{totalCols > 0 ? dateColumnsCount : '--'}</strong>
            </div>
          </div>

          <div className="section-title" style={{ marginTop: '1.5rem' }}>Supported Formats</div>
          <div className="format-grid">
            <div className="format-pill">CSV</div>
            <div className="format-pill">XLSX</div>
            <div className="format-pill">XLS</div>
            <div className="format-pill">JSON</div>
          </div>
        </div>
      </div>

      {dataset && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Dataset Preview (sampled rows)</div>
            <select
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#10b981', // Neon green
                border: '1px solid #10b981',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                padding: '6px 36px 6px 16px',
                fontSize: '0.85rem',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer',
                width: 'auto',
                minWidth: '150px',
                textAlign: 'left',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2310b981%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px top 50%',
                backgroundSize: '10px auto'
              }}
            >
              <option value="head" style={{ background: '#0f172a', color: '#10b981' }}>Head (Top 20)</option>
              <option value="tail" style={{ background: '#0f172a', color: '#10b981' }}>Tail (Bottom 20)</option>
            </select>
          </div>
          <DatasetPreviewTable
            rows={previewMode === 'head' ? dataset.rows.slice(0, 20) : dataset.rows.slice(-20)}
            columns={dataset.columns}
            types={previewMeta.types}
            nullCounts={previewMeta.nullCounts}
          />
        </div>
      )}
    </div>
  )
}
