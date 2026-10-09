// Fixtures for the e2e-runner flows. They reuse the Playwright suite's
// hermetic browser contract (e2e/fixtures/courtai.js) so both runners serve
// the same `/api` answers; only the browser seam differs.
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
        seenRoutes.add(route);
        seen.push({
          method: route.request.method,
          path: url.pathname,
          search: url.searchParams,
          body: parseBody(route.request.postData),
          authorization: route.request.headers.authorization,
        });
      }
      await handler({
        request: () => contractRequest(route.request),
        fulfill: (response: Parameters<WebRoute['fulfill']>[0]) => route.fulfill(response),
      });
    }),
});
const seenRoutes = new WeakSet<object>();

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

const withContract = base.extend<{ api: Api }>({
  api: async ({ browser }, use) => {
    const requests: SeenRequest[] = [];
    const page = contractPage(browser, requests);
    await browser.addInitScript(recordPageErrors, ERRORS_KEY);
    await installApiContract(page);
    await use({
      requests,
      sent: (path, method) =>
        requests.filter((r) => r.path === path && (!method || r.method === method)),
      override: (overrides) => installApiContract(page, overrides),
    });
    const errors = await browser.evaluate(
      (key: string) => JSON.parse(window.sessionStorage.getItem(key) || '[]'),
      ERRORS_KEY,
    );
    expect(errors, 'The page should not throw uncaught errors').toEqual([]);
  },
});

/** A visitor with no session; `/api` is the hermetic contract. */
export const signedOutTest = withContract;

/** A signed-in reader through the development auth adapter. */
export const signedInTest = withContract.extend<{ signedIn: true }>({
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
