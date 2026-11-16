/**
 * Installs MCP.Worker.API VBScript handlers into CRM_WORKER.FDB
 * (direct GD_FUNCTION insert — avoids interactive namespace UI for stage 0).
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MCP_FUNCTION_IDS as IDS } from './namespace-ids.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const nsDir = resolve(repoRoot, 'packages/report-worker/namespace');

/** Bake GEDEMIN_WORKER_TOKEN into VBS (placeholder {{MCP_WORKER_TOKEN}}). */
function bakeWorkerToken(script, env) {
  const raw =
    env.GEDEMIN_WORKER_TOKEN?.trim() ||
    env.MCP_API_KEY?.trim() ||
    'mcp-worker-dev';
  const escaped = raw.replace(/"/g, '""');
  if (!script.includes('{{MCP_WORKER_TOKEN}}')) {
    throw new Error('script missing {{MCP_WORKER_TOKEN}} placeholder');
  }
  return script.replaceAll('{{MCP_WORKER_TOKEN}}', escaped);
}

function loadEnv() {
  const env = { ...process.env };
  for (const line of readFileSync(resolve(repoRoot, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim();
  }
  return env;
}

function extractScript(yaml, name) {
  const marker = `NAME: "${name}"`;
  const i = yaml.indexOf(marker);
  if (i < 0) throw new Error(`function ${name} not found in YAML`);
  // Must not match DISPLAYSCRIPT: |
  const re = /\n      SCRIPT: \|/;
  const m = re.exec(yaml.slice(i));
  if (!m) throw new Error(`SCRIPT for ${name} not found`);
  const start = i + m.index + m[0].length;
  const rest = yaml.slice(start);
  const lines = rest.split(/\r?\n/);
  const body = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (/^      [A-Z]/.test(line) || /^    Set:/.test(line) || /^  -/.test(line)) {
      break;
    }
    if (line.startsWith('        ')) {
      body.push(line.slice(8));
    } else if (line.trim() === '') {
      body.push('');
    } else {
      break;
    }
  }
  return body.join('\n').replace(/\n+$/, '\n');
}

const WEB_HANDLER_PARAMS_FROM_YAML = Buffer.from(
  `U0xQUlBSU1QJAAAAQ09NUE9ORU5UCQAAAENPTVBPTkVOVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AABGTlNUUFJTVAYAAABQQVJBTVMGAAAAUEFSQU1TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEZO
U1RQUlNUCgAAAFJFU1BPTlNFTk8KAAAAUkVTUE9OU0VOTwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AABGTlNUUFJTVAsAAABDT05URU5UVEVYVAsAAABDT05URU5UVEVYVAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAABGTlNUUFJTVAoAAABGT1JNUEFSQU1TCgAAAEZPUk1QQVJBTVMAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAARk5TVEZMUFI=`.replace(/\s+/g, ''),
  'base64'
);

async function main() {
  const env = loadEnv();
  const yaml = readFileSync(resolve(nsDir, 'MCP.Worker.API.yml'), 'utf8');
  const scriptFile = (name) =>
    readFileSync(resolve(nsDir, `scripts/${name}.vbs`), 'utf8').replace(/\r\n/g, '\n');
  const scripts = {
    mcp_JsonEscape: extractScript(yaml, 'mcp_JsonEscape'),
    mcp_trial_balance: bakeWorkerToken(extractScript(yaml, 'mcp_trial_balance'), env),
    mcp_web_handlers: extractScript(yaml, 'mcp_web_handlers'),
    mcp_RegisterHandlers: extractScript(yaml, 'mcp_RegisterHandlers'),
    mcp_account_card: bakeWorkerToken(scriptFile('mcp_account_card'), env),
    mcp_account_review: bakeWorkerToken(scriptFile('mcp_account_review'), env),
    mcp_journal_order: bakeWorkerToken(scriptFile('mcp_journal_order'), env),
    mcp_run_report_config: bakeWorkerToken(scriptFile('mcp_run_report_config'), env),
  };
  console.log(
    'worker token baked from',
    env.GEDEMIN_WORKER_TOKEN
      ? 'GEDEMIN_WORKER_TOKEN'
      : env.MCP_API_KEY
        ? 'MCP_API_KEY'
        : 'default mcp-worker-dev'
  );

  for (const [k, v] of Object.entries(scripts)) {
    if (!v.includes('Function ') && !v.includes('Sub ') && !v.includes('Public ')) {
      throw new Error(`Extracted empty/invalid script for ${k}: ${JSON.stringify(v.slice(0, 80))}`);
    }
    console.log(`script ${k}: ${v.length} chars`);
  }

  const tmpSql = resolve(nsDir, '_install_tmp.sql');
  const toHex = (s) => Buffer.from(s, 'utf8').toString('hex').toUpperCase();
  const paramsHex = WEB_HANDLER_PARAMS_FROM_YAML.toString('hex').toUpperCase();

  const sql = `
SET NAMES UTF8;
DELETE FROM rp_additionalfunction WHERE mainfunctionkey IN (${IDS.webHandlers}, ${IDS.trialBalance}, ${IDS.accountCard}, ${IDS.accountReview}, ${IDS.journalOrder}, ${IDS.runReportConfig}) OR addfunctionkey IN (${IDS.jsonEscape}, ${IDS.trialBalance}, ${IDS.accountCard}, ${IDS.accountReview}, ${IDS.journalOrder}, ${IDS.runReportConfig});
DELETE FROM evt_macroslist WHERE functionkey = ${IDS.registerHandlers} OR UPPER(name)='MCP_REGISTERHANDLERS';
DELETE FROM gd_function WHERE id IN (${IDS.jsonEscape}, ${IDS.trialBalance}, ${IDS.webHandlers}, ${IDS.registerHandlers}, ${IDS.accountCard}, ${IDS.accountReview}, ${IDS.journalOrder}, ${IDS.runReportConfig});
DELETE FROM gd_function WHERE UPPER(name) IN ('MCP_JSONESCAPE','MCP_TRIAL_BALANCE','MCP_WEB_HANDLERS','MCP_REGISTERHANDLERS','MCP_ACCOUNT_CARD','MCP_ACCOUNT_REVIEW','MCP_JOURNAL_ORDER','MCP_RUN_REPORT_CONFIG');

INSERT INTO gd_function (id, module, language, name, script, displayscript, modulecode, publicfunction, enteredparams, inheritedrule, usedebuginfo, afull, aview, achag)
VALUES (${IDS.jsonEscape}, 'UNKNOWN', 'VBScript', 'mcp_JsonEscape',
  x'${toHex(scripts.mcp_JsonEscape)}',
  'MCP_JSONESCAPE', 1010001, 1, NULL, 0, 0, -1, -1, -1);

INSERT INTO gd_function (id, module, language, name, script, displayscript, modulecode, publicfunction, enteredparams, inheritedrule, usedebuginfo, afull, aview, achag)
VALUES (${IDS.trialBalance}, 'UNKNOWN', 'VBScript', 'mcp_trial_balance',
  x'${toHex(scripts.mcp_trial_balance)}',
  'MCP_TRIAL_BALANCE', 1010001, 1, x'${paramsHex}', 0, 0, -1, -1, -1);

INSERT INTO gd_function (id, module, language, name, script, displayscript, modulecode, publicfunction, enteredparams, inheritedrule, usedebuginfo, afull, aview, achag)
VALUES (${IDS.accountCard}, 'UNKNOWN', 'VBScript', 'mcp_account_card',
  x'${toHex(scripts.mcp_account_card)}',
  'MCP_ACCOUNT_CARD', 1010001, 1, x'${paramsHex}', 0, 0, -1, -1, -1);

INSERT INTO gd_function (id, module, language, name, script, displayscript, modulecode, publicfunction, enteredparams, inheritedrule, usedebuginfo, afull, aview, achag)
VALUES (${IDS.accountReview}, 'UNKNOWN', 'VBScript', 'mcp_account_review',
  x'${toHex(scripts.mcp_account_review)}',
  'MCP_ACCOUNT_REVIEW', 1010001, 1, x'${paramsHex}', 0, 0, -1, -1, -1);

INSERT INTO gd_function (id, module, language, name, script, displayscript, modulecode, publicfunction, enteredparams, inheritedrule, usedebuginfo, afull, aview, achag)
VALUES (${IDS.journalOrder}, 'UNKNOWN', 'VBScript', 'mcp_journal_order',
  x'${toHex(scripts.mcp_journal_order)}',
  'MCP_JOURNAL_ORDER', 1010001, 1, x'${paramsHex}', 0, 0, -1, -1, -1);

INSERT INTO gd_function (id, module, language, name, script, displayscript, modulecode, publicfunction, enteredparams, inheritedrule, usedebuginfo, afull, aview, achag)
VALUES (${IDS.runReportConfig}, 'UNKNOWN', 'VBScript', 'mcp_run_report_config',
  x'${toHex(scripts.mcp_run_report_config)}',
  'MCP_RUN_REPORT_CONFIG', 1010001, 1, x'${paramsHex}', 0, 0, -1, -1, -1);

INSERT INTO gd_function (id, module, language, name, script, displayscript, modulecode, publicfunction, enteredparams, inheritedrule, usedebuginfo, afull, aview, achag)
VALUES (${IDS.webHandlers}, 'GLOBALOBJECT', 'VBScript', 'mcp_web_handlers',
  x'${toHex(scripts.mcp_web_handlers)}',
  x'${toHex('MCP_WEB_HANDLERS_INITIALIZE\r\nMCP_WEB_HANDLERS_TERMINATE\n')}',
  1010001, 1, NULL, 0, 0, -1, -1, -1);

INSERT INTO gd_function (id, module, language, name, script, displayscript, modulecode, publicfunction, enteredparams, inheritedrule, usedebuginfo, afull, aview, achag)
VALUES (${IDS.registerHandlers}, 'MACROS', 'VBScript', 'mcp_RegisterHandlers',
  x'${toHex(scripts.mcp_RegisterHandlers)}',
  'MCP_REGISTERHANDLERS', 1010001, 1, NULL, 0, 0, -1, -1, -1);

INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.webHandlers}, ${IDS.jsonEscape});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.webHandlers}, ${IDS.trialBalance});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.webHandlers}, ${IDS.accountCard});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.webHandlers}, ${IDS.accountReview});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.webHandlers}, ${IDS.journalOrder});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.webHandlers}, ${IDS.runReportConfig});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.trialBalance}, ${IDS.jsonEscape});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.accountCard}, ${IDS.jsonEscape});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.accountReview}, ${IDS.jsonEscape});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.journalOrder}, ${IDS.jsonEscape});
INSERT INTO rp_additionalfunction (mainfunctionkey, addfunctionkey)
VALUES (${IDS.runReportConfig}, ${IDS.jsonEscape});

COMMIT;
SELECT id, name, module FROM gd_function WHERE id IN (${IDS.jsonEscape}, ${IDS.trialBalance}, ${IDS.webHandlers}, ${IDS.registerHandlers}, ${IDS.accountCard}, ${IDS.accountReview}, ${IDS.journalOrder}, ${IDS.runReportConfig});
EXIT;
`;

  writeFileSync(tmpSql, sql, 'ascii');

  // Also try to insert RUNONLOGIN macros via a second statement file after discovering table name
  const isql = 'D:\\Soft\\Firebird\\Firebird_5_0\\isql.exe';
  const host = env.NODE_FB_HOST || '127.0.0.1';
  const port = env.NODE_FB_PORT || '3055';
  const database = env.NODE_FB_DB;
  if (!database) {
    console.error('NODE_FB_DB missing — refuse to install namespace into an unknown database');
    process.exit(1);
  }
  const db = `${host}/${port}:${database}`;
  const user = env.ISC_USER || 'SYSDBA';
  const password = env.ISC_PASSWORD || 'masterkey';
  console.log('install namespace into', db);

  const r = spawnSync(isql, ['-user', user, '-password', password, db, '-i', tmpSql], {
    encoding: 'utf8',
    maxBuffer: 10_000_000,
  });
  console.log(r.stdout || '');
  if (r.stderr) console.error(r.stderr);
  if (r.status !== 0) {
    console.error('isql exit', r.status);
    process.exit(r.status || 1);
  }

  // Macros table varies by version — probe and insert RUNONLOGIN
  const macSqlPath = resolve(nsDir, '_macros_tmp.sql');
  const macSql = `
SET NAMES UTF8;
SELECT rdb$relation_name FROM rdb$relations WHERE TRIM(rdb$relation_name) IN ('GD_MACROS','EVT_MACROSLIST','RP_MACROS');
EXIT;
`;
  writeFileSync(macSqlPath, macSql, 'ascii');
  const r2 = spawnSync(isql, ['-user', user, '-password', password, db, '-i', macSqlPath], {
    encoding: 'utf8',
  });
  console.log('macros tables:', r2.stdout);

  if (/EVT_MACROSLIST/i.test(r2.stdout || '')) {
    const macIns = `
SET NAMES UTF8;
DELETE FROM evt_macroslist WHERE UPPER(name)='MCP_REGISTERHANDLERS' OR functionkey=${IDS.registerHandlers};
INSERT INTO evt_macroslist (id, macrosgroupkey, functionkey, name, islocalexecute, isrebuild, shortcut, displayinmenu, runonlogin, afull, aview, achag)
VALUES (
  ${IDS.registerHandlers + 1},
  (SELECT macrosgroupkey FROM evt_macroslist WHERE id=258746374),
  ${IDS.registerHandlers},
  'mcp_RegisterHandlers',
  0, 0, 0, 0, 1, -1, -1, -1
);
COMMIT;
SELECT id, name, runonlogin, functionkey FROM evt_macroslist WHERE functionkey=${IDS.registerHandlers};
EXIT;
`;
    writeFileSync(macSqlPath, macIns, 'ascii');
    const r3 = spawnSync(isql, ['-user', user, '-password', password, db, '-i', macSqlPath], {
      encoding: 'utf8',
    });
    console.log(r3.stdout || '');
    if (r3.stderr) console.error(r3.stderr);
    if (r3.status !== 0) {
      console.warn('macros insert failed (GLOBALOBJECT init may still register handlers)');
    }
  }

  try {
    unlinkSync(tmpSql);
    unlinkSync(macSqlPath);
  } catch {
    /* ignore */
  }
  console.log('install done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
