/*
 * PROTOTYPE (throwaway). A port of statsplus-mcp `src/statsplus_mcp/cards/matchup.html`
 * (origin/main 7e553cc): the same markup, built from the same structured shape
 * the get_matchup tool hands its card, which `toCard` derives from the raw
 * Unscheduled Matchup the web app fetches (the tool's own selection rules,
 * see read.js). Each Player Profile tab draws one Base of it.
 */
import { readBase } from './read';

const DIET_BASES = [
  ['shot_types', 'Shot types'],
  ['shot_zones', 'Shot zones'],
  ['play_types', 'Play types'],
  ['assist_locations', 'Assist locations'],
  ['rebound_types', 'Rebound types'],
];

const MARKET_ORDER = [
  'PTS',
  'REB',
  'AST',
  '3PM',
  'PRA',
  'PA',
  'PR',
  'RA',
  'FGA',
  'FGM',
  'FG2A',
  'FG2M',
  'FG3A',
  'FTA',
  'FTM',
  'STL',
  'BLK',
  'STKS',
  'TOV',
];
const BASES = [
  ['shot_types', 'Shot types'],
  ['shot_zones', 'Shot zones'],
  ['play_types', 'Play types'],
  ['assist_locations', 'Assist locations'],
  ['traditional', 'Traditional'],
  ['rebound_types', 'Rebound types'],
];
const TRAD = {
  OPP_REB: ['Rebounds', 'rebounds allowed per 48'],
  OPP_TOV: ['Turnovers', 'turnovers forced per 48'],
  OPP_STL: ['Steals', 'steals per 48'],
  OPP_BLK: ['Blocks', 'blocks per 48'],
};

/* ---- window.sp from the card's bridge.js ---- */
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const minus = (s) => String(s).replace(/^-/, '−');
const fixed = (a, d) => a.toFixed(d);
const pct = (v) => {
  const p = v * 100;
  if (fixed(Math.abs(p), 1) === '0.0') return '0%';
  return `${p > 0 ? '+' : '−'}${fixed(Math.abs(p), Math.abs(p) < 0.95 ? 1 : 0)}%`;
};
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const wash = (v) => {
  if (Math.round(v * 100) === 0) return '';
  const a = Math.min(0.5, 0.12 + Math.abs(v) * 2.5).toFixed(2);
  return `background: rgb(var(${v > 0 ? '--mcc-up-rgb' : '--mcc-down-rgb'}) / ${a})`;
};
const day = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const SHORT = {
  'Shot types': 'Shot',
  'Shot zones': 'Zone',
  'Play types': 'Play',
  'Assist locations': 'Assist',
  Traditional: 'Trad',
};

/* ---- the tool's text formats (vocabulary.py) ---- */
const percentText = (p) => {
  if (Math.round(p * 10) === 0) return '0%';
  return `${p > 0 ? '+' : '-'}${Math.abs(p) < 0.95 ? Math.abs(p).toFixed(1) : Math.abs(p).toFixed(0)}%`;
};
const shareText = (f) => (f == null ? null : `${Math.round(f * 100)}%`);

const scoreCell = (window) => {
  const blend = window?.blend;
  if (blend && blend.value != null) return { value: blend.value, thin: Boolean(blend.thin) };
  const comps = Object.entries(window?.components || {}).filter(([, c]) => c && c.value != null);
  if (comps.length === 1 && !(window.missing_inputs || []).length) {
    const [base, c] = comps[0];
    return {
      value: c.value,
      thin: Boolean(c.thin),
      no_blend_component: Object.fromEntries(BASES)[base] || base,
    };
  }
  return null;
};

// The card shows Last 15 only when it disagrees with the Season score (matchup.py).
const sameDirection = (a, b) => a > 0 === b > 0 && a < 0 === b < 0;
const disagreeing = (season, last15) =>
  last15 && season && sameDirection(season.value, last15.value) ? null : last15;

/* The get_matchup structured content, for the bases the Profile tabs draw plus Traditional. */
export const toCard = (data, opponent) => {
  const player = data.players[0];
  const team = data.teams.find((t) => t.tricode === opponent);
  const markets = MARKET_ORDER.filter((m) => player.scores?.[m]).map((market) => {
    const season = player.scores[market].season || {};
    const components = Object.fromEntries(
      BASES.filter(([key]) => key !== 'rebound_types' || season.components?.[key]).map(
        ([key, label]) => {
          const c = season.components?.[key];
          return [label, c && c.value != null ? { value: c.value, thin: Boolean(c.thin) } : null];
        },
      ),
    );
    const bases = [];
    DIET_BASES.forEach(([base, label]) => {
      const r = readBase(data, opponent, base, market);
      const slices = r.slices
        .filter((s) => s.vs != null)
        .map((s) => ({
          slice: s.label,
          opponent_rank: s.mix ? null : s.rank,
          vs_league: percentText(s.vs),
          ...(s.mix ? { his_mix: true } : {}),
        }));
      if (slices.length)
        bases.push({
          base: label,
          slices,
          ...(slices.every((s) => s.his_mix) ? { his_mix: true } : {}),
        });
    });
    const trad = (team?.defense_sheet?.traditional || [])
      .filter((r) => (r.markets || []).includes(market) && r.season?.rank != null)
      .sort(
        (a, b) =>
          Math.abs(b.season.percent_vs_league_average) -
          Math.abs(a.season.percent_vs_league_average),
      )[0];
    if (trad && components.Traditional) {
      const [slice, metric] = TRAD[trad.key] || [trad.label, trad.label];
      bases.push({
        base: 'Traditional',
        slices: [
          {
            slice,
            metric,
            opponent_rank: trad.season.rank,
            vs_league: percentText(trad.season.percent_vs_league_average),
          },
        ],
      });
    }
    // matchup._drivers: the 1-2 Bases whose components pull the score its way, strongest first.
    const cells = Object.entries(season.components || {}).filter(([, c]) => c && c.value != null);
    const sc = scoreCell(season);
    const positive = sc
      ? sc.value >= 0
      : Math.max(...cells.map(([, c]) => c.value)) >= -Math.min(...cells.map(([, c]) => c.value));
    cells.sort((x, y) => (positive ? y[1].value - x[1].value : x[1].value - y[1].value));
    const chosen = cells.length
      ? [
          cells[0],
          ...cells.slice(1, 2).filter(([, c]) => c.value > 0 === positive && c.value !== 0),
        ]
      : [];
    const drivers = chosen
      .map(([key]) => {
        const label = Object.fromEntries(BASES)[key];
        if (key === 'traditional') {
          const t = bases.find((b) => b.base === 'Traditional');
          return t ? { base: label, ...t.slices[0], trad: true } : null;
        }
        const r = readBase(data, opponent, key, market);
        const top = r.slices.find((x) => x.vs != null);
        return top
          ? {
              base: label,
              slice: top.label,
              share: shareText(top.share),
              opponent_rank: top.mix ? null : top.rank,
              vs_league: percentText(top.vs),
              his_mix: top.mix,
            }
          : null;
      })
      .filter(Boolean);
    return {
      market,
      drivers,
      season: scoreCell(season),
      last15: disagreeing(scoreCell(season), scoreCell(player.scores[market].last_15)),
      components,
      bases,
    };
  });
  const diet = DIET_BASES.map(([base, label]) => ({
    base: label,
    slices: readBase(data, opponent, base, 'PTS').slices.map((s) => ({
      slice: s.label,
      share: shareText(s.share),
      league_share: shareText(s.league),
    })),
  }));
  return {
    mode: 'unscheduled',
    as_of: data.as_of,
    player: {
      name: player.name,
      team: player.tricode,
      opponent,
      averages: player.season_averages || {},
      last_10_minutes: (player.last_10_minutes || [])
        .map((x) => (typeof x === 'number' ? x : x?.minutes))
        .filter((x) => typeof x === 'number'),
    },
    bases: BASES.map(([, label]) => label),
    diet,
    markets,
  };
};

