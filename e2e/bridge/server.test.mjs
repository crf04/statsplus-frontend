import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { get } from 'node:http';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { startBridge } from './server.mjs';

test('HTTP bridge preserves the fixture contract and isolates disposable accounts', async (t) => {
  const bridge = await startBridge();
  t.after(() => bridge.close());
  assert.equal(new URL(bridge.origin).hostname, '127.0.0.1');
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
      assert.equal(
        (await fetch(`${bridge.origin}/api/games/slate`, { headers: { Cookie: reader } })).status,
        401,
      );
      assert.equal(
        (
          await fetch(`${bridge.origin}/api/games/slate`, {
            headers: { Authorization: 'Bearer courtai-e2e-token' },
          })
        ).status,
        401,
      );
      const wrongHostStatus = await new Promise((resolve, reject) => {
        get(bridge.origin, { headers: { Host: 'outside.invalid' } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        }).on('error', reject);
      });
      assert.equal(wrongHostStatus, 403);
      assert.equal(
        (
          await api(reader, 'admin/collection/repair', 'POST', {
            stream_key: 'traditional_opponent',
            season: '2025-26',
            cutoff: '2026-04-13T00:00:00.000Z',
            reason: 'Must be denied',
          })
        ).status,
        403,
      );
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
      assert.equal(
        response.headers
          .get('content-security-policy')
          .split(';')
          .map((value) => value.trim())
          .find((value) => value.startsWith('connect-src')),
        "connect-src 'self'",
      );
      assert.doesNotMatch(await response.text(), /fonts\.google/);
    },
  );
});

test(
  'CLI records browser network evidence without query strings and exits on SIGTERM',
  { timeout: 15000 },
  async (t) => {
    const child = spawn(process.execPath, ['e2e/bridge/server.mjs', '0'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exited = once(child, 'exit');
    const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
    t.after(async () => {
      child.kill('SIGTERM');
      await exited;
    });
    const nextLine = async (prefix) => {
      while (true) {
        const { value, done } = await lines.next();
        assert.equal(done, false, 'bridge must remain running until teardown');
        if (value.startsWith(prefix)) return value;
      }
    };
    const origin = (await nextLine('Fixture bridge: ')).slice('Fixture bridge: '.length);
    const response = await fetch(`${origin}/__fixture/network`, {
      method: 'POST',
      body: JSON.stringify([{ url: 'wss://outside.invalid/socket?private=value', blocked: true }]),
    });
    assert.equal(response.status, 204);
    const record = JSON.parse(await nextLine('{"kind":"browser-resource"'));
    assert.deepEqual(record, {
      kind: 'browser-resource',
      origin: 'wss://outside.invalid',
      path: '/socket',
      blocked: true,
    });
    child.kill('SIGTERM');
    const [code] = await exited;
    assert.equal(code, 0);
  },
);
