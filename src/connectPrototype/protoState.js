// PROTOTYPE (throwaway, branch prototype/connect-page-look).
// Variant state rides the URL hash (`#v=B&h=2`), never the query string: on `/`
// the query string is the Filter Set. sessionStorage carries the choice across
// client-side navigation, which drops the hash.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const PROTO_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.REACT_APP_PROTOTYPE === 'connect';

export const CONNECT_VARIANTS = [
  { id: 'A', label: 'Polished guide' },
  { id: 'B', label: 'Chat preview' },
  { id: 'C', label: 'Three steps' },
  { id: 'D', label: 'Box score' },
];

export const HOME_VARIANTS = [
  { id: '1', label: 'Eyebrow pill' },
  { id: '2', label: 'Third door' },
  { id: '3', label: 'Card under ladder' },
  { id: '4', label: 'Ticker strip' },
  { id: 'off', label: 'None' },
];

const read = () => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    v: params.get('v') || sessionStorage.getItem('proto-connect-v') || 'B',
    h: params.get('h') || sessionStorage.getItem('proto-connect-h') || '1',
  };
};

export const setProto = (next) => {
  const state = { ...read(), ...next };
  sessionStorage.setItem('proto-connect-v', state.v);
  sessionStorage.setItem('proto-connect-h', state.h);
  window.location.hash = `v=${state.v}&h=${state.h}`;
};

export const useProto = () => {
  const location = useLocation();
  const [state, setState] = useState(read);

  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    setState(read());
  }, [location.pathname, location.hash]);

  return state;
};
