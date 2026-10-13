import { expect, test as base } from '@playwright/test';
import {
  E2E_ADMIN_STORAGE_KEY,
  E2E_AUTH_STORAGE_KEY,
  installApiContract,
} from './courtai-contract.mjs';
export * from './courtai-contract.mjs';

export const test = base.extend({
  browserHealth: [
    async ({ page }, run) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await run();
      expect(pageErrors, 'The browser page should not throw uncaught errors').toEqual([]);
    },
    { auto: true },
  ],
  authenticatedPage: async ({ page }, run) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, 'true');
    }, E2E_AUTH_STORAGE_KEY);
    await installApiContract(page);
    await run(page);
  },
  adminPage: async ({ page }, run) => {
    await page.addInitScript(
      ({ authKey, adminKey }) => {
        window.localStorage.setItem(authKey, 'true');
        window.localStorage.setItem(adminKey, 'true');
      },
      { authKey: E2E_AUTH_STORAGE_KEY, adminKey: E2E_ADMIN_STORAGE_KEY },
    );
    await installApiContract(page);
    await run(page);
  },
});

export { expect };
