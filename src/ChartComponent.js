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
    const numericLineValue = parseFloat(lineValue);
    const backgroundColors = !isNaN(numericLineValue) 
      ? data.map(value => value > numericLineValue ? 'rgba(75, 192, 75, 0.6)' : 'rgba(192, 75, 75, 0.6)')
      : 'rgba(75, 192, 192, 0.6)';
  
    return {
      labels,
      datasets: [
        {
          label: lineType,
          data,
          backgroundColor: backgroundColors,
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }
      ]
    };
  };
  
  const getChartOptions = () => {
    const numericLineValue = parseFloat(lineValue);
  
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
              borderColor: 'rgb(255, 99, 132)',
              borderWidth: 2,
              label: {
                content: `Line: ${lineValue}`,
                enabled: true,
                position: 'start'
              }
            }
          }
        },
        tooltip: {
          displayColors: false, // This removes the colored box
          callbacks: {
            title: (tooltipItems) => {
              const index = tooltipItems[0].dataIndex;
              return `${gameLogs[index].GAME_DATE}`;
            },
            label: (tooltipItem) => {
              const index = tooltipItem.dataIndex;
              const value = tooltipItem.raw;
              const opponent = gameLogs[index].MATCHUP.split(' ')[2]; 
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
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: lineType,
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
            ratio={`${gameLogs.filter(log => log[lineType] > parseFloat(lineValue)).length}/${gameLogs.length}`}
            last5ratio = {`${gameLogs.slice(1).slice(-5).filter(log => log[lineType] > parseFloat(lineValue)).length}/${gameLogs.slice(1).slice(-5).length}`}
            last10ratio = {`${gameLogs.slice(1).slice(-10).filter(log => log[lineType] > parseFloat(lineValue)).length}/${gameLogs.slice(1).slice(-10).length}`}
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