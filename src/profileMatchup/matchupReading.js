/*
 * What the Player Profile's matchup card reads from an Unscheduled Matchup, chosen the way
 * the MCP `get_matchup` card chooses it (statsplus-mcp `tools/matchup_reading.py`:
 * `diet_slices`, `pick_slice_row`, `own_shot_shares`), so the web card and
 * Claude state the same numbers. Everything here selects and relabels backend values; the
 * only arithmetic is the combo decomposition, which reproduces the backend's combo score.
 */

/* The Bases in display order (the Score Matrix's), with the Diet-backed ones first. */
export const BASES = [
  ['shot_types', 'Shot types'],
  ['shot_zones', 'Shot zones'],
  ['play_types', 'Play types'],
  ['assist_locations', 'Assist locations'],
  ['traditional', 'Traditional'],
  ['rebound_types', 'Rebound types'],
];
const BASE_LABELS = Object.fromEntries(BASES);
const DIET_BASES = BASES.filter(([key]) => key !== 'traditional').map(([key]) => key);

/* The Bases drawn as a half court, by region. */
export const COURT_REGIONS = {
  shot_zones: {
    rim: 'Restricted Area',
    paint: 'In The Paint (Non-RA)',
    mid: 'Mid-Range',
    corner: 'Corner 3',
    arc: 'Above the Break 3',
  },
  assist_locations: {
    rim: 'AtRimAssists',
    paint: 'ShortMidRangeAssists',
    mid: 'LongMidRangeAssists',
    corner: 'Corner3Assists',
    arc: 'Arc3Assists',
  },
};

const SLICE_LABELS = {
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
  shot_zones: {
    'Restricted Area': 'Restricted area',
    'In The Paint (Non-RA)': 'Paint (non-RA)',
    'Mid-Range': 'Mid-range',
    'Corner 3': 'Corner 3',
    'Above the Break 3': 'Above-break 3',
  },
  assist_locations: {
    AtRimAssists: 'Rim',
    Arc3Assists: 'Arc 3',
    Corner3Assists: 'Corner 3',
    ShortMidRangeAssists: 'Short mid-range',
    LongMidRangeAssists: 'Long mid-range',
    Assists: 'All assists',
  },
  rebound_types: {
    DefTwoPtRebounds: 'DREB off 2PT misses',
    DefThreePtRebounds: 'DREB off 3PT misses',
    FTDefRebounds: 'DREB off FT misses',
    OffTwoPtRebounds: 'OREB off 2PT misses',
    OffThreePtRebounds: 'OREB off 3PT misses',
    FTOffRebounds: 'OREB off FT misses',
  },
};
const sliceLabel = (base, key) => SLICE_LABELS[base]?.[key] ?? key;

/* A Traditional row's metric in words (`vocabulary.row_metric`). */
const STAT_WORDS = {
  PTS: 'points',
  FG2M: '2PT makes',
  FG2A: '2PT attempts',
  FG3M: '3PT makes',
  FG3A: '3PT attempts',
  FGM: 'field goals made',
  FGA: 'field goal attempts',
  AST: 'assists',
  FTM: 'free throws made',
  FTA: 'free throw attempts',
  REB: 'rebounds',
};
const traditionalMetric = (key) => {
  if (key === 'OPP_TOV') return 'turnovers forced per 48';
  if (key === 'OPP_STL') return 'steals per 48';
  if (key === 'OPP_BLK') return 'blocks per 48';
  const stat = key.replace(/^OPP_/, '');
  return `${STAT_WORDS[stat] ?? stat.toLowerCase()} allowed per 48`;
};

/* The markets a combo adds up, and the stat each one is. */
export const COMBO_STATS = {
  PRA: ['PTS', 'REB', 'AST'],
  PA: ['PTS', 'AST'],
  PR: ['PTS', 'REB'],
  RA: ['REB', 'AST'],
};
const STAT_LABELS = { PTS: 'Points', REB: 'Rebounds', AST: 'Assists' };

