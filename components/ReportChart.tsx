'use client';

import { useEffect, useRef } from 'react';
// 'chart.js/auto' registers every chart type, so no setup is needed
import Chart from 'chart.js/auto';
import { categoryColors, chartGrid, chartText } from '@/utils/reports';

export interface ChartSeries {
  label: string;
  data: number[];
  // Defaults to the next color in categoryColors
  color?: string;
  // Doughnut only: one color per slice
  colors?: string[];
}

interface Props {
  type: 'bar' | 'line' | 'doughnut';
  // Describes the chart for screen readers, e.g. "Feedback per week by sentiment"
  title: string;
  labels: string[];
  series: ChartSeries[];
  // Bars on top of each other (e.g. positive/neutral/negative per week)
  stacked?: boolean;
  // Horizontal bars, for long labels such as topics or stream titles
  horizontal?: boolean;
  // Tailwind height class, e.g. 'h-80'
  heightClass?: string;
}

// A Chart.js chart. The chart is rebuilt when the data changes and destroyed when
// the component is removed (otherwise Chart.js keeps it in memory).
export default function ReportChart({ type, title, labels, series, stacked = false, horizontal = false, heightClass = 'h-64' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Comparing the data as text: the parent creates new arrays on every render,
  // but the chart only needs rebuilding when the numbers really change.
  const dataKey = JSON.stringify({ labels, series });

  useEffect(() => {
    if (!canvasRef.current) return;
    const data = JSON.parse(dataKey) as { labels: string[]; series: ChartSeries[] };
    const showLegend = type === 'doughnut' || data.series.length > 1;

    const chart = new Chart(canvasRef.current, {
      type,
      data: {
        labels: data.labels,
        datasets: data.series.map((s, i) => {
          const color = s.color ?? categoryColors[i % categoryColors.length];
          if (type === 'doughnut') {
            // A gap in the card color between slices keeps them apart
            return { label: s.label, data: s.data, backgroundColor: s.colors, borderColor: '#1a1a2e', borderWidth: 2 };
          }
          if (type === 'line') {
            return {
              label: s.label, data: s.data, borderColor: color, backgroundColor: color,
              borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.2,
            };
          }
          return {
            label: s.label, data: s.data, backgroundColor: color,
            borderRadius: 4, maxBarThickness: 36,
            // Thin gap between stacked parts and neighbouring bars
            borderColor: '#1a1a2e', borderWidth: stacked ? 1 : 0,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        indexAxis: horizontal ? 'y' : 'x',
        // Hovering anywhere above a date shows all values for that date
        interaction: type === 'doughnut' ? undefined : { mode: 'index', intersect: false },
        plugins: {
          legend: { display: showLegend, position: 'bottom', labels: { color: chartText, boxWidth: 12 } },
        },
        scales: type === 'doughnut' ? {} : {
          x: { stacked, ticks: { color: chartText, precision: 0 }, grid: { color: chartGrid } },
          y: { stacked, beginAtZero: true, ticks: { color: chartText, precision: 0 }, grid: { color: chartGrid } },
        },
      },
    });

    // Fit the chart to the paper size when printing / saving as PDF
    const onPrint = () => chart.resize();
    window.addEventListener('beforeprint', onPrint);

    return () => {
      window.removeEventListener('beforeprint', onPrint);
      chart.destroy();
    };
  }, [dataKey, type, stacked, horizontal]);

  return (
    <div className={`relative ${heightClass}`}>
      <canvas ref={canvasRef} role="img" aria-label={title} />
    </div>
  );
}
