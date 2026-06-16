import type { ISensitiveFieldClassifier } from '../../ports/ISensitiveFieldClassifier';

export const REDACTED_VALUE = '[REDACTED]';

export function redactSensitiveRows(
  rows: Record<string, unknown>[],
  classifier: ISensitiveFieldClassifier
): Record<string, unknown>[] {
  if (rows.length === 0) {
    return rows;
  }

  const sensitiveKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (classifier.classify({ fieldName: key }).sensitive) {
        sensitiveKeys.add(key);
      }
    }
  }

  if (sensitiveKeys.size === 0) {
    return rows;
  }

  return rows.map((row) => {
    const copy = { ...row };
    for (const key of sensitiveKeys) {
      if (key in copy) {
        copy[key] = REDACTED_VALUE;
      }
    }
    return copy;
  });
}
