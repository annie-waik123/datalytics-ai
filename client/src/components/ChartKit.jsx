import { formatNumber } from '../lib/dataUtils.js'

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185', '#22d3ee', '#f97316']

function getColor(index) {
  return COLORS[index % COLORS.length]
}

export function BarChart({ data, height = 220, valueFormatter = formatNumber }) {
  if (!data.length) {
    return <div className="empty-chart">No data available.</div>
  }
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="chart-card" style={{ height }}>
      <div className="chart-bars">
        {data.map((item, index) => (
          <div key={item.label} className="chart-bar">
            <div
              className="chart-bar-fill"
              style={{ height: `${(item.value / max) * 100}%`, background: getColor(index) }}
            />
            <span className="chart-bar-label">{item.label}</span>
            <span className="chart-bar-value">{valueFormatter(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LineChart({ data, height = 220, valueFormatter = formatNumber }) {
  if (!data.length) {
    return <div className="empty-chart">No data available.</div>
  }
  const max = Math.max(1, ...data.map(d => d.value))
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100
    const y = 40 - (item.value / max) * 34 - 3
    return `${x},${y}`
  })

  return (
    <div className="chart-card" style={{ height }}>
      <svg className="chart-line" viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="#38bdf8" strokeWidth="2.6" points={points.join(' ')} />
        <polygon points={`0,40 ${points.join(' ')} 100,40`} fill="url(#lineFill)" />
      </svg>
      <div className="chart-line-labels">
        {data.map(item => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{valueFormatter(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PieChart({ data, size = 200, valueFormatter = formatNumber }) {
  if (!data.length) {
    return <div className="empty-chart">No data available.</div>
  }
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1
  let start = 0
  const gradient = data.map((item, index) => {
    const percent = (item.value / total) * 100
    const end = start + percent
    const color = getColor(index)
    const segment = `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    start = end
    return segment
  }).join(', ')

  return (
    <div className="chart-card chart-card--pie">
      <div className="chart-pie" style={{ width: size, height: size, background: `conic-gradient(${gradient})` }} />
      <div className="chart-legend">
        {data.map((item, index) => (
          <div key={item.label} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: getColor(index) }} />
            <span className="chart-legend-label">{item.label}</span>
            <span className="chart-legend-value">{valueFormatter(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Heatmap({ matrix, labels }) {
  if (!matrix || !labels || labels.length === 0) return null
  const cells = []
  cells.push(<div key="empty" className="heatmap-cell heatmap-cell--empty" />)
  labels.forEach(label => {
    cells.push(
      <div key={`col-${label}`} className="heatmap-label">{label}</div>
    )
  })
  matrix.forEach((row, rowIndex) => {
    cells.push(
      <div key={`row-${labels[rowIndex]}`} className="heatmap-label heatmap-label--row">{labels[rowIndex]}</div>
    )
    row.forEach((value, colIndex) => {
      cells.push(
        <div
          key={`cell-${rowIndex}-${colIndex}`}
          className="heatmap-cell"
          style={{ background: getHeatColor(value) }}
          title={`${labels[rowIndex]} vs ${labels[colIndex]}: ${value.toFixed(2)}`}
        >
          {value.toFixed(2)}
        </div>
      )
    })
  })

  return (
    <div className="heatmap">
      <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${labels.length + 1}, minmax(46px, 1fr))` }}>
        {cells}
      </div>
    </div>
  )
}

export function HistogramChart({ bins, height = 220 }) {
  return <BarChart data={bins} height={height} valueFormatter={value => String(Math.round(value))} />
}

function getHeatColor(value) {
  const clamped = Math.max(-1, Math.min(1, value))
  if (clamped >= 0) {
    return `rgba(56, 189, 248, ${(0.2 + clamped * 0.6).toFixed(2)})`
  }
  return `rgba(244, 114, 182, ${(0.2 + Math.abs(clamped) * 0.6).toFixed(2)})`
}
