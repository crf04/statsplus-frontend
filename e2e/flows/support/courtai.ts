// Fixtures for the e2e-runner flows. They reuse the Playwright suite's
// hermetic browser contract (e2e/fixtures/courtai.js) so both runners serve
// the same `/api` answers; only the browser seam differs.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { test as base } from '@e2e-dev/web';
import type { Browser, WebRoute } from '@e2e-dev/web';
import { expect } from 'e2e';
import {
  E2E_ADMIN_STORAGE_KEY,
  E2E_AUTH_STORAGE_KEY,
  installApiContract,
} from '../../fixtures/courtai.js';

export type SeenRequest = {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
  authorization: string | undefined;
  /** The status the contract answered with; unset until it has answered. */
  status?: number;
};

// The contract's overrides receive a request shaped like Playwright's.
type ContractRequest = {
  url(): string;
  method(): string;
  headers(): Readonly<Record<string, string>>;
  postData(): string | null;
  postDataJSON(): unknown;
};
type Override =
  { status?: number; body?: unknown } | ((request: ContractRequest) => unknown | Promise<unknown>);

export type Api = {
  /** Every `/api` request the page sent, in order. */
  readonly requests: SeenRequest[];
  /** Requests to one path, optionally one method. */
  sent(path: string, method?: string): SeenRequest[];
  /** Answers listed paths differently for the rest of the test. */
  override(overrides: Record<string, Override>): Promise<void>;
};

const parseBody = (postData: string | undefined) => {
  if (!postData) return null;
  try {
    return JSON.parse(postData);
  } catch {
    return postData;
  }
};

const contractRequest = (request: WebRoute['request']): ContractRequest => ({
  url: () => request.url,
  method: () => request.method,
  headers: () => request.headers,
  postData: () => request.postData ?? null,
  postDataJSON: () => (request.postData ? JSON.parse(request.postData) : null),
});

// The slice of a Playwright Page that installApiContract touches.
const contractPage = (browser: Browser, seen: SeenRequest[]) => ({
  route: (pattern: string, handler: (route: unknown) => Promise<void>) =>
    browser.route(pattern, async (route) => {
      const url = new URL(route.request.url);
      // Each installation sees every request; record it once, in the newest.
      if (!seenRoutes.has(route)) {
        seen.push({
          method: route.request.method,
          path: url.pathname,
          search: url.searchParams,
          body: parseBody(route.request.postData),
          authorization: route.request.headers.authorization,
        });
        seenRoutes.set(route, seen[seen.length - 1]);
      }
      await handler({
        request: () => contractRequest(route.request),
        fulfill: (response: Parameters<WebRoute['fulfill']>[0]) => {
          const entry = seenRoutes.get(route);
          if (entry) entry.status = response.status ?? 200;
          return route.fulfill(response);
        },
      });
    }),
});
const seenRoutes = new WeakMap<object, SeenRequest>();

// Playwright's pageerror has no e2e counterpart, so each document records its
// own uncaught errors where the fixture can read them after the test.
const ERRORS_KEY = 'courtai:e2e-page-errors';
const recordPageErrors = (key: string) => {
  const push = (message: string) => {
    const errors = JSON.parse(window.sessionStorage.getItem(key) || '[]');
    errors.push(message);
    window.sessionStorage.setItem(key, JSON.stringify(errors));
  };
  window.addEventListener('error', (event) => push(String(event.message)));
  window.addEventListener('unhandledrejection', (event) => push(String(event.reason)));
};

const signIn = (keys: string[]) => {
  for (const key of keys) window.localStorage.setItem(key, 'true');
};

const contractFixture = (options: { waitlisted: boolean }) =>
  base.extend<{ api: Api }>({
    api: async ({ browser }, use) => {
      const requests: SeenRequest[] = [];
      const page = contractPage(browser, requests);
      await browser.addInitScript(recordPageErrors, ERRORS_KEY);
      await installApiContract(page, {}, options);
      await use({
        requests,
        sent: (path, method) =>
          requests.filter((r) => r.path === path && (!method || r.method === method)),
        override: (overrides) => installApiContract(page, overrides, options),
      });
      const errors = await browser.evaluate(
        (key: string) => JSON.parse(window.sessionStorage.getItem(key) || '[]'),
        ERRORS_KEY,
      );
      expect(errors, 'The page should not throw uncaught errors').toEqual([]);
    },
  });

