/**
 * 1.4 starter: dump table list + document-type header/line relations from AT_* / GD_DOCUMENTTYPE.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
}
// Prefer local CRM_WORKER for catalog
process.env.NODE_FB_HOST = process.env.NODE_FB_HOST || '127.0.0.1';
process.env.NODE_FB_PORT = process.env.NODE_FB_PORT || '3052';
process.env.NODE_FB_DB =
  process.env.SCHEMA_CATALOG_DB ||
  'D:\\Soft\\gedemin\\Databases\\CRM_WORKER.FDB';

const {
  createDbServices,
  disposeDbServices,
  loadFirebirdConfig,
} = await import('../../db-firebird/src/index.ts');

const config = loadFirebirdConfig();
if (!config) {
  console.error('Firebird config missing');
  process.exit(1);
}

const db = createDbServices(config);
try {
  const tables = await db.listTables.run();
  const docTypes = await db.executeSql.run(`
SELECT FIRST 100
  dt.id,
  dt.name,
  dt.headerrelkey,
  dt.linerelkey,
  hr.relationname AS header_table,
  lr.relationname AS line_table
FROM gd_documenttype dt
LEFT JOIN at_relations hr ON hr.id = dt.headerrelkey
LEFT JOIN at_relations lr ON lr.id = dt.linerelkey
ORDER BY dt.name
`);

  const usrFields = await db.executeSql.run(`
SELECT FIRST 80
  TRIM(arf.fieldname) AS fieldname,
  TRIM(arf.relationname) AS relationname,
  arf.lname
FROM at_relation_fields arf
WHERE UPPER(TRIM(arf.relationname)) = 'AC_ENTRY'
  AND UPPER(TRIM(arf.fieldname)) STARTING WITH 'USR$'
ORDER BY 1
`);

  const catalog = {
    generatedAt: new Date().toISOString(),
    tableCount: tables.length,
    tables: tables.slice(0, 500),
    documentTypes: docTypes.rows,
    acEntryUsrAnalytics: usrFields.rows,
  };

  const out = resolve(root, 'docs/specs/001-mcp-server-v2/schema-catalog.json');
  writeFileSync(out, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        out,
        tableCount: tables.length,
        documentTypes: docTypes.rowCount,
        acEntryUsr: usrFields.rowCount,
      },
      null,
      2
    )
  );
} finally {
  await disposeDbServices();
}
