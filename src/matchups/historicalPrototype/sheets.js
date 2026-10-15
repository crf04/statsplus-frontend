/*
 * PROTOTYPE — throwaway. Three easier-to-read Defense Sheets for variant C.
 *
 * Shared fixes: plain-English slice and measure names instead of wire keys
 * ("Arc3Assists", "Cut POSS"), the rank said in words (30 = allows the most),
 * one headline number (% vs league) with σ moved to a tooltip, "Save as Target"
 * reduced to an icon, and player leans as short "Name 15%" text.
 *
 *   C1 Plain rows   one row per sheet row, label + rank words, big % on the right
 *   C2 Merged       one row per slice, its measures side by side (Cut: poss | pts)
 *   C3 Bars         a diverging bar around league average, the length is the %
 *   C4 Cards        today's card look (rank squares, pill chips) with the fixes above
 *   C5 Cards merged C4, one card per slice with its measures side by side
 */
import { Bookmark } from 'lucide-react';
import { DIET_BASE_WIRE_NAMES } from '../matchupApi';
import { findDietShare, getDisplayableDietShare } from '../displayConfig';

const BASE_LABELS = {
  playTypes: 'Play types',
  shotZones: 'Shot zones',
  shotTypes: 'Shot types',
  assistLocations: 'Assists by location',
  traditional: 'Box score',
};
const SHARE_LABELS = {
  playTypes: 'poss',
  shotZones: 'FGA',
  shotTypes: 'FGA',
  assistLocations: 'ast',
};

const SLICE_NAMES = {
  Arc3Assists: 'Above-the-break 3s',
  Assists: 'All assists',
  AtRimAssists: 'At the rim',
  Corner3Assists: 'Corner 3s',
  LongMidRangeAssists: 'Long mid-range',
  ShortMidRangeAssists: 'Short mid-range',
  PRBallHandler: 'P&R ball handler',
  PRRollMan: 'P&R roll man',
  OffRebound: 'Putbacks',
  OffScreen: 'Off screen',
  Postup: 'Post up',
  Spotup: 'Spot up',
  Misc: 'Miscellaneous',
  'Less Than 10 ft': 'Under 10 ft',
  'In The Paint (Non-RA)': 'Paint (non-restricted)',
  'Above the Break 3': 'Above-the-break 3',
  OPP_BLK: 'Blocks',
  OPP_REB: 'Rebounds',
  OPP_STL: 'Steals',
  OPP_TOV: 'Turnovers forced',
};
const MEASURE_NAMES = {
  POSS: 'possessions',
  PTS: 'points',
  FGA: 'shots',
  FGM: 'makes',
  FG2A: '2PT shots',
  FG2M: '2PT makes',
  FG3A: '3PT shots',
  FG3M: '3PT makes',
};
const MEASURE_SHORT = {
  POSS: 'Poss',
  PTS: 'Pts',
  FGA: 'Shots',
  FGM: 'Makes',
  FG2A: '2PA',
  FG2M: '2PM',
  FG3A: '3PA',
  FG3M: '3PM',
};

const splitKey = (key) => {
  const [slice, measure] = key.includes(':') ? key.split(':') : [key, null];
  return { slice, measure, sliceName: SLICE_NAMES[slice] || slice };
};
const rowTitle = (row) => {
  const { sliceName, measure } = splitKey(row.key);
  return measure ? `${sliceName} · ${MEASURE_NAMES[measure] || measure}` : sliceName;
};

const ordinal = (n) => {
  const suffix =
    n % 10 === 1 && n !== 11
      ? 'st'
      : n % 10 === 2 && n !== 12
        ? 'nd'
        : n % 10 === 3 && n !== 13
          ? 'rd'
          : 'th';
  return `${n}${suffix}`;
};
// 30 = allows the most, 1 = allows the fewest.
const rankWords = (rank) =>
  rank >= 16
    ? rank === 30
      ? 'Allows the most'
      : `Allows ${ordinal(31 - rank)} most`
    : rank === 1
      ? 'Allows the fewest'
      : `Allows ${ordinal(rank)} fewest`;
