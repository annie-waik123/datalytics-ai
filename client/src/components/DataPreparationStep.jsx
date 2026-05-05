import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import DataTable from './DataTable.jsx'
import { useToast } from '../hooks/useToast.js'
import { buildDatasetProfile } from '../utils/dataset.js'
import CustomDropdown from './ui/CustomDropdown.jsx';
import {
  TARGET_ALL_COLUMNS,
  TARGET_ALL_CATEGORICAL,
  TARGET_ALL_NUMERIC,
  TARGET_ALL_TEXT,
  countDuplicateRows,
  fillMissingValues,
  findAndReplaceValues,
  removeDuplicateRows,
  removeOutliersIqr,
  trimTextValues,
} from '../utils/dataPreparation.js'

const FILL_METHOD_OPTIONS = {
  numeric: [
    { value: 'mean', label: 'Fill with Mean' },
    { value: 'median', label: 'Fill with Median' },
    { value: 'mode', label: 'Fill with Mode' },
    { value: 'constant', label: 'Fill with Custom Value' },
    { value: 'dropRows', label: 'Drop Rows with Missing Values' },
  ],
  categorical: [
    { value: 'mode', label: 'Fill with Mode' },
    { value: 'constant', label: 'Fill with Custom Value' },
    { value: 'dropRows', label: 'Drop Rows with Missing Values' },
  ],
  mixed: [
    { value: 'mode', label: 'Fill with Mode' },
    { value: 'constant', label: 'Fill with Custom Value' },
    { value: 'dropRows', label: 'Drop Rows with Missing Values' },
  ],
}

function formatDelta(value, invert = false) {
  if (!value) return 'No change'
  const positive = invert ? value < 0 : value > 0
  const neutralized = Math.abs(value)
  return `${positive ? '+' : '-'}${neutralized.toLocaleString()}`
}

function getFillScope(profile, target) {
  if (target === TARGET_ALL_NUMERIC) return 'numeric'
  if (target === TARGET_ALL_CATEGORICAL || target === TARGET_ALL_TEXT) return 'categorical'
  if (target === TARGET_ALL_COLUMNS) return 'mixed'
  return profile?.types?.[target] === 'number' ? 'numeric' : 'categorical'
}

function getSelectOptions(profile, mode) {
  const options = []

  if (mode === 'fill') {
    if (profile?.numericColumns?.length) options.push({ value: TARGET_ALL_NUMERIC, label: 'All Numeric Columns' })
    if (profile?.categoricalColumns?.length) options.push({ value: TARGET_ALL_CATEGORICAL, label: 'All Text / Categorical Columns' })
    options.push({ value: TARGET_ALL_COLUMNS, label: 'All Columns' })
  }

  if (mode === 'replace') {
    options.push({ value: TARGET_ALL_TEXT, label: 'All Text Columns' })
  }

  if (mode === 'outliers' && profile?.numericColumns?.length) {
    options.push({ value: TARGET_ALL_NUMERIC, label: 'All Numeric Columns' })
  }

  profile?.columns?.forEach((column) => {
    if (mode === 'outliers' && profile?.types?.[column] !== 'number') return
    if (mode === 'replace' && profile?.types?.[column] === 'number') return
    options.push({ value: column, label: column })
  })

  return options
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint && <div className="prep-metric-hint">{hint}</div>}
    </div>
  )
}

