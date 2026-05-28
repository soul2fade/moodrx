import AsyncStorage from '@react-native-async-storage/async-storage';

const UI_STATE_KEY = '@moodrx_ui_state';

/** Legacy keys migrated into UI_STATE_KEY on first load. */
const LEGACY_KEYS = {
  notifPromptShown: '@moodrx_notif_prompt_shown',
  homeHintSeen: '@moodrx_home_hint_seen',
  carouselHintSeen: '@moodrx_carousel_hint_seen',
  navHintPending: '@moodrx_nav_hint_pending',
  navHintSeen: '@moodrx_nav_hint_seen',
  carouselPage: '@moodrx_carousel_page',
} as const;

export interface MoodRxUiState {
  notifPromptShown: boolean;
  homeHintSeen: boolean;
  carouselHintSeen: boolean;
  navHintPending: boolean;
  navHintSeen: boolean;
  lastCarouselPage: number;
}

const DEFAULT_UI_STATE: MoodRxUiState = {
  notifPromptShown: false,
  homeHintSeen: false,
  carouselHintSeen: false,
  navHintPending: false,
  navHintSeen: false,
  lastCarouselPage: 0,
};

let uiStateCache: MoodRxUiState | null = null;
let loadPromise: Promise<MoodRxUiState> | null = null;

function parseUiState(raw: string | null): MoodRxUiState {
  if (!raw) return { ...DEFAULT_UI_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<MoodRxUiState>;
    const page = parsed.lastCarouselPage;
    return {
      notifPromptShown: parsed.notifPromptShown === true,
      homeHintSeen: parsed.homeHintSeen === true,
      carouselHintSeen: parsed.carouselHintSeen === true,
      navHintPending: parsed.navHintPending === true,
      navHintSeen: parsed.navHintSeen === true,
      lastCarouselPage:
        typeof page === 'number' && Number.isFinite(page) && page >= 0 && page <= 2 ? page : 0,
    };
  } catch {
    return { ...DEFAULT_UI_STATE };
  }
}

async function migrateLegacyKeys(): Promise<MoodRxUiState> {
  const entries = await AsyncStorage.multiGet(Object.values(LEGACY_KEYS));
  const byKey = Object.fromEntries(entries) as Record<string, string | null>;
  const pageRaw = byKey[LEGACY_KEYS.carouselPage];
  const pageNum = pageRaw !== null ? parseInt(pageRaw, 10) : 0;

  return {
    notifPromptShown: byKey[LEGACY_KEYS.notifPromptShown] === 'true',
    homeHintSeen: byKey[LEGACY_KEYS.homeHintSeen] === 'true',
    carouselHintSeen: byKey[LEGACY_KEYS.carouselHintSeen] === 'true',
    navHintPending: byKey[LEGACY_KEYS.navHintPending] === 'true',
    navHintSeen: byKey[LEGACY_KEYS.navHintSeen] === 'true',
    lastCarouselPage:
      Number.isFinite(pageNum) && pageNum >= 0 && pageNum <= 2 ? pageNum : 0,
  };
}

async function persistUiState(state: MoodRxUiState): Promise<void> {
  await AsyncStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
  uiStateCache = state;
}

export async function loadUiState(): Promise<MoodRxUiState> {
  if (uiStateCache) return uiStateCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const raw = await AsyncStorage.getItem(UI_STATE_KEY);
    if (raw) {
      const parsed = parseUiState(raw);
      uiStateCache = parsed;
      return parsed;
    }

    const migrated = await migrateLegacyKeys();
    const legacyPresent = (await AsyncStorage.multiGet(Object.values(LEGACY_KEYS))).some(
      ([, v]) => v !== null,
    );
    if (legacyPresent) {
      await persistUiState(migrated);
      await AsyncStorage.multiRemove(Object.values(LEGACY_KEYS));
      return migrated;
    }

    const initial = { ...DEFAULT_UI_STATE };
    await persistUiState(initial);
    return initial;
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

export async function patchUiState(patch: Partial<MoodRxUiState>): Promise<MoodRxUiState> {
  const current = await loadUiState();
  const next = { ...current, ...patch };
  await persistUiState(next);
  return next;
}

export function invalidateUiStateCache(): void {
  uiStateCache = null;
}

export async function clearUiState(): Promise<void> {
  uiStateCache = null;
  await AsyncStorage.multiRemove([UI_STATE_KEY, ...Object.values(LEGACY_KEYS)]);
}
