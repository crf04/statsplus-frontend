import { expect, test } from '@playwright/test';
import { bootstrapVercelBypassCookie } from '../fixtures/deployedSmokeConfig';

const deploymentUrl = 'https://statsplus-frontend-pj8o7a8n2-chris-fus-projects.vercel.app/';

test('bootstraps a host-scoped cookie through a real browser context', async ({ browser }) => {
  const browserContext = await browser.newContext();
  const requestApi = {
    newContext: async () => ({
      get: async () => ({
        status: () => 307,
        headersArray: () => [
          { name: 'set-cookie', value: '_vercel_jwt=jwt-token; Path=/; Secure; HttpOnly' },
        ],
      }),
      dispose: async () => {},
    }),
  };

  try {
    await bootstrapVercelBypassCookie({
      browserContext,
      configuredBaseUrl: deploymentUrl,
      bypassSecret: 'offline-test-secret',
      protectedDeployment: true,
      requestApi,
    });

    const [cookie] = await browserContext.cookies(deploymentUrl);
    expect(cookie).toEqual(
      expect.objectContaining({
        name: '_vercel_jwt',
        value: 'jwt-token',
        domain: new URL(deploymentUrl).hostname,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      }),
    );
  } finally {
    await browserContext.close();
  }
});
