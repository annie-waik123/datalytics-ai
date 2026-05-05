import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { fetchDatasetJson, uploadDataset, connectDatabase } from '../api/upload.js'
import { getDemoDataset } from '../lib/demoDataset.js'
import { computeMissingByColumn, inferColumnTypes } from '../utils/dataset.js'
import DatasetPreviewTable from './DatasetPreviewTable.jsx'
import { useToast } from '../hooks/useToast.js'
import CustomDropdown from './ui/CustomDropdown.jsx';
import DataSourcesModal from './DataSourcesModal.jsx';
import ConnectionModal from './ConnectionModal.jsx';

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
  const sample = rows.slice(0, 1000)
  return {
    types: inferColumnTypes(sample, columns),
    nullCounts: computeMissingByColumn(sample, columns),
  }
}

export default function UploadStep({ dataset, onDatasetChange, onComplete, onBeforeUpload, onReset }) {
  const { addToast } = useToast()
  const [previewMode, setPreviewMode] = useState('head')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [previewMeta, setPreviewMeta] = useState({ types: {}, nullCounts: {} })
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false)
  const [selectedSource, setSelectedSource] = useState(null)
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
      workerRef.current.postMessage({ rows: rows.slice(0, 1000), columns })
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
      const charged = await onBeforeUpload?.()
      if (charged === false) return

      if (workerRef.current) {
        workerRef.current.postMessage({ rows: previewRows.slice(0, 1000), columns: previewColumns })
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
      const message = err.response?.data?.detail || err.message || 'Something went wrong while uploading.'
      console.warn('Upload failed:', message)
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

  const simulateDatabaseImport = async (sourceInfo, formData) => {
    setLoading(true);
    setError(null);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(p => p < 90 ? p + 15 : 90);
    }, 200);

    try {
      // Direct file upload for JSON
      if (sourceInfo.id === 'json' && formData.file) {
        clearInterval(interval);
        await handleFile(formData.file);
        return;
      }

      // PDF needs to be parsed by Next.js API first
      if (sourceInfo.id === 'pdf' && formData.file) {
        const formPayload = new FormData();
        formPayload.append('file', formData.file);
        const res = await fetch(`/api/connect/pdf`, { method: 'POST', body: formPayload });
        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to parse PDF.');
        }
        
        // Convert the parsed PDF rows into a JSON file and upload it
        const jsonString = JSON.stringify(data.data);
        const file = new File([jsonString], `${formData.file.name}.json`, { type: 'application/json' });
        clearInterval(interval);
        await handleFile(file);
        return;
      }
      // Hybrid Frontend-First Fetch for Google Sheets
      if (sourceInfo.id === 'googlesheets') {
        const url = formData.url;
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        const sheetId = match ? match[1] : null;
        if (!sheetId) throw new Error('Invalid Google Sheets URL');
        
        const gidMatch = url.match(/[#&?]gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : '0';
        
        const urlsToTry = [
          `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
          `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
          `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
        ];

        let parsedData = null;

        for (const csvUrl of urlsToTry) {
          try {
            const response = await fetch(csvUrl, {
              method: 'GET',
              headers: { 'Accept': 'text/csv, text/plain, */*' },
              redirect: 'follow',
            });

            if (!response.ok) continue;

            const text = await response.text();

            if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
              throw new Error(
                'This sheet is not publicly accessible. Please:\n' +
                '1. Open the sheet in Google Sheets\n' +
                '2. Click Share → Change to "Anyone with the link"\n' +
                '3. Set role to "Viewer"\n' +
                '4. Copy the link and paste here'
              );
            }

            const result = Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true,
            });

            if (result.data && result.data.length > 0) {
              parsedData = result.data;
              break;
            }
          } catch (err) {
            if (err.message.includes('not publicly accessible')) throw err;
            continue;
          }
        }

        if (!parsedData) {
          throw new Error(
            'Could not load the sheet. Please ensure:\n' +
            '✅ Share → Anyone with the link → Viewer\n' +
            '✅ NOT restricted to organization only\n' +
            '✅ Valid Google Sheets URL'
          );
        }

        const jsonString = JSON.stringify(parsedData);
        const file = new File([jsonString], `GoogleSheet_${sheetId.slice(0, 8)}.json`, { type: 'application/json' });
        clearInterval(interval);
        await handleFile(file);
        return;
      }

      // For all databases and API URLs, use the robust Python backend
      const response = await connectDatabase({
        source: sourceInfo.id,
        ...formData
      });
      
      clearInterval(interval);
      setUploadProgress(100);
      
      const dbName = formData.database || (formData.url ? 'URL' : 'Import');
      const datasetName = `${sourceInfo.name} - ${dbName}`;
      
      const nextDataset = normalizeDataset({ ...response, name: datasetName });
      const previewRows = nextDataset.rows || [];
      const previewColumns = nextDataset.columns || [];
      const charged = await onBeforeUpload?.();
      if (charged === false) return;

      if (workerRef.current) {
        workerRef.current.postMessage({ rows: previewRows.slice(0, 1000), columns: previewColumns });
      } else {
        setPreviewMeta(profileDatasetRows(previewRows, previewColumns));
      }

      setUploadedFiles((prev) => [
        ...prev,
        {
          name: datasetName,
          size: JSON.stringify(previewRows).length,
          status: 'ready',
          storageMode: nextDataset.meta?.storage_mode || 'memory',
        },
      ]);
      
      onDatasetChange(nextDataset);
      onComplete('upload');
      addToast(`Data imported from ${sourceInfo.name} successfully.`, null, 'success');
    } catch (err) {
      clearInterval(interval);
      let message = err.response?.data?.detail || err.message || 'Failed to connect and import data.';
      
      if (sourceInfo.id === 'googlesheets' && (message.includes('Failed to fetch Google Sheet') || message.includes('Strategy'))) {
        message = "Could not access the sheet. Please check:\n✅ Sheet is set to 'Anyone with the link → Viewer'\n✅ URL is a valid Google Sheets link\n✅ Sheet is not restricted to organization only";
      }

      console.warn('DB connect failed:', message);
      setError(message);
      addToast(message, null, 'error');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const totalFiles = uploadedFiles.length
  const readyFiles = uploadedFiles.filter((f) => f.status === 'ready').length
  const processingFiles = loading ? 1 : 0

  const numColumnsCount = Object.values(previewMeta.types || {}).filter(t => t === 'number').length;
  const dateColumnsCount = Object.values(previewMeta.types || {}).filter(t => t === 'date').length;
  const catColumnsCount = Object.values(previewMeta.types || {}).filter(t => t === 'string' || t === 'boolean').length;
  const totalRows = dataset?.meta?.rows || dataset?.rows?.length || 0;
  const totalCols = dataset?.meta?.cols || dataset?.columns?.length || 0;

  const duplicateRows = (() => {
    if (!dataset?.rows) return 0;
    const seen = new Set();
    let duplicates = 0;
    dataset.rows.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) duplicates++;
      else seen.add(key);
    });
    return duplicates;
  })();
  const duplicatePct = totalRows > 0 ? ((duplicateRows / (dataset?.rows?.length || totalRows)) * 100).toFixed(2) : '0.00';

  const backendColsInfo = dataset?.meta?.columns_info || [];
  const missingData = (dataset?.columns || []).map(col => {
    const backendInfo = backendColsInfo.find(info => info.column === col);
    const count = backendInfo ? backendInfo.null : (previewMeta.nullCounts[col] || 0);
    const pct = backendInfo ? backendInfo.null_pct : (totalRows > 0 ? ((count / (dataset?.rows?.length || 1)) * 100).toFixed(2) : '0.00');
    return { col, count, pct: Number(pct).toFixed(2) };
  });

  const totalMissingCount = missingData.reduce((sum, item) => sum + item.count, 0);
  const totalCells = totalRows * totalCols;
  const totalMissingPct = totalCells > 0 ? ((totalMissingCount / totalCells) * 100).toFixed(2) : '0.00';

  return (
    <div style={{ padding: '0 0 32px 0', position: 'relative' }}>
      <button 
        type="button" 
        className="btn btn-secondary" 
        onClick={() => setIsDataSourcesOpen(true)}
        style={{ 
          position: 'absolute', 
          top: '55px', 
          right: '20px', 
          zIndex: 90,
          background: '#009973',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,153,115,0.4)',
          color: '#fff',
          fontWeight: '600',
          boxShadow: '0 4px 12px rgba(0,153,115,0.3)'
        }}
      >
        Data Sources
      </button>
      <div className="step-header">
        <div>
          <h1 className="page-title">Dataset Upload</h1>
          <p className="page-subtitle">Drag and drop CSV, Excel, or JSON files to begin the pipeline.</p>
        </div>
        <div className="header-actions" style={{ marginTop: '8px' }}>
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

      <div className="grid-2" style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              position: 'relative',
              background: dragging 
                ? 'linear-gradient(145deg, rgba(0,153,115,0.08), rgba(34,211,238,0.06))' 
                : 'linear-gradient(145deg, rgba(15,23,42,0.6), rgba(10,15,30,0.8))',
              border: 'none',
              borderRadius: '24px',
              padding: '3rem 2rem',
              transition: 'all 0.4s ease',
              cursor: 'pointer',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              overflow: 'hidden',
              outline: dragging ? '2px solid #009973' : '1.5px solid rgba(255,255,255,0.07)',
              boxShadow: dragging 
                ? '0 0 60px rgba(0,153,115,0.15), inset 0 0 60px rgba(0,153,115,0.05)' 
                : '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Animated corner gradient lines */}
            <div style={{ position:'absolute', inset:0, borderRadius:'24px', background: dragging ? 'none' : 'none', pointerEvents:'none',
              backgroundImage: 'linear-gradient(90deg, rgba(0,153,115,0.4) 0%, transparent 40%, transparent 60%, rgba(34,211,238,0.4) 100%)',
              WebkitMaskImage: 'linear-gradient(#fff 0 0)', maskComposite: 'exclude',
              opacity: 0.4 }} />

            {/* Glow orbs in background */}
            <div style={{ position:'absolute', top:'-30px', right:'-30px', width:'180px', height:'180px', borderRadius:'50%', background:'radial-gradient(circle, rgba(0,153,115,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:'-20px', left:'-20px', width:'140px', height:'140px', borderRadius:'50%', background:'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)', pointerEvents:'none' }} />

            {/* Upload icon — glowing orb */}
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(0,153,115,0.18), rgba(34,211,238,0.12))', 
              color: '#00c896', 
              width: '88px', height: '88px', 
              borderRadius: '26px',
              margin: '0 auto 1.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(0,153,115,0.35)',
              boxShadow: '0 0 40px rgba(0,153,115,0.2), 0 0 0 8px rgba(0,153,115,0.06)',
              transition: 'all 0.3s ease',
              position: 'relative'
            }}>
              {/* Pulse ring */}
              <div style={{ position:'absolute', inset:'-8px', borderRadius:'34px', border:'1px solid rgba(0,153,115,0.15)', animation:'pulse 2s infinite' }} />
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10L12 5L17 10" />
                <path d="M12 5V15" />
                <path d="M20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13" />
              </svg>
            </div>

            {/* Heading */}
            <h2 style={{ fontSize: '1.55rem', fontWeight: '800', margin: '0 0 0.6rem 0', color: '#fff', textAlign: 'center', letterSpacing: '-0.3px',
              background: 'linear-gradient(90deg, #fff 30%, #94e8d0)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              {dragging ? '✦ Release to upload' : 'Drop your dataset here'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', margin: '0 0 1.75rem 0', textAlign: 'center', fontSize: '14px', lineHeight: 1.6 }}>
              Drag &amp; drop your file or browse from your computer.<br/>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Supports .csv, .xlsx, .xls, .json — up to 2 GB</span>
            </p>

            {/* Format chips */}
            <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginBottom:'1.75rem', flexWrap:'wrap' }}>
              {['CSV', 'Excel', 'JSON'].map(fmt => (
                <span key={fmt} style={{ padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'600', letterSpacing:'0.5px',
                  background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)' }}>
                  {fmt}
                </span>
              ))}
            </div>

            {/* Browse Files button */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                disabled={loading}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: loading ? 'rgba(0,153,115,0.4)' : 'linear-gradient(135deg, #009973, #00c896)',
                  border: 'none',
                  color: '#fff',
                  boxShadow: loading ? 'none' : '0 4px 24px rgba(0,153,115,0.45)',
                  padding: '0.8rem 1.8rem',
                  borderRadius: '14px',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.25s ease',
                  letterSpacing: '0.2px'
                }}
                onMouseEnter={e => { if(!loading) { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(0,153,115,0.55)'; }}}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 24px rgba(0,153,115,0.45)'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {loading ? 'Uploading...' : 'Browse Files'}
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
            <div className="alert alert-warning" style={{ marginTop: '1rem', whiteSpace: 'pre-line' }}>
              {error}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title" style={{ textAlign: 'center' }}>Upload Summary</div>
          <div className="summary-list">
            <div className="summary-row">
              <span>Dataset Name</span>
              <strong>{dataset?.name || '--'}</strong>
            </div>
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
            {totalRows > 0 && (
              <>
                <div className="summary-row" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <span>Duplicate Rows</span>
                  <strong>{duplicateRows.toLocaleString()}</strong>
                </div>
                <div className="summary-row">
                  <span>Duplicate Percentage</span>
                  <strong>{duplicatePct}%</strong>
                </div>
                
                <div className="summary-row" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <span>Missing Values</span>
                  <strong>{totalMissingCount.toLocaleString()}</strong>
                </div>
                <div className="summary-row">
                  <span>Missing Percentage</span>
                  <strong>{totalMissingPct}%</strong>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {dataset && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Dataset Preview (sampled rows)</div>
            <CustomDropdown
              value={previewMode}
              onChange={(val) => setPreviewMode(val)}
              style={{ width: '220px' }}
            >
              <option value="head" style={{ background: '#0f172a', color: '#10b981' }}>Head (Top 20)</option>
              <option value="tail" style={{ background: '#0f172a', color: '#10b981' }}>Tail (Bottom 20)</option>
            </CustomDropdown>
          </div>
          <DatasetPreviewTable
            rows={previewMode === 'head' ? dataset.rows.slice(0, 20) : dataset.rows.slice(-20)}
            columns={dataset.columns}
            types={previewMeta.types}
            nullCounts={previewMeta.nullCounts}
          />
        </div>
      )}
      <DataSourcesModal 
        isOpen={isDataSourcesOpen} 
        onClose={() => setIsDataSourcesOpen(false)} 
        onSelectSource={(source) => {
          setIsDataSourcesOpen(false);
          setSelectedSource(source);
        }}
      />
      <ConnectionModal
        isOpen={!!selectedSource}
        onClose={() => setSelectedSource(null)}
        source={selectedSource}
        onConnect={(formData, source) => {
          setSelectedSource(null);
          simulateDatabaseImport(source, formData);
        }}
      />
    </div>
  )
}
