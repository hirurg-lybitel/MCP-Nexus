import { createDefaultPatternSet } from '../../domain/sensitivity/pattern-set';
import type { ISensitiveFieldClassifier } from '../../ports/ISensitiveFieldClassifier';
import { PatternSensitiveFieldClassifier } from './pattern-sensitive-field-classifier';
import { redactSensitiveRows as redactRows } from './redact-sensitive-rows';

let defaultClassifier: ISensitiveFieldClassifier | null = null;

export function getDefaultSensitiveFieldClassifier(): ISensitiveFieldClassifier {
  if (!defaultClassifier) {
    defaultClassifier = new PatternSensitiveFieldClassifier(
      createDefaultPatternSet()
    );
  }
  return defaultClassifier;
}

/** Backward-compatible helper for apps that only have a column key. */
export function isSensitiveColumn(name: string): boolean {
  return getDefaultSensitiveFieldClassifier().classify({ fieldName: name })
    .sensitive;
}

export { REDACTED_VALUE } from './redact-sensitive-rows';

export function redactSensitiveRows(
  rows: Record<string, unknown>[],
  classifier: ISensitiveFieldClassifier = getDefaultSensitiveFieldClassifier()
): Record<string, unknown>[] {
  return redactRows(rows, classifier);
}
