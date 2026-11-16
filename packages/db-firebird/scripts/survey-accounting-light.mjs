/**
 * Lightweight accounting-shape survey. Prints one JSON object.
 * Usage: node survey-accounting-light.mjs <port> <fdb> <label>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbServices, loadFirebirdConfig } from '../dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const [, , port, dbPath, label, outPath] = process.argv;
process.env.NODE_FB_HOST = 'localhost';
process.env.NODE_FB_PORT = port;
process.env.NODE_FB_DB = dbPath;
process.env.FIREBIRD_MAX_ROWS = '8000';
process.env.FIREBIRD_QUERY_TIMEOUT_MS = '180000';
process.env.FIREBIRD_MIN_ENGINE_MAJOR = '5';

const db = createDbServices(loadFirebirdConfig());

async function q(name, sql) {
  try {
    const rows = (await db.executeSql.run(sql)).rows;
    return { name, ok: true, rows };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    };
  }
}

const sections = [];
try {
  sections.push(
    await q(
      'engine',
      `SELECT TRIM(rdb$get_context('SYSTEM', 'ENGINE_VERSION')) AS v FROM rdb$database`
    )
  );
  sections.push(
    await q(
      'charts',
      `SELECT a.id, TRIM(a.alias) AS alias, TRIM(a.name) AS name, a.lb, a.rb
       FROM ac_account a WHERE a.accounttype = 'C' ORDER BY a.id`
    )
  );
  sections.push(
    await q(
      'byType',
      `SELECT TRIM(accounttype) AS accounttype, COUNT(*) AS c
       FROM ac_account GROUP BY 1 ORDER BY 1`
    )
  );
  sections.push(
    await q(
      'companies',
      `SELECT FIRST 60
         ca.companykey, TRIM(c.name) AS company_name,
         TRIM(a.alias) AS chart_alias, ca.isactive
       FROM ac_companyaccount ca
       JOIN gd_contact c ON c.id = ca.companykey
       JOIN ac_account a ON a.id = ca.accountkey
       ORDER BY ca.isactive DESC, c.name`
    )
  );
  sections.push(
    await q(
      'analytics',
      `SELECT TRIM(arf.fieldname) AS fieldname, TRIM(arf.lname) AS lname,
              TRIM(af.reftable) AS reftable
       FROM at_relation_fields arf
       LEFT JOIN at_fields af ON TRIM(af.fieldname) = TRIM(arf.fieldsource)
       WHERE TRIM(arf.relationname) = 'AC_ENTRY'
         AND arf.fieldname STARTING WITH 'USR$'
       ORDER BY 1`
    )
  );
  sections.push(
    await q(
      'settlementAliases',
      `SELECT TRIM(a.alias) AS alias, TRIM(a.name) AS name,
              TRIM(a.accounttype) AS accounttype, TRIM(a.activity) AS activity,
              a.offbalance, a.multycurr, TRIM(root.alias) AS chart
       FROM ac_account a
       JOIN ac_account root ON a.lb > root.lb AND a.rb < root.rb AND root.accounttype = 'C'
       WHERE a.accounttype IN ('A', 'S')
         AND (
           TRIM(a.alias) STARTING WITH '60'
           OR TRIM(a.alias) STARTING WITH '62'
           OR TRIM(a.alias) STARTING WITH '90'
           OR TRIM(a.alias) STARTING WITH '51'
           OR UPPER(a.name) CONTAINING 'ПОКУПАТ'
           OR UPPER(a.name) CONTAINING 'ПОСТАВЩ'
           OR UPPER(a.name) CONTAINING 'РЕАЛИЗ'
         )
       ORDER BY root.alias, a.alias`
    )
  );
  sections.push(
    await q(
      'span',
      `SELECT MIN(entrydate) AS dmin, MAX(entrydate) AS dmax,
              COUNT(*) AS entries
       FROM ac_entry`
    )
  );
  sections.push(
    await q(
      'docTypeCount',
      `SELECT COUNT(*) AS doctypes FROM gd_documenttype`
    )
  );
  sections.push(
    await q(
      'docTypeSample',
      `SELECT FIRST 40 dt.id, TRIM(dt.name) AS name
       FROM gd_documenttype dt
       ORDER BY dt.name`
    )
  );
  const json = JSON.stringify({ label: label ?? dbPath, sections }, null, 2);
  if (outPath) writeFileSync(outPath, json);
  else process.stdout.write(json);
} finally {
  try {
    await db.dispose();
  } catch {
    /* connection may already be closing */
  }
}
