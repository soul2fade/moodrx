import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    // The Expo/React Native app is verified via typecheck + lint + on-device,
    // not vitest. Only pure-logic libs/functions are unit-tested here.
    exclude: ['node_modules', 'dist', '.expo'],
  },
});
