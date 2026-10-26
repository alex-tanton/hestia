import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/cli.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Workspace packages export TypeScript source, so they are bundled in;
  // npm dependencies stay external and are installed in the image.
  noExternal: [/^@hestia\//],
});
