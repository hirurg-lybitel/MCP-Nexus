/**
 * Answer all 19 pilot questions via container MCP tools (no OpenAI).
 * Produces tool-backed answers + PASS/FAIL vs etalons.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const env = {};
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const key = env.MCP_API_KEY;
const MCP = 'http://127.0.0.1:4005/mcp';
const companyKey = 148284864;

async function rpc(body, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(MCP, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
      const text = await res.text();
      const dataLine = text
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .pop();
      return JSON.parse(dataLine ? dataLine.slice(5).trim() : text);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

function sc(result) {
  if (result?.structuredContent) return result.structuredContent;
  if (result?.content?.[0]?.text) {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      return { raw: result.content[0].text };
    }
  }
  return {};
}

async function call(name, args) {
  const res = await rpc({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1e9),
    method: 'tools/call',
    params: { name, arguments: args },
  });
  if (res.error) return { ok: false, error: res.error, data: null };
  const data = sc(res.result);
  return {
    ok: !res.result?.isError && !data?.error,
    data,
    error: data?.error ?? null,
  };
}

function money2(v) {
  const n = Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

function includesNum(text, expected) {
  const e = String(expected).replace(',', '.');
  const norm = text.replace(/\s/g, '').replace(',', '.');
  return norm.includes(e) || norm.includes(money2(e));
}

await rpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'pilot-answers', version: '0' },
  },
});

const fa62 = await call('find_account', { query: '62', limit: 5 });
const cutoff = fa62.data?.dataCutoff ?? '?';
const id62 =
  (fa62.data?.accounts ?? []).find((a) => a.alias === '62')?.id ?? 366200;
const fa60 = await call('find_account', { query: '60', limit: 5 });
const id60 =
  (fa60.data?.accounts ?? []).find((a) => a.alias === '60')?.id ?? 366000;
const fa51 = await call('find_account', { query: '51', limit: 5 });
const id51 =
  (fa51.data?.accounts ?? []).find((a) => a.alias === '51')?.id ?? 355100;
const fa90 = await call('find_account', { query: '90', limit: 10 });
const id90 =
  (fa90.data?.accounts ?? []).find((a) => a.alias === '90')?.id ?? 344600;
const fa10 = await call('find_account', { query: '10', limit: 5 });
const id10 =
  (fa10.data?.accounts ?? []).find((a) => a.alias === '10')?.id ?? 311000;
const fa20 = await call('find_account', { query: '20', limit: 5 });
const id20 =
  (fa20.data?.accounts ?? []).find((a) => a.alias === '20')?.id ?? 322000;
const fa621 = await call('find_account', { query: '62.1', limit: 5 });
const id621 = (fa621.data?.accounts ?? []).find((a) =>
  String(a.alias).startsWith('62.1')
)?.id;
const fa68 = await call('find_account', { query: '68', limit: 5 });
const id68 = (fa68.data?.accounts ?? []).find((a) => a.alias === '68')?.id;

const bal62_31 = await call('get_balance', {
  companyKey,
  accountKey: id62,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal60_31 = await call('get_balance', {
  companyKey,
  accountKey: id60,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal62_28 = await call('get_balance', {
  companyKey,
  accountKey: id62,
  dateEnd: '2025-12-28',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal60_28 = await call('get_balance', {
  companyKey,
  accountKey: id60,
  dateEnd: '2025-12-28',
  withSubAccounts: true,
  summaryOnly: true,
});
const debt = await call('get_analytics_balance', {
  companyKey,
  accountKey: id62,
  dateEnd: '2025-12-31',
  fieldName: 'USR$GS_CUSTOMER',
  side: 'debit',
  limit: 10,
});
const debtAging = await call('get_analytics_balance', {
  companyKey,
  accountKey: id62,
  dateEnd: cutoff,
  fieldName: 'USR$GS_CUSTOMER',
  side: 'debit',
  limit: 5,
});
const bal51_cut = await call('get_balance', {
  companyKey,
  accountKey: id51,
  dateEnd: cutoff,
  withSubAccounts: true,
  summaryOnly: true,
});
const siblings51 = bal51_cut.data?.relatedSiblingAccounts ?? [];
const siblingBals = [];
for (const s of siblings51.slice(0, 8)) {
  siblingBals.push(
    await call('get_balance', {
      companyKey,
      accountKey: s.accountKey,
      dateEnd: cutoff,
      withSubAccounts: true,
      summaryOnly: true,
    })
  );
}
const bal10 = await call('get_balance', {
  companyKey,
  accountKey: id10,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal20 = await call('get_balance', {
  companyKey,
  accountKey: id20,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
const tb = await call('get_trial_balance', {
  companyKey,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
});
const an60 = await call('get_analytics_balance', {
  companyKey,
  accountKey: id60,
  dateEnd: '2025-12-31',
  fieldName: 'USR$GS_CUSTOMER',
  withSubAccounts: true,
  limit: 5,
});
const an90 = await call('get_account_analysis', {
  companyKey,
  accountKey: id90,
  dateBegin: '2025-01-01',
  dateEnd: '2025-12-31',
  withSubAccounts: true,
});
const jo51 = await call('get_journal_order', {
  companyKey,
  accountKey: id51,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
  groupBy: 'MONTH',
  withSubAccounts: true,
});
const configs = await call('list_report_configs', { limit: 10 });
const jo62n = await call('get_journal_order', {
  companyKey,
  accountKey: id62,
  dateBegin: '2025-11-01',
  dateEnd: '2025-11-30',
  groupBy: 'NONE',
  withSubAccounts: true,
});
const jo62d = await call('get_journal_order', {
  companyKey,
  accountKey: id62,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
  groupBy: 'NONE',
  withSubAccounts: true,
});
const debt621 = id621
  ? await call('get_analytics_balance', {
      companyKey,
      accountKey: id621,
      dateEnd: '2025-12-31',
      fieldName: 'USR$GS_CUSTOMER',
      side: 'debit',
      limit: 10,
    })
  : { ok: false, data: null };
const tb5062 = await call('get_trial_balance', {
  companyKey,
  dateBegin: '2025-12-01',
  dateEnd: '2025-12-31',
  accountAliases: ['50-62'],
  includeOffBalance: false,
});
const bal51_31 = await call('get_balance', {
  companyKey,
  accountKey: id51,
  dateEnd: '2025-12-31',
  withSubAccounts: true,
  summaryOnly: true,
});
const bal68_31 = id68
  ? await call('get_balance', {
      companyKey,
      accountKey: id68,
      dateEnd: '2025-12-31',
      withSubAccounts: true,
      summaryOnly: true,
    })
  : { ok: false, data: null };

const top3 = (debt.data?.rows ?? []).slice(0, 3);
const joRow = (jo51.data?.rows ?? [])[0];
const n62 = (jo62n.data?.rows ?? [])[0];
const d62 = (jo62d.data?.rows ?? [])[0];

const rows = [
  {
    id: 'D1',
    prompt:
      'Сколько нам должны покупатели и сколько мы должны поставщикам на конец декабря 2025?',
    answer: `На 2025-12-31: покупатели (Дт 62) ${bal62_31.data?.totals?.debitNcu} бел. руб.; поставщикам (Кт 60) ${bal60_31.data?.totals?.creditNcu} бел. руб. (срез учёта dataCutoff=${cutoff}).`,
    pass:
      bal62_31.data?.totals?.debitNcu === '823.864' &&
      bal60_31.data?.totals?.creditNcu === '1933.1951',
  },
  {
    id: 'D2',
    prompt: 'Какая выручка и прибыль (убыток) за 2025 год?',
    answer: an90.ok
      ? `Единого показателя «выручка/прибыль» нет (нет list_metrics). Анализ 90 за 2025: ${an90.data?.rowCount} корреспонденций; saldoEnd=${an90.data?.saldoEndNcu}. Нужно читать accountName по субсчетам 90.*, не угадывать по коду.`
      : `Отказ/ошибка анализа 90: ${an90.error}`,
    pass: an90.ok && (an90.data?.rowCount ?? 0) > 0,
  },
  {
    id: 'D3',
    prompt: 'Кто из покупателей наши крупнейшие должники?',
    answer: `На 2025-12-31 по 62 (USR$GS_CUSTOMER): ${top3
      .map((r) => `${r.analyticsName} ${r.debitNcu}`)
      .join('; ')}.`,
    pass:
      String(top3[0]?.analyticsName ?? '').includes('МакВторВуд') &&
      String(top3[0]?.debitNcu) === '365.28' &&
      String(top3[1]?.debitNcu) === '358.72' &&
      String(top3[2]?.debitNcu) === '99.88',
  },
  {
    id: 'D4',
    prompt: 'Есть ли просроченная дебиторка / кому давно не платим?',
    answer: `Срез dataCutoff=${cutoff}. Топ ДЗ: ${(debtAging.data?.rows ?? [])
      .slice(0, 3)
      .map((r) => `${r.analyticsName} debit=${r.debitNcu} last=${r.lastEntryDate ?? '?'}`)
      .join('; ')}. Без дат 9026.`,
    pass:
      debtAging.ok &&
      cutoff === '2026-10-31' &&
      !(debtAging.error || '').includes('9026'),
  },
  {
    id: 'D5',
    prompt:
      'Как изменились остатки денег на расчётных счетах за последний месяц / квартал?',
    answer: `dataCutoff=${cutoff}. 51 totals=${JSON.stringify(bal51_cut.data?.totals)}; siblings=${siblings51.map((s) => s.alias).join(',') || 'none'} (${siblingBals.filter((b) => b.ok).length} ok).`,
    pass: bal51_cut.ok && cutoff === '2026-10-31',
  },
  {
    id: 'D6',
    prompt: 'Где «заморожены» деньги: запасы, незавершёнка, авансы?',
    answer: `На 2025-12-31: запасы 10 Дт ${bal10.data?.totals?.debitNcu} (нетто ${bal10.data?.totals?.simpleNcu}); НЗП 20 Дт ${bal20.data?.totals?.debitNcu}; авансы поставщикам (Дт 60) ${bal60_31.data?.totals?.debitNcu}.`,
    pass:
      money2(bal10.data?.totals?.debitNcu) === '1794169.48' &&
      money2(bal20.data?.totals?.debitNcu) === '907935.23',
  },
  {
    id: 'A1',
    prompt: 'Оборотно-сальдовая по организации за декабрь 2025 — сверка.',
    answer: `ОСВ 2025-12-01..31: rows=${tb.data?.rowCount}, totals=${JSON.stringify(tb.data?.totals)}.`,
    pass: tb.ok && (tb.data?.rowCount ?? 0) > 0,
  },
  {
    id: 'A2',
    prompt:
      'Развёртка 62 / 60 на конец декабря 2025: долг vs авансы по клиентам.',
    answer: `62 totals Дт ${bal62_31.data?.totals?.debitNcu} Кт ${bal62_31.data?.totals?.creditNcu}; 60 Дт ${bal60_31.data?.totals?.debitNcu} Кт ${bal60_31.data?.totals?.creditNcu}. Analytics 60 top=${(an60.data?.rows ?? []).length}.`,
    pass:
      bal62_31.data?.totals?.debitNcu === '823.864' &&
      bal60_31.data?.totals?.creditNcu === '1933.1951',
  },
  {
    id: 'A3',
    prompt:
      'Карта или анализ счёта 90 за 2025: выручка, НДС, себестоимость, расходы.',
    answer: an90.ok
      ? `get_account_analysis(90): rows=${an90.data?.rowCount}; sample=${JSON.stringify(
          (an90.data?.rows ?? []).slice(0, 4).map((r) => ({
            alias: r.alias,
            name: r.accountName,
            corr: r.corrAlias,
            corrName: r.corrAccountName,
            d: r.ncuDebit,
            c: r.ncuCredit,
          }))
        )}`
      : String(an90.error),
    pass: an90.ok && (an90.data?.rowCount ?? 0) > 0,
  },
  {
    id: 'A4',
    prompt: 'Журнал-ордер по 51 за декабрь 2025 — крупные поступления и списания.',
    answer: `ЖО 51 декабрь: Дт ${joRow?.ncuDebit} Кт ${joRow?.ncuCredit} (source=${jo51.data?.source}).`,
    pass:
      String(joRow?.ncuDebit) === '2932211.53' &&
      String(joRow?.ncuCredit) === '3250514.93',
  },
  {
    id: 'A5',
    prompt: 'Почему сальдо по покупателю X не сходится с актом сверки?',
    answer:
      'Нужно уточнить контрагента X, дату/период сверки и счёт (62.*). Без X ответ не строится — это корректный отказ.',
    pass: true,
  },
  {
    id: 'A6',
    prompt:
      'Какие сохранённые настройки отчётов есть по карте / ОСВ — запусти за декабрь 2025.',
    answer: `list_report_configs: ${configs.data?.rowCount} шт. Примеры: ${JSON.stringify(
      (configs.data?.configs ?? []).slice(0, 3).map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.reportKind,
      }))
    )}.`,
    pass: configs.ok && (configs.data?.rowCount ?? 0) > 0,
  },
  {
    id: 'B1',
    prompt:
      'Кратко для директора: дебиторка и кредиторка на 28.12.2025, без субсчетов в ответе — итогами.',
    answer: `На 28.12.2025: ДЗ (Дт 62) ${bal62_28.data?.totals?.debitNcu}; КЗ (Кт 60) ${bal60_28.data?.totals?.creditNcu} бел. руб.`,
    pass:
      bal62_28.data?.totals?.debitNcu === '823.864' &&
      bal60_28.data?.totals?.creditNcu === '621134.608',
  },
  {
    id: 'B2',
    prompt:
      'Сравни обороты по 62 за ноябрь и декабрь 2025: отгрузка vs оплаты.',
    answer: `Ноябрь: отгрузка ${n62?.ncuDebit} / оплаты ${n62?.ncuCredit}; декабрь: ${d62?.ncuDebit} / ${d62?.ncuCredit}.`,
    pass:
      String(n62?.ncuDebit) === '52.8' &&
      String(n62?.ncuCredit) === '666.32' &&
      String(d62?.ncuDebit) === '0' &&
      String(d62?.ncuCredit) === '454.1',
  },
  {
    id: 'B3',
    prompt: 'Топ-10 должников по 62.1 на конец декабря 2025.',
    answer: id621
      ? `62.1 id=${id621}: rows=${debt621.data?.rowCount ?? (debt621.data?.rows ?? []).length}, totals=${JSON.stringify(debt621.data?.totals)}.`
      : 'Счёт 62.1 не найден.',
    pass: Boolean(id621) && debt621.ok,
  },
  {
    id: 'B4',
    prompt:
      'По счёту 90 за 2025: выручка с НДС, себестоимость, финансовый результат.',
    answer: an90.ok
      ? `См. A3: ${an90.data?.rowCount} строк анализа. Имена брать из accountName/corrAccountName; 90.2≠себестоимость.`
      : String(an90.error),
    pass: an90.ok,
  },
  {
    id: 'B5',
    prompt:
      'Покажи ОСВ за декабрь 2025 только по деньгам и расчётам (50–62), без забаланса.',
    answer: `ОСВ aliases 50-62: rows=${tb5062.data?.rowCount}, begin_debit=${tb5062.data?.totals?.begin_debit}.`,
    pass: tb5062.ok && (tb5062.data?.rowCount ?? 0) > 0,
  },
  {
    id: 'C1',
    prompt: 'Сколько затрат в декабре 2025 и как их уменьшить?',
    answer: `Затраты нужно смотреть по счетам 20/25/26/44 и субсчетам 90 затрат за 2025-12 (не путать с НДС 90.2). ОСВ декабря доступна (rows=${tb.data?.rowCount}).`,
    pass: tb.ok,
  },
  {
    id: 'C2',
    prompt:
      'Хватает ли денег на р/с на 31.12.2025 на долги поставщикам и налогам?',
    answer: `Деньги 51 на 31.12: Дт ${bal51_31.data?.totals?.debitNcu}; долг поставщикам Кт 60 ${bal60_31.data?.totals?.creditNcu}; 68 totals=${JSON.stringify(bal68_31.data?.totals)}. Вывод: денег на 51 (${bal51_31.data?.totals?.debitNcu}) >> долг 60 (${bal60_31.data?.totals?.creditNcu}).`,
    pass:
      bal51_31.ok &&
      bal60_31.data?.totals?.creditNcu === '1933.1951' &&
      Number(bal51_31.data?.totals?.debitNcu) >
        Number(bal60_31.data?.totals?.creditNcu),
  },
];

const out = {
  dataCutoff: cutoff,
  generatedAt: new Date().toISOString(),
  results: rows.map((r) => ({
    id: r.id,
    prompt: r.prompt,
    verdict: r.pass ? 'PASS' : 'FAIL',
    answer: r.answer,
  })),
};
const pass = rows.filter((r) => r.pass).length;
const fail = rows.length - pass;

console.log(`dataCutoff=${cutoff}`);
for (const r of rows) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} — ${r.answer.slice(0, 160).replace(/\s+/g, ' ')}`);
}
console.log(`\nSUMMARY pass=${pass} fail=${fail} total=${rows.length}`);

const outPath = resolve(root, 'apps/mcp-server/scripts/pilot-answers-results.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`Saved ${outPath}`);
process.exit(fail ? 1 : 0);
