import React, { useRef, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'chart.js';
import MetricsDashboardRow from './MetricsDashboardRow';
import AppliedFilters from './AppliedFilters'

Chart.register(annotationPlugin);

const ChartComponent = ({ gameLogs, lineType, lineValue, selectedPlayer, averages, appliedFilters }) => {
  const chartRef = useRef(null);

  const getChartData = () => {
    if (!gameLogs || gameLogs.length === 0 || lineType === 'None') {
      return {
        labels: [],
        datasets: [{
          label: 'No data',
          data: [],
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
        }]
      };
    }
  
    const labels = gameLogs.map(log => log?.GAME_DATE || '');
    const data = gameLogs.map(log => log?.[lineType] || 0);
    
    // Use the average if lineValue is empty or not provided
    const defaultLineValue = lineValue && lineValue !== '' ? 
      parseFloat(lineValue) : 
      (averages[0] && averages[0][lineType] ? averages[0][lineType] : 0);
    
    const numericLineValue = defaultLineValue;
    const backgroundColors = !isNaN(numericLineValue) && numericLineValue > 0
      ? data.map(value => value > numericLineValue ? 'rgba(76, 175, 125, 0.78)' : 'rgba(194, 78, 78, 0.72)')
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
        }
      ]
    };
  };
  
  const getChartOptions = () => {
    // Use the average if lineValue is empty or not provided
    const defaultLineValue = lineValue && lineValue !== '' ? 
      parseFloat(lineValue) : 
      (averages[0] && averages[0][lineType] ? averages[0][lineType] : 0);
    
    const numericLineValue = defaultLineValue;
  
    return {
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
                content: lineValue && lineValue !== '' ?
                  `Line: ${lineValue}` :
                  `Avg: ${numericLineValue.toFixed(1)}`,
                enabled: true,
                position: 'start',
                backgroundColor: '#1e1a12',
                color: '#e8a33d',
                borderColor: 'rgba(232, 163, 61, 0.4)',
                borderWidth: 1,
                font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 11 }
              }
            }
          }
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
              return `${gameLogs[index].GAME_DATE}`;
            },
            label: (tooltipItem) => {
              const index = tooltipItem.dataIndex;
              const value = tooltipItem.raw;
              const matchup = gameLogs[index]?.MATCHUP;
              const opponent = matchup ? matchup.split(' ')[2] || 'N/A' : 'N/A'; 
              return [
                `OPP: ${opponent}`,
                `MIN: ${gameLogs[index].MIN}`,
                `${lineType}: ${value}`
              ];
            }
          }
        },
        datalabels: {
          display: false,
        }
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
                ? new Date(Number(label)).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
                : label;
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: {
            color: '#9b937f',
            font: { family: 'ui-monospace, SF Mono, Menlo, monospace', size: 10 }
          },
          title: {
            display: true,
            text: lineType,
            color: '#9b937f',
          }
        }
      }
    };
  };
  

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update();
    }
  }, [lineType, lineValue, gameLogs, averages]);

  return (
    <>
      {gameLogs.length > 0 && lineType !== 'None' && (
        <>          
          <MetricsDashboardRow
            rawValue={averages[0]?.[lineType] || 0}
            per36Value={averages[0]?.[lineType] ? (averages[0][lineType] / averages[0].MIN) * 36 : 0}
            seasonRawValue={averages[1]?.[lineType] || 0}
            seasonPer36Value={averages[1]?.[lineType] ? (averages[1][lineType] / averages[1].MIN) * 36 : 0}
            ratio={`${gameLogs.filter(log => {
              const defaultLineValue = lineValue && lineValue !== '' ? 
                parseFloat(lineValue) : 
                (averages[0] && averages[0][lineType] ? averages[0][lineType] : 0);
              return log[lineType] > defaultLineValue;
            }).length}/${gameLogs.length}`}
            last5ratio = {`${gameLogs.slice(-5).filter(log => {
              const defaultLineValue = lineValue && lineValue !== '' ? 
                parseFloat(lineValue) : 
                (averages[0] && averages[0][lineType] ? averages[0][lineType] : 0);
              return log[lineType] > defaultLineValue;
            }).length}/${Math.min(5, gameLogs.length)}`}
            last10ratio = {`${gameLogs.slice(-10).filter(log => {
              const defaultLineValue = lineValue && lineValue !== '' ? 
                parseFloat(lineValue) : 
                (averages[0] && averages[0][lineType] ? averages[0][lineType] : 0);
              return log[lineType] > defaultLineValue;
            }).length}/${Math.min(10, gameLogs.length)}`}
          />
          <div className="mt-3 mb-3">
            <AppliedFilters filters={appliedFilters} />
          </div>
          <div className="chart-container">
            <Bar 
              ref={chartRef}
              data={getChartData()} 
              options={getChartOptions()} 
            />
          </div>
        </>
      )}
    </>
  );
};

export default ChartComponent;