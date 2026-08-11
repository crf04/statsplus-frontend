export const getOriginScopedBypassHeaders = ({ configuredBaseUrl, bypassSecret, requestUrl }) => {
  if (!configuredBaseUrl || !bypassSecret) return {};

  if (new URL(requestUrl).origin !== new URL(configuredBaseUrl).origin) return {};

  return {
    'x-vercel-protection-bypass': bypassSecret,
    'x-vercel-set-bypass-cookie': 'true',
  };
};

export const installOriginScopedBypass = async (
  page,
  {
    configuredBaseUrl = process.env.E2E_BASE_URL,
    bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  } = {},
) => {
  if (!configuredBaseUrl || !bypassSecret) return;

  await page.route('**/*', async (route) => {
    const request = route.request();
    const bypassHeaders = getOriginScopedBypassHeaders({
      configuredBaseUrl,
      bypassSecret,
      requestUrl: request.url(),
    });

    if (Object.keys(bypassHeaders).length === 0) {
      await route.continue();
      return;
    }

    await route.continue({
      headers: {
        ...request.headers(),
        ...bypassHeaders,
      },
    });
  });
};