/* ---- matchup.html, ported ---- */
const REGIONS = {
  'Shot zones': {
    rim: 'Restricted area',
    paint: 'Paint (non-RA)',
    mid: 'Mid-range',
    corner: 'Corner 3',
    arc: 'Above-break 3',
  },
  'Assist locations': {
    rim: 'Rim',
    paint: 'Short mid-range',
    mid: 'Long mid-range',
    corner: 'Corner 3',
    arc: 'Arc 3',
  },
};
const num = (text) => (text == null ? null : parseFloat(String(text).replace('−', '-')));
const soft = (p) =>
  p == null
    ? 'var(--mcc-tint)'
    : `rgb(var(${p >= 0 ? '--mcc-up-rgb' : '--mcc-down-rgb'}) / ${Math.min(0.8, 0.12 + Math.abs(p) / 28).toFixed(2)})`;
const rankPill = (r) =>
  r == null
    ? '<span class="rpill" style="background:var(--mcc-tint);color:var(--mcc-faint)">–</span>'
    : `<span class="rpill" style="background:hsl(${Math.round((r - 1) * 4.1)},62%,42%)">${r}</span>`;
const spark = (xs, w = 64, h = 18) => {
  if (xs.length < 2) return '';
  const mx = Math.max(...xs);
  const mn = Math.min(...xs);
  const pts = xs
    .map(
      (x, i) =>
        `${((i / (xs.length - 1)) * w).toFixed(1)},${(h - 2 - ((x - mn) / (mx - mn || 1)) * (h - 4)).toFixed(1)}`,
    )
    .join(' ');
  return `<svg width="${w}" height="${h}" class="spark" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--mcc-amber)" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
};
const minutesAverage = (xs) =>
  xs.length ? fixed(xs.reduce((a, b) => a + b, 0) / xs.length, 1) : null;

function joined(d, base) {
  const diet = (d.diet || []).find((b) => b.base === base.base);
  const byLabel = Object.fromEntries(((diet && diet.slices) || []).map((s) => [s.slice, s]));
  // The card reads the market's slices; a Diet slice the market has no row for keeps its share.
  const order = ((diet && diet.slices) || []).map((s) => s.slice);
  const reads = Object.fromEntries(base.slices.map((s) => [s.slice, s]));
  return order.length
    ? order.map((label) => ({
        ...byLabel[label],
        ...(reads[label] || { slice: label, opponent_rank: null, vs_league: null }),
      }))
    : base.slices;
}

function court(d, base, opp, plain = false) {
  const map = REGIONS[base.base];
  const by = Object.fromEntries(joined(d, base).map((s) => [s.slice, s]));
  const at = (region) => by[map[region]];
  const fill = (region) => {
    const s = at(region);
    return plain ? 'var(--mcc-tint)' : soft(s ? num(s.vs_league) : null);
  };
  const hy = 75;
  const R3 = 237.5;
  const hoop = 40.5;
  const arc = `M30 0 L30 140 A${R3} ${R3} 0 0 0 470 140 L470 0`;
  const ra = `M190 0 L190 ${hy} A60 60 0 0 0 310 ${hy} L310 0`;
  const shape = (region, el) =>
    el.replace('/>', ` data-region="${region}" style="fill:${fill(region)}"/>`);
  const ground = (el) => el.replace('/>', ' style="fill:var(--mcc-ground)"/>');
  const svg = `<svg class="court" viewBox="0 0 500 400" role="img" aria-label="${esc(base.base)} half court">
      ${ground('<rect width="500" height="400"/>')}${shape('arc', '<rect width="500" height="400"/>')}
      ${shape('corner', '<rect width="30" height="140"/>')}${shape('corner', '<rect x="470" width="30" height="140"/>')}
      ${ground(`<path d="${arc} Z"/>`)}${shape('mid', `<path d="${arc} Z"/>`)}
      ${ground('<rect x="170" width="160" height="190"/>')}${shape('paint', '<rect x="170" width="160" height="190"/>')}
      ${ground(`<path d="${ra} Z"/>`)}${shape('rim', `<path d="${ra} Z"/>`)}
      <g fill="none" stroke="var(--mcc-ground)" stroke-width="3"><path d="${arc}"/><rect x="170" width="160" height="190"/><path d="${ra}"/></g>
      <rect width="500" height="400" fill="none" stroke="var(--mcc-line-strong)" stroke-width="2"/>
      <circle cx="250" cy="${hoop}" r="7.5" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="2"/>
      <line x1="220" x2="280" y1="${hoop - 10}" y2="${hoop - 10}" stroke="currentColor" stroke-opacity=".5" stroke-width="3"/>
    </svg>`;
  const label = (region, x, y, rot) => {
    const s = at(region);
    if (!s) return '';
    const rank =
      s.opponent_rank == null
        ? 'no opponent row'
        : `${esc(opp)} ${ordinal(s.opponent_rank)} (${esc(s.vs_league)} vs league)`;
    if (plain)
      return `<div class="rl pl${rot ? ' rot' : ''}" data-region="${region}" style="left:${(x / 5).toFixed(1)}%;top:${(y / 4).toFixed(1)}%" title="${esc(s.slice)}: ${esc(s.share)} of his ${esc(base.base)} · ${rank}"><b>${esc(s.share)}</b>${rot ? '' : sPill(s)}</div>`;
    const second = rot
      ? ''
      : `<small>${s.opponent_rank == null ? '–' : ordinal(s.opponent_rank)} · ${s.vs_league == null ? '–' : esc(minus(s.vs_league))}</small>`;
    return `<div class="rl${rot ? ' rot' : ''}" data-region="${region}" style="left:${(x / 5).toFixed(1)}%;top:${(y / 4).toFixed(1)}%" title="${esc(s.slice)}: ${esc(s.share)} of his ${esc(base.base)} Diet · ${rank}"><b>${esc(s.share)}</b>${second}</div>`;
  };
  const labels =
    label('rim', 250, 86) +
    label('paint', 250, 162) +
    label('mid', 250, 242) +
    label('arc', 250, 337) +
    label('corner', 18, 70, true) +
    label('corner', 483, 70, true);
  return `<div class="courtbox">${svg}${labels}</div>`;
}

function courtKey(d, base, opp) {
  const slices = joined(d, base);
  const s = slices.reduce((a, b) => (num(b.share) > num(a.share) ? b : a), slices[0]);
  if (!s) return '';
  const noun = base.base === 'Assist locations' ? 'assists' : 'shots';
  const gap = Object.values(REGIONS[base.base]).some(
    (label) => !slices.some((x) => x.slice === label && x.vs_league != null),
  );
  return `<div class="zkey">
      <div class="rl" style="background:${soft(num(s.vs_league))}"><b>${esc(s.share)}</b><small>${s.opponent_rank == null ? '–' : ordinal(s.opponent_rank)} · ${s.vs_league == null ? '–' : esc(minus(s.vs_league))}</small></div>
      <div class="lines"><span>Share of his ${noun} from this zone</span><span>${esc(opp)}'s rank (30th = most) · vs league</span></div>
      ${gap ? '<i class="none"></i><span>No data for this zone</span>' : ''}
    </div>`;
}

function butterfly(d, m, base, opp, { limit = null, open = false } = {}) {
  const all = joined(d, base);
  const hidden = limit && !open ? Math.max(0, all.length - limit) : 0;
  const slices = hidden ? all.slice(0, limit) : all;
  const mx = Math.max(
    0.4,
    ...slices.map((s) => Math.max(num(s.share) / 100 || 0, num(s.league_share) / 100 || 0)),
  );
  const comp = m.components[base.base];
  const mix = slices.length > 0 && slices.every((x) => x.his_mix);
  const rows = slices
    .map((s) => {
      const noShare = s.share == null;
      const share = noShare ? 0 : num(s.share) / 100;
      const league = s.league_share == null ? null : num(s.league_share) / 100;
      const v = num(s.vs_league);
      const w = v == null ? 0 : Math.min(50, (Math.abs(v) / 30) * 50);
      const tip = `${s.slice}: ${noShare ? 'no Diet share' : `${s.share} of his Diet`}${s.league_share == null ? '' : ` (league ${s.league_share})`} · ${s.his_mix ? `${s.vs_league} vs league for his mix of 2s and 3s` : s.opponent_rank == null ? 'no opponent row' : `${opp} ${ordinal(s.opponent_rank)} (${s.vs_league} vs league)`}`;
      return `<span class="t l">${noShare ? '–' : esc(s.share)}</span>
        <div class="lb">${noShare ? '' : `<i style="width:${((share / mx) * 100).toFixed(1)}%"></i>`}${league == null ? '' : `<s style="right:${((league / mx) * 100).toFixed(1)}%"></s>`}</div>
        <span class="lab" title="${esc(tip)}">${esc(s.slice)}</span>
        <div class="rb">${v == null ? '' : `<i style="${v >= 0 ? 'left:50%' : 'right:50%'};width:${w.toFixed(1)}%;background:${soft(v)}"></i>`}</div>
        <span class="t r"><span>${s.vs_league == null ? '–' : esc(minus(s.vs_league))}</span><span>${s.opponent_rank == null ? '' : ordinal(s.opponent_rank)}</span></span>`;
    })
    .join('');
  return `<div class="sec"><span>${esc(base.base)} · ${esc(m.market)}</span><span class="rk ${comp && comp.value >= 0 ? 'up' : 'down'}">${comp ? pct(comp.value) : ''}</span></div>
      <div class="bf" aria-label="${esc(base.base)}: his Diet against what ${esc(opp)} allows">
        <span class="hd l" title="Share of his volume; the tick marks the league average">His Diet</span><span class="hd r" title="% vs league, then ${esc(opp)}'s rank (30th = allows the most)">${mix ? `${esc(opp)} allows, for his mix` : `${esc(opp)} allows`}</span>${rows}${
          limit && all.length > limit
            ? `<button type="button" class="more" data-more="${esc(base.base)}">${open ? 'Show fewer' : `+${hidden} more`}</button>`
            : ''
        }</div>`;
}

function tradRow(m, opp) {
  const base = (m.bases || []).find((x) => x.base === 'Traditional');
  const comp = m.components.Traditional;
  const t = base && base.slices[0];
  if (!t || !comp) return '';
  const allowed = /^(.*) allowed per 48$/.exec(t.metric);
  const what = allowed ? `${esc(opp)} allows ${esc(allowed[1])}` : `${esc(opp)}: ${esc(t.metric)}`;
  const vs = t.vs_league ? `, ${esc(minus(t.vs_league))} vs league per 48` : '';
  return `<div class="sec"><span>Traditional · ${esc(m.market)}</span></div>
      <div class="trad">${rankPill(t.opponent_rank)}<div><b>${what}</b> · ${ordinal(t.opponent_rank)} in the league${vs}</div><span class="rk ${comp.value >= 0 ? 'up' : 'down'}">${pct(comp.value)}</span></div>`;
}

/* The card's draw(), with the body narrowed to one Base: the tab's. */
export const drawCard = (d, picked) => {
  const m = d.markets.find((x) => x.market === picked) || d.markets[0];
  const opp = d.player.opponent;
  const minutes = d.player.last_10_minutes || [];
  const average = minutesAverage(minutes);
  const asOf = d.as_of && (d.as_of.season_defense || d.as_of.player_diets);
  const meta = `${esc(d.player.team || 'team n/a')} vs <b>${esc(opp)}</b> · Unscheduled Matchup (no scheduled game) · data as of ${esc(asOf ? day(asOf) : 'an unreported date')}`;
  const season = m.season;
  const pill = season
    ? `<span class="pill" style="${wash(season.value)}">${pct(season.value)}</span>`
    : '<span class="pill">—</span>';
  const tiles = d.markets
    .map((x) => {
      const s = x.season;
      const tone = !s || Math.round(s.value * 100) === 0 ? '' : s.value > 0 ? ' up' : ' down';
      return `<button type="button" class="tile mk${x === m ? ' on' : ''}${s && s.thin ? ' thin' : ''}" data-market="${esc(x.market)}" aria-pressed="${x === m}">
        <span class="k">${esc(x.market)}</span><span class="v${tone}">${s ? pct(s.value) : '—'}</span>${x.last15 ? `<span class="l15">L15 ${pct(x.last15.value)}</span>` : ''}</button>`;
    })
    .join('');
  const chips = d.bases
    .filter((b) => m.components[b])
    .map((b) => {
      const c = m.components[b];
      return `<span class="cchip${c.thin ? ' thin' : ''}" style="${wash(c.value)}">${esc(SHORT[b] || b)} <b>${pct(c.value)}</b>${c.thin ? '<em>low conf.</em>' : ''}</span>`;
    })
    .join('');
  const blend =
    season && !season.no_blend_component
      ? `<span class="cchip blend${season.thin ? ' thin' : ''}" style="${wash(season.value)}">Blend <b>${pct(season.value)}</b>${season.thin ? '<em>low conf.</em>' : ''}${m.last15 ? `<span class="l15">Last 15 <b>${pct(m.last15.value)}</b></span>` : ''}</span>`
      : '';

  // matchup.html draw(): the first spatial Base is the court, every other Diet Base a butterfly.
  const bases = (m.bases || []).filter((b) => b.base !== 'Traditional');
  const spatial = bases.find((b) => REGIONS[b.base]);
  const others = bases.filter((b) => b !== spatial);
  const sc = spatial && m.components[spatial.base];
  const left = spatial
    ? `<div><div class="sec"><span>${esc(spatial.base)} · ${esc(m.market)}</span><span class="rk ${sc && sc.value >= 0 ? 'up' : 'down'}">${sc ? pct(sc.value) : ''}</span></div>
          ${court(d, spatial, opp)}
          <div class="legend"><b>${esc(opp)} allows vs league</b><span>Less</span><span class="grad"></span><span>More</span></div>
          ${courtKey(d, spatial, opp)}</div>`
    : '';
  const key = others.length
    ? `<div class="sub bfkey"><b>His Diet:</b> share of his volume; the tick marks the league average.<br><b>${esc(opp)} allows:</b> % vs league, then rank (30th = most).</div>`
    : '';
  const trad = tradRow(m, opp);
  const right = others.map((b) => butterfly(d, m, b, opp)).join('') + key + trad;
  const body =
    left || right
      ? `<div class="layout${left && right ? '' : ' solo'}">${left}${right ? `<div>${right}</div>` : ''}</div>`
      : `<p class="sub">No Diet-based Base for ${esc(m.market)}.</p>`;
  const a = d.as_of || {};
  const footer = `<details class="as-of rule"><summary>Data as of ${esc(asOf ? day(asOf) : '–')}</summary><p>Completed ${esc(a.season || '')} season: Season defense ${esc(a.season_defense || '–')}, Last 15 defense ${esc(a.last_15_defense || '–')}, player Diets ${esc(a.player_diets || '–')}.</p></details>`;

  return `<div class="mh">
        <div class="who">
          <div class="nm">${esc(d.player.name)}</div>
          <div class="meta">${meta}</div>
        </div>
        <div class="sc"><div class="brand">CourtAI</div>${pill}<div class="meta">${esc(m.market)} Matchup Score${season && season.thin ? ' · low confidence' : ''}${season && season.no_blend_component ? ` · ${esc(season.no_blend_component)} only` : ''}</div></div>
      </div>
      <p class="season-line">Evidence season ${esc(a.season || '–')}</p>
      <div class="sstrip" role="group" aria-label="Market">
        <div class="tile minutes"><span class="k">MIN, last 10</span><span class="v">${average == null ? '—' : average}${spark(minutes)}</span></div>
        ${tiles}
      </div>
      <div class="comps" aria-label="Season Matchup Score by Base">${chips}${blend}</div>
      ${body}
      ${footer}`;
};

/* Variant G: the same card, trimmed. The market comes from the game logs, the
   header is one line, the keys are one line each, butterflies show five slices. */
export const drawCardG = (d, picked, { note = '', open = new Set() } = {}) => {
  const m = d.markets.find((x) => x.market === picked) || d.markets[0];
  const opp = d.player.opponent;
  const a = d.as_of || {};
  const asOf = a.season_defense || a.player_diets;
  const season = m.season;
  const pill = season
    ? `<span class="pill" style="${wash(season.value)}">${pct(season.value)}</span>`
    : '<span class="pill">—</span>';
  const l15 = m.last15 ? `<span class="gl15">L15 ${pct(m.last15.value)}</span>` : '';
  const chips = d.bases
    .filter((b) => m.components[b])
    .map((b) => {
      const c = m.components[b];
      return `<span class="cchip${c.thin ? ' thin' : ''}" style="${wash(c.value)}">${esc(SHORT[b] || b)} <b>${pct(c.value)}</b></span>`;
    })
    .join('');
  const bases = (m.bases || []).filter((b) => b.base !== 'Traditional');
  const spatial = bases.find((b) => REGIONS[b.base]);
  const others = bases.filter((b) => b !== spatial);
  const sc = spatial && m.components[spatial.base];
  const left = spatial
    ? `<div class="gleft"><div class="sec"><span>${esc(spatial.base)} · ${esc(m.market)}</span><span class="rk ${sc && sc.value >= 0 ? 'up' : 'down'}">${sc ? pct(sc.value) : ''}</span></div>
          ${court(d, spatial, opp)}
          <div class="gkey"><span>share · ${esc(opp)} rank (30th = most) · vs league</span><span class="glegend">Less<span class="grad"></span>More</span></div></div>`
    : '';
  const key = others.length
    ? `<div class="gnote">Left: his share, tick = league. Right: ${esc(opp)} % vs league, rank (30th = most).</div>`
    : '';
  const right =
    others.map((b) => butterfly(d, m, b, opp, { limit: 5, open: open.has(b.base) })).join('') +
    key +
    tradRow(m, opp);
  const body =
    left || right
      ? `<div class="layout g${left && right ? '' : ' solo'}">${left}${right ? `<div>${right}</div>` : ''}</div>`
      : `<p class="sub">No Diet-based Base for ${esc(m.market)}.</p>`;
  return `<div class="gh">
        <div class="gt"><b>${esc(d.player.name)}</b> vs <b>${esc(opp)}</b> · Unscheduled · ${esc(a.season || '–')} · data as of ${esc(asOf ? day(asOf) : '–')}</div>
        <div class="gs">${pill}<span class="gm">${esc(m.market)}${season && season.no_blend_component ? ` · ${esc(season.no_blend_component)} only` : ''}</span>${l15}</div>
      </div>
      ${note ? `<p class="gfall">${esc(note)}</p>` : ''}
      <div class="comps g">${chips}</div>
      ${body}`;
};

/* Variants H1-H3: between F and G in size, with three ways to read his Diet mix.
   The right half (what the opponent allows) is the card's, unchanged. */
const MIX_COLORS = [
  'var(--ct-gold-fill)',
  'rgb(var(--ct-series-lead-fg-rgb))',
  'rgb(var(--ct-series-kept-fg-rgb))',
  'rgb(var(--ct-series-pink-fg-rgb))',
  'rgb(var(--ct-slate-fg-rgb))',
];

const rightHalf = (s) => {
  const v = num(s.vs_league);
  const w = v == null ? 0 : Math.min(50, (Math.abs(v) / 30) * 50);
  return `<div class="rb">${v == null ? '' : `<i style="${v >= 0 ? 'left:50%' : 'right:50%'};width:${w.toFixed(1)}%;background:${soft(v)}"></i>`}</div>
        <span class="t r"><span>${s.vs_league == null ? '–' : esc(minus(s.vs_league))}</span><span>${s.opponent_rank == null ? '' : ordinal(s.opponent_rank)}</span></span>`;
};

const mixStrip = (who, slices, key) => {
  const top = slices.slice(0, 5);
  const rest = slices.slice(5).reduce((sum, s) => sum + (num(s[key]) || 0), 0);
  const segs = top
    .map((s, i) => {
      const v = num(s[key]) || 0;
      return `<i style="width:${v}%;background:${MIX_COLORS[i]}" title="${esc(s.slice)} ${v}%">${v >= 13 ? `<em>${esc(s.slice)}</em>` : ''}</i>`;
    })
    .join('');
  const other =
    rest > 0.5
      ? `<i class="oth" style="width:${rest}%" title="other ${Math.round(rest)}%">${rest >= 13 ? '<em>other</em>' : ''}</i>`
      : '';
  return `<div class="hstrip"><span class="who">${esc(who)}</span><div class="bar">${segs}${other}</div></div>`;
};

function butterflyH(d, m, base, opp, mode, open) {
  const all = joined(d, base);
  const limit = 6;
  const hidden = !open ? Math.max(0, all.length - limit) : 0;
  const slices = hidden ? all.slice(0, limit) : all;
  const mx = Math.max(...all.map((s) => Math.max(num(s.share) || 0, num(s.league_share) || 0)), 1);
  const comp = m.components[base.base];
  const mix = all.length > 0 && all.every((x) => x.his_mix);
  const leftHead = {
    H1: 'His Diet · <span class="notch-key"></span> league',
    H2: 'His Diet <span class="dot-key gold"></span> him <span class="dot-key hollow"></span> league',
    H3: 'His share · league',
  }[mode];
  const rows = slices
    .map((s, i) => {
      const share = num(s.share);
      const league = num(s.league_share);
      const tip = `${s.slice}: ${s.share ?? '–'} of his Diet (league ${s.league_share ?? '–'})`;
      let left;
      if (mode === 'H1') {
        const delta = share != null && league != null ? Math.round(share - league) : null;
        const chip =
          delta == null
            ? ''
            : `<span class="dchip ${delta > 0 ? 'dup' : 'ddown'}">${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)}<span class="vl"> vs lg</span></span>`;
        left = `<div class="h1l"><span class="h1t"><b>${esc(s.share ?? '–')}</b>${chip}</span><div class="h1bar"><i style="width:${(((share || 0) / mx) * 100).toFixed(1)}%"></i>${league == null ? '' : `<s style="right:${((league / mx) * 100).toFixed(1)}%"></s>`}</div></div>`;
      } else if (mode === 'H2') {
        const a = ((share || 0) / mx) * 100;
        const b = league == null ? a : (league / mx) * 100;
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const over = a >= b;
        left = `<div class="h2l"><div class="h2axis">
            <span class="h2line ${over ? 'h2up' : 'h2down'}" style="left:${lo.toFixed(1)}%;width:${(hi - lo).toFixed(1)}%"></span>
            ${league == null ? '' : `<span class="h2dot hollow" style="left:${b.toFixed(1)}%"></span><span class="h2lab lg ${over ? 'before' : 'after'}" style="left:${b.toFixed(1)}%">lg ${esc(s.league_share)}</span>`}
            <span class="h2dot gold" style="left:${a.toFixed(1)}%"></span><span class="h2lab me ${over ? 'after' : 'before'}" style="left:${a.toFixed(1)}%">${esc(s.share ?? '–')}</span>
          </div></div>`;
      } else {
        const sw =
          i < 5
            ? `<span class="sw" style="background:${MIX_COLORS[i]}"></span>`
            : '<span class="sw oth"></span>';
        left = `<div class="h3l"><b>${esc(s.share ?? '–')}</b> <span class="lg">· lg ${esc(s.league_share ?? '–')}</span>${sw}</div>`;
      }
      return `${left}<span class="lab" title="${esc(tip)}">${esc(s.slice)}</span>${rightHalf(s)}`;
    })
    .join('');
  const strips =
    mode === 'H3'
      ? `<div class="hstrips">${mixStrip(d.player.name.split(' ').slice(-1)[0], all, 'share')}${mixStrip('League', all, 'league_share')}</div>`
      : '';
  const more =
    all.length > limit
      ? `<button type="button" class="more" data-more="${esc(base.base)}">${open ? 'Show fewer' : `+${hidden} more`}</button>`
      : '';
  return `<div class="sec"><span>${esc(base.base)} · ${esc(m.market)}</span><span class="rk ${comp && comp.value >= 0 ? 'up' : 'down'}">${comp ? pct(comp.value) : ''}</span></div>
      ${strips}<div class="bfh ${mode}" aria-label="${esc(base.base)}: his Diet against what ${esc(opp)} allows">
        <span class="hd l">${leftHead}</span><span class="hd r">${mix ? `${esc(opp)} allows, for his mix` : `${esc(opp)} allows`}</span>${rows}${more}</div>`;
}

export const drawCardH = (d, picked, { note = '', open = new Set(), mode = 'H1' } = {}) => {
  const m = d.markets.find((x) => x.market === picked) || d.markets[0];
  const opp = d.player.opponent;
  const a = d.as_of || {};
  const asOf = a.season_defense || a.player_diets;
  const season = m.season;
  const pill = season
    ? `<span class="pill" style="${wash(season.value)}">${pct(season.value)}</span>`
    : '<span class="pill">—</span>';
  const l15 = m.last15 ? `<span class="gl15">L15 ${pct(m.last15.value)}</span>` : '';
  const chips = d.bases
    .filter((b) => m.components[b])
    .map((b) => {
      const c = m.components[b];
      return `<span class="cchip${c.thin ? ' thin' : ''}" style="${wash(c.value)}">${esc(SHORT[b] || b)} <b>${pct(c.value)}</b></span>`;
    })
    .join('');
  const blend =
    season && !season.no_blend_component
      ? `<span class="cchip blend" style="${wash(season.value)}">Blend <b>${pct(season.value)}</b></span>`
      : '';
  const bases = (m.bases || []).filter((b) => b.base !== 'Traditional');
  const spatial = bases.find((b) => REGIONS[b.base]);
  const others = bases.filter((b) => b !== spatial);
  const sc = spatial && m.components[spatial.base];
  const left = spatial
    ? `<div class="hleft"><div class="sec"><span>${esc(spatial.base)} · ${esc(m.market)}</span><span class="rk ${sc && sc.value >= 0 ? 'up' : 'down'}">${sc ? pct(sc.value) : ''}</span></div>
          ${court(d, spatial, opp)}
          <div class="legend"><b>${esc(opp)} allows vs league</b><span>Less</span><span class="grad"></span><span>More</span></div>
          <div class="hkey">Each zone: his share, then ${esc(opp)}'s rank (30th = most) · vs league</div></div>`
    : '';
  const key = others.length
    ? `<div class="sub bfkey"><b>${esc(opp)} allows:</b> % vs league, then rank (30th = most).</div>`
    : '';
  const right =
    others.map((b) => butterflyH(d, m, b, opp, mode, open.has(b.base))).join('') +
    key +
    tradRow(m, opp);
  const body =
    left || right
      ? `<div class="layout h${left && right ? '' : ' solo'}">${left}${right ? `<div>${right}</div>` : ''}</div>`
      : `<p class="sub">No Diet-based Base for ${esc(m.market)}.</p>`;
  return `<div class="gh hh">
        <div class="gt"><b>${esc(d.player.name)}</b> vs <b>${esc(opp)}</b> · Unscheduled · ${esc(a.season || '–')} · data as of ${esc(asOf ? day(asOf) : '–')}</div>
        <div class="gs">${pill}<span class="gm">${esc(m.market)} Matchup Score${season && season.no_blend_component ? ` · ${esc(season.no_blend_component)} only` : ''}</span>${l15}</div>
      </div>
      ${note ? `<p class="gfall">${esc(note)}</p>` : ''}
      <div class="comps">${chips}${blend}</div>
      ${body}`;
};

