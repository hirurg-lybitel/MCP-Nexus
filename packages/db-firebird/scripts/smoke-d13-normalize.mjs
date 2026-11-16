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
  const sum = await db.executeSql.run(
    `SELECT SUM(DEBITNCU) AS s, COUNT(*) AS c
     FROM AC_ENTRY
     WHERE ENTRYDATE BETWEEN DATE '2023-01-01' AND DATE '2023-01-31'`
  );
  const s = sum.rows[0]?.S ?? sum.rows[0]?.s;
  const c = sum.rows[0]?.C ?? sum.rows[0]?.c;
  console.log('SUM', typeof s, s, 'COUNT', typeof c, c);
  if (typeof s !== 'string') throw new Error(`expected decimal string SUM, got ${typeof s}`);
  if (typeof c !== 'number') throw new Error(`expected integer COUNT as number, got ${typeof c}`);

  const blob = await db.executeSql.run(
    `SELECT FIRST 1 DESCRIPTION AS d FROM AC_ACCOUNT WHERE DESCRIPTION IS NOT NULL`
  );
  const d = blob.rows[0]?.D ?? blob.rows[0]?.d;
  console.log('BLOB', typeof d, typeof d === 'string' ? d.slice(0, 60) : d);
  if (typeof d !== 'string') throw new Error(`expected BLOB text, got ${typeof d}`);

  console.log('d13-normalize OK');
} finally {
  await db.dispose();
}
