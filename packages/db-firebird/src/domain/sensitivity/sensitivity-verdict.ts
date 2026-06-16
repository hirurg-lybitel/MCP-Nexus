export type SensitivitySignal = 'fieldName' | 'displayName';

export interface SensitivityVerdict {
  sensitive: boolean;
  signals: SensitivitySignal[];
}