/* Variants S1-S3: where his volume comes from, and whether the opponent allows more there.
   Rank colour is the only colour. */
const sPill = (s) =>
  s.opponent_rank == null
    ? `<span class="spill none" title="${esc(s.his_mix ? `${s.vs_league} vs league for his mix of 2s and 3s` : 'no opponent row')}">–</span>`
    : `<span class="spill" style="background:hsl(${Math.round((s.opponent_rank - 1) * 4.1)},55%,40%)" title="${esc(ordinal(s.opponent_rank))} of 30 (30th = allows the most) · ${esc(s.vs_league)} vs league">${ordinal(s.opponent_rank)}</span>`;

const NOUN = {
  'Shot types': 'shots',
  'Shot zones': 'shots',
  'Play types': 'plays',
  'Assist locations': 'assists',
  'Rebound types': 'rebounds',
};

const sRow = (s) => `<div class="srow">
    <span class="sn">${esc(s.slice)}</span>
    <span class="ss"><b>${esc(s.share ?? '–')}</b></span>
    ${sPill(s)}<span class="sv">${s.vs_league == null ? '' : esc(minus(s.vs_league))}</span>
  </div>`;

const sGroups = (d, m, bases, all) =>
  bases
    .map((b) => {
      const rows = joined(d, b);
      return `<div class="sgrp"><div class="sbase">${esc(b.base)}${rows.every((x) => x.his_mix) ? ' <i>· for his mix of 2s and 3s</i>' : ''}</div>${(all ? rows : rows.slice(0, 3)).map(sRow).join('')}</div>`;
    })
    .join('');

