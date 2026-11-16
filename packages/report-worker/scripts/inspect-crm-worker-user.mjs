/**
 * Read mcp_worker shape from CRM_FB5 (reference only). Does not print passwords.
 */
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
const attachment = await client.connect(
  `localhost/3055:${env.NODE_FB_DB?.includes('CRM') ? env.NODE_FB_DB : 'D:\\Soft\\gedemin\\Databases\\CRM_FB5.FDB'}`,
  { username: env.ISC_USER || 'SYSDBA', password: env.ISC_PASSWORD }
);
const tx = await attachment.startTransaction();
try {
  const rs = await attachment.executeQuery(
    tx,
    `SELECT u.id, u.name, u.ingroup, u.disabled, u.ibname,
            CHAR_LENGTH(u.passw) AS pass_len, CHAR_LENGTH(u.ibpassword) AS ibpass_len,
            u.contactkey, c.name AS contact_name, c.parent, c.contacttype,
            uc.companykey, oc.afull
     FROM gd_user u
     LEFT JOIN gd_contact c ON c.id = u.contactkey
     LEFT JOIN gd_usercompany uc ON uc.userkey = u.id
     LEFT JOIN gd_ourcompany oc ON oc.companykey = uc.companykey
     WHERE UPPER(u.name) = 'MCP_WORKER'`
  );
  const rows = await rs.fetchAsObject();
  await rs.close();
  console.log(JSON.stringify(rows, null, 2));

  const folder = await attachment.executeQuery(
    tx,
    `SELECT FIRST 5 id, name, contacttype FROM gd_contact
     WHERE contacttype = 1 AND UPPER(name) CONTAINING 'КОНТАКТ'
     ORDER BY id`
  );
  console.log('folders', JSON.stringify(await folder.fetchAsObject(), null, 2));
  await folder.close();
} finally {
  await tx.commit();
  await attachment.disconnect();
}
