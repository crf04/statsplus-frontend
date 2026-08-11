import { expect, test as base } from './courtai';
import { installOriginScopedBypass } from '../../src/vercelBypass';

export const test = base.extend({
  deployedPage: async ({ page }, run) => {
    await installOriginScopedBypass(page);
    await run(page);
  },
});

export { expect };
