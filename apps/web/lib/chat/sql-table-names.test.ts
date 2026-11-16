import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTableNamesFromSql } from '@mcp-nexus/db-firebird';

describe('extractTableNamesFromSql', () => {
  it('extracts FROM and JOIN tables', () => {
    const tables = extractTableNamesFromSql(`
      SELECT g.NAME FROM GD_GOOD g
      JOIN GD_GOODGROUP gg ON g.GROUPKEY = gg.ID
    `);
    assert.deepEqual(tables.sort(), ['GD_GOOD', 'GD_GOODGROUP']);
  });

  it('ignores FROM inside EXTRACT', () => {
    const tables = extractTableNamesFromSql(`
      SELECT EXTRACT(MONTH FROM e.entrydate) FROM ac_entry e
    `);
    assert.deepEqual(tables.sort(), ['AC_ENTRY']);
  });
});
