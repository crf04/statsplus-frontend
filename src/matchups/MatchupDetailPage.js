import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import { formatAge, useMinuteNow } from '../freshness';
import { getSurfaceFreshnessPresentation } from '../slateStatus';
import { fetchMatchup, fetchMatchupSelection } from './matchupApi';
import { getDisplayableDietShare } from './displayConfig';
import SelectionCard from './SelectionCard';
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
const UNAVAILABLE_RELATIVE_LABEL = 'vs league: unavailable (not comparable)';
const SECTION_ORDER = [
  ['schedule', 'Schedule'],
  ['participants', 'Participants'],
  ['seasonDefense', 'Season defense'],
  ['last15Defense', 'Last 15 defense'],
  ['injuries', 'Injuries'],
];
const CONTEXT_LABELS = {
  completed_season_catalog: 'Completed-season catalog',
  current_season_catalog: 'Current-season catalog',
  completed_season: 'Completed-season context',
  pregame: 'Pregame',
  posted_markets: 'Posted markets',
  current: 'Current',
};
const SOURCE_LABELS = {
  event_catalog: 'Event Catalog',
  player_game_logs: 'game logs',
  player_pool: 'Player Pool',
  team_matchup_publication: 'Defense Sheet publication',
  rotowire: 'rotowire',
};
const SECTION_REASONS = {
  no_point_in_time_snapshot: 'No point-in-time snapshot was captured for this game.',
  no_pregame_snapshot: 'No pregame injury snapshot was archived for this game.',
  game_logs_incomplete: 'Canonical game logs are incomplete for this game.',
  no_game_log_rows: 'No canonical game-log rows exist for this game.',
  player_pool_unavailable: 'No Player Pool snapshot is available for this game.',
};
const sectionReason = (section) =>
  SECTION_REASONS[section.unavailableReason] || `${section.unavailableReason}.`;
const contextLabel = (section) => CONTEXT_LABELS[section.context] || section.context;
const sourceLabel = (section) => SOURCE_LABELS[section.source] || section.source;
// Collection time is provenance for immutable evidence, so it is stated as a
// date rather than an age that would read as an operational staleness warning.
const collectedLabel = (section) =>
  section.collectedAt ? ` · collected ${section.collectedAt.slice(0, 10)}` : '';

// Historical sections replace the live freshness bars: each one governs only its
// own evidence, so a missing pool or stats marker cannot speak for the others.
function HistoricalEvidence({ sections }) {
  return (
    <section className="matchup-freshness" aria-label="Historical matchup evidence">
      {SECTION_ORDER.map(([key, label]) => {
        const section = sections[key];
        return (
          <span key={key}>
            <strong>{label}</strong>:{' '}
            {section.status === 'available'
              ? `${contextLabel(section)} · from ${sourceLabel(section)}${collectedLabel(section)}`
              : `${section.status} — ${sectionReason(section)}`}
          </span>
        );
      })}
    </section>
  );
}

