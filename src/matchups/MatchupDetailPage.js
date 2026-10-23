import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Bookmark } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoginButton from '../components/Auth/LoginButton';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import { formatAge, useMinuteNow } from '../freshness';
import { filterSetToSearchParams } from '../filterUtils';
import { getStatusPresentation, getSurfaceFreshnessPresentation } from '../slateStatus';
import { DIET_BASE_WIRE_NAMES, fetchMatchup, fetchMatchupSelection } from './matchupApi';
import {
  MARKET_PROVIDERS,
  UNAVAILABLE_RELATIVE_LABEL,
  bookMark,
  bookName,
  findDietShare,
  formatScorePercent,
  dietBaseVolumePerGame,
  getDisplayableDietShare,
  isThinDietShare,
  orderCategories,
  sliceName,
} from './displayConfig';
import { SEASON_WINDOW_REASONS, WINDOW_REASONS } from '../windowReasons';
import { trailingSeason } from '../servingSeason';
import { bestPrices, formatPrice } from './linePrices';
import SelectionCard from './SelectionCard';
import TargetCaptureModal from '../targets/TargetCaptureModal';
import '../readings.css';
import './MatchupDetailPage.css';
import ErrorMessage from '../feedback/ErrorMessage';

const WINDOWS = [
  { key: 'season', label: 'Season' },
  { key: 'last15', label: 'Last 15' },
];
const DEVIATIONS = [
  { value: 0, label: 'All deviations' },
  { value: 1, label: 'At least 1 sigma' },
  { value: 2, label: 'At least 2 sigma' },
];
const SECTION_REASONS = {
  no_point_in_time_snapshot: 'No point-in-time snapshot was captured for this game.',
  no_pregame_snapshot: 'No pregame injury snapshot was archived for this game.',
  game_logs_incomplete: 'Canonical game logs are incomplete for this game.',
  no_game_log_rows: 'No canonical game-log rows exist for this game.',
  player_pool_unavailable: 'No Player Pool snapshot is available for this game.',
};
const surfaceReason = (unavailableReason, windowKey = 'last15') =>
  (windowKey === 'season' ? SEASON_WINDOW_REASONS : WINDOW_REASONS)[unavailableReason] ||
  SECTION_REASONS[unavailableReason] ||
  `${unavailableReason}.`;
const sectionReason = (section) => surfaceReason(section.unavailableReason);
const WINDOW_SECTIONS = { season: 'seasonDefense', last15: 'last15Defense' };

// Before a team has played 15 games, Last 15 covers the games so far and is
// named by their count. A section's own count wins over its window's, and a
// null count is a full window.
const last15Games = (state, section) =>
  (state?.windowGames === undefined ? section?.windowGames : state.windowGames) ?? 15;
const shortestLast15 = (matchup) =>
  Math.min(
    ...Object.values(matchup.league.surfaceAvailability).map((windows) =>
      last15Games(windows.last15, matchup.experience.sections?.last15Defense),
    ),
  );

