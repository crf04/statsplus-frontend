import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import './chartSetup';
import MetricsDashboardRow from './MetricsDashboardRow';
import AppliedFilters from './AppliedFilters';
import { numericOrZero, toFiniteNumber } from './numberUtils';

const getPer36Value = (average, stat) => {
  const value = toFiniteNumber(average?.[stat]);
  const minutes = toFiniteNumber(average?.MIN);
  return value !== null && minutes !== null && minutes !== 0 ? (value / minutes) * 36 : 0;
};

const ChartComponent = ({ gameLogs, lineType, lineValue, averages, appliedFilters }) => {
  const explicitLineValue = toFiniteNumber(lineValue);
  const numericLineValue =
    explicitLineValue !== null ? explicitLineValue : toFiniteNumber(averages?.[0]?.[lineType], 0);

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

    return {
      labels,
      datasets: [
        {
          label: lineType,
          data,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          borderRadius: 3,
          borderSkipped: 'bottom',
        },
      ],
    };
  }, [gameLogs, lineType, numericLineValue]);

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
              borderColor: '#e8a33d',
              borderWidth: 1.5,
              borderDash: [6, 4],
              label: {
                content:
                  explicitLineValue !== null
                    ? `Line: ${lineValue}`
                    : `Avg: ${numericLineValue.toFixed(1)}`,
                enabled: true,
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
    [gameLogs, lineType, lineValue, explicitLineValue, numericLineValue],
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