const withContract = contractFixture({ waitlisted: false });

/** A visitor with no session; `/api` is the hermetic contract. */
export const signedOutTest = withContract;

/** A signed-in reader through the development auth adapter. */
export const signedInTest = withContract.extend<{ signedIn: true }>({
  signedIn: async ({ browser }, use) => {
    await browser.addInitScript(signIn, [E2E_AUTH_STORAGE_KEY]);
    await use(true);
  },
});

/** Signed in, but every authenticated `/api` route answers with the `waitlisted` refusal. */
export const waitlistedTest = contractFixture({ waitlisted: true }).extend<{ signedIn: true }>({
  signedIn: async ({ browser }, use) => {
    await browser.addInitScript(signIn, [E2E_AUTH_STORAGE_KEY]);
    await use(true);
  },
});

/** A signed-in administrator. */
export const adminTest = withContract.extend<{ signedIn: true }>({
  signedIn: async ({ browser }, use) => {
    await browser.addInitScript(signIn, [E2E_AUTH_STORAGE_KEY, E2E_ADMIN_STORAGE_KEY]);
    await use(true);
  },
});

/** True when the document scrolls sideways. */
export const overflowsHorizontally = (browser: Browser) =>
  browser.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

const BODILESS = new Set([101, 204, 205, 304]);
const HOP_BY_HOP = [
  'connection',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'keep-alive',
];
const TEXTUAL = /^(text\/|application\/(json|javascript|xml|[a-z.+-]*\+(json|xml))|image\/svg)/i;

/**
 * Records the status of every response the browser receives for a request that
 * is not answered by the `/api` contract, in every frame, across navigations.
 * e2e has no response listener and `route.continue` hides the response, so a
 * catch-all route plays the network itself: it fetches the request from the
 * test process, notes the status, and fulfills the browser with the same
 * status, headers and body (binary bodies go through a file under `.e2e/`).
 * Register it before `app.open`. `/api` requests fall back to the contract,
 * whose own statuses are in `api.requests`.
 */
export const observeResponses = async (browser: Browser, origin: string) => {
  const statuses: { path: string; status: number }[] = [];
  await browser.route('**/*', async (route) => {
    const { url, method, headers, postData } = route.request;
    const target = new URL(url);
    if (target.origin !== origin || target.pathname.startsWith('/api/')) {
      await route.fallback();
      return;
    }
    const forwarded: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers)) {
      if (
        ![
          'host',
          'connection',
          'content-length',
          'accept-encoding',
          'if-none-match',
          'if-modified-since',
        ].includes(name.toLowerCase())
      ) {
        forwarded[name] = value;
      }
    }
    forwarded['accept-encoding'] = 'identity';
    const response = await fetch(url, {
      method,
      headers: forwarded,
      body: method === 'GET' || method === 'HEAD' ? undefined : postData,
      redirect: 'manual',
    });
    statuses.push({ path: target.pathname, status: response.status });
    const out: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (!HOP_BY_HOP.includes(name) && name !== 'set-cookie') out[name] = value;
    });
    const type = response.headers.get('content-type') ?? '';
    if (BODILESS.has(response.status)) {
      await route.fulfill({ status: response.status, headers: out });
    } else if (method === 'HEAD' || TEXTUAL.test(type) || type === '') {
      await route.fulfill({ status: response.status, headers: out, body: await response.text() });
    } else {
      const dir = '.e2e/proxy';
      await mkdir(dir, { recursive: true });
      const file = `${dir}/${randomUUID()}`;
      await writeFile(file, Buffer.from(await response.arrayBuffer()));
      await route.fulfill({ status: response.status, headers: out, path: file });
    }
  });
  return statuses;
};
