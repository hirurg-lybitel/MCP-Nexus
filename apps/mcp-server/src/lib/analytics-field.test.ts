import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSafeIdent,
  resolveAnalyticsField,
  resolveAnalyticsFieldForAccounts,
} from './analytics-field.js';

describe('isSafeIdent', () => {
  it('allows USR$ analytics identifiers', () => {
    assert.equal(isSafeIdent('USR$GS_CUSTOMER'), true);
    assert.equal(isSafeIdent('GD_CONTACT'), true);
    assert.equal(isSafeIdent('USR$GS_CUSTOMER; DROP'), false);
    assert.equal(isSafeIdent('e.usr$gs_customer'), false);
  });
});

describe('resolveAnalyticsField', () => {
  it('rejects non-USR fields', async () => {
    const db = {
      executeSql: {
        run: async () => ({ rows: [] }),
      },
    };
    const res = await resolveAnalyticsField(db, 'ACCOUNTKEY');
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, 'INVALID_FIELD');
  });

  it('resolves GD_CONTACT metadata', async () => {
    const db = {
      executeSql: {
        run: async (sql: string) => {
          if (/at_relation_fields/i.test(sql)) {
            return {
              rows: [
                {
                  FIELDNAME: 'USR$GS_CUSTOMER',
                  LNAME: 'Клиент',
                  REFTABLE: 'GD_CONTACT',
                  REFLISTFIELD: 'NAME',
                },
              ],
            };
          }
          return { rows: [] };
        },
      },
    };
    const res = await resolveAnalyticsField(db, 'usr$gs_customer');
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.meta.fieldName, 'USR$GS_CUSTOMER');
      assert.equal(res.meta.fieldLabel, 'Клиент');
      assert.equal(res.meta.refTable, 'GD_CONTACT');
      assert.equal(res.meta.nameColumn, 'NAME');
    }
  });
});

describe('resolveAnalyticsFieldForAccounts', () => {
  it('defaults to the single AC_ACCANALYTICSEXT field', async () => {
    const db = {
      executeSql: {
        run: async (sql: string) => {
          if (/ac_accanalyticsext/i.test(sql)) {
            return {
              rows: [{ FIELDNAME: 'USR$GS_CUSTOMER', LNAME: 'Клиент' }],
            };
          }
          if (/at_relation_fields/i.test(sql)) {
            return {
              rows: [
                {
                  FIELDNAME: 'USR$GS_CUSTOMER',
                  LNAME: 'Клиент',
                  REFTABLE: 'GD_CONTACT',
                  REFLISTFIELD: 'NAME',
                },
              ],
            };
          }
          return { rows: [] };
        },
      },
    };
    const res = await resolveAnalyticsFieldForAccounts(db, [1], undefined);
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.meta.fieldName, 'USR$GS_CUSTOMER');
  });

  it('errors when several analytics fields and fieldName omitted', async () => {
    const db = {
      executeSql: {
        run: async (sql: string) => {
          if (/ac_accanalyticsext/i.test(sql)) {
            return {
              rows: [
                { FIELDNAME: 'USR$GS_CUSTOMER', LNAME: 'Клиент' },
                { FIELDNAME: 'USR$GS_DEPARTMENT', LNAME: 'Подразделение' },
              ],
            };
          }
          return { rows: [] };
        },
      },
    };
    const res = await resolveAnalyticsFieldForAccounts(db, [1], undefined);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, 'AMBIGUOUS_ANALYTICS_FIELD');
  });
});
