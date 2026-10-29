import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSavedFilterSets } from '../../savedFilterSetsApi';

const isWaitlisted = (failure) =>
  failure?.response?.status === 403 && failure.response.data?.error?.code === 'waitlisted';

/*
 * Whether the signed-in account may publish a Report (crf04/statsplus#382):
 * 'signed_out', 'checking', 'active', 'waitlisted' or 'failed'. The auth
 * context learns of the waitlist only when an authenticated read is refused,
 * and the Report pages make none that the backend refuses, so this reads the
 * Saved Filter Sets list, which only an admitted account may read.
 */
const useAdmission = () => {
  const { isAuthenticated, waitlist, currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [answer, setAnswer] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || waitlist || !uid) return undefined;
    const controller = new AbortController();
    fetchSavedFilterSets({ signal: controller.signal }).then(
      () => setAnswer({ uid, attempt, status: 'active' }),
      (failure) => {
        if (controller.signal.aborted) return;
        setAnswer({ uid, attempt, status: isWaitlisted(failure) ? 'waitlisted' : 'failed' });
      },
    );
    return () => controller.abort();
  }, [isAuthenticated, waitlist, uid, attempt]);

  const retry = () => setAttempt((n) => n + 1);
  if (!isAuthenticated) return { status: 'signed_out', retry };
  if (waitlist) return { status: 'waitlisted', retry };
  const current = answer?.uid === uid && answer.attempt === attempt;
  return { status: current ? answer.status : 'checking', retry };
};

export default useAdmission;
