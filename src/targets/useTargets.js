import { historicalDate, readRevisit } from '../revisitCache';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { beginStatPreferenceRead } from './useStatPreferences';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import {
  fetchDietBaselines,
  fetchSeasonMinutes,
  fetchResolvedTargets,
  fetchTargetPreview,
  fetchTargets,
} from './targetsApi';

const LOAD_FAILURE = 'Unable to load your Targets. Please try again.';
const PREVIEW_FAILURE = 'Unable to read the season for this draft. Please try again.';

const EMPTY_LIST = { targets: [] };
const EMPTY_RESOLUTION = { slateDate: null, entries: [] };

/*
 * How long a draft has to hold still before the Lab reads it. Long enough that
 * typing "35" is one request rather than two, short enough to feel like the
 * table answered the keystroke.
 */
export const PREVIEW_DELAY_MS = 600;

/*
 * Each read returns the state it contributes, so the hook below can hold any
 * of them without knowing which one it is holding. What a read is scoped by —
 * a Slate Date, a Target id, or nothing at all — travels as one opaque value.
 */
const readList = async ({ signal, userId }) => {
  const preferences = beginStatPreferenceRead(userId);
  try {
    return { targets: preferences.reconcile(await fetchTargets({ signal })) };
  } finally {
    preferences.release();
  }
};
const readResolution = ({ scope, signal, userId, bypass }) => {
  const load = () => fetchResolvedTargets({ date: scope, signal });
  if (historicalDate(scope))
    return readRevisit('resolution', userId, scope, load, { signal, bypass });
  // An absent scope is the Slate's own current date, read as often as every
  // surface that shows it revisits — cached under one identity rather than
  // the (unknown here) date it will turn out to be.
  if (scope === undefined)
    return readRevisit('resolution', userId, 'current', load, { signal, bypass });
  return load();
};

/*
 * One account-private read, in the three shapes the Target surfaces need. All
 * are read the same way — nothing before sign-in, one in-flight request that
 * is abandoned when the page moves on, and a reload that refetches rather than
 * patching in place, so what is on screen is always what the backend last
 * returned.
 *
 * A `lazy` read makes no request until it is asked for: its request count
 * starts at zero and stays there until `reload` raises it, which is what keeps
 * a read nobody has asked for off the wire.
 */
const useAccountRead = (
  read,
  empty,
  scope,
  { lazy = false, failure = LOAD_FAILURE, keepPrevious = false } = {},
) => {
  const { isAuthenticated, loading: authLoading, currentUser } = useAuth();
  const owner = useRef();
  const bypassNext = useRef(false);
  const [state, setState] = useState({ status: 'idle', error: null, ...empty });
  const [requests, setRequests] = useState(lazy ? 0 : 1);

  useEffect(() => {
    if (requests === 0 || authLoading || !isAuthenticated) {
      setState({ status: 'idle', error: null, ...empty });
      return undefined;
    }
    const controller = new AbortController();
    const sameOwner = owner.current === currentUser?.uid;
    owner.current = currentUser?.uid;
    setState((current) => ({
      ...(keepPrevious && sameOwner ? current : empty),
      status: 'loading',
      error: null,
    }));
    const bypass = bypassNext.current;
    bypassNext.current = false;
    read({ scope, signal: controller.signal, userId: currentUser?.uid, bypass })
      .then(
        (data) => !controller.signal.aborted && setState({ status: 'ready', error: null, ...data }),
      )
      .catch((error) => {
        if (!controller.signal.aborted && !isRequestCancelled(error)) {
          setState({
            status: 'error',
            error: getRequestErrorMessage(error, failure),
            ...empty,
          });
        }
      });
    return () => controller.abort();
  }, [
    authLoading,
    isAuthenticated,
    scope,
    read,
    empty,
    failure,
    requests,
    keepPrevious,
    currentUser?.uid,
  ]);

  const reload = useCallback(() => {
    bypassNext.current = true;
    setRequests((count) => count + 1);
  }, []);

  return { authLoading, isAuthenticated, reload, ...state };
};

/*
 * The account's Targets as records: what the grid lists, and what the detail
 * route identifies one by. This is the read that keeps a Target manageable,
 * so it never depends on the day resolving.
 */
export const useTargets = (options) => useAccountRead(readList, EMPTY_LIST, undefined, options);

/*
 * The same Targets read against one Slate Date. The Slate passes the date it
 * is showing so the blocks under its rows belong to the games above them; the
 * other surfaces pass none, which is the Slate's own current date, and read
 * the date back off the response rather than working it out a second time.
 */
export const useResolvedTargets = (date) => useAccountRead(readResolution, EMPTY_RESOLUTION, date);

const EMPTY_PREVIEW = { status: 'idle', error: null, preview: null, key: null };

/*
 * What a Draft Target is evaluated by: the opponent and the Qualifiers. The
 * note is never part of the evidence, so editing it is not a new draft.
 */
const previewKey = (request) =>
  request
    ? JSON.stringify({
        opponent: request.opponent,
        qualifiers: request.qualifiers,
        ...(request.conditions !== undefined ? { conditions: request.conditions } : {}),
      })
    : null;

