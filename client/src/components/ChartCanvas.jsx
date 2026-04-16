import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default function ChartCanvas({ config, height = 260, onReady }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    chartRef.current = new Chart(canvasRef.current, config);
    if (onReady) {
      onReady(chartRef.current);
    }
    return () => chartRef.current?.destroy();
  }, [config, onReady]);

  return <canvas ref={canvasRef} style={{ width: '100%', height }} />;
}
