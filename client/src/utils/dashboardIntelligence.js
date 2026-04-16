const GEO_ROLE_HINTS = {
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon'],
  country: ['country', 'nation'],
  state: ['state', 'province', 'region'],
  city: ['city', 'town'],
}

const MAX_PROFILE_ROWS = 4000
const MAX_FILTER_VALUES = 8

function normalizeToken(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function inferGeoRole(column) {
  const token = normalizeToken(column)
  return Object.entries(GEO_ROLE_HINTS).find(([, hints]) => (
    hints.some((hint) => token.includes(hint))
  ))?.[0] || null
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value))
}

function toNumber(value) {
  if (value == null || value === '') return NaN
  if (typeof value === 'number') return value
  return Number(String(value).replace(/[^0-9.-]/g, ''))
}

function parseDateValue(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && value !== '')))
}

function sampleRows(rows = [], limit = MAX_PROFILE_ROWS) {
  if (rows.length <= limit) return rows
  const step = Math.max(1, Math.floor(rows.length / limit))
  const sampled = []
  for (let index = 0; index < rows.length && sampled.length < limit; index += step) {
    sampled.push(rows[index])
  }
  return sampled
}

function inferColumnKind(column, values) {
  const nonEmpty = values.filter((value) => value !== null && value !== undefined && value !== '')
  if (!nonEmpty.length) return 'categorical'

  const numericRatio = nonEmpty.filter((value) => isFiniteNumber(value)).length / nonEmpty.length
  const dateRatio = nonEmpty.filter((value) => parseDateValue(value)).length / nonEmpty.length
  const geoRole = inferGeoRole(column)

  if (geoRole === 'latitude' || geoRole === 'longitude') return 'numeric'
  if (numericRatio >= 0.82) return 'numeric'
  if (dateRatio >= 0.8) return 'datetime'
  return 'categorical'
}

function summarizeNumeric(values = []) {
  const numbers = values.map((value) => toNumber(value)).filter((value) => Number.isFinite(value))
  if (!numbers.length) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      std: 0,
    }
  }

  const sorted = [...numbers].sort((left, right) => left - right)
  const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
  const variance = numbers.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / numbers.length
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median,
    std: Math.sqrt(variance),
  }
}

function quantile(values = [], q = 0.5) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  }
  return sorted[base]
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return Math.round(value * 10) / 10 === value ? `${value}` : value.toFixed(1)
}