// "a", "a and b", "a, b and c".
const listWords = (words, conjunction = 'and') =>
  words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} ${conjunction} ${words.at(-1)}`;
// Whole numbers stay whole; a half-point line keeps its half.
const formatStat = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const toneClass = (value) =>
  value === null || value === 0 ? 'tone-flat' : value > 0 ? 'tone-up' : 'tone-down';

/* ------------------------------- Summary ------------------------------- */

// The game's date and tip-off read in the reader's own zone, as the
// selection card does.
const gameDay = (game) =>
  new Date(game.scheduledAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const clock = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const gameStatus = (game) =>
  game.status === 'final'
    ? 'Final'
    : game.status === 'postponed'
      ? 'Postponed'
      : `Tip-off ${clock(game.scheduledAt)}`;

// A book with lines in the pool; a missing or unavailable one has none.
const hasLines = (surface) => !['missing', 'unavailable'].includes(surface.status);

// The books the live sheet's lines come from. The pool names the books it
// read; an older pool names none, so the players' provenance stands in.
const linesBooks = (matchup) => {
  const { pool } = matchup.freshness;
  if (!hasLines(pool)) return [];
  if (pool.providers.length) {
    return pool.providers.filter(hasLines).map((provider) => provider.name);
  }
  return [...new Set(matchup.players.flatMap((player) => Object.keys(player.provenance)))];
};

// The live header warns only when the lines themselves are old: the oldest
// read among the books it names, once it crosses the pool's freshness bar.
const staleLinesWarning = (matchup, now) => {
  const { pool } = matchup.freshness;
  const surfaces = pool.providers.length ? pool.providers.filter(hasLines) : [pool];
  const stale = surfaces.filter(
    (surface) =>
      surface.retrievedAt && getSurfaceFreshnessPresentation(surface, 'pool', now).warning,
  );
  if (!stale.length) return null;
  const oldest = stale.reduce((a, b) =>
    new Date(a.retrievedAt) <= new Date(b.retrievedAt) ? a : b,
  );
  return `Lines last read ${formatAge(oldest.retrievedAt, now)}.`;
};

/*
 * One sentence in place of the provenance block: when the game is and what
 * the sheet is built on. A finished game also says what it does not have; a
 * live one adds a warning only when its lines are stale.
 */
function MatchupSummary({ matchup, now }) {
  const { game, experience } = matchup;
  if (experience.mode === 'historical') {
    const missing = [];
    if (experience.sections.last15Defense.status !== 'available') missing.push('Last 15');
    if (experience.sections.injuries.status !== 'available') missing.push('injury report');
    return (
      <section className="matchup-summary" aria-label="Matchup summary">
        <p>
          {gameDay(game)} · {gameStatus(game)}.{' '}
          <span>
            Full-season defense ranks
            {missing.length ? `; no ${listWords(missing, 'or')}.` : '.'}
          </span>
        </p>
      </section>
    );
  }
  const books = linesBooks(matchup);
  const warning = books.length ? staleLinesWarning(matchup, now) : null;
  return (
    <section className="matchup-summary" aria-label="Matchup summary">
      <p>
        {gameDay(game)} · {gameStatus(game)}.{' '}
        <span>
          {books.length ? `Lines from ${listWords(books.map(bookName))}.` : 'No lines posted yet.'}
        </span>
        {matchup.freshness.pool.status === 'closing' && (
          <> {getStatusPresentation('closing').currentPoolMessage}</>
        )}
        {warning && (
          <>
            {' '}
            <span className="matchup-warning">{warning}</span>
          </>
        )}
      </p>
    </section>
  );
}

/* --------------------------------- Rail -------------------------------- */

// A score is unavailable, not zero, when the contract could not compute it.
// A Blend withheld alongside named missing inputs is an incomplete score, so
// no single component may stand in for it. A defensive category has no Blend
// by contract and names nothing missing, so its component is the whole score.
const scoreFor = (player, stat, windowKey) => {
  const score = player.scores[stat]?.[windowKey];
  if (!score) return null;
  if (score.blend === null && score.missingInputs.length > 0) return null;
  return score.blend?.value ?? Object.values(score.components)[0]?.value ?? null;
};

const postedLine = (player, provider, stat) => {
  const markets = Object.hasOwn(player.lines, provider) ? player.lines[provider] : {};
  return Object.hasOwn(markets, stat) ? markets[stat] : null;
};

/*
 * The books that post him in this stat, PrizePicks first, each with its line,
 * and the one line the row leads with. A prediction market's line leads when
 * one posts it (Polymarket, then Novig, then Kalshi); otherwise the first book
 * that has one. No line anywhere is a null headline, never a guess. The row is
 * flagged when the posted lines span a full point or more.
 */
const DISAGREEMENT_SPAN = 1;
const linesFor = (player, stat) => {
  const books = Object.keys(player.provenance)
    .filter((provider) => player.provenance[provider].includes(stat))
    .sort((a, b) => Number(b === 'prizepicks') - Number(a === 'prizepicks'))
    .map((provider) => ({ provider, line: postedLine(player, provider, stat) }));
  const posted = (provider) =>
    books.find((book) => book.provider === provider && book.line !== null);
  const market = MARKET_PROVIDERS.map(posted).find(Boolean);
  const lead = market ?? books.find((book) => book.line !== null);
  const lines = books.map((book) => book.line).filter((line) => line !== null);
  return {
    books,
    headline: lead?.line ?? null,
    headlineProvider: lead?.provider ?? null,
    fromMarket: Boolean(market),
    flagged: lines.length > 1 && Math.max(...lines) - Math.min(...lines) >= DISAGREEMENT_SPAN,
  };
};

// A book's gap from the headline: "+0.5", "−1". Trailing zeros are trimmed.
const signedGap = (gap) => `${gap < 0 ? '−' : '+'}${Math.abs(Math.round(gap * 100) / 100)}`;

// "Best Over −106 at Novig, best Under −102 at Novig, line 26.5"; a side no
// source prices says so.
const priceLabel = (best) => {
  const side = (name, quote) =>
    quote
      ? `best ${name} ${formatPrice(quote.price)} at ${bookName(quote.provider)}`
      : `no ${name} price`;
  const label = `${side('Over', best.over)}, ${side('Under', best.under)}, line ${formatStat(best.line)}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
};

