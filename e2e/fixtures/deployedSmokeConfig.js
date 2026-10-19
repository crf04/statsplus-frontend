const vercelDeploymentHost =
  /^(?:statsplus-frontend|statsplus-frontend-[a-z0-9-]+-chris-fus-projects)\.vercel\.app$/;

const containsUnsafeCookieValueCharacter = (value) =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x20 || code === 0x7f || character === ';';
  });

const isBareHttpsOrigin = (candidate) => {
  if (typeof candidate !== 'string' || candidate.length === 0) return null;
  if (candidate !== candidate.trim()) return null;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  return url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === ''
    ? url
    : null;
};

// The Release Check targets (crf04/statsplus#249): the only frontend, API and MCP
// origins it may be pointed at. The API and MCP hosts are matched exactly for
// production; the staging backend and MCP are separate Railway services.
const releaseCheckTargets = {
  production: {
    api: /^statsplus-backend-production\.up\.railway\.app$/,
    mcp: /^mcp\.courtai\.app$/,
  },
  staging: {
    frontend: /^staging\.courtai\.app$/,
    api: /^statsplus-backend-staging[a-z0-9-]*\.up\.railway\.app$/,
    mcp: /^mcp-staging\.courtai\.app$/,
  },
  // The frontend serving production against the candidate backend and MCP on staging.
  compatibility: {
    frontend: /^statsplus-frontend\.vercel\.app$/,
    api: /^statsplus-backend-staging[a-z0-9-]*\.up\.railway\.app$/,
    mcp: /^mcp-staging\.courtai\.app$/,
  },
};

export const isAllowedReleaseCheckTarget = (mode, { frontend, api, mcp }) => {
  const target = releaseCheckTargets[mode];
  if (!target) return false;
  const frontendHost = isBareHttpsOrigin(frontend)?.hostname;
  const apiHost = isBareHttpsOrigin(api)?.hostname;
  const mcpHost = isBareHttpsOrigin(mcp)?.hostname;
  if (!frontendHost || !apiHost || !mcpHost) return false;
  const frontendAllowed = target.frontend
    ? target.frontend.test(frontendHost)
    : isAllowedDeploymentUrl(frontend, mode);
  return frontendAllowed && target.api.test(apiHost) && target.mcp.test(mcpHost);
};

export const isAllowedDeploymentUrl = (candidate, mode = 'any') => {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  if (candidate !== candidate.trim()) return false;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }

  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '' &&
    vercelDeploymentHost.test(url.hostname) &&
    !(mode === 'production' && url.hostname !== 'statsplus-frontend.vercel.app') &&
    !(mode === 'protected-preview' && url.hostname === 'statsplus-frontend.vercel.app')
  );
};

export const parseVercelJwtSetCookie = (headers) => {
  const values = [];

  for (const header of headers ?? []) {
    if (typeof header?.name !== 'string' || header.name.toLowerCase() !== 'set-cookie') continue;
    if (typeof header.value !== 'string') throw new Error('Malformed Vercel bypass cookie.');

    const cookiePair = header.value.split(';', 1)[0];
    const separator = cookiePair.indexOf('=');
    const name = separator === -1 ? cookiePair.trim() : cookiePair.slice(0, separator).trim();

    if (name !== '_vercel_jwt') continue;
    if (separator === -1) throw new Error('Malformed Vercel bypass cookie.');

    const value = cookiePair.slice(separator + 1).trim();
    if (!value || containsUnsafeCookieValueCharacter(value)) {
      throw new Error('Malformed Vercel bypass cookie.');
    }
    values.push(value);
  }

  if (values.length !== 1) throw new Error('Vercel bypass cookie was not returned.');
  return values[0];
};

export const bootstrapVercelBypassCookie = async ({
  browserContext,
  configuredBaseUrl = process.env.E2E_BASE_URL,
  bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  protectedDeployment = process.env.E2E_PROTECTED_PREVIEW === 'true',
  requestApi,
}) => {
  if (!protectedDeployment || !configuredBaseUrl || !bypassSecret) return false;
  if (!isAllowedDeploymentUrl(configuredBaseUrl, 'protected-preview')) {
    throw new Error('The deployed smoke URL is not an allowed StatsPlus deployment.');
  }

  const requestContext = await requestApi.newContext();
  try {
    const response = await requestContext.get(configuredBaseUrl, {
      headers: {
        'x-vercel-protection-bypass': bypassSecret,
        'x-vercel-set-bypass-cookie': 'true',
      },
      maxRedirects: 0,
    });

    const status = response.status();
    if (status !== 307) {
      throw new Error(`Vercel protection bypass expected HTTP 307; received ${status}.`);
    }

    const value = parseVercelJwtSetCookie(response.headersArray());
    await browserContext.addCookies([
      {
        name: '_vercel_jwt',
        value,
        url: configuredBaseUrl,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    return true;
  } finally {
    await requestContext.dispose();
  }
};

// The Release Check reads only. Every browser request that is not a GET, HEAD or
// OPTIONS is aborted before it leaves the browser and recorded, so a page that
// tries to write fails its test without the write ever reaching a server.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const blockWrites = async (browserContext) => {
  const blocked = [];
  await browserContext.route('**/*', (route) => {
    const request = route.request();
    if (SAFE_METHODS.has(request.method())) return route.fallback();
    blocked.push(`${request.method()} ${request.url()}`);
    return route.abort();
  });
  return blocked;
};
