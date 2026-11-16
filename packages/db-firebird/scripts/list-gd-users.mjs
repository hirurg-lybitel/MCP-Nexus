import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbServices, loadFirebirdConfig } from '../dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const db = createDbServices(loadFirebirdConfig());
try {
  const users = await db.executeSql.run(`
SELECT FIRST 30 u.id, u.name, u.ingroup
FROM gd_user u
ORDER BY u.name
`);
  console.log(JSON.stringify(users.rows, null, 2));
} finally {
  await db.dispose();
}
