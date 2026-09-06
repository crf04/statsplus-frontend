/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * What every variant needs and none of them should have to lay out: the two
 * real reads joined into one list, a stub save that keeps a composed Target in
 * memory, a draft the composers edit, and the small controls a Qualifier is
 * edited with. Layout stays in the variants.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatTip } from '../../calendarDate';
import {
  blankQualifier,
  blankTargetDraft,
  describeDraft,
  targetToDraft,
} from '../../targets/TargetForm';
import {
  NBA_TEAM_TRICODES,
  TARGET_BASES,
  TARGET_COMPARATORS,
  TARGET_SLICES,
  deriveTargetTitle,
  findTargetBase,
  formatQualifierParts,
  nudgeThresholdPercent,
} from '../../targets/targetCatalog';
import { useResolvedTargets, useTargets } from '../../targets/useTargets';
import { LeagueHint, leagueAveragePercent } from './leagueAverages';
import { decodeResolvedTargets, decodeTargets } from '../../targets/targetsApi';
import { PROTO_STANDALONE } from './prototypeMode';
import { useBacktests } from './history';
import targetsMock from './mock/targets.json';
import resolveMock from './mock/resolve-2026-04-10.json';

/* Standalone: the production payloads captured on 2026-09-06 stand in for
   the two reads, decoded on first use by the real decoders so the shapes
   cannot drift (and so the shipped page's tests, which mock the API module,
   can still load this file). */
const noop = () => {};
let mockList = null;
let mockResolved = null;
const useMockTargets = () => {
  if (!mockList) {
    mockList = {
      status: 'ready',
      error: null,
      authLoading: false,
      isAuthenticated: true,
      reload: noop,
      targets: decodeTargets(targetsMock),
    };
  }
  return mockList;
};
const useMockResolved = () => {
  if (!mockResolved) {
    mockResolved = {
      status: 'ready',
      error: null,
      reload: noop,
      ...decodeResolvedTargets(resolveMock),
    };
  }
  return mockResolved;
};
const useList = PROTO_STANDALONE ? useMockTargets : useTargets;
const useResolved = PROTO_STANDALONE ? useMockResolved : useResolvedTargets;

/* In the standalone build there is nowhere for a link to go. */
export function ProtoLink({ to, children, ...rest }) {
  const [searchParams] = useSearchParams();
  if (to.startsWith('/targets/')) {
    const next = new URLSearchParams();
    next.set('proto', 'targets');
    ['v', 'dv', 'date', 'q'].forEach((name) => {
      if (searchParams.get(name)) next.set(name, searchParams.get(name));
    });
    return (
      <Link to={`${to}?${next.toString()}`} {...rest}>
        {children}
      </Link>
    );
  }
  if (PROTO_STANDALONE) return <span {...rest}>{children}</span>;
  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );
}

let localSequence = 0;

export const useTargetsPrototypeData = (date) => {
  const list = useList();
  const resolved = useResolved(date);
  const [extras, setExtras] = useState([]);
  const backtests = useBacktests(list.targets);

  const items = useMemo(() => {
    const byId = new Map(resolved.entries.map((entry) => [String(entry.target.id), entry]));
    const all = [...extras, ...list.targets].map((target) => ({
      target,
      entry: byId.get(String(target.id)) || null,
    }));
    // Live first, then idle; each group keeps the list's own newest-first order.
    return [...all.filter((item) => item.entry?.game), ...all.filter((item) => !item.entry?.game)];
  }, [extras, list.targets, resolved.entries]);

  /* The stub save: the Target exists for this session only and never reaches
     the backend, so it is marked as such wherever it is shown. */
  const saveLocally = (request) => {
    localSequence += 1;
    setExtras((previous) => [
      {
        id: `proto-${localSequence}`,
        opponent: request.opponent,
        qualifiers: request.qualifiers,
        note: request.note,
        title: deriveTargetTitle(request),
        createdAt: new Date().toISOString(),
        local: true,
      },
      ...previous,
    ]);
  };

  return { list, resolved, items, backtests, saveLocally, slateDate: resolved.slateDate };
};

export const isLive = (item) => Boolean(item.entry?.game);

export const fitCount = (item) =>
  item.entry?.game && item.entry.availability.status === 'available'
    ? item.entry.players.length
    : null;

/* How the day answers one Target, in the fewest words. */
export const describeToday = (item) => {
  const { entry } = item;
  if (!entry) return item.target.local ? 'unsaved' : '—';
  if (!entry.game) return 'no game';
  if (entry.availability.status !== 'available') return 'pool unavailable';
  return `${entry.players.length} fit`;
};

