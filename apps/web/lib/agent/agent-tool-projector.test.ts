import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentToolProjector } from './agent-tool-projector';
import { AgentToolName } from './tool-names';

describe('AgentToolProjector', () => {
  const projector = new AgentToolProjector();

  it('projects execute_sql rows to summary with sample rows for model', () => {
    const full = JSON.stringify({
      rows: [{ ID: 1, NAME: 'Secret User', PASSW: '[REDACTED]' }],
      rowCount: 1,
      truncated: false,
    });

    const model = JSON.parse(projector.forModel('execute_sql', full)) as {
      ok: boolean;
      rowCount: number;
      columns: string[];
      sampleRows?: Record<string, unknown>[];
      rows?: unknown;
    };

    assert.equal(model.ok, true);
    assert.equal(model.rowCount, 1);
    assert.deepEqual(model.columns, ['ID', 'NAME', 'PASSW']);
    assert.deepEqual(model.sampleRows, [
      { ID: 1, NAME: 'Secret User', PASSW: '[REDACTED]' },
    ]);
    assert.equal(model.rows, undefined);
  });

  it('slims describe_table columns for model context', () => {
    const full = JSON.stringify({
      tableName: 'GD_USER',
      columns: [
        {
          fieldName: 'NAME',
          displayName: 'Имя',
          fieldType: 'VARCHAR',
          fieldLength: 80,
          nullable: true,
          position: 0,
        },
        {
          fieldName: 'PASSW',
          displayName: 'Пароль',
          sensitive: true,
          fieldType: 'VARCHAR',
          fieldLength: 32,
          nullable: true,
          position: 1,
        },
      ],
    });

    const model = JSON.parse(
      projector.forModel('describe_table', full)
    ) as { columns: Array<Record<string, unknown>> };

    assert.equal(model.columns.length, 2);
    assert.equal(model.columns[0]?.fieldName, 'NAME');
    assert.equal(model.columns[0]?.fieldType, undefined);
    assert.equal(model.columns[1]?.sensitive, true);
  });

  it('projects present_query_result to acknowledgement only', () => {
    const full = JSON.stringify({
      title: 'Users',
      rows: [{ ID: 1 }],
      rowCount: 1,
      truncated: false,
    });

    const model = JSON.parse(
      projector.forModel(AgentToolName.PresentQueryResult, full)
    ) as { presented: boolean; rowCount: number };

    assert.equal(model.presented, true);
    assert.equal(model.rowCount, 1);
    assert.equal(JSON.stringify(model).includes('"rows"'), false);
  });
});