const sTrad = (m, opp) => {
  const t = (m.bases || []).find((b) => b.base === 'Traditional');
  if (!t || !m.components.Traditional) return '';
  const r = t.slices[0];
  return `<div class="sgrp"><div class="sbase">Traditional</div><div class="srow"><span class="sn">${esc(opp)}: ${esc(r.metric)}</span><span class="ss"></span>${sPill(r)}<span class="sv">${esc(minus(r.vs_league))}</span></div></div>`;
};

const driverSentence = (dr, opp) => {
  const vs = `${minus(dr.vs_league)} vs league`;
  if (dr.trad)
    return `${esc(opp)} ranks ${ordinal(dr.opponent_rank)} of 30 in ${esc(dr.metric)}, ${esc(vs)}.`;
  const first = `${esc(dr.share)} of his ${NOUN[dr.base] || 'volume'} are ${esc(dr.slice)}.`;
  if (dr.opponent_rank == null)
    return `${first} ${esc(opp)} allows ${esc(vs)} for his mix of 2s and 3s.`;
  const r = dr.opponent_rank;
  const where =
    r >= 16
      ? r === 30
        ? 'the most'
        : `the ${ordinal(31 - r)} most`
      : r === 1
        ? 'the fewest'
        : `the ${ordinal(r)} fewest`;
  return `${first} ${esc(opp)} allows ${where} (${ordinal(r)} of 30), ${esc(vs)}.`;
};

