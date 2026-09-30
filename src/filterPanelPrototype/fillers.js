/*
 * PROTOTYPE — throwaway. What fills the space under the filters when the
 * panel is pinned to the chart card's height (variants G and H).
 *
 * The filler is elastic: it measures the room it has and shows as much as
 * fits, in priority order — the match count, then the season strip, then a
 * list (saved Filter Sets, or the next opponent) cut at whole rows.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, getApiUrl } from '../config';
import { fetchSavedFilterSets } from '../savedFilterSetsApi';
import { describeSavedFilterSet } from '../savedFilterSetDescription';
import { toFiniteNumber } from '../numberUtils';

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

const COUNT_H = 30;
const STRIP_H = 84;
const LIST_HEAD_H = 46;
const ROW_H = 42;

/* ---- match count + season strip ---------------------------------------- */

const lineFor = ({ lineType, lineValue, averages }) => {
  const explicit = toFiniteNumber(lineValue);
  return explicit !== null ? explicit : toFiniteNumber(averages?.[0]?.[lineType], 0);
};

const MatchCount = ({ kept, season }) => {
  const pct = season ? Math.round((kept / season) * 100) : 0;
  return (
    <div className="fpx-count">
      <div className="fpx-count-text">
        <b>{kept}</b> of {season} games match
        <span className={pct < 20 ? 'is-thin' : ''}>
          {pct < 20 ? ` · small sample` : ` · ${pct}%`}
        </span>
      </div>
      <div className="fpx-count-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const SeasonStrip = ({ seasonLogs, keptDates, lineType, line }) => {
  const first = seasonLogs[0]?.GAME_DATE;
  const last = seasonLogs[seasonLogs.length - 1]?.GAME_DATE;
  const month = (iso) =>
    iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short' }) : '';
  return (
    <div className="fpx-strip">
      <div className="fpx-strip-grid">
        {seasonLogs.map((log) => {
          const kept = keptDates.has(log.GAME_DATE);
          const value = toFiniteNumber(log[lineType], 0);
          const tone = !kept ? 'out' : value > line ? 'over' : 'under';
          return (
            <i
              key={log.GAME_DATE}
              className={`is-${tone}`}
              title={`${log.GAME_DATE} ${log.MATCHUP} · ${lineType} ${value}${kept ? '' : ' (filtered out)'}`}
            />
          );
        })}
      </div>
      <div className="fpx-strip-legend">
        <span>{month(first)}</span>
        <span>
          <i className="is-over" /> over {line} <i className="is-under" /> under{' '}
          <i className="is-out" /> filtered out
        </span>
        <span>{month(last)}</span>
      </div>
    </div>
  );
};

/* ---- saved Filter Sets -------------------------------------------------- */

const useSavedSets = () => {
  const [sets, setSets] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchSavedFilterSets({ signal: controller.signal })
      .then(setSets)
      .catch(() => setSets([]));
    return () => controller.abort();
  }, []);
  return sets;
};

