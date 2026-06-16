import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'domain/query-result-summary': 'src/domain/query-result-summary.ts',
    'infrastructure/sensitivity/sensitive-field-compat':
      'src/infrastructure/sensitivity/sensitive-field-compat.ts',
  },
  format: ['cjs'],
  outDir: 'dist',
  target: 'node20',
  dts: true,
  clean: true,
  external: ['node-firebird-driver-native'],
});
