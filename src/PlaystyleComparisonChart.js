import MatchupComboChart from './MatchupComboChart';
import { formatMatchupRating, matchupRatingColor, matchupRatingPercent } from './matchupRating';

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
        const teamDefenseRank = teamData ? parseInt(teamData[`${playstyle}_RANK`]) || 0 : null;

        return {
          playstyle,
          playerFrequency,
          teamDefense,
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

  const matchupRating = teamData
    ? matchupRatingPercent(
        chartData.map((row) => ({ frequency: row.playerFrequency, teamDefense: row.teamDefense })),
      )
    : null;

  const renderTooltip = (data) => (
    <div
      className="custom-tooltip"
      style={{
        backgroundColor: 'var(--ct-surface-2)',
        padding: '10px 12px',
        border: '1px solid var(--ct-line-strong)',
        borderRadius: '6px',
        color: 'var(--ct-text)',
      }}
    >
      <p className="label">{`${data.playstyle}`}</p>
      <p
        style={{ color: 'var(--ct-gold)' }}
      >{`Player Frequency: ${data.playerFrequency.toFixed(2)}%`}</p>
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
      {matchupRating !== null && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'var(--ct-surface-2)',
            color: 'var(--ct-text)',
            padding: '5px',
            border: '1px solid var(--ct-line-strong)',
            borderRadius: '5px',
          }}
        >
          <strong>Total Matchup Rating: </strong>
          <span style={{ color: matchupRatingColor(matchupRating) }}>
            {formatMatchupRating(matchupRating)}
          </span>
        </div>
      )}
    </div>
  );
};

export default PlaystyleComparisonChart;
