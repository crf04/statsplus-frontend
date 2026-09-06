import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import {
  fetchResolvedTargets,
  fetchTargetBacktest,
  fetchTargetPreview,
  fetchTargets,
} from './targetsApi';

const LOAD_FAILURE = 'Unable to load your Targets. Please try again.';
const BACKTEST_FAILURE = 'Unable to load this backtest. Please try again.';
const PREVIEW_FAILURE = 'Unable to read the season for this draft. Please try again.';

const EMPTY_LIST = { targets: [] };
const EMPTY_RESOLUTION = { slateDate: null, entries: [] };
const EMPTY_BACKTEST = { backtest: null };
const EMPTY_PREVIEW = { preview: null };

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
const readList = ({ signal }) => fetchTargets({ signal }).then((targets) => ({ targets }));
const readResolution = ({ scope, signal }) => fetchResolvedTargets({ date: scope, signal });
const readBacktest = ({ scope, signal }) =>
  fetchTargetBacktest({ id: scope, signal }).then((backtest) => ({ backtest }));
const readPreview = ({ scope, signal }) =>
  fetchTargetPreview({ ...scope, signal }).then((preview) => ({ preview }));

/*
 * One account-private read, in the three shapes the Target surfaces need. All
 * are read the same way — nothing before sign-in, one in-flight request that
 * is abandoned when the page moves on, and a reload that refetches rather than
 * patching in place, so what is on screen is always what the backend last
 * returned.
 *
 * A `lazy` read makes no request until it is asked for: its request count
 * starts at zero and stays there until `reload` raises it, which is what keeps
 * a read nobody has asked for off the wire. A `skip`ped read has nothing to
 * ask about yet and holds the empty state until it does. A read that `keep`s
 * shows what it last returned while the next answer is on its way, rather
 * than blanking on every request.
 */
const useAccountRead = (
  read,
  empty,
  scope,
  { lazy = false, skip = false, keep = false, failure = LOAD_FAILURE } = {},
) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState({ status: 'idle', error: null, ...empty });
  const [requests, setRequests] = useState(lazy ? 0 : 1);

  useEffect(() => {
    if (skip || requests === 0 || authLoading || !isAuthenticated) {
      setState({ status: 'idle', error: null, ...empty });
      return undefined;
    }
    const controller = new AbortController();
    const held = (current) => (keep ? current : { ...current, ...empty });
    setState((current) => ({ ...held(current), status: 'loading', error: null }));
    read({ scope, signal: controller.signal })
      .then((data) => setState({ status: 'ready', error: null, ...data }))
      .catch((error) => {
        if (!isRequestCancelled(error)) {
          setState((current) => ({
            ...held(current),
            status: 'error',
            error: getRequestErrorMessage(error, failure),
          }));
        }
      });
    return () => controller.abort();
  }, [authLoading, isAuthenticated, scope, read, empty, failure, requests, skip, keep]);

  const reload = useCallback(() => setRequests((count) => count + 1), []);

  return { authLoading, isAuthenticated, reload, ...state };
};

/*
 * The account's Targets as records: what the grid lists, and what the detail
 * route identifies one by. This is the read that keeps a Target manageable,
 * so it never depends on the day resolving.
 */
export const useTargets = () => useAccountRead(readList, EMPTY_LIST);

/*
 * The same Targets read against one Slate Date. The Slate passes the date it
 * is showing so the blocks under its rows belong to the games above them; the
 * other surfaces pass none, which is the Slate's own current date, and read
 * the date back off the response rather than working it out a second time.
 */
export const useResolvedTargets = (date) => useAccountRead(readResolution, EMPTY_RESOLUTION, date);

/*
 * The season behind one Target, which costs a league-wide game-log scan and so
 * is the one read here that waits to be asked for. Reading it again after a
 * refusal asks again; a backtest already in hand is kept rather than re-read.
 */
export const useTargetBacktest = (id) => {
  const { reload, ...state } = useAccountRead(readBacktest, EMPTY_BACKTEST, id, {
    lazy: true,
    failure: BACKTEST_FAILURE,
  });
  // The first reload of a read that has never run is that read.
  return { ...state, read: reload };
};

/*
 * The season behind a Draft Target, read while it is composed. The draft is
 * compared by value, so a re-render is not a new draft and neither is retyping
 * the same threshold; a changed one is read only once it has held still for
 * the delay, so several quick edits are one request. Nothing is asked about a
 * draft that is not complete, and what was last read stays in hand, to be
 * shown dimmed, until the next answer lands. `pending` says the draft has
 * moved on from what was last read, whether or not the read has started.
 */
export const useTargetPreview = (request) => {
  const key = request ? JSON.stringify(request) : null;
  const [settled, setSettled] = useState(null);

  useEffect(() => {
    if (key === null) {
      setSettled(null);
      return undefined;
    }
    const timer = setTimeout(() => setSettled(key), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key]);

  const scope = useMemo(() => (settled === null ? null : JSON.parse(settled)), [settled]);
  const state = useAccountRead(readPreview, EMPTY_PREVIEW, scope, {
    skip: scope === null,
    keep: true,
    failure: PREVIEW_FAILURE,
  });
  return { ...state, pending: key !== settled };
};
