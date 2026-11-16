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
process.env.NODE_FB_DB = 'D:\\Soft\\gedemin\\Databases\\BG_NEW_FB5.FDB';
process.env.FIREBIRD_MAX_ROWS = '5000';
process.env.FIREBIRD_QUERY_TIMEOUT_MS = '180000';

const db = createDbServices(loadFirebirdConfig());
const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

try {
  const ver = await db.executeSql.run(
    `SELECT TRIM(rdb$get_context('SYSTEM', 'ENGINE_VERSION')) AS v FROM rdb$database`
  );
  const engine = String(ver.rows[0]?.V ?? '');
  record('engine', engine.startsWith('5.'), engine);

  const company = 148284864;
  const latest = await db.executeSql.run(`
    SELECT FIRST 1 entrydate AS d
    FROM ac_entry
    WHERE companykey = ${company}
      AND debitncu > 0
      AND entrydate BETWEEN DATE '2020-01-01' AND DATE '2025-12-31'
    ORDER BY entrydate DESC
  `);
  const latestDate = String(latest.rows[0]?.D ?? latest.rows[0]?.d ?? '');
  record('latest BelGISS debit date 2020-2025', /^\d{4}-\d{2}-\d{2}/.test(latestDate), latestDate);
  const year = Number(latestDate.slice(0, 4));
  const month = latestDate.slice(0, 7);
  if (Number.isFinite(year)) {
    const osb = await db.executeSql.run(`
      SELECT COUNT(*) AS accounts,
             CAST(SUM(ncu_debit) AS NUMERIC(18,2)) AS debit,
             CAST(SUM(ncu_credit) AS NUMERIC(18,2)) AS credit
      FROM ac_circulationlist_bal(
        DATE '${month}-01',
        DATE '${year}-${month.slice(5, 7)}-28',
        ${company},
        0,
        300001,
        0,
        1
      )
    `);
    const row = osb.rows[0] ?? {};
    const accounts = Number(row.ACCOUNTS ?? row.accounts);
    const debit = Number(row.DEBIT ?? row.debit);
    const credit = Number(row.CREDIT ?? row.credit);
    record(
      `OSB procedure BelGISS ${month}`,
      accounts > 0 && (debit > 0 || credit > 0),
      { accounts, debit: row.DEBIT ?? row.debit, credit: row.CREDIT ?? row.credit }
    );
  } else {
    record('OSB procedure BelGISS', false, 'no year in 2015-2025');
  }

  const profile = await db.getCompatibilityProfile();
  record('udf profile', profile.engineMajor === 5, {
    engine: profile.engineVersion,
    broken: profile.udf.brokenFunctions,
    unavailable: profile.udf.unavailableTables.length,
  });

  const sum = await db.executeSql.run(`
    SELECT CAST(SUM(debitncu) AS NUMERIC(18,2)) AS s
    FROM ac_entry
    WHERE companykey = ${company}
      AND entrydate BETWEEN DATE '${month}-01' AND DATE '${year}-${month.slice(5, 7)}-28'
  `);
  const s = sum.rows[0]?.S ?? sum.rows[0]?.s;
  record(
    `debit sum BelGISS ${month} is decimal string`,
    typeof s === 'string' && Number(s) > 0,
    { type: typeof s, s, keys: Object.keys(sum.rows[0] ?? {}) }
  );

  const account = await db.executeSql.run(`
    SELECT FIRST 5 id, alias, name
    FROM ac_account
    WHERE alias STARTING WITH '62'
    ORDER BY alias
  `);
  record('account 62 exists', account.rows.length > 0, account.rows);
} catch (error) {
  record('probe', false, error instanceof Error ? error.message : String(error));
} finally {
  try {
    await db.dispose();
  } catch {
    /* ignore */
  }
}

const failed = checks.filter((c) => !c.ok);
if (failed.length) process.exitCode = 1;
