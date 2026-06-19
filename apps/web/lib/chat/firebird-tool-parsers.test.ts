import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatColumnList,
  parseDescribeTableTool,
  parseExecuteSqlTool,
  parseListTablesTool,
  parseSearchTablesTool,
  isFirebirdTool,
  countSensitiveColumns,
} from './firebird-tools';
import { isToolPanelVisible, shouldShowToolCallPanel } from './tool-ui';

describe('isFirebirdTool', () => {
  it('recognizes Firebird MCP tools', () => {
    assert.equal(isFirebirdTool('execute_sql'), true);
    assert.equal(isFirebirdTool('search_tables'), true);
    assert.equal(isFirebirdTool('get_horoscope'), false);
  });
});

describe('parseExecuteSqlTool', () => {
  it('parses sanitized success payload with sql from input', () => {
    const result = parseExecuteSqlTool(
      { sql: 'SELECT FIRST 5 * FROM GD_GOOD' },
      JSON.stringify({
        rowCount: 5,
        columns: ['ID', 'NAME'],
        truncated: false,
      })
    );
    assert.equal(result.kind, 'success');
    if (result.kind === 'success') {
      assert.equal(result.rowCount, 5);
      assert.deepEqual(result.columns, ['ID', 'NAME']);
      assert.equal(result.sql, 'SELECT FIRST 5 * FROM GD_GOOD');
    }
  });

  it('returns error for error payload', () => {
    const result = parseExecuteSqlTool(
      {},
      JSON.stringify({ error: 'Unknown table' })
    );
    assert.equal(result.kind, 'error');
    if (result.kind === 'error') {
      assert.equal(result.message, 'Unknown table');
    }
  });
});

describe('parseSearchTablesTool', () => {
  it('parses table list with query', () => {
    const result = parseSearchTablesTool(
      { query: 'групп' },
      JSON.stringify({
        query: 'групп',
        tables: [
          { tableName: 'GD_GOODGROUP', displayName: 'Группы товаров' },
        ],
      })
    );
    assert.equal(result.kind, 'success');
    assert.equal(result.tables.length, 1);
    assert.equal(result.query, 'групп');
  });

  it('returns empty tables on error', () => {
    const result = parseSearchTablesTool(
      {},
      JSON.stringify({ error: 'DB offline' })
    );
    assert.equal(result.kind, 'error');
    assert.equal(result.error, 'DB offline');
  });
});

describe('parseListTablesTool', () => {
  it('parses catalog', () => {
    const result = parseListTablesTool(
      JSON.stringify({
        tables: [{ tableName: 'GD_UNIT' }],
      })
    );
    assert.equal(result.kind, 'success');
    assert.equal(result.tables.length, 1);
  });
});

describe('parseDescribeTableTool', () => {
  it('parses schema columns', () => {
    const result = parseDescribeTableTool(
      { tableName: 'GD_GOOD' },
      JSON.stringify({
        tableName: 'GD_GOOD',
        tableDisplayName: 'Товары',
        columns: [
          {
            fieldName: 'ID',
            displayName: 'Код',
            sensitive: false,
          },
          {
            fieldName: 'PASSW',
            sensitive: true,
          },
        ],
      })
    );
    assert.equal(result.kind, 'success');
    if (result.kind === 'success') {
      assert.equal(result.tableName, 'GD_GOOD');
      assert.equal(countSensitiveColumns(result.columns), 1);
    }
  });

  it('parses extended column metadata for schema explorer', () => {
    const result = parseDescribeTableTool(
      { tableName: 'GD_GOOD' },
      JSON.stringify({
        tableName: 'GD_GOOD',
        columns: [
          {
            fieldName: 'GROUPKEY',
            fieldType: 'INTEGER',
            fieldLength: 4,
            nullable: false,
            refTable: 'GD_GOODGROUP',
            refListField: 'NAME',
            refTableDisplayName: 'Groups',
          },
        ],
      })
    );
    assert.equal(result.kind, 'success');
    if (result.kind === 'success') {
      const col = result.columns[0];
      assert.equal(col?.fieldType, 'INTEGER');
      assert.equal(col?.fieldLength, 4);
      assert.equal(col?.nullable, false);
      assert.equal(col?.refTable, 'GD_GOODGROUP');
      assert.equal(col?.refListField, 'NAME');
      assert.equal(col?.refTableDisplayName, 'Groups');
    }
  });
});

describe('formatColumnList', () => {
  it('truncates long column lists', () => {
    assert.equal(
      formatColumnList(['A', 'B', 'C', 'D', 'E', 'F'], 5),
      'A, B, C, D, E, …'
    );
  });
});

describe('isToolPanelVisible', () => {
  it('shows Firebird tools without developer mode', () => {
    assert.equal(isToolPanelVisible('execute_sql', false), true);
    assert.equal(isToolPanelVisible('search_tables', false), true);
  });

  it('hides non-Firebird tools without developer mode', () => {
    assert.equal(isToolPanelVisible('get_horoscope', false), false);
    assert.equal(isToolPanelVisible('get_horoscope', true), true);
  });

  it('hides host tools with dedicated UI', () => {
    assert.equal(shouldShowToolCallPanel('create_query_plan'), false);
    assert.equal(shouldShowToolCallPanel('present_query_result'), false);
    assert.equal(isToolPanelVisible('create_query_plan', true), false);
  });
});
