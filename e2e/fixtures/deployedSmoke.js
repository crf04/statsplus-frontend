import { expect, test as base } from './courtai';
import { request } from '@playwright/test';
import { bootstrapVercelBypassCookie } from './deployedSmokeConfig';

export const test = base.extend({
  deployedPage: async ({ page, context }, run) => {
    await bootstrapVercelBypassCookie({ browserContext: context, requestApi: request });
    await run(page);
  },
});

export { expect };
