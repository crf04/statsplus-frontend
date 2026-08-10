import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import { fetchMatchup } from './matchupApi';
import { shouldDisplayDietShare } from './displayConfig';
import './MatchupDetailPage.css';

const WINDOWS = [
  { key: 'season', label: 'Season' },
  { key: 'last15', label: 'Last 15' },
];
const DEVIATIONS = [
  { value: 0, label: 'All deviations' },
  { value: 1, label: 'At least 1 sigma' },
  { value: 2, label: 'At least 2 sigma' },
];
const BASE_LABELS = {
  playTypes: 'Play types',
  shotZones: 'Shot zones',
  shotTypes: 'Shot types',
  assistLocations: 'Assist locations',
  traditional: 'Traditional defense',
};
const SHARE_LABELS = {
  playTypes: 'poss',
  shotZones: 'FGA',
  shotTypes: 'FGA',
  assistLocations: 'ast',
};

const ageText = (retrievedAt) => {
  if (!retrievedAt) return 'age unavailable';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(retrievedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const isFreshnessWarning = (name, surface) => {
  if (surface.status !== 'fresh') return true;
  if (!surface.retrievedAt) return true;
  const age = Date.now() - new Date(surface.retrievedAt).getTime();
  if (name === 'pool') return age > 15 * 60 * 1000;
  if (name === 'schedule') return age > 30 * 60 * 60 * 1000;
  return false;
};

function Freshness({ freshness }) {
  const surfaces = [
    ['schedule', freshness.schedule],
    ['pool', freshness.pool],
    ['stats', freshness.stats],
    ['injuries', freshness.injuries],
  ];
  return (
    <section className="matchup-freshness" aria-label="Matchup data freshness">
      {surfaces.map(([name, surface]) => {
        const warning = isFreshnessWarning(name, surface);
        return (
          <span key={name} className={warning ? 'matchup-warning' : undefined}>
            <strong>{name}</strong>: {surface.status}, as of {ageText(surface.retrievedAt)}
            {warning ? ` — ${name} data warning` : ''}
          </span>
        );
      })}
      {freshness.pool.providers.map((provider) => (
        <span
          key={provider.name}
          className={isFreshnessWarning('pool', provider) ? 'matchup-warning' : undefined}
        >
          <strong>{provider.name} pool</strong>: {provider.status}, as of{' '}
          {ageText(provider.retrievedAt)}
        </span>
      ))}
    </section>
  );
}

function Sparkline({ values, playerName }) {
  if (values.length === 0) return <span className="sparkline-empty">Minutes unavailable</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(1, values.length - 1)) * 88 + 4},${24 - ((value - min) / span) * 18}`,
    )
    .join(' ');
  return (
    <svg
      className="minutes-sparkline"
      viewBox="0 0 96 30"
      role="img"
      aria-label={`${playerName} last 10 minutes: ${values.join(', ')}`}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function PlayerRail({ players, injuries, market }) {
  const injuryById = new Map(
    injuries.teams.flatMap((team) => team.entries).map((entry) => [entry.id, entry]),
  );
  const scoped = players
    .filter((player) => market === 'All' || player.postedMarkets.includes(market))
    .sort((a, b) => b.seasonScoring - a.seasonScoring || a.name.localeCompare(b.name));
  return (
    <aside className="player-rail" aria-labelledby="player-rail-heading">
      <div className="section-heading">
        <p className="matchup-eyebrow">Targetable players</p>
        <h2 id="player-rail-heading">Season scoring order</h2>
      </div>
      {scoped.length === 0 ? (
        <p className="honest-empty">No posted players are available for this market.</p>
      ) : (
        <div className="player-list">
          {scoped.map((player) => {
            const injury = injuryById.get(player.injuryBadgeRef);
            return (
              <article key={player.id} aria-label={`${player.name} player`} className="player-card">
                <div>
                  <h3>{player.name}</h3>
                  <p>{player.seasonScoring.toFixed(1)} PPG</p>
                </div>
                {injury && (
                  <span className="injury-badge">{injury.status || injury.rawStatus}</span>
                )}
                <div className="market-chips" aria-label={`${player.name} posted markets`}>
                  {player.postedMarkets.map((postedMarket) => (
                    <span key={postedMarket}>{postedMarket}</span>
                  ))}
                </div>
                <Sparkline values={player.last10Minutes} playerName={player.name} />
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function DietShareChips({ players, base, rowKey, windowKey }) {
  if (!SHARE_LABELS[base]) return null;
  const chips = players.flatMap((player) => {
    const share = player.dietShares[base]?.find((entry) => entry.key === rowKey)?.[windowKey];
    if (!share || !shouldDisplayDietShare(base, share)) return [];
    return [{ player, share }];
  });
  if (chips.length === 0)
    return <p className="no-lean">No displayed Diet Shares meet the named threshold.</p>;
  return (
    <div className="diet-chips" aria-label="Players leaning on this slice">
      {chips.map(({ player, share }) => (
        <span key={player.id}>
          {player.name} · {Math.round(share.share * 100)}% {SHARE_LABELS[base]}
        </span>
      ))}
    </div>
  );
}

function DefenseSheet({ team, players, market, windowKey, deviation }) {
  let hidden = 0;
  const sections = Object.entries(team.defenseSheet).map(([base, rows]) => {
    const marketRows = rows.filter((row) => market === 'All' || row.markets.includes(market));
    const visibleRows = marketRows.filter((row) => {
      const shown = Math.abs(row[windowKey].sigmaDeviation) >= deviation;
      if (!shown) hidden += 1;
      return shown;
    });
    return { base, visibleRows };
  });
  const visibleCount = sections.reduce((total, section) => total + section.visibleRows.length, 0);
  return (
    <section className="defense-sheet" aria-labelledby="defense-sheet-heading">
      <div className="section-heading">
        <p className="matchup-eyebrow">Relative concessions · per 48</p>
        <h2 id="defense-sheet-heading">{team.tricode} Defense Sheet</h2>
      </div>
      <p className="hidden-count">
        {hidden} {hidden === 1 ? 'row' : 'rows'} hidden near league average.
      </p>
      {visibleCount === 0 && (
        <p className="honest-empty">No Defense Sheet rows match these controls.</p>
      )}
      {sections.map(({ base, visibleRows }) =>
        visibleRows.length ? (
          <section className="sheet-base" key={base} aria-labelledby={`base-${base}`}>
            <h3 id={`base-${base}`}>{BASE_LABELS[base] || base}</h3>
            <div className="sheet-rows">
              {visibleRows.map((row) => {
                const stat = row[windowKey];
                return (
                  <article className="sheet-row" key={`${base}-${row.key}`}>
                    <div className="row-stat">
                      <div>
                        <h4>{row.label}</h4>
                        <span>Rank {stat.rank} of 30</span>
                      </div>
                      <div
                        className={
                          stat.percentVsLeagueAverage < 0 ? 'relative-under' : 'relative-over'
                        }
                      >
                        <strong>{stat.allowedPer48.toFixed(1)}</strong>
                        <span>
                          {stat.percentVsLeagueAverage > 0 ? '+' : ''}
                          {stat.percentVsLeagueAverage}% vs league
                        </span>
                        <span>
                          {stat.sigmaDeviation > 0 ? '+' : ''}
                          {stat.sigmaDeviation.toFixed(1)}σ
                        </span>
                      </div>
                    </div>
                    <DietShareChips
                      players={players}
                      base={base}
                      rowKey={row.key}
                      windowKey={windowKey}
                    />
                  </article>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
    </section>
  );
}

function InjuryReport({ injuries }) {
  if (injuries.status === 'unavailable') {
    return (
      <section className="injury-report" aria-labelledby="injury-heading">
        <h2 id="injury-heading">Injury Report</h2>
        <p className="honest-empty">
          Injury report unavailable: {injuries.unavailableReason || 'unknown reason'}.
        </p>
      </section>
    );
  }
  const entries = injuries.teams.flatMap((team) => team.entries);
  return (
    <section className="injury-report" aria-labelledby="injury-heading">
      <div className="section-heading">
        <p className="matchup-eyebrow">
          {injuries.status} · as of {ageText(injuries.retrievedAt)}
        </p>
        <h2 id="injury-heading">Injury Report</h2>
      </div>
      {entries.length === 0 ? (
        <p className="honest-empty">No non-Available injury entries were reported.</p>
      ) : (
        <div className="injury-list">
          {entries.map((entry) => (
            <article key={entry.id}>
              <div>
                <strong>{entry.playerName}</strong> <span>{entry.tricode}</span>
              </div>
              <span className="injury-badge">
                {entry.status || entry.rawStatus || 'Unknown status'}
              </span>
              <p>{entry.reason}</p>
              <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Detail({ matchup }) {
  const homeTricode = matchup.game.home_team?.tricode;
  const initialTeam =
    matchup.teams.find((team) => team.tricode === homeTricode) || matchup.teams[0];
  const [teamId, setTeamId] = useState(initialTeam.teamId);
  const [market, setMarket] = useState('All');
  const [windowKey, setWindowKey] = useState('season');
  const [deviation, setDeviation] = useState(1);
  const defenseTeam = matchup.teams.find((team) => team.teamId === teamId) || initialTeam;
  const opposingTeam = matchup.teams.find((team) => team.teamId !== defenseTeam.teamId);
  const opposingPlayers = matchup.players.filter(
    (player) => player.teamId === opposingTeam?.teamId,
  );
  const markets = useMemo(
    () => ['All', ...new Set(matchup.players.flatMap((player) => player.postedMarkets))],
    [matchup.players],
  );
  return (
    <>
      <header className="matchup-heading">
        <div>
          <Link to="/matchups">← Back to slate</Link>
          <p className="matchup-eyebrow">Open Team Sheets</p>
          <h1>
            {matchup.game.away_team.tricode} @ {matchup.game.home_team.tricode}
          </h1>
        </div>
        <div className="team-toggle" role="group" aria-label="Defense team">
          {matchup.teams.map((team) => (
            <button
              type="button"
              aria-pressed={team.teamId === defenseTeam.teamId}
              key={team.teamId}
              onClick={() => setTeamId(team.teamId)}
            >
              {team.tricode} defense
            </button>
          ))}
        </div>
      </header>
      <Freshness freshness={matchup.freshness} />
      <section className="detail-controls" aria-label="Defense Sheet controls">
        <div className="segmented" role="group" aria-label="Market">
          {markets.map((item) => (
            <button
              type="button"
              aria-pressed={market === item}
              key={item}
              onClick={() => setMarket(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Stat window">
          {WINDOWS.map((item) => (
            <button
              type="button"
              aria-pressed={windowKey === item.key}
              key={item.key}
              onClick={() => setWindowKey(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Deviation filter">
          {DEVIATIONS.map((item) => (
            <button
              type="button"
              aria-pressed={deviation === item.value}
              key={item.value}
              onClick={() => setDeviation(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <div className="detail-grid">
        <DefenseSheet
          team={defenseTeam}
          players={opposingPlayers}
          market={market}
          windowKey={windowKey}
          deviation={deviation}
        />
        <PlayerRail players={opposingPlayers} injuries={matchup.injuries} market={market} />
      </div>
      <InjuryReport injuries={matchup.injuries} />
    </>
  );
}

export default function MatchupDetailPage() {
  const { gameId } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState({ status: 'idle', matchup: null, error: null });
  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setState({ status: 'idle', matchup: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', matchup: null, error: null });
    fetchMatchup(gameId, { signal: controller.signal })
      .then((matchup) => setState({ status: 'ready', matchup, error: null }))
      .catch((error) => {
        if (!isRequestCancelled(error))
          setState({
            status: 'error',
            matchup: null,
            error: getRequestErrorMessage(error, 'Unable to load this matchup. Please try again.'),
          });
      });
    return () => controller.abort();
  }, [authLoading, gameId, isAuthenticated]);

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="matchup-page signed-out-detail">
        <h1>Sign in to view this matchup</h1>
        <p>Use the sign-in control in the navigation to load Defense Sheets and player data.</p>
      </main>
    );
  }
  return (
    <main className="matchup-page">
      {state.status === 'loading' && <p role="status">Loading matchup…</p>}
      {state.status === 'error' && <p role="alert">{state.error}</p>}
      {state.status === 'ready' && <Detail matchup={state.matchup} />}
    </main>
  );
}
