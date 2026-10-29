import { useAuth } from '../../contexts/AuthContext';

/*
 * What a reader may do with a Log Workspace link (crf04/statsplus#381). Anyone
 * reads the game logs a link names. The backend answers its other public
 * reads (players, teams, profiles) with or without an account, but refuses a
 * waitlisted one. Only an admitted account has account reads and writes
 * (seasons, next opponent, Saved Filter Sets, Share). A signed-out visitor may
 * start a change, which waits for sign-up (useSignUpThen); a waitlisted
 * account cannot, because signing up again would not admit it.
 *
 * `reads`: the URL's Filter Set loads.
 * `openReads`: the player and team lists and the profiles load.
 * `account`: the account's own reads and writes run.
 * `changes`: controls that change or keep the Filter Set are live.
 */
const ACCESS = {
  checking: { reads: false, openReads: false, account: false, changes: false },
  'signed-out': { reads: true, openReads: true, account: false, changes: true },
  waitlisted: { reads: true, openReads: false, account: false, changes: false },
  'signed-in': { reads: true, openReads: true, account: true, changes: true },
};

const modeOf = ({ loading, isAuthenticated, waitlist }) => {
  if (loading) return 'checking';
  if (!isAuthenticated) return 'signed-out';
  return waitlist ? 'waitlisted' : 'signed-in';
};

export const useReadAccess = () => {
  const mode = modeOf(useAuth());
  return { mode, ...ACCESS[mode] };
};
