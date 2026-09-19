import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { protectProduction } from "./production-guard.mjs";

test("production writes cannot reach the upstream handler, including encoded paths", async () => {
  let writes = 0;
  const server = createServer(
    protectProduction("production", (req, res) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) writes++;
      res.end("upstream");
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(origin + "/api/games/slate")).status, 200);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const path of [
        "/api/user/saved-filter-sets",
        "/api%2fuser%2fsaved-filter-sets",
        "/other",
      ]) {
        assert.equal((await fetch(origin + path, { method })).status, 403);
      }
    }
    assert.equal(writes, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("QA passes writes through for real mutation tests", async () => {
  let writes = 0;
  const server = createServer(
    protectProduction("qa", (_req, res) => {
      writes++;
      res.end("saved");
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/user/saved-filter-sets`,
      { method: "POST" },
    );
    assert.equal(response.status, 200);
    assert.equal(writes, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
