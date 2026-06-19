import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_PRESENT_TABLE_TOOL,
  isSilentFirebirdToolUi,
  parseTableFromToolResult,
  shouldShowToolCallPanel,
} from './parse-tool-table';
import { isToolPanelVisible } from './tool-ui';

describe('parseTableFromToolResult', () => {
  it('parses present_query_result rows with columnLabels', () => {
    const result = parseTableFromToolResult(
      AGENT_PRESENT_TABLE_TOOL,
      JSON.stringify({
        title: 'GD_GOOD sample',
        rows: [
          { ID: 1, NAME: 'A' },
          { ID: 2, NAME: 'B' },
        ],
        rowCount: 2,
        truncated: false,
        columnLabels: { NAME: 'Наименование' },
      })
    );
    assert.ok(result);
    assert.ok(result!.title?.startsWith('GD_GOOD sample'));
    const nameCol = result!.columns.find((c) => c.key === 'NAME');
    assert.equal(nameCol?.label, 'Наименование');
    assert.ok(!result!.columns.some((c) => c.key === 'ID'));
    assert.equal(result!.rows.length, 2);
    assert.ok(result!.rows[0]?.ID !== undefined);
    assert.ok(result!.hiddenColumns?.some((c) => c.key === 'ID'));
  });

  it('parses sql and params from present_query_result', () => {
    const result = parseTableFromToolResult(
      AGENT_PRESENT_TABLE_TOOL,
      JSON.stringify({
        rows: [{ CNT: 42 }],
        rowCount: 1,
        sql: 'SELECT COUNT(*) AS CNT FROM GD_GOOD',
        params: { id: 5 },
        tableName: 'GD_GOOD',
      })
    );
    assert.ok(result);
    assert.equal(result!.sql, 'SELECT COUNT(*) AS CNT FROM GD_GOOD');
    assert.deepEqual(result!.params, { id: 5 });
    assert.equal(result!.tableName, 'GD_GOOD');
  });

  it('parses columnMeta onto columns and keyFields into meta', () => {
    const result = parseTableFromToolResult(
      AGENT_PRESENT_TABLE_TOOL,
      JSON.stringify({
        rows: [{ NAME: 'Widget', GROUPKEY: 5, GOODSCOUNT: 10 }],
        rowCount: 1,
        columnMeta: {
          GROUPKEY: {
            fieldType: 'INTEGER',
            refTable: 'GD_GOODGROUP',
            constraintType: 'FOREIGN KEY',
          },
          GOODSCOUNT: { fieldType: 'INTEGER' },
        },
        keyFields: { primaryKey: ['ID'], foreignKey: ['GROUPKEY'] },
      })
    );
    assert.ok(result);
    const countCol = result!.columns.find((c) => c.key === 'GOODSCOUNT');
    assert.equal(countCol?.meta?.fieldType, 'INTEGER');
    const hiddenGroup = result!.hiddenColumns?.find((c) => c.key === 'GROUPKEY');
    assert.equal(hiddenGroup?.meta?.fieldType, 'INTEGER');
    assert.equal(hiddenGroup?.meta?.refTable, 'GD_GOODGROUP');
    assert.deepEqual(result!.meta?.keyFields?.foreignKey, ['GROUPKEY']);
  });

  it('hides RDB key columns when keyFields in payload', () => {
    const result = parseTableFromToolResult(
      AGENT_PRESENT_TABLE_TOOL,
      JSON.stringify({
        rows: [{ ID: 1, NAME: 'Материалы', GOODSCOUNT: 551 }],
        rowCount: 1,
        keyFields: { primaryKey: ['ID'], foreignKey: [] },
        columnLabels: { NAME: 'Группа', GOODSCOUNT: 'Кол-во' },
      })
    );
    assert.ok(result);
    assert.ok(!result!.columns.some((c) => c.key === 'ID'));
    assert.equal(
      result!.columns.find((c) => c.key === 'GOODSCOUNT')?.label,
      'Кол-во'
    );
  });

  it('prefers agent columnLabels over prettify', () => {
    const result = parseTableFromToolResult(
      AGENT_PRESENT_TABLE_TOOL,
      JSON.stringify({
        rows: [{ PRODUCTCOUNT: 10 }],
        rowCount: 1,
        columnLabels: { PRODUCTCOUNT: 'Кол-во SKU' },
      })
    );
    assert.equal(result!.columns[0]?.label, 'Кол-во SKU');
  });

  it('does not render internal Firebird tools as UI tables', () => {
    assert.equal(
      parseTableFromToolResult(
        'execute_sql',
        JSON.stringify({
          rows: [{ ID: 1 }],
          rowCount: 1,
        })
      ),
      null
    );
    assert.equal(
      parseTableFromToolResult(
        'list_tables',
        JSON.stringify({ tables: [{ tableName: 'GD_GOOD' }] })
      ),
      null
    );
    assert.equal(
      parseTableFromToolResult(
        'describe_table',
        JSON.stringify({
          tableName: 'GD_GOOD',
          columns: [{ fieldName: 'ID', fieldType: 'INTEGER' }],
        })
      ),
      null
    );
  });

  it('ignores non-tabular tools', () => {
    assert.equal(
      parseTableFromToolResult('get_humidity', '{"message":"50%"}'),
      null
    );
  });
});

describe('isSilentFirebirdToolUi', () => {
  it('returns false — Firebird tools use sanitized ToolCallPanel', () => {
    assert.equal(isSilentFirebirdToolUi('list_tables'), false);
    assert.equal(isSilentFirebirdToolUi('describe_table'), false);
    assert.equal(isSilentFirebirdToolUi('execute_sql'), false);
    assert.equal(isSilentFirebirdToolUi('create_query_plan'), false);
  });
});

describe('shouldShowToolCallPanel', () => {
  it('hides panel only for host tools with dedicated UI', () => {
    assert.equal(shouldShowToolCallPanel('create_query_plan'), false);
    assert.equal(shouldShowToolCallPanel('present_query_result'), false);
    assert.equal(shouldShowToolCallPanel('execute_sql'), true);
    assert.equal(shouldShowToolCallPanel('search_tables'), true);
    assert.equal(shouldShowToolCallPanel('describe_table'), true);
    assert.equal(shouldShowToolCallPanel('get_horoscope'), true);
  });
});

describe('isToolPanelVisible', () => {
  it('shows Firebird tools always', () => {
    assert.equal(isToolPanelVisible('execute_sql', false), true);
  });

  it('requires developer mode for other tools', () => {
    assert.equal(isToolPanelVisible('get_horoscope', false), false);
    assert.equal(isToolPanelVisible('get_horoscope', true), true);
  });
});
