import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunctionNames } from './compatibility-profile.js';

describe('extractFunctionNames', () => {
  const known = new Set(['G_S_DELCHAR', 'G_D_FORMATDATETIME', 'G_M_ROUNDNN']);

  it('finds UDF names used in computed source', () => {
    assert.deepEqual(
      extractFunctionNames('g_s_delchar(NUMBER)', known),
      ['G_S_DELCHAR']
    );
    assert.deepEqual(
      extractFunctionNames(
        "g_d_formatdatetime('yyyy.mm', msgstart)",
        known
      ),
      ['G_D_FORMATDATETIME']
    );
  });

  it('ignores unknown identifiers', () => {
    assert.deepEqual(extractFunctionNames('CAST(X AS INTEGER)', known), []);
  });
});
