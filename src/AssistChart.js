import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { formatNumber, numericOrZero, toFiniteNumber } from './numberUtils';

const AssistChart = ({
  assistData,
  teamData,
  assistTypes = [],
  labelFormatter = (type) => type,
}) => {
  if (!assistData || typeof assistData !== 'object' || Object.keys(assistData).length === 0) {
    return <p>No assist data available for chart</p>;
  }

  const getColor = (value, inverse = true) => {
    const hue = inverse
      ? ((value - 0.8) / (1.2 - 0.8)) * 120
      : (1 - (value - 0.8) / (1.2 - 0.8)) * 120;
    return `hsl(${hue}, 100%, 40%)`;
  };

  const chartData = assistTypes
    .map((type) => {
      const frequency = numericOrZero(assistData[type]);
      const plus = toFiniteNumber(assistData[`${type}+`]);
      const frequencyPlus = plus === null ? 0 : -(1 - plus) * 100;
      const teamDefense = teamData ? toFiniteNumber(teamData[type], 1) : 1;
      const teamDefenseRank = teamData ? toFiniteNumber(teamData[`${type}_RANK`]) : null;

      return {
        type: labelFormatter(type),
        frequency,
        frequencyPlus,
        teamDefense,
        matchupRating: frequency * teamDefense,
        teamDefenseRank,
      };
    })
    .filter((item) => item.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency);

  if (chartData.length === 0) {
    return <p>No valid assist data available for chart</p>;
  }

  const totalMatchupRating = teamData
    ? chartData.reduce((sum, item) => sum + item.matchupRating, 0)
    : null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    return (
      <div
        className="custom-tooltip"
        style={{
          backgroundColor: '#1e1a12',
          padding: '10px 12px',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: '6px',
          color: '#efe9dc',
        }}
      >
        <p className="label">{`${label} Assists`}</p>
        <p style={{ color: '#e8a33d' }}>{`Frequency: ${formatNumber(data.frequency, 2)}%`}</p>
        <p style={{ color: '#7a8699' }}>{`Frequency+: ${formatNumber(data.frequencyPlus, 2)}%`}</p>
        {teamData && (
          <p style={{ color: getColor(data.teamDefense) }}>
            {`Team Defense: ${formatNumber(data.teamDefense * 100 - 100, 2)}% (Rank: ${data.teamDefenseRank ?? 'N/A'})`}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      style={{ width: '100%', height: '400px', position: 'relative' }}
      role="img"
      aria-label={`${teamData ? 'Assist frequency and team defense' : 'Assist frequency'} chart`}
    >
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            tick={{ fill: '#9b937f', fontSize: 11 }}
            dataKey="type"
            angle={assistTypes.length > 2 ? -45 : 0}
            textAnchor={assistTypes.length > 2 ? 'end' : 'middle'}
            interval={0}
            height={assistTypes.length > 2 ? 80 : 30}
          />
          <YAxis tick={{ fill: '#9b937f', fontSize: 11 }} yAxisId="left">
            <Label
              angle={-90}
              value="Frequency (%)"
              position="insideLeft"
              style={{ textAnchor: 'middle' }}
            />
          </YAxis>
          {teamData && (
            <YAxis
              tick={{ fill: '#9b937f', fontSize: 11 }}
              yAxisId="right"
              orientation="right"
              domain={[0.5, 1.5]}
            >
              <Label
                angle={90}
                value="Team Defense Multiplier"
                position="insideRight"
                style={{ textAnchor: 'middle' }}
              />
            </YAxis>
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="frequency"
            name="Assist Frequency (%)"
            fill="#e8a33d"
            radius={[3, 3, 0, 0]}
          />
          {teamData && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="teamDefense"
              name="Team Defense"
              stroke="#7a8699"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {teamData && totalMatchupRating !== null && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: '#1e1a12',
            color: '#efe9dc',
            padding: '5px',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: '5px',
          }}
        >
          <strong>Total Matchup Rating: </strong>
          <span style={{ color: getColor((200 - totalMatchupRating) / 100, false) }}>
            {formatNumber(totalMatchupRating, 2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default AssistChart;
