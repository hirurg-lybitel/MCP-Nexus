/**
 * One-off survey of Gedemin accounting shape on a restored database.
 * Usage: node survey-accounting-shape.mjs <port> <fdb-path> <label>
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbServices, loadFirebirdConfig } from '../dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const [, , port, dbPath, label] = process.argv;
if (!port || !dbPath) {
  console.error('usage: node survey-accounting-shape.mjs <port> <fdb> <label>');
  process.exit(1);
}

process.env.NODE_FB_HOST = 'localhost';
process.env.NODE_FB_PORT = port;
process.env.NODE_FB_DB = dbPath;
process.env.FIREBIRD_MAX_ROWS = '5000';
process.env.FIREBIRD_MIN_ENGINE_MAJOR = '5';

const cfg = loadFirebirdConfig();
if (!cfg) throw new Error('no config');
const db = createDbServices(cfg);

async function q(sql) {
  const r = await db.executeSql.run(sql);
  return r.rows;
}

function cell(row, name) {
  if (!row) return null;
  const key = Object.keys(row).find((k) => k.toUpperCase() === name.toUpperCase());
  return key ? row[key] : null;
}

try {
  const version = await q(
    `SELECT TRIM(rdb$get_context('SYSTEM', 'ENGINE_VERSION')) AS v FROM rdb$database`
  );
  const counts = await q(`
    SELECT
      (SELECT COUNT(*) FROM ac_account) AS accounts,
      (SELECT COUNT(*) FROM ac_entry) AS entries,
      (SELECT COUNT(*) FROM ac_record) AS records,
      (SELECT COUNT(*) FROM ac_transaction) AS transactions,
      (SELECT COUNT(*) FROM gd_document) AS documents,
      (SELECT COUNT(*) FROM gd_documenttype) AS doctypes,
      (SELECT COUNT(*) FROM gd_ourcompany) AS our_companies
    FROM rdb$database
  `);
  const span = await q(`
    SELECT MIN(entrydate) AS dmin, MAX(entrydate) AS dmax FROM ac_entry
  `);
  const charts = await q(`
    SELECT a.id, TRIM(a.alias) AS alias, TRIM(a.name) AS name
    FROM ac_account a
    WHERE a.accounttype = 'C'
    ORDER BY a.id
  `);
  const byType = await q(`
    SELECT TRIM(accounttype) AS accounttype, COUNT(*) AS c
    FROM ac_account
    GROUP BY 1
    ORDER BY 1
  `);
  const companies = await q(`
    SELECT
      ca.companykey,
      TRIM(c.name) AS company_name,
      TRIM(a.alias) AS chart_alias,
      TRIM(a.name) AS chart_name,
      ca.isactive
    FROM ac_companyaccount ca
    JOIN gd_contact c ON c.id = ca.companykey
    JOIN ac_account a ON a.id = ca.accountkey
    ORDER BY ca.isactive DESC, c.name
  `);
  const analytics = await q(`
    SELECT
      TRIM(arf.fieldname) AS fieldname,
      TRIM(arf.lname) AS lname,
      TRIM(af.reftable) AS reftable
    FROM at_relation_fields arf
    LEFT JOIN at_fields af ON TRIM(af.fieldname) = TRIM(arf.fieldsource)
    WHERE TRIM(arf.relationname) = 'AC_ENTRY'
      AND arf.fieldname STARTING WITH 'USR$'
    ORDER BY 1
  `);
  const usedAnalytics = await q(`
    SELECT TRIM(rf.rdb$field_name) AS fieldname
    FROM rdb$relation_fields rf
    JOIN rdb$relation_fields ra
      ON ra.rdb$field_name = rf.rdb$field_name
     AND TRIM(ra.rdb$relation_name) = 'AC_ACCOUNT'
    WHERE TRIM(rf.rdb$relation_name) = 'AC_ENTRY'
      AND rf.rdb$field_name STARTING WITH 'USR$'
    ORDER BY 1
  `);
  const topAliases = await q(`
    SELECT FIRST 40 TRIM(alias) AS alias, TRIM(name) AS name, TRIM(accounttype) AS accounttype
    FROM ac_account
    WHERE accounttype IN ('A', 'S')
      AND alias IS NOT NULL
    ORDER BY alias
  `);
  const docTypes = await q(`
    SELECT FIRST 30
      dt.id,
      TRIM(dt.name) AS name,
      (SELECT COUNT(*) FROM gd_document d WHERE d.documenttypekey = dt.id) AS docs
    FROM gd_documenttype dt
    ORDER BY 3 DESC
  `);
  const tx = await q(`
    SELECT FIRST 25
      t.id,
      TRIM(t.name) AS name,
      (SELECT COUNT(*) FROM ac_record r WHERE r.transactionkey = t.id) AS records
    FROM ac_transaction t
    ORDER BY 3 DESC
  `);

  const out = {
    label: label ?? dbPath,
    engine: cell(version[0], 'v'),
    counts: counts[0],
    span: span[0],
    charts,
    byType,
    companyCount: companies.length,
    companies: companies.slice(0, 40),
    analytics,
    analyticsOnBothTables: usedAnalytics.map((r) => cell(r, 'fieldname')),
    topAliases,
    docTypes,
    transactions: tx,
  };
  console.log(JSON.stringify(out, null, 2));
} finally {
  await db.dispose();
}
