'use client';

import { useEffect, useRef, useState } from 'react';
// 'chart.js/auto' registers every chart type, so no setup is needed
import Chart, { type ChartConfiguration } from 'chart.js/auto';
import { chartPalettes, type ChartTheme } from '@/utils/reports';
import type { Sentiment } from '@/utils/types';

export interface ChartSeries {
  label: string;
  data: number[];
  // Sentiment series use the fixed sentiment color (blue / gray / red)
  tone?: Sentiment;
  // Otherwise the category color in this slot; defaults to the series' position. Pass a fixed
  // slot when a series must keep its color whatever else is shown.
  slot?: number;
  // Doughnut only: one sentiment per slice (otherwise slices take the category colors in order)
  tones?: Sentiment[];
}

interface Props {
  type: 'bar' | 'line' | 'doughnut';
  // The chart's name, read by screen readers and used as the data table caption
  title: string;
  labels: string[];
  series: ChartSeries[];
  // Bars on top of each other (e.g. positive/neutral/negative per tournament); with type 'line',
  // a stacked area chart (e.g. sentiment per minute)
  stacked?: boolean;
  // Horizontal bars, for long labels such as topics or stream titles
  horizontal?: boolean;
  // Axis titles with units, e.g. categoryTitle "Week starting (Monday)", valueTitle "Registrations (count)".
  // They follow the axes when horizontal is on.
  categoryTitle?: string;
  valueTitle?: string;
  // '%' = values are percentages (axis 0-100, tooltips "63%")
  unit?: '%';
  // Tailwind height class, e.g. 'h-80'
  heightClass?: string;
}

// The site theme (<html data-theme>), following the theme toggle while the page is open
function useSiteTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>('light');
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

type Data = { labels: string[]; series: ChartSeries[] };

// The full Chart.js setup for one theme. Kept in one function so printing can switch to the light
// palette synchronously (printed pages always use the light theme).
function buildConfig(
  data: Data,
  theme: ChartTheme,
  opts: Pick<Props, 'type' | 'stacked' | 'horizontal' | 'categoryTitle' | 'valueTitle' | 'unit'>,
): ChartConfiguration {
  const p = chartPalettes[theme];
  const { type, stacked = false, horizontal = false, categoryTitle, valueTitle, unit } = opts;
  const color = (s: ChartSeries, i: number) => (s.tone ? p.sentiment[s.tone] : p.category[(s.slot ?? i) % p.category.length]);
  const suffix = unit ?? '';
  const axisTitle = (text: string | undefined) =>
    text ? { display: true, text, color: p.text, font: { weight: 'bold' as const } } : { display: false };
  const categoryAxis = { stacked, ticks: { color: p.text }, grid: { display: false }, title: axisTitle(categoryTitle) };
  const valueAxis = {
    stacked,
    beginAtZero: true,
    ...(unit === '%' ? { max: 100 } : {}),
    ticks: { color: p.text, precision: 0, callback: (v: string | number) => `${v}${suffix}` },
    grid: { color: p.grid },
    border: { display: false },
    title: axisTitle(valueTitle),
  };

  return {
    type,
    data: {
      labels: data.labels,
      datasets: data.series.map((s, i) => {
        if (type === 'doughnut') {
          const colors = s.data.map((_, j) => (s.tones?.[j] ? p.sentiment[s.tones[j]] : p.category[j % p.category.length]));
          // A gap in the card color between slices keeps them apart
          return { label: s.label, data: s.data, backgroundColor: colors, borderColor: p.surface, borderWidth: 2 };
        }
        if (type === 'line') {
          // stacked line = stacked area: each series fills down to the one below it (the first to
          // the axis) in its own color at 40% (palette colors are #rrggbb), small points
          if (stacked) {
            return {
              label: s.label, data: s.data, borderColor: color(s, i), backgroundColor: `${color(s, i)}66`,
              fill: i === 0 ? 'origin' : '-1',
              borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, pointBorderColor: p.surface, pointBorderWidth: 1, tension: 0.25,
            };
          }
          return {
            label: s.label, data: s.data, borderColor: color(s, i), backgroundColor: color(s, i),
            borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: p.surface, pointBorderWidth: 2, tension: 0.2,
          };
        }
        return {
          label: s.label, data: s.data, backgroundColor: color(s, i),
          borderRadius: 4, maxBarThickness: 36,
          // Thin gap in the card color between stacked parts and neighbouring bars
          borderColor: p.surface, borderWidth: 2, borderSkipped: false,
        };
      }),
    } as ChartConfiguration['data'],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: horizontal ? 'y' : 'x',
      // Hovering anywhere above a date shows all values for that date
      interaction: type === 'doughnut' ? undefined : { mode: 'index', intersect: false },
      plugins: {
        // A legend on every chart (color is never the only way to tell series apart: the data
        // table below the chart lists every value too)
        legend: { display: true, position: 'bottom', labels: { color: p.text, boxWidth: 12, usePointStyle: type === 'line' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = Number(ctx.raw ?? 0);
              if (type === 'doughnut') {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + Number(b), 0);
                const share = total ? Math.round((value / total) * 100) : 0;
                return `${ctx.label}: ${value} (${share}%)`;
              }
              return `${ctx.dataset.label}: ${value}${suffix}`;
            },
          },
        },
      },
      scales: type === 'doughnut' ? {} : horizontal
        ? { x: valueAxis, y: categoryAxis }
        : { x: categoryAxis, y: valueAxis },
    },
  } as ChartConfiguration;
}