/* The markets whose own stat row is PTS. */
const POINTS_MARKETS = new Set(['PTS', 'PA', 'PR', 'PRA']);
/* Single-stat shooting markets read his share of their kind of shot in each shot type. */
const OWN_SHOT_KINDS = { FG3A: '3', '3PM': '3', FG2A: '2', FG2M: '2' };

const splitRowKey = (key) => {
  const at = key.lastIndexOf(':');
  return at < 0 ? [key, key] : [key.slice(0, at), key.slice(at + 1)];
};

const marketRows = (team, base, market) =>
  (team?.defense_sheet?.[base] ?? []).filter(
    (row) =>
      (row.markets ?? []).includes(market) &&
      row.season?.rank != null &&
      row.season?.percent_vs_league_average != null,
  );

/* The stat of a market's own overall row in a Base: PTS for a points market, a shot type's FGM or FGA. */
const ownStat = (base, market) => {
  if (POINTS_MARKETS.has(market)) return 'PTS';
  if (base === 'shot_types' && (market === 'FGM' || market === 'FGA')) return market;
  return null;
};

/* `pick_slice_row`: the market's own overall row, else a scored row over POSS, furthest from league. */
const pickSliceRow = (rows, own) => {
  if (!rows.length) return null;
  const ownRow = own && rows.find((row) => splitRowKey(row.key)[1] === own);
  if (ownRow) return ownRow;
  const scored = rows.filter((row) => splitRowKey(row.key)[1] !== 'POSS');
  return (scored.length ? scored : rows).reduce((best, row) =>
    Math.abs(row.season.percent_vs_league_average) > Math.abs(best.season.percent_vs_league_average)
      ? row
      : best,
  );
};

const dietShares = (player, base) =>
  new Map(
    (player.diet_shares?.[base] ?? [])
      .filter((fact) => fact.season?.share != null)
      .map((fact) => [fact.key, fact.season.share]),
  );

/* `own_shot_shares`: his share of the market's kind of shot in each shot type. */
const ownShotShares = (player, base, market) => {
  const kind = OWN_SHOT_KINDS[market];
  if (base !== 'shot_types' || !kind) return null;
  const volumes = new Map();
  for (const fact of player.diet_shares?.[base] ?? []) {
    const volume = fact.season?.shot_values?.[kind]?.volume;
    if (volume == null) return null;
    volumes.set(fact.key, volume);
  }
  const total = [...volumes.values()].reduce((sum, v) => sum + v, 0);
  if (total <= 0) return null;
  return new Map([...volumes].map(([key, volume]) => [key, volume / total]));
};

/* `diet_slices`: every slice of his Diet in a Base, largest share first, against the opponent's row for it. */
export const dietSlices = (player, team, base, market) => {
  const rows = marketRows(team, base, market);
  const shares = ownShotShares(player, base, market) ?? dietShares(player, base);
  // Largest share first; ties keep the backend's order.
  const order = [...shares.keys()].sort((a, b) => shares.get(b) - shares.get(a));
  return order.map((key) => {
    const slice = { key, label: sliceLabel(base, key), share: shares.get(key) };
    const row = pickSliceRow(
      rows.filter((candidate) => splitRowKey(candidate.key)[0] === key),
      ownStat(base, market),
    );
    return {
      ...slice,
      rank: row ? row.season.rank : null,
      vsLeague: row ? row.season.percent_vs_league_average : null,
    };
  });
};

/* The Traditional row a market reads: the market-tagged row furthest from league average. */
const traditionalRow = (team, market) => {
  const row = pickSliceRow(marketRows(team, 'traditional', market), ownStat('traditional', market));
  return row
    ? {
        metric: traditionalMetric(row.key),
        rank: row.season.rank,
        vsLeague: row.season.percent_vs_league_average,
      }
    : null;
};

