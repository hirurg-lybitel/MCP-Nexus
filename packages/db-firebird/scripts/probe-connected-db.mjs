import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbServices, loadFirebirdConfig } from '../dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

process.env.FIREBIRD_QUERY_TIMEOUT_MS ||= '120000';

const db = createDbServices(loadFirebirdConfig());
try {
  const engine = await db.executeSql.run(
    `SELECT TRIM(rdb$get_context('SYSTEM', 'ENGINE_VERSION')) AS v FROM rdb$database`
  );
  const company = await db.executeSql.run(`
SELECT FIRST 5 c.id, c.name, ca.accountkey
FROM ac_companyaccount ca
JOIN gd_contact c ON c.id = ca.companykey
WHERE ca.isactive = 1
ORDER BY c.name
`);
  const user = await db.executeSql.run(`
SELECT FIRST 10 u.id, u.name
FROM gd_user u
WHERE UPPER(u.name) CONTAINING 'MCP'
   OR UPPER(u.name) CONTAINING 'WORKER'
ORDER BY u.name
`);
  console.log(
    JSON.stringify(
      {
        database: process.env.NODE_FB_DB,
        port: process.env.NODE_FB_PORT,
        engine: engine.rows,
        companies: company.rows,
        users: user.rows,
      },
      null,
      2
    )
  );
} finally {
  await db.dispose();
}
