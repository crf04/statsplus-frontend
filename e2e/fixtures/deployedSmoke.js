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
    expect(blockedWrites, 'The Release Check is read-only; these writes were aborted').toEqual([]);
  },
});

export { expect };