export const drawCardS = (
  d,
  picked,
  { note = '', mode = 'S1', open = new Set(), combo = 'C1', picker = null } = {},
) => {
  const m = d.markets.find((x) => x.market === picked) || d.markets[0];
  const opp = d.player.opponent;
  const a = d.as_of || {};
  const asOf = a.season_defense || a.player_diets;
  const season = m.season;
  const pill = season
    ? `<span class="pill" style="${wash(season.value)}">${pct1(season.value)}</span>`
    : '<span class="pill">—</span>';
  const info = `Share: his share of each Base for ${m.market}; lg = league average share. Pill: ${opp}'s rank, 30th = allows the most (green). % = ${opp} vs league. Score: ${m.market} Season Matchup Score${m.last15 ? `; Last 15 ${pct1(m.last15.value)}` : ''}.`;
  const head = `<div class="gh sh">
      <div class="gt"><b>${esc(d.player.name)}</b> vs <b>${esc(opp)}</b> · ${esc(a.season || '–')} · data as of ${esc(asOf ? day(asOf) : '–')} <span class="sinfo" tabindex="0" title="${esc(info)}">ⓘ</span></div>
      <div class="gs">${pill}${
        picker
          ? `<select class="smkt" data-market-select aria-label="Market (sets the game logs' Line Type)">${picker.groups
              .map(
                (g) =>
                  `<optgroup label="${esc(g.label)}">${g.options
                    .map(
                      (o) =>
                        `<option value="${esc(o.value)}"${o.value === picker.value ? ' selected' : ''}>${esc(o.label)}</option>`,
                    )
                    .join('')}</optgroup>`,
              )
              .join('')}</select>`
          : `<span class="gm">${esc(m.market)}</span>`
      }</div>
    </div>${note ? `<p class="gfall">${esc(note)}</p>` : ''}`;
  const bases = (m.bases || []).filter((b) => b.base !== 'Traditional');
  const all = open.has('all');
  const toggle = (label) =>
    `<button type="button" class="more" data-more="all">${all ? 'Show less' : label}</button>`;
  const title = `<div class="stitle">Where his ${esc(m.market)} come from</div>`;
  const list = (bs, showToggle = true) =>
    `${sGroups(d, m, bs, all)}${sTrad(m, opp)}${showToggle && bs.some((b) => b.slices.length > 3 || joined(d, b).length > 3) ? toggle('Show all') : ''}`;
  let body;
  if (!bases.length && !sTrad(m, opp))
    body = `<p class="sub">No Diet-based Base for ${esc(m.market)}.</p>`;
  else if (mode === 'S1') body = `${title}<div class="slist">${list(bases)}</div>`;
  else if (mode === 'S2') {
    const spatial = bases.find((b) => REGIONS[b.base]);
    const others = bases.filter((b) => b !== spatial);
    body = `${title}<div class="s2${spatial && others.length ? '' : ' solo'}">${spatial ? `<div><div class="sbase">${esc(spatial.base)}</div>${court(d, spatial, opp, true)}</div>` : ''}${others.length || sTrad(m, opp) ? `<div class="slist">${list(others)}</div>` : ''}</div>`;
  } else if (mode === 'S4' && COMBO_PARTS[m.market]) {
    body = comboBody(d, m, opp, combo, open);
  } else if (mode === 'S4') {
    // S2's list beside the card's own coloured court; with no other Base (AST), the list is the court's Base.
    const spatial = bases.find((b) => REGIONS[b.base]);
    const others = bases.filter((b) => b !== spatial);
    const listed = others.length ? others : spatial ? [spatial] : [];
    const courtCol = spatial
      ? `<div><div class="sbase">${esc(spatial.base)}</div>${court(d, spatial, opp)}<div class="legend"><b>${esc(opp)} allows vs league</b><span>Less</span><span class="grad"></span><span>More</span></div></div>`
      : '';
    body = `${title}<div class="layout s4${courtCol ? '' : ' solo'}">${courtCol}<div class="slist">${list(listed)}</div></div>`;
  } else {
    const sentences = (m.drivers || []).map((dr) => `<p>${driverSentence(dr, opp)}</p>`).join('');
    body = `<div class="sdrivers">${sentences || `<p>No driver for ${esc(m.market)}.</p>`}</div>
      <details class="sfull"${open.has('full') ? ' open' : ''}><summary data-more="full">See full breakdown</summary>${title}<div class="slist">${list(bases)}</div></details>`;
  }
  return `${head}${body}`;
};

