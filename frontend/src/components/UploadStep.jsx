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
    setError(null)
    setLoading(true)
    setUploadProgress(0)

    try {
      if (file.size > MAX_SIZE) {
        throw new Error('File exceeds 2GB limit.')
      }

      const name = file.name || 'Dataset'
      const extension = name.split('.').pop().toLowerCase()

      if (!['csv', 'xlsx', 'xls', 'json'].includes(extension)) {
        throw new Error('Please upload a CSV, Excel, or JSON file.')
      }

      const response = await uploadDataset(file, {
        onProgress: (value) => setUploadProgress(value),
      })

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
      addToast('Dataset loaded successfully.', null, 'success')
    } catch (err) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Upload failed. Please try again.'
      setError(errorMessage)
      addToast(errorMessage, null, 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleDemo() {
    const demo = getDemoDataset()
    const name = 'demo_dataset.csv'
    setUploadedFiles((prev) => [...prev, { name, size: 0, status: 'ready', storageMode: 'local' }])
    const columns = demo.rows[0] ? Object.keys(demo.rows[0]) : []
    setPreviewMeta(profileDatasetRows(demo.rows, columns))
    onDatasetChange(
      normalizeDataset(
        {
          ...demo,
          name,
          rows: demo.rows.length,
          cols: columns.length,
          all_columns: columns,
          sample_rows: demo.rows,
          backend_managed: false,
          storage_mode: 'local',
        },
        demo.rows,
        columns
      )
    )
    onComplete('upload')
    addToast('Dataset loaded successfully.', null, 'success')
  }

  function downloadSampleCsv() {
    const demo = getDemoDataset()
    const csv = Papa.unparse(demo.rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sample_dataset.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportJson() {
    if (!dataset) {
      addToast('Upload a dataset before exporting JSON.', null, 'warning')
      return
    }

    try {
      const payload = await fetchDatasetJson(5000)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(dataset.name || 'dataset').replace(/\.[^.]+$/, '')}_api.json`
      link.click()
      URL.revokeObjectURL(url)
      addToast('API-ready dataset JSON exported.', null, 'success')
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || 'Could not export dataset JSON.'
      addToast(message, null, 'error')
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

  return (
    <div style={{ padding: '0 0 32px 0' }}>
      <div className="step-header">
        <div>
          <h1 className="page-title">Dataset Upload</h1>
          <p className="page-subtitle">Drag and drop CSV, Excel, or JSON files to begin the pipeline.</p>
        </div>
        <div className="header-actions">
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
          >
            <div className="dropzone-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 10L12 5L17 10" />
                <path d="M12 5V15" />
                <path d="M20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13" />
              </svg>
            </div>
            <p className="dropzone-title">Drag and drop files here</p>
            <p className="dropzone-subtitle">or click to browse (.csv, .xlsx, .xls, .json)</p>
            <p className="dropzone-note">Chunked upload + streamed parsing enabled for large files up to 2GB</p>
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

          <div className="upload-actions">
            <button type="button" className="btn btn-secondary" onClick={handleDemo} disabled={loading}>
              Try Demo Dataset
            </button>
            <button type="button" className="btn btn-ghost" onClick={downloadSampleCsv}>
              Download Sample CSV
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleExportJson} disabled={!dataset || loading}>
              Export API JSON
            </button>
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
              <span>Total Files</span>
              <strong>{totalFiles}</strong>
            </div>
            <div className="summary-row">
              <span>Ready</span>
              <strong>{readyFiles}</strong>
            </div>
            <div className="summary-row">
              <span>Processing</span>
              <strong>{processingFiles}</strong>
            </div>
            <div className="summary-row">
              <span>Storage Mode</span>
              <strong>{dataset?.meta?.storage_mode || 'local'}</strong>
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
          <div className="section-title">Dataset Preview (sampled rows)</div>
          <DatasetPreviewTable
            rows={dataset.rows}
            columns={dataset.columns}
            types={previewMeta.types}
            nullCounts={previewMeta.nullCounts}
          />
        </div>
      )}
    </div>
  )
}
