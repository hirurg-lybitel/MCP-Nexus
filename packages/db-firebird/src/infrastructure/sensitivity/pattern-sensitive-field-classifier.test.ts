import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultPatternSet } from '../../domain/sensitivity/pattern-set';
import { PatternSensitiveFieldClassifier } from './pattern-sensitive-field-classifier';

describe('PatternSensitiveFieldClassifier', () => {
  const classifier = new PatternSensitiveFieldClassifier(
    createDefaultPatternSet()
  );

  it('matches password and secret field names', () => {
    assert.equal(
      classifier.classify({ fieldName: 'PASSW' }).sensitive,
      true
    );
    assert.equal(
      classifier.classify({ fieldName: 'ACCESS_TOKEN' }).sensitive,
      true
    );
    assert.deepEqual(
      classifier.classify({ fieldName: 'PASSW' }).signals,
      ['fieldName']
    );
  });

  it('matches sensitive display names from Gedemin labels', () => {
    const verdict = classifier.classify({
      fieldName: 'FIELD1',
      displayName: 'Пароль пользователя',
    });
    assert.equal(verdict.sensitive, true);
    assert.ok(verdict.signals.includes('displayName'));
  });

  it('does not match ordinary business columns', () => {
    assert.equal(
      classifier.classify({ fieldName: 'NAME', displayName: 'Наименование' })
        .sensitive,
      false
    );
  });
});