/* Combo markets (PRA, PA, PR, RA) in S4: no court. Each part of the line reads the Base that feeds it;
   the combo's component for a Base is the part's own component scaled by the part's share of his line. */
const COMBO_PARTS = {
  PRA: ['PTS', 'REB', 'AST'],
  PA: ['PTS', 'AST'],
  PR: ['PTS', 'REB'],
  RA: ['REB', 'AST'],
};
const PART = {
  PTS: { label: 'Points', bases: ['Play types', 'Shot zones', 'Shot types'] },
  REB: { label: 'Rebounds', bases: ['Rebound types'] },
  AST: { label: 'Assists', bases: ['Assist locations'] },
};
const BASE_TAG = {
  'Play types': 'Play type',
  'Shot zones': 'Shot zone',
  'Shot types': 'Shot type',
  'Assist locations': 'Assist loc',
  'Rebound types': 'Reb type',
};

/* The Base waterfall. W bars are the Base components as the response (and MCP) state them. Those do not
   add up to the combo score: the backend averages each stat's Bases, then weights the stats by his line.
   W2 bars are each Base's contribution to the score (its component divided by the Bases its stat averages),
   which do add up to it. */
/* How the backend builds a combo score (checked on every sample player and combo): each stat's score is
   the mean of its Bases' components, and the combo is the stats' scores weighted by his season averages.
   So a Base's share of the combo is, summed over the stats it feeds, weight x component / Bases in that
   stat. Traditional feeds PTS, REB and AST alike, so it is split per stat rather than mapped to one. */