function RailPrices({ best }) {
  const side = (letter, quote) => (
    <span>
      {letter} {quote ? <b>{formatPrice(quote.price)}</b> : <b>—</b>}
      {quote && (
        <>
          {' '}
          <i>{bookMark(quote.provider)}</i>
        </>
      )}
    </span>
  );
  return (
    <span className="rail-price" role="group" aria-label={priceLabel(best)}>
      {best.offHeadline && (
        <>
          <em>books {formatStat(best.line)}</em>{' '}
        </>
      )}
      {side('o', best.over)} {side('u', best.under)}
    </span>
  );
}

const averageOf = (values) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

function RailRow({ player, stat, historical, windowKey, injury, selected, onSelect, register }) {
  const serializedPlayerId = String(player.id);
  const gameLogsPath = `/?${filterSetToSearchParams({ player_name: player.name })}`;
  const seasonAverage = stat === 'PTS' ? player.seasonScoring : null;
  let value;
  let caption;
  let meta;
  let marks = null;
  let prices = null;
  let flagged = false;
  if (historical) {
    const focal = player.focalGameLine;
    const did = focal && Object.hasOwn(focal.stats, stat) ? focal.stats[stat] : null;
    const delta =
      did !== null && seasonAverage !== null ? Math.round((did - seasonAverage) * 10) / 10 : null;
    value = <b>{did === null ? '—' : formatStat(did)}</b>;
    caption = stat;
    meta = (
      <>
        {focal ? `${Math.round(focal.minutes)} min` : 'Minutes unavailable'}
        {delta !== null && (
          <em className={toneClass(delta)}>
            {' · '}
            {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
            {Math.abs(delta).toFixed(1)} vs his season average
          </em>
        )}
      </>
    );
  } else {
    const { books, headline, headlineProvider, fromMarket, ...rest } = linesFor(player, stat);
    flagged = rest.flagged;
    const score = headline === null ? scoreFor(player, stat, windowKey) : null;
    value =
      headline !== null ? (
        <b>{formatStat(headline)}</b>
      ) : (
        <b className={score === null ? undefined : toneClass(Math.round(score * 100))}>
          {score === null ? '—' : formatScorePercent(score)}
        </b>
      );
    caption =
      headline !== null
        ? seasonAverage !== null
          ? `${fromMarket ? 'market line' : 'line'} · ${seasonAverage.toFixed(1)} avg`
          : fromMarket
            ? 'market line'
            : 'line'
        : 'Matchup Score';
    const minutes = averageOf(player.last10Minutes);
    meta = minutes === null ? null : `${Math.round(minutes)} min last 10`;
    const differs = (line) => line !== null && line !== headline;
    const against = fromMarket ? 'the market' : headlineProvider && bookName(headlineProvider);
    marks = books.length ? (
      <span
        className="rail-books"
        aria-label={`${stat} posted by ${listWords(
          books.map(({ provider, line }) => {
            if (!differs(line)) return bookName(provider);
            const gap = line - headline;
            return `${bookName(provider)} at ${formatStat(line)}, ${Math.abs(
              Math.round(gap * 100) / 100,
            )} ${gap < 0 ? 'lower' : 'higher'} than ${against}`;
          }),
        )}`}
      >
        {books.map(({ provider, line }) => (
          <i key={provider} aria-hidden="true" className={differs(line) ? 'differs' : undefined}>
            {bookMark(provider)}
            {differs(line) ? ` ${signedGap(line - headline)}` : ''}
          </i>
        ))}
      </span>
    ) : null;
    const best = bestPrices(player, stat, headline);
    if (best && (best.over || best.under)) prices = <RailPrices best={best} />;
  }
  return (
    <article
      aria-label={`${player.name} player`}
      className={`rail-row${selected ? ' selected' : ''}${flagged ? ' lines-disagree' : ''}`}
    >
      <div className="rail-row-name">
        <h3>
          <Link
            aria-label={`${player.name} game logs`}
            className="player-game-logs"
            to={gameLogsPath}
          >
            {player.name}
            <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </h3>
        <p>
          {meta}
          {injury && <span className="injury-badge">{injury.status || injury.rawStatus}</span>}
        </p>
      </div>
      <div className="rail-row-value">
        {value}
        <small>{caption}</small>
        {marks}
        {prices}
        {flagged && <span className="selection-visually-hidden">Lines disagree</span>}
      </div>
      {/* The whole row opens the selection card; the name above stays its own link. */}
      <button
        ref={(node) => register(serializedPlayerId, node)}
        type="button"
        className="rail-row-open"
        aria-expanded={selected}
        aria-controls="matchup-selection-card"
        aria-label={selected ? 'Selected' : 'Open selection card'}
        onClick={() => onSelect(player)}
      />
    </article>
  );
}

/*
 * One stat at a time: the selected tab's, points on All. After the game each
 * row leads with what he did; before it, with his posted line, or his Matchup
 * Score when no book has posted a number.
 */
function PlayerRail({
  players,
  teamTricode,
  injuries,
  historical,
  unavailableMessage,
  market,
  windowKey,
  targetableCount,
  selectedId,
  onSelect,
  registerTrigger,
  headingRef,
}) {
  const stat = market === 'All' ? 'PTS' : market;
  const injuryById = new Map(
    injuries.teams.flatMap((team) => team.entries).map((entry) => [entry.id, entry]),
  );
  const scoped = players
    .filter((player) => market === 'All' || player.statCategories.includes(market))
    .sort((a, b) => {
      if ((a.seasonScoring === null) !== (b.seasonScoring === null)) {
        return a.seasonScoring === null ? 1 : -1;
      }
      return (b.seasonScoring ?? 0) - (a.seasonScoring ?? 0) || a.name.localeCompare(b.name);
    });
  const label = historical ? 'Players in game' : 'Targetable players';
  return (
    <aside className="player-rail" aria-label={label}>
      <div className="rail-heading">
        <p className="matchup-eyebrow">{label}</p>
        {/* Focus lands here when a closed card's own row is not on screen. */}
        <h2 ref={headingRef} tabIndex={-1}>
          {teamTricode ? `${teamTricode} · ` : ''}
          {stat}
        </h2>
        <p className="rail-count">
          By season scoring
          {targetableCount !== null ? ` · ${targetableCount} targetable returned` : ''}
        </p>
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
          {scoped.map((player) => (
            <RailRow
              key={player.id}
              player={player}
              stat={stat}
              historical={historical}
              windowKey={windowKey}
              injury={historical ? undefined : injuryById.get(player.injuryBadgeRef)}
              selected={selectedId === String(player.id)}
              onSelect={onSelect}
              register={registerTrigger}
            />
          ))}
        </div>
      )}
    </aside>
  );
}

