import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeScalarValue,
  numberToDecimalString,
} from './normalize-query-value.js';

describe('numberToDecimalString', () => {
  it('keeps integers as plain digits', () => {
    assert.equal(numberToDecimalString(42), '42');
    assert.equal(numberToDecimalString(-7), '-7');
  });

  it('trims trailing zeros from decimals', () => {
    assert.equal(numberToDecimalString(147792.5), '147792.5');
    assert.equal(numberToDecimalString(1.25), '1.25');
    assert.equal(numberToDecimalString(10), '10');
  });
});

describe('normalizeScalarValue', () => {
  it('leaves safe integers as numbers', () => {
    assert.equal(normalizeScalarValue(146866007), 146866007);
  });

  it('turns non-integers into decimal strings', () => {
    assert.equal(normalizeScalarValue(515139.5), '515139.5');
    assert.equal(normalizeScalarValue(0.5), '0.5');
  });

  it('stringifies bigint', () => {
    assert.equal(normalizeScalarValue(10n), '10');
  });

  it('formats local-midnight dates as YYYY-MM-DD', () => {
    assert.equal(
      normalizeScalarValue(new Date(2023, 0, 31, 0, 0, 0, 0)),
      '2023-01-31'
    );
  });

  it('passes through null and strings', () => {
    assert.equal(normalizeScalarValue(null), null);
    assert.equal(normalizeScalarValue('ok'), 'ok');
  });
});
