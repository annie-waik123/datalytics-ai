import { useEffect, useMemo, useRef, useState } from 'react'
import { IoLogoSnapchat } from 'react-icons/io5'
import { clearChatHistory, fetchChatHistory, sendChatMessage } from '../api/chat.js'

const IDENTIFIER_HINTS = ['id', 'uuid', 'guid', 'index', 'serial', 'code', 'employeeid', 'empid']
const DETAIL_QUERY_RE = /\b(detail|details|info|information|record|row|profile|employee)\b/i

function formatTime(value) {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function buildMessage(role, content, extras = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date(),
    chart: extras.chart || null,
    insights: extras.insights || null,
    details: extras.details || null,
  }
}

function formatMetric(value) {
  if (!Number.isFinite(value)) return String(value ?? '')
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '')
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function humanizeColumnName(column) {
  return String(column ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function columnAliases(column) {
  const original = String(column ?? '').trim().toLowerCase()
  const humanized = humanizeColumnName(column)
  const normalized = normalizeText(column)
  return Array.from(new Set([original, humanized, normalized].filter(Boolean)))
}

function isIdentifierColumn(column) {
  const normalized = normalizeText(column)
  return IDENTIFIER_HINTS.some((hint) => normalized.includes(hint))
}

function matchColumns(question, columns = []) {
  const lower = String(question || '').toLowerCase()
  const tokens = new Set(lower.match(/[a-z0-9]+/g) || [])
  const scored = columns.map((column) => {
    const aliases = columnAliases(column)
    let score = 0

    aliases.forEach((alias) => {
      if (!alias) return
      if (alias.includes(' ')) {
        if (new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`).test(lower)) {
          score += 24
        }
        return
      }
      if (alias === normalizeText(alias) && alias.length >= 5 && normalizeText(lower).includes(alias)) {
        score += 12
      } else if (new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`).test(lower)) {
        score += 20
      }
    })

    const humanizedTokens = humanizeColumnName(column).split(' ').filter(Boolean)
    const overlap = humanizedTokens.filter((token) => tokens.has(token)).length
    if (overlap === humanizedTokens.length && overlap > 1) {
      score += 18
    } else {
      score += overlap * 6
    }

    return { column, score }
  })

  return scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.column)
}

function parseFilters(question, columns = [], types = {}) {
  const filters = []
  const text = String(question || '')

  for (const column of [...columns].sort((a, b) => b.length - a.length)) {
    for (const alias of columnAliases(column)) {
      const escaped = escapeRegex(alias)
      const boundary = alias === normalizeText(alias) ? escaped : `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`
      const patterns = [
        { regex: new RegExp(`${boundary}\\s*(>=|<=|!=|=|>|<)\\s*([^,;?]+)`, 'i') },
        { regex: new RegExp(`${boundary}\\s+is\\s+([^,;?]+)`, 'i'), operator: '=' },
        { regex: new RegExp(`${boundary}\\s+equals\\s+([^,;?]+)`, 'i'), operator: '=' },
        { regex: new RegExp(`${boundary}\\s+greater than\\s+([^,;?]+)`, 'i'), operator: '>' },
        { regex: new RegExp(`${boundary}\\s+less than\\s+([^,;?]+)`, 'i'), operator: '<' },
      ]

      for (const pattern of patterns) {
        const match = text.match(pattern.regex)
        if (!match) continue
        const operator = pattern.operator || match[match.length - 2]
        const rawValue = String(pattern.operator ? match[match.length - 1] : match[match.length - 1] || '').trim().replace(/^["']|["']$/g, '')
        if (!rawValue) continue
        filters.push({ column, operator, value: rawValue, type: types[column] || 'string' })
        break
      }
      if (filters.some((item) => item.column === column)) break
    }
  }

  return filters
}

function applyParsedFilters(rows = [], filters = []) {
  if (!filters.length) return rows
  return rows.filter((row) => filters.every((filter) => {
    const raw = row?.[filter.column]
    if (filter.type === 'number') {
      const left = Number(raw)
      const right = Number(filter.value)
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false
      if (filter.operator === '>') return left > right
      if (filter.operator === '>=') return left >= right
      if (filter.operator === '<') return left < right
      if (filter.operator === '<=') return left <= right
      if (filter.operator === '!=') return left !== right
      return left === right
    }

    const left = String(raw ?? '').trim().toLowerCase()
    const right = String(filter.value ?? '').trim().toLowerCase()
    if (filter.operator === '!=') return left !== right
    return left === right
  }))
}

function buildLocalInsights(dataset, datasetProfile, intent, matchedColumns = [], filters = []) {
  const numericColumns = datasetProfile?.numericColumns || []
  const summaryNumeric = numericColumns.slice(0, 2).reduce((acc, column) => {
    acc[column] = datasetProfile?.numericStats?.[column]?.mean ?? null
    return acc
  }, {})

  const keyInsights = []
  const firstNumeric = numericColumns[0]
  if (firstNumeric && datasetProfile?.numericStats?.[firstNumeric]) {
    const stats = datasetProfile.numericStats[firstNumeric]
    keyInsights.push(
      `${firstNumeric} ranges from ${formatMetric(stats.min)} to ${formatMetric(stats.max)} with an average of ${formatMetric(stats.mean)}.`
    )
  }
  if (filters.length) {
    keyInsights.push(`Applied filter: ${filters.map((item) => `${item.column} ${item.operator} ${item.value}`).join(' and ')}.`)
  }
  if (matchedColumns.length) {
    keyInsights.push(`Matched columns: ${matchedColumns.join(', ')}.`)
  }

  return {
    summary: {
      dataset_name: dataset?.name || 'Dataset',
      total_rows: datasetProfile?.totalRowCount || datasetProfile?.rowCount || dataset?.rows?.length || 0,
      total_columns: datasetProfile?.totalColumnCount || datasetProfile?.columnCount || dataset?.columns?.length || 0,
      averages: summaryNumeric,
      min: {},
      max: {},
    },
    query: {
      intent,
      metric: null,
      matched_columns: matchedColumns,
      filters: filters.map((item) => `${item.column} ${item.operator} ${item.value}`),
    },
    key_insights: keyInsights,
  }
}

function matchLookupRow(rows, column, rawValue, type) {
  const expected = String(rawValue ?? '').trim()
  if (!expected) return null

  const matches = rows.filter((row) => {
    const current = row?.[column]
    if (type === 'number') {
      const left = Number(current)
      const right = Number(expected)
      return Number.isFinite(left) && Number.isFinite(right) && left === right
    }
    return String(current ?? '').trim().toLowerCase() === expected.toLowerCase()
  })

  return matches.length === 1 ? matches[0] : null
}

function buildRowDetailsEntries(row, columns, keyColumn) {
  const orderedColumns = [keyColumn, ...columns.filter((column) => column !== keyColumn)]
  return orderedColumns
    .map((column) => ({ column, value: row?.[column] }))
    .filter((item) => item.value !== undefined && item.value !== null && item.value !== '')
}

function buildRowDetailsAnswer(row, columns, keyColumn, keyValue) {
  const parts = buildRowDetailsEntries(row, columns, keyColumn)
    .map((item) => `${item.column}: ${item.value}`)
  return `${keyColumn} ${keyValue} details: ${parts.join(', ')}.`
}

function buildInsightBadges(insights) {
  if (!insights?.summary) return []

  const badges = []
  const totalRows = Number(insights.summary.total_rows)
  const totalColumns = Number(insights.summary.total_columns)
  const averages = insights.summary.averages || {}
  const firstAverage = Object.entries(averages).find(([, value]) => value !== null && value !== undefined && value !== '')

  if (Number.isFinite(totalRows)) {
    badges.push(`${totalRows.toLocaleString()} rows`)
  }

  if (Number.isFinite(totalColumns)) {
    badges.push(`${totalColumns.toLocaleString()} columns`)
  }

  if (firstAverage) {
    badges.push(`Avg ${firstAverage[0]} ${formatMetric(Number(firstAverage[1]))}`)
  }

  return badges.slice(0, 3)
}

function BotLogo({ size = 'message', className = '' }) {
  const classes = ['chatbot-bot-logo', `chatbot-bot-logo--${size}`, className].filter(Boolean).join(' ')

  return (
    <span className={classes} aria-hidden="true">
      <span className="chatbot-bot-logo-shell">
        <IoLogoSnapchat className="chatbot-bot-logo-ghost" />
      </span>
      <span className="chatbot-bot-logo-badge">
        <span className="chatbot-bot-logo-badge-text">AI</span>
        <span className="chatbot-bot-logo-dot" />
      </span>
    </span>
  )
}

function resolveRowDetailLookup(question, rows, columns, types, matchedColumns = []) {
  const lower = String(question || '').toLowerCase()
  const detailIntent = DETAIL_QUERY_RE.test(lower) || /\b(employee\s*id|emp\s*id|record\s*id|identifier|id)\b/i.test(lower)
  if (!detailIntent) return null

  const numericTokens = Array.from(new Set((lower.match(/\b\d+\b/g) || []).map((value) => value.trim())))
  const quotedTokens = Array.from(lower.matchAll(/["']([^"']+)["']/g)).map((item) => item[1].trim()).filter(Boolean)
  const lookupTokens = Array.from(new Set([...numericTokens, ...quotedTokens]))
  const identifierColumns = columns.filter((column) => isIdentifierColumn(column))
  const preferredColumns = matchedColumns.filter((column) => isIdentifierColumn(column))
  const candidateColumns = preferredColumns.length ? preferredColumns : identifierColumns

  for (const token of lookupTokens) {
    for (const column of candidateColumns) {
      const row = matchLookupRow(rows, column, token, types[column])
      if (!row) continue
      return {
        answer: buildRowDetailsAnswer(row, columns, column, token),
        details: buildRowDetailsEntries(row, columns, column),
        insights: {
          summary: {
            dataset_name: 'Dataset',
            total_rows: rows.length,
            total_columns: columns.length,
            averages: {},
            min: {},
            max: {},
          },
          query: {
            intent: 'lookup',
            metric: null,
            matched_columns: [column],
            filters: [`${column} = ${token}`],
          },
          key_insights: [`Exact row matched on ${column} = ${token}.`],
        },
        chart: {},
      }
    }
  }

  if (candidateColumns.length && lookupTokens.length) {
    return {
      answer: `I could not find any row where ${candidateColumns[0]} = ${lookupTokens[0]}.`,
      insights: {
        summary: {
          dataset_name: 'Dataset',
          total_rows: rows.length,
          total_columns: columns.length,
          averages: {},
          min: {},
          max: {},
        },
        query: {
          intent: 'lookup',
          metric: null,
          matched_columns: candidateColumns.slice(0, 1),
          filters: [`${candidateColumns[0]} = ${lookupTokens[0]}`],
        },
        key_insights: [`No exact row matched ${candidateColumns[0]} = ${lookupTokens[0]}.`],
      },
      chart: {},
    }
  }

  return null
}

function resolveLocalDatasetQuery(question, dataset, datasetProfile) {
  if (!dataset || !datasetProfile || !Array.isArray(dataset.rows) || !dataset.rows.length) {
    return null
  }

  const rows = dataset.rows
  const columns = dataset.columns || Object.keys(rows[0] || {})
  const types = datasetProfile.types || {}
  const numericColumns = datasetProfile.numericColumns || []
  const dateColumns = columns.filter((column) => types[column] === 'date')
  const categoricalColumns = columns.filter((column) => types[column] !== 'number' && types[column] !== 'date')
  const lower = String(question || '').toLowerCase()
  const matchedColumns = matchColumns(lower, columns)
  const filters = parseFilters(lower, columns, types)
  const filteredRows = applyParsedFilters(rows, filters)
  const totalRows = filters.length ? filteredRows.length : (datasetProfile.totalRowCount || datasetProfile.rowCount || rows.length)

  const detailLookup = resolveRowDetailLookup(question, rows, columns, types, matchedColumns)
  if (detailLookup) {
    detailLookup.insights.summary.dataset_name = dataset?.name || 'Dataset'
    return detailLookup
  }

  if (filters.length && !filteredRows.length) {
    return {
      answer: 'No rows match that filter.',
      insights: buildLocalInsights(dataset, datasetProfile, 'filter', matchedColumns, filters),
      chart: {},
    }
  }

  const targetNumeric = matchedColumns.find((column) => numericColumns.includes(column)) || numericColumns[0]
  const targetDate = matchedColumns.find((column) => dateColumns.includes(column)) || dateColumns[0]
  const targetCategory = matchedColumns.find((column) => categoricalColumns.includes(column)) || categoricalColumns[0]

  if (filters.length && !/(average|mean|max|highest|min|lowest|trend|top|best|compare)/.test(lower)) {
    return {
      answer: `${filteredRows.length.toLocaleString()} rows match ${filters.map((item) => `${item.column} ${item.operator} ${item.value}`).join(' and ')}.`,
      insights: buildLocalInsights(dataset, datasetProfile, 'filter', matchedColumns, filters),
      chart: {
        type: 'pie',
        x: 'segment',
        y: 'rows',
        data: [
          { segment: 'Matched', rows: filteredRows.length },
          { segment: 'Remaining', rows: Math.max((datasetProfile.totalRowCount || rows.length) - filteredRows.length, 0) },
        ],
      },
    }
  }

  if (/(how many|count|number of|rows)/.test(lower) && !targetNumeric) {
    return {
      answer: `The dataset contains ${totalRows.toLocaleString()} rows${filters.length ? ' for the current filter' : ''}.`,
      insights: buildLocalInsights(dataset, datasetProfile, 'count', matchedColumns, filters),
      chart: {
        type: 'bar',
        x: 'metric',
        y: 'rows',
        data: [{ metric: 'rows', rows: totalRows }],
      },
    }
  }

  if (targetNumeric) {
    const numericValues = filteredRows
      .map((row) => Number(row?.[targetNumeric]))
      .filter((value) => Number.isFinite(value))

    if (numericValues.length) {
      const avg = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
      const max = Math.max(...numericValues)
      const min = Math.min(...numericValues)

      if (/(average|mean|avg)/.test(lower)) {
        return {
          answer: `The average ${targetNumeric} is ${formatMetric(avg)}.`,
          insights: buildLocalInsights(dataset, datasetProfile, 'aggregation', [targetNumeric], filters),
          chart: {
            type: 'bar',
            x: 'metric',
            y: targetNumeric,
            data: [{ metric: 'average', [targetNumeric]: avg }],
          },
        }
      }

      if (/(highest|max|maximum|largest)/.test(lower)) {
        return {
          answer: `The highest ${targetNumeric} value is ${formatMetric(max)}.`,
          insights: buildLocalInsights(dataset, datasetProfile, 'aggregation', [targetNumeric], filters),
          chart: {
            type: 'bar',
            x: 'metric',
            y: targetNumeric,
            data: [{ metric: 'max', [targetNumeric]: max }],
          },
        }
      }

      if (/(lowest|min|minimum|smallest)/.test(lower)) {
        return {
          answer: `The lowest ${targetNumeric} value is ${formatMetric(min)}.`,
          insights: buildLocalInsights(dataset, datasetProfile, 'aggregation', [targetNumeric], filters),
          chart: {
            type: 'bar',
            x: 'metric',
            y: targetNumeric,
            data: [{ metric: 'min', [targetNumeric]: min }],
          },
        }
      }
    }
  }

  if (/(trend|over time|monthly|daily|weekly)/.test(lower) && targetDate && targetNumeric) {
    const buckets = new Map()
    filteredRows.forEach((row) => {
      const rawDate = row?.[targetDate]
      const rawValue = Number(row?.[targetNumeric])
      const date = new Date(rawDate)
      if (!Number.isFinite(rawValue) || Number.isNaN(date.getTime())) return
      const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      buckets.set(label, (buckets.get(label) || 0) + rawValue)
    })
    const data = Array.from(buckets.entries())
      .map(([label, value]) => ({ [targetDate]: label, [targetNumeric]: value }))
      .sort((a, b) => String(a[targetDate]).localeCompare(String(b[targetDate])))
      .slice(-12)

    if (data.length >= 2) {
      const start = data[0][targetNumeric]
      const end = data[data.length - 1][targetNumeric]
      const direction = end >= start ? 'upward' : 'downward'
      return {
        answer: `${targetNumeric} shows an overall ${direction} trend from ${data[0][targetDate]} to ${data[data.length - 1][targetDate]}.`,
        insights: buildLocalInsights(dataset, datasetProfile, 'trend', [targetDate, targetNumeric], filters),
        chart: {
          type: 'line',
          x: targetDate,
          y: targetNumeric,
          data,
        },
      }
    }
  }

  if (/(top|best|performs best|category)/.test(lower) && targetCategory) {
    const counts = new Map()
    filteredRows.forEach((row) => {
      const label = String(row?.[targetCategory] ?? 'Unknown')
      counts.set(label, (counts.get(label) || 0) + 1)
    })
    const data = Array.from(counts.entries())
      .map(([label, count]) => ({ [targetCategory]: label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    if (data.length) {
      return {
        answer: `${data[0][targetCategory]} is the top value in ${targetCategory} with ${data[0].count.toLocaleString()} rows.`,
        insights: buildLocalInsights(dataset, datasetProfile, 'ranking', [targetCategory], filters),
        chart: {
          type: data.length <= 5 ? 'pie' : 'bar',
          x: targetCategory,
          y: 'count',
          data,
        },
      }
    }
  }

  return null
}

function chartLabel(chart) {
  if (!chart?.type) return ''
  if (chart?.x && chart?.y) {
    return `${chart.type} chart: ${chart.y} by ${chart.x}`
  }
  return `${chart.type} chart`
}

function dashboardRequestFromChart(chart) {
  if (!chart?.type) return null

  const typeMap = {
    bar: 'bar_chart',
    line: 'line_chart',
    pie: 'pie_chart',
  }

  const chartType = typeMap[chart.type] || 'bar_chart'
  if (chartType === 'pie_chart') {
    return {
      chart_type: chartType,
      title: chartLabel(chart),
      mapping: {
        legend: chart.x || '',
        values: chart.y ? [chart.y] : [],
        tooltip: [chart.x, chart.y].filter(Boolean),
        aggregation: 'sum',
      },
    }
  }

  return {
    chart_type: chartType,
    title: chartLabel(chart),
    mapping: {
      x_axis: chart.x || '',
      y_axis: chart.y || '',
      values: chart.y ? [chart.y] : [],
      tooltip: [chart.x, chart.y].filter(Boolean),
      aggregation: 'sum',
    },
  }
}

function normalizeChartPayload(chart, fallbackTitle = '') {
  if (!chart || typeof chart !== 'object') return null

  if (chart.chart_type || chart.mapping) {
    return {
      kind: 'dashboard',
      request: {
        chart_type: chart.chart_type || 'bar_chart',
        title: chart.title || fallbackTitle || chart.chart_type || 'Suggested chart',
        mapping: chart.mapping || {},
      },
      label: chart.title || chart.chart_type || 'Suggested chart',
    }
  }

  if (chart.type) {
    return {
      kind: 'analytics',
      request: dashboardRequestFromChart(chart),
      label: chartLabel(chart),
    }
  }

  return null
}

export default function ChatBot({ dataset, datasetProfile }) {
  const [open, setOpen] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([
    buildMessage(
      'assistant',
      dataset
        ? `Ask me anything about ${dataset.name}. I can explain trends, answer data questions, and help you explore the uploaded sample faster.`
        : 'Upload a dataset and I can answer questions, summarize the data, and help generate insights.'
    ),
  ])
  const [input, setInput] = useState('')
  const messagesRef = useRef(null)
  const historyLoadedRef = useRef(false)
  const hasDataset = Boolean(dataset)

  const datasetStatus = useMemo(() => {
    if (!dataset) return 'Waiting for dataset context'

    const rowCount = datasetProfile?.totalRowCount || datasetProfile?.rowCount || dataset?.rows?.length || 0
    const parts = [dataset.name]
    if (rowCount) parts.push(`${rowCount.toLocaleString()} rows`)
    return `${parts.join(' | ')} loaded`
  }, [dataset, datasetProfile])

  const datasetPills = useMemo(() => {
    if (!dataset) return []

    const rowCount = datasetProfile?.totalRowCount || datasetProfile?.rowCount || dataset?.rows?.length || 0
    const columnCount = datasetProfile?.totalColumnCount || datasetProfile?.columnCount || dataset?.columns?.length || 0
    const numericCount = datasetProfile?.numericColumns?.length || 0
    const dateCount = Object.values(datasetProfile?.types || {}).filter((value) => value === 'date').length

    return [
      rowCount ? { label: 'Rows', value: rowCount.toLocaleString() } : null,
      columnCount ? { label: 'Columns', value: columnCount.toLocaleString() } : null,
      numericCount ? { label: 'Numeric', value: numericCount.toLocaleString() } : null,
      dateCount ? { label: 'Dates', value: dateCount.toLocaleString() } : null,
    ].filter(Boolean).slice(0, 4)
  }, [dataset, datasetProfile])

  const welcomeState = useMemo(() => {
    if (!dataset) {
      return {
        eyebrow: 'Ready when your data is',
        title: 'Upload a CSV or Excel file to unlock dataset answers',
        description: 'I can summarize the file, answer row-level questions, compare values, and suggest quick charts once the dataset is loaded.',
      }
    }

    return {
      eyebrow: 'Dataset assistant',
      title: `Working with ${dataset.name}`,
      description: 'Ask for exact record details, filtered counts, averages, top performers, or a trend and I will answer from the uploaded rows.',
    }
  }, [dataset])

  const quickPrompts = useMemo(() => {
    if (!dataset) {
      return [
        'What can you do once I upload a dataset?',
        'How should I clean my data before analysis?',
        'Which chart types work best for tabular data?',
      ]
    }

    const primaryNumeric = datasetProfile?.numericColumns?.[0]
    const categoricalColumns = dataset?.columns?.filter((column) => !(datasetProfile?.numericColumns || []).includes(column) && datasetProfile?.types?.[column] !== 'date') || []
    const primaryCategory = categoricalColumns[0]
    const identifierColumn = dataset?.columns?.find((column) => isIdentifierColumn(column))
    const identifierExample = identifierColumn
      ? dataset?.rows?.find((row) => row?.[identifierColumn] !== undefined && row?.[identifierColumn] !== null && row?.[identifierColumn] !== '')?.[identifierColumn]
      : null

    return [
      primaryNumeric ? `What is the average ${primaryNumeric}?` : 'What is the average of the main numeric column?',
      'Show the strongest trend I should investigate.',
      primaryCategory ? `Which ${primaryCategory} performs best?` : 'Which category performs best?',
      identifierColumn && identifierExample !== null && identifierExample !== undefined
        ? `Show details of ${humanizeColumnName(identifierColumn)} ${identifierExample}`
        : 'How many rows match the current filter?',
    ]
  }, [dataset, datasetProfile])

  const showWelcomeCard = messages.length <= 1 && messages.every((message) => message.role === 'assistant')

  useEffect(() => {
    if (!open || historyLoadedRef.current) return
    let ignore = false

    async function loadHistory() {
      setLoadingHistory(true)
      try {
        const response = await fetchChatHistory()
        if (ignore) return
        const history = Array.isArray(response?.messages) ? response.messages : []
        if (history.length) {
          setMessages(history.map((message) => ({
            id: `${message.role}-${Math.random().toString(36).slice(2, 8)}`,
            role: message.role,
            content: message.content,
            createdAt: new Date(),
            chart: null,
            insights: null,
            details: null,
          })))
        }
        historyLoadedRef.current = true
      } catch {
        historyLoadedRef.current = true
      } finally {
        if (!ignore) setLoadingHistory(false)
      }
    }

    loadHistory()
    return () => {
      ignore = true
    }
  }, [open])

  useEffect(() => {
    if (!messagesRef.current) return
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages, open, sending])

  async function handleSend(rawValue) {
    const value = String(rawValue ?? input).trim()
    if (!value || sending) return

    const userMessage = buildMessage('user', value)
    setMessages((current) => [...current, userMessage])
    setInput('')
    setSending(true)

    try {
      const localPayload = resolveLocalDatasetQuery(value, dataset, datasetProfile)
      if (localPayload) {
        const assistantMessage = buildMessage(
          'assistant',
          localPayload.answer,
          {
            chart: normalizeChartPayload(localPayload.chart, localPayload.answer),
            insights: localPayload.insights || null,
            details: localPayload.details || null,
          }
        )
        setMessages((current) => [...current, assistantMessage])
        return
      }

      const response = await sendChatMessage(value)
      const normalizedChart = normalizeChartPayload(
        response?.chart || response?.chart_request || null,
        response?.answer || response?.reply || ''
      )
      const assistantMessage = buildMessage(
        'assistant',
        response?.answer || response?.reply || 'I could not generate a reply for that request.',
        {
          chart: normalizedChart,
          insights: response?.insights || null,
          details: Array.isArray(response?.details) ? response.details : null,
        }
      )
      setMessages((current) => [...current, assistantMessage])
    } catch (error) {
      const fallback = buildMessage(
        'assistant',
        error?.response?.data?.detail || error?.message || 'The chatbot is unavailable right now.'
      )
      setMessages((current) => [...current, fallback])
    } finally {
      setSending(false)
    }
  }

  function handleCreateChart(message) {
    if (typeof window === 'undefined') return
    const request = message?.chart?.request || null
    if (!request) return
    window.dispatchEvent(new CustomEvent('datalytics:create-dashboard-widget', { detail: request }))
  }

  async function handleClear() {
    try {
      await clearChatHistory()
    } catch {
      // Keep the local reset even if the backend clear request fails.
    }

    setMessages([
      buildMessage(
        'assistant',
        dataset
          ? `Chat cleared. Ask a new question about ${dataset.name} whenever you're ready.`
          : 'Chat cleared. Upload a dataset and I can help analyze it.'
      ),
    ])
  }

  return (
    <>
      <button
        type="button"
        className={`chatbot-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close chatbot' : 'Open chatbot'}
      >
        <BotLogo size="fab" className="chatbot-fab-logo" />
      </button>

      {open ? (
        <section className="chatbot-panel">
          <header className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-avatar">
                <BotLogo size="header" />
              </div>
              <div className="chatbot-header-copy">
                <div className="chatbot-title-row">
                  <div className="chatbot-title">Datalytics Assistant</div>
                  <span className="chatbot-mode-pill">{hasDataset ? 'Dataset mode' : 'Guide mode'}</span>
                </div>
                <div className="chatbot-status">
                  <span className={`chatbot-status-dot ${hasDataset ? 'online' : ''}`} />
                  <span className="chatbot-status-text">{datasetStatus}</span>
                  {hasDataset
                    ? `${dataset.name} loaded${datasetProfile?.totalRowCount ? ` • ${datasetProfile.totalRowCount.toLocaleString()} rows` : ''}`
                    : 'Waiting for dataset context'}
                </div>
              </div>
            </div>
            <div className="chatbot-header-right">
              <button type="button" className="chatbot-clear-btn" onClick={handleClear}>Clear</button>
              <button type="button" className="chatbot-minimize-btn" onClick={() => setOpen(false)}>Hide</button>
            </div>
          </header>

          {datasetPills.length ? (
            <div className="chatbot-dataset-pills">
              {datasetPills.map((pill) => (
                <div key={pill.label} className="chatbot-dataset-pill">
                  <span className="chatbot-dataset-pill-label">{pill.label}</span>
                  <strong>{pill.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <div className="chatbot-quick">
            <div className="chatbot-quick-title">Quick prompts</div>
            <div className="chatbot-quick-grid">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chatbot-quick-btn"
                  disabled={sending}
                  onClick={() => handleSend(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div ref={messagesRef} className="chatbot-messages">
            {loadingHistory ? (
              <div className="chatbot-typing">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="typing-text">Loading previous messages</div>
              </div>
            ) : null}

            {showWelcomeCard ? (
              <div className="chatbot-welcome-card">
                <div className="chatbot-welcome-eyebrow">{welcomeState.eyebrow}</div>
                <div className="chatbot-welcome-title">{welcomeState.title}</div>
                <div className="chatbot-welcome-copy">{welcomeState.description}</div>
                {datasetPills.length ? (
                  <div className="chatbot-welcome-grid">
                    {datasetPills.map((pill) => (
                      <div key={pill.label} className="chatbot-welcome-item">
                        <span>{pill.label}</span>
                        <strong>{pill.value}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="chatbot-empty-note">
                    Ask about averages, filters, trends, or specific record IDs after upload.
                  </div>
                )}
              </div>
            ) : null}

            {messages.map((message) => {
              const isUser = message.role === 'user'
              const insightBadges = buildInsightBadges(message.insights)
              return (
                <div key={message.id} className={`chatbot-msg ${isUser ? 'chatbot-msg--user' : ''}`}>
                  <div className={`chatbot-msg-avatar ${isUser ? 'chatbot-msg-avatar--user' : 'chatbot-msg-avatar--assistant'}`}>
                    {isUser ? 'You' : <BotLogo size="message" />}
                  </div>
                  <div className="chatbot-msg-content">
                    <div className="chatbot-msg-meta">
                      <span className="chatbot-msg-author">{isUser ? 'You' : 'Assistant'}</span>
                      <span className="chatbot-msg-time">{formatTime(message.createdAt)}</span>
                    </div>
                    <div className="chatbot-msg-surface">
                      <div className="chatbot-msg-bubble">{message.content}</div>
                      {message.details?.length ? (
                        <div className="chatbot-details-card">
                          <div className="chatbot-details-title">Record details</div>
                          <div className="chatbot-details-grid">
                            {message.details.map((detail) => (
                              <div key={detail.column} className="chatbot-detail-row">
                                <span className="chatbot-detail-label">{detail.column}</span>
                                <strong className="chatbot-detail-value">{String(detail.value)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {message.insights?.summary ? (
                      <div className="chatbot-insight-panel">
                        <div className="chatbot-insight-header">
                          <div className="chatbot-insight-meta">
                            Query snapshot
                          </div>
                          {insightBadges.length ? (
                            <div className="chatbot-insight-badges">
                              {insightBadges.map((badge) => (
                                <span key={badge} className="chatbot-insight-badge">{badge}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="chatbot-insight-meta chatbot-insight-meta--legacy">
                          {message.insights.summary.total_rows?.toLocaleString?.() || message.insights.summary.total_rows || 0} rows
                          {message.insights.query?.intent ? ` • ${message.insights.query.intent}` : ''}
                        </div>
                        {(message.insights.key_insights || []).slice(0, 2).map((insight) => (
                          <div key={insight} className="chatbot-insight-item">{insight}</div>
                        ))}
                      </div>
                    ) : null}
                    {message.chart?.request ? (
                      <div className="chatbot-chart-action">
                        <div className="chatbot-chart-action-meta">
                          Suggested visual: <strong>{message.chart.label || 'Suggested chart'}</strong>
                        </div>
                        <button
                          type="button"
                          className="chatbot-send-btn"
                          onClick={() => handleCreateChart(message)}
                        >
                          Add chart
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}

            {sending ? (
              <div className="chatbot-typing">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="typing-text">{hasDataset ? 'Analyzing your dataset' : 'Thinking'}</div>
              </div>
            ) : null}
          </div>

          <div className="chatbot-input-row">
            <div className="chatbot-input-meta">
              <span>{hasDataset ? `Context: ${dataset.name}` : 'Tip: upload a dataset to unlock record-level answers'}</span>
              <span>Enter to send</span>
            </div>
            <div className="chatbot-input-wrapper">
              <textarea
                className="chatbot-input"
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={hasDataset ? 'Ask about your uploaded dataset...' : 'Upload a dataset, then ask a question...'}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSend()
                  }
                }}
              />
              <div className="chatbot-input-actions">
                <button
                  type="button"
                  className={`chatbot-send-btn ${!input.trim() || sending ? 'disabled' : ''}`}
                  disabled={!input.trim() || sending}
                  onClick={() => handleSend()}
                >
                  {sending ? 'Sending' : 'Ask AI'}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
