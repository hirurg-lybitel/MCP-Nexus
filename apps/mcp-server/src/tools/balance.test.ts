import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeAccountBalance } from './balance.js';

describe('computeAccountBalance (BUG-09 / BUG-10)', () => {
  function makeMockDb() {
    const calls: string[] = [];
    return {
      calls,
      db: {
        executeSql: {
          run: async (sql: string) => {
            calls.push(sql);
            if (/ac_companyaccount/i.test(sql)) {
              return { rows: [{ ACCOUNTKEY: 300000 }] };
            }
            if (/NOT \(a\.lb >= root\.lb AND a\.rb <= root\.rb\)/i.test(sql)) {
              if (/UPPER\('51/i.test(sql)) {
                return {
                  rows: [
                    {
                      ID: 355101,
                      ALIAS: '51-1',
                      NAME: 'Р/с доп.',
                      ACCOUNTTYPE: 'A',
                    },
                  ],
                };
              }
              return { rows: [] };
            }
            if (/SELECT FIRST 1 a\.alias, a\.name/i.test(sql)) {
              return { rows: [{ ALIAS: '51', NAME: 'Расчётный счёт' }] };
            }
            if (
              /FROM\s+ac_account\s+a/i.test(sql) &&
              /JOIN ac_account root/i.test(sql) &&
              !/JOIN ac_account chart/i.test(sql)
            ) {
              return {
                rows: [
                  { ID: 366000, ALIAS: '60', NAME: 'Поставщики' },
                  { ID: 148542117, ALIAS: '60.1', NAME: 'Поставщики (товары)' },
                ],
              };
            }
            if (/ac_accountexsaldo_bal[\s\S]*366000/i.test(sql)) {
              return {
                rows: [{ DEBIT_NCU: '0', CREDIT_NCU: '0.0049' }],
              };
            }
            if (/ac_accountexsaldo_bal[\s\S]*148542117/i.test(sql)) {
              return {
                rows: [{ DEBIT_NCU: '0', CREDIT_NCU: '621075.9029' }],
              };
            }
            return { rows: [] };
          },
        },
      },
    };
  }

  it('defaults withSubAccounts to true when omitted', async () => {
    const { db } = makeMockDb();
    const res = await computeAccountBalance(
      {
        companyKey: 148284864,
        accountKey: 366000,
        dateEnd: '2025-12-28',
        accountAlias: '60',
        accountName: 'Поставщики',
      },
      db
    );
    assert.equal(res.withSubAccounts, true);
    assert.equal(res.subAccountCount, 2);
    assert.equal(res.totals.creditNcu, '621075.9078');
  });

  it('summaryOnly omits rows array while keeping full subaccount totals', async () => {
    const { db } = makeMockDb();
    const res = await computeAccountBalance(
      {
        companyKey: 148284864,
        accountKey: 366000,
        dateEnd: '2025-12-28',
        summaryOnly: true,
        accountAlias: '60',
        accountName: 'Поставщики',
      },
      db
    );
    assert.equal(res.withSubAccounts, true);
    assert.equal(res.summaryOnly, true);
    assert.equal('rows' in res, false);
    assert.equal(res.rowCount, 0);
    assert.equal(res.subAccountCount, 2);
    assert.equal(res.totals.creditNcu, '621075.9078');
  });

  it('returns relatedSiblingAccounts for short synthetic aliases', async () => {
    const { db } = makeMockDb();
    const res = await computeAccountBalance(
      {
        companyKey: 148284864,
        accountKey: 355100,
        dateEnd: '2025-12-31',
        accountAlias: '51',
        accountName: 'Расчётный счёт',
        summaryOnly: true,
      },
      db
    );
    assert.equal(res.accountAlias, '51');
    assert.deepEqual(res.relatedSiblingAccounts, [
      {
        accountKey: 355101,
        alias: '51-1',
        name: 'Р/с доп.',
        accountType: 'A',
      },
    ]);
  });
});
