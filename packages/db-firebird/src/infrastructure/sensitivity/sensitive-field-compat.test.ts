import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSensitiveColumn,
  redactSensitiveRows,
  REDACTED_VALUE,
} from './sensitive-field-compat';

describe('sensitive-field-compat', () => {
  it('isSensitiveColumn delegates to default classifier', () => {
    assert.equal(isSensitiveColumn('PASSW'), true);
    assert.equal(isSensitiveColumn('NAME'), false);
  });

  it('redactSensitiveRows replaces sensitive values', () => {
    const rows = [{ ID: 1, NAME: 'User', PASSW: '123' }];
    const redacted = redactSensitiveRows(rows);
    assert.equal(redacted[0]!.PASSW, REDACTED_VALUE);
    assert.equal(redacted[0]!.NAME, 'User');
  });
});
