/*
 * PROTOTYPE — throwaway (branch prototype/feedback-look).
 * Question: what should "send feedback to Chris" look like in the app?
 * Four variants of the in-app feedback entry, the form, and the "Send
 * feedback" affordance next to a visible `(ref …)` error, switchable via the
 * URL hash (`#proto=feedback&v=B`) on every route.
 *
 * The variant rides the hash, never the query string: on `/` the query string
 * is the Filter Set, and an unknown parameter there refuses the page.
 */
import { useCallback, useEffect, useState } from 'react';

/* Dev servers always allow the prototype; a production build only with
   REACT_APP_PROTOTYPE=feedback. A stray merge cannot ship it. */
export const PROTO_STANDALONE = process.env.REACT_APP_PROTOTYPE === 'feedback';
export const PROTO_ENABLED = process.env.NODE_ENV !== 'production' || PROTO_STANDALONE;

export const VARIANT_KEYS = ['A', 'B', 'C', 'D'];

export const VARIANT_NAMES = {
  A: 'Header link → popover',
  B: 'Floating tab → pick a kind',
  C: 'Account menu → dialog with visible context',
  D: 'Talk to Chris (chat dock)',
};

/* State lives in sessionStorage so it survives app navigation (router links
   drop the hash); the hash mirrors it so a link opens on a given variant. */
const STORE = 'courtai:feedback-proto';
const EVENT = 'feedback-proto-change';

const readHash = () => new URLSearchParams(window.location.hash.replace(/^#/, ''));

const readState = () => {
  const saved = JSON.parse(window.sessionStorage.getItem(STORE) || '{}');
  const hash = readHash();
  const v = hash.get('v') || saved.v || 'A';
  return {
    on: hash.get('proto') === 'feedback' || saved.on === true,
    v: VARIANT_KEYS.includes(v) ? v : 'A',
    err: hash.has('err') ? hash.get('err') === '1' : saved.err === true,
  };
};

const writeState = (state) => {
  window.sessionStorage.setItem(STORE, JSON.stringify(state));
  const hash = new URLSearchParams({ proto: 'feedback', v: state.v });
  if (state.err) hash.set('err', '1');
  window.history.replaceState(window.history.state, '', `#${hash}`);
  window.dispatchEvent(new Event(EVENT));
};

export const isFailing = () => readState().err;

export const useVariant = () => {
  const [state, setState] = useState(readState);
  useEffect(() => {
    const sync = () => setState(readState());
    window.addEventListener(EVENT, sync);
    window.addEventListener('hashchange', sync);
    if (state.on) writeState(state);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('hashchange', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const active = PROTO_ENABLED && (PROTO_STANDALONE || state.on);
  const step = useCallback(
    (delta) => {
      const index = VARIANT_KEYS.indexOf(state.v);
      writeState({
        ...state,
        on: true,
        v: VARIANT_KEYS[(index + delta + VARIANT_KEYS.length) % VARIANT_KEYS.length],
      });
    },
    [state],
  );
  const setFailing = useCallback((err) => writeState({ ...state, on: true, err }), [state]);
  return { active, variant: state.v, step, failing: state.err, setFailing };
};
