import React from 'react';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';

const PlaystyleComparisonChart = ({ playerData, teamData }) => {
  if (!playerData) {
    return <p>No data available for chart</p>;
  }

  const getColor = (value, inverse = true) => {
    const hue = inverse
      ? ((value - 0.8) / (1.2 - 0.8)) * 120
      : (1 - (value - 0.8) / (1.2 - 0.8)) * 120;
    return `hsl(${hue}, 100%, 40%)`;
  };

  const processData = () => {
    const playstyles = Object.keys(playerData).filter(key => key.includes('%'));
    return playstyles.map(key => {
      const playstyle = key.replace('%', '');
      const playerFrequency = parseFloat(playerData[key]) || 0;
      const teamDefense = teamData ? (parseFloat(teamData[playstyle]) || 1) : 1;
      const matchupRating = playerFrequency * teamDefense;
      const teamDefenseRank = teamData ? (parseInt(teamData[`${playstyle}_RANK`]) || 0) : null;

      return {
        playstyle,
        playerFrequency,
        teamDefense,
        matchupRating,
        teamDefenseRank
      };
    })
    .filter(item => item.playerFrequency > 0)
    .sort((a, b) => b.playerFrequency - a.playerFrequency);
  };

  const chartData = processData();

  if (chartData.length === 0) {
    return <p>No valid data available for chart</p>;
  }

  const totalMatchupRating = teamData
    ? chartData.reduce((sum, item) => sum + (item.matchupRating || 0), 0)
    : null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc' }}>
          <p className="label">{`${data.playstyle}`}</p>
          <p style={{ color: '#8884d8' }}>{`Player Frequency: ${data.playerFrequency.toFixed(2)}%`}</p>
          {teamData && (
            <>
              <p style={{ color: getColor(data.teamDefense) }}>
                {`Team Defense: ${((data.teamDefense * 100) - 100).toFixed(2)}% (Rank: ${data.teamDefenseRank})`}
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const ChartComponent = teamData ? ComposedChart : BarChart;
    return (
      <ChartComponent
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 60,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="playstyle" angle={-45} textAnchor="end" interval={0} height={80} />
        <YAxis yAxisId="left" orientation="left">
          <Label angle={-90} value="Player Frequency (%)" position="insideLeft" style={{ textAnchor: 'middle' }} />
        </YAxis>
        {teamData && (
          <YAxis yAxisId="right" orientation="right" domain={[0.5, 1.5]}>
            <Label angle={90} value="Team Defense Multiplier" position="insideRight" style={{ textAnchor: 'middle' }} />
          </YAxis>
        )}
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar yAxisId="left" dataKey="playerFrequency" name="Player Frequency (%)" fill="#8884d8" />
        {teamData && (
          <Line yAxisId="right" type="monotone" dataKey="teamDefense" name="Team Defense" stroke="#82ca9d" />
        )}
      </ChartComponent>
    );
  };

  return (
    <div style={{ width: '100%', height: '500px', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
      {teamData && totalMatchupRating && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(255, 255, 255, 0.8)',
          padding: '5px',
          border: '1px solid #ccc',
          borderRadius: '5px'
        }}>
          <strong>Total Matchup Rating: </strong>
          <span style={{ color: getColor((200 - totalMatchupRating) / 100, false) }}>
            {totalMatchupRating.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default PlaystyleComparisonChart;
