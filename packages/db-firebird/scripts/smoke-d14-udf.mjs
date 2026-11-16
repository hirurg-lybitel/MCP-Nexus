import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbServices, loadFirebirdConfig } from '../dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

process.env.NODE_FB_HOST = 'localhost';
process.env.NODE_FB_PORT = '3055';
process.env.NODE_FB_DB = 'D:\\Soft\\gedemin\\Databases\\CRM_FB5.FDB';

const cfg = loadFirebirdConfig();
if (!cfg) throw new Error('no config');
const db = createDbServices(cfg);

try {
  const profile = await db.getCompatibilityProfile();
  console.log(JSON.stringify(profile, null, 2));
  if (profile.engineMajor !== 5) {
    throw new Error(`expected engineMajor 5, got ${profile.engineMajor}`);
  }
  if (profile.udf.brokenFunctions.length > 0) {
    throw new Error(
      `stand FB5 should have working gudf; broken=${profile.udf.brokenFunctions.join(',')}`
    );
  }
  if (profile.udf.unavailableTables.length > 0) {
    throw new Error(
      `unexpected unavailable tables: ${profile.udf.unavailableTables.map((t) => t.table).join(',')}`
    );
  }
  console.log('d14-udf OK');
} finally {
  await db.dispose();
}
