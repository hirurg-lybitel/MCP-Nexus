import { defineConfig } from "tsup";

export default defineConfig({
  entry: ['server.ts'],
  format: ['cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false, 
  outDir: 'dist',
  external: ['next'],
});