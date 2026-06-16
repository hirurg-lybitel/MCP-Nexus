export interface PatternSet {
  fieldNamePatterns: RegExp[];
  displayNamePatterns: RegExp[];
}

export function createDefaultPatternSet(
  extensions?: Partial<PatternSet>
): PatternSet {
  const base: PatternSet = {
    fieldNamePatterns: [
      /^PASSW(ORD)?$/i,
      /^PWD$/i,
      /^PASSWORD_HASH$/i,
      /SECRET/i,
      /TOKEN/i,
      /API[_-]?KEY/i,
      /PRIVATE[_-]?KEY/i,
      /AUTH(_)?(KEY|TOKEN)?$/i,
    ],
    displayNamePatterns: [
      /password/i,
      /парол/i,
      /secret/i,
      /секрет/i,
      /token/i,
      /токен/i,
      /api[_\s-]?key/i,
      /ключ\s*api/i,
      /private[_\s-]?key/i,
      /auth(_)?(key|token)?/i,
    ],
  };

  if (!extensions) {
    return base;
  }

  return {
    fieldNamePatterns: [
      ...base.fieldNamePatterns,
      ...(extensions.fieldNamePatterns ?? []),
    ],
    displayNamePatterns: [
      ...base.displayNamePatterns,
      ...(extensions.displayNamePatterns ?? []),
    ],
  };
}
