import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  flattenAccountingRow,
  parseAccountingToolTable,
} from './parse-accounting-table';
import { parseTableFromToolResult } from './parse-tool-table';

describe('flattenAccountingRow', () => {
  it('drops nested objects and counts arrays', () => {
    assert.deepEqual(
      flattenAccountingRow({
        alias: '60',
        ncuDebit: '1',
        correspondence: [{ corrAlias: '51' }, { corrAlias: '52' }],
        meta: { x: 1 },
      }),
      {
        alias: '60',
        ncuDebit: '1',
        correspondence: 2,
      }
    );
  });
});

describe('parseAccountingToolTable', () => {
  it('parses trial balance accounts into a UI table', () => {
    const table = parseAccountingToolTable(
      'get_trial_balance',
      JSON.stringify({
        dateBegin: '2025-12-01',
        dateEnd: '2025-12-31',
        accounts: [
          {
            ACCOUNT_ALIAS: '51',
            ACCOUNT_NAME: 'Расчётный счёт',
            DEBIT: '10',
            CREDIT: '0',
          },
          {
            ACCOUNT_ALIAS: '60',
            ACCOUNT_NAME: 'Поставщики',
            DEBIT: '0',
            CREDIT: '5',
          },
        ],
        rowCount: 2,
        totals: { debit: '10', credit: '5' },
      })
    );
    assert.ok(table);
    assert.equal(table!.title, 'ОСВ 2025-12-01 – 2025-12-31');
    assert.equal(table!.rows.length, 2);
    assert.ok(table!.columns.some((c) => c.key === 'ACCOUNT_ALIAS'));
  });

  it('parses account analysis rows with names', () => {
    const table = parseAccountingToolTable(
      'get_account_analysis',
      JSON.stringify({
        accountKey: 344600,
        accountAlias: '90',
        rows: [
          {
            alias: '90.2-3',
            accountName: 'НДС от основной реализации',
            corrAlias: '68',
            corrAccountName: 'Налоги',
            ncuDebit: '0',
            ncuCredit: '100',
          },
        ],
        rowCount: 1,
      })
    );
    assert.ok(table);
    assert.equal(table!.title, 'Анализ счёта 90');
    assert.equal(table!.rows[0]?.accountName, 'НДС от основной реализации');
  });

  it('returns null for summaryOnly balance without rows', () => {
    assert.equal(
      parseAccountingToolTable(
        'get_balance',
        JSON.stringify({
          accountAlias: '62',
          dateEnd: '2025-12-31',
          summaryOnly: true,
          rowCount: 0,
          totals: { debitNcu: '823.864', creditNcu: '0' },
        })
      ),
      null
    );
  });

  it('is wired through parseTableFromToolResult', () => {
    const table = parseTableFromToolResult(
      'get_account_card',
      JSON.stringify({
        accountKey: 355100,
        entries: [
          {
            entryDate: '2025-12-01',
            alias: '51',
            corrAlias: '62',
            ncuDebit: '10',
            ncuCredit: '0',
          },
        ],
      })
    );
    assert.ok(table);
    assert.match(table!.title, /Карта счёта/);
  });
});
