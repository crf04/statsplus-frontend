import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  bootstrapVercelBypassCookie,
  isAllowedDeploymentUrl,
  isAllowedReleaseCheckTarget,
} from '../e2e/fixtures/deployedSmokeConfig';

const deploymentUrl = 'https://statsplus-frontend-pj8o7a8n2-chris-fus-projects.vercel.app/';
const productionUrl = 'https://statsplus-frontend.vercel.app/';

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
    expect(isAllowedDeploymentUrl(productionUrl)).toBe(true);
    expect(isAllowedDeploymentUrl(productionUrl, 'production')).toBe(true);
    expect(isAllowedDeploymentUrl(deploymentUrl, 'production')).toBe(false);
    expect(isAllowedDeploymentUrl(productionUrl, 'protected-preview')).toBe(false);
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
    expect(workflowSource).toContain('github.event.repository.default_branch');
    expect(workflowSource).toContain(
      'run: node scripts/validate-deployment-url.mjs "$RELEASE_CHECK_MODE" "$E2E_BASE_URL" "$E2E_API_BASE_URL" "$E2E_MCP_BASE_URL"',
    );
    expect(workflowSource).toContain('VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.');
    expect(workflowSource.indexOf('Validate protected preview deployment URL')).toBeLessThan(
      workflowSource.indexOf('VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.'),
    );
    expect(workflowSource).toContain(
      "E2E_BASE_URL: ${{ github.event_name == 'workflow_dispatch' && (inputs.base_url || (inputs.mode == 'staging' && 'https://staging.courtai.app' || 'https://statsplus-frontend.vercel.app')) || 'https://statsplus-frontend.vercel.app' }}",
    );
    expect(workflowSource).not.toContain('github.event.deployment_status.environment_url');
  });

  test('names a Release Check dispatch after its mode and release_id so the Nightly Release finds its own run', () => {
    const workflow = YAML.parse(
      fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/deployed-smoke.yml'), 'utf8'),
    );

    expect(workflow['run-name']).toBe(
      "${{ inputs.release_id && format('Release Check {0} {1}', inputs.mode, inputs.release_id) || github.workflow }}",
    );
    expect(workflow.on.workflow_dispatch.inputs.release_id).toMatchObject({
      required: false,
      type: 'string',
    });
    // The named run must still be the one that runs the Release Check for a dispatch:
    // the whole active condition, so appending `&& false` (a skipped job) is noticed.
    expect(workflow.jobs['production-smoke'].if.replace(/\s+/g, ' ').trim()).toBe(
      "github.repository == 'crf04/statsplus-frontend' && ((github.event_name == 'deployment_status' && github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Production') || (github.event_name == 'workflow_dispatch' && (inputs.mode == 'production' || inputs.mode == 'staging' || inputs.mode == 'compatibility')))",
    );
  });

  test('the deployed-page fixture applies compatibility routing and the job tells it the mode', () => {
    const fixture = fs.readFileSync(
      path.resolve(process.cwd(), 'e2e/fixtures/deployedSmoke.js'),
      'utf8',
    );
    const workflow = YAML.parse(
      fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/deployed-smoke.yml'), 'utf8'),
    );

    expect(fixture).toMatch(
      /const blockedWrites = await blockWrites\(context\);\s+await routeApiToCandidate\(context\);/,
    );
    expect(workflow.jobs['production-smoke'].env.RELEASE_CHECK_MODE).toContain('inputs.mode');
    expect(workflow.jobs['production-smoke'].env.E2E_API_BASE_URL).toContain('inputs.api_base_url');
  });

  test('the compatibility Release Check pairs the production frontend with the staging API and MCP only', () => {
    const staging = {
      api: 'https://statsplus-backend-staging.up.railway.app',
      mcp: 'https://mcp-staging.courtai.app',
    };
    const check = (target) => isAllowedReleaseCheckTarget('compatibility', target);

    expect(check({ frontend: 'https://statsplus-frontend.vercel.app', ...staging })).toBe(true);
    expect(check({ frontend: 'https://staging.courtai.app', ...staging })).toBe(false);
    expect(
      check({
        frontend: 'https://statsplus-frontend.vercel.app',
        api: 'https://statsplus-backend-production.up.railway.app',
        mcp: staging.mcp,
      }),
    ).toBe(false);
    expect(
      check({
        frontend: 'https://statsplus-frontend.vercel.app',
        api: staging.api,
        mcp: 'https://mcp.courtai.app',
      }),
    ).toBe(false);
  });

  test('dispatches the Release Check against staging with explicit API and MCP URLs', () => {
    const workflowSource = fs.readFileSync(
      path.resolve(process.cwd(), '.github/workflows/deployed-smoke.yml'),
      'utf8',
    );

    expect(workflowSource).toContain('- staging');
    expect(workflowSource).toContain('api_base_url:');
    expect(workflowSource).toContain('mcp_base_url:');
    expect(workflowSource).toContain(
      "(inputs.mode == 'production' || inputs.mode == 'staging' || inputs.mode == 'compatibility')",
    );
    expect(workflowSource).toMatch(
      /E2E_API_BASE_URL: .*inputs\.mode == 'production' && 'https:\/\/statsplus-backend-production\.up\.railway\.app' \|\| ''/,
    );
    expect(workflowSource).toMatch(
      /E2E_MCP_BASE_URL: .*inputs\.mode == 'production' && 'https:\/\/mcp\.courtai\.app' \|\| ''/,
    );
  });

  test('runs the smoke suite itself in both the Release Check and protected preview jobs', () => {
    const workflowSource = fs.readFileSync(
      path.resolve(process.cwd(), '.github/workflows/deployed-smoke.yml'),
      'utf8',
    );

    expect(workflowSource).toMatch(/- name: Run Release Check\n\s+run: npm run test:e2e:smoke\n/);
    expect(workflowSource).toMatch(
      /E2E_PROTECTED_PREVIEW=true \\\n\s+VERCEL_AUTOMATION_BYPASS_SECRET="\$protected_secret" \\\n\s+npm run test:e2e:smoke\n/,
    );
  });

  test('uses the immutable workflow revision for manual smoke runs', () => {
    const workflowSource = fs.readFileSync(
      path.resolve(process.cwd(), '.github/workflows/deployed-smoke.yml'),
      'utf8',
    );
    const manualWorkflowRevision =
      "ref: ${{ github.event_name == 'workflow_dispatch' && github.workflow_sha || github.event.repository.default_branch }}";
    const checkoutSteps = workflowSource.match(
      /- name: Check out trusted smoke harness[\s\S]*?persist-credentials: false/g,
    );

    expect(checkoutSteps).toHaveLength(2);
    expect(checkoutSteps).toEqual([
      expect.stringContaining(manualWorkflowRevision),
      expect.stringContaining(manualWorkflowRevision),
    ]);
  });

  const productionApi = 'https://statsplus-backend-production.up.railway.app';
  const productionMcp = 'https://mcp.courtai.app';
  const stagingApi = 'https://statsplus-backend-staging.up.railway.app';
  const stagingMcp = 'https://mcp-staging.courtai.app';
  const stagingUrl = 'https://staging.courtai.app';

  test.each([
    {
      label: 'public production alias',
      args: ['production', productionUrl, productionApi, productionMcp],
      status: 0,
    },
    {
      label: 'immutable deployment URL',
      args: ['production', deploymentUrl, productionApi, productionMcp],
      status: 1,
    },
    {
      label: 'staging frontend, API and MCP',
      args: ['staging', stagingUrl, stagingApi, stagingMcp],
      status: 0,
    },
    { label: 'production without API and MCP', args: ['production', productionUrl], status: 1 },
    { label: 'staging without API and MCP', args: ['staging', stagingUrl], status: 1 },
    {
      label: 'staging frontend in production mode',
      args: ['production', stagingUrl, productionApi, productionMcp],
      status: 1,
    },
    {
      label: 'production frontend in staging mode',
      args: ['staging', productionUrl, stagingApi, stagingMcp],
      status: 1,
    },
    {
      label: 'production API against staging',
      args: ['staging', stagingUrl, productionApi, stagingMcp],
      status: 1,
    },
    {
      label: 'production MCP against staging',
      args: ['staging', stagingUrl, stagingApi, productionMcp],
      status: 1,
    },
    {
      label: 'staging MCP against production',
      args: ['production', productionUrl, productionApi, stagingMcp],
      status: 1,
    },
    {
      label: 'another host',
      args: ['staging', 'https://evil.example/', stagingApi, stagingMcp],
      status: 1,
    },
    {
      label: 'a lookalike staging host',
      args: ['staging', 'https://staging.courtai.app.evil.example/', stagingApi, stagingMcp],
      status: 1,
    },
    {
      label: 'an MCP URL with a path',
      args: ['production', productionUrl, productionApi, `${productionMcp}/mcp`],
      status: 1,
    },
    {
      label: 'plain http',
      args: ['staging', stagingUrl.replace('https', 'http'), stagingApi, stagingMcp],
      status: 1,
    },
    {
      label: 'an unknown mode',
      args: ['preview', productionUrl, productionApi, productionMcp],
      status: 1,
    },
  ])('validates Release Check targets for $label', ({ args, status }) => {
    const result = spawnSync(process.execPath, ['scripts/validate-deployment-url.mjs', ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.status).toBe(status);
  });

  test.each([
    {
      label: 'query values',
      rejectedUrl: 'https://statsplus-frontend.vercel.app/?x-vercel-protection-bypass=query-secret',
      secret: 'query-secret',
      expectedOrigin: 'https://statsplus-frontend.vercel.app',
    },
    {
      label: 'userinfo',
      rejectedUrl: 'https://userinfo-secret:password@statsplus-frontend.vercel.app/',
      secret: 'userinfo-secret',
      expectedOrigin: 'https://statsplus-frontend.vercel.app',
    },
    {
      label: 'fragment values',
      rejectedUrl: 'https://statsplus-frontend.vercel.app/#fragment-secret',
      secret: 'fragment-secret',
      expectedOrigin: 'https://statsplus-frontend.vercel.app',
    },
    {
      label: 'malformed input',
      rejectedUrl: 'https://[malformed-secret',
      secret: 'malformed-secret',
      expectedOrigin: '<redacted-invalid-url>',
    },
  ])(
    'reports the rejected mode and safe origin for $label',
    ({ rejectedUrl, secret, expectedOrigin }) => {
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
      expect(result.stderr).toContain(`origin=${JSON.stringify(expectedOrigin)}`);
      expect(result.stderr).not.toContain(secret);
      expect(result.stderr).not.toContain(bypassSecret);
    },
  );
});
