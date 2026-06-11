import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // React-Native-only native module → in-memory stub so lib/* loads in Node.
      // Listed BEFORE '@/' so it wins (Vite matches longest/first applicable).
      '@react-native-async-storage/async-storage': `${root}test/stubs/async-storage.ts`,
      // Mirror the tsconfig path alias so tests can import '@/lib/...'.
      // '@/' never collides with '@react-native-...' (that doesn't start with '@/').
      '@': root,
    },
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    // The Expo/React Native app is verified via typecheck + lint + on-device,
    // not vitest. Only pure-logic libs/functions are unit-tested here.
    exclude: ['node_modules', 'dist', '.expo'],
  },
});
