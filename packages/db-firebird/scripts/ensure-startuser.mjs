/**
 * Ensure Firebird security user STARTUSER exists (both plugins on FB5)
 * and GRANT ALTER ANY SEQUENCE — required for Gedemin /Q without interactive SYSDBA prompt.
 *
 * Password defaults to platform-conventional "startuser" (override GEDEMIN_STARTUSER_PASSWORD).
 * Does not print the password. Uses ISC_* + NODE_FB_* from repo .env.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNativeClient, getDefaultLibraryFilename } from 'node-firebird-driver-native';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const envPath = resolve(root, '.env');

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = readEnv(envPath);
const host = env.NODE_FB_HOST || 'localhost';
const port = env.NODE_FB_PORT || '3055';
const dbPath = env.NODE_FB_DB;
if (!dbPath) throw new Error('NODE_FB_DB missing in .env');

const startPass = env.GEDEMIN_STARTUSER_PASSWORD || 'startuser';
const uri = `${host}/${port}:${dbPath}`;
const client = createNativeClient(getDefaultLibraryFilename());
const msg = (e) => String(e?.message ?? e).replace(/\n/g, ' | ');

const att = await client.connect(uri, {
  username: env.ISC_USER || 'SYSDBA',
  password: env.ISC_PASSWORD,
});

try {
  for (const plugin of [
    ' USING PLUGIN Legacy_UserManager',
    ' USING PLUGIN Srp',
  ]) {
    const tr = await att.startTransaction();
    try {
      await att.execute(
        tr,
        `CREATE USER STARTUSER PASSWORD '${startPass}'${plugin}`
      );
      await tr.commit();
      console.log(`CREATE USER STARTUSER ok${plugin}`);
    } catch (e) {
      await tr.rollback();
      const m = msg(e);
      if (/already exists|SQLSTATE = 28000/i.test(m)) {
        console.log(`STARTUSER already exists${plugin}`);
      } else {
        console.log(`CREATE USER STARTUSER${plugin}: ${m.slice(0, 200)}`);
      }
    }
  }

  const tr2 = await att.startTransaction();
  try {
    await att.execute(tr2, `GRANT ALTER ANY SEQUENCE TO STARTUSER`);
    await tr2.commit();
    console.log('GRANT ALTER ANY SEQUENCE TO STARTUSER ok');
  } catch (e) {
    await tr2.rollback();
    console.log(`GRANT: ${msg(e).slice(0, 200)}`);
  }

  // Probe login as STARTUSER (password not printed)
  try {
    const a2 = await client.connect(uri, {
      username: 'STARTUSER',
      password: startPass,
    });
    await a2.disconnect();
    console.log('STARTUSER login probe ok');
  } catch (e) {
    console.log(`STARTUSER login FAILED: ${msg(e).slice(0, 200)}`);
    process.exitCode = 1;
  }
} finally {
  await att.disconnect();
}
