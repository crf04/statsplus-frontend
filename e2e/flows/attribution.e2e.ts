// Ported from e2e/specs/attribution.spec.js (second test only; the source stays, see MIGRATION.md).
// The first source test counts the requests the client sends, which e2e cannot observe
// completely, so it stays in Playwright. The title is the source's leaf title; the source
// nested it in `test.describe('attribution endpoint contract in the fixture')`.
import { expect } from 'e2e';
import { signedInTest } from './support/courtai.ts';

const BEARER = 'courtai-e2e-token';

signedInTest(
  '401 without a bearer, 400 for bad bodies, 201 on the first write, 200 afterwards',
  async ({ app, browser, api }) => {
    const post = (token: string | null, body: string) =>
      browser.evaluate(
        async ({ token, body }: { token: string | null; body: string }) => {
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

    // Mark the app's own send as done so this test owns the account's first write.
    await browser.addInitScript(() =>
      window.localStorage.setItem(
        'courtai.firstTouch',
        JSON.stringify({ payload: {}, sentFor: 'courtai-e2e-user' }),
      ),
    );
    await app.open('/');

    expect(await post(null, '{}')).toEqual({
      status: 401,
      json: { error: { code: 'unauthorized', message: 'Missing E2E bearer token.' } },
    });
    for (const body of ['[]', '"text"', '{"ref":5}']) {
      const invalid = await post(BEARER, body);
      expect(invalid.status).toBe(400);
      expect(invalid.json.error.code).toBe('invalid_attribution');
    }
    expect(await post(BEARER, '{"ref":"abc"}')).toEqual({
      status: 201,
      json: { recorded: true },
    });
    expect(await post(BEARER, '{"ref":"zzz"}')).toEqual({
      status: 200,
      json: { recorded: false },
    });
    // Not in the source: only this test's six posts reached the endpoint, so the app's
    // own send did not take the first write.
    expect(api.sent('/api/user/attribution', 'POST')).toHaveLength(6);
  },
);