/* `season_score`: the Blend, or the single component a one-Base market carries. */
const seasonScore = (window) => {
  if (window?.blend?.value != null) return window.blend.value;
  const components = Object.values(window?.components ?? {}).filter((c) => c?.value != null);
  if (components.length === 1 && !(window.missing_inputs ?? []).length) return components[0].value;
  return null;
};

const readMarket = (player, team, market) => {
  const window = player.scores?.[market]?.season ?? {};
  const components = Object.fromEntries(
    BASES.filter(([key]) => window.components?.[key]?.value != null).map(([key]) => [
      key,
      window.components[key].value,
    ]),
  );
  const bases = DIET_BASES.map((key) => ({
    key,
    label: BASE_LABELS[key],
    slices: dietSlices(player, team, key, market),
  })).filter((base) => base.slices.some((slice) => slice.vsLeague != null));
  return {
    market,
    score: seasonScore(window),
    components,
    bases,
    traditional: 'traditional' in components ? traditionalRow(team, market) : null,
  };
};

/*
 * A combo's score is each stat's score weighted by his season average of it, and each stat's
 * score is the mean of its Bases' components. So a stat contributes weight × score, and each of
 * its Bases weight × component ÷ the number of Bases the stat averages. Which Bases feed a stat
 * is read from the stat's own market in the response; Traditional feeds several and is split.
 */
const decomposeCombo = (markets, averages, combo) => {
  const stats = COMBO_STATS[combo];
  const total = stats.reduce((sum, stat) => sum + (averages[stat] ?? 0), 0) || 1;
  return stats.map((stat) => {
    const single = markets[stat];
    const weight = (averages[stat] ?? 0) / total;
    const fed = Object.entries(single?.components ?? {});
    return {
      stat,
      label: STAT_LABELS[stat],
      weight,
      value: single?.score != null ? weight * single.score : 0,
      bases: fed
        .map(([key, component]) => ({
          key,
          label: BASE_LABELS[key],
          value: (weight * component) / fed.length,
        }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    };
  });
};

/* Everything the card can show for this player against this opponent, every market. */
export const readMatchup = (data, opponent) => {
  const player = data.players[0];
  const team = data.teams.find((candidate) => candidate.tricode === opponent) ?? null;
  const markets = Object.fromEntries(
    Object.keys(player.scores ?? {}).map((market) => [market, readMarket(player, team, market)]),
  );
  const averages = player.season_averages ?? {};
  Object.keys(COMBO_STATS).forEach((combo) => {
    if (markets[combo]) markets[combo].combo = decomposeCombo(markets, averages, combo);
  });
  return {
    player: player.name,
    opponent,
    season: data.as_of?.season ?? null,
    dataDate: data.as_of?.season_defense ?? data.as_of?.player_diets ?? null,
    markets,
  };
};

/* ---- Text, in the MCP card's formats ---- */

/* A % vs league: whole percent, one decimal under 1 so it never reads as zero, "0%" at zero. */
export const vsLeagueText = (percent) => {
  if (percent == null) return '–';
  if (Math.round(percent * 10) === 0) return '0%';
  const size = Math.abs(percent);
  return `${percent > 0 ? '+' : '−'}${size < 0.95 ? size.toFixed(1) : size.toFixed(0)}%`;
};

/* A Matchup Score or a contribution to one (a fraction), to one decimal: "+0.9%". */
export const scoreText = (fraction) => {
  const size = Math.abs(fraction * 100).toFixed(1);
  return size === '0.0' ? '0.0%' : `${fraction > 0 ? '+' : '−'}${size}%`;
};

/* An observed share to the whole percent, halves rounding up. */
export const shareText = (share) => (share == null ? '–' : `${Math.floor(share * 100 + 0.5)}%`);

export const ordinal = (rank) => {
  const teen = rank % 100 >= 11 && rank % 100 <= 13;
  return `${rank}${teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th'}`;
};
