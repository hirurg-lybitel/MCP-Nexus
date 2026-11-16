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
  const meta = await db.describeTable.run('AC_ACCT_CONFIG');
  console.log(
    'columns',
    meta.columns?.map((c) => c.name) ?? meta
  );

  const counts = await db.executeSql.run(`
SELECT classname, COUNT(*) AS c
FROM ac_acct_config
GROUP BY 1
ORDER BY 2 DESC
`);
  console.log('by class', JSON.stringify(counts.rows, null, 2));

  const list = await db.executeSql.run(`
SELECT FIRST 15 id, name, classname, folder, showinexplorer
FROM ac_acct_config
ORDER BY name
`);
  console.log('list', JSON.stringify(list.rows, null, 2));

  const analytics = await db.executeSql.run(`
SELECT FIRST 8 a.accountkey, acc.alias, f.fieldname, f.lname, f.reftable
FROM ac_accanalyticsext a
JOIN ac_account acc ON acc.id = a.accountkey
JOIN at_relation_fields f ON f.id = a.valuekey
WHERE acc.alias STARTING WITH '62'
`);
  console.log('analytics 62*', JSON.stringify(analytics.rows, null, 2));

  const acct = await db.executeSql.run(`
SELECT FIRST 1 id, alias, name, accounttype, activity, offbalance, multycurr, lb, rb, parent
FROM ac_account
WHERE accounttype IN ('A','S') AND alias STARTING WITH '62'
ORDER BY alias
`);
  console.log('account', JSON.stringify(acct.rows[0] ?? null, null, 2));

  const descCols = await db.describeTable.run('AC_ACCOUNT');
  console.log(
    'ac_account has description?',
    (descCols.columns ?? []).some((c) => /DESC/i.test(c.name))
  );
  console.log(
    'ac_account fields',
    (descCols.columns ?? []).map((c) => c.name).filter((n) => /ANAL|DESC|ACTIV|OFF|MULTI|TYPE|ALIAS|NAME|LB|RB|PARENT/i.test(n))
  );
} finally {
  await db.dispose();
}
