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
  const arf = await db.describeTable.run('AT_RELATION_FIELDS');
  console.log(
    'at_relation_fields',
    (arf.columns ?? []).map((c) => c?.name ?? c).filter(Boolean)
  );

  const analytics = await db.executeSql.run(`
SELECT FIRST 10 a.accountkey, acc.alias, f.fieldname, f.lname
FROM ac_accanalyticsext a
JOIN ac_account acc ON acc.id = a.accountkey
JOIN at_relation_fields f ON f.id = a.valuekey
WHERE acc.alias STARTING WITH '62'
`);
  console.log('analytics', JSON.stringify(analytics.rows, null, 2));

  const ledgers = await db.executeSql.run(`
SELECT FIRST 5 id, name, classname, folder, showinexplorer
FROM ac_acct_config
WHERE classname = 'TAccLedgerConfig'
ORDER BY name
`);
  console.log('ledger configs', JSON.stringify(ledgers.rows, null, 2));

  const cards = await db.executeSql.run(`
SELECT FIRST 5 id, name, classname, folder, showinexplorer
FROM ac_acct_config
WHERE classname = 'TAccCardConfig' AND showinexplorer = 1
ORDER BY name
`);
  console.log('visible cards', JSON.stringify(cards.rows, null, 2));

  const acctMeta = await db.describeTable.run('AC_ACCOUNT');
  console.log(
    'ac_account',
    (acctMeta.columns ?? []).map((c) => c?.name ?? c).filter(Boolean)
  );
} finally {
  await db.dispose();
}
