import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/vitest.setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
    pool: 'forks',
  },
});
