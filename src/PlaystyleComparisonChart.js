import MatchupComboChart from './MatchupComboChart';

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
    const playstyles = Object.keys(playerData).filter((key) => key.includes('%'));
    return playstyles
      .map((key) => {
        const playstyle = key.replace('%', '');
        const playerFrequency = parseFloat(playerData[key]) || 0;
        const teamDefense = teamData ? parseFloat(teamData[playstyle]) || 1 : 1;
        const matchupRating = playerFrequency * teamDefense;
        const teamDefenseRank = teamData ? parseInt(teamData[`${playstyle}_RANK`]) || 0 : null;

        return {
          playstyle,
          playerFrequency,
          teamDefense,
          matchupRating,
          teamDefenseRank,
        };
      })
      .filter((item) => item.playerFrequency > 0)
      .sort((a, b) => b.playerFrequency - a.playerFrequency);
  };

  const chartData = processData();

  if (chartData.length === 0) {
    return <p>No valid data available for chart</p>;
  }

  const totalMatchupRating = teamData
    ? chartData.reduce((sum, item) => sum + (item.matchupRating || 0), 0)
    : null;

  const renderTooltip = (data) => (
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
      <p className="label">{`${data.playstyle}`}</p>
      <p style={{ color: '#e8a33d' }}>{`Player Frequency: ${data.playerFrequency.toFixed(2)}%`}</p>
      {teamData && (
        <>
          <p style={{ color: getColor(data.teamDefense) }}>
            {`Team Defense: ${(data.teamDefense * 100 - 100).toFixed(2)}% (Rank: ${data.teamDefenseRank})`}
          </p>
        </>
      )}
    </div>
  );

  return (
    <div
      style={{ width: '100%', height: '500px', position: 'relative' }}
      role="img"
      aria-label={`${teamData ? 'Playtype frequency and team defense' : 'Playtype frequency'} chart`}
    >
      <MatchupComboChart
        rows={chartData.map((row) => ({
          ...row,
          label: row.playstyle,
          frequency: row.playerFrequency,
        }))}
        barLabel="Player Frequency (%)"
        yTitle="Player Frequency (%)"
        withDefense={Boolean(teamData)}
        rotateLabels
        renderTooltip={renderTooltip}
      />
      {teamData && totalMatchupRating && (
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
            {totalMatchupRating.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default PlaystyleComparisonChart;
