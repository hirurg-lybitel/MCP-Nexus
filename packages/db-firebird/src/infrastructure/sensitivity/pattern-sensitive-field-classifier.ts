import type { FieldDescriptor } from '../../domain/sensitivity/field-descriptor';
import type { PatternSet } from '../../domain/sensitivity/pattern-set';
import type {
  SensitivitySignal,
  SensitivityVerdict,
} from '../../domain/sensitivity/sensitivity-verdict';
import type { ISensitiveFieldClassifier } from '../../ports/ISensitiveFieldClassifier';

function normalizeFieldName(name: string): string {
  return name.trim().toUpperCase();
}

function normalizeDisplayName(name: string): string {
  return name.trim();
}

export class PatternSensitiveFieldClassifier implements ISensitiveFieldClassifier {
  constructor(private readonly patternSet: PatternSet) {}

  classify(field: FieldDescriptor): SensitivityVerdict {
    const signals: SensitivitySignal[] = [];
    const fieldUpper = normalizeFieldName(field.fieldName);

    if (
      this.patternSet.fieldNamePatterns.some((pattern) =>
        pattern.test(fieldUpper)
      )
    ) {
      signals.push('fieldName');
    }

    const displayName = field.displayName?.trim();
    if (
      displayName &&
      this.patternSet.displayNamePatterns.some((pattern) =>
        pattern.test(normalizeDisplayName(displayName))
      )
    ) {
      signals.push('displayName');
    }

    return {
      sensitive: signals.length > 0,
      signals,
    };
  }
}
