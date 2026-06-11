import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Derive the repo root from this file. Pass the import.meta.url STRING straight
// to fileURLToPath (no `new URL()`) — the app's tsconfig includes the DOM lib,
// whose global URL type is incompatible with node:url's URL, which would break
// `npm run typecheck`.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // React-Native-only native module → in-memory stub so lib/* loads in Node.
      // Listed BEFORE '@/' so it wins (Vite matches longest/first applicable).
      '@react-native-async-storage/async-storage': resolve(root, 'test/stubs/async-storage.ts'),
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
