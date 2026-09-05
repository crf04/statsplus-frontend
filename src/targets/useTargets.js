import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import { fetchResolvedTargets, fetchTargetBacktest, fetchTargets } from './targetsApi';

const LOAD_FAILURE = 'Unable to load your Targets. Please try again.';
const BACKTEST_FAILURE = 'Unable to load this backtest. Please try again.';

const EMPTY_LIST = { targets: [] };
const EMPTY_RESOLUTION = { slateDate: null, entries: [] };
const EMPTY_BACKTEST = { backtest: null };

/*
 * Each read returns the state it contributes, so the hook below can hold any
 * of them without knowing which one it is holding. What a read is scoped by —
 * a Slate Date, a Target id, or nothing at all — travels as one opaque value.
 */
const readList = ({ signal }) => fetchTargets({ signal }).then((targets) => ({ targets }));
const readResolution = ({ scope, signal }) => fetchResolvedTargets({ date: scope, signal });
const readBacktest = ({ scope, signal }) =>
  fetchTargetBacktest({ id: scope, signal }).then((backtest) => ({ backtest }));

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
const useAccountRead = (read, empty, scope, { lazy = false, failure = LOAD_FAILURE } = {}) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState({ status: 'idle', error: null, ...empty });
  const [requests, setRequests] = useState(lazy ? 0 : 1);

  useEffect(() => {
    if (requests === 0 || authLoading || !isAuthenticated) {
      setState({ status: 'idle', error: null, ...empty });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', error: null, ...empty });
    read({ scope, signal: controller.signal })
      .then((data) => setState({ status: 'ready', error: null, ...data }))
      .catch((error) => {
        if (!isRequestCancelled(error)) {
          setState({
            status: 'error',
            error: getRequestErrorMessage(error, failure),
            ...empty,
          });
        }
      });
    return () => controller.abort();
  }, [authLoading, isAuthenticated, scope, read, empty, failure, requests]);

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
