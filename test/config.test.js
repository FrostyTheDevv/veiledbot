import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('compatibility profile loads its separate dotenv file without requiring credentials in the shell', () => {
  const fixtureDir = mkdtempSync(resolve(tmpdir(), 'veiledbot-config-'));
  const envPath = resolve(fixtureDir, '.env.compat.local');
  try {
    writeFileSync(envPath, 'VEILED_BOT_TOKEN=fixture-token\nVEILED_API_URL=https://api.example.test/api/v1\nBOT_PREFIX=?\n');
    const env = { ...process.env };
    for (const name of ['VEILED_BOT_TOKEN', 'TOKEN', 'VEILED_API_URL', 'API_URL', 'VEILED_GATEWAY_URL', 'GATEWAY_URL', 'BOT_PREFIX']) delete env[name];
    env.VEILEDBOT_ENV_FILE = envPath;
    const moduleUrl = new URL('../src/config.js', import.meta.url).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const { config } = await import(${JSON.stringify(moduleUrl)}); process.stdout.write(JSON.stringify({ token: config.token, apiUrl: config.apiUrl, commandPrefix: config.commandPrefix }));`], {
      cwd: projectRoot,
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      token: 'fixture-token',
      apiUrl: 'https://api.example.test/api/v1',
      commandPrefix: '?',
    });
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
