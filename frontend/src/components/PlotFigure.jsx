import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

export default function PlotFigure({ figure, style, className = '' }) {
  const divRef = useRef(null)

  useEffect(() => {
    if (!figure?.data || !figure?.layout || !divRef.current) return

    Plotly.react(divRef.current, figure.data, {
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#edf3ff' },
      margin: { l: 40, r: 20, t: 60, b: 40 },
      ...figure.layout,
    }, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d'],
      ...figure.config,
    })

    return () => {
      if (divRef.current) Plotly.purge(divRef.current)
    }
  }, [figure])

  if (!figure?.data || !figure?.layout) return null

  return (
    <div
      ref={divRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  )
}
