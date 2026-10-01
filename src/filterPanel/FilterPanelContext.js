import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSavedFilterSets, subscribeSavedFilterSets } from '../savedFilterSetsApi';
import { describeSavedFilterSet } from '../savedFilterSetDescription';
import { toFiniteNumber } from '../numberUtils';
import { opponentFilterLabel } from '../opponentFilters';
import { useAuth } from '../contexts/AuthContext';
import { fetchNextOpponent } from '../nextOpponentApi';

const useHeight = () => {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, height];
};

const lineFor = ({ lineType, lineValue, averages }) => {
  const explicit = toFiniteNumber(lineValue);
  return explicit !== null ? explicit : toFiniteNumber(averages?.[0]?.[lineType], 0);
};

const SeasonStrip = ({ seasonLogs, keptDates, lineType, line, stripRows = 4 }) => {
  const [selectedGame, setSelectedGame] = useState(null);
  const first = seasonLogs[0]?.GAME_DATE;
  const last = seasonLogs[seasonLogs.length - 1]?.GAME_DATE;
  const month = (iso) =>
    iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short' }) : '';
  return (
    <div className="fpx-strip">
      <div className="fpx-strip-grid" style={{ gridTemplateRows: `repeat(${stripRows}, 10px)` }}>
        {seasonLogs.map((log) => {
          const kept = keptDates.has(log.GAME_DATE);
          const value = toFiniteNumber(log[lineType], 0);
          const tone = !kept ? 'out' : value > line ? 'over' : 'under';
          const description = `${log.GAME_DATE} ${log.MATCHUP} · ${lineType} ${value}${kept ? ` (${tone})` : ' (filtered out)'}`;
          return (
            <i
              key={log.GAME_DATE}
              className={`is-${tone}`}
              role="button"
              tabIndex={0}
              aria-label={description}
              onClick={() => setSelectedGame(description)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedGame(description);
                }
              }}
              title={`${log.GAME_DATE} ${log.MATCHUP} · ${lineType} ${value}${kept ? '' : ' (filtered out)'}`}
            />
          );
        })}
      </div>
      {selectedGame && (
        <div role="status" aria-label="Game details" className="fp-note">
          {selectedGame}
        </div>
      )}
      <div className="fpx-strip-legend">
        <span>{month(first)}</span>
        <span>
          <i className="is-over" /> over <i className="is-under" /> under <i className="is-out" />{' '}
          filtered out
        </span>
        <span>{month(last)}</span>
      </div>
    </div>
  );
};

