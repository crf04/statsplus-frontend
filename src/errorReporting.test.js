jest.unmock('axios');
import * as Sentry from '@sentry/react';
import apiClient from './utils/axiosConfig';
import { initErrorReporting, parseTracesSampleRate, reportRenderError } from './errorReporting';

jest.mock('./firebase/config', () => ({ auth: { currentUser: null } }));
jest.mock('firebase/auth', () => ({ getIdToken: jest.fn() }));

const REQUEST_ID = '0123456789abcdef0123456789abcdef';
let sent;

const transport = () => ({
  send: async (envelope) => {
    sent.push(envelope);
    return { statusCode: 200 };
  },
  flush: async () => true,
});

const events = () =>
  sent.flatMap(([, items]) =>
    items.filter(([header]) => header.type === 'event').map(([, payload]) => payload),
  );

const failWith = (status, headers = {}, data = {}) =>
  apiClient
    .get('/api/anything', {
      adapter: async (config) => {
        const response = { status, data, headers, config, statusText: '' };
        const { AxiosError } = jest.requireActual('axios');
        throw new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, response);
      },
    })
    .catch(() => {});

beforeEach(() => {
  sent = [];
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await Sentry.close();
  jest.restoreAllMocks();
});

test('a 5xx response is reported with the full request id as the request_id tag', async () => {
  initErrorReporting({ dsn: 'https://key@example.ingest.sentry.io/1', transport });
  await failWith(503, { 'x-request-id': REQUEST_ID });
  await Sentry.flush();
  expect(events().map((event) => event.tags)).toEqual([
    { request_id: REQUEST_ID, http_status: '503' },
  ]);
});

test.each([400, 401, 403, 404, 429])('a %i response is not reported', async (status) => {
  initErrorReporting({ dsn: 'https://key@example.ingest.sentry.io/1', transport });
  await failWith(status, { 'x-request-id': REQUEST_ID });
  await Sentry.flush();
  expect(events()).toEqual([]);
});

test('rate_limited and waitlisted refusals are not reported', async () => {
  initErrorReporting({ dsn: 'https://key@example.ingest.sentry.io/1', transport });
  await failWith(429, { 'retry-after': '3' }, { error: { code: 'rate_limited' } });
  await failWith(403, {}, { error: { code: 'waitlisted' } });
  await Sentry.flush();
  expect(events()).toEqual([]);
});

test('without a DSN nothing is initialized and nothing is sent', async () => {
  expect(initErrorReporting({ dsn: '', transport })).toBe(false);
  await failWith(500, { 'x-request-id': REQUEST_ID });
  reportRenderError(new Error('render failed'), { componentStack: '\n in Page' });
  await Sentry.flush();
  expect(sent).toEqual([]);
  expect(Sentry.getClient()).toBeUndefined();
});

test('a render error is reported', async () => {
  initErrorReporting({ dsn: 'https://key@example.ingest.sentry.io/1', transport });
  reportRenderError(new Error('render failed'), { componentStack: '\n in Page' });
  await Sentry.flush();
  expect(events().map((event) => event.exception.values[0].value)).toEqual(['render failed']);
});

test('events carry no tokens, emails, request bodies or replay', async () => {
  initErrorReporting({ dsn: 'https://key@example.ingest.sentry.io/1', transport });
  Sentry.setUser({ email: 'someone@example.com', id: 'u1' });
  Sentry.addBreadcrumb({ message: 'Bearer secret-token' });
  await apiClient
    .post(
      '/api/user/targets',
      { note: 'private body' },
      {
        headers: { Authorization: 'Bearer secret-token' },
        adapter: async (config) => {
          const { AxiosError } = jest.requireActual('axios');
          throw new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, {
            status: 500,
            data: {},
            headers: { 'x-request-id': REQUEST_ID },
            config,
          });
        },
      },
    )
    .catch(() => {});
  await Sentry.flush();
  const serialized = JSON.stringify(sent);
  expect(events()).toHaveLength(1);
  for (const secret of ['secret-token', 'someone@example.com', 'private body']) {
    expect(serialized).not.toContain(secret);
  }
  expect(sent.flatMap(([, items]) => items.map(([header]) => header.type))).toEqual(['event']);
  const options = Sentry.getClient().getOptions();
  expect(options.sendDefaultPii).toBe(false);
  expect(options.integrations.map((integration) => integration.name)).not.toEqual(
    expect.arrayContaining(['Replay']),
  );
});

test('events keep the page path only and drop request headers and exception secrets', async () => {
  initErrorReporting({ dsn: 'https://key@example.ingest.sentry.io/1', transport });
  window.history.replaceState(
    {},
    '',
    '/matchups?email=someone@example.com#access_token=secret-token',
  );
  reportRenderError(new Error('failed for someone@example.com with Bearer secret-token'), {});
  await Sentry.flush();
  window.history.replaceState({}, '', '/');
  const [event] = events();
  expect(event.request.url).toBe('http://localhost/matchups');
  expect(event.request.headers).toBeUndefined();
  expect(event.request.query_string).toBeUndefined();
  expect(event.request.cookies).toBeUndefined();
  expect(event.exception.values[0].value).toBe('failed for [email] with Bearer [token]');
  expect(JSON.stringify(sent)).not.toMatch(/secret-token|someone@example\.com/);
});

test('an uncaught error is reported without the page query, hash or frame URL secrets', async () => {
  initErrorReporting({ dsn: 'https://key@example.ingest.sentry.io/1', transport });
  window.history.replaceState(
    {},
    '',
    '/connect?email=someone@example.com#access_token=secret-token',
  );
  const swallow = (event) => event.preventDefault();
  window.addEventListener('error', swallow);
  const error = new Error('boom');
  error.stack = `Error: boom\n    at run (http://localhost/assets/app.js?email=someone@example.com#access_token=secret-token:1:1)`;
  window.dispatchEvent(
    new ErrorEvent('error', {
      error,
      message: 'boom',
      filename:
        'http://localhost/assets/app.js?email=someone@example.com#access_token=secret-token',
    }),
  );
  window.removeEventListener('error', swallow);
  await Sentry.flush();
  window.history.replaceState({}, '', '/');
  expect(events().map((event) => event.exception.values[0].value)).toEqual(['boom']);
  expect(JSON.stringify(sent)).not.toMatch(/secret-token|someone@example\.com/);
});

describe('tracing options', () => {
  const initWith = (options) => {
    initErrorReporting({ dsn: 'https://key@example.ingest.sentry.io/1', transport, ...options });
    return Sentry.getClient().getOptions();
  };

  test('page loads are traced at 5% by default, with replays and header propagation off', () => {
    const options = initWith();
    expect(options.tracesSampleRate).toBe(0.05);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    expect(options.tracePropagationTargets).toBeUndefined();
    expect(Sentry.getClient().getIntegrationByName('BrowserTracing')).toBeDefined();
  });

  test('the rate passed to init is used', () => {
    expect(initWith({ tracesSampleRate: 0.2 }).tracesSampleRate).toBe(0.2);
  });

  test.each([
    [undefined, 0.05],
    ['', 0.05],
    ['0.3', 0.3],
    ['0', 0],
    ['1', 1],
    ['abc', 0.05],
    ['-1', 0.05],
    ['2', 0.05],
    ['NaN', 0.05],
  ])('the rate setting %p resolves to %p', (raw, expected) => {
    expect(parseTracesSampleRate(raw)).toBe(expected);
  });
});
