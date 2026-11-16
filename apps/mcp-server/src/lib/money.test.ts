import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addMoney, formatMoney, subMoney } from './money.js';

describe('money helpers', () => {
  it('adds decimal strings without float noise', () => {
    assert.equal(addMoney('823.8639', '0.0001'), '823.864');
    assert.equal(addMoney('1933.19', '0.0049'), '1933.1949');
    assert.equal(addMoney('1933.1949', '0.0002'), '1933.1951');
  });

  it('subtracts and formats driver numbers cleanly', () => {
    assert.equal(subMoney('823.8639', '0'), '823.8639');
    assert.equal(formatMoney(823.8639999999999), '823.864');
    assert.equal(formatMoney('1,25'), '1.25');
  });
});
