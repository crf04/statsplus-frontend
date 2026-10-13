import assert from 'node:assert/strict';
import test from 'node:test';
import { startBridge } from './server.mjs';

test('HTTP bridge preserves the fixture contract and isolates disposable accounts', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.close());
  const bootstrap = async (role) => {
    const response = await fetch(`${bridge.origin}/__fixture/bootstrap/${role}`);
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  const api = (cookie, path, method = 'GET', body) =>
    fetch(`${bridge.origin}/api/${path}`, {
      method,
      headers: {
        Cookie: cookie,
        Authorization: 'Bearer courtai-e2e-token',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const reader = await bootstrap('reader');

  await t.test(
    'unknown API and bootstrap routes fail closed; no session cannot read data',
    async () => {
      assert.equal((await api(reader, 'unknown')).status, 501);
      assert.equal((await fetch(`${bridge.origin}/__fixture/unknown`)).status, 404);
      assert.equal((await fetch(`${bridge.origin}/api/games/slate`)).status, 401);
      assert.equal((await api(reader, 'admin/collection/diagnostics')).status, 403);
    },
  );

  await t.test(
    'saved sets persist for their cookie but a fresh bootstrap starts empty',
    async () => {
      const created = await api(reader, 'user/saved-filter-sets', 'POST', {
        name: 'One game',
        query_string: 'player_name=LeBron+James&game_filter=1',
      });
      assert.equal(created.status, 201);
      const read = await (await api(reader, 'user/saved-filter-sets')).json();
      assert.deepEqual(
        read.saved_filter_sets.map(({ name, query_string }) => ({ name, query_string })),
        [{ name: 'One game', query_string: 'player_name=LeBron+James&game_filter=1' }],
      );
      const other = await bootstrap('reader');
      assert.deepEqual(await (await api(other, 'user/saved-filter-sets')).json(), {
        success: true,
        saved_filter_sets: [],
      });
      assert.equal(
        (await (await api(reader, 'user/saved-filter-sets')).json()).saved_filter_sets.length,
        1,
      );
    },
  );

  await t.test('admin jobs are simulated and isolated from a second administrator', async () => {
    const admin = await bootstrap('admin');
    const jobs = async (cookie) =>
      (await (await api(cookie, 'admin/collection/diagnostics')).json()).jobs;
    const before = await jobs(admin);
    const queued = await api(admin, 'admin/collection/repair', 'POST', {
      stream_key: 'traditional_opponent',
      season: '2025-26',
      cutoff: '2026-04-13T00:00:00.000Z',
      reason: 'Fixture isolation check',
    });
    assert.equal(queued.status, 202);
    assert.equal((await jobs(admin)).length, before.length + 1);
    assert.deepEqual(await jobs(await bootstrap('admin')), before);
  });

  await t.test(
    'documents restrict resources to this origin and omit remote font connections',
    async () => {
      const response = await fetch(bridge.origin);
      assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
      assert.doesNotMatch(await response.text(), /fonts\.google/);
    },
  );
});
