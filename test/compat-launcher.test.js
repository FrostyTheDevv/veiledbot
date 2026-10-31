import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const launcher = resolve(root, 'scripts', 'start-compat.js');

test('compat launcher fails safely until a Discord client is wired', () => {
  const result = spawnSync(process.execPath, [launcher], {
    cwd: root,
    env: {},
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Discord migration runner is not wired yet/);
  assert.match(result.stderr, /does not connect a Discord client/);
  assert.match(result.stderr, /npm run veiled/);
  assert.equal(result.stdout, '');
});
