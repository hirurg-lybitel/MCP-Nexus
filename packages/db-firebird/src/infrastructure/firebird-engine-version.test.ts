import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertMinFirebirdEngineMajor,
  FirebirdUnsupportedEngineError,
  parseFirebirdEngineMajor,
} from './firebird-engine-version.js';

describe('parseFirebirdEngineMajor', () => {
  it('parses plain ENGINE_VERSION', () => {
    assert.equal(parseFirebirdEngineMajor('5.0.4'), 5);
    assert.equal(parseFirebirdEngineMajor('2.5.9'), 2);
    assert.equal(parseFirebirdEngineMajor('3.0.11'), 3);
  });

  it('parses platform-prefixed versions', () => {
    assert.equal(parseFirebirdEngineMajor('WI-V2.5.9.27139 Firebird 2.5'), 2);
    assert.equal(parseFirebirdEngineMajor('LI-V5.0.0.1306 Firebird 5.0'), 5);
  });

  it('returns null for empty/unknown', () => {
    assert.equal(parseFirebirdEngineMajor(''), null);
    assert.equal(parseFirebirdEngineMajor('unknown'), null);
  });
});

describe('assertMinFirebirdEngineMajor', () => {
  it('accepts Firebird 5+', () => {
    assert.deepEqual(assertMinFirebirdEngineMajor('5.0.4'), {
      major: 5,
      version: '5.0.4',
    });
  });

  it('rejects Firebird 2.5', () => {
    assert.throws(
      () => assertMinFirebirdEngineMajor('2.5.9'),
      FirebirdUnsupportedEngineError
    );
  });

  it('rejects Firebird 3 when min is 5', () => {
    assert.throws(
      () => assertMinFirebirdEngineMajor('3.0.10', 5),
      /Upgrade the database to Firebird 5/
    );
  });
});
