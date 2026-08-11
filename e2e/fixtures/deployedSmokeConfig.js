const vercelDeploymentHost =
  /^(?:statsplus-frontend|statsplus-frontend-[a-z0-9-]+-chris-fus-projects)\.vercel\.app$/;

const containsUnsafeCookieValueCharacter = (value) =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x20 || code === 0x7f || character === ';';
  });

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
