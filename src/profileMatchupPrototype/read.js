/*
 * PROTOTYPE (throwaway). Reads one Base of an Unscheduled Matchup the way
 * statsplus-mcp `matchup_reading.diet_slices` / `driver_for` do, so the card
 * says what get_matchup says.
 */
import { useEffect, useState } from 'react';
import { apiClient, getApiUrl } from '../config';

export const TAB_BASES = {
  Playtypes: { base: 'play_types', label: 'Play types' },
  assists: { base: 'assist_locations', label: 'Assist locations' },
  'Shooting Type': { base: 'shot_types', label: 'Shot types' },
};
export const MARKETS = ['PTS', 'REB', 'AST', '3PM', 'PRA'];

const SLICE_LABELS = {
  shot_zones: {
    'Restricted Area': 'Restricted area',
    'In The Paint (Non-RA)': 'Paint (non-RA)',
    'Mid-Range': 'Mid-range',
    'Corner 3': 'Corner 3',
    'Above the Break 3': 'Above-break 3',
  },
  rebound_types: {
    DefTwoPtRebounds: 'DREB off 2PT misses',
    DefThreePtRebounds: 'DREB off 3PT misses',
    FTDefRebounds: 'DREB off FT misses',
    OffTwoPtRebounds: 'OREB off 2PT misses',
    OffThreePtRebounds: 'OREB off 3PT misses',
    FTOffRebounds: 'OREB off FT misses',
  },
  play_types: {
    Transition: 'Transition',
    Isolation: 'Isolation',
    PRBallHandler: 'PnR ball handler',
    PRRollMan: 'PnR roll man',
    Spotup: 'Spot up',
    Cut: 'Cut',
    Handoff: 'Handoff',
    OffScreen: 'Off screen',
    Postup: 'Post up',
    OffRebound: 'Putback',
    Misc: 'Misc',
  },
  shot_types: {
    'Catch and Shoot': 'Catch & shoot',
    Pullups: 'Pull-ups',
    'Less Than 10 ft': 'Less Than 10 ft',
  },
  assist_locations: {
    AtRimAssists: 'Rim',
    Arc3Assists: 'Arc 3',
    Corner3Assists: 'Corner 3',
    ShortMidRangeAssists: 'Short mid-range',
    LongMidRangeAssists: 'Long mid-range',
  },
};
const POINTS = new Set(['PTS', 'PA', 'PR', 'PRA']);
const MIX = new Set(['PTS', 'PA', 'PR', 'PRA', 'FGA']);

const split = (key) => {
  const i = key.lastIndexOf(':');
  return i < 0 ? [key, key] : [key.slice(0, i), key.slice(i + 1)];
};

const marketRows = (team, base, market) =>
  ((team?.defense_sheet || {})[base] || []).filter(
    (r) =>
      (r.markets || []).includes(market) &&
      r.season?.rank != null &&
      r.season?.percent_vs_league_average != null,
  );

const pickRow = (mine, market) => {
  if (!mine.length) return null;
  if (POINTS.has(market)) {
    const own = mine.find((r) => split(r.key)[1] === 'PTS');
    if (own) return own;
  }
  const scored = mine.filter((r) => split(r.key)[1] !== 'POSS');
  const pool = scored.length ? scored : mine;
  return pool.reduce((a, b) =>
    Math.abs(b.season.percent_vs_league_average) > Math.abs(a.season.percent_vs_league_average)
      ? b
      : a,
  );
};

const shotMix = (player, market) => {
  if (!MIX.has(market)) return null;
  const source = market === 'FGA' ? 'FGA' : 'PTS';
  const slices = player.scores?.[source]?.season?.components?.shot_types?.slices;
  if (!Array.isArray(slices) || !slices.length) return null;
  return Object.fromEntries(
    slices
      .filter((s) => s.key != null && s.percent_vs_league_average != null)
      .map((s) => [s.key, s.percent_vs_league_average]),
  );
};

/* Everything one tab shows for one market. */
export const readBase = (data, opponent, base, market) => {
  const player = data.players[0];
  const team = data.teams.find((t) => t.tricode === opponent);
  const window = player.scores?.[market]?.season || {};
  const component = window.components?.[base];
  const blend = window.blend;
  const mix = base === 'shot_types' ? shotMix(player, market) : null;
  const rows = marketRows(team, base, market);
  const diet = (player.diet_shares?.[base] || [])
    .filter((f) => f.season?.share != null)
    .sort((a, b) => b.season.share - a.season.share);

  const slices = diet.map((fact) => {
    const key = fact.key;
    const out = {
      key,
      label: SLICE_LABELS[base]?.[key] || key,
      share: fact.season.share,
      league: fact.season.league_average_share ?? null,
      sd: fact.season.sigma_deviation ?? null,
      rank: null,
      vs: null,
      mix: false,
      row: null,
    };
    if (mix && key in mix) return { ...out, vs: mix[key], mix: true };
    const row = pickRow(
      rows.filter((r) => split(r.key)[0] === key),
      market,
    );
    if (row)
      return {
        ...out,
        rank: row.season.rank,
        vs: row.season.percent_vs_league_average,
        row: row.key,
      };
    return out;
  });

  // driver_for: the largest-share slice that has a reading.
  const driver = slices.find((s) => s.vs != null)?.key ?? null;
  return {
    slices: slices.map((s) => ({ ...s, driver: s.key === driver })),
    component:
      component && component.value != null
        ? { value: component.value, thin: Boolean(component.thin) }
        : null,
    blend: blend && blend.value != null ? blend.value : null,
    allComponents: window.components || {},
    team: player.tricode || player.team_tricode || null,
  };
};

export const seasonLabel = (data) => {
  const a = data.as_of || {};
  return `Evidence season ${a.season || '–'} · Diets as of ${a.player_diets || '–'} · defense as of ${a.season_defense || '–'}`;
};

/* Fractions (score values) and percents (sheet values) in MCP's wording. */
export const pct = (percent) => {
  if (percent == null) return '–';
  if (Math.round(percent * 10) === 0) return '0%';
  const s = percent > 0 ? '+' : '−';
  const a = Math.abs(percent);
  return `${s}${a < 0.95 ? a.toFixed(1) : a.toFixed(0)}%`;
};
export const score = (fraction) => (fraction == null ? '–' : pct(fraction * 100));
export const share = (fraction) => (fraction == null ? '–' : `${Math.round(fraction * 100)}%`);
export const tone = (percent) =>
  percent == null || Math.round(percent * 10) === 0 ? 'even' : percent > 0 ? 'soft' : 'tough';

const cache = new Map();
export const useMatchup = (playerName, opponent) => {
  const key = `${playerName}|${opponent}`;
  const [state, setState] = useState(() => cache.get(key) || { loading: true });
  useEffect(() => {
    if (cache.has(key)) {
      setState(cache.get(key));
      return undefined;
    }
    let live = true;
    setState({ loading: true });
    apiClient
      .get(getApiUrl('MATCHUP_UNSCHEDULED'), { params: { player_name: playerName, opponent } })
      .then(({ data }) => {
        const next = { data };
        cache.set(key, next);
        if (live) setState(next);
      })
      .catch((error) => live && setState({ error: String(error?.message || error) }));
    return () => {
      live = false;
    };
  }, [key, playerName, opponent]);
  return state;
};
