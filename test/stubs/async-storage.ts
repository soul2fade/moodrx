// Minimal in-memory stand-in for @react-native-async-storage/async-storage,
// aliased in vitest.config.ts so lib/storage.ts + lib/ui-state.ts load under
// Node. Covers the AsyncStorage surface those modules use.
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (k: string): Promise<string | null> => store.get(k) ?? null,
  multiGet: async (ks: string[]): Promise<[string, string | null][]> =>
    ks.map((k) => [k, store.get(k) ?? null]),
  setItem: async (k: string, v: string): Promise<void> => void store.set(k, v),
  removeItem: async (k: string): Promise<void> => void store.delete(k),
  multiRemove: async (ks: string[]): Promise<void> => {
    for (const k of ks) store.delete(k);
  },
  clear: async (): Promise<void> => void store.clear(),
};

export default AsyncStorage;
