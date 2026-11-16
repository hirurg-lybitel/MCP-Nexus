import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNativeClient, getDefaultLibraryFilename } from 'node-firebird-driver-native';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const env = {};
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const client = createNativeClient(getDefaultLibraryFilename());
const uri = `${env.NODE_FB_HOST}/${env.NODE_FB_PORT}:${env.NODE_FB_DB}`;
const att = await client.connect(uri, {
  username: env.ISC_USER || 'SYSDBA',
  password: env.ISC_PASSWORD,
});
const tr = await att.startTransaction({ accessMode: 'READ_ONLY' });

async function q(sql) {
  const rs = await att.executeQuery(tr, sql);
  const rows = await rs.fetchAsObject();
  await rs.close();
  return rows;
}

console.log(
  'companies',
  await q(`SELECT FIRST 3 ca.companykey, c.name FROM ac_companyaccount ca JOIN gd_contact c ON c.id = ca.companykey WHERE ca.isactive=1`)
);
console.log(
  'contacttype counts',
  await q(`SELECT contacttype, COUNT(*) AS c FROM gd_contact GROUP BY 1 ORDER BY 2 DESC`)
);
console.log(
  'user parents',
  await q(`SELECT FIRST 10 p.id, p.name, p.contacttype, COUNT(*) AS users
           FROM gd_user u
           JOIN gd_contact c ON c.id = u.contactkey
           JOIN gd_contact p ON p.id = c.parent
           GROUP BY p.id, p.name, p.contacttype
           ORDER BY 4 DESC`)
);
console.log(
  'folders sample',
  await q(`SELECT FIRST 15 id, name, contacttype FROM gd_contact WHERE contacttype IN (0,1,3,4) ORDER BY id`)
);

await tr.commit();
await att.disconnect();
await client.dispose();
