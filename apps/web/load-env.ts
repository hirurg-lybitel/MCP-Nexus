import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveHere(): string {
  try {
    // Prefer CJS __dirname when tsup emits CommonJS (import.meta.url is undefined).
    if (typeof __dirname === 'string' && __dirname.length > 0) {
      return __dirname;
    }
  } catch {
    /* ignore */
  }
  try {
    const metaUrl = import.meta.url;
    if (typeof metaUrl === 'string' && metaUrl.length > 0) {
      return dirname(fileURLToPath(metaUrl));
    }
  } catch {
    /* ignore */
  }
  return process.cwd();
}

const here = resolveHere();
const candidates = [
  resolve(here, '../../.env'),
  resolve(here, '../.env'),
  resolve(process.cwd(), '.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    loadDotenv({ path, override: false });
    break;
  }
}
