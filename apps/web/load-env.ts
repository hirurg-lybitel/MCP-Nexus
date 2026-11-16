import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
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
