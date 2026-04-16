import { useMemo } from 'react';
import ChartCanvas from './ChartCanvas.jsx';

export default function HeatmapChart({ matrix = [], labels = [] }) {
  const config = useMemo(() => {
    const points = [];
    matrix.forEach((row, i) => {
      row.forEach((value, j) => {
        points.push({ x: i, y: j, v: value });
      });
    });

    const heatmapPlugin = {
      id: 'heatmap',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        const cellSize = 26;
        meta.data.forEach((pt, idx) => {
          const value = chart.data.datasets[0].data[idx].v;
          const color = `rgba(255, 107, 53, ${Math.abs(value)})`;
          ctx.fillStyle = color;
          ctx.fillRect(pt.x - cellSize / 2, pt.y - cellSize / 2, cellSize, cellSize);
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Space Grotesk';
          ctx.fillText(value.toFixed(2), pt.x - 10, pt.y + 3);
        });
      },
    };

    return {
      type: 'scatter',
      data: {
        datasets: [
          {
            data: points,
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Correlation Heatmap', color: '#e6edf3' },
        },
        scales: {
          x: {
            ticks: { callback: (value) => labels[value] || '', color: '#9aa4b2' },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            ticks: { callback: (value) => labels[value] || '', color: '#9aa4b2' },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
      plugins: [heatmapPlugin],
    };
  }, [matrix, labels]);

  if (!matrix.length) {
    return <div className="empty-chart">Not enough numeric columns for heatmap.</div>;
  }

  return <ChartCanvas config={config} height={320} />;
}