const decompose = (d, m) => {
  const parts = COMBO_PARTS[m.market];
  const avg = d.player.averages || {};
  const total = parts.reduce((sum, k) => sum + (avg[k] || 0), 0) || 1;
  return parts.map((key) => {
    const single = d.markets.find((x) => x.market === key);
    const comps = Object.entries((single && single.components) || {}).filter(([, c]) => c);
    const weight = (avg[key] || 0) / total;
    return {
      key,
      label: PART[key].label,
      weight,
      single,
      value: single && single.season ? weight * single.season.value : 0,
      bases: comps.map(([base, c]) => ({ base, value: (weight * c.value) / comps.length })),
    };
  });
};

// One decimal, so the bars read like the MCP components (+3.1, not +3%).
const pct1 = (v) => {
  const t = Math.abs(v * 100).toFixed(1);
  return t === '0.0' ? '0.0%' : `${v > 0 ? '+' : '−'}${t}%`;
};

function waterfall(d, m, opp, combo, open) {
  const share = {};
  decompose(d, m).forEach((stat) =>
    stat.bases.forEach((x) => {
      share[x.base] = (share[x.base] || 0) + x.value;
    }),
  );
  const rows = Object.entries(m.components)
    .filter(([, c]) => c)
    .map(([base, c]) => ({
      base,
      component: c.value,
      value: combo === 'W2' ? (share[base] ?? 0) : c.value,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const total = m.season ? m.season.value : null;
  const max = Math.max(
    ...rows.map((r) => Math.abs(r.value)),
    combo === 'W2' && total != null ? Math.abs(total) : 0,
    1e-6,
  );
  const accKey = [...open].find((k) => k.startsWith('acc:'));
  const expanded = accKey ? accKey.slice(4) : rows[0] && rows[0].base;
  const bar = (v) => {
    const w = (Math.abs(v) / max) * 50;
    return `<span class="wbar"><i class="${v >= 0 ? 'wup' : 'wdown'}" style="${v >= 0 ? 'left:50%' : 'right:50%'};width:${w.toFixed(1)}%"></i></span>`;
  };
  const slices = (r) => {
    const base = (m.bases || []).find((b) => b.base === r.base);
    if (!base) return '<p class="sub">No rows.</p>';
    if (r.base === 'Traditional') {
      const t = base.slices[0];
      return `<div class="srow"><span class="sn">${esc(opp)}: ${esc(t.metric)}</span><span class="ss"></span>${sPill(t)}<span class="sv">${esc(minus(t.vs_league))}</span></div>`;
    }
    const list = joined(d, base);
    const showAll = open.has(`all:${r.base}`);
    const shown = showAll ? list : list.slice(0, 3);
    const more =
      list.length > 3
        ? `<button type="button" class="more" data-more="all:${esc(r.base)}">${showAll ? 'Show less' : `Show all ${list.length}`}</button>`
        : '';
    return `${list.every((x) => x.his_mix) ? '<div class="ssub">For his mix of 2s and 3s: no opponent rank.</div>' : ''}${shown.map(sRow).join('')}${more}`;
  };
  const body = rows
    .map((r) => {
      const isOpen = r.base === expanded;
      const label = combo === 'W2' ? `${pct1(r.value)}` : pct1(r.value);
      const title =
        combo === 'W2'
          ? `${r.base}: ${pct1(r.value)} of the ${m.market} score (component ${pct1(r.component)})`
          : `${r.base} component ${pct1(r.value)}`;
      return `<div class="wrow${isOpen ? ' open' : ''}">
        <button type="button" class="whead" data-more="${isOpen ? 'acc:none' : `acc:${esc(r.base)}`}" aria-expanded="${isOpen}" title="${esc(title)}">
          <span class="wcar">${isOpen ? '▾' : '▸'}</span><span class="wname">${esc(r.base)}</span>${bar(r.value)}<span class="wval ${r.value >= 0 ? 'up' : 'down'}">${label}</span>
        </button>
        ${isOpen ? `<div class="wbody">${slices(r)}</div>` : ''}
      </div>`;
    })
    .join('');
  const totalRow =
    combo === 'W2' && total != null
      ? `<div class="wtotal"><span class="wcar"></span><span class="wname">${esc(m.market)} score</span>${bar(total)}<span class="wval ${total >= 0 ? 'up' : 'down'}">${pct1(total)}</span></div>`
      : '';
  const foot =
    combo === 'W2'
      ? `Each bar is that Base's share of the ${esc(m.market)} score.`
      : `Each bar is that Base's ${esc(m.market)} component, as MCP reports it.`;
  return `<div class="wtitle">${esc(m.market)} vs ${esc(opp)}</div>
    <div class="wlist">${body}${totalRow}</div><div class="wfoot">${foot}</div>`;
}

const comboParts = (d, m) => {
  const avg = d.player.averages || {};
  const total = COMBO_PARTS[m.market].reduce((sum, k) => sum + (avg[k] || 0), 0) || 1;
  return COMBO_PARTS[m.market].map((key) => {
    const single = d.markets.find((x) => x.market === key);
    const bases = PART[key].bases
      .map((b) => (m.bases || []).find((x) => x.base === b))
      .filter(Boolean);
    return {
      key,
      label: PART[key].label,
      weight: (avg[key] || 0) / total,
      score: single && single.season,
      bases,
    };
  });
};

const partHead = (part, m) => `<div class="cpart">
    <span class="cpl">${esc(part.label)}</span>
    <span class="cpw">${Math.round(part.weight * 100)}% of his ${esc(m.market)}</span>
    ${part.score ? `<span class="pill cps" style="${wash(part.score.value)}" title="${esc(part.key)} Season Matchup Score">${esc(part.key)} ${pct(part.score.value)}</span>` : ''}
  </div>`;

const tagRow = (s, tag) =>
  sRow(s).replace('<span class="sn">', `<span class="sn"><em class="ctag">${esc(tag)}</em>`);

function comboBody(d, m, opp, combo, open) {
  const parts = comboParts(d, m);
  const all = open.has('all');
  const toggle = `<button type="button" class="more" data-more="all">${all ? 'Show less' : 'Show all'}</button>`;
  const title = `<div class="stitle">Where his ${esc(m.market)} come from</div>`;
  const trad = sTrad(m, opp);
  // A part's rows: its first Base (Points: Play types, else Shot zones) unless expanded.
  const partRows = (part, n) => {
    const bases = all ? part.bases : part.bases.slice(0, 1);
    const groups = bases
      .map((b) => {
        const rows = joined(d, b);
        const shown = all ? rows : rows.slice(0, n);
        return `${bases.length > 1 || all ? `<div class="sbase">${esc(b.base)}${rows.every((x) => x.his_mix) ? ' <i>· for his mix</i>' : ''}</div>` : ''}${shown.map(sRow).join('')}`;
      })
      .join('');
    return (
      groups +
      (part.key === 'REB'
        ? trad.replace(
            '<div class="sgrp"><div class="sbase">Traditional</div>',
            '<div class="sgrp ctrad"><div class="sbase">Traditional</div>',
          )
        : '')
    );
  };
  if (combo === 'W3') return waterfallByStat(d, m, opp, open);
  if (combo === 'W' || combo === 'W2') return waterfall(d, m, opp, combo, open);
  if (combo === 'C1') {
    const groups = parts
      .map((part) => `<div class="sgrp">${partHead(part, m)}${partRows(part, 3)}</div>`)
      .join('');
    return `${title}<div class="slist">${groups}${toggle}</div>`;
  }
  if (combo === 'C2') {
    // share x |vs league| x the part's share of his line: how much a slice can move the combo.
    const cands = [];
    parts.forEach((part) =>
      part.bases
        .filter((b) => b.base !== 'Shot types')
        .forEach((b) =>
          joined(d, b).forEach((s) => {
            const v = num(s.vs_league);
            if (v == null || s.share == null) return;
            cands.push({
              s,
              tag: BASE_TAG[b.base],
              impact: part.weight * (num(s.share) / 100) * Math.abs(v),
            });
          }),
        ),
    );
    cands.sort((x, y) => y.impact - x.impact);
    const top = cands
      .slice(0, 6)
      .map((c) => tagRow(c.s, c.tag))
      .join('');
    const rest = all
      ? `<div class="crest">${sGroups(
          d,
          m,
          parts.flatMap((p) => p.bases),
          true,
        )}${trad}</div>`
      : '';
    return `${title}<div class="ssub">The slices that move his ${esc(m.market)} most: share × |vs league| × part of his line</div><div class="slist">${top}${rest}${toggle}</div>`;
  }
  // C3: one part at a time.
  const picked =
    parts.find((p) => open.has(`part:${p.key}`)) ||
    parts.reduce((a, b) => (b.weight > a.weight ? b : a));
  const seg = `<div class="cseg" role="group" aria-label="Part of the line">${parts
    .map(
      (p) =>
        `<button type="button" data-more="part:${p.key}" aria-pressed="${p === picked}">${esc(p.label)} <i>${Math.round(p.weight * 100)}%</i></button>`,
    )
    .join('')}</div>`;
  return `${title}${seg}<div class="slist"><div class="sgrp">${partHead(picked, m)}${partRows(picked, 3)}</div>${toggle}</div>`;
}

/* W3: W2's contribution bars, grouped under the stats the combo is made of, on one shared scale. */
function waterfallByStat(d, m, opp, open) {
  const stats = decompose(d, m)
    .map((st) => ({
      ...st,
      bases: [...st.bases].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const total = m.season ? m.season.value : null;
  const max = Math.max(
    ...stats.flatMap((st) => [Math.abs(st.value), ...st.bases.map((x) => Math.abs(x.value))]),
    total == null ? 0 : Math.abs(total),
    1e-6,
  );
  const accKey = [...open].find((k) => k.startsWith('acc:'));
  // Compact: nothing opens into slices until tapped.
  const expanded = accKey ? accKey.slice(4) : null;
  const bar = (v) => {
    const w = (Math.abs(v) / max) * 50;
    return `<span class="wbar"><i class="${v >= 0 ? 'wup' : 'wdown'}" style="${v >= 0 ? 'left:50%' : 'right:50%'};width:${w.toFixed(1)}%"></i></span>`;
  };
  const slices = (st, baseName) => {
    const base = ((st.single && st.single.bases) || []).find((b) => b.base === baseName);
    if (!base) return '<p class="sub">No rows.</p>';
    if (baseName === 'Traditional') {
      const t = base.slices[0];
      return `<div class="srow"><span class="sn">${esc(opp)}: ${esc(t.metric)}</span><span class="ss"></span>${sPill(t)}<span class="sv">${esc(minus(t.vs_league))}</span></div>`;
    }
    const list = joined(d, base);
    const allKey = `all:${st.key}|${baseName}`;
    const showAll = open.has(allKey);
    const shown = showAll ? list : list.slice(0, 3);
    const more =
      list.length > 3
        ? `<button type="button" class="more" data-more="${esc(allKey)}">${showAll ? 'Show less' : `Show all ${list.length}`}</button>`
        : '';
    return `${list.every((x) => x.his_mix) ? '<div class="ssub">For his mix of 2s and 3s: no opponent rank.</div>' : ''}${shown.map(sRow).join('')}${more}`;
  };
  const groups = stats
    .map((st) => {
      // Compact: the group's largest Base shows; the rest sit behind "+N more".
      const grpKey = `grp:${st.key}`;
      // fit: keys are groups the height fit opened; they show in full with no button.
      const fitOpen = open.has(`fit${grpKey}`);
      const grpOpen = fitOpen || open.has(grpKey);
      const visible = grpOpen ? st.bases : st.bases.slice(0, 1);
      const hidden = st.bases.length - visible.length;
      const moreRow =
        st.bases.length > 1 && !fitOpen
          ? `<button type="button" class="w3more" data-more="${grpKey}">${grpOpen ? 'Show less' : `+${hidden} more`}</button>`
          : '';
      const rows =
        visible
          .map((x) => {
            const id = `${st.key}|${x.base}`;
            const isOpen = id === expanded;
            return `<div class="wrow w3b${isOpen ? ' open' : ''}">
            <button type="button" class="whead" data-more="${isOpen ? 'acc:none' : `acc:${esc(id)}`}" aria-expanded="${isOpen}" title="${esc(`${x.base} in ${st.label}: ${pct1(x.value)} of the ${m.market} score`)}">
              <span class="wcar">${isOpen ? '▾' : '▸'}</span><span class="wname">${esc(x.base)}</span>${bar(x.value)}<span class="wval ${x.value >= 0 ? 'up' : 'down'}">${pct1(x.value)}</span>
            </button>
            ${isOpen ? `<div class="wbody">${slices(st, x.base)}</div>` : ''}
          </div>`;
          })
          .join('') + moreRow;
      return `<div class="w3g" data-grp="${grpKey}" data-bases="${st.bases.length}">
          <div class="w3h"><span class="wcar"></span><span class="wname"><b>${esc(st.label)}</b> <i>· ${Math.round(st.weight * 100)}% of his ${esc(m.market)}</i></span>${bar(st.value)}<span class="wval ${st.value >= 0 ? 'up' : 'down'}">${pct1(st.value)}</span></div>
          ${rows}
        </div>`;
    })
    .join('');
  const totalRow =
    total != null
      ? `<div class="wtotal"><span class="wcar"></span><span class="wname">${esc(m.market)} score</span>${bar(total)}<span class="wval ${total >= 0 ? 'up' : 'down'}">${pct1(total)}</span></div>`
      : '';
  return `<div class="wtitle">${esc(m.market)} vs ${esc(opp)}</div>
    <div class="wlist w3">${groups}${totalRow}</div><div class="wfoot">Bars are each Base's share of the ${esc(m.market)} score.</div>`;
}
