import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The zone/RBAC tests are deliberately hermetic: real middleware, real
    // Express app, in-memory session store. No database required.
    globals: false,
  },
});
