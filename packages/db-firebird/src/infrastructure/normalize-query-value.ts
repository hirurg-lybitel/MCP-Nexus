import {
  Blob,
  type Attachment,
  type Transaction,
} from 'node-firebird-driver-native';

/** Soft cap for text BLOBs returned to the model (bytes). */
export const DEFAULT_MAX_BLOB_BYTES = 256 * 1024;

/**
 * Format a finite JS number as a decimal string without binary float noise
 * for typical accounting scales (≤ 8 fractional digits).
 */
export function numberToDecimalString(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (Number.isInteger(value)) {
    if (
      value > Number.MAX_SAFE_INTEGER ||
      value < Number.MIN_SAFE_INTEGER
    ) {
      return value.toLocaleString('en-US', {
        useGrouping: false,
        maximumFractionDigits: 0,
      });
    }
    return String(value);
  }
  // Prefer shortest round-trip that still looks decimal (D13).
  const fixed = value.toFixed(8).replace(/\.?0+$/, '');
  return fixed === '-0' ? '0' : fixed;
}

export function isFirebirdBlob(value: unknown): value is Blob {
  return value instanceof Blob;
}

function formatDateValue(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return value.toString();
  }
  // Firebird DATE arrives as local midnight; TIMESTAMP may have a clock time.
  const hasTime =
    value.getHours() !== 0 ||
    value.getMinutes() !== 0 ||
    value.getSeconds() !== 0 ||
    value.getMilliseconds() !== 0;
  if (!hasTime) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return value.toISOString();
}

export function normalizeScalarValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) {
      if (
        value > Number.MAX_SAFE_INTEGER ||
        value < Number.MIN_SAFE_INTEGER
      ) {
        return numberToDecimalString(value);
      }
      return value;
    }
    return numberToDecimalString(value);
  }
  if (value instanceof Date) return formatDateValue(value);
  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }
  return value;
}

async function readBlobAsText(
  attachment: Attachment,
  transaction: Transaction,
  blob: Blob,
  maxBytes: number
): Promise<string> {
  const stream = await attachment.openBlob(transaction, blob);
  try {
    const length = await stream.length;
    if (length > maxBytes) {
      return `[BLOB truncated: ${length} bytes, limit ${maxBytes}]`;
    }
    const buffer = Buffer.alloc(length);
    let offset = 0;
    while (offset < length) {
      const n = await stream.read(buffer.subarray(offset));
      if (n < 0) break;
      offset += n;
    }
    // Heuristic: mostly NUL → treat as binary
    const sample = buffer.subarray(0, Math.min(buffer.length, 64));
    let nul = 0;
    for (const b of sample) {
      if (b === 0) nul += 1;
    }
    if (sample.length > 0 && nul / sample.length > 0.25) {
      return `[BLOB binary: ${length} bytes]`;
    }
    return buffer.toString('utf8');
  } finally {
    await stream.close();
  }
}

export async function normalizeRowValues(
  rows: Record<string, unknown>[],
  attachment: Attachment,
  transaction: Transaction,
  maxBlobBytes: number = DEFAULT_MAX_BLOB_BYTES
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (isFirebirdBlob(value)) {
        next[key] = await readBlobAsText(
          attachment,
          transaction,
          value,
          maxBlobBytes
        );
      } else {
        next[key] = normalizeScalarValue(value);
      }
    }
    out.push(next);
  }
  return out;
}
