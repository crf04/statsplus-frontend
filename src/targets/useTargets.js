import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import { fetchResolvedTargets, fetchTargetBacktest, fetchTargets } from './targetsApi';

const LOAD_FAILURE = 'Unable to load your Targets. Please try again.';
const BACKTEST_FAILURE = 'Unable to load this backtest. Please try again.';

const EMPTY_LIST = { targets: [] };
const EMPTY_RESOLUTION = { slateDate: null, entries: [] };

/*
 * Each read returns the state it contributes, so the hook below can hold both
 * without knowing which one it is holding.
 */
const readList = ({ signal }) => fetchTargets({ signal }).then((targets) => ({ targets }));
const readResolution = ({ date, signal }) => fetchResolvedTargets({ date, signal });

/*
 * One account-private read, in the two shapes the Target surfaces need. Both
 * are read the same way — nothing before sign-in, one in-flight request that
 * is abandoned when the page moves on, and a reload that refetches rather than
 * patching in place, so what is on screen is always what the backend last
 * returned.
 */
const useAccountRead = (read, empty, date) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState({ status: 'idle', error: null, ...empty });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setState({ status: 'idle', error: null, ...empty });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', error: null, ...empty });
    read({ date, signal: controller.signal })
      .then((data) => setState({ status: 'ready', error: null, ...data }))
      .catch((error) => {
        if (!isRequestCancelled(error)) {
          setState({
            status: 'error',
            error: getRequestErrorMessage(error, LOAD_FAILURE),
            ...empty,
          });
        }
      });
    return () => controller.abort();
  }, [authLoading, isAuthenticated, date, read, empty, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

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
 * The backtest is the one read over a Target that costs a league-wide game-log
 * scan, so it is not made on arrival like the two above: `attempt` is 0 until
 * a reader opens the disclosure, and rises again only when a reader who was
 * refused opens it again. A backtest already in hand is kept while the
 * disclosure is closed rather than read a second time.
 */
export const useTargetBacktest = (id, attempt) => {
  const [state, setState] = useState({ status: 'idle', error: null, backtest: null });

  useEffect(() => {
    if (attempt === 0) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading', error: null, backtest: null });
    fetchTargetBacktest({ id, signal: controller.signal })
      .then((backtest) => setState({ status: 'ready', error: null, backtest }))
      .catch((error) => {
        if (!isRequestCancelled(error)) {
          setState({
            status: 'error',
            error: getRequestErrorMessage(error, BACKTEST_FAILURE),
            backtest: null,
          });
        }
      });
    return () => controller.abort();
  }, [id, attempt]);

  return state;
};
