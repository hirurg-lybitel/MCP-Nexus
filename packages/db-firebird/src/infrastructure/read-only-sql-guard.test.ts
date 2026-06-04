import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertReadOnlySql } from './read-only-sql-guard';
import { ReadOnlySqlError } from '../domain/errors';

describe('assertReadOnlySql', () => {
  it('allows SELECT', () => {
    assert.doesNotThrow(() => assertReadOnlySql('SELECT 1 FROM RDB$DATABASE'));
  });

  it('allows WITH', () => {
    assert.doesNotThrow(() =>
      assertReadOnlySql('WITH cte AS (SELECT 1 AS x FROM RDB$DATABASE) SELECT * FROM cte')
    );
  });

  it('rejects INSERT', () => {
    assert.throws(
      () => assertReadOnlySql('INSERT INTO T (ID) VALUES (1)'),
      ReadOnlySqlError
    );
  });

  it('rejects semicolon', () => {
    assert.throws(
      () => assertReadOnlySql('SELECT 1; SELECT 2'),
      ReadOnlySqlError
    );
  });

  it('rejects empty SQL', () => {
    assert.throws(() => assertReadOnlySql('   '), ReadOnlySqlError);
  });
});
