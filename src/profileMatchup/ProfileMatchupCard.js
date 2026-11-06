import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LINE_TYPE_GROUPS } from '../filterUtils';
import MatchupCourt from './MatchupCourt';
import {
  COMBO_STATS,
  COURT_REGIONS,
  ordinal,
  scoreText,
  shareText,
  vsLeagueText,
} from './matchupReading';
import './profileMatchup.css';

/*
 * The Player Profile body: the MCP `get_matchup` card for the game logs' Line Type. Single
 * markets read as S4 (where his volume comes from, against what the opponent allows); the
 * combos PRA, PA, PR and RA as W3 (each Base's share of the combo score, grouped by stat).
 * The market is the Line Type: the picker writes it through the same setter as the Line Type
 * select and keeps no copy of its own.
 */

/* A Line Type's Matchup market; FD_PTS and None have none. */
export const marketFor = (lineType) =>
  lineType === 'FG3M' ? '3PM' : lineType === 'FD_PTS' || lineType === 'None' ? null : lineType;

/* Green or red by sign, as the value reads: one that rounds to 0.0% is neither. */
const tone = (value) => {
  const text = scoreText(value);
  return text === '0.0%' ? '' : text.startsWith('+') ? 'pmc-up' : 'pmc-down';
};

const RankPill = ({ rank, vsLeague, hisMix = false }) =>
  rank === null ? (
    <span
      className="pmc-rank pmc-rank-none"
      title={hisMix ? 'Scored on his mix of 2s and 3s: no opponent rank' : 'No opponent row'}
    >
      –
    </span>
  ) : (
    <span
      className="pmc-rank"
      style={{ '--rank': rank }}
      title={`${ordinal(rank)} of 30 (30th = allows the most) · ${vsLeagueText(vsLeague)} vs league`}
    >
      {ordinal(rank)}
    </span>
  );

/* One slice: name · his share · the opponent's rank · % vs league. */
const SliceRow = ({ name, share = null, rank, vsLeague, hisMix }) => (
  <li className="pmc-row">
    <span className="pmc-row-name">{name}</span>
    <span className="pmc-row-share">{share === null ? '' : shareText(share)}</span>
    <RankPill rank={rank} vsLeague={vsLeague} hisMix={hisMix} />
    <span className="pmc-row-vs">{vsLeague === null ? '' : vsLeagueText(vsLeague)}</span>
  </li>
);

const TraditionalRow = ({ row, opponent }) => (
  <SliceRow name={`${opponent}: ${row.metric}`} rank={row.rank} vsLeague={row.vsLeague} />
);

const allMix = (base) => base.slices.every((slice) => slice.hisMix);

const BaseRows = ({ base, limit = null }) => (
  <ul className="pmc-rows" aria-label={base.label}>
    {(limit === null ? base.slices : base.slices.slice(0, limit)).map((slice) => (
      <SliceRow
        key={slice.key}
        name={slice.label}
        share={slice.share}
        rank={slice.rank}
        vsLeague={slice.vsLeague}
        hisMix={slice.hisMix}
      />
    ))}
  </ul>
);

const BaseHeading = ({ base }) => (
  <div className="pmc-base">
    {base.label}
    {allMix(base) && <i> · for his mix of 2s and 3s</i>}
  </div>
);

