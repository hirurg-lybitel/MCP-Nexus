/**
 * Decimal money helpers. Firebird amounts are NUMERIC(18,4) — never sum via IEEE float.
 */

const SCALE = 4;
const FACTOR = 10n ** BigInt(SCALE);

export function formatMoney(value: unknown): string {
  if (value == null) return '0';
  if (typeof value === 'bigint') return fromScaled(value * FACTOR);
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Incoming driver floats: round to scale, do not keep binary noise.
    return fromScaled(BigInt(Math.round(value * Number(FACTOR))));
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized || normalized === '-') return '0';
    return fromScaled(toScaled(normalized));
  }
  return fromScaled(toScaled(String(value)));
}

export function addMoney(a: string, b: string): string {
  return fromScaled(toScaled(a) + toScaled(b));
}

export function subMoney(a: string, b: string): string {
  return fromScaled(toScaled(a) - toScaled(b));
}

function toScaled(raw: string): bigint {
  const s = raw.trim().replace(',', '.');
  if (!s || s === '-' || s === '.' || s === '-.') return 0n;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const [intRaw = '0', fracRaw = ''] = body.split('.');
  const intPart = intRaw === '' ? '0' : intRaw;
  if (!/^\d+$/.test(intPart) || (fracRaw !== '' && !/^\d+$/.test(fracRaw))) {
    return 0n;
  }
  const frac = (fracRaw + '0'.repeat(SCALE)).slice(0, SCALE);
  const scaled = BigInt(intPart) * FACTOR + BigInt(frac);
  return neg ? -scaled : scaled;
}

function fromScaled(n: bigint): string {
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const intPart = abs / FACTOR;
  const frac = (abs % FACTOR).toString().padStart(SCALE, '0').replace(/0+$/, '');
  const out = frac ? `${intPart}.${frac}` : `${intPart}`;
  return neg && out !== '0' ? `-${out}` : out;
}
