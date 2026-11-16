/**
 * Create Gedemin + Firebird user mcp_worker in the connected NODE_FB_DB (BG).
 * Reuses GEDEMIN_WORKER_* from .env when present. Does not print secrets.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
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

function setEnvKey(key, value) {
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (line.match(new RegExp(`^\\s*${key}\\s*=`))) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  writeFileSync(envPath, next.join('\n').replace(/\n+$/, '\n'));
}

const rnd = (len, firstLetter) => {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += abc[randomInt(i === 0 && firstLetter ? 26 : 36)];
  }
  return s;
};

const mixed = (len) => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => abc[randomInt(abc.length)]).join('');
};

const env = readEnv(envPath);
const dbPath = env.NODE_FB_DB;
const port = env.NODE_FB_PORT || '3055';
const host = env.NODE_FB_HOST || 'localhost';
if (!dbPath) throw new Error('NODE_FB_DB missing');

const userName = 'mcp_worker';
const pass = env.GEDEMIN_WORKER_PASSWORD || mixed(16);
const ibname = env.GEDEMIN_WORKER_IBNAME || rnd(8, true);
const ibpass = env.GEDEMIN_WORKER_IBPASSWORD || rnd(8, false);

setEnvKey('GEDEMIN_WORKER_USER', userName);
setEnvKey('GEDEMIN_WORKER_PASSWORD', pass);
setEnvKey('GEDEMIN_WORKER_IBNAME', ibname);
setEnvKey('GEDEMIN_WORKER_IBPASSWORD', ibpass);
setEnvKey('GEDEMIN_WORKER_SN', `localhost/${port}:${dbPath}`);
setEnvKey('GEDEMIN_WORKER_DB_ALIAS', 'BG_NEW_FB5');

const uri = `${host}/${port}:${dbPath}`;
const client = createNativeClient(getDefaultLibraryFilename());
const msg = (e) => String(e?.message ?? e).replace(/\n/g, ' | ');

async function firstRow(attachment, transaction, sql, params = []) {
  const rs = await attachment.executeQuery(transaction, sql, params);
  try {
    const rows = await rs.fetchAsObject();
    return rows[0] ?? null;
  } finally {
    await rs.close();
  }
}

const att = await client.connect(uri, {
  username: env.ISC_USER || 'SYSDBA',
  password: env.ISC_PASSWORD,
});

try {
  let tr = await att.startTransaction();
  const company = await firstRow(
    att,
    tr,
    `SELECT FIRST 1 ca.companykey AS id, c.name AS name
     FROM ac_companyaccount ca
     JOIN gd_contact c ON c.id = ca.companykey
     WHERE ca.isactive = 1
     ORDER BY c.name`
  );
  if (!company?.ID) throw new Error('No active company in AC_COMPANYACCOUNT');

  // On BelGISS charts users hang under department folders (contacttype 4),
  // not under a CRM-style "Contacts" folder (type 1).
  let parent = await firstRow(
    att,
    tr,
    `SELECT FIRST 1 p.id
     FROM gd_user u
     JOIN gd_contact c ON c.id = u.contactkey
     JOIN gd_contact p ON p.id = c.parent
     WHERE p.contacttype = 4
     ORDER BY p.id`
  );
  if (!parent?.ID) {
    parent = await firstRow(
      att,
      tr,
      `SELECT FIRST 1 id FROM gd_contact WHERE contacttype = 4 ORDER BY id`
    );
  }
  if (!parent?.ID) throw new Error('No contact folder for parent');

  const existing = await firstRow(
    att,
    tr,
    `SELECT id FROM gd_user WHERE UPPER(name) = UPPER(?)`,
    [userName]
  );

  let userId;
  let contactId;
  if (existing?.ID) {
    userId = existing.ID;
    console.log(`gd_user exists id=${userId}`);
    await att.execute(
      tr,
      `UPDATE gd_user SET passw = ?, ibname = ?, ibpassword = ?, disabled = 0, lockedout = 0 WHERE id = ?`,
      [pass, ibname, ibpass, userId]
    );
    const uc = await firstRow(
      att,
      tr,
      `SELECT companykey FROM gd_usercompany WHERE userkey = ?`,
      [userId]
    );
    if (!uc?.COMPANYKEY) {
      await att.execute(
        tr,
        `INSERT INTO gd_usercompany (userkey, companykey) VALUES (?, ?)`,
        [userId, company.ID]
      );
    } else if (Number(uc.COMPANYKEY) !== Number(company.ID)) {
      await att.execute(
        tr,
        `UPDATE gd_usercompany SET companykey = ? WHERE userkey = ?`,
        [company.ID, userId]
      );
    }
  } else {
    const c = await att.executeReturningAsObject(
      tr,
      `INSERT INTO gd_contact (parent, contacttype, name) VALUES (?, 2, 'MCP Worker') RETURNING id`,
      [parent.ID]
    );
    contactId = c.ID;
    await att.execute(
      tr,
      `INSERT INTO gd_people (contactkey, surname, firstname) VALUES (?, 'MCP', 'Worker')`,
      [contactId]
    );
    const u = await att.executeReturningAsObject(
      tr,
      `INSERT INTO gd_user (
         name, passw, ingroup, fullname, description, contactkey,
         disabled, lockedout, mustchange, cantchangepassw, passwneverexp, allowaudit,
         ibname, ibpassword
       ) VALUES (?, ?, 4, 'MCP Worker', 'MCP report worker (non-admin Users group).', ?, 0, 0, 0, 1, 1, 0, ?, ?)
       RETURNING id`,
      [userName, pass, contactId, ibname, ibpass]
    );
    userId = u.ID;
    await att.execute(
      tr,
      `INSERT INTO gd_usercompany (userkey, companykey) VALUES (?, ?)`,
      [userId, company.ID]
    );
    console.log(`created gd_contact=${contactId} gd_user=${userId}`);
  }

  // Users group (bit 4) needs AFULL on working company
  const oc = await firstRow(
    att,
    tr,
    `SELECT companykey, afull FROM gd_ourcompany WHERE companykey = ?`,
    [company.ID]
  );
  if (oc?.COMPANYKEY != null) {
    const afull = Number(oc.AFULL ?? 0);
    const withUsers = afull | 4;
    if (withUsers !== afull) {
      await att.execute(
        tr,
        `UPDATE gd_ourcompany SET afull = ? WHERE companykey = ?`,
        [withUsers, company.ID]
      );
      console.log(`GD_OURCOMPANY.AFULL ${afull} -> ${withUsers}`);
    } else {
      console.log(`GD_OURCOMPANY.AFULL already has Users bit (${afull})`);
    }
  } else {
    console.log('WARN: company not in GD_OURCOMPANY');
  }

  await tr.commit();

  for (const plugin of [
    ' USING PLUGIN Legacy_UserManager',
    ' USING PLUGIN Srp',
  ]) {
    const tr2 = await att.startTransaction();
    try {
      await att.execute(
        tr2,
        `CREATE USER ${ibname} PASSWORD '${ibpass}'${plugin}`
      );
      await tr2.commit();
      console.log(`CREATE USER ok${plugin}`);
    } catch (e) {
      await tr2.rollback();
      console.log(`CREATE USER${plugin}: ${msg(e).slice(0, 180)}`);
    }
  }

  const tr3 = await att.startTransaction();
  try {
    await att.execute(
      tr3,
      `GRANT ADMINISTRATOR TO ${ibname} WITH ADMIN OPTION`
    );
    await tr3.commit();
    console.log('GRANT ADMINISTRATOR ok');
  } catch (e) {
    await tr3.rollback();
    console.log(`GRANT: ${msg(e).slice(0, 180)}`);
  }

  console.log(
    JSON.stringify({
      company: { id: Number(company.ID), name: String(company.NAME) },
      parentFolder: Number(parent.ID),
      userId: Number(userId),
    })
  );

  // Login probe via GD_P_SEC_LOGINUSER (needs ACCESS_VERSION like Gedemin client)
  const tr4 = await att.startTransaction({ accessMode: 'READ_ONLY' });
  try {
    await att.execute(
      tr4,
      `SELECT rdb$set_context('USER_SESSION', 'ACCESS_VERSION', 'DESKTOP_1') FROM rdb$database`
    );
    const login = await att.executeReturningAsObject(
      tr4,
      `EXECUTE PROCEDURE gd_p_sec_loginuser(?, ?, NULL)`,
      [userName, pass]
    );
    console.log(
      JSON.stringify({
        loginResult: Number(login.RESULT),
        loginUserKey: Number(login.USERKEY),
        loginIngroup: Number(login.INGROUP),
        ibnameMatch: String(login.IBNAME || '').trim() === ibname,
      })
    );
  } catch (e) {
    console.log(`GD_P_SEC_LOGINUSER: ${msg(e).slice(0, 240)}`);
  } finally {
    await tr4.commit();
  }

  try {
    const a2 = await client.connect(uri, {
      username: ibname,
      password: ibpass,
      role: 'ADMINISTRATOR',
    });
    const tr5 = await a2.startTransaction({ accessMode: 'READ_ONLY' });
    const r = await firstRow(
      a2,
      tr5,
      `SELECT CURRENT_USER AS u, CURRENT_ROLE AS r FROM rdb$database`
    );
    console.log(
      `IB login ok user=${String(r.U).trim()} role=${String(r.R).trim()}`
    );
    await tr5.commit();
    await a2.disconnect();
  } catch (e) {
    console.log(`IB login FAILED: ${msg(e).slice(0, 200)}`);
    process.exitCode = 1;
  }
} finally {
  await att.disconnect();
  await client.dispose();
}