function Freshness({ freshness, now }) {
  const surfaces = [
    ['schedule', freshness.schedule],
    ['pool', freshness.pool],
    ['stats', freshness.stats],
    ['injuries', freshness.injuries],
  ];
  return (
    <section className="matchup-freshness" aria-label="Matchup data freshness">
      {surfaces.map(([name, surface]) => {
        const presentation = getSurfaceFreshnessPresentation(surface, name, now);
        return (
          <span key={name} className={presentation.warning ? 'matchup-warning' : undefined}>
            <strong>{name}</strong>: {presentation.status}, as of{' '}
            {formatAge(surface.retrievedAt, now)}
            {presentation.warning ? ` — ${name} data warning` : ''}
            {presentation.thresholdNote ? ` (${presentation.thresholdNote})` : ''}
          </span>
        );
      })}
      {freshness.pool.providers.map((provider) => {
        const presentation = getSurfaceFreshnessPresentation(provider, 'pool', now);
        return (
          <span
            key={provider.name}
            className={presentation.warning ? 'matchup-warning' : undefined}
          >
            <strong>{provider.name} pool</strong>: {presentation.status}, as of{' '}
            {formatAge(provider.retrievedAt, now)}
          </span>
        );
      })}
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

function PlayerRail({
  players,
  injuries,
  historical,
  unavailableMessage,
  market,
  windowKey,
  targetableCount,
  selectedId,
  onSelect,
  registerTrigger,
}) {
  const [sortMode, setSortMode] = useState('season');
  useEffect(() => {
    if (market === 'All') setSortMode('season');
  }, [market]);
  const injuryById = new Map(
    injuries.teams.flatMap((team) => team.entries).map((entry) => [entry.id, entry]),
  );
  const windowScoreFor = (player) => player.scores[market]?.[windowKey] ?? null;
  // A score is unavailable, not zero, when the contract could not compute it.
  const scoreFor = (player) => {
    const score = windowScoreFor(player);
    if (!score) return null;
    return score.blend?.value ?? Object.values(score.components)[0]?.value ?? null;
  };
  const byScore = sortMode === 'score' && market !== 'All';
  const compareDescendingUnavailableLast = (a, b, valueOf) => {
    const first = valueOf(a);
    const second = valueOf(b);
    if ((first === null) !== (second === null)) return first === null ? 1 : -1;
    if (first === null || first === second) return 0;
    return second - first;
  };
  const scoped = players.filter(
    (player) => market === 'All' || player.statCategories.includes(market),
  );
  scoped.sort(
    (a, b) =>
      (byScore ? compareDescendingUnavailableLast(a, b, scoreFor) : 0) ||
      compareDescendingUnavailableLast(a, b, (player) => player.seasonScoring) ||
      a.name.localeCompare(b.name),
  );
  return (
    <aside
      className="player-rail"
      aria-label={historical ? 'Players in game' : undefined}
      aria-labelledby={historical ? undefined : 'player-rail-heading'}
    >
      <div className="section-heading">
        <p className="matchup-eyebrow">{historical ? 'Players in game' : 'Targetable players'}</p>
        <h2 id="player-rail-heading">
          {sortMode === 'score' && market !== 'All'
            ? `${market} Matchup Score order`
            : 'Season scoring order'}
        </h2>
        {targetableCount !== null && (
          <p className="rail-count">{targetableCount} targetable returned</p>
        )}
        <div className="rail-sort" role="group" aria-label="Player rail sort">
          <button
            type="button"
            aria-pressed={sortMode === 'season'}
            onClick={() => setSortMode('season')}
          >
            Season scoring
          </button>
          <button
            type="button"
            aria-pressed={sortMode === 'score'}
            disabled={market === 'All'}
            onClick={() => setSortMode('score')}
          >
            Matchup Score
          </button>
        </div>
      </div>
      {unavailableMessage ? (
        <p className="honest-empty">{unavailableMessage}</p>
      ) : scoped.length === 0 ? (
        <p className="honest-empty">
          {historical
            ? 'No participants are available for this Stat Category.'
            : 'No posted players are available for this market.'}
        </p>
      ) : (
        <div className="player-list">
          {scoped.map((player) => {
            const injury = historical ? undefined : injuryById.get(player.injuryBadgeRef);
            const serializedPlayerId = String(player.id);
            const focalLine = player.focalGameLine;
            const unscored = market !== 'All' && scoreFor(player) === null;
            const missingInputs = unscored ? (windowScoreFor(player)?.missingInputs ?? []) : [];
            return (
              <article
                key={player.id}
                aria-label={`${player.name} player`}
                className={`player-card${selectedId === serializedPlayerId ? ' selected' : ''}`}
              >
                <div>
                  <h3>{player.name}</h3>
                  <p>
                    {player.seasonScoring === null
                      ? 'Season scoring unavailable'
                      : `${player.seasonScoring.toFixed(1)} PPG`}
                    {historical && player.seasonScoring !== null
                      ? ' · completed-season context'
                      : ''}
                  </p>
                </div>
                {injury && (
                  <span className="injury-badge">{injury.status || injury.rawStatus}</span>
                )}
                {historical && focalLine && (
                  <p className="focal-line">
                    Focal game {focalLine.matchup} · {focalLine.minutes.toFixed(1)} MIN ·{' '}
                    {(market === 'All' ? player.statCategories : [market])
                      .map((category) => `${focalLine.stats[category].toFixed(1)} ${category}`)
                      .join(' · ')}
                  </p>
                )}
                {historical && unscored && (
                  <p className="honest-empty">
                    {market} Matchup Score unavailable
                    {missingInputs.length ? `: missing ${missingInputs.join(', ')}` : ''}.
                  </p>
                )}
                {!historical && (
                  <div
                    className="market-chips"
                    role="group"
                    aria-label={`${player.name} posted markets`}
                  >
                    {player.postedMarkets.map((postedMarket) => {
                      const providers = Object.entries(player.provenance)
                        .filter(([, markets]) => markets.includes(postedMarket))
                        .map(([provider]) => provider);
                      const provenanceLabel = `${postedMarket} from ${providers.join(', ')}`;
                      return (
                        <span
                          key={postedMarket}
                          aria-label={provenanceLabel}
                          title={provenanceLabel}
                        >
                          {postedMarket}
                        </span>
                      );
                    })}
                  </div>
                )}
                <Sparkline values={player.last10Minutes} playerName={player.name} />
                <button
                  ref={(node) => registerTrigger(serializedPlayerId, node)}
                  type="button"
                  className="select-player"
                  aria-expanded={selectedId === serializedPlayerId}
                  aria-controls="matchup-selection-card"
                  onClick={() => onSelect(player)}
                >
                  {selectedId === serializedPlayerId ? 'Selected' : 'Open selection card'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function DietShareChips({ players, base, sliceKey, market }) {
  if (!SHARE_LABELS[base]) return null;
  const chips = players
    .filter((player) => market === 'All' || player.statCategories.includes(market))
    .flatMap((player) => {
      const share = getDisplayableDietShare(player, base, sliceKey);
      if (!share) return [];
      return [{ player, share }];
    });
  if (chips.length === 0)
    return <p className="no-lean">No displayed Diet Shares meet the named threshold.</p>;
  return (
    <div className="diet-chips" role="group" aria-label="Players leaning on this slice">
      {chips.map(({ player, share }) => (
        <span key={player.id}>
          {player.name} · {Math.round(share.share * 100)}% {SHARE_LABELS[base]}
        </span>
      ))}
    </div>
  );
}

function DefenseSheet({
  team,
  players,
  market,
  windowKey,
  deviation,
  selectedPlayer,
  surfaceAvailability,
  provenance,
}) {
  let hidden = 0;
  const sections = Object.entries(team.defenseSheet).map(([base, rows]) => {
    const marketRows = rows.filter((row) => market === 'All' || row.markets.includes(market));
    const availability = surfaceAvailability[base][windowKey];
    if (availability.status !== 'available') {
      return {
        base,
        availability,
        relevant: marketRows.length > 0,
        legacyUnavailableRow: null,
        visibleRows: [],
      };
    }
    const legacyUnavailableRow =
      base === 'traditional'
        ? marketRows.find((row) => row.key === 'OPP_REB' && row[windowKey] === null) || null
        : null;
    const visibleRows = marketRows
      .filter((row) => row[windowKey] !== null)
      .filter((row) => {
        const shown = Math.abs(row[windowKey].sigmaDeviation) >= deviation;
        if (!shown) hidden += 1;
        return shown;
      });
    return {
      base,
      availability,
      relevant: marketRows.length > 0,
      legacyUnavailableRow,
      visibleRows,
    };
  });
  const visibleCount = sections.reduce((total, section) => total + section.visibleRows.length, 0);
  const hasNamedUnavailable = sections.some(
    (section) =>
      section.legacyUnavailableRow ||
      (section.availability.status !== 'available' && section.relevant),
  );
  const traditionalHasRelevantRows =
    sections.find((section) => section.base === 'traditional')?.relevant ?? false;
  return (
    <section className="defense-sheet" aria-labelledby="defense-sheet-heading">
      <div className="section-heading">
        <p className="matchup-eyebrow">Relative concessions · per 48</p>
        <h2 id="defense-sheet-heading">{team.tricode} Defense Sheet</h2>
        {provenance && <p className="sheet-provenance">{provenance}</p>}
      </div>
      <p className="hidden-count">
        {hidden} {hidden === 1 ? 'row' : 'rows'} hidden near league average.
      </p>
      <DefensiveColumns
        columns={team.defensiveColumns}
        market={market}
        windowKey={windowKey}
        availability={surfaceAvailability.traditional[windowKey]}
        hasRelevantRows={traditionalHasRelevantRows}
      />
      {visibleCount === 0 && !hasNamedUnavailable && (
        <p className="honest-empty">No Defense Sheet rows match these controls.</p>
      )}
      {sections.map(({ base, availability, relevant, legacyUnavailableRow, visibleRows }) =>
        availability.status !== 'available' && relevant && base !== 'traditional' ? (
          <section className="sheet-base" key={base} aria-labelledby={`base-${base}`}>
            <h3 id={`base-${base}`}>{BASE_LABELS[base] || base}</h3>
            <p className="honest-empty">
              {BASE_LABELS[base] || base} unavailable for{' '}
              {WINDOWS.find((window) => window.key === windowKey)?.label}:{' '}
              {availability.unavailableReason}.
            </p>
          </section>
        ) : visibleRows.length || legacyUnavailableRow ? (
          <section className="sheet-base" key={base} aria-labelledby={`base-${base}`}>
            <h3 id={`base-${base}`}>{BASE_LABELS[base] || base}</h3>
            {visibleRows.length > 0 && (
              <div className="sheet-rows">
                {visibleRows.map((row) => {
                  const stat = row[windowKey];
                  return (
                    <article
                      className={`sheet-row${
                        selectedPlayer &&
                        getDisplayableDietShare(selectedPlayer, base, row.sliceKey)
                          ? ' selection-why'
                          : ''
                      }`}
                      key={`${base}-${row.key}`}
                    >
                      <div className="row-stat">
                        <span
                          className="rank-pill"
                          style={{ '--rank': stat.rank }}
                          title={`Opponent rank ${stat.rank}/30 — 30 allows the most`}
                        >
                          {stat.rank}
                        </span>
                        <div>
                          <h4>{row.label}</h4>
                        </div>
                        <div
                          className={
                            stat.percentVsLeagueAverage === null
                              ? 'relative-neutral'
                              : stat.percentVsLeagueAverage < 0
                                ? 'relative-under'
                                : 'relative-over'
                          }
                        >
                          <strong>{stat.allowedPer48.toFixed(1)}</strong>
                          {stat.percentVsLeagueAverage === null ? (
                            <span>{UNAVAILABLE_RELATIVE_LABEL}</span>
                          ) : (
                            <span>
                              {stat.percentVsLeagueAverage > 0 ? '+' : ''}
                              {stat.percentVsLeagueAverage}% vs league
                            </span>
                          )}
                          <span>
                            {stat.sigmaDeviation > 0 ? '+' : ''}
                            {stat.sigmaDeviation.toFixed(1)}σ
                          </span>
                        </div>
                      </div>
                      <DietShareChips
                        players={players}
                        base={base}
                        sliceKey={row.sliceKey}
                        market={market}
                      />
                    </article>
                  );
                })}
              </div>
            )}
            {legacyUnavailableRow && (
              <p className="honest-empty">
                Opponent rebounds unavailable for{' '}
                {WINDOWS.find((window) => window.key === windowKey)?.label}.
              </p>
            )}
          </section>
        ) : null,
      )}
    </section>
  );
}

const DEFENSIVE_COLUMN_MARKETS = { OPP_TOV: 'TOV', OPP_STL: 'STL', OPP_BLK: 'BLK' };

function DefensiveColumns({ columns, market, windowKey, availability, hasRelevantRows }) {
  const visible = Object.entries(columns).filter(
    ([key]) => market === 'All' || DEFENSIVE_COLUMN_MARKETS[key] === market,
  );
  if (availability.status !== 'available') {
    if (visible.length === 0 && !hasRelevantRows) return null;
    return (
      <section className="defensive-columns" aria-labelledby="defensive-columns-heading">
        <h3 id="defensive-columns-heading">Traditional defensive columns</h3>
        <p className="honest-empty">
          Traditional defense unavailable for{' '}
          {WINDOWS.find((window) => window.key === windowKey)?.label}:{' '}
          {availability.unavailableReason}.
        </p>
      </section>
    );
  }
  if (visible.length === 0) return null;
  return (
    <section className="defensive-columns" aria-labelledby="defensive-columns-heading">
      <h3 id="defensive-columns-heading">Traditional defensive columns</h3>
      <div className="defensive-column-grid">
        {visible.map(([key, windows]) => {
          const value = windows[windowKey];
          return (
            <article key={key}>
              <h4>{key}</h4>
              <strong>{value.per48.toFixed(1)} per 48</strong>
              {value.percentVsLeagueAverage === null ? (
                <span>{UNAVAILABLE_RELATIVE_LABEL}</span>
              ) : (
                <span>
                  {value.percentVsLeagueAverage > 0 ? '+' : ''}
                  {value.percentVsLeagueAverage}% vs league
                </span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InjuryReport({ injuries, now }) {
  if (injuries.status === 'unavailable') {
    return (
      <section className="injury-report" aria-labelledby="injury-heading">
        <h2 id="injury-heading">Injury Report</h2>
        <p className="honest-empty">
          Injury report unavailable: {injuries.unavailableReason || 'unknown reason'}.
        </p>
        <a href={injuries.sourceUrl} target="_blank" rel="noreferrer">
          Data source: {injuries.source}
        </a>
      </section>
    );
  }
  const entries = injuries.teams.flatMap((team) => team.entries);
  return (
    <section className="injury-report" aria-labelledby="injury-heading">
      <div className="section-heading">
        <p className="matchup-eyebrow">
          {injuries.status} · as of {formatAge(injuries.retrievedAt, now)}
        </p>
        <h2 id="injury-heading">Injury Report</h2>
        <a href={injuries.sourceUrl} target="_blank" rel="noreferrer">
          Data source: {injuries.source}
        </a>
      </div>
      {entries.length === 0 ? (
        <p className="honest-empty">No non-Available injury entries were reported.</p>
      ) : (
        <div className="injury-list">
          {injuries.teams.flatMap((team) =>
            team.entries.map((entry) => (
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
                <small>
                  {team.tricode} submission: {team.submissionState || 'unknown'}
                </small>
              </article>
            )),
          )}
        </div>
      )}
    </section>
  );
}

function Detail({ matchup, gameId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMinuteNow(true);
  const homeTricode = matchup.game.home.tricode;
  const initialTeam =
    matchup.teams.find((team) => team.tricode === homeTricode) || matchup.teams[0];
  const [teamId, setTeamId] = useState(initialTeam.teamId);
  const [market, setMarket] = useState('All');
  const [windowKey, setWindowKey] = useState('season');
  const [deviation, setDeviation] = useState(1);
  const selectedId = searchParams.get('player');
  const selectedPlayer = matchup.players.find((player) => String(player.id) === selectedId) || null;
  const selectionTriggers = useRef(new Map());
  const previousSelectedId = useRef(null);
  const [selectionState, setSelectionState] = useState({
    status: 'idle',
    playerId: null,
    data: null,
    error: null,
  });
  const defenseTeam = matchup.teams.find((team) => team.teamId === teamId) || initialTeam;
  const opposingTeam = matchup.teams.find((team) => team.teamId !== defenseTeam.teamId);
  const opposingTeamId = opposingTeam?.teamId;
  const historical = matchup.experience.mode === 'historical';
  const sections = matchup.experience.sections;
  const poolAvailable = !['missing', 'unavailable'].includes(matchup.freshness.pool.status);
  const participantsAvailable = historical
    ? sections.participants.status === 'available'
    : poolAvailable;
  const opposingPlayers = useMemo(
    () =>
      participantsAvailable
        ? matchup.players.filter((player) => player.teamId === opposingTeamId)
        : [],
    [matchup.players, opposingTeamId, participantsAvailable],
  );
  const opposingGameTeam = [matchup.game.away, matchup.game.home].find(
    (team) => team.teamId === opposingTeamId,
  );
  const markets = useMemo(
    () => ['All', ...new Set(opposingPlayers.flatMap((player) => player.statCategories))],
    [opposingPlayers],
  );
  const windowSection = historical
    ? sections[windowKey === 'season' ? 'seasonDefense' : 'last15Defense']
    : null;
  const last15Section = historical ? sections.last15Defense : null;
  const last15Blocked = Boolean(last15Section) && last15Section.status !== 'available';
  useEffect(() => {
    if (!markets.includes(market)) setMarket('All');
  }, [market, markets]);
  useEffect(() => {
    if (!selectedPlayer) {
      setSelectionState({ status: 'idle', playerId: null, data: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    let current = true;
    setSelectionState({ status: 'loading', playerId: selectedPlayer.id, data: null, error: null });
    fetchMatchupSelection(gameId, selectedPlayer.id, selectedPlayer.statCategories, {
      signal: controller.signal,
    })
      .then((data) => {
        if (current)
          setSelectionState({ status: 'ready', playerId: selectedPlayer.id, data, error: null });
      })
      .catch((error) => {
        if (current && !isRequestCancelled(error))
          setSelectionState({
            status: 'error',
            playerId: selectedPlayer.id,
            data: null,
            error: `Unable to load selection logs. ${getRequestErrorMessage(error, 'Please try again.')}`,
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [gameId, selectedPlayer]);
  useEffect(() => {
    if (previousSelectedId.current && !selectedId) {
      selectionTriggers.current.get(previousSelectedId.current)?.focus();
    }
    previousSelectedId.current = selectedId;
  }, [selectedId]);
  const updateSelectedPlayer = (playerId) => {
    const serializedPlayerId = playerId === null ? null : String(playerId);
    if (serializedPlayerId === selectedId) return;
    const next = new URLSearchParams(searchParams);
    if (serializedPlayerId) next.set('player', serializedPlayerId);
    else next.delete('player');
    setSearchParams(next, { replace: false });
  };
  const registerTrigger = (playerId, node) => {
    if (node) selectionTriggers.current.set(playerId, node);
    else selectionTriggers.current.delete(playerId);
  };
  return (
    <>
      <header className="matchup-heading">
        <div>
          <Link to="/matchups">← Back to slate</Link>
          <p className="matchup-eyebrow">
            {historical
              ? 'Historical Matchup · stored evidence'
              : 'Open Team Sheets · live contract'}
          </p>
          <h1>
            {matchup.game.away.tricode} @ {matchup.game.home.tricode}
          </h1>
        </div>
        {historical ? (
          <HistoricalEvidence sections={sections} />
        ) : (
          <Freshness freshness={matchup.freshness} now={now} />
        )}
      </header>
      {matchup.game.preseason && (
        <p
          role="note"
          aria-label="Preseason matchup caveat"
          className="matchup-warning preseason-caveat"
        >
          Preseason matchup — current-season samples may be limited.
        </p>
      )}
      <div className="detail-grid">
        <div className="matchup-sidebar">
          <p className="sheet-instruction">
            Tap a player to trace their rows across the sheet; use the score card for the full
            dossier.
          </p>
          {historical && sections.injuries.status !== 'available' ? (
            <section className="injury-report" aria-labelledby="injury-heading">
              <h2 id="injury-heading">Injuries</h2>
              <p className="honest-empty">{sectionReason(sections.injuries)}</p>
            </section>
          ) : (
            <InjuryReport injuries={matchup.injuries} now={now} />
          )}
          <PlayerRail
            players={opposingPlayers}
            injuries={matchup.injuries}
            historical={historical}
            unavailableMessage={
              historical && !participantsAvailable ? sectionReason(sections.participants) : null
            }
            market={market}
            windowKey={windowKey}
            targetableCount={
              !historical && poolAvailable
                ? (opposingGameTeam?.targetablePlayerCount ?? null)
                : null
            }
            selectedId={selectedId}
            onSelect={(player) => updateSelectedPlayer(player.id)}
            registerTrigger={registerTrigger}
          />
        </div>
        <div className="matchup-workspace">
          <section className="detail-controls" aria-label="Defense Sheet controls">
            <div
              className="segmented market-tabs"
              role="group"
              aria-label={historical ? 'Stat category' : 'Market'}
            >
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
            <div className="control-row">
              <div className="segmented" role="group" aria-label="Stat window">
                {WINDOWS.map((item) => (
                  <button
                    type="button"
                    aria-pressed={windowKey === item.key}
                    disabled={item.key === 'last15' && last15Blocked}
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
            </div>
            {windowSection?.context && (
              <p className="window-context">{contextLabel(windowSection)}</p>
            )}
            {last15Blocked && <p className="honest-empty">{sectionReason(last15Section)}</p>}
          </section>
          {selectedId && !selectedPlayer && (
            <p role="alert" className="selection-card">
              That player is not available in this matchup.
            </p>
          )}
          {selectedPlayer && (
            <SelectionCard
              player={selectedPlayer}
              selection={selectionState.playerId === selectedPlayer.id ? selectionState.data : null}
              status={
                selectionState.playerId === selectedPlayer.id ? selectionState.status : 'loading'
              }
              error={selectionState.error}
              windowKey={windowKey}
              sheetMarket={market}
              whyRelevant={selectedPlayer.teamId !== defenseTeam.teamId}
              onClose={() => updateSelectedPlayer(null)}
            />
          )}
          {/* The Defense Sheet is governed by its own Surface availability. The
              generic legacy stats freshness marker never suppresses it. */}
          <DefenseSheet
            team={defenseTeam}
            players={opposingPlayers}
            market={market}
            windowKey={windowKey}
            deviation={deviation}
            selectedPlayer={selectedPlayer?.teamId !== defenseTeam.teamId ? selectedPlayer : null}
            surfaceAvailability={matchup.league.surfaceAvailability}
            provenance={
              windowSection
                ? `${WINDOWS.find((item) => item.key === windowKey).label} defense provenance: ${contextLabel(windowSection)} · ${sourceLabel(windowSection)}`
                : null
            }
          />
        </div>
      </div>
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
      {state.status === 'ready' && <Detail matchup={state.matchup} gameId={gameId} />}
    </main>
  );
}
