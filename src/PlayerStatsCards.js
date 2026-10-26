import { useState } from 'react';
import './PlayerStatsCards.css';

// NBA's public headshot for a person id; the initials stand in without one.
const Headshot = ({ playerId, selectedPlayer }) => {
  const [failed, setFailed] = useState(false);

  if (playerId && !failed) {
    return (
      <img
        className="player-headshot"
        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`}
        alt={selectedPlayer}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="player-initials">
      {selectedPlayer
        ? selectedPlayer
            .split(' ')
            .map((n) => n[0])
            .join('')
        : 'PL'}
    </span>
  );
};

const statCards = [
  { key: 'PTS', label: 'PTS' },
  { key: 'REB', label: 'REB' },
  { key: 'AST', label: 'AST' },
  { key: 'STKS', label: 'STK' },
  { key: 'MIN', label: 'MIN' },
  { key: 'FG_PCT', label: 'FG%', isPercentage: true },
  { key: 'FD_PTS', label: 'FPTS' },
  // Fewer turnovers than the season average is the better side.
  { key: 'TOV', label: 'TOV', lowerIsBetter: true },
];

const formatStat = (value, isPercentage = false) => {
  if (typeof value !== 'number') return '--';
  if (isPercentage) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(1);
};

// The filtered average against the season average, and which side of it the
// player sits on.
const seasonComparison = (filtered, season, stat) => {
  if (typeof filtered !== 'number' || typeof season !== 'number') return null;
  const diff = Number(((filtered - season) * (stat.isPercentage ? 100 : 1)).toFixed(1));
  const sign = diff > 0 ? '+' : '';
  const text = `${sign}${diff.toFixed(1)}${stat.isPercentage ? '%' : ''}`;
  if (diff === 0) return { text, tone: '' };
  const better = stat.lowerIsBetter ? diff < 0 : diff > 0;
  return { text, tone: better ? 'is-better' : 'is-worse' };
};

const PlayerStatsCards = ({ averages, selectedPlayer, playerId = null }) => {
  if (!Array.isArray(averages) || averages.length !== 2) {
    return null;
  }

  const [filteredAvg, seasonAvg] = averages;

  if (!filteredAvg || !seasonAvg) {
    return null;
  }

  return (
    <div className="player-stats-cards">
      <div className="player-identity">
        <div className="headshot-circle">
          <Headshot key={playerId} playerId={playerId} selectedPlayer={selectedPlayer} />
        </div>
        <h4 className="player-name">{selectedPlayer || 'Select Player'}</h4>
      </div>

      <div className="player-stat-tiles">
        {statCards.map((stat) => {
          const comparison = seasonComparison(filteredAvg[stat.key], seasonAvg[stat.key], stat);
          return (
            <div key={stat.key} className="player-stat-tile">
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">
                {formatStat(filteredAvg[stat.key], stat.isPercentage)}
              </span>
              <span className={`stat-comparison ${comparison?.tone || ''}`}>
                {comparison && (
                  <>
                    {comparison.text}
                    <span className="visually-hidden"> vs Season</span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerStatsCards;
