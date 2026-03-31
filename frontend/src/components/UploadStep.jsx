import { useRef, useState } from 'react'
import DataTable from './DataTable.jsx'
import client from '../api/client.js'
import { getDemoDataset } from '../lib/demoDataset.js'

function normalizeDataset(payload) {
  // Backend returns preview data, so use that for rows
  const rows = payload?.preview || payload?.rows || []
  const columns = payload?.all_columns || payload?.columns || (rows[0] ? Object.keys(rows[0]) : [])
  
  console.log('normalizeDataset:', {
    payloadKeys: Object.keys(payload || {}),
    rowsCount: rows.length,
    columnsCount: columns.length,
    hasPreview: !!(payload?.preview),
    hasRows: !!(payload?.rows)
  })
  
  return {
    name: payload?.name || 'Dataset',
    rows,
    columns,
    // Keep the original payload for reference
    meta: payload
  }
}

export default function UploadStep({ dataset, datasetProfile, onDatasetChange, onComplete }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  async function handleFile(file) {
    if (!file) return
    setError(null)
    setLoading(true)

    try {
      const name = file.name || 'Dataset'
      const extension = name.split('.').pop().toLowerCase()
      
      console.log('Uploading file:', name, 'Extension:', extension)
      
      if (extension === 'csv') {
        const formData = new FormData()
        formData.append('file', file)
        
        console.log('Sending request to /upload...')
        const res = await client.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        
        console.log('Upload response:', res.data)
        const nextDataset = normalizeDataset({ ...res.data, name })
        onDatasetChange(nextDataset)
        onComplete('upload')
      } else if (extension === 'xlsx' || extension === 'xls') {
        console.log('Excel file detected, loading demo dataset')
        const demo = getDemoDataset()
        onDatasetChange(normalizeDataset({ ...demo, name }))
        onComplete('upload')
        setError('Excel parsing is not enabled in this demo. Loaded sample dataset instead.')
      } else {
        throw new Error('Please upload a CSV or Excel file.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      const errorMessage = err?.response?.data?.detail || err?.message || 'Upload failed. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function handleDemo() {
    const demo = getDemoDataset()
    onDatasetChange(normalizeDataset(demo))
    onComplete('upload')
  }

  const onDrop = event => {
    event.preventDefault()
    setDragging(false)
    
    const files = event.dataTransfer.files
    if (files.length === 0) {
      setError('No file dropped. Please select a file.')
      return
    }
    
    console.log('Files dropped:', files.length, 'First file:', files[0]?.name)
    handleFile(files[0])
  }

  return (
    <div className="upload-container">
      <div className="upload-header">
        <h1 className="page-title">Dataset Upload</h1>
        <p className="page-subtitle">Start your ML pipeline by uploading a dataset or try our demo</p>
      </div>

      <div className="upload-content">
        <div className="upload-main">
          <div 
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
          >
            <div className="upload-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 10L12 5L17 10" />
                <path d="M12 5V15" />
                <path d="M20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13" />
              </svg>
            </div>
            <div className="upload-text">
              <h3>Drop your file here</h3>
              <p>or click to browse</p>
              <span className="upload-formats">CSV, Excel (XLSX, XLS)</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={e => {
                const files = e.target.files
                if (files && files.length > 0) {
                  console.log('File selected via input:', files[0]?.name)
                  handleFile(files[0])
                }
              }}
              style={{ display: 'none' }}
            />
          </div>

          <div className="upload-actions">
            <button 
              type="button" 
              className="btn btn-primary btn-lg" 
              onClick={() => fileRef.current?.click()}
              disabled={loading}
            >
              {loading ? (
                <span className="loading-spinner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path d="M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
                  </svg>
                  Processing...
                </span>
              ) : '📁 Upload Dataset'}
            </button>
            
            <button 
              type="button" 
              className="btn btn-secondary btn-lg" 
              onClick={handleDemo}
              disabled={loading}
            >
              🎯 Try Demo Dataset
            </button>
          </div>

          {error && (
            <div className="upload-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
        </div>

      </div>

      {dataset && (
        <div className="upload-success">
          <div className="success-icon">✅</div>
          <h3>Dataset Loaded Successfully!</h3>
          <p>{dataset.name} • {dataset.rows?.length || 0} rows • {dataset.columns?.length || 0} columns</p>
          <DataTable 
            data={dataset.rows?.slice(0, 5) || []} 
            columns={dataset.columns || []} 
            compact 
          />
        </div>
      )}
    </div>
  )
}
