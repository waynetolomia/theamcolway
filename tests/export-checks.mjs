import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const manifest = JSON.parse(read('source-assets.json'));
assert.equal(manifest.sourceCommit, '3d7019d22655fb3b681f29e2eb0a977d040330c1');
let totalBytes = 0;
for (const item of manifest.files) {
  const file = new URL(item.path, root);
  let data = readFileSync(file);
  if (item.path === 'public/game/academy-ui.js') {
    const text = data.toString();
    assert.ok(text.includes('href="/auth/login"'));
    assert.ok(!text.includes('/signin-with-chatgpt'));
    data = Buffer.from(text.replace('/auth/login', '/signin-with-chatgpt?return_to=%2Fgame%2Findex.html'));
  }
  assert.equal(createHash('sha256').update(data).digest('hex'), item.sha256, `Source asset changed: ${item.path}`);
  assert.ok(statSync(file).size < 25 * 1024 * 1024, `Static asset exceeds Cloudflare's 25 MiB limit: ${item.path}`);
  totalBytes += statSync(file).size;
}
const config = JSON.parse(read('wrangler.jsonc'));
assert.equal(config.assets.directory, './public');
assert.equal(config.assets.binding, 'ASSETS');
assert.equal(config.assets.run_worker_first, true);
assert.equal(config.assets.not_found_handling, 'none');
assert.equal(config.assets.html_handling, 'none');
assert.equal(config.main, 'src/worker.mjs');
assert.equal(config.vars.ENVIRONMENT, 'production');
assert.ok(!config.vars.DEV_MODE);
assert.equal(config.preview_urls, false);
assert.deepEqual(readdirSync(new URL('migrations/', root)).sort(), ['0000_chubby_captain_flint.sql', '0001_huge_exiles.sql']);
assert.ok(!read('src/auth.mjs').includes("headers.get('oai-authenticated-user-id')"));
for (const options of [{}, { D1_DATABASE_ID: 'bad' }, {
  D1_DATABASE_ID: '12345678-1234-1234-1234-123456789abc', DEV_MODE: 'true',
}]) {
  const env = { ...process.env, D1_DATABASE_ID: '', ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '', DEV_MODE: '', ...options };
  const result = spawnSync(process.execPath, ['scripts/configure.mjs'], { cwd: root, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'Production configure must reject incomplete or development configuration');
}
console.log(`Export checks passed: ${manifest.files.length} original tracked assets, ${totalBytes.toLocaleString()} bytes; production fails closed; instructor files are outside the asset root.`);
