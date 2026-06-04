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
});
