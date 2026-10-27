import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import './chartSetup';
import { useThemeColors } from './theme/useThemeColors';

// A frequency bar per category on a left axis, optionally with the opponent's
// Team Defense multiplier as a line on a fixed 0.5-1.5 right axis. The legend
// and tooltip are HTML so they keep the page's typography; the parent supplies
// the tooltip's contents and owns the sized, relatively positioned container.

// Canvas paint, resolved from the theme tokens.
const CHART_COLORS = {
  bar: '--ct-gold-fill',
  line: '--ct-slate',
  point: '--ct-text-max',
  axis: '--ct-x-666666',
  cursor: '--ct-x-cccccc',
  tick: '--ct-dim',
  grid: '--ct-line',
  title: '--ct-x-808080',
};
const FONT_FAMILY =
  "'Barlow', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const TICK_FONT = { family: FONT_FAMILY, size: 11 };
// Plain numbers ("0.75", "1") rather than Chart.js's rounded, localized labels.
const valueLabel = (value) => String(value);
// Chart.js centres an axis title `lineHeight / 2 + padding.top` inside the
// axis edge; this puts it 5px in, where the old chart's titles sat.
const TITLE_LAYOUT = {
  display: true,
  font: { family: FONT_FAMILY, size: 16, lineHeight: 1.2 },
  padding: { top: 5 - (16 * 1.2) / 2, bottom: 0 },
};
// Plot-area margins and fixed axis sizes, in CSS pixels.
const MARGIN = { top: 20, right: 30, bottom: 60, left: 20 };
const Y_AXIS_WIDTH = 60;
const TOOLTIP_OFFSET = 10;
const TICK_COUNT = 5;

// Five evenly spaced ticks from zero whose step is a "nice" number, so the
// frequency axis reads 0/8/16/24/32 for a 31.4% maximum rather than 0-35 by 5.
export const frequencyAxisStep = (max) => {
  const roughStep = max / (TICK_COUNT - 1);
  if (!(roughStep > 0)) return 1;
  const digits = Math.floor(Math.log10(roughStep)) + 1;
  const magnitude = 10 ** digits;
  const increment = digits === 1 ? 0.1 : 0.05;
  const ratio = Math.ceil(Number((roughStep / magnitude / increment).toFixed(10))) * increment;
  return Number((ratio * magnitude).toPrecision(12));
};

const fixSize = (dimension, size) => (scale) => {
  scale[dimension] = size;
};

const legendIcons = {
  bar: <path stroke="none" fill="var(--ct-gold-fill)" d="M0,4h32v24h-32z" />,
  line: (
    <path
      strokeWidth="4"
      fill="none"
      stroke="var(--ct-slate)"
      d="M0,16h10.67A5.33,5.33,0,1,1,21.33,16H32M21.33,16A5.33,5.33,0,1,1,10.67,16"
    />
  ),
};