/* ---------------------------- Defense Sheet ---------------------------- */

const SHEET_BASES = [
  'playTypes',
  'shotTypes',
  'shotZones',
  'assistLocations',
  'traditional',
  'reboundTypes',
];
const BASE_LABELS = {
  playTypes: 'Play types',
  shotTypes: 'Shot types',
  shotZones: 'Shot zones',
  assistLocations: 'Assists by location',
  traditional: 'Box score',
  reboundTypes: 'Rebound Types',
};
// Each category names its measures once, in its header row.
const BASE_COLUMNS = {
  playTypes: ['Points'],
  shotTypes: ['Attempts', 'Makes'],
  shotZones: ['Attempts', 'Makes'],
  assistLocations: ['Allowed'],
  traditional: ['Allowed'],
  reboundTypes: ['Allowed'],
};
const MEASURE_COLUMNS = {
  PTS: 'Points',
  FGA: 'Attempts',
  FG2A: 'Attempts',
  FG3A: 'Attempts',
  FGM: 'Makes',
  FG2M: 'Makes',
  FG3M: 'Makes',
};
// Bases that publish no rows while unavailable still belong to these markets.
const BASE_MARKETS = { reboundTypes: ['REB', 'PR', 'RA', 'PRA'] };
const SHARE_LABELS = {
  playTypes: 'possessions',
  shotZones: 'FGA',
  shotTypes: 'FGA',
  assistLocations: 'assists',
  reboundTypes: 'rebounds',
};

const rowMeasure = (row) => (row.key.includes(':') ? row.key.split(':')[1] : null);
// Catch-and-shoot 2s and under-10-ft 3s are too rare to read.
const isRareShotType = (row) => /^(Catch and Shoot:FG2|Less Than 10 ft:FG3)/.test(row.key);
const columnOf = (row) => MEASURE_COLUMNS[rowMeasure(row)] || 'Allowed';

/*
 * One sheet line per slice, its measures side by side. A shot type carries 2-
 * and 3-point measures, so each shot value is its own line ("Catch-and-shoot
 * 3s") pairing its attempts with its makes.
 */
