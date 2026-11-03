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
    return {
      market,
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

function court(d, base, opp) {
  const map = REGIONS[base.base];
  const by = Object.fromEntries(joined(d, base).map((s) => [s.slice, s]));
  const at = (region) => by[map[region]];
  const fill = (region) => {
    const s = at(region);
    return soft(s ? num(s.vs_league) : null);
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

function butterfly(d, m, base, opp) {
  const slices = joined(d, base);
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
        <span class="hd l">His Diet</span><span class="hd r">${mix ? `${esc(opp)} allows, for his mix` : `${esc(opp)} allows`}</span>${rows}</div>`;
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
