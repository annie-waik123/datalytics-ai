const NUMBER_RE = /^-?\d+(?:\.\d+)?$/

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map(value => value.trim())
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (!lines.length) {
    return { columns: [], rows: [] }
  }

  const columns = parseCsvLine(lines[0])
  const rows = []

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i])
    const row = {}
    columns.forEach((col, idx) => {
      row[col] = values[idx] ?? ''
    })
    rows.push(row)
  }

  return { columns, rows }
}

export function inferColumnTypes(rows, columns) {
  // Ensure rows is an array
  if (!Array.isArray(rows)) {
    console.warn('inferColumnTypes: rows is not an array:', typeof rows, rows)
    rows = []
  }
  
  const types = {}
  columns.forEach(column => {
    let numeric = 0
    let dateLike = 0
    let total = 0
    for (const row of rows) {
      const value = row[column]
      if (value === '' || value == null) continue
      total += 1
      const stringValue = String(value).trim()
      if (NUMBER_RE.test(stringValue)) numeric += 1
      const parsed = Date.parse(stringValue)
      if (!Number.isNaN(parsed)) dateLike += 1
    }
    if (total === 0) {
      types[column] = 'string'
    } else if (numeric / total > 0.7) {
      types[column] = 'number'
    } else if (dateLike / total > 0.7) {
      types[column] = 'date'
    } else {
      types[column] = 'string'
    }
  })
  return types
}

export function computeMissingByColumn(rows, columns) {
  // Ensure rows is an array
  if (!Array.isArray(rows)) {
    console.warn('computeMissingByColumn: rows is not an array:', typeof rows, rows)
    rows = []
  }
  
  const missing = {}
  columns.forEach(col => { missing[col] = 0 })
  for (const row of rows) {
    columns.forEach(col => {
      const value = row[col]
      if (value == null || value === '') missing[col] += 1
    })
  }
  return missing
}

export function computeNumericStats(rows, numericColumns) {
  // Ensure rows is an array
  if (!Array.isArray(rows)) {
    console.warn('computeNumericStats: rows is not an array:', typeof rows, rows)
    return {}
  }
  
  const stats = {}
  if (!rows || !rows.length || !numericColumns || !numericColumns.length) return stats;
  
  numericColumns.forEach(column => {
    try {
      const values = rows
        .map(row => toNumber(row[column]))
        .filter(value => value !== null && value !== undefined && !Number.isNaN(value) && Number.isFinite(value))
      
      if (!values.length) {
        stats[column] = { mean: 0, median: 0, std: 0, min: 0, max: 0 }
        return
      }
      
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length
      const sorted = [...values].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
      const std = Math.sqrt(variance)
      
      stats[column] = {
        mean,
        median,
        std,
        min: Math.min(...values),
        max: Math.max(...values)
      }
    } catch (err) {
      console.warn(`Failed to compute stats for column ${column}:`, err)
      stats[column] = { mean: 0, median: 0, std: 0, min: 0, max: 0 }
    }
  })
  return stats
}

