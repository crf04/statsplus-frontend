import { expect, test } from '../fixtures/courtai';

test('the landing UTM and ref reach the attribution endpoint once, even from a waitlisted account', async ({
  waitlistedPage,
}) => {
  const page = waitlistedPage;
  const bodies = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/user/attribution') && request.method() === 'POST') {
      bodies.push(request.postDataJSON());
    }
  });

  await page.goto('/no-such-route?utm_source=x&utm_campaign=y&ref=abc');
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toMatchObject({
    utm_source: 'x',
    utm_campaign: 'y',
    ref: 'abc',
    landing_path: '/no-such-route',
  });

  // The fixture accepts only a valid bearer, so a recorded send proves the token was attached.
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(window.localStorage.getItem('courtai.firstTouch')).sentFor),
    )
    .toBe('courtai-e2e-user');

  await page.goto('/?utm_source=other');
  await page.reload();
  expect(bodies).toHaveLength(1);
});

test.describe('attribution endpoint contract in the fixture', () => {
  const post = (page, { token, body }) =>
    page.evaluate(
      async ({ token, body }) => {
        const response = await fetch('/api/user/attribution', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
        });
        return { status: response.status, json: await response.json() };
      },
      { token, body },
    );

  test('401 without a bearer, 400 for bad bodies, 201 on the first write, 200 afterwards', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    // Mark the app's own send as done so this test owns the account's first write.
    await page.addInitScript(() =>
      window.localStorage.setItem(
        'courtai.firstTouch',
        JSON.stringify({ payload: {}, sentFor: 'courtai-e2e-user' }),
      ),
    );
    await page.goto('/');
    const bearer = 'courtai-e2e-token';

    expect(await post(page, { token: null, body: '{}' })).toEqual({
      status: 401,
      json: { error: { code: 'unauthorized', message: 'Missing E2E bearer token.' } },
    });
    for (const body of ['[]', '"text"', '{"ref":5}']) {
      const invalid = await post(page, { token: bearer, body });
      expect(invalid.status).toBe(400);
      expect(invalid.json.error.code).toBe('invalid_attribution');
    }
    expect(await post(page, { token: bearer, body: '{"ref":"abc"}' })).toEqual({
      status: 201,
      json: { recorded: true },
    });
    expect(await post(page, { token: bearer, body: '{"ref":"zzz"}' })).toEqual({
      status: 200,
      json: { recorded: false },
    });
  });
});
