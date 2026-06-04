import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toolResultPayload } from './tool-result-payload';

describe('toolResultPayload', () => {
  it('prefers structuredContent over text content', () => {
    const payload = toolResultPayload({
      content: [{ type: 'text', text: '{"legacy":true}' }],
      structuredContent: { rows: [{ ID: 1 }], rowCount: 1, truncated: false },
    });
    const parsed = JSON.parse(payload);
    assert.equal(parsed.rowCount, 1);
    assert.deepEqual(parsed.rows, [{ ID: 1 }]);
  });

  it('falls back to text content', () => {
    const payload = toolResultPayload({
      content: [{ type: 'text', text: '{"tables":[{"tableName":"GD_GOOD"}]}' }],
    });
    assert.ok(JSON.parse(payload).tables);
  });
});
