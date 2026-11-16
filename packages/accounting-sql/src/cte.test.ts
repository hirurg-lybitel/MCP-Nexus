import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INTERNAL_ENTRY_PREDICATE,
  journalOrderSql,
  turnoverByAccountSql,
  vAccountsCte,
  vDocumentsCte,
  vEntriesCte,
  vEntryPairsCte,
  withClause,
} from './cte.js';

describe('accounting CTE templates', () => {
  it('builds v_accounts under chart root', () => {
    const sql = vAccountsCte({ chartRootId: 300001 });
    assert.match(sql, /root\.id = 300001/);
    assert.match(sql, /accounttype IN \('A', 'S'\)/);
    assert.doesNotMatch(sql, /WITH RECURSIVE/i);
  });

  it('embeds D9 internal-move filter by default', () => {
    const sql = vEntriesCte(
      { dateBegin: '2022-01-01', dateEnd: '2022-12-31' },
      { companyKey: 146866007 }
    );
    assert.match(sql, /isinternal/);
    assert.match(sql, /NOT EXISTS/);
    assert.ok(INTERNAL_ENTRY_PREDICATE.includes('e_cm.debitncu'));
  });

  it('can include internal entries', () => {
    const sql = vEntriesCte(
      { dateBegin: '2022-01-01', dateEnd: '2022-12-31' },
      { companyKey: 146866007 },
      { excludeInternal: false }
    );
    assert.doesNotMatch(sql, /isinternal/);
  });

  it('builds issimple pair CTE and documents CTE', () => {
    assert.match(vEntryPairsCte(), /IIF\(c\.issimple = 0/);
    assert.match(
      vDocumentsCte(
        { dateBegin: '2022-01-01', dateEnd: '2022-12-31' },
        { companyKey: 146866007 }
      ),
      /gd_document/
    );
  });

  it('composes turnover query without recursive WITH', () => {
    const sql = turnoverByAccountSql(
      { chartRootId: 300001 },
      { dateBegin: '2023-01-01', dateEnd: '2023-10-31' },
      { companyKey: 146866007 }
    );
    assert.match(sql, /^WITH\nv_accounts/m);
    assert.match(sql, /v_entries/);
    assert.doesNotMatch(sql, /WITH RECURSIVE/i);
    assert.ok(withClause('a AS (SELECT 1 AS x)').startsWith('WITH'));
  });

  it('builds journal-order SQL for account tree', () => {
    const sql = journalOrderSql(
      { accountKey: 355100, withSubAccounts: true },
      { dateBegin: '2025-12-01', dateEnd: '2025-12-31' },
      { companyKey: 148284864 },
      { excludeInternal: true }
    );
    assert.match(sql, /v_focus_accounts/);
    assert.match(sql, /root\.id = 355100/);
    assert.match(sql, /v_entry_pairs/);
    assert.match(sql, /GROUP BY entrydate, alias, corr_alias/);
    assert.doesNotMatch(sql, /WITH RECURSIVE/i);
  });

  it('can restrict journal-order to the account itself', () => {
    const sql = journalOrderSql(
      { accountKey: 355100, withSubAccounts: false },
      { dateBegin: '2025-12-01', dateEnd: '2025-12-31' },
      { companyKey: 148284864 }
    );
    assert.match(sql, /a\.id = root\.id/);
  });
});
