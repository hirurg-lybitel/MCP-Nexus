import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const { createDbServices, loadFirebirdConfig, disposeDbServices, FirebirdUnsupportedEngineError } =
  await import(pathToFileURL(resolve(root, 'packages/db-firebird/src/index.ts')).href);

async function probe(label, overrides) {
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  // reset singleton
  await disposeDbServices();
  const config = loadFirebirdConfig();
  if (!config) {
    console.log(label, 'NO_CONFIG');
    return;
  }
  const db = createDbServices(config);
  try {
    const r = await db.executeSql.run(
      `SELECT TRIM(rdb$get_context('SYSTEM', 'ENGINE_VERSION')) AS v FROM rdb$database`
    );
    console.log(label, 'OK', r.rows[0]);
  } catch (e) {
    const name = e?.constructor?.name || 'Error';
    console.log(label, name, e instanceof Error ? e.message.slice(0, 200) : e);
  } finally {
    await db.dispose();
    await disposeDbServices();
  }
}

await probe('fb5', {
  NODE_FB_HOST: 'localhost',
  NODE_FB_PORT: '3055',
  NODE_FB_DB: 'D:\\Soft\\gedemin\\Databases\\CRM_FB5.FDB',
});

await probe('fb25', {
  NODE_FB_HOST: 'localhost',
  NODE_FB_PORT: '3052',
  NODE_FB_DB: 'D:\\Soft\\gedemin\\Databases\\CRM.FDB',
});
