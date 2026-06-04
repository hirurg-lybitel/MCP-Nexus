/**
 * Column header resolution for UI tables.
 * Primary source: Gedemin AT_RELATION_FIELDS (via present_query_result / agent columnLabels).
 * Fallback: agent-provided labels, then minimal prettifying of the SQL field name.
 */

export function normalizeColumnLabels(
  raw: unknown
): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim();
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Minimal fallback when neither AT_* nor agent supplied a label. */
export function prettifyFieldKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    return key;
  }

  return trimmed
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

export function labelForColumn(
  key: string,
  columnLabels?: Record<string, string>
): string {
  const override =
    columnLabels?.[key] ??
    columnLabels?.[key.toUpperCase()] ??
    columnLabels?.[key.toLowerCase()];

  if (override?.trim()) {
    return override.trim();
  }

  return prettifyFieldKey(key);
}