const useSavedSets = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const [sets, setSets] = useState(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeSavedFilterSets(() => setRevision((value) => value + 1)), []);
  useEffect(() => {
    if (!isAuthenticated) {
      setSets(null);
      return undefined;
    }
    const controller = new AbortController();
    setError(false);
    fetchSavedFilterSets({ signal: controller.signal })
      .then((sets) => {
        if (!controller.signal.aborted) setSets(sets);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [isAuthenticated, currentUser?.uid, revision]);
  return { sets, error, retry: () => setRevision((value) => value + 1) };
};

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const formatStat = (stat) => {
  if (stat.unit === 'percent') return `${(stat.value * 100).toFixed(1)}%`;
  if (stat.unit === 'league_ratio') {
    const pct = Math.round((stat.value - 1) * 100);
    return `${pct > 0 ? '+' : ''}${pct}% vs avg`;
  }
  return stat.value.toFixed(1);
};

const OpponentExtremes = ({ rows, expanded, onToggle, panel, data, extremes }) => {
  if (!data?.next_game) return null;
  const game = data.next_game;
  const date = new Date(`${game.date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const summaryOnly = !expanded && rows === 0;
  const shown = expanded ? extremes : extremes.slice(0, rows);
  const hidden = extremes.length - shown.length;
  const most = extremes.filter((stat) => !stat.fewest).length;
  return (
    <div className="fpx-list fpx-ext">
      <button type="button" className="fpx-list-head fpx-ext-head" onClick={onToggle}>
        <span>
          Next: {game.home ? 'vs' : '@'} {game.opponent} · {date}
        </span>
        <span className="fp-val">
          {most} most · {extremes.length - most} fewest
        </span>
      </button>
      {shown.map((stat) => {
        const applied =
          stat.token && panel.activeFilters.some((filter) => filter.filter === stat.token);
        return (
          <div key={`${stat.group}-${stat.label}`} className="fpx-ext-row">
            <span className={`fpx-ext-rank${stat.fewest ? ' is-fewest' : ' is-most'}`}>
              {ordinal(stat.place)} {stat.fewest ? 'fewest' : 'most'}
            </span>
            <span className="fpx-ext-label" title={stat.group}>
              {stat.label}
            </span>
            <span className="fpx-ext-value">{formatStat(stat)}</span>
            {stat.token ? (
              <button
                type="button"
                className="fpx-ext-add"
                disabled={applied}
                title={`Add: teams ranked ${stat.tier[0]}–${stat.tier[1]} in ${opponentFilterLabel(stat.token)}`}
                aria-label={`Add teams ranked ${stat.tier[0]}–${stat.tier[1]} in ${opponentFilterLabel(stat.token)}`}
                onClick={() => panel.addTeamFilter(stat.token, stat.tier)}
              >
                {applied ? '✓' : '+'}
              </button>
            ) : (
              <span className="fpx-ext-add is-none" title="No matching defensive filter" />
            )}
          </div>
        );
      })}
      {summaryOnly && (
        <button type="button" className="fpx-ext-summary" onClick={onToggle}>
          {extremes.slice(0, 6).map((stat) => (
            <span key={stat.label} className={stat.fewest ? 'is-fewest' : 'is-most'}>
              {ordinal(stat.place)} {stat.fewest ? 'fewest' : 'most'} · {stat.label}
            </span>
          ))}
        </button>
      )}
      {!summaryOnly && (hidden > 0 || expanded) && (
        <button type="button" className="fpx-ext-more" onClick={onToggle}>
          {expanded ? 'Show fewer' : `+ ${hidden} more`}
        </button>
      )}
    </div>
  );
};

const MATCH_HEIGHT = 92;
const BLOCK_GAP = 12;
const HEADING_HEIGHT = 34;
const SUMMARY_HEIGHT = 28;
const OPPONENT_ROW_HEIGHT = 32;
const MORE_HEIGHT = 30;
const SAVED_ROW_HEIGHT = 46;
const SAVED_MINIMUM = 2;

// The count is the strip's title: how many of the season's games the
// filters kept, over the cells that show which ones.
const MatchStrip = ({ seasonLogs, keptDates, lineType, line }) => {
  const kept = seasonLogs.filter((log) => keptDates.has(log.GAME_DATE)).length;
  const pct = seasonLogs.length ? Math.round((kept / seasonLogs.length) * 100) : 0;
  return (
    <div className="fpx-match">
      <div className="fpx-list-head fpx-match-head">
        <span>
          <b>{kept}</b> of {seasonLogs.length} games match
        </span>
        <span className={`fp-val${kept / seasonLogs.length < 0.2 ? ' is-thin' : ''}`}>
          {kept / seasonLogs.length < 0.2 ? 'small sample' : `${pct}%`}
        </span>
      </div>
      <SeasonStrip
        seasonLogs={seasonLogs}
        keptDates={keptDates}
        lineType={lineType}
        line={line}
        stripRows={3}
      />
    </div>
  );
};

const SavedFilterSets = ({ rows, expanded, onToggle }) => {
  const { sets, error, retry } = useSavedSets();
  const navigate = useNavigate();
  if (error)
    return (
      <div className="fpx-list">
        <div className="fpx-list-head">Saved Filter Sets</div>
        <p role="status" className="fp-note">
          Could not load Saved Filter Sets.
        </p>
        <button type="button" className="fp-link" onClick={retry}>
          Retry saved sets
        </button>
      </div>
    );
  if (!sets) return null;
  const canonicalSearch = (search) => {
    const params = new URLSearchParams(search);
    params.sort();
    return params.toString();
  };
  const currentSearch = canonicalSearch(window.location.search);
  const shown = expanded ? sets : sets.slice(0, rows);
  const hidden = sets.length - shown.length;
  return (
    <div className="fpx-list">
      <div className="fpx-list-head">
        <span>Saved Filter Sets</span>
        <span className="fp-val">{sets.length}</span>
      </div>
      {sets.length === 0 && (
        <p className="fp-note">Nothing saved yet. Save this set to come back to it in one tap.</p>
      )}
      {shown.map((set) => {
        const described = describeSavedFilterSet(set.queryString);
        const current = canonicalSearch(set.queryString) === currentSearch;
        return (
          <button
            key={set.id}
            type="button"
            className={`fpx-saved${current ? ' is-current' : ''}`}
            onClick={() => navigate(`/?${set.queryString}`)}
          >
            <b>{set.name}</b>
            <span>
              {described.parameters.map((parameter) => parameter.label).join(' · ') || 'no filters'}
            </span>
          </button>
        );
      })}
      {(hidden > 0 || (expanded && sets.length > rows)) && (
        <button type="button" className="fpx-ext-more" onClick={onToggle}>
          {expanded ? 'Show fewer' : `+ ${hidden} more`}
        </button>
      )}
    </div>
  );
};

// Everything is always shown; spare height goes to opponent rows first, then
// saved sets. When even the minimum does not fit, the panel scrolls.
const FilterPanelContext = ({ panel, extra }) => {
  const [ref, height] = useHeight();
  const { isAuthenticated } = useAuth();
  const [opponent, setOpponent] = useState(null);
  useEffect(() => {
    setOpponent(null);
    if (!isAuthenticated || !panel.selectedPlayer) return undefined;
    const controller = new AbortController();
    fetchNextOpponent(panel.selectedPlayer, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setOpponent(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isAuthenticated, panel.selectedPlayer]);
  const extremes = (opponent?.opponent_ranks || [])
    .filter((stat) => stat.most_rank <= 8 || stat.most_rank > stat.ranked_teams - 8)
    .map((stat) => {
      const fewest = stat.ranked_teams - stat.most_rank + 1 < stat.most_rank;
      return {
        ...stat,
        token: stat.team_filter,
        fewest,
        place: fewest ? stat.ranked_teams - stat.most_rank + 1 : stat.most_rank,
        tier: fewest ? [stat.ranked_teams - 7, stat.ranked_teams] : [1, 8],
      };
    })
    .sort((a, b) => a.place - b.place || a.label.localeCompare(b.label));
  const [oppOpen, setOppOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const { ensureSeason } = panel;
  useEffect(() => {
    ensureSeason();
  }, [ensureSeason]);

  const seasonLogs = extra.seasonGameLogs || [];
  const keptDates = new Set((extra.gameLogs || []).map((log) => log.GAME_DATE));

  // On a phone the panel stacks under the chart, so nothing needs filling:
  // show a fixed amount instead of measuring.
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  let spare =
    height -
    (MATCH_HEIGHT +
      BLOCK_GAP +
      HEADING_HEIGHT +
      SUMMARY_HEIGHT +
      BLOCK_GAP +
      HEADING_HEIGHT +
      SAVED_MINIMUM * SAVED_ROW_HEIGHT +
      MORE_HEIGHT);
  let oppRows = 0;
  if (phone) {
    oppRows = 5;
    spare = MORE_HEIGHT + SAVED_ROW_HEIGHT;
  } else if (!oppOpen) {
    const all = extremes.length;
    const canvas = spare + SUMMARY_HEIGHT;
    if (canvas >= all * OPPONENT_ROW_HEIGHT) {
      oppRows = all;
      spare = canvas - all * OPPONENT_ROW_HEIGHT;
    } else {
      const fit = Math.floor((canvas - MORE_HEIGHT) / OPPONENT_ROW_HEIGHT);
      if (fit >= 2) {
        oppRows = fit;
        spare = canvas - fit * OPPONENT_ROW_HEIGHT - MORE_HEIGHT;
      }
    }
  }
  // An expanded opponent list takes the spare height, and the panel scrolls.
  const savedRows = oppOpen
    ? SAVED_MINIMUM
    : SAVED_MINIMUM + Math.max(0, Math.floor(spare / SAVED_ROW_HEIGHT));

  return (
    <div className="fp-filler is-j" ref={ref}>
      {extra.gameLogsLoading ? (
        <p role="status" className="fp-note">
          Loading matching games…
        </p>
      ) : extra.gameLogsError ? (
        <p role="status" className="fp-note">
          Matching games are unavailable.
        </p>
      ) : extra.seasonGameLogsLoading ? (
        <p role="status" className="fp-note">
          Loading the season range…
        </p>
      ) : extra.seasonGameLogsFailed ? (
        <div className="fp-note">
          <p role="status">Could not load the season strip.</p>
          <button type="button" className="fp-link" onClick={panel.ensureSeason}>
            Retry season
          </button>
        </div>
      ) : (
        seasonLogs.length > 0 && (
          <MatchStrip
            seasonLogs={seasonLogs}
            keptDates={keptDates}
            lineType={extra.lineType}
            line={lineFor(extra)}
          />
        )
      )}
      <OpponentExtremes
        rows={oppRows}
        expanded={oppOpen}
        onToggle={() => setOppOpen((open) => !open)}
        panel={panel}
        data={opponent}
        extremes={extremes}
      />
      <SavedFilterSets
        rows={savedRows}
        expanded={savedOpen}
        onToggle={() => setSavedOpen((open) => !open)}
      />
    </div>
  );
};

export default FilterPanelContext;
