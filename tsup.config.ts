import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: { resolve: true },
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ['get-windows'],
    outDir: 'dist',
  },
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    clean: false,
    sourcemap: true,
    treeshake: true,
    external: ['get-windows'],
    outDir: 'dist',
  },
]);
