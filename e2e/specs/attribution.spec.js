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

  await page.goto('/?utm_source=other');
  await page.reload();
  expect(bodies).toHaveLength(1);
});