const groupBySlice = (base, rows) => {
  const groups = new Map();
  for (const row of rows) {
    const shotValue = base === 'shotTypes' ? /^FG([23])/.exec(rowMeasure(row) || '')?.[1] : null;
    const id = shotValue ? `${row.sliceKey} ${shotValue}s` : row.sliceKey;
    if (!groups.has(id)) {
      const name = sliceName(row.sliceKey);
      groups.set(id, {
        id,
        sliceKey: row.sliceKey,
        shotValue: shotValue || null,
        name: shotValue ? `${name} ${shotValue}s` : name,
        rows: [],
      });
    }
    groups.get(id).rows.push(row);
  }
  return [...groups.values()];
};

// 30 allows the most, 1 the fewest.
const ordinal = (n) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
};
const rankWords = (rank) =>
  rank === 30
    ? 'allows the most'
    : rank === 1
      ? 'allows the fewest'
      : rank >= 16
        ? `allows the ${ordinal(31 - rank)} most`
        : `allows the ${ordinal(rank)} fewest`;
const formatRelative = (value) => {
  if (value === null) return '—';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)}%`;
};
const cellTitle = (stat) =>
  [
    `${stat.allowedPer48.toFixed(1)} per 48`,
    `${stat.sigmaDeviation > 0 ? '+' : ''}${stat.sigmaDeviation.toFixed(1)}σ`,
    `rank ${stat.rank} of 30 (30 allows the most)`,
    ...(stat.percentVsLeagueAverage === null ? [UNAVAILABLE_RELATIVE_LABEL] : []),
  ].join(' · ');

/*
 * The league average a slice is read against is published on the diet fact
 * itself, so it is the same number for every player who has that slice. Any one
 * of them answers for the slice; a slice nobody in the pool has, or one the
 * backend publishes no league average for, has no line to start a Target from.
 */
const sliceLeagueAverageShare = (players, base, sliceKey) => {
  for (const player of players) {
    const share = findDietShare(player, base, sliceKey)?.leagueAverageShare;
    if (typeof share === 'number') return share;
  }
  return null;
};

// Who leans on a slice more than the league does, most first. Players below
// league are left off: the sheet lists who a soft spot is for. A shot type row
// reads his twos or threes of it, not the whole shot type.
const leansFor = (players, base, sliceKey, shotValue, market) =>
  SHARE_LABELS[base]
    ? players
        .filter((player) => market === 'All' || player.statCategories.includes(market))
        .flatMap((player) => {
          const share = getDisplayableDietShare(player, base, sliceKey, shotValue);
          if (!share || share.sigmaDeviation <= 0) return [];
          const volume = dietBaseVolumePerGame(player, base);
          return [{ player, share, thin: isThinDietShare(base, volume), volume }];
        })
        .sort((a, b) => b.share.sigmaDeviation - a.share.sigmaDeviation)
    : [];

function SheetCell({ row, windowKey }) {
  const stat = row[windowKey];
  return (
    <div className="sheet-cell" title={cellTitle(stat)}>
      <b className={toneClass(stat.percentVsLeagueAverage)}>
        {formatRelative(stat.percentVsLeagueAverage)}
      </b>
      <span
        className="rank-track"
        role="img"
        aria-label={`Rank ${stat.rank} of 30: ${rankWords(stat.rank)}`}
      >
        <i style={{ left: `${((stat.rank - 1) / 29) * 100}%`, '--rank': stat.rank }}>{stat.rank}</i>
      </span>
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
  windowName,
  windowSection,
  publishedSeason,
  onCapture,
}) {
  const inMarket = (row) => market === 'All' || row.markets.includes(market);
  let hidden = 0;
  const sections = SHEET_BASES.filter((base) => team.defenseSheet[base]).map((base) => {
    // Play types read by points only; the possession rows repeat the same story.
    const rows = team.defenseSheet[base].filter(
      (row) =>
        !(base === 'playTypes' && rowMeasure(row) === 'POSS') &&
        !(base === 'shotTypes' && isRareShotType(row)),
    );
    const marketRows = rows.filter(inMarket);
    const availability = surfaceAvailability[base][windowKey];
    if (availability.status !== 'available') {
      return {
        base,
        availability,
        // An unavailable base may carry no rows to name its markets, so the
        // markets it supports decide whether this selection is waiting on it.
        relevant:
          marketRows.length > 0 ||
          (BASE_MARKETS[base] ? market === 'All' || BASE_MARKETS[base].includes(market) : false),
        legacyUnavailableRow: null,
        groups: [],
      };
    }
    const legacyUnavailableRow =
      base === 'traditional'
        ? marketRows.find((row) => row.key === 'OPP_REB' && row[windowKey] === null) || null
        : null;
    const lead = (group) => {
      const values = group.rows
        .filter(inMarket)
        .map((row) => row[windowKey].percentVsLeagueAverage)
        .filter((value) => value !== null);
      return values.length ? Math.max(...values) : null;
    };
    const groups = groupBySlice(
      base,
      rows.filter((row) => row[windowKey] !== null),
    )
      .filter((group) => group.rows.some(inMarket))
      .filter((group) => {
        const shown = group.rows
          .filter(inMarket)
          .some((row) => Math.abs(row[windowKey].sigmaDeviation) >= deviation);
        if (!shown) hidden += 1;
        return shown;
      })
      // Softest spot first; a slice with no league comparison reads last.
      .map((group) => ({ ...group, lead: lead(group) }))
      .sort((a, b) => {
        if ((a.lead === null) !== (b.lead === null)) return a.lead === null ? 1 : -1;
        return (b.lead ?? 0) - (a.lead ?? 0);
      });
    return { base, availability, relevant: marketRows.length > 0, legacyUnavailableRow, groups };
  });
  const visibleCount = sections.reduce((total, section) => total + section.groups.length, 0);
  const hasNamedUnavailable = sections.some(
    (section) =>
      section.legacyUnavailableRow ||
      (section.availability.status !== 'available' && section.relevant),
  );
  return (
    <section className="defense-sheet" aria-labelledby="defense-sheet-heading">
      <header className="sheet-heading">
        <h2 id="defense-sheet-heading">What {team.tricode} allows</h2>
        <p>
          Compared with the league average, softest spots first.
          {hidden ? ` ${hidden} close to average hidden.` : ''}
        </p>
      </header>
      {visibleCount === 0 && !hasNamedUnavailable && (
        <p className="honest-empty">No Defense Sheet rows match these controls.</p>
      )}
      <div className="sheet-sections">
        {sections.map(({ base, availability, relevant, legacyUnavailableRow, groups }) => {
          const label = BASE_LABELS[base];
          const season = trailingSeason(
            availability.season ?? windowSection?.season,
            publishedSeason,
          );
          // The toggle names the shortest Last 15; a section covering more says so.
          const games =
            windowKey === 'last15' && availability.status === 'available'
              ? last15Games(availability, windowSection)
              : null;
          const title = (
            <div className="sheet-base-title">
              <h3 id={`base-${base}`}>{label}</h3>
              {season && <span className="sheet-season">{season} season</span>}
              {games !== null && `Last ${games}` !== windowName && (
                <span className="sheet-season">Last {games}</span>
              )}
            </div>
          );
          if (availability.status !== 'available') {
            return relevant ? (
              <section className="sheet-base" key={base} aria-labelledby={`base-${base}`}>
                <div className="sheet-base-head">{title}</div>
                <p className="honest-empty">
                  {label} unavailable for {windowName}:{' '}
                  {surfaceReason(availability.unavailableReason, windowKey)}
                </p>
              </section>
            ) : null;
          }
          if (!groups.length && !legacyUnavailableRow) return null;
          const columns = BASE_COLUMNS[base];
          return (
            <section
              className="sheet-base"
              key={base}
              aria-labelledby={`base-${base}`}
              style={{ '--cols': columns.length }}
            >
              <div className="sheet-base-head">
                {title}
                {columns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>
              {groups.map((group) => {
                const why =
                  selectedPlayer &&
                  getDisplayableDietShare(selectedPlayer, base, group.sliceKey, group.shotValue);
                const leans = leansFor(players, base, group.sliceKey, group.shotValue, market);
                return (
                  <article
                    key={group.id}
                    className={`sheet-row${why ? ' selection-why' : ''}`}
                    aria-label={group.name}
                  >
                    <h4>{group.name}</h4>
                    {columns.map((column) => {
                      const row = group.rows.find((item) => columnOf(item) === column);
                      return row ? (
                        <SheetCell key={column} row={row} windowKey={windowKey} />
                      ) : (
                        <span key={column} className="sheet-cell-empty" />
                      );
                    })}
                    {/* The row is the evidence, so the Target is captured where
                        it is read: this team as the opponent, this slice as the
                        Qualifier. */}
                    {DIET_BASE_WIRE_NAMES[base] ? (
                      <button
                        type="button"
                        className="sheet-save"
                        aria-label={`Save ${group.name} as a Target`}
                        title="Save as Target"
                        onClick={() =>
                          onCapture({
                            opponent: team.tricode,
                            base: DIET_BASE_WIRE_NAMES[base],
                            sliceKey: group.sliceKey,
                            leagueAverageShare: sliceLeagueAverageShare(
                              players,
                              base,
                              group.sliceKey,
                            ),
                          })
                        }
                      >
                        <Bookmark size={16} strokeWidth={2} aria-hidden="true" />
                      </button>
                    ) : (
                      <span />
                    )}
                    {leans.length > 0 && (
                      <ul className="sheet-leans" aria-label={`Players leaning on ${group.name}`}>
                        {leans.map(({ player, share, thin, volume }) => (
                          <li
                            key={player.id}
                            className={thin ? 'lean-thin' : undefined}
                            title={`${Math.round(share.share * 100)}% of his ${SHARE_LABELS[base]}${
                              thin
                                ? ` · thin sample (${volume.toFixed(1)} ${SHARE_LABELS[base]} per game)`
                                : ''
                            }`}
                          >
                            <span>{player.name}</span> <b>{Math.round(share.share * 100)}%</b>
                            {thin && <em> · thin</em>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
              {groups.length > 0 && (
                <div className="sheet-legend" aria-hidden="true">
                  <span />
                  {columns.map((column) => (
                    <span key={column}>
                      <em>fewest</em>
                      <em>most</em>
                    </span>
                  ))}
                </div>
              )}
              {legacyUnavailableRow && (
                <p className="honest-empty">Opponent rebounds unavailable for {windowName}.</p>
              )}
            </section>
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

// Away first, then home, so the tabs read the same way as the title.
function TeamTabs({ matchup, defenseTeam, onSelect }) {
  const tabs = [matchup.game.away, matchup.game.home]
    .map((side) => matchup.teams.find((team) => team.teamId === side.teamId))
    .filter(Boolean);
  return (
    <div className="team-tabs" role="group" aria-label="Defense team">
      {tabs.map((team) => {
        const opponent = matchup.teams.find((other) => other.teamId !== team.teamId);
        return (
          <button
            type="button"
            key={team.teamId}
            aria-pressed={team.teamId === defenseTeam.teamId}
            onClick={() => onSelect(team.teamId)}
          >
            <span className="team-tab-name">
              {team.tricode} <small>defense</small>
            </span>
            {opponent && <span className="team-tab-sub">vs {opponent.tricode} players</span>}
          </button>
        );
      })}
    </div>
  );
}

const openingMarket = (markets) => (markets.includes('PTS') ? 'PTS' : 'All');

function Detail({ matchup, gameId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMinuteNow(true);
  const homeTricode = matchup.game.home.tricode;
  const initialTeam =
    matchup.teams.find((team) => team.tricode === homeTricode) || matchup.teams[0];
  const [teamId, setTeamId] = useState(initialTeam.teamId);
  const [windowKey, setWindowKey] = useState('season');
  const [deviation, setDeviation] = useState(1);
  const selectedId = searchParams.get('player');
  const selectionTriggers = useRef(new Map());
  const previousSelectedId = useRef(null);
  const railHeading = useRef(null);
  const [selectionState, setSelectionState] = useState({
    status: 'idle',
    playerId: null,
    data: null,
    error: null,
  });
  const [capture, setCapture] = useState(null);
  const defenseTeam = matchup.teams.find((team) => team.teamId === teamId) || initialTeam;
  const opposingTeam = matchup.teams.find((team) => team.teamId !== defenseTeam.teamId);
  const opposingTeamId = opposingTeam?.teamId;
  const experienceMode = matchup.experience.mode;
  const historical = experienceMode === 'historical';
  const sections = matchup.experience.sections;
  const poolAvailable = !['missing', 'unavailable'].includes(matchup.freshness.pool.status);
  const participantsAvailable = historical
    ? sections.participants.status === 'available'
    : poolAvailable;
  // Nobody is selectable when Participants are unavailable, so a deep link
  // cannot open a dossier the rail says this matchup does not have.
  const selectedPlayer =
    (participantsAvailable && matchup.players.find((player) => String(player.id) === selectedId)) ||
    null;
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
    () => [
      'All',
      ...orderCategories([...new Set(opposingPlayers.flatMap((player) => player.statCategories))]),
    ],
    [opposingPlayers],
  );
  // The page opens on points when the players on the sheet's other side have
  // points, and the rail reads the same stat the sheet is filtered to.
  // A chosen stat the other side does not have falls back the same way.
  const [chosenMarket, setMarket] = useState(null);
  const market = markets.includes(chosenMarket) ? chosenMarket : openingMarket(markets);
  const shortest = shortestLast15(matchup);
  const windows = WINDOWS.map((item) =>
    item.key === 'last15' && shortest < 15 ? { ...item, label: `Last ${shortest}` } : item,
  );
  const windowName = windows.find((item) => item.key === windowKey).label;
  const last15Section = historical ? sections.last15Defense : null;
  const last15Blocked = Boolean(last15Section) && last15Section.status !== 'available';
  const injuriesAvailable = historical
    ? sections.injuries.status === 'available'
    : matchup.injuries.status !== 'unavailable';
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
      mode: experienceMode,
      focalGameLine: selectedPlayer.focalGameLine,
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
  }, [experienceMode, gameId, selectedPlayer]);
  useEffect(() => {
    if (previousSelectedId.current && !selectedId) {
      // The stat in view can hide the row that opened the card (a deep link
      // to a player without it), so the rail heading keeps focus on the page.
      (selectionTriggers.current.get(previousSelectedId.current) || railHeading.current)?.focus();
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
          <p className="matchup-eyebrow">Matchup</p>
          <h1>
            {matchup.game.away.tricode} @ {matchup.game.home.tricode}
          </h1>
        </div>
        <MatchupSummary matchup={matchup} now={now} />
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
          <TeamTabs matchup={matchup} defenseTeam={defenseTeam} onSelect={setTeamId} />
          <PlayerRail
            players={opposingPlayers}
            teamTricode={opposingTeam?.tricode}
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
            headingRef={railHeading}
          />
          {/* An injury report nobody has is named in the summary sentence. */}
          {injuriesAvailable && <InjuryReport injuries={matchup.injuries} now={now} />}
        </div>
        <div className="matchup-workspace">
          <section className="detail-controls" aria-label="Defense Sheet controls">
            <div className="control-row">
              <div className="control-group">
                <span className="control-label" aria-hidden="true">
                  Window
                </span>
                <div className="segmented" role="group" aria-label="Stat window">
                  {windows.map((item) => (
                    <button
                      type="button"
                      aria-pressed={windowKey === item.key}
                      disabled={item.key === 'last15' && last15Blocked}
                      title={
                        item.key === 'last15' && last15Blocked
                          ? sectionReason(last15Section)
                          : undefined
                      }
                      key={item.key}
                      onClick={() => setWindowKey(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-group">
                <span className="control-label" aria-hidden="true">
                  Show
                </span>
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
              </div>
            </div>
            <div
              className="market-tabs"
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
          </section>
          {selectedId && !selectedPlayer && (
            <p role="alert" className="selection-card">
              That player is not available in this matchup.
            </p>
          )}
          {selectedPlayer && (
            <SelectionCard
              player={selectedPlayer}
              game={matchup.game}
              selection={selectionState.playerId === selectedPlayer.id ? selectionState.data : null}
              status={
                selectionState.playerId === selectedPlayer.id ? selectionState.status : 'loading'
              }
              error={selectionState.error}
              windowKey={windowKey}
              windowName={windowName}
              sheetMarket={market}
              whyRelevant={selectedPlayer.teamId !== defenseTeam.teamId}
              historical={historical}
              onClose={() => updateSelectedPlayer(null)}
            />
          )}
          {/* A historical Defense Sheet is governed by its own Surface
              availability, so the generic legacy stats marker never suppresses
              it. The live journey keeps the gate it has always had. */}
          {!historical && matchup.freshness.stats.status === 'missing' ? (
            <section className="defense-sheet" aria-labelledby="defense-sheet-heading">
              <h2 id="defense-sheet-heading">What {defenseTeam.tricode} allows</h2>
              <p className="honest-empty">Defense Sheet unavailable because stats are missing.</p>
            </section>
          ) : (
            <DefenseSheet
              team={defenseTeam}
              players={opposingPlayers}
              market={market}
              windowKey={windowKey}
              deviation={deviation}
              selectedPlayer={selectedPlayer?.teamId !== defenseTeam.teamId ? selectedPlayer : null}
              surfaceAvailability={matchup.league.surfaceAvailability}
              windowName={windowName}
              windowSection={sections?.[WINDOW_SECTIONS[windowKey]]}
              publishedSeason={matchup.asOfSeason}
              onCapture={setCapture}
            />
          )}
        </div>
      </div>
      <TargetCaptureModal capture={capture} onHide={() => setCapture(null)} />
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
        <p>
          A free account unlocks Defense Sheets and player data. Sign up with Google to open it.
        </p>
        <LoginButton size="sm" label="Sign up free" />
      </main>
    );
  }
  return (
    <main className="matchup-page">
      {state.status === 'loading' && <p role="status">Loading matchup…</p>}
      {state.status === 'error' && (
        <p role="alert">
          <ErrorMessage message={state.error} />
        </p>
      )}
      {state.status === 'ready' && <Detail matchup={state.matchup} gameId={gameId} />}
    </main>
  );
}