const MatchupComboChart = ({
  rows,
  barLabel,
  yTitle,
  withDefense,
  rotateLabels,
  renderTooltip,
}) => {
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);
  const hoverRef = useRef(null);
  const legendRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [legendHeight, setLegendHeight] = useState(null);
  const colors = useThemeColors(CHART_COLORS);

  const data = useMemo(
    () => ({
      labels: rows.map((row) => row.label),
      datasets: [
        {
          type: 'bar',
          label: barLabel,
          data: rows.map((row) => row.frequency),
          backgroundColor: colors.bar,
          hoverBackgroundColor: colors.bar,
          borderWidth: 0,
          borderRadius: 3,
          borderSkipped: 'bottom',
          categoryPercentage: 0.8,
          barPercentage: 1,
          yAxisID: 'y',
          // Lower `order` draws later, so the line sits on top of the bars.
          order: 1,
        },
        ...(withDefense
          ? [
              {
                type: 'line',
                label: 'Team Defense',
                data: rows.map((row) => row.teamDefense),
                borderColor: colors.line,
                borderWidth: 2,
                cubicInterpolationMode: 'monotone',
                pointRadius: 3,
                pointBorderWidth: 2,
                pointBorderColor: colors.line,
                pointBackgroundColor: colors.point,
                pointHoverRadius: 4,
                pointHoverBorderWidth: 2,
                pointHoverBorderColor: colors.point,
                pointHoverBackgroundColor: colors.line,
                yAxisID: 'y1',
                order: 0,
              },
            ]
          : []),
      ],
    }),
    [rows, barLabel, withDefense, colors],
  );

  const options = useMemo(() => {
    const maxFrequency = Math.max(...rows.map((row) => row.frequency));
    const step = frequencyAxisStep(maxFrequency);
    const ticks = { color: colors.tick, font: TICK_FONT, padding: 2 };
    const valueTicks = { ...ticks, callback: valueLabel };
    const tickMarks = { tickColor: colors.axis, tickLength: 6 };
    const grid = { color: colors.grid, ...tickMarks };
    // Chart.js v4 draws grid lines with `border.dash`; the axis line stays solid.
    const axisBorder = { color: colors.axis, dash: [3, 3] };
    const title = { ...TITLE_LAYOUT, color: colors.title };
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1500 },
      layout: {
        padding: { ...MARGIN, bottom: MARGIN.bottom + legendHeight },
      },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        matchupHover: { cursorColor: colors.cursor },
      },
      scales: {
        x: {
          afterFit: fixSize('height', rotateLabels ? 80 : 30),
          ticks: {
            ...ticks,
            autoSkip: false,
            maxRotation: rotateLabels ? 45 : 0,
            minRotation: rotateLabels ? 45 : 0,
            // Chart.js anchors a rotated label's end a few pixels up and left
            // of where the old SVG labels ended; nudge it back under the tick.
            ...(rotateLabels ? { labelOffset: 4, padding: 4 } : {}),
          },
          grid: { ...grid, offset: false },
          border: axisBorder,
        },
        y: {
          position: 'left',
          min: 0,
          max: step * (TICK_COUNT - 1),
          afterFit: fixSize('width', Y_AXIS_WIDTH),
          ticks: { ...valueTicks, stepSize: step },
          grid,
          border: axisBorder,
          title: { ...title, text: yTitle },
        },
        ...(withDefense
          ? {
              y1: {
                position: 'right',
                min: 0.5,
                max: 1.5,
                afterFit: fixSize('width', Y_AXIS_WIDTH),
                ticks: { ...valueTicks, stepSize: 0.25 },
                grid: { ...tickMarks, drawOnChartArea: false },
                border: { color: colors.axis },
                title: { ...title, text: 'Team Defense Multiplier' },
              },
            }
          : {}),
      },
    };
  }, [rows, yTitle, withDefense, rotateLabels, legendHeight, colors]);

  // Track the hovered category inside the plot area: it drives the HTML
  // tooltip and the vertical cursor drawn behind the series.
  const plugins = useMemo(
    () => [
      {
        id: 'matchupHover',
        afterEvent(chart, args) {
          const { event, inChartArea } = args;
          let next = null;
          if (event.type !== 'mouseout' && inChartArea) {
            const index = chart.scales.x.getValueForPixel(event.x);
            if (index >= 0 && index < chart.data.labels.length) {
              const { left, top, right, bottom } = chart.chartArea;
              next = {
                index,
                x: chart.scales.x.getPixelForValue(index),
                y: event.y,
                area: { left, top, right, bottom },
              };
            }
          } else if (chart.getActiveElements().length > 0) {
            chart.setActiveElements([]);
            args.changed = true;
          }
          if (hoverRef.current?.index !== next?.index) args.changed = true;
          hoverRef.current = next;
          setHover(next);
        },
        // The cursor colour rides in the options, so a theme change reaches
        // this plugin without reinstalling it.
        beforeDatasetsDraw(chart, _args, pluginOptions) {
          const current = hoverRef.current;
          if (!current || current.index >= chart.data.labels.length) return;
          const { ctx, chartArea } = chart;
          const x = chart.scales.x.getPixelForValue(current.index);
          ctx.save();
          ctx.strokeStyle = pluginOptions.cursorColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.restore();
        },
      },
    ],
    [],
  );

  // The legend sits under the x axis and wraps onto a second row on narrow
  // screens, so the plot area ends above however tall it is. Measure it before
  // the chart first draws so the plot does not jump.
  useLayoutEffect(() => {
    const element = legendRef.current;
    const measure = () => setLegendHeight(element.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Place the tooltip beside the hovered category and pointer, flipping it
  // back inside the plot area when it would overflow the right or bottom edge.
  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!element || !hover) return;
    const { area } = hover;
    const place = (coordinate, size, start, end) =>
      coordinate + TOOLTIP_OFFSET + size > end
        ? Math.max(coordinate - size - TOOLTIP_OFFSET, start)
        : Math.max(coordinate + TOOLTIP_OFFSET, start);
    const x = place(hover.x, element.offsetWidth, area.left, area.right);
    const y = place(hover.y, element.offsetHeight, area.top, area.bottom);
    element.style.transform = `translate(${x}px, ${y}px)`;
  }, [hover]);

  // Canvas text does not reflow when the web font arrives; redraw once it has.
  useEffect(() => {
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) chartRef.current?.update('none');
    });
    return () => {
      active = false;
    };
  }, []);

  const hoveredRow = hover && rows[hover.index];
  const legend = [
    { key: 'bar', label: barLabel, color: 'var(--ct-gold)' },
    ...(withDefense ? [{ key: 'line', label: 'Team Defense', color: 'var(--ct-slate)' }] : []),
  ];

  return (
    <>
      {legendHeight !== null && (
        <Chart
          ref={chartRef}
          type="bar"
          data={data}
          options={options}
          plugins={plugins}
          // The parent's container carries the chart's accessible name.
          aria-hidden="true"
        />
      )}
      <div
        ref={legendRef}
        style={{
          position: 'absolute',
          left: MARGIN.left,
          right: MARGIN.right,
          bottom: MARGIN.bottom,
        }}
      >
        <ul style={{ padding: 0, margin: 0, textAlign: 'center' }}>
          {legend.map((item) => (
            <li key={item.key} style={{ display: 'inline-block', marginRight: 10 }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 32 32"
                aria-hidden="true"
                style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}
              >
                {legendIcons[item.key]}
              </svg>
              <span style={{ color: item.color }}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div
        ref={tooltipRef}
        style={{
          visibility: hoveredRow ? 'visible' : 'hidden',
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          transition: 'transform 400ms',
        }}
      >
        {hoveredRow && renderTooltip(hoveredRow)}
      </div>
    </>
  );
};

export default MatchupComboChart;
