import type { FieldDescriptor } from '../domain/sensitivity/field-descriptor';
import type { SensitivityVerdict } from '../domain/sensitivity/sensitivity-verdict';

export interface ISensitiveFieldClassifier {
  classify(field: FieldDescriptor): SensitivityVerdict;
}
