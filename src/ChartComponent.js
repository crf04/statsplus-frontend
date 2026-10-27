import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import './chartSetup';
import MetricsDashboardRow from './MetricsDashboardRow';
import AppliedFilters from './AppliedFilters';
import { formatNumber, numericOrZero, toFiniteNumber } from './numberUtils';
import { postedLineFor } from './gameLogsApi';
import { bookName } from './matchups/displayConfig';
import { shortSlateDay } from './home/homeFormat';
import { useThemeColors } from './theme/useThemeColors';

// Canvas paint, resolved from the theme tokens.
const CHART_COLORS = {
  over: '--ct-hit-fill-78',
  under: '--ct-miss-fill-72',
  bar: '--ct-gold-fill-72',
  empty: '--ct-scrim-10',
  line: '--ct-gold',
  labelGround: '--ct-surface-2',
  label: '--ct-gold',
  labelEdge: '--ct-gold-fg-40',
  tooltipGround: '--ct-surface-2',
  tooltipTitle: '--ct-text',
  tooltipBody: '--ct-dim',
  tooltipEdge: '--ct-line-strong',
  tick: '--ct-dim',
  grid: '--ct-overlay-fg-6',
};

const getPer36Value = (average, stat) => {
  const value = toFiniteNumber(average?.[stat]);
  const minutes = toFiniteNumber(average?.MIN);
  return value !== null && minutes !== null && minutes !== 0 ? (value / minutes) * 36 : 0;
};

// Whose line it is, then which game, on two lines so a phone-width chart fits
// it: "PrizePicks 26.5" / "GSW vs LAL · Wed, Oct 21".
const postedLineLabel = ({ key, line, matchup, gameDate }) =>
  [
    `${bookName(key)} ${formatNumber(line, 1)}`,
    [matchup, gameDate && shortSlateDay(gameDate)].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n');

// A quarter of the bar's width, at most 10px, so narrow phone bars do not
// turn into pills. Chart.js draws bars at 0.9 × 0.8 of each category slot.
const barCornerRadius = ({ chart, dataset }) => {
  const area = chart.chartArea;
  if (!area || !dataset?.data?.length) return 10;
  const barWidth = (area.width / dataset.data.length) * 0.72;
  return Math.min(10, Math.round(barWidth / 4));
};

const ChartComponent = ({
  gameLogs,
  lineType,
  lineValue,
  averages,
  postedLine,
  lineSource,
  appliedFilters,
}) => {
  const explicitLineValue = toFiniteNumber(lineValue);
  const numericLineValue =
    explicitLineValue !== null ? explicitLineValue : toFiniteNumber(averages?.[1]?.[lineType], 0);
  const posted = lineSource ? postedLineFor(postedLine, lineType, lineSource) : null;
  const colors = useThemeColors(CHART_COLORS);
  const lineLabel = posted
    ? postedLineLabel(posted)
    : explicitLineValue !== null
      ? `Line: ${lineValue}`
      : `Season avg: ${numericLineValue.toFixed(1)}`;

  // react-chartjs-2 redraws whenever `data` or `options` is a new object, so
  // both are rebuilt only when an input they read changes.
  const chartData = useMemo(() => {
    if (!Array.isArray(gameLogs) || gameLogs.length === 0 || lineType === 'None') {
      return {
        labels: [],
        datasets: [
          {
            label: 'No data',
            data: [],
            backgroundColor: colors.empty,
          },
        ],
      };
    }

    const labels = gameLogs.map((log) => log?.GAME_DATE || '');
    const data = gameLogs.map((log) => numericOrZero(log?.[lineType]));

    const backgroundColors =
      !isNaN(numericLineValue) && numericLineValue > 0
        ? data.map((value) => (value > numericLineValue ? colors.over : colors.under))
        : colors.bar;

    return {
      labels,
      datasets: [
        {
          label: lineType,
          data,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          borderRadius: barCornerRadius,
          borderSkipped: 'bottom',
        },
      ],
    };
  }, [gameLogs, lineType, numericLineValue, colors]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
        annotation: {
          annotations: {
            line1: {
              type: 'line',
              yMin: numericLineValue || 0,
              yMax: numericLineValue || 0,
              borderColor: colors.line,
              borderWidth: 1.5,
              borderDash: [6, 4],
              label: {
                content: lineLabel.split('\n'),
                // chartjs-plugin-annotation 3 draws a label only with `display`.
                display: true,
                position: 'start',
                backgroundColor: colors.labelGround,
                color: colors.label,
                borderColor: colors.labelEdge,
                borderWidth: 1,
                font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
              },
            },
          },
        },
        tooltip: {
          displayColors: false, // This removes the colored box
          backgroundColor: colors.tooltipGround,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipEdge,
          borderWidth: 1,
          cornerRadius: 6,
          titleFont: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
          bodyFont: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
          callbacks: {
            title: (tooltipItems) => {
              const index = tooltipItems[0].dataIndex;
              return `${gameLogs[index]?.GAME_DATE || 'N/A'}`;
            },
            label: (tooltipItem) => {
              const index = tooltipItem.dataIndex;
              const value = tooltipItem.raw;
              const matchup = gameLogs[index]?.MATCHUP;
              const opponent = typeof matchup === 'string' ? matchup.split(' ')[2] || 'N/A' : 'N/A';
              return [
                `OPP: ${opponent}`,
                `MIN: ${numericOrZero(gameLogs[index]?.MIN)}`,
                `${lineType}: ${numericOrZero(value)}`,
              ];
            },
          },
        },
        datalabels: {
          display: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: colors.tick,
            font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 10 },
            maxRotation: 60,
            callback(value) {
              const label = this.getLabelForValue(value);
              return typeof label === 'number' || /^\d{12,}$/.test(String(label))
                ? new Date(Number(label)).toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                  })
                : label;
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          ticks: {
            color: colors.tick,
            font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 10 },
          },
          title: {
            display: true,
            text: lineType,
            color: colors.tick,
          },
        },
      },
    }),
    [gameLogs, lineType, lineLabel, numericLineValue, colors],
  );

  const overLineCount = (logs) =>
    logs.filter((log) => numericOrZero(log[lineType]) > numericLineValue).length;

  return (
    <>
      {Array.isArray(gameLogs) && gameLogs.length > 0 && lineType !== 'None' && (
        <>
          <MetricsDashboardRow
            rawValue={numericOrZero(averages?.[0]?.[lineType])}
            per36Value={getPer36Value(averages?.[0], lineType)}
            seasonRawValue={numericOrZero(averages?.[1]?.[lineType])}
            seasonPer36Value={getPer36Value(averages?.[1], lineType)}
            ratio={`${overLineCount(gameLogs)}/${gameLogs.length}`}
            last5ratio={`${overLineCount(gameLogs.slice(-5))}/${Math.min(5, gameLogs.length)}`}
            last10ratio={`${overLineCount(gameLogs.slice(-10))}/${Math.min(10, gameLogs.length)}`}
          />
          <div className="mt-3 mb-3">
            <AppliedFilters filters={appliedFilters} />
          </div>
          <div className="chart-container">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </>
      )}
    </>
  );
};

export default ChartComponent;
