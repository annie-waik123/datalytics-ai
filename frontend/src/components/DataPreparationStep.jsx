import { useEffect, useMemo, useState } from 'react'
import DataTable from './DataTable.jsx'
import { useToast } from '../hooks/useToast.js'
import { buildDatasetProfile } from '../utils/dataset.js'
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
    addToast(dirty ? 'Prepared dataset saved. Moving to exploration.' : 'Continuing with the current dataset.', null, 'success')
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
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={handleUndo}>
            Undo
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleResetWorkingCopy}>
            Reset Working Copy
          </button>
          <button type="button" className="btn btn-primary" onClick={handleContinue}>
            {dirty ? 'Save & Continue' : 'Continue to Exploration'}
          </button>
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
          value={workingProfile.rowCount.toLocaleString()}
          hint={`Loaded: ${baseProfile.rowCount.toLocaleString()} | ${formatDelta(rowDelta)}`}
        />
        <MetricCard
          label="Missing Cells"
          value={workingProfile.missingTotal.toLocaleString()}
          hint={`Loaded: ${baseProfile.missingTotal.toLocaleString()} | ${formatDelta(missingDelta, true)}`}
        />
        <MetricCard
          label="Duplicate Rows"
          value={workingDuplicates.toLocaleString()}
          hint={`Loaded: ${baseDuplicates.toLocaleString()} | ${formatDelta(duplicateDelta, true)}`}
        />
        <MetricCard
          label="Numeric Columns"
          value={workingProfile.numericColumns.length}
          hint={`${workingProfile.categoricalColumns.length} text/date columns`}
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
              <select value={fillTarget} onChange={(event) => setFillTarget(event.target.value)}>
                {getSelectOptions(workingProfile, 'fill').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="prep-field">
              <span>Method</span>
              <select value={fillMethod} onChange={(event) => setFillMethod(event.target.value)}>
                {fillOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
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
              Apply Missing-Value Cleaning
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
              <select value={outlierTarget} onChange={(event) => setOutlierTarget(event.target.value)}>
                {getSelectOptions(workingProfile, 'outliers').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="prep-field">
              <span>Action</span>
              <select value={outlierMode} onChange={(event) => setOutlierMode(event.target.value)}>
                <option value="remove">Remove Outlier Rows</option>
                <option value="cap">Cap to IQR Bounds</option>
              </select>
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
              <select value={replaceTarget} onChange={(event) => setReplaceTarget(event.target.value)}>
                {getSelectOptions(workingProfile, 'replace').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="prep-field">
              <span>Replace Mode</span>
              <select value={replaceMode} onChange={(event) => setReplaceMode(event.target.value)}>
                <option value="contains">Replace Matching Text</option>
                <option value="exact">Replace Whole Cell Only</option>
              </select>
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

      <div className="glass-card">
        <div className="prep-card-header">
          <div>
            <div className="prep-card-title">Prepared Dataset Preview</div>
            <p className="prep-card-copy">Preview the first 40 rows of the working copy before sending it into exploration, charts, and modeling.</p>
          </div>
          <div className="prep-preview-badges">
            <span className="badge">Rows: {workingProfile.rowCount.toLocaleString()}</span>
            <span className="badge">Missing: {workingProfile.missingTotal.toLocaleString()}</span>
            <span className="badge">Duplicates: {workingDuplicates.toLocaleString()}</span>
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