function pearsonCorrelation(xValues, yValues) {
  const n = Math.min(xValues.length, yValues.length)
  if (n === 0) return 0
  const meanX = xValues.reduce((sum, v) => sum + v, 0) / n
  const meanY = yValues.reduce((sum, v) => sum + v, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i += 1) {
    const dx = xValues[i] - meanX
    const dy = yValues[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const denom = Math.sqrt(denX * denY)
  return denom === 0 ? 0 : num / denom
}

export function computeCorrelationMatrix(rows, numericColumns) {
  // Ensure rows is an array
  if (!Array.isArray(rows)) {
    console.warn('computeCorrelationMatrix: rows is not an array:', typeof rows, rows)
    return []
  }
  
  if (!rows || !rows.length || !numericColumns || !numericColumns.length) return [];
  
  const matrix = numericColumns.map(() => numericColumns.map(() => 0))
  for (let i = 0; i < numericColumns.length; i += 1) {
    for (let j = 0; j < numericColumns.length; j += 1) {
      try {
        const valuesX = rows.map(row => toNumber(row[numericColumns[i]])).filter(v => Number.isFinite(v))
        const valuesY = rows.map(row => toNumber(row[numericColumns[j]])).filter(v => Number.isFinite(v))
        matrix[i][j] = pearsonCorrelation(valuesX, valuesY)
      } catch (err) {
        matrix[i][j] = 0
      }
    }
  }
  return matrix
}

export function buildDatasetProfile(dataset) {
  const rows = dataset?.rows || []
  
  // Ensure rows is an array
  if (!Array.isArray(rows)) {
    console.warn('buildDatasetProfile: rows is not an array:', typeof rows, rows)
    // Try to extract rows from preview if available
    if (dataset?.preview && Array.isArray(dataset.preview)) {
      rows = dataset.preview
    } else {
      rows = []
    }
  }
  
  const columns = dataset?.columns || (rows[0] ? Object.keys(rows[0]) : [])
  const types = inferColumnTypes(rows, columns)
  const numericColumns = columns.filter(col => types[col] === 'number')
  const categoricalColumns = columns.filter(col => types[col] !== 'number')
  const missingByColumn = computeMissingByColumn(rows, columns)
  const missingTotal = Object.values(missingByColumn).reduce((sum, value) => sum + value, 0)
  
  let numericStats = {}
  let correlation = []
  
  try {
    numericStats = computeNumericStats(rows, numericColumns)
    correlation = computeCorrelationMatrix(rows, numericColumns)
  } catch (err) {
    console.warn('Dataset profile computation failed:', err)
  }

  return {
    columns,
    types,
    numericColumns,
    categoricalColumns,
    rowCount: rows.length,
    columnCount: columns.length,
    missingByColumn,
    missingTotal,
    numericStats,
    correlation
  }
}

export function getUniqueValues(rows, column) {
  const set = new Set()
  rows.forEach(row => {
    const value = row[column]
    if (value == null || value === '') return
    set.add(String(value))
  })
  return Array.from(set)
}

export function applyFilters(rows, filters) {
  if (!filters || !filters.column || !filters.values || filters.values.length === 0) {
    return rows
  }
  return rows.filter(row => filters.values.includes(String(row[filters.column])))
}

export function aggregateByKey(rows, key, valueKey, agg = 'sum', limit = 8) {
  const bucket = new Map()
  rows.forEach(row => {
    const label = row[key] ?? 'Unknown'
    const value = toNumber(row[valueKey])
    if (!Number.isFinite(value)) return
    bucket.set(label, (bucket.get(label) || 0) + value)
  })
  const data = Array.from(bucket.entries()).map(([label, value]) => ({ label: String(label), value }))
  data.sort((a, b) => b.value - a.value)
  return data.slice(0, limit)
}

export function buildTimeSeries(rows, key, valueKey, limit = 12) {
  const bucket = new Map()
  rows.forEach(row => {
    const raw = row[key]
    if (!raw) return
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const value = toNumber(row[valueKey])
    if (!Number.isFinite(value)) return
    bucket.set(label, (bucket.get(label) || 0) + value)
  })
  const data = Array.from(bucket.entries()).map(([label, value]) => ({ label, value }))
  data.sort((a, b) => a.label.localeCompare(b.label))
  return data.slice(-limit)
}

export function computeHistogram(values, bins = 8) {
  const clean = values.filter(v => Number.isFinite(v))
  if (!clean.length) return []
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const step = (max - min) / bins || 1
  const buckets = Array.from({ length: bins }, (_, idx) => ({
    label: `${(min + idx * step).toFixed(1)}-${(min + (idx + 1) * step).toFixed(1)}`,
    value: 0
  }))
  clean.forEach(value => {
    const index = Math.min(bins - 1, Math.floor((value - min) / step))
    buckets[index].value += 1
  })
  return buckets
}

export function toNumber(value) {
  if (value == null || value === '') return NaN
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  return Number(cleaned)
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toFixed(1)
}
