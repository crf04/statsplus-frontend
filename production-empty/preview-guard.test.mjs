import test from 'node:test';
import assert from 'node:assert/strict';
import { protectProduction } from './production-guard.mjs';
function check(method, url, allowed) {
  let forwarded = false, status;
  const guard = protectProduction('production', () => { forwarded = true; });
  guard({ method, url }, { writeHead(code) { status = code; }, end() {} });
  assert.equal(forwarded, allowed, `${method} ${url}`);
  if (!allowed) assert.equal(status, 403);
}
test('permits only the exact non-persistent preview POST in production', () => {
  check('POST', '/api/user/targets/preview', true);
  check('GET', '/api/user/targets', true);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    check(method, '/api/user/targets', false);
    check(method, '/api/user/targets/1', false);
  }
  for (const path of ['/api/user/targets/preview/', '/api/user/targets/preview?x=1', '/api/user/targets/preview/../1', '/api/user/targets/preview%2f..%2f1']) check('POST', path, false);
  check('DELETE', '/api/user/targets/preview', false);
});