export const shortDate = (date) =>
  date
    ? new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${date}T12:00:00Z`))
    : '';

export const formatCreated = (createdAt) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(createdAt),
  );

/* --- a draft, and the controls that edit one --- */

export const useDraft = (initial) => {
  const [draft, setDraft] = useState(() => (initial ? targetToDraft(initial) : blankTargetDraft()));
  const patch = (fields) => setDraft((current) => ({ ...current, ...fields }));
  const patchQualifier = (index, fields) =>
    setDraft((current) => ({
      ...current,
      qualifiers: current.qualifiers.map((qualifier, position) =>
        position === index ? { ...qualifier, ...fields } : qualifier,
      ),
    }));
  const addQualifier = () =>
    setDraft((current) => ({ ...current, qualifiers: [...current.qualifiers, blankQualifier()] }));
  const removeQualifier = (index) =>
    setDraft((current) => ({
      ...current,
      qualifiers: current.qualifiers.filter((_, position) => position !== index),
    }));
  const reset = (target) => setDraft(target ? targetToDraft(target) : blankTargetDraft());
  return {
    draft,
    patch,
    patchQualifier,
    addQualifier,
    removeQualifier,
    reset,
    ...describeDraft(draft),
  };
};

export function OpponentSelect({ value, onChange, className, big = false }) {
  return (
    <select
      className={`pt-opponent${big ? ' is-big' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Opponent"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {NBA_TEAM_TRICODES.map((tricode) => (
        <option key={tricode} value={tricode}>
          {tricode}
        </option>
      ))}
    </select>
  );
}

/*
 * One Qualifier as a row that reads top to bottom: which slice, then the
 * bound on it, then where that bound sits against the league on a track. The
 * track is the hint: the league average is a tick, the threshold a marker,
 * and the side of it a player has to be on is shaded.
 */
function QualifierTrack({ qualifier, index, onPatch, onRemove }) {
  const unit = findTargetBase(qualifier.base)?.unit || '';
  const league = leagueAveragePercent(qualifier.base, qualifier.sliceKey);
  const threshold = Number(qualifier.thresholdPercent);
  const hasThreshold = qualifier.thresholdPercent !== '' && Number.isFinite(threshold);
  const top = Math.max(
    60,
    Math.ceil((Math.max(hasThreshold ? threshold : 0, league || 0) + 10) / 10) * 10,
  );
  const at = (value) => `${Math.min(100, Math.max(0, (value / top) * 100))}%`;
  const above = qualifier.comparator === 'at_or_above';
  const nudge = (delta) =>
    onPatch({ thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, delta) });
  return (
    <div className="pt-qualifier">
      <div className="pt-q-slice">
        <select
          aria-label={`Qualifier ${index + 1} diet base`}
          className="pt-q-base"
          value={qualifier.base}
          onChange={(event) =>
            onPatch({ base: event.target.value, sliceKey: TARGET_SLICES[event.target.value][0][0] })
          }
        >
          {TARGET_BASES.map((base) => (
            <option key={base.key} value={base.key}>
              {base.label}
            </option>
          ))}
        </select>
        <select
          aria-label={`Qualifier ${index + 1} slice`}
          className="pt-q-key"
          value={qualifier.sliceKey}
          onChange={(event) => onPatch({ sliceKey: event.target.value })}
        >
          {TARGET_SLICES[qualifier.base].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {onRemove && (
          <button
            type="button"
            className="pt-remove"
            aria-label={`Remove Qualifier ${index + 1}`}
            onClick={onRemove}
          >
            ×
          </button>
        )}
      </div>
      <div className="pt-q-bound">
        <span
          className="pt-comparator"
          role="group"
          aria-label={`Qualifier ${index + 1} comparator`}
        >
          {TARGET_COMPARATORS.map((comparator) => (
            <button
              type="button"
              key={comparator.key}
              aria-label={comparator.label}
              aria-pressed={qualifier.comparator === comparator.key}
              onClick={() => onPatch({ comparator: comparator.key })}
            >
              {comparator.symbol}
            </button>
          ))}
        </span>
        <span className="pt-threshold">
          <button
            type="button"
            aria-label={`Qualifier ${index + 1} threshold down 1%`}
            onClick={() => nudge(-1)}
          >
            −
          </button>
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            placeholder="—"
            aria-label={`Qualifier ${index + 1} threshold percent`}
            value={qualifier.thresholdPercent}
            onChange={(event) => onPatch({ thresholdPercent: event.target.value })}
            onKeyDown={(event) => {
              const delta = { ArrowUp: 1, ArrowDown: -1 }[event.key];
              if (!delta) return;
              event.preventDefault();
              nudge(delta);
            }}
          />
          <button
            type="button"
            aria-label={`Qualifier ${index + 1} threshold up 1%`}
            onClick={() => nudge(1)}
          >
            +
          </button>
        </span>
        <span className="pt-q-unit">% {unit}</span>
        <LeagueHint
          base={qualifier.base}
          sliceKey={qualifier.sliceKey}
          onUse={(thresholdPercent) => onPatch({ thresholdPercent })}
        />
      </div>
      <div className="pt-q-track" aria-hidden="true">
        {hasThreshold && (
          <i
            className="pt-q-fill"
            style={above ? { left: at(threshold), right: 0 } : { left: 0, width: at(threshold) }}
          />
        )}
        {league !== null && (
          <i className="pt-q-league" style={{ left: at(league) }}>
            <small>lg</small>
          </i>
        )}
        {hasThreshold && <i className="pt-q-mark" style={{ left: at(threshold) }} />}
        <small className="pt-q-scale">{top}%</small>
      </div>
    </div>
  );
}

