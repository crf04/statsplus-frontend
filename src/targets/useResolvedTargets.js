import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import { fetchResolvedTargets } from './targetsApi';

/*
 * Every Target the account holds, read against one Slate Date. The Slate
 * passes the date it is showing so the blocks under its rows belong to the
 * games above them; the Target detail passes none, which is the Slate's own
 * current date, and reads the date back off the response rather than working
 * it out a second time.
 */
export const useResolvedTargets = (date) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState({
    status: 'idle',
    slateDate: null,
    entries: [],
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setState({ status: 'idle', slateDate: null, entries: [], error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', slateDate: null, entries: [], error: null });
    fetchResolvedTargets({ date, signal: controller.signal })
      .then(({ slateDate, entries }) =>
        setState({ status: 'ready', slateDate, entries, error: null }),
      )
      .catch((error) => {
        if (!isRequestCancelled(error)) {
          setState({
            status: 'error',
            slateDate: null,
            entries: [],
            error: getRequestErrorMessage(error, 'Unable to load your Targets. Please try again.'),
          });
        }
      });
    return () => controller.abort();
  }, [authLoading, isAuthenticated, date, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { authLoading, isAuthenticated, reload, ...state };
};
