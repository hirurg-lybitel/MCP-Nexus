import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWorkingCompany } from './working-company.js';

function mockDb(rowsBySql: Array<{ match: RegExp; rows: unknown[] }>) {
  return {
    executeSql: {
      run: async (sql: string) => {
        const hit = rowsBySql.find((entry) => entry.match.test(sql));
        if (!hit) throw new Error(`unexpected sql: ${sql}`);
        return { rows: hit.rows };
      },
    },
  };
}

describe('resolveWorkingCompany', () => {
  it('rejects invented companyKey not in GD_OURCOMPANY', async () => {
    const db = mockDb([
      { match: /gd_ourcompany/i, rows: [] },
    ]);
    const result = await resolveWorkingCompany(db, 1);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'COMPANY_NOT_FOUND');
    assert.match(result.message, /find_counterparty|omit companyKey/i);
  });

  it('accepts an explicit working organization', async () => {
    const db = mockDb([
      {
        match: /gd_ourcompany/i,
        rows: [{ COMPANYKEY: 148284864, NAME: 'БелГИСС' }],
      },
    ]);
    const result = await resolveWorkingCompany(db, 148284864);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.companyKey, 148284864);
    assert.equal(result.companyName, 'БелГИСС');
    assert.equal(result.companyScope, 'explicit');
  });

  it('defaults to the only working organization when companyKey is omitted', async () => {
    const db = mockDb([
      {
        match: /gd_ourcompany/i,
        rows: [{ companykey: 148284864, name: 'БелГИСС' }],
      },
    ]);
    const result = await resolveWorkingCompany(db);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.companyKey, 148284864);
    assert.equal(result.companyScope, 'default_single_working');
  });

  it('returns AMBIGUOUS_COMPANY when several working orgs exist and companyKey is omitted', async () => {
    const db = mockDb([
      {
        match: /gd_ourcompany/i,
        rows: [
          { companykey: 100, name: 'A' },
          { companykey: 200, name: 'B' },
        ],
      },
    ]);
    const result = await resolveWorkingCompany(db);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'AMBIGUOUS_COMPANY');
    assert.equal(result.companies?.length, 2);
  });
});
