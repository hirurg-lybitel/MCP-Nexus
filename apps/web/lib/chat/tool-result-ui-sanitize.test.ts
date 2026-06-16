import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeToolResultForUi } from './tool-result-ui-sanitize';

describe('sanitizeToolResultForUi', () => {
  it('strips rows from execute_sql result for chat UI', () => {
    const full = JSON.stringify({
      rows: [{ ID: 1, NAME: 'Alpha', PASSW: 'secret' }],
      rowCount: 1,
      truncated: false,
    });

    const ui = JSON.parse(
      sanitizeToolResultForUi('execute_sql', full)
    ) as Record<string, unknown>;

    assert.equal(ui.rowCount, 1);
    assert.deepEqual(ui.columns, ['ID', 'NAME', 'PASSW']);
    assert.equal(ui.truncated, false);
    assert.equal(ui.rows, undefined);
  });

  it('passes through execute_sql errors unchanged', () => {
    const full = JSON.stringify({ error: 'Read-only SQL required' });
    assert.equal(sanitizeToolResultForUi('execute_sql', full), full);
  });

  it('slims describe_table columns for chat UI', () => {
    const full = JSON.stringify({
      tableName: 'GD_USER',
      tableDisplayName: 'Users',
      columns: [
        {
          fieldName: 'NAME',
          displayName: 'Имя',
          fieldType: 'VARCHAR',
          fieldLength: 80,
        },
        {
          fieldName: 'PASSW',
          displayName: 'Пароль',
          sensitive: true,
        },
      ],
    });

    const ui = JSON.parse(
      sanitizeToolResultForUi('describe_table', full)
    ) as { columns: Array<Record<string, unknown>> };

    assert.equal(ui.columns.length, 2);
    assert.equal(ui.columns[0]?.fieldName, 'NAME');
    assert.equal(ui.columns[0]?.fieldType, undefined);
    assert.equal(ui.columns[1]?.sensitive, true);
  });

  it('passes search_tables result through unchanged', () => {
    const full = JSON.stringify({
      tables: [{ tableName: 'AT_GOODS', displayName: 'Товары' }],
    });
    assert.equal(sanitizeToolResultForUi('search_tables', full), full);
  });
});
