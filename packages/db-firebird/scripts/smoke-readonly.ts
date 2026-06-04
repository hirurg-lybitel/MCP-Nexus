import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createDbServices,
  disposeDbServices,
  loadFirebirdConfig,
} from '../src/index.ts';

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const envFile =
  process.env.FIREBIRD_ENV_FILE ??
  resolve(process.cwd(), '../../apps/web/.env');

loadEnvFile(envFile);

async function main() {
  const config = loadFirebirdConfig();
  if (!config) {
    console.error('Firebird config missing. Set NODE_FB_* and ISC_* or FIREBIRD_ENV_FILE.');
    process.exit(1);
  }

  const db = createDbServices(config);

  try {
    const tables = await db.listTables.run();
    console.log(`list_tables: ${tables.length} tables`);

    if (tables.length > 0) {
      const first = tables[0]!.tableName;
      const described = await db.describeTable.run(first);
      console.log(
        `describe_table(${first}): ${described.columns.length} columns`,
        described.tableDisplayName
          ? `(display: ${described.tableDisplayName})`
          : ''
      );
      const withLabel = described.columns.find((c) => c.displayName);
      if (withLabel) {
        console.log(`  e.g. ${withLabel.fieldName} → ${withLabel.displayName}`);
      }
    }

    const query = await db.executeSql.run(
      'SELECT 1 AS ONE FROM RDB$DATABASE'
    );
    console.log(`execute_sql: rowCount=${query.rowCount}`, query.rows[0]);
  } finally {
    await disposeDbServices();
  }
}

main().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});