const pct = (value) =>
  value === null
    ? 'n/a'
    : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(Math.round(value))}%`;
const tone = (value) => (value === null ? 'flat' : value > 0 ? 'up' : value < 0 ? 'down' : 'flat');
const shortName = (name) => name.split(' ').slice(-1)[0];

const leansFor = (players, base, sliceKey, market) =>
  !SHARE_LABELS[base]
    ? []
    : players
        .filter((player) => market === 'All' || player.statCategories.includes(market))
        .flatMap((player) => {
          const share = getDisplayableDietShare(player, base, sliceKey);
          return share ? [{ player, share }] : [];
        })
        .sort((a, b) => Math.abs(b.share.sigmaDeviation) - Math.abs(a.share.sigmaDeviation));

const leagueShare = (players, base, sliceKey) => {
  for (const player of players) {
    const share = findDietShare(player, base, sliceKey)?.leagueAverageShare;
    if (typeof share === 'number') return share;
  }
  return null;
};

function Leans({ players, base, sliceKey, market }) {
  const leans = leansFor(players, base, sliceKey, market);
  if (!leans.length) return null;
  return (
    <p className="ps-leans">
      {leans.slice(0, 3).map(({ player, share }, index) => (
        <span
          key={player.id}
          title={`${player.name}: ${Math.round(share.share * 100)}% of his ${SHARE_LABELS[base]}, ${share.sigmaDeviation > 0 ? '+' : ''}${share.sigmaDeviation.toFixed(1)}σ vs league`}
        >
          {index > 0 && ' · '}
          <b>{shortName(player.name)}</b> {Math.round(share.share * 100)}%
        </span>
      ))}
      {leans.length > 3 && (
        <span
          title={leans
            .slice(3)
            .map(({ player }) => player.name)
            .join(', ')}
        >
          {' '}
          +{leans.length - 3}
        </span>
      )}
    </p>
  );
}

function LeanChips({ players, base, sliceKey, market }) {
  const leans = leansFor(players, base, sliceKey, market);
  if (!leans.length) return null;
  return (
    <div className="pc-chips">
      {leans.slice(0, 3).map(({ player, share }) => (
        <span
          key={player.id}
          title={`${player.name}: ${Math.round(share.share * 100)}% of his ${SHARE_LABELS[base]}, ${share.sigmaDeviation > 0 ? '+' : ''}${share.sigmaDeviation.toFixed(1)}σ vs league`}
        >
          {shortName(player.name)} <b>{Math.round(share.share * 100)}%</b>
        </span>
      ))}
      {leans.length > 3 && (
        <span
          className="more"
          title={leans
            .slice(3)
            .map(({ player }) => player.name)
            .join(', ')}
        >
          +{leans.length - 3}
        </span>
      )}
    </div>
  );
}

const RankSquare = ({ rank }) => (
  <span className="rank-pill pc-rank" style={{ '--rank': rank }} aria-hidden="true">
    {rank}
  </span>
);

function SaveButton({ row, base, team, players, onCapture }) {
  if (!DIET_BASE_WIRE_NAMES[base]) return null;
  return (
    <button
      type="button"
      className="ps-save"
      aria-label={`Save ${row.label} as a Target`}
      title="Save as Target"
      onClick={() =>
        onCapture({
          opponent: team.tricode,
          base: DIET_BASE_WIRE_NAMES[base],
          sliceKey: row.sliceKey,
          leagueAverageShare: leagueShare(players, base, row.sliceKey),
        })
      }
    >
      <Bookmark size={15} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

// Same filtering as the page's sheet: market, window availability, deviation.
const prepare = ({ team, market, windowKey, deviation, surfaceAvailability }) => {
  let hidden = 0;
  const sections = Object.entries(team.defenseSheet).flatMap(([base, rows]) => {
    if (surfaceAvailability[base][windowKey].status !== 'available') return [];
    const visible = rows
      .filter((row) => market === 'All' || row.markets.includes(market))
      .filter((row) => row[windowKey] !== null)
      .filter((row) => {
        const shown = Math.abs(row[windowKey].sigmaDeviation) >= deviation;
        if (!shown) hidden += 1;
        return shown;
      });
    return visible.length ? [{ base, rows: visible }] : [];
  });
  return { sections, hidden };
};

const sigmaTitle = (stat) =>
  `${stat.allowedPer48.toFixed(1)} per 48 · ${stat.sigmaDeviation > 0 ? '+' : ''}${stat.sigmaDeviation.toFixed(1)}σ · rank ${stat.rank}/30 (30 allows the most)`;

export default function ProtoSheet(props) {
  const { team, players, market, windowKey, selectedPlayer, style } = props;
  const { sections, hidden } = prepare(props);
  const why = (base, row) =>
    selectedPlayer && getDisplayableDietShare(selectedPlayer, base, row.sliceKey);
  return (
    <section className={`ps ps-${style}`} aria-labelledby="defense-sheet-heading">
      <div className="ps-head">
        <h2 id="defense-sheet-heading">What {team.tricode} allows</h2>
        <p>
          vs league average, per 48 min{market !== 'All' ? ` · ${market}` : ''} · {hidden} near
          average hidden
        </p>
      </div>
      {sections.length === 0 && <p className="honest-empty">No rows match these controls.</p>}
      {sections.map(({ base, rows }) => (
        <section className="ps-base" key={base}>
          <h3>{BASE_LABELS[base] || base}</h3>
          {style === 'C4' || style === 'C5' ? (
            <div className="pc-grid">
              {(style === 'C5'
                ? mergeBySlice(rows)
                : rows.map((row) => ({ slice: row.key, sliceName: rowTitle(row), rows: [row] }))
              ).map((group) => (
                <article
                  key={group.slice}
                  className={`pc-card${group.rows.some((row) => why(base, row)) ? ' why' : ''}`}
                >
                  <div className="pc-top">
                    <h4>{group.sliceName}</h4>
                    <SaveButton row={group.rows[0]} base={base} {...props} />
                  </div>
                  <div className="pc-stats">
                    {group.rows.map((row) => {
                      const stat = row[windowKey];
                      const { measure } = splitKey(row.key);
                      return (
                        <div key={row.key} className="pc-stat" title={sigmaTitle(stat)}>
                          <RankSquare rank={stat.rank} />
                          <div>
                            <b className={tone(stat.percentVsLeagueAverage)}>
                              {pct(stat.percentVsLeagueAverage)}
                              <small> vs league</small>
                            </b>
                            <span>
                              {style === 'C5' && measure
                                ? `${MEASURE_SHORT[measure] || measure} · `
                                : ''}
                              {rankWords(stat.rank)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <LeanChips
                    players={players}
                    base={base}
                    sliceKey={group.rows[0].sliceKey}
                    market={market}
                  />
                </article>
              ))}
            </div>
          ) : style === 'C2' ? (
            mergeBySlice(rows).map((group) => (
              <article
                key={group.slice}
                className={`ps-row${group.rows.some((row) => why(base, row)) ? ' why' : ''}`}
              >
                <div className="ps-merged">
                  <div className="ps-label">
                    <h4>{group.sliceName}</h4>
                  </div>
                  <div className="ps-cells">
                    {group.rows.map((row) => {
                      const stat = row[windowKey];
                      const { measure } = splitKey(row.key);
                      return (
                        <span key={row.key} title={sigmaTitle(stat)}>
                          <small>{MEASURE_SHORT[measure] || measure || 'Allowed'}</small>
                          <b className={tone(stat.percentVsLeagueAverage)}>
                            {pct(stat.percentVsLeagueAverage)}
                          </b>
                          <em>{rankWords(stat.rank).replace('Allows ', '')}</em>
                        </span>
                      );
                    })}
                  </div>
                  <SaveButton row={group.rows[0]} base={base} {...props} />
                </div>
                <Leans
                  players={players}
                  base={base}
                  sliceKey={group.rows[0].sliceKey}
                  market={market}
                />
              </article>
            ))
          ) : (
            rows.map((row) => {
              const stat = row[windowKey];
              const value = stat.percentVsLeagueAverage;
              return (
                <article key={row.key} className={`ps-row${why(base, row) ? ' why' : ''}`}>
                  {style === 'C3' ? (
                    <div className="ps-bar-row" title={sigmaTitle(stat)}>
                      <div className="ps-label">
                        <h4>{rowTitle(row)}</h4>
                        <span>{rankWords(stat.rank)}</span>
                      </div>
                      <div className="ps-bar" aria-hidden="true">
                        <i
                          className={tone(value)}
                          style={{
                            width: `${Math.min(50, (Math.abs(value ?? 0) / 30) * 50)}%`,
                            [value >= 0 ? 'left' : 'right']: '50%',
                          }}
                        />
                      </div>
                      <b className={tone(value)}>{pct(value)}</b>
                      <SaveButton row={row} base={base} {...props} />
                    </div>
                  ) : (
                    <div className="ps-plain" title={sigmaTitle(stat)}>
                      <div className="ps-label">
                        <h4>{rowTitle(row)}</h4>
                        <span>
                          {rankWords(stat.rank)} · {stat.allowedPer48.toFixed(1)} per 48
                        </span>
                      </div>
                      <b className={tone(value)}>
                        {pct(value)}
                        <small>vs league</small>
                      </b>
                      <SaveButton row={row} base={base} {...props} />
                    </div>
                  )}
                  <Leans players={players} base={base} sliceKey={row.sliceKey} market={market} />
                </article>
              );
            })
          )}
        </section>
      ))}
    </section>
  );
}

const mergeBySlice = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const { slice, sliceName } = splitKey(row.key);
    if (!groups.has(slice)) groups.set(slice, { slice, sliceName, rows: [] });
    groups.get(slice).rows.push(row);
  }
  return [...groups.values()];
};
