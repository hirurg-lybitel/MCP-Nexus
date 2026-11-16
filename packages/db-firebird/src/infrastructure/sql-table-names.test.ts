import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractCteNamesFromSql,
  extractTableNamesFromSql,
  maskSqlFunctionsWithFrom,
} from './sql-table-names.js';

describe('extractTableNamesFromSql', () => {
  it('extracts FROM and JOIN tables', () => {
    const tables = extractTableNamesFromSql(`
      SELECT g.NAME FROM GD_GOOD g
      JOIN GD_GOODGROUP gg ON g.GROUPKEY = gg.ID
    `);
    assert.deepEqual(tables.sort(), ['GD_GOOD', 'GD_GOODGROUP']);
  });

  it('does not treat EXTRACT(... FROM ...) as a table', () => {
    const tables = extractTableNamesFromSql(`
      SELECT EXTRACT(MONTH FROM e.entrydate) AS m, SUM(e.debitncu)
      FROM ac_entry e
      WHERE e.entrydate >= DATE '2025-01-01'
      GROUP BY 1
    `);
    assert.deepEqual(tables.sort(), ['AC_ENTRY']);
  });

  it('masks TRIM and SUBSTRING FROM constructs', () => {
    const tables = extractTableNamesFromSql(`
      SELECT TRIM(BOTH ' ' FROM s.name), SUBSTRING(x.note FROM 1 FOR 3)
      FROM gd_contact s
      JOIN gd_document x ON x.id = s.id
    `);
    assert.deepEqual(tables.sort(), ['GD_CONTACT', 'GD_DOCUMENT']);
  });

  it('ignores CTE names but keeps real tables inside CTE bodies', () => {
    const sql = `
      WITH pairs AS (
        SELECT e.id FROM ac_entry e
      )
      SELECT * FROM pairs p
      JOIN ac_account a ON a.id = 1
    `;
    assert.deepEqual(extractCteNamesFromSql(sql), ['PAIRS']);
    assert.deepEqual(extractTableNamesFromSql(sql).sort(), [
      'AC_ACCOUNT',
      'AC_ENTRY',
    ]);
  });

  it('handles EXTRACT inside CTE', () => {
    const tables = extractTableNamesFromSql(`
      WITH m AS (
        SELECT EXTRACT(YEAR FROM e.entrydate) AS y FROM ac_entry e
      )
      SELECT * FROM m
    `);
    assert.deepEqual(tables.sort(), ['AC_ENTRY']);
  });
});

describe('maskSqlFunctionsWithFrom', () => {
  it('blanks nested EXTRACT body', () => {
    const masked = maskSqlFunctionsWithFrom(
      'SELECT EXTRACT(MONTH FROM e.entrydate) FROM ac_entry e'
    );
    assert.doesNotMatch(masked, /EXTRACT\s*\([^)]*FROM/i);
    assert.match(masked, /FROM ac_entry/i);
  });
});
