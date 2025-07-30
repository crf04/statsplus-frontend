import React from 'react';
import { Line, Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Mock performance trend data
const mockPerformanceTrends = {
  labels: ['5 games ago', '4 games ago', '3 games ago', '2 games ago', 'Last game'],
  lakers: [112, 118, 109, 125, 115],
  warriors: [119, 106, 123, 111, 127]
};

// Mock radar chart data for team strengths
const mockRadarData = {
  lakers: {
    offense: 85,
    defense: 78,
    rebounding: 88,
    threePoint: 72,
    freeThrow: 80,
    pace: 75
  },
  warriors: {
    offense: 92,
    defense: 85,
    rebounding: 80,
    threePoint: 95,
    freeThrow: 88,
    pace: 82
  }
};

const PerformanceTrendsChart = ({ teamA, teamB }) => {
  const data = {
    labels: mockPerformanceTrends.labels,
    datasets: [
      {
        label: teamA.name,
        data: mockPerformanceTrends.lakers,
        borderColor: teamA.color || '#552583',
        backgroundColor: `${teamA.color || '#552583'}20`,
        tension: 0.4,
        fill: false,
        pointBackgroundColor: teamA.color || '#552583',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
      {
        label: teamB.name,
        data: mockPerformanceTrends.warriors,
        borderColor: teamB.color || '#1D428A',
        backgroundColor: `${teamB.color || '#1D428A'}20`,
        tension: 0.4,
        fill: false,
        pointBackgroundColor: teamB.color || '#1D428A',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#ffffff',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 12,
            weight: '600'
          }
        }
      },
      title: {
        display: true,
        text: 'Recent Performance Trends (Points Scored)',
        color: '#ffffff',
        font: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
          size: 16,
          weight: '700'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#cccccc',
        borderColor: '#f59e0b',
        borderWidth: 1,
        cornerRadius: 8,
        titleFont: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
          weight: '600'
        },
        bodyFont: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#cccccc',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 11
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#cccccc',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 11
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    }
  };

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Line data={data} options={options} />
    </div>
  );
};

const TeamStrengthsRadar = ({ teamA, teamB }) => {
  const data = {
    labels: ['Offense', 'Defense', 'Rebounding', '3-Point', 'Free Throw', 'Pace'],
    datasets: [
      {
        label: teamA.name,
        data: [
          mockRadarData.lakers.offense,
          mockRadarData.lakers.defense,
          mockRadarData.lakers.rebounding,
          mockRadarData.lakers.threePoint,
          mockRadarData.lakers.freeThrow,
          mockRadarData.lakers.pace
        ],
        backgroundColor: `${teamA.color || '#552583'}30`,
        borderColor: teamA.color || '#552583',
        borderWidth: 2,
        pointBackgroundColor: teamA.color || '#552583',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4
      },
      {
        label: teamB.name,
        data: [
          mockRadarData.warriors.offense,
          mockRadarData.warriors.defense,
          mockRadarData.warriors.rebounding,
          mockRadarData.warriors.threePoint,
          mockRadarData.warriors.freeThrow,
          mockRadarData.warriors.pace
        ],
        backgroundColor: `${teamB.color || '#1D428A'}30`,
        borderColor: teamB.color || '#1D428A',
        borderWidth: 2,
        pointBackgroundColor: teamB.color || '#1D428A',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#ffffff',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 12,
            weight: '600'
          }
        }
      },
      title: {
        display: true,
        text: 'Team Strengths Comparison',
        color: '#ffffff',
        font: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
          size: 16,
          weight: '700'
        }
      }
    },
    scales: {
      r: {
        angleLines: {
          color: 'rgba(255, 255, 255, 0.2)'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.2)'
        },
        pointLabels: {
          color: '#cccccc',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 11,
            weight: '500'
          }
        },
        ticks: {
          color: '#888888',
          backdropColor: 'transparent',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 10
          }
        },
        min: 0,
        max: 100
      }
    }
  };

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Radar data={data} options={options} />
    </div>
  );
};

const StatComparisonBar = ({ teamA, teamB, stats }) => {
  const labels = stats.map(stat => stat.label);
  const teamAData = stats.map(stat => teamA.stats[stat.key]);
  const teamBData = stats.map(stat => teamB.stats[stat.key]);

  const data = {
    labels: labels,
    datasets: [
      {
        label: teamA.name,
        data: teamAData,
        backgroundColor: `${teamA.color || '#552583'}80`,
        borderColor: teamA.color || '#552583',
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: teamB.name,
        data: teamBData,
        backgroundColor: `${teamB.color || '#1D428A'}80`,
        borderColor: teamB.color || '#1D428A',
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#ffffff',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 12,
            weight: '600'
          }
        }
      },
      title: {
        display: true,
        text: 'Key Statistics Comparison',
        color: '#ffffff',
        font: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
          size: 16,
          weight: '700'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#cccccc',
        borderColor: '#f59e0b',
        borderWidth: 1,
        cornerRadius: 8,
        titleFont: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
          weight: '600'
        },
        bodyFont: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#cccccc',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 10
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#cccccc',
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", system-ui, sans-serif',
            size: 11
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    }
  };

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Bar data={data} options={options} />
    </div>
  );
};

const MatchupChart = ({ type, teamA, teamB, stats = null }) => {
  const chartStyle = {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    border: '1px solid #333333',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    transition: 'all 0.3s ease'
  };

  switch (type) {
    case 'performance-trends':
      return (
        <div style={chartStyle}>
          <PerformanceTrendsChart teamA={teamA} teamB={teamB} />
        </div>
      );
    case 'team-strengths':
      return (
        <div style={chartStyle}>
          <TeamStrengthsRadar teamA={teamA} teamB={teamB} />
        </div>
      );
    case 'stat-comparison':
      return (
        <div style={chartStyle}>
          <StatComparisonBar teamA={teamA} teamB={teamB} stats={stats} />
        </div>
      );
    default:
      return null;
  }
};

export default MatchupChart;