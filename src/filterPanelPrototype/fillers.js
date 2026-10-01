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
import { opponentFilterLabel } from '../opponentFilters';
import opponentCha from './mock/opponent-cha.json';

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
const ROW_H = 46;

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

const SeasonStrip = ({ seasonLogs, keptDates, lineType, line, stripRows = 4 }) => {
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
          <i className="is-over" /> over <i className="is-under" /> under{' '}
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

/* ---- next opponent: every top-8 / bottom-8 rank (variant I) ------------ */

const EXT_COUNT_H = 30;
const EXT_SUMMARY_H = 28;
const EXT_MIN_H = 12 + 34 + EXT_SUMMARY_H;
const EXT_STRIP_H = 12 + 36 + 7 + 16;
const EXT_ROW_H = 32;
const EXT_MORE_H = 30;

// Team-stats ranks run 1 = fewest allowed. Only the ends of the league count.
const EXTREMES = opponentCha.stats
  .filter((stat) => stat.teamRank <= 8 || stat.teamRank >= 23)
  .map((stat) => {
    const fewest = stat.teamRank <= 8;
    return {
      ...stat,
      fewest,
      place: fewest ? stat.teamRank : 31 - stat.teamRank,
      // The defensive filter ranks 1 = most allowed, so "fewest" is 23–30.
      tier: fewest ? [23, 30] : [1, 8],
    };
  })
  .sort((a, b) => a.place - b.place || a.label.localeCompare(b.label));

const formatStat = (stat) => {
  if (stat.fmt === 'pct') return `${(stat.value * 100).toFixed(1)}%`;
  if (stat.fmt === 'idx') {
    const pct = Math.round((stat.value - 1) * 100);
    return `${pct > 0 ? '+' : ''}${pct}% vs avg`;
  }
  return stat.value.toFixed(1);
};

const OpponentExtremes = ({ rows, expanded, onToggle, panel }) => {
  const summaryOnly = !expanded && rows === 0;
  const shown = expanded ? EXTREMES : EXTREMES.slice(0, rows);
  const hidden = EXTREMES.length - shown.length;
  const most = EXTREMES.filter((stat) => !stat.fewest).length;
  return (
    <div className="fpx-list fpx-ext">
      <button type="button" className="fpx-list-head fpx-ext-head" onClick={onToggle}>
        <span>Next: @ {opponentCha.tricode} · demo game</span>
        <span className="fp-val">
          {most} most · {EXTREMES.length - most} fewest
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
                onClick={() => panel.addDefenseRule(stat.token, stat.tier)}
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
          {EXTREMES.slice(0, 6).map((stat) => (
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

/* ---- variant J: strip with its count, demo game, saved sets ------------- */

const J_MATCH_H = 92;
const J_GAP = 12;
const J_HEAD_H = 34;
const J_SUMMARY_H = 28;
const J_OPP_ROW_H = 32;
const J_MORE_H = 30;
const J_SAVED_ROW_H = 46;
const J_SAVED_MIN = 2;

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
        <span className={`fp-val${pct < 20 ? ' is-thin' : ''}`}>
          {pct < 20 ? 'small sample' : `${pct}%`}
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

const SavedSetsJ = ({ rows, expanded, onToggle }) => {
  const sets = useSavedSets();
  const navigate = useNavigate();
  if (!sets) return null;
  const currentSearch = window.location.search.replace(/^\?/, '');
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
      {(hidden > 0 || (expanded && sets.length > rows)) && (
        <button type="button" className="fpx-ext-more" onClick={onToggle}>
          {expanded ? 'Show fewer' : `+ ${hidden} more`}
        </button>
      )}
    </div>
  );
};

// Everything is always shown; spare height goes to demo-game rows first, then
// saved sets. When even the minimum does not fit, the panel scrolls.
export const FillerJ = ({ panel, extra }) => {
  const [ref, height] = useHeight();
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
    (J_MATCH_H +
      J_GAP +
      J_HEAD_H +
      J_SUMMARY_H +
      J_GAP +
      J_HEAD_H +
      J_SAVED_MIN * J_SAVED_ROW_H +
      J_MORE_H);
  let oppRows = 0;
  if (phone) {
    oppRows = 5;
    spare = J_MORE_H + J_SAVED_ROW_H;
  } else if (!oppOpen) {
    const all = EXTREMES.length;
    const canvas = spare + J_SUMMARY_H;
    if (canvas >= all * J_OPP_ROW_H) {
      oppRows = all;
      spare = canvas - all * J_OPP_ROW_H;
    } else {
      const fit = Math.floor((canvas - J_MORE_H) / J_OPP_ROW_H);
      if (fit >= 2) {
        oppRows = fit;
        spare = canvas - fit * J_OPP_ROW_H - J_MORE_H;
      }
    }
  }
  const savedRows = J_SAVED_MIN + Math.max(0, Math.floor(spare / J_SAVED_ROW_H));

  return (
    <div className="fp-filler is-j" ref={ref}>
      {seasonLogs.length > 0 && (
        <MatchStrip
          seasonLogs={seasonLogs}
          keptDates={keptDates}
          lineType={extra.lineType}
          line={lineFor(extra)}
        />
      )}
      <OpponentExtremes
        rows={oppRows}
        expanded={oppOpen}
        onToggle={() => setOppOpen((open) => !open)}
        panel={panel}
      />
      <SavedSetsJ
        rows={savedRows}
        expanded={savedOpen}
        onToggle={() => setSavedOpen((open) => !open)}
      />
    </div>
  );
};

/* ---- the filler --------------------------------------------------------- */

const Filler = ({ kind, panel, extra }) => {
  const [ref, height] = useHeight();
  const [expanded, setExpanded] = useState(false);
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
  let rows = Math.max(0, Math.floor((room - LIST_HEAD_H) / ROW_H));
  let showStripI = false;

  // Variant I: count, then the opponent summary, then a 3-row strip, then
  // opponent rows (replacing the summary line), then saved sets.
  let extRows = 0;
  let showExt = false;
  let stripRows = 4;
  if (kind === 'saved-extremes') {
    stripRows = 3;
    room = height;
    const count = seasonLogs.length > 0 && room >= EXT_COUNT_H;
    if (count) room -= EXT_COUNT_H;
    showExt = expanded || room >= EXT_MIN_H;
    if (showExt && !expanded) room -= EXT_MIN_H;
    showStripI = count && room >= EXT_STRIP_H;
    if (showStripI) room -= EXT_STRIP_H;
    const all = EXTREMES.length;
    if (showExt && !expanded) {
      const reclaimed = room + EXT_SUMMARY_H;
      if (Math.floor(reclaimed / EXT_ROW_H) >= all) {
        extRows = all;
        room = reclaimed - all * EXT_ROW_H;
      } else {
        const fit = Math.floor((reclaimed - EXT_MORE_H) / EXT_ROW_H);
        if (fit >= 2) {
          extRows = fit;
          room = reclaimed - fit * EXT_ROW_H - EXT_MORE_H;
        }
      }
    }
    rows = expanded ? 3 : Math.max(0, Math.floor((room - LIST_HEAD_H) / ROW_H));
  }

  return (
    <div className={`fp-filler${expanded ? ' is-expanded' : ''}`} ref={ref}>
      {(kind === 'saved-extremes' ? seasonLogs.length > 0 && height >= EXT_COUNT_H : showCount) && (
        <MatchCount kept={gameLogs.length} season={seasonLogs.length} />
      )}
      {showExt && (
        <OpponentExtremes
          rows={extRows}
          expanded={expanded}
          onToggle={() => setExpanded((open) => !open)}
          panel={panel}
        />
      )}
      {showStripI && (
        <SeasonStrip
          seasonLogs={seasonLogs}
          keptDates={keptDates}
          lineType={extra.lineType}
          line={line}
          stripRows={stripRows}
        />
      )}
      {kind !== 'saved-extremes' && showStrip && (
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
      {kind === 'saved-extremes' && (
        <SavedSets rows={rows} currentSearch={window.location.search.replace(/^\?/, '')} />
      )}
      {kind === 'next' && <NextOpponent rows={rows} panel={panel} lineType={extra.lineType} />}
    </div>
  );
};

export default Filler;
