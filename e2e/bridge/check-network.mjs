import { readFile } from 'node:fs/promises';

const files = process.argv.slice(2);
if (!files.length) throw new Error('Pass one or more bridge network log paths');
for (const file of files) {
  const counts = { http: 0, 'browser-resource': 0 };
  const origins = new Set();
  const outside = [];
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    if (!line.startsWith('{')) continue;
    const entry = JSON.parse(line);
    if (!(entry.kind in counts)) continue;
    counts[entry.kind]++;
    origins.add(entry.origin);
    if (!['127.0.0.1', '[::1]'].includes(new URL(entry.origin).hostname)) outside.push(entry);
  }
  if (!counts.http || !counts['browser-resource'])
    throw new Error(`${file}: missing HTTP or browser evidence`);
  if (outside.length) throw new Error(`${file}: non-loopback entries: ${JSON.stringify(outside)}`);
  console.log(JSON.stringify({ file, ...counts, origins: [...origins], nonLoopback: 0 }));
}