export default function DataPreparationStep({
  dataset,
  datasetProfile,
  onContinue,
  onJumpToUpload,
}) {
  const { addToast } = useToast()
  const [workingDataset, setWorkingDataset] = useState(dataset)
  const [history, setHistory] = useState([])
  const [dirty, setDirty] = useState(false)
  const [fillTarget, setFillTarget] = useState(TARGET_ALL_NUMERIC)
  const [fillMethod, setFillMethod] = useState('mean')
  const [fillConstant, setFillConstant] = useState('')
  const [outlierTarget, setOutlierTarget] = useState(TARGET_ALL_NUMERIC)
  const [outlierMode, setOutlierMode] = useState('remove')
  const [replaceTarget, setReplaceTarget] = useState(TARGET_ALL_TEXT)
  const [replaceMode, setReplaceMode] = useState('contains')
  const [findValue, setFindValue] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [dtypeTarget, setDtypeTarget] = useState('')
  const [dtypeType, setDtypeType] = useState('number')
  const [dropCols, setDropCols] = useState([])
  const [textCleanTarget, setTextCleanTarget] = useState('__all_text__')
  const [textCleanOps, setTextCleanOps] = useState({ lowercase: true, uppercase: false, punctuation: true, stopwords: false })
  const [validCol, setValidCol] = useState('')
  const [validMin, setValidMin] = useState('')
  const [validMax, setValidMax] = useState('')
  const [validAction, setValidAction] = useState('nullify')
  const [validResult, setValidResult] = useState(null)

  const baseProfile = useMemo(() => datasetProfile || (dataset ? buildDatasetProfile(dataset) : null), [dataset, datasetProfile])
  const workingProfile = useMemo(() => (workingDataset ? buildDatasetProfile(workingDataset) : null), [workingDataset])
  const baseDuplicates = useMemo(() => countDuplicateRows(dataset), [dataset])
  const workingDuplicates = useMemo(() => countDuplicateRows(workingDataset), [workingDataset])

  useEffect(() => {
    setWorkingDataset(dataset)
    setHistory([])
    setDirty(false)
  }, [dataset])

  useEffect(() => {
    if (!workingProfile) return

    const fillOptions = getSelectOptions(workingProfile, 'fill')
    const outlierOptions = getSelectOptions(workingProfile, 'outliers')
    const replaceOptions = getSelectOptions(workingProfile, 'replace')

    if (!fillOptions.some((option) => option.value === fillTarget)) {
      setFillTarget(fillOptions[0]?.value || TARGET_ALL_COLUMNS)
    }
    if (!outlierOptions.some((option) => option.value === outlierTarget)) {
      setOutlierTarget(outlierOptions[0]?.value || TARGET_ALL_NUMERIC)
    }
    if (!replaceOptions.some((option) => option.value === replaceTarget)) {
      setReplaceTarget(replaceOptions[0]?.value || TARGET_ALL_TEXT)
    }
  }, [fillTarget, outlierTarget, replaceTarget, workingProfile])

  const fillScope = getFillScope(workingProfile, fillTarget)
  const fillOptions = FILL_METHOD_OPTIONS[fillScope]

  useEffect(() => {
    if (!fillOptions.some((option) => option.value === fillMethod)) {
      setFillMethod(fillOptions[0]?.value || 'mode')
    }
  }, [fillMethod, fillOptions])

  if (!dataset || !workingDataset || !workingProfile || !baseProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to prepare it</h2>
        <p>Clean missing values, remove outliers, and standardize columns before exploration.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  function pushHistory(previousDataset) {
    setHistory((prev) => [...prev.slice(-14), previousDataset])
  }

  function applyResult(result) {
    if (!result?.changedCount) {
      addToast(result?.message || 'No changes were made.', null, 'warning')
      return
    }

    pushHistory(workingDataset)
    setWorkingDataset(result.dataset)
    setDirty(true)
    addToast(result.message, null, 'success')
  }

  function handleUndo() {
    if (!history.length) {
      addToast('There is nothing to undo yet.', null, 'warning')
      return
    }

    const previous = history[history.length - 1]
    setHistory((prev) => prev.slice(0, -1))
    setWorkingDataset(previous)
    setDirty(previous !== dataset || history.length > 1)
    addToast('Reverted the last preparation change.', null, 'success')
  }

  function handleResetWorkingCopy() {
    setWorkingDataset(dataset)
    setHistory([])
    setDirty(false)
    addToast('Reset the working copy to the saved dataset.', null, 'success')
  }

  function handleContinue() {
    if (!workingDataset.rows.length) {
      addToast('The cleaned dataset has no rows left. Undo or reset before continuing.', null, 'error')
      return
    }

    onContinue(workingDataset, dirty)
    addToast(dirty ? 'Prepared dataset saved. Moving to visualization.' : 'Continuing with the current dataset.', null, 'success')
  }

  function handleDownloadCSV() {
    if (!workingDataset || !workingDataset.rows.length) {
      addToast('No data to download.', null, 'warning')
      return
    }
    const csv = Papa.unparse(workingDataset.rows, { columns: workingDataset.columns })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'prepared_dataset.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    addToast('Prepared dataset downloaded as CSV.', null, 'success')
  }

  function handleDownloadXLSX() {
    if (!workingDataset || !workingDataset.rows.length) {
      addToast('No data to download.', null, 'warning')
      return
    }
    const ws = XLSX.utils.json_to_sheet(workingDataset.rows, { header: workingDataset.columns })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Prepared Data")
    XLSX.writeFile(wb, "prepared_dataset.xlsx")
    addToast('Prepared dataset downloaded as XLSX.', null, 'success')
  }

  /* ── Data Type Fix helpers ────────────────────────────── */
  function coerceColumn(rows, col, toType) {
    return rows.map((row) => {
      const raw = row[col]
      if (raw === null || raw === undefined || raw === '') return { ...row, [col]: null }
      try {
        if (toType === 'number') {
          if (typeof raw === 'number') return { ...row, [col]: raw }
          const cleaned = String(raw).replace(/[^\d.-]/g, '')
          const n = Number(cleaned)
          return { ...row, [col]: isNaN(n) || cleaned === '' ? null : n }
        }
        if (toType === 'boolean') {
          const s = String(raw).trim().toLowerCase()
          return { ...row, [col]: s === 'true' || s === '1' || s === 'yes' }
        }
        if (toType === 'date') {
          const d = new Date(raw)
          return { ...row, [col]: isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10) }
        }
        return { ...row, [col]: String(raw) }
      } catch { return { ...row, [col]: null } }
    })
  }

  function handleFixDataType() {
    if (!dtypeTarget) { addToast('Select a column first.', null, 'warning'); return }
    const cols = dtypeTarget === '__all__' ? workingDataset.columns : [dtypeTarget]
    let rows = [...workingDataset.rows]
    cols.forEach((col) => { rows = coerceColumn(rows, col, dtypeType) })
    const changed = rows.filter((r, i) => r[cols[0]] !== workingDataset.rows[i][cols[0]]).length
    if (!changed) { addToast('No values were converted — they may already be this type.', null, 'warning'); return }
    pushHistory(workingDataset)
    setWorkingDataset({ ...workingDataset, rows })
    setDirty(true)
    addToast(`Converted ${cols.length > 1 ? 'multiple columns' : `"${dtypeTarget}"`} to ${dtypeType}. ${changed} cells updated.`, null, 'success')
  }

  function handleAutoFixTypes() {
    const cols = workingDataset.columns
    let rows = [...workingDataset.rows]
    const fixed = []
    cols.forEach((col) => {
      // Only attempt auto-fix on non-numeric looking columns
      const sample = rows.slice(0, 100).map((r) => r[col]).filter((v) => v !== null && v !== '')
      
      const allNumeric = sample.length > 0 && sample.every((v) => {
        if (typeof v === 'number') return true
        const cleaned = String(v).replace(/[^\d.-]/g, '')
        return cleaned !== '' && !isNaN(Number(cleaned))
      })

      if (allNumeric && workingProfile?.types?.[col] !== 'number') {
        rows = coerceColumn(rows, col, 'number')
        fixed.push(col)
      }
    })
    if (!fixed.length) { addToast('All columns appear to already have the correct data types.', null, 'info'); return }
    pushHistory(workingDataset)
    setWorkingDataset({ ...workingDataset, rows })
    setDirty(true)
    addToast(`Auto-fixed ${fixed.length} column(s) to numeric: ${fixed.slice(0, 5).join(', ')}${fixed.length > 5 ? '…' : ''}`, null, 'success')
  }

  function handleDropColumns() {
    if (!dropCols.length) { addToast('Select at least one column to drop.', null, 'warning'); return }
    if (dropCols.length >= workingDataset.columns.length) {
      addToast('You cannot drop all columns — keep at least one.', null, 'error')
      return
    }
    const remaining = workingDataset.columns.filter((c) => !dropCols.includes(c))
    const rows = workingDataset.rows.map((row) => {
      const next = {}
      remaining.forEach((c) => { next[c] = row[c] })
      return next
    })
    pushHistory(workingDataset)
    setWorkingDataset({ columns: remaining, rows })
    setDropCols([])
    setDirty(true)
    addToast(`Dropped ${dropCols.length} column(s): ${dropCols.slice(0, 4).join(', ')}${dropCols.length > 4 ? '…' : ''}`, null, 'success')
  }

  /* Common English stopwords */
  const STOPWORDS = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','may','might','shall','must','can','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','this','that','these','those','what','which','who','whom','how','when','where','why','if','as','not','no','nor','so','yet','both','either','neither','just','also'])

  function cleanText(str, ops) {
    if (typeof str !== 'string') return str
    let s = str
    if (ops.lowercase) s = s.toLowerCase()
    if (ops.uppercase) s = s.toUpperCase()
    if (ops.punctuation) s = s.replace(/[^\w\s]/g, '').replace(/_/g, ' ')
    if (ops.stopwords) s = s.split(/\s+/).filter((w) => w && !STOPWORDS.has(w.toLowerCase())).join(' ')
    return s.trim()
  }

  function handleTextClean() {
    const ops = textCleanOps
    if (!ops.lowercase && !ops.uppercase && !ops.punctuation && !ops.stopwords) {
      addToast('Select at least one cleaning operation.', null, 'warning')
      return
    }
    const textCols = textCleanTarget === '__all_text__'
      ? workingDataset.columns.filter((c) => workingProfile?.types?.[c] !== 'number')
      : [textCleanTarget]
    if (!textCols.length) { addToast('No text columns found in the dataset.', null, 'warning'); return }
    let changed = 0
    const rows = workingDataset.rows.map((row) => {
      const next = { ...row }
      textCols.forEach((col) => {
        const cleaned = cleanText(row[col], ops)
        if (cleaned !== row[col]) { next[col] = cleaned; changed++ }
      })
      return next
    })
    if (!changed) { addToast('No changes needed — values may already be clean.', null, 'info'); return }
    pushHistory(workingDataset)
    setWorkingDataset({ ...workingDataset, rows })
    setDirty(true)
    const opsApplied = [
      ops.lowercase && 'Lowercase',
      ops.uppercase && 'Uppercase',
      ops.punctuation && 'Punctuation Removed',
      ops.stopwords && 'Stopwords Removed',
    ].filter(Boolean).join(', ')
    addToast(`Text cleaned (${opsApplied}) across ${textCols.length} column(s). ${changed} cells updated.`, null, 'success')
  }

  /* ── Data Validation helpers ───────────────────────── */
  function handleValidate() {
    if (!validCol) { addToast('Select a column to validate.', null, 'warning'); return }
    const min = validMin !== '' ? Number(validMin) : null
    const max = validMax !== '' ? Number(validMax) : null
    if (min === null && max === null) { addToast('Enter at least a Min or Max value.', null, 'warning'); return }

    const violations = []
    workingDataset.rows.forEach((row, idx) => {
      const val = Number(row[validCol])
      const isNull = row[validCol] === null || row[validCol] === '' || row[validCol] === undefined
      const belowMin = min !== null && !isNull && val < min
      const aboveMax = max !== null && !isNull && val > max
      if (isNull || belowMin || aboveMax) {
        violations.push({
          rowIndex: idx,
          value: row[validCol],
          reason: isNull ? 'null / missing' : belowMin ? `${val} < min (${min})` : `${val} > max (${max})`,
        })
      }
    })
    setValidResult({ violations, col: validCol, min, max })
    if (!violations.length) {
      addToast(`✅ No violations found in "${validCol}" — all values are within range.`, null, 'success')
    } else {
      addToast(`⚠️ Found ${violations.length} violation(s) in "${validCol}".`, null, 'warning')
    }
  }

  function handleFixViolations() {
    if (!validResult?.violations?.length) { addToast('Run Validate first.', null, 'warning'); return }
    const violatingIndexes = new Set(validResult.violations.map((v) => v.rowIndex))
    let rows
    if (validAction === 'drop') {
      rows = workingDataset.rows.filter((_, i) => !violatingIndexes.has(i))
    } else {
      rows = workingDataset.rows.map((row, i) =>
        violatingIndexes.has(i) ? { ...row, [validResult.col]: null } : row
      )
    }
    pushHistory(workingDataset)
    setWorkingDataset({ ...workingDataset, rows })
    setDirty(true)
    setValidResult(null)
    addToast(
      validAction === 'drop'
        ? `Dropped ${violatingIndexes.size} invalid row(s) from "${validResult.col}".`
        : `Set ${violatingIndexes.size} invalid value(s) to null in "${validResult.col}".`,
      null, 'success'
    )
  }

  const rowDelta = (workingProfile.rowCount || 0) - (baseProfile.rowCount || 0)
  const missingDelta = (workingProfile.missingTotal || 0) - (baseProfile.missingTotal || 0)
  const duplicateDelta = workingDuplicates - baseDuplicates

  return (
    <div className="prep-container">
      <div className="step-header">
        <div>
          <h1 className="page-title">Data Preparation</h1>
          <p className="page-subtitle">Clean missing values, remove outliers, and standardize rows before analysis. Changes stay local here until you save and continue.</p>
        </div>
        <div className="flex flex-1 items-center justify-end gap-6 w-full ml-auto">
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary" onClick={handleUndo}>
              Undo
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleResetWorkingCopy}>
              Reset Working Copy
            </button>
            <button type="button" className="btn btn-primary" onClick={handleContinue}>
              {dirty ? 'Save & Continue' : 'Continue to Visualization'}
            </button>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-6 ml-auto">
            <button type="button" className="btn btn-secondary hover:!bg-emerald-500 hover:!text-white hover:!border-emerald-500 transition-colors duration-200" onClick={handleDownloadCSV}>
              Download CSV
            </button>
            <button type="button" className="btn btn-secondary hover:!bg-emerald-500 hover:!text-white hover:!border-emerald-500 transition-colors duration-200" onClick={handleDownloadXLSX}>
              Download XLSX
            </button>
          </div>
        </div>
      </div>

      <div className="prep-banner">
        <span className={`badge ${dirty ? 'warning' : 'success'}`}>
          {dirty ? 'Unsaved changes in working copy' : 'Working copy matches saved dataset'}
        </span>
        <span className="prep-banner-copy">
          Apply any combination of cleaning operations, preview the result, then continue when the dataset looks right.
        </span>
      </div>

      <div className="prep-metrics-grid">
        <MetricCard
          label="Rows"
          value={(workingProfile.rowCount ?? 0).toLocaleString()}
          hint={`Loaded: ${(baseProfile.rowCount ?? 0).toLocaleString()} | ${formatDelta(rowDelta)}`}
        />
        <MetricCard
          label="Missing Cells"
          value={(workingProfile.missingTotal ?? 0).toLocaleString()}
          hint={`Loaded: ${(baseProfile.missingTotal ?? 0).toLocaleString()} | ${formatDelta(missingDelta, true)}`}
        />
        <MetricCard
          label="Duplicate Rows"
          value={(workingDuplicates ?? 0).toLocaleString()}
          hint={`Loaded: ${(baseDuplicates ?? 0).toLocaleString()} | ${formatDelta(duplicateDelta, true)}`}
        />
        <MetricCard
          label="Numeric Columns"
          value={workingProfile.numericColumns?.length ?? 0}
          hint={`${workingProfile.categoricalColumns?.length ?? 0} text/date columns`}
        />
      </div>

      <div className="prep-grid">
        <div className="card prep-card">
          <div className="prep-card-header">
            <div>
              <div className="prep-card-title">Missing Values</div>
              <p className="prep-card-copy">Fill with mean, median, mode, or a custom value. You can also drop incomplete rows.</p>
            </div>
            <span className="badge badge-orange">{workingProfile.missingTotal.toLocaleString()} missing cells</span>
          </div>

          <div className="prep-form-grid">
            <label className="prep-field">
              <span>Target</span>
              <CustomDropdown value={fillTarget} onChange={(value) => setFillTarget(value)}>
                {getSelectOptions(workingProfile, 'fill').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </CustomDropdown>
            </label>

            <label className="prep-field">
              <span>Method</span>
              <CustomDropdown value={fillMethod} onChange={(value) => setFillMethod(value)}>
                {fillOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </CustomDropdown>
            </label>

            {fillMethod === 'constant' && (
              <label className="prep-field prep-field-full">
                <span>Custom Value</span>
                <input
                  type="text"
                  value={fillConstant}
                  onChange={(event) => setFillConstant(event.target.value)}
                  placeholder="Enter the replacement value"
                />
              </label>
            )}
          </div>

          <div className="prep-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => applyResult(fillMissingValues(workingDataset, workingProfile, {
                target: fillTarget,
                method: fillMethod,
                constantValue: fillConstant,
              }))}
            >
              Apply Missing Value
            </button>
          </div>
        </div>

        <div className="card prep-card">
          <div className="prep-card-header">
            <div>
              <div className="prep-card-title">Outlier Handling</div>
              <p className="prep-card-copy">Use IQR bounds to remove outlier rows or cap extreme values for selected numeric columns.</p>
            </div>
            <span className="badge badge-orange">{workingProfile.numericColumns.length} numeric columns</span>
          </div>

          <div className="prep-form-grid">
            <label className="prep-field">
              <span>Numeric Target</span>
              <CustomDropdown value={outlierTarget} onChange={(value) => setOutlierTarget(value)}>
                {getSelectOptions(workingProfile, 'outliers').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </CustomDropdown>
            </label>

            <label className="prep-field">
              <span>Action</span>
              <CustomDropdown value={outlierMode} onChange={(value) => setOutlierMode(value)}>
                <option value="remove">Remove Outlier Rows</option>
                <option value="cap">Cap to IQR Bounds</option>
              </CustomDropdown>
            </label>
          </div>

          <div className="prep-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => applyResult(removeOutliersIqr(workingDataset, workingProfile, {
                target: outlierTarget,
                mode: outlierMode,
              }))}
            >
              Apply Outlier Rule
            </button>
          </div>
        </div>
      </div>

      <div className="prep-grid">
        <div className="card prep-card">
          <div className="prep-card-header">
            <div>
              <div className="prep-card-title">Manual Find & Replace</div>
              <p className="prep-card-copy">Replace exact values or partial text matches in one column or across all text columns.</p>
            </div>
            <span className="badge">{replaceMode === 'contains' ? 'Partial match' : 'Exact match'}</span>
          </div>

          <div className="prep-form-grid">
            <label className="prep-field">
              <span>Column Scope</span>
              <CustomDropdown value={replaceTarget} onChange={(value) => setReplaceTarget(value)}>
                {getSelectOptions(workingProfile, 'replace').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </CustomDropdown>
            </label>

            <label className="prep-field">
              <span>Replace Mode</span>
              <CustomDropdown value={replaceMode} onChange={(value) => setReplaceMode(value)}>
                <option value="contains">Replace Matching Text</option>
                <option value="exact">Replace Whole Cell Only</option>
              </CustomDropdown>
            </label>

            <label className="prep-field">
              <span>Find</span>
              <input
                type="text"
                value={findValue}
                onChange={(event) => setFindValue(event.target.value)}
                placeholder="Value to find"
              />
            </label>

            <label className="prep-field">
              <span>Replace With</span>
              <input
                type="text"
                value={replaceValue}
                onChange={(event) => setReplaceValue(event.target.value)}
                placeholder="Replacement value"
              />
            </label>
          </div>

          <div className="prep-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => applyResult(findAndReplaceValues(workingDataset, workingProfile, {
                target: replaceTarget,
                findValue,
                replaceValue,
                mode: replaceMode,
              }))}
            >
              Apply Find & Replace
            </button>
          </div>
        </div>

        <div className="card prep-card">
          <div className="prep-card-header">
            <div>
              <div className="prep-card-title">Quick Cleaning Actions</div>
              <p className="prep-card-copy">Use the most common cleanup steps in one click before doing more targeted work.</p>
            </div>
          </div>

          <div className="prep-quick-grid">
            <button
              type="button"
              className="prep-quick-button"
              onClick={() => applyResult(removeDuplicateRows(workingDataset))}
            >
              <strong>Remove Duplicates</strong>
              <span>Drop repeated rows from the working copy.</span>
            </button>

            <button
              type="button"
              className="prep-quick-button"
              onClick={() => applyResult(trimTextValues(workingDataset, workingProfile, TARGET_ALL_TEXT))}
            >
              <strong>Trim Text Columns</strong>
              <span>Remove leading and trailing whitespace.</span>
            </button>

            <button
              type="button"
              className="prep-quick-button"
              onClick={() => applyResult(fillMissingValues(workingDataset, workingProfile, {
                target: TARGET_ALL_COLUMNS,
                method: 'dropRows',
              }))}
            >
              <strong>Drop Incomplete Rows</strong>
              <span>Remove rows containing any missing cell.</span>
            </button>

            <button
              type="button"
              className="prep-quick-button"
              onClick={handleResetWorkingCopy}
            >
              <strong>Discard Working Changes</strong>
              <span>Return this screen to the saved dataset snapshot.</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Remove Irrelevant Data ── */}
      <div className="prep-grid">
        <div className="card prep-card" style={{ gridColumn: '1 / -1' }}>
          <div className="prep-card-header">
            <div>
              <div className="prep-card-title">Remove Irrelevant Data</div>
              <p className="prep-card-copy">Select columns that are not useful for analysis (IDs, constants, junk) and drop them from the working dataset.</p>
            </div>
            <span className="badge">{workingDataset.columns.length} columns total</span>
          </div>

          <div className="prep-col-grid">
            {workingDataset.columns.map((col) => {
              const checked = dropCols.includes(col)
              return (
                <label
                  key={col}
                  className={`prep-col-chip${checked ? ' is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDropCols((prev) =>
                        prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                      )
                    }
                  />
                  <span>{col}</span>
                  {workingProfile?.types?.[col] === 'number'
                    ? <em className="prep-col-type prep-col-type--num">num</em>
                    : <em className="prep-col-type">txt</em>}
                </label>
              )
            })}
          </div>

          {dropCols.length > 0 && (
            <div className="prep-drop-summary">
              <span>{dropCols.length} column{dropCols.length > 1 ? 's' : ''} selected to drop: <strong>{dropCols.join(', ')}</strong></span>
              <button type="button" className="prep-clear-btn" onClick={() => setDropCols([])}>
                Clear Selection
              </button>
            </div>
          )}

          <div className="prep-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDropColumns}
              disabled={!dropCols.length}
            >
              Drop Selected Columns
            </button>
          </div>
        </div>
      </div>

      {/* ── Text Cleaning ── */}
      <div className="prep-grid">
        <div className="card prep-card" style={{ gridColumn: '1 / -1' }}>
          <div className="prep-card-header">
            <div>
              <div className="prep-card-title">Text Cleaning</div>
              <p className="prep-card-copy">Apply NLP-style cleaning operations to text columns — lowercase, remove punctuation, or strip common stopwords.</p>
            </div>
            <span className="badge">{workingProfile?.categoricalColumns?.length ?? 0} text columns</span>
          </div>

          <div className="prep-form-grid">
            <label className="prep-field">
              <span>Target Column</span>
              <CustomDropdown value={textCleanTarget} onChange={(value) => setTextCleanTarget(value)}>
                <option value="__all_text__">All Text Columns</option>
                {workingDataset.columns
                  .filter((c) => workingProfile?.types?.[c] !== 'number')
                  .map((col) => <option key={col} value={col}>{col}</option>)}
              </CustomDropdown>
            </label>

            <div className="prep-field">
              <span className="prep-field-label">Cleaning Operations</span>
              <div className="prep-text-ops">
                <label className="prep-text-op-item">
                  <input
                    type="checkbox"
                    checked={textCleanOps.lowercase}
                    onChange={(e) => setTextCleanOps((p) => ({
                      ...p,
                      lowercase: e.target.checked,
                      uppercase: e.target.checked ? false : p.uppercase,
                    }))}
                  />
                  <span>🔡 Lowercase</span>
                  <em>Convert all text to lower case</em>
                </label>
                <label className="prep-text-op-item">
                  <input
                    type="checkbox"
                    checked={textCleanOps.uppercase}
                    onChange={(e) => setTextCleanOps((p) => ({
                      ...p,
                      uppercase: e.target.checked,
                      lowercase: e.target.checked ? false : p.lowercase,
                    }))}
                  />
                  <span>🔠 Uppercase</span>
                  <em>Convert all text to UPPER CASE</em>
                </label>
                <label className="prep-text-op-item">
                  <input
                    type="checkbox"
                    checked={textCleanOps.punctuation}
                    onChange={(e) => setTextCleanOps((p) => ({ ...p, punctuation: e.target.checked }))}
                  />
                  <span>🚫 Punctuation Remove</span>
                  <em>Strip ! . , ; : " ' and other symbols</em>
                </label>
                <label className="prep-text-op-item">
                  <input
                    type="checkbox"
                    checked={textCleanOps.stopwords}
                    onChange={(e) => setTextCleanOps((p) => ({ ...p, stopwords: e.target.checked }))}
                  />
                  <span>📚 Stopwords Remove</span>
                  <em>Remove common words (the, a, is, are…)</em>
                </label>
              </div>
            </div>
          </div>

          <div className="prep-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleTextClean}
            >
              Apply Text Cleaning
            </button>
          </div>
        </div>
      </div>

      <div className="prep-grid">
        <div className="card prep-card" style={{ gridColumn: '1 / -1' }}>
          <div className="prep-card-header">
            <div>
              <div className="prep-card-title">Data Type Fixing</div>
              <p className="prep-card-copy">Convert column values to the correct type — numeric, text, boolean, or date. Use Auto Fix to detect and convert all text columns that contain numbers.</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAutoFixTypes}
              title="Scan all columns and auto-convert text columns that contain numeric values"
            >
              ⚡ Auto Fix Data Types
            </button>
          </div>

          <div className="prep-form-grid">
            <label className="prep-field">
              <span>Select Column</span>
              <CustomDropdown value={dtypeTarget} onChange={(value) => setDtypeTarget(value)}>
                <option value="">— Pick a column —</option>
                <option value="__all__">All Columns</option>
                {workingDataset.columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </CustomDropdown>
            </label>

            <label className="prep-field">
              <span>Convert To</span>
              <CustomDropdown value={dtypeType} onChange={(value) => setDtypeType(value)}>
                <option value="number">Numeric (Float / Int)</option>
                <option value="string">Text / String</option>
                <option value="boolean">Boolean (true / false)</option>
                <option value="date">Date (YYYY-MM-DD)</option>
              </CustomDropdown>
            </label>
          </div>

          <div className="prep-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFixDataType}
              disabled={!dtypeTarget}
            >
              Fix Data Type
            </button>
          </div>
        </div>
      </div>

      {/* ── Data Validation ── */}
      <div className="prep-grid">
        <div className="card prep-card" style={{ gridColumn: '1 / -1' }}>
          <div className="prep-card-header">
            <div>
              <div className="prep-card-title">Data Validation ✔️</div>
              <p className="prep-card-copy">Check numeric columns for out-of-range values and logical errors (e.g. Age = −5 ❌, Price = −99999 ❌). Set Min/Max range, validate, then fix violations.</p>
            </div>
            {validResult && (
              <span className={`badge ${validResult.violations.length ? 'badge-orange' : ''}`}>
                {validResult.violations.length ? `⚠️ ${validResult.violations.length} violations` : '✅ Clean'}
              </span>
            )}
          </div>

          <div className="prep-form-grid">
            <label className="prep-field">
              <span>Numeric Column</span>
              <CustomDropdown value={validCol} onChange={(value) => { setValidCol(value); setValidResult(null) }}>
                <option value="">— Pick a column —</option>
                {workingDataset.columns
                  .filter((c) => workingProfile?.types?.[c] === 'number')
                  .map((col) => <option key={col} value={col}>{col}</option>)}
              </CustomDropdown>
            </label>

            <label className="prep-field">
              <span>Fix Action</span>
              <CustomDropdown value={validAction} onChange={(value) => setValidAction(value)}>
                <option value="nullify">Set Invalid to Null</option>
                <option value="drop">Drop Invalid Rows</option>
              </CustomDropdown>
            </label>

            <label className="prep-field">
              <span>Min Valid Value</span>
              <input
                type="number"
                value={validMin}
                onChange={(e) => { setValidMin(e.target.value); setValidResult(null) }}
                placeholder="e.g. 0  (leave blank to skip)"
              />
            </label>

            <label className="prep-field">
              <span>Max Valid Value</span>
              <input
                type="number"
                value={validMax}
                onChange={(e) => { setValidMax(e.target.value); setValidResult(null) }}
                placeholder="e.g. 120  (leave blank to skip)"
              />
            </label>
          </div>

          {/* Violation table */}
          {validResult?.violations?.length > 0 && (
            <div className="prep-validation-result">
              <div className="prep-validation-header">
                <span>⚠️ {validResult.violations.length} violation(s) in <strong>&quot;{validResult.col}&quot;</strong></span>
                <span className="prep-validation-range">Valid range: [{validResult.min ?? '−∞'} — {validResult.max ?? '+∞'}]</span>
              </div>
              <div className="prep-validation-table-wrap">
                <table className="prep-validation-table">
                  <thead>
                    <tr><th>Row #</th><th>Value</th><th>Issue</th></tr>
                  </thead>
                  <tbody>
                    {validResult.violations.slice(0, 12).map((v) => (
                      <tr key={v.rowIndex}>
                        <td>{v.rowIndex + 1}</td>
                        <td className="prep-val-cell">{String(v.value ?? 'null')}</td>
                        <td className="prep-val-issue">{v.reason}</td>
                      </tr>
                    ))}
                    {validResult.violations.length > 12 && (
                      <tr><td colSpan={3} className="prep-val-more">+ {validResult.violations.length - 12} more violations not shown</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {validResult?.violations?.length === 0 && (
            <div className="prep-validation-ok">
              ✅ All values in &quot;{validResult.col}&quot; are within [{validResult.min ?? '−∞'} — {validResult.max ?? '+∞'}]. No action needed.
            </div>
          )}

          <div className="prep-actions">
            <button type="button" className="btn btn-secondary" onClick={handleValidate} disabled={!validCol}>
              🔍 Validate Column
            </button>
            {validResult?.violations?.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={handleFixViolations}>
                Fix {validResult.violations.length} Violation(s)
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="prep-card-header">
          <div>
            <div className="prep-card-title">Prepared Dataset Preview</div>
            <p className="prep-card-copy">Preview the first 40 rows of the working copy before sending it into exploration, charts, and modeling.</p>
          </div>
          <div className="prep-preview-badges">
            <span className="badge">Rows: {(workingProfile.rowCount ?? 0).toLocaleString()}</span>
            <span className="badge">Missing: {(workingProfile.missingTotal ?? 0).toLocaleString()}</span>
            <span className="badge">Duplicates: {(workingDuplicates ?? 0).toLocaleString()}</span>
          </div>
        </div>

        <DataTable
          rows={workingDataset.rows}
          columns={workingDataset.columns}
          limit={40}
          pageSize={8}
          sortable
          highlightNulls
        />
      </div>
    </div>
  )
}
