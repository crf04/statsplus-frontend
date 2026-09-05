import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRequestErrorMessage, isRequestCancelled } from '../gameLogsApi';
import { fetchTargets } from './targetsApi';

/*
 * Both Target surfaces read the same account-private list: the grid shows all
 * of it and the detail route picks one out of it, because the contract has no
 * single-Target read. A mutation reloads rather than patching in place, so the
 * derived titles on screen are always the ones the backend just derived.
 */
export const useTargets = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState({ status: 'idle', targets: [], error: null });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setState({ status: 'idle', targets: [], error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', targets: [], error: null });
    fetchTargets({ signal: controller.signal })
      .then((targets) => setState({ status: 'ready', targets, error: null }))
      .catch((error) => {
        if (!isRequestCancelled(error)) {
          setState({
            status: 'error',
            targets: [],
            error: getRequestErrorMessage(error, 'Unable to load your Targets. Please try again.'),
          });
        }
      });
    return () => controller.abort();
  }, [authLoading, isAuthenticated, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { authLoading, isAuthenticated, reload, ...state };
};
