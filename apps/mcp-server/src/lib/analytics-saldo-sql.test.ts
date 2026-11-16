import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAnalyticsSaldoSql,
  buildCloseDateSql,
  buildLastEntryDateSql,
} from './analytics-saldo-sql.js';

describe('buildAnalyticsSaldoSql', () => {
  it('uses balance cache and entries in [closeDate, dateEnd) when dateEnd >= closeDate', () => {
    const sql = buildAnalyticsSaldoSql({
      fieldName: 'USR$GS_CUSTOMER',
      accountKeys: [148542117],
      companyKey: 148284864,
      holdingCompanyKeys: [],
      dateEnd: '2025-12-31',
      closeDate: '2020-01-01',
    });
    assert.match(sql, /ac_entry_balance/i);
    assert.match(sql, /entrydate >= DATE '2020-01-01'/i);
    assert.match(sql, /entrydate < DATE '2025-12-31'/i);
    assert.doesNotMatch(sql, /entrydate <=/i);
    assert.match(sql, /GROUP BY main\.analytics_id, main\.account_key, main\.company_key/);
  });

  it('subtracts entries when dateEnd < closeDate', () => {
    const sql = buildAnalyticsSaldoSql({
      fieldName: 'USR$GS_CUSTOMER',
      accountKeys: [1, 2],
      companyKey: 10,
      holdingCompanyKeys: [11],
      dateEnd: '2019-06-01',
      closeDate: '2020-01-01',
    });
    assert.match(sql, /-e\.debitncu/i);
    assert.match(sql, /entrydate >= DATE '2019-06-01'/i);
    assert.match(sql, /entrydate < DATE '2020-01-01'/i);
    assert.match(sql, /companykey IN \(10, 11\)/i);
  });
});

describe('buildCloseDateSql / lastEntryDate', () => {
  it('reads generator offset from epoch 1858-11-17', () => {
    assert.match(buildCloseDateSql(), /gd_g_entry_balance_date/i);
    assert.match(buildCloseDateSql(), /1858-11-17/);
  });

  it('last movement uses same exclusive dateEnd bound', () => {
    const sql = buildLastEntryDateSql({
      fieldName: 'USR$GS_CUSTOMER',
      accountKeys: [1],
      companyKey: 2,
      holdingCompanyKeys: [],
      dateEnd: '2025-12-31',
    });
    assert.match(sql, /entrydate < DATE '2025-12-31'/i);
  });
});
