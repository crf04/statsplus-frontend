import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import './chartSetup';
import MetricsDashboardRow from './MetricsDashboardRow';
import AppliedFilters from './AppliedFilters';
import { formatNumber, numericOrZero, toFiniteNumber } from './numberUtils';
import { postedLineFor } from './gameLogsApi';
import { bookName } from './matchups/displayConfig';
import { shortSlateDay } from './home/homeFormat';

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

// Rebound and assist charts show the player-tracking opportunity behind each
// bar: the chances a rebound could have come from, the passes that led to a shot.
const TRACKING = {
  REB: {
    chances: 'REB_CHANCES',
    conversion: 'REB_CONV_PCT',
    noun: 'chances',
    rowLabel: 'Chances',
    ghostLabel: 'Rebound chances',
  },
  AST: {
    chances: 'POTENTIAL_AST',
    conversion: 'AST_CONV_PCT',
    noun: 'potential',
    rowLabel: 'Potential',
    ghostLabel: 'Potential assists',
  },
};

const percentText = (ratio) => `${Math.round(ratio * 100)}%`;

// The average chances, one decimal; null when the backend sends none.
const trackingAverageText = (average, tracking) => {
  const chances = toFiniteNumber(average?.[tracking.chances]);
  return chances === null ? null : formatNumber(chances, 1);
};

const TrackingAverages = ({ tracking, averages }) => {
  const filtered = trackingAverageText(averages?.[0], tracking);
  if (filtered === null) return null;
  const season = trackingAverageText(averages?.[1], tracking);
  return (
    <div className="tracking-averages mt-2 flex items-baseline gap-2 font-mono text-sm">
      <span className="text-[#9b937f] uppercase text-xs tracking-wider">{tracking.rowLabel}</span>{' '}
      <span className="text-[#e8a33d] font-bold">{filtered}</span>
      {season !== null && <span className="text-[#9b937f]"> · season {season}</span>}
    </div>
  );
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
  const tracking = TRACKING[lineType] ?? null;
  const posted = lineSource ? postedLineFor(postedLine, lineType, lineSource) : null;
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
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          },
        ],
      };
    }

    const labels = gameLogs.map((log) => log?.GAME_DATE || '');
    const data = gameLogs.map((log) => numericOrZero(log?.[lineType]));

    const backgroundColors =
      !isNaN(numericLineValue) && numericLineValue > 0
        ? data.map((value) =>
            value > numericLineValue ? 'rgba(76, 175, 125, 0.78)' : 'rgba(194, 78, 78, 0.72)',
          )
        : 'rgba(232, 163, 61, 0.72)';

    const bars = {
      label: lineType,
      data,
      backgroundColor: backgroundColors,
      borderWidth: 0,
      borderRadius: barCornerRadius,
      borderSkipped: 'bottom',
    };
    if (!tracking) return { labels, datasets: [bars] };

    // Drawn first and behind (a higher order is drawn earlier). An untracked
    // game is null, which Chart.js leaves empty; it is not a zero-height bar.
    return {
      labels,
      datasets: [
        { ...bars, grouped: false, order: 0 },
        {
          label: tracking.ghostLabel,
          data: gameLogs.map((log) => toFiniteNumber(log?.[tracking.chances])),
          backgroundColor: 'rgba(232, 163, 61, 0.16)',
          borderWidth: 0,
          borderRadius: barCornerRadius,
          borderSkipped: 'bottom',
          grouped: false,
          order: 1,
        },
      ],
    };
  }, [gameLogs, lineType, numericLineValue, tracking]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: Boolean(tracking),
          // Both bars are named; hiding one would only misread the other.
          onClick: null,
          labels: {
            color: '#9b937f',
            boxWidth: 12,
            font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
          },
        },
        annotation: {
          annotations: {
            line1: {
              type: 'line',
              yMin: numericLineValue || 0,
              yMax: numericLineValue || 0,
              borderColor: '#e8a33d',
              borderWidth: 1.5,
              borderDash: [6, 4],
              label: {
                content: lineLabel.split('\n'),
                // chartjs-plugin-annotation 3 draws a label only with `display`.
                display: true,
                position: 'start',
                backgroundColor: '#1e1a12',
                color: '#e8a33d',
                borderColor: 'rgba(232, 163, 61, 0.4)',
                borderWidth: 1,
                font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
              },
            },
          },
        },
        tooltip: {
          displayColors: false, // This removes the colored box
          backgroundColor: '#1e1a12',
          titleColor: '#efe9dc',
          bodyColor: '#9b937f',
          borderColor: 'rgba(255, 255, 255, 0.16)',
          borderWidth: 1,
          cornerRadius: 6,
          titleFont: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
          bodyFont: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 },
          // One entry per game: the ghost bar shares the main bar's tooltip.
          filter: (item) => item.datasetIndex === 0,
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
              const lines = [
                `OPP: ${opponent}`,
                `MIN: ${numericOrZero(gameLogs[index]?.MIN)}`,
                `${lineType}: ${numericOrZero(value)}`,
              ];
              if (tracking) {
                const chances = toFiniteNumber(gameLogs[index]?.[tracking.chances]);
                const made = numericOrZero(value);
                lines[2] =
                  chances === null
                    ? `${lineType} ${made} · not tracked`
                    : `${lineType} ${made} · ${chances} ${tracking.noun}${
                        chances > 0 ? ` · ${percentText(made / chances)}` : ''
                      }`;
              }
              return lines;
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
            color: '#9b937f',
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
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: {
            color: '#9b937f',
            font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 10 },
          },
          title: {
            display: true,
            text: lineType,
            color: '#9b937f',
          },
        },
      },
    }),
    [gameLogs, lineType, lineLabel, numericLineValue, tracking],
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
          {tracking && <TrackingAverages tracking={tracking} averages={averages} />}
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