/*
 * The season behind a Draft Target, read while it is composed. The draft is
 * compared by value, so a re-render is not a new draft and neither is retyping
 * the same threshold; a changed one is read only once it has held still for
 * the delay, so several quick edits are one request. The moment the draft
 * changes, whatever was in flight for the old one is abandoned, and a late
 * answer from it is never shown.
 *
 * What was last read stays in hand — through the next edit, an incomplete
 * draft, and a refusal — so a keystroke never blanks the screen; it is dropped
 * only when the account signs out or the host goes away. `pending` says the
 * draft has moved on from what was last read, whether or not the read has
 * started; the caller shows the result dimmed until it is current again.
 */
export const useTargetPreview = (request, { immediateInitial = false } = {}) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const key = previewKey(request);
  const [state, setState] = useState(EMPTY_PREVIEW);
  const [attempt, setAttempt] = useState(0);
  // The draft the result in hand was read for, kept where the effect can see
  // it without re-running for it: a draft typed back to what was last read is
  // not a new draft either.
  const readKey = useRef(null);
  const initialRead = useRef({ key: null, changed: false });

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      readKey.current = null;
      setState(EMPTY_PREVIEW);
      return undefined;
    }
    if (initialRead.current.key !== null && initialRead.current.key !== key) {
      initialRead.current.changed = true;
    }
    if (key === null || key === readKey.current) {
      // Nothing to read, and the read that was under way was abandoned when
      // the draft moved. What was last read stays.
      setState((current) => ({
        ...current,
        status: current.preview ? 'ready' : 'idle',
        error: null,
      }));
      return undefined;
    }
    const controller = new AbortController();
    if (initialRead.current.key === null) initialRead.current.key = key;
    const load = () => {
      setState((current) => ({ ...current, status: 'loading', error: null }));
      fetchTargetPreview({ ...JSON.parse(key), signal: controller.signal })
        .then((preview) => {
          if (controller.signal.aborted) return;
          readKey.current = key;
          setState({ status: 'ready', error: null, preview, key });
        })
        .catch((error) => {
          if (controller.signal.aborted || isRequestCancelled(error)) return;
          setState((current) => ({
            ...current,
            status: 'error',
            error: getRequestErrorMessage(error, PREVIEW_FAILURE),
          }));
        });
    };
    // A saved Target already has settled criteria. StrictMode may replay this
    // effect, so eligibility follows the initial key rather than effect count.
    const immediate = immediateInitial && !initialRead.current.changed && attempt === 0;
    const timer = immediate ? undefined : setTimeout(load, PREVIEW_DELAY_MS);
    if (immediate) load();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, authLoading, isAuthenticated, attempt, immediateInitial]);

  const { key: shownKey, ...read } = state;
  const retry = useCallback(() => {
    readKey.current = null;
    setAttempt((value) => value + 1);
  }, []);
  return { ...read, pending: key !== shownKey, retry };
};

const EMPTY_BASELINES = { shares: {} };
const readBaselines = ({ signal }) => fetchDietBaselines({ signal });
export const useDietBaselines = () =>
  useAccountRead(readBaselines, EMPTY_BASELINES, undefined, {
    failure: 'League averages unavailable.',
  });

const RosterReadContext = createContext(null);

// A page owns its roster reads. Multiple cards for the same opponent share the
// request and result, and leaving the page aborts and releases every read.
export function SeasonMinutesProvider({ children, resetKey, enabled = true }) {
  const { currentUser, isAuthenticated, loading } = useAuth();
  const reads = useMemo(() => {
    const requests = new Map();
    const controllers = new Set();
    return {
      read: ({ scope }) => {
        if (!scope || !enabled) return Promise.resolve(EMPTY_ROSTER);
        if (requests.has(scope)) return requests.get(scope);
        const controller = new AbortController();
        controllers.add(controller);
        const request = fetchSeasonMinutes({ opponent: scope, signal: controller.signal })
          .then((data) => ({ ...data, opponent: scope }))
          .catch((error) => {
            if (requests.get(scope) === request) requests.delete(scope);
            throw error;
          })
          .finally(() => controllers.delete(controller));
        requests.set(scope, request);
        return request;
      },
      dispose: () => {
        controllers.forEach((controller) => controller.abort());
        requests.clear();
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Account and route identities bound this cache lifetime.
  }, [currentUser?.uid, isAuthenticated, loading, resetKey, enabled]);
  useEffect(() => () => reads.dispose(), [reads]);
  return <RosterReadContext.Provider value={reads.read}>{children}</RosterReadContext.Provider>;
}

const EMPTY_ROSTER = { season: null, players: [], opponent: null };
const readRoster = async ({ scope, signal }) =>
  scope
    ? { ...(await fetchSeasonMinutes({ opponent: scope, signal })), opponent: scope }
    : EMPTY_ROSTER;
export const useSeasonMinutes = (opponent) => {
  const sharedRead = useContext(RosterReadContext);
  const read = useAccountRead(sharedRead || readRoster, EMPTY_ROSTER, opponent, {
    failure: 'Unable to load the season roster.',
  });
  return {
    ...read,
    season: read.opponent === opponent ? read.season : null,
    players: read.opponent === opponent ? read.players : [],
  };
};
