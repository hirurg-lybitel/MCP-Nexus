import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbServices, loadFirebirdConfig } from '../dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}
process.env.FIREBIRD_QUERY_TIMEOUT_MS ||= '180000';

const db = createDbServices(loadFirebirdConfig());
try {
  const collapsed = await db.executeSql.run(`
SELECT FIRST 3 *
FROM ac_accountexsaldo_bal(DATE '2025-12-28', 366201, 'ACCOUNTKEY', 148284864, 0, 0)
`);
  console.log('collapsed keys', Object.keys(collapsed.rows[0] ?? {}));
  console.log('collapsed', JSON.stringify(collapsed.rows, null, 2));

  const expanded = await db.executeSql.run(`
SELECT FIRST 5 *
FROM ac_accountexsaldo_bal(DATE '2025-12-28', 366201, 'USR$GS_CUSTOMER', 148284864, 0, 0)
`);
  console.log('expanded keys', Object.keys(expanded.rows[0] ?? {}));
  console.log('expanded', JSON.stringify(expanded.rows.slice(0, 3), null, 2));
} finally {
  await db.dispose();
}
