import { readFile, writeFile } from 'node:fs/promises';
import { accessConfiguration } from '../src/auth.mjs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('wrangler.jsonc', root), 'utf8'));
const bootstrap = process.argv.includes('--bootstrap');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const databaseID = process.env.D1_DATABASE_ID || '';
if (!uuid.test(databaseID) || databaseID === '00000000-0000-0000-0000-000000000000') {
  throw new Error('Set D1_DATABASE_ID to the database ID from wrangler d1 create.');
}
if (process.env.DEV_MODE && process.env.DEV_MODE !== 'false') {
  throw new Error('DEV_MODE must not be enabled for a production configuration.');
}
config.d1_databases[0].database_id = databaseID;
config.vars = { ENVIRONMENT: 'production', ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' };
if (!bootstrap) {
  const { team, audience } = accessConfiguration(process.env);
  config.vars.ACCESS_TEAM_DOMAIN = team;
  config.vars.ACCESS_AUD = audience;
}
await writeFile(new URL('wrangler.production.json', root), JSON.stringify(config, null, 2) + '\n');
console.log(bootstrap
  ? 'Created fail-closed bootstrap configuration. The game will stay unavailable until Cloudflare Access is configured.'
  : 'Created production configuration with D1 and verified Cloudflare Access settings. No credentials were written.');