const SavedSets = ({ rows, currentSearch }) => {
  const sets = useSavedSets();
  const navigate = useNavigate();
  if (!sets || rows < 1) return null;
  return (
    <div className="fpx-list">
      <div className="fpx-list-head">
        <span>Saved Filter Sets</span>
        <span className="fp-val">{sets.length}</span>
      </div>
      {sets.length === 0 && (
        <p className="fp-note">Nothing saved yet. Save this set to come back to it in one tap.</p>
      )}
      {sets.slice(0, rows).map((set) => {
        const described = describeSavedFilterSet(set.queryString);
        const current = new URLSearchParams(set.queryString).toString() === currentSearch;
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
    </div>
  );
};

/* ---- next opponent ------------------------------------------------------ */

// PROTO: the captured season is over, so there is no next game. The card
// pretends the next one is @ CHA and says so.
const DEMO_NEXT = { team: 'Charlotte Hornets', tricode: 'CHA', label: '@ CHA · demo game' };

// The opponent metric each line type leans on, as team-stats key + filter token.
const METRICS = {
  PTS: { key: 'OPP_PTS', token: 'OPP_PTS', label: 'Points allowed' },
  REB: { key: 'OPP_REB', token: 'OPP_REB', label: 'Rebounds allowed' },
  AST: { key: 'OPP_AST', token: 'OPP_AST', label: 'Assists allowed' },
  FG3M: { key: 'OPP_FG3M', token: 'OPP_FG3M', label: '3s allowed' },
  TOV: { key: 'OPP_TOV', token: 'OPP_TOV', label: 'Turnovers forced' },
  STKS: { key: 'OPP_STL+BLK', token: 'OPP_STOCKS', label: 'Steals + blocks' },
};
const LEANS = {
  PTS: ['PTS', 'FG3M', 'AST'],
  REB: ['REB', 'PTS', 'AST'],
  AST: ['AST', 'PTS', 'REB'],
  PRA: ['PTS', 'REB', 'AST'],
  PR: ['PTS', 'REB', 'AST'],
  PA: ['PTS', 'AST', 'REB'],
  RA: ['REB', 'AST', 'PTS'],
  FG3M: ['FG3M', 'PTS', 'AST'],
  TOV: ['TOV', 'PTS', 'AST'],
  STKS: ['STKS', 'PTS', 'REB'],
};
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const NextOpponent = ({ rows, panel, lineType }) => {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get(getApiUrl('TEAM_STATS'), {
        params: { category: 'Traditional', team: DEMO_NEXT.team },
        signal: controller.signal,
      })
      .then(({ data }) => setStats(data))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!stats || rows < 1) return null;
  const metrics = (LEANS[lineType] || LEANS.PTS).map((key) => METRICS[key]).slice(0, rows);
  return (
    <div className="fpx-list">
      <div className="fpx-list-head">
        <span>Next: {DEMO_NEXT.label}</span>
      </div>
      {metrics.map((metric) => {
        // Team stats rank 1 = the LOWEST value; the defensive filter ranks
        // 1 = the highest. Flip before offering a filter.
        const teamRank = stats[`${metric.key}_RANK`];
        const rank = 31 - teamRank;
        const window = [Math.max(1, rank - 3), Math.min(30, rank + 3)];
        const applied = panel.activeFilters.some((filter) => filter.filter === metric.token);
        return (
          <div key={metric.key} className="fpx-opp">
            <div>
              <b>{metric.label}</b>
              <span>
                {toFiniteNumber(stats[metric.key], 0).toFixed(1)} · {ordinal(rank)} most
              </span>
            </div>
            <button
              type="button"
              className="fp-btn-ghost"
              disabled={applied}
              onClick={() => panel.addDefenseRule(metric.token, window)}
            >
              {applied ? 'Added' : `Teams ${window[0]}–${window[1]}`}
            </button>
          </div>
        );
      })}
    </div>
  );
};

/* ---- the filler --------------------------------------------------------- */

const Filler = ({ kind, panel, extra }) => {
  const [ref, height] = useHeight();
  const { ensureSeason } = panel;
  useEffect(() => {
    ensureSeason();
  }, [ensureSeason]);

  const seasonLogs = extra.seasonGameLogs || [];
  const gameLogs = extra.gameLogs || [];
  const keptDates = new Set(gameLogs.map((log) => log.GAME_DATE));
  const line = lineFor(extra);

  let room = height;
  const showCount = seasonLogs.length > 0 && room >= COUNT_H;
  if (showCount) room -= COUNT_H;
  const showStrip = showCount && room >= STRIP_H;
  if (showStrip) room -= STRIP_H;
  const rows = Math.max(0, Math.floor((room - LIST_HEAD_H) / ROW_H));

  return (
    <div className="fp-filler" ref={ref}>
      {showCount && <MatchCount kept={gameLogs.length} season={seasonLogs.length} />}
      {showStrip && (
        <SeasonStrip
          seasonLogs={seasonLogs}
          keptDates={keptDates}
          lineType={extra.lineType}
          line={line}
        />
      )}
      {kind === 'saved' && (
        <SavedSets rows={rows} currentSearch={window.location.search.replace(/^\?/, '')} />
      )}
      {kind === 'next' && <NextOpponent rows={rows} panel={panel} lineType={extra.lineType} />}
    </div>
  );
};

export default Filler;
