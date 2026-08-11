import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  bootstrapVercelBypassCookie,
  isAllowedDeploymentUrl,
} from '../e2e/fixtures/deployedSmokeConfig';

const deploymentUrl = 'https://statsplus-frontend-pj8o7a8n2-chris-fus-projects.vercel.app/';

const makeResponse = ({ status = 307, headers = [] } = {}) => ({
  status: jest.fn(() => status),
  headersArray: jest.fn(() => headers),
});

const makeRequestApi = (response) => {
  const requestContext = {
    get: jest.fn(async () => response),
    dispose: jest.fn(async () => {}),
  };

  return {
    newContext: jest.fn(async () => requestContext),
    requestContext,
  };
};

const makeBrowserContext = () => ({ addCookies: jest.fn(async () => {}) });

describe('deployed smoke Vercel bootstrap', () => {
  test('uses one trusted request for the exact URL and installs only a scoped cookie', async () => {
    const response = makeResponse({
      headers: [
        { name: 'set-cookie', value: 'other=value; Path=/' },
        { name: 'Set-Cookie', value: '_vercel_jwt=jwt-token; Path=/; Secure; HttpOnly' },
      ],
    });
    const requestApi = makeRequestApi(response);
    const browserContext = makeBrowserContext();

    await bootstrapVercelBypassCookie({
      browserContext,
      configuredBaseUrl: deploymentUrl,
      bypassSecret: 'raw-secret-that-must-not-reach-the-browser',
      protectedDeployment: true,
      requestApi,
    });

    expect(requestApi.newContext).toHaveBeenCalledTimes(1);
    expect(requestApi.requestContext.get).toHaveBeenCalledWith(deploymentUrl, {
      headers: {
        'x-vercel-protection-bypass': 'raw-secret-that-must-not-reach-the-browser',
        'x-vercel-set-bypass-cookie': 'true',
      },
      maxRedirects: 0,
    });
    expect(requestApi.requestContext.dispose).toHaveBeenCalledTimes(1);
    expect(browserContext.addCookies).toHaveBeenCalledWith([
      {
        name: '_vercel_jwt',
        value: 'jwt-token',
        url: deploymentUrl,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  });

  test.each([
    [200, [{ name: 'set-cookie', value: '_vercel_jwt=jwt-token; Path=/' }], 'HTTP 307'],
    [307, [{ name: 'set-cookie', value: 'other=value; Path=/' }], 'Vercel bypass cookie'],
    [307, [{ name: 'set-cookie', value: '_vercel_jwt; Path=/' }], 'Vercel bypass cookie'],
  ])('fails closed for an invalid bootstrap response', async (status, headers, message) => {
    const requestApi = makeRequestApi(makeResponse({ status, headers }));

    await expect(
      bootstrapVercelBypassCookie({
        browserContext: makeBrowserContext(),
        configuredBaseUrl: deploymentUrl,
        bypassSecret: 'raw-secret',
        protectedDeployment: true,
        requestApi,
      }),
    ).rejects.toThrow(message);
    expect(requestApi.requestContext.dispose).toHaveBeenCalledTimes(1);
  });

  test.each([
    { configuredBaseUrl: undefined, bypassSecret: 'raw-secret', protectedDeployment: true },
    { configuredBaseUrl: deploymentUrl, bypassSecret: undefined, protectedDeployment: true },
    { configuredBaseUrl: deploymentUrl, bypassSecret: 'raw-secret', protectedDeployment: false },
    {
      configuredBaseUrl: 'http://127.0.0.1:4173',
      bypassSecret: 'raw-secret',
      protectedDeployment: false,
    },
  ])(
    'does not bootstrap without an explicitly protected deployment configuration',
    async (options) => {
      const requestApi = makeRequestApi(makeResponse());
      const browserContext = makeBrowserContext();

      await bootstrapVercelBypassCookie({ ...options, browserContext, requestApi });

      expect(requestApi.newContext).not.toHaveBeenCalled();
      expect(browserContext.addCookies).not.toHaveBeenCalled();
    },
  );
});

describe('deployed smoke URL and fixture wiring', () => {
  test('allows only the StatsPlus Vercel project deployment host over HTTPS', () => {
    expect(isAllowedDeploymentUrl(deploymentUrl)).toBe(true);
    expect(isAllowedDeploymentUrl('https://statsplus-frontend.vercel.app/')).toBe(true);
    expect(
      isAllowedDeploymentUrl('https://statsplus-frontend.vercel.app/', 'protected-preview'),
    ).toBe(false);
    expect(
      isAllowedDeploymentUrl(
        'https://statsplus-frontend-git-feature-chris-fus-projects.vercel.app/',
      ),
    ).toBe(true);
    expect(
      isAllowedDeploymentUrl('https://statsplus-frontend-pj8o7a8n2-other-account.vercel.app/'),
    ).toBe(false);
    expect(isAllowedDeploymentUrl(deploymentUrl.replace('https://', 'http://'))).toBe(false);
    expect(isAllowedDeploymentUrl(`https://evil.example/${deploymentUrl}`)).toBe(false);
    expect(
      isAllowedDeploymentUrl(
        'https://statsplus-frontend-pj8o7a8n2-chris-fus-projects.vercel.app/?redirect=evil',
      ),
    ).toBe(false);
  });

  test('uses the deployed fixture for the smoke journey without browser route interception', () => {
    const fixtureSource = fs.readFileSync(
      path.resolve(process.cwd(), 'e2e/fixtures/deployedSmoke.js'),
      'utf8',
    );
    const smokeSource = fs.readFileSync(
      path.resolve(process.cwd(), 'e2e/specs/core-flows.spec.js'),
      'utf8',
    );

    expect(fixtureSource).toContain('bootstrapVercelBypassCookie');
    expect(fixtureSource).not.toContain('page.route');
    expect(smokeSource).toContain("from '../fixtures/deployedSmoke'");
    expect(smokeSource).toContain('deployedPage: page');
  });

  test('keeps deployment event trust and secret scope in the workflow', () => {
    const workflowSource = fs.readFileSync(
      path.resolve(process.cwd(), '.github/workflows/deployed-smoke.yml'),
      'utf8',
    );

    expect(workflowSource).toContain("github.event.deployment.environment == 'Production'");
    expect(workflowSource).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.mode == 'protected-preview'",
    );
    expect(workflowSource).toContain('ref: ${{ github.event.repository.default_branch }}');
    expect(workflowSource).toContain('node scripts/validate-deployment-url.mjs');
    expect(workflowSource).toContain('VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.');
    expect(workflowSource.indexOf('Validate protected preview deployment URL')).toBeLessThan(
      workflowSource.indexOf('VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.'),
    );
  });

  test('reports the rejected mode and URL without exposing a bypass secret', () => {
    const rejectedUrl = 'https://statsplus-frontend.vercel.app/?redirect=evil';
    const bypassSecret = 'do-not-print-this-secret';
    const result = spawnSync(
      process.execPath,
      ['scripts/validate-deployment-url.mjs', 'protected-preview', rejectedUrl],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, VERCEL_AUTOMATION_BYPASS_SECRET: bypassSecret },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('mode="protected-preview"');
    expect(result.stderr).toContain(`url=${JSON.stringify(rejectedUrl)}`);
    expect(result.stderr).not.toContain(bypassSecret);
  });
});