function formatPercent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`
}

function buildProfile(dataset, profiledRows = null) {
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : []
  const columns = Array.isArray(dataset?.columns) && dataset.columns.length
    ? dataset.columns
    : Object.keys(rows[0] || {})
  const sampledRows = Array.isArray(profiledRows) ? profiledRows : sampleRows(rows)

  const columnMeta = columns.map((column) => {
    const values = sampledRows.map((row) => row?.[column])
    const kind = inferColumnKind(column, values)
    return {
      column,
      kind,
      uniqueCount: uniqueValues(values).length,
      sample: uniqueValues(values).slice(0, 6),
      geoRole: inferGeoRole(column),
      stats: kind === 'numeric' ? summarizeNumeric(values) : null,
      missing: rows.reduce((count, row) => (
        row?.[column] === null || row?.[column] === undefined || row?.[column] === '' ? count + 1 : count
      ), 0),
    }
  })

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: {
      all: columns,
      numeric: columnMeta.filter((column) => column.kind === 'numeric').map((column) => column.column),
      categorical: columnMeta.filter((column) => column.kind === 'categorical').map((column) => column.column),
      datetime: columnMeta.filter((column) => column.kind === 'datetime').map((column) => column.column),
    },
    columnMeta,
  }
}

function strengthLabel(value) {
  const absolute = Math.abs(value)
  if (absolute >= 0.8) return 'very strong'
  if (absolute >= 0.6) return 'strong'
  if (absolute >= 0.4) return 'moderate'
  if (absolute >= 0.2) return 'light'
  return 'weak'
}

function pearsonCorrelation(points) {
  if (points.length < 3) return 0
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length
  let numerator = 0
  let denominatorX = 0
  let denominatorY = 0

  points.forEach((point) => {
    const dx = point.x - meanX
    const dy = point.y - meanY
    numerator += dx * dy
    denominatorX += dx * dx
    denominatorY += dy * dy
  })

  const denominator = Math.sqrt(denominatorX * denominatorY)
  return denominator ? numerator / denominator : 0
}

function buildCorrelationInsights(rows, numericColumns = []) {
  const pairs = []

  for (let leftIndex = 0; leftIndex < numericColumns.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < numericColumns.length; rightIndex += 1) {
      const left = numericColumns[leftIndex]
      const right = numericColumns[rightIndex]
      const points = rows
        .map((row) => ({
          x: toNumber(row?.[left]),
          y: toNumber(row?.[right]),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))

      const value = pearsonCorrelation(points)
      if (!Number.isFinite(value) || Math.abs(value) < 0.18) continue

      pairs.push({
        left,
        right,
        value,
        absoluteValue: Math.abs(value),
        direction: value >= 0 ? 'positive' : 'negative',
        label: strengthLabel(value),
      })
    }
  }

  return pairs.sort((left, right) => right.absoluteValue - left.absoluteValue).slice(0, 6)
}

function buildAnomalyInsights(rows, numericColumns = []) {
  return numericColumns
    .map((column) => {
      const values = rows
        .map((row) => toNumber(row?.[column]))
        .filter((value) => Number.isFinite(value))

      if (values.length < 8) {
        return null
      }

      const q1 = quantile(values, 0.25)
      const q3 = quantile(values, 0.75)
      const iqr = q3 - q1
      const lower = q1 - (1.5 * iqr)
      const upper = q3 + (1.5 * iqr)
      const count = values.filter((value) => value < lower || value > upper).length

      return {
        column,
        count,
        ratio: count / values.length,
        lower,
        upper,
      }
    })
    .filter(Boolean)
    .filter((item) => item.count > 0)
    .sort((left, right) => right.ratio - left.ratio)
    .slice(0, 4)
}

function aggregateTimeline(rows, dateColumn, valueColumn) {
  const bucket = new Map()

  rows.forEach((row) => {
    const date = parseDateValue(row?.[dateColumn])
    if (!date) return
    const numericValue = toNumber(row?.[valueColumn])
    if (!Number.isFinite(numericValue)) return
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    bucket.set(label, (bucket.get(label) || 0) + numericValue)
  })

  return Array.from(bucket.entries())
    .map(([label, value], index) => ({ label, value, index }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function linearForecast(points = []) {
  if (points.length < 3) return null
  const meanX = points.reduce((sum, point) => sum + point.index, 0) / points.length
  const meanY = points.reduce((sum, point) => sum + point.value, 0) / points.length

  let numerator = 0
  let denominator = 0
  points.forEach((point) => {
    numerator += (point.index - meanX) * (point.value - meanY)
    denominator += (point.index - meanX) ** 2
  })

  const slope = denominator ? numerator / denominator : 0
  const intercept = meanY - (slope * meanX)
  const nextIndex = points.length
  const nextValue = intercept + (slope * nextIndex)

  return {
    slope,
    nextValue,
  }
}

function nextTimelineLabel(label) {
  const [yearValue, monthValue] = String(label || '').split('-').map((value) => Number(value))
  if (!yearValue || !monthValue) return 'Next period'
  const nextMonth = monthValue === 12 ? 1 : monthValue + 1
  const nextYear = monthValue === 12 ? yearValue + 1 : yearValue
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

function buildForecastInsight(rows, datetimeColumns = [], numericColumns = []) {
  const dateColumn = datetimeColumns[0]
  const valueColumn = numericColumns[0]
  if (!dateColumn || !valueColumn) return null

  const timeline = aggregateTimeline(rows, dateColumn, valueColumn)
  if (timeline.length < 3) return null

  const forecast = linearForecast(timeline)
  if (!forecast || !Number.isFinite(forecast.nextValue)) return null

  const latest = timeline[timeline.length - 1]
  return {
    dateColumn,
    valueColumn,
    latestLabel: latest.label,
    latestValue: latest.value,
    nextLabel: nextTimelineLabel(latest.label),
    nextValue: forecast.nextValue,
    direction: forecast.nextValue >= latest.value ? 'up' : 'down',
  }
}

function buildTrendInsight(rows, datetimeColumns = [], numericColumns = []) {
  const dateColumn = datetimeColumns[0]
  const valueColumn = numericColumns[0]
  if (!dateColumn || !valueColumn) return null

  const timeline = aggregateTimeline(rows, dateColumn, valueColumn)
  if (timeline.length < 2) return null

  const first = timeline[0]
  const last = timeline[timeline.length - 1]
  const change = last.value - first.value
  const ratio = first.value ? change / first.value : 0

  return {
    dateColumn,
    valueColumn,
    from: first.label,
    to: last.label,
    change,
    ratio,
    direction: change >= 0 ? 'up' : 'down',
  }
}

function buildCompletenessScore(profile) {
  const totalCells = Math.max(1, profile.rowCount * profile.columnCount)
  const missingTotal = profile.columnMeta.reduce((sum, column) => sum + column.missing, 0)
  return Math.max(0, 1 - (missingTotal / totalCells))
}

function buildKpiCards(profile, rows) {
  const completeness = buildCompletenessScore(profile)
  const numericLeader = profile.columnMeta.find((column) => column.kind === 'numeric' && column.stats)
  const categoryLeader = profile.columnMeta
    .filter((column) => column.kind === 'categorical')
    .sort((left, right) => left.uniqueCount - right.uniqueCount)[0]

  const cards = [
    {
      id: 'rows',
      label: 'Rows In Scope',
      value: profile.rowCount.toLocaleString(),
      detail: `${profile.columnCount} modeled columns`,
      tone: 'neutral',
    },
    {
      id: 'quality',
      label: 'Data Quality',
      value: formatPercent(completeness),
      detail: completeness >= 0.95 ? 'Very complete dataset' : 'Review missing values in weak columns',
      tone: completeness >= 0.95 ? 'positive' : 'warning',
    },
  ]

  if (numericLeader?.stats) {
    cards.push({
      id: `metric-${numericLeader.column}`,
      label: `${numericLeader.column} Avg`,
      value: formatCompactNumber(numericLeader.stats.mean),
      detail: `Range ${formatCompactNumber(numericLeader.stats.min)} to ${formatCompactNumber(numericLeader.stats.max)}`,
      tone: 'accent',
    })
  }

  if (categoryLeader) {
    cards.push({
      id: `dimension-${categoryLeader.column}`,
      label: `${categoryLeader.column} Segments`,
      value: categoryLeader.uniqueCount.toLocaleString(),
      detail: categoryLeader.uniqueCount <= 12 ? 'Dashboard-friendly grouping field' : 'High-cardinality dimension',
      tone: categoryLeader.uniqueCount <= 12 ? 'positive' : 'neutral',
    })
  }

  return cards.slice(0, 4)
}

function buildSuggestedFilters(rows, profile) {
  return profile.columnMeta
    .filter((column) => column.kind !== 'numeric')
    .filter((column) => column.uniqueCount > 1 && column.uniqueCount <= 18)
    .slice(0, 6)
    .map((column) => ({
      column: column.column,
      values: uniqueValues(rows.map((row) => row?.[column.column])).slice(0, MAX_FILTER_VALUES),
      uniqueCount: column.uniqueCount,
      kind: column.kind,
    }))
}

function buildNarrative(profile, correlations, anomalies, trendInsight) {
  const parts = []
  if (trendInsight) {
    parts.push(
      `${trendInsight.valueColumn} moved ${trendInsight.direction === 'up' ? 'upward' : 'downward'} by ${formatPercent(Math.abs(trendInsight.ratio))} from ${trendInsight.from} to ${trendInsight.to}.`
    )
  }
  if (correlations[0]) {
    parts.push(
      `${correlations[0].left} and ${correlations[0].right} show a ${correlations[0].label} ${correlations[0].direction} relationship.`
    )
  }
  if (anomalies[0]) {
    parts.push(
      `${anomalies[0].column} contains ${anomalies[0].count} likely outlier values that deserve review.`
    )
  }
  if (!parts.length) {
    parts.push(`This dataset includes ${profile.rowCount.toLocaleString()} rows and ${profile.columnCount} columns with live chart recommendations ready to use.`)
  }
  return parts.join(' ')
}

function buildInsightCards(profile, correlations, anomalies, trendInsight, forecastInsight) {
  const cards = []

  if (trendInsight) {
    cards.push({
      id: 'trend',
      type: 'trend',
      title: `${trendInsight.valueColumn} is trending ${trendInsight.direction === 'up' ? 'up' : 'down'}`,
      body: `${trendInsight.valueColumn} changed by ${formatPercent(Math.abs(trendInsight.ratio))} between ${trendInsight.from} and ${trendInsight.to}.`,
      tone: trendInsight.direction === 'up' ? 'positive' : 'warning',
    })
  }

  if (correlations[0]) {
    cards.push({
      id: 'correlation',
      type: 'correlation',
      title: `${correlations[0].left} vs ${correlations[0].right}`,
      body: `${correlations[0].label} ${correlations[0].direction} correlation detected (${correlations[0].value.toFixed(2)}). A scatter or combo view should explain this relationship clearly.`,
      tone: 'accent',
    })
  }

  if (anomalies[0]) {
    cards.push({
      id: 'anomaly',
      type: 'anomaly',
      title: `Outliers found in ${anomalies[0].column}`,
      body: `${anomalies[0].count} values fall outside the expected range. A box plot or histogram can help validate those spikes quickly.`,
      tone: 'warning',
    })
  }

  if (forecastInsight) {
    cards.push({
      id: 'forecast',
      type: 'forecast',
      title: `${forecastInsight.valueColumn} forecast for ${forecastInsight.nextLabel}`,
      body: `Simple trend extrapolation suggests ${formatCompactNumber(forecastInsight.nextValue)} next period, ${forecastInsight.direction === 'up' ? 'above' : 'below'} the latest ${formatCompactNumber(forecastInsight.latestValue)}.`,
      tone: forecastInsight.direction === 'up' ? 'positive' : 'neutral',
    })
  }

  if (!cards.length) {
    cards.push({
      id: 'overview',
      type: 'overview',
      title: 'Dataset ready for auto-dashboarding',
      body: `${profile.rowCount.toLocaleString()} rows and ${profile.columnCount} columns were profiled. Drag visuals in or let the builder assemble the first dashboard automatically.`,
      tone: 'neutral',
    })
  }

  return cards.slice(0, 4)
}

export function buildDashboardIntelligence(dataset, providedProfile = null) {
  const allRows = Array.isArray(dataset?.rows) ? dataset.rows : []
  const rows = sampleRows(allRows)
  const derivedProfile = buildProfile({
    rows: allRows,
    columns: dataset?.columns,
  }, rows)
  const profile = {
    ...derivedProfile,
    rowCount: Number(providedProfile?.totalRowCount || providedProfile?.rowCount || derivedProfile.rowCount),
    columnCount: Number(providedProfile?.totalColumnCount || providedProfile?.columnCount || derivedProfile.columnCount),
  }

  const correlations = buildCorrelationInsights(rows, profile.columns.numeric)
  const anomalies = buildAnomalyInsights(rows, profile.columns.numeric)
  const trendInsight = buildTrendInsight(rows, profile.columns.datetime, profile.columns.numeric)
  const forecastInsight = buildForecastInsight(rows, profile.columns.datetime, profile.columns.numeric)
  const kpis = buildKpiCards(profile, rows)
  const filters = buildSuggestedFilters(rows, profile)
  const insights = buildInsightCards(profile, correlations, anomalies, trendInsight, forecastInsight)

  return {
    profile,
    rowsProfiled: rows.length,
    kpis,
    insights,
    correlations,
    anomalies,
    trendInsight,
    forecastInsight,
    filters,
    narrative: buildNarrative(profile, correlations, anomalies, trendInsight),
    providedProfileUsed: Boolean(providedProfile),
  }
}