/*
 * Idea 2 — Slider. The threshold is the handle on a league-scaled track;
 * drag it, or step it with the keys. The comparator is one toggle that flips
 * which side of the handle shades. Nothing is typed.
 */
function QualifierSlider({ qualifier, index, onPatch, onRemove }) {
  const unit = findTargetBase(qualifier.base)?.unit || '';
  const league = leagueAveragePercent(qualifier.base, qualifier.sliceKey);
  const threshold = Number(qualifier.thresholdPercent);
  const hasThreshold = qualifier.thresholdPercent !== '' && Number.isFinite(threshold);
  const top = Math.max(
    60,
    Math.ceil((Math.max(hasThreshold ? threshold : 0, league || 0) + 10) / 10) * 10,
  );
  const at = (value) => `${Math.min(100, Math.max(0, (value / top) * 100))}%`;
  const above = qualifier.comparator === 'at_or_above';
  return (
    <div className="pt-qualifier is-slider">
      <div className="pt-q-slice">
        <select
          aria-label={`Qualifier ${index + 1} diet base`}
          className="pt-q-base"
          value={qualifier.base}
          onChange={(event) =>
            onPatch({ base: event.target.value, sliceKey: TARGET_SLICES[event.target.value][0][0] })
          }
        >
          {TARGET_BASES.map((base) => (
            <option key={base.key} value={base.key}>
              {base.label}
            </option>
          ))}
        </select>
        <select
          aria-label={`Qualifier ${index + 1} slice`}
          className="pt-q-key"
          value={qualifier.sliceKey}
          onChange={(event) => onPatch({ sliceKey: event.target.value })}
        >
          {TARGET_SLICES[qualifier.base].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {onRemove && (
          <button
            type="button"
            className="pt-remove"
            aria-label={`Remove Qualifier ${index + 1}`}
            onClick={onRemove}
          >
            ×
          </button>
        )}
      </div>
      <div className="pt-q-slider">
        <button
          type="button"
          className="pt-q-flip"
          aria-label={
            above ? 'At or above; press for at or below' : 'At or below; press for at or above'
          }
          onClick={() => onPatch({ comparator: above ? 'at_or_below' : 'at_or_above' })}
        >
          {above ? '≥' : '≤'}
        </button>
        <span className="pt-q-range">
          {hasThreshold && (
            <i
              className="pt-q-fill"
              style={above ? { left: at(threshold), right: 0 } : { left: 0, width: at(threshold) }}
            />
          )}
          {league !== null && (
            <i className="pt-q-league" style={{ left: at(league) }}>
              <small>lg {league}%</small>
            </i>
          )}
          <input
            type="range"
            min="0"
            max={top}
            step="1"
            aria-label={`Qualifier ${index + 1} threshold percent`}
            value={hasThreshold ? threshold : 0}
            onChange={(event) => onPatch({ thresholdPercent: event.target.value })}
          />
          {hasThreshold && (
            <b className="pt-q-value" style={{ left: at(threshold) }}>
              {threshold}%
            </b>
          )}
        </span>
        <span className="pt-q-unit">{unit}</span>
      </div>
    </div>
  );
}

/*
 * Idea 3 — Line. One dense line per Qualifier, no boxes: the slice as one
 * grouped pick, the bound typed, and the distance from the league average
 * said in words beside it. The shape of a filter chip rather than a form.
 */
function QualifierLine({ qualifier, index, onPatch, onRemove }) {
  const league = leagueAveragePercent(qualifier.base, qualifier.sliceKey);
  const threshold = Number(qualifier.thresholdPercent);
  const hasThreshold = qualifier.thresholdPercent !== '' && Number.isFinite(threshold);
  const gap = hasThreshold && league !== null ? Math.round(threshold - league) : null;
  const nudge = (delta) =>
    onPatch({ thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, delta) });
  return (
    <div className="pt-qualifier is-line">
      <select
        aria-label={`Qualifier ${index + 1} slice`}
        className="pt-q-pick"
        value={`${qualifier.base}|${qualifier.sliceKey}`}
        onChange={(event) => {
          const [base, sliceKey] = event.target.value.split('|');
          onPatch({ base, sliceKey });
        }}
      >
        {TARGET_BASES.map((base) => (
          <optgroup key={base.key} label={base.label}>
            {TARGET_SLICES[base.key].map(([key, label]) => (
              <option key={key} value={`${base.key}|${key}`}>
                {label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="pt-q-word">share</span>
      <select
        aria-label={`Qualifier ${index + 1} comparator`}
        className="pt-q-cmp"
        value={qualifier.comparator}
        onChange={(event) => onPatch({ comparator: event.target.value })}
      >
        {TARGET_COMPARATORS.map((comparator) => (
          <option key={comparator.key} value={comparator.key}>
            {comparator.symbol}
          </option>
        ))}
      </select>
      <input
        className="pt-q-num"
        type="number"
        min="0"
        max="100"
        step="any"
        placeholder="—"
        aria-label={`Qualifier ${index + 1} threshold percent`}
        value={qualifier.thresholdPercent}
        onChange={(event) => onPatch({ thresholdPercent: event.target.value })}
        onKeyDown={(event) => {
          const delta = { ArrowUp: 1, ArrowDown: -1 }[event.key];
          if (!delta) return;
          event.preventDefault();
          nudge(delta);
        }}
      />
      <span className="pt-q-word">%</span>
      {league !== null && (
        <button
          type="button"
          className="pt-q-gap"
          title="League-average share · press to use it"
          onClick={() => onPatch({ thresholdPercent: String(league) })}
        >
          {gap === null
            ? `lg ${league}%`
            : gap === 0
              ? 'at league'
              : `${gap > 0 ? '+' : ''}${gap} vs lg ${league}%`}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          className="pt-remove"
          aria-label={`Remove Qualifier ${index + 1}`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* Which drawing of a Qualifier: `q=1` track (default), `2` slider, `3` line. */
export const CRITERIA_STYLES = { 1: 'Track', 2: 'Slider', 3: 'Line' };

export const useCriteriaStyle = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Chris's verdict (2026-09-06): the slider.
  const style = CRITERIA_STYLES[searchParams.get('q')] ? searchParams.get('q') : '2';
  const setStyle = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set('q', next);
    setSearchParams(params, { replace: true });
  };
  return { style, setStyle };
};

export function QualifierFields(props) {
  const { style } = useCriteriaStyle();
  if (style === '2') return <QualifierSlider {...props} />;
  if (style === '3') return <QualifierLine {...props} />;
  return <QualifierTrack {...props} />;
}

/* --- small read-only pieces --- */

export function QualifierChips({ target }) {
  return (
    <span className="pt-chips">
      {target.qualifiers.map((qualifier, index) => {
        const { label, value } = formatQualifierParts(qualifier);
        return (
          <span className="pt-chip" key={index}>
            {label} <b>{value}</b>
          </span>
        );
      })}
    </span>
  );
}

/*
 * Whether the opponent plays today, and nothing more: the Matchups page owns
 * the game itself. A live Target gets a dot and the game, an idle one a
 * quiet line, so the absence reads as an answer rather than a gap.
 */
export function TodayIndicator({ entry }) {
  if (!entry) return null;
  if (!entry.game) return <span className="pt-today is-idle">no game today</span>;
  const { game } = entry;
  return (
    <ProtoLink className="pt-today is-live" to={`/matchups/${game.gameId}`}>
      <i aria-hidden="true" />
      game today
      <b>
        {game.away.tricode} @ {game.home.tricode}
      </b>
      <small>{formatTip(game.scheduledAt)}</small>
    </ProtoLink>
  );
}

export function GameLine({ game }) {
  return (
    <span className="pt-game">
      <ProtoLink to={`/matchups/${game.gameId}`}>
        {game.away.tricode} @ {game.home.tricode}
      </ProtoLink>
      <small>{formatTip(game.scheduledAt)}</small>
      {game.status.state !== 'scheduled' && <em>{game.status.label}</em>}
    </span>
  );
}
