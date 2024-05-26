import React from 'react';
import { Bar } from 'react-chartjs-2';

function DataVisualization({ data }) {
  const chartData = {
    labels: data.map(item => item.GAME_DATE),
    datasets: [
      {
        label: 'Points',
        data: data.map(item => item.PTS),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
    ],
  };

  return (
    <div>
      <Bar data={chartData} />
    </div>
  );
}

export default DataVisualization;