// A Chart.js chart with a legend, axis titles, tooltips and a data table. Colors come from the
// validated palette for the current theme (utils/reports.ts chartPalettes). The chart is rebuilt
// when the data or theme changes and destroyed when the component is removed.
export default function ReportChart({
  type, title, labels, series, stacked = false, horizontal = false, categoryTitle, valueTitle, unit, heightClass = 'h-64',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useSiteTheme();
  // Comparing the data as text: the parent creates new arrays on every render,
  // but the chart only needs rebuilding when the numbers really change.
  const dataKey = JSON.stringify({ labels, series });

  useEffect(() => {
    if (!canvasRef.current) return;
    const data = JSON.parse(dataKey) as Data;
    const opts = { type, stacked, horizontal, categoryTitle, valueTitle, unit };
    const chart = new Chart(canvasRef.current, buildConfig(data, theme, opts));

    // Printing / saving as PDF: light colors and the paper's width, then back
    const apply = (t: ChartTheme) => {
      const config = buildConfig(data, t, opts);
      chart.data = config.data;
      chart.options = config.options ?? {};
      chart.update('none');
    };
    const beforePrint = () => {
      apply('light');
      chart.resize();
    };
    const afterPrint = () => {
      apply(theme);
      chart.resize();
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);

    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
      chart.destroy();
    };
  }, [dataKey, theme, type, stacked, horizontal, categoryTitle, valueTitle, unit]);

  const suffix = unit ?? '';
  return (
    <div>
      <div className={`relative ${heightClass}`}>
        <canvas ref={canvasRef} role="img" aria-label={title} />
      </div>
      {/* Every value as a table: for screen readers, color-blind readers and exact numbers */}
      <details className="mt-2 print:hidden">
        <summary className="cursor-pointer text-xs font-bold text-stone-600 hover:text-stone-900">Show data table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-left border-b border-stone-200">
                <th scope="col" className="py-1.5 pr-3 font-black text-stone-600">{categoryTitle ?? 'Item'}</th>
                {series.map((s) => (
                  <th key={s.label} scope="col" className="py-1.5 pr-3 font-black text-stone-600 text-right">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {labels.map((label, i) => (
                <tr key={`${label}-${i}`}>
                  <th scope="row" className="py-1.5 pr-3 font-medium text-stone-800 text-left break-words">{label}</th>
                  {series.map((s) => (
                    <td key={s.label} className="py-1.5 pr-3 text-right tabular-nums text-stone-800">{s.data[i] ?? 0}{suffix}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
