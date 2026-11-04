import { expect, test as base } from './courtai';
import { request } from '@playwright/test';
import {
  blockWrites,
  bootstrapVercelBypassCookie,
  routeApiToCandidate,
} from './deployedSmokeConfig';

export const test = base.extend({
  deployedPage: async ({ page, context }, run) => {
    const blockedWrites = await blockWrites(context);
    await routeApiToCandidate(context);
    await bootstrapVercelBypassCookie({ browserContext: context, requestApi: request });
    await run(page);
    // A candidate /api fetch still in flight when the test ends would throw outside any test.
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    expect(blockedWrites, 'The Release Check is read-only; these writes were aborted').toEqual([]);
  },
});

export { expect };
