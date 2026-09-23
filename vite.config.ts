import { defineConfig } from 'vite';

// The Web UI (src/web) is the Vite root. The CLI and core are built with tsc.
export default defineConfig({
  root: 'src/web',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    root: '.',
    // Scaffolding has no tests yet; a zero-test run should still succeed.
    passWithNoTests: true,
  },
});
