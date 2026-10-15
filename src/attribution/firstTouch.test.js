import { act, renderHook } from '@testing-library/react';
import { captureFirstTouch, sendFirstTouch, useFirstTouchSender } from './firstTouch';

const KEY = 'courtai.firstTouch';
const ORIGIN = 'https://courtai.app';
const stored = () => JSON.parse(window.localStorage.getItem(KEY));

const land = (search, { referrer = '', pathname = '/' } = {}) => ({
  location: { search, pathname, origin: ORIGIN },
  document: { referrer },
  localStorage: window.localStorage,
});

const clientReturning = (...outcomes) => {
  const post = jest.fn();
  outcomes.forEach((outcome) =>
    outcome instanceof Error
      ? post.mockRejectedValueOnce(outcome)
      : post.mockResolvedValueOnce({ status: outcome, data: {} }),
  );
  return { post };
};

beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
});
afterEach(() => jest.useRealTimers());

describe('captureFirstTouch', () => {
  test('stores utm, ref, referrer, path and time from the landing URL', () => {
    captureFirstTouch(
      land('?utm_source=x&utm_medium=cpc&utm_campaign=y&utm_content=c&utm_term=t&ref=abc', {
        referrer: 'https://www.google.com/search?q=courtai',
        pathname: '/matchups',
      }),
    );
    expect(stored()).toEqual({
      payload: {
        utm_source: 'x',
        utm_medium: 'cpc',
        utm_campaign: 'y',
        utm_content: 'c',
        utm_term: 't',
        ref: 'abc',
        referrer: 'https://www.google.com/search?q=courtai',
        landing_path: '/matchups',
        landed_at: '2026-10-15T12:00:00.000Z',
      },
      sentFor: null,
    });
  });

  test('a direct visit stores nulls', () => {
    captureFirstTouch(land(''));
    expect(stored().payload).toEqual({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      ref: null,
      referrer: null,
      landing_path: '/',
      landed_at: '2026-10-15T12:00:00.000Z',
    });
  });

  test('keeps the first touch when captured again with different params', () => {
    captureFirstTouch(land('?utm_source=first'));
    captureFirstTouch(land('?utm_source=second&ref=zzz'));
    expect(stored().payload.utm_source).toBe('first');
    expect(stored().payload.ref).toBeNull();
  });

  test('same-origin referrer is null, external referrer is kept', () => {
    captureFirstTouch(land('', { referrer: `${ORIGIN}/targets` }));
    expect(stored().payload.referrer).toBeNull();
    window.localStorage.clear();
    captureFirstTouch(land('', { referrer: 'https://t.co/abc' }));
    expect(stored().payload.referrer).toBe('https://t.co/abc');
  });

  test('malformed storage is treated as absent', () => {
    window.localStorage.setItem(KEY, '{not json');
    captureFirstTouch(land('?utm_source=x'));
    expect(stored().payload.utm_source).toBe('x');
    expect(stored().sentFor).toBeNull();
  });

  test('unavailable storage does not throw', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(() =>
      captureFirstTouch({ ...land('?utm_source=x'), localStorage: throwing }),
    ).not.toThrow();
  });
});

describe('sendFirstTouch', () => {
  beforeEach(() => captureFirstTouch(land('?utm_source=x&ref=abc')));

  test('posts the payload and marks 201 as sent', async () => {
    const client = clientReturning(201);
    await sendFirstTouch('uid-1', client);
    expect(client.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = client.post.mock.calls[0];
    expect(url.endsWith('/api/user/attribution')).toBe(true);
    expect(body).toEqual(stored().payload);
    expect(body.utm_source).toBe('x');
    expect(config.expectedUserId).toBe('uid-1');
    expect(stored().sentFor).toBe('uid-1');
  });

  test('200 also marks sent', async () => {
    await sendFirstTouch('uid-1', clientReturning(200));
    expect(stored().sentFor).toBe('uid-1');
  });

  test('sends once per uid and again for a different uid', async () => {
    const client = clientReturning(201, 201);
    await sendFirstTouch('uid-1', client);
    await sendFirstTouch('uid-1', client);
    expect(client.post).toHaveBeenCalledTimes(1);
    await sendFirstTouch('uid-2', client);
    expect(client.post).toHaveBeenCalledTimes(2);
    expect(stored().sentFor).toBe('uid-2');
  });

  test('a network failure leaves sentFor null, does not throw, and retries later', async () => {
    const client = clientReturning(new Error('Network Error'), 201);
    await expect(sendFirstTouch('uid-1', client)).resolves.toBeUndefined();
    expect(stored().sentFor).toBeNull();
    await sendFirstTouch('uid-1', client);
    expect(client.post).toHaveBeenCalledTimes(2);
    expect(stored().sentFor).toBe('uid-1');
  });

  test('a 404 from an undeployed backend leaves sentFor null', async () => {
    await sendFirstTouch('uid-1', clientReturning(404));
    expect(stored().sentFor).toBeNull();
  });

  test('sends nothing for a signed-out visitor (no uid)', async () => {
    const client = clientReturning(201);
    await sendFirstTouch(undefined, client);
    await sendFirstTouch(null, client);
    expect(client.post).not.toHaveBeenCalled();
    expect(stored().sentFor).toBeNull();
  });

  test('two concurrent sends for the same uid make exactly one request', async () => {
    let resolve;
    const client = {
      post: jest.fn(() => new Promise((done) => (resolve = done))),
    };
    const first = sendFirstTouch('uid-1', client);
    const second = sendFirstTouch('uid-1', client);
    resolve({ status: 201, data: {} });
    await Promise.all([first, second]);
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(stored().sentFor).toBe('uid-1');
  });

  test('a throwing localStorage getter does not reject', async () => {
    const client = clientReturning(201);
    const spy = jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    try {
      await expect(sendFirstTouch('uid-1', client)).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }
    expect(client.post).not.toHaveBeenCalled();
  });

  test('sends nothing when no first touch was stored', async () => {
    window.localStorage.clear();
    const client = clientReturning(201);
    await sendFirstTouch('uid-1', client);
    expect(client.post).not.toHaveBeenCalled();
  });
});

describe('useFirstTouchSender', () => {
  beforeEach(() => captureFirstTouch(land('?utm_source=x')));

  test('sends when a user appears, not for a signed-out visitor, and not on re-render', async () => {
    const client = clientReturning(201, 201);
    const { rerender } = renderHook(({ uid }) => useFirstTouchSender(uid, client), {
      initialProps: { uid: null },
    });
    expect(client.post).not.toHaveBeenCalled();

    await act(async () => rerender({ uid: 'uid-1' }));
    await act(async () => rerender({ uid: 'uid-1' }));
    expect(client.post).toHaveBeenCalledTimes(1);

    await act(async () => rerender({ uid: 'uid-2' }));
    expect(client.post).toHaveBeenCalledTimes(2);
  });
});