/* S4: the coloured court for a Base read by region, beside the top 3 slices of every other. */
const SingleMarket = ({ reading, market }) => {
  const [showAll, setShowAll] = useState(false);
  const courtBase = market.bases.find((base) => COURT_REGIONS[base.key]);
  const listed = market.bases.filter((base) => base !== courtBase);
  if (!market.bases.length && !market.traditional) {
    return <p className="pmc-empty">No Diet-based Base reads {market.market}.</p>;
  }
  const hasList = listed.length > 0 || market.traditional;
  return (
    <>
      <div className="pmc-title">Where his {market.market} come from</div>
      <div className={`pmc-s4${courtBase && listed.length ? '' : ' pmc-solo'}`}>
        {courtBase && (
          <div className="pmc-court-col">
            <BaseHeading base={courtBase} />
            <MatchupCourt base={courtBase} opponent={reading.opponent} />
          </div>
        )}
        {hasList && (
          <div>
            {listed.map((base) => (
              <div className="pmc-group" key={base.key}>
                <BaseHeading base={base} />
                <BaseRows base={base} limit={showAll ? null : 3} />
              </div>
            ))}
            {market.traditional && (
              <div className="pmc-group">
                <div className="pmc-base">Traditional</div>
                <ul className="pmc-rows" aria-label="Traditional">
                  <TraditionalRow row={market.traditional} opponent={reading.opponent} />
                </ul>
              </div>
            )}
            {listed.some((base) => base.slices.length > 3) && (
              <button type="button" className="pmc-toggle" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show less' : 'Show all'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

/* A contribution on the sheet's one diverging scale. */
const Bar = ({ value, max }) => (
  <span className="pmc-bar" aria-hidden="true">
    {value !== 0 && (
      <i
        className={value > 0 ? 'pmc-bar-up' : 'pmc-bar-down'}
        style={{ width: `${((Math.abs(value) / max) * 50).toFixed(1)}%` }}
      />
    )}
  </span>
);

/* A Base opened under a stat: its top 3 slices for that stat's market, or its Traditional row. */
const BaseSlices = ({ reading, stat, baseKey, showAll, onShowAll }) => {
  const single = reading.markets[stat];
  if (baseKey === 'traditional') {
    return single?.traditional ? (
      <ul className="pmc-rows" aria-label="Traditional">
        <TraditionalRow row={single.traditional} opponent={reading.opponent} />
      </ul>
    ) : (
      <p className="pmc-empty">No opponent row.</p>
    );
  }
  const base = single?.bases.find((candidate) => candidate.key === baseKey);
  if (!base) return <p className="pmc-empty">No opponent rows.</p>;
  return (
    <>
      {allMix(base) && (
        <div className="pmc-w3-sub">For his mix of 2s and 3s: no opponent rank.</div>
      )}
      <BaseRows base={base} limit={showAll ? null : 3} />
      {base.slices.length > 3 && (
        <button type="button" className="pmc-toggle" onClick={onShowAll}>
          {showAll ? 'Show less' : `Show all ${base.slices.length}`}
        </button>
      )}
    </>
  );
};

/* On a phone the card has no neighbour to match, so a combo sheet may be as tall as the S4
   PTS sheet measured at 390px. */
const PHONE_BUDGET = 640;

/* The room the sheet has. On desktop, the height the row gives the card: the Opposing Team
   Profile's natural height, less this card's own content above and below the sheet. */
const sheetBudget = (sheet) => {
  const card = sheet.closest('.dark-card');
  const row = card?.closest('.row');
  const neighbour = row && [...row.querySelectorAll('.dark-card')].find((c) => c !== card);
  const top = (el) => el.getBoundingClientRect().top;
  if (!card || !neighbour || Math.abs(top(neighbour) - top(card)) > 4) return PHONE_BUDGET;
  const natural = (c) => {
    const body = c.querySelector('.card-body') ?? c;
    const last = body.lastElementChild;
    return (
      (last ? last.getBoundingClientRect().bottom : top(body)) -
      top(c) +
      parseFloat(getComputedStyle(body).paddingBottom) +
      parseFloat(getComputedStyle(c).borderBottomWidth)
    );
  };
  const below = natural(card) - (sheet.getBoundingClientRect().bottom - top(card));
  const above = top(sheet) - top(card);
  return natural(neighbour) - above - below;
};

/*
 * W3. The sheet starts with each stat's header and largest Base, then opens whole groups in
 * display order while it still fits the room it has. The fit runs again on resize; once the
 * reader opens a group or a Base it stops, so it never collapses what they opened.
 */
const ComboMarket = ({ reading, market }) => {
  const stats = [...market.combo].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const [opened, setOpened] = useState(() => new Set());
  const [fitted, setFitted] = useState(() => new Set());
  const [touched, setTouched] = useState(false);
  const [openBase, setOpenBase] = useState(null);
  const [allSlices, setAllSlices] = useState(() => new Set());
  const [resized, setResized] = useState(0);
  const sheetRef = useRef(null);
  const moreHeight = useRef(0);

  useEffect(() => {
    const bump = () => setResized((n) => n + 1);
    window.addEventListener('resize', bump);
    const row = sheetRef.current?.closest('.row');
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(bump);
    row?.querySelectorAll('.dark-card .card-body').forEach((body) => observer?.observe(body));
    return () => {
      window.removeEventListener('resize', bump);
      observer?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || touched) return;
    const rowHeight = sheet.querySelector('.pmc-w3-base')?.getBoundingClientRect().height ?? 0;
    const more = sheet.querySelector('.pmc-w3-more');
    if (more) moreHeight.current = more.getBoundingClientRect().height;
    if (!rowHeight) return;
    const groups = [...sheet.querySelectorAll('[data-fit-group]')];
    const extra = (group) => {
      const bases = Number(group.dataset.bases);
      return (bases - 1) * rowHeight - (bases > 1 ? moreHeight.current : 0);
    };
    // The sheet as it would be with every group compact.
    let height =
      sheet.getBoundingClientRect().height -
      groups
        .filter((group) => fitted.has(group.dataset.fitGroup))
        .reduce((sum, group) => sum + extra(group), 0);
    const budget = sheetBudget(sheet);
    const next = new Set();
    groups.forEach((group) => {
      if (Number(group.dataset.bases) < 2) return;
      if (height + extra(group) <= budget + 0.5) {
        next.add(group.dataset.fitGroup);
        height += extra(group);
      }
    });
    if (next.size !== fitted.size || [...next].some((stat) => !fitted.has(stat))) {
      setFitted(next);
    }
  }, [touched, fitted, resized, openBase, allSlices, opened]);

  const toggleIn = (set, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };
  const total = market.score;
  const max = Math.max(
    ...stats.flatMap((stat) => [Math.abs(stat.value), ...stat.bases.map((b) => Math.abs(b.value))]),
    total === null ? 0 : Math.abs(total),
    1e-6,
  );

  return (
    <>
      <div className="pmc-title">
        {market.market} vs {reading.opponent}
      </div>
      <div ref={sheetRef}>
        {stats.map((stat) => {
          const fitOpen = fitted.has(stat.stat);
          const groupOpen = fitOpen || opened.has(stat.stat);
          const visible = groupOpen ? stat.bases : stat.bases.slice(0, 1);
          return (
            <section
              className="pmc-w3-group"
              key={stat.stat}
              data-fit-group={stat.stat}
              data-bases={stat.bases.length}
              aria-label={stat.label}
            >
              <div className="pmc-w3-head">
                <span />
                <span className="pmc-w3-name">
                  <b>{stat.label}</b>{' '}
                  <i>
                    · {Math.round(stat.weight * 100)}% of his {market.market}
                  </i>
                </span>
                <Bar value={stat.value} max={max} />
                <span className={`pmc-val ${tone(stat.value)}`}>{scoreText(stat.value)}</span>
              </div>
              {visible.map((base) => {
                const id = `${stat.stat}|${base.key}`;
                const isOpen = openBase === id;
                return (
                  <div className={`pmc-w3-base${isOpen ? ' pmc-open' : ''}`} key={base.key}>
                    <button
                      type="button"
                      className="pmc-w3-toggle"
                      aria-expanded={isOpen}
                      title={`${base.label} in ${stat.label}: ${scoreText(base.value)} of the ${market.market} score`}
                      onClick={() => {
                        setTouched(true);
                        setOpenBase(isOpen ? null : id);
                      }}
                    >
                      <span className="pmc-caret" aria-hidden="true">
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span className="pmc-w3-name">{base.label}</span>
                      <Bar value={base.value} max={max} />
                      <span className={`pmc-val ${tone(base.value)}`}>{scoreText(base.value)}</span>
                    </button>
                    {isOpen && (
                      <div className="pmc-w3-body">
                        <BaseSlices
                          reading={reading}
                          stat={stat.stat}
                          baseKey={base.key}
                          showAll={allSlices.has(id)}
                          onShowAll={() => setAllSlices(toggleIn(allSlices, id))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {stat.bases.length > 1 && !fitOpen && (
                <button
                  type="button"
                  className="pmc-w3-more"
                  onClick={() => {
                    setTouched(true);
                    setOpened(toggleIn(opened, stat.stat));
                  }}
                >
                  {groupOpen ? 'Show less' : `+${stat.bases.length - 1} more`}
                </button>
              )}
            </section>
          );
        })}
        {total !== null && (
          <div className="pmc-w3-total">
            <span />
            <span className="pmc-w3-name">{market.market} score</span>
            <Bar value={total} max={max} />
            <span className={`pmc-val ${tone(total)}`}>{scoreText(total)}</span>
          </div>
        )}
      </div>
      <p className="pmc-foot">Bars are each Base&apos;s share of the {market.market} score.</p>
    </>
  );
};

const ProfileMatchupCard = ({ reading, lineType, setLineType }) => {
  const scored = (name) => reading.markets[name]?.score != null;
  const wanted = marketFor(lineType);
  const shown = wanted && scored(wanted) ? wanted : 'PTS';
  const market = reading.markets[shown];
  const pickerGroups = LINE_TYPE_GROUPS.map((group) => ({
    label: group.label,
    options: group.options.filter((option) => {
      const name = marketFor(option);
      return name && scored(name);
    }),
  })).filter((group) => group.options.length);
  const dataDate = reading.dataDate
    ? new Date(`${reading.dataDate}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '–';

  return (
    <div className="pmc">
      <div className="pmc-head">
        <div className="pmc-who">
          <b>{reading.player}</b> vs <b>{reading.opponent}</b> · {reading.season ?? '–'} · data as
          of {dataDate}
        </div>
        <div className="pmc-score">
          <span
            className={`pmc-pill ${market?.score == null ? '' : tone(market.score)}`}
            title={`${shown} Season Matchup Score`}
          >
            {market?.score == null ? '—' : scoreText(market.score)}
          </span>
          <select
            className="pmc-market"
            aria-label="Market"
            value={wanted && scored(wanted) ? lineType : 'PTS'}
            onChange={(event) => setLineType(event.target.value)}
          >
            {pickerGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option} value={option}>
                    {marketFor(option)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      {shown !== wanted && <p className="pmc-note">PTS shown; {lineType} has no Matchup Score</p>}
      {!market ? (
        <p className="pmc-empty">No Matchup Score for {shown}.</p>
      ) : market.combo && COMBO_STATS[shown] ? (
        <ComboMarket
          key={`${reading.player}|${reading.opponent}|${shown}`}
          reading={reading}
          market={market}
        />
      ) : (
        <SingleMarket
          key={`${reading.player}|${reading.opponent}|${shown}`}
          reading={reading}
          market={market}
        />
      )}
    </div>
  );
};

export default ProfileMatchupCard;
