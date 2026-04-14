import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
    entry: ['src/index.ts'],
  },
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['get-windows'],
});
