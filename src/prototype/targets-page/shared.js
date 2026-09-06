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
  formatQualifierParts,
  nudgeThresholdPercent,
} from '../../targets/targetCatalog';
import { useResolvedTargets, useTargets } from '../../targets/useTargets';
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
    ['v', 'dv', 'date'].forEach((name) => {
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

export function QualifierFields({ qualifier, index, onPatch, onRemove }) {
  return (
    <div className="pt-qualifier">
      <select
        aria-label={`Qualifier ${index + 1} diet base`}
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
        value={qualifier.sliceKey}
        onChange={(event) => onPatch({ sliceKey: event.target.value })}
      >
        {TARGET_SLICES[qualifier.base].map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <span className="pt-comparator" role="group" aria-label={`Qualifier ${index + 1} comparator`}>
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
          onClick={() =>
            onPatch({ thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, -1) })
          }
        >
          −
        </button>
        <input
          type="number"
          min="0"
          max="100"
          step="any"
          aria-label={`Qualifier ${index + 1} threshold percent`}
          value={qualifier.thresholdPercent}
          onChange={(event) => onPatch({ thresholdPercent: event.target.value })}
          onKeyDown={(event) => {
            const delta = { ArrowUp: 1, ArrowDown: -1 }[event.key];
            if (!delta) return;
            event.preventDefault();
            onPatch({ thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, delta) });
          }}
        />
        <button
          type="button"
          aria-label={`Qualifier ${index + 1} threshold up 1%`}
          onClick={() =>
            onPatch({ thresholdPercent: nudgeThresholdPercent(qualifier.thresholdPercent, 1) })
          }
        >
          +
        </button>
        <span>%</span>
      </span>
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
