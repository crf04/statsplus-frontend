import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';

const TwoThreeAssistChart = ({ assistData, teamData }) => {
  if (!assistData || Object.keys(assistData).length === 0) {
    return <p>No assist data available for chart</p>;
  }

  const getColor = (value, inverse = true) => {
    const hue = inverse
      ? ((value - 0.8) / (1.2 - 0.8)) * 120
      : (1 - (value - 0.8) / (1.2 - 0.8)) * 120;
    return `hsl(${hue}, 100%, 40%)`;
  };

  const processData = () => {
    const assistTypes = ['ThreePtAssists', 'TwoPtAssists'];
    return assistTypes.map(type => {
      const frequency = parseFloat(assistData[type]) || 0;
      const frequencyPlus = -(1 - parseFloat(assistData[`${type}+`])) * 100 || 0;
      const teamDefense = teamData ? (parseFloat(teamData[type]) || 1) : 1;
      const matchupRating = frequency * teamDefense;
      const teamDefenseRank = teamData ? (parseInt(teamData[`${type}_RANK`]) || 0) : null;

      return {
        type: type.replace('Assists', ''),
        frequency,
        frequencyPlus,
        teamDefense,
        matchupRating,
        teamDefenseRank
      };
    }).filter(item => item.frequency > 0)
      .sort((a, b) => b.frequency - a.frequency);
  };

  const chartData = processData();

  if (chartData.length === 0) {
    return <p>No valid assist data available for chart</p>;
  }

  const totalMatchupRating = teamData
    ? chartData.reduce((sum, item) => sum + (item.matchupRating || 0), 0)
    : null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc' }}>
          <p className="label">{`${label} Assists`}</p>
          <p style={{ color: '#8884d8' }}>{`Frequency: ${data.frequency.toFixed(2)}%`}</p>
          <p style={{ color: '#82ca9d' }}>{`Frequency+: ${data.frequencyPlus.toFixed(2)}%`}</p>
          {teamData && (
            <p style={{ color: getColor(data.teamDefense) }}>
              {`Team Defense: ${((data.teamDefense * 100) - 100).toFixed(2)}% (Rank: ${data.teamDefenseRank})`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: '400px', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="type" />
          <YAxis yAxisId="left">
            <Label angle={-90} value="Frequency (%)" position="insideLeft" style={{ textAnchor: 'middle' }} />
          </YAxis>
          {teamData && (
            <YAxis yAxisId="right" orientation="right" domain={[0.5, 1.5]}>
              <Label angle={90} value="Team Defense Multiplier" position="insideRight" style={{ textAnchor: 'middle' }} />
            </YAxis>
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar yAxisId="left" dataKey="frequency" name="Assist Frequency (%)" fill="#8884d8" />
          {teamData && (
            <Line yAxisId="right" type="monotone" dataKey="teamDefense" name="Team Defense" stroke="#ff7300" />
          )}
        </ComposedChart>
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

export default TwoThreeAssistChart;